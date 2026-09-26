import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ProductionPriceScope { tenantId:string;companyId:string; }
export type ProductionServiceKind='linked'|'manual'|'discount';
export interface ProductionPriceInput extends ProductionPriceScope { workId:string;contractServiceId:string;structureId:string;unitValue:number; }

export async function saveEngineeringProductionPrice(input:ProductionPriceInput):Promise<void>{
 const client=getSupabaseClient();
 const {data:existing,error:findError}=await client.from('engineering_production_services').select('id').eq('tenant_id',input.tenantId).eq('company_id',input.companyId).eq('work_id',input.workId).eq('contract_service_id',input.contractServiceId).eq('status','active').maybeSingle();
 if(findError)throw findError;
 let productionServiceId=existing?.id as string|undefined;
 if(!productionServiceId){
  const contractResponse:unknown=await client.from('contract_services').select('description,unit').eq('tenant_id',input.tenantId).eq('company_id',input.companyId).eq('id',input.contractServiceId).single();
  const contractTyped=contractResponse as {data:{description:string;unit:string|null}|null;error:{message?:string}|null};
  if(contractTyped.error)throw new Error(contractTyped.error.message??'Não foi possível carregar o serviço contratual.');if(!contractTyped.data)throw new Error('Serviço contratual não encontrado.');
  const createResponse:unknown=await client.from('engineering_production_services').insert({tenant_id:input.tenantId,company_id:input.companyId,work_id:input.workId,contract_service_id:input.contractServiceId,name:contractTyped.data.description,unit:contractTyped.data.unit,kind:'linked',status:'active'}).select('id').single();
  const createTyped=createResponse as {data:{id:string}|null;error:{message?:string}|null};if(createTyped.error)throw new Error(createTyped.error.message??'Não foi possível criar o serviço de produção.');if(!createTyped.data)throw new Error('Serviço de produção não foi criado.');productionServiceId=createTyped.data.id;
 }
 const {error}=await client.from('engineering_production_prices').upsert({tenant_id:input.tenantId,company_id:input.companyId,work_id:input.workId,production_service_id:productionServiceId,contract_service_id:input.contractServiceId,structure_id:input.structureId,unit_value:input.unitValue,status:'active'},{onConflict:'tenant_id,company_id,production_service_id,structure_id'});
 if(error)throw error;
}

export async function createManualProductionService(input:ProductionPriceScope&{workId:string;name:string;unit:string|null;kind:'manual'|'discount';structureId:string|null;unitValue:number}):Promise<void>{
 const client=getSupabaseClient();
 const serviceResponse:unknown=await client.from('engineering_production_services').insert({tenant_id:input.tenantId,company_id:input.companyId,work_id:input.workId,contract_service_id:null,name:input.name.trim(),unit:input.unit?.trim()||null,kind:input.kind,status:'active'}).select('id').single();
 const serviceTyped=serviceResponse as {data:{id:string}|null;error:{message?:string}|null};if(serviceTyped.error)throw new Error(serviceTyped.error.message??'Não foi possível criar o serviço manual.');if(!serviceTyped.data)throw new Error('Serviço manual não foi criado.');
 const {error}=await client.from('engineering_production_prices').insert({tenant_id:input.tenantId,company_id:input.companyId,work_id:input.workId,production_service_id:serviceTyped.data.id,contract_service_id:null,structure_id:input.structureId,unit_value:input.unitValue,status:'active'});
 if(error)throw error;
}

export async function deactivateEngineeringProductionPrice(scope:ProductionPriceScope,contractServiceId:string,structureId:string):Promise<void>{
 const client=getSupabaseClient();const {error}=await client.from('engineering_production_prices').update({status:'inactive'}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_service_id',contractServiceId).eq('structure_id',structureId);if(error)throw error;
}

export async function resolveEngineeringProductionPrice(input:ProductionPriceScope&{workId:string;contractServiceId:string;structureId:string}):Promise<number|null>{
 const client=getSupabaseClient();const response:unknown=await client.rpc('resolve_engineering_production_price',{p_tenant_id:input.tenantId,p_company_id:input.companyId,p_work_id:input.workId,p_contract_service_id:input.contractServiceId,p_structure_id:input.structureId});
 const typed=response as {data:unknown;error:{message?:string}|null};if(typed.error)throw new Error(typed.error.message??'Não foi possível resolver o valor de produção.');return typed.data===null?null:Number(typed.data);
}
