-- ============================================================================
-- STUDIFY — CONSOLIDATED CLEANUP, STORAGE RLS & MISSING TABLES MIGRATION
-- Filename: 20261117_cleanup_test_pyqs_and_ensure_policies.sql
--
-- Safe to paste and run ONCE in the Supabase SQL Editor.
--
-- What this script does:
--   1. Refreshes SECURITY DEFINER helper public.is_admin(uuid).
--   2. Fixes storage.objects SELECT & DELETE RLS policies on 'community-pyqs'
--      so verified admins/owners AND uploaders can cleanly delete objects.
--   3. Creates missing tables (paper_reports, moderation_logs,
--      user_moderation_status, notes, user_download_quotas) if absent.
--   4. Removes leftover broken/test PYQ rows ('Testing', 'phd', 'aaa', 'A')
--      and prunes orphaned saved_papers, paper_ratings, and project paper_ids.
--   5. Strictly preserves auth.users, public.user_roles (teamstudify5@gmail.com
--      owner role), schemas, and Storage buckets.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VERIFY / REFRESH SECURITY DEFINER HELPER public.is_admin(uuid)
-- ----------------------------------------------------------------------------
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
-- 2. FIX storage.objects RLS FOR 'community-pyqs' (OWNER OR VERIFIED ADMIN DELETE)
-- ----------------------------------------------------------------------------
DO $$
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
END $$;

DROP POLICY IF EXISTS "Community PYQs Owner Read" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Read" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Select" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Select" ON storage.objects;

DROP POLICY IF EXISTS "Community PYQs Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Delete" ON storage.objects;

CREATE POLICY "Community PYQs Owner Or Admin Read"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND (
        owner_id = (SELECT auth.uid()::text)
        OR public.is_admin((SELECT auth.uid()))
    )
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
        OR public.is_admin((SELECT auth.uid()))
    )
);

CREATE POLICY "Community PYQs Restrict Owner Or Admin Select"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO public
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            owner_id = (SELECT auth.uid()::text)
            OR public.is_admin((SELECT auth.uid()))
        )
    )
);

CREATE POLICY "Community PYQs Restrict Owner Or Admin Delete"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO public
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            owner_id = (SELECT auth.uid()::text)
            OR public.is_admin((SELECT auth.uid()))
        )
    )
);

-- ----------------------------------------------------------------------------
-- 3. ENSURE MISSING APPLICATION TABLES EXIST WITH RLS
-- ----------------------------------------------------------------------------
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

ALTER TABLE public.paper_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reports they created" ON public.paper_reports;
CREATE POLICY "Users can view reports they created"
ON public.paper_reports FOR SELECT
USING ((SELECT auth.uid()) = reporter_id OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.paper_reports;
CREATE POLICY "Authenticated users can submit reports"
ON public.paper_reports FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (reporter_id IS NULL OR reporter_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Only moderators can update reports" ON public.paper_reports;
CREATE POLICY "Only moderators can update reports"
ON public.paper_reports FOR UPDATE
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));

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

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view moderation logs" ON public.moderation_logs;
CREATE POLICY "Only admins can view moderation logs"
ON public.moderation_logs FOR SELECT
USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can record moderation logs" ON public.moderation_logs;
CREATE POLICY "Only admins can record moderation logs"
ON public.moderation_logs FOR INSERT
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.user_moderation_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_suspended boolean NOT NULL DEFAULT false,
    suspension_reason text,
    suspended_until timestamptz,
    suspended_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_moderation_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can check their own suspension status" ON public.user_moderation_status;
CREATE POLICY "Users can check their own suspension status"
ON public.user_moderation_status FOR SELECT
USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can manage user suspensions" ON public.user_moderation_status;
CREATE POLICY "Only admins can manage user suspensions"
ON public.user_moderation_status FOR ALL
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));

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

DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes"
ON public.notes FOR SELECT
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "Users can insert their own notes"
ON public.notes FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes"
ON public.notes FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes"
ON public.notes FOR DELETE
USING ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

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

ALTER TABLE public.user_download_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read their own download quota" ON public.user_download_quotas;
CREATE POLICY "Anyone can read their own download quota"
ON public.user_download_quotas FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can create their own download quota" ON public.user_download_quotas;
CREATE POLICY "Anyone can create their own download quota"
ON public.user_download_quotas FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update their own download quota" ON public.user_download_quotas;
CREATE POLICY "Anyone can update their own download quota"
ON public.user_download_quotas FOR UPDATE
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. CLEAN UP BROKEN & TEST PYQ RECORDS AND ORPHANED REFERENCES
--    (Preserves auth.users, public.user_roles, and all schemas)
-- ----------------------------------------------------------------------------
DELETE FROM public.community_pyqs
WHERE id::text IN (
    '7ebc1eca-e938-4a3d-af24-53fae359fb14', -- Testing (test image upload)
    'ef3f469b-4c6f-4806-b574-ee8fab1f0d41', -- phd (missing storage PDF)
    '047a4b3a-9f05-4d80-a5b3-1389b0e8db85', -- aaa (missing storage PDF)
    '0081501b-6ba7-480b-8120-281c3ecdf3f0'  -- A (missing storage image)
);

-- Remove orphaned paper_ratings referencing non-existent papers
DELETE FROM public.paper_ratings pr
WHERE NOT EXISTS (
    SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = pr.paper_id::text
)
AND NOT EXISTS (
    SELECT 1 FROM public.papers p WHERE p.id::text = pr.paper_id::text
);

-- Remove orphaned saved_papers referencing non-existent papers
DELETE FROM public.saved_papers sp
WHERE NOT EXISTS (
    SELECT 1 FROM public.community_pyqs cp WHERE cp.id::text = sp.paper_id::text
)
AND NOT EXISTS (
    SELECT 1 FROM public.papers p WHERE p.id::text = sp.paper_id::text
);

-- Prune non-existent paper IDs from study_projects.paper_ids
DO $$
BEGIN
    IF to_regclass('public.study_projects') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'study_projects'
             AND column_name = 'paper_ids'
             AND data_type = 'jsonb'
       ) THEN
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
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. SAFE VERIFICATION SUMMARY
-- ----------------------------------------------------------------------------
SELECT
    (SELECT count(*) FROM public.user_roles WHERE role = 'owner') AS owner_roles_preserved,
    (SELECT count(*) FROM public.community_pyqs) AS community_pyqs_remaining,
    (SELECT count(*) FROM public.papers) AS legacy_papers_remaining,
    (SELECT count(*) FROM public.saved_papers) AS saved_papers_remaining,
    (SELECT count(*) FROM public.paper_ratings) AS paper_ratings_remaining;
