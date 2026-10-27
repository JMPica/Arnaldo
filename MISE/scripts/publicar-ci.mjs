#!/usr/bin/env node
// MISE · publicación automática en Cloudflare desde GitHub Actions (sin instalar nada en ningún ordenador).
// Requiere secretos del repositorio: CLOUDFLARE_API_TOKEN y MISE_OWNER_EMAIL (opcional: CLOUDFLARE_ACCOUNT_ID, MISE_SUBDOMAIN).
// Idempotente: busca o crea subdominio workers.dev, base D1, organización y aplicación de Access; despliega y verifica.
// Orden seguro: si Access no está listo, se publica una versión que responde 500 sin contenido (nunca abierta).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_CONFIG = path.join(ROOT, 'wrangler.publicacion.json');
const WORKER = 'mise';
const DB_NAME = 'mise-db';
const API = process.env.CLOUDFLARE_API_BASE_URL ?? 'https://api.cloudflare.com/client/v4'; // misma variable que wrangler (pruebas)
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? '';
const EMAIL = (process.env.MISE_OWNER_EMAIL ?? '').trim().toLowerCase();
const summary = [];
const note = (s) => { console.log(s); summary.push(s); };
const finish = (code) => {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Publicación de MISE\n\n${summary.map((s) => `- ${s}`).join('\n')}\n`);
  process.exit(code);
};
const stop = (s) => { note(`✗ ${s}`); finish(1); };

if (!TOKEN) { note('Sin CLOUDFLARE_API_TOKEN: publicación omitida (añádelo en Settings → Secrets and variables → Actions).'); finish(0); }
if (!/^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/.test(EMAIL)) stop('Falta o no es válido el secreto MISE_OWNER_EMAIL (tu email, el único que podrá entrar).');

async function cf(method, p, body) {
  const res = await fetch(API + p, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && j.success !== false, status: res.status, result: j.result, errors: (j.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') };
}
const need = (r, what) => { if (!r.ok) stop(`${what} (HTTP ${r.status} ${r.errors}). Revisa los permisos del token.`); return r.result; };

// ───────────── Cuenta ─────────────
let account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!account) {
  const accs = need(await cf('GET', '/accounts'), 'No se pudo leer la cuenta');
  if (accs.length !== 1) stop(`El token ve ${accs.length} cuentas: añade el secreto CLOUDFLARE_ACCOUNT_ID.`);
  account = accs[0].id;
}
const A = `/accounts/${account}`;

// ───────────── Subdominio workers.dev ─────────────
let sub = (await cf('GET', `${A}/workers/subdomain`)).result?.subdomain;
if (!sub) {
  const wanted = (process.env.MISE_SUBDOMAIN || `chef-${randomBytes(3).toString('hex')}`).toLowerCase();
  sub = need(await cf('PUT', `${A}/workers/subdomain`, { subdomain: wanted }), 'No se pudo crear el subdominio workers.dev').subdomain;
}
const HOST = `${WORKER}.${sub}.workers.dev`;
const URL_ = `https://${HOST}`;

// ───────────── Base de datos D1 ─────────────
let db = (need(await cf('GET', `${A}/d1/database?name=${DB_NAME}`), 'No se pudo consultar D1') ?? []).find((d) => d.name === DB_NAME);
if (!db) db = need(await cf('POST', `${A}/d1/database`, { name: DB_NAME }), 'No se pudo crear la base de datos D1');

// ───────────── Cloudflare Access ─────────────
let org = (await cf('GET', `${A}/access/organizations`)).result;
if (!org?.auth_domain) {
  const r = await cf('POST', `${A}/access/organizations`, { name: 'MISE', auth_domain: `${sub}.cloudflareaccess.com` });
  org = r.ok ? r.result : null;
  if (!org) note(`Zero Trust aún no está activado en la cuenta (${r.errors || r.status}).`);
}
let app = null;
if (org?.auth_domain) {
  const apps = (await cf('GET', `${A}/access/apps`)).result ?? [];
  app = apps.find((a) => a.domain === HOST || a.self_hosted_domains?.includes(HOST) || a.destinations?.some((d) => d.uri === HOST));
  if (!app) {
    const r = await cf('POST', `${A}/access/apps`, { name: 'MISE', type: 'self_hosted', domain: HOST, session_duration: '720h', app_launcher_visible: false });
    if (r.ok) app = r.result;
    else note(`No se pudo crear la aplicación de Access por API (${r.errors || r.status}).`);
  }
}
if (app) {
  const pols = (await cf('GET', `${A}/access/apps/${app.id}/policies`)).result ?? [];
  const body = { name: 'MISE · propietario', decision: 'allow', include: [{ email: { email: EMAIL } }], precedence: 1 };
  const mine = pols.find((p) => p.name === body.name);
  need(mine ? await cf('PUT', `${A}/access/apps/${app.id}/policies/${mine.id}`, body) : await cf('POST', `${A}/access/apps/${app.id}/policies`, body), 'No se pudo fijar la política de Access');
  const others = pols.filter((p) => p.name !== body.name && p.decision !== 'deny');
  if (others.length) note(`Aviso: la aplicación de Access tiene otras ${others.length} reglas además de la tuya; MISE igualmente solo deja entrar a tu email.`);
}

// ───────────── Configuración y despliegue ─────────────
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const prod = cfg.env.production;
prod.name = WORKER;
prod.d1_databases[0].database_id = db.uuid;
prod.vars.ACCESS_TEAM_DOMAIN = org?.auth_domain ? `https://${org.auth_domain}` : 'https://REPLACE-TEAM.cloudflareaccess.com';
prod.vars.ACCESS_AUD = app?.aud ?? 'REPLACE_AUD_PRODUCTION';
delete cfg.$schema;
fs.writeFileSync(GEN_CONFIG, JSON.stringify(cfg, null, 2));

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, CI: 'true', WRANGLER_SEND_METRICS: 'false' };
const ENV = ['--config', GEN_CONFIG, '--env', 'production'];
function wrangler(argv, label, input) {
  const r = spawnSync('npx', ['wrangler', ...argv], { cwd: ROOT, env, input, encoding: 'utf8', stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  if (r.status !== 0) stop(`${label} ha fallado (ver registro).`);
}
wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote', ...ENV], 'Migraciones D1');
wrangler(['deploy', ...ENV], 'Despliegue');
wrangler(['secret', 'put', 'OWNER_EMAILS', ...ENV], 'Secreto OWNER_EMAILS', EMAIL);

if (!app) {
  note(`Publicado **cerrado** (responde error sin contenido) en ${URL_} porque falta Cloudflare Access.`);
  note(!org?.auth_domain
    ? 'Acción: en dash.cloudflare.com abre **Zero Trust**, elige un nombre de equipo y el plan **Free**; después vuelve a lanzar este trabajo.'
    : 'Acción: en dash.cloudflare.com → Workers & Pages → mise → Settings → Domains & Routes → workers.dev → **Enable Cloudflare Access**; después vuelve a lanzar este trabajo.');
  finish(1);
}

// ───────────── Verificación de privacidad desde fuera ─────────────
let out = '';
for (let i = 0; i < 12; i++) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'smoke-http.mjs'), URL_], { cwd: ROOT, encoding: 'utf8' });
  out = r.stdout ?? '';
  if (r.status === 0) {
    note(`MISE publicado y protegido: ${URL_}`);
    note(`Acceso: solo ${EMAIL.replace(/^(.).*(@.*)$/, '$1…$2')} con código por email (Cloudflare Access ${org.auth_domain}).`);
    note(`Privacidad sin sesión: ${(out.match(/^PASS/gm) ?? []).length} comprobaciones PASS.`);
    finish(0);
  }
  await new Promise((res) => setTimeout(res, 10_000));
}
console.log(out);
stop(`La comprobación de privacidad no pasa en ${URL_}. No metas datos reales todavía.`);
