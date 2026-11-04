// Service worker de Tororo: recibe notificaciones push con la app cerrada y las muestra con sonido/vibración
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const IOS = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || '');

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Avisa a la app para que revise sus notificaciones al instante
    list.forEach(c => c.postMessage({ type: 'push' }));
    const visible = list.some(c => c.visibilityState === 'visible');
    // Si la app está abierta y visible, ella misma muestra el aviso y suena (evita duplicados).
    // En Chrome/Android no hace falta mostrar nada; iOS exige mostrar una por cada push o cancela la suscripción.
    if (visible && !IOS) return;
    await self.registration.showNotification(d.title || 'Tororo', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'tororo',
      renotify: true,
      silent: visible,
      data: { url: d.url || './' }
    });
    if (visible) {
      // iOS con la app abierta: se muestra y se cierra enseguida para cumplir la regla sin molestar
      await new Promise(r => setTimeout(r, 1500));
      const n = await self.registration.getNotifications({ tag: d.tag || 'tororo' });
      n.forEach(x => x.close());
    }
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l =>
    l.length ? l[0].focus() : self.clients.openWindow(url)));
});
