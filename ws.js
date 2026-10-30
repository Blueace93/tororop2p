/* Tororo P2P · service worker: carga rápida con internet lento + notificaciones con la app cerrada */
const V='tororo-v3',LIB='tororo-lib';
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png']).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==LIB).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

async function netFirst(req){
  const c=await caches.open(V);
  try{
    const r=await Promise.race([fetch(req),new Promise((_,rej)=>setTimeout(()=>rej(new Error('lento')),4000))]);
    if(r&&r.ok)c.put(req,r.clone());
    return r;
  }catch(e){
    return (await c.match(req))||(await c.match('index.html'))||(await c.match('./'))||Response.error();
  }}
async function cacheFirst(req){
  const c=await caches.open(LIB),m=await c.match(req);if(m)return m;
  const r=await fetch(req);if(r&&r.ok)c.put(req,r.clone());return r}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin===location.origin&&(req.mode==='navigate'||/\.(html|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/')))return e.respondWith(netFirst(req));
  if(u.origin===location.origin&&/\.(png|jpg|svg|ico)$/.test(u.pathname))return e.respondWith(cacheFirst(req));
  if(u.hostname==='cdn.jsdelivr.net')return e.respondWith(cacheFirst(req));
});

/* Notificación push (llega aunque la app esté cerrada) */
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){d={title:'Tororo P2P',body:e.data?e.data.text():''}}
  e.waitUntil((async()=>{
    const cl=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(cl.some(c=>c.visibilityState==='visible')){cl.forEach(c=>c.postMessage({type:'push'}));return}
    await self.registration.showNotification(d.title||'Tororo P2P',{
      body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',vibrate:[200,100,200,100,200],
      tag:d.tag||'tororo',renotify:true,silent:false,requireInteraction:false,data:{url:d.url||'./'}});
  })())});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil((async()=>{
    const cl=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of cl){if('focus' in c){await c.focus();return}}
    await self.clients.openWindow((e.notification.data&&e.notification.data.url)||'./');
  })())});
