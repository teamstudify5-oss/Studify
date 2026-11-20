-- ============================================================================
-- STUDIFY CONSOLIDATED MIGRATION (Production-Safe, Idempotent, Non-Destructive)
-- Filename: 20261114_consolidated_rls_ratings_and_orphan_cleanup.sql
--
-- Consolidates:
--   - 20261113_community_pyqs_and_paper_ratings_rls.sql
--   - 20261114_fix_user_roles_rls_and_prune_orphaned_refs.sql
--
-- Execution Order: Run ONCE in Supabase SQL Editor after Migrations 1 & 2.
--
-- Safety Guarantees:
--   - Never drops or truncates any table.
--   - Never deletes auth.users, public.user_roles, or original PYQ content.
--   - Never modifies or deletes Supabase Storage buckets or objects.
--   - Removes only truly orphaned paper references (IDs absent from both
--     public.community_pyqs and public.papers regardless of paper status).
--   - Preserves all projects, tasks, notes, resources, and quick captures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENSURE public.user_roles EXISTS & DEFINE NON-RECURSIVE public.is_admin(uuid)
-- ----------------------------------------------------------------------------
-- Create only if missing; never modifies or overwrites existing owner/admin rows.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'student')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unconditionally replace public.is_admin(uuid) so SECURITY DEFINER and
-- SET search_path = public, auth are enforced even if an older definition exists.
CREATE OR REPLACE FUNCTION public.is_admin(check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
    SELECT
        check_uid IS NOT NULL
        AND (
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
$$;

-- ----------------------------------------------------------------------------
-- 2. FIX PostgreSQL INFINITE RECURSION (42P17) ON public.user_roles RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Remove all existing SELECT policies on public.user_roles (which may include
-- self-referential "Admins can view all roles" variants) without touching any
-- INSERT, UPDATE, or DELETE policies.
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

    -- Guard against any pre-existing FOR ALL policy on user_roles that queries user_roles
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_roles'
          AND cmd = 'ALL'
          AND (
              COALESCE(qual, '') ~* 'user_roles'
              OR COALESCE(with_check, '') ~* 'user_roles'
          )
    LOOP
        RAISE EXCEPTION
            'Pre-existing FOR ALL policy "%" on public.user_roles self-references user_roles and would still cause 42P17 recursion. Review and replace it manually before re-running.',
            pol.policyname;
    END LOOP;
END $$;

-- Users can read their own role row; admins/owners can read all role rows via
-- SECURITY DEFINER public.is_admin() without self-referencing user_roles in RLS.
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

-- ----------------------------------------------------------------------------
-- 3. HARDEN public.community_pyqs SELECT & OWNERSHIP RLS POLICIES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
    has_id boolean;
    has_uploader_id boolean;
    has_status boolean;
BEGIN
    IF to_regclass('public.community_pyqs') IS NULL THEN
        RAISE EXCEPTION 'Required table public.community_pyqs does not exist.';
    END IF;

    SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'id'),
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'uploader_id'),
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'community_pyqs' AND column_name = 'status')
    INTO has_id, has_uploader_id, has_status;

    IF NOT (has_id AND has_uploader_id AND has_status) THEN
        RAISE EXCEPTION 'public.community_pyqs is missing expected columns (id, uploader_id, status).';
    END IF;

    ALTER TABLE public.community_pyqs ENABLE ROW LEVEL SECURITY;

    -- Remove all conflicting or obsolete SELECT policies on public.community_pyqs
    -- without touching unrelated INSERT, UPDATE, or DELETE policies.
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'community_pyqs'
          AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_pyqs', pol.policyname);
    END LOOP;
END $$;

-- Drop only previously defined Studify write/guard policy names for idempotency
DROP POLICY IF EXISTS "Community PYQs Authenticated Insert" ON public.community_pyqs;
DROP POLICY IF EXISTS "Authenticated users can insert community_pyqs" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Owner Update" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Update" ON public.community_pyqs;
DROP POLICY IF EXISTS "Uploaders can update own community_pyqs" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Owner Delete" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Delete" ON public.community_pyqs;
DROP POLICY IF EXISTS "Uploaders can delete own community_pyqs" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Restrict Public Read" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Update" ON public.community_pyqs;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Delete" ON public.community_pyqs;

-- SELECT: Anonymous/public users see only published/active papers;
-- authenticated uploaders also see their own submissions;
-- authenticated owners/admins also see papers requiring moderation.
CREATE POLICY "Community PYQs Public Read"
ON public.community_pyqs
AS PERMISSIVE
FOR SELECT
TO public
USING (
    status IN ('active', 'approved', 'published')
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            uploader_id = (SELECT auth.uid())
            OR public.is_admin((SELECT auth.uid()))
        )
    )
);

