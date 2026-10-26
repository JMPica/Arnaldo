#!/usr/bin/env node
// MISE · publicar en internet (Cloudflare, plan gratuito, acceso privado con Cloudflare Access).
// Uso: doble clic en «Publicar MISE en internet (Windows).bat» / «(Mac).command», o `node scripts/publicar.mjs`.
// Se puede repetir sin riesgo: reutiliza la base de datos y la configuración guardadas y vuelve a publicar la última versión.
// Configuración propia (no se versiona): datos-locales/publicacion.json y wrangler.publicacion.json.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'datos-locales');
const STATE_FILE = path.join(DATA, 'publicacion.json');
const GEN_CONFIG = path.join(ROOT, 'wrangler.publicacion.json');
const WIN = process.platform === 'win32';
const WORKER = 'mise';
const DB_NAME = 'mise-db';
const baseEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' };
const log = (s = '') => console.log(s);
const fail = (s) => { console.error(`\n✗ ${s}\n`); process.exit(1); };
const args = (list) => (WIN ? list.map((a) => (/[\s&()^%!]/.test(a) ? `"${a}"` : a)) : list);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def = '') => (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def;

/** Comando interactivo (el usuario ve y responde a wrangler). */
function run(cmd, argv, label, extraEnv = {}) {
  if (label) log(`· ${label}…`);
  const r = spawnSync(cmd, args(argv), { cwd: ROOT, env: { ...baseEnv, ...extraEnv }, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`${label ?? cmd} ha fallado. Revisa el mensaje anterior.`);
}
/** Comando no interactivo con salida capturada. */
function capture(argv, input, extraEnv = {}) {
  const r = spawnSync('npx', args(argv), { cwd: ROOT, env: { ...baseEnv, CI: 'true', ...extraEnv }, input, encoding: 'utf8', shell: WIN });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}`, err: `${r.stderr ?? ''}` };
}
function openBrowser(url) {
  const [cmd, a] = WIN ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, a, { stdio: 'ignore', detached: true }).unref();
}
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
// `--reconfigurar`: vuelve a pedir el email y los datos de Access (si se cambió algo en el panel de Cloudflare)
if (process.argv.includes('--reconfigurar')) { delete state.owner_email; delete state.team_domain; delete state.aud; }
const save = () => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 }); };

/** wrangler.jsonc + valores reales del entorno «production» → wrangler.publicacion.json (fuera de git). */
function writeConfig() {
  const raw = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(raw);
  const p = cfg.env.production;
  p.name = WORKER;
  p.d1_databases[0].database_id = state.database_id;
  p.vars.ACCESS_TEAM_DOMAIN = state.team_domain ?? 'https://REPLACE-TEAM.cloudflareaccess.com';
  p.vars.ACCESS_AUD = state.aud ?? 'REPLACE_AUD_PRODUCTION';
  delete cfg.$schema;
  fs.writeFileSync(GEN_CONFIG, JSON.stringify(cfg, null, 2));
}
const W = ['wrangler'];
const ENV = ['--config', GEN_CONFIG, '--env', 'production'];

function deploy(label) {
  const out = path.join(os.tmpdir(), `mise-deploy-${Date.now()}.ndjson`);
  run('npx', [...W, 'deploy', ...ENV], label, { WRANGLER_OUTPUT_FILE_PATH: out });
  const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  fs.rmSync(out, { force: true });
  const url = lines.filter((l) => l.type === 'deploy').flatMap((l) => l.targets ?? []).find((t) => /workers\.dev/.test(t));
  if (url) state.url = url.startsWith('http') ? url : `https://${url}`;
}
/** Sin sesión, una app protegida por Access redirige al login de <equipo>.cloudflareaccess.com. */
async function accessRedirect() {
  try {
    const res = await fetch(state.url, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    const u = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com\//.test(loc) ? new URL(loc) : null;
    return u ? { team: u.origin, kid: u.searchParams.get('kid') } : null;
  } catch { return null; }
}

// ───────────── 1. Preparación ─────────────
log('\nMISE · publicar en internet (Cloudflare, gratis y privado)\n');
if (Number(process.versions.node.split('.')[0]) < 20) fail('Necesitas Node.js 20 o superior: https://nodejs.org');
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'wrangler'))) run('npm', ['ci', '--no-audit', '--no-fund'], 'Instalando componentes (solo la primera vez)');
run('npm', ['run', 'build:web'], 'Preparando la interfaz');

// ───────────── 2. Cuenta de Cloudflare ─────────────
let who = capture([...W, 'whoami', '--json']);
if (!who.ok) {
  log('\nSe abrirá el navegador: entra en tu cuenta de Cloudflare y pulsa «Allow» (Permitir).');
  await ask('Pulsa Intro para continuar');
  run('npx', [...W, 'login'], 'Conectando con tu cuenta de Cloudflare');
  who = capture([...W, 'whoami', '--json']);
  if (!who.ok) fail('No se ha podido conectar con Cloudflare. Vuelve a intentarlo.');
}
const me = JSON.parse(who.out.slice(who.out.indexOf('{')));
const accounts = me.accounts ?? [];
if (!accounts.length) fail('Tu usuario de Cloudflare no tiene ninguna cuenta. Entra en dash.cloudflare.com y termina el registro.');
if (!state.account_id || !accounts.some((a) => a.id === state.account_id)) {
  let acc = accounts[0];
  if (accounts.length > 1) {
    accounts.forEach((a, i) => log(`  ${i + 1}. ${a.name}`));
    acc = accounts[Number(await ask('¿Qué cuenta uso? (número)', '1')) - 1] ?? accounts[0];
  }
  state.account_id = acc.id;
}
baseEnv.CLOUDFLARE_ACCOUNT_ID = state.account_id;
log(`· Cuenta de Cloudflare: ${accounts.find((a) => a.id === state.account_id)?.name}`);

