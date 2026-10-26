#!/usr/bin/env node
// Smoke del modo local: arranca el lanzador real (scripts/local.mjs) con datos temporales y comprueba
// bloqueo sin emparejar, emparejamiento de un solo uso, copia automática, reinicio con persistencia y cierre limpio.
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mise-local-'));
const DATA = path.join(TMP, 'datos-locales');
let failed = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failed++; };

function start() {
  const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'local.mjs'), '--no-abrir'], { cwd: ROOT, env: { ...process.env, MISE_PORT: String(PORT), MISE_DATOS: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  return new Promise((resolve, reject) => {
    const t = setInterval(() => { if (out.includes('Enlace de emparejamiento')) { clearInterval(t); resolve({ p, out: () => out }); } }, 500);
    p.on('exit', (c) => { clearInterval(t); reject(new Error(`el lanzador terminó (${c}):\n${out}`)); });
    setTimeout(() => { clearInterval(t); reject(new Error(`timeout:\n${out}`)); }, 240_000);
  });
}
async function stop(p) {
  const done = new Promise((r) => p.once('exit', r));
  p.kill('SIGHUP');
  await done;
  await new Promise((r) => setTimeout(r, 1500));
  return fetch(`${BASE}/api/health`).then(() => false, () => true);
}
function token(name) {
  const secret = fs.readFileSync(path.join(DATA, 'secreto.txt'), 'utf8').trim();
  const payload = Buffer.from(JSON.stringify({ jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 600, n: name })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`pair:${payload}`).digest('base64url')}`;
}

try {
  let s = await start();
  check((await fetch(`${BASE}/`)).status === 401, 'página sin emparejar → 401');
  check((await fetch(`${BASE}/api/v1/events`)).status === 401, 'API sin emparejar → 401');
  check((await fetch(`${BASE}/api/v1/me`, { headers: { 'cf-access-authenticated-user-email': 'propietario@mise.local' } })).status === 401, 'cabecera de identidad falsificada → 401');
  const fileMode = fs.statSync(path.join(DATA, 'secreto.txt')).mode & 0o777;
  check(process.platform === 'win32' || fileMode === 0o600, `secreto con permisos 600 (${fileMode.toString(8)})`);
  const copias = path.join(TMP, 'copias-locales');
  check(fs.existsSync(copias) && fs.readdirSync(copias).some((f) => /^MISE_copia_.*\.json$/.test(f)), 'copia automática al arrancar');
  const t = token('Smoke');
  const pr = await fetch(`${BASE}/emparejar?t=${encodeURIComponent(t)}`, { redirect: 'manual' });
  const cookie = (pr.headers.get('set-cookie') ?? '').split(';')[0];
  check(pr.status === 302 && /HttpOnly/.test(pr.headers.get('set-cookie') ?? ''), 'emparejamiento → cookie HttpOnly');
  check((await fetch(`${BASE}/emparejar?t=${encodeURIComponent(t)}`, { redirect: 'manual' })).status === 401, 'token reutilizado → 401');
  const h = { cookie, 'x-mise-csrf': '1', 'content-type': 'application/json', origin: BASE };
  check((await fetch(`${BASE}/api/v1/suppliers`, { method: 'POST', headers: h, body: '{"name":"Proveedor smoke"}' })).status === 201, 'alta de datos con dispositivo emparejado');
  check(await stop(s.p), 'cierre limpio (puerto liberado)');
  s = await start();
  const sup = await (await fetch(`${BASE}/api/v1/suppliers`, { headers: { cookie } })).json();
  check(Array.isArray(sup) && sup.some((x) => x.name === 'Proveedor smoke'), 'datos y emparejamiento persisten tras reiniciar');
  check(await stop(s.p), 'cierre limpio tras reinicio');
} catch (e) {
  console.error(e.message);
  failed++;
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} comprobaciones FALLIDAS` : '\nModo local: todas las comprobaciones PASS');
process.exit(failed ? 1 : 0);
