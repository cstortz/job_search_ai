#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://dev01.int.stortz.tech:3000}"
APP_SESSION="${APP_SESSION:-}"
VERBOSE="${VERBOSE:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

print_step() {
  printf "\n==> %s\n" "$1"
}

show_json() {
  local body="$1"
  if [[ "$VERBOSE" == "1" ]]; then
    printf "%s\n" "$body" | jq .
  else
    printf "%s\n" "$body" | jq '{ok: .ok, authenticated: .authenticated, error: .error, userId: .user.id, counts: {jobSites: (.jobSites|length?), jobListings: (.jobListings|length?), resumePackets: (.resumePackets|length?), skills: (.skills|length?)}}' 2>/dev/null || printf "%s\n" "$body" | jq .
  fi
}

json_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  local args=(
    -sS
    -X "$method"
    "$BASE_URL$path"
    -H "accept: application/json"
  )

  if [[ -n "$APP_SESSION" ]]; then
    args+=(-H "cookie: appSession=$APP_SESSION")
  fi

  if [[ -n "$data" ]]; then
    args+=(-H "content-type: application/json" -d "$data")
  fi

  curl "${args[@]}"
}

logout_request() {
  local args=(
    -sS
    -i
    -X GET
    "$BASE_URL/auth/logout"
  )

  if [[ -n "$APP_SESSION" ]]; then
    args+=(-H "cookie: appSession=$APP_SESSION")
  fi

  curl "${args[@]}"
}

if [[ -z "$APP_SESSION" ]]; then
  cat <<EOF
APP_SESSION is not set.

1) Open: $BASE_URL/auth/login
2) Complete login + 2FA in browser
3) Copy the appSession cookie value from browser devtools
EOF

  if [[ -t 0 ]]; then
    printf "\nPaste appSession cookie value and press Enter:\n> "
    read -r APP_SESSION
  fi

  if [[ -z "$APP_SESSION" ]]; then
    cat <<EOF

No cookie value was provided.
You can run non-interactively with:

APP_SESSION='<cookie value>' BASE_URL='$BASE_URL' bash scripts/smoke-auth-flow.sh
EOF
    exit 1
  fi
fi

print_step "Auth check (should be authenticated)"
auth_session_json="$(json_request GET "/api/auth/session")"
show_json "$auth_session_json"
authenticated="$(printf "%s" "$auth_session_json" | jq -r '.authenticated // false')"
if [[ "$authenticated" != "true" ]]; then
  echo "Auth check failed: expected authenticated=true" >&2
  exit 1
fi

print_step "Current user profile"
me_json="$(json_request GET "/api/auth/me")"
show_json "$me_json"
user_id="$(printf "%s" "$me_json" | jq -r '.user.id // empty')"
if [[ -z "$user_id" ]]; then
  echo "Failed to get user.id from /api/auth/me" >&2
  exit 1
fi

print_step "GET /api/job-sites"
job_sites_json="$(json_request GET "/api/job-sites")"
show_json "$job_sites_json"
job_source_id="$(printf "%s" "$job_sites_json" | jq -r '.jobSites[0].id // empty')"

print_step "POST /api/job-sites (create smoke-test site)"
site_suffix="$(date +%s)"
created_site_json="$(json_request POST "/api/job-sites" "{\"url\":\"https://smoketest-$site_suffix.example.com/jobs\",\"company\":\"SmokeTest Co\",\"industry\":\"software\",\"frequency\":\"daily\",\"enabled\":true,\"timezone\":\"UTC\"}")"
show_json "$created_site_json"
created_site_id="$(printf "%s" "$created_site_json" | jq -r '.jobSite.id // empty')"

if [[ -n "$created_site_id" ]]; then
  print_step "GET /api/job-sites/$created_site_id"
  created_site_read_json="$(json_request GET "/api/job-sites/$created_site_id")"
  show_json "$created_site_read_json"

  print_step "PATCH /api/job-sites/$created_site_id"
  patched_site_json="$(json_request PATCH "/api/job-sites/$created_site_id" "{\"url\":\"https://smoketest-$site_suffix.example.com/careers\",\"company\":\"SmokeTest Co\",\"industry\":\"software\",\"frequency\":\"weekly\",\"enabled\":true,\"timezone\":\"UTC\"}")"
  show_json "$patched_site_json"

  print_step "DELETE /api/job-sites/$created_site_id"
  deleted_site_json="$(json_request DELETE "/api/job-sites/$created_site_id")"
  show_json "$deleted_site_json"
