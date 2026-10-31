import { useEffect, useState } from 'react';
import { checkModuleAccess } from '../infrastructure/PortalMasterRepository';
export const routeModuleCode: Record<string,string> = {'/':'dashboard','/financeiro':'financeiro','/contas-do-mes':'financeiro','/bancos':'bancos','/cartoes':'cartoes','/orcamento':'limites','/limites':'limites','/rh':'rh','/engenharia':'engenharia','/orcamentos':'engenharia','/producao':'producao','/relatorios':'relatorios','/usuarios':'usuarios','/configuracoes':'configuracoes','/auditoria':'auditoria','/seguranca':'usuarios','/empresas':'configuracoes','/clientes':'configuracoes','/minhas-empresas':'configuracoes','/sistema':'auditoria','/clientes-saas':'usuarios','/planos-modulos':'usuarios','/acertos-pessoais':'particular'};
const codes=[...new Set(Object.values(routeModuleCode))];
export function useVisibleModules(tenantIds:readonly string[]){
 const [allowed,setAllowed]=useState<ReadonlySet<string>>(new Set());
 const key=[...tenantIds].sort().join(',');
 useEffect(()=>{let alive=true;setAllowed(new Set());const ids=key.split(',').filter(Boolean);if(!ids.length)return;
 void Promise.all(codes.map(async code=>({code,ok:(await Promise.all(ids.map(id=>checkModuleAccess(id,code).catch(()=>false)))).every(Boolean)}))).then(rows=>{if(alive)setAllowed(new Set(rows.filter(row=>row.ok).map(row=>row.code)));});
 return()=>{alive=false};},[key]);
 return (path:string)=>{const code=routeModuleCode[path.split('?')[0]];return code===undefined||allowed.has(code)};
}
