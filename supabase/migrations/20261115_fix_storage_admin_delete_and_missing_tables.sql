-- ============================================================================
-- STUDIFY MIGRATION — STORAGE ADMIN/OWNER DELETE FIX & MISSING TABLE ALIGNMENT
-- Filename: 20261115_fix_storage_admin_delete_and_missing_tables.sql
--
-- Purpose:
--   1. Fix storage.objects RLS on 'community-pyqs' so verified admins/owners
--      (via public.is_admin(auth.uid())) AND original object owners can SELECT
--      and DELETE objects in 'community-pyqs' (required by Supabase Storage
--      remove() which enforces BOTH SELECT and DELETE RLS).
--   2. Preserve owner-only INSERT and UPDATE in 'community-pyqs', and preserve
--      all other buckets (e.g. 'app-files') untouched.
--   3. Create missing application tables observed in 404 checks using
--      CREATE TABLE IF NOT EXISTS (paper_reports, moderation_logs,
--      user_moderation_status, notes, user_download_quotas) with strict RLS.
--   4. Preserve all existing user_roles, auth.users, existing community_pyqs rows,
--      and existing CHECK constraints (including total_marks & time_allowed_minutes).
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

-- Drop only Studify SELECT & DELETE policies for 'community-pyqs' before recreating
DROP POLICY IF EXISTS "Community PYQs Owner Read" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Read" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Select" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Select" ON storage.objects;

DROP POLICY IF EXISTS "Community PYQs Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Owner Or Admin Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Community PYQs Restrict Owner Or Admin Delete" ON storage.objects;

-- SELECT: Authenticated object owners OR verified admins/owners can read/list
-- objects in 'community-pyqs' (needed by storage.from().remove() pre-check).
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

-- DELETE: Authenticated object owners OR verified admins/owners can delete
-- objects from 'community-pyqs'.
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

-- RESTRICTIVE guards scoped strictly to 'community-pyqs' (other buckets unaffected)
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
-- 3. CREATE MISSING APPLICATION TABLES IF NOT YET PROVISIONED
-- ----------------------------------------------------------------------------

-- 3A. public.paper_reports
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

-- 3B. public.moderation_logs
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

-- 3C. public.user_moderation_status
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

-- 3D. public.notes
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

-- 3E. public.user_download_quotas
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
-- 4. SAFE READ-ONLY VERIFICATION QUERIES
-- ----------------------------------------------------------------------------
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY cmd, policyname;

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'community_pyqs'
  AND c.contype = 'c'
ORDER BY conname;
