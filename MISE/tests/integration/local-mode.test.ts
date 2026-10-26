import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import app from '../../src/worker/index';
import { createPairingToken, sessionValue } from '../../src/worker/local-auth';
import { call, installAccessMock, seedBasic } from './helpers';

const SECRET = 'k'.repeat(48);
const LOCAL = { ...(env as any), AUTH_MODE: 'local', LOCAL_SECRET: SECRET, LOCAL_LAN_URLS: 'http://192.168.1.20:8787' };
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

async function req(path: string, init: RequestInit & { cookie?: string; host?: string } = {}, e: any = LOCAL) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.method && init.method !== 'GET' && !headers.has('x-mise-csrf')) headers.set('x-mise-csrf', '1');
  const res = await app.fetch(new Request(`http://${init.host ?? '192.168.1.20:8787'}${path}`, { ...init, headers, redirect: 'manual' }), e, ctx);
  return res;
}
async function pair(name = 'Dispositivo', e: any = LOCAL) {
  const { token } = await createPairingToken(e, name);
  const res = await req(`/emparejar?t=${encodeURIComponent(token)}`, {}, e);
  expect(res.status).toBe(302);
  return { cookie: res.headers.get('set-cookie')!.split(';')[0]!, setCookie: res.headers.get('set-cookie')!, token };
}

