/* Caché para abrir Tororo más rápido. No toca las notificaciones push. */
const CACHE='tororo-v1';
const SB_LIB='cdn.jsdelivr.net/npm/@supabase/supabase-js';

self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tororo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  /* Librería de Supabase (versión fija): primero la copia guardada */
  if(r.url.includes(SB_LIB)){
    e.respondWith(caches.open(CACHE).then(c=>c.match(r).then(h=>h||fetch(r).then(n=>{if(n.ok)c.put(r,n.clone());return n}))));
    return}
  /* La página y sus iconos: se muestra lo guardado al instante y se actualiza detrás */
  if(u.origin===location.origin&&(r.mode==='navigate'||/\/(index\.html|manifest\.json|icon-[^/]+\.png)?$/.test(u.pathname))){
    e.respondWith(caches.open(CACHE).then(c=>c.match(r,{ignoreSearch:true}).then(h=>{
      const net=fetch(r).then(n=>{if(n.ok)c.put(r,n.clone());return n}).catch(()=>h);
      return h||net})));
    return}
  /* Todo lo demás (Supabase, pagos, OCR) pasa directo a la red */
});
