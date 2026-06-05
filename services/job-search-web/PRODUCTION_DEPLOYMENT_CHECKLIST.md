# Production Deployment Checklist

Use this checklist when deploying `job-search-web` to a remote web server that calls backend APIs server-to-server.

## 1) Infrastructure and DNS

- [ ] Provision production host (VM/container platform) with outbound access to backend APIs.
- [ ] Set DNS record for app domain (example: `app.example.com`) to the web server.
- [ ] Ensure NTP/time sync is enabled on host.
- [ ] Restrict inbound ports to `80/443` only (and SSH admin path).

## 2) TLS / HTTPS

- [ ] Configure TLS certificate (LetsEncrypt or managed cert).
- [ ] Force HTTP -> HTTPS redirect.
- [ ] Verify app loads at `https://<your-domain>`.
- [ ] Confirm secure cookies are present in browser session after login.

## 3) Auth0 production configuration

- [ ] Set application type to **Regular Web Application**.
- [ ] Allowed Callback URLs: `https://<your-domain>/auth/callback`
- [ ] Allowed Logout URLs: `https://<your-domain>`
- [ ] Allowed Web Origins: `https://<your-domain>`
- [ ] Verify MFA policy and enrollment settings for production users.

## 4) Production environment variables

- [ ] Create production env file or secret set (never commit it).
- [ ] Set Auth0 variables:
  - [ ] `AUTH0_DOMAIN`
  - [ ] `AUTH0_CLIENT_ID`
  - [ ] `AUTH0_CLIENT_SECRET`
  - [ ] `AUTH0_SECRET` (strong random value)
- [ ] Set app/backend variables:
  - [ ] `APP_BASE_URL=https://<your-domain>`
  - [ ] `DB_API_BASE_URL=https://<backend-api-domain-or-private-url>`
  - [ ] `LLM_PROVIDER` (`anthropic` / `openai` / `gemini` / `mock`)
- [ ] Set provider-specific keys/models as needed:
  - [ ] `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
  - [ ] `OPENAI_API_KEY`, `OPENAI_MODEL`
  - [ ] `GEMINI_API_KEY`, `GEMINI_MODEL`
- [ ] Rotate any leaked/test keys before go-live.

## 5) Backend/API security posture

- [ ] Ensure backend APIs are reachable from web server.
- [ ] Prefer private networking or allowlist web server egress IPs.
- [ ] Disable public internet exposure for internal-only APIs where possible.
- [ ] Enforce auth/authorization checks in backend APIs independently (do not rely only on web tier).

## 6) Build and runtime setup

- [ ] Install Node runtime compatible with current Next.js version.
- [ ] Install dependencies: `npm ci`
- [ ] Build app: `npm run build`
- [ ] Start app: `npm run start` (behind process manager: `systemd`, `pm2`, container orchestrator).
- [ ] Configure automatic restart on failure.
- [ ] Configure startup on host reboot.

## 7) Reverse proxy (if used: Nginx/Caddy/ALB)

- [ ] Proxy `https://<your-domain>` to Next.js server port (example `localhost:3000`).
- [ ] Preserve `Host`, `X-Forwarded-*` headers.
- [ ] Enable gzip/brotli compression.
- [ ] Set reasonable request body limits for upload endpoints.
- [ ] Configure access and error logs with rotation.

## 8) Data + file handling

- [ ] Validate DB schema is current in production database.
- [ ] Confirm `job_search_ai` tables exist and user has required SQL permissions.
- [ ] Confirm upload storage path strategy for production (local disk vs object storage).
- [ ] Ensure backup/retention policy exists for database and uploaded artifacts.

## 9) Observability and ops

- [ ] Centralize logs (app + proxy + backend API logs).
- [ ] Add health monitor for `/api/health`.
- [ ] Add alerts for 5xx rate, auth failures, and latency spikes.
- [ ] Capture LLM provider errors and rate-limit responses in logs.
- [ ] Document incident response and on-call escalation path.

## 10) Security hardening before launch

- [ ] Confirm `.env.local` and secrets are gitignored.
- [ ] Run dependency audit (`npm audit`) and address critical issues.
- [ ] Add rate limiting on chat/auth-sensitive endpoints.
- [ ] Add request timeout + retry policy for LLM provider calls.
- [ ] Validate CORS and cookie settings are production-safe.
- [ ] Review least-privilege access for DB/API credentials.

## 11) End-to-end verification (go-live gate)

- [ ] Login flow works in production domain.
- [ ] MFA flow works in production.
- [ ] Authenticated endpoints return expected data:
  - [ ] `/api/job-sites`
  - [ ] `/api/job-listings`
  - [ ] `/api/job-listings/{id}`
  - [ ] `PATCH /api/job-listings/{id}/status`
  - [ ] `/api/resume-packets`
- [ ] Chat works with real LLM provider and stream endpoint.
- [ ] Logout clears session in browser and `/api/auth/session` returns unauthenticated.
- [ ] Run `scripts/smoke-auth-flow.sh` against production base URL.

## 12) Rollback plan

- [ ] Keep previous deploy artifact/version available.
- [ ] Document one-command rollback procedure.
- [ ] Confirm rollback includes env var compatibility notes.
- [ ] Verify database migration backward-compatibility assumptions.
