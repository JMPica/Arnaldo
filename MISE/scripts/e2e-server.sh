#!/usr/bin/env bash
# Servidor para E2E: Worker real (workerd) + D1 local limpia + autenticación dev SOLO en loopback.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8788}"
STATE=".wrangler/e2e-state"
rm -rf "$STATE"
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
[ -f dist/client/index.html ] && [ -f public/ocr/worker.min.js ] || npm run build:web
npx wrangler d1 migrations apply mise-db --local --persist-to "$STATE" >/dev/null
exec npx wrangler dev --local --port "$PORT" --ip 127.0.0.1 --persist-to "$STATE" --show-interactive-dev-session=false
