-- ============================================================================
-- Job Search AI Database Setup Script
-- ============================================================================
-- This script creates the database schema for the Job Search AI application.
-- It includes all tables, indexes, foreign keys, and comments for MCP/LLM use.
--
-- Databases: job_search_ai_dev, job_search_ai_prod
-- Schema: job_search_ai
--
-- Usage:
--   1. Connect to job_search_ai_dev:  psql -d job_search_ai_dev -f database_setup.sql
--   2. Connect to job_search_ai_prod: psql -d job_search_ai_prod -f database_setup.sql
--
-- SQLAlchemy Compatibility:
--   This schema is designed to work seamlessly with SQLAlchemy ORM.
--   See sqlalchemy_requirements.md for complete setup instructions and examples.
--   Key points:
--   - All tables use snake_case naming (SQLAlchemy convention)
--   - UUID primary keys use uuid_generate_v4() as server_default
--   - Timestamps use CURRENT_TIMESTAMP as server_default
--   - Updated_at triggers work with SQLAlchemy
--   - Schema must be specified in models: __table_args__ = {'schema': 'job_search_ai'}
--
-- Note: This script creates the schema and all tables. Run once per database.
-- All tables, columns, and the schema itself have COMMENT fields for MCP/LLM use.
-- ============================================================================

-- ============================================================================
-- Create Schema First
-- ============================================================================
-- Create the schema first so we can reference it and set search_path appropriately.
-- Some clients (e.g. JDBC, DBeaver) may connect with an empty search_path,
-- which causes "no schema has been selected to create in" (3F000).
-- Note: This database does not use the public schema (removed for security/organization).

CREATE SCHEMA IF NOT EXISTS job_search_ai;
COMMENT ON SCHEMA job_search_ai IS 'Main schema for Job Search AI application. Contains all tables for job search, applications, skills, assessments, and related data.';

-- Set search path to our schema (public schema does not exist in this database)
SET search_path TO job_search_ai;

-- ============================================================================
-- Enable Required Extensions
-- ============================================================================
-- Extensions are installed in the job_search_ai schema.
-- Extensions are database-wide objects, but their functions/objects are created
-- in the specified schema. They will be accessible throughout the database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA job_search_ai;
COMMENT ON EXTENSION "uuid-ossp" IS 'Extension for generating UUIDs';

CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA job_search_ai;
COMMENT ON EXTENSION "vector" IS 'pgvector extension for vector similarity search (used for RAG over skills)';

-- ============================================================================
-- Table: users
-- Description: User accounts with Auth0 integration and profile information
-- ============================================================================

CREATE TABLE job_search_ai.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth0_subject_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    linkedin_url VARCHAR(500),
    other_urls JSONB,
    resume_field_includes JSONB DEFAULT '{"name":true,"preferredName":true,"email":true,"phone":true,"location":true,"streetAddress":false,"linkedinUrl":true,"timezone":false,"workAuthorization":false}'::jsonb,
    preferred_name TEXT,
    work_authorization TEXT,
    marketing_statements JSONB DEFAULT '{"headline":"","pitch":"","includeHeadlineInResume":true,"includePitchInResume":true}'::jsonb,
    job_preferences JSONB DEFAULT '{}'::jsonb,
    education JSONB,
    timezone VARCHAR(100) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true, "in_app": true}'::jsonb,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.users IS 'User accounts with Auth0 authentication. Each user has their own isolated data including jobs, applications, skills, and assessments.';
COMMENT ON COLUMN job_search_ai.users.id IS 'Primary key UUID for the user';
COMMENT ON COLUMN job_search_ai.users.auth0_subject_id IS 'Unique identifier from Auth0 (sub claim). Used for authentication and user identification';
COMMENT ON COLUMN job_search_ai.users.name IS 'User full name';
COMMENT ON COLUMN job_search_ai.users.phone IS 'User phone number';
COMMENT ON COLUMN job_search_ai.users.address IS 'User postal address';
COMMENT ON COLUMN job_search_ai.users.email IS 'User email address (must be unique)';
COMMENT ON COLUMN job_search_ai.users.email_verified IS 'Whether the email address has been verified';
COMMENT ON COLUMN job_search_ai.users.linkedin_url IS 'User LinkedIn profile URL';
COMMENT ON COLUMN job_search_ai.users.other_urls IS 'JSON array of other URLs: [{"name":"GitHub","url":"https://...","includeInResume":true}]';
COMMENT ON COLUMN job_search_ai.users.resume_field_includes IS 'Per-field flags for which profile values appear on generated resumes';
COMMENT ON COLUMN job_search_ai.users.education IS 'JSON array of education entries: [{"institution": "...", "field": "...", "degree": "..."}]';
COMMENT ON COLUMN job_search_ai.users.timezone IS 'User timezone (e.g., "America/New_York", "UTC") for scheduling reminders and notifications';
COMMENT ON COLUMN job_search_ai.users.notification_preferences IS 'JSON object with notification channel preferences: {"email": true, "sms": false, "push": true, "in_app": true}';
COMMENT ON COLUMN job_search_ai.users.last_login_at IS 'Timestamp of last user login';
COMMENT ON COLUMN job_search_ai.users.created_at IS 'Timestamp when user account was created';
COMMENT ON COLUMN job_search_ai.users.updated_at IS 'Timestamp when user record was last updated';

CREATE INDEX idx_users_auth0_subject_id ON job_search_ai.users(auth0_subject_id);
CREATE INDEX idx_users_email ON job_search_ai.users(email);

-- ============================================================================
-- Table: job_sources
-- Description: Job sources for automated and on-demand job retrieval
-- ============================================================================

CREATE TABLE job_search_ai.job_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    company VARCHAR(255),
    industry VARCHAR(255),
    us_postal_address TEXT,
    url VARCHAR(1000) NOT NULL,
    frequency VARCHAR(50),
    last_polled_at TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN DEFAULT TRUE,
    last_error_message TEXT,
    error_count INTEGER DEFAULT 0,
    timezone VARCHAR(100) DEFAULT 'UTC',
    authentication_type VARCHAR(50),
    authentication_credentials TEXT, -- Stored as SealedSecret in application
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.job_sources IS 'Job sources configured by users for automated polling. Each source produces many job postings. Authentication credentials are stored securely as SealedSecrets in Kubernetes.';
COMMENT ON COLUMN job_search_ai.job_sources.id IS 'Primary key UUID for the job source';
COMMENT ON COLUMN job_search_ai.job_sources.user_id IS 'Foreign key to users table. Each job source belongs to a user';
COMMENT ON COLUMN job_search_ai.job_sources.company IS 'Company name associated with this job source';
COMMENT ON COLUMN job_search_ai.job_sources.industry IS 'Industry category for this job source';
COMMENT ON COLUMN job_search_ai.job_sources.us_postal_address IS 'US postal address for the job source (can be null)';
COMMENT ON COLUMN job_search_ai.job_sources.url IS 'URL for the job site to poll';
COMMENT ON COLUMN job_search_ai.job_sources.frequency IS 'Frequency to poll the job site (e.g., "daily", "weekly", "hourly")';
COMMENT ON COLUMN job_search_ai.job_sources.last_polled_at IS 'Timestamp of last successful polling';
COMMENT ON COLUMN job_search_ai.job_sources.enabled IS 'Whether this job source is currently active';
COMMENT ON COLUMN job_search_ai.job_sources.last_error_message IS 'Error message from last failed polling attempt';
COMMENT ON COLUMN job_search_ai.job_sources.error_count IS 'Number of consecutive errors';
COMMENT ON COLUMN job_search_ai.job_sources.timezone IS 'Timezone for scheduling polls (e.g., "America/New_York")';
COMMENT ON COLUMN job_search_ai.job_sources.authentication_type IS 'Type of authentication required: "none", "basic", "api_key", "session_cookie"';
COMMENT ON COLUMN job_search_ai.job_sources.authentication_credentials IS 'Authentication credentials (username, password, API key, session token). Stored as SealedSecret in Kubernetes, not in database';
COMMENT ON COLUMN job_search_ai.job_sources.created_at IS 'Timestamp when job source was created';
COMMENT ON COLUMN job_search_ai.job_sources.updated_at IS 'Timestamp when job source was last updated';

CREATE INDEX idx_job_sources_user_id ON job_search_ai.job_sources(user_id);
CREATE INDEX idx_job_sources_enabled ON job_search_ai.job_sources(enabled);

-- ============================================================================
-- Table: jobs
-- Description: Job postings retrieved from job sources
-- ============================================================================

