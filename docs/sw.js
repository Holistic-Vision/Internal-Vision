const CACHE = "internal-vision-v1";
const ASSETS = ["./", "./index.html", "./styles.css", "./data.js", "./app.js", "./manifest.json"];

self.addEventListener("install", (e)=>{
  e.waitUntil((async()=>{
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k=> (k===CACHE)?null:caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e)=>{
  e.respondWith((async()=>{
    const cached = await caches.match(e.request);
    if(cached) return cached;
    try{
      const res = await fetch(e.request);
      return res;
    }catch{
      return caches.match("./index.html");
    }
  })());
});
