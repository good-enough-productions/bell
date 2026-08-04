/* Service Worker for Bell PWA */

const CACHE_NAME = 'bell-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass cache for API endpoints
  if (event.request.url.includes('script.google.com') || event.request.url.includes('ntfy.sh')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notification listener
self.addEventListener('push', (event) => {
  let data = { title: '🔔 Urgent Bell Ring!', body: 'Partner requested help!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || 'Urgent call from partner!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 2a2 2 0 0 0-2 2v.29C7.12 5.14 5 7.82 5 11v6H3v2h18v-2h-2v-6c0-3.18-2.12-5.86-5-6.71V4a2 2 0 0 0-2-2zm0 20a3 3 0 0 0 3-3h-6a3 3 0 0 0 3 3z"/></svg>',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'bell-urgent-call',
    renotify: true,
    requireInteraction: true,
    data: { url: './' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Urgent Bell Ring!', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
