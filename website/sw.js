// Keeps the site on the device for 30 days: pages are fetched fresh when online
// (falling back to the copy), static files are served from the copy.
const VERSION = 'ev-v5';
const MAX_AGE = 30 * 24 * 3600 * 1000;
const CORE = ['/', '/styles.css?v=5', '/main.js?v=5', '/vendor/anime-4.5.0.esm.min.js', '/vendor/lenis-1.3.27.mjs', '/vendor/lenis-1.3.27.css', '/assets/logo.svg', '/assets/home.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function put(req, res) {
  if (!res.ok || res.type === 'opaque') return res;
  const headers = new Headers(res.headers);
  headers.set('sw-cached-at', String(Date.now()));
  const body = await res.clone().blob();
  const cache = await caches.open(VERSION);
  await cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  return res;
}
const fresh = (res) => res && Date.now() - Number(res.headers.get('sw-cached-at') || 0) < MAX_AGE;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => put(req, res)).catch(() => caches.match(req).then((r) => r || caches.match('/'))));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => (fresh(hit) ? hit : fetch(req).then((res) => put(req, res)).catch(() => hit))),
  );
});
