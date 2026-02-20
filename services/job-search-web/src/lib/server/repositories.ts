import "server-only";

import {
  DocumentRepository,
  DocumentSqlTemplates,
} from "../db/db-repository";

const documentSqlTemplates: DocumentSqlTemplates = {
  listDocumentsByUser: `
    SELECT id, user_id, filename, content_type, size_bytes, status, uploaded_at
    FROM documents
    WHERE user_id = :user_id
    ORDER BY uploaded_at DESC
  `,
  findDocumentByIdForUser: `
    SELECT id, user_id, filename, content_type, size_bytes, status, uploaded_at
    FROM documents
    WHERE id = :document_id AND user_id = :user_id
    LIMIT 1
  `,
  deleteDocumentByIdForUser: `
    DELETE FROM documents
    WHERE id = :document_id AND user_id = :user_id
  `,
};

export const documentRepository = new DocumentRepository(documentSqlTemplates);

