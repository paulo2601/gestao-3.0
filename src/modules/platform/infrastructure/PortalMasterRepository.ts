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
