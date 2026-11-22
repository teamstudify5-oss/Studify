-- ============================================================================
-- STUDIFY WORKSPACE SCHEMA ALIGNMENT & PUBLIC APP RATINGS / REVIEWS MIGRATION
-- Filename: 20261121_workspace_schema_and_app_feedback.sql
--
-- Non-Destructive & Idempotent:
--   1. Aligns public.study_projects with all client fields (subject DEFAULT '',
--      exam_board, target_exam, target_date, icon) and verifies owner RLS/grants.
--   2. Aligns public.quick_captures with client fields (title, content, type,
--      project_id, tags, is_resolved), backfills any legacy text/tag rows,
--      and keeps legacy columns nullable with safe defaults.
--   3. Creates/aligns public.app_feedback with visitor_id uniqueness, author_name,
--      validated 1..5 ratings, public SELECT RLS, and hardened SECURITY DEFINER
--      RPCs (submit_app_feedback, get_app_feedback_summary) so anyone can rate
--      and review publicly without cross-visitor overwrite or table-level writes.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ALIGN public.study_projects SCHEMA & RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_projects (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    subject text NOT NULL DEFAULT '',
    exam_board text,
    target_exam text,
    target_date text,
    color text NOT NULL DEFAULT 'cyan',
    icon text,
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active',
    paper_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes jsonb NOT NULL DEFAULT '[]'::jsonb,
    resources jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS subject text DEFAULT '';
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS exam_board text;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS target_exam text;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS target_date text;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS color text DEFAULT 'cyan';
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS paper_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS tasks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.study_projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.study_projects SET subject = '' WHERE subject IS NULL;
UPDATE public.study_projects SET description = '' WHERE description IS NULL;
UPDATE public.study_projects SET color = 'cyan' WHERE color IS NULL;
UPDATE public.study_projects SET status = 'active' WHERE status IS NULL;
UPDATE public.study_projects SET paper_ids = '[]'::jsonb WHERE paper_ids IS NULL;
UPDATE public.study_projects SET tasks = '[]'::jsonb WHERE tasks IS NULL;
UPDATE public.study_projects SET notes = '[]'::jsonb WHERE notes IS NULL;
UPDATE public.study_projects SET resources = '[]'::jsonb WHERE resources IS NULL;

ALTER TABLE public.study_projects ALTER COLUMN subject SET DEFAULT '';
ALTER TABLE public.study_projects ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.study_projects ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.study_projects ALTER COLUMN color SET DEFAULT 'cyan';
ALTER TABLE public.study_projects ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.study_projects ALTER COLUMN paper_ids SET DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ALTER COLUMN tasks SET DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ALTER COLUMN notes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.study_projects ALTER COLUMN resources SET DEFAULT '[]'::jsonb;

ALTER TABLE public.study_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own study_projects" ON public.study_projects;
CREATE POLICY "Users manage own study_projects"
ON public.study_projects
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_projects TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. ALIGN public.quick_captures SCHEMA & RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quick_captures (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'thought',
    project_id text,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_resolved boolean NOT NULL DEFAULT false,
    text text NOT NULL DEFAULT '',
    tag text NOT NULL DEFAULT 'thought',
    paper_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS type text DEFAULT 'thought';
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS is_resolved boolean DEFAULT false;
ALTER TABLE public.quick_captures ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quick_captures' AND column_name = 'text'
    ) THEN
        ALTER TABLE public.quick_captures ALTER COLUMN text SET DEFAULT '';
        ALTER TABLE public.quick_captures ALTER COLUMN text DROP NOT NULL;
        UPDATE public.quick_captures
        SET content = text
        WHERE (content IS NULL OR pg_catalog.btrim(content) = '')
          AND text IS NOT NULL
          AND pg_catalog.btrim(text) <> '';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quick_captures' AND column_name = 'tag'
    ) THEN
        ALTER TABLE public.quick_captures ALTER COLUMN tag SET DEFAULT 'thought';
        ALTER TABLE public.quick_captures ALTER COLUMN tag DROP NOT NULL;
        UPDATE public.quick_captures
        SET type = CASE
            WHEN tag IN ('thought', 'formula', 'doubt', 'resource') THEN tag
            ELSE 'thought'
        END
        WHERE (type IS NULL OR pg_catalog.btrim(type) = '')
          AND tag IS NOT NULL;
    END IF;
END $$;

UPDATE public.quick_captures SET title = '' WHERE title IS NULL;
UPDATE public.quick_captures SET content = '' WHERE content IS NULL;
UPDATE public.quick_captures SET type = 'thought' WHERE type IS NULL OR type NOT IN ('thought', 'formula', 'doubt', 'resource');
UPDATE public.quick_captures SET tags = '[]'::jsonb WHERE tags IS NULL;
UPDATE public.quick_captures SET is_resolved = false WHERE is_resolved IS NULL;

