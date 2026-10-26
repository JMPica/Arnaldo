#!/usr/bin/env bash
# Despliegue privado de MISE en Cloudflare (requiere `npx wrangler login` hecho por el propietario).
# Uso: bash scripts/deploy.sh staging|production
set -euo pipefail
cd "$(dirname "$0")/.."
ENV="${1:?staging|production}"
DB=$([ "$ENV" = production ] && echo mise-db || echo mise-db-staging)

npx wrangler whoami | grep -q "You are logged in" || { echo "✗ Falta autorización: ejecuta 'npx wrangler login' (lo hace el propietario)."; exit 2; }
node -e "
const c=require('fs').readFileSync('wrangler.jsonc','utf8').replace(/^\s*\/\/.*$/gm,'');
const e=JSON.parse(c).env['$ENV'];
const bad=[e.vars.ACCESS_TEAM_DOMAIN,e.vars.ACCESS_AUD,e.d1_databases[0].database_id].filter(v=>/REPLACE/.test(v));
if(bad.length){console.error('✗ Sustituye en wrangler.jsonc (env $ENV): '+bad.join(', '));process.exit(3)}"
npx wrangler secret list --env "$ENV" | grep -q OWNER_EMAILS || { echo "✗ Falta el secreto OWNER_EMAILS: npx wrangler secret put OWNER_EMAILS --env $ENV"; exit 4; }

npm run typecheck && npm run test:unit && npm run test:integration && npm run build
npx wrangler d1 migrations apply "$DB" --remote --env "$ENV"
npx wrangler deploy --env "$ENV"
URL=$(npx wrangler deployments list --env "$ENV" 2>/dev/null | grep -o 'https://[^ ]*workers.dev' | head -1 || true)
echo "Desplegado. Comprobando privacidad sin sesión en ${URL:-<indica la URL>}…"
[ -n "${URL:-}" ] && node scripts/smoke-http.mjs "$URL"
echo "Ahora abre la URL con tu email autorizado (Cloudflare Access) y comprueba Ajustes → Seguridad."
