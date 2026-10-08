import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface PlanningScope { tenantId: string; companyId: string }
export interface PlannedService {
  id: string; measurementId: string; contractId: string; competence: string;
  originType: string; originId: string; targetKind: 'contract'|'addendum';
  targetId: string; plannedQuantity: number; unitPriceSnapshot: number;
}
export interface ExecutionEntry {
  id: string; planId: string; executionDate: string;
  executedQuantity: number; unitReference: string|null; notes: string|null;
}
type PlanRow = {
  id:string; measurement_id:string; contract_id:string; competence:string;
  origin_type:string; origin_id:string; target_kind:'contract'|'addendum';
  target_id:string; planned_quantity:number|string; unit_price_snapshot:number|string;
};
type ExecutionRow = {
  id:string; plan_id:string; execution_date:string;
  executed_quantity:number|string; unit_reference:string|null; notes:string|null;
};
/** Apenas leitura: a gravação será habilitada após RPC transacional e validação da migração. */
export async function loadMeasurementPlanning(scope:PlanningScope,measurementId:string):
 Promise<{plans:PlannedService[];executions:ExecutionEntry[]}> {
  const client=getSupabaseClient();
  const plansResponse=await client.from('engineering_measurement_plans')
    .select('id,measurement_id,contract_id,competence,origin_type,origin_id,target_kind,target_id,planned_quantity,unit_price_snapshot')
    .eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('measurement_id',measurementId);
  if(plansResponse.error)throw plansResponse.error;
  const plans=((plansResponse.data??[]) as PlanRow[]).map(row=>({
    id:row.id,measurementId:row.measurement_id,contractId:row.contract_id,competence:row.competence,
    originType:row.origin_type,originId:row.origin_id,targetKind:row.target_kind,
    targetId:row.target_id,plannedQuantity:Number(row.planned_quantity),unitPriceSnapshot:Number(row.unit_price_snapshot)
  }));
  if(plans.length===0)return {plans,executions:[]};
  const response=await client.from('engineering_execution_entries')
    .select('id,plan_id,execution_date,executed_quantity,unit_reference,notes')
    .eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId)
    .in('plan_id',plans.map(plan=>plan.id));
  if(response.error)throw response.error;
  const executions=((response.data??[]) as ExecutionRow[]).map(row=>({
    id:row.id,planId:row.plan_id,executionDate:row.execution_date,
    executedQuantity:Number(row.executed_quantity),unitReference:row.unit_reference,notes:row.notes
  }));
  return {plans,executions};
}
