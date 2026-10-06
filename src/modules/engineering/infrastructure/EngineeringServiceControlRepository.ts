import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ServiceControlItem { id:string;description:string;category:string|null;unit:string;contractedQuantity:number;unitPrice:number;contractedValue:number; }
export interface ServiceControlEntry { id:string;itemId:string;executionDate:string;executedQuantity:number;notes:string|null; }
export interface ServiceControl { id:string;tenantId:string;companyId:string;contractId:string;name:string;status:string;items:ServiceControlItem[];entries:ServiceControlEntry[]; }
interface ServiceControlRow { id:string;tenant_id:string;company_id:string;contract_id:string;name:string;status:string; }
interface ServiceControlItemRow { id:string;control_id:string;description:string;category:string|null;unit:string;contracted_quantity:number|string;unit_price:number|string;contracted_value:number|string; }
interface ServiceControlEntryRow { id:string;control_id:string;item_id:string;execution_date:string;executed_quantity:number|string;notes:string|null; }
interface ContractServiceRow { id:string;service_id:string|null;description:string;unit:string;contracted_quantity:number|string;unit_price:number|string;status:string; }
interface EngineeringServiceRow { id:string;category:string|null; }

export async function listServiceControls(scope:{tenantId:string;companyId:string}){
 const client=getSupabaseClient();
 const c=await client.from('engineering_service_controls').select('id,tenant_id,company_id,contract_id,name,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('created_at');
 if(c.error)throw c.error; const controls=(c.data??[]) as ServiceControlRow[]; if(!controls.length)return [];
 const ids=controls.map(x=>x.id);
 const [i,e]=await Promise.all([
  client.from('engineering_service_control_items').select('id,control_id,description,category,unit,contracted_quantity,unit_price,contracted_value').in('control_id',ids).order('created_at'),
  client.from('engineering_service_control_entries').select('id,control_id,item_id,execution_date,executed_quantity,notes').in('control_id',ids).order('execution_date')
 ]);
 if(i.error)throw i.error;if(e.error)throw e.error;
 return controls.map(row=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,contractId:row.contract_id,name:row.name,status:row.status,
  items:((i.data??[]) as ServiceControlItemRow[]).filter(x=>x.control_id===row.id).map(x=>({id:x.id,description:x.description,category:x.category,unit:x.unit,contractedQuantity:Number(x.contracted_quantity),unitPrice:Number(x.unit_price),contractedValue:Number(x.contracted_value)})),
  entries:((e.data??[]) as ServiceControlEntryRow[]).filter(x=>x.control_id===row.id).map(x=>({id:x.id,itemId:x.item_id,executionDate:x.execution_date,executedQuantity:Number(x.executed_quantity),notes:x.notes}))
 })) as ServiceControl[];
}
export async function importContractToServiceControl(scope:{tenantId:string;companyId:string},contractId:string,name:string){
 const client=getSupabaseClient();
 const existing=await client.from('engineering_service_controls').select('id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return String(existing.data.id);
 const services=await client.from('contract_services').select('id,service_id,description,unit,contracted_quantity,unit_price,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('contract_id',contractId).eq('status','active');if(services.error)throw services.error;
 const masterIds=[...new Set(((services.data??[]) as ContractServiceRow[]).map(x=>x.service_id).filter(Boolean))];let categories=new Map<string,string|null>();
 if(masterIds.length){const m=await client.from('engineering_services').select('id,category').in('id',masterIds);if(m.error)throw m.error;categories=new Map(((m.data??[]) as EngineeringServiceRow[]).map(x=>[x.id,x.category??null]));}
 const created=await client.from('engineering_service_controls').insert({tenant_id:scope.tenantId,company_id:scope.companyId,contract_id:contractId,name}).select('id').single();if(created.error)throw created.error;
 const id=String(created.data.id);const rows=((services.data??[]) as any[]).map(x=>({tenant_id:scope.tenantId,company_id:scope.companyId,control_id:id,source_contract_service_id:x.id,description:x.description,category:categories.get(x.service_id)??null,unit:x.unit,contracted_quantity:Number(x.contracted_quantity),unit_price:Number(x.unit_price)}));
 if(rows.length){const ins=await client.from('engineering_service_control_items').insert(rows);if(ins.error){await client.from('engineering_service_controls').delete().eq('id',id);throw ins.error;}}
 return id;
}
export async function addServiceControlEntry(scope:{tenantId:string;companyId:string},controlId:string,itemId:string,date:string,quantity:number,notes:string){
 const client=getSupabaseClient();const r=await client.from('engineering_service_control_entries').insert({tenant_id:scope.tenantId,company_id:scope.companyId,control_id:controlId,item_id:itemId,execution_date:date,executed_quantity:quantity,notes:notes.trim()||null});if(r.error)throw r.error;
}
export async function deleteServiceControlEntry(id:string){const client=getSupabaseClient();const r=await client.from('engineering_service_control_entries').delete().eq('id',id);if(r.error)throw r.error;}
