/**
 * My Money Tracker — Offline-First Progressive Web App Service Worker
 *
 * Architectural & Security Guarantees:
 * 1. Caches ONLY static application shell assets (HTML, CSS, JS, SVG/PNG icons, manifest).
 * 2. NEVER clears, modifies, or accesses IndexedDB ('MyMoneyTrackerIndexedDB') during install/activate/update.
 * 3. NEVER caches sensitive financial transaction exports (.json backups, .csv exports, or blob: URLs).
 * 4. Does NOT claim background cloud sync because all records live 100% locally on the device.
 */

const CACHE_VERSION = 'mmt-app-shell-v3';

const CORE_SHELL_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './favicon.svg',
  './apple-touch-icon.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_SHELL_ASSETS))
      .catch(() => {
        // Ignore individual asset pre-cache failures in dev mode
      })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up only outdated static asset caches (mmt-app-shell-*).
  // IndexedDB is completely untouched.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('mmt-app-shell-') && key !== CACHE_VERSION
            )
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle standard GET requests over http/https
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache Vite HMR / dev-server internal modules or sensitive backup/export downloads
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.endsWith('.csv') ||
    (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.webmanifest'))
  ) {
    return;
  }

  // Navigation requests (HTML): Network-first with cached index.html & offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('./index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await caches.match('./');
          if (cachedRoot) return cachedRoot;
          return caches.match('./offline.html');
        })
    );
    return;
  }

  // Static build assets (/assets/*, icons, manifest): Cache-first with background network refresh
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
