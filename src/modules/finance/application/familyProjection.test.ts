import { describe, expect, it } from 'vitest';
import type { FinanceMonthlyItem } from '../domain/monthly';
import { buildFamilyProjection, maximumFundingGap, projectionMonths } from './familyProjection';

const base: FinanceMonthlyItem = {
  tenantId: 'tenant', companyId: 'personal', sourceKind: 'financial_installment',
  itemId: 'salary', parentId: 'salary-entry', competenceMonth: '2026-12-01',
  dueDate: '2026-12-05', entryType: 'income', description: 'Salário',
  counterpartyName: null, categoryId: 'income', costCenterId: null,
  installmentNumber: 1, installmentCount: 1, plannedAmount: 10000,
  realizedAmount: 0, pendingAmount: 10000, paymentStatus: 'pending',
};
describe('family projection', () => {
  it('crosses the year boundary correctly', () => {
    expect(projectionMonths('2026-12', 3)).toEqual(['2026-12', '2027-01', '2027-02']);
  });
  it('details every obligation and carries deficits forward', () => {
    const expenses: FinanceMonthlyItem[] = [
      { ...base, itemId: 'loan1', parentId: 'loan', entryType: 'expense', description: 'Empréstimo A', plannedAmount: 9000, installmentNumber: 4, installmentCount: 12 },
      { ...base, itemId: 'loan2', parentId: 'other', entryType: 'expense', description: 'Empréstimo B', plannedAmount: 5000, installmentNumber: 2, installmentCount: 6 },
    ];
    const january = { ...base, itemId: 'jan-salary', competenceMonth: '2027-01-01', dueDate: '2027-01-05' };
    const months = buildFamilyProjection([base, ...expenses, january], '2026-12', 2);
    expect(months[0]!.expenses).toBe(14000);
    expect(months[0]!.net).toBe(-4000);
    expect(months[0]!.items.find(x => x.itemId === 'loan1')?.remainingInstallments).toBe(8);
    expect(months[1]!.closingBalance).toBe(6002);
    expect(maximumFundingGap(months)).toBe(3998);
  });
  it('does not double count realized and pending amounts', () => {
    const item = { ...base, realizedAmount: 4000, pendingAmount: 6000 };
    expect(buildFamilyProjection([item], '2026-12')[0]!.income).toBe(10000);
  });
  it('rejects duplicated installment identifiers', () => {
    expect(() => buildFamilyProjection([base, base], '2026-12')).toThrow(/duplicada/);
  });
});
