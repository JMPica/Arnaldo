// MISE service worker: cachea SOLO recursos estáticos con hash (/assets/*) y los del OCR local.
// Nunca cachea /api ni HTML (datos personales y sesión de Cloudflare Access).
const CACHE = 'mise-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!(url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ocr/'))) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && res.type === 'basic') c.put(e.request, res.clone());
    return res;
  }));
});
