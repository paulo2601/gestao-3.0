import type { SupabaseClient } from '@supabase/supabase-js';

type FlowType='income'|'expense';
type MonthlyRow={source_kind:string;item_id:string;parent_id:string;competence_month:string;due_date:string;entry_type:FlowType;description:string;counterparty_name:string|null;category_id:string|null;cost_center_id:string|null;installment_number:number;installment_count:number;planned_amount:number|string;pending_amount:number|string;realized_amount:number|string};
export type BudgetCommitments=Map<string,number>;
export type UnregisteredBudgetEntry={key:string;sourceKind:string;flowType:FlowType;itemId:string;parentId:string;competenceMonth:string;dueDate:string;description:string;counterpartyName:string|null;categoryId:string|null;costCenterId:string|null;installmentNumber:number;installmentCount:number;amount:number};

const value=(raw:number|string|null|undefined)=>{const parsed=Number(raw??0);return Number.isFinite(parsed)?parsed:0;};
const key=(categoryId:string|null,costCenterId:string|null)=>`${categoryId??'none'}:${costCenterId??'general'}`;
const flowKey=(flowType:FlowType,categoryId:string|null,costCenterId:string|null)=>`${flowType}:${key(categoryId,costCenterId)}`;

async function monthlyRows(client:SupabaseClient,tenantId:string,companyId:string,competenceMonth:string){
 const result=await client.from('finance_monthly_items').select('source_kind,item_id,parent_id,competence_month,due_date,entry_type,description,counterparty_name,category_id,cost_center_id,installment_number,installment_count,planned_amount,pending_amount,realized_amount').eq('tenant_id',tenantId).eq('company_id',companyId).eq('competence_month',competenceMonth);
 if(result.error)throw result.error;
 return(result.data??[])as MonthlyRow[];
}
export async function loadBudgetCommitments(client:SupabaseClient,tenantId:string,companyId:string,competenceMonth:string):Promise<BudgetCommitments>{
 const totals:BudgetCommitments=new Map();
 for(const row of await monthlyRows(client,tenantId,companyId,competenceMonth)){if(row.entry_type!=='expense')continue;const itemKey=key(row.category_id,row.cost_center_id);totals.set(itemKey,(totals.get(itemKey)??0)+Math.max(value(row.planned_amount),value(row.pending_amount)+value(row.realized_amount)));}
 return totals;
}
export async function loadUnregisteredBudgetEntries(client:SupabaseClient,tenantId:string,companyId:string,competenceMonth:string,budgetedKeys:ReadonlySet<string>,otherCategoryIds:ReadonlySet<string>):Promise<UnregisteredBudgetEntry[]>{
 const rows=await monthlyRows(client,tenantId,companyId,competenceMonth);
 return rows.filter(row=>!row.category_id||otherCategoryIds.has(row.category_id)||!budgetedKeys.has(flowKey(row.entry_type,row.category_id,row.cost_center_id))).map(row=>({key:`${row.source_kind}:${row.item_id}`,sourceKind:row.source_kind,flowType:row.entry_type,itemId:row.item_id,parentId:row.parent_id,competenceMonth:row.competence_month,dueDate:row.due_date,description:row.description,counterpartyName:row.counterparty_name,categoryId:row.category_id,costCenterId:row.cost_center_id,installmentNumber:row.installment_number,installmentCount:row.installment_count,amount:Math.max(value(row.planned_amount),value(row.pending_amount)+value(row.realized_amount))}));
}
export function committedAmount(commitments:BudgetCommitments,categoryId:string|null,costCenterId:string|null,realized:number){return Math.max(realized,commitments.get(key(categoryId,costCenterId))??0);}
export function budgetScopeKey(categoryId:string|null,costCenterId:string|null){return key(categoryId,costCenterId);}
export function budgetFlowScopeKey(flowType:FlowType,categoryId:string|null,costCenterId:string|null){return flowKey(flowType,categoryId,costCenterId);}

export async function classifyUnregisteredBudgetEntry(client:SupabaseClient,tenantId:string,companyId:string,item:UnregisteredBudgetEntry,categoryId:string,costCenterId:string|null){
 if(!categoryId)throw new Error('Selecione uma categoria para classificar o lançamento.');
 const table=item.sourceKind==='financial_installment'?'financial_entries':item.sourceKind==='card_installment'?'card_transactions':null;
 if(!table)throw new Error('Origem do lançamento ainda não permite classificação automática.');
 const targetId=item.sourceKind==='financial_installment'?item.parentId:item.itemId;
 const result=await client.from(table).update({category_id:categoryId,cost_center_id:costCenterId||null}).eq('tenant_id',tenantId).eq('company_id',companyId).eq('id',targetId);
 if(result.error)throw result.error;
}
