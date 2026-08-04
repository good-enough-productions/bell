/* Service Worker for Bell PWA */

const CACHE_NAME = 'bell-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('script.google.com') ||
      e.request.url.includes('ntfy.sh') ||
      e.request.url.includes('fonts.')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200) {
        caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const getData = e.data
    ? e.data.json().catch(() => ({ title: '🔔 Bell!', body: e.data.text() }))
    : Promise.resolve({ title: '🔔 Bell!', body: 'Partner needs you!' });
  e.waitUntil(getData.then(d =>
    self.registration.showNotification(d.title || '🔔 Bell!', {
      body: d.body || d.message || 'Partner needs you!',
      vibrate: [300, 100, 300, 100, 300],
      tag: 'bell-alert',
      renotify: true,
      requireInteraction: true
    })
  ));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});