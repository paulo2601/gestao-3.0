import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import type { FinanceMonthlyItem } from '../domain/monthly';
import { buildFamilyProjection, maximumFundingGap, projectionMonths } from '../application/familyProjection';
import { forecastRecurrences } from '../application/forecastRecurrences';
import './family-planning.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthName = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};
const currentMonth = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
};
function isPersonal(company: CompanySummary) {
  return (company.tradeName + ' ' + company.legalName).toLocaleUpperCase('pt-BR').includes('PESSOAL');
}
interface Props { companies: readonly CompanySummary[] }
export function FamilyPlanningPage({ companies }: Props) {
  const personal = companies.find(isPersonal);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [monthlyExtraIncome, setMonthlyExtraIncome] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [items, setItems] = useState<readonly FinanceMonthlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tenantId = personal?.tenantId;
  const companyId = personal?.id;
  useEffect(() => {
    if (!tenantId || !companyId) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    const months = projectionMonths(startMonth);
    const repositories = getFinanceRepositories();
    void Promise.all([repositories.monthly.list({
      tenantId, companyId, competenceFrom: months[0] + '-01', competenceTo: months[months.length - 1] + '-01',
    }), repositories.recurrences.list({ tenantId, companyId })]).then(([rows, rules]) => {
      if (active) setItems([...rows, ...forecastRecurrences(rules, rows, months[0], months[months.length - 1])]);
    })
      .catch((reason: unknown) => { if (active) { setItems([]); setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o planejamento.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, companyId, startMonth]);
  const projection = useMemo(() => buildFamilyProjection(items, startMonth, openingBalance), [items, startMonth, openingBalance]);
  const simulated = useMemo(() => projection.reduce((acc, row) => {
    const net = row.net + monthlyExtraIncome + monthlySavings;
    const prior = acc.length ? acc[acc.length - 1].closingBalance : openingBalance;
    acc.push({ month: row.month, net, closingBalance: Math.round((prior + net) * 100) / 100 });
    return acc;
  }, [] as { month: string; net: number; closingBalance: number }[]), [projection, monthlyExtraIncome, monthlySavings, openingBalance]);
  const month = projection.find(row => row.month === selectedMonth) ?? projection[0];
  const maxGap = maximumFundingGap(projection);
  const firstRecovery = projection.find(row => row.closingBalance >= 0 && row.net > 0);
  if (!personal) return <section className="family-plan"><h1>Planejamento familiar</h1><p>Selecione uma conta com acesso à empresa Pessoal para visualizar este planejamento.</p></section>;
  return <section className="family-plan">
    <header className="family-plan__header">
      <div><small>FINANCEIRO · PESSOAL</small><h1>Planejamento financeiro familiar</h1><p>Projeção de 12 meses com cada compromisso discriminado.</p></div>
      <label>Mês inicial <input type="month" value={startMonth} onChange={event => { setStartMonth(event.target.value); setSelectedMonth(event.target.value); }}/></label>
    </header>
    <div className="family-plan__setup"><label>Saldo inicial (R$) <input type="number" step="0.01" value={openingBalance} onChange={event => setOpeningBalance(Number(event.target.value) || 0)}/></label><span>Informe o saldo consolidado das contas pessoais na data inicial. Transferências internas não são receitas.</span></div>
    <div className="family-plan__setup family-plan__actions"><label>Receita extra mensal (R$) <input type="number" step="0.01" value={monthlyExtraIncome} onChange={event => setMonthlyExtraIncome(Number(event.target.value) || 0)}/></label><label>Redução mensal de despesas (R$) <input type="number" step="0.01" value={monthlySavings} onChange={event => setMonthlySavings(Number(event.target.value) || 0)}/></label><button type="button" onClick={() => window.print()}>Imprimir / salvar PDF</button><span>Simulação separada dos valores reais; nenhum lançamento será alterado.</span></div>
    {error && <p role="alert" className="family-plan__error">{error}</p>}
    {loading && <p role="status">Carregando compromissos financeiros...</p>}
    {!loading && !error && <>
      <div className="family-plan__cards">
        <article><small>Receitas previstas (12 meses)</small><strong>{currency.format(projection.reduce((sum, row) => sum + row.income, 0))}</strong></article>
        <article><small>Despesas previstas (12 meses)</small><strong>{currency.format(projection.reduce((sum, row) => sum + row.expenses, 0))}</strong></article>
        <article><small>Maior necessidade de caixa</small><strong className="family-plan__negative">{currency.format(maxGap)}</strong></article>
        <article><small>Primeiro mês de recuperação</small><strong>{firstRecovery ? monthName(firstRecovery.month) : 'Não identificado'}</strong></article>
      </div>
      <div className="family-plan__table-wrap"><table className="family-plan__table"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Saldo acumulado</th><th>Saldo simulado</th></tr></thead><tbody>{projection.map(row => <tr key={row.month} className={month.month === row.month ? 'family-plan__selected' : ''} onClick={() => setSelectedMonth(row.month)}><th><button type="button" onClick={() => setSelectedMonth(row.month)}>{monthName(row.month)}</button></th><td>{currency.format(row.income)}</td><td>{currency.format(row.expenses)}</td><td className={row.net < 0 ? 'family-plan__negative' : ''}>{currency.format(row.net)}</td><td className={row.closingBalance < 0 ? 'family-plan__negative' : ''}>{currency.format(row.closingBalance)}</td><td>{currency.format(simulated.find(s => s.month === row.month)?.closingBalance ?? row.closingBalance)}</td></tr>)}</tbody></table></div>
      <div className="family-plan__detail"><h2>Todos os lançamentos — {monthName(month.month)}</h2><p>Resultado do mês: <strong className={month.net < 0 ? 'family-plan__negative' : ''}>{currency.format(month.net)}</strong> · {month.items.length} parcelas/lançamentos</p>
      <div className="family-plan__table-wrap"><table className="family-plan__table"><thead><tr><th>Tipo</th><th>Descrição / identificação</th><th>Vencimento</th><th>Parcela</th><th>Faltam</th><th>Previsto</th><th>Baixado (fora cartão)</th><th>Pendente (fora cartão)</th></tr></thead><tbody>{month.items.map(item => <tr key={item.sourceKind + item.itemId}><td>{item.entryType === 'income' ? 'Entrada' : item.sourceKind === 'card_installment' ? 'Cartão' : 'Saída'}</td><td><strong>{item.description}</strong>{item.counterpartyName && <small>{item.counterpartyName}</small>}</td><td>{item.dueDate.split('-').reverse().join('/')}</td><td>{item.installmentNumber}/{item.installmentCount}</td><td>{item.remainingInstallments}</td><td>{currency.format(item.plannedAmount)}</td><td>{item.sourceKind === 'card_installment' ? '—' : currency.format(item.realizedAmount)}</td><td>{item.sourceKind === 'card_installment' ? '—' : currency.format(item.pendingAmount)}</td></tr>)}</tbody></table>{month.items.length === 0 && <p>Nenhum lançamento identificado para este mês. Confira se receitas e despesas futuras já estão cadastradas.</p>}</div>
      </div>
      <div className="family-plan__print-all" aria-hidden="true">
        {projection.map(row => <section key={row.month} className="family-plan__print-month">
          <h2>{monthName(row.month)} — Receitas {currency.format(row.income)} · Despesas {currency.format(row.expenses)} · Saldo {currency.format(row.closingBalance)}</h2>
          <table className="family-plan__table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Vencimento</th><th>Parcela</th><th>Faltam</th><th>Previsto</th></tr></thead>
          <tbody>{row.items.map(item => <tr key={item.sourceKind + item.itemId}><td>{item.entryType === 'income' ? 'Entrada' : item.sourceKind === 'card_installment' ? 'Cartão' : 'Saída'}</td><td>{item.description}</td><td>{item.dueDate.split('-').reverse().join('/')}</td><td>{item.installmentNumber}/{item.installmentCount}</td><td>{item.remainingInstallments}</td><td>{currency.format(item.plannedAmount)}</td></tr>)}</tbody></table>
          {row.items.length === 0 && <p>Sem lançamentos cadastrados ou projetados.</p>}
        </section>)}
      </div>
      <p className="family-plan__notice">Projeção baseada nas parcelas atualmente cadastradas. Para cartão, o valor previsto é a compra parcelada; a coluna de baixas não representa pagamento da fatura. Receitas futuras não lançadas, recorrências ainda não geradas e valores de quitação de empréstimos não podem ser presumidos. O saldo inicial é uma simulação local e não altera bancos nem lançamentos.</p>
    </>}
  </section>;
}
