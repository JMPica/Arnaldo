#!/usr/bin/env bash
# Arranca el Worker local en modo producción (AUTH_MODE=access, sin modo dev) y ejecuta el smoke de privacidad.
set -euo pipefail
cd "$(dirname "$0")/.."
STATE=".wrangler/smoke-state"; rm -rf "$STATE"
cat > .dev.vars.staging <<VARS
AUTH_MODE=access
ACCESS_TEAM_DOMAIN=https://mise-smoke.cloudflareaccess.com
ACCESS_AUD=smoke-aud
OWNER_EMAILS=chef@example.com
VARS
npx wrangler d1 migrations apply mise-db-staging --local --env staging --persist-to "$STATE" >/dev/null
npx wrangler dev --env staging --local --port 8789 --ip 127.0.0.1 --persist-to "$STATE" --show-interactive-dev-session=false >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -f .dev.vars.staging' EXIT
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8789/ && break; sleep 1; done
node scripts/smoke-http.mjs http://127.0.0.1:8789
