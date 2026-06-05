# job-search-web local setup

## Run the dev server

```bash
source /home/cstortz/repos/job_search_ai/.venv/bin/activate
cd /home/cstortz/repos/initial_build/services/job-search-web
DB_API_BASE_URL=http://localhost:8100 npm run dev
```

## Required Auth0 environment variables

Create `services/job-search-web/.env.local`:

```env
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=
APP_BASE_URL=http://dev01.int.stortz.tech:3000
DB_API_BASE_URL=http://localhost:8100
LLM_PROVIDER=mock
# For Claude
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-sonnet-4-6
# For OpenAI
# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4.1-mini
# For Gemini
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.5-flash
```

Generate `AUTH0_SECRET` with:

```bash
openssl rand -hex 32
```

## Auth0 dashboard configuration

- Application type: **Regular Web Application**
- Allowed Callback URLs: `http://dev01.int.stortz.tech:3000/auth/callback`
- Allowed Logout URLs: `http://dev01.int.stortz.tech:3000`
- Allowed Web Origins: `http://dev01.int.stortz.tech:3000`

## Test auth in browser

1. Open `http://dev01.int.stortz.tech:3000/auth/login`
2. Complete Auth0 login
3. Open `http://dev01.int.stortz.tech:3000/api/auth/session`
4. Verify `authenticated: true`

## Swagger endpoints

- Docs: `http://dev01.int.stortz.tech:3000/docs`
- OpenAPI: `http://dev01.int.stortz.tech:3000/openapi.json`

Protected routes in Swagger require an Auth0 `appSession` cookie.

## End-to-end auth + API smoke flow

Use the script below to run the auth/session + new jobs endpoints in order, carrying IDs from earlier responses:

```bash
cd /home/cstortz/repos/initial_build/services/job-search-web
bash scripts/smoke-auth-flow.sh
```

The script will prompt you to:

1. Login at `/auth/login`
2. Complete MFA
3. Paste the `appSession` cookie value

Then it runs:

- `/api/auth/session`
- `/api/auth/me`
- `/api/job-sites`
- `/api/job-listings` (+ filtered variants if data exists)
- `/api/job-listings/{id}`
- `/api/job-listings/{id}/status`
- `/api/resume-packets` (+ filtered variants)
- `/api/skills` (list + create + read + update + delete smoke CRUD)
- `/auth/logout`

Optional flags:

```bash
BASE_URL=http://localhost:3000 APP_SESSION='<cookie>' VERBOSE=1 bash scripts/smoke-auth-flow.sh
```

## LLM provider configuration

Set `LLM_PROVIDER` to one of:

- `mock` (default, no external API call)
- `anthropic` (or `claude`)
- `openai`
- `gemini` (or `google`)

When using a real provider, set the corresponding API key env var in `.env.local`.

## Localhost fallback (optional)

If you run this app locally instead of on `dev01`, use:

- `APP_BASE_URL=http://localhost:3000`
- Allowed Callback URLs: `http://localhost:3000/auth/callback`
- Allowed Logout URLs: `http://localhost:3000`
- Allowed Web Origins: `http://localhost:3000`

Local docs URLs:

- `http://localhost:3000/docs`
- `http://localhost:3000/openapi.json`
