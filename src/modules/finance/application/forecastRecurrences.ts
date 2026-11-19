import type { FinancialRecurrenceRule } from '../domain/recurrence';
import type { FinanceMonthlyItem } from '../domain/monthly';

function addMonths(date: Date, months: number, anchor: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchor, lastDay));
  return result;
}

function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}
function sameIncomePurpose(ruleDescription: string, entryDescription: string): boolean {
  const rule = normalize(ruleDescription);
  const entry = normalize(entryDescription);
  if (rule === entry) return true;
  if (rule.includes('adiantamento') && entry.includes('adiantamento')) return true;
  if (rule.includes('pagamento') && entry.includes('pagamento')) return true;
  if (rule.includes('recebimento extra') && entry.includes('recebimento comissao')) return true;
  return false;
}

/**
 * Creates read-only projected occurrences, never writing back to Supabase.
 * A materialized installment with the same due date, description and type
 * takes precedence, even if its amount was edited after the recurrence was set.
 */
export function forecastRecurrences(
  rules: readonly FinancialRecurrenceRule[],
  existing: readonly FinanceMonthlyItem[],
  fromMonth: string,
  toMonth: string,
): FinanceMonthlyItem[] {
  const first = fromMonth + '-01';
  const last = iso(new Date(Date.UTC(Number(toMonth.slice(0, 4)), Number(toMonth.slice(5, 7)), 0)));
  const matchesExisting = (rule: FinancialRecurrenceRule, date: string) =>
    existing.some(item => item.companyId === rule.companyId &&
      item.dueDate === date && item.entryType === rule.entryType &&
      (
        normalize(item.description) === normalize(rule.description) ||
        (rule.entryType === 'income' && item.sourceKind === 'financial_installment' &&
          item.categoryId === rule.categoryId &&
          (sameIncomePurpose(rule.description, item.description) ||
            Math.round(item.plannedAmount * 100) === Math.round(rule.amount * 100)))
      ));
  const result: FinanceMonthlyItem[] = [];
  for (const rule of rules) {
    if (rule.status !== 'active' || rule.intervalCount < 1) continue;
    const start = rule.nextOccurrenceDate > rule.startDate ? rule.nextOccurrenceDate : rule.startDate;
    if (start > last) continue;
    let date = new Date(start + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime())) continue;
    for (let n = 0; n < 1500 && iso(date) <= last; n++) {
      const due = iso(date);
      if (rule.endDate && due > rule.endDate) break;
      if (due >= first && !matchesExisting(rule, due)) {
        result.push({
          tenantId: rule.tenantId, companyId: rule.companyId,
          sourceKind: 'financial_installment', itemId: 'forecast:' + rule.id + ':' + due,
          parentId: rule.id, competenceMonth: due.slice(0, 7) + '-01', dueDate: due,
          entryType: rule.entryType, description: rule.description + ' (projeção recorrente)',
          counterpartyName: rule.counterpartyName, categoryId: rule.categoryId,
          costCenterId: rule.costCenterId, installmentNumber: 1, installmentCount: 1,
          plannedAmount: rule.amount, realizedAmount: 0, pendingAmount: rule.amount,
          paymentStatus: 'pending',
        });
      }
      date = rule.frequency === 'weekly'
        ? new Date(date.getTime() + rule.intervalCount * 7 * 86400000)
        : addMonths(date, rule.intervalCount, rule.anchorDay);
    }
  }
  return result;
}
