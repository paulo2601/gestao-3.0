import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
export interface ProductionAttendanceDiscount{employmentContractId:string;attendanceDate:string;status:string;amount:number;}
export async function loadProductionAttendanceDiscounts(scope:{tenantId:string;companyId:string},startDate:string,endDate:string):Promise<ProductionAttendanceDiscount[]>{
 const client=getSupabaseClient();const result=await client.from('employee_attendance_daily').select('employment_contract_id,attendance_date,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).gte('attendance_date',startDate).lte('attendance_date',endDate).in('status',['absence','medical_certificate']);if(result.error)throw result.error;
 return (result.data??[]).map(row=>({employmentContractId:row.employment_contract_id as string,attendanceDate:row.attendance_date as string,status:row.status as string,amount:row.status==='absence'?500:0}));
}