describe('Modo local: acceso solo con dispositivo emparejado', () => {
  it('sin emparejar: página sin datos y API 401, aunque se falsifique Host=127.0.0.1', async () => {
    for (const host of ['192.168.1.20:8787', '127.0.0.1:8787', 'localhost:8787']) {
      const page = await req('/', { host });
      expect(page.status).toBe(401);
      const html = await page.text();
      expect(html).toContain('no está emparejado');
      expect(html).not.toContain('id="root"');
      expect((await req('/api/v1/events', { host })).status).toBe(401);
      expect((await req('/api/v1/exports/backup.json', { host })).status).toBe(401);
    }
  });

  it('emparejamiento: cookie HttpOnly/SameSite, token de un solo uso, caducado o falsificado rechazado', async () => {
    const { cookie, setCookie, token } = await pair('iPhone de prueba');
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const me = await req('/api/v1/me', { cookie });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ auth_mode: 'local_device', email: 'propietario@mise.local' });
    expect((await req('/', { cookie })).status).toBe(200);
    // reutilizar el token
    expect((await req(`/emparejar?t=${encodeURIComponent(token)}`)).status).toBe(401);
    // token firmado con otro secreto
    const { token: forged } = await createPairingToken({ ...LOCAL, LOCAL_SECRET: 'x'.repeat(48) } as any, 'x');
    expect((await req(`/emparejar?t=${encodeURIComponent(forged)}`)).status).toBe(401);
    // token caducado
    const { token: old } = await createPairingToken(LOCAL as any, 'x', -5);
    const r = await req(`/emparejar?t=${encodeURIComponent(old)}`);
    expect(r.status).toBe(401);
    expect(await r.text()).toContain('caducado');
    // cookie inventada / firma alterada
    expect((await req('/api/v1/me', { cookie: 'mise_dispositivo=abc.def' })).status).toBe(401);
    expect((await req('/api/v1/me', { cookie: cookie.slice(0, -2) + 'xx' })).status).toBe(401);
    // cookie válida de un id inexistente en BD
    expect((await req('/api/v1/me', { cookie: `mise_dispositivo=${await sessionValue(LOCAL as any, 'no-existe')}` })).status).toBe(401);
  });

  it('el mismo navegador ya emparejado no crea otro dispositivo; QR con URLs de la wifi; revocación inmediata', async () => {
    const a = await pair('Mac');
    const before = (await (await req('/api/v1/devices', { cookie: a.cookie })).json()) as any;
    const { token } = await createPairingToken(LOCAL as any, 'Mac');
    expect((await req(`/emparejar?t=${encodeURIComponent(token)}`, { cookie: a.cookie })).status).toBe(302);
    const after = (await (await req('/api/v1/devices', { cookie: a.cookie })).json()) as any;
    expect(after.devices.length).toBe(before.devices.length);
    const qr = (await (await req('/api/v1/devices/pairing', { method: 'POST', cookie: a.cookie, body: JSON.stringify({ name: 'iPhone' }), headers: { 'content-type': 'application/json' } })).json()) as any;
    expect(qr.urls[0]).toMatch(/^http:\/\/192\.168\.1\.20:8787\/emparejar\?t=/);
    expect(qr.urls[0]).toBe(`http://192.168.1.20:8787${qr.path}`);
    // URLs de red no válidas en la configuración se descartan (el QR nunca apunta a otro sitio)
    const bogus = { ...LOCAL, LOCAL_LAN_URLS: 'https://evil.example,javascript:alert(1), http://10.0.0.5:8787 ' };
    const qr2 = (await (await req('/api/v1/devices/pairing', { method: 'POST', cookie: a.cookie, body: '{}', headers: { 'content-type': 'application/json' } }, bogus)).json()) as any;
    expect(qr2.urls).toEqual([`http://10.0.0.5:8787${qr2.path}`]);
    const b = await pair('iPhone');
    const list = (await (await req('/api/v1/devices', { cookie: a.cookie })).json()) as any;
    const iphone = list.devices.find((d: any) => d.name === 'iPhone' && !d.revoked_at);
    expect((await req(`/api/v1/devices/${iphone.id}`, { method: 'DELETE', cookie: a.cookie })).status).toBe(200);
    expect((await req('/api/v1/me', { cookie: b.cookie })).status).toBe(401);
    expect((await req('/api/v1/me', { cookie: a.cookie })).status).toBe(200);
    // renombrar y revocar el propio dispositivo
    const self = list.devices.find((d: any) => d.id === list.current);
    expect((await req(`/api/v1/devices/${self.id}`, { method: 'PATCH', cookie: a.cookie, body: '{"name":"Mac de casa"}', headers: { 'content-type': 'application/json' } })).status).toBe(200);
    const c = await pair('Otro');
    const lc = (await (await req('/api/v1/devices', { cookie: c.cookie })).json()) as any;
    const rv = await req(`/api/v1/devices/${lc.current}`, { method: 'DELETE', cookie: c.cookie });
    expect(await rv.json()).toEqual({ revoked: true, was_current: true });
    expect((await req('/api/v1/me', { cookie: c.cookie })).status).toBe(401);
    // CSRF sigue activo en modo local
    expect((await req('/api/v1/clients', { method: 'POST', cookie: a.cookie, body: '{"display_name":"x"}', headers: { 'content-type': 'application/json', 'x-mise-csrf': '0' } })).status).toBe(403);
  });

  it('sin LOCAL_SECRET → error seguro; en modo Access /emparejar y /devices no existen', async () => {
    expect((await req('/api/v1/me', {}, { ...LOCAL, LOCAL_SECRET: '' })).status).toBe(500);
    const accessEnv = { ...(env as any) };
    expect((await req('/emparejar?t=x', {}, accessEnv)).status).toBe(401);
    expect((await req('/api/v1/devices', {}, accessEnv)).status).toBe(401);
  });

  it('BACKUP-03: copia hecha en otra instalación (otro ordenador, o Cloudflare → local) se restaura entera', async () => {
    const { cookie } = await pair('Mac nuevo');
    const json = { 'content-type': 'application/json' };
    const sup = (await (await req('/api/v1/suppliers', { method: 'POST', cookie, body: '{"name":"Proveedor de la otra instalación"}', headers: json })).json()) as any;
    const backup = (await (await req('/api/v1/exports/backup.json?files=1', { cookie })).json()) as any;
    // En otra instalación el usuario tiene otro id: la auditoría de la copia apunta a un usuario que aquí no existe
    backup.tables.audit_log = backup.tables.audit_log.map((a: any) => ({ ...a, actor_user_id: '00000000-dead-4bee-8000-000000000000' }));
    expect(backup.tables.audit_log.length).toBeGreaterThan(0);
    const { sha256Hex } = await import('../../src/worker/services/backup');
    backup.checksum_sha256 = await sha256Hex(JSON.stringify({ tables: backup.tables, settings: backup.settings ?? null }));
    expect((await (await req('/api/v1/restore/preview', { method: 'POST', cookie, body: JSON.stringify(backup), headers: json })).json()) as any).toMatchObject({ ok: true });
    await req(`/api/v1/suppliers/${sup.id}`, { method: 'DELETE', cookie });
    const r = await req('/api/v1/restore/commit', { method: 'POST', cookie, body: JSON.stringify({ backup, confirm: 'RESTAURAR' }), headers: json });
    expect(r.status, await r.clone().text()).toBe(200);
    const names = ((await (await req('/api/v1/suppliers', { cookie })).json()) as any[]).map((x) => x.name);
    expect(names).toContain('Proveedor de la otra instalación');
  });
});
