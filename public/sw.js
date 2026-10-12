const CACHE_NAME = 'census-app-shell-v2';

const APP_SHELL = [
  '/',
  '/login.html',
  '/capture.html',
  '/dashboard.html',
  '/admin-users.html',
  '/css/style.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/geo.js',
  '/js/validation.js',
  '/js/queueStatus.js',
  '/js/sync.js',
  '/js/topbar.js',
  '/js/register-sw.js',
  '/js/pages/login.js',
  '/js/pages/capture.js',
  '/js/pages/dashboard.js',
  '/js/pages/admin-users.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/leaflet.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell; never intercept /api requests —
// those are handled by the page's own offline queue (IndexedDB).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
