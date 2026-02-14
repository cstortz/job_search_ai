# AI Job Search — Angular Frontend Implementation Prompt

---

## ⬇️ SERVICE DEFINITION — COPY THIS INTO THE ARCHITECTURE CONFIG

When filling in the `## Project Configuration` block of the architecture/devops prompt,
add this entry to the `services:` list:

```yaml
- name: "Job Search Web"
  filename: "job-search-web"
  port: 8080
  language: "node"
  health_check_path: "/healthz"
```

> **Why port 8080?** The container serves via `nginx-unprivileged`, which listens on
> 8080 by default so Nginx can run as a non-root user — satisfying the architecture's
> non-root container requirement without extra kernel capabilities.

---

## Project Overview

Build the Angular frontend web application for an AI-powered job search assistant. The app
lives inside an existing **Nx monorepo** under `apps/job-search-web/`. The backend and
monorepo DevOps scaffolding (GitHub Actions, Helm, Sealed Secrets) are already defined
in the architecture document. This prompt defines the complete specification for the
**frontend application only**.

The main experience is a **Claude AI–powered chatbot**. File uploads happen **inline
inside the chat interface**, matching the UX pattern of ChatGPT and Claude.ai — the user
attaches a file directly from the chat input bar, previews it as an attachment chip
before sending, and the file travels with the message as a single `multipart/form-data`
request. The assistant acknowledges and acts on the file as a natural part of the
conversation.

This is a **100% internal project**. All file uploads go directly to the backend API,
which stores them on the local server filesystem. No cloud storage is used.

---

## Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Angular (latest stable) | Standalone components throughout — no NgModules |
| Monorepo Tooling | Nx | App source under `apps/job-search-web/` |
| Component Library | Angular Material | Version must match the Angular version installed |
| Styling | Angular Material theming + SCSS | Custom theme file; no Tailwind |
| State Management | Angular Signals | `signal()`, `computed()`, `effect()` — no NgRx |
| Routing | Angular Router | Standalone router with lazy-loaded feature routes |
| HTTP | Angular `HttpClient` | Use `inject(HttpClient)` pattern inside all services |
| Authentication | Auth0 | `@auth0/auth0-angular` SDK |
| File Uploads | `multipart/form-data` via `HttpClient` | Inline in chat — no cloud storage |
| AI Streaming | Server-Sent Events (SSE) | Streams Claude responses token by token |
| Markdown Rendering | `ngx-markdown` | Renders all assistant messages as formatted Markdown |
| Container Runtime | `nginx-unprivileged:alpine` | Serves the Angular build; runs as non-root |

---

## DevOps & Container Alignment

This section defines everything the architecture scaffold needs from the frontend service.
All items here directly correspond to the architecture document's specifications.

---

### Monorepo Location

The Angular source lives in the Nx workspace as normal:
```
apps/job-search-web/    ← Angular source (Nx convention)
```

The architecture scaffold additionally requires a service directory at the repo root:
```
services/job-search-web/
  Dockerfile
  nginx.conf
  entrypoint.sh
  .dockerignore
```

> The `services/job-search-web/` directory is what the GitHub Actions CI/CD path filter
> watches (`services/job-search-web/**`). The Dockerfile inside it runs the Angular build
> from the monorepo root context so it can access `apps/job-search-web/` and `package.json`.

---

### Dockerfile

Multi-stage build. Stage 1 compiles the Angular app; Stage 2 is a minimal Nginx runtime.
This deviates from the standard Node.js runtime template in the architecture doc because
Angular produces static assets that must be served by a web server, not Node. The Node
runtime stage is replaced with `nginx-unprivileged` to satisfy the non-root requirement.

```dockerfile
# services/job-search-web/Dockerfile

ARG APP_VERSION=dev

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

# Copy dependency manifests first to exploit Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy the full monorepo source
COPY . .

# Build the Angular app in production mode
RUN npx nx build job-search-web --configuration production

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
# nginx-unprivileged runs on port 8080 as a non-root user out of the box,
# satisfying the architecture's non-root container requirement without
# requiring extra Linux capabilities (no CAP_NET_BIND_SERVICE needed).
FROM nginxinc/nginx-unprivileged:alpine AS runtime

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

# Copy the compiled Angular output from the builder stage.
# Nx outputs to dist/apps/job-search-web/browser for standalone builds.
COPY --from=builder /app/dist/apps/job-search-web/browser /usr/share/nginx/html

# Copy the custom Nginx config (SPA routing + /healthz endpoint)
COPY services/job-search-web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy and enable the entrypoint script that injects runtime config
COPY services/job-search-web/entrypoint.sh /entrypoint.sh

# nginx-unprivileged already uses a non-root user (nginx, uid 101).
# We only need to ensure the entrypoint is executable.
USER root
RUN chmod +x /entrypoint.sh
USER nginx

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
```

---

### Nginx Configuration

