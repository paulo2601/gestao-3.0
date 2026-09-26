import type { PayrollEventRow, RecordPayrollEventInput } from '../application/HrOperationsRepository';
import { getHrOperationsRepository } from '../infrastructure/HrOperationsFactory';

type FortnightAdjustmentInput={
 tenantId:string; companyId:string; employmentContractId:string; costCenterId?:string|null;
 competenceMonth:string; eventKind:PayrollEventRow['eventKind']; amount:number; description?:string|null; payrollHalf:1|2;
};

export async function saveFortnightAdjustment(input:FortnightAdjustmentInput){
 const idempotencyKey=['fortnight',input.competenceMonth,input.payrollHalf,input.employmentContractId,input.eventKind,input.description??'',input.amount,Date.now()].join(':');
 const event:RecordPayrollEventInput={tenantId:input.tenantId,companyId:input.companyId,employmentContractId:input.employmentContractId,costCenterId:input.costCenterId,competenceMonth:input.competenceMonth,eventKind:input.eventKind,amount:input.amount,description:input.description,idempotencyKey};
 await getHrOperationsRepository().recordPayrollEvent(event);
}
