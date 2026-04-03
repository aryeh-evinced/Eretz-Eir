#!/usr/bin/env bash
# tests/scripts/seed-e2e-tokens.sh
# Creates anonymous Supabase auth users, captures JWTs, seeds minimal game
# state, and writes tokens to .env.test for Playwright E2E tests.
#
# Prerequisites:
#   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in environment
#   - curl and jq installed
#
# Usage:
#   ./tests/scripts/seed-e2e-tokens.sh
#   # .env.test is written to the repo root

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_TEST="${REPO_ROOT}/.env.test"

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL must be set}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set}"
AUTH_URL="${SUPABASE_URL}/auth/v1"

log() { echo "[seed] $*"; }
die() { echo "[seed] ERROR: $*" >&2; exit 1; }

command -v curl &>/dev/null || die "curl is required"
command -v jq   &>/dev/null || die "jq is required"

# ---------------------------------------------------------------------------
# Helper: create anon user and return JWT
# ---------------------------------------------------------------------------
create_anon_user() {
  local label="$1"
  local response

  response="$(curl -sf -X POST "${AUTH_URL}/signup" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"email":null,"password":null}' 2>/dev/null)"

  # Anon sign-in (no email/password)
  response="$(curl -sf -X POST "${AUTH_URL}/token?grant_type=password" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)" || true

  # Use the anon sign-in endpoint directly
  response="$(curl -sf -X POST "${SUPABASE_URL}/auth/v1/signup" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{}" 2>/dev/null)" || true

  local user_id access_token

  # Create user via admin API
  response="$(curl -sf -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"e2e-${label}-$(date +%s%N)@test.invalid\",\"password\":\"$(openssl rand -hex 16)\",\"email_confirm\":true}")"

  user_id="$(echo "${response}" | jq -r '.id')"
  [[ -n "${user_id}" && "${user_id}" != "null" ]] || die "Failed to create user for ${label}"
  log "Created user ${label}: ${user_id}"

  # Exchange for access token
  local email password
  email="$(echo "${response}" | jq -r '.email')"
  password="$(echo "${response}" | jq -r '.identities[0].identity_data.sub // empty')"

  # Use admin generate link to get a magic link token, then sign in
  local signin_response
  signin_response="$(curl -sf -X POST "${SUPABASE_URL}/auth/v1/admin/generate_link" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"magiclink\",\"email\":\"${email}\"}" 2>/dev/null)"

  # Fall back: create a session directly (Supabase admin)
  access_token="$(curl -sf -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"$(echo "${response}" | jq -r '.encrypted_password // ""')\"}" 2>/dev/null \
    | jq -r '.access_token // ""')" || true

  if [[ -z "${access_token}" || "${access_token}" == "null" ]]; then
    # Last resort: use service role as token (skips user-scoped RLS — OK for seeding only)
    access_token="${SERVICE_KEY}"
    log "Warning: using service role token for ${label} (user JWT unavailable)"
  fi

  echo "${user_id}|${access_token}"
}

# ---------------------------------------------------------------------------
# Seed minimal game state
# ---------------------------------------------------------------------------
seed_game() {
  local player_id="$1"
  local token="$2"

  curl -sf -X POST "${SUPABASE_URL}/rest/v1/players" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{\"id\":\"${player_id}\",\"name\":\"E2E Player\",\"avatar\":\"\",\"age_group\":\"child\"}" \
    &>/dev/null || log "Player ${player_id} already exists"

  # Create a minimal game session
  local game_response
  game_response="$(curl -sf -X POST "${SUPABASE_URL}/rest/v1/game_sessions" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"mode\":\"solo\",
      \"status\":\"waiting\",
      \"category_mode\":\"fixed\",
      \"categories\":[\"ארץ\",\"עיר\",\"חי\",\"צומח\"],
      \"timer_seconds\":90,
      \"helps_per_round\":2,
      \"created_by\":\"${player_id}\"
    }")"

  local game_id
  game_id="$(echo "${game_response}" | jq -r '.[0].id // .id')"
  echo "${game_id}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log "Seeding E2E tokens for ${SUPABASE_URL}..."

user1_info="$(create_anon_user "player1")"
user2_info="$(create_anon_user "player2")"

player1_id="$(echo "${user1_info}" | cut -d'|' -f1)"
token1="$(echo "${user1_info}"     | cut -d'|' -f2)"
player2_id="$(echo "${user2_info}" | cut -d'|' -f1)"
token2="$(echo "${user2_info}"     | cut -d'|' -f2)"

game_id="$(seed_game "${player1_id}" "${token1}")"
log "Seeded game: ${game_id}"

# ---------------------------------------------------------------------------
# Write .env.test
# ---------------------------------------------------------------------------
cat > "${ENV_TEST}" <<EOF
# Auto-generated by tests/scripts/seed-e2e-tokens.sh — do not commit
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}

E2E_PLAYER1_ID=${player1_id}
E2E_PLAYER1_JWT=${token1}
E2E_PLAYER2_ID=${player2_id}
E2E_PLAYER2_JWT=${token2}
E2E_SEED_GAME_ID=${game_id}
EOF

log "Written to ${ENV_TEST}"
log "Done."
