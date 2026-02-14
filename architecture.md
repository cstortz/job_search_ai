# AI IDE Prompt: Reusable Monorepo DevOps Scaffold
# GitHub Actions + Docker + Kubernetes (Self-Hosted, On-Premises)

---

## HOW TO USE THIS PROMPT

This prompt is a reusable template. Every time you start a new application or set of
services, fill in the `## Project Configuration` block below with your project-specific
values, then paste the entire prompt into your AI IDE. The AI will generate a complete,
consistent monorepo scaffold every time.

---

## Project Configuration
> Fill in this block before pasting into the AI IDE. Everything below this section
> stays the same for every project.

```yaml
project:
  name: "job-search-ai"               # e.g. "payments-platform"
  github_org: "cstortz"           # e.g. "acme-corp"
  github_repo: "job_search_ai"         # e.g. "payments-platform" (the monorepo repo name)

services:
  - name: "<SERVICE_1_NAME>"           # e.g. "API Gateway" — human-readable label for docs/comments
    filename: "<SERVICE_1_FILENAME>"   # e.g. "api-gateway" — used for all dirs, files, and workflow names
    port: <SERVICE_1_PORT>             # e.g. 8080
    language: "<SERVICE_1_LANG>"       # node | python | go | java | unknown
    health_check_path: "/healthz"      # override if different

  - name: "<SERVICE_2_NAME>"           # e.g. "User Service"
    filename: "<SERVICE_2_FILENAME>"   # e.g. "user-service"
    port: <SERVICE_2_PORT>
    language: "<SERVICE_2_LANG>"
    health_check_path: "/healthz"

  # Add more services as needed using the same structure above

environments:
  staging:
    namespace: "staging"
    ingress_domain: "<STAGING_DOMAIN>"       # e.g. "staging.acme.internal"
  production:
    namespace: "production"
    ingress_domain: "<PRODUCTION_DOMAIN>"    # e.g. "acme.internal"
```

---

## Role & Objective

You are a senior DevOps architect. Using the project configuration block above, scaffold
a complete, production-grade monorepo with CI/CD pipelines, Helm charts, and secrets
management for every service defined. Apply every specification below exactly as written.

Generate all files in full — do not truncate, abbreviate, or use placeholder comments
like `# add more here`. Every file must be complete and ready to use.

After generating all files, produce a `PLACEHOLDERS.md` at the repo root listing every
`<PLACEHOLDER>` value remaining in the generated output, what it represents, and an
example value. At minimum the table must include these entries:

| Placeholder | Description | Example Value |
|---|---|---|
| `<GITHUB_ORG>` | GitHub organisation or username | `acme-corp` |
| `<GITHUB_REPO>` | Name of the monorepo | `payments-platform` |
| `<SERVICE_NAME>` | Human-readable service label — used in descriptions and comments only | `API Gateway` |
| `<SERVICE_FILENAME>` | Filesystem slug — used for all directories, workflow file names, image names, and Helm release names | `api-gateway` |
| `<SERVICE_PORT>` | Port the service listens on inside the container | `8080` |
| `<STAGING_DOMAIN>` | Base ingress domain for staging | `staging.acme.internal` |
| `<PRODUCTION_DOMAIN>` | Base ingress domain for production | `acme.internal` |
| `<TLS_SECRET_NAME>` | Name of the Kubernetes TLS secret used by the ingress | `acme-tls` |
| `<HEALTH_CHECK_PATH>` | HTTP path for readiness and liveness probes | `/healthz` |

---

## Architecture Decisions (Do Not Deviate)

| Concern                  | Decision                                                              |
|--------------------------|-----------------------------------------------------------------------|
| Repo structure           | Monorepo — all services in one GitHub repository                      |
| CI/CD platform           | GitHub Actions — **self-hosted runner** (standalone VM, on-premises) |
| Container registry       | GitHub Container Registry (GHCR)                                      |
| Orchestration            | Kubernetes — self-hosted, on-premises, single cluster                 |
| Deployment strategy      | Rolling update                                                        |
| Namespace strategy       | Two namespaces on one cluster: `staging` and `production`             |
| Manifest tooling         | Helm 3 — one chart per service, all charts in the monorepo            |
| Workflow architecture    | Reusable workflows (`workflow_call`) — defined once, called per service |
| Secrets (in-cluster)     | Bitnami Sealed Secrets                                                |
| Secrets (CI-level)       | GitHub Actions Encrypted Secrets                                      |
| Image tagging            | `develop-<SHA>` for staging, semver tag for production                |
| Production gate          | GitHub Actions `environment` with required manual reviewer approval   |

