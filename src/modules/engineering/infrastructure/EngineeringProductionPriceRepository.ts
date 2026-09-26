import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ProductionPriceScope { tenantId:string;companyId:string; }
export interface ProductionPriceInput extends ProductionPriceScope { workId:string;contractServiceId:string;structureId:string;unitValue:number; }

export async function saveEngineeringProductionPrice(input:ProductionPriceInput):Promise<void>{
 const client=getSupabaseClient();
 const {error}=await client.from('engineering_production_prices').upsert({
  tenant_id:input.tenantId,company_id:input.companyId,work_id:input.workId,
  contract_service_id:input.contractServiceId,structure_id:input.structureId,
  unit_value:input.unitValue,status:'active'
 },{onConflict:'tenant_id,company_id,contract_service_id,structure_id'});
 if(error)throw error;
}

export async function deactivateEngineeringProductionPrice(scope:ProductionPriceScope,contractServiceId:string,structureId:string):Promise<void>{
 const client=getSupabaseClient();
 const {error}=await client.from('engineering_production_prices').update({status:'inactive'})
  .eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId)
  .eq('contract_service_id',contractServiceId).eq('structure_id',structureId);
 if(error)throw error;
}

export async function resolveEngineeringProductionPrice(input:ProductionPriceScope&{workId:string;contractServiceId:string;structureId:string}):Promise<number|null>{
 const client=getSupabaseClient();
 const {data,error}=await client.rpc('resolve_engineering_production_price',{
  p_tenant_id:input.tenantId,p_company_id:input.companyId,p_work_id:input.workId,
  p_contract_service_id:input.contractServiceId,p_structure_id:input.structureId
 });
 if(error)throw error;
 return data===null?null:Number(data);
}