ALTER TABLE public.quick_captures ALTER COLUMN title SET DEFAULT '';
ALTER TABLE public.quick_captures ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.quick_captures ALTER COLUMN type SET DEFAULT 'thought';
ALTER TABLE public.quick_captures ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
ALTER TABLE public.quick_captures ALTER COLUMN is_resolved SET DEFAULT false;

ALTER TABLE public.quick_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quick_captures" ON public.quick_captures;
CREATE POLICY "Users manage own quick_captures"
ON public.quick_captures
AS PERMISSIVE
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quick_captures TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. ENSURE public.notes RLS & GRANTS
-- ----------------------------------------------------------------------------
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

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. PUBLIC APP RATINGS & REVIEWS (public.app_feedback + HARDENED RPCs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_feedback (
    id text PRIMARY KEY DEFAULT ('fb_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')),
    visitor_id text NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name text NOT NULL DEFAULT 'Student',
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'Student';
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS comment text DEFAULT '';
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.app_feedback SET author_name = 'Student' WHERE author_name IS NULL OR pg_catalog.btrim(author_name) = '';
UPDATE public.app_feedback SET comment = '' WHERE comment IS NULL;

ALTER TABLE public.app_feedback ALTER COLUMN author_name SET DEFAULT 'Student';
ALTER TABLE public.app_feedback ALTER COLUMN comment SET DEFAULT '';
ALTER TABLE public.app_feedback ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.app_feedback ALTER COLUMN updated_at SET DEFAULT now();

DO $$
DECLARE
    con_rec record;
BEGIN
    -- Deduplicate any legacy pre-constraint duplicate visitor_id rows safely (keep newest)
    DELETE FROM public.app_feedback a
    USING public.app_feedback b
    WHERE a.visitor_id = b.visitor_id
      AND (
          COALESCE(a.updated_at, a.created_at) < COALESCE(b.updated_at, b.created_at)
          OR (COALESCE(a.updated_at, a.created_at) = COALESCE(b.updated_at, b.created_at) AND a.ctid < b.ctid)
      );

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
        WHERE n.nspname = 'public'
          AND c.relname = 'app_feedback'
          AND i.indisunique = true
          AND array_length(i.indkey, 1) = 1
          AND a.attname = 'visitor_id'
    ) THEN
        CREATE UNIQUE INDEX app_feedback_visitor_id_unique_idx
        ON public.app_feedback (visitor_id);
    END IF;

    -- Ensure 1..5 rating check constraint exists
    FOR con_rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'app_feedback'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ~* '\mrating\M'
    LOOP
        EXECUTE format('ALTER TABLE public.app_feedback DROP CONSTRAINT IF EXISTS %I', con_rec.conname);
    END LOOP;

    ALTER TABLE public.app_feedback
        ADD CONSTRAINT app_feedback_rating_check CHECK (rating >= 1 AND rating <= 5);
END $$;

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- Remove any unsafe direct write policies; public reads are allowed, writes go via validated RPC
DROP POLICY IF EXISTS "Public can read app_feedback" ON public.app_feedback;
DROP POLICY IF EXISTS "Anyone can insert app_feedback" ON public.app_feedback;
DROP POLICY IF EXISTS "Anyone can update app_feedback" ON public.app_feedback;
DROP POLICY IF EXISTS "Public can insert app_feedback" ON public.app_feedback;
DROP POLICY IF EXISTS "Public can update app_feedback" ON public.app_feedback;

CREATE POLICY "Public can read app_feedback"
ON public.app_feedback
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE public.app_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_feedback TO anon, authenticated;
GRANT ALL ON TABLE public.app_feedback TO service_role;

-- Hardened RPC: anyone (anon or signed-in) can submit/update their own visitor feedback
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
            'updated_at', COALESCE(v_saved.updated_at, v_saved.created_at)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_app_feedback(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_app_feedback(text, integer, text, text) TO anon, authenticated, service_role;

-- Hardened RPC: returns complete Play Store average, 5-to-1 breakdown across all rows, and public reviews
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
            'updated_at', COALESCE(af.updated_at, af.created_at)
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
                'updated_at', COALESCE(sub.updated_at, sub.created_at)
            )
            ORDER BY COALESCE(sub.updated_at, sub.created_at) DESC, sub.created_at DESC
        ),
        '[]'::jsonb
    )
    INTO v_items
    FROM (
        SELECT id, visitor_id, author_name, rating, comment, created_at, updated_at
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

COMMIT;
