import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
export type EpiProduct={id:string;tenant_id:string;company_id:string;name:string;ca_number:string|null;manufacturer:string|null;size:string|null;minimum_stock:number;quantity:number;active:boolean};
export async function listEpiProducts(scopes:readonly {tenantId:string;companyId:string}[]):Promise<EpiProduct[]>{
 const client=getSupabaseClient();
 const groups=await Promise.all(scopes.map(async s=>{const r=await client.from('hr_epi_products').select('*').eq('tenant_id',s.tenantId).eq('company_id',s.companyId).order('name').returns<EpiProduct[]>();if(r.error)throw r.error;return r.data??[];}));
 return groups.flat();
}
export async function createEpiProduct(input:{tenantId:string;companyId:string;name:string;ca:string;manufacturer:string;size:string;minimum:number}){
 if(!input.name.trim()||!Number.isInteger(input.minimum)||input.minimum<0)throw Error('Confira nome e estoque mínimo.');
 const r=await getSupabaseClient().from('hr_epi_products').insert({tenant_id:input.tenantId,company_id:input.companyId,name:input.name.trim(),ca_number:input.ca.trim()||null,manufacturer:input.manufacturer.trim()||null,size:input.size.trim()||null,minimum_stock:input.minimum});
 if(r.error)throw r.error;
}
export async function registerEpiStockEntry(productId:string,quantity:number,notes:string){
 const r=await getSupabaseClient().rpc('hr_epi_register_entry',{p_product:productId,p_quantity:quantity,p_notes:notes||null});if(r.error)throw r.error;
}
export async function registerStockEpiDelivery(productId:string,contractId:string,quantity:number,date:string,notes:string){
 const r=await getSupabaseClient().rpc('hr_epi_register_delivery',{p_product:productId,p_contract:contractId,p_quantity:quantity,p_date:date,p_notes:notes||null});if(r.error)throw r.error;
}

export type OfficialCaRecord={ca_number:string;equipment:string;manufacturer:string|null;model:string|null;expires_on:string|null;situation:string|null;source_updated_at:string|null};
export async function lookupOfficialEpiCa(ca:string):Promise<OfficialCaRecord|null>{
 const digits=ca.replace(/\D/g,'');
 if(!/^\d{3,6}$/.test(digits))return null;
 const client=getSupabaseClient();
 const response: {data: {record?:OfficialCaRecord|null;error?:string}|null;error: Error|null}=await client.functions.invoke<{
  record?:OfficialCaRecord|null;
  error?:string;
 }>('lookup-epi-ca',{body:{ca:digits}});
 if(response.error){
  const errorWithContext=response.error as Error & {context?:unknown};
  const context=errorWithContext.context;
  if(context instanceof Response){
   const payload:unknown=await context.clone().json().catch(()=>null);
   if(payload&&typeof payload==='object'&&'error' in payload&&typeof payload.error==='string')throw new Error(payload.error);
  }
  throw new Error('Serviço de consulta do CA indisponível. Tente novamente mais tarde.');
 }
 const payload:unknown=response.data;
 if(!payload||typeof payload!=='object')return null;
 const result=payload as {record?:OfficialCaRecord|null;error?:string};
 if(result.error)throw new Error(result.error);
 return result.record??null;
}
