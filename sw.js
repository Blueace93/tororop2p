// Service worker de Tororo: notificaciones push con la app cerrada + abrir la página sin internet
const CACHE = 'tororo-v2';
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Página: siempre la versión nueva si hay internet. La copia guardada solo se usa sin conexión o si la red tarda más de 8 s.
async function pageFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put('./', res.clone()); return res; });
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 8000))]);
  } catch (_) {
    const hit = await cache.match('./', { ignoreSearch: true });
    return hit || net;
  }
}

// Librería de Supabase (versión fija): primero la copia guardada
async function libFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

// Iconos y manifest: copia guardada y se actualiza en segundo plano
async function iconsFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate') return e.respondWith(pageFirst(req));
  if (u.hostname === 'cdn.jsdelivr.net') return e.respondWith(libFirst(req));
  if (u.origin === location.origin) return e.respondWith(iconsFirst(req));
  // Supabase (datos, saldos, fotos) y todo lo demás: nunca se guarda ni se toca
});

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