---

## Branch-to-Environment Strategy

| Git Event                               | Pipeline Behaviour                                                  |
|-----------------------------------------|---------------------------------------------------------------------|
| Push to `feature/**` (any service path) | Test + build only — no image push, no deploy                        |
| Push to `develop` (any service path)    | Test → build → push `develop-<SHA>` image → deploy to `staging`     |
| Push of a semver tag `v*.*.*`           | Test → build → push `<TAG>` + `latest` images → manual approval gate → deploy to `production` |

Path filtering ensures a commit touching `services/<SERVICE_FILENAME>/**` only triggers the
`<SERVICE_FILENAME>` pipeline — not every service pipeline simultaneously.

---

## GitHub Actions Secrets to Configure

Instruct the developer to add the following secrets once to the monorepo under
**Settings → Secrets and Variables → Actions:**

| Secret Name               | Description                                                                  |
|---------------------------|------------------------------------------------------------------------------|
| `GHCR_TOKEN`              | GitHub Personal Access Token (classic) with `write:packages` scope           |
| `KUBECONFIG_STAGING`      | Base64-encoded kubeconfig scoped to the `staging` namespace ServiceAccount   |
| `KUBECONFIG_PRODUCTION`   | Base64-encoded kubeconfig scoped to the `production` namespace ServiceAccount |
| `SEALED_SECRETS_CERT`     | Public cert from the Sealed Secrets controller (for offline sealing)         |

> **Kubeconfig scoping rule:** Each kubeconfig must reference a Kubernetes ServiceAccount
> bound to a Role limited to `get`, `list`, `create`, `update`, `patch`, `delete` on
> `deployments`, `services`, `configmaps`, `ingresses`, and `pods` within its namespace
> only. Never use a cluster-admin kubeconfig in CI.

---

## Monorepo File Structure to Generate

Generate the following top-level structure. Repeat the `services/<SERVICE_FILENAME>/` and
`helm/<SERVICE_FILENAME>/` blocks for every service defined in the project configuration:

```
<GITHUB_REPO>/
├── .github/
│   └── workflows/
│       ├── _reusable-ci.yml                      # Reusable: test + build only
│       ├── _reusable-deploy-staging.yml          # Reusable: test + build + push + deploy staging
│       ├── _reusable-deploy-production.yml       # Reusable: test + build + push + deploy production
│       │
│       ├── <SERVICE_1_FILENAME>-ci.yml           # Caller: feature branch trigger for service 1
│       ├── <SERVICE_1_FILENAME>-staging.yml      # Caller: develop branch trigger for service 1
│       ├── <SERVICE_1_FILENAME>-production.yml   # Caller: tag trigger for service 1
│       │
│       └── ... (repeat caller trio for every additional service)
│
├── services/
│   ├── <SERVICE_1_FILENAME>/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── ... (one directory per service)
│
├── helm/
│   ├── <SERVICE_1_FILENAME>/
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   ├── values-staging.yaml
│   │   ├── values-production.yaml
│   │   └── templates/
│   │       ├── _helpers.tpl
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── ingress.yaml
│   │       ├── hpa.yaml
│   │       ├── serviceaccount.yaml
│   │       ├── configmap.yaml
│   │       └── sealedsecret.yaml
│   └── ... (one chart per service)
│
├── sealed-secrets/
│   └── README.md
│
├── PLACEHOLDERS.md
└── README.md
```

---

## Detailed Specifications

### 1. Reusable Workflow: `_reusable-ci.yml`

**Trigger:** `on: workflow_call`

**Inputs:**
- `service_filename` (string, required) — the `filename` value from project config
- `image_tag` (string, required)

**Secrets:**
- `GHCR_TOKEN` (required, inherited via caller)

**Jobs:**

