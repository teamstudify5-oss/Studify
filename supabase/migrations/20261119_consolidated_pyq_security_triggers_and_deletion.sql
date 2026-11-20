-- ============================================================================
-- STUDIFY CONSOLIDATED SECURITY, TRIGGER UNIFICATION, GRANTS & DELETION FIX
-- Filename: 20261119_consolidated_pyq_security_triggers_and_deletion.sql
--
-- Non-Destructive & Idempotent:
--   - Preserves all user accounts, user_roles, buckets, storage files,
--     ratings, bookmarks, projects, moderation logs, and community_pyqs rows.
--   - Drops ONLY the conflicting pre-existing guard trigger
--     `trg_studify_guard_community_pyq_fields` ("Status field is system-controlled.")
--     and unifies column protection inside `trg_guard_community_pyqs_protected_columns`.
--   - Removes ALL unsafe `current_user IN ('postgres', 'supabase_admin')`
--     and `current_user NOT IN (...)` checks from every SECURITY DEFINER function.
--   - Replaces spoofable `app.internal_pyq_mutation = 'on'` with transaction-,
--     PID-, and target-bound HMAC-SHA256 internal mutation tokens in app_private.
--   - Fixes `sync_paper_rating_summary()` trigger cascade so deleting rated papers
--     in `delete_community_pyq_permanently()` never hits a guard trigger block.
--   - Cleans dependent references (`saved_papers`, `paper_ratings`, `paper_reports`,
--     `paper_moderation_states`, `study_projects.paper_ids`) atomically on delete.
--   - Re-asserts table RLS + minimal GRANTs and updates private `community-pyqs`
--     Storage SELECT/DELETE policies to support `owner_id`, legacy `owner`, & admins.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SCHEMA INSPECTION & NON-DESTRUCTIVE TABLE ALIGNMENT
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    con_rec record;
    v_missing_cols text;
    v_id_type text;
    v_sections_type text;
BEGIN
    IF to_regclass('public.community_pyqs') IS NULL THEN
        RAISE EXCEPTION 'Required table public.community_pyqs does not exist.';
    END IF;

    SELECT string_agg(req_col, ', ')
    INTO v_missing_cols
    FROM unnest(ARRAY[
        'id',
        'uploader_id',
        'title',
        'subject',
        'grade',
        'exam_board',
        'year',
        'file_name',
        'file_path',
        'file_url',
        'sections',
        'status',
        'views_count',
        'downloads_count'
    ]) AS req_col
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'community_pyqs'
          AND c.column_name = req_col
    );

    IF v_missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'public.community_pyqs is missing required columns: %', v_missing_cols;
    END IF;

    SELECT data_type INTO v_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'id';

    SELECT data_type INTO v_sections_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'sections';

    IF v_id_type <> 'uuid' THEN
        RAISE EXCEPTION 'Expected public.community_pyqs.id to be uuid, got %', v_id_type;
    END IF;

    IF v_sections_type NOT IN ('jsonb', 'json') THEN
        RAISE EXCEPTION 'Expected public.community_pyqs.sections to be jsonb/json, got %', v_sections_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'moderation_notes'
    ) THEN
        ALTER TABLE public.community_pyqs ADD COLUMN moderation_notes text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'is_flagged'
    ) THEN
        ALTER TABLE public.community_pyqs ADD COLUMN is_flagged boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'report_count'
    ) THEN
        ALTER TABLE public.community_pyqs ADD COLUMN report_count integer NOT NULL DEFAULT 0;
    END IF;

    FOR con_rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'community_pyqs'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* '\mstatus\M'
    LOOP
        EXECUTE format('ALTER TABLE public.community_pyqs DROP CONSTRAINT IF EXISTS %I', con_rec.conname);
    END LOOP;

    ALTER TABLE public.community_pyqs
        ADD CONSTRAINT community_pyqs_status_check CHECK (
            status IN (
                'active',
                'approved',
                'published',
                'pending',
                'rejected',
                'removed',
                'takedown',
                'taken_down',
                'flagged',
                'archived'
            )
        );
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'student')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paper_moderation_states (
    paper_id uuid PRIMARY KEY REFERENCES public.community_pyqs(id) ON DELETE CASCADE,
    is_removed boolean NOT NULL DEFAULT false,
    previous_status text NOT NULL DEFAULT 'active',
    removal_reason text,
    removed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    removed_by_label text NOT NULL DEFAULT 'Studify Administrator',
    removed_at timestamptz,
    restore_note text,
    restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    restored_by_label text,
    restored_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Non-destructive backfill for any historically removed rows lacking state records
INSERT INTO public.paper_moderation_states (
    paper_id,
    is_removed,
    previous_status,
    removal_reason,
    removed_by_label,
    removed_at
)
SELECT
    cp.id,
    true,
    'active',
    COALESCE(
        NULLIF(pg_catalog.btrim(cp.moderation_notes), ''),
        (
            SELECT NULLIF(pg_catalog.btrim(elem->>'reason'), '')
            FROM pg_catalog.jsonb_array_elements(
                CASE WHEN pg_catalog.jsonb_typeof(cp.sections::jsonb) = 'array' THEN cp.sections::jsonb ELSE '[]'::jsonb END
            ) AS elem
            WHERE elem->>'action' = 'removed_by_admin' OR elem->>'type' = 'moderation_action'
            LIMIT 1
        ),
        'Removed by Administrator'
    ),
    COALESCE(
        (
            SELECT NULLIF(pg_catalog.btrim(elem->>'adminEmail'), '')
            FROM pg_catalog.jsonb_array_elements(
                CASE WHEN pg_catalog.jsonb_typeof(cp.sections::jsonb) = 'array' THEN cp.sections::jsonb ELSE '[]'::jsonb END
            ) AS elem
            WHERE elem->>'action' = 'removed_by_admin' OR elem->>'type' = 'moderation_action'
            LIMIT 1
        ),
        'Studify Administrator'
    ),
    COALESCE(cp.updated_at, cp.created_at, now())
FROM public.community_pyqs cp
WHERE cp.status IN ('removed', 'takedown', 'taken_down')
ON CONFLICT (paper_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.paper_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id text NOT NULL,
    reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    reporter_name text NOT NULL DEFAULT 'Student',
    reporter_email text,
    reason_category text NOT NULL CHECK (
        reason_category IN (
            'copyright',
            'incorrect_content',
            'poor_quality',
            'duplicate',
            'spam',
            'unsafe_file',
            'privacy_violation',
            'other'
        )
    ),
    reason_details text NOT NULL,
    evidence_url text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed', 'takedown')),
    resolution_notes text,
    resolved_by uuid REFERENCES auth.users(id),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
    action text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('paper', 'report', 'user')),
    target_id text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_moderation_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_suspended boolean NOT NULL DEFAULT false,
    suspension_reason text,
    suspended_until timestamptz,
    suspended_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    project_id text,
    title text NOT NULL DEFAULT 'Untitled Note',
    content text NOT NULL DEFAULT '',
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_download_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    downloads_used integer NOT NULL DEFAULT 0,
    downloads_allowed integer NOT NULL DEFAULT 10,
    uploads_completed integer NOT NULL DEFAULT 0,
    current_cycle_uploads integer NOT NULL DEFAULT 0,
    upload_hashes text[] NOT NULL DEFAULT '{}'::text[],
    download_history jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paper_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text text,
    user_display_name text NOT NULL DEFAULT 'Student',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT paper_ratings_user_paper_unique UNIQUE (user_id, paper_id)
);

