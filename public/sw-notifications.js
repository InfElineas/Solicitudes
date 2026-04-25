self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Reserved for real Web Push payloads when backend push is configured.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Nueva notificación', body: event.data?.text?.() || '' };
  }

  const title = payload.title || 'Nueva notificación';
  const options = {
    body: payload.body || payload.message || '',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || payload.id || 'app-notification',
    data: payload.data || {},
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = '/Requests';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        const url = new URL(client.url);
        if (url.pathname === targetPath && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }
      return undefined;
    })
  );
});
