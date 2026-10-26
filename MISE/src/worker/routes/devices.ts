import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ApiError, body } from '../http';
import { createPairingToken } from '../local-auth';

/** Gestión de dispositivos emparejados (solo modo local). */
export const devices = new Hono<AppEnv>();

devices.use('/devices/*', async (c, next) => {
  if (c.env.AUTH_MODE !== 'local') throw new ApiError(404, 'not_found');
  await next();
});
devices.use('/devices', async (c, next) => {
  if (c.env.AUTH_MODE !== 'local') throw new ApiError(404, 'not_found');
  await next();
});

devices.get('/devices', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, name, created_at, last_seen_at, revoked_at FROM paired_devices ORDER BY created_at DESC').all();
  return c.json({ current: c.get('deviceId') ?? null, devices: rows.results });
});

/** Genera un código de emparejamiento (10 min, un solo uso) con las URLs de la red local para el QR. */
devices.post('/devices/pairing', async (c) => {
  const d = await body(c, z.object({ name: z.string().trim().max(60).optional() }));
  const { token, expires_at } = await createPairingToken(c.env, d.name || 'Dispositivo');
  const bases = (c.env.LOCAL_LAN_URLS ?? '').split(',').map((s) => s.trim()).filter((s) => /^http:\/\/[\d.]+:\d+$/.test(s));
  const path = `/emparejar?t=${encodeURIComponent(token)}`;
  return c.json({ expires_at, path, urls: bases.map((b) => `${b}${path}`) });
});

devices.patch('/devices/:id', async (c) => {
  const d = await body(c, z.object({ name: z.string().trim().min(1).max(60) }));
  const r = await c.env.DB.prepare('UPDATE paired_devices SET name = ? WHERE id = ?').bind(d.name, c.req.param('id')).run();
  if (!r.meta.changes) throw new ApiError(404, 'not_found');
  return c.json({ ok: true });
});

devices.delete('/devices/:id', async (c) => {
  const r = await c.env.DB.prepare('UPDATE paired_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(new Date().toISOString(), c.req.param('id')).run();
  if (!r.meta.changes) throw new ApiError(404, 'not_found');
  return c.json({ revoked: true, was_current: c.req.param('id') === c.get('deviceId') });
});
