const CACHE='ponto-digital-shell-v7';
const SHELL=['./','./index.html','./app.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  await Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))));
 }));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('ponto-digital-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(new Request(req,{cache:'no-store'}));
   if(response.ok)event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
   return response;
  }catch(error){
   const cached=await cache.match(req,{ignoreSearch:true});
   if(cached)return cached;
   if(req.mode==='navigate'){
    const fallback=await cache.match('./index.html');
    if(fallback)return fallback;
   }
   throw error;
  }
 })());
});
self.addEventListener('push',event=>{let payload={};try{payload=event.data?.json()||{}}catch{}const title=payload.title||'Ponto Digital';const body=payload.body||'Está na hora de registrar seu ponto.';event.waitUntil(self.registration.showNotification(title,{body,icon:'./icon.svg',badge:'./icon.svg',tag:payload.tag||'ponto-lembrete',renotify:true,data:{url:self.registration.scope}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const client=clients.find(c=>c.url.startsWith(self.registration.scope));if(client)return client.focus();return self.clients.openWindow(self.registration.scope)}))});
