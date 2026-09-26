import type { RecordPayrollEventInput } from '../application/HrOperationsRepository';
import { getHrOperationsRepository } from '../infrastructure/createHrRepositories';

type FortnightAdjustmentInput={
 tenantId:string; companyId:string; employmentContractId:string; costCenterId?:string|null;
 competenceMonth:string; eventKind:'adjustment_earning'|'adjustment_deduction'; amount:number; description?:string|null; payrollHalf:1|2;
};

export async function saveFortnightAdjustment(input:FortnightAdjustmentInput){
 const idempotencyKey=['fortnight',input.competenceMonth,input.payrollHalf,input.employmentContractId,input.eventKind,input.description??'',input.amount,Date.now()].join(':');
 const event:RecordPayrollEventInput={tenantId:input.tenantId,companyId:input.companyId,employmentContractId:input.employmentContractId,costCenterId:input.costCenterId??null,competenceMonth:input.competenceMonth,eventKind:input.eventKind,amount:input.amount,description:input.description??null,idempotencyKey};
 await getHrOperationsRepository().recordPayrollEvent(event);
}
