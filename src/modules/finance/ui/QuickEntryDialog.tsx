import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CopyPlus, Eraser } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { CreditCard } from '../domain/cards';
import type { FinancialAccount } from '../domain/registries';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';
import type { BenefitCard } from './PersonalBenefits';

declare const __GESTAO_APP_VARIANT__: 'primary' | 'secondary';
const PERSONAL_APP = __GESTAO_APP_VARIANT__ === 'secondary';
type EntryType = 'expense' | 'income';
type LaunchType = 'single' | 'installment' | 'recurring';
type PaymentMethod = 'pix' | 'debit' | 'credit' | 'benefit' | 'cash' | 'transfer' | 'boleto' | 'other';
type InlineRegistry = 'costCenter' | 'category';
type OwnedAccount = FinancialAccount & { ownerLabel: string };
type OwnedCard = CreditCard & { ownerLabel: string };
type SmartTemplate = {
  description: string;
  companyId: string;
  entryType: EntryType;
  categoryId: string;
  costCenterId: string;
  accountRef: string;
  paymentMethod: PaymentMethod;
  cardRef: string;
  counterparty: string;
  launchType: LaunchType;
  installmentCount: string;
  occurredOn: string;
};
type FinancialTemplateMetaRow = {
  id: string;
  company_id: string;
  payment_method: string | null;
  planned_account_id: string | null;
  planned_account_company_id: string | null;
  created_at: string;
};
type CardTemplateRow = {
  company_id: string;
  expense_company_id: string | null;
  card_id: string;
  purchase_date: string;
  description: string;
  counterparty_name: string | null;
  category_id: string;
  cost_center_id: string | null;
  installment_count: number | string;
  created_at: string;
};

interface QuickEntryDialogProps {
  open: boolean;
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
  allCompaniesMode?: boolean;
  initialPaymentMethod?: PaymentMethod;
  initialAccountRef?: string;
  initialCardRef?: string;
  embedded?: boolean;
  initialValues?: { date?: string; description?: string; amount?: number; counterparty?: string; notes?: string };
  onSaved?: () => void;
  onClose: () => void;
}

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const idempotencyKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 14);
const amountFromDigits = (digits: string) => Number(digits || '0') / 100;
const formatMoneyDigits = (digits: string) => digits
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountFromDigits(digits))
  : '';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
const paymentRef = (companyId: string, resourceId: string) => `${companyId}::${resourceId}`;

function parsePaymentRef(value: string): { companyId: string; resourceId: string } | null {
  const separator = value.indexOf('::');
  if (separator <= 0) return null;
  return { companyId: value.slice(0, separator), resourceId: value.slice(separator + 2) };
}

function paymentMethodFromStored(value: string | null | undefined): PaymentMethod {
  const raw = normalized(value ?? '');
  if (!raw || raw === 'pix') return 'pix';
  if (raw === 'debit' || raw.includes('debito')) return 'debit';
  if (raw === 'credit' || raw.includes('credito')) return 'credit';
  if (raw === 'cash' || raw.includes('dinheiro')) return 'cash';
  if (raw === 'transfer' || raw.includes('transfer')) return 'transfer';
  if (raw.includes('boleto')) return 'boleto';
  return 'other';
}

function smartTemplateRank(template: SmartTemplate, query: string): number {
  const description = normalized(template.description);
  if (description === query) return 3;
  if (description.startsWith(query)) return 2;
  if (description.includes(query)) return 1;
  return 0;
}

function findSmartTemplate(templates: readonly SmartTemplate[], query: string): SmartTemplate | null {
  let best: SmartTemplate | null = null;
  let bestRank = 0;
  for (const template of templates) {
    const rank = smartTemplateRank(template, query);
    if (rank > bestRank) {
      best = template;
      bestRank = rank;
      if (rank === 3) break;
    }
  }
  return best;
}

function companyName(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR')) return 'PR';
  if (raw.includes('CR')) return 'CR';
  return company.tradeName ?? company.legalName;
}

function companySubtitle(company: CompanySummary): string {
  const short = companyName(company);
  if (short === 'CR') return 'CR Engenharia';
  if (short === 'PR') return 'PR Instalações';
  if (short === 'Pessoal') return 'Uso pessoal';
  return company.tradeName ?? company.legalName;
}

const COST_CENTER_ORDER = ['Admin', 'Blaze', 'CR', 'Pessoal', 'PR', 'Sartori'] as const;

