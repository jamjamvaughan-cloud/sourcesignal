#!/usr/bin/env bash
#
# One-command VPS rollout for the SourceSignal backend.
#
# Run on the VPS from inside the repo checkout:
#   bash scripts/deploy-vps.sh
#
# Steps:
#   1. Pull the latest main from GitHub.
#   2. Ensure PostgreSQL / PgBouncer / Redis are running.
#   3. Apply the idempotent schema (safe on every deploy).
#   4. Rebuild and restart the stack.
#   5. Verify the public API routes through Caddy.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f docker-compose.prod.yml)
PG_USER="${POSTGRES_USER:-sourcesignal}"
PG_DB="${POSTGRES_DB:-sourcesignal_db}"
API_ORIGIN="${API_ORIGIN:-https://api.sourcesignal.site}"

log() { printf '\n==> %s\n' "$*"; }

log "Fetching latest main"
git fetch origin main
git checkout main
git pull --ff-only origin main

log "Ensuring database services are up"
"${COMPOSE[@]}" up -d postgres pgbouncer redis

log "Waiting for PostgreSQL"
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "Applying idempotent schema"
"${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" < src/lib/db-schema.sql

log "Building and restarting the stack"
if [ "${NO_CACHE:-0}" = "1" ]; then
  log "NO_CACHE=1: rebuilding images without cached layers"
  "${COMPOSE[@]}" build --no-cache
fi
"${COMPOSE[@]}" up -d --build

log "Waiting for API health"
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "Verifying public routes through Caddy"
declare -A EXPECTED=(
  ["/api/health"]=200
  ["/api/coverage"]=200
  ["/api/signals"]=401
  ["/api/user/preferences"]=401
  ["/api/webhooks"]=401
)
FAILED=0
for path in /api/health /api/coverage /api/signals /api/user/preferences /api/webhooks; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -m 20 "${API_ORIGIN}${path}" || echo 000)"
  printf '  %-16s %s (expected %s)\n' "$path" "$code" "${EXPECTED[$path]}"
  if [ "$code" != "${EXPECTED[$path]}" ]; then
    FAILED=1
  fi
done

log "Pruning old images"
docker image prune -f >/dev/null 2>&1 || true

log "Done. Deployed HEAD: $(git rev-parse --short HEAD)"
if [ "$FAILED" -ne 0 ]; then
  echo "One or more route checks failed. Inspect: ${COMPOSE[*]} logs api" >&2
  exit 1
fi
