-- Profile IA expansion: marketing statements, demographics, job preferences stub
ALTER TABLE job_search_ai.users
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS work_authorization TEXT,
  ADD COLUMN IF NOT EXISTS marketing_statements JSONB
    DEFAULT '{"headline":"","pitch":"","includeHeadlineInResume":true,"includePitchInResume":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS job_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN job_search_ai.users.preferred_name IS
  'Display/preferred name shown on profile and resume';
COMMENT ON COLUMN job_search_ai.users.work_authorization IS
  'Work authorization status for job matching (not shared with employers by default)';
COMMENT ON COLUMN job_search_ai.users.marketing_statements IS
  'Personal headline and pitch shown on home page with resume include toggles';
COMMENT ON COLUMN job_search_ai.users.job_preferences IS
  'Job matching preferences: relocation, office type, job search settings';
