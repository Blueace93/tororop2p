// Service worker de Tororo: recibe notificaciones push con la app cerrada y las muestra con sonido/vibración
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Si la app está abierta y visible, ella misma muestra el aviso (evita duplicados)
    if (list.some(c => c.visibilityState === 'visible')) {
      list.forEach(c => c.postMessage({ type: 'push' }));
      return;
    }
    await self.registration.showNotification(d.title || 'Tororo', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'tororo',
      renotify: true,
      data: { url: d.url || './' }
    });
    list.forEach(c => c.postMessage({ type: 'push' }));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l =>
    l.length ? l[0].focus() : self.clients.openWindow(url)));
});
