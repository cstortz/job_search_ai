-- Adds profile address + per-field resume inclusion flags on users.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE job_search_ai.users
  ADD COLUMN IF NOT EXISTS resume_field_includes JSONB
    DEFAULT '{"name":true,"email":true,"phone":true,"location":true,"streetAddress":false,"linkedinUrl":true,"timezone":false}'::jsonb;

COMMENT ON COLUMN job_search_ai.users.resume_field_includes IS
  'Per-field flags for which profile values appear on generated resumes.';
