import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type BudgetFlowType = 'income' | 'expense';
export type EffectiveBudgetPlan = { categoryId: string | null; costCenterId: string | null; flowType: BudgetFlowType; plannedAmount: number };
type EffectiveBudgetPlanRow = { category_id: string | null; cost_center_id: string | null; flow_type: BudgetFlowType; planned_amount: number | string };
type SavedPlanRow = { planned_amount: number | string };
const supabase = getSupabaseClient();

export function competenceDate(competence: string): string { return `${competence.slice(0, 7)}-01`; }

export async function loadEffectiveBudgetPlans(tenantId: string, companyId: string, competence: string): Promise<EffectiveBudgetPlan[]> {
  const { data, error } = await supabase.from('budget_effective_plans_v2').select('category_id,cost_center_id,flow_type,planned_amount').eq('tenant_id', tenantId).eq('company_id', companyId).eq('competence_month', competenceDate(competence));
  if (error) throw error;
  return ((data ?? []) as EffectiveBudgetPlanRow[]).map((row) => ({ categoryId: row.category_id, costCenterId: row.cost_center_id, flowType: row.flow_type, plannedAmount: Number(row.planned_amount ?? 0) }));
}

export async function saveMonthlyBudgetPlan(input: { tenantId: string; companyId: string; competence: string; categoryId: string | null; costCenterId: string | null; flowType: BudgetFlowType; plannedAmount: number; notes?: string | null }): Promise<number> {
  const competenceMonth = competenceDate(input.competence);
  const payload = { tenant_id: input.tenantId, company_id: input.companyId, competence_month: competenceMonth, category_id: input.categoryId, cost_center_id: input.costCenterId, flow_type: input.flowType, planned_amount: input.plannedAmount, notes: input.notes ?? null };
  const { error } = await supabase.from('budget_plans').upsert(payload, { onConflict: 'tenant_id,company_id,competence_month,category_id,cost_center_id,flow_type' });
  if (error) throw error;
  let verification = supabase.from('budget_plans').select('planned_amount').eq('tenant_id', input.tenantId).eq('company_id', input.companyId).eq('competence_month', competenceMonth).eq('flow_type', input.flowType);
  verification = input.categoryId === null ? verification.is('category_id', null) : verification.eq('category_id', input.categoryId);
  verification = input.costCenterId === null ? verification.is('cost_center_id', null) : verification.eq('cost_center_id', input.costCenterId);
  const { data, error: verificationError } = await verification.maybeSingle();
  if (verificationError) throw verificationError;
  const persisted = Number((data as SavedPlanRow | null)?.planned_amount ?? Number.NaN);
  if (!Number.isFinite(persisted) || Math.abs(persisted - input.plannedAmount) > 0.009) throw new Error('O orçamento não pôde ser confirmado após o salvamento.');
  return persisted;
}
