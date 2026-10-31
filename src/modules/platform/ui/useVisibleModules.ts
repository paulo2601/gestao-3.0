import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { checkModuleAccess } from '../infrastructure/PortalMasterRepository';
export const routeModuleCode: Record<string,string> = {'/':'dashboard','/financeiro':'financeiro','/contas-do-mes':'financeiro','/bancos':'bancos','/cartoes':'cartoes','/orcamento':'limites','/limites':'limites','/rh':'rh','/engenharia':'engenharia','/orcamentos':'engenharia','/producao':'producao','/relatorios':'relatorios','/usuarios':'usuarios','/configuracoes':'configuracoes','/auditoria':'auditoria','/seguranca':'usuarios','/empresas':'configuracoes','/clientes':'configuracoes','/minhas-empresas':'configuracoes','/sistema':'auditoria','/clientes-saas':'usuarios','/planos-modulos':'usuarios','/acertos-pessoais':'particular'};
const codes=[...new Set(Object.values(routeModuleCode))];
const platformOnlyRoutes=new Set(['/clientes-saas','/planos-modulos']);
export function useVisibleModules(tenantIds:readonly string[]){
 const [allowed,setAllowed]=useState<ReadonlySet<string>>(new Set());
 const [platformOperator,setPlatformOperator]=useState(false);
 const key=[...tenantIds].sort().join(',');
 useEffect(()=>{let alive=true;setAllowed(new Set());const ids=key.split(',').filter(Boolean);if(!ids.length)return;
 void getSupabaseClient().rpc('is_platform_operator').then(({data,error})=>{if(alive)setPlatformOperator(!error&&data===true);},()=>{if(alive)setPlatformOperator(false);});
 void Promise.all(codes.map(async code=>({code,ok:(await Promise.all(ids.map(id=>checkModuleAccess(id,code).catch(()=>false)))).every(Boolean)}))).then(rows=>{if(alive)setAllowed(new Set(rows.filter(row=>row.ok).map(row=>row.code)));});
 return()=>{alive=false};},[key]);
 return (path:string)=>{const pathname=path.split('?')[0] ?? '/';const code=routeModuleCode[pathname];return (!platformOnlyRoutes.has(pathname)||platformOperator)&&(code===undefined||allowed.has(code))};
}
