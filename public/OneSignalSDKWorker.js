// OneSignal Service Worker Import
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'flick-pwa-cache-v3';
const OFFLINE_URL = '/offline.html';

// Critical assets to cache on install for full offline-first standalone app launch
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[PWA Service Worker] Installing and pre-caching shell assets...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[PWA Service Worker] Warning pre-caching assets on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[PWA Service Worker] Activating worker and purging stale caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[PWA Service Worker] Purging old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First with Network Fallback fetch strategy for performance and offline reliability
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests or browser extension/localhost/hot-reload requests
  if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:' || url.pathname.includes('/@vite/') || url.pathname.includes('/src/')) {
    return;
  }

  // Skip firestore or live api routes to ensure direct backend database consistency
  if (url.hostname.includes('firebase') || url.hostname.includes('firestore') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, but optionally fetch in background to refresh cache silently (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* ignore silent bg refresh fail */});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Navigation requests fallback to custom HTML offline page
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Fallback background push event listener to guarantee native pushes are caught and shown under all conditions
self.addEventListener('push', (event) => {
  console.log('[PWA Service Worker] Push message received:', event);
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { body: event.data ? event.data.text() : 'New encrypted dialogue message received.' };
  }

  const title = payload.title || 'New Flick Signal';
  const options = {
    body: payload.body || payload.content || 'Decrypt handshake established. Unlock communication.',
    icon: payload.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    data: payload.data || payload,
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Conduit' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
