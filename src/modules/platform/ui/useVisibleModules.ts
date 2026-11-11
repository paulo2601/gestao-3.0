import { useEffect, useState } from 'react';
import { checkModuleAccess, checkPlatformOperator } from '../infrastructure/PortalMasterRepository';
export const routeModuleCode: Record<string,string> = {'/':'dashboard','/financeiro':'financeiro','/contas-do-mes':'financeiro','/bancos':'bancos','/cartoes':'cartoes','/orcamento':'limites','/limites':'limites','/rh':'rh','/engenharia':'engenharia','/orcamentos':'engenharia','/producao':'producao','/relatorios':'relatorios','/usuarios':'usuarios','/configuracoes':'configuracoes','/auditoria':'auditoria','/seguranca':'usuarios','/empresas':'configuracoes','/clientes':'configuracoes','/minhas-empresas':'configuracoes','/sistema':'auditoria','/clientes-saas':'usuarios','/planos-modulos':'usuarios','/acertos-pessoais':'particular'};
const codes=[...new Set(Object.values(routeModuleCode))];
const platformOnlyRoutes=new Set(['/clientes-saas','/planos-modulos']);
// UI-only cache: server-side RLS and RPC authorization remain authoritative.
const CACHE_TTL_MS=5*60*1000;
type AccessSnapshot={time:number;codes:string[];operator:boolean};
function readSnapshot(key:string):AccessSnapshot|null{
 try{const value=JSON.parse(sessionStorage.getItem(key)||'null') as AccessSnapshot|null;
  if(!value||!Number.isFinite(value.time)||Date.now()-value.time>CACHE_TTL_MS||!Array.isArray(value.codes))return null;
  return value;
 }catch{return null}
}
export function useVisibleModules(tenantIds:readonly string[],userId?:string){
 const key=[...tenantIds].sort().join(',');
 const cacheKey=userId&&key?'gestao.moduleVisibility.v2:'+userId+':'+key:'';
 const initial=cacheKey?readSnapshot(cacheKey):null;
 const [snapshot,setSnapshot]=useState<{key:string;allowed:ReadonlySet<string>;operator:boolean}>({
  key:cacheKey,allowed:new Set(initial?.codes||[]),operator:initial?.operator===true
 });
 useEffect(()=>{
  let alive=true;
  const ids=key.split(',').filter(Boolean);
  if(!cacheKey||!ids.length){setSnapshot({key:cacheKey,allowed:new Set(),operator:false});return()=>{alive=false};}
  const cached=readSnapshot(cacheKey);
  setSnapshot(previous=>previous.key===cacheKey?previous:{
   key:cacheKey,allowed:new Set(cached?.codes||[]),operator:cached?.operator===true
  });
  void (async()=>{
   const [operatorResult,moduleResults]=await Promise.all([
    checkPlatformOperator().then(value=>({ok:true,value}),()=>({ok:false,value:false})),
    Promise.all(codes.map(async code=>{
     try{return {code,ok:true,value:(await Promise.all(ids.map(id=>checkModuleAccess(id,code)))).every(Boolean)}}
     catch{return {code,ok:false,value:false}}
    }))
   ]);
   if(!alive)return;
   setSnapshot(previous=>{
    if(previous.key!==cacheKey)return previous;
    const next=new Set(previous.allowed);
    for(const result of moduleResults){if(!result.ok)continue;if(result.value)next.add(result.code);else next.delete(result.code)}
    const operator=operatorResult.ok?operatorResult.value:previous.operator;
    // Never cache a partial response as a new authoritative permission snapshot.
    if(operatorResult.ok&&moduleResults.every(result=>result.ok)){
     try{sessionStorage.setItem(cacheKey,JSON.stringify({time:Date.now(),codes:[...next],operator}))}catch{/* storage unavailable */}
    }
    return {key:cacheKey,allowed:next,operator};
   });
  })();
  return()=>{alive=false};
 },[key,cacheKey]);
 return (path:string)=>{
  const pathname=path.split('?')[0]??'/';
  const code=routeModuleCode[pathname];
  return snapshot.key===cacheKey&&(!platformOnlyRoutes.has(pathname)||snapshot.operator)&&(code===undefined||snapshot.allowed.has(code));
 };
}
