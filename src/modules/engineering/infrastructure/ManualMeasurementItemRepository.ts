import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ManualMeasurementItemInput {
  description:string;
  unit:string;
  quantity:number;
  unitPrice:number;
  notes?:string;
}

export async function addManualMeasurementItem(
  scope:{tenantId:string;companyId:string},
  measurementId:string,
  input:ManualMeasurementItemInput,
){
  const response=await getSupabaseClient().from('measurement_lines').insert({
    tenant_id:scope.tenantId,
    company_id:scope.companyId,
    measurement_id:measurementId,
    contract_service_id:null,
    contract_addendum_line_id:null,
    structure_id:null,
    measured_quantity:input.quantity,
    unit_price_snapshot:input.unitPrice,
    manual_description:input.description.trim(),
    manual_unit:input.unit.trim().toUpperCase(),
    notes:input.notes?.trim()?'[ITEM AVULSO] '+input.notes.trim():'[ITEM AVULSO]',
  });
  if(response.error)throw response.error;
}
