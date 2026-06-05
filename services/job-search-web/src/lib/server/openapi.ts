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
            "Upserts a user record from the current Auth0 session. Accepts profile overrides including address, resume inclusion flags, and other URLs.",
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
                    linkedinUrl: {
                      type: ["string", "null"],
                      description:
                        "LinkedIn profile value. UI edits the handle after linkedin.com/in/; stored as full profile URL when possible.",
                    },
                    linkedinHandle: {
                      type: ["string", "null"],
                      description:
                        "Optional UI-only handle segment (linkedin.com/in/{handle}). Prefer linkedinUrl on save.",
                    },
                    address: {
                      type: ["object", "null"],
                      properties: {
                        street: { type: "string" },
                        streetLine2: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        postalCode: { type: "string" },
                        country: { type: "string" },
                      },
                    },
                    otherUrls: {
                      type: ["array", "null"],
                      items: {
                        type: "object",
                        required: ["name", "url", "includeInResume"],
                        properties: {
                          name: { type: "string" },
                          url: { type: "string", format: "uri" },
                          includeInResume: { type: "boolean" },
                        },
                      },
                    },
                    resumeIncludes: {
                      type: ["object", "null"],
                      additionalProperties: { type: "boolean" },
                    },
                    notificationPreferences: {
                      type: ["object", "null"],
                      properties: {
                        email: { type: "boolean" },
                        sms: { type: "boolean" },
                        push: { type: "boolean" },
                        in_app: { type: "boolean" },
                      },
                    },
                    timezone: { type: ["string", "null"] },
                  },
                },
                examples: {
                  syncUser: {
                    value: {
                      phone: "(555) 123-4567",
                      linkedinUrl: "https://linkedin.com/in/careystortz",
                      address: {
                        street: "123 Main St",
                        streetLine2: "",
                        city: "Green Bay",
                        state: "WI",
                        postalCode: "54301",
                        country: "US",
                      },
                      resumeIncludes: {
                        name: true,
                        email: true,
                        phone: true,
                        location: true,
                        streetAddress: false,
                        linkedinUrl: true,
                        timezone: false,
                      },
                      timezone: "America/Chicago",
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
      "/api/job-sites": {
        get: {
          summary: "List job sites",
          description:
            "Returns job source/site configurations for the authenticated user.",
          operationId: "listJobSites",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          responses: {
            "200": {
              description: "Job sites returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobSites"],
                    properties: {
                      jobSites: {
                        type: "array",
                        items: { $ref: "#/components/schemas/JobSiteRecord" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/job-sites' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
        post: {
          summary: "Create job site",
          description:
            "Creates a new job source/site configuration for the authenticated user.",
          operationId: "createJobSite",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string" },
                    company: { type: ["string", "null"] },
                    industry: { type: ["string", "null"] },
                    usPostalAddress: { type: ["string", "null"] },
                    frequency: { type: ["string", "null"] },
                    enabled: { type: "boolean" },
                    timezone: { type: ["string", "null"] },
                    authenticationType: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Job site created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobSite"],
                    properties: {
                      jobSite: { $ref: "#/components/schemas/JobSiteRecord" },
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
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/job-sites' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"url\":\"https://jobs.example.com\",\"company\":\"Example Inc\",\"enabled\":true}'",
            },
          ],
        },
      },
      "/api/job-sites/{id}": {
        get: {
          summary: "Get job site by id",
          description: "Returns one job site owned by the authenticated user.",
          operationId: "getJobSiteById",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Job site returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobSite"],
                    properties: {
                      jobSite: { $ref: "#/components/schemas/JobSiteRecord" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job site not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        patch: {
          summary: "Update job site",
          description: "Updates one job site owned by the authenticated user.",
          operationId: "patchJobSiteById",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string" },
                    company: { type: ["string", "null"] },
                    industry: { type: ["string", "null"] },
                    usPostalAddress: { type: ["string", "null"] },
                    frequency: { type: ["string", "null"] },
                    enabled: { type: "boolean" },
                    timezone: { type: ["string", "null"] },
                    authenticationType: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Job site updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobSite"],
                    properties: {
                      jobSite: { $ref: "#/components/schemas/JobSiteRecord" },
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
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job site not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        delete: {
          summary: "Delete job site",
          description: "Deletes one job site owned by the authenticated user.",
          operationId: "deleteJobSiteById",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Job site deleted",
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
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job site not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/skills": {
        get: {
          summary: "List user skills",
          description: "Returns all skills captured for the authenticated user.",
          operationId: "listSkills",
          tags: ["Skills"],
          security: [{ auth0Session: [] }],
          responses: {
            "200": {
              description: "Skills returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["skills"],
                    properties: {
                      skills: {
                        type: "array",
                        items: { $ref: "#/components/schemas/SkillRecord" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/skills' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
        post: {
          summary: "Create user skill",
          description: "Creates a new skill for the authenticated user.",
          operationId: "createSkill",
          tags: ["Skills"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["skillName"],
                  properties: {
                    skillName: { type: "string" },
                    skillCategory: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    yearsOfExperience: { type: ["integer", "null"] },
                    lastUsedDate: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Skill created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["skill"],
                    properties: {
                      skill: { $ref: "#/components/schemas/SkillRecord" },
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
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/skills' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"skillName\":\"TypeScript\",\"skillCategory\":\"technical\",\"yearsOfExperience\":4}'",
            },
          ],
        },
      },
      "/api/skills/{id}": {
        get: {
          summary: "Get skill by id",
          description: "Returns one skill owned by the authenticated user.",
          operationId: "getSkillById",
          tags: ["Skills"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Skill returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["skill"],
                    properties: {
                      skill: { $ref: "#/components/schemas/SkillRecord" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Skill not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        patch: {
          summary: "Update skill",
          description: "Updates an existing skill owned by the authenticated user.",
          operationId: "updateSkillById",
          tags: ["Skills"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["skillName"],
                  properties: {
                    skillName: { type: "string" },
                    skillCategory: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    yearsOfExperience: { type: ["integer", "null"] },
                    lastUsedDate: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Skill updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["skill"],
                    properties: {
                      skill: { $ref: "#/components/schemas/SkillRecord" },
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
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Skill not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        delete: {
          summary: "Delete skill",
          description: "Deletes one skill owned by the authenticated user.",
          operationId: "deleteSkillById",
          tags: ["Skills"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Skill deleted",
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
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Skill not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/job-listings": {
        get: {
          summary: "List job listings",
          description:
            "Returns job listings for the authenticated user. Supports filtering by listing status and job source.",
          operationId: "listJobListings",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional job listing status filter.",
              example: "active",
            },
            {
              name: "jobSourceId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
              description: "Optional job source UUID filter.",
              example: "6d96f9ef-213d-4d68-9845-f6b4f6f57de8",
            },
          ],
          responses: {
            "200": {
              description: "Job listings returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobListings"],
                    properties: {
                      jobListings: {
                        type: "array",
                        items: { $ref: "#/components/schemas/JobListingRecord" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/job-listings?status=active' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
        post: {
          summary: "Create a job listing from URL",
          description:
            "Creates a single job listing from a provided posting URL and starts resume creation by creating a draft resume packet.",
          operationId: "createJobListing",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["jobUrl"],
                  properties: {
                    jobUrl: { type: "string", format: "uri" },
                  },
                },
                examples: {
                  default: {
                    summary: "Create from URL",
                    value: {
                      jobUrl: "https://company.example/jobs/software-engineer-2",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Job listing created and resume process started",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobListing", "resumePacket", "message"],
                    properties: {
                      jobListing: { $ref: "#/components/schemas/JobListingRecord" },
                      resumePacket: {
                        $ref: "#/components/schemas/ResumePacketRecord",
                      },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/job-listings' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"jobUrl\":\"https://company.example/jobs/software-engineer-2\"}'",
            },
          ],
        },
      },
      "/api/job-listings/{id}": {
        get: {
          summary: "Get job listing by id",
          description:
            "Returns a single job listing owned by the authenticated user.",
          operationId: "getJobListingById",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Job listing UUID.",
              example: "2cdca7a0-6f2e-42a5-b393-733a5a8d23e4",
            },
          ],
          responses: {
            "200": {
              description: "Job listing returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobListing"],
                    properties: {
                      jobListing: {
                        $ref: "#/components/schemas/JobListingRecord",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job listing not found",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/job-listings/2cdca7a0-6f2e-42a5-b393-733a5a8d23e4' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/job-listings/{id}/status": {
        patch: {
          summary: "Update job listing status",
          description:
            "Updates the status field for a single job listing owned by the authenticated user.",
          operationId: "patchJobListingStatus",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Job listing UUID.",
              example: "2cdca7a0-6f2e-42a5-b393-733a5a8d23e4",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: { type: "string", maxLength: 50 },
                  },
                },
                examples: {
                  updateStatus: {
                    value: { status: "archived" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Job listing status updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["jobListing"],
                    properties: {
                      jobListing: {
                        $ref: "#/components/schemas/JobListingRecord",
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
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job listing not found",
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
                "curl -X PATCH 'http://dev01.int.stortz.tech:3000/api/job-listings/2cdca7a0-6f2e-42a5-b393-733a5a8d23e4/status' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"status\":\"archived\"}'",
            },
          ],
        },
      },
      "/api/resume-packets": {
        get: {
          summary: "List resume packets",
          description:
            "Returns resume packages/packets for the authenticated user. Supports filtering by job, packet status, and application status.",
          operationId: "listResumePackets",
          tags: ["Jobs"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "jobId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
              description: "Optional job UUID filter.",
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional resume packet status filter.",
            },
            {
              name: "applicationStatus",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional application status filter.",
            },
          ],
          responses: {
            "200": {
              description: "Resume packets returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["resumePackets"],
                    properties: {
                      resumePackets: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ResumePacketRecord" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/resume-packets?applicationStatus=applied' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/chat/message": {
        post: {
          summary: "Create chat session and enqueue user message",
          description:
            "Creates or continues a conversation and returns a `sessionId` used by the SSE stream endpoint.",
          operationId: "postChatMessage",
          tags: ["Chat"],
          security: [{ auth0Session: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["text"],
                  properties: {
                    text: { type: "string" },
                    conversationId: {
                      anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
                    },
                    attachmentIds: {
                      type: "array",
                      items: { type: "string", format: "uuid" },
                    },
                  },
                },
                examples: {
                  sendMessage: {
                    value: {
                      text: "Please review my uploaded resume and suggest improvements.",
                      conversationId: null,
                      attachmentIds: ["b5faac3d-22ee-4903-8103-3438a9d874ed"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Chat message accepted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["sessionId", "conversationId"],
                    properties: {
                      sessionId: { type: "string", format: "uuid" },
                      conversationId: { type: "string", format: "uuid" },
                    },
                  },
                  examples: {
                    accepted: {
                      value: {
                        sessionId: "d338451a-cc2f-4c67-bced-3f189e5167a8",
                        conversationId: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
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
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X POST 'http://dev01.int.stortz.tech:3000/api/chat/message' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"text\":\"Please review my uploaded resume.\",\"conversationId\":null,\"attachmentIds\":[]}'",
            },
          ],
        },
      },
      "/api/chat/conversations": {
        get: {
          summary: "List conversations for current user",
          description:
            "Returns all chat conversations for the authenticated user ordered by most recent activity.",
          operationId: "listChatConversations",
          tags: ["Chat"],
          security: [{ auth0Session: [] }],
          responses: {
            "200": {
              description: "Conversation list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["conversations"],
                    properties: {
                      conversations: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/ChatConversationRecord",
                        },
                      },
                    },
                  },
                  examples: {
                    conversations: {
                      value: {
                        conversations: [
                          {
                            id: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
                            user_id: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                            title: null,
                            skill_type: null,
                            last_message_at: "2026-02-20T21:43:00Z",
                            created_at: "2026-02-20T21:42:45Z",
                            updated_at: "2026-02-20T21:43:00Z",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/chat/conversations' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/chat/conversations/{conversationId}": {
        patch: {
          summary: "Update conversation title",
          description:
            "Updates the title for a conversation owned by the authenticated user.",
          operationId: "patchChatConversationTitle",
          tags: ["Chat"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "conversationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Conversation UUID",
              example: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: ["string", "null"], maxLength: 500 },
                  },
                },
                examples: {
                  setTitle: {
                    value: { title: "Resume review follow-up" },
                  },
                  clearTitle: {
                    value: { title: null },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Conversation title updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["conversation"],
                    properties: {
                      conversation: {
                        $ref: "#/components/schemas/ChatConversationRecord",
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
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Conversation not found",
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
                "curl -X PATCH 'http://dev01.int.stortz.tech:3000/api/chat/conversations/46f39744-a756-4ec1-a7e8-4d6d7132452b' -H 'accept: application/json' -H 'content-type: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>' -d '{\"title\":\"Resume review follow-up\"}'",
            },
          ],
        },
      },
      "/api/chat/conversations/{conversationId}/messages": {
        get: {
          summary: "List messages for one conversation",
          description:
            "Returns message history for one conversation owned by the authenticated user.",
          operationId: "listChatMessagesForConversation",
          tags: ["Chat"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "conversationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Conversation UUID",
              example: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
            },
          ],
          responses: {
            "200": {
              description: "Conversation and messages returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["conversation", "messages"],
                    properties: {
                      conversation: {
                        $ref: "#/components/schemas/ChatConversationRecord",
                      },
                      messages: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ChatMessageRecord" },
                      },
                    },
                  },
                  examples: {
                    messages: {
                      value: {
                        conversation: {
                          id: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
                          user_id: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                          title: null,
                          skill_type: null,
                          last_message_at: "2026-02-20T21:43:00Z",
                          created_at: "2026-02-20T21:42:45Z",
                          updated_at: "2026-02-20T21:43:00Z",
                        },
                        messages: [
                          {
                            id: "f3f6d3c7-6646-4067-a0ff-54f703be75d2",
                            conversation_id: "46f39744-a756-4ec1-a7e8-4d6d7132452b",
                            user_id: "2f31fd6a-f872-429f-89f4-85395deef8f9",
                            role: "user",
                            content_text: "Please review my resume.",
                            attachment_document_ids: null,
                            skill_type: null,
                            model: null,
                            prompt_tokens: null,
                            completion_tokens: null,
                            total_tokens: null,
                            created_at: "2026-02-20T21:42:45Z",
                            updated_at: "2026-02-20T21:42:45Z",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Conversation not found",
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
                "curl -X GET 'http://dev01.int.stortz.tech:3000/api/chat/conversations/46f39744-a756-4ec1-a7e8-4d6d7132452b/messages' -H 'accept: application/json' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
            },
          ],
        },
      },
      "/api/chat/stream/{sessionId}": {
        get: {
          summary: "Stream assistant response tokens (SSE)",
          description:
            "Streams assistant tokens for a previously created `sessionId` using Server-Sent Events.",
          operationId: "getChatStream",
          tags: ["Chat"],
          security: [{ auth0Session: [] }],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Session UUID returned by POST /api/chat/message",
              example: "d338451a-cc2f-4c67-bced-3f189e5167a8",
            },
          ],
          responses: {
            "200": {
              description: "SSE token stream",
              content: {
                "text/event-stream": {
                  examples: {
                    stream: {
                      value:
                        "event: token\ndata: Got it. \n\nevent: token\ndata: I received your message.\n\nevent: done\ndata:\n\n",
                    },
                  },
                },
              },
            },
            "401": {
              description: "No valid Auth0 session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Unknown or expired session",
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
                "curl -N -X GET 'http://dev01.int.stortz.tech:3000/api/chat/stream/d338451a-cc2f-4c67-bced-3f189e5167a8' -H 'accept: text/event-stream' --cookie 'appSession=<AUTH0_SESSION_COOKIE>'",
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
        ChatConversationRecord: {
          type: "object",
          required: [
            "id",
            "user_id",
            "title",
            "skill_type",
            "last_message_at",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            title: { type: ["string", "null"] },
            skill_type: { type: ["string", "null"] },
            last_message_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ChatMessageRecord: {
          type: "object",
          required: [
            "id",
            "conversation_id",
            "user_id",
            "role",
            "content_text",
            "attachment_document_ids",
            "skill_type",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            conversation_id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content_text: { type: "string" },
            attachment_document_ids: {
              anyOf: [
                { type: "array", items: { type: "string", format: "uuid" } },
                { type: "null" },
              ],
            },
            skill_type: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            prompt_tokens: { type: ["integer", "null"] },
            completion_tokens: { type: ["integer", "null"] },
            total_tokens: { type: ["integer", "null"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        JobSiteRecord: {
          type: "object",
          required: [
            "id",
            "user_id",
            "url",
            "enabled",
            "error_count",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            company: { type: ["string", "null"] },
            industry: { type: ["string", "null"] },
            us_postal_address: { type: ["string", "null"] },
            url: { type: "string" },
            frequency: { type: ["string", "null"] },
            last_polled_at: { type: ["string", "null"], format: "date-time" },
            enabled: { type: "boolean" },
            last_error_message: { type: ["string", "null"] },
            error_count: { type: "integer" },
            timezone: { type: ["string", "null"] },
            authentication_type: { type: ["string", "null"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        JobListingRecord: {
          type: "object",
          required: [
            "id",
            "user_id",
            "job_title",
            "company_name",
            "job_url",
            "status",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            job_source_id: { type: ["string", "null"], format: "uuid" },
            job_title: { type: "string" },
            company_name: { type: "string" },
            job_description_text: { type: ["string", "null"] },
            requirements_text: { type: ["string", "null"] },
            application_url: { type: ["string", "null"] },
            job_url: { type: "string" },
            external_job_id: { type: ["string", "null"] },
            posting_date: { type: ["string", "null"] },
            salary_range: {},
            location: { type: ["string", "null"] },
            job_location_type: { type: ["string", "null"] },
            job_type: { type: ["string", "null"] },
            job_level: { type: ["string", "null"] },
            application_deadline: { type: ["string", "null"] },
            user_interest_level: { type: ["string", "null"] },
            user_tags: {},
            status: { type: "string" },
            first_seen_at: { type: ["string", "null"], format: "date-time" },
            last_fetched_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ResumePacketRecord: {
          type: "object",
          required: ["id", "user_id", "job_id", "created_at", "updated_at"],
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            job_id: { type: "string", format: "uuid" },
            status: { type: ["string", "null"] },
            application_status: { type: ["string", "null"] },
            date_applied: { type: ["string", "null"], format: "date-time" },
            date_of_last_status_change: {
              type: ["string", "null"],
              format: "date-time",
            },
            application_method: { type: ["string", "null"] },
            application_tracking_number: { type: ["string", "null"] },
            portal_url: { type: ["string", "null"] },
            version_number: { type: ["integer", "null"] },
            parent_resume_package_id: { type: ["string", "null"], format: "uuid" },
            resume_file_url: { type: ["string", "null"] },
            resume_file_path: { type: ["string", "null"] },
            resume_storage_type: { type: ["string", "null"] },
            resume_file_size: { type: ["integer", "null"] },
            resume_file_format: { type: ["string", "null"] },
            cover_letter_file_url: { type: ["string", "null"] },
            cover_letter_file_path: { type: ["string", "null"] },
            cover_letter_storage_type: { type: ["string", "null"] },
            cover_letter_file_size: { type: ["integer", "null"] },
            cover_letter_file_format: { type: ["string", "null"] },
            generated_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        SkillRecord: {
          type: "object",
          required: [
            "id",
            "user_id",
            "skill_name",
            "skill_category",
            "description",
            "years_of_experience",
            "last_used_date",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            skill_name: { type: "string" },
            skill_category: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            years_of_experience: { type: ["integer", "null"] },
            last_used_date: { type: ["string", "null"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
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
            linkedin_url: {
              type: ["string", "null"],
              description: "User-editable LinkedIn profile string.",
            },
            address: { type: ["string", "null"] },
            other_urls: { type: ["array", "object", "null"] },
            resume_field_includes: {
              type: ["object", "null"],
              additionalProperties: { type: "boolean" },
            },
            notification_preferences: {
              type: ["object", "null"],
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" },
                push: { type: "boolean" },
                in_app: { type: "boolean" },
              },
            },
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
