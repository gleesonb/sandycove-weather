self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Sandycove Weather';
  const options = {
    body: data.body || 'New weather alert',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: data.tag || 'weather-alert',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
});
