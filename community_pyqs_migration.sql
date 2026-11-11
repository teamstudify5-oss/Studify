-- ==============================================================================
-- STUDIFY DATABASE MIGRATION: Make total_marks and time_allowed_minutes nullable
-- Target table: public.community_pyqs
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

ALTER TABLE public.community_pyqs
  ALTER COLUMN total_marks DROP NOT NULL,
  ALTER COLUMN total_marks DROP DEFAULT,
  ALTER COLUMN time_allowed_minutes DROP NOT NULL,
  ALTER COLUMN time_allowed_minutes DROP DEFAULT;

-- Confirm columns are nullable
COMMENT ON COLUMN public.community_pyqs.total_marks IS 'Optional positive integer. Null when unspecified by uploader.';
COMMENT ON COLUMN public.community_pyqs.time_allowed_minutes IS 'Optional positive integer duration in minutes. Null when unspecified by uploader.';
