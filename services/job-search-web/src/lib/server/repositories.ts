import "server-only";

import {
  DocumentRepository,
  DocumentSqlTemplates,
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
      timezone
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7
    )
    ON CONFLICT (auth0_subject_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified,
      phone = EXCLUDED.phone,
      linkedin_url = EXCLUDED.linkedin_url,
      timezone = EXCLUDED.timezone,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id::text AS id,
      auth0_subject_id,
      name,
      email,
      email_verified,
      phone,
      linkedin_url,
      timezone,
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
      timezone,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM job_search_ai.users
    WHERE auth0_subject_id = $1
    LIMIT 1
  `,
};

export const userRepository = new UserRepository(userSqlTemplates);

