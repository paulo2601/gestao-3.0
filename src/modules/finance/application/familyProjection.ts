import type { FinanceMonthlyItem } from '../domain/monthly';

export interface FamilyMonthProjection {
  month: string;
  income: number;
  expenses: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
  items: readonly FamilyProjectionItem[];
}

export interface FamilyProjectionItem extends FinanceMonthlyItem {
  remainingInstallments: number;
}

function cents(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Valor financeiro inválido.');
  return Math.round(value * 100);
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function projectionMonths(startMonth: string, count = 12): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) throw new Error('Mês inicial inválido.');
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('Horizonte inválido.');
  const [year, month] = startMonth.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 + i, 1));
    return date.toISOString().slice(0, 7);
  });
}

/**
 * Read-only projection of already materialized obligations. A card statement
 * payment is not added again: the underlying card installments are the expense.
 * Realized and pending amounts are subdivisions of the same planned obligation.
 */
export function buildFamilyProjection(
  source: readonly FinanceMonthlyItem[],
  startMonth: string,
  openingBalance = 0,
  horizon = 12,
): FamilyMonthProjection[] {
  const months = projectionMonths(startMonth, horizon);
  const allowed = new Set(months);
  const unique = new Map<string, FinanceMonthlyItem>();
  for (const item of source) {
    const key = monthKey(item.competenceMonth);
    if (!allowed.has(key)) continue;
    if (!Number.isInteger(item.installmentNumber) || !Number.isInteger(item.installmentCount) ||
      item.installmentNumber < 1 || item.installmentCount < item.installmentNumber) {
      throw new Error('Numeração de parcelas inconsistente.');
    }
    const identity = [item.tenantId, item.companyId, item.sourceKind, item.itemId].join(':');
    if (unique.has(identity)) throw new Error('Parcela duplicada na origem: ' + identity);
    cents(item.plannedAmount);
    unique.set(identity, item);
  }
  let balance = cents(openingBalance);
  return months.map(month => {
    const items: FamilyProjectionItem[] = [...unique.values()]
      .filter(item => monthKey(item.competenceMonth) === month)
      .map(item => ({ ...item, remainingInstallments: item.installmentCount - item.installmentNumber }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description));
    const income = items.filter(item => item.entryType === 'income')
      .reduce((total, item) => total + cents(item.plannedAmount), 0);
    const expenses = items.filter(item => item.entryType === 'expense')
      .reduce((total, item) => total + cents(item.plannedAmount), 0);
    const opening = balance;
    balance += income - expenses;
    return {
      month,
      income: income / 100,
      expenses: expenses / 100,
      net: (income - expenses) / 100,
      openingBalance: opening / 100,
      closingBalance: balance / 100,
      items,
    };
  });
}

export function maximumFundingGap(months: readonly FamilyMonthProjection[]): number {
  return Math.max(0, ...months.map(month => -month.closingBalance));
}