CREATE TABLE job_search_ai.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_source_id UUID REFERENCES job_search_ai.job_sources(id) ON DELETE SET NULL,
    job_title VARCHAR(500) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    job_description_text TEXT,
    requirements_text TEXT,
    application_url VARCHAR(1000),
    job_url VARCHAR(1000) NOT NULL,
    external_job_id VARCHAR(255),
    posting_date DATE,
    salary_range JSONB,
    location VARCHAR(500),
    job_location_type VARCHAR(50),
    job_type VARCHAR(50),
    job_level VARCHAR(50),
    application_deadline DATE,
    user_interest_level VARCHAR(50),
    user_tags JSONB,
    status VARCHAR(50) DEFAULT 'active',
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.jobs IS 'Job postings retrieved from job sources. Multiple users can have the same job posting (same external_job_id), but each user instance is separate.';
COMMENT ON COLUMN job_search_ai.jobs.id IS 'Primary key UUID for the job posting';
COMMENT ON COLUMN job_search_ai.jobs.user_id IS 'Foreign key to users table. Each job belongs to a user';
COMMENT ON COLUMN job_search_ai.jobs.job_source_id IS 'Foreign key to job_sources table. The job source that produced this job posting';
COMMENT ON COLUMN job_search_ai.jobs.job_title IS 'Job title from the posting';
COMMENT ON COLUMN job_search_ai.jobs.company_name IS 'Company name from the posting';
COMMENT ON COLUMN job_search_ai.jobs.job_description_text IS 'Full job posting content/description';
COMMENT ON COLUMN job_search_ai.jobs.requirements_text IS 'Requirements and qualifications text from the posting';
COMMENT ON COLUMN job_search_ai.jobs.application_url IS 'URL for submitting application';
COMMENT ON COLUMN job_search_ai.jobs.job_url IS 'Original posting URL';
COMMENT ON COLUMN job_search_ai.jobs.external_job_id IS 'Unique identifier from the source (if available). Used to detect duplicate jobs across sources';
COMMENT ON COLUMN job_search_ai.jobs.posting_date IS 'Date when the job was posted by the employer';
COMMENT ON COLUMN job_search_ai.jobs.salary_range IS 'JSON object: {"min": 80000, "max": 120000, "currency": "USD"} or string like "$80k-$120k"';
COMMENT ON COLUMN job_search_ai.jobs.location IS 'Location: city, state, country, or "Remote"';
COMMENT ON COLUMN job_search_ai.jobs.job_location_type IS 'Location type: "remote", "hybrid", "onsite"';
COMMENT ON COLUMN job_search_ai.jobs.job_type IS 'Job type: "full-time", "part-time", "contract", "internship"';
COMMENT ON COLUMN job_search_ai.jobs.job_level IS 'Job level: "entry", "mid", "senior", "executive"';
COMMENT ON COLUMN job_search_ai.jobs.application_deadline IS 'Application deadline if specified by the job posting';
COMMENT ON COLUMN job_search_ai.jobs.user_interest_level IS 'User interest level: "interested", "not_interested", "maybe", "applied"';
COMMENT ON COLUMN job_search_ai.jobs.user_tags IS 'JSON array of user-defined tags for categorization';
COMMENT ON COLUMN job_search_ai.jobs.status IS 'Job status: "active", "expired", "archived"';
COMMENT ON COLUMN job_search_ai.jobs.first_seen_at IS 'Timestamp when job was first seen/retrieved';
COMMENT ON COLUMN job_search_ai.jobs.last_fetched_at IS 'Timestamp when job posting was last fetched/updated';
COMMENT ON COLUMN job_search_ai.jobs.created_at IS 'Timestamp when job record was created';
COMMENT ON COLUMN job_search_ai.jobs.updated_at IS 'Timestamp when job record was last updated';

CREATE INDEX idx_jobs_user_id ON job_search_ai.jobs(user_id);
CREATE INDEX idx_jobs_job_source_id ON job_search_ai.jobs(job_source_id);
CREATE INDEX idx_jobs_external_job_id ON job_search_ai.jobs(external_job_id);
CREATE INDEX idx_jobs_status ON job_search_ai.jobs(status);
CREATE INDEX idx_jobs_user_interest_level ON job_search_ai.jobs(user_interest_level);
CREATE INDEX idx_jobs_company_name ON job_search_ai.jobs(company_name);
CREATE INDEX idx_jobs_posting_date ON job_search_ai.jobs(posting_date);

-- ============================================================================
-- Table: assessments
-- Description: AI-powered assessments of candidate skills against job requirements
-- ============================================================================

CREATE TABLE job_search_ai.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_search_ai.jobs(id) ON DELETE CASCADE,
    markdown_assessment TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    skills_matched JSONB,
    gaps JSONB,
    gap_filling_resources JSONB,
    assessment_model_version VARCHAR(255),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, job_id)
);

COMMENT ON TABLE job_search_ai.assessments IS 'AI-powered assessments comparing candidate skills to job requirements. One assessment per user per job. Uses RAG to find relevant skills from skill_embeddings table.';
COMMENT ON COLUMN job_search_ai.assessments.id IS 'Primary key UUID for the assessment';
COMMENT ON COLUMN job_search_ai.assessments.user_id IS 'Foreign key to users table. Each assessment belongs to a user';
COMMENT ON COLUMN job_search_ai.assessments.job_id IS 'Foreign key to jobs table. The job being assessed';
COMMENT ON COLUMN job_search_ai.assessments.markdown_assessment IS 'Markdown formatted assessment of the candidate to the job';
COMMENT ON COLUMN job_search_ai.assessments.score IS 'Match score between 0 and 100 for the candidate';
COMMENT ON COLUMN job_search_ai.assessments.skills_matched IS 'JSON array of skills that the candidate HAS that match the job: ["Python", "PostgreSQL", "FastAPI"]';
COMMENT ON COLUMN job_search_ai.assessments.gaps IS 'JSON array of skill gaps: ["Python", "AWS", "Docker"]';
COMMENT ON COLUMN job_search_ai.assessments.gap_filling_resources IS 'JSON array of objects: [{"url": "...", "type": "training"|"certification"|"schooling", "title": "..."}]';
COMMENT ON COLUMN job_search_ai.assessments.assessment_model_version IS 'AI model and version that generated this assessment (e.g., "claude-3-5-sonnet-v1")';
COMMENT ON COLUMN job_search_ai.assessments.generated_at IS 'Timestamp when the assessment was created/generated';
COMMENT ON COLUMN job_search_ai.assessments.created_at IS 'Timestamp when assessment record was created';
COMMENT ON COLUMN job_search_ai.assessments.updated_at IS 'Timestamp when assessment record was last updated';

CREATE INDEX idx_assessments_user_id ON job_search_ai.assessments(user_id);
CREATE INDEX idx_assessments_job_id ON job_search_ai.assessments(job_id);
CREATE INDEX idx_assessments_score ON job_search_ai.assessments(score);

-- ============================================================================
-- Table: roles
-- Description: Work experience/role entries for user resume
-- ============================================================================

CREATE TABLE job_search_ai.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    employment_type VARCHAR(50),
    reason_for_leaving TEXT,
    achievements TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.roles IS 'Work experience entries for user resume. These are the "resume" entries that describe past and current roles.';
COMMENT ON COLUMN job_search_ai.roles.id IS 'Primary key UUID for the role';
COMMENT ON COLUMN job_search_ai.roles.user_id IS 'Foreign key to users table. Each role belongs to a user';
COMMENT ON COLUMN job_search_ai.roles.job_title IS 'Job title for this role';
COMMENT ON COLUMN job_search_ai.roles.company_name IS 'Company name where user worked';
COMMENT ON COLUMN job_search_ai.roles.start_date IS 'Start date of the role';
COMMENT ON COLUMN job_search_ai.roles.end_date IS 'End date of the role (null for current role)';
COMMENT ON COLUMN job_search_ai.roles.employment_type IS 'Employment type: "full-time", "part-time", "contract", "internship", "freelance"';
COMMENT ON COLUMN job_search_ai.roles.reason_for_leaving IS 'Optional reason why user left this role';
COMMENT ON COLUMN job_search_ai.roles.achievements IS 'Key achievements and accomplishments in this role (separate from description)';
COMMENT ON COLUMN job_search_ai.roles.description IS 'Optional description/notes about the role';
COMMENT ON COLUMN job_search_ai.roles.created_at IS 'Timestamp when role record was created';
COMMENT ON COLUMN job_search_ai.roles.updated_at IS 'Timestamp when role record was last updated';

CREATE INDEX idx_roles_user_id ON job_search_ai.roles(user_id);
CREATE INDEX idx_roles_company_name ON job_search_ai.roles(company_name);

-- ============================================================================
-- Table: skills
-- Description: Reusable skill definitions
-- ============================================================================

CREATE TABLE job_search_ai.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(50),
    description TEXT,
    years_of_experience INTEGER,
    last_used_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_name)
);

COMMENT ON TABLE job_search_ai.skills IS 'Reusable skill definitions. Skills can be referenced by multiple roles and resume packages.';
COMMENT ON COLUMN job_search_ai.skills.id IS 'Primary key UUID for the skill';
COMMENT ON COLUMN job_search_ai.skills.user_id IS 'Foreign key to users table. Each skill belongs to a user';
COMMENT ON COLUMN job_search_ai.skills.skill_name IS 'Name of the skill (e.g., "Python", "Project Management")';
COMMENT ON COLUMN job_search_ai.skills.skill_category IS 'Skill category: "technical", "soft_skill", "language", "certification", "tool", "framework", "methodology"';
COMMENT ON COLUMN job_search_ai.skills.description IS 'Optional description of the skill';
COMMENT ON COLUMN job_search_ai.skills.years_of_experience IS 'Total years of experience with this skill';
COMMENT ON COLUMN job_search_ai.skills.last_used_date IS 'Most recent date this skill was used';
COMMENT ON COLUMN job_search_ai.skills.created_at IS 'Timestamp when skill record was created';
COMMENT ON COLUMN job_search_ai.skills.updated_at IS 'Timestamp when skill record was last updated';

