-- ============================================================================
-- STUDIFY TEAM OFFICIAL REVIEW REPLIES & WORKSPACE NOTE FILE BACKUP MIGRATION
-- Filename: 20261122_app_feedback_replies_and_workspace_note_files.sql
--
-- Non-Destructive & Idempotent:
--   1. Extends public.app_feedback with official reply columns:
--      reply_text, reply_author, replied_by_user_id, reply_updated_at.
--   2. Adds hardened public.is_studify_owner(uuid) verification helper and
--      SECURITY DEFINER RPCs:
--        - public.reply_to_app_feedback(p_feedback_id text, p_reply_text text)
--        - public.delete_app_feedback_reply(p_feedback_id text)
--      strictly restricted to the verified Studify main owner account
--      (NO current_user checks, SET search_path = '').
--   3. Updates public.get_app_feedback_summary & public.submit_app_feedback so
--      official Studify Team replies are included publicly and never erased
--      when a reviewer updates their rating or comment.
--   4. Aligns public.study_projects with note_attachments jsonb column.
--   5. Ensures private 'app-files' storage bucket and owner-scoped RLS
--      policies so authenticated students can back up note PDFs & photos.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTEND public.app_feedback FOR OFFICIAL STUDIFY TEAM REPLIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS reply_text text;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS reply_author text;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS replied_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS reply_updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. VERIFIED STUDIFY MAIN ACCOUNT HELPER (OWNER-ONLY, NO current_user CHECK)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_studify_owner(check_uid uuid DEFAULT auth.uid())
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
              AND r.role = 'owner'
        )
        OR EXISTS (
            SELECT 1
            FROM auth.users u
            WHERE u.id = check_uid
              AND (
                  u.raw_app_meta_data->>'role' = 'owner'
                  OR pg_catalog.lower(pg_catalog.btrim(COALESCE(u.email, ''))) = 'teamstudify5@gmail.com'
              )
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_studify_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_studify_owner(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. OWNER-ONLY REPLY & DELETE-REPLY RPCs FOR public.app_feedback
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reply_to_app_feedback(
    p_feedback_id text,
    p_reply_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_feedback_id text;
    v_clean_reply text;
    v_saved public.app_feedback%ROWTYPE;
BEGIN
    IF v_uid IS NULL OR NOT public.is_studify_owner(v_uid) THEN
        RAISE EXCEPTION 'Only the verified Studify main account can reply to reviews.' USING ERRCODE = '42501';
    END IF;

    v_feedback_id := pg_catalog.btrim(COALESCE(p_feedback_id, ''));
    IF v_feedback_id = '' THEN
        RAISE EXCEPTION 'Review identifier is required.' USING ERRCODE = '22023';
    END IF;

    v_clean_reply := pg_catalog.left(
        pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(p_reply_text, ''), '[<>]', '', 'g')),
        500
    );
    IF v_clean_reply = '' THEN
        RAISE EXCEPTION 'Reply message cannot be empty.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.app_feedback
    SET
        reply_text = v_clean_reply,
        reply_author = 'Studify Team',
        replied_by_user_id = v_uid,
        reply_updated_at = pg_catalog.now()
    WHERE id::text = v_feedback_id
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'item', pg_catalog.jsonb_build_object(
            'id', v_saved.id::text,
            'visitor_id', v_saved.visitor_id,
            'author_name', COALESCE(NULLIF(v_saved.author_name, ''), 'Student'),
            'rating', v_saved.rating,
            'comment', COALESCE(v_saved.comment, ''),
            'created_at', v_saved.created_at,
            'updated_at', COALESCE(v_saved.updated_at, v_saved.created_at),
            'reply_text', v_saved.reply_text,
            'reply_author', COALESCE(NULLIF(v_saved.reply_author, ''), 'Studify Team'),
            'reply_updated_at', v_saved.reply_updated_at
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_app_feedback(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_app_feedback(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_app_feedback_reply(
    p_feedback_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_feedback_id text;
    v_saved public.app_feedback%ROWTYPE;
BEGIN
    IF v_uid IS NULL OR NOT public.is_studify_owner(v_uid) THEN
        RAISE EXCEPTION 'Only the verified Studify main account can delete official replies.' USING ERRCODE = '42501';
    END IF;

    v_feedback_id := pg_catalog.btrim(COALESCE(p_feedback_id, ''));
    IF v_feedback_id = '' THEN
        RAISE EXCEPTION 'Review identifier is required.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.app_feedback
    SET
        reply_text = NULL,
        reply_author = NULL,
        replied_by_user_id = NULL,
        reply_updated_at = NULL
    WHERE id::text = v_feedback_id
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'item', pg_catalog.jsonb_build_object(
            'id', v_saved.id::text,
            'visitor_id', v_saved.visitor_id,
            'author_name', COALESCE(NULLIF(v_saved.author_name, ''), 'Student'),
            'rating', v_saved.rating,
            'comment', COALESCE(v_saved.comment, ''),
            'created_at', v_saved.created_at,
            'updated_at', COALESCE(v_saved.updated_at, v_saved.created_at),
            'reply_text', NULL,
            'reply_author', NULL,
            'reply_updated_at', NULL
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_app_feedback_reply(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_app_feedback_reply(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. REFRESH submit_app_feedback & get_app_feedback_summary WITH REPLY FIELDS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_app_feedback(
    p_visitor_id text,
    p_rating integer DEFAULT NULL,
    p_comment text DEFAULT NULL,
    p_author_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_visitor_id text;
    v_clean_comment text;
    v_clean_author text;
    v_existing public.app_feedback%ROWTYPE;
    v_saved public.app_feedback%ROWTYPE;
    v_final_rating integer;
    v_final_comment text;
    v_final_author text;
    v_uid uuid;
BEGIN
    v_visitor_id := pg_catalog.btrim(COALESCE(p_visitor_id, ''));
    IF v_visitor_id = '' OR pg_catalog.char_length(v_visitor_id) > 128 THEN
        RAISE EXCEPTION 'Invalid visitor identifier.' USING ERRCODE = '22023';
    END IF;

    IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5 stars.' USING ERRCODE = '22023';
    END IF;

    v_clean_comment := NULL;
    IF p_comment IS NOT NULL THEN
        v_clean_comment := pg_catalog.left(
            pg_catalog.btrim(pg_catalog.regexp_replace(p_comment, '[<>]', '', 'g')),
            500
        );
    END IF;

    v_clean_author := NULL;
    IF p_author_name IS NOT NULL THEN
        v_clean_author := pg_catalog.left(
            pg_catalog.btrim(pg_catalog.regexp_replace(p_author_name, '[<>]', '', 'g')),
            60
        );
    END IF;

    v_uid := auth.uid();

    SELECT *
    INTO v_existing
    FROM public.app_feedback
    WHERE visitor_id = v_visitor_id
    FOR UPDATE;

    IF FOUND THEN
        v_final_rating := COALESCE(p_rating, v_existing.rating);
        v_final_comment := CASE WHEN v_clean_comment IS NULL THEN COALESCE(v_existing.comment, '') ELSE v_clean_comment END;
        v_final_author := COALESCE(NULLIF(v_clean_author, ''), NULLIF(v_existing.author_name, ''), 'Student');

        UPDATE public.app_feedback
        SET
            rating = v_final_rating,
            comment = v_final_comment,
            author_name = v_final_author,
            user_id = COALESCE(v_uid, user_id),
            updated_at = pg_catalog.now()
        WHERE visitor_id = v_visitor_id
        RETURNING * INTO v_saved;
    ELSE
        v_final_rating := COALESCE(p_rating, 5);
        v_final_comment := COALESCE(v_clean_comment, '');
        v_final_author := COALESCE(NULLIF(v_clean_author, ''), 'Student');

        INSERT INTO public.app_feedback (
            visitor_id,
            user_id,
            author_name,
            rating,
            comment,
            created_at,
            updated_at
        )
        VALUES (
            v_visitor_id,
            v_uid,
            v_final_author,
            v_final_rating,
            v_final_comment,
            pg_catalog.now(),
            pg_catalog.now()
        )
        RETURNING * INTO v_saved;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'item', pg_catalog.jsonb_build_object(
            'id', v_saved.id::text,
            'visitor_id', v_saved.visitor_id,
            'author_name', COALESCE(NULLIF(v_saved.author_name, ''), 'Student'),
            'rating', v_saved.rating,
            'comment', COALESCE(v_saved.comment, ''),
            'created_at', v_saved.created_at,
            'updated_at', COALESCE(v_saved.updated_at, v_saved.created_at),
            'reply_text', v_saved.reply_text,
            'reply_author', CASE WHEN pg_catalog.btrim(COALESCE(v_saved.reply_text, '')) <> '' THEN COALESCE(NULLIF(v_saved.reply_author, ''), 'Studify Team') ELSE NULL END,
            'reply_updated_at', v_saved.reply_updated_at
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_app_feedback(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_app_feedback(text, integer, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_app_feedback_summary(
    p_visitor_id text DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_limit integer;
    v_visitor_id text;
    v_total_ratings bigint := 0;
    v_total_reviews bigint := 0;
    v_average_rating numeric := NULL;
    v_breakdown jsonb;
    v_user_feedback jsonb := NULL;
    v_items jsonb := '[]'::jsonb;
BEGIN
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
    v_visitor_id := NULLIF(pg_catalog.btrim(COALESCE(p_visitor_id, '')), '');

    SELECT
        COUNT(*)::bigint,
        COUNT(*) FILTER (WHERE pg_catalog.btrim(COALESCE(comment, '')) <> '')::bigint,
        CASE WHEN COUNT(*) > 0 THEN pg_catalog.round(AVG(rating)::numeric, 1) ELSE NULL END,
        pg_catalog.jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE rating = 5),
            '4', COUNT(*) FILTER (WHERE rating = 4),
            '3', COUNT(*) FILTER (WHERE rating = 3),
            '2', COUNT(*) FILTER (WHERE rating = 2),
            '1', COUNT(*) FILTER (WHERE rating = 1)
        )
    INTO v_total_ratings, v_total_reviews, v_average_rating, v_breakdown
    FROM public.app_feedback;

    IF v_visitor_id IS NOT NULL THEN
        SELECT pg_catalog.jsonb_build_object(
            'id', af.id::text,
            'visitor_id', af.visitor_id,
            'author_name', COALESCE(NULLIF(af.author_name, ''), 'Student'),
            'rating', af.rating,
            'comment', COALESCE(af.comment, ''),
            'created_at', af.created_at,
            'updated_at', COALESCE(af.updated_at, af.created_at),
            'reply_text', af.reply_text,
            'reply_author', CASE WHEN pg_catalog.btrim(COALESCE(af.reply_text, '')) <> '' THEN COALESCE(NULLIF(af.reply_author, ''), 'Studify Team') ELSE NULL END,
            'reply_updated_at', af.reply_updated_at
        )
        INTO v_user_feedback
        FROM public.app_feedback af
        WHERE af.visitor_id = v_visitor_id
        LIMIT 1;
    END IF;

    SELECT COALESCE(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'id', sub.id::text,
                'visitor_id', sub.visitor_id,
                'author_name', COALESCE(NULLIF(sub.author_name, ''), 'Student'),
                'rating', sub.rating,
                'comment', COALESCE(sub.comment, ''),
                'created_at', sub.created_at,
                'updated_at', COALESCE(sub.updated_at, sub.created_at),
                'reply_text', sub.reply_text,
                'reply_author', CASE WHEN pg_catalog.btrim(COALESCE(sub.reply_text, '')) <> '' THEN COALESCE(NULLIF(sub.reply_author, ''), 'Studify Team') ELSE NULL END,
                'reply_updated_at', sub.reply_updated_at
            )
            ORDER BY COALESCE(sub.updated_at, sub.created_at) DESC, sub.created_at DESC
        ),
        '[]'::jsonb
    )
    INTO v_items
    FROM (
        SELECT id, visitor_id, author_name, rating, comment, created_at, updated_at, reply_text, reply_author, reply_updated_at
        FROM public.app_feedback
        WHERE pg_catalog.btrim(COALESCE(comment, '')) <> ''
        ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
        LIMIT v_limit
    ) sub;

    RETURN pg_catalog.jsonb_build_object(
        'average_rating', v_average_rating,
        'total_ratings', v_total_ratings,
        'total_reviews', v_total_reviews,
        'rating_breakdown', COALESCE(
            v_breakdown,
            '{"5":0,"4":0,"3":0,"2":0,"1":0}'::jsonb
        ),
        'user_feedback', v_user_feedback,
        'items', v_items
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_app_feedback_summary(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_feedback_summary(text, integer) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. WORKSPACE PROJECT NOTE ATTACHMENTS COLUMN & PRIVATE 'app-files' STORAGE
-- ----------------------------------------------------------------------------
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS note_attachments jsonb DEFAULT '[]'::jsonb;
UPDATE public.study_projects SET note_attachments = '[]'::jsonb WHERE note_attachments IS NULL;
ALTER TABLE public.study_projects ALTER COLUMN note_attachments SET DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'app-files',
    'app-files',
    false,
    26214400,
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/gif',
        'image/svg+xml'
    ]
)
ON CONFLICT (id) DO UPDATE
SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "App Files Owner Read" ON storage.objects;
DROP POLICY IF EXISTS "App Files Owner Insert" ON storage.objects;
DROP POLICY IF EXISTS "App Files Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "App Files Owner Delete" ON storage.objects;

CREATE POLICY "App Files Owner Read"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    bucket_id = 'app-files'
    AND (
        owner_id = (SELECT auth.uid()::text)
        OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
);

CREATE POLICY "App Files Owner Insert"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'app-files'
    AND (SELECT auth.uid()) IS NOT NULL
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "App Files Owner Update"
ON storage.objects
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'app-files'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'app-files'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "App Files Owner Delete"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    bucket_id = 'app-files'
    AND (
        owner_id = (SELECT auth.uid()::text)
        OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
);

COMMIT;