**`test` job:**
- Checkout full repo (`actions/checkout`)
- `cd services/${{ inputs.service_filename }}`
- Detect language via a shell step checking for `package.json`, `requirements.txt`,
  `go.mod`, `pom.xml` — set step output `LANG`
- Run the appropriate test command based on `LANG`:
  - `node` → `npm ci && npm test`
  - `python` → `pip install -r requirements.txt && pytest`
  - `go` → `go test ./...`
  - `java` → `mvn test`
  - `unknown` → `echo "No test runner detected. Add tests and configure this step." && exit 0`

**`build` job** (needs: `test`):
- Checkout code
- Set up Docker Buildx (`docker/setup-buildx-action`)
- Log in to GHCR using `docker/login-action` with `GHCR_TOKEN` secret
- Build image — do **not** push
- Tag: `ghcr.io/<GITHUB_ORG>/${{ inputs.service_filename }}:${{ inputs.image_tag }}`
- Use GitHub Actions layer cache: `cache-from: type=gha` / `cache-to: type=gha,mode=max`

---

### 2. Reusable Workflow: `_reusable-deploy-staging.yml`

**Trigger:** `on: workflow_call`

**Inputs:**
- `service_filename` (string, required) — the `filename` value from project config

**Secrets:**
- `GHCR_TOKEN` (required)
- `KUBECONFIG_STAGING` (required)

**Jobs:**

**`test` job:** Identical to `_reusable-ci.yml` test job.

**`build-push` job** (needs: `test`):
- Checkout code
- Log in to GHCR
- Build and **push** image tagged `develop-${{ github.sha }}`
- Use layer cache

**`deploy-staging` job** (needs: `build-push`):
- Decode `KUBECONFIG_STAGING` from base64 and write to `${{ runner.temp }}/kubeconfig`
- Export `KUBECONFIG=${{ runner.temp }}/kubeconfig`
- Verify helm is available: `helm version || (echo "helm not found" && exit 1)`
- Run:
  ```bash
  helm upgrade --install ${{ inputs.service_filename }} ./helm/${{ inputs.service_filename }} \
    --namespace staging \
    --create-namespace \
    --values ./helm/${{ inputs.service_filename }}/values.yaml \
    --values ./helm/${{ inputs.service_filename }}/values-staging.yaml \
    --set image.tag=develop-${{ github.sha }} \
    --atomic \
    --timeout 5m
  ```
- **Mandatory cleanup step** using `if: always()`:
  ```bash
  rm -f ${{ runner.temp }}/kubeconfig
  ```

---

### 3. Reusable Workflow: `_reusable-deploy-production.yml`

**Trigger:** `on: workflow_call`

**Inputs:**
- `service_filename` (string, required) — the `filename` value from project config
- `image_tag` (string, required) — the caller passes `${{ github.ref_name }}`

**Secrets:**
- `GHCR_TOKEN` (required)
- `KUBECONFIG_PRODUCTION` (required)

**Jobs:**

**`test` job:** Identical pattern.

**`build-push` job** (needs: `test`):
- Build and push two tags: `${{ inputs.image_tag }}` and `latest`

**`deploy-production` job** (needs: `build-push`):
- Declare `environment: production` — this enforces the manual approval gate configured
  in the repo's GitHub Environments settings before the job runs
- Decode `KUBECONFIG_PRODUCTION`, write to temp path, export `KUBECONFIG` env var
- Run:
  ```bash
  helm upgrade --install ${{ inputs.service_filename }} ./helm/${{ inputs.service_filename }} \
    --namespace production \
    --create-namespace \
    --values ./helm/${{ inputs.service_filename }}/values.yaml \
    --values ./helm/${{ inputs.service_filename }}/values-production.yaml \
    --set image.tag=${{ inputs.image_tag }} \
    --atomic \
    --timeout 5m
  ```
- Mandatory cleanup with `if: always()`

---

### 4. Caller Workflows (one trio per service)

For each service defined in the project config, generate three thin caller workflows.
These files only define the trigger, path filter, and delegation to the reusable workflow.