CREATE INDEX idx_skills_user_id ON job_search_ai.skills(user_id);
CREATE INDEX idx_skills_skill_name ON job_search_ai.skills(skill_name);
CREATE INDEX idx_skills_category ON job_search_ai.skills(skill_category);

-- ============================================================================
-- Table: skill_embeddings
-- Description: Vector embeddings for RAG-based skill matching
-- ============================================================================

CREATE TABLE job_search_ai.skill_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES job_search_ai.roles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES job_search_ai.skills(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- Default dimension, can be adjusted
    embedding_model_version VARCHAR(255),
    embedding_dimension INTEGER DEFAULT 1536,
    index_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.skill_embeddings IS 'Vector embeddings for RAG (Retrieval-Augmented Generation). Stores pgvector embeddings of skill chunks for semantic similarity search. Used to find relevant skills when assessing jobs.';
COMMENT ON COLUMN job_search_ai.skill_embeddings.id IS 'Primary key UUID for the skill embedding';
COMMENT ON COLUMN job_search_ai.skill_embeddings.user_id IS 'Foreign key to users table. Each embedding belongs to a user';
COMMENT ON COLUMN job_search_ai.skill_embeddings.role_id IS 'Foreign key to roles table. Which role this skill was used in';
COMMENT ON COLUMN job_search_ai.skill_embeddings.skill_id IS 'Foreign key to skills table. Which skill this embedding represents';
COMMENT ON COLUMN job_search_ai.skill_embeddings.chunk_text IS 'The specific text/chunk that describes how this skill was used in this role. This is what gets embedded.';
COMMENT ON COLUMN job_search_ai.skill_embeddings.embedding IS 'pgvector column - the vector representation of the chunk text. Default dimension 1536 (OpenAI text-embedding-3-large).';
COMMENT ON COLUMN job_search_ai.skill_embeddings.embedding_model_version IS 'Which embedding model was used (e.g., "text-embedding-3-large")';
COMMENT ON COLUMN job_search_ai.skill_embeddings.embedding_dimension IS 'Dimension of the embedding vector (e.g., 1536)';
COMMENT ON COLUMN job_search_ai.skill_embeddings.index_type IS 'pgvector index type: "ivfflat", "hnsw", or "none"';
COMMENT ON COLUMN job_search_ai.skill_embeddings.created_at IS 'Timestamp when embedding record was created';
COMMENT ON COLUMN job_search_ai.skill_embeddings.updated_at IS 'Timestamp when embedding record was last updated';

CREATE INDEX idx_skill_embeddings_user_id ON job_search_ai.skill_embeddings(user_id);
CREATE INDEX idx_skill_embeddings_role_id ON job_search_ai.skill_embeddings(role_id);
CREATE INDEX idx_skill_embeddings_skill_id ON job_search_ai.skill_embeddings(skill_id);
-- Vector similarity index (HNSW for better performance)
CREATE INDEX idx_skill_embeddings_embedding_hnsw ON job_search_ai.skill_embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- Table: resume_packages
-- Description: Resume packages created for specific job applications
-- ============================================================================

CREATE TABLE job_search_ai.resume_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job_search_ai.jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'draft',
    application_status VARCHAR(50),
    date_applied TIMESTAMP WITH TIME ZONE,
    date_of_last_status_change TIMESTAMP WITH TIME ZONE,
    application_method VARCHAR(50),
    application_tracking_number VARCHAR(255),
    portal_url VARCHAR(1000),
    portal_username VARCHAR(255), -- Stored as SealedSecret in application
    portal_password VARCHAR(255), -- Stored as SealedSecret in application
    application_confirmation_number VARCHAR(255),
    version_number INTEGER DEFAULT 1,
    parent_resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    resume_file_url VARCHAR(1000),
    resume_file_path VARCHAR(1000),
    resume_storage_type VARCHAR(50),
    resume_file_size BIGINT,
    resume_file_format VARCHAR(50),
    cover_letter_file_url VARCHAR(1000),
    cover_letter_file_path VARCHAR(1000),
    cover_letter_storage_type VARCHAR(50),
    cover_letter_file_size BIGINT,
    cover_letter_file_format VARCHAR(50),
    skills_used JSONB,
    executive_statement TEXT,
    technical_proficiencies TEXT,
    resume_maker_json JSONB,
    cover_letter_maker_json JSONB,
    resume_maker_template_version VARCHAR(255),
    application_notes TEXT,
    application_form_data JSONB,
    rejection_reason TEXT,
    rejection_feedback TEXT,
    withdrawal_reason TEXT,
    archive_date TIMESTAMP WITH TIME ZONE,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.resume_packages IS 'Resume packages created for specific job applications. Includes resume, cover letter, and application metadata. Supports versioning for multiple resume versions per job.';
COMMENT ON COLUMN job_search_ai.resume_packages.id IS 'Primary key UUID for the resume package';
COMMENT ON COLUMN job_search_ai.resume_packages.user_id IS 'Foreign key to users table. Each resume package belongs to a user';
COMMENT ON COLUMN job_search_ai.resume_packages.job_id IS 'Foreign key to jobs table. The job this resume package is for';
COMMENT ON COLUMN job_search_ai.resume_packages.status IS 'Package status: "draft", "submitted", "withdrawn"';
COMMENT ON COLUMN job_search_ai.resume_packages.application_status IS 'Application status: "applied", "under_review", "interview_scheduled", "interview_completed", "offer_received", "rejected", "withdrawn"';
COMMENT ON COLUMN job_search_ai.resume_packages.date_applied IS 'Timestamp when the application was submitted';
COMMENT ON COLUMN job_search_ai.resume_packages.date_of_last_status_change IS 'Timestamp when application status was last updated';
COMMENT ON COLUMN job_search_ai.resume_packages.application_method IS 'Application method: "email", "form", "linkedin_easy_apply", "company_portal", "recruiter", "other"';
COMMENT ON COLUMN job_search_ai.resume_packages.application_tracking_number IS 'Tracking number provided by employer (if available)';
COMMENT ON COLUMN job_search_ai.resume_packages.portal_url IS 'URL to employer application portal (if applicable)';
COMMENT ON COLUMN job_search_ai.resume_packages.portal_username IS 'Username for application portal. Stored as SealedSecret in Kubernetes, not in database';
COMMENT ON COLUMN job_search_ai.resume_packages.portal_password IS 'Password for application portal. Stored as SealedSecret in Kubernetes, not in database';
COMMENT ON COLUMN job_search_ai.resume_packages.application_confirmation_number IS 'Confirmation number/receipt from application submission';
COMMENT ON COLUMN job_search_ai.resume_packages.version_number IS 'Version number for tracking multiple versions of resume for the same job';
COMMENT ON COLUMN job_search_ai.resume_packages.parent_resume_package_id IS 'Foreign key to resume_packages table. References previous version if this is a revision';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_file_url IS 'URL to generated resume file storage location';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_file_path IS 'Storage path or object key for the resume file';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_storage_type IS 'Storage type: "s3", "local", "object-storage"';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_file_size IS 'Resume file size in bytes';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_file_format IS 'Resume file format: "pdf", "docx"';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_file_url IS 'URL to generated cover letter file storage location';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_file_path IS 'Storage path or object key for the cover letter file';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_storage_type IS 'Storage type: "s3", "local", "object-storage"';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_file_size IS 'Cover letter file size in bytes';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_file_format IS 'Cover letter file format: "pdf", "docx"';
COMMENT ON COLUMN job_search_ai.resume_packages.skills_used IS 'JSON array of skill IDs used in this resume';
COMMENT ON COLUMN job_search_ai.resume_packages.executive_statement IS 'One line about the candidate that stands out';
COMMENT ON COLUMN job_search_ai.resume_packages.technical_proficiencies IS 'Pipe-delimited list of technical proficiencies';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_maker_json IS 'JSON payload sent to resume maker to create the resume';
COMMENT ON COLUMN job_search_ai.resume_packages.cover_letter_maker_json IS 'JSON payload sent to resume maker to create the cover letter';
COMMENT ON COLUMN job_search_ai.resume_packages.resume_maker_template_version IS 'Template name and version used to generate this resume';
COMMENT ON COLUMN job_search_ai.resume_packages.application_notes IS 'User notes about the application process, company research, etc.';
COMMENT ON COLUMN job_search_ai.resume_packages.application_form_data IS 'JSON object storing form field data for jobs requiring form submissions';
COMMENT ON COLUMN job_search_ai.resume_packages.rejection_reason IS 'Reason provided by employer or inferred (if application status is "rejected")';
COMMENT ON COLUMN job_search_ai.resume_packages.rejection_feedback IS 'Detailed feedback from employer (if provided)';
COMMENT ON COLUMN job_search_ai.resume_packages.withdrawal_reason IS 'Reason for withdrawal (if application status is "withdrawn")';
COMMENT ON COLUMN job_search_ai.resume_packages.archive_date IS 'Timestamp when application was archived (if applicable)';
COMMENT ON COLUMN job_search_ai.resume_packages.generated_at IS 'Timestamp when resume/cover letter files were generated';
COMMENT ON COLUMN job_search_ai.resume_packages.created_at IS 'Timestamp when resume package record was created';
COMMENT ON COLUMN job_search_ai.resume_packages.updated_at IS 'Timestamp when resume package record was last updated';

CREATE INDEX idx_resume_packages_user_id ON job_search_ai.resume_packages(user_id);
CREATE INDEX idx_resume_packages_job_id ON job_search_ai.resume_packages(job_id);
CREATE INDEX idx_resume_packages_application_status ON job_search_ai.resume_packages(application_status);
CREATE INDEX idx_resume_packages_status ON job_search_ai.resume_packages(status);
CREATE INDEX idx_resume_packages_parent_id ON job_search_ai.resume_packages(parent_resume_package_id);

-- ============================================================================
-- Table: email_tracking
-- Description: Email tracking for job application communications
-- ============================================================================

CREATE TABLE job_search_ai.email_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    email_subject VARCHAR(500),
    email_body TEXT,
    recipient_email VARCHAR(255),
    sender_email VARCHAR(255),
    email_date TIMESTAMP WITH TIME ZONE,
    message_id VARCHAR(500),
    thread_id VARCHAR(500),
    status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (resume_package_id IS NOT NULL OR job_id IS NOT NULL)
);

