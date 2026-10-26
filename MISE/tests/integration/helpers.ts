import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { exports } from 'cloudflare:workers';
import { vi } from 'vitest';

export const TEAM = 'https://mise-test.cloudflareaccess.com';
export const AUD = 'test-aud-123';
export const OWNER = 'chef@example.com';

let keys: { privateKey: CryptoKey; publicKey: CryptoKey } | null = null;
let attackerKeys: { privateKey: CryptoKey; publicKey: CryptoKey } | null = null;

/** Simula el endpoint de certificados de Cloudflare Access (JWKS) para la verificación de firma. */
export async function installAccessMock() {
  keys ??= await generateKeyPair('RS256', { extractable: true });
  attackerKeys ??= await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${TEAM}/cdn-cgi/access/certs`) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
    return realFetch(input as RequestInfo, init);
  });
}

export async function token(opts: { email?: string; aud?: string; iss?: string; exp?: string | number; attacker?: boolean; sub?: string } = {}) {
  const k = opts.attacker ? attackerKeys! : keys!;
  return new SignJWT({ email: opts.email ?? OWNER })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? TEAM)
    .setAudience(opts.aud ?? AUD)
    .setSubject(opts.sub ?? `sub-${opts.email ?? OWNER}`)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(k.privateKey);
}

export interface CallOpts { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string>; raw?: BodyInit }

export async function call(path: string, o: CallOpts = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  const t = o.token === undefined ? await token() : o.token;
  if (t) headers['cf-access-jwt-assertion'] = t;
  const method = o.method ?? (o.body !== undefined || o.raw ? 'POST' : 'GET');
  if (method !== 'GET' && !('x-mise-csrf' in headers)) headers['x-mise-csrf'] = '1';
  let body: BodyInit | undefined = o.raw;
  if (o.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(o.body); }
  const res = await (exports as any).default.fetch(new Request(`https://mise.example.com${path}`, { method, headers, body }));
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status as number, data: data as any, headers: res.headers as Headers };
}

/** Atajo: crea el catálogo mínimo del fixture (calabaza merma 20 + nata) y devuelve ids. */
export async function seedBasic() {
  const sup = (await call('/api/v1/suppliers', { body: { name: 'Mercado Ficticio' } })).data;
  const cal = (await call('/api/v1/ingredients', { body: { name: 'Calabaza', base_unit: 'g', waste_pct: '20', allergens: [], preferred_supplier_id: sup.id } })).data;
  const nata = (await call('/api/v1/ingredients', { body: { name: 'Nata', base_unit: 'ml', waste_pct: '0', allergens: ['milk'] } })).data;
  const f1 = (await call('/api/v1/purchase-formats', { body: { ingredient_id: cal.id, supplier_id: sup.id, label: 'Bolsa 1 kg', pack_quantity_base: '1000', initial_price: '2.40', effective_at: '2026-10-01' } })).data;
  const f2 = (await call('/api/v1/purchase-formats', { body: { ingredient_id: nata.id, supplier_id: sup.id, label: 'Brick 1 L', pack_quantity_base: '1000', initial_price: '4.20', effective_at: '2026-10-01' } })).data;
  const rec = (await call('/api/v1/recipes', { body: { name: 'Crema de calabaza', portions: '4', lines: [
    { ingredient_id: cal.id, quantity: '500', unit: 'g' }, { ingredient_id: nata.id, quantity: '180', unit: 'ml' },
  ] } })).data;
  const client = (await call('/api/v1/clients', { body: { display_name: 'Cliente Sintético' } })).data;
  return { sup, cal, nata, f1, f2, rec, client };
}
