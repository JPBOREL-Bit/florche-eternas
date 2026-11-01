self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Florche.Eternas', {
    body: d.body || '', tag: d.tag || 'default',
    data: { url: d.url || '/admin' }, vibrate: [200, 100, 200],
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then((cs) => {
    const target = e.notification.data.url || '/admin';
    for (const c of cs) { if (c.url.includes('/admin') && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});
