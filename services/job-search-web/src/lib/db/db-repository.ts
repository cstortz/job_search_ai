import "server-only";

import {
  PreparedClient,
  PreparedClientError,
  PreparedDeleteRequest,
  PreparedInsertRequest,
  PreparedSQLResponse,
  PreparedSelectRequest,
  PreparedUpdateRequest,
  ValidationResponse,
  createPreparedClient,
} from "./prepared-client";

export class DatabaseOperationError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "DatabaseOperationError";
    this.details = details;
  }
}

function ensureSuccess<T>(response: PreparedSQLResponse<T>): PreparedSQLResponse<T> {
  if (!response.success) {
    throw new DatabaseOperationError(
      response.message || "Prepared SQL operation failed.",
      response,
    );
  }
  return response;
}

/**
 * Generic repository helper that centralizes Prepared SQL usage.
 * Feature repositories should extend this class and expose domain methods.
 */
export class PreparedRepository {
  protected readonly client: PreparedClient;

  constructor(client: PreparedClient = createPreparedClient()) {
    this.client = client;
  }

  protected async selectMany<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<T[]> {
    const request: PreparedSelectRequest = { sql, parameters: parameters ?? null };
    const response = await this.client.preparedSelect<T>(request);
    return ensureSuccess(response).data ?? [];
  }

  protected async selectOne<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<T | null> {
    const rows = await this.selectMany<T>(sql, parameters);
    return rows.length > 0 ? rows[0] : null;
  }

  protected async insert<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedInsertRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedInsert<T>(request));
  }

  protected async update<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedUpdateRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedUpdate<T>(request));
  }

  protected async delete<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedDeleteRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedDelete<T>(request));
  }

  protected async validate(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<ValidationResponse> {
    const response = await this.client.validatePreparedSql({
      sql,
      parameters: parameters ?? null,
      operation_type: "read",
    });

    if (!response.valid) {
      throw new DatabaseOperationError(
        response.message || "Prepared SQL validation failed.",
        response,
      );
    }

    return response;
  }
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  uploaded_at: string;
}

export interface DocumentSqlTemplates {
  listDocumentsByUser: string;
  findDocumentByIdForUser: string;
  deleteDocumentByIdForUser: string;
}

/**
 * Example domain repository.
 * Keep SQL here (server-side), never in UI/client components.
 */
export class DocumentRepository extends PreparedRepository {
  private readonly sql: DocumentSqlTemplates;

  constructor(
    sqlTemplates: DocumentSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async listByUserId(userId: string): Promise<DocumentRecord[]> {
    return this.selectMany<DocumentRecord>(this.sql.listDocumentsByUser, {
      user_id: userId,
    });
  }

  async findByIdForUser(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null> {
    return this.selectOne<DocumentRecord>(this.sql.findDocumentByIdForUser, {
      document_id: documentId,
      user_id: userId,
    });
  }

  async deleteByIdForUser(documentId: string, userId: string): Promise<number> {
    const response = await this.delete(this.sql.deleteDocumentByIdForUser, {
      document_id: documentId,
      user_id: userId,
    });
    return response.affected_rows ?? 0;
  }
}

export function isPreparedClientError(error: unknown): error is PreparedClientError {
  return error instanceof PreparedClientError;
}

