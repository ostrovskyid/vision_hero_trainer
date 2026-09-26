// Android only installs a real standalone app (a WebAPK, which is what honours
// the manifest's display: fullscreen) when the site has a service worker with a
// fetch handler. Without one, "Add to Home Screen" makes a plain shortcut that
// reopens the browser. Caching also lets a training session run offline.
const CACHE = 'vision-hero-v2';

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

// The page itself (index.html) is network-first, so one reload or launch
// brings a new version; the cached copy is only for offline use. Everything
// else has a content hash in its name, so it is served from the cache
// straight away (stale-while-revalidate).
const isPage = (request, url) =>
  request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isPage(request, url)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match(request)))
    );
    return;
  }

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
