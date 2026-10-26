import type { Env } from './env';
import { ApiError } from './http';

/**
 * Modo local (ordenador propio + iPhone por wifi), AUTH_MODE=local.
 * - No se confía en la red ni en la cabecera Host: TODO dispositivo, incluido el propio ordenador,
 *   necesita una sesión de dispositivo firmada (HMAC-SHA256 con LOCAL_SECRET) y no revocada en la BD.
 * - Las sesiones se obtienen con un token de emparejamiento firmado, caducable (10 min) y de un solo uso,
 *   que muestra el ordenador como QR (Ajustes → Seguridad) o que genera el lanzador al arrancar.
 */
export const LOCAL_OWNER = { subject: 'local-owner', email: 'propietario@mise.local' };
export const SESSION_COOKIE = 'mise_dispositivo';
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function secretOf(env: Env): string {
  const s = env.LOCAL_SECRET ?? '';
  if (s.length < 32) throw new ApiError(500, 'auth_not_configured');
  return s;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Token de emparejamiento: base64url(JSON {jti, exp, n}) + '.' + firma. Mismo formato que genera scripts/local.mjs. */
export async function createPairingToken(env: Env, name: string, ttlSeconds = 600): Promise<{ token: string; expires_at: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(enc.encode(JSON.stringify({ jti: crypto.randomUUID(), exp, n: name.slice(0, 60) })));
  return { token: `${payload}.${await hmac(secretOf(env), `pair:${payload}`)}`, expires_at: new Date(exp * 1000).toISOString() };
}

export async function verifyPairingToken(env: Env, token: string): Promise<{ jti: string; n: string }> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !timingSafeEqual(sig, await hmac(secretOf(env), `pair:${payload}`))) throw new ApiError(401, 'invalid_pairing_token');
  let data: { jti?: string; exp?: number; n?: string };
  try { data = JSON.parse(new TextDecoder().decode(fromB64url(payload))); } catch { throw new ApiError(401, 'invalid_pairing_token'); }
  if (!data.jti || !data.exp || data.exp < Math.floor(Date.now() / 1000)) throw new ApiError(401, 'pairing_token_expired');
  return { jti: data.jti, n: data.n ?? 'Dispositivo' };
}

export async function sessionValue(env: Env, deviceId: string) {
  return `${deviceId}.${await hmac(secretOf(env), `device:${deviceId}`)}`;
}

function cookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/** Devuelve el id de dispositivo si la cookie es auténtica y el dispositivo no está revocado. */
export async function verifyDeviceSession(req: Request, env: Env): Promise<string> {
  secretOf(env); // configuración incompleta → 500, nunca acceso
  const raw = cookie(req, SESSION_COOKIE);
  if (!raw) throw new ApiError(401, 'device_not_paired');
  const [deviceId, sig] = raw.split('.');
  if (!deviceId || !sig || !timingSafeEqual(sig, await hmac(secretOf(env), `device:${deviceId}`))) throw new ApiError(401, 'device_not_paired');
  const row = await env.DB.prepare('SELECT id, revoked_at, last_seen_at FROM paired_devices WHERE id = ?').bind(deviceId).first<{ id: string; revoked_at: string | null; last_seen_at: string | null }>();
  if (!row || row.revoked_at) throw new ApiError(401, 'device_not_paired');
  // actualiza "visto por última vez" como mucho una vez por hora
  if (!row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) > 3_600_000) {
    await env.DB.prepare('UPDATE paired_devices SET last_seen_at = ? WHERE id = ?').bind(new Date().toISOString(), deviceId).run();
  }
  return deviceId;
}

/** GET /emparejar?t=…: consume el token (un solo uso) y crea la sesión del dispositivo. */
export async function handlePairing(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? '';
  let tok: { jti: string; n: string };
  try { tok = await verifyPairingToken(env, token); } catch (e) { return unpairedPage(e instanceof ApiError ? e.code : 'invalid_pairing_token', 401); }
  // Si este navegador ya está emparejado, no se crea otro dispositivo
  let existing: string | null = null;
  try { existing = await verifyDeviceSession(req, env); } catch { existing = null; }
  const used = await env.DB.prepare('INSERT OR IGNORE INTO pairing_tokens_used (jti, device_id) VALUES (?, ?)').bind(tok.jti, existing).run();
  if (!used.meta.changes) return unpairedPage('pairing_token_used', 401);
  let deviceId = existing;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 200);
    const name = tok.n !== 'Dispositivo' ? tok.n : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Dispositivo';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO paired_devices (id, name, user_agent, last_seen_at) VALUES (?, ?, ?, ?)').bind(deviceId, name, ua, new Date().toISOString()),
      env.DB.prepare('UPDATE pairing_tokens_used SET device_id = ? WHERE jti = ?').bind(deviceId, tok.jti),
    ]);
  }
  const maxAge = 180 * 24 * 3600;
  return new Response(null, {
    status: 302,
    headers: {
      location: '/',
      'set-cookie': `${SESSION_COOKIE}=${await sessionValue(env, deviceId)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`,
      'cache-control': 'no-store',
    },
  });
}

/** Página sin datos para dispositivos no emparejados (ES/CA). */
export function unpairedPage(code: string, status = 401): Response {
  const msg: Record<string, [string, string]> = {
    device_not_paired: ['Este dispositivo aún no está emparejado.', 'Aquest dispositiu encara no està emparellat.'],
    pairing_token_expired: ['El código de emparejamiento ha caducado (dura 10 minutos).', 'El codi d’emparellament ha caducat (dura 10 minuts).'],
    pairing_token_used: ['Este código ya se usó. Genera uno nuevo.', 'Aquest codi ja s’ha fet servir. Genera’n un de nou.'],
    invalid_pairing_token: ['El código de emparejamiento no es válido.', 'El codi d’emparellament no és vàlid.'],
  };
  const [es, ca] = msg[code] ?? msg.device_not_paired!;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>MISE · acceso privado</title>
<style>body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#f7f9f6;color:#172621;margin:0;padding:32px 20px}main{max-width:480px;margin:0 auto}h1{font-family:Georgia,serif;font-weight:500;font-size:34px;margin:0 0 4px}.k{letter-spacing:.2em;font-size:11px;color:#31674f;font-weight:700}.c{background:#fff;border:1px solid #dfe7e2;border-radius:14px;padding:18px;margin-top:18px}ol{padding-left:20px}</style></head>
<body><main><div class="k">PRIVATE CHEF OS</div><h1>MISE.</h1><div class="c"><strong>${es}</strong><ol><li>En el ordenador donde está MISE abre <b>Ajustes → Seguridad → Conectar un dispositivo</b>.</li><li>Escanea el código QR con la cámara de este dispositivo.</li></ol></div>
<div class="c" lang="ca"><strong>${ca}</strong><ol><li>A l’ordinador on hi ha MISE obre <b>Configuració → Seguretat → Connectar un dispositiu</b>.</li><li>Escaneja el codi QR amb la càmera d’aquest dispositiu.</li></ol></div></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
