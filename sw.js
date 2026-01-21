const CACHE_NAME = 'triple-j-v11';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './parser.js',
  './api.js',
  './script.js',
  './triple j.jpg',
  './manifest.json'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, network-first for JS/CSS (to get updates), cache-first for images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for API calls (need fresh sports data)
  if (url.hostname.includes('codetabs.com') || url.hostname.includes('nba.com') || url.hostname.includes('espn.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML/JS/CSS (to get code updates quickly)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((fetchResponse) => {
          // Cache the fresh response
          if (event.request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, fetchResponse.clone());
            });
          }
          return fetchResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for images and other static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        if (event.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
          return fetchResponse;
        }
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});
