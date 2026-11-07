// Service worker de Tororo: notificaciones push con la app cerrada + caché para abrir más rápido
const CACHE = 'tororo-v3';
const SB_LIB = 'cdn.jsdelivr.net/npm/@supabase/supabase-js';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('tororo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

// ---- Caché ----
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Librería de Supabase (versión fija): primero la copia guardada
  if (r.url.includes(SB_LIB)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(h => h || fetch(r).then(n => { if (n.ok) c.put(r, n.clone()); return n; }))));
    return;
  }
  // Librería de Supabase en tu propio dominio (nombre con versión): primero la copia guardada.
  // Solo se guarda si de verdad es JavaScript (por si el servidor responde con otra cosa).
  if (u.origin === location.origin && /\/supabase-[\d.]+\.min\.js$/.test(u.pathname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(h => h || fetch(r).then(n => {
      if (n.ok && /javascript/i.test(n.headers.get('content-type') || '')) c.put(r, n.clone());
      return n;
    }))));
    return;
  }
  // La página y sus iconos: primero la versión nueva (hasta 3 s); si la red va lenta o falla, la guardada
  if (u.origin === location.origin && (r.mode === 'navigate' || /\/(index\.html|manifest\.json|icon-[^/]+\.png)?$/.test(u.pathname))) {
    e.respondWith(caches.open(CACHE).then(c => {
      const net = fetch(r, { cache: 'no-cache' }).then(n => { if (n.ok) c.put(r, n.clone()); return n; });
      const slow = new Promise(res => setTimeout(res, 3000, null));
      return Promise.race([net, slow]).then(n => n || c.match(r, { ignoreSearch: true }).then(h => h || net))
        .catch(() => c.match(r, { ignoreSearch: true }));
    }));
    return;
  }
  // Todo lo demás (Supabase, pagos, OCR) pasa directo a la red
});

// ---- Notificaciones push ----
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