```nginx
# services/job-search-web/nginx.conf

server {
    listen       8080;
    server_name  _;
    root         /usr/share/nginx/html;
    index        index.html;

    # Kubernetes readiness and liveness probe endpoint.
    # Returns 200 immediately with no disk I/O — lightweight for frequent probing.
    location /healthz {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    # Angular SPA routing: any path that does not match a real file
    # falls back to index.html so the Angular router can handle it.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively; Angular filenames include content hashes
    # so cache busting is automatic on new deployments.
    location ~* \.(js|css|png|jpg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

### Runtime Configuration & Environment Injection

**Problem:** Angular's `environment.ts` values are baked into the JavaScript bundle at
build time. In Kubernetes, the same Docker image must run in both `staging` and
`production` with different Auth0 domains and API URLs — so values cannot be hardcoded
into the image.

**Solution:** A shell `entrypoint.sh` writes a `config.js` file to the Nginx web root
at container startup, reading values from environment variables injected by Kubernetes
ConfigMap. Angular reads these values from `window.__env` at runtime via an
`APP_INITIALIZER`.

```bash
#!/bin/sh
# services/job-search-web/entrypoint.sh
#
# Writes runtime configuration into config.js before Nginx starts.
# Values are injected as environment variables by Kubernetes ConfigMap.
# This allows the same Docker image to run in staging and production.

cat > /usr/share/nginx/html/config.js <<EOF
window.__env = {
  apiBaseUrl: "${API_BASE_URL:-http://localhost:3000/api}",
  auth0Domain: "${AUTH0_DOMAIN:-}",
  auth0ClientId: "${AUTH0_CLIENT_ID:-}",
  auth0Audience: "${AUTH0_AUDIENCE:-}",
};
EOF

exec nginx -g "daemon off;"
```

**`index.html` — load config.js before the Angular bundle:**
```html
<head>
  <!-- Load runtime config before Angular boots so window.__env is populated -->
  <script src="config.js"></script>
  ...
</head>
```

**Angular `environment.ts` — read from `window.__env` at runtime:**
```typescript
// src/environments/environment.ts
declare const window: Window & { __env?: Record<string, string> };

const env = window.__env ?? {};

export const environment = {
  production: false,
  apiBaseUrl: env['apiBaseUrl'] ?? 'http://localhost:3000/api',
  auth0: {
    domain:    env['auth0Domain']   ?? 'YOUR_AUTH0_DOMAIN',
    clientId:  env['auth0ClientId'] ?? 'YOUR_AUTH0_CLIENT_ID',
    authorizationParams: {
      redirect_uri: window.location.origin + '/callback',
      audience: env['auth0Audience'] ?? 'YOUR_AUTH0_AUDIENCE',
    },
  },
};
```

```typescript
// src/environments/environment.prod.ts
// Production and staging both use the same runtime-injection approach.
// This file is identical to environment.ts — no values are hardcoded here.
export { environment } from './environment';
```

> **Local development:** Run `npm start` as normal. The `window.__env` object will be
> undefined and the fallback values in `environment.ts` will be used.

---

### Helm Chart Values (Overrides)

The architecture scaffold generates the Helm chart automatically from the service
definition. Provide these overrides in the generated values files to correctly configure
the frontend service.

**`helm/job-search-web/values-staging.yaml` overrides:**
```yaml
# Staging runs 1 replica — saves resources while still exercising the full pipeline
replicaCount: 1

ingress:
  enabled: true
  host: job-search-web.<STAGING_DOMAIN>

# Non-sensitive runtime config — injected into the container as environment variables.
# The entrypoint.sh script writes these into config.js at startup.
# Auth0 domain and clientId are NOT sensitive (they are public values in the JS bundle).
env:
  API_BASE_URL: "http://job-search-api.<STAGING_DOMAIN>/api"
  AUTH0_DOMAIN: "<AUTH0_STAGING_DOMAIN>"
  AUTH0_CLIENT_ID: "<AUTH0_STAGING_CLIENT_ID>"
  AUTH0_AUDIENCE: "<AUTH0_STAGING_AUDIENCE>"

autoscaling:
  enabled: false

resources:
  requests:
    cpu: "50m"
    memory: "32Mi"
  limits:
    cpu: "200m"
    memory: "128Mi"
```

**`helm/job-search-web/values-production.yaml` overrides:**
```yaml
replicaCount: 3

ingress:
  enabled: true
  host: job-search-web.<PRODUCTION_DOMAIN>

env:
  API_BASE_URL: "http://job-search-api.<PRODUCTION_DOMAIN>/api"
  AUTH0_DOMAIN: "<AUTH0_PRODUCTION_DOMAIN>"
  AUTH0_CLIENT_ID: "<AUTH0_PRODUCTION_CLIENT_ID>"
  AUTH0_AUDIENCE: "<AUTH0_PRODUCTION_AUDIENCE>"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 6
  targetCPUUtilizationPercentage: 70

resources:
  requests:
    cpu: "100m"
    memory: "64Mi"
  limits:
    cpu: "300m"
    memory: "256Mi"
