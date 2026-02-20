import { describe, expect, it, vi } from "vitest";

import {
  DatabaseOperationError,
  DocumentRepository,
  type DocumentSqlTemplates,
} from "./db-repository";
import type { PreparedClient } from "./prepared-client";

const sqlTemplates: DocumentSqlTemplates = {
  listDocumentsByUser: "SELECT * FROM documents WHERE user_id = :user_id",
  findDocumentByIdForUser:
    "SELECT * FROM documents WHERE id = :document_id AND user_id = :user_id LIMIT 1",
  deleteDocumentByIdForUser:
    "DELETE FROM documents WHERE id = :document_id AND user_id = :user_id",
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
        parameters: { user_id: "user-1" },
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
      parameters: { user_id: "user-1" },
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
        parameters: { document_id: "doc-x", user_id: "user-1" },
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
        parameters: { user_id: "user-1" },
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
      parameters: { document_id: "doc-1", user_id: "user-1" },
    });
  });
});

