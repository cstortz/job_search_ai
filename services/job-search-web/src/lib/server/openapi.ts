import "server-only";

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
        url: "/",
        description:
          "Relative server base URL (uses the same host as /docs).",
      },
    ],
    paths: {
      "/api/auth/sync-user": {
        post: {
          summary: "Create or update user from Auth0 profile",
          description:
            "Upserts a user record from the current Auth0 session. Accepts optional profile overrides (phone/linkedin/timezone).",
          operationId: "syncUser",
          tags: ["Auth"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    phone: { type: ["string", "null"] },
                    linkedinUrl: { type: ["string", "null"] },
                    timezone: { type: ["string", "null"] },
                  },
                },
                examples: {
                  syncUser: {
                    value: {
                      phone: null,
                      linkedinUrl: "https://linkedin.com/in/careystortz",
                      timezone: "America/New_York",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User created or updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["user"],
                    properties: {
                      user: { $ref: "#/components/schemas/UserRecord" },
                    },
                  },
                  examples: {
                    synced: {
                      value: {
                        user: {
                          id: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                          auth0_subject_id: "auth0|abc123",
                          name: "Carey Stortz",
                          email: "carey@example.com",
                          email_verified: true,
                          phone: null,
                          linkedin_url:
                            "https://linkedin.com/in/careystortz",
                          timezone: "America/New_York",
                          created_at: "2026-02-26T22:30:00Z",
                          updated_at: "2026-02-26T22:30:00Z",
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request body",
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/auth/sync-user' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"timezone\":\"America/New_York\"}'",
            },
          ],
        },
      },
      "/api/auth/session": {
        get: {
          summary: "Inspect auth session",
          description:
            "Returns whether an Auth0 app session cookie is currently present and the basic user claims if authenticated.",
          operationId: "getAuthSessionStatus",
          tags: ["Auth"],
          responses: {
            "200": {
              description: "Auth session status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["authenticated", "user"],
                    properties: {
                      authenticated: { type: "boolean" },
                      user: {
                        anyOf: [
                          { $ref: "#/components/schemas/AuthSessionUser" },
                          { type: "null" },
                        ],
                      },
                    },
                  },
                  examples: {
                    unauthenticated: {
                      value: {
                        authenticated: false,
                        user: null,
                      },
                    },
                    authenticated: {
                      value: {
                        authenticated: true,
                        user: {
                          sub: "auth0|abc123",
                          email: "carey@example.com",
                          name: "Carey Stortz",
                          email_verified: true,
                        },
                      },
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/auth/session' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/auth/me": {
        get: {
          summary: "Get current user profile",
          description:
            "Fetches the current user from the Auth0 session cookie, then resolves app user and RBAC context.",
          operationId: "getCurrentUser",
          tags: ["Auth"],
          security: [{ auth0Session: [] }],
          responses: {
            "200": {
              description: "User found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["user", "roles", "permissions"],
                    properties: {
                      user: { $ref: "#/components/schemas/UserRecord" },
                      roles: {
                        type: "array",
                        items: { type: "string" },
                      },
                      permissions: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                  examples: {
                    me: {
                      value: {
                        user: {
                          id: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                          auth0_subject_id: "auth0|abc123",
                          name: "Carey Stortz",
                          email: "carey@example.com",
                          email_verified: true,
                          phone: null,
                          linkedin_url:
                            "https://linkedin.com/in/careystortz",
                          timezone: "America/New_York",
                          created_at: "2026-02-26T22:30:00Z",
                          updated_at: "2026-02-26T22:30:00Z",
                        },
                        roles: [],
                        permissions: [],
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing auth header",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "User not found",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/auth/me' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/rbac/roles": {
        get: {
          summary: "List available roles",
          description:
            "Returns the RBAC role catalog used by the frontend service.",
          operationId: "listRbacRoles",
          tags: ["RBAC"],
          responses: {
            "200": {
              description: "RBAC roles list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["roles"],
                    properties: {
                      roles: {
                        type: "array",
                        items: { $ref: "#/components/schemas/RoleRecord" },
                      },
                    },
                  },
                  examples: {
                    roles: {
                      value: {
                        roles: [
                          {
                            id: "user",
                            name: "User",
                            description:
                              "Standard user role for personal job-search workflows.",
                          },
                          {
                            id: "admin",
                            name: "Admin",
                            description:
                              "Administrative role with elevated management capabilities.",
                          },
                        ],
                      },
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/rbac/roles' -H 'accept: application/json'",
            },
          ],
        },
      },
      "/api/rbac/permissions": {
        get: {
          summary: "List available permissions",
          description:
            "Returns the RBAC permission catalog used by the frontend service.",
          operationId: "listRbacPermissions",
          tags: ["RBAC"],
          responses: {
            "200": {
              description: "RBAC permissions list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["permissions"],
                    properties: {
                      permissions: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/PermissionRecord",
                        },
                      },
                    },
                  },
                  examples: {
                    permissions: {
                      value: {
                        permissions: [
                          {
                            id: "documents.read",
                            name: "documents.read",
                            description: "Read own uploaded documents.",
                          },
                          {
                            id: "documents.write",
                            name: "documents.write",
                            description: "Upload and delete own documents.",
                          },
                          {
                            id: "chat.use",
                            name: "chat.use",
                            description:
                              "Send chat messages and receive streaming AI responses.",
                          },
                          {
                            id: "admin.manage",
                            name: "admin.manage",
                            description:
                              "Administrative access to global management operations.",
                          },
                        ],
                      },
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/rbac/permissions' -H 'accept: application/json'",
            },
          ],
        },
      },
      "/api/rbac/me": {
        get: {
          summary: "Resolve current user's roles and permissions",
          description:
            "Returns RBAC context for the current user, based on Auth0 subject id.",
          operationId: "getRbacMe",
          tags: ["RBAC"],
          security: [{ auth0Session: [] }],
          responses: {
            "200": {
              description: "Resolved RBAC context",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["userId", "auth0SubjectId", "roles", "permissions"],
                    properties: {
                      userId: { type: "string" },
                      auth0SubjectId: { type: "string" },
                      roles: {
                        type: "array",
                        items: { type: "string" },
                      },
                      permissions: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                  examples: {
                    me: {
                      value: {
                        userId: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                        auth0SubjectId: "auth0|abc123",
                        roles: ["user"],
                        permissions: ["documents.read", "documents.write", "chat.use"],
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing auth header",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "User not found",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/rbac/me' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/health' -H 'accept: application/json'",
            },
          ],
        },
      },
      "/api/documents": {
        get: {
          summary: "List user documents",
          description:
            "Returns uploaded documents for the currently authenticated user (Auth0 session).",
          operationId: "getDocuments",
          tags: ["Documents"],
          security: [{ auth0Session: [] }],
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
                            id: "b5faac3d-22ee-4903-8103-3438a9d874ed",
                            user_id: "11111111-1111-1111-1111-111111111111",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/documents' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/documents/upload": {
        post: {
          summary: "Upload document",
          description:
            "Uploads one file and creates a document record for the authenticated user.",
          operationId: "uploadDocument",
          tags: ["Documents"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                      description: "File to upload (PDF, DOCX, TXT; max 10 MB).",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "File uploaded and document record created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["documentId", "filename", "sizeBytes", "contentType"],
                    properties: {
                      documentId: { type: "string" },
                      filename: { type: "string" },
                      sizeBytes: { type: "integer" },
                      contentType: { type: "string" },
                    },
                  },
                  examples: {
                    uploaded: {
                      value: {
                        documentId: "4f95f0ad-3709-4fca-b0ac-9ffd120f7720",
                        filename: "resume.pdf",
                        sizeBytes: 248130,
                        contentType: "application/pdf",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid upload request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/documents/upload' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -F 'file=@/tmp/resume.pdf;type=application/pdf'",
            },
          ],
        },
      },
      "/api/documents/{id}": {
        get: {
          summary: "Get user document by id",
          description:
            "Returns one document scoped to the authenticated user.",
          operationId: "getDocumentById",
          tags: ["Documents"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Document UUID",
              example: "b5faac3d-22ee-4903-8103-3438a9d874ed",
            },
          ],
          responses: {
            "200": {
              description: "Document returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["document"],
                    properties: {
                      document: {
                        $ref: "#/components/schemas/DocumentRecord",
                      },
                    },
                  },
                  examples: {
                    getDocument: {
                      value: {
                        document: {
                          id: "b5faac3d-22ee-4903-8103-3438a9d874ed",
                          user_id: "11111111-1111-1111-1111-111111111111",
                          filename: "resume.pdf",
                          content_type: "application/pdf",
                          size_bytes: 248130,
                          status: "ready",
                          uploaded_at: "2026-02-20T19:30:00Z",
                        },
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/documents/b5faac3d-22ee-4903-8103-3438a9d874ed' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
        delete: {
          summary: "Delete user document",
          description:
            "Deletes one document for the current authenticated user.",
          operationId: "deleteDocument",
          tags: ["Documents"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Document UUID",
              example: "b5faac3d-22ee-4903-8103-3438a9d874ed",
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
                      value: {
                        deleted: true,
                        affectedRows: 1,
                        id: "b5faac3d-22ee-4903-8103-3438a9d874ed",
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
                "curl -X DELETE 'http://dev01.int.stortz.tech:3000/api/documents/b5faac3d-22ee-4903-8103-3438a9d874ed' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
    },
    components: {
      securitySchemes: {
        auth0Session: {
          type: "apiKey",
          in: "cookie",
          name: "appSession",
        },
      },
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
        UserRecord: {
          type: "object",
          required: [
            "id",
            "auth0_subject_id",
            "name",
            "email",
            "email_verified",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string" },
            auth0_subject_id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            email_verified: { type: "boolean" },
            phone: { type: ["string", "null"] },
            linkedin_url: { type: ["string", "null"] },
            timezone: { type: ["string", "null"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        RoleRecord: {
          type: "object",
          required: ["id", "name", "description"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
          },
        },
        PermissionRecord: {
          type: "object",
          required: ["id", "name", "description"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
          },
        },
        AuthSessionUser: {
          type: "object",
          required: ["sub", "email", "name", "email_verified"],
          properties: {
            sub: { type: "string" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            email_verified: { type: "boolean" },
          },
        },
      },
    },
  };
}
