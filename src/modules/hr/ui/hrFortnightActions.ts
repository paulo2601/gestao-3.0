import type { RecordPayrollEventInput } from '../application/HrOperationsRepository';
import { getHrOperationsRepository } from '../infrastructure/HrOperationsFactory';

export async function saveFortnightAdjustment(input:Omit<RecordPayrollEventInput,'idempotencyKey'>&{payrollHalf:1|2}){
 const key=['fortnight',input.competenceMonth,input.payrollHalf,input.employmentContractId,input.eventKind,input.description??'',input.amount,Date.now()].join(':');
 await getHrOperationsRepository().recordPayrollEvent({...input,idempotencyKey:key});
}
