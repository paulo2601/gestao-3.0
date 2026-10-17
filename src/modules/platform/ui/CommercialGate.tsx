import { useEffect,useState, type ReactNode } from 'react';
import { checkModuleAccess } from '../infrastructure/PortalMasterRepository';
const routeModules:Record<string,string>={
 '/':'dashboard','/financeiro':'financeiro','/contas-do-mes':'financeiro',
 '/bancos':'bancos','/cartoes':'cartoes','/orcamento':'limites','/limites':'limites',
 '/rh':'rh','/engenharia':'engenharia','/orcamentos':'engenharia',
 '/producao':'producao','/relatorios':'relatorios','/usuarios':'usuarios',
 '/configuracoes':'configuracoes','/auditoria':'auditoria'
};
export function CommercialGate({tenantIds,path,children}:{tenantIds:string;path:string;children:ReactNode}){
 const moduleCode=routeModules[path];
 const [allowed,setAllowed]=useState<boolean|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let current=true;
  if(!moduleCode){setAllowed(true);setError('');return;}
  const ids=tenantIds.split(',').filter(Boolean);
  setAllowed(null);setError('');
  if(ids.length===0){setAllowed(false);return;}
  void Promise.all(ids.map(id=>checkModuleAccess(id,moduleCode))).then(results=>{
   if(current)setAllowed(results.every(Boolean));
  }).catch((e:unknown)=>{
   if(current){setAllowed(false);setError(e instanceof Error?e.message:'Falha ao verificar acesso comercial.');}
  });
  return()=>{current=false;};
 },[moduleCode,tenantIds]);
 if(!moduleCode)return <>{children}</>;
 if(allowed===null)return <p role="status">Verificando permissões do módulo…</p>;
 if(!allowed)return <section role="alert"><h2>Acesso ao módulo indisponível</h2><p>{error||'Este módulo não está liberado para o cliente ou a assinatura não está ativa.'}</p></section>;
 return <>{children}</>;
}