else
  print_step "Skipping job-site id-based tests (site create failed)"
fi

print_step "GET /api/job-listings"
job_listings_json="$(json_request GET "/api/job-listings")"
show_json "$job_listings_json"
job_id="$(printf "%s" "$job_listings_json" | jq -r '.jobListings[0].id // empty')"
job_status="$(printf "%s" "$job_listings_json" | jq -r '.jobListings[0].status // empty')"

if [[ -n "$job_source_id" ]]; then
  print_step "GET /api/job-listings?jobSourceId=$job_source_id"
  filtered_listings_json="$(json_request GET "/api/job-listings?jobSourceId=$job_source_id")"
  show_json "$filtered_listings_json"
fi

if [[ -n "$job_status" ]]; then
  print_step "GET /api/job-listings?status=$job_status"
  status_filtered_json="$(json_request GET "/api/job-listings?status=$job_status")"
  show_json "$status_filtered_json"
fi

if [[ -n "$job_id" ]]; then
  print_step "GET /api/job-listings/$job_id"
  single_job_json="$(json_request GET "/api/job-listings/$job_id")"
  show_json "$single_job_json"

  print_step "PATCH /api/job-listings/$job_id/status (idempotent to current status)"
  next_status="$job_status"
  if [[ -z "$next_status" ]]; then
    next_status="active"
  fi
  patched_job_json="$(json_request PATCH "/api/job-listings/$job_id/status" "{\"status\":\"$next_status\"}")"
  show_json "$patched_job_json"
else
  print_step "Skipping id-based listing tests (no job listings found)"
fi

print_step "GET /api/resume-packets"
resume_packets_json="$(json_request GET "/api/resume-packets")"
show_json "$resume_packets_json"

if [[ -n "$job_id" ]]; then
  print_step "GET /api/resume-packets?jobId=$job_id"
  filtered_packets_json="$(json_request GET "/api/resume-packets?jobId=$job_id")"
  show_json "$filtered_packets_json"
fi

print_step "GET /api/resume-packets?applicationStatus=applied"
status_packets_json="$(json_request GET "/api/resume-packets?applicationStatus=applied")"
show_json "$status_packets_json"

print_step "GET /api/skills"
skills_json="$(json_request GET "/api/skills")"
show_json "$skills_json"

print_step "POST /api/skills (create smoke-test skill)"
skill_suffix="$(date +%s)"
new_skill_name="SmokeTestSkill-$skill_suffix"
created_skill_json="$(json_request POST "/api/skills" "{\"skillName\":\"$new_skill_name\",\"skillCategory\":\"technical\",\"description\":\"Created by smoke test\",\"yearsOfExperience\":1}")"
show_json "$created_skill_json"
created_skill_id="$(printf "%s" "$created_skill_json" | jq -r '.skill.id // empty')"

if [[ -n "$created_skill_id" ]]; then
  print_step "GET /api/skills/$created_skill_id"
  created_skill_read_json="$(json_request GET "/api/skills/$created_skill_id")"
  show_json "$created_skill_read_json"

  print_step "PATCH /api/skills/$created_skill_id"
  patched_skill_json="$(json_request PATCH "/api/skills/$created_skill_id" "{\"skillName\":\"$new_skill_name\",\"skillCategory\":\"technical\",\"description\":\"Updated by smoke test\",\"yearsOfExperience\":2}")"
  show_json "$patched_skill_json"

  print_step "DELETE /api/skills/$created_skill_id"
  deleted_skill_json="$(json_request DELETE "/api/skills/$created_skill_id")"
  show_json "$deleted_skill_json"
else
  print_step "Skipping skill id-based tests (skill create failed)"
fi

print_step "Auth logout endpoint"
logout_response="$(logout_request)"
if [[ "$VERBOSE" == "1" ]]; then
  printf "%s\n" "$logout_response"
else
  printf "%s\n" "$logout_response" | awk 'NR<=15 {print}'
fi

cat <<EOF

Smoke flow complete.

Important logout note:
- This script sends appSession as a raw header value.
- Auth0 logout clears cookies in a browser, but cannot clear your pasted header value.
- To fully validate post-logout auth state, refresh browser and re-check:
  $BASE_URL/api/auth/session
EOF