COMMENT ON TABLE job_search_ai.email_tracking IS 'Tracks all email communications related to job applications. Can reference either a Resume Package (for application emails) or directly to a Job (for general correspondence).';
COMMENT ON COLUMN job_search_ai.email_tracking.id IS 'Primary key UUID for the email tracking record';
COMMENT ON COLUMN job_search_ai.email_tracking.user_id IS 'Foreign key to users table. Each email tracking record belongs to a user';
COMMENT ON COLUMN job_search_ai.email_tracking.resume_package_id IS 'Foreign key to resume_packages table. References application if email is related to specific application';
COMMENT ON COLUMN job_search_ai.email_tracking.job_id IS 'Foreign key to jobs table. References job if email is general correspondence';
COMMENT ON COLUMN job_search_ai.email_tracking.event_type IS 'Event type: "application_sent", "reply_received", "email_opened", "follow_up_sent"';
COMMENT ON COLUMN job_search_ai.email_tracking.email_subject IS 'Email subject line';
COMMENT ON COLUMN job_search_ai.email_tracking.email_body IS 'Full email content or reference to stored email file';
COMMENT ON COLUMN job_search_ai.email_tracking.recipient_email IS 'Recipient email address';
COMMENT ON COLUMN job_search_ai.email_tracking.sender_email IS 'Sender email address';
COMMENT ON COLUMN job_search_ai.email_tracking.email_date IS 'Timestamp when the email was sent/received';
COMMENT ON COLUMN job_search_ai.email_tracking.message_id IS 'Email message ID for deduplication';
COMMENT ON COLUMN job_search_ai.email_tracking.thread_id IS 'Email thread ID for grouping related emails';
COMMENT ON COLUMN job_search_ai.email_tracking.status IS 'Email status: "sent", "delivered", "opened", "replied", "bounced"';
COMMENT ON COLUMN job_search_ai.email_tracking.notes IS 'Optional text notes about this email';
COMMENT ON COLUMN job_search_ai.email_tracking.created_at IS 'Timestamp when email tracking record was created';
COMMENT ON COLUMN job_search_ai.email_tracking.updated_at IS 'Timestamp when email tracking record was last updated';

CREATE INDEX idx_email_tracking_user_id ON job_search_ai.email_tracking(user_id);
CREATE INDEX idx_email_tracking_resume_package_id ON job_search_ai.email_tracking(resume_package_id);
CREATE INDEX idx_email_tracking_job_id ON job_search_ai.email_tracking(job_id);
CREATE INDEX idx_email_tracking_thread_id ON job_search_ai.email_tracking(thread_id);
CREATE INDEX idx_email_tracking_message_id ON job_search_ai.email_tracking(message_id);

-- ============================================================================
-- Table: interviews
-- Description: Interview scheduling and management
-- ============================================================================

CREATE TABLE job_search_ai.interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    interview_round_number VARCHAR(50),
    interview_type VARCHAR(50),
    interview_format VARCHAR(50),
    interview_date_time TIMESTAMP WITH TIME ZONE,
    interview_duration INTEGER,
    location TEXT,
    interviewer_names JSONB,
    interviewer_emails JSONB,
    meeting_link VARCHAR(1000),
    interview_preparation_notes TEXT,
    interview_notes TEXT,
    interview_feedback TEXT,
    interview_rating INTEGER CHECK (interview_rating >= 1 AND interview_rating <= 5),
    interview_cost DECIMAL(10, 2),
    interview_outcome VARCHAR(50),
    cancellation_reason TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (job_id IS NOT NULL OR resume_package_id IS NOT NULL)
);

COMMENT ON TABLE job_search_ai.interviews IS 'Tracks all interviews related to job applications. Can reference either a Job or Resume Package. Round number helps track multiple interview rounds for the same application.';
COMMENT ON COLUMN job_search_ai.interviews.id IS 'Primary key UUID for the interview';
COMMENT ON COLUMN job_search_ai.interviews.user_id IS 'Foreign key to users table. Each interview belongs to a user';
COMMENT ON COLUMN job_search_ai.interviews.job_id IS 'Foreign key to jobs table. The job this interview is for';
COMMENT ON COLUMN job_search_ai.interviews.resume_package_id IS 'Foreign key to resume_packages table. The application this interview is for';
COMMENT ON COLUMN job_search_ai.interviews.interview_round_number IS 'Interview round: "first_round", "second_round", "final_round", "other"';
COMMENT ON COLUMN job_search_ai.interviews.interview_type IS 'Interview type: "phone", "video", "onsite", "technical_assessment", "behavioral"';
COMMENT ON COLUMN job_search_ai.interviews.interview_format IS 'Interview format: "panel", "one_on_one", "group"';
COMMENT ON COLUMN job_search_ai.interviews.interview_date_time IS 'Scheduled date and time for the interview';
COMMENT ON COLUMN job_search_ai.interviews.interview_duration IS 'Expected duration in minutes';
COMMENT ON COLUMN job_search_ai.interviews.location IS 'Physical address for onsite, or meeting link for video/phone';
COMMENT ON COLUMN job_search_ai.interviews.interviewer_names IS 'JSON array of interviewer names';
COMMENT ON COLUMN job_search_ai.interviews.interviewer_emails IS 'JSON array of interviewer email addresses';
COMMENT ON COLUMN job_search_ai.interviews.meeting_link IS 'Zoom, Teams, Google Meet URL, etc.';
COMMENT ON COLUMN job_search_ai.interviews.interview_preparation_notes IS 'AI-generated common questions, suggested answers, company research';
COMMENT ON COLUMN job_search_ai.interviews.interview_notes IS 'User notes taken during/after interview - questions asked, answers given, feedback';
COMMENT ON COLUMN job_search_ai.interviews.interview_feedback IS 'Feedback received from interviewer (if any)';
COMMENT ON COLUMN job_search_ai.interviews.interview_rating IS 'User self-rating of how the interview went: 1-5 stars';
COMMENT ON COLUMN job_search_ai.interviews.interview_cost IS 'Travel expenses if applicable (for onsite interviews)';
COMMENT ON COLUMN job_search_ai.interviews.interview_outcome IS 'Interview outcome: "pending", "completed", "cancelled", "no_show"';
COMMENT ON COLUMN job_search_ai.interviews.cancellation_reason IS 'Reason for cancellation (if cancelled)';
COMMENT ON COLUMN job_search_ai.interviews.follow_up_required IS 'Whether a follow-up email is needed';
COMMENT ON COLUMN job_search_ai.interviews.created_at IS 'Timestamp when interview record was created';
COMMENT ON COLUMN job_search_ai.interviews.updated_at IS 'Timestamp when interview record was last updated';

CREATE INDEX idx_interviews_user_id ON job_search_ai.interviews(user_id);
CREATE INDEX idx_interviews_job_id ON job_search_ai.interviews(job_id);
CREATE INDEX idx_interviews_resume_package_id ON job_search_ai.interviews(resume_package_id);
CREATE INDEX idx_interviews_interview_date_time ON job_search_ai.interviews(interview_date_time);
CREATE INDEX idx_interviews_outcome ON job_search_ai.interviews(interview_outcome);

-- ============================================================================
-- Table: reminders
-- Description: Reminders and notifications for job applications
-- ============================================================================

CREATE TABLE job_search_ai.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    interview_id UUID REFERENCES job_search_ai.interviews(id) ON DELETE SET NULL,
    reminder_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(100),
    notification_channel VARCHAR(50),
    recurrence_pattern VARCHAR(50),
    reminder_status VARCHAR(50) DEFAULT 'pending',
    snooze_until TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_delivery_status VARCHAR(50),
    notification_read_status VARCHAR(50),
    notification_priority VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.reminders IS 'Reminders and notifications for job applications. Can reference a Job (for deadline reminders), Resume Package (for follow-up reminders), or Interview (for interview reminders).';
