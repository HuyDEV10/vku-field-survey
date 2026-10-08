import { syncQueue } from './business/sync.js';
const CACHE = __CACHE_NAME__,
  ASSETS = __PRECACHE__;
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('vku-shell-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match('/index.html')) || fetch(event.request)),
    );
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(url.pathname)) || fetch(event.request)),
    );
  }
});
self.addEventListener('sync', (event) => {
  if (event.tag === 'vku-surveys')
    event.waitUntil(
      (async () => {
        await syncQueue();
        const clients = await self.clients.matchAll();
        for (const client of clients) client.postMessage('QUEUE_UPDATED');
        const { surveys } = await import('./data/db.js');
        if ((await surveys()).some((r) => r.status === 'PENDING_SYNC'))
          throw new Error('Queue has pending surveys');
      })(),
    );
});
