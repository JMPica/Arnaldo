#!/usr/bin/env node
// MISE · modo local (Windows / Mac) — arranca la app en este ordenador, accesible por wifi para el iPhone.
// Uso: doble clic en «Iniciar MISE (Windows).bat» o «Iniciar MISE (Mac).command», o `node scripts/local.mjs`.
// Datos: ./datos-locales (base de datos y secreto) · Copias automáticas: ./copias-locales (configurable).
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MISE_PORT ?? 8787);
const DATA = process.env.MISE_DATOS ? path.resolve(process.env.MISE_DATOS) : path.join(ROOT, 'datos-locales');
const WIN = process.platform === 'win32';
const OPEN = !process.argv.includes('--no-abrir');
// Sin telemetría ni consultas a Cloudflare: funciona igual sin conexión a internet
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false', CI: 'true', FORCE_COLOR: '0' };
const log = (s = '') => console.log(s);
const fail = (s) => { console.error(`\n✗ ${s}\n`); process.exit(1); };
// En Windows hay que lanzar npm/npx a través del intérprete de comandos, que une los argumentos sin comillas:
// se entrecomillan las rutas con espacios (p. ej. C:\Users\Nombre Apellido\…).
const args = (list) => (WIN ? list.map((a) => (/[\s&()^%!]/.test(a) ? `"${a}"` : a)) : list);

function run(cmd, argv, label) {
  log(`· ${label}…`);
  const r = spawnSync(cmd, args(argv), { cwd: ROOT, env, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`${label} ha fallado. Revisa el mensaje anterior.`);
}

function newestMtime(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return t;
}

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) out.push(`http://${a.address}:${PORT}`);
    }
  }
  return [...new Set(out)];
}

/** Mismo formato que src/worker/local-auth.ts: base64url(JSON) + '.' + HMAC-SHA256("pair:"+payload). */
function pairingToken(secret, name, ttl = 600) {
  const payload = Buffer.from(JSON.stringify({ jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + ttl, n: name })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`pair:${payload}`).digest('base64url')}`;
}

function openBrowser(url) {
  const [cmd, args] = WIN ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false }).unref();
}

// ───────────── 1. Requisitos e instalación ─────────────
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) fail(`Necesitas Node.js 20 o superior (tienes ${process.versions.node}). Descárgalo en https://nodejs.org`);
log('\nMISE · Private Chef OS — modo local\n');
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'wrangler'))) run('npm', ['ci', '--no-audit', '--no-fund'], 'Instalando componentes (solo la primera vez, unos minutos)');
const built = path.join(ROOT, 'dist', 'client', 'index.html');
if (!fs.existsSync(built) || !fs.existsSync(path.join(ROOT, 'public', 'ocr', 'worker.min.js')) || newestMtime(path.join(ROOT, 'src')) > fs.statSync(built).mtimeMs) {
  run('npm', ['run', 'build:web'], 'Preparando la interfaz');
}

// ───────────── 2. Datos, secreto y configuración ─────────────
fs.mkdirSync(DATA, { recursive: true });
const secretFile = path.join(DATA, 'secreto.txt');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();
const configFile = path.join(DATA, 'config.json');
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ carpeta_copias: path.join(path.dirname(DATA), 'copias-locales'), copias_a_conservar: 30 }, null, 2));
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const backupDir = process.env.MISE_COPIAS ?? config.carpeta_copias;
const urls = lanUrls();
// El secreto viaja en un fichero (no en la línea de comandos)
const envFile = path.join(DATA, 'entorno.env');
fs.writeFileSync(envFile, `AUTH_MODE=local\nLOCAL_SECRET=${SECRET}\nLOCAL_LAN_URLS=${urls.join(',')}\nAPP_ENV=local-app\n`, { mode: 0o600 });

const base = `http://127.0.0.1:${PORT}`;
if (await fetch(`${base}/api/health`).then(() => true, () => false)) {
  fail(`MISE ya está abierto en otra ventana (${base}). Ciérrala antes de volver a arrancarlo.`);
}