COMMENT ON COLUMN job_search_ai.reminders.id IS 'Primary key UUID for the reminder';
COMMENT ON COLUMN job_search_ai.reminders.user_id IS 'Foreign key to users table. Each reminder belongs to a user';
COMMENT ON COLUMN job_search_ai.reminders.job_id IS 'Foreign key to jobs table. For deadline reminders';
COMMENT ON COLUMN job_search_ai.reminders.resume_package_id IS 'Foreign key to resume_packages table. For follow-up reminders';
COMMENT ON COLUMN job_search_ai.reminders.interview_id IS 'Foreign key to interviews table. For interview reminders';
COMMENT ON COLUMN job_search_ai.reminders.reminder_type IS 'Reminder type: "follow_up", "application_deadline", "interview_reminder", "status_check"';
COMMENT ON COLUMN job_search_ai.reminders.title IS 'Short title for the reminder';
COMMENT ON COLUMN job_search_ai.reminders.description IS 'Detailed description of what the reminder is for';
COMMENT ON COLUMN job_search_ai.reminders.due_date_time IS 'When the reminder should trigger';
COMMENT ON COLUMN job_search_ai.reminders.timezone IS 'Timezone for the reminder (defaults to user timezone)';
COMMENT ON COLUMN job_search_ai.reminders.notification_channel IS 'Notification channel: "email", "sms", "push", "in_app"';
COMMENT ON COLUMN job_search_ai.reminders.recurrence_pattern IS 'Recurrence pattern: "one_time", "daily", "weekly", "monthly"';
COMMENT ON COLUMN job_search_ai.reminders.reminder_status IS 'Reminder status: "pending", "completed", "dismissed", "snoozed"';
COMMENT ON COLUMN job_search_ai.reminders.snooze_until IS 'If snoozed, when to remind again';
COMMENT ON COLUMN job_search_ai.reminders.notification_sent IS 'Whether notification was sent';
COMMENT ON COLUMN job_search_ai.reminders.notification_sent_at IS 'Timestamp when notification was sent';
COMMENT ON COLUMN job_search_ai.reminders.notification_delivery_status IS 'Delivery status: "sent", "delivered", "failed", "pending"';
COMMENT ON COLUMN job_search_ai.reminders.notification_read_status IS 'Read status: "read", "unread"';
COMMENT ON COLUMN job_search_ai.reminders.notification_priority IS 'Notification priority: "low", "medium", "high", "urgent"';
COMMENT ON COLUMN job_search_ai.reminders.created_at IS 'Timestamp when reminder record was created';
COMMENT ON COLUMN job_search_ai.reminders.updated_at IS 'Timestamp when reminder record was last updated';

CREATE INDEX idx_reminders_user_id ON job_search_ai.reminders(user_id);
CREATE INDEX idx_reminders_due_date_time ON job_search_ai.reminders(due_date_time);
CREATE INDEX idx_reminders_status ON job_search_ai.reminders(reminder_status);
CREATE INDEX idx_reminders_job_id ON job_search_ai.reminders(job_id);
CREATE INDEX idx_reminders_resume_package_id ON job_search_ai.reminders(resume_package_id);
CREATE INDEX idx_reminders_interview_id ON job_search_ai.reminders(interview_id);

-- ============================================================================
-- Table: job_preferences
-- Description: User preferences and saved job searches
-- ============================================================================

CREATE TABLE job_search_ai.job_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    search_name VARCHAR(255) NOT NULL,
    keywords TEXT,
    exclude_keywords TEXT,
    location_preferences JSONB,
    job_location_type_preferences JSONB,
    job_type_preferences JSONB,
    job_level_preferences JSONB,
    salary_range_minimum DECIMAL(10, 2),
    salary_range_maximum DECIMAL(10, 2),
    industry_preferences JSONB,
    company_preferences JSONB,
    minimum_match_score_threshold INTEGER CHECK (minimum_match_score_threshold >= 0 AND minimum_match_score_threshold <= 100),
    search_frequency VARCHAR(50),
    notification_preferences JSONB,
    search_results_count_threshold INTEGER,
    active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.job_preferences IS 'User preferences and saved job searches. Can be used to automatically filter and notify users of new matching jobs.';
COMMENT ON COLUMN job_search_ai.job_preferences.id IS 'Primary key UUID for the job preference';
COMMENT ON COLUMN job_search_ai.job_preferences.user_id IS 'Foreign key to users table. Each preference belongs to a user';
COMMENT ON COLUMN job_search_ai.job_preferences.search_name IS 'User-friendly name for the saved search';
COMMENT ON COLUMN job_search_ai.job_preferences.keywords IS 'Search keywords/phrases';
COMMENT ON COLUMN job_search_ai.job_preferences.exclude_keywords IS 'Keywords to exclude from results';
COMMENT ON COLUMN job_search_ai.job_preferences.location_preferences IS 'JSON array of locations: cities, states, "Remote", etc.';
COMMENT ON COLUMN job_search_ai.job_preferences.job_location_type_preferences IS 'JSON array: ["remote", "hybrid", "onsite"]';
COMMENT ON COLUMN job_search_ai.job_preferences.job_type_preferences IS 'JSON array: ["full-time", "part-time", "contract", "internship"]';
COMMENT ON COLUMN job_search_ai.job_preferences.job_level_preferences IS 'JSON array: ["entry", "mid", "senior", "executive"]';
COMMENT ON COLUMN job_search_ai.job_preferences.salary_range_minimum IS 'Minimum desired salary';
COMMENT ON COLUMN job_search_ai.job_preferences.salary_range_maximum IS 'Maximum desired salary (optional)';
COMMENT ON COLUMN job_search_ai.job_preferences.industry_preferences IS 'JSON array of industries';
COMMENT ON COLUMN job_search_ai.job_preferences.company_preferences IS 'JSON array of company names to include/exclude';
COMMENT ON COLUMN job_search_ai.job_preferences.minimum_match_score_threshold IS 'Minimum assessment score to show jobs (0-100)';
COMMENT ON COLUMN job_search_ai.job_preferences.search_frequency IS 'How often to run: "daily", "weekly", "monthly", "manual"';
COMMENT ON COLUMN job_search_ai.job_preferences.notification_preferences IS 'JSON: {"email": true, "in_app": true} - how to notify when jobs found';
COMMENT ON COLUMN job_search_ai.job_preferences.search_results_count_threshold IS 'Only notify if X+ jobs found';
COMMENT ON COLUMN job_search_ai.job_preferences.active IS 'Whether this search is currently active';
COMMENT ON COLUMN job_search_ai.job_preferences.last_run_at IS 'Timestamp when this search was last executed';
COMMENT ON COLUMN job_search_ai.job_preferences.created_at IS 'Timestamp when preference record was created';
COMMENT ON COLUMN job_search_ai.job_preferences.updated_at IS 'Timestamp when preference record was last updated';

CREATE INDEX idx_job_preferences_user_id ON job_search_ai.job_preferences(user_id);
CREATE INDEX idx_job_preferences_active ON job_search_ai.job_preferences(active);

-- ============================================================================
-- Table: application_notes
-- Description: General notes and journaling for applications
-- ============================================================================

CREATE TABLE job_search_ai.application_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    note_title VARCHAR(255),
    note_content TEXT NOT NULL,
    note_type VARCHAR(50),
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.application_notes IS 'General notes and journaling for applications. Separate from email notes and interview notes. Used for application journaling, company research, salary negotiation planning, etc.';
COMMENT ON COLUMN job_search_ai.application_notes.id IS 'Primary key UUID for the application note';
COMMENT ON COLUMN job_search_ai.application_notes.user_id IS 'Foreign key to users table. Each note belongs to a user';
COMMENT ON COLUMN job_search_ai.application_notes.job_id IS 'Foreign key to jobs table. The job this note is about';
COMMENT ON COLUMN job_search_ai.application_notes.resume_package_id IS 'Foreign key to resume_packages table. The application this note is about';
COMMENT ON COLUMN job_search_ai.application_notes.note_title IS 'Optional short title for the note';
COMMENT ON COLUMN job_search_ai.application_notes.note_content IS 'Full text of the note';
COMMENT ON COLUMN job_search_ai.application_notes.note_type IS 'Note type: "general", "company_research", "salary_negotiation", "interview_prep", "other"';
COMMENT ON COLUMN job_search_ai.application_notes.tags IS 'JSON array of tags for categorization';
COMMENT ON COLUMN job_search_ai.application_notes.created_at IS 'Timestamp when note record was created';
COMMENT ON COLUMN job_search_ai.application_notes.updated_at IS 'Timestamp when note record was last updated';

CREATE INDEX idx_application_notes_user_id ON job_search_ai.application_notes(user_id);
CREATE INDEX idx_application_notes_job_id ON job_search_ai.application_notes(job_id);
CREATE INDEX idx_application_notes_resume_package_id ON job_search_ai.application_notes(resume_package_id);
CREATE INDEX idx_application_notes_note_type ON job_search_ai.application_notes(note_type);

-- ============================================================================
-- Table: offers
-- Description: Job offer management and negotiation
-- ============================================================================

