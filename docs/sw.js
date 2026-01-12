const CACHE="internal-vision-v3";
const ASSETS=["./","./index.html","./styles.css","./app.js","./core/storage.js","./core/engine.js","./core/voice.js","./core/export.js","./data/base.js","./themes/themes.js","./hud.html","./report.html","./manifest.json","./sw.js"];
self.addEventListener("install",(e)=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);self.skipWaiting();})());});
self.addEventListener("activate",(e)=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>k===CACHE?null:caches.delete(k)));self.clients.claim();})());});
self.addEventListener("fetch",(e)=>{e.respondWith((async()=>{const r=await caches.match(e.request);if(r) return r;try{return await fetch(e.request);}catch{return caches.match("./index.html");}})());});
