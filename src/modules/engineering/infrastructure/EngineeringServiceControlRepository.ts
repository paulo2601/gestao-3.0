import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ServiceControlItem { id:string;description:string;category:string|null;unit:string;contractedQuantity:number;unitPrice:number;contractedValue:number;notes:string|null; }
export interface ServiceControlEntry { id:string;itemId:string;executionDate:string;executedQuantity:number;notes:string|null; }
export interface ServiceControl { id:string;tenantId:string;companyId:string;contractId:string;name:string;status:string;items:ServiceControlItem[];entries:ServiceControlEntry[]; }
interface ServiceControlRow { id:string;tenant_id:string;company_id:string;contract_id:string;name:string;status:string; }
interface ServiceControlItemRow { id:string;control_id:string;source_contract_service_id?:string|null;description:string;category:string|null;unit:string;contracted_quantity:number|string;unit_price:number|string;contracted_value:number|string;notes:string|null; }
interface ServiceControlEntryRow { id:string;control_id:string;item_id:string;execution_date:string;executed_quantity:number|string;notes:string|null; }

export async function listServiceControls(scope:{tenantId:string;companyId:string}){
 const client=getSupabaseClient();
 const c=await client.from('engineering_service_controls').select('id,tenant_id,company_id,contract_id,name,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('created_at');
 if(c.error)throw c.error; const controls=(c.data??[]) as ServiceControlRow[]; if(!controls.length)return [];
 const ids=controls.map(x=>x.id);
 const [i,e]=await Promise.all([
  client.from('engineering_service_control_items').select('id,control_id,source_contract_service_id,description,category,unit,contracted_quantity,unit_price,contracted_value,notes').in('control_id',ids).order('created_at'),
  client.from('engineering_service_control_entries').select('id,control_id,item_id,execution_date,executed_quantity,notes').in('control_id',ids).order('execution_date')
 ]);
 if(i.error)throw i.error;if(e.error)throw e.error;
 return controls.map(row=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,contractId:row.contract_id,name:row.name,status:row.status,
  items:((i.data??[]) as ServiceControlItemRow[]).filter(x=>x.control_id===row.id&&x.source_contract_service_id==null).map(x=>({id:x.id,description:x.description,category:x.category,unit:x.unit,contractedQuantity:Number(x.contracted_quantity),unitPrice:Number(x.unit_price),contractedValue:Number(x.contracted_value),notes:x.notes})),
  entries:((e.data??[]) as ServiceControlEntryRow[]).filter(x=>x.control_id===row.id).map(x=>({id:x.id,itemId:x.item_id,executionDate:x.execution_date,executedQuantity:Number(x.executed_quantity),notes:x.notes}))
 })) as ServiceControl[];
}
export async function addServiceControlEntry(scope:{tenantId:string;companyId:string},controlId:string,itemId:string,date:string,quantity:number,notes:string){
 const client=getSupabaseClient();const r=await client.from('engineering_service_control_entries').insert({tenant_id:scope.tenantId,company_id:scope.companyId,control_id:controlId,item_id:itemId,execution_date:date,executed_quantity:quantity,notes:notes.trim()||null});if(r.error)throw r.error;
}
export async function updateServiceControlEntry(scope:{tenantId:string;companyId:string},id:string,date:string,quantity:number,notes:string){
 const client=getSupabaseClient();const r=await client.from('engineering_service_control_entries').update({execution_date:date,executed_quantity:quantity,notes:notes.trim()||null}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id);if(r.error)throw r.error;
}
export async function deleteServiceControlEntry(id:string){const client=getSupabaseClient();const r=await client.from('engineering_service_control_entries').delete().eq('id',id);if(r.error)throw r.error;}

export async function ensureServiceControl(scope:{tenantId:string;companyId:string},contractId:string,name:string){
 const client=getSupabaseClient();const existing=await client.from('engineering_service_controls').select('id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return String(existing.data.id);
 const created=await client.from('engineering_service_controls').insert({tenant_id:scope.tenantId,company_id:scope.companyId,contract_id:contractId,name}).select('id').single();if(created.error)throw created.error;return String(created.data.id);
}
export async function addServiceControlItem(scope:{tenantId:string;companyId:string},controlId:string,description:string,unit:string,contractedQuantity:number,totalValue:number,notes:string){
 const client=getSupabaseClient();const unitPrice=contractedQuantity>0?totalValue/contractedQuantity:0;const r=await client.from('engineering_service_control_items').insert({tenant_id:scope.tenantId,company_id:scope.companyId,control_id:controlId,source_contract_service_id:null,description:description.trim(),category:'Controle',unit,contracted_quantity:contractedQuantity,unit_price:unitPrice,notes:notes.trim()||null});if(r.error)throw r.error;
}
export async function updateServiceControlItem(scope:{tenantId:string;companyId:string},id:string,description:string,unit:string,contractedQuantity:number,totalValue:number,notes:string){
 const client=getSupabaseClient();const unitPrice=contractedQuantity>0?totalValue/contractedQuantity:0;const r=await client.from('engineering_service_control_items').update({description:description.trim(),unit,contracted_quantity:contractedQuantity,unit_price:unitPrice,notes:notes.trim()||null,updated_at:new Date().toISOString()}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).is('source_contract_service_id',null);if(r.error)throw r.error;
}
export async function deleteServiceControlItem(scope:{tenantId:string;companyId:string},id:string){
 const client=getSupabaseClient();const existing=await client.from('engineering_service_control_entries').select('id',{count:'exact',head:true}).eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('item_id',id);if(existing.error)throw existing.error;if((existing.count??0)>0)throw new Error('Este serviço possui execuções lançadas e não pode ser excluído.');const r=await client.from('engineering_service_control_items').delete().eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('id',id).is('source_contract_service_id',null);if(r.error)throw r.error;
}