CREATE TABLE job_search_ai.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    offer_status VARCHAR(50),
    base_salary DECIMAL(12, 2),
    salary_currency VARCHAR(10),
    sign_on_bonus DECIMAL(12, 2),
    bonus_amount DECIMAL(12, 2),
    equity_stock_options TEXT,
    stock_vesting_schedule JSONB,
    relocation_assistance TEXT,
    benefits_summary TEXT,
    benefits_details_breakdown JSONB,
    pto_vacation_days INTEGER,
    work_from_home_policy TEXT,
    offer_letter_file_url VARCHAR(1000),
    start_date DATE,
    offer_expiration_date DATE,
    offer_date DATE,
    response_date DATE,
    negotiation_history JSONB,
    counter_offer_details JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.offers IS 'Job offer management and negotiation. Tracks job offers, negotiation history, and acceptance/rejection. Can reference either a Job or Resume Package.';
COMMENT ON COLUMN job_search_ai.offers.id IS 'Primary key UUID for the offer';
COMMENT ON COLUMN job_search_ai.offers.user_id IS 'Foreign key to users table. Each offer belongs to a user';
COMMENT ON COLUMN job_search_ai.offers.job_id IS 'Foreign key to jobs table. The job this offer is for';
COMMENT ON COLUMN job_search_ai.offers.resume_package_id IS 'Foreign key to resume_packages table. The application this offer is for';
COMMENT ON COLUMN job_search_ai.offers.offer_status IS 'Offer status: "pending", "accepted", "rejected", "expired", "withdrawn", "negotiating"';
COMMENT ON COLUMN job_search_ai.offers.base_salary IS 'Annual base salary amount';
COMMENT ON COLUMN job_search_ai.offers.salary_currency IS 'Salary currency: "USD", "EUR", etc.';
COMMENT ON COLUMN job_search_ai.offers.sign_on_bonus IS 'One-time signing bonus amount';
COMMENT ON COLUMN job_search_ai.offers.bonus_amount IS 'Annual bonus amount (if applicable)';
COMMENT ON COLUMN job_search_ai.offers.equity_stock_options IS 'Description or value of equity compensation';
COMMENT ON COLUMN job_search_ai.offers.stock_vesting_schedule IS 'JSON: vesting timeline and details';
COMMENT ON COLUMN job_search_ai.offers.relocation_assistance IS 'Amount or description of relocation package';
COMMENT ON COLUMN job_search_ai.offers.benefits_summary IS 'JSON object or text describing benefits package';
COMMENT ON COLUMN job_search_ai.offers.benefits_details_breakdown IS 'JSON: {"health_insurance": "...", "dental": "...", "vision": "...", "401k_match": "...", "pto_days": 20}';
COMMENT ON COLUMN job_search_ai.offers.pto_vacation_days IS 'Number of paid time off days';
COMMENT ON COLUMN job_search_ai.offers.work_from_home_policy IS 'Days per week/month allowed to work from home';
COMMENT ON COLUMN job_search_ai.offers.offer_letter_file_url IS 'URL to offer letter PDF/document';
COMMENT ON COLUMN job_search_ai.offers.start_date IS 'Proposed start date';
COMMENT ON COLUMN job_search_ai.offers.offer_expiration_date IS 'Deadline to respond to offer';
COMMENT ON COLUMN job_search_ai.offers.offer_date IS 'Date when the offer was received';
COMMENT ON COLUMN job_search_ai.offers.response_date IS 'Date when offer was accepted/rejected';
COMMENT ON COLUMN job_search_ai.offers.negotiation_history IS 'JSON array of negotiation steps: [{"date": "...", "type": "counter_offer"|"request"|"response", "details": "...", "salary": ...}]';
COMMENT ON COLUMN job_search_ai.offers.counter_offer_details IS 'If user made a counter offer - salary, benefits, etc. (JSON)';
COMMENT ON COLUMN job_search_ai.offers.notes IS 'User notes about the offer, negotiation strategy, etc.';
COMMENT ON COLUMN job_search_ai.offers.created_at IS 'Timestamp when offer record was created';
COMMENT ON COLUMN job_search_ai.offers.updated_at IS 'Timestamp when offer record was last updated';

CREATE INDEX idx_offers_user_id ON job_search_ai.offers(user_id);
CREATE INDEX idx_offers_job_id ON job_search_ai.offers(job_id);
CREATE INDEX idx_offers_resume_package_id ON job_search_ai.offers(resume_package_id);
CREATE INDEX idx_offers_offer_status ON job_search_ai.offers(offer_status);

-- ============================================================================
-- Table: references
-- Description: Professional references provided to employers
-- ============================================================================

CREATE TABLE job_search_ai.references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    reference_name VARCHAR(255) NOT NULL,
    reference_title VARCHAR(255),
    company VARCHAR(255),
    email_address VARCHAR(255),
    phone_number VARCHAR(50),
    relationship VARCHAR(100),
    years_known INTEGER,
    relationship_strength VARCHAR(50),
    permission_status VARCHAR(50),
    availability VARCHAR(50),
    reference_provided_date DATE,
    context TEXT,
    provided_for_jobs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.references IS 'Professional references that can be provided to employers. Can be linked to specific applications.';
COMMENT ON COLUMN job_search_ai.references.id IS 'Primary key UUID for the reference';
COMMENT ON COLUMN job_search_ai.references.user_id IS 'Foreign key to users table. Each reference belongs to a user';
COMMENT ON COLUMN job_search_ai.references.reference_name IS 'Full name of the reference';
COMMENT ON COLUMN job_search_ai.references.reference_title IS 'Their job title/position';
COMMENT ON COLUMN job_search_ai.references.company IS 'Company where reference works/worked';
COMMENT ON COLUMN job_search_ai.references.email_address IS 'Reference email address';
COMMENT ON COLUMN job_search_ai.references.phone_number IS 'Reference phone number (optional)';
COMMENT ON COLUMN job_search_ai.references.relationship IS 'Relationship: "former_manager", "colleague", "client", "professor"';
COMMENT ON COLUMN job_search_ai.references.years_known IS 'How long user has known this reference';
COMMENT ON COLUMN job_search_ai.references.relationship_strength IS 'Relationship strength: "strong", "moderate", "weak"';
COMMENT ON COLUMN job_search_ai.references.permission_status IS 'Permission status: "permission_given", "permission_pending", "permission_denied", "not_asked"';
COMMENT ON COLUMN job_search_ai.references.availability IS 'Availability: "available", "unavailable", "limited"';
COMMENT ON COLUMN job_search_ai.references.reference_provided_date IS 'Date when reference was actually provided to employer';
COMMENT ON COLUMN job_search_ai.references.context IS 'Notes about the relationship, what they can speak to, etc.';
COMMENT ON COLUMN job_search_ai.references.provided_for_jobs IS 'JSON array of Job IDs or Resume Package IDs where this reference was provided';
COMMENT ON COLUMN job_search_ai.references.created_at IS 'Timestamp when reference record was created';
COMMENT ON COLUMN job_search_ai.references.updated_at IS 'Timestamp when reference record was last updated';

CREATE INDEX idx_references_user_id ON job_search_ai.references(user_id);
CREATE INDEX idx_references_email_address ON job_search_ai.references(email_address);

-- ============================================================================
-- Table: documents
-- Description: Supporting documents and attachments
-- ============================================================================

CREATE TABLE job_search_ai.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_search_ai.jobs(id) ON DELETE SET NULL,
    resume_package_id UUID REFERENCES job_search_ai.resume_packages(id) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(1000),
    file_path VARCHAR(1000),
    storage_type VARCHAR(50),
    file_size BIGINT,
    file_format VARCHAR(50),
    document_expiration_date DATE,
    document_issuer VARCHAR(255),
    document_verification_status VARCHAR(50),
    description TEXT,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.documents IS 'Stores portfolio links/files, certificates, transcripts, writing samples, and other supporting documents. Can be linked to specific jobs or resume packages.';
COMMENT ON COLUMN job_search_ai.documents.id IS 'Primary key UUID for the document';
COMMENT ON COLUMN job_search_ai.documents.user_id IS 'Foreign key to users table. Each document belongs to a user';
COMMENT ON COLUMN job_search_ai.documents.job_id IS 'Foreign key to jobs table. The job this document is for';
COMMENT ON COLUMN job_search_ai.documents.resume_package_id IS 'Foreign key to resume_packages table. The application this document is for';
COMMENT ON COLUMN job_search_ai.documents.document_type IS 'Document type: "portfolio", "certificate", "transcript", "writing_sample", "other"';
COMMENT ON COLUMN job_search_ai.documents.document_name IS 'User-friendly name for the document';
COMMENT ON COLUMN job_search_ai.documents.file_url IS 'URL to document file storage location';
COMMENT ON COLUMN job_search_ai.documents.file_path IS 'Storage path or object key for the document file';
COMMENT ON COLUMN job_search_ai.documents.storage_type IS 'Storage type: "s3", "local", "object-storage"';
COMMENT ON COLUMN job_search_ai.documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN job_search_ai.documents.file_format IS 'File format: "pdf", "docx", "jpg", "url"';
COMMENT ON COLUMN job_search_ai.documents.document_expiration_date IS 'Expiration date for certificates with expiration dates';
COMMENT ON COLUMN job_search_ai.documents.document_issuer IS 'Who issued the certificate or document';
COMMENT ON COLUMN job_search_ai.documents.document_verification_status IS 'Verification status: "verified", "unverified", "expired"';
COMMENT ON COLUMN job_search_ai.documents.description IS 'Optional description of the document';
COMMENT ON COLUMN job_search_ai.documents.tags IS 'JSON array of tags for categorization';
COMMENT ON COLUMN job_search_ai.documents.created_at IS 'Timestamp when document record was created';
COMMENT ON COLUMN job_search_ai.documents.updated_at IS 'Timestamp when document record was last updated';

