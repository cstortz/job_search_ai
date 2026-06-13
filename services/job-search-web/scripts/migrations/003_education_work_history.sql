-- Education and job history profile sections
ALTER TABLE job_search_ai.users
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '{"degrees":[],"certifications":[],"postGradClasses":[]}'::jsonb;

ALTER TABLE job_search_ai.users
  ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN job_search_ai.users.education IS
  'Degrees, certifications, and post-graduate classes for resume generation';

COMMENT ON COLUMN job_search_ai.users.work_history IS
  'Employment timeline entries linked to skills for resume generation';
