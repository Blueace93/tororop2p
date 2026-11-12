// Service worker de Tororo: caché del shell y navegación ligera para conexiones lentas
const CACHE = 'tororo-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './supabase-2.45.4.min.js'
];

const staleWhileRevalidate = async req => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
};

const networkFirst = async req => {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return cache.match('./index.html', { ignoreSearch: true });
  }
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tororo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Solo cachea el shell principal y recursos locales estáticos
  if (url.origin === location.origin && (req.mode === 'navigate' || /\/(?:index\.html|manifest\.json|manifest\.webmanifest|icon-[^/]+\.png)$/.test(url.pathname))) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (url.origin === location.origin && /(?:\.js|\.css|\.png|\.jpg|\.jpeg|\.webp|\.svg|\.woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Las librerías externas no se cachean con lógica pesada; se dejan ir a la red.
  // Esto evita corrupción de caché si refetches o cambios de versión.
});

// Notificaciones push (sin cambios en comportamiento)
const IOS = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || '');

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'push' }));
    const visible = list.some(c => c.visibilityState === 'visible');
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
