import "server-only";

const serverUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Job Search Web API",
      version: "0.1.0",
      description:
        "Frontend-owned API routes for the Job Search Web service. Includes manual test examples for each route.",
    },
    servers: [
      {
        url: serverUrl,
        description: "Frontend service base URL",
      },
    ],
    paths: {
      "/api/health": {
        get: {
          summary: "Health check",
          description: "Liveness/readiness endpoint for probes and smoke checks.",
          operationId: "getHealth",
          tags: ["Health"],
          responses: {
            "200": {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                  examples: {
                    healthy: {
                      value: { ok: true, service: "job-search-web" },
                    },
                  },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "bash",
              label: "curl test request",
              source:
                "curl -X GET 'http://localhost:3000/api/health' -H 'accept: application/json'",
            },
          ],
        },
      },
      "/api/documents": {
        get: {
          summary: "List user documents",
          description:
            "Returns uploaded documents scoped to the authenticated user. Current implementation expects `x-user-id` header.",
          operationId: "getDocuments",
          tags: ["Documents"],
          parameters: [
            {
              name: "x-user-id",
              in: "header",
              required: true,
              schema: { type: "string" },
              description:
                "Temporary user identifier header used during early route development.",
              example: "auth0|user_123",
            },
          ],
          responses: {
            "200": {
              description: "Documents returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["documents"],
                    properties: {
                      documents: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DocumentRecord" },
                      },
                    },
                  },
                  examples: {
                    listDocuments: {
                      value: {
                        documents: [
                          {
                            id: "doc-1",
                            user_id: "auth0|user_123",
                            filename: "resume.pdf",
                            content_type: "application/pdf",
                            size_bytes: 248130,
                            status: "ready",
                            uploaded_at: "2026-02-20T19:30:00Z",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing user header",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "bash",
              label: "curl test request",
              source:
                "curl -X GET 'http://localhost:3000/api/documents' -H 'accept: application/json' -H 'x-user-id: auth0|user_123'",
            },
          ],
        },
      },
      "/api/documents/{id}": {
        delete: {
          summary: "Delete user document",
          description:
            "Deletes one document for the current user. Current implementation expects `x-user-id` header.",
          operationId: "deleteDocument",
          tags: ["Documents"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "doc-1",
            },
            {
              name: "x-user-id",
              in: "header",
              required: true,
              schema: { type: "string" },
              example: "auth0|user_123",
            },
          ],
          responses: {
            "200": {
              description: "Document deletion result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted", "affectedRows", "id"],
                    properties: {
                      deleted: { type: "boolean" },
                      affectedRows: { type: "integer" },
                      id: { type: "string" },
                    },
                  },
                  examples: {
                    deleted: {
                      value: { deleted: true, affectedRows: 1, id: "doc-1" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing user header",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Document not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "bash",
              label: "curl test request",
              source:
                "curl -X DELETE 'http://localhost:3000/api/documents/doc-1' -H 'accept: application/json' -H 'x-user-id: auth0|user_123'",
            },
          ],
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["ok", "service"],
          properties: {
            ok: { type: "boolean" },
            service: { type: "string" },
          },
        },
        DocumentRecord: {
          type: "object",
          required: [
            "id",
            "user_id",
            "filename",
            "content_type",
            "size_bytes",
            "status",
            "uploaded_at",
          ],
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            filename: { type: "string" },
            content_type: { type: "string" },
            size_bytes: { type: "integer" },
            status: { type: "string", enum: ["processing", "ready", "error"] },
            uploaded_at: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  };
}
