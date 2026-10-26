import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { call, installAccessMock, token } from './helpers';

beforeAll(installAccessMock);

describe('SEC-01 visitante anónimo bloqueado (app, API, ficheros)', () => {
  for (const path of ['/', '/eventos', '/api/v1/events', '/api/v1/clients', '/api/v1/documents', '/api/v1/documents/x/file', '/api/v1/exports/backup.json', '/api/health', '/assets/index.js']) {
    it(`GET ${path} sin token → 401 sin datos`, async () => {
      const r = await call(path, { token: null });
      expect(r.status).toBe(401);
      expect(JSON.stringify(r.data)).not.toMatch(/Cliente|chef@|<div id="root"/);
    });
  }
});

describe('SEC-02 tokens inválidos, usuario ajeno e IDOR', () => {
  it('firma falsa (otra clave) → 401', async () => {
    expect((await call('/api/v1/events', { token: await token({ attacker: true }) })).status).toBe(401);
  });
  it('audiencia incorrecta → 401', async () => {
    expect((await call('/api/v1/events', { token: await token({ aud: 'otra-app' }) })).status).toBe(401);
  });
  it('issuer incorrecto → 401', async () => {
    expect((await call('/api/v1/events', { token: await token({ iss: 'https://evil.cloudflareaccess.com' }) })).status).toBe(401);
  });
  it('token caducado → 401', async () => {
    expect((await call('/api/v1/events', { token: await token({ exp: Math.floor(Date.now() / 1000) - 3600 }) })).status).toBe(401);
  });
  it('token basura y cookie basura → 401', async () => {
    expect((await call('/api/v1/events', { token: 'abc.def.ghi' })).status).toBe(401);
    expect((await call('/api/v1/events', { token: null, headers: { cookie: 'CF_Authorization=xyz' } })).status).toBe(401);
  });
  it('email válido pero fuera de la allowlist → 403', async () => {
    expect((await call('/api/v1/events', { token: await token({ email: 'intruso@example.com' }) })).status).toBe(403);
  });
  it('cabecera de email falsificada sin JWT no autentica', async () => {
    expect((await call('/api/v1/events', { token: null, headers: { 'cf-access-authenticated-user-email': 'chef@example.com' } })).status).toBe(401);
  });
  it('IDOR: datos de otro propietario no son accesibles por id adivinado', async () => {
    // Otro propietario y su cliente creados directamente en BD
    const DB = (env as any).DB as D1Database;
    await DB.batch([
      DB.prepare("INSERT INTO app_users (id, access_subject, email, role, owner_id) VALUES ('other','sub-other','other@example.com','owner','other')"),
      DB.prepare("INSERT INTO clients (id, owner_id, display_name, notes_private) VALUES ('c-other','other','Cliente Ajeno','secreto')"),
      DB.prepare("INSERT INTO ingredients (id, owner_id, name, base_unit) VALUES ('i-other','other','Trufa ajena','g')"),
    ]);
    // inicializa el propietario legítimo
    expect((await call('/api/v1/me')).status).toBe(200);
    const r = await call('/api/v1/clients/c-other');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.data)).not.toContain('secreto');
    expect((await call('/api/v1/clients')).data.find((x: any) => x.id === 'c-other')).toBeUndefined();
    expect((await call('/api/v1/clients/c-other', { method: 'PATCH', body: { display_name: 'hack' } })).status).toBe(404);
    // enlazar el ingrediente ajeno en una receta propia → 404, y owner_id enviado por el cliente se ignora
    const rec = await call('/api/v1/recipes', { body: { name: 'Robo', portions: '1', lines: [{ ingredient_id: 'i-other', quantity: '1', unit: 'g' }] } });
    expect(rec.status).toBe(404);
    const cl = await call('/api/v1/clients', { body: { display_name: 'Mío', owner_id: 'other' } });
    expect(cl.status).toBe(201);
    const row = await DB.prepare('SELECT owner_id FROM clients WHERE id = ?').bind(cl.data.id).first<{ owner_id: string }>();
    expect(row!.owner_id).not.toBe('other');
  });
  it('colaborador de la allowlist accede al mismo propietario (preparado para roles)', async () => {
    const r = await call('/api/v1/me', { token: await token({ email: 'ayudante@example.com' }) });
    expect(r.status).toBe(200);
    expect(r.data.role).toBe('collaborator');
  });
});

describe('SEC-03 inyección SQL y XSS almacenado', () => {
  it('texto malicioso se guarda como dato literal y no altera consultas', async () => {
    const evil = `Robert'); DROP TABLE clients;-- <script>alert(1)</script><img src=x onerror=alert(1)>`;
    const r = await call('/api/v1/clients', { body: { display_name: evil, notes_private: evil } });
    expect(r.status).toBe(201);
    const back = await call(`/api/v1/clients/${r.data.id}`);
    expect(back.data.display_name).toBe(evil);
    expect((await call('/api/v1/clients')).status).toBe(200);
    const s = await call(`/api/v1/search?q=${encodeURIComponent("%' OR 1=1 --")}`);
    expect(s.status).toBe(200);
    expect(s.data).toEqual([]);
    // la API responde JSON (nunca HTML) y con CSP restrictiva
    expect(back.headers.get('content-type')).toContain('application/json');
    expect(back.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(back.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('CSRF, CORS y límites', () => {
  it('mutación sin cabecera CSRF → 403; Origin ajeno → 403', async () => {
    expect((await call('/api/v1/clients', { body: { display_name: 'x' }, headers: { 'x-mise-csrf': '0' } })).status).toBe(403);
    expect((await call('/api/v1/clients', { body: { display_name: 'x' }, headers: { origin: 'https://evil.example' } })).status).toBe(403);
  });
  it('no concede CORS', async () => {
    const r = await call('/api/v1/events', { headers: { origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('JSON malformado, tipo de contenido erróneo y payload excesivo', async () => {
    expect((await call('/api/v1/clients', { method: 'POST', raw: '{bad', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await call('/api/v1/clients', { method: 'POST', raw: 'display_name=x', headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status).toBe(415);
    expect((await call('/api/v1/clients', { body: { display_name: 'x'.repeat(2_000_000) } })).status).toBe(413);
    expect((await call('/api/v1/clients', { body: { display_name: '' } })).status).toBe(422);
  });
  it('ruta API desconocida → 404 JSON', async () => {
    const r = await call('/api/v1/nope');
    expect(r.status).toBe(404);
  });
});
