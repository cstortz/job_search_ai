# AI Job Search — Next.js Frontend Implementation Prompt

---

## SERVICE DEFINITION (MUST MATCH architecture.md)

Use this exact service entry in `architecture.md` project configuration:

```yaml
- name: "Job Search Web"
  filename: "job-search-web"
  port: 3000
  language: "node"
  health_check_path: "/api/health"
```

This frontend runs as a Node-based Next.js service (not Nginx static hosting).

---

## Project Overview

Build the frontend web app for an AI-powered job search assistant using Next.js App Router
and TypeScript. This document defines frontend behavior, structure, and API integration
requirements while staying aligned with the monorepo DevOps architecture in `architecture.md`.

Primary UX is a Claude-powered chat interface. File uploads happen inline in the chat input:
users attach files before sending, upload starts immediately, and sent messages reference
uploaded document IDs.

This is an internal project. All files are uploaded directly to backend APIs and stored on
internal infrastructure. No cloud object storage is used.

---

## Stack (Aligned to architecture.md)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable) | App Router + React Server/Client Components as appropriate |
| Language | TypeScript | Strict mode enabled |
| Runtime | Node.js | Container listens on port 3000 |
| Routing | Next.js App Router | Route groups and nested layouts where useful |
| State | React state + lightweight store | `useState`, `useReducer`, optional Zustand; no Angular Signals |
| Auth | Auth0 | Auth0 Next.js SDK, session-based frontend auth |
| HTTP to backend | `fetch` | Use bearer token from Auth0 session for protected API calls |
| Streaming | SSE | `EventSource` from client component for token streaming |
| Markdown rendering | `react-markdown` | Assistant messages render structured markdown |
| Styling | CSS Modules or scoped styles | Keep implementation simple and consistent |

---

## Monorepo and Service Layout

The service lives under:

```
services/job-search-web/
  Dockerfile
  .dockerignore
  package.json
  next.config.ts
  tsconfig.json
  app/
    layout.tsx
    page.tsx                  # redirects to /chat
    chat/
      page.tsx
    callback/
      page.tsx                # optional based on Auth0 flow
    api/
      health/route.ts         # returns 200 for probes
  src/
    components/
      chat/
      documents/
      shared/
    lib/
      api/
      auth/
      models/
      utils/
```

CI path filters and Helm charts continue to use `services/job-search-web/**` and
`helm/job-search-web/**` as defined in the architecture document.

---

## Runtime Configuration and Environment Variables

Do not use Angular-style runtime injection (`window.__env`) or Nginx entrypoint scripts.
Use standard Next.js environment variables:

- Browser-safe config uses `NEXT_PUBLIC_*`.
- Server-only secrets remain non-public env vars.
- Frontend should read:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_AUTH0_DOMAIN`
  - `NEXT_PUBLIC_AUTH0_CLIENT_ID`
  - `NEXT_PUBLIC_AUTH0_AUDIENCE`
  - plus Auth0 app session vars required by the SDK.

Example browser-safe access:

```ts
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api",
  auth0Domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "",
  auth0ClientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "",
  auth0Audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "",
};
```

---

## Data Models

```ts
export type MessageRole = "user" | "assistant";
export type ChatSkill =
  | "resume-review"
  | "generate-packet"
  | "monitor-job-site"
  | "query-packets"
  | "apply-for-job";

export interface MessageAttachment {
  documentId: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  attachments?: MessageAttachment[];
  skillType?: ChatSkill;
}

export type DocumentStatus = "processing" | "ready" | "error";

export interface CareerDocument {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: DocumentStatus;
}

export interface ResumePacket {
  id: string;
  targetWebsite: string;
  targetJobTitle: string;
  createdAt: string;
  downloadUrl: string;
}

export interface JobSite {
  id: string;
  url: string;
  label: string;
  addedAt: string;
  lastCheckedAt?: string;
  newJobsCount: number;
}

export type JobListingStatus = "new" | "viewed" | "applied" | "archived";

export interface JobListing {
  id: string;
  jobSiteId: string;
  jobSiteLabel: string;
  title: string;
  company: string;
  postingUrl: string;
  description: string;
  discoveredAt: string;
  status: JobListingStatus;
}
```

---

## Feature 0 - Auth0 Protection

### Goal
Protect all app pages behind Auth0 except explicit auth callback endpoints.

### Requirements

- Use Auth0 Next.js integration for login, logout, callback, and session retrieval.
- Unauthenticated access to `/chat` triggers login flow.
- Top navigation shows user name/avatar from session.
- Logout returns user to app origin.
- Frontend includes bearer token when calling protected backend endpoints.

---

## Feature 1 - Chat UI and Streaming

### Goal
Full-screen chat interface with assistant tokens streamed live over SSE.

### Layout

```
+--------------------------------------------------+
|              Top Navigation Bar                  |
+----------------+---------------------------------+
|                |                                 |
|  Document      |       Chat Window               |
|  Panel         |  (scrollable message list)      |
|                +---------------------------------+
|                |  Skill Chips                    |
|                +---------------------------------+
|                |       Chat Input Bar            |
+----------------+---------------------------------+
```

### Chat State (client store)

Maintain:
- `messages: Message[]`
- `isStreaming: boolean`
- `streamingContent: string`
- `error: string | null`
- `conversationId: string | null`

### Send and stream flow

1. Append user message locally.
2. POST to `/api/chat/message` with:
   - `text`
   - `conversationId`
   - `attachmentIds`
3. Receive `{ sessionId, conversationId }`.
4. Open `EventSource` to `/api/chat/stream/{sessionId}`.
5. On `token` events, append token text to `streamingContent`.
6. On `done`, append assistant message and clear streaming state.
7. On stream error, stop streaming and surface retry error.

### Rendering

- User message bubbles right-aligned.
- Assistant message bubbles left-aligned.
- Assistant content rendered via Markdown renderer.
- While streaming, render a temporary assistant bubble with blinking cursor.
- Chat list container must use `role="log"` and `aria-live="polite"`.

---

## Feature 2 - Inline File Upload

### Goal
Uploads are part of chat composition, not a separate workflow.

### Behavior

- Input supports multi-file attach (`.pdf`, `.docx`, `.txt`).
- Files upload immediately after selection.
- Pending attachment chips show upload status/progress.
- On submit, only successfully uploaded attachments are included.
- Remove action only removes from pending message, not server storage.

### Validation

- Allowed MIME types:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `text/plain`
- Max size: 10 MB
- Invalid files show non-blocking toast/banner.

### Document API contract

```
POST /api/documents/upload
  Content-Type: multipart/form-data
  Body: file
  Response 201: { documentId, filename, sizeBytes, contentType }

