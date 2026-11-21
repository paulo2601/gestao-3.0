import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Button } from '../../../shared/ui/Button';

export type BenefitCard = { id: string; tenant_id: string; company_id: string; name: string; provider: string; opening_balance: number; status: string };
type BenefitMovement = { id: string; card_id: string; movement_date: string; description: string; amount: number; direction: 'credit' | 'debit' };
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const benefitBalance = (card: BenefitCard, movements: BenefitMovement[]) =>
  Number(card.opening_balance) + movements.filter(m => m.card_id === card.id).reduce((sum, m) => sum + Number(m.amount) * (m.direction === 'credit' ? 1 : -1), 0);

export function PersonalBenefits({ companies }: { companies: readonly CompanySummary[] }) {
  const [cards, setCards] = useState<BenefitCard[]>([]);
  const [movements, setMovements] = useState<BenefitMovement[]>([]);
  const [name, setName] = useState('VR Alimentação');
  const [companyId, setCompanyId] = useState('');
  const [opening, setOpening] = useState('0');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [error, setError] = useState('');
  const companyKeys = companies.map(c => c.id).join(',');
  const load = useCallback(async () => {
    const companyIds = companyKeys.split(',').filter(Boolean);
    if (!companyIds.length) return;
    const db = getSupabaseClient();
    const [c, m] = await Promise.all([
      db.from('personal_benefit_cards').select('*').in('company_id', companyIds).eq('status', 'active'),
      db.from('personal_benefit_movements').select('id,card_id,movement_date,description,amount,direction').in('company_id', companyIds).order('movement_date', { ascending: false }),
    ]);
    if (c.error || m.error) { setError(c.error?.message || m.error?.message || 'Erro ao consultar benefícios'); return; }
    setError('');
    setCards((c.data || []) as BenefitCard[]);
    setMovements((m.data || []) as BenefitMovement[]);
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
        <div style={{ marginTop: 12, fontSize: 13 }}>Movimentações <button type="button" onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}>{selectedCard === card.id ? 'Ocultar histórico' : 'Ver histórico completo'}</button></div>
        {movements.filter(m => m.card_id === card.id).slice(0, selectedCard === card.id ? undefined : 8).map(m => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0' }}><span>{m.movement_date.split('-').reverse().join('/')} · {m.description}</span><strong>{m.direction === 'credit' ? '+' : '−'} {brl(Number(m.amount))}</strong></div>)}
      </div>)}
    </div>
  </section>;
}