-- RESTRICTIVE SELECT guard ensures any pre-existing broad FOR ALL policy cannot
-- leak pending, rejected, flagged, or removed rows to non-owners/non-admins.
CREATE POLICY "Community PYQs Restrict Public Read"
ON public.community_pyqs
AS RESTRICTIVE
FOR SELECT
TO public
USING (
    status IN ('active', 'approved', 'published')
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            uploader_id = (SELECT auth.uid())
            OR public.is_admin((SELECT auth.uid()))
        )
    )
);

-- INSERT: Authenticated users can insert only rows bound to their own uploader_id
CREATE POLICY "Community PYQs Authenticated Insert"
ON public.community_pyqs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND uploader_id = (SELECT auth.uid())
);

-- UPDATE: Only the original uploader or an owner/admin can update a submission
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

-- DELETE: Only the original uploader or an owner/admin can delete a submission
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

-- RESTRICTIVE write guards prevent any pre-existing broad permissive policy from
-- letting non-owners update or delete another user's submission.
CREATE POLICY "Community PYQs Restrict Owner Or Admin Update"
ON public.community_pyqs
AS RESTRICTIVE
FOR UPDATE
TO public
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

CREATE POLICY "Community PYQs Restrict Owner Or Admin Delete"
ON public.community_pyqs
AS RESTRICTIVE
FOR DELETE
TO public
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
        uploader_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

-- ----------------------------------------------------------------------------
-- 4. CREATE public.paper_ratings IF MISSING + UNIQUE CONSTRAINT + RLS
-- ----------------------------------------------------------------------------
-- Exact columns expected by src/services/supabaseDb.ts (fetchPaperRatings / submitPaperRating)
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

-- Verify expected columns exist if the table predated this migration,
-- and ensure the unique constraint on (user_id, paper_id) required by upsert exists.
DO $$
DECLARE
    missing_cols text;
    has_unique boolean;
BEGIN
    SELECT string_agg(req_col, ', ')
    INTO missing_cols
    FROM unnest(ARRAY[
        'id',
        'paper_id',
        'user_id',
        'rating',
        'review_text',
        'user_display_name',
        'created_at',
        'updated_at'
    ]) AS req_col
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'paper_ratings'
          AND c.column_name = req_col
    );

    IF missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'Existing public.paper_ratings is missing expected column(s): %', missing_cols;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'paper_ratings'
          AND c.contype IN ('u', 'p')
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attname::text)
              FROM unnest(c.conkey) AS k(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
          ) = ARRAY['paper_id', 'user_id']
    ) INTO has_unique;

    IF NOT has_unique THEN
        ALTER TABLE public.paper_ratings
            ADD CONSTRAINT paper_ratings_user_paper_unique UNIQUE (user_id, paper_id);
    END IF;
END $$;

ALTER TABLE public.paper_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ratings" ON public.paper_ratings;
DROP POLICY IF EXISTS "Authenticated users can rate once per paper" ON public.paper_ratings;
DROP POLICY IF EXISTS "Users can edit their own rating" ON public.paper_ratings;
DROP POLICY IF EXISTS "Users can delete their own rating" ON public.paper_ratings;
DROP POLICY IF EXISTS "Paper Ratings Restrict Owner Insert" ON public.paper_ratings;
DROP POLICY IF EXISTS "Paper Ratings Restrict Owner Update" ON public.paper_ratings;

-- SELECT: Anyone can read ratings; also required by PostgreSQL for ON CONFLICT upsert
CREATE POLICY "Anyone can read ratings"
ON public.paper_ratings
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

-- INSERT: Authenticated users can insert only with their own auth.uid()
CREATE POLICY "Authenticated users can rate once per paper"
ON public.paper_ratings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
);

-- UPDATE: Authenticated users can update only their own rating and cannot reassign user_id
CREATE POLICY "Users can edit their own rating"
ON public.paper_ratings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
);

-- DELETE: Users can delete their own rating; owners/admins can moderate abusive ratings
CREATE POLICY "Users can delete their own rating"
ON public.paper_ratings
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
        user_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

-- RESTRICTIVE guards prevent impersonation or modifying another user's rating
CREATE POLICY "Paper Ratings Restrict Owner Insert"
ON public.paper_ratings
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
);

