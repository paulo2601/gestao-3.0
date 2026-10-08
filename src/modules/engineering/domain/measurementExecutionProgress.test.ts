import { describe, expect, it } from 'vitest';
import { summarizeExecution } from './measurementExecutionProgress';

describe('resumo financeiro de execucao', () => {
  it('calcula a meta e o saldo sem faturar', () => {
    const result = summarizeExecution([{ id: 'a', plannedQuantity: 30, executedQuantity: 20, unitPrice: 100 }]);
    expect(result.plannedValue).toBe(3000);
    expect(result.executedValue).toBe(2000);
    expect(result.remainingValue).toBe(1000);
    expect(result.financialProgressPercent).toBe(66.67);
  });
  it('nao soma unidades fisicas diferentes', () => {
    const result = summarizeExecution([{ id: 'm', plannedQuantity: 10, executedQuantity: 5, unitPrice: 100 }, { id: 'un', plannedQuantity: 2, executedQuantity: 2, unitPrice: 500 }]);
    expect(result.financialProgressPercent).toBe(75);
  });
  it('bloqueia execucao acima da meta', () => {
    expect(() => summarizeExecution([{ id: 'x', plannedQuantity: 2, executedQuantity: 3, unitPrice: 10 }])).toThrow();
  });
});
