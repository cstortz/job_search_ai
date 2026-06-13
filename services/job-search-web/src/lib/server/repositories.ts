import "server-only";

import {
  ChatRepository,
  ChatSqlTemplates,
  DocumentRepository,
  DocumentSqlTemplates,
  JobRepository,
  JobSqlTemplates,
  SkillRepository,
  SkillSqlTemplates,
  UserRepository,
  UserSqlTemplates,
} from "../db/db-repository";

const documentSqlTemplates: DocumentSqlTemplates = {
  listDocumentsByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      document_name AS filename,
      COALESCE(tags->>'contentType', 'application/octet-stream') AS content_type,
      COALESCE(file_size, 0) AS size_bytes,
      CASE
        WHEN document_verification_status = 'expired' THEN 'error'
        ELSE 'ready'
      END AS status,
      created_at::text AS uploaded_at
    FROM job_search_ai.documents
    WHERE user_id = $1::uuid
    ORDER BY created_at DESC
  `,
  findDocumentByIdForUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      document_name AS filename,
      COALESCE(tags->>'contentType', 'application/octet-stream') AS content_type,
      COALESCE(file_size, 0) AS size_bytes,
      CASE
        WHEN document_verification_status = 'expired' THEN 'error'
        ELSE 'ready'
      END AS status,
      created_at::text AS uploaded_at
    FROM job_search_ai.documents
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  deleteDocumentByIdForUser: `
    DELETE FROM job_search_ai.documents
    WHERE id = $1::uuid AND user_id = $2::uuid
  `,
  insertUploadedDocument: `
    INSERT INTO job_search_ai.documents (
      user_id,
      document_type,
      document_name,
      file_url,
      file_path,
      storage_type,
      file_size,
      file_format,
      document_verification_status,
      tags
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      CAST($10 AS jsonb)
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      document_name AS filename,
      COALESCE(tags->>'contentType', 'application/octet-stream') AS content_type,
      COALESCE(file_size, 0) AS size_bytes,
      'ready' AS status,
      created_at::text AS uploaded_at
  `,
};

export const documentRepository = new DocumentRepository(documentSqlTemplates);

const userSqlTemplates: UserSqlTemplates = {
  upsertUserByAuth0Subject: `
    INSERT INTO job_search_ai.users (
      auth0_subject_id,
      name,
      email,
      email_verified,
      phone,
      linkedin_url,
      timezone,
      other_urls,
      address,
      resume_field_includes,
      notification_preferences,
      preferred_name,
      work_authorization,
      marketing_statements,
      job_preferences,
      education,
      work_history
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      CASE WHEN $8::text IS NULL THEN NULL ELSE CAST($8 AS jsonb) END,
      $9,
      CASE WHEN $10::text IS NULL THEN NULL ELSE CAST($10 AS jsonb) END,
      CASE WHEN $11::text IS NULL THEN NULL ELSE CAST($11 AS jsonb) END,
      $12,
      $13,
      CASE WHEN $14::text IS NULL THEN NULL ELSE CAST($14 AS jsonb) END,
      CASE WHEN $15::text IS NULL THEN NULL ELSE CAST($15 AS jsonb) END,
      CASE WHEN $16::text IS NULL THEN NULL ELSE CAST($16 AS jsonb) END,
      CASE WHEN $17::text IS NULL THEN NULL ELSE CAST($17 AS jsonb) END
    )
    ON CONFLICT (auth0_subject_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified,
      phone = EXCLUDED.phone,
      linkedin_url = EXCLUDED.linkedin_url,
      timezone = EXCLUDED.timezone,
      other_urls = EXCLUDED.other_urls,
      address = EXCLUDED.address,
      resume_field_includes = EXCLUDED.resume_field_includes,
      notification_preferences = EXCLUDED.notification_preferences,
      preferred_name = EXCLUDED.preferred_name,
      work_authorization = EXCLUDED.work_authorization,
      marketing_statements = EXCLUDED.marketing_statements,
      job_preferences = EXCLUDED.job_preferences,
      education = EXCLUDED.education,
      work_history = EXCLUDED.work_history,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id::text AS id,
      auth0_subject_id,
      name,
      email,
      email_verified,
      phone,
      linkedin_url,
      other_urls,
      address,
      resume_field_includes,
      notification_preferences,
      timezone,
      preferred_name,
      work_authorization,
      marketing_statements,
      job_preferences,
      education,
      work_history,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  findUserByAuth0Subject: `
    SELECT
      id::text AS id,
      auth0_subject_id,
      name,
      email,
      email_verified,
      phone,
      linkedin_url,
      other_urls,
      address,
      resume_field_includes,
      notification_preferences,
      timezone,
      preferred_name,
      work_authorization,
      marketing_statements,
      job_preferences,
      education,
      work_history,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.users
    WHERE auth0_subject_id = $1
    LIMIT 1
  `,
};

export const userRepository = new UserRepository(userSqlTemplates);

const chatSqlTemplates: ChatSqlTemplates = {
  findConversationByIdForUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      title,
      skill_type,
      last_message_at::text AS last_message_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.chat_conversations
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  listConversationsByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      title,
      skill_type,
      last_message_at::text AS last_message_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.chat_conversations
    WHERE user_id = $1::uuid
    ORDER BY COALESCE(last_message_at, created_at) DESC
  `,
  listMessagesByConversationForUser: `
    SELECT
      m.id::text AS id,
      m.conversation_id::text AS conversation_id,
      m.user_id::text AS user_id,
      m.role,
      m.content_text,
      m.attachment_document_ids,
      m.skill_type,
      m.model,
      m.prompt_tokens,
      m.completion_tokens,
      m.total_tokens,
      m.created_at::text AS created_at,
      m.updated_at::text AS updated_at
    FROM job_search_ai.chat_messages m
    INNER JOIN job_search_ai.chat_conversations c
      ON c.id = m.conversation_id
    WHERE m.conversation_id = $1::uuid
      AND c.user_id = $2::uuid
    ORDER BY m.created_at ASC
  `,
  updateConversationTitleForUser: `
    UPDATE job_search_ai.chat_conversations
    SET
      title = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2::uuid
      AND user_id = $3::uuid
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      title,
      skill_type,
      last_message_at::text AS last_message_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  createConversationForUser: `
    INSERT INTO job_search_ai.chat_conversations (
      user_id,
      last_message_at
    )
    VALUES (
      $1::uuid,
      CURRENT_TIMESTAMP
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      title,
      skill_type,
      last_message_at::text AS last_message_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  touchConversationLastMessageAt: `
    UPDATE job_search_ai.chat_conversations
    SET
      last_message_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1::uuid AND user_id = $2::uuid
  `,
  insertMessage: `
    INSERT INTO job_search_ai.chat_messages (
      conversation_id,
      user_id,
      role,
      content_text,
      attachment_document_ids,
      skill_type,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      CASE WHEN $5::text IS NULL THEN NULL ELSE CAST($5 AS jsonb) END,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    RETURNING
      id::text AS id,
      conversation_id::text AS conversation_id,
      user_id::text AS user_id,
      role,
      content_text,
      attachment_document_ids,
      skill_type,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  createStreamSession: `
    INSERT INTO job_search_ai.chat_stream_sessions (
      conversation_id,
      user_id,
      request_message_id,
      stream_payload,
      expires_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      CASE WHEN $4::text IS NULL THEN NULL ELSE CAST($4 AS jsonb) END,
      $5::timestamptz
    )
    RETURNING
      id::text AS id,
      conversation_id::text AS conversation_id,
      user_id::text AS user_id,
      request_message_id::text AS request_message_id,
      status,
      stream_payload,
      error_message,
      expires_at::text AS expires_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  getStreamSessionForUser: `
    SELECT
      id::text AS id,
      conversation_id::text AS conversation_id,
      user_id::text AS user_id,
      request_message_id::text AS request_message_id,
      status,
      stream_payload,
      error_message,
      expires_at::text AS expires_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.chat_stream_sessions
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  updateStreamSessionStatus: `
    UPDATE job_search_ai.chat_stream_sessions
    SET
      status = $1,
      error_message = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3::uuid AND user_id = $4::uuid
  `,
};

export const chatRepository = new ChatRepository(chatSqlTemplates);

const jobSqlTemplates: JobSqlTemplates = {
  listJobSitesByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      company,
      industry,
      us_postal_address,
      url,
      frequency,
      last_polled_at::text AS last_polled_at,
      enabled,
      last_error_message,
      error_count,
      timezone,
      authentication_type,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.job_sources
    WHERE user_id = $1::uuid
    ORDER BY created_at DESC
  `,
  findJobSiteByIdForUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      company,
      industry,
      us_postal_address,
      url,
      frequency,
      last_polled_at::text AS last_polled_at,
      enabled,
      last_error_message,
      error_count,
      timezone,
      authentication_type,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.job_sources
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  insertJobSiteForUser: `
    INSERT INTO job_search_ai.job_sources (
      user_id,
      company,
      industry,
      us_postal_address,
      url,
      frequency,
      enabled,
      timezone,
      authentication_type
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      company,
      industry,
      us_postal_address,
      url,
      frequency,
      last_polled_at::text AS last_polled_at,
      enabled,
      last_error_message,
      error_count,
      timezone,
      authentication_type,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  updateJobSiteForUser: `
    UPDATE job_search_ai.job_sources
    SET
      company = $1,
      industry = $2,
      us_postal_address = $3,
      url = $4,
      frequency = $5,
      enabled = $6,
      timezone = $7,
      authentication_type = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9::uuid AND user_id = $10::uuid
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      company,
      industry,
      us_postal_address,
      url,
      frequency,
      last_polled_at::text AS last_polled_at,
      enabled,
      last_error_message,
      error_count,
      timezone,
      authentication_type,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  deleteJobSiteForUser: `
    DELETE FROM job_search_ai.job_sources
    WHERE id = $1::uuid AND user_id = $2::uuid
  `,
  listJobListingsByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      job_source_id::text AS job_source_id,
      job_title,
      company_name,
      job_description_text,
      requirements_text,
      application_url,
      job_url,
      external_job_id,
      posting_date::text AS posting_date,
      salary_range,
      location,
      job_location_type,
      job_type,
      job_level,
      application_deadline::text AS application_deadline,
      user_interest_level,
      user_tags,
      status,
      first_seen_at::text AS first_seen_at,
      last_fetched_at::text AS last_fetched_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at,
      assessments.score AS match_score
    FROM job_search_ai.jobs
    LEFT JOIN job_search_ai.assessments
      ON assessments.job_id = jobs.id
      AND assessments.user_id = jobs.user_id
    WHERE jobs.user_id = $1::uuid
      AND ($2::text IS NULL OR jobs.status = $2::text)
      AND ($3::uuid IS NULL OR jobs.job_source_id = $3::uuid)
    ORDER BY assessments.score DESC NULLS LAST, jobs.created_at DESC
  `,
  insertJobListingForUser: `
    INSERT INTO job_search_ai.jobs (
      user_id,
      job_source_id,
      job_title,
      company_name,
      job_url,
      status,
      first_seen_at,
      last_fetched_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      $5,
      $6,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      job_source_id::text AS job_source_id,
      job_title,
      company_name,
      job_description_text,
      requirements_text,
      application_url,
      job_url,
      external_job_id,
      posting_date::text AS posting_date,
      salary_range,
      location,
      job_location_type,
      job_type,
      job_level,
      application_deadline::text AS application_deadline,
      user_interest_level,
      user_tags,
      status,
      first_seen_at::text AS first_seen_at,
      last_fetched_at::text AS last_fetched_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  findJobListingByIdForUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      job_source_id::text AS job_source_id,
      job_title,
      company_name,
      job_description_text,
      requirements_text,
      application_url,
      job_url,
      external_job_id,
      posting_date::text AS posting_date,
      salary_range,
      location,
      job_location_type,
      job_type,
      job_level,
      application_deadline::text AS application_deadline,
      user_interest_level,
      user_tags,
      status,
      first_seen_at::text AS first_seen_at,
      last_fetched_at::text AS last_fetched_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.jobs
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  updateJobListingStatusForUser: `
    UPDATE job_search_ai.jobs
    SET
      status = $1::text,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2::uuid
      AND user_id = $3::uuid
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      job_source_id::text AS job_source_id,
      job_title,
      company_name,
      job_description_text,
      requirements_text,
      application_url,
      job_url,
      external_job_id,
      posting_date::text AS posting_date,
      salary_range,
      location,
      job_location_type,
      job_type,
      job_level,
      application_deadline::text AS application_deadline,
      user_interest_level,
      user_tags,
      status,
      first_seen_at::text AS first_seen_at,
      last_fetched_at::text AS last_fetched_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  listResumePacketsByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      job_id::text AS job_id,
      status,
      application_status,
      date_applied::text AS date_applied,
      date_of_last_status_change::text AS date_of_last_status_change,
      application_method,
      application_tracking_number,
      portal_url,
      version_number,
      parent_resume_package_id::text AS parent_resume_package_id,
      resume_file_url,
      resume_file_path,
      resume_storage_type,
      resume_file_size,
      resume_file_format,
      cover_letter_file_url,
      cover_letter_file_path,
      cover_letter_storage_type,
      cover_letter_file_size,
      cover_letter_file_format,
      generated_at::text AS generated_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.resume_packages
    WHERE user_id = $1::uuid
      AND ($2::uuid IS NULL OR job_id = $2::uuid)
      AND ($3::text IS NULL OR status = $3::text)
      AND ($4::text IS NULL OR application_status = $4::text)
    ORDER BY created_at DESC
  `,
  insertResumePacketForUser: `
    INSERT INTO job_search_ai.resume_packages (
      user_id,
      job_id,
      status
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      job_id::text AS job_id,
      status,
      application_status,
      date_applied::text AS date_applied,
      date_of_last_status_change::text AS date_of_last_status_change,
      application_method,
      application_tracking_number,
      portal_url,
      version_number,
      parent_resume_package_id::text AS parent_resume_package_id,
      resume_file_url,
      resume_file_path,
      resume_storage_type,
      resume_file_size,
      resume_file_format,
      cover_letter_file_url,
      cover_letter_file_path,
      cover_letter_storage_type,
      cover_letter_file_size,
      cover_letter_file_format,
      generated_at::text AS generated_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
};

export const jobRepository = new JobRepository(jobSqlTemplates);

const skillSqlTemplates: SkillSqlTemplates = {
  listSkillsByUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      skill_name,
      skill_category,
      description,
      years_of_experience,
      last_used_date::text AS last_used_date,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.skills
    WHERE user_id = $1::uuid
    ORDER BY skill_name ASC
  `,
  findSkillByIdForUser: `
    SELECT
      id::text AS id,
      user_id::text AS user_id,
      skill_name,
      skill_category,
      description,
      years_of_experience,
      last_used_date::text AS last_used_date,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.skills
    WHERE id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
  `,
  insertSkillForUser: `
    INSERT INTO job_search_ai.skills (
      user_id,
      skill_name,
      skill_category,
      description,
      years_of_experience,
      last_used_date
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      CASE WHEN $6::text IS NULL THEN NULL ELSE $6::text::date END
    )
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      skill_name,
      skill_category,
      description,
      years_of_experience,
      last_used_date::text AS last_used_date,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  updateSkillForUser: `
    UPDATE job_search_ai.skills
    SET
      skill_name = $1,
      skill_category = $2,
      description = $3,
      years_of_experience = $4,
      last_used_date = CASE WHEN $5::text IS NULL THEN NULL ELSE $5::text::date END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6::uuid
      AND user_id = $7::uuid
    RETURNING
      id::text AS id,
      user_id::text AS user_id,
      skill_name,
      skill_category,
      description,
      years_of_experience,
      last_used_date::text AS last_used_date,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `,
  deleteSkillForUser: `
    DELETE FROM job_search_ai.skills
    WHERE id = $1::uuid AND user_id = $2::uuid
  `,
};

export const skillRepository = new SkillRepository(skillSqlTemplates);

