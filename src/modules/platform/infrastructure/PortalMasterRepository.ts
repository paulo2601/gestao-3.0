import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
export type TenantOverview={id:string;name:string;slug:string;status:string;created_at:string};
export type SubscriptionOverview={id:string;tenant_id:string;plan_id:string;status:string;ciclo:string;renova_em:string|null};
export type PlanOverview={id:string;nome:string;slug:string};
export async function loadPortalMaster(){
 const db=getSupabaseClient();
 const operatorResponse=await db.rpc('is_platform_operator');
 const operator:unknown=operatorResponse.data;
 const operatorError=operatorResponse.error;
 if(operatorError)throw new Error(operatorError.message);
 if(operator!==true)return {authorized:false as const,tenants:[] as TenantOverview[],subscriptions:[] as SubscriptionOverview[],plans:[] as PlanOverview[]};
 const [t,s,p]=await Promise.all([
 db.rpc('platform_master_tenants'),
 db.from('platform_tenant_subscriptions').select('id,tenant_id,plan_id,status,ciclo,renova_em'),
 db.rpc('platform_master_catalog')
 ]);
 const failure=t.error??s.error??p.error;
 if(failure)throw new Error(failure.message);
 return {authorized:true as const,tenants:(t.data??[]) as TenantOverview[],subscriptions:(s.data??[]) as SubscriptionOverview[],plans:(p.data??[]) as PlanOverview[]};
}

export async function assignCustomerPlan(tenantId:string,planId:string,cycle:'monthly'|'annual'):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_assign_plan',{p_tenant:tenantId,p_plan:planId,p_cycle:cycle});
 const result:unknown=response.data;
 if(response.error)throw new Error(response.error.message);
 if(typeof result!=='string')throw new Error('Resposta inválida ao cadastrar assinatura.');
}

export type CustomerModule={modulo:string;nome:string;habilitado:boolean;personalizado:boolean};
export async function loadCustomerModules(tenantId:string):Promise<CustomerModule[]>{
 const response=await getSupabaseClient().rpc('platform_master_modules',{p_tenant:tenantId});
 if(response.error)throw new Error(response.error.message);
 const rows:unknown=response.data;
 if(!Array.isArray(rows))throw new Error('Resposta inválida na consulta de módulos.');
 return rows as CustomerModule[];
}
export async function setCustomerModule(tenantId:string,moduleCode:string,enabled:boolean):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_set_module',{p_tenant:tenantId,p_modulo:moduleCode,p_habilitado:enabled});
 if(response.error)throw new Error(response.error.message);
}
export async function resetCustomerModule(tenantId:string,moduleCode:string):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_reset_module',{p_tenant:tenantId,p_modulo:moduleCode});
 if(response.error)throw new Error(response.error.message);
}

export async function saveSaasCustomer(id:string|null,name:string,slug:string,status:'active'|'inactive'):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_save_tenant',{p_id:id,p_name:name,p_slug:slug,p_status:status});
 if(response.error)throw new Error(response.error.message);
}
export async function linkCustomerOwner(tenantId:string,email:string,companyName:string):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_link_customer_owner',{p_tenant:tenantId,p_email:email.trim().toLowerCase(),p_company_name:companyName.trim()});
 if(response.error)throw new Error(response.error.message);
 if(typeof response.data!=='string')throw new Error('Vínculo não confirmado.');
}
export type CommercialStatus='pending'|'trial'|'active'|'past_due'|'suspended'|'cancelled';
export async function saveSaasSubscription(tenantId:string,planId:string,cycle:'monthly'|'annual',status:CommercialStatus):Promise<void>{
 const response=await getSupabaseClient().rpc('platform_master_save_subscription',{p_tenant:tenantId,p_plan:planId,p_cycle:cycle,p_status:status});
 if(response.error)throw new Error(response.error.message);
}
export async function checkModuleAccess(tenantId:string,moduleCode:string):Promise<boolean>{
 const response=await getSupabaseClient().rpc('platform_module_allowed',{p_tenant:tenantId,p_module:moduleCode});
 if(response.error)throw new Error(response.error.message);
 const value:unknown=response.data;
 return value===true;
}

/** Renew a possibly stale access token before retrying a failed permission check. */
export async function recoverModuleAccessSession():Promise<void>{
 const {data,error}=await getSupabaseClient().auth.refreshSession();
 if(error)throw new Error('Não foi possível renovar a sessão. '+error.message);
 if(!data.session)throw new Error('Sua sessão expirou. Entre novamente para continuar.');
}

export async function inviteCustomerOwner(tenantId:string,email:string):Promise<void>{
 const response=await getSupabaseClient().functions.invoke<unknown>('platform-invite-customer',{body:{tenantId,email:email.trim().toLowerCase()}});
 if(response.error)throw new Error(response.error.message);
 const result:unknown=response.data;
 if(typeof result!=='object'||result===null)throw new Error('Resposta inválida do serviço de convite.');
 const payload=result as Record<string,unknown>;
 if(typeof payload.error==='string')throw new Error(payload.error);
 if(payload.sent!==true)throw new Error('Envio não confirmado.');
}
