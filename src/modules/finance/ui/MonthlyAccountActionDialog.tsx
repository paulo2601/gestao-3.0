import { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, Pencil, Trash2, WalletCards } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { InstallmentMaintenanceScope } from '../application/FinancialEntryRepository';
import type { FinancialEntryListItem } from '../domain/entries';
import type { FinancialAccount } from '../domain/registries';
import type { InstallmentBalance } from '../domain/settlements';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { MoneyInput } from '../../../shared/ui/MoneyInput';
import { Select } from '../../../shared/ui/Select';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';
import '../../home/ui/planning-payments.css';

type Action = 'details' | 'payment' | 'edit' | 'delete';
type PaymentMode = 'total' | 'partial';
interface Props { company: CompanySummary; entry: FinancialEntryListItem; balance?: InstallmentBalance; open: boolean; onClose: () => void; onChanged: () => void; }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const finance = getFinanceRepositories();
const today = () => new Date().toISOString().slice(0, 10);
const key = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const formatDate = (value: string) => value.split('-').reverse().join('/');

export function MonthlyAccountActionDialog({ company, entry, balance, open, onClose, onChanged }: Props) {
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;
  const [action, setAction] = useState<Action>('details');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [maintenanceScope, setMaintenanceScope] = useState<InstallmentMaintenanceScope>('single');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('total');
  const [paymentAccounts, setPaymentAccounts] = useState<readonly FinancialAccount[]>([]);
  const [paymentForm, setPaymentForm] = useState({ accountId: '', settledOn: today(), amount: 0, notes: '' });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [differenceConfirm, setDifferenceConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', dueDate: entry.dueDate, amount: entry.amount, notes: entry.notes ?? '' });

  const original = balance?.installmentAmount ?? entry.amount;
  const alreadySettled = balance?.settledAmount ?? 0;
  const remaining = Math.max(0, balance?.remainingAmount ?? entry.amount);
  const paid = balance?.financialStatus === 'paid' || remaining <= 0;
  const partial = !paid && remaining + 0.005 < original;
  const isIncome = entry.entryType === 'income';
  const paymentAmount = paymentForm.amount;
  const settlementDifference = paymentAmount - remaining;
  const absoluteDifference = Math.abs(settlementDifference);
  const differsFromRemaining = absoluteDifference > 0.005;
  const remainingAfter = Math.max(remaining - paymentAmount, 0);

  useEffect(() => {
    if (!open) return;
    setAction('details'); setLocalError(null); setMaintenanceScope('single'); setPaymentMode('total'); setPaymentError(null); setDifferenceConfirm(false);
    setPaymentForm({ accountId: '', settledOn: today(), amount: remaining, notes: '' });
    setEditForm({ description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', dueDate: entry.dueDate, amount: entry.amount, notes: entry.notes ?? '' });
    operations.clearFeedback();
  }, [open, entry.installmentId, entry.description, entry.counterpartyName, entry.categoryId, entry.costCenterId, entry.dueDate, entry.amount, entry.notes, remaining, operations.clearFeedback]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void finance.registries.listTenantAccounts(company.tenantId).then(accounts => { if (!cancelled) setPaymentAccounts(accounts.filter(account => account.status === 'active')); }).catch(() => { if (!cancelled) setPaymentAccounts([]); });
    return () => { cancelled = true; };
  }, [company.tenantId, open]);

  const activeAccounts = paymentAccounts.length ? paymentAccounts : (references?.accounts ?? []).filter(item => item.status === 'active');
  const activeCostCenters = (references?.costCenters ?? []).filter(item => item.status === 'active');
  const categories = (references?.categories ?? []).filter(item => item.status === 'active' && (item.kind === 'both' || item.kind === entry.entryType));
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...activeAccounts.map(item => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...activeCostCenters.map(item => ({ value: item.id, label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...categories.map(item => ({ value: item.id, label: item.name }))];
  const scopeChoices = entry.installmentCount > 1 ? <div className="payment-app__modes"><Button variant={maintenanceScope === 'single' ? 'primary' : 'secondary'} onClick={() => setMaintenanceScope('single')}>Somente esta</Button><Button variant={maintenanceScope === 'following' ? 'primary' : 'secondary'} onClick={() => setMaintenanceScope('following')}>Esta e as seguintes</Button></div> : null;

  function openPayment() { setPaymentMode('total'); setPaymentError(null); setDifferenceConfirm(false); setPaymentForm(current => ({ ...current, amount: remaining })); setAction('payment'); }
  function openEdit() { setMaintenanceScope('single'); setLocalError(null); setEditForm({ description: entry.description, counterparty: entry.counterpartyName ?? '', categoryId: entry.categoryId, costCenterId: entry.costCenterId ?? '', dueDate: entry.dueDate, amount: entry.amount, notes: entry.notes ?? '' }); setAction('edit'); }
  function openDelete() { setMaintenanceScope('single'); setLocalError(null); setAction('delete'); }

  async function savePayment(confirmed = false) {
    setPaymentError(null);
    if (!paymentForm.accountId) { setPaymentError('Selecione o banco ou conta para continuar.'); return; }
    if (paymentForm.amount <= 0) { setPaymentError('Informe um valor maior que zero.'); return; }
    if (paymentMode === 'partial' && paymentForm.amount > remaining + 0.005) { setPaymentError(`O valor parcial não pode ultrapassar ${currency.format(remaining)}.`); return; }
    if (paymentMode === 'total' && differsFromRemaining && !confirmed) { setDifferenceConfirm(true); return; }
    try { await operations.settleInstallment({ installmentId: entry.installmentId, accountId: paymentForm.accountId, settledOn: paymentForm.settledOn, amount: paymentForm.amount, idempotencyKey: key('monthly-account'), notes: paymentForm.notes || null, settlesInFull: paymentMode === 'total' }); onChanged(); onClose(); } catch { /* feedback do hook */ }
  }

  async function saveEdit() {
    if (!editForm.description.trim() || editForm.amount <= 0) return;
    setBusy(true); setLocalError(null);
    try {
      await finance.entries.updateInstallmentScope({ ...scope, installmentId: entry.installmentId, scope: maintenanceScope, description: editForm.description.trim(), counterpartyName: editForm.counterparty || null, categoryId: editForm.categoryId, costCenterId: editForm.costCenterId || null, dueDate: editForm.dueDate, amount: editForm.amount, notes: editForm.notes || null });
      onChanged(); onClose();
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Não foi possível editar a parcela.'); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    setBusy(true); setLocalError(null);
    try { await finance.entries.deleteInstallmentScope(scope, entry.installmentId, maintenanceScope); onChanged(); onClose(); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Não foi possível excluir a parcela.'); }
    finally { setBusy(false); }
  }

  if (action === 'payment') return <><Dialog open={open} title={isIncome ? 'Registrar recebimento' : 'Registrar pagamento'} description={entry.description} loading={operations.state.busy} confirmLabel={isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'} onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => void savePayment()}><div className="payment-app">{(paymentError ?? operations.state.errorMessage) && <Feedback tone="danger" title="Operação não concluída" message={paymentError ?? operations.state.errorMessage ?? ''} />}<div className="payment-app__hero"><div><strong>{entry.description}</strong><span>{entry.installmentCount > 1 ? `PARCELA ${entry.installmentNumber}/${entry.installmentCount}` : isIncome ? 'RECEITA' : 'DESPESA'}</span></div></div><div className="payment-app__totals"><div><span>Total original</span><strong>{currency.format(original)}</strong></div><div><span>{isIncome ? 'Já recebido' : 'Já pago'}</span><strong>{currency.format(alreadySettled)}</strong></div><div><span>Restante</span><strong>{currency.format(remaining)}</strong></div></div><div className="payment-app__modes"><Button variant={paymentMode === 'total' ? 'primary' : 'secondary'} onClick={() => { setPaymentMode('total'); setPaymentForm(c => ({ ...c, amount: remaining })); }}>Total</Button><Button variant={paymentMode === 'partial' ? 'primary' : 'secondary'} onClick={() => setPaymentMode('partial')}>Parcial</Button></div><Select label="Banco" value={paymentForm.accountId} onChange={e => setPaymentForm(c => ({ ...c, accountId: e.target.value }))} options={accountOptions} required /><div className="payment-app__fields"><Input label="Data efetiva" type="date" value={paymentForm.settledOn} onChange={e => setPaymentForm(c => ({ ...c, settledOn: e.target.value }))} /><MoneyInput label="Valor efetivo" value={paymentForm.amount} onValueChange={amount => setPaymentForm(c => ({ ...c, amount }))} /></div><Input label="Observação" value={paymentForm.notes} onChange={e => setPaymentForm(c => ({ ...c, notes: e.target.value }))} /><div className="payment-app__result"><span>Saldo restante após confirmar</span><strong>{currency.format(remainingAfter)}</strong></div></div></Dialog><Dialog open={differenceConfirm} title="Confirmar valor diferente" description={`Diferença de ${currency.format(absoluteDifference)} em relação ao saldo.`} confirmLabel="Confirmar" onClose={() => setDifferenceConfirm(false)} onBack={() => setDifferenceConfirm(false)} onConfirm={() => void savePayment(true)}><Feedback tone="warning" title="Valor diferente" message="O valor efetivo informado será registrado na baixa." /></Dialog></>;

  if (action === 'edit') return <Dialog open={open} title="Editar lançamento" description={entry.installmentCount > 1 ? `Parcela ${entry.installmentNumber}/${entry.installmentCount}. Escolha o alcance da alteração.` : 'Altere os dados do lançamento.'} loading={busy} confirmLabel="Salvar" onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => void saveEdit()}>{localError && <Feedback tone="danger" title="Não foi possível editar" message={localError} />}{scopeChoices}<div className="quick-entry edit-entry-app"><div className="quick-entry__form-card"><div className="quick-entry__two-col"><Input label="Descrição" value={editForm.description} onChange={e => setEditForm(c => ({ ...c, description: e.target.value }))} required /><MoneyInput label="Valor da parcela" value={editForm.amount} onValueChange={amount => setEditForm(c => ({ ...c, amount }))} required /></div><div className="quick-entry__two-col"><Select label="Categoria" value={editForm.categoryId} onChange={e => setEditForm(c => ({ ...c, categoryId: e.target.value }))} options={categoryOptions} required /><Input label={isIncome ? 'Pagador' : 'Fornecedor'} value={editForm.counterparty} onChange={e => setEditForm(c => ({ ...c, counterparty: e.target.value }))} /></div><Select label="Obra / Centro de custo" value={editForm.costCenterId} onChange={e => setEditForm(c => ({ ...c, costCenterId: e.target.value }))} options={costCenterOptions} /><Input label="Vencimento" type="date" value={editForm.dueDate} onChange={e => setEditForm(c => ({ ...c, dueDate: e.target.value }))} required /><Input label="Observação" value={editForm.notes} onChange={e => setEditForm(c => ({ ...c, notes: e.target.value }))} /></div></div></Dialog>;

  if (action === 'delete') return <Dialog open={open} title="Excluir lançamento" description={entry.installmentCount > 1 ? `Parcela ${entry.installmentNumber}/${entry.installmentCount}. Escolha o alcance da exclusão.` : 'Esta ação não pode ser desfeita.'} loading={busy} confirmLabel="Excluir" onClose={() => setAction('details')} onBack={() => setAction('details')} onConfirm={() => void confirmDelete()}>{localError && <Feedback tone="danger" title="Não foi possível excluir" message={localError} />}{scopeChoices}<Feedback tone="danger" title="Confirme a exclusão" message={maintenanceScope === 'following' ? 'A parcela selecionada e todas as seguintes ainda não baixadas serão excluídas.' : 'Somente a parcela selecionada será excluída.'} /></Dialog>;

  return <Dialog open={open} title={entry.description} description={`${isIncome ? 'A receber' : 'A pagar'} · ${formatDate(entry.dueDate)}`} onClose={onClose} onBack={onClose}><div className="monthly-account-detail"><section className={`monthly-account-detail__hero ${isIncome ? 'monthly-account-detail__hero--income' : 'monthly-account-detail__hero--expense'}`}><span className="monthly-account-detail__hero-icon">{isIncome ? <Banknote aria-hidden="true" /> : <WalletCards aria-hidden="true" />}</span><div><small>{paid ? 'Valor baixado' : partial ? 'Saldo restante' : isIncome ? 'Valor a receber' : 'Valor a pagar'}</small><strong>{currency.format(paid ? entry.amount : remaining)}</strong></div><span className={`monthly-account-detail__status ${paid ? 'is-paid' : partial ? 'is-partial' : 'is-pending'}`}>{paid ? 'Baixada' : partial ? 'Parcial' : 'Pendente'}</span></section><section className="monthly-account-detail__info"><div><CalendarDays aria-hidden="true" /><span><small>Vencimento</small><strong>{formatDate(entry.dueDate)}</strong></span></div><div><CheckCircle2 aria-hidden="true" /><span><small>Parcela</small><strong>{entry.installmentCount > 1 ? `${entry.installmentNumber}/${entry.installmentCount}` : 'Única'}</strong></span></div>{entry.counterpartyName && <div className="monthly-account-detail__counterparty"><span><small>{isIncome ? 'Pagador' : 'Fornecedor'}</small><strong>{entry.counterpartyName}</strong></span></div>}</section>{!paid && <section className="monthly-account-detail__actions" aria-label="Ações do lançamento"><Button className="monthly-account-detail__action monthly-account-detail__action--pay" onClick={openPayment}><WalletCards aria-hidden="true" /><span>{isIncome ? 'Receber' : partial ? 'Completar pagamento' : 'Pagar'}</span></Button><Button variant="secondary" className="monthly-account-detail__action monthly-account-detail__action--edit" onClick={openEdit}><Pencil aria-hidden="true" /><span>Editar</span></Button><Button variant="danger" className="monthly-account-detail__action monthly-account-detail__action--delete" onClick={openDelete}><Trash2 aria-hidden="true" /><span>Excluir</span></Button></section>}</div></Dialog>;
}