run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'mise-db-local', '--local', '--env', 'local', '--persist-to', path.join(DATA, 'db')], 'Actualizando la base de datos');

// ───────────── 3. Servidor ─────────────
log('· Arrancando MISE…');
const server = spawn('npx', args(['wrangler', 'dev', '--env', 'local', '--local', '--ip', '0.0.0.0', '--port', String(PORT), '--persist-to', path.join(DATA, 'db'),
  '--env-file', envFile, '--show-interactive-dev-session=false', '--log-level', 'warn']), { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'], shell: WIN, detached: !WIN });
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  log('\nCerrando MISE…');
  try {
    if (WIN) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-server.pid, 'SIGTERM');
  } catch { /* ya cerrado */ }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGHUP', stop); // cerrar la ventana de Terminal / consola
server.on('exit', (code) => { if (!stopping) fail(`El servidor se ha detenido (código ${code}).`); });

for (let i = 0; ; i++) {
  try { await fetch(`${base}/api/health`); break; } catch { /* aún arrancando */ }
  if (i > 120) fail('MISE no ha arrancado en 2 minutos.');
  await new Promise((r) => setTimeout(r, 1000));
}

// ───────────── 4. Copias de seguridad automáticas ─────────────
const sessionFile = path.join(DATA, '.sesion-copias');
async function backupSession() {
  if (fs.existsSync(sessionFile)) {
    const c = fs.readFileSync(sessionFile, 'utf8').trim();
    if ((await fetch(`${base}/api/v1/me`, { headers: { cookie: c } })).ok) return c;
  }
  const res = await fetch(`${base}/emparejar?t=${encodeURIComponent(pairingToken(SECRET, 'Copias automáticas'))}`, { redirect: 'manual' });
  const c = (res.headers.get('set-cookie') ?? '').split(';')[0];
  if (!c) throw new Error('no se pudo autorizar las copias');
  fs.writeFileSync(sessionFile, c, { mode: 0o600 });
  return c;
}
async function backup() {
  try {
    const cookie = await backupSession();
    const res = await fetch(`${base}/api/v1/exports/backup.json?files=1`, { headers: { cookie } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
    const file = path.join(backupDir, `MISE_copia_${stamp}.json`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    const keep = Number(config.copias_a_conservar ?? 30);
    const old = fs.readdirSync(backupDir).filter((f) => /^MISE_copia_.*\.json$/.test(f)).sort().reverse().slice(keep);
    for (const f of old) fs.unlinkSync(path.join(backupDir, f));
    log(`· Copia de seguridad guardada: ${file}`);
  } catch (e) {
    console.error(`! No se pudo hacer la copia automática: ${e.message}`);
  }
}
await backup();
setInterval(backup, 24 * 3600 * 1000);

// ───────────── 5. Abrir y explicar ─────────────
const thisDevice = WIN ? 'Este ordenador (Windows)' : process.platform === 'darwin' ? 'Este ordenador (Mac)' : 'Este ordenador';
const firstUrl = `${base}/emparejar?t=${encodeURIComponent(pairingToken(SECRET, thisDevice))}`;
log('\n──────────────────────────────────────────────────────────────');
log('  MISE está en marcha en este ordenador.');
log(`  · En este ordenador:  ${base}`);
if (urls.length) log(`  · Desde el iPhone (misma wifi): ${urls.join('  ')}`);
else log('  · No se ha detectado red wifi/local: el iPhone no podrá conectarse.');
log('  · Para conectar el iPhone: en MISE abre Ajustes → Seguridad →');
log('    «Conectar un dispositivo» y escanea el código QR con la cámara.');
log(`  · Copias automáticas en: ${backupDir}`);
log('  · Para cerrar MISE: cierra esta ventana (o pulsa Ctrl+C).');
log('──────────────────────────────────────────────────────────────\n');
if (OPEN) openBrowser(firstUrl);
else log(`Enlace de emparejamiento para este ordenador (10 min): ${firstUrl}`);