#### `<SERVICE_FILENAME>-ci.yml`
```yaml
on:
  push:
    branches: ['feature/**']
    paths:
      - 'services/<SERVICE_FILENAME>/**'
      - 'helm/<SERVICE_FILENAME>/**'
jobs:
  ci:
    uses: ./.github/workflows/_reusable-ci.yml
    with:
      service_filename: <SERVICE_FILENAME>
      image_tag: pr-${{ github.sha }}
    secrets: inherit
```

#### `<SERVICE_FILENAME>-staging.yml`
```yaml
on:
  push:
    branches: ['develop']
    paths:
      - 'services/<SERVICE_FILENAME>/**'
      - 'helm/<SERVICE_FILENAME>/**'
jobs:
  staging:
    uses: ./.github/workflows/_reusable-deploy-staging.yml
    with:
      service_filename: <SERVICE_FILENAME>
    secrets: inherit
```

#### `<SERVICE_FILENAME>-production.yml`
```yaml
# NOTE: GitHub Actions tag triggers do not natively support paths filtering.
# The _reusable-deploy-production.yml workflow includes a paths-filter step
# using dorny/paths-filter to detect whether this service's directory changed
# since the previous tag. If no relevant changes are detected, all subsequent
# jobs are skipped automatically.
on:
  push:
    tags: ['v*.*.*']
jobs:
  production:
    uses: ./.github/workflows/_reusable-deploy-production.yml
    with:
      service_filename: <SERVICE_FILENAME>
      image_tag: ${{ github.ref_name }}
    secrets: inherit
```

> Inside `_reusable-deploy-production.yml`, add a `paths-filter` step at the start of
> the `test` job using `dorny/paths-filter@v3` to check if
> `services/<SERVICE_FILENAME>/**` or `helm/<SERVICE_FILENAME>/**` changed. Set a job output
> `should_run`. Gate all subsequent jobs with `if: needs.test.outputs.should_run == 'true'`.

---

### 5. Dockerfiles

For each service, generate a **multi-stage Dockerfile** in `services/<SERVICE_FILENAME>/`
using the `language` value from the project config to select the correct template.

**Node.js template:**
- Stage 1 (`builder`): `node:20-alpine` — copy `package*.json`, run `npm ci --omit=dev`, copy source, run build if `build` script exists
- Stage 2 (`runtime`): `node:20-alpine` — copy built output from builder, `addgroup` and `adduser appuser`, `USER appuser`

**Python template:**
- Stage 1 (`builder`): `python:3.12-slim` — create venv at `/opt/venv`, install from `requirements.txt`
- Stage 2 (`runtime`): `python:3.12-slim` — copy `/opt/venv` from builder, create non-root user `appuser`, `USER appuser`

**Go template:**
- Stage 1 (`builder`): `golang:1.22-alpine` — copy source, `CGO_ENABLED=0 go build -o /app ./...`
- Stage 2 (`runtime`): `gcr.io/distroless/static:nonroot` — copy binary only, no shell, minimal attack surface

**Java template:**
- Stage 1 (`builder`): `maven:3.9-eclipse-temurin-21-alpine` — run `mvn package -DskipTests`
- Stage 2 (`runtime`): `eclipse-temurin:21-jre-alpine` — copy jar, `addgroup` / `adduser appuser`, `USER appuser`

**Unknown language:**
- Generate the Node.js template with a prominent `# TODO` comment at the top

All Dockerfiles must:
- Accept `ARG APP_VERSION=dev` and expose it as `ENV APP_VERSION=$APP_VERSION`
- `EXPOSE <SERVICE_PORT>` using the port from project config
- Run as a non-root user
- Include a matching `.dockerignore` excluding: `.git`, `node_modules`, `__pycache__`,
  `*.pyc`, `*.md`, `.github`, `coverage/`, `dist/`, `.env`, `.env.*`, `*.test.*`,
  `*.spec.*`, `Dockerfile*`

---

### 6. Helm Charts

Generate one complete Helm chart per service under `helm/<SERVICE_FILENAME>/`.

#### `Chart.yaml`
```yaml
apiVersion: v2
name: <SERVICE_FILENAME>
description: Helm chart for <SERVICE_NAME>
version: 0.1.0
appVersion: "0.1.0"
```

