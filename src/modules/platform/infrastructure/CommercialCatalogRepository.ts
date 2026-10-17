import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
export type Plan={id:string;nome:string;slug:string;descricao:string|null;preco_mensal:number|null;preco_anual:number|null;publico:boolean;ordem:number};
export type Module={modulo:string;nome:string;categoria:string;ativo:boolean;vendavel:boolean};
export type Assignment={plan_id:string;modulo:string;habilitado:boolean};
export async function loadCommercialCatalog():Promise<{plans:Plan[];modules:Module[];assignments:Assignment[]}>{
 const db=getSupabaseClient();
 const [p,m,a]=await Promise.all([
 db.from('platform_plans').select('id,nome,slug,descricao,preco_mensal,preco_anual,publico,ordem').order('ordem'),
 db.from('platform_module_catalog').select('modulo,nome,categoria,ativo,vendavel').order('ordem'),
 db.from('platform_plan_modules').select('plan_id,modulo,habilitado')]);
 const failure = p.error ?? m.error ?? a.error;
 if (failure) throw new Error(`Falha ao carregar catálogo comercial: ${failure.message}`);
 return {plans:(p.data??[]) as Plan[],modules:(m.data??[]) as Module[],assignments:(a.data??[]) as Assignment[]};
}
