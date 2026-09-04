// Android only installs a real standalone app (a WebAPK, which is what honours
// the manifest's display: fullscreen) when the site has a service worker with a
// fetch handler. Without one, "Add to Home Screen" makes a plain shortcut that
// reopens the browser. Caching also lets a training session run offline.
const CACHE = 'vision-hero-v1';

// The very first page load happens before this worker controls the page, so
// the shell is fetched here explicitly; without it the first offline launch
// has nothing to serve.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        // A missing shell entry must not block activation.
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: paint from cache immediately, refresh in the
// background so the next launch has the newest build.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || fromNetwork;
    })
  );
});