// ───────────── 3. Email autorizado ─────────────
if (!state.owner_email) {
  log('\nSolo podrá entrar en MISE el email que indiques (te llegará un código cada vez que entres desde un aparato nuevo).');
  for (;;) {
    const e = (await ask('Tu email', me.email ?? '')).toLowerCase();
    if (/^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/.test(e)) { state.owner_email = e; break; }
    log('  Ese email no parece válido.');
  }
}
save();

// ───────────── 4. Base de datos ─────────────
const listDbs = () => { const r = capture([...W, 'd1', 'list', '--json']); try { return JSON.parse(r.out.slice(r.out.indexOf('['))); } catch { return []; } };
let db = listDbs().find((d) => d.name === DB_NAME);
if (!db) {
  log('· Creando la base de datos (gratis)…');
  const r = capture([...W, 'd1', 'create', DB_NAME, '--update-config=false']);
  if (!r.ok) fail(`No se pudo crear la base de datos:\n${r.out}${r.err}`);
  db = listDbs().find((d) => d.name === DB_NAME);
  if (!db) fail('La base de datos no aparece después de crearla. Vuelve a ejecutar este programa.');
}
state.database_id = db.uuid;
save();
writeConfig();
const mig = capture([...W, 'd1', 'migrations', 'apply', DB_NAME, '--remote', ...ENV]);
if (!mig.ok) fail(`No se pudieron preparar las tablas:\n${mig.out}${mig.err}`);
log('· Base de datos lista');

// ───────────── 5. Publicación inicial (cerrada: sin Access configurado responde error y no muestra nada) ─────────────
deploy('Publicando MISE');
if (!state.url) fail('No se ha obtenido la dirección de MISE. Vuelve a ejecutar este programa.');
const secret = capture([...W, 'secret', 'put', 'OWNER_EMAILS', ...ENV], state.owner_email);
if (!secret.ok) fail(`No se pudo guardar el email autorizado:\n${secret.out}${secret.err}`);
save();

// ───────────── 6. Cloudflare Access (protección con tu email) ─────────────
let redirect = await accessRedirect();
if (!redirect) {
  const dash = `https://dash.cloudflare.com/${state.account_id}/workers/services/view/${WORKER}/production/settings`;
  log('\n──────────────── Paso manual (1 minuto) ────────────────');
  log('Se abrirá la configuración de MISE en Cloudflare. Allí:');
  log('  1. Busca «Domains & Routes» (Dominios y rutas) → la fila «workers.dev».');
  log('  2. Pulsa los tres puntos o el botón de esa fila → «Enable Cloudflare Access» (Activar).');
  log('  3. Pulsa «Manage Cloudflare Access» y deja autorizado SOLO tu email:');
  log(`     ${state.owner_email}`);
  log('Cuando termines, vuelve a esta ventana.');
  log('────────────────────────────────────────────────────────\n');
  openBrowser(dash);
  for (;;) {
    await ask('Pulsa Intro cuando hayas activado Access');
    redirect = await accessRedirect();
    if (redirect) break;
    log('  Todavía no está activo (puede tardar un minuto). Comprueba el paso 2 y vuelve a pulsar Intro.');
  }
}
state.team_domain = redirect.team;
log(`· Access activo (equipo ${redirect.team})`);
if (!state.aud) {
  log('\nFalta un código de Access: en la pantalla «Manage Cloudflare Access» (o en Zero Trust → Access → Applications → tu');
  log('aplicación de MISE → Overview) copia el «Application Audience (AUD) Tag» y pégalo aquí.');
  for (;;) {
    const v = (await ask('AUD Tag', redirect.kid && /^[a-f0-9]{64}$/.test(redirect.kid) ? redirect.kid : '')).toLowerCase();
    if (/^[a-f0-9]{64}$/.test(v)) { state.aud = v; break; }
    log('  El AUD Tag son 64 caracteres (números y letras a-f). Cópialo de nuevo.');
  }
}
save();
writeConfig();
deploy('Publicando MISE con la protección activada');

// ───────────── 7. Comprobación de privacidad ─────────────
log('\n· Comprobando desde fuera que nadie sin tu email ve nada…');
const smoke = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'smoke-http.mjs'), state.url], { cwd: ROOT, encoding: 'utf8' });
const fails = (smoke.stdout ?? '').split('\n').filter((l) => l.startsWith('FAIL'));
if (smoke.status !== 0) {
  log(fails.join('\n'));
  fail('La comprobación de privacidad NO ha pasado. No metas datos reales y envía esta ventana a Claude.');
}
log(`  PASS: ${(smoke.stdout.match(/^PASS/gm) ?? []).length} comprobaciones sin sesión (ningún dato visible)`);
state.verified_at = new Date().toISOString();
save();
rl.close();

log('\n──────────────────────────────────────────────────────────────');
log('  MISE está publicado y protegido.');
log(`  Dirección: ${state.url}`);
log(`  Solo entra: ${state.owner_email} (código por email la primera vez en cada aparato)`);
log('  · En el iPhone: abre la dirección en Safari → entra → Compartir → «Añadir a pantalla de inicio».');
log('  · Comprueba en MISE: Ajustes → Seguridad → Autenticación «Cloudflare Access».');
log('  · Para actualizar MISE en el futuro, vuelve a abrir este programa.');
log('  · Si no te deja entrar con tu email: `node scripts/publicar.mjs --reconfigurar`.');
log('──────────────────────────────────────────────────────────────\n');
openBrowser(state.url);