```

---

### Sealed Secrets

The frontend service does not require encrypted secrets. Auth0 configuration values are
public (they are embedded in the JavaScript bundle on every user's browser) and are
handled via ConfigMap through the `env:` values block above.

The architecture scaffold will generate a `helm/job-search-web/templates/sealedsecret.yaml`
automatically. Leave it with only the placeholder comment and no `encryptedData` entries:

```yaml
# No application secrets are required for this service.
# Auth0 domain, clientId, and audience are non-sensitive public values
# and are injected via ConfigMap (the env: block in values files).
# If a future requirement adds a sensitive value (e.g. an internal API key),
# follow the instructions in sealed-secrets/README.md to seal it.
spec:
  encryptedData: {}
```

---

### CI/CD Workflow Files

The architecture scaffold generates the three caller workflow files automatically when the
service definition is added to the project config. No manual workflow authoring is needed.
The generated files will be:

```
.github/workflows/
  job-search-web-ci.yml          # Triggered on push to feature/** touching this service
  job-search-web-staging.yml     # Triggered on push to develop touching this service
  job-search-web-production.yml  # Triggered on semver tag push
```

**Path filters** watch both `services/job-search-web/**` and `helm/job-search-web/**`,
so a CI run is only triggered when this service's files actually change.

**Branch and tag strategy** (defined by the architecture document, summarised here):

| Git Event | What Happens |
|---|---|
| Push to `feature/**` | Angular build is compiled and tested — no image push |
| Push to `develop` | Build → push `develop-<SHA>` image to GHCR → deploy to `staging` namespace |
| Push of `v*.*.*` tag | Build → push `<TAG>` + `latest` → manual approval gate → deploy to `production` namespace |

**To deploy to staging:** merge or push to the `develop` branch.
**To deploy to production:** create and push a semver tag, then approve the GitHub
Environment gate in the Actions UI.

---

### .dockerignore

```
# services/job-search-web/.dockerignore
.git
.github
node_modules
dist
coverage
.env
.env.*
*.md
*.test.*
*.spec.*
e2e/
.nx/cache
```

---

## Nx Project Structure

```
apps/
  job-search-web/
    src/
      app/
        core/
          auth/
            auth.guard.ts              # Protects all routes except /callback
            auth.interceptor.ts        # Attaches Auth0 Bearer JWT to all HttpClient requests
          services/
            chat.service.ts            # SSE streaming, message state, skill routing
            document.service.ts        # Upload, list, delete career documents
            resume-packet.service.ts   # Generate and retrieve resume packets
            job-monitor.service.ts     # Add and list monitored job sites
          models/
            message.model.ts
            document.model.ts
            resume-packet.model.ts
            job-site.model.ts
            job-listing.model.ts
        features/
          auth/
            callback/
              callback.component.ts    # Handles Auth0 post-login redirect
          chat/
            chat-shell/
              chat-shell.component.ts  # Full-page layout: nav + sidebar + chat area
            chat-window/
              chat-window.component.ts # Scrollable list of MessageBubbleComponents
            message-bubble/
              message-bubble.component.ts  # Single message; supports inline attachments
            chat-input/
              chat-input.component.ts  # Textarea, file attach button, attachment preview strip
            skill-chips/
              skill-chips.component.ts # Shortcut prompt chips rendered above the input bar
          documents/
            document-panel/
              document-panel.component.ts  # Sidebar panel: view/delete previously uploaded docs
        shared/
          components/
            loading-indicator/
              loading-indicator.component.ts
            error-banner/
              error-banner.component.ts
            confirm-dialog/
              confirm-dialog.component.ts
          pipes/
            file-size.pipe.ts          # Converts bytes to human-readable string
            time-ago.pipe.ts           # Relative timestamps
          directives/
            auto-scroll.directive.ts   # Keeps chat scrolled to the bottom on new messages
        app.config.ts
        app.routes.ts
        app.component.ts
      environments/
        environment.ts                 # Reads from window.__env at runtime (see DevOps section)
        environment.prod.ts
      styles/
        _theme.scss
        _variables.scss
        styles.scss

libs/
  shared/
    data-access/
      src/
        lib/
          chat.types.ts
          document.types.ts
          resume-packet.types.ts
          job-site.types.ts
          job-listing.types.ts

services/
  job-search-web/                      # Dockerfile context root — watched by CI path filters
    Dockerfile
    nginx.conf
    entrypoint.sh
    .dockerignore
```

---

## app.config.ts

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAuth0 } from '@auth0/auth0-angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideAuth0(environment.auth0),
  ],
};
```

---

## app.routes.ts

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'callback',
    loadComponent: () =>
      import('./features/auth/callback/callback.component')
        .then(m => m.CallbackComponent),
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chat/chat-shell/chat-shell.component')
        .then(m => m.ChatShellComponent),
  },
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'chat',
  },
];
```

---

## Data Models

```typescript
// message.model.ts
export type MessageRole = 'user' | 'assistant';
export type ChatSkill = 'resume-review' | 'generate-packet' | 'monitor-job-site' | 'query-packets' | 'apply-for-job';

export interface MessageAttachment {
  documentId: string;   // returned by backend after upload
  filename: string;
  sizeBytes: number;
  contentType: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  attachments?: MessageAttachment[];  // files sent with this message
  skillType?: ChatSkill;              // set when the message triggered a specific skill
}
```

```typescript
// document.model.ts
export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface CareerDocument {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  status: DocumentStatus;
}
```

```typescript
// resume-packet.model.ts
export interface ResumePacket {
  id: string;
  targetWebsite: string;
  targetJobTitle: string;
  createdAt: Date;
  downloadUrl: string;  // backend-served download endpoint
}
```

```typescript
// job-site.model.ts
export interface JobSite {
  id: string;
  url: string;
  label: string;
  addedAt: Date;
  lastCheckedAt?: Date;
  newJobsCount: number;
}
```

```typescript
// job-listing.model.ts
// Represents an individual job posting discovered on a monitored site.
// Populated by the backend job monitoring service when it scans registered URLs.
export type JobListingStatus = 'new' | 'viewed' | 'applied' | 'archived';

export interface JobListing {
  id: string;
  jobSiteId: string;         // FK to the JobSite that found this listing
  jobSiteLabel: string;      // Denormalised for display convenience
  title: string;
  company: string;
  postingUrl: string;
  description: string;       // Full job description text — passed to Claude for analysis
  discoveredAt: Date;
  status: JobListingStatus;
}
```

---

## Feature 0 — User Authentication

### Goal
Protect the entire application behind Auth0. Users must be authenticated before accessing the chat.

### auth.guard.ts
```typescript
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  return auth.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) return true;
      auth.loginWithRedirect();
      return false;
    }),
  );
};
```

### auth.interceptor.ts
```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, take } from 'rxjs/operators';
import { from } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return from(auth.getAccessTokenSilently()).pipe(
    take(1),
    switchMap(token => {
      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(cloned);
    }),
  );
};
```

### CallbackComponent
- A minimal "Signing you in..." full-screen loading state displayed at `/callback`
- No logic needed in the component body; the Auth0 SDK handles the token exchange automatically on mount
- After the exchange completes the SDK automatically redirects to `/chat`

### Top Navigation Bar
- Display the logged-in user's name and avatar sourced from `AuthService.user$`
- A **Log Out** `MatButton` calls `AuthService.logout({ logoutParams: { returnTo: window.location.origin } })`
- A **Documents** toggle `MatIconButton` opens and closes the `MatSidenav` document panel

---

## Feature 1 — Chatbot UI

### Goal
A full-screen, streaming chat interface. Claude responses arrive token by token via SSE and are rendered live as the tokens arrive.

### Chat State (chat.service.ts)

```typescript
@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl;

  // Public signals consumed by components
  readonly messages = signal<Message[]>([]);
  readonly isStreaming = signal<boolean>(false);
  readonly streamingContent = signal<string>('');
  readonly error = signal<string | null>(null);

  private conversationId = signal<string | null>(null);
  private eventSource: EventSource | null = null;

  sendMessage(text: string, attachments: MessageAttachment[] = []): void {
    if (this.isStreaming()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachments: attachments.length ? attachments : undefined,
    };

    this.messages.update(msgs => [...msgs, userMessage]);
    this.isStreaming.set(true);
    this.streamingContent.set('');
    this.error.set(null);

    this.http.post<{ sessionId: string; conversationId: string }>(
      `${this.apiBase}/chat/message`,
      {
        text,
        conversationId: this.conversationId(),
        attachmentIds: attachments.map(a => a.documentId),
      }
    ).subscribe({
      next: ({ sessionId, conversationId }) => {
        this.conversationId.set(conversationId);
        this.openStream(sessionId);
      },
      error: () => {
        this.isStreaming.set(false);
        this.error.set('Failed to send message. Please try again.');
      },
    });
  }

  private openStream(sessionId: string): void {
    this.closeStream();
    this.eventSource = new EventSource(`${this.apiBase}/chat/stream/${sessionId}`);

    this.eventSource.addEventListener('token', (event: MessageEvent) => {
      this.streamingContent.update(c => c + event.data);
    });

    this.eventSource.addEventListener('done', () => {
      this.messages.update(msgs => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: this.streamingContent(),
          timestamp: new Date(),
        },
      ]);
      this.streamingContent.set('');
      this.isStreaming.set(false);
      this.closeStream();
    });

    this.eventSource.addEventListener('error', () => {
      this.isStreaming.set(false);
      this.error.set('Connection lost. Please try again.');
      this.closeStream();
    });
  }

  private closeStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
```

### ChatShellComponent Layout

Use CSS Grid for a three-region layout:

```
+--------------------------------------------------+
|              Top Navigation Bar                  |
+----------------+---------------------------------+
|                |                                 |
|  Document      |       Chat Window               |
|  Panel         |  (scrollable message list)      |
|  (MatSidenav)  |                                 |
|                +---------------------------------+
|                |  Skill Chips                    |
|                +---------------------------------+
|                |       Chat Input Bar            |
+----------------+---------------------------------+
```

- The document panel is a `MatSidenav` with `mode="side"` on desktop
- On screens narrower than 768 px the sidenav switches to `mode="over"`
- The chat area uses `flex-direction: column`; the window grows to fill available space and the input is pinned to the bottom

### ChatWindowComponent

- Uses `autoScroll` directive on the scrollable container
- Renders `@for (message of chatService.messages(); track message.id)` with `MessageBubbleComponent`
- When `chatService.isStreaming()` is true, renders one additional assistant bubble with `content=chatService.streamingContent()` and `[isStreaming]="true"` to show the live token stream
- Container uses `role="log"` and `aria-live="polite"` for screen reader support

### AutoScrollDirective

```typescript
@Directive({ selector: '[autoScroll]', standalone: true })
export class AutoScrollDirective implements AfterViewChecked {
  private el = inject(ElementRef);
  private userScrolledUp = false;

  @HostListener('scroll')
  onScroll(): void {
    const el = this.el.nativeElement;
    this.userScrolledUp = el.scrollTop < el.scrollHeight - el.clientHeight - 100;
  }

  ngAfterViewChecked(): void {
    if (!this.userScrolledUp) {
      this.el.nativeElement.scrollTop = this.el.nativeElement.scrollHeight;
    }
  }
}
```

### MessageBubbleComponent

Inputs:
- `message: Message`
- `isStreaming?: boolean = false`

Behavior:
- **User bubbles**: right-aligned; primary theme color background
  - If `message.attachments` is present, render attachment cards above the message text
- **Assistant bubbles**: left-aligned; surface color background
  - Render `message.content` through `<markdown>` from `ngx-markdown`
  - When `isStreaming` is true, append a blinking cursor `|` via CSS animation after the content
- Use `ChangeDetectionStrategy.OnPush`

### ChatInputComponent

```typescript
protected pendingText = signal<string>('');
protected pendingAttachments = signal<PendingAttachment[]>([]);
protected isUploading = signal<boolean>(false);
```

Where `PendingAttachment` is:
```typescript
interface PendingAttachment {
  file: File;
  status: 'uploading' | 'ready' | 'error';
  progress: number;        // 0–100
  result?: MessageAttachment;  // populated on success
}
```

Layout:
```
+-------------------------------------------------------+
| [📄 resume.pdf  1.2MB  ✕]  [📄 cover.docx  ✕]        |  ← attachment strip
+-------------------------------------------------------+
| 📎  [ textarea .................................. ] [➤] |  ← input row
+-------------------------------------------------------+
```

Behavior:
- Textarea uses `cdkTextareaAutosize` (from `@angular/cdk/text-field`), min 1 row, max 4 rows
- **Enter** submits; **Shift+Enter** inserts a newline
- Submit button and textarea are disabled while `chatService.isStreaming()` or `isUploading()` is true
- Paperclip button triggers a hidden `<input type="file" multiple accept=".pdf,.docx,.txt">` via `ElementRef`
- On file selection, each file is **immediately uploaded** via `DocumentService.uploadFile()` — do not wait for the user to hit send
  - Show `MatProgressBar` inside the attachment chip during upload
  - On success, set `status: 'ready'` and store the `MessageAttachment` result
  - On failure, set `status: 'error'` and show a retry icon on the chip
- `isUploading` is true if any attachment is still in `uploading` status
- On submit: call `chatService.sendMessage(pendingText(), readyAttachments)`, then clear both signals
- After submit, return focus to the textarea

### SkillChipsComponent

Render a horizontal scrollable row of `mat-chip` elements above the input bar. Hidden while `chatService.isStreaming()` is true.

| Chip | Injected Prompt |
|---|---|
| 📄 Review My Resume | `"Please review my uploaded resume and career documents, suggest improvements, and ask me questions to help identify skills I may be overlooking."` |
| 📦 Generate Resume Packet | `"I'd like to create a tailored resume packet. Please ask me for the target website or job posting URL."` |
| 🔔 Monitor a Job Site | `"I'd like to add a job site for you to monitor. Please ask me for the URL."` |
| 📋 My Saved Packets | `"Please show me all of my saved resume packets."` |
| 🚀 Apply for a Job | `"I'd like help applying for one of my saved jobs. Please show me the available listings."` |

Clicking a chip sets `pendingText` in `ChatInputComponent` and immediately submits the message.

---

## Feature 2 — Inline File Upload

### Goal
File uploads are part of the chat flow. Files attach in the input bar, upload immediately,
and travel with the message when sent.

### DocumentService

```typescript
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl;

  // Incrementing signal — components use effect() to react to changes
  readonly refreshTrigger = signal<number>(0);

  uploadFile(file: File): Observable<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<MessageAttachment>(
      `${this.apiBase}/documents/upload`,
      formData
    ).pipe(
      tap(() => this.refreshTrigger.update(n => n + 1))
    );
  }

  getDocuments(): Observable<CareerDocument[]> {
    return this.http.get<CareerDocument[]>(`${this.apiBase}/documents`);
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/documents/${id}`).pipe(
      tap(() => this.refreshTrigger.update(n => n + 1))
    );
  }
}
```

### Client-Side File Validation (enforced before upload begins)
- Accepted types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`
- Maximum size: **10 MB**
- On failure: show `MatSnackBar` toast; do not begin upload

### Attachment Chip (in ChatInputComponent)
```
[ 📄  resume_2024.pdf  1.2 MB  ✕ ]
```
- File type icon based on `contentType`
- Filename truncated with ellipsis if longer than 24 characters
- Size rendered via `FileSizePipe`
- **✕** removes the attachment from `pendingAttachments` (does not delete from the server)
- While uploading: show `MatProgressBar` replacing the file icon
- On error: show red warning icon and a retry button

### Attachment Card in MessageBubble (display only)
```
+--------------------------------+
| 📄  resume_2024.pdf            |
|     PDF · 1.2 MB               |
+--------------------------------+
```
Rendered above message text inside user bubbles when `message.attachments` is present.

### Backend API Contract
```
POST /api/documents/upload
  Content-Type: multipart/form-data
  Body: file (binary)
  Response 201: { documentId, filename, sizeBytes, contentType }

GET  /api/documents
  Response 200: CareerDocument[]

DELETE /api/documents/:id
  Response 204: (empty)
```

---

## Feature 3 — Resume Review Conversation (AI Skill)

### Goal
Claude reviews uploaded career documents, suggests improvements, and asks targeted
follow-up questions to surface skills the user has but may not think to mention.

### Trigger
User clicks the **"📄 Review My Resume"** chip or types a similar request.

### Expected Conversation Flow
The backend system prompt for this skill instructs Claude to:

1. **Acknowledge and parse** all documents associated with the conversation
2. **Provide structured Markdown feedback** covering:
   - Formatting and visual clarity
   - Accomplishments (prefer metrics over duties)
   - Missing sections (summary, skills, certifications)
   - ATS keyword gaps
3. **Ask one focused question at a time** to surface hidden skills, for example:
   - *"You listed project management — have you earned any certifications, even informally?"*
   - *"I noticed a customer-facing role — did you ever train newer staff or handle escalations?"*
4. **Maintain a running skills list** as the user answers
5. **Summarize newly identified skills** and ask if the user wants to update their documents

### Frontend Responsibilities
- No special logic beyond the standard chat flow
- Set `skillType: 'resume-review'` on the triggering user message
- `MessageBubbleComponent` Markdown renderer handles all structured output

---

## Feature 4 — Generate Resume Packet (AI Skill)

### Goal
Generate a tailored cover letter and adapted resume targeting a specific job posting or company.

### Trigger
User clicks **"📦 Generate Resume Packet"** chip.

### Conversation Flow
1. Claude: *"What is the URL of the job posting or company you're targeting?"*
2. User provides URL
3. Claude: *"What job title are you applying for?"*
4. User confirms
5. Backend generates and saves the packet
6. Claude replies with a Markdown download link:
   `[Download Your Resume Packet](/api/resume-packets/{id}/download)`

### ResumePacketService

```typescript
@Injectable({ providedIn: 'root' })
export class ResumePacketService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl;

  getPackets(): Observable<ResumePacket[]> {
    return this.http.get<ResumePacket[]>(`${this.apiBase}/resume-packets`);
  }
}
```

### Frontend Responsibilities
- Entirely conversational — no dedicated UI required
- The Markdown renderer in `MessageBubbleComponent` renders the download link automatically
- Set `skillType: 'generate-packet'` on the triggering user message

---

## Feature 5 — Monitor a Job Site (AI Skill)

### Goal
Register a job search URL for the backend to monitor for new matching postings.

### Trigger
User clicks **"🔔 Monitor a Job Site"** chip.

### Conversation Flow
1. Claude: *"Please share the URL of the job site or search results page you'd like me to monitor."*
2. User provides URL
3. Claude: *"Would you like to give this a label? (e.g. 'LinkedIn Angular Jobs')"*
4. Claude confirms: *"Got it! I'll monitor [label] and let you know when something relevant appears."*

### JobMonitorService

```typescript
@Injectable({ providedIn: 'root' })
export class JobMonitorService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl;

  getMonitoredSites(): Observable<JobSite[]> {
    return this.http.get<JobSite[]>(`${this.apiBase}/job-sites`);
  }

  /** Returns all individual job listings discovered across all monitored sites. */
  getJobListings(): Observable<JobListing[]> {
    return this.http.get<JobListing[]>(`${this.apiBase}/job-listings`);
  }

  /** Returns listings for a single monitored site. */
  getListingsBySite(jobSiteId: string): Observable<JobListing[]> {
    return this.http.get<JobListing[]>(`${this.apiBase}/job-listings?siteId=${jobSiteId}`);
  }

  /** Marks a listing's status — called after Claude confirms the user is applying. */
  updateListingStatus(listingId: string, status: JobListingStatus): Observable<JobListing> {
    return this.http.patch<JobListing>(
      `${this.apiBase}/job-listings/${listingId}/status`,
      { status }
    );
  }
}
```

### Frontend Responsibilities
- Entirely conversational — no dedicated UI required
- Set `skillType: 'monitor-job-site'` on the triggering user message

---

## Feature 7 — Apply for a Saved Job (AI Skill)

### Goal
The user can ask Claude to help them apply for any job listing discovered through their
monitored job sites. Claude presents the available listings, lets the user pick one,
analyses their fit against the job description, and guides them through the application
process using their uploaded career documents.

### Prerequisite — Backend Extension Required

> **This feature requires additions to the job monitoring backend service.** The existing
> job monitoring service tracks job *sites* (Feature 5). It must be extended to also
> store the individual *job listings* it discovers on those sites. The frontend cannot
> implement this feature until the following backend API endpoints exist:
>
> ```
> GET  /api/job-listings
>   Query params: siteId? (optional filter)
>   Response 200: JobListing[]
>
> GET  /api/job-listings/:id
>   Response 200: JobListing  (includes full description text)
>
> PATCH /api/job-listings/:id/status
>   Body: { status: 'new' | 'viewed' | 'applied' | 'archived' }
>   Response 200: JobListing
> ```
>
> The `description` field on `JobListing` must contain the full job posting text.
> Claude uses this to compare against the user's resume and generate application materials.

### Trigger
User clicks **"🚀 Apply for a Job"** chip or asks a related question.

### Conversation Flow

**Step 1 — Claude fetches and presents saved listings:**

The backend retrieves all listings and Claude formats them in a scannable Markdown list:

```markdown
Here are your saved job listings. Which one would you like to apply for?