CREATE INDEX idx_documents_user_id ON job_search_ai.documents(user_id);
CREATE INDEX idx_documents_job_id ON job_search_ai.documents(job_id);
CREATE INDEX idx_documents_resume_package_id ON job_search_ai.documents(resume_package_id);
CREATE INDEX idx_documents_document_type ON job_search_ai.documents(document_type);

-- ============================================================================
-- Table: chat_conversations
-- Description: Chat conversation threads between user and AI assistant
-- ============================================================================

CREATE TABLE job_search_ai.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    skill_type VARCHAR(100),
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.chat_conversations IS 'Conversation threads for chat interactions. Each conversation belongs to one user and contains many messages.';
COMMENT ON COLUMN job_search_ai.chat_conversations.id IS 'Primary key UUID for the conversation';
COMMENT ON COLUMN job_search_ai.chat_conversations.user_id IS 'Foreign key to users table. Each conversation belongs to a user';
COMMENT ON COLUMN job_search_ai.chat_conversations.title IS 'Optional user-friendly title for the conversation';
COMMENT ON COLUMN job_search_ai.chat_conversations.skill_type IS 'Optional skill context: "resume-review", "generate-packet", "monitor-job-site", "query-packets", "apply-for-job"';
COMMENT ON COLUMN job_search_ai.chat_conversations.last_message_at IS 'Timestamp of the most recent message in this conversation';
COMMENT ON COLUMN job_search_ai.chat_conversations.created_at IS 'Timestamp when conversation was created';
COMMENT ON COLUMN job_search_ai.chat_conversations.updated_at IS 'Timestamp when conversation was last updated';

CREATE INDEX idx_chat_conversations_user_id ON job_search_ai.chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_last_message_at ON job_search_ai.chat_conversations(last_message_at);

-- ============================================================================
-- Table: chat_messages
-- Description: Individual messages inside a chat conversation
-- ============================================================================

CREATE TABLE job_search_ai.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES job_search_ai.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content_text TEXT NOT NULL,
    attachment_document_ids JSONB,
    skill_type VARCHAR(100),
    model VARCHAR(255),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.chat_messages IS 'Message records within conversations, including user prompts, assistant responses, and optional token accounting metadata.';
COMMENT ON COLUMN job_search_ai.chat_messages.id IS 'Primary key UUID for the chat message';
COMMENT ON COLUMN job_search_ai.chat_messages.conversation_id IS 'Foreign key to chat_conversations table. Message belongs to one conversation';
COMMENT ON COLUMN job_search_ai.chat_messages.user_id IS 'Foreign key to users table. Used for tenant scoping and auth checks';
COMMENT ON COLUMN job_search_ai.chat_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN job_search_ai.chat_messages.content_text IS 'Plain text or markdown message content';
COMMENT ON COLUMN job_search_ai.chat_messages.attachment_document_ids IS 'JSON array of document UUIDs attached to the message';
COMMENT ON COLUMN job_search_ai.chat_messages.skill_type IS 'Optional skill context for this message';
COMMENT ON COLUMN job_search_ai.chat_messages.model IS 'AI model used to generate assistant response (if applicable)';
COMMENT ON COLUMN job_search_ai.chat_messages.prompt_tokens IS 'Prompt token count for metering (optional)';
COMMENT ON COLUMN job_search_ai.chat_messages.completion_tokens IS 'Completion token count for metering (optional)';
COMMENT ON COLUMN job_search_ai.chat_messages.total_tokens IS 'Total token count for metering (optional)';
COMMENT ON COLUMN job_search_ai.chat_messages.created_at IS 'Timestamp when message was created';
COMMENT ON COLUMN job_search_ai.chat_messages.updated_at IS 'Timestamp when message was last updated';

CREATE INDEX idx_chat_messages_conversation_id ON job_search_ai.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON job_search_ai.chat_messages(user_id);
CREATE INDEX idx_chat_messages_role ON job_search_ai.chat_messages(role);
CREATE INDEX idx_chat_messages_created_at ON job_search_ai.chat_messages(created_at);

-- ============================================================================
-- Table: chat_stream_sessions
-- Description: Temporary stream sessions used by SSE response flow
-- ============================================================================

CREATE TABLE job_search_ai.chat_stream_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES job_search_ai.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    request_message_id UUID REFERENCES job_search_ai.chat_messages(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'done', 'error', 'expired')),
    stream_payload JSONB,
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.chat_stream_sessions IS 'Temporary stream state for SSE chat responses. Sessions are short-lived and can be safely expired/cleaned.';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.id IS 'Primary key UUID for the stream session';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.conversation_id IS 'Foreign key to chat_conversations table';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.user_id IS 'Foreign key to users table. Used to enforce per-user stream access';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.request_message_id IS 'Optional reference to the initiating user chat message';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.status IS 'Stream status lifecycle: pending, streaming, done, error, expired';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.stream_payload IS 'JSON payload with provider/session metadata for streaming';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.error_message IS 'Last stream error message when status=error';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.expires_at IS 'Expiration timestamp for server-side stream cleanup';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.created_at IS 'Timestamp when stream session was created';
COMMENT ON COLUMN job_search_ai.chat_stream_sessions.updated_at IS 'Timestamp when stream session was last updated';

CREATE INDEX idx_chat_stream_sessions_user_id ON job_search_ai.chat_stream_sessions(user_id);
CREATE INDEX idx_chat_stream_sessions_conversation_id ON job_search_ai.chat_stream_sessions(conversation_id);
CREATE INDEX idx_chat_stream_sessions_status ON job_search_ai.chat_stream_sessions(status);
CREATE INDEX idx_chat_stream_sessions_expires_at ON job_search_ai.chat_stream_sessions(expires_at);

-- ============================================================================
-- Table: learning_progress
-- Description: Tracking progress on gap-filling resources
-- ============================================================================

CREATE TABLE job_search_ai.learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES job_search_ai.assessments(id) ON DELETE SET NULL,
    resource_url VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(50),
    resource_title VARCHAR(500),
    resource_provider VARCHAR(255),
    resource_cost DECIMAL(10, 2),
    resource_duration VARCHAR(255),
    resource_difficulty_level VARCHAR(50),
    progress_status VARCHAR(50) DEFAULT 'not_started',
    completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_certificate VARCHAR(1000),
    resource_rating INTEGER CHECK (resource_rating >= 1 AND resource_rating <= 5),
    notes TEXT,
    skills_improved JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.learning_progress IS 'Tracks user progress on learning resources identified in Assessments. Links completed learning to skill improvements.';
COMMENT ON COLUMN job_search_ai.learning_progress.id IS 'Primary key UUID for the learning progress record';
COMMENT ON COLUMN job_search_ai.learning_progress.user_id IS 'Foreign key to users table. Each learning progress record belongs to a user';
COMMENT ON COLUMN job_search_ai.learning_progress.assessment_id IS 'Foreign key to assessments table. The assessment that identified this learning resource';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_url IS 'The learning resource URL from the Assessment';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_type IS 'Resource type: "training", "certification", "schooling"';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_title IS 'Title of the learning resource';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_provider IS 'Resource provider/platform: "Coursera", "Udemy", "edX", "university_name"';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_cost IS 'Cost of the resource (if paid)';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_duration IS 'Expected hours/days to complete';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_difficulty_level IS 'Difficulty level: "beginner", "intermediate", "advanced"';
COMMENT ON COLUMN job_search_ai.learning_progress.progress_status IS 'Progress status: "not_started", "in_progress", "completed", "abandoned"';
COMMENT ON COLUMN job_search_ai.learning_progress.completion_percentage IS 'Completion percentage (0-100)';
COMMENT ON COLUMN job_search_ai.learning_progress.started_at IS 'Timestamp when user started the resource';
COMMENT ON COLUMN job_search_ai.learning_progress.completed_at IS 'Timestamp when user completed the resource';
COMMENT ON COLUMN job_search_ai.learning_progress.completion_certificate IS 'File URL if certificate was earned';
COMMENT ON COLUMN job_search_ai.learning_progress.resource_rating IS 'User rating of the resource: 1-5 stars';
COMMENT ON COLUMN job_search_ai.learning_progress.notes IS 'User notes about the learning experience, key takeaways, etc.';
COMMENT ON COLUMN job_search_ai.learning_progress.skills_improved IS 'JSON array of Skill IDs that this resource helped improve';
COMMENT ON COLUMN job_search_ai.learning_progress.created_at IS 'Timestamp when learning progress record was created';
COMMENT ON COLUMN job_search_ai.learning_progress.updated_at IS 'Timestamp when learning progress record was last updated';

