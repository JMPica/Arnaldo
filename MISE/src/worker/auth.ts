import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthUser, Env } from './env';
import { ApiError } from './http';
import { uuid } from './db';

/**
 * Autenticación de MISE.
 *  - Producción/staging: Cloudflare Access delante de TODO el Worker + verificación aquí del JWT firmado
 *    (firma RS256 contra los certificados del equipo, issuer, audience y expiración) + allowlist de emails.
 *  - Desarrollo: identidad simulada SOLO si AUTH_MODE=dev y la petición llega por loopback.
 * Si falta configuración → error seguro (nunca acceso público por defecto).
 */

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`), { cacheMaxAge: 10 * 60 * 1000, cooldownDuration: 30_000 });
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function allowlist(env: Env): string[] {
  return (env.OWNER_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface Identity {
  subject: string;
  email: string;
}

export async function verifyIdentity(req: Request, env: Env): Promise<Identity> {
  const mode = env.AUTH_MODE;
  const owners = allowlist(env);
  if (mode === 'dev') {
    const host = new URL(req.url).hostname;
    if (!LOOPBACK.has(host) || env.APP_ENV === 'production') throw new ApiError(403, 'dev_auth_not_allowed');
    const email = (env.DEV_USER_EMAIL ?? '').toLowerCase();
    if (!email || !owners.includes(email)) throw new ApiError(500, 'auth_not_configured');
    return { subject: `dev:${email}`, email };
  }
  if (mode !== 'access') throw new ApiError(500, 'auth_not_configured');
  const team = (env.ACCESS_TEAM_DOMAIN ?? '').replace(/\/$/, '');
  const aud = env.ACCESS_AUD ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud || owners.length === 0) throw new ApiError(500, 'auth_not_configured');
  const token = req.headers.get('cf-access-jwt-assertion') ?? cookie(req, 'CF_Authorization');
  if (!token) throw new ApiError(401, 'unauthenticated');
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwksFor(team), { issuer: team, audience: aud, algorithms: ['RS256'], clockTolerance: 30 }));
  } catch {
    throw new ApiError(401, 'invalid_token');
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!payload.sub || !email) throw new ApiError(401, 'invalid_token');
  if (!owners.includes(email)) throw new ApiError(403, 'forbidden');
  return { subject: payload.sub, email };
}

/**
 * Resuelve el usuario de la aplicación. El primer email de OWNER_EMAILS es el propietario; los demás
 * de la allowlist quedan preparados como colaboradores del mismo propietario (ampliación futura).
 * owner_id NUNCA se toma de la petición.
 */
export async function resolveUser(db: D1Database, env: Env, identity: Identity): Promise<AuthUser> {
  const existing = await db.prepare('SELECT id, email, owner_id, role, active FROM app_users WHERE email = ?').bind(identity.email).first<{ id: string; email: string; owner_id: string; role: 'owner' | 'collaborator'; active: number }>();
  if (existing) {
    if (!existing.active) throw new ApiError(403, 'forbidden');
    return { id: existing.id, email: existing.email, owner_id: existing.owner_id, role: existing.role };
  }
  const owners = allowlist(env);
  const primaryEmail = owners[0]!;
  let ownerId: string;
  let role: 'owner' | 'collaborator';
  if (identity.email === primaryEmail) {
    ownerId = uuid();
    role = 'owner';
  } else {
    const primary = await db.prepare("SELECT id FROM app_users WHERE email = ? AND role = 'owner'").bind(primaryEmail).first<{ id: string }>();
    if (!primary) throw new ApiError(403, 'owner_not_initialized');
    ownerId = primary.id;
    role = 'collaborator';
  }
  const id = role === 'owner' ? ownerId : uuid();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO app_users (id, access_subject, email, role, owner_id) VALUES (?,?,?,?,?)').bind(id, identity.subject, identity.email, role, ownerId),
    db.prepare('INSERT OR IGNORE INTO settings (owner_id) SELECT ? WHERE ? = ?').bind(ownerId, role, 'owner'),
  ]);
  const row = await db.prepare('SELECT id, email, owner_id, role FROM app_users WHERE email = ?').bind(identity.email).first<AuthUser>();
  return row!;
}
