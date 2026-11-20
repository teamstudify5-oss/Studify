-- ============================================================
-- STUDIFY MIGRATION 1
-- Community PYQs storage and strict RLS security
-- Execution Order: Run 1st in Supabase SQL Editor
-- ============================================================

-- 1. Configure the public storage bucket without deleting existing files.

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'community-pyqs',
    'community-pyqs',
    true,
    26214400, -- 25 MB in bytes (25 * 1024 * 1024)
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp'
    ];

-- 2. Verify that RLS is enabled and owner_id exists.
-- Do not modify the Supabase-managed table structure.

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
        RAISE EXCEPTION
            'RLS is not enabled on storage.objects. Resolve this before applying the migration.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'storage'
          AND table_name = 'objects'
          AND column_name = 'owner_id'
    ) THEN
        RAISE EXCEPTION
            'Expected storage.objects.owner_id was not found.';
    END IF;
END $$;

-- 3. Drop only previously used Studify policy names.
-- Never dynamically delete unknown or shared policies.

DROP POLICY IF EXISTS
    "Public Community PYQs Read Access" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Public Access" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Public Read" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Owner Read" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Authenticated Upload" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Owner Upload" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Owner Update" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Owner Delete" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Restrict Owner Select" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Restrict Owner Insert" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Restrict Owner Update" ON storage.objects;

DROP POLICY IF EXISTS
    "Community PYQs Restrict Owner Delete" ON storage.objects;

-- 4. SELECT: Authenticated users can list/read
-- only objects they own.
--
-- Public direct file retrieval is handled by the public bucket.
-- This does not grant anonymous bucket listing access.

CREATE POLICY "Community PYQs Owner Read"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND owner_id = (SELECT auth.uid()::text)
);

-- 5. INSERT: Authenticated users can upload
-- objects owned by their authenticated identity.

CREATE POLICY "Community PYQs Authenticated Upload"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'community-pyqs'
    AND (SELECT auth.uid()) IS NOT NULL
    AND owner_id = (SELECT auth.uid()::text)
);

-- 6. UPDATE: Only the actual object owner
-- can update or replace their own files.

CREATE POLICY "Community PYQs Owner Update"
ON storage.objects
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'community-pyqs'
    AND owner_id = (SELECT auth.uid()::text)
);

-- 7. DELETE: Only the actual object owner
-- can delete their own files.

CREATE POLICY "Community PYQs Owner Delete"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    bucket_id = 'community-pyqs'
    AND owner_id = (SELECT auth.uid()::text)
);

-- 8. RESTRICTIVE SELECT GUARD
-- Prevent other permissive policies from allowing
-- anonymous or non-owner bucket listing.

CREATE POLICY "Community PYQs Restrict Owner Select"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO public
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
    )
);

-- 9. RESTRICTIVE INSERT GUARD
-- Prevent broad existing policies from bypassing
-- authenticated ownership requirements.

CREATE POLICY "Community PYQs Restrict Owner Insert"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
    )
);

-- 10. RESTRICTIVE UPDATE GUARD

CREATE POLICY "Community PYQs Restrict Owner Update"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO public
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
    )
)
WITH CHECK (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
    )
);

-- 11. RESTRICTIVE DELETE GUARD

CREATE POLICY "Community PYQs Restrict Owner Delete"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO public
USING (
    bucket_id IS DISTINCT FROM 'community-pyqs'
    OR (
        (SELECT auth.uid()) IS NOT NULL
        AND owner_id = (SELECT auth.uid()::text)
    )
);
