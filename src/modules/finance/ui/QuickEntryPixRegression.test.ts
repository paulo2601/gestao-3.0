import { describe, expect, it } from 'vitest';
import quickEntrySource from './QuickEntryDialog.tsx?raw';

describe('quick entry Pix regression guard', () => {
  it('keeps Pix single entries tied to a bank account and only auto-settles current or past dates', () => {
    expect(quickEntrySource).toContain("form.paymentMethod === 'pix' && form.launchType === 'single' && !form.accountRef");
    expect(quickEntrySource).toContain("payment_method: form.paymentMethod");
    expect(quickEntrySource).toContain('await operations.settleInstallment({');
    expect(quickEntrySource).toContain("idempotencyKey('quick-pix-settlement')");
    expect(quickEntrySource).toContain("window.dispatchEvent(new Event('finance-bank-order-changed'))");
  });

  it('does not auto-settle installment, recurring, or future Pix as an immediate payment', () => {
    expect(quickEntrySource).toContain("form.paymentMethod === 'pix' && form.launchType === 'single' && form.date <= today()");
  });
});
