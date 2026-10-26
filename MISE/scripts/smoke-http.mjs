#!/usr/bin/env node
// Smoke de privacidad (SEC-01/SEC-02/OPS-03). Uso: node scripts/smoke-http.mjs https://mise.<cuenta>.workers.dev
// Comprueba SIN sesión que la app, la API, los ficheros y los recursos no entregan datos, y que cabeceras
// o tokens falsificados se rechazan. Válido contra local (modo access) y contra el despliegue real.
const base = (process.argv[2] ?? 'http://127.0.0.1:8789').replace(/\/$/, '');
const paths = ['/', '/eventos', '/api/health', '/api/v1/me', '/api/v1/events', '/api/v1/clients', '/api/v1/documents', '/api/v1/documents/00000000-0000-0000-0000-000000000000/file', '/api/v1/exports/backup.json', '/api/v1/exports/csv/clients', '/manifest.webmanifest', '/sw.js', '/ocr/worker.min.js'];
const fakeJwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0.eyJlbWFpbCI6ImNoZWZAZXhhbXBsZS5jb20iLCJzdWIiOiJ4In0.ZmFrZQ';
const cases = [
  ['sin sesión', {}],
  ['cabecera de email falsificada', { 'cf-access-authenticated-user-email': 'chef@example.com' }],
  ['JWT falso en cabecera', { 'cf-access-jwt-assertion': fakeJwt }],
  ['JWT falso en cookie', { cookie: `CF_Authorization=${fakeJwt}` }],
];
let fail = 0;
for (const [label, headers] of cases) {
  for (const p of paths) {
    const res = await fetch(base + p, { headers, redirect: 'manual' });
    const body = await res.text();
    const leaked = /chef@|display_name|location_private|"tables"|<div id="root">/.test(body);
    // 401/403 del Worker, o 302/303 hacia el login de Cloudflare Access (despliegue real)
    const blocked = [401, 403].includes(res.status) || ([302, 303].includes(res.status) && /cloudflareaccess\.com/.test(res.headers.get('location') ?? ''));
    const ok = blocked && !leaked;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(res.status).padEnd(3)} ${label.padEnd(31)} ${p}`);
  }
}
// Mutación cross-site sin CSRF
const post = await fetch(base + '/api/v1/clients', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{"display_name":"x"}', redirect: 'manual' });
console.log(`${[401, 403, 302, 303].includes(post.status) ? 'PASS' : 'FAIL'}  ${post.status} POST cross-site sin sesión`);
if (![401, 403, 302, 303].includes(post.status)) fail++;
console.log(fail ? `\n${fail} comprobaciones FALLIDAS` : '\nTodas las comprobaciones de privacidad: PASS');
process.exit(fail ? 1 : 0);
