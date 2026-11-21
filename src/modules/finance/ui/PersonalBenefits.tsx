import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Button } from '../../../shared/ui/Button';

export type BenefitCard = { id: string; tenant_id: string; company_id: string; name: string; provider: string; opening_balance: number; status: string };
type RecurringCredit = { id: string; card_id: string; description: string; amount: number; day_of_month: number; active: boolean };
type BenefitMovement = { id: string; card_id: string; movement_date: string; description: string; amount: number; direction: 'credit' | 'debit' };
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const benefitBalance = (card: BenefitCard, movements: BenefitMovement[]) =>
  Number(card.opening_balance) + movements.filter(m => m.card_id === card.id).reduce((sum, m) => sum + Number(m.amount) * (m.direction === 'credit' ? 1 : -1), 0);

export function PersonalBenefits({ companies }: { companies: readonly CompanySummary[] }) {
  const [cards, setCards] = useState<BenefitCard[]>([]);
  const [movements, setMovements] = useState<BenefitMovement[]>([]);
  const [recurring, setRecurring] = useState<RecurringCredit[]>([]);
  const [recurringAmount, setRecurringAmount] = useState<Record<string,string>>({});
  const [recurringDay, setRecurringDay] = useState<Record<string,string>>({});
  const [name, setName] = useState('VR Alimentação');
  const [companyId, setCompanyId] = useState('');
  const [opening, setOpening] = useState('0');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const companyKeys = companies.map(c => c.id).join(',');
  const load = useCallback(async () => {
    const companyIds = companyKeys.split(',').filter(Boolean);
    if (!companyIds.length) return;
    const db = getSupabaseClient();
    const [c, m, rules] = await Promise.all([
      db.from('personal_benefit_cards').select('*').in('company_id', companyIds).eq('status', 'active'),
      db.from('personal_benefit_movements').select('id,card_id,movement_date,description,amount,direction').in('company_id', companyIds).order('movement_date', { ascending: false }),
      db.from('personal_benefit_recurring_credits').select('*').in('company_id', companyIds),
    ]);
    if (c.error || m.error || rules.error) { setError(c.error?.message || m.error?.message || rules.error?.message || 'Erro ao consultar benefícios'); return; }
    setError('');
    setCards((c.data || []) as BenefitCard[]);
    setMovements((m.data || []) as BenefitMovement[]);
    setRecurring((rules.data || []) as RecurringCredit[]);
  }, [companyKeys]);
  useEffect(() => { void load(); const refresh = () => { void load(); }; window.addEventListener('finance-benefit-changed', refresh); return () => window.removeEventListener('finance-benefit-changed', refresh); }, [load]);
  async function create() {
    const company = companies.find(c => c.id === (companyId || companies[0]?.id));
    const amount = Number(opening.replace(',', '.'));
    if (!company || !name.trim() || !Number.isFinite(amount) || amount < 0) { setError('Informe nome e saldo inicial válidos.'); return; }
    setBusy(true); setError('');
    const { error: issue } = await getSupabaseClient().from('personal_benefit_cards').insert({ tenant_id: company.tenantId, company_id: company.id, name: name.trim(), provider: 'VR', opening_balance: amount });
    setBusy(false);
    if (issue) { setError(issue.message); return; }
    setCreating(false); setOpening('0'); await load();
  }
  async function saveRecurring(card: BenefitCard) {
    const amount = Number((recurringAmount[card.id] || '').replace(',', '.'));
    const day = Number(recurringDay[card.id]);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(day) || day < 1 || day > 31) { setError('Informe valor e dia do mês válidos.'); return; }
    setBusy(true); setError('');
    const { error: issue } = await getSupabaseClient().from('personal_benefit_recurring_credits').upsert({ tenant_id: card.tenant_id, company_id: card.company_id, card_id: card.id, description: 'Crédito mensal de ' + card.name, amount, day_of_month: day, active: true }, { onConflict: 'card_id' });
    setBusy(false); if (issue) { setError(issue.message); return; } await load();
  }
  async function confirmCredit(card: BenefitCard, rule: RecurringCredit) {
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    const day = Math.min(rule.day_of_month, new Date(year, month + 1, 0).getDate());
    const date = [year, String(month + 1).padStart(2,'0'), String(day).padStart(2,'0')].join('-');
    if (new Date(year, month, day) > now) { setError('O crédito mensal ainda não venceu.'); return; }
    setBusy(true); setError('');
    const { error: issue } = await getSupabaseClient().from('personal_benefit_movements').insert({ tenant_id: card.tenant_id, company_id: card.company_id, card_id: card.id, movement_date: date, description: rule.description, amount: rule.amount, direction: 'credit', recurring_credit_id: rule.id });
    setBusy(false); if (issue) { setError(issue.code === '23505' ? 'Este crédito mensal já foi confirmado.' : issue.message); return; }
    await load(); window.dispatchEvent(new Event('finance-benefit-changed'));
  }
  const reportMovements = movements.filter(m => m.movement_date.startsWith(reportMonth));
  const reportCredits = reportMovements.filter(m => m.direction === 'credit').reduce((s,m) => s + Number(m.amount), 0);
  const reportExpenses = reportMovements.filter(m => m.direction === 'debit').reduce((s,m) => s + Number(m.amount), 0);
  function exportReport() {
    const quote = (value: string) => '"' + value.replaceAll('"','""') + '"';
    const lines = [['Data','Cartão','Descrição','Tipo','Valor (R$)'].map(quote).join(';'), ...reportMovements.map(m => [m.movement_date, cards.find(c => c.id === m.card_id)?.name || '', m.description, m.direction === 'credit' ? 'Crédito' : 'Despesa', Number(m.amount).toFixed(2).replace('.',',')].map(quote).join(';'))];
    const blob = new Blob(['\\uFEFF' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'relatorio-beneficios-' + reportMonth + '.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section style={{ marginTop: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <h2>Cartões de benefício</h2><Button onClick={() => setCreating(!creating)}>+ Cartão de benefício</Button>
    </div>
    <p>VR, VA e outros saldos pré-pagos. Não compõem o saldo bancário nem a fatura de crédito.</p>
    {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
    {creating && <div style={{ display: 'grid', gap: 10, maxWidth: 420, marginBottom: 16 }}>
      <label>Nome do cartão<input value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Responsável / empresa<select value={companyId || companies[0]?.id || ''} onChange={e => setCompanyId(e.target.value)}>{companies.map(c => <option key={c.id} value={c.id}>{c.tradeName || c.legalName}</option>)}</select></label>
      <label>Saldo inicial (R$)<input type="number" min="0" step="0.01" value={opening} onChange={e => setOpening(e.target.value)} /></label>
      <Button disabled={busy} onClick={() => { void create(); }}>Salvar benefício</Button>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
      {cards.map(card => <div key={card.id} style={{ border: '1px solid var(--border-color, #d4ddd6)', borderRadius: 14, padding: 16 }}>
        <strong>{card.name}</strong><div style={{ fontSize: 12 }}>Cartão de benefício · {card.provider}</div>
        <div style={{ marginTop: 12 }}>Saldo disponível</div><strong style={{ fontSize: 24 }}>{brl(benefitBalance(card, movements))}</strong>
        <div style={{ marginTop: 12, fontSize: 13 }}><strong>Crédito mensal</strong></div>
        {recurring.find(r => r.card_id === card.id && r.active) ? (() => { const rule = recurring.find(r => r.card_id === card.id && r.active)!; const currentMonth = new Date().toISOString().slice(0,7); const credited = movements.some(m => m.card_id === card.id && m.direction === 'credit' && m.movement_date.startsWith(currentMonth) && m.description === rule.description); return <div><p>{brl(Number(rule.amount))} · dia {rule.day_of_month} · {credited ? 'Crédito registrado neste mês' : 'Aguardando confirmação'}</p><Button disabled={busy || credited} onClick={() => { void confirmCredit(card, rule); }}>Confirmar recebimento deste mês</Button></div>; })() : <div style={{ display: 'grid', gap: 6 }}><label>Valor mensal (R$)<input type="number" min="0.01" step="0.01" value={recurringAmount[card.id] || ''} onChange={e => setRecurringAmount(v => ({ ...v, [card.id]: e.target.value }))} /></label><label>Dia do crédito<input type="number" min="1" max="31" value={recurringDay[card.id] || ''} onChange={e => setRecurringDay(v => ({ ...v, [card.id]: e.target.value }))} /></label><Button disabled={busy} onClick={() => { void saveRecurring(card); }}>Configurar crédito mensal</Button></div>}
        <div style={{ marginTop: 12, fontSize: 13 }}>Movimentações <button type="button" onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}>{selectedCard === card.id ? 'Ocultar histórico' : 'Ver histórico completo'}</button></div>
        {movements.filter(m => m.card_id === card.id).slice(0, selectedCard === card.id ? undefined : 8).map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0' }}><span>{m.movement_date.split('-').reverse().join('/')} · {m.description}</span><strong>{m.direction === 'credit' ? '+' : '−'} {brl(Number(m.amount))}</strong></div>)}
      </div>)}
    </div>
    <section style={{ marginTop: 24 }} aria-label="Relatório de benefícios">
      <h3>Relatório mensal de benefícios</h3>
      <p>Créditos e compras são apresentados separadamente, sem compor entradas, saídas ou saldo bancário.</p>
      <label>Competência <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: '12px 0' }}><div>Créditos <strong>{brl(reportCredits)}</strong></div><div>Despesas <strong>{brl(reportExpenses)}</strong></div><div>Variação do benefício <strong>{brl(reportCredits - reportExpenses)}</strong></div></div>
      <Button onClick={exportReport} disabled={!reportMovements.length}>Exportar relatório CSV</Button>
      <div style={{ marginTop: 12 }}>{reportMovements.map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}><span>{m.movement_date.split('-').reverse().join('/')} · {cards.find(c => c.id === m.card_id)?.name} · {m.description}</span><strong>{m.direction === 'credit' ? '+' : '−'} {brl(Number(m.amount))}</strong></div>)}</div>
    </section>
  </section>;
}