CREATE POLICY "Paper Ratings Restrict Owner Update"
ON public.paper_ratings
AS RESTRICTIVE
FOR UPDATE
TO public
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
);

-- ----------------------------------------------------------------------------
-- 5. RATING-SUMMARY TRIGGER (ONLY VERIFIED EXISTING COLUMNS)
-- ----------------------------------------------------------------------------
-- Dynamically checks rating & rating_count existence and rating nullability on
-- public.community_pyqs (and public.papers if present) so deleting the last rating
-- never violates a NOT NULL rating constraint or references missing columns.
CREATE OR REPLACE FUNCTION public.sync_paper_rating_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_paper_id text;
    avg_rating numeric;
    total_count integer;
    cpyq_rating_nullable text;
    cpyq_has_rating_count boolean;
    papers_rating_nullable text;
    papers_has_rating_count boolean;
BEGIN
    target_paper_id := COALESCE(NEW.paper_id, OLD.paper_id);

    SELECT
        ROUND(AVG(rating)::numeric, 1),
        COUNT(*)::integer
    INTO avg_rating, total_count
    FROM public.paper_ratings
    WHERE paper_id = target_paper_id;

    total_count := COALESCE(total_count, 0);

    IF to_regclass('public.community_pyqs') IS NOT NULL THEN
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
            UPDATE public.community_pyqs
            SET
                rating = CASE
                    WHEN total_count > 0 THEN avg_rating
                    WHEN cpyq_rating_nullable = 'YES' THEN NULL
                    ELSE 0
                END,
                rating_count = total_count
            WHERE id::text = target_paper_id;
        END IF;
    END IF;

    IF to_regclass('public.papers') IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS trg_sync_paper_rating_summary ON public.paper_ratings;

CREATE TRIGGER trg_sync_paper_rating_summary
AFTER INSERT OR UPDATE OR DELETE ON public.paper_ratings
FOR EACH ROW
EXECUTE FUNCTION public.sync_paper_rating_summary();

-- ----------------------------------------------------------------------------
-- 6. SAFE ORPHANED REFERENCE CLEANUP (saved_papers & study_projects.paper_ids)
-- ----------------------------------------------------------------------------
-- Removes ONLY references whose paper_id genuinely does not exist in
-- public.community_pyqs (or public.papers if present), WITHOUT filtering by
-- status. Pending, rejected, flagged, and unpublished paper links are preserved.
DO $$
DECLARE
    has_community_pyqs boolean := to_regclass('public.community_pyqs') IS NOT NULL;
    has_papers boolean := to_regclass('public.papers') IS NOT NULL;
    paper_ids_type text;
    deleted_bookmarks integer := 0;
    updated_projects integer := 0;
