import { now, type Env } from "./db";

// Autenticación del propietario:
//  - contraseña verificada con PBKDF2-SHA256 (el hash vive en un secreto del Worker),
//  - segundo factor TOTP opcional (RFC 6238),
//  - sesión con token aleatorio en cookie HttpOnly + Secure + SameSite=Strict;
//    en la base de datos solo se guarda el SHA-256 del token,
//  - límite de intentos fallidos por IP.

const enc = new TextEncoder();
const SESSION_DAYS = 30;
export const COOKIE = "apex_session";

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
}

export function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = 20000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2:${iterations}:${b64(salt)}:${b64(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  // formato pbkdf2:iteraciones:sal:hash (sin "$" para que ningún .env lo expanda)
  const [scheme, it, salt, hash] = stored.trim().split(/[:$]/);
  if (scheme !== "pbkdf2" || !it || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(it));
  return timingSafeEqual(got, unb64(hash));
}

// --- TOTP ---
function base32Decode(s: string): Uint8Array<ArrayBuffer> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totp(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 255;
    c = Math.floor(c / 256);
  }
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export async function verifyTotp(secret: string, code: string, t = now()): Promise<boolean> {
  const c = Math.floor(t / 30);
  for (const d of [-1, 0, 1]) if ((await totp(secret, c + d)) === code) return true;
  return false;
}

// --- Sesiones ---
function cookieValue(req: Request, name: string): string | null {
  const h = req.headers.get("cookie") ?? "";
  for (const part of h.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function createSession(env: Env, req: Request): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
  const t = now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t),
    env.DB.prepare("INSERT INTO sessions (id, created_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?)").bind(
      await sha256Hex(token),
      t,
      t + SESSION_DAYS * 86400,
      req.headers.get("cf-connecting-ip") ?? "",
      (req.headers.get("user-agent") ?? "").slice(0, 200),
    ),
  ]);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function isAuthenticated(env: Env, req: Request): Promise<boolean> {
  const token = cookieValue(req, COOKIE);
  if (!token || token.length < 20) return false;
  const r = await env.DB.prepare("SELECT expires_at FROM sessions WHERE id = ?").bind(await sha256Hex(token)).first<{ expires_at: number }>();
  return !!r && r.expires_at > now();
}

export async function destroySession(env: Env, req: Request): Promise<string> {
  const token = cookieValue(req, COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function destroyAllSessions(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions").run();
}

// --- Límite de intentos ---
const MAX_FAILS = 5;
const WINDOW = 15 * 60;

export async function tooManyAttempts(env: Env, ip: string): Promise<boolean> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ts > ?").bind(ip, now() - WINDOW).first<{ n: number }>();
  return (r?.n ?? 0) >= MAX_FAILS;
}

export async function recordFailure(env: Env, ip: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_attempts WHERE ts < ?").bind(now() - 86400),
    env.DB.prepare("INSERT INTO login_attempts (ip, ts) VALUES (?, ?)").bind(ip, now()),
  ]);
}

// Las peticiones que cambian estado deben venir del propio origen (CSRF).
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (!origin) return req.headers.get("x-apex") === "1";
  return origin === url.origin && req.headers.get("x-apex") === "1";
}

export async function bearerOk(req: Request, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 24) return false;
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return false;
  const a = enc.encode(await sha256Hex(h.slice(7)));
  const b = enc.encode(await sha256Hex(secret));
  return timingSafeEqual(a, b);
}