**1. Senior Angular Developer — Google**
   📍 Remote · Found on: LinkedIn Angular Jobs · Status: New
   [View Posting](https://linkedin.com/jobs/...)

**2. Frontend Engineer — Stripe**
   📍 San Francisco, CA · Found on: Stripe Careers · Status: New
   [View Posting](https://stripe.com/jobs/...)

**3. UI Engineer — Vercel**
   📍 Remote · Found on: Vercel Careers · Status: Viewed
   [View Posting](https://vercel.com/careers/...)
```

**Step 2 — User selects a job (by number or name)**

**Step 3 — Claude performs a fit analysis:**

Claude compares the job description against the user's uploaded documents and responds
with a structured Markdown assessment:

```markdown
### Fit Analysis: Senior Angular Developer — Google

**Strong Matches ✅**
- 5+ years Angular experience aligns with the requirement
- RxJS and NgRx listed in both the role and your resume
- Experience with large-scale SPAs matches the team description

**Gaps to Address ⚠️**
- The role asks for GraphQL experience — not mentioned in your resume
- Google's JD emphasises Web Performance optimization — consider adding your Lighthouse work

**Suggested Resume Tweaks**
- Add a bullet under your current role: "Reduced bundle size by 40% using lazy loading and tree shaking"
- Move Angular Material to a more prominent position in your Skills section
```

**Step 4 — Claude asks how to proceed:**

*"Would you like me to:*
*A) Generate a tailored resume packet for this role*
*B) Draft a cover letter*
*C) Do both*
*D) Walk through the application form together"*

**Step 5 — Based on user choice:**
- **A or C:** Triggers the resume packet generation flow (Feature 4) pre-filled with this job's URL and title. No duplicate code — `ChatService.sendMessage()` is called with a prompt that kicks off the Feature 4 skill.
- **B:** Claude drafts a cover letter in the chat using Markdown. The user can copy it from the message bubble.
- **D:** Claude asks the user to share the application form URL or paste the form questions, then helps draft answers one section at a time.

**Step 6 — Mark as applied:**

After completing any application path, Claude asks: *"Have you submitted your application?"*
If the user confirms, the frontend calls `JobMonitorService.updateListingStatus(id, 'applied')`.
Claude then replies: *"Great! I've marked this job as applied. Good luck! 🤞"*

### Frontend Responsibilities

- Set `skillType: 'apply-for-job'` on the triggering user message
- The entire flow is conversational — no dedicated UI component required
- The fit analysis, cover letter, and application guidance are all rendered by the existing `MessageBubbleComponent` Markdown renderer
- The `updateListingStatus()` call is the only non-chat API call triggered by this skill; make it from `ChatService` after detecting the confirmation pattern, or expose a method the component can call directly after the user confirms

### Backend API Contract

```
GET  /api/job-listings
  Response 200: JobListing[]

GET  /api/job-listings/:id
  Response 200: JobListing  (must include full description field)

PATCH /api/job-listings/:id/status
  Body: { status: JobListingStatus }
  Response 200: JobListing
```

---

## Feature 6 — Query Saved Resume Packets (AI Skill)

### Goal
Allow the user to retrieve and view all previously generated resume packets through the chat.

### Trigger
User clicks **"📋 My Saved Packets"** chip.

### Conversation Flow
Claude responds in Markdown with a formatted table:

```markdown
Here are your saved resume packets:

| # | Target | Job Title | Created | Download |
|---|--------|-----------|---------|----------|
| 1 | google.com | Senior Angular Developer | Jan 15 2025 | [Download](/api/resume-packets/abc/download) |
| 2 | stripe.com | Frontend Engineer | Feb 2 2025 | [Download](/api/resume-packets/def/download) |
```

Claude follows up: *"Would you like to generate a new packet or update one of these?"*

### Frontend Responsibilities
- Entirely conversational — no dedicated UI required
- `ngx-markdown` renders the table and download links automatically
- Set `skillType: 'query-packets'` on the triggering user message

---

## Document Panel (Secondary UI)

The `MatSidenav` panel accessed via the nav bar Documents toggle. This is a reference
view — not the primary upload path.

### DocumentPanelComponent
- Calls `DocumentService.getDocuments()` on open and whenever `DocumentService.refreshTrigger` changes (use `effect()`)
- Renders each document as a `mat-list-item`:
  - File type icon
  - Filename + upload date via `TimeAgoPipe`
  - Status chip: `processing` (amber), `ready` (green), `error` (red) — always paired with text label
  - Delete `MatIconButton` → opens `ConfirmDialogComponent` → calls `DocumentService.deleteDocument()`
- Skeleton placeholder rows (`MatProgressBar`) while loading
- Empty state: *"No documents yet. Attach files directly in the chat to upload them."*

---

## Shared Utilities

### FileSizePipe
```typescript
@Pipe({ name: 'fileSize', standalone: true })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
}
```

### TimeAgoPipe
Convert a `Date` to a relative string: `"just now"`, `"5 minutes ago"`, `"2 days ago"`.
Implement with pure arithmetic — no external library required.

### ConfirmDialogComponent
Reusable `MatDialog` accepting `title: string` and `message: string` as `@Input()`.
Returns `true` on confirm, `false` on cancel.

### ErrorBannerComponent
Reads `ChatService.error()`. When non-null, displays a dismissible error bar at the top
of the chat area. Dismissing calls `ChatService.error.set(null)`.

---

## Angular Material Theme

```scss
// styles/_theme.scss
@use '@angular/material' as mat;

$primary: mat.define-palette(mat.$indigo-palette, 700);
$accent:  mat.define-palette(mat.$cyan-palette, A400);
$warn:    mat.define-palette(mat.$red-palette);

$theme: mat.define-light-theme((
  color: (primary: $primary, accent: $accent, warn: $warn),
  typography: mat.define-typography-config(),
  density: 0,
));

@include mat.all-component-themes($theme);

@media (prefers-color-scheme: dark) {
  $dark-theme: mat.define-dark-theme((
    color: (primary: $primary, accent: $accent, warn: $warn),
  ));
  @include mat.all-component-colors($dark-theme);
}
```

---

## Error Handling Strategy

| Scenario | Behavior |
|---|---|
| Network error on `sendMessage` | Show `ErrorBannerComponent`; user can retry |
| SSE connection drops mid-stream | Set `isStreaming` false; show error banner |
| File upload fails | Show error state on attachment chip with retry option |
| File too large or wrong type | `MatSnackBar` toast before upload begins |
| Auth token expired | `AuthInterceptor` calls `getAccessTokenSilently()`; SDK handles silently |
| 401 from API | Redirect to Auth0 login |
| Missing `window.__env` at runtime | Fall back to hardcoded dev values in `environment.ts` |

---

## Accessibility Requirements

- All `MatIconButton` elements must have descriptive `aria-label` attributes
- `ChatWindowComponent` container must have `role="log"` and `aria-live="polite"`
- Focus returns to the textarea after every message submission
- Attachment chips must be keyboard-navigable; `Delete` or `Backspace` removes the focused chip
- Color is never the sole indicator of state — always pair with icon or text

---

## Performance Guidelines

- All feature routes lazy-loaded (see `app.routes.ts`)
- `messages` signal is only appended to, never replaced wholesale
- `MessageBubbleComponent` uses `ChangeDetectionStrategy.OnPush`
- `AutoScrollDirective` short-circuits when the user has manually scrolled up
- `ngx-markdown` is loaded asynchronously

---

## Implementation Order

Build in this sequence to enable incremental testing at each step:

1. **Nx app scaffolding** — generate app, configure router, set up Material theme
2. **`services/job-search-web/` scaffold** — Dockerfile, nginx.conf, entrypoint.sh, .dockerignore
3. **Auth0 integration** — guard, interceptor, callback route, nav bar with user avatar
4. **Runtime config** — add `config.js` script tag to `index.html`, update `environment.ts` to read `window.__env`
5. **Chat shell layout** — empty shell with nav bar and sidenav toggle
6. **Chat service and SSE streaming** — signals wired to EventSource
7. **MessageBubbleComponent** — static messages first, then streaming, then Markdown
8. **ChatInputComponent** — textarea, send behavior, keyboard shortcuts
9. **SkillChipsComponent** — chip row with injected prompts (all 5 chips including Apply for a Job)
10. **Inline file upload** — attach button, immediate upload, attachment chip strip
11. **DocumentPanelComponent** — sidebar list, delete with confirm dialog
12. **Skill conversations (Features 3–6)** — resume review, packet generation, job monitoring, packet query
13. **Feature 7 — Apply for a Job** — requires backend `/api/job-listings` endpoints to be live first; implement fit analysis flow, cover letter path, and `updateListingStatus()` call
14. **Helm values** — fill in `values-staging.yaml` and `values-production.yaml` with correct env vars
15. **Polish** — empty states, error handling, accessibility audit, dark mode verification