function costCenterLabel(code: string | null, name: string): string | null {
  const raw = `${code ?? ''} ${name}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('ADMIN')) return 'Admin';
  if (raw.includes('BLAZE')) return 'Blaze';
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('SARTORI')) return 'Sartori';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  return null;
}

function canonicalCostCenters<T extends { id: string; code: string | null; name: string }>(rows: readonly T[]) {
  const chosen = new Map<string, T>();
  const extras: T[] = [];
  for (const item of rows) {
    const label = costCenterLabel(item.code, item.name);
    if (!label) {
      extras.push(item);
      continue;
    }
    const current = chosen.get(label);
    const currentHistoric = current ? /HIST/i.test(`${current.code ?? ''} ${current.name}`) : true;
    const candidateHistoric = /HIST/i.test(`${item.code ?? ''} ${item.name}`);
    if (!current || (currentHistoric && !candidateHistoric)) chosen.set(label, item);
  }
  return [
    ...COST_CENTER_ORDER.flatMap((label) => chosen.get(label) ? [{ item: chosen.get(label)!, label }] : []),
    ...extras.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((item) => ({ item, label: item.name })),
  ];
}

function recurrenceEnd(start: string, count: number): string {
  const [year = 1970, month = 1, day = 1] = start.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + Math.max(0, count - 1), 1, 12));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

export function QuickEntryDialog({ open, companies, initialCompanyId = '', initialPaymentMethod, initialAccountRef = '', initialCardRef = '', embedded = false, initialValues, onSaved, onClose }: QuickEntryDialogProps) {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState(initialCompanyId || companies[0]?.id || '');
  const [moreOptions, setMoreOptions] = useState(false);
  const [inlineRegistry, setInlineRegistry] = useState<InlineRegistry | null>(null);
  const [newRegistryName, setNewRegistryName] = useState('');
  const [templates, setTemplates] = useState<readonly SmartTemplate[]>([]);
  const manuallyEdited = useRef<Set<string>>(new Set());
  const manualCompany = useRef(false);
  const [paymentAccounts, setPaymentAccounts] = useState<readonly OwnedAccount[]>([]);
  const [paymentCards, setPaymentCards] = useState<readonly OwnedCard[]>([]);
  const [benefitCards, setBenefitCards] = useState<BenefitCard[]>([]);
  const benefitCompanyIds = companies.map(item => item.id).join(',');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSettle, setAutoSettle] = useState(false);
  const [autoSettleFrom, setAutoSettleFrom] = useState<string | null>(null);
  const autoSettleEffective = autoSettle || (autoSettleFrom !== null && today() >= autoSettleFrom);
  const [autoSettleReady, setAutoSettleReady] = useState(false);
  const [savingAutoSettle, setSavingAutoSettle] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (!PERSONAL_APP || !companyId) return;
    let cancelled = false;
    setAutoSettle(false);
    setAutoSettleFrom(null);
    setAutoSettleReady(false);
    void getSupabaseClient().from('personal_finance_preferences').select('auto_settle_on_entry,auto_settle_from').eq('company_id', companyId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setLocalError('Não foi possível consultar o modo de lançamentos. A baixa automática ficará bloqueada.'); return; }
      setAutoSettle(data?.auto_settle_on_entry === true);
      setAutoSettleFrom(data?.auto_settle_from ?? null);
      setAutoSettleReady(true);
    });
    return () => { cancelled = true; };
  }, [companyId]);
  async function changeAutoSettle(enabled: boolean) {
    const selected = companies.find(item => item.id === companyId);
    if (!selected || !autoSettleReady || savingAutoSettle) return;
    setSavingAutoSettle(true);
    const { error } = await getSupabaseClient().from('personal_finance_preferences').upsert({
      company_id: selected.id, tenant_id: selected.tenantId, auto_settle_on_entry: enabled, auto_settle_from: null, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (error) setLocalError('Não foi possível alterar o modo de lançamentos: ' + error.message);
    else { setAutoSettle(enabled); setAutoSettleFrom(null); setLocalError(null); }
    setSavingAutoSettle(false);
  }
  const [form, setForm] = useState({
    entryType: 'expense' as EntryType,
    date: today(),
    description: '',
    amountDigits: '',
    paymentMethod: 'pix' as PaymentMethod,
    launchType: 'single' as LaunchType,
    installmentCount: '2',
    recurrenceCount: '12', recurrenceFrequency: 'monthly' as 'monthly' | 'weekly', ongoingInstallment: false, currentInstallment: '1', totalInstallments: '12', ongoingCardInstallment: false,
    accountRef: '',
    cardRef: '',
    categoryId: '',
    costCenterId: '',
    counterparty: '',
    notes: '',
    includeInBudget: false,
  });

  // A fresh companies array after a save must not reset the user's retained form.
  const firstCompanyId = companies[0]?.id ?? '';
  useEffect(() => {
    if (!open) return;
    setCompanyId(initialCompanyId || firstCompanyId);
    manuallyEdited.current.clear();
    manualCompany.current = false;
    setMoreOptions(false);
    setInlineRegistry(null);
    setNewRegistryName('');
    setLocalError(null);
    setLocalSuccess(null);
    setForm({
      entryType: 'expense', date: initialValues?.date ?? today(), description: initialValues?.description ?? '', amountDigits: initialValues?.amount ? String(Math.round(initialValues.amount * 100)) : '', paymentMethod: initialPaymentMethod ?? 'pix', launchType: 'single',
      installmentCount: '2', recurrenceCount: '12', recurrenceFrequency: 'monthly', ongoingInstallment: false, currentInstallment: '1', totalInstallments: '12', accountRef: initialAccountRef, cardRef: initialCardRef, categoryId: '', costCenterId: '',
      counterparty: initialValues?.counterparty ?? '', notes: initialValues?.notes ?? '', includeInBudget: false,
    });
  }, [firstCompanyId, initialAccountRef, initialCardRef, initialCompanyId, initialPaymentMethod, initialValues?.amount, initialValues?.counterparty, initialValues?.date, initialValues?.description, initialValues?.notes, open]);

  useEffect(() => { if (!open || !PERSONAL_APP || !benefitCompanyIds) return; let cancelled = false; void getSupabaseClient().from('personal_benefit_cards').select('*').in('company_id', benefitCompanyIds.split(',')).eq('status', 'active').then(({data}) => { if (!cancelled) setBenefitCards((data || []) as BenefitCard[]); }); return () => { cancelled = true; }; }, [open, benefitCompanyIds]);
  const company = companies.find((item) => item.id === companyId) ?? companies[0];
  const scope = useMemo(() => ({ tenantId: company?.tenantId ?? '', companyId: company?.id ?? '' }), [company?.id, company?.tenantId]);
  const operations = useFinanceOperations(scope, 'quick');
  const references = operations.state.references;
  const isCrIncome = Boolean(company && companyName(company) === 'CR' && form.entryType === 'income');

  useEffect(() => {
    if (!open || companies.length === 0) return;
    let cancelled = false;
    setPaymentLoading(true);
    void (async () => {
      const repositories = getFinanceRepositories();
      const rows = await Promise.all(companies.map(async (owner) => {
        const ownerScope = { tenantId: owner.tenantId, companyId: owner.id };
        const [accounts, cards] = await Promise.all([
          repositories.registries.listAccounts(ownerScope),
          repositories.cards.listCards(ownerScope),
        ]);
        return {
          accounts: accounts.filter((item) => item.status === 'active').map((item) => ({ ...item, ownerLabel: companyName(owner) })),
          cards: cards.filter((item) => item.status === 'active').map((item) => ({ ...item, ownerLabel: companyName(owner) })),
        };
      }));
      if (!cancelled) {
        setPaymentAccounts(rows.flatMap((item) => item.accounts));
        setPaymentCards(rows.flatMap((item) => item.cards));
        setPaymentLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setPaymentAccounts([]);
        setPaymentCards([]);
        setPaymentLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [companies, open]);

  useEffect(() => {
    if (!open || companies.length === 0 || PERSONAL_APP) {
      if (PERSONAL_APP) setTemplates([]);
      return;
    }
    let cancelled = false;
    const loadTemplates = () => void (async () => {
      const repositories = getFinanceRepositories();
      const supabase = getSupabaseClient();
      const tenantId = companies[0]?.tenantId;
      if (!tenantId) return;

      const [entryLists, financialMetaResult, cardResult] = await Promise.all([
        Promise.all(companies.map(async (entryCompany) => ({
          companyId: entryCompany.id,
          rows: await repositories.entries.list({ tenantId: entryCompany.tenantId, companyId: entryCompany.id }),
        }))),
        supabase
          .from('financial_entries')
          .select('id,company_id,payment_method,planned_account_id,planned_account_company_id,created_at')
          .eq('tenant_id', tenantId)
          .in('company_id', companies.map(item => item.id))
          .order('created_at', { ascending: false })
          .limit(250)
          .returns<FinancialTemplateMetaRow[]>(),
        supabase
          .from('card_transactions')
          .select('company_id,expense_company_id,card_id,purchase_date,description,counterparty_name,category_id,cost_center_id,installment_count,created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(250)
          .returns<CardTemplateRow[]>(),
      ]);

      if (financialMetaResult.error) throw financialMetaResult.error;
      if (cardResult.error) throw cardResult.error;

      const metaByEntryId = new Map((financialMetaResult.data ?? []).map((row) => [row.id, row]));
      const seenEntryIds = new Set<string>();
      const financialTemplates: SmartTemplate[] = [];
      for (const list of entryLists) {
        for (const row of list.rows) {
          if (seenEntryIds.has(row.entryId)) continue;
          seenEntryIds.add(row.entryId);
          const meta = metaByEntryId.get(row.entryId);
          const method = paymentMethodFromStored(meta?.payment_method);
          const accountCompanyId = meta?.planned_account_company_id ?? list.companyId;
          const installmentCount = Math.max(1, row.installmentCount);
          financialTemplates.push({
            description: row.description,
            companyId: list.companyId,
            entryType: row.entryType,
            categoryId: row.categoryId,
            costCenterId: row.costCenterId ?? '',
            accountRef: row.plannedAccountId ? paymentRef(accountCompanyId, row.plannedAccountId) : '',
            paymentMethod: method,
            cardRef: '',
            counterparty: row.counterpartyName ?? '',
            launchType: installmentCount > 1 ? 'installment' : 'single',
            installmentCount: String(Math.max(2, installmentCount)),
            occurredOn: meta?.created_at ?? row.dueDate,
          });
        }
      }

      const cardTemplates: SmartTemplate[] = (cardResult.data ?? []).map((row) => {
        const installmentCount = Math.max(1, Number(row.installment_count || 1));
        return {
          description: String(row.description ?? ''),
          companyId: String(row.expense_company_id ?? row.company_id ?? ''),
          entryType: 'expense' as const,
          categoryId: String(row.category_id ?? ''),
          costCenterId: row.cost_center_id ? String(row.cost_center_id) : '',
          accountRef: '',
          paymentMethod: 'credit' as const,
          cardRef: paymentRef(String(row.company_id ?? ''), String(row.card_id ?? '')),
          counterparty: String(row.counterparty_name ?? ''),
          launchType: installmentCount > 1 ? 'installment' as const : 'single' as const,
          installmentCount: String(Math.max(2, installmentCount)),
          occurredOn: row.created_at || row.purchase_date,
        };
      });

      if (!cancelled) {
        setTemplates([...cardTemplates, ...financialTemplates].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)));
      }
    })().catch(() => { if (!cancelled) setTemplates([]); });
    const timer = window.setTimeout(loadTemplates, 900);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [companies, open]);

  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const categories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === form.entryType));
  const costCenters = PERSONAL_APP ? activeCostCenters.filter(item => item.name === 'Paulo' || item.name === 'Camila').map(item => ({ item, label: item.name })) : canonicalCostCenters(activeCostCenters);
  const accountOptions = [{ value: '', label: 'Selecione' }, ...paymentAccounts.map((item) => ({ value: paymentRef(item.companyId, item.id), label: PERSONAL_APP ? item.name : `${item.ownerLabel} · ${item.name}` }))];
  const benefitOptions = [{ value: '', label: 'Selecione o benefício' }, ...benefitCards.filter(card => card.company_id === company?.id).map(card => ({ value: card.id, label: card.name }))];
  const cardOptions = [{ value: '', label: 'Selecione o cartão' }, ...paymentCards.map((item) => ({ value: paymentRef(item.companyId, item.id), label: `${item.ownerLabel} · ${item.name}` }))];
  const categoryOptions = [{ value: '', label: 'Selecione' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Selecione' }, ...costCenters.map(({ item, label }) => ({ value: item.id, label }))];
  const paymentOptions = [
    { value: 'pix', label: 'Pix' }, { value: 'debit', label: 'Cartão de débito' },
    ...(form.entryType === 'expense' ? [{ value: 'credit', label: 'Cartão de crédito' }] : []),
    ...(PERSONAL_APP ? [{ value: 'benefit', label: 'Cartão de benefício (VR/VA)' }] : []),
    { value: 'cash', label: 'Dinheiro' }, { value: 'transfer', label: 'Transferência' },
    { value: 'boleto', label: 'Boleto' }, { value: 'other', label: 'Outro' },
  ];

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    manuallyEdited.current.add(field);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setPaymentMethod(value: PaymentMethod) {
    manuallyEdited.current.add('paymentMethod');
    setForm((current) => ({ ...current, paymentMethod: value, launchType: value === 'benefit' ? 'single' : current.launchType, cardRef: value === 'benefit' ? '' : current.cardRef }));
  }

  function selectCompany(nextCompanyId: string) {
    // A mudança manual de empresa não deve descartar o lançamento em andamento.
    // Referências de outra empresa são validadas ao salvar, sem perda silenciosa.
    manualCompany.current = true;
    setCompanyId(nextCompanyId);
    setLocalError(null);
  }

  function smartFill(description: string) {
    // Personal finance is independent: never infer payer, recurrence or other fields from past descriptions.
    if (PERSONAL_APP) {
      set('description', description);
      return;
    }
    const query = normalized(description);
    if (query.length < 3) {
      set('description', description);
      return;
    }
    const match = findSmartTemplate(templates, query);
    if (!match) {
      set('description', description);
      return;
    }
    if (!manualCompany.current && match.companyId && match.companyId !== companyId && companies.some((item) => item.id === match.companyId)) {
      setCompanyId(match.companyId);
    }
    setForm((current) => {
      const suggested = {
        entryType: match.entryType,
        categoryId: match.categoryId,
        costCenterId: match.costCenterId,
        accountRef: match.paymentMethod === 'credit' ? '' : match.accountRef,
        paymentMethod: match.paymentMethod,
        cardRef: match.paymentMethod === 'credit' ? match.cardRef : '',
        counterparty: match.counterparty,
        launchType: match.launchType,
        installmentCount: match.installmentCount,
      };
      const next = { ...current, description };
      for (const key of Object.keys(suggested) as Array<keyof typeof suggested>) {
        if (!manuallyEdited.current.has(key)) Object.assign(next, { [key]: suggested[key] });
      }
      return next;
    });
  }

  function resetAfterSave(keepData: boolean) {
    setLocalSuccess(null);
    if (keepData) return;
    manuallyEdited.current.clear();
    manualCompany.current = false;
    setForm({
      entryType: 'expense', date: today(), description: '', amountDigits: '', paymentMethod: 'pix', launchType: 'single',
      installmentCount: '2', recurrenceCount: '12', recurrenceFrequency: 'monthly', ongoingInstallment: false, currentInstallment: '1', totalInstallments: '12', accountRef: '', cardRef: '', categoryId: '', costCenterId: '',
      counterparty: '', notes: '', includeInBudget: false,
    });
  }

  function clearForm() {
    operations.clearFeedback();
    setLocalError(null);
    setLocalSuccess(null);
    setMoreOptions(false);
    resetAfterSave(false);
  }

  function exitQuickEntry() {
    onClose();
    if (!embedded) void navigate('/');
  }

  async function createInlineRegistry(kind: InlineRegistry) {
    const name = newRegistryName.trim();
    if (!name || !company) return;
    operations.clearFeedback();
    setLocalError(null);
    try {
      if (kind === 'category') {
        const created = await operations.createCategory({ name, kind: form.entryType });
        await operations.loadReferences();
        set('categoryId', created.id);
      } else {
        const created = await operations.createCostCenter({ name, code: null });
        await operations.loadReferences();
        set('costCenterId', created.id);
      }
      setInlineRegistry(null);
      setNewRegistryName('');
    } catch (error) {
      setLocalError(error instanceof Error && error.message ? error.message : 'Não foi possível concluir o cadastro rápido.');
    }
  }

  async function launch(keepData: boolean) {
    operations.clearFeedback();
    setLocalError(null);
    setLocalSuccess(null);
    const amount = amountFromDigits(form.amountDigits);
    if (!company || !form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.categoryId) {
      setLocalError('Preencha descrição, valor e categoria.');
      return;
    }
    if (PERSONAL_APP && form.paymentMethod === 'benefit' && form.entryType === 'income' && form.launchType === 'single' && form.date > today()) { setLocalError('Crédito futuro do benefício: selecione Recorrente para programar sem alterar o saldo atual.'); return; }
    if (PERSONAL_APP && form.paymentMethod === 'benefit' && (!form.cardRef || (form.launchType !== 'single' && !(form.entryType === 'income' && form.launchType === 'recurring')))) { setLocalError('Selecione um cartão de benefício. Para créditos mensais, use Recorrente; despesas devem ser Único.'); return; }
    if (form.paymentMethod === 'credit' && (!form.cardRef || form.entryType !== 'expense')) {
      setLocalError('Selecione um cartão válido.');
      return;
    }
    const immediatePayment = ['pix', 'debit', 'cash'].includes(form.paymentMethod);
    if (immediatePayment && !form.accountRef) {
      setLocalError('Selecione o banco/conta usado no pagamento.');
      return;
    }
    if (PERSONAL_APP && form.launchType === 'recurring' && form.ongoingInstallment) {
      const current = Number(form.currentInstallment);
      const total = Number(form.totalInstallments);
      if (form.recurrenceFrequency !== 'monthly' || !Number.isSafeInteger(current) || !Number.isSafeInteger(total) || current < 1 || total < current || total > 1200) {
        setLocalError('Informe parcela atual e total válidos (até 1.200 parcelas) para a recorrência mensal.');
        return;
      }
    }
    if (PERSONAL_APP && form.paymentMethod === 'credit' && form.launchType === 'installment' && form.ongoingCardInstallment) {
      const current = Number(form.currentInstallment), total = Number(form.totalInstallments);
      if (!Number.isSafeInteger(current) || !Number.isSafeInteger(total) || current < 1 || total < 2 || total > 120 || current > total) {
        setLocalError('Informe a parcela atual e o total de parcelas do cartão (até 120).');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (PERSONAL_APP && form.paymentMethod === 'benefit') {
        const benefit = benefitCards.find(card => card.id === form.cardRef && card.company_id === company.id);
        if (!benefit) throw new Error('Cartão de benefício não encontrado para esta empresa.');
        const db = getSupabaseClient();
        if (form.launchType === 'recurring') {
          if (form.entryType !== 'income' || form.recurrenceFrequency !== 'monthly') throw new Error('Créditos recorrentes de benefício devem ser receitas mensais.');
          const startDay = Number(form.date.slice(8, 10));
          const { error: ruleError } = await db.from('personal_benefit_recurring_credits').upsert({
            tenant_id: company.tenantId, company_id: company.id, card_id: benefit.id,
            description: form.description.trim(), amount, day_of_month: startDay, active: true,
          }, { onConflict: 'card_id' });
          if (ruleError) throw ruleError;
        } else {
        if (form.entryType === 'expense') {
          const { data: prior, error: priorError } = await db.from('personal_benefit_movements').select('amount,direction').eq('card_id', benefit.id);
          if (priorError) throw priorError;
          const balance = Number(benefit.opening_balance) + (prior || []).reduce((sum, item) => sum + Number(item.amount) * (item.direction === 'credit' ? 1 : -1), 0);
          if (balance < amount) throw new Error('Saldo insuficiente no cartão de benefício.');
        }
        const { error: movementError } = await db.from('personal_benefit_movements').insert({ tenant_id: company.tenantId, company_id: company.id, card_id: benefit.id, movement_date: form.date, description: form.description.trim(), amount, direction: form.entryType === 'income' ? 'credit' : 'debit', category_id: form.categoryId });
        if (movementError) throw movementError;
        }
        window.dispatchEvent(new Event('finance-benefit-changed'));
      } else if (form.launchType === 'recurring') {
        const count = form.ongoingInstallment && PERSONAL_APP ? Number(form.totalInstallments) - Number(form.currentInstallment) + 1 : Math.max(1, Math.trunc(Number(form.recurrenceCount || '1')));
        await operations.createRecurrence({
          entryType: form.entryType, description: form.description.trim(), counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId, costCenterId: form.costCenterId || null, amount, frequency: form.recurrenceFrequency, intervalCount: form.recurrenceFrequency === 'weekly' ? 2 : 1,
          startDate: form.date, endDate: form.recurrenceFrequency === 'weekly' ? new Date(Date.parse(form.date + 'T12:00:00Z') + (count - 1) * 14 * 86400000).toISOString().slice(0, 10) : recurrenceEnd(form.date, count), notes: [form.notes.trim(), ...(PERSONAL_APP && form.ongoingInstallment ? [`[personal-installments:${form.currentInstallment}/${form.totalInstallments}]`] : []), ...(PERSONAL_APP && form.accountRef ? [`[personal-planned-account:${form.accountRef}]`] : [])].filter(Boolean).join('\n') || null,
        });
      } else if (form.paymentMethod === 'credit') {
        const card = parsePaymentRef(form.cardRef);
        if (!card) throw new Error('Selecione um cartão válido.');
        const installmentCount = form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1;
        const baseArgs = {
          p_tenant_id: company.tenantId,
          p_card_id: card.resourceId,
          p_purchase_date: form.date,
          p_description: form.description.trim(),
          p_counterparty_name: form.counterparty.trim() || null,
          p_category_id: form.categoryId,
          p_cost_center_id: form.costCenterId || null,
          p_total_amount: amount,
          p_installment_count: installmentCount,
          p_notes: form.notes.trim() || null,
        };
        const ongoingCard = PERSONAL_APP && form.launchType === 'installment' && form.ongoingCardInstallment;
        const result = ongoingCard
          ? await getSupabaseClient().rpc('create_ongoing_card_purchase', {
              p_tenant_id: company.tenantId,
              p_card_company_id: card.companyId,
              p_expense_company_id: company.id,
              p_card_id: card.resourceId,
              p_first_statement_month: form.date.slice(0, 7) + '-01',
              p_description: form.description.trim(),
              p_counterparty_name: form.counterparty.trim() || null,
              p_category_id: form.categoryId,
              p_cost_center_id: form.costCenterId || null,
              p_installment_amount: amount,
              p_current_installment: Number(form.currentInstallment),
              p_total_installments: Number(form.totalInstallments),
              p_idempotency_key: idempotencyKey('quick-card-ongoing'),
              p_notes: form.notes.trim() || null,
            })
          : card.companyId === company.id
            ? await getSupabaseClient().rpc('create_card_purchase', {
                ...baseArgs,
                p_company_id: company.id,
                p_idempotency_key: idempotencyKey('quick-card-purchase'),
              })
            : await getSupabaseClient().rpc('create_card_purchase_cross_company', {
                ...baseArgs,
                p_card_company_id: card.companyId,
                p_expense_company_id: company.id,
                p_idempotency_key: idempotencyKey('quick-card-purchase-cross-company'),
              });
        if (result.error) throw new Error(result.error.message || 'Não foi possível concluir o lançamento no cartão.');
        window.dispatchEvent(new Event('finance-card-order-changed'));
      } else {
        const created = await operations.createEntry({
          entryType: form.entryType, description: form.description.trim(), counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId, costCenterId: form.costCenterId || null, competenceMonth: monthStart(form.date),
          dueDate: form.date, amount,
          installmentCount: form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1,
          notes: form.notes.trim() || null,
        });
        const includeInBudget = isCrIncome ? form.includeInBudget : true;
        const budgetUpdate = await getSupabaseClient()
          .from('financial_entries')
          .update({ include_in_budget: includeInBudget, payment_method: form.paymentMethod })
          .eq('tenant_id', company.tenantId)
          .eq('company_id', company.id)
          .eq('id', created.entryId);
        if (budgetUpdate.error) throw budgetUpdate.error;
        const account = parsePaymentRef(form.accountRef);
        if (account) await getFinanceRepositories().entries.setPlannedAccount(scope, created.entryId, account.resourceId, account.companyId);
        const shouldAutoSettle = (!PERSONAL_APP || (autoSettleReady && autoSettleEffective)) && ['pix', 'debit', 'cash'].includes(form.paymentMethod)
          && form.launchType === 'single'
          && form.date <= today();
        if (shouldAutoSettle) {
          if (!account || !created.installmentId) throw new Error('Não foi possível identificar a conta ou parcela para concluir o pagamento.');
          await operations.settleInstallment({
            installmentId: created.installmentId,
            accountId: account.resourceId,
            settledOn: form.date,
            amount,
            idempotencyKey: idempotencyKey(`quick-${form.paymentMethod}-settlement`),
            notes: form.notes.trim() || `Liquidação automática via ${form.paymentMethod === 'pix' ? 'Pix' : form.paymentMethod === 'debit' ? 'débito' : 'dinheiro'}`,
          });
          window.dispatchEvent(new Event('finance-bank-order-changed'));
        }
      }

      const learnedTemplate: SmartTemplate = {
        description: form.description.trim(),
        companyId: company.id,
        entryType: form.entryType,
        categoryId: form.categoryId,
        costCenterId: form.costCenterId,
        accountRef: form.paymentMethod === 'credit' ? '' : form.accountRef,
        paymentMethod: form.paymentMethod,
        cardRef: form.paymentMethod === 'credit' ? form.cardRef : '',
        counterparty: form.counterparty.trim(),
        launchType: form.launchType,
        installmentCount: form.installmentCount,
        occurredOn: new Date().toISOString(),
      };
      setTemplates((current) => [
        learnedTemplate,
        ...current.filter((item) => !(normalized(item.description) === normalized(learnedTemplate.description) && item.companyId === learnedTemplate.companyId)),
      ]);

      // A gravação já foi confirmada. Falhas de atualização visual não podem
      // transformar um lançamento concluído em erro nem incentivar duplicação.
      resetAfterSave(keepData);
      setLocalSuccess(keepData ? 'Lançamento concluído. Todos os dados foram mantidos.' : 'Lançamento concluído. Pronto para o próximo lançamento.');
      // Notifique as telas imediatamente após a confirmação da gravação.
      // Recarregar cadastros (categorias, contas e cartões) é uma operação
      // independente e não pode atrasar a atualização de saldos/extratos.
      window.dispatchEvent(new Event('finance-data-changed'));
      onSaved?.();
      void operations.loadReferences().catch(() => {
        // Falha de atualização de cadastros não desfaz o lançamento salvo.
      });
    } catch (error) {
      setLocalError(error instanceof Error && error.message ? error.message : 'Não foi possível concluir o lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  const busy = operations.state.busy || paymentLoading || submitting;
  const footer = <div className="quick-entry__footer-actions">
    <Button className="quick-entry__footer-action quick-entry__footer-action--clear" variant="tertiary" disabled={busy} onClick={clearForm}><Eraser className="quick-entry__footer-icon" aria-hidden="true"/><span>Limpar</span></Button>
    <Button className="quick-entry__footer-action quick-entry__footer-action--keep" variant="secondary" disabled={busy} onClick={() => { void launch(true); }}><CopyPlus className="quick-entry__footer-icon" aria-hidden="true"/><span>Lançar e manter dados</span></Button>
    <Button className="quick-entry__footer-action quick-entry__footer-action--launch" loading={busy} loadingLabel="Lançando…" onClick={() => { void launch(false); }}><Check className="quick-entry__footer-icon" aria-hidden="true"/><span>Lançar</span></Button>
  </div>;

  return <Dialog open={open} title="Novo lançamento" description="Registre uma receita ou despesa" variant={PERSONAL_APP ? "quick-entry-personal" : "quick-entry"} onClose={exitQuickEntry} onBack={exitQuickEntry} loading={busy} footer={footer}>
    {!company ? <Feedback tone="danger" title="Empresa obrigatória" message="Selecione uma empresa para continuar." /> : !references && operations.state.busy ? <LoadingState label="Carregando dados do lançamento…" /> : <>
      {(localError || (!localSuccess && operations.state.errorMessage)) && <Feedback tone="danger" title="Não foi possível lançar" message={localError || operations.state.errorMessage || ''} />}
      {(localSuccess ?? operations.state.successMessage) && <Feedback tone="success" title="Lançamento concluído" message={localSuccess ?? operations.state.successMessage ?? ''} />}
      <div className={`quick-entry${PERSONAL_APP ? " quick-entry--personal" : ""}`}>
        <div className="quick-entry__hero">
          <div className="quick-entry__type-switch" role="group" aria-label="Tipo do lançamento">
            <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--expense${form.entryType === 'expense' ? ' is-selected' : ''}`} aria-pressed={form.entryType === 'expense'} onClick={() => set('entryType', 'expense')}>
              <span className="quick-entry__choice-check">{form.entryType === 'expense' ? '✓' : '○'}</span><span className="quick-entry__choice-icon">↓</span><span><strong>Despesa</strong><small>Saída de dinheiro</small></span>
            </Button>
            <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--income${form.entryType === 'income' ? ' is-selected' : ''}`} aria-pressed={form.entryType === 'income'} onClick={() => set('entryType', 'income')}>
              <span className="quick-entry__choice-check">{form.entryType === 'income' ? '✓' : '○'}</span><span className="quick-entry__choice-icon">↑</span><span><strong>Receita</strong><small>Entrada de dinheiro</small></span>
            </Button>
          </div>
        </div>

        <div className="quick-entry__form-card">
          <div className="quick-entry__two-col">
            <Input label="Data" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            <Input label="Valor" autoComplete={PERSONAL_APP ? "off" : undefined} inputMode="numeric" placeholder="R$ 0,00" value={formatMoneyDigits(form.amountDigits)} onChange={(event) => set('amountDigits', digitsOnly(event.target.value))} required />
          </div>
          <Input label="Descrição" autoComplete={PERSONAL_APP ? "off" : undefined} placeholder="Ex.: Café da manhã" value={form.description} onChange={(event) => smartFill(event.target.value)} required />

          <div className="quick-entry__two-col">
            <div className="quick-entry__registry-field"><div className="quick-entry__registry-control">
              <Select label="Categoria" value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} options={categoryOptions} required />
              <Button className="quick-entry__add" aria-label="Adicionar categoria" onClick={() => { setInlineRegistry(inlineRegistry === 'category' ? null : 'category'); setNewRegistryName(''); }}>＋</Button>
            </div>{inlineRegistry === 'category' && <div className="quick-entry__registry-create"><Input label="Nova categoria" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('category'); }}>Adicionar</Button></div>}</div>
            <Input label={form.entryType === 'expense' ? 'Fornecedor' : 'Pagador / origem'} autoComplete={PERSONAL_APP ? "off" : undefined} placeholder="Selecione / digite" value={form.counterparty} onChange={(event) => set('counterparty', event.target.value)} />
          </div>

          {!PERSONAL_APP && <div className="quick-entry__company-section">
            <strong className="quick-entry__section-label">▥ Empresa</strong>
            <div className="quick-entry__company-options">
              {companies.map((item) => {
                const selected = item.id === companyId;
                const short = companyName(item);
                return <Button key={item.id} variant="tertiary" className={`quick-entry__company-choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => selectCompany(item.id)}>
                  <span className="quick-entry__company-check">{selected ? '✓' : short === 'Pessoal' ? '◎' : '▥'}</span>
                  <span><strong>{short}</strong><small>{companySubtitle(item)}</small></span>
                </Button>;
              })}
            </div>
          </div>}

          <div className="quick-entry__registry-field"><div className="quick-entry__registry-control">
            <Select label="Obra / Centro de custo" value={form.costCenterId} onChange={(event) => set('costCenterId', event.target.value)} options={costCenterOptions} />
            <Button className="quick-entry__add" aria-label="Adicionar obra ou centro de custo" onClick={() => { setInlineRegistry(inlineRegistry === 'costCenter' ? null : 'costCenter'); setNewRegistryName(''); }}>＋</Button>
          </div>{inlineRegistry === 'costCenter' && <div className="quick-entry__registry-create"><Input label="Nova obra / centro de custo" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('costCenter'); }}>Adicionar</Button></div>}</div>

          <div className="quick-entry__two-col quick-entry__payment-fields">
            <Select label="Forma de pagamento" value={form.paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} options={paymentOptions} />
            {form.paymentMethod === 'benefit' ? <Select label="Cartão de benefício" value={form.cardRef} onChange={(event) => set('cardRef', event.target.value)} options={benefitOptions} required /> : form.paymentMethod === 'credit' ? <Select label="Cartão" value={form.cardRef} onChange={(event) => set('cardRef', event.target.value)} options={cardOptions} required /> : <Select label="Banco / Conta" value={form.accountRef} onChange={(event) => set('accountRef', event.target.value)} options={accountOptions} />}
          </div>
          {PERSONAL_APP && <div className="quick-entry__budget-toggle quick-entry__auto-settle-toggle" hidden aria-hidden="true">
            <label><input type="checkbox" checked={autoSettleEffective} disabled={!autoSettleReady || savingAutoSettle || submitting} onChange={event => { void changeAutoSettle(event.target.checked); }} />
              <span><strong>Baixa automática de Pix, débito e dinheiro</strong><small>{autoSettleEffective ? 'Operação normal: lançamentos únicos com data de hoje ou anterior são pagos automaticamente.' : autoSettleFrom ? `Cadastro inicial até ${autoSettleFrom.split('-').reverse().join('/')}. A baixa automática volta nessa data.` : 'Cadastro inicial: despesas ficam pendentes, mesmo com Pix e conta selecionada.'}</small></span>
            </label>
          </div>}
        </div>

        <div className="quick-entry__launch-section">
          <strong className="quick-entry__section-label">▱ Tipo de lançamento</strong>
          <div className="quick-entry__launch-options">
            <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'single' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'single'} onClick={() => set('launchType', 'single')}>
              <span className="quick-entry__launch-check">{form.launchType === 'single' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">▱</span><span><strong>Único</strong><small>À vista</small></span>
            </Button>
            <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'installment' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'installment'} onClick={() => { if (form.paymentMethod !== 'benefit') set('launchType', 'installment'); }} disabled={form.paymentMethod === 'benefit'}>
              <span className="quick-entry__launch-check">{form.launchType === 'installment' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">▤</span><span><strong>Parcelado</strong><small>Várias parcelas</small></span>
            </Button>
            {form.paymentMethod !== 'credit' && (form.paymentMethod !== 'benefit' || form.entryType === 'income') && <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'recurring' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'recurring'} onClick={() => { set('launchType', 'recurring'); if (form.paymentMethod === 'benefit') set('recurrenceFrequency', 'monthly'); }}>
              <span className="quick-entry__launch-check">{form.launchType === 'recurring' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">⟳</span><span><strong>Recorrente</strong><small>Mensal ou quinzenal</small></span>
            </Button>}
          </div>
          {PERSONAL_APP && form.paymentMethod === 'credit' && form.launchType === 'installment' && <label className="quick-entry__budget-toggle"><input type="checkbox" checked={form.ongoingCardInstallment} onChange={event=>set('ongoingCardInstallment',event.target.checked)} /> Compra já parcelada (em andamento)</label>}
          {form.launchType === 'installment' && !(PERSONAL_APP && form.paymentMethod === 'credit' && form.ongoingCardInstallment) && <Input label="Quantidade de parcelas" type="number" min="2" max="120" value={form.installmentCount} onChange={(event) => set('installmentCount', event.target.value)} required />}
          {PERSONAL_APP && form.paymentMethod === 'credit' && form.launchType === 'installment' && form.ongoingCardInstallment && <div className="quick-entry__ongoing-card"><p>Informe o valor de <strong>uma parcela</strong> no campo Valor. A data acima indica o mês da primeira fatura a cadastrar. As parcelas anteriores não serão recriadas.</p><div className="quick-entry__field-grid"><Input label="Parcela atual" type="number" min="1" max="120" value={form.currentInstallment} onChange={event=>set('currentInstallment',event.target.value)} required /><Input label="Total de parcelas" type="number" min="2" max="120" value={form.totalInstallments} onChange={event=>set('totalInstallments',event.target.value)} required /></div></div>}
          {form.launchType === 'recurring' && form.paymentMethod !== 'benefit' && <Select label="Frequência" value={form.recurrenceFrequency} onChange={(event) => set('recurrenceFrequency', event.target.value as 'monthly' | 'weekly')} options={[{ value: 'monthly', label: 'Mensal' }, { value: 'weekly', label: 'Quinzenal (a cada 2 semanas)' }]} />}
          {PERSONAL_APP && form.paymentMethod !== 'benefit' && form.launchType === 'recurring' && form.recurrenceFrequency === 'monthly' && <label className="quick-entry__budget-toggle"><input type="checkbox" checked={form.ongoingInstallment} onChange={event=>set('ongoingInstallment',event.target.checked)} /> Parcelamento em andamento</label>}
          {PERSONAL_APP && form.paymentMethod !== 'benefit' && form.launchType === 'recurring' && form.recurrenceFrequency === 'monthly' && form.ongoingInstallment && <div className="quick-entry__field-grid"><Input label="Parcela atual" type="number" min="1" max="1200" value={form.currentInstallment} onChange={event=>set('currentInstallment',event.target.value)} required /><Input label="Total de parcelas" type="number" min="1" max="1200" value={form.totalInstallments} onChange={event=>set('totalInstallments',event.target.value)} required /></div>}
          {form.launchType === 'recurring' && form.paymentMethod !== 'benefit' && !(PERSONAL_APP && form.ongoingInstallment && form.recurrenceFrequency === 'monthly') && <Input label="Quantidade de repetições" type="number" min="1" max="120" value={form.recurrenceCount} onChange={(event) => set('recurrenceCount', event.target.value)} required />}
          {isCrIncome && form.launchType !== 'recurring' && <label className="quick-entry__budget-toggle">
            <input type="checkbox" checked={form.includeInBudget} onChange={(event) => set('includeInBudget', event.target.checked)} />
            <span><strong>Considerar no orçamento</strong><small>Desmarcado: registra a entrada financeira, mas não soma na receita realizada do orçamento da CR.</small></span>
          </label>}
        </div>

        <Button className="quick-entry__action-row" variant="secondary" onClick={() => setMoreOptions((value) => !value)} aria-expanded={moreOptions}>
          <span>▤</span><span><strong>Observações (opcional)</strong><small>{form.notes || 'Adicione uma observação…'}</small></span><span>›</span>
        </Button>
        {moreOptions && <div className="quick-entry__notes"><Input label="Observação" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></div>}
      </div>
    </>}
  </Dialog>;
}
