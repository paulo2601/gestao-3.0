import { describe, expect, it } from 'vitest';
import quickEntrySource from './QuickEntryDialog.tsx?raw';

describe('quick entry immediate payment regression guard', () => {
  it('requires a bank account for immediate Pix, debit and cash payments', () => {
    expect(quickEntrySource).toContain("const immediatePayment = ['pix', 'debit', 'cash'].includes(form.paymentMethod)");
    expect(quickEntrySource).toContain("if (immediatePayment && !form.accountRef)");
    expect(quickEntrySource).toContain("payment_method: form.paymentMethod");
  });

  it('auto-settles only single current or past Pix, debit and cash payments', () => {
    expect(quickEntrySource).toContain("const shouldAutoSettle = ['pix', 'debit', 'cash'].includes(form.paymentMethod)");
    expect(quickEntrySource).toContain("&& form.launchType === 'single'");
    expect(quickEntrySource).toContain("&& form.date <= today()");
    expect(quickEntrySource).toContain('await operations.settleInstallment({');
    expect(quickEntrySource).toContain("settledOn: form.date");
    expect(quickEntrySource).toContain("window.dispatchEvent(new Event('finance-bank-order-changed'))");
  });

  it('keeps future and installment payments pending', () => {
    expect(quickEntrySource).toContain("form.launchType === 'single'");
    expect(quickEntrySource).toContain("form.date <= today()");
  });
});
