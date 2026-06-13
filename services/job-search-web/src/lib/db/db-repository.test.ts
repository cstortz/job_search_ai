import { describe, expect, it, vi } from "vitest";

import {
  DatabaseOperationError,
  DocumentRepository,
  type DocumentSqlTemplates,
  UserRepository,
  type UserSqlTemplates,
} from "./db-repository";
import type { PreparedClient } from "./prepared-client";

const sqlTemplates: DocumentSqlTemplates = {
  listDocumentsByUser: "SELECT * FROM documents WHERE user_id = $1::uuid",
  findDocumentByIdForUser:
    "SELECT * FROM documents WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1",
  deleteDocumentByIdForUser:
    "DELETE FROM documents WHERE id = $1::uuid AND user_id = $2::uuid",
  insertUploadedDocument: `
    INSERT INTO documents (user_id, document_name) VALUES ($1::uuid, $3)
    RETURNING id, user_id, document_name AS filename
  `,
};

const userSqlTemplates: UserSqlTemplates = {
  upsertUserByAuth0Subject:
    "INSERT INTO job_search_ai.users (auth0_subject_id, email, name) VALUES ($1,$3,$2) RETURNING *",
  findUserByAuth0Subject:
    "SELECT * FROM job_search_ai.users WHERE auth0_subject_id = $1 LIMIT 1",
};

describe("DocumentRepository", () => {
  it("listByUserId returns rows from prepared select", async () => {
    const client = {
      preparedSelect: vi.fn().mockResolvedValue({
        success: true,
        message: "ok",
        data: [
          {
            id: "doc-1",
            user_id: "user-1",
            filename: "resume.pdf",
            content_type: "application/pdf",
            size_bytes: 100,
            status: "ready",
            uploaded_at: "2026-01-01T00:00:00Z",
          },
        ],
        row_count: 1,
        affected_rows: null,
        sql: sqlTemplates.listDocumentsByUser,
        parameters: { "1": "user-1" },
      }),
    };

    const repository = new DocumentRepository(
      sqlTemplates,
      client as unknown as PreparedClient,
    );
    const rows = await repository.listByUserId("user-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.filename).toBe("resume.pdf");
    expect(client.preparedSelect).toHaveBeenCalledWith({
      sql: sqlTemplates.listDocumentsByUser,
      parameters: { "1": "user-1" },
    });
  });

  it("findByIdForUser returns null when no rows exist", async () => {
    const client = {
      preparedSelect: vi.fn().mockResolvedValue({
        success: true,
        message: "ok",
        data: [],
        row_count: 0,
        affected_rows: null,
        sql: sqlTemplates.findDocumentByIdForUser,
        parameters: { "1": "doc-x", "2": "user-1" },
      }),
    };

    const repository = new DocumentRepository(
      sqlTemplates,
      client as unknown as PreparedClient,
    );
    const row = await repository.findByIdForUser("doc-x", "user-1");

    expect(row).toBeNull();
  });

  it("throws DatabaseOperationError when API success is false", async () => {
    const client = {
      preparedSelect: vi.fn().mockResolvedValue({
        success: false,
        message: "query failed",
        data: null,
        row_count: 0,
        affected_rows: null,
        sql: sqlTemplates.listDocumentsByUser,
        parameters: { "1": "user-1" },
      }),
    };

    const repository = new DocumentRepository(
      sqlTemplates,
      client as unknown as PreparedClient,
    );

    await expect(repository.listByUserId("user-1")).rejects.toBeInstanceOf(
      DatabaseOperationError,
    );
  });

  it("deleteByIdForUser returns affected row count", async () => {
    const client = {
      preparedDelete: vi.fn().mockResolvedValue({
        success: true,
        message: "deleted",
        data: null,
        row_count: null,
        affected_rows: 1,
        sql: sqlTemplates.deleteDocumentByIdForUser,
        parameters: { document_id: "doc-1", user_id: "user-1" },
      }),
    };

    const repository = new DocumentRepository(
      sqlTemplates,
      client as unknown as PreparedClient,
    );
    const affectedRows = await repository.deleteByIdForUser("doc-1", "user-1");

    expect(affectedRows).toBe(1);
    expect(client.preparedDelete).toHaveBeenCalledWith({
      sql: sqlTemplates.deleteDocumentByIdForUser,
      parameters: { "1": "doc-1", "2": "user-1" },
    });
  });

  it("createUploadedDocument returns inserted row", async () => {
    const client = {
      preparedInsert: vi.fn().mockResolvedValue({
        success: true,
        message: "inserted",
        data: [
          {
            id: "doc-2",
            user_id: "user-1",
            filename: "resume.pdf",
            content_type: "application/pdf",
            size_bytes: 1200,
            status: "ready",
            uploaded_at: "2026-02-20T20:00:00Z",
          },
        ],
        row_count: 1,
        affected_rows: null,
        sql: sqlTemplates.insertUploadedDocument,
        parameters: {},
      }),
    };

    const repository = new DocumentRepository(
      sqlTemplates,
      client as unknown as PreparedClient,
    );

    const created = await repository.createUploadedDocument({
      userId: "user-1",
      filename: "resume.pdf",
      contentType: "application/pdf",
      sizeBytes: 1200,
      filePath: "/tmp/uploads/resume.pdf",
    });

    expect(created?.id).toBe("doc-2");
    expect(client.preparedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: sqlTemplates.insertUploadedDocument,
        parameters: expect.objectContaining({
          "1": "user-1",
          "3": "resume.pdf",
          "5": "/tmp/uploads/resume.pdf",
        }),
      }),
    );
  });
});