#### `values.yaml`
```yaml
replicaCount: 2

image:
  repository: ghcr.io/<GITHUB_ORG>/<SERVICE_FILENAME>
  pullPolicy: IfNotPresent
  tag: "latest"

imagePullSecrets:
  - name: ghcr-pull-secret

serviceAccount:
  create: true
  name: ""

service:
  type: ClusterIP
  port: <SERVICE_PORT>

ingress:
  enabled: false
  className: "nginx"
  host: <SERVICE_HOSTNAME>
  tlsSecretName: <TLS_SECRET_NAME>

resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

# maxUnavailable: 0 ensures zero downtime — new pods must be Ready before old ones terminate
rollingUpdate:
  maxSurge: 1
  maxUnavailable: 0

readinessProbe:
  path: <HEALTH_CHECK_PATH>
  port: <SERVICE_PORT>
  initialDelaySeconds: 10
  periodSeconds: 5

livenessProbe:
  path: <HEALTH_CHECK_PATH>
  port: <SERVICE_PORT>
  initialDelaySeconds: 15
  periodSeconds: 10

# Non-sensitive environment variables only.
# These are injected via ConfigMap. For secrets, use SealedSecrets.
env: {}
  # LOG_LEVEL: "info"
```

#### `values-staging.yaml`
```yaml
replicaCount: 1

ingress:
  enabled: true
  host: <SERVICE_FILENAME>.<STAGING_DOMAIN>

autoscaling:
  enabled: false

resources:
  requests:
    cpu: "50m"
    memory: "64Mi"
  limits:
    cpu: "250m"
    memory: "256Mi"
```

#### `values-production.yaml`
```yaml
replicaCount: 3

ingress:
  enabled: true
  host: <SERVICE_FILENAME>.<PRODUCTION_DOMAIN>

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10

resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

#### `templates/_helpers.tpl`
Generate all standard Helm helper templates:
- `<CHART>.fullname` — truncated to 63 chars
- `<CHART>.name`
- `<CHART>.chart`
- `<CHART>.labels` — standard recommended labels including `helm.sh/chart`, `app.kubernetes.io/name`, `app.kubernetes.io/instance`, `app.kubernetes.io/version`, `app.kubernetes.io/managed-by`
- `<CHART>.selectorLabels` — `app.kubernetes.io/name` and `app.kubernetes.io/instance` only
- `<CHART>.serviceAccountName`

#### `templates/deployment.yaml`
- `strategy.type: RollingUpdate` using `maxSurge` and `maxUnavailable` from values
- `envFrom` referencing the ConfigMap by fullname
- `readinessProbe` and `livenessProbe` using values
- `imagePullSecrets` from values
- `serviceAccountName` from helper
- `securityContext: { runAsNonRoot: true, allowPrivilegeEscalation: false }`
- `revisionHistoryLimit: 3`

#### `templates/service.yaml`
ClusterIP service with `selector` using `selectorLabels` helper.

#### `templates/ingress.yaml`
Render only when `ingress.enabled` is true. Include TLS block referencing `ingress.tlsSecretName`.

#### `templates/hpa.yaml`
Render only when `autoscaling.enabled` is true. Target the Deployment by fullname.

#### `templates/serviceaccount.yaml`
Render only when `serviceAccount.create` is true.

#### `templates/configmap.yaml`
Always render. Populate from `env` values map. If `env` is empty, render an empty
ConfigMap — the Deployment always references it via `envFrom` so it must exist.

#### `templates/sealedsecret.yaml`
```yaml
# ============================================================
# SEALED SECRET — DO NOT EDIT ENCRYPTED VALUES MANUALLY
#
# To seal secrets for this service:
#
# kubectl create secret generic {{ include "<CHART>.fullname" . }} \
#   --namespace <NAMESPACE> \
#   --from-literal=MY_SECRET_KEY=my_secret_value \
#   --dry-run=client -o yaml | \
# kubeseal --cert sealed-secrets-cert.pem \
#   --scope namespace-wide \
#   --format yaml > helm/<SERVICE_FILENAME>/templates/sealedsecret.yaml
#
# Seal separately for staging and production — SealedSecrets are
# namespace-scoped and cannot be reused across namespaces.
#
# See sealed-secrets/README.md for full instructions.
# ============================================================
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
spec:
  encryptedData:
    # TODO: Replace with output from kubeseal
    # EXAMPLE_KEY: <SEALED_VALUE>
  template:
    metadata:
      name: {{ include "<CHART>.fullname" . }}
      namespace: {{ .Release.Namespace }}
    type: Opaque