CREATE INDEX idx_learning_progress_user_id ON job_search_ai.learning_progress(user_id);
CREATE INDEX idx_learning_progress_assessment_id ON job_search_ai.learning_progress(assessment_id);
CREATE INDEX idx_learning_progress_progress_status ON job_search_ai.learning_progress(progress_status);

-- ============================================================================
-- Table: companies
-- Description: Company research and information database
-- ============================================================================

CREATE TABLE job_search_ai.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    company_size VARCHAR(100),
    headquarters_location VARCHAR(500),
    company_website VARCHAR(500),
    company_logo_url VARCHAR(1000),
    company_social_media_links JSONB,
    company_stock_ticker VARCHAR(20),
    company_description TEXT,
    company_culture_notes TEXT,
    benefits_overview TEXT,
    glassdoor_rating DECIMAL(3, 2),
    company_contacts JSONB,
    research_notes TEXT,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_name)
);

COMMENT ON TABLE job_search_ai.companies IS 'Centralized company information separate from individual job postings. Can be referenced by multiple Jobs and Application Notes.';
COMMENT ON COLUMN job_search_ai.companies.id IS 'Primary key UUID for the company';
COMMENT ON COLUMN job_search_ai.companies.user_id IS 'Foreign key to users table. Each company record belongs to a user';
COMMENT ON COLUMN job_search_ai.companies.company_name IS 'Official company name';
COMMENT ON COLUMN job_search_ai.companies.industry IS 'Industry category';
COMMENT ON COLUMN job_search_ai.companies.company_size IS 'Company size: "startup", "50-200", "1000+"';
COMMENT ON COLUMN job_search_ai.companies.headquarters_location IS 'Headquarters location: city, state, country';
COMMENT ON COLUMN job_search_ai.companies.company_website IS 'Company website URL';
COMMENT ON COLUMN job_search_ai.companies.company_logo_url IS 'URL to company logo image';
COMMENT ON COLUMN job_search_ai.companies.company_social_media_links IS 'JSON: {"linkedin": "...", "twitter": "...", "facebook": "...", "github": "..."}';
COMMENT ON COLUMN job_search_ai.companies.company_stock_ticker IS 'Stock ticker if public company (e.g., "AAPL", "GOOGL")';
COMMENT ON COLUMN job_search_ai.companies.company_description IS 'Overview of the company';
COMMENT ON COLUMN job_search_ai.companies.company_culture_notes IS 'User research notes about company culture';
COMMENT ON COLUMN job_search_ai.companies.benefits_overview IS 'General benefits information about the company';
COMMENT ON COLUMN job_search_ai.companies.glassdoor_rating IS 'Glassdoor rating if available';
COMMENT ON COLUMN job_search_ai.companies.company_contacts IS 'JSON array of contacts: [{"name": "...", "title": "...", "email": "...", "linkedin": "...", "notes": "..."}]';
COMMENT ON COLUMN job_search_ai.companies.research_notes IS 'User research notes about the company';
COMMENT ON COLUMN job_search_ai.companies.tags IS 'JSON array of tags for categorization';
COMMENT ON COLUMN job_search_ai.companies.created_at IS 'Timestamp when company record was created';
COMMENT ON COLUMN job_search_ai.companies.updated_at IS 'Timestamp when company record was last updated';

CREATE INDEX idx_companies_user_id ON job_search_ai.companies(user_id);
CREATE INDEX idx_companies_company_name ON job_search_ai.companies(company_name);

-- ============================================================================
-- Table: skills_progress
-- Description: Tracking skill improvement over time
-- ============================================================================

CREATE TABLE job_search_ai.skills_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES job_search_ai.users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES job_search_ai.skills(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    skill_level VARCHAR(50),
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    skill_assessment_method VARCHAR(50),
    skill_verification VARCHAR(1000),
    skill_usage_frequency VARCHAR(50),
    evidence TEXT,
    related_learning_resources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE job_search_ai.skills_progress IS 'Tracks how skills improve over time. Can be linked to completed learning resources and certifications.';
COMMENT ON COLUMN job_search_ai.skills_progress.id IS 'Primary key UUID for the skills progress record';
COMMENT ON COLUMN job_search_ai.skills_progress.user_id IS 'Foreign key to users table. Each skills progress record belongs to a user';
COMMENT ON COLUMN job_search_ai.skills_progress.skill_id IS 'Foreign key to skills table. The skill being tracked';
COMMENT ON COLUMN job_search_ai.skills_progress.assessment_date IS 'Date when this skill assessment was recorded';
COMMENT ON COLUMN job_search_ai.skills_progress.skill_level IS 'Self-assessed or AI-assessed level: "beginner", "intermediate", "advanced", "expert"';
COMMENT ON COLUMN job_search_ai.skills_progress.confidence_score IS 'User confidence in this skill (0-100)';
COMMENT ON COLUMN job_search_ai.skills_progress.skill_assessment_method IS 'Assessment method: "self", "test", "certification", "project", "peer_review", "ai_assessment"';
COMMENT ON COLUMN job_search_ai.skills_progress.skill_verification IS 'Proof/documentation of skill level - link to certificate, project, test result';
COMMENT ON COLUMN job_search_ai.skills_progress.skill_usage_frequency IS 'Usage frequency: "daily", "weekly", "monthly", "rarely"';
COMMENT ON COLUMN job_search_ai.skills_progress.evidence IS 'Text describing evidence of skill improvement - projects, certifications, etc.';
COMMENT ON COLUMN job_search_ai.skills_progress.related_learning_resources IS 'JSON array of Learning Progress IDs that contributed to this improvement';
COMMENT ON COLUMN job_search_ai.skills_progress.created_at IS 'Timestamp when skills progress record was created';
COMMENT ON COLUMN job_search_ai.skills_progress.updated_at IS 'Timestamp when skills progress record was last updated';

CREATE INDEX idx_skills_progress_user_id ON job_search_ai.skills_progress(user_id);
CREATE INDEX idx_skills_progress_skill_id ON job_search_ai.skills_progress(skill_id);
CREATE INDEX idx_skills_progress_assessment_date ON job_search_ai.skills_progress(assessment_date);

-- ============================================================================
-- Create Updated At Triggers
-- ============================================================================
-- These triggers automatically update the updated_at column on row updates.
-- SQLAlchemy can work with these triggers - they will update updated_at even
-- if SQLAlchemy doesn't explicitly set it. If SQLAlchemy also sets updated_at,
-- the trigger will ensure it's always current.
-- ============================================================================

CREATE OR REPLACE FUNCTION job_search_ai.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION job_search_ai.update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp on row updates. Works seamlessly with SQLAlchemy - if SQLAlchemy sets updated_at, it will be used; otherwise trigger ensures it is set.';

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON job_search_ai.users FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_job_sources_updated_at BEFORE UPDATE ON job_search_ai.job_sources FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON job_search_ai.jobs FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON job_search_ai.assessments FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON job_search_ai.roles FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON job_search_ai.skills FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_skill_embeddings_updated_at BEFORE UPDATE ON job_search_ai.skill_embeddings FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_resume_packages_updated_at BEFORE UPDATE ON job_search_ai.resume_packages FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_email_tracking_updated_at BEFORE UPDATE ON job_search_ai.email_tracking FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON job_search_ai.interviews FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON job_search_ai.reminders FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_job_preferences_updated_at BEFORE UPDATE ON job_search_ai.job_preferences FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_application_notes_updated_at BEFORE UPDATE ON job_search_ai.application_notes FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON job_search_ai.offers FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_references_updated_at BEFORE UPDATE ON job_search_ai.references FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON job_search_ai.documents FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON job_search_ai.chat_conversations FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON job_search_ai.chat_messages FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_chat_stream_sessions_updated_at BEFORE UPDATE ON job_search_ai.chat_stream_sessions FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_learning_progress_updated_at BEFORE UPDATE ON job_search_ai.learning_progress FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON job_search_ai.companies FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();
CREATE TRIGGER update_skills_progress_updated_at BEFORE UPDATE ON job_search_ai.skills_progress FOR EACH ROW EXECUTE FUNCTION job_search_ai.update_updated_at_column();

-- ============================================================================
-- SQLAlchemy Compatibility Notes
-- ============================================================================
-- This schema is designed to work seamlessly with SQLAlchemy:
-- 1. All tables use snake_case naming (SQLAlchemy convention)
-- 2. UUID primary keys use uuid_generate_v4() as server_default
-- 3. Timestamps use CURRENT_TIMESTAMP as server_default
-- 4. JSONB columns can be mapped using JSONB type from sqlalchemy.dialects.postgresql
-- 5. Vector columns require pgvector package: pip install pgvector
-- 6. All tables are in the 'job_search_ai' schema - specify in __table_args__
-- 7. Updated_at triggers work with SQLAlchemy - they ensure updated_at is always current
-- 8. Foreign keys use ON DELETE CASCADE or SET NULL as appropriate
-- ============================================================================

-- ============================================================================
-- End of Schema Creation
-- ============================================================================