CREATE TABLE IF NOT EXISTS public.saved_papers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    paper_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_projects (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    subject text NOT NULL DEFAULT '',
    color text NOT NULL DEFAULT 'cyan',
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active',
    paper_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes jsonb NOT NULL DEFAULT '[]'::jsonb,
    resources jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_captures (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    text text NOT NULL DEFAULT '',
    tag text NOT NULL DEFAULT 'note',
    paper_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PRIVATE SERVER-SIDE CRYPTOGRAPHIC INFRASTRUCTURE (app_private)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.quota_signing_keys (
    id integer PRIMARY KEY,
    secret_hex text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE app_private.quota_signing_keys FROM PUBLIC, anon, authenticated;

INSERT INTO app_private.quota_signing_keys (id, secret_hex)
SELECT
    1,
    pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text || ':' || pg_catalog.clock_timestamp()::text || ':a', 'UTF8')),
        'hex'
    ) || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text || ':' || pg_catalog.clock_timestamp()::text || ':b', 'UTF8')),
        'hex'
    )
WHERE NOT EXISTS (SELECT 1 FROM app_private.quota_signing_keys WHERE id = 1);

CREATE OR REPLACE FUNCTION app_private.hmac_sha256_hex(p_message text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_secret_hex text;
    v_key_bytes bytea;
    v_ipad bytea := pg_catalog.decode(pg_catalog.repeat('00', 64), 'hex');
    v_opad bytea := pg_catalog.decode(pg_catalog.repeat('00', 64), 'hex');
    v_b integer;
    i integer;
BEGIN
    SELECT qsk.secret_hex
    INTO v_secret_hex
    FROM app_private.quota_signing_keys qsk
    WHERE qsk.id = 1;

    IF v_secret_hex IS NULL THEN
        RAISE EXCEPTION 'Server signing key is not initialized.';
    END IF;

    v_key_bytes := pg_catalog.decode(v_secret_hex, 'hex');
    IF pg_catalog.octet_length(v_key_bytes) > 64 THEN
        v_key_bytes := pg_catalog.sha256(v_key_bytes);
    END IF;

    FOR i IN 0..63 LOOP
        v_b := CASE WHEN i < pg_catalog.octet_length(v_key_bytes) THEN pg_catalog.get_byte(v_key_bytes, i) ELSE 0 END;
        v_ipad := pg_catalog.set_byte(v_ipad, i, v_b # 54);
        v_opad := pg_catalog.set_byte(v_opad, i, v_b # 92);
    END LOOP;

    RETURN pg_catalog.encode(
        pg_catalog.sha256(
            v_opad || pg_catalog.sha256(v_ipad || pg_catalog.convert_to(COALESCE(p_message, ''), 'UTF8'))
        ),
        'hex'
    );
END;
$$;
REVOKE ALL ON FUNCTION app_private.hmac_sha256_hex(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.verify_guest_quota_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_parts text[];
    v_visitor_id text;
    v_sig text;
    v_expected text;
    v_diff integer := 0;
    i integer;
BEGIN
    IF p_token IS NULL OR pg_catalog.btrim(p_token) = '' THEN
        RAISE EXCEPTION 'Invalid guest token: missing token.' USING ERRCODE = '42501';
    END IF;

    v_parts := pg_catalog.string_to_array(pg_catalog.btrim(p_token), '.');
    IF pg_catalog.array_length(v_parts, 1) IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'Invalid guest token format.' USING ERRCODE = '42501';
    END IF;

    v_visitor_id := v_parts[1];
    v_sig := pg_catalog.lower(v_parts[2]);

    IF v_visitor_id !~ '^vis_[a-f0-9]{32}$' OR v_sig !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Invalid guest token structure.' USING ERRCODE = '42501';
    END IF;

    v_expected := pg_catalog.lower(app_private.hmac_sha256_hex(v_visitor_id));
    IF pg_catalog.length(v_sig) IS DISTINCT FROM pg_catalog.length(v_expected) THEN
        RAISE EXCEPTION 'Invalid guest token signature.' USING ERRCODE = '42501';
    END IF;

    FOR i IN 1..pg_catalog.length(v_expected) LOOP
        IF pg_catalog.substr(v_sig, i, 1) IS DISTINCT FROM pg_catalog.substr(v_expected, i, 1) THEN
            v_diff := v_diff + 1;
        END IF;
    END LOOP;

    IF v_diff <> 0 THEN
        RAISE EXCEPTION 'Invalid guest token signature.' USING ERRCODE = '42501';
    END IF;

    RETURN v_visitor_id;
END;
$$;
REVOKE ALL ON FUNCTION app_private.verify_guest_quota_token(text) FROM PUBLIC, anon, authenticated;

-- Transaction- & PID-bound HMAC-SHA256 internal mutation token helpers
-- Ordinary clients cannot read quota_signing_keys or execute begin_internal_pyq_mutation,
-- so forged set_config('app_private.pyq_mutation_token', ...) always fails verification.
CREATE OR REPLACE FUNCTION app_private.begin_internal_pyq_mutation(
    p_op text,
    p_paper_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_target text := COALESCE(p_paper_id::text, '*');
    v_payload text;
    v_sig text;
BEGIN
    IF p_op NOT IN ('admin_remove', 'admin_restore', 'rating_summary', 'view_counter', 'download_counter') THEN
        RAISE EXCEPTION 'Invalid internal PYQ mutation operation: %', p_op USING ERRCODE = '22023';
    END IF;

    v_payload := 'pyq_mut:' || p_op || '|' || v_target || '|' ||
                 pg_catalog.pg_backend_pid()::text || '|' || pg_catalog.txid_current()::text;
    v_sig := app_private.hmac_sha256_hex(v_payload);

    PERFORM pg_catalog.set_config(
        'app_private.pyq_mutation_token',
        p_op || '|' || v_target || '|' || v_sig,
        true
    );
END;
$$;
REVOKE ALL ON FUNCTION app_private.begin_internal_pyq_mutation(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.verify_internal_pyq_mutation(p_paper_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token text := COALESCE(pg_catalog.current_setting('app_private.pyq_mutation_token', true), '');
    v_parts text[];
    v_op text;
    v_target text;
    v_sig text;
    v_expected text;
    v_diff integer := 0;
    i integer;
BEGIN
    IF v_token = '' THEN
        RETURN NULL;
    END IF;

    v_parts := pg_catalog.string_to_array(v_token, '|');
    IF pg_catalog.array_length(v_parts, 1) IS DISTINCT FROM 3 THEN
        RETURN NULL;
    END IF;

    v_op := v_parts[1];
    v_target := v_parts[2];
    v_sig := pg_catalog.lower(v_parts[3]);

    IF v_op NOT IN ('admin_remove', 'admin_restore', 'rating_summary', 'view_counter', 'download_counter') THEN
        RETURN NULL;
    END IF;

    IF v_target <> '*' AND v_target IS DISTINCT FROM p_paper_id::text THEN
        RETURN NULL;
    END IF;

    IF v_sig !~ '^[a-f0-9]{64}$' THEN
        RETURN NULL;
    END IF;

    v_expected := pg_catalog.lower(
        app_private.hmac_sha256_hex(
            'pyq_mut:' || v_op || '|' || v_target || '|' ||
            pg_catalog.pg_backend_pid()::text || '|' || pg_catalog.txid_current()::text
        )
    );

    IF pg_catalog.length(v_sig) IS DISTINCT FROM pg_catalog.length(v_expected) THEN
        RETURN NULL;
    END IF;

    FOR i IN 1..pg_catalog.length(v_expected) LOOP
        IF pg_catalog.substr(v_sig, i, 1) IS DISTINCT FROM pg_catalog.substr(v_expected, i, 1) THEN
            v_diff := v_diff + 1;
        END IF;
    END LOOP;

    IF v_diff <> 0 THEN
        RETURN NULL;
    END IF;

    RETURN v_op;
END;
$$;
REVOKE ALL ON FUNCTION app_private.verify_internal_pyq_mutation(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.end_internal_pyq_mutation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_catalog.set_config('app_private.pyq_mutation_token', '', true);
END;
$$;
REVOKE ALL ON FUNCTION app_private.end_internal_pyq_mutation() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. HARDENED SECURITY DEFINER HELPERS (ZERO current_user CHECKS)
-- ----------------------------------------------------------------------------

-- 3A. public.is_admin(uuid): strict auth.uid() binding (no current_user bypass)
CREATE OR REPLACE FUNCTION public.is_admin(check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid uuid := auth.uid();
    v_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF check_uid IS NULL THEN
        RETURN false;
    END IF;

    IF v_jwt_role <> 'service_role'
       AND (v_caller_uid IS NULL OR check_uid IS DISTINCT FROM v_caller_uid)
    THEN
        RETURN false;
    END IF;

    RETURN (
        EXISTS (
            SELECT 1
            FROM public.user_roles r
            WHERE r.user_id = check_uid
              AND r.role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1
            FROM auth.users u
            WHERE u.id = check_uid
              AND (
                  u.raw_app_meta_data->>'role' IN ('owner', 'admin')
                  OR u.raw_app_meta_data->>'is_admin' = 'true'
              )
        )
    );
END;
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- 3B. Storage object authorization helpers for private 'community-pyqs' bucket
CREATE OR REPLACE FUNCTION public.can_read_published_community_pyq_object(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_clean text;
BEGIN
    IF p_object_name IS NULL OR pg_catalog.btrim(p_object_name) = '' THEN
        RETURN false;
    END IF;

    v_clean := pg_catalog.ltrim(pg_catalog.btrim(p_object_name), '/');

    RETURN EXISTS (
        SELECT 1
        FROM public.community_pyqs cp
        LEFT JOIN public.paper_moderation_states pms ON pms.paper_id = cp.id
        WHERE cp.status IN ('active', 'approved', 'published')
          AND COALESCE(pms.is_removed, false) = false
          AND (
              pg_catalog.ltrim(COALESCE(cp.file_path, ''), '/') = v_clean
              OR EXISTS (
                  SELECT 1
                  FROM pg_catalog.jsonb_array_elements(
                      CASE
                          WHEN pg_catalog.jsonb_typeof(cp.sections::jsonb) = 'array' THEN cp.sections::jsonb
                          ELSE '[]'::jsonb
                      END
                  ) AS sec
                  WHERE pg_catalog.ltrim(COALESCE(sec->>'filePath', sec->>'path', ''), '/') = v_clean
                     OR EXISTS (
                         SELECT 1
                         FROM pg_catalog.jsonb_array_elements_text(
                             CASE
                                 WHEN pg_catalog.jsonb_typeof(sec->'imagePaths') = 'array' THEN sec->'imagePaths'
                                 ELSE '[]'::jsonb
                             END
                         ) AS img_path
                         WHERE pg_catalog.ltrim(img_path, '/') = v_clean
                     )
              )
          )
    );
END;
$$;
REVOKE ALL ON FUNCTION public.can_read_published_community_pyq_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_published_community_pyq_object(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_community_pyq_object(p_object_name text, check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid uuid := auth.uid();
    v_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
    v_clean text;
BEGIN
    IF p_object_name IS NULL OR pg_catalog.btrim(p_object_name) = '' THEN
        RETURN false;
    END IF;

    IF public.can_read_published_community_pyq_object(p_object_name) THEN
        RETURN true;
    END IF;

    IF check_uid IS NULL THEN
        RETURN false;
    END IF;

    IF v_jwt_role <> 'service_role'
       AND (v_caller_uid IS NULL OR check_uid IS DISTINCT FROM v_caller_uid)
    THEN
        RETURN false;
    END IF;

    IF public.is_admin(check_uid) THEN
        RETURN true;
    END IF;

    v_clean := pg_catalog.ltrim(pg_catalog.btrim(p_object_name), '/');

    RETURN EXISTS (
        SELECT 1
        FROM public.community_pyqs cp
        WHERE cp.uploader_id = check_uid
          AND (
              pg_catalog.ltrim(COALESCE(cp.file_path, ''), '/') = v_clean
              OR EXISTS (
                  SELECT 1
                  FROM pg_catalog.jsonb_array_elements(
                      CASE
                          WHEN pg_catalog.jsonb_typeof(cp.sections::jsonb) = 'array' THEN cp.sections::jsonb
                          ELSE '[]'::jsonb
                      END
                  ) AS sec
                  WHERE pg_catalog.ltrim(COALESCE(sec->>'filePath', sec->>'path', ''), '/') = v_clean
                     OR EXISTS (
                         SELECT 1
                         FROM pg_catalog.jsonb_array_elements_text(
                             CASE
                                 WHEN pg_catalog.jsonb_typeof(sec->'imagePaths') = 'array' THEN sec->'imagePaths'
                                 ELSE '[]'::jsonb
                             END
                         ) AS img_path
                         WHERE pg_catalog.ltrim(img_path, '/') = v_clean
                     )
              )
          )
    );
END;
$$;
REVOKE ALL ON FUNCTION public.can_read_community_pyq_object(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_community_pyq_object(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_paper_removed(p_paper_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.paper_moderation_states pms
        WHERE pms.paper_id = p_paper_id
          AND pms.is_removed = true
    );
$$;
REVOKE ALL ON FUNCTION public.is_paper_removed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_paper_removed(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_paper_uploader(p_paper_id uuid, check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid uuid := auth.uid();
    v_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF p_paper_id IS NULL OR check_uid IS NULL THEN
        RETURN false;
    END IF;

    IF v_jwt_role <> 'service_role'
       AND (v_caller_uid IS NULL OR check_uid IS DISTINCT FROM v_caller_uid)
    THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.community_pyqs cp
        WHERE cp.id = p_paper_id
          AND cp.uploader_id = check_uid
    );
END;
$$;
REVOKE ALL ON FUNCTION public.is_paper_uploader(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paper_uploader(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_paper_uploader_text(p_paper_id text, check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid uuid := auth.uid();
    v_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF p_paper_id IS NULL OR pg_catalog.btrim(p_paper_id) = '' OR check_uid IS NULL THEN
        RETURN false;
    END IF;

    IF v_jwt_role <> 'service_role'
       AND (v_caller_uid IS NULL OR check_uid IS DISTINCT FROM v_caller_uid)
    THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.community_pyqs cp
        WHERE cp.id::text = p_paper_id
          AND cp.uploader_id = check_uid
    );
END;
$$;
REVOKE ALL ON FUNCTION public.is_paper_uploader_text(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paper_uploader_text(text, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. UNIFY TRIGGERS & HARDEN PROTECTED-COLUMN GUARD
-- ----------------------------------------------------------------------------
-- Explicitly remove ONLY the conflicting status/counter trigger from community_pyqs
DROP TRIGGER IF EXISTS trg_studify_guard_community_pyq_fields ON public.community_pyqs;

-- Drop obsolete trigger function only if zero triggers still reference it
DO $$
DECLARE
    v_fn_oid oid;
    v_ref_count integer;
BEGIN
    SELECT p.oid INTO v_fn_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'studify_guard_community_pyq_fields'
    LIMIT 1;

    IF v_fn_oid IS NOT NULL THEN
        SELECT count(*) INTO v_ref_count FROM pg_trigger WHERE tgfoid = v_fn_oid;
        IF v_ref_count = 0 THEN
            DROP FUNCTION IF EXISTS public.studify_guard_community_pyq_fields();
        END IF;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_community_pyqs_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid uuid := auth.uid();
    v_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
    v_internal_op text := app_private.verify_internal_pyq_mutation(NEW.id);
    v_is_admin boolean := false;
BEGIN
    -- 1. Trusted backend service_role
    IF v_jwt_role = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- 2. Cryptographically verified transaction/PID/target-bound internal RPC operation
    --    with strict per-operation column allowlists (cannot mutate arbitrary columns)
    IF v_internal_op = 'rating_summary' THEN
        IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes
           OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
           OR NEW.report_count IS DISTINCT FROM OLD.report_count
           OR NEW.views_count IS DISTINCT FROM OLD.views_count
           OR NEW.downloads_count IS DISTINCT FROM OLD.downloads_count
        THEN
            RAISE EXCEPTION 'Unauthorized column mutation during rating summary sync.' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF v_internal_op = 'view_counter' THEN
        IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes
           OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
           OR NEW.report_count IS DISTINCT FROM OLD.report_count
           OR NEW.downloads_count IS DISTINCT FROM OLD.downloads_count
           OR NEW.rating IS DISTINCT FROM OLD.rating
           OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
        THEN
            RAISE EXCEPTION 'Unauthorized column mutation during view counter update.' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF v_internal_op = 'download_counter' THEN
        IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes
           OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
           OR NEW.report_count IS DISTINCT FROM OLD.report_count
           OR NEW.views_count IS DISTINCT FROM OLD.views_count
           OR NEW.rating IS DISTINCT FROM OLD.rating
           OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
        THEN
            RAISE EXCEPTION 'Unauthorized column mutation during download counter update.' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF v_caller_uid IS NOT NULL THEN
        v_is_admin := public.is_admin(v_caller_uid);
    END IF;

    IF v_internal_op IN ('admin_remove', 'admin_restore') THEN
        IF NOT v_is_admin THEN
            RAISE EXCEPTION 'Administrator privileges required for moderation state change.' USING ERRCODE = '42501';
        END IF;
        IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
           OR NEW.views_count IS DISTINCT FROM OLD.views_count
           OR NEW.downloads_count IS DISTINCT FROM OLD.downloads_count
           OR NEW.rating IS DISTINCT FROM OLD.rating
           OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
        THEN
            RAISE EXCEPTION 'Unauthorized ownership/counter mutation during moderation operation.' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Direct updates by a verified administrator
    IF v_is_admin THEN
        IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
            RAISE EXCEPTION 'Cannot change paper uploader_id.' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- 4. Ordinary authenticated uploader editing metadata only:
    --    strictly blocks mutations to ownership, status, moderation fields, and counters.
    IF NEW.uploader_id IS DISTINCT FROM OLD.uploader_id THEN
        RAISE EXCEPTION 'Cannot change paper uploader_id.' USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Only administrators may alter paper publication status.' USING ERRCODE = '42501';
    END IF;

    IF NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes
       OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
       OR NEW.report_count IS DISTINCT FROM OLD.report_count
    THEN
        RAISE EXCEPTION 'Only administrators may alter moderation metadata.' USING ERRCODE = '42501';
    END IF;

    IF NEW.views_count IS DISTINCT FROM OLD.views_count
       OR NEW.downloads_count IS DISTINCT FROM OLD.downloads_count
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
    THEN
        RAISE EXCEPTION 'Aggregate counters are system-managed.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_community_pyqs_protected_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_community_pyqs_protected_columns ON public.community_pyqs;
CREATE TRIGGER trg_guard_community_pyqs_protected_columns
BEFORE UPDATE ON public.community_pyqs
FOR EACH ROW
EXECUTE FUNCTION public.guard_community_pyqs_protected_columns();

-- 4B. Rating summary trigger (uses cryptographic internal token scoped to target paper)
CREATE OR REPLACE FUNCTION public.sync_paper_rating_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_paper_id text;
    target_paper_uuid uuid;
    avg_rating numeric;
    total_count integer;
    cpyq_rating_nullable text;
    cpyq_has_rating_count boolean;
    papers_rating_nullable text;
    papers_has_rating_count boolean;
BEGIN
    target_paper_id := COALESCE(NEW.paper_id, OLD.paper_id);

    SELECT
        pg_catalog.round(pg_catalog.avg(rating)::numeric, 1),
        pg_catalog.count(*)::integer
    INTO avg_rating, total_count
    FROM public.paper_ratings
    WHERE paper_id = target_paper_id;

    total_count := COALESCE(total_count, 0);

    IF target_paper_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        target_paper_uuid := target_paper_id::uuid;
    END IF;

    IF target_paper_uuid IS NOT NULL AND pg_catalog.to_regclass('public.community_pyqs') IS NOT NULL THEN
        SELECT c.is_nullable
        INTO cpyq_rating_nullable
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'community_pyqs'
          AND c.column_name = 'rating';

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'community_pyqs'
              AND c.column_name = 'rating_count'
        ) INTO cpyq_has_rating_count;

        IF cpyq_rating_nullable IS NOT NULL AND cpyq_has_rating_count THEN
            PERFORM app_private.begin_internal_pyq_mutation('rating_summary', target_paper_uuid);
            UPDATE public.community_pyqs
            SET
                rating = CASE
                    WHEN total_count > 0 THEN avg_rating
                    WHEN cpyq_rating_nullable = 'YES' THEN NULL
                    ELSE 0
                END,
                rating_count = total_count
            WHERE id = target_paper_uuid;
            PERFORM app_private.end_internal_pyq_mutation();
        END IF;
    END IF;

    IF pg_catalog.to_regclass('public.papers') IS NOT NULL THEN
        SELECT c.is_nullable
        INTO papers_rating_nullable
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'papers'
          AND c.column_name = 'rating';

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'papers'
              AND c.column_name = 'rating_count'
        ) INTO papers_has_rating_count;

        IF papers_rating_nullable IS NOT NULL AND papers_has_rating_count THEN
            UPDATE public.papers
            SET
                rating = CASE
                    WHEN total_count > 0 THEN avg_rating
                    WHEN papers_rating_nullable = 'YES' THEN NULL
                    ELSE 0
                END,
                rating_count = total_count
            WHERE id::text = target_paper_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_paper_rating_summary() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_paper_rating_summary ON public.paper_ratings;
CREATE TRIGGER trg_sync_paper_rating_summary
AFTER INSERT OR UPDATE OR DELETE ON public.paper_ratings
FOR EACH ROW
EXECUTE FUNCTION public.sync_paper_rating_summary();

-- 4C. View & download counter RPCs
CREATE OR REPLACE FUNCTION public.increment_community_pyq_view(target_pyq_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM app_private.begin_internal_pyq_mutation('view_counter', target_pyq_id);
    UPDATE public.community_pyqs cp
    SET views_count = COALESCE(cp.views_count, 0) + 1
    WHERE cp.id = target_pyq_id
      AND cp.status IN ('active', 'approved', 'published')
      AND NOT EXISTS (
          SELECT 1 FROM public.paper_moderation_states pms
          WHERE pms.paper_id = cp.id AND pms.is_removed = true
      );
    PERFORM app_private.end_internal_pyq_mutation();
END;
$$;
REVOKE ALL ON FUNCTION public.increment_community_pyq_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_community_pyq_view(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_community_pyq_download(target_pyq_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM app_private.begin_internal_pyq_mutation('download_counter', target_pyq_id);
    UPDATE public.community_pyqs cp
    SET downloads_count = COALESCE(cp.downloads_count, 0) + 1
    WHERE cp.id = target_pyq_id
      AND cp.status IN ('active', 'approved', 'published')
      AND NOT EXISTS (
          SELECT 1 FROM public.paper_moderation_states pms
          WHERE pms.paper_id = cp.id AND pms.is_removed = true
      );
    PERFORM app_private.end_internal_pyq_mutation();
END;
$$;
REVOKE ALL ON FUNCTION public.increment_community_pyq_download(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_community_pyq_download(uuid) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. ADMIN REMOVE / RESTORE / LIST / NOTICE / PERMANENT DELETE & QUOTA RPCS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_remove_paper(
    p_paper_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_clean_reason text := pg_catalog.btrim(COALESCE(p_reason, ''));
    v_row public.community_pyqs%ROWTYPE;
    v_existing_state public.paper_moderation_states%ROWTYPE;
    v_previous_status text;
    v_admin_email text;
    v_now timestamptz := pg_catalog.now();
BEGIN
    IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
        RAISE EXCEPTION 'Permission denied: verified administrator privileges required.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_reason = '' THEN
        RAISE EXCEPTION 'A mandatory reason for removal is required.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_row
    FROM public.community_pyqs
    WHERE id = p_paper_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Paper not found.');
    END IF;

    SELECT * INTO v_existing_state
    FROM public.paper_moderation_states
    WHERE paper_id = p_paper_id
    FOR UPDATE;

    v_previous_status := CASE
        WHEN v_row.status IN ('removed', 'takedown', 'taken_down') THEN
            COALESCE(NULLIF(v_existing_state.previous_status, ''), 'active')
        ELSE v_row.status
    END;

    SELECT COALESCE(NULLIF(pg_catalog.btrim(u.email), ''), 'Studify Administrator')
    INTO v_admin_email
    FROM auth.users u
    WHERE u.id = v_uid;

    INSERT INTO public.paper_moderation_states (
        paper_id,
        is_removed,
        previous_status,
        removal_reason,
        removed_by,
        removed_by_label,
        removed_at,
        updated_at
    )
    VALUES (
        p_paper_id,
        true,
        v_previous_status,
        v_clean_reason,
        v_uid,
        COALESCE(v_admin_email, 'Studify Administrator'),
        v_now,
        v_now
    )
    ON CONFLICT (paper_id) DO UPDATE SET
        is_removed = true,
        previous_status = EXCLUDED.previous_status,
        removal_reason = EXCLUDED.removal_reason,
        removed_by = EXCLUDED.removed_by,
        removed_by_label = EXCLUDED.removed_by_label,
        removed_at = EXCLUDED.removed_at,
        updated_at = EXCLUDED.updated_at;

    PERFORM app_private.begin_internal_pyq_mutation('admin_remove', p_paper_id);

    UPDATE public.community_pyqs
    SET
        status = 'removed',
        moderation_notes = v_clean_reason,
        updated_at = v_now
    WHERE id = p_paper_id;

    PERFORM app_private.end_internal_pyq_mutation();

    UPDATE public.paper_reports
    SET
        status = 'takedown',
        resolution_notes = v_clean_reason,
        resolved_by = v_uid,
        resolved_at = v_now
    WHERE paper_id = p_paper_id::text
      AND status = 'pending';

    INSERT INTO public.moderation_logs (
        moderator_id,
        action,
        target_type,
        target_id,
        reason,
        metadata
    )
    VALUES (
        v_uid,
        'remove_paper',
        'paper',
        p_paper_id::text,
        v_clean_reason,
        jsonb_build_object(
            'moderatorEmail', COALESCE(v_admin_email, 'Studify Administrator'),
            'previousStatus', v_previous_status,
            'paperTitle', v_row.title,
            'uploaderId', v_row.uploader_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'paper_id', p_paper_id,
        'previous_status', v_previous_status,
        'status', 'removed'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_paper(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_paper(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_restore_paper(
    p_paper_id uuid,
    p_restore_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_row public.community_pyqs%ROWTYPE;
    v_state public.paper_moderation_states%ROWTYPE;
    v_target_status text;
    v_admin_email text;
    v_now timestamptz := pg_catalog.now();
BEGIN
    IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
        RAISE EXCEPTION 'Permission denied: verified administrator privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_row
    FROM public.community_pyqs
    WHERE id = p_paper_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paper not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_state
    FROM public.paper_moderation_states
    WHERE paper_id = p_paper_id
    FOR UPDATE;

    v_target_status := CASE
        WHEN COALESCE(v_state.previous_status, '') IN ('active', 'approved', 'published', 'pending')
            THEN v_state.previous_status
        ELSE 'active'
    END;

    SELECT COALESCE(NULLIF(pg_catalog.btrim(u.email), ''), 'Studify Administrator')
    INTO v_admin_email
    FROM auth.users u
    WHERE u.id = v_uid;

    INSERT INTO public.paper_moderation_states (
        paper_id,
        is_removed,
        previous_status,
        restore_note,
        restored_by,
        restored_by_label,
        restored_at,
        updated_at
    )
    VALUES (
        p_paper_id,
        false,
        v_target_status,
        NULLIF(pg_catalog.btrim(COALESCE(p_restore_note, '')), ''),
        v_uid,
        COALESCE(v_admin_email, 'Studify Administrator'),
        v_now,
        v_now
    )
    ON CONFLICT (paper_id) DO UPDATE SET
        is_removed = false,
        restore_note = EXCLUDED.restore_note,
        restored_by = EXCLUDED.restored_by,
        restored_by_label = EXCLUDED.restored_by_label,
        restored_at = EXCLUDED.restored_at,
        updated_at = EXCLUDED.updated_at;

    PERFORM app_private.begin_internal_pyq_mutation('admin_restore', p_paper_id);

    UPDATE public.community_pyqs
    SET
        status = v_target_status,
        moderation_notes = NULL,
        is_flagged = false,
        updated_at = v_now
    WHERE id = p_paper_id
    RETURNING * INTO v_row;

    PERFORM app_private.end_internal_pyq_mutation();

    INSERT INTO public.moderation_logs (
        moderator_id,
        action,
        target_type,
        target_id,
        reason,
        metadata
    )
    VALUES (
        v_uid,
        'restore_paper',
        'paper',
        p_paper_id::text,
        COALESCE(NULLIF(pg_catalog.btrim(COALESCE(p_restore_note, '')), ''), 'Restored to previous published state'),
        jsonb_build_object(
            'moderatorEmail', COALESCE(v_admin_email, 'Studify Administrator'),
            'restoredStatus', v_target_status,
            'paperTitle', v_row.title,
            'previousRemovalReason', v_state.removal_reason
        )
    );

    RETURN pg_catalog.to_jsonb(v_row) || jsonb_build_object(
        'is_removed', false,
        'previous_status', v_target_status
    );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_restore_paper(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_paper(uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_list_removed_papers();

CREATE OR REPLACE FUNCTION public.admin_list_removed_papers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
        RAISE EXCEPTION 'Permission denied: verified administrator privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
        pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(cp) || pg_catalog.jsonb_build_object(
                'previous_status', COALESCE(pms.previous_status, 'active'),
                'removal_reason', COALESCE(pms.removal_reason, cp.moderation_notes, 'Removed by Administrator'),
                'removed_by_label', COALESCE(pms.removed_by_label, 'Studify Administrator'),
                'removed_at', COALESCE(pms.removed_at, cp.updated_at, cp.created_at),
                'is_removed', true
            )
            ORDER BY COALESCE(pms.removed_at, cp.updated_at, cp.created_at) DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM public.community_pyqs cp
    LEFT JOIN public.paper_moderation_states pms ON pms.paper_id = cp.id
    WHERE cp.status IN ('removed', 'takedown', 'taken_down')
       OR COALESCE(pms.is_removed, false) = true;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_removed_papers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_removed_papers() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_paper_removal_notice(p_paper_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    subject text,
    exam_board text,
    grade text,
    year integer,
    removal_reason text,
    removed_at timestamptz,
    removed_by text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        cp.id,
        cp.title::text,
        cp.subject::text,
        cp.exam_board::text,
        cp.grade::text,
        cp.year::integer,
        COALESCE(pms.removal_reason, cp.moderation_notes, 'Removed by Administrator')::text AS removal_reason,
        COALESCE(pms.removed_at, cp.updated_at, cp.created_at)::timestamptz AS removed_at,
        'Studify Administrator'::text AS removed_by
    FROM public.community_pyqs cp
    LEFT JOIN public.paper_moderation_states pms ON pms.paper_id = cp.id
    WHERE cp.id = p_paper_id
      AND (
          cp.status IN ('removed', 'takedown', 'taken_down')
          OR COALESCE(pms.is_removed, false) = true
      )
    LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_paper_removal_notice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paper_removal_notice(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_community_pyq_permanently(p_paper_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_is_admin boolean;
    v_row public.community_pyqs%ROWTYPE;
    v_admin_email text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_is_admin := public.is_admin(v_uid);

    SELECT * INTO v_row
    FROM public.community_pyqs
    WHERE id = p_paper_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('deleted', false, 'error', 'Paper not found.');
    END IF;

    IF v_row.uploader_id IS DISTINCT FROM v_uid AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied: only the uploader or a verified admin can delete this paper.' USING ERRCODE = '42501';
    END IF;

    -- Clean up dependent user references & ratings safely (rating trigger uses HMAC token)
    DELETE FROM public.saved_papers WHERE paper_id = p_paper_id::text;
    DELETE FROM public.paper_ratings WHERE paper_id = p_paper_id::text;
    DELETE FROM public.paper_reports WHERE paper_id = p_paper_id::text;
    DELETE FROM public.paper_moderation_states WHERE paper_id = p_paper_id;

    -- Prune deleted paper ID from any study project references across accounts
    IF pg_catalog.to_regclass('public.study_projects') IS NOT NULL THEN
        UPDATE public.study_projects sp
        SET
            paper_ids = COALESCE(
                (
                    SELECT pg_catalog.jsonb_agg(elem)
                    FROM pg_catalog.jsonb_array_elements_text(
                        CASE
                            WHEN pg_catalog.jsonb_typeof(sp.paper_ids) = 'array' THEN sp.paper_ids
                            ELSE '[]'::jsonb
                        END
                    ) AS elem
                    WHERE elem <> p_paper_id::text
                ),
                '[]'::jsonb
            ),
            updated_at = pg_catalog.now()
        WHERE pg_catalog.jsonb_typeof(sp.paper_ids) = 'array'
          AND sp.paper_ids @> pg_catalog.jsonb_build_array(p_paper_id::text);
    END IF;

    DELETE FROM public.community_pyqs WHERE id = p_paper_id;

    IF pg_catalog.to_regclass('public.papers') IS NOT NULL THEN
        DELETE FROM public.papers WHERE id::text = p_paper_id::text;
    END IF;

    IF v_is_admin THEN
        SELECT COALESCE(NULLIF(pg_catalog.btrim(u.email), ''), 'Studify Administrator')
        INTO v_admin_email
        FROM auth.users u
        WHERE u.id = v_uid;

        INSERT INTO public.moderation_logs (
            moderator_id,
            action,
            target_type,
            target_id,
            reason,
            metadata
        )
        VALUES (
            v_uid,
            'permanent_delete_paper',
            'paper',
            p_paper_id::text,
            'Permanent deletion confirmed after Storage object cleanup',
            jsonb_build_object(
                'moderatorEmail', COALESCE(v_admin_email, 'Studify Administrator'),
                'paperTitle', v_row.title,
                'uploaderId', v_row.uploader_id
            )
        );
    END IF;

    RETURN jsonb_build_object('deleted', true, 'id', p_paper_id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_community_pyq_permanently(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_community_pyq_permanently(uuid) TO authenticated, service_role;

-- Quota RPCs preserved identically so migration is self-contained
CREATE OR REPLACE FUNCTION public.issue_guest_quota_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_visitor_id text;
    v_sig text;
BEGIN
    v_visitor_id := 'vis_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
    v_sig := app_private.hmac_sha256_hex(v_visitor_id);

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        'anon:' || v_visitor_id,
        NULL,
        v_visitor_id,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    RETURN v_visitor_id || '.' || v_sig;
END;
$$;
REVOKE ALL ON FUNCTION public.issue_guest_quota_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_guest_quota_token() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_guest_download_quota(p_token text)
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_visitor_id text;
    v_identifier text;
    v_row public.user_download_quotas%ROWTYPE;
BEGIN
    v_visitor_id := app_private.verify_guest_quota_token(p_token);
    v_identifier := 'anon:' || v_visitor_id;

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_identifier,
        NULL,
        v_visitor_id,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.user_download_quotas
    WHERE identifier = v_identifier;

    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.get_guest_download_quota(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_download_quota(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_guest_download_quota(
    p_token text,
    p_paper_id text,
    p_paper_title text DEFAULT 'Question Paper'
)
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_visitor_id text;
    v_identifier text;
    v_row public.user_download_quotas%ROWTYPE;
    v_entry jsonb;
    v_now timestamptz := pg_catalog.now();
BEGIN
    v_visitor_id := app_private.verify_guest_quota_token(p_token);
    v_identifier := 'anon:' || v_visitor_id;

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_identifier,
        NULL,
        v_visitor_id,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.user_download_quotas
    WHERE identifier = v_identifier
    FOR UPDATE;

    IF v_row.downloads_used >= v_row.downloads_allowed THEN
        RAISE EXCEPTION 'Guest download quota reached.' USING ERRCODE = 'P0001';
    END IF;

    v_entry := jsonb_build_array(
        jsonb_build_object(
            'paperId', COALESCE(p_paper_id, ''),
            'paperTitle', COALESCE(NULLIF(pg_catalog.btrim(p_paper_title), ''), 'Question Paper'),
            'timestamp', v_now
        )
    );

    UPDATE public.user_download_quotas
    SET
        downloads_used = v_row.downloads_used + 1,
        download_history = (
            SELECT COALESCE(pg_catalog.jsonb_agg(elem), '[]'::jsonb)
            FROM (
                SELECT elem
                FROM pg_catalog.jsonb_array_elements(v_entry || COALESCE(v_row.download_history, '[]'::jsonb)) AS t(elem)
                LIMIT 50
            ) s
        ),
        updated_at = v_now
    WHERE identifier = v_identifier
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.record_guest_download_quota(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_guest_download_quota(text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_download_quota(p_visitor_id text DEFAULT '')
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_identifier text;
    v_visitor text;
    v_row public.user_download_quotas%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_identifier := 'user:' || v_uid::text;
    v_visitor := COALESCE(NULLIF(pg_catalog.btrim(p_visitor_id), ''), v_identifier);

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_identifier,
        v_uid,
        v_visitor,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.user_download_quotas
    WHERE identifier = v_identifier;

    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.get_auth_download_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_download_quota(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_auth_download_quota(
    p_paper_id text,
    p_paper_title text DEFAULT 'Question Paper',
    p_visitor_id text DEFAULT ''
)
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_identifier text;
    v_visitor text;
    v_row public.user_download_quotas%ROWTYPE;
    v_entry jsonb;
    v_now timestamptz := pg_catalog.now();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_identifier := 'user:' || v_uid::text;
    v_visitor := COALESCE(NULLIF(pg_catalog.btrim(p_visitor_id), ''), v_identifier);

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_identifier,
        v_uid,
        v_visitor,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.user_download_quotas
    WHERE identifier = v_identifier
    FOR UPDATE;

    IF v_row.downloads_used >= v_row.downloads_allowed THEN
        RAISE EXCEPTION 'Download quota reached.' USING ERRCODE = 'P0001';
    END IF;

    v_entry := jsonb_build_array(
        jsonb_build_object(
            'paperId', COALESCE(p_paper_id, ''),
            'paperTitle', COALESCE(NULLIF(pg_catalog.btrim(p_paper_title), ''), 'Question Paper'),
            'timestamp', v_now
        )
    );

    UPDATE public.user_download_quotas
    SET
        user_id = v_uid,
        downloads_used = v_row.downloads_used + 1,
        download_history = (
            SELECT COALESCE(pg_catalog.jsonb_agg(elem), '[]'::jsonb)
            FROM (
                SELECT elem
                FROM pg_catalog.jsonb_array_elements(v_entry || COALESCE(v_row.download_history, '[]'::jsonb)) AS t(elem)
                LIMIT 50
            ) s
        ),
        updated_at = v_now
    WHERE identifier = v_identifier
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.record_auth_download_quota(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_auth_download_quota(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_auth_upload_quota(
    p_file_hash text,
    p_visitor_id text DEFAULT ''
)
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_clean_hash text := pg_catalog.btrim(COALESCE(p_file_hash, ''));
    v_identifier text;
    v_visitor text;
    v_row public.user_download_quotas%ROWTYPE;
    v_next_cycle integer;
    v_next_allowed integer;
    v_now timestamptz := pg_catalog.now();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_hash = '' THEN
        RAISE EXCEPTION 'Missing file hash.' USING ERRCODE = '22023';
    END IF;

    v_identifier := 'user:' || v_uid::text;
    v_visitor := COALESCE(NULLIF(pg_catalog.btrim(p_visitor_id), ''), v_identifier);

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_identifier,
        v_uid,
        v_visitor,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.user_download_quotas
    WHERE identifier = v_identifier
    FOR UPDATE;

    IF v_clean_hash = ANY(COALESCE(v_row.upload_hashes, '{}'::text[])) THEN
        RAISE EXCEPTION 'Duplicate upload hash detected.' USING ERRCODE = '23505';
    END IF;

    v_next_cycle := COALESCE(v_row.current_cycle_uploads, 0) + 1;
    v_next_allowed := COALESCE(v_row.downloads_allowed, 10);

    IF v_next_cycle >= 2 THEN
        v_next_allowed := v_next_allowed + 10;
        v_next_cycle := 0;
    END IF;

    UPDATE public.user_download_quotas
    SET
        user_id = v_uid,
        uploads_completed = COALESCE(v_row.uploads_completed, 0) + 1,
        current_cycle_uploads = v_next_cycle,
        downloads_allowed = v_next_allowed,
        upload_hashes = pg_catalog.array_append(COALESCE(v_row.upload_hashes, '{}'::text[]), v_clean_hash),
        updated_at = v_now
    WHERE identifier = v_identifier
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.record_auth_upload_quota(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_auth_upload_quota(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.merge_guest_quota_into_user(p_guest_token text)
RETURNS public.user_download_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_visitor_id text;
    v_anon_id text;
    v_user_id text;
    v_anon_row public.user_download_quotas%ROWTYPE;
    v_user_row public.user_download_quotas%ROWTYPE;
    v_now timestamptz := pg_catalog.now();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_visitor_id := app_private.verify_guest_quota_token(p_guest_token);
    v_anon_id := 'anon:' || v_visitor_id;
    v_user_id := 'user:' || v_uid::text;

    SELECT * INTO v_anon_row
    FROM public.user_download_quotas
    WHERE identifier = v_anon_id
    FOR UPDATE;

    INSERT INTO public.user_download_quotas (
        identifier,
        user_id,
        visitor_id,
        downloads_used,
        downloads_allowed
    )
    VALUES (
        v_user_id,
        v_uid,
        v_visitor_id,
        0,
        10
    )
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_user_row
    FROM public.user_download_quotas
    WHERE identifier = v_user_id
    FOR UPDATE;

    IF v_anon_row.id IS NOT NULL AND v_anon_row.downloads_used > 0 THEN
        UPDATE public.user_download_quotas
        SET
            user_id = v_uid,
            downloads_used = GREATEST(v_user_row.downloads_used, v_anon_row.downloads_used),
            downloads_allowed = GREATEST(v_user_row.downloads_allowed, v_anon_row.downloads_allowed),
            download_history = (
                SELECT COALESCE(pg_catalog.jsonb_agg(elem), '[]'::jsonb)
                FROM (
                    SELECT elem
                    FROM pg_catalog.jsonb_array_elements(
                        COALESCE(v_user_row.download_history, '[]'::jsonb) || COALESCE(v_anon_row.download_history, '[]'::jsonb)
                    ) AS t(elem)
                    LIMIT 50
                ) s
            ),
            updated_at = v_now
        WHERE identifier = v_user_id
        RETURNING * INTO v_user_row;
    END IF;

    RETURN v_user_row;
END;
$$;
REVOKE ALL ON FUNCTION public.merge_guest_quota_into_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_guest_quota_into_user(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. ENABLE RLS & APPLY ROLE-SCOPED POLICIES ON PUBLIC TABLES
-- ----------------------------------------------------------------------------

-- 6A. public.community_pyqs
ALTER TABLE public.community_pyqs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'community_pyqs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_pyqs', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Community PYQs Anon Published Read"
ON public.community_pyqs
AS PERMISSIVE
FOR SELECT
TO anon
USING (
    status IN ('active', 'approved', 'published')
    AND NOT public.is_paper_removed(id)
);

CREATE POLICY "Community PYQs Restrict Anon Read"
ON public.community_pyqs
AS RESTRICTIVE
FOR SELECT
TO anon
USING (
    status IN ('active', 'approved', 'published')
    AND NOT public.is_paper_removed(id)
);

CREATE POLICY "Community PYQs Authenticated Read"
ON public.community_pyqs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (
        status IN ('active', 'approved', 'published')
        AND NOT public.is_paper_removed(id)
    )
    OR uploader_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Community PYQs Restrict Authenticated Read"
ON public.community_pyqs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
    (
        status IN ('active', 'approved', 'published')
        AND NOT public.is_paper_removed(id)
    )
    OR uploader_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Community PYQs Authenticated Insert"
ON public.community_pyqs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND uploader_id = (SELECT auth.uid())
);

CREATE POLICY "Community PYQs Owner Or Admin Update"
ON public.community_pyqs
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
        uploader_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
        uploader_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

CREATE POLICY "Community PYQs Owner Or Admin Delete"
ON public.community_pyqs
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
        uploader_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

-- 6B. public.paper_moderation_states
ALTER TABLE public.paper_moderation_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and owners view paper moderation states" ON public.paper_moderation_states;
CREATE POLICY "Admins and owners view paper moderation states"
ON public.paper_moderation_states
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    public.is_admin((SELECT auth.uid()))
    OR public.is_paper_uploader(paper_id, (SELECT auth.uid()))
);

-- 6C. public.user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_roles'
          AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Users can read their own role"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    public.is_admin((SELECT auth.uid()))
);

-- 6D. public.paper_reports
ALTER TABLE public.paper_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reports they created" ON public.paper_reports;
CREATE POLICY "Users can view reports they created"
ON public.paper_reports
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = reporter_id
    OR public.is_admin((SELECT auth.uid()))
    OR public.is_paper_uploader_text(paper_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.paper_reports;
CREATE POLICY "Authenticated users can submit reports"
ON public.paper_reports
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (reporter_id IS NULL OR reporter_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Only moderators can update reports" ON public.paper_reports;
CREATE POLICY "Only moderators can update reports"
ON public.paper_reports
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    public.is_admin((SELECT auth.uid()))
    OR public.is_paper_uploader_text(paper_id, (SELECT auth.uid()))
)
WITH CHECK (
    public.is_admin((SELECT auth.uid()))
    OR public.is_paper_uploader_text(paper_id, (SELECT auth.uid()))
);

-- 6E. public.moderation_logs
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view moderation logs" ON public.moderation_logs;
CREATE POLICY "Only admins can view moderation logs"
ON public.moderation_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can record moderation logs" ON public.moderation_logs;
CREATE POLICY "Only admins can record moderation logs"
ON public.moderation_logs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin((SELECT auth.uid())));

-- 6F. public.user_moderation_status
ALTER TABLE public.user_moderation_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can check their own suspension status" ON public.user_moderation_status;
CREATE POLICY "Users can check their own suspension status"
ON public.user_moderation_status
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can manage user suspensions" ON public.user_moderation_status;
CREATE POLICY "Only admins can manage user suspensions"
ON public.user_moderation_status
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));

-- 6G. public.user_download_quotas
ALTER TABLE public.user_download_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read their own download quota" ON public.user_download_quotas;
DROP POLICY IF EXISTS "Anyone can create their own download quota" ON public.user_download_quotas;
DROP POLICY IF EXISTS "Anyone can update their own download quota" ON public.user_download_quotas;
DROP POLICY IF EXISTS "Authenticated users read own quota" ON public.user_download_quotas;
DROP POLICY IF EXISTS "Authenticated users insert own quota" ON public.user_download_quotas;
DROP POLICY IF EXISTS "Authenticated users update own quota" ON public.user_download_quotas;

CREATE POLICY "Authenticated users read own quota"
ON public.user_download_quotas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND identifier = 'user:' || (SELECT auth.uid())::text
);

CREATE POLICY "Authenticated users insert own quota"
ON public.user_download_quotas
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND identifier = 'user:' || (SELECT auth.uid())::text
);

CREATE POLICY "Authenticated users update own quota"
ON public.user_download_quotas
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND identifier = 'user:' || (SELECT auth.uid())::text
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND identifier = 'user:' || (SELECT auth.uid())::text
);

-- 6H. Owner-scoped workspace & user tables
ALTER TABLE public.paper_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ratings" ON public.paper_ratings;
DROP POLICY IF EXISTS "Authenticated users can rate once per paper" ON public.paper_ratings;
DROP POLICY IF EXISTS "Users can edit their own rating" ON public.paper_ratings;
DROP POLICY IF EXISTS "Users can delete their own rating" ON public.paper_ratings;
DROP POLICY IF EXISTS "Paper Ratings Restrict Owner Insert" ON public.paper_ratings;
DROP POLICY IF EXISTS "Paper Ratings Restrict Owner Update" ON public.paper_ratings;

CREATE POLICY "Anyone can read ratings"
ON public.paper_ratings
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated users can rate once per paper"
ON public.paper_ratings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY "Users can edit their own rating"
ON public.paper_ratings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own rating"
ON public.paper_ratings
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
);

ALTER TABLE public.saved_papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved_papers" ON public.saved_papers;
CREATE POLICY "Users manage own saved_papers"
ON public.saved_papers
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.study_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own study_projects" ON public.study_projects;
CREATE POLICY "Users manage own study_projects"
ON public.study_projects
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.quick_captures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own quick_captures" ON public.quick_captures;
CREATE POLICY "Users manage own quick_captures"
ON public.quick_captures
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert their own notes" ON public.notes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
    IF to_regclass('public.papers') IS NOT NULL THEN
        ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
    END IF;
    IF to_regclass('public.app_feedback') IS NOT NULL THEN
        ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public can read app_feedback" ON public.app_feedback;
        CREATE POLICY "Public can read app_feedback" ON public.app_feedback FOR SELECT TO anon, authenticated USING (true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. MANDATORY PRE-GRANT RLS ASSERTION & LEAST-PRIVILEGE POSTGRESQL GRANTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    v_rls boolean;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'community_pyqs',
        'paper_moderation_states',
        'paper_ratings',
        'paper_reports',
        'moderation_logs',
        'user_moderation_status',
        'user_roles',
        'saved_papers',
        'study_projects',
        'quick_captures',
        'notes',
        'user_download_quotas'
    ]
    LOOP
        SELECT c.relrowsecurity
        INTO v_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = tbl;

        IF v_rls IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'Refusing GRANT: RLS is NOT enabled on public.%', tbl;
        END IF;
    END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.community_pyqs TO anon;
GRANT SELECT ON TABLE public.paper_ratings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_pyqs TO authenticated;
GRANT SELECT ON TABLE public.paper_moderation_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paper_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.paper_reports TO authenticated;
GRANT SELECT, INSERT ON TABLE public.moderation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_moderation_status TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_papers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_captures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_download_quotas TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

DO $$
BEGIN
    IF to_regclass('public.papers') IS NOT NULL THEN
        GRANT SELECT ON TABLE public.papers TO anon, authenticated;
    END IF;
    IF to_regclass('public.app_feedback') IS NOT NULL THEN
        GRANT SELECT ON TABLE public.app_feedback TO anon, authenticated;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. PRIVATE STORAGE POLICIES FOR 'community-pyqs' (SUPPORTS owner_id, owner & ADMIN)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage'
          AND c.relname = 'objects'
          AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on storage.objects.';
    END IF;

    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND (
              COALESCE(qual, '') ~* 'community-pyqs'
              OR COALESCE(with_check, '') ~* 'community-pyqs'
              OR policyname ILIKE 'Community PYQs%'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Community PYQs Anon Published Object Read"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO anon
USING (
    bucket_id = 'community-pyqs'
    AND public.can_read_published_community_pyq_object(name)
);

CREATE POLICY "Community PYQs Restrict Anon Object Read"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO anon
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR public.can_read_published_community_pyq_object(name)
);

CREATE POLICY "Community PYQs Authenticated Object Read"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND (
        public.can_read_community_pyq_object(name, (SELECT auth.uid()))
        OR owner_id = (SELECT auth.uid()::text)
        OR owner = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

CREATE POLICY "Community PYQs Restrict Authenticated Object Read"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR public.can_read_community_pyq_object(name, (SELECT auth.uid()))
    OR owner_id = (SELECT auth.uid()::text)
    OR owner = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Community PYQs Authenticated Upload"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'community-pyqs'
    AND (SELECT auth.uid()) IS NOT NULL
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Community PYQs Restrict Authenticated Insert"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
);

CREATE POLICY "Community PYQs Owner Update"
ON storage.objects
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND (owner_id = (SELECT auth.uid()::text) OR owner = (SELECT auth.uid()))
)
WITH CHECK (
    bucket_id = 'community-pyqs'
    AND (owner_id = (SELECT auth.uid()::text) OR owner = (SELECT auth.uid()))
);

CREATE POLICY "Community PYQs Restrict Owner Only Update"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR owner_id = (SELECT auth.uid()::text)
    OR owner = (SELECT auth.uid())
)
WITH CHECK (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR owner_id = (SELECT auth.uid()::text)
    OR owner = (SELECT auth.uid())
);

CREATE POLICY "Community PYQs Owner Or Admin Delete"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND (
        owner_id = (SELECT auth.uid()::text)
        OR owner = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

CREATE POLICY "Community PYQs Restrict Owner Or Admin Authenticated Delete"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            owner_id = (SELECT auth.uid()::text)
            OR owner = (SELECT auth.uid())
            OR public.is_admin((SELECT auth.uid()))
        )
    )
);

UPDATE storage.buckets
SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/gif',
        'image/svg+xml'
    ]
WHERE id = 'community-pyqs';

COMMIT;