describe("UserRepository", () => {
  it("upsertByAuth0Subject maps payload to positional parameters", async () => {
    const client = {
      preparedInsert: vi.fn().mockResolvedValue({
        success: true,
        message: "upserted",
        data: [
          {
            id: "u-1",
            auth0_subject_id: "auth0|abc",
            name: "Carey Stortz",
            email: "carey@example.com",
            email_verified: true,
            phone: null,
            linkedin_url: null,
            other_urls: null,
            address: null,
            resume_field_includes: null,
            notification_preferences: null,
            timezone: "UTC",
            preferred_name: null,
            work_authorization: null,
            marketing_statements: null,
            job_preferences: null,
            created_at: "2026-02-26T00:00:00Z",
            updated_at: "2026-02-26T00:00:00Z",
          },
        ],
        row_count: 1,
        affected_rows: 1,
        sql: userSqlTemplates.upsertUserByAuth0Subject,
        parameters: {},
      }),
    };

    const repository = new UserRepository(
      userSqlTemplates,
      client as unknown as PreparedClient,
    );

    const user = await repository.upsertByAuth0Subject({
      auth0SubjectId: "auth0|abc",
      email: "carey@example.com",
      name: "Carey Stortz",
      emailVerified: true,
    });

    expect(user?.auth0_subject_id).toBe("auth0|abc");
    expect(client.preparedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: userSqlTemplates.upsertUserByAuth0Subject,
        parameters: expect.objectContaining({
          "1": "auth0|abc",
          "2": "Carey Stortz",
          "3": "carey@example.com",
          "4": true,
        }),
      }),
    );
  });

  it("findByAuth0Subject returns null when not found", async () => {
    const client = {
      preparedSelect: vi.fn().mockResolvedValue({
        success: true,
        message: "ok",
        data: [],
        row_count: 0,
        affected_rows: null,
        sql: userSqlTemplates.findUserByAuth0Subject,
        parameters: { "1": "auth0|missing" },
      }),
    };

    const repository = new UserRepository(
      userSqlTemplates,
      client as unknown as PreparedClient,
    );
    const user = await repository.findByAuth0Subject("auth0|missing");
    expect(user).toBeNull();
  });
});

