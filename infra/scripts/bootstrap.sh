#!/usr/bin/env bash
# infra/scripts/bootstrap.sh
# Idempotent bootstrap for Eretz-Eir cloud resources.
# Run once per environment before deploying application code.
#
# Usage:
#   ENVIRONMENT=staging ./infra/scripts/bootstrap.sh
#   ENVIRONMENT=production ./infra/scripts/bootstrap.sh
#
# Prerequisites:
#   - terraform >= 1.5 on PATH
#   - supabase CLI on PATH (brew install supabase/tap/supabase)
#   - gh CLI authenticated (for GitHub secrets, optional)
#   - Environment variables set (see .env.example)

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/terraform"

log() { echo "[bootstrap] $*"; }
die() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Validate required env vars
# ---------------------------------------------------------------------------
required_vars=(
  SUPABASE_ACCESS_TOKEN
  SUPABASE_ORGANIZATION_ID
  SUPABASE_DB_PASSWORD
  VERCEL_API_TOKEN
)

for var in "${required_vars[@]}"; do
  [[ -n "${!var:-}" ]] || die "Required environment variable '$var' is not set."
done

log "Bootstrapping environment: ${ENVIRONMENT}"

# ---------------------------------------------------------------------------
# 1. Terraform: init + apply (create-or-update semantics)
# ---------------------------------------------------------------------------
log "Initializing Terraform..."
terraform -chdir="${TF_DIR}" init -upgrade

log "Applying Terraform plan (environment=${ENVIRONMENT})..."
terraform -chdir="${TF_DIR}" apply -auto-approve \
  -var="environment=${ENVIRONMENT}" \
  -var="supabase_access_token=${SUPABASE_ACCESS_TOKEN}" \
  -var="supabase_organization_id=${SUPABASE_ORGANIZATION_ID}" \
  -var="supabase_db_password=${SUPABASE_DB_PASSWORD}" \
  -var="vercel_api_token=${VERCEL_API_TOKEN}" \
  ${VERCEL_TEAM_ID:+-var="vercel_team_id=${VERCEL_TEAM_ID}"}

SUPABASE_PROJECT_REF="$(terraform -chdir="${TF_DIR}" output -raw supabase_project_id)"
log "Supabase project ref: ${SUPABASE_PROJECT_REF}"

# ---------------------------------------------------------------------------
# 2. Supabase: link project and push migrations
# ---------------------------------------------------------------------------
log "Linking Supabase project..."
supabase link \
  --project-ref "${SUPABASE_PROJECT_REF}" \
  --password "${SUPABASE_DB_PASSWORD}" \
  2>/dev/null || log "Already linked (idempotent)."

log "Pushing database migrations..."
supabase db push --include-all

# ---------------------------------------------------------------------------
# 3. Supabase: deploy Edge Functions
# ---------------------------------------------------------------------------
log "Deploying Edge Functions..."
for fn_dir in "${REPO_ROOT}"/supabase/functions/*/; do
  fn_name="$(basename "${fn_dir}")"
  log "  Deploying function: ${fn_name}"
  supabase functions deploy "${fn_name}" --project-ref "${SUPABASE_PROJECT_REF}"
done

# ---------------------------------------------------------------------------
# 4. Export project ref for downstream CI steps
# ---------------------------------------------------------------------------
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF}" >> "${GITHUB_ENV}"
fi

log "Bootstrap complete for environment: ${ENVIRONMENT}"
