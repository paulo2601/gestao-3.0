import { useCallback, useEffect, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Card } from '../../../shared/ui/Card';

type CardRow = { id: string; name: string; opening_balance: number };
type MovementRow = { card_id: string; amount: number; direction: 'credit' | 'debit' };
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export function PersonalBenefitOverview({ companies }: { companies: readonly CompanySummary[] }) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [error, setError] = useState(false);
  const companyIds = companies.map(c => c.id).join(',');
  const refresh = useCallback(async () => {
    if (!companyIds) return;
    const ids = companyIds.split(',');
    const db = getSupabaseClient();
    const [c, m] = await Promise.all([
      db.from('personal_benefit_cards').select('id,name,opening_balance').in('company_id', ids).eq('status', 'active'),
      db.from('personal_benefit_movements').select('card_id,amount,direction').in('company_id', ids),
    ]);
    if (c.error || m.error) { setError(true); return; }
    setError(false); setCards((c.data || []) as CardRow[]); setMovements((m.data || []) as MovementRow[]);
  }, [companyIds]);
  useEffect(() => { void refresh(); const listener = () => { void refresh(); }; window.addEventListener('finance-benefit-changed', listener); return () => window.removeEventListener('finance-benefit-changed', listener); }, [refresh]);
  const balances = cards.map(card => ({ ...card, balance: Number(card.opening_balance) + movements.filter(m => m.card_id === card.id).reduce((sum, m) => sum + Number(m.amount) * (m.direction === 'credit' ? 1 : -1), 0) }));
  return <Card title="Saldo de benefícios"><p>Separado das contas bancárias e do saldo disponível em dinheiro.</p>{error ? <p>Não foi possível carregar os benefícios.</p> : balances.length ? <><strong>{money(balances.reduce((sum, card) => sum + card.balance, 0))}</strong>{balances.map(card => <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}><span>{card.name}</span><strong>{money(card.balance)}</strong></div>)}</> : <p>Nenhum cartão de benefício cadastrado.</p>}</Card>;
}
