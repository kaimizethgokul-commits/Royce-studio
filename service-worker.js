const C='royce-live-v3';
const SHELL=['./','./index.html','./styles.css?v=104fix2','./app.js?v=104fix2','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  const url=new URL(r.url);
  if(r.mode==='navigate'||r.destination==='script'||r.destination==='style'){
    e.respondWith(fetch(r).then(res=>{
      const copy=res.clone();
      caches.open(C).then(c=>c.put(r,copy));
      return res;
    }).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});