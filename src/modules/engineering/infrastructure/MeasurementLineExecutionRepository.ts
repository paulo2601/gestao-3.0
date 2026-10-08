import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
export interface LineExecution {
 id:string; measurementLineId:string; executionDate:string; executedQuantity:number; notes:string|null;
}
export async function loadLineExecutions(scope:{tenantId:string;companyId:string},lineIds:string[]):Promise<LineExecution[]>{
 if(!lineIds.length)return [];
 const client=getSupabaseClient();
 const rows:LineExecution[]=[];
 for(let offset=0;offset<lineIds.length;offset+=100){
  const response=await client.from('engineering_measurement_line_executions')
   .select('id,measurement_line_id,execution_date,executed_quantity,notes')
   .eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId)
   .in('measurement_line_id',lineIds.slice(offset,offset+100));
  if(response.error)throw response.error;
  rows.push(...(response.data??[]).map(row=>({
   id:row.id as string,measurementLineId:row.measurement_line_id as string,
   executionDate:row.execution_date as string,executedQuantity:Number(row.executed_quantity),
   notes:row.notes as string|null
  })));
 }
 return rows;
}
export async function saveLineExecution(input:{measurementLineId:string;executionDate:string;quantity:number}){
 const client=getSupabaseClient();
 const response=await client.rpc('record_measurement_line_execution',{
  p_line_id:input.measurementLineId,p_execution_date:input.executionDate,p_quantity:input.quantity,p_notes:null
 });
 if(response.error)throw response.error;
 return response.data as string;
}

export async function updateLineExecution(input:{id:string;executionDate:string;quantity:number}):Promise<void>{
 const response=await getSupabaseClient().rpc('update_measurement_line_execution',{
  p_execution_id:input.id,p_execution_date:input.executionDate,p_quantity:input.quantity
 });
 if(response.error)throw response.error;
}
export async function deleteLineExecution(id:string):Promise<void>{
 const response=await getSupabaseClient().rpc('delete_measurement_line_execution',{p_execution_id:id});
 if(response.error)throw response.error;
}
