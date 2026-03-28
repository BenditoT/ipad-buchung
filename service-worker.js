// iPad-Buchung KRS — Service Worker v1
const CACHE_NAME = 'ipad-buchung-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
];

// Install: Cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Einzelne Assets cachen falls batch fehlschlaegt
        return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)));
      });
    })
  );
  self.skipWaiting();
});

// Activate: Alte Caches loeschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first fuer API, Cache-first fuer static
self.addEventListener('fetch', event => {
  const { request } = event;

  // API calls: Network-first mit Cache-Fallback
  if (request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Nur GET-Responses cachen
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: Gecachte Version zurueckgeben
          return caches.match(request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'Offline — keine gecachten Daten verfügbar.' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // ESM.sh CDN: Cache-first (Libraries aendern sich nicht)
  if (request.url.includes('esm.sh')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets: Cache-first, Network-Fallback
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback fuer HTML-Navigation
      if (request.mode === 'navigate') {
        return caches.match('./');
      }
    })
  );
});
