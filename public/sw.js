/* FinMemory — PWA + pós-deploy: activate limpa Cache Storage; navigate e /_next/ revalidam. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  const isNavigate = req.mode === 'navigate' || req.destination === 'document';
  if (isNavigate) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => fetch(req))
    );
    return;
  }

  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).catch(() => fetch(req))
    );
    return;
  }

  event.respondWith(fetch(req));
});
