import { describe, expect, it } from 'vitest';
import type { FinancialRecurrenceRule } from '../domain/recurrence';
import type { FinanceMonthlyItem } from '../domain/monthly';
import { forecastRecurrences } from './forecastRecurrences';

const rule: FinancialRecurrenceRule = {
  id: 'rent', tenantId: 't', companyId: 'personal', entryType: 'expense',
  description: 'Aluguel', counterpartyName: null, categoryId: 'housing',
  costCenterId: null, amount: 1500, frequency: 'monthly', intervalCount: 1,
  startDate: '2026-11-30', nextOccurrenceDate: '2026-11-30', endDate: null,
  anchorDay: 30, status: 'active', notes: null,
};
describe('recurrence forecast', () => {
  it('projects monthly dates and clamps February', () => {
    const rows = forecastRecurrences([rule], [], '2026-12', '2027-03');
    expect(rows.map(row => row.dueDate)).toEqual(['2026-12-30', '2027-01-30', '2027-02-28', '2027-03-30']);
    expect(rows.every(row => row.plannedAmount === 1500)).toBe(true);
  });
  it('does not add an already materialized occurrence twice', () => {
    const existing: FinanceMonthlyItem = {
      tenantId: 't', companyId: 'personal', sourceKind: 'financial_installment',
      itemId: 'materialized', parentId: 'entry', competenceMonth: '2026-12-01',
      dueDate: '2026-12-30', entryType: 'expense', description: 'Aluguel',
      counterpartyName: null, categoryId: 'housing', costCenterId: null,
      installmentNumber: 1, installmentCount: 1, plannedAmount: 1500,
      realizedAmount: 0, pendingAmount: 1500, paymentStatus: 'pending',
    };
    expect(forecastRecurrences([rule], [existing], '2026-12', '2026-12')).toEqual([]);
  });
  it('does not duplicate a materialized recurrence whose amount was adjusted', () => {
    const existing: FinanceMonthlyItem = {
      tenantId: 't', companyId: 'personal', sourceKind: 'financial_installment',
      itemId: 'adjusted', parentId: 'entry', competenceMonth: '2026-11-01',
      dueDate: '2026-11-30', entryType: 'expense', description: 'Aluguel',
      counterpartyName: null, categoryId: 'housing', costCenterId: null,
      installmentNumber: 1, installmentCount: 1, plannedAmount: 1450,
      realizedAmount: 0, pendingAmount: 1450, paymentStatus: 'pending',
    };
    expect(forecastRecurrences([rule], [existing], '2026-11', '2026-11')).toEqual([]);
  });
  it('does not double count same-day income when description or amount differs', () => {
    const cases = [
      ['Recebimento de pagamento', 1573, 'Recebimento de pagamento', 1500, '2026-11-05'],
      ['Recebimento extra', 6000, 'Recebimento comissão', 6000, '2026-11-15'],
      ['Recebimento adiantamento', 1100, 'Adiantamento de salário', 1177.01, '2026-11-20'],
    ] as const;
    for (const [ruleDescription, ruleAmount, entryDescription, entryAmount, dueDate] of cases) {
      const incomeRule = { ...rule, entryType: 'income' as const, description: ruleDescription, amount: ruleAmount,
        startDate: dueDate, nextOccurrenceDate: dueDate };
      const existing: FinanceMonthlyItem = {
        tenantId: 't', companyId: 'personal', sourceKind: 'financial_installment',
        itemId: 'existing', parentId: 'entry', competenceMonth: '2026-11-01',
        dueDate, entryType: 'income', description: entryDescription,
        counterpartyName: null, categoryId: 'housing', costCenterId: null,
        installmentNumber: 1, installmentCount: 1, plannedAmount: entryAmount,
        realizedAmount: 0, pendingAmount: entryAmount, paymentStatus: 'pending',
      };
      expect(forecastRecurrences([incomeRule], [existing], '2026-11', '2026-11')).toEqual([]);
    }
  });
  it('supports fortnightly recurring expenses', () => {
    const fortnightly = { ...rule, frequency: 'weekly' as const, intervalCount: 2, startDate: '2026-11-27', nextOccurrenceDate: '2026-11-27' };
    expect(forecastRecurrences([fortnightly], [], '2026-12', '2026-12').map(row => row.dueDate))
      .toEqual(['2026-12-11', '2026-12-25']);
  });
});