```

---

### 7. `sealed-secrets/README.md`

Generate a complete operations guide covering:

**One-time cluster setup — install the Sealed Secrets controller:**
```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --set fullnameOverride=sealed-secrets
```

**Export the public cert and store as a GitHub Actions Secret:**
```bash
kubeseal --fetch-cert \
  --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  > sealed-secrets-cert.pem

# Base64-encode the cert and paste into GitHub Actions Secrets as SEALED_SECRETS_CERT
cat sealed-secrets-cert.pem | base64
```

**Create the GHCR pull secret in each namespace (one-time, per namespace):**
```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_ORG> \
  --docker-password=<GHCR_TOKEN> \
  --namespace staging

kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_ORG> \
  --docker-password=<GHCR_TOKEN> \
  --namespace production
```

**Sealing a new application secret:**
```bash
kubectl create secret generic <SECRET_NAME> \
  --namespace <NAMESPACE> \
  --from-literal=KEY=VALUE \
  --dry-run=client -o yaml | \
kubeseal --cert sealed-secrets-cert.pem \
  --scope namespace-wide \
  --format yaml > helm/<SERVICE_FILENAME>/templates/sealedsecret.yaml

# Commit the updated sealedsecret.yaml to git
```

**Namespace scoping warning:** A secret sealed for `staging` cannot be decrypted in
`production`. Always seal separately per namespace.

**Key rotation:** If the controller's key pair is rotated, all SealedSecrets must be
re-sealed using the new cert and re-committed. Describe how to detect stale seals and
re-seal in bulk using a loop over all `sealedsecret.yaml` files.

---

### 8. Root `README.md`

Generate a concise README covering:
- What this project is (one-line summary)
- Services included (auto-populated from project config)
- Prerequisites: `kubectl`, `helm`, `kubeseal`, `docker`, `git`
- One-time setup checklist (3 items — see Global Rule #9 below)
- Branch and tagging conventions
- How to add a new service (step-by-step: add to config block, re-run scaffold prompt, commit)
- How to deploy to production (push a semver tag, approve the GitHub environment gate)
- Pointer to `sealed-secrets/README.md`

---

## Global Generation Rules

1. **Generate every file in full.** Do not truncate, summarise, or use stub comments
   like `# rest of file unchanged`. Every file must be immediately usable as-is.
2. **No hardcoded secrets anywhere.** Sensitive values come from SealedSecrets or
   GitHub Actions Secrets only. Never put real credentials in values files or YAML.
3. **Kubeconfig cleanup is mandatory.** Every deploy job must delete the temp kubeconfig
   in a step with `if: always()` so it is removed even if the job fails.
4. **Non-root containers are required.** Every Dockerfile uses a non-root user. Every
   Deployment template sets `securityContext.runAsNonRoot: true` and
   `allowPrivilegeEscalation: false`.
5. **All workflow jobs must specify `runs-on: self-hosted`.**
6. **Use `secrets: inherit`** in all caller workflows — do not re-declare individual secrets.
7. **Add inline comments** to non-obvious decisions in all generated files (e.g. why
   `--atomic` is used, why `maxUnavailable: 0` ensures zero-downtime, why `revisionHistoryLimit`
   is set to 3).
8. **Do not generate Terraform, cloud-provider resources, or external DNS config.**
   This is an on-premises Kubernetes cluster only.
9. **After generating all files**, output a summary containing:
   - A complete generated file tree
   - A three-item one-time setup checklist:
     1. Configure the `production` GitHub Environment in repo Settings and add yourself
        as a required reviewer (this is the manual gate before every production deploy)
     2. Create `ghcr-pull-secret` in both the `staging` and `production` namespaces
        (commands in `sealed-secrets/README.md`)
     3. Install the Sealed Secrets controller into `kube-system`
        (commands in `sealed-secrets/README.md`)