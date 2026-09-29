import type { SupabaseClient } from '@supabase/supabase-js';

type CommitmentRow={category_id:string|null;cost_center_id:string|null;planned_amount:number|string;pending_amount:number|string;realized_amount:number|string};
export type BudgetCommitments=Map<string,number>;

const value=(raw:number|string|null|undefined)=>{const parsed=Number(raw??0);return Number.isFinite(parsed)?parsed:0;};
const key=(categoryId:string|null,costCenterId:string|null)=>`${categoryId??'none'}:${costCenterId??'general'}`;

export async function loadBudgetCommitments(client:SupabaseClient,tenantId:string,companyId:string,competenceMonth:string):Promise<BudgetCommitments>{
 const result=await client.from('finance_monthly_items').select('category_id,cost_center_id,planned_amount,pending_amount,realized_amount').eq('tenant_id',tenantId).eq('company_id',companyId).eq('entry_type','expense').eq('competence_month',competenceMonth);
 if(result.error)throw result.error;
 const totals:BudgetCommitments=new Map();
 for(const row of (result.data??[]) as CommitmentRow[]){const itemKey=key(row.category_id,row.cost_center_id);totals.set(itemKey,(totals.get(itemKey)??0)+Math.max(value(row.planned_amount),value(row.pending_amount)+value(row.realized_amount)));}
 return totals;
}

export function committedAmount(commitments:BudgetCommitments,categoryId:string|null,costCenterId:string|null,realized:number){return Math.max(realized,commitments.get(key(categoryId,costCenterId))??0);}
