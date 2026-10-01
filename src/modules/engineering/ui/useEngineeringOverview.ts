import { useEffect, useMemo, useState } from 'react';
import type { EngineeringOverview } from '../domain/overview';
import { getEngineeringOverviewRepository } from '../infrastructure/createEngineeringRepositories';

export type EngineeringOverviewState =
  | { status:'idle'|'loading'; data:null; errorMessage:null }
  | { status:'ready'; data:EngineeringOverview; errorMessage:null }
  | { status:'error'; data:null; errorMessage:string };

type Scope={tenantId:string;companyId:string};

export function useEngineeringOverview(scopes:readonly Scope[], refreshToken = 0):EngineeringOverviewState {
  const repository = useMemo(()=>getEngineeringOverviewRepository(),[]);
  const [state,setState] = useState<EngineeringOverviewState>({status:'idle',data:null,errorMessage:null});

  useEffect(()=>{
    if(scopes.length===0){ setState({status:'idle',data:null,errorMessage:null}); return; }
    let cancelled=false;
    // Mantém a última visão válida enquanto uma atualização é buscada. Assim,
    // ações de refresh não desmontam a tela inteira de Engenharia.
    setState(previous=>previous.status==='ready'?previous:{status:'loading',data:null,errorMessage:null});
    void Promise.allSettled(scopes.map(scope=>repository.load(scope))).then(results=>{
      if(cancelled)return;
      const successful=results
        .filter((result):result is PromiseFulfilledResult<EngineeringOverview>=>result.status==='fulfilled')
        .map(result=>result.value);
      if(successful.length===0){
        // Uma falha transitória de atualização não deve apagar dados que já
        // estavam disponíveis para o usuário.
        setState(previous=>previous.status==='ready'?previous:{status:'error',data:null,errorMessage:'Não foi possível carregar a Engenharia para o filtro selecionado.'});
        return;
      }
      setState({status:'ready',data:{
        contracts:successful.flatMap(item=>item.contracts),
        measurements:successful.flatMap(item=>item.measurements),
        production:successful.flatMap(item=>item.production),
        addenda:successful.flatMap(item=>item.addenda),
        provisionals:successful.flatMap(item=>item.provisionals),
      },errorMessage:null});
    }).catch(()=>{
      if(!cancelled)setState(previous=>previous.status==='ready'?previous:{status:'error',data:null,errorMessage:'Não foi possível carregar a Engenharia para o filtro selecionado.'});
    });
    return ()=>{cancelled=true;};
  },[repository,scopes,refreshToken]);

  return state;
}