GET /api/documents
  Response 200: CareerDocument[]

DELETE /api/documents/:id
  Response 204
```

---

## Feature 3 - Resume Review Skill

### Trigger
`"Review My Resume"` chip or similar user intent.

### Frontend responsibilities

- Set `skillType: "resume-review"` on triggering user message.
- Use normal chat flow only; no dedicated page or wizard.
- Render backend markdown output directly in assistant bubble.

---

## Feature 4 - Generate Resume Packet Skill

### Trigger
`"Generate Resume Packet"` chip.

### Frontend responsibilities

- Set `skillType: "generate-packet"` on trigger.
- No dedicated UI; conversational flow only.
- Markdown links to packet download render in chat.

Packet list endpoint:

```
GET /api/resume-packets
  Response 200: ResumePacket[]
```

---

## Feature 5 - Monitor Job Site Skill

### Trigger
`"Monitor a Job Site"` chip.

### Frontend responsibilities

- Set `skillType: "monitor-job-site"` on trigger.
- Conversational only; no dedicated CRUD page required.

Endpoints:

```
GET /api/job-sites
  Response 200: JobSite[]
```

---

## Feature 6 - Query Saved Packets Skill

### Trigger
`"My Saved Packets"` chip.

### Frontend responsibilities

- Set `skillType: "query-packets"` on trigger.
- Render backend markdown tables and links in chat bubble.

---

## Feature 7 - Apply for Saved Job Skill

### Trigger
`"Apply for a Job"` chip or equivalent user prompt.

### Backend prerequisite
Requires backend support for persisted individual job listings.

Required APIs:

```
GET /api/job-listings
GET /api/job-listings/:id
PATCH /api/job-listings/:id/status
```

### Frontend responsibilities

- Set `skillType: "apply-for-job"` on trigger.
- Keep flow conversational in chat.
- After user confirms submission, call
  `PATCH /api/job-listings/:id/status` with `{ status: "applied" }`.

---

## Document Panel (Secondary UI)

A side panel opened from top nav that lists uploaded documents.

Requirements:
- Fetch on panel open.
- Refresh after successful upload/delete.
- Show status, upload time, and delete action.
- Confirm before delete.
- Empty state: "No documents yet. Attach files directly in the chat to upload them."

---

## Health Check Endpoint

Implement a lightweight Next.js route:

```
GET /api/health -> 200 OK
```

Used by readiness/liveness probes from Helm values.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Send message network failure | Show retryable error banner |
| SSE disconnect mid-stream | Stop stream, preserve typed history, show reconnect guidance |
| Upload failure | Mark attachment as error and offer retry |
| Invalid file type/size | Show user-facing validation message before upload starts |
| 401/expired auth | Trigger re-authentication via Auth0 |

---

## Accessibility

- Icon-only buttons require `aria-label`.
- Chat transcript region uses `role="log"` and `aria-live="polite"`.
- After submit, focus returns to chat textarea.
- Attachment chips are keyboard navigable and removable by keyboard.
- Status uses text or icon in addition to color.

---

## Performance

- Keep markdown rendering scoped to assistant bubbles.
- Avoid full list re-render on each token; update only streaming message node.
- Use dynamic import for heavier optional UI sections where useful.
- Minimize client-only boundaries; keep static shell components server-rendered.

---

## DevOps and Deployment Alignment

This frontend must follow the architecture template behavior:

- Node service on port `3000`.
- Health check path `/api/health`.
- Non-root container requirement is satisfied by Dockerfile generated from the Node template.
- No Nginx config, no runtime `config.js`, no `entrypoint.sh`.
- CI/CD triggers and Helm charts are generated by architecture scaffolding and remain authoritative.

---

## Implementation Order

1. Scaffold `services/job-search-web` as Next.js App Router + TypeScript service.
2. Add Auth0 integration and protected `/chat` experience.
3. Build chat shell layout and message list rendering.
4. Add chat state/store and send-message API integration.
5. Add SSE streaming flow and live assistant bubble updates.
6. Implement chat input interactions (submit shortcuts, disabled states).
7. Implement inline upload chips, immediate upload, validation, retry.
8. Add skill chips and attach `skillType` metadata on trigger.
9. Add document side panel (list, status, delete confirm).
10. Add `/api/health` route and verify probe compatibility.
11. Finalize accessibility, error handling, and performance polish.