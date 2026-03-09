// RiderExpress Service Worker v1.0
const CACHE_NAME = 'riderexpress-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Gestione notifiche push
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const title = data.title || 'RiderExpress';
  const options = {
    body:    data.body  || 'Hai una nuova notifica',
    icon:    data.icon  || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag   || 'riderexpress',
    data:    data.url   || '/',
    vibrate: [200, 100, 200],
    actions: data.actions || []
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica → apre/focus l'app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow(e.notification.data || '/');
    })
  );
});
