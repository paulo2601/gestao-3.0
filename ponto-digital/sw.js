const CACHE='ponto-digital-shell-v10';
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
self.addEventListener('push',event=>{let payload={};try{payload=event.data?.json()||{}}catch{}const title=payload.title||'Ponto Digital';const body=payload.body||'Está na hora de registrar seu ponto.';event.waitUntil(Promise.allSettled([self.registration.showNotification(title,{body,icon:'./icon.svg',badge:'./icon.svg',tag:payload.tag||'ponto-lembrete',renotify:true,data:{url:self.registration.scope}}),uploadPending()]))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const client=clients.find(c=>c.url.startsWith(self.registration.scope));if(client)return client.focus();return self.clients.openWindow(self.registration.scope)}))});


// O navegador pode disparar este evento ao recuperar conectividade, mesmo sem janela aberta.
// Não há garantia de execução imediata em todos os Androids.
const PONTO_DB='ponto-digital-background-v1';
const API='https://ogmtzxotpukddzowhqwl.supabase.co';
const KEY='sb_publishable_vkhFOCSIvSbWifFCy6DjIg_9QJeYd38';
function openPontoDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(PONTO_DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('pending'))db.createObjectStore('pending',{keyPath:'id'});if(!db.objectStoreNames.contains('auth'))db.createObjectStore('auth')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbOperation(db,table,mode,method,...args){return new Promise((resolve,reject)=>{const tx=db.transaction(table,mode);const r=tx.objectStore(table)[method](...args);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function uploadPending(){
 const db=await openPontoDb();
 try{
  const records=await dbOperation(db,'pending','readonly','getAll');
  if(!records.length)return;
  const refresh=await dbOperation(db,'auth','readonly','get','refresh');
  if(!refresh)throw Error('Aguardando autenticação do colaborador');
  const tokenResponse=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})});
  if(!tokenResponse.ok)throw Error('Sessão expirada: sincronizar ao abrir aplicativo');
  const tokens=await tokenResponse.json();
  if(tokens.refresh_token)await dbOperation(db,'auth','readwrite','put',tokens.refresh_token,'refresh');
  for(const record of records){
   const response=await fetch(API+'/rest/v1/employee_clock_events',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(record)});
   if(!response.ok){
    if(response.status===409){
     const check=await fetch(API+'/rest/v1/employee_clock_events?select=id&id=eq.'+encodeURIComponent(record.id),{headers:{apikey:KEY,Authorization:'Bearer '+tokens.access_token}});
     if(check.ok&&(await check.json()).length){await dbOperation(db,'pending','readwrite','delete',record.id);continue}
    }
    throw Error('Envio pendente: HTTP '+response.status);
   }
   await dbOperation(db,'pending','readwrite','delete',record.id);
  }
 }finally{db.close()}
}
self.addEventListener('sync',event=>{if(event.tag==='ponto-upload-pending')event.waitUntil(uploadPending())});
// Pending punches are also retried by the existing push listener above.