BEGIN
    IF NOT has_community_pyqs AND NOT has_papers THEN
        RAISE NOTICE 'Neither public.community_pyqs nor public.papers exists; skipping orphan reference cleanup.';
        RETURN;
    END IF;

    -- 6A. Prune genuinely orphaned saved_papers rows
    IF to_regclass('public.saved_papers') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'saved_papers'
             AND column_name = 'paper_id'
       ) THEN
        IF has_community_pyqs AND has_papers THEN
            DELETE FROM public.saved_papers sp
            WHERE NOT EXISTS (
                SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = sp.paper_id::text
            )
            AND NOT EXISTS (
                SELECT 1 FROM public.papers p WHERE p.id::text = sp.paper_id::text
            );
        ELSIF has_community_pyqs THEN
            DELETE FROM public.saved_papers sp
            WHERE NOT EXISTS (
                SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = sp.paper_id::text
            );
        ELSIF has_papers THEN
            DELETE FROM public.saved_papers sp
            WHERE NOT EXISTS (
                SELECT 1 FROM public.papers p WHERE p.id::text = sp.paper_id::text
            );
        END IF;

        GET DIAGNOSTICS deleted_bookmarks = ROW_COUNT;
        RAISE NOTICE 'Removed % genuinely orphaned saved_papers row(s).', deleted_bookmarks;
    END IF;

    -- 6B. Prune genuinely orphaned paper IDs from study_projects.paper_ids (jsonb array)
    SELECT data_type
    INTO paper_ids_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'study_projects'
      AND column_name = 'paper_ids';

    IF to_regclass('public.study_projects') IS NOT NULL AND paper_ids_type = 'jsonb' THEN
        IF has_community_pyqs AND has_papers THEN
            WITH cleaned AS (
                SELECT
                    sp.id,
                    COALESCE((
                        SELECT jsonb_agg(elem)
                        FROM jsonb_array_elements(sp.paper_ids) AS elem
                        WHERE EXISTS (
                            SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = (elem #>> '{}')
                        )
                        OR EXISTS (
                            SELECT 1 FROM public.papers p WHERE p.id::text = (elem #>> '{}')
                        )
                    ), '[]'::jsonb) AS next_paper_ids
                FROM public.study_projects sp
                WHERE jsonb_typeof(sp.paper_ids) = 'array'
                  AND jsonb_array_length(sp.paper_ids) > 0
            )
            UPDATE public.study_projects sp
            SET
                paper_ids = cleaned.next_paper_ids,
                updated_at = now()
            FROM cleaned
            WHERE sp.id = cleaned.id
              AND sp.paper_ids IS DISTINCT FROM cleaned.next_paper_ids;
        ELSIF has_community_pyqs THEN
            WITH cleaned AS (
                SELECT
                    sp.id,
                    COALESCE((
                        SELECT jsonb_agg(elem)
                        FROM jsonb_array_elements(sp.paper_ids) AS elem
                        WHERE EXISTS (
                            SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = (elem #>> '{}')
                        )
                    ), '[]'::jsonb) AS next_paper_ids
                FROM public.study_projects sp
                WHERE jsonb_typeof(sp.paper_ids) = 'array'
                  AND jsonb_array_length(sp.paper_ids) > 0
            )
            UPDATE public.study_projects sp
            SET
                paper_ids = cleaned.next_paper_ids,
                updated_at = now()
            FROM cleaned
            WHERE sp.id = cleaned.id
              AND sp.paper_ids IS DISTINCT FROM cleaned.next_paper_ids;
        ELSIF has_papers THEN
            WITH cleaned AS (
                SELECT
                    sp.id,
                    COALESCE((
                        SELECT jsonb_agg(elem)
                        FROM jsonb_array_elements(sp.paper_ids) AS elem
                        WHERE EXISTS (
                            SELECT 1 FROM public.papers p WHERE p.id::text = (elem #>> '{}')
                        )
                    ), '[]'::jsonb) AS next_paper_ids
                FROM public.study_projects sp
                WHERE jsonb_typeof(sp.paper_ids) = 'array'
                  AND jsonb_array_length(sp.paper_ids) > 0
            )
            UPDATE public.study_projects sp
            SET
                paper_ids = cleaned.next_paper_ids,
                updated_at = now()
            FROM cleaned
            WHERE sp.id = cleaned.id
              AND sp.paper_ids IS DISTINCT FROM cleaned.next_paper_ids;
        END IF;

        GET DIAGNOSTICS updated_projects = ROW_COUNT;
        RAISE NOTICE 'Updated % study_projects row(s) containing genuinely orphaned paper_ids.', updated_projects;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. SAFE READ-ONLY VERIFICATION QUERIES
-- ----------------------------------------------------------------------------

-- 7A. Verify public.is_admin(uuid) is SECURITY DEFINER with hardened search_path
SELECT
    p.proname AS function_name,
    p.prosecdef AS is_security_definer,
    p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';

-- 7B. Verify active RLS policies on user_roles, community_pyqs, and paper_ratings
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_roles', 'community_pyqs', 'paper_ratings')
ORDER BY tablename, cmd, policyname;

-- 7C. Verify public.paper_ratings columns & unique constraint
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'paper_ratings'
ORDER BY ordinal_position;

-- 7D. Verify preserved user roles (owner intact), paper status breakdown, and user data counts
SELECT
    (SELECT count(*) FROM public.user_roles WHERE role = 'owner') AS owner_roles_preserved,
    (SELECT count(*) FROM public.user_roles) AS total_user_roles,
    (SELECT count(*) FROM public.community_pyqs) AS community_pyqs_total,
    (SELECT count(*) FROM public.community_pyqs WHERE status IN ('active', 'approved', 'published')) AS community_pyqs_public,
    (SELECT count(*) FROM public.paper_ratings) AS paper_ratings_total,
    (SELECT count(*) FROM public.saved_papers) AS saved_papers_remaining,
    (SELECT count(*) FROM public.study_projects) AS study_projects_preserved,
    (SELECT count(*) FROM public.quick_captures) AS quick_captures_preserved;

-- 7E. Verify zero orphaned saved_papers remain
SELECT count(*) AS remaining_orphaned_saved_papers
FROM public.saved_papers sp
WHERE NOT EXISTS (
    SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = sp.paper_id::text
)
AND NOT EXISTS (
    SELECT 1 FROM public.papers p WHERE p.id::text = sp.paper_id::text
);
