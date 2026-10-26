import { Hono } from 'hono';
import { resolveUser, verifyIdentity } from './auth';
import { LOCAL_OWNER, handlePairing, unpairedPage, verifyDeviceSession } from './local-auth';
import { devices } from './routes/devices';
import type { AppEnv } from './env';
import { ApiError, errorResponse } from './http';
import { catalog } from './routes/catalog';
import { data } from './routes/data';
import { documents } from './routes/documents';
import { events } from './routes/events';
import { insights } from './routes/insights';
import { purchasing } from './routes/purchasing';
import { recipes } from './routes/recipes';

const app = new Hono<AppEnv>();

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Cabeceras de seguridad en TODAS las respuestas. */
app.use('*', async (c, next) => {
  await next();
  const h = c.res.headers;
  if (!h.has('content-security-policy')) h.set('content-security-policy', CSP);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'no-referrer');
  h.set('x-frame-options', h.has('content-security-policy') && /frame-ancestors 'self'/.test(h.get('content-security-policy') ?? '') ? 'SAMEORIGIN' : 'DENY');
  h.set('permissions-policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  h.set('cross-origin-opener-policy', 'same-origin');
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
});

app.onError((err) => errorResponse(err));

/** Modo local: emparejamiento de dispositivos (única ruta accesible sin sesión, no revela datos). */
app.get('/emparejar', async (c, next) => {
  if (c.env.AUTH_MODE !== 'local') return next();
  return handlePairing(c.req.raw, c.env);
});

/** Autenticación obligatoria para TODO (API, ficheros privados y la propia SPA). */
app.use('*', async (c, next) => {
  if (c.env.AUTH_MODE === 'local') {
    try {
      c.set('deviceId', await verifyDeviceSession(c.req.raw, c.env));
    } catch (e) {
      // Fuera de la API se muestra una página sin datos con instrucciones de emparejamiento
      if (!new URL(c.req.url).pathname.startsWith('/api/') && !(e instanceof ApiError && e.status === 500)) return unpairedPage('device_not_paired');
      throw e;
    }
    c.set('user', await resolveUser(c.env.DB, { ...c.env, OWNER_EMAILS: LOCAL_OWNER.email }, LOCAL_OWNER));
    return next();
  }
  const identity = await verifyIdentity(c.req.raw, c.env);
  const user = await resolveUser(c.env.DB, c.env, identity);
  c.set('user', user);
  await next();
});

/**
 * CSRF: toda mutación exige JSON/multipart + cabecera propia (fuerza preflight CORS, que no se concede)
 * y, si el navegador envía Origin, que coincida con el host.
 */
app.use('/api/*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD') {
    if (c.req.header('x-mise-csrf') !== '1') throw new ApiError(403, 'csrf_header_required');
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) throw new ApiError(403, 'cross_origin_forbidden');
  }
  await next();
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

const v1 = new Hono<AppEnv>();
v1.route('/', insights);
v1.route('/', catalog);
v1.route('/', recipes);
v1.route('/', events);
v1.route('/', purchasing);
v1.route('/', data);
v1.route('/', documents);
v1.route('/', devices);
v1.all('*', () => { throw new ApiError(404, 'not_found'); });
app.route('/api/v1', v1);
app.all('/api/*', () => { throw new ApiError(404, 'not_found'); });

/** SPA y recursos estáticos, servidos SOLO tras autenticar (run_worker_first). */
app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  const out = new Response(res.body, res);
  const path = new URL(c.req.url).pathname;
  out.headers.set('cache-control', path.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'no-store');
  return out;
});

export default app;
