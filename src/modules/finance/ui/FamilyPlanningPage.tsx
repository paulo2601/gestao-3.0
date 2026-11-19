import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import type { FinanceMonthlyItem } from '../domain/monthly';
import { buildFamilyProjection, maximumFundingGap, projectionMonths } from '../application/familyProjection';
import { forecastRecurrences } from '../application/forecastRecurrences';
import './family-planning.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthName = (key: string) => {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};
const currentMonth = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
};
function companyName(company: CompanySummary) { return company.tradeName || company.legalName || 'Empresa'; }
interface Props { companies: readonly CompanySummary[] }
export function FamilyPlanningPage({ companies }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => companies.find(company => companyName(company).toLocaleLowerCase('pt-BR') === 'pessoal')?.id ?? companies[0]?.id ?? '');
  const selectedCompany = companies.find(company => company.id === selectedCompanyId);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [monthlyExtraIncome, setMonthlyExtraIncome] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [items, setItems] = useState<readonly FinanceMonthlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const tenantId = selectedCompany?.tenantId;
  const companyId = selectedCompany?.id;
  useEffect(() => {
    if (!tenantId || !companyId) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) { setLoading(false); setError('Selecione um mês inicial válido.'); return; }
    const months = projectionMonths(startMonth);
    const repositories = getFinanceRepositories();
    void Promise.all([repositories.monthly.list({
      tenantId, companyId, competenceFrom: months[0]! + '-01', competenceTo: months[months.length - 1]! + '-01',
    }), repositories.recurrences.list({ tenantId, companyId })]).then(([rows, rules]) => {
      if (active) setItems([...rows, ...forecastRecurrences(rules, rows, months[0]!, months[months.length - 1]!)]);
    })
      .catch((reason: unknown) => { if (active) { setItems([]); setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o planejamento.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, companyId, startMonth, reload]);
  const projectionResult = useMemo(() => {
    try { return { rows: buildFamilyProjection(items, startMonth, openingBalance), message: '' }; }
    catch (reason) { return { rows: [] as ReturnType<typeof buildFamilyProjection>, message: reason instanceof Error ? reason.message : 'Erro ao calcular a projeção.' }; }
  }, [items, startMonth, openingBalance]);
  const projection = projectionResult.rows;
  const simulated = useMemo(() => projection.reduce((acc, row) => {
    const net = row.net + monthlyExtraIncome + monthlySavings;
    const prior = acc.length ? acc[acc.length - 1]!.closingBalance : openingBalance;
    acc.push({ month: row.month, net, closingBalance: Math.round((prior + net) * 100) / 100 });
    return acc;
  }, [] as { month: string; net: number; closingBalance: number }[]), [projection, monthlyExtraIncome, monthlySavings, openingBalance]);
  const month = projection.find(row => row.month === selectedMonth) ?? projection[0];
  const maxGap = maximumFundingGap(projection);
  const financialExpenses = projection.flatMap(row => row.items).filter(item => item.entryType === 'expense' && item.sourceKind === 'financial_installment');
  const outstanding = financialExpenses.reduce((sum, item) => sum + Math.max(0, item.pendingAmount), 0);
  const settled = financialExpenses.reduce((sum, item) => sum + Math.max(0, item.realizedAmount), 0);
  const cardCount = projection.reduce((sum, row) => sum + row.items.filter(item => item.sourceKind === 'card_installment').length, 0);
  const pendingByMonth = new Map(projection.map(row => [row.month, row.items.filter(item => item.entryType === 'expense' && item.sourceKind === 'financial_installment').reduce((sum, item) => sum + Math.max(0, item.pendingAmount), 0)]));
  const debtGroups = financialExpenses.filter(item => item.installmentCount > 1).reduce((groups, item) => {
    const key = item.parentId;
    const current = groups.get(key);
    if (current) { current.pending += Math.max(0, item.pendingAmount); current.installments += 1; current.latest = Math.max(current.latest, item.installmentNumber); }
    else groups.set(key, { description: item.description, pending: Math.max(0, item.pendingAmount), installments: 1, latest: item.installmentNumber, total: item.installmentCount });
    return groups;
  }, new Map<string, { description: string; pending: number; installments: number; latest: number; total: number }>());
  async function downloadPdf() {
    if (loading || error || projectionResult.message || projection.length !== 12 || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const { exportFamilyPlanningPdf } = await import('../application/exportFamilyPlanningPdf');
      await exportFamilyPlanningPdf(projection);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'Não foi possível gerar o PDF.');
    } finally { setExporting(false); }
  }
  const periodIncome = projection.reduce((sum, row) => sum + row.income, 0);
  const periodExpenses = projection.reduce((sum, row) => sum + row.expenses, 0);
  const periodNet = periodIncome - periodExpenses;
  const highest = Math.max(1, ...projection.flatMap(row => [row.income, row.expenses]));
  const bestMonth = projection.reduce((best, row) => !best || row.net > best.net ? row : best, undefined as typeof projection[number] | undefined);
  const worstMonth = projection.reduce((worst, row) => !worst || row.net < worst.net ? row : worst, undefined as typeof projection[number] | undefined);
  const firstNegativeIndex = projection.findIndex(row => row.closingBalance < 0);
  const firstRecovery = firstNegativeIndex < 0 ? undefined : projection.find((row, index) => index > firstNegativeIndex && row.closingBalance >= 0);
  if (!selectedCompany) return <section className="family-plan"><h1>Painel Orçamentário e Financeiro</h1><p>Nenhuma empresa disponível para consulta.</p></section>;
  return <section className="family-plan">
    <header className="family-plan__header">
      <div><small>GESTÃO 3.0 · FINANCEIRO</small><h1>Painel Orçamentário e Financeiro</h1><p>Visão completa das entradas, saídas e saldo mês a mês. Clique no mês para conferir cada lançamento.</p></div><label>Empresa<select value={selectedCompanyId} onChange={event => setSelectedCompanyId(event.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{companyName(company)}</option>)}</select></label>
      <label>Mês inicial <input type="month" value={startMonth} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) { setStartMonth(event.target.value); setSelectedMonth(event.target.value); } }}/></label>
    </header>
    <div className="family-plan__setup"><label>Saldo inicial (R$) <input type="number" step="0.01" value={openingBalance} onChange={event => setOpeningBalance(Number(event.target.value) || 0)}/></label><span>Informe o saldo consolidado da empresa na data inicial. Transferências internas não são receitas.</span></div>
    <div className="family-plan__setup family-plan__actions"><label>Receita extra mensal (R$) <input type="number" step="0.01" value={monthlyExtraIncome} onChange={event => setMonthlyExtraIncome(Number(event.target.value) || 0)}/></label><label>Redução mensal de despesas (R$) <input type="number" step="0.01" value={monthlySavings} onChange={event => setMonthlySavings(Number(event.target.value) || 0)}/></label><button type="button" onClick={() => void downloadPdf()} disabled={loading || exporting || projection.length !== 12}>{exporting ? 'Gerando PDF...' : 'Baixar PDF detalhado'}</button><button type="button" onClick={() => window.print()}>Imprimir</button><span>Simulação separada dos valores reais; nenhum lançamento será alterado.</span></div>
    {(error || projectionResult.message || exportError) && <p role="alert" className="family-plan__error">{error || projectionResult.message || exportError}</p>}
    <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}>Atualizar dados financeiros</button>
    {loading && <p role="status">Carregando compromissos financeiros...</p>}
    {!loading && !error && !projectionResult.message && month && <>
      <div className="family-plan__cards">
        <article><small>Entradas previstas · 12 meses</small><strong className="family-plan__positive">{currency.format(periodIncome)}</strong></article>
        <article><small>Saídas previstas · 12 meses</small><strong className="family-plan__negative">{currency.format(periodExpenses)}</strong></article>
        <article><small>Resultado do período</small><strong className={periodNet < 0 ? 'family-plan__negative' : 'family-plan__positive'}>{currency.format(periodNet)}</strong></article>
        <article><small>Saldo acumulado projetado</small><strong className={projection[11]!.closingBalance < 0 ? 'family-plan__negative' : ''}>{currency.format(projection[11]!.closingBalance)}</strong></article>
      </div>
      <div className="family-plan__detail"><h2>Comparativo mensal · clique no mês para discriminar</h2>
        <div className="family-plan__table-wrap"><table className="family-plan__table family-plan__monthly"><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th><th>Saldo acumulado</th></tr></thead><tbody>{projection.map(row => <tr key={row.month} className={month.month === row.month ? 'family-plan__selected' : ''}><th><button type="button" aria-expanded={month.month === row.month} onClick={() => setSelectedMonth(row.month)}>{month.month === row.month ? '▾ ' : '› '}{monthName(row.month)}</button></th><td>{currency.format(row.income)}</td><td>{currency.format(row.expenses)}</td><td className={row.net < 0 ? 'family-plan__negative' : 'family-plan__positive'}>{currency.format(row.net)}</td><td className={row.closingBalance < 0 ? 'family-plan__negative' : ''}>{currency.format(row.closingBalance)}</td></tr>)}</tbody></table></div>
      </div>
      <div className="family-plan__detail family-plan__monthly-detail"><h2>{monthName(month.month)} — Detalhamento</h2>
        <div className="family-plan__month-totals"><span>Entradas: <strong className="family-plan__positive">{currency.format(month.income)}</strong></span><span>Saídas: <strong className="family-plan__negative">{currency.format(month.expenses)}</strong></span><span>Resultado: <strong className={month.net < 0 ? 'family-plan__negative' : 'family-plan__positive'}>{currency.format(month.net)}</strong></span></div>
        <div className="family-plan__breakdown">
          {(['income', 'expense'] as const).map(kind => <div className="family-plan__breakdown-panel" key={kind}><h3 className={kind === 'income' ? 'family-plan__positive' : 'family-plan__negative'}>{kind === 'income' ? '↓ Entradas' : '↑ Saídas'} — {currency.format(kind === 'income' ? month.income : month.expenses)}</h3><div className="family-plan__table-wrap"><table className="family-plan__table"><thead><tr><th>Data prevista</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{month.items.filter(item => item.entryType === kind).map(item => <tr key={item.sourceKind + item.itemId}><td>{item.dueDate.split('-').reverse().join('/')}</td><td><strong>{item.description}</strong>{item.counterpartyName && <small>{item.counterpartyName}</small>}{item.installmentCount > 1 && <small>Parcela {item.installmentNumber}/{item.installmentCount} · faltam {item.remainingInstallments}</small>}{item.sourceKind === 'card_installment' && <small>Cartão · pagamento conferir na fatura</small>}</td><td>{currency.format(item.plannedAmount)}</td></tr>)}</tbody></table>{!month.items.some(item => item.entryType === kind) && <p>Nenhum lançamento identificado.</p>}</div></div>)}
        </div>
      </div>
      <div className="family-plan__breakdown family-plan__analytics">
        <div className="family-plan__detail family-plan__chart"><h2>Fluxo de caixa projetado</h2>{projection.map(row => <div className="family-plan__chart-row" key={row.month}><span>{monthName(row.month)}</span><div><i className="family-plan__bar-income" style={{width: (row.income / highest * 100) + '%'}}/><i className="family-plan__bar-expense" style={{width: (row.expenses / highest * 100) + '%'}}/></div><small className={row.closingBalance < 0 ? 'family-plan__negative' : ''}>{currency.format(row.closingBalance)}</small></div>)}</div>
        <div className="family-plan__detail family-plan__insights"><h2>Análise do período</h2><p>Maior resultado positivo: <strong>{bestMonth ? monthName(bestMonth.month) + ' · ' + currency.format(bestMonth.net) : '—'}</strong></p><p>Maior resultado negativo: <strong>{worstMonth ? monthName(worstMonth.month) + ' · ' + currency.format(worstMonth.net) : '—'}</strong></p><p>Primeiro mês de recuperação: <strong>{firstRecovery ? monthName(firstRecovery.month) : 'Não identificado'}</strong></p><p>Maior necessidade de caixa projetada: <strong>{currency.format(maxGap)}</strong></p><p>Saldo final projetado: <strong>{currency.format(projection[11]!.closingBalance)}</strong></p></div>
      </div>
      <p className="family-plan__notice">Valores previstos representam o orçamento bruto, incluindo parcelas já baixadas; o saldo acumulado é uma projeção e não o saldo bancário futuro. Despesas comuns: {currency.format(settled)} baixados e {currency.format(outstanding)} pendentes. {cardCount} parcelas de cartão devem ser conciliadas por fatura, sem duplicar pagamentos. Pendente fora cartões no mês selecionado: {currency.format(pendingByMonth.get(month.month) ?? 0)}. Saldo simulado no mês: {currency.format(simulated.find(row => row.month === month.month)?.closingBalance ?? month.closingBalance)}.</p>
      <div className="family-plan__detail family-plan__debts"><h2>Compromissos parcelados fora dos cartões</h2><p>Valores pendentes apenas das parcelas cadastradas dentro dos 12 meses; não representam o saldo total de quitação dos contratos.</p><div className="family-plan__table-wrap"><table className="family-plan__table"><thead><tr><th>Compromisso</th><th>Parcelas no período</th><th>Última parcela no período</th><th>Restantes após período</th><th>Saldo pendente no período</th></tr></thead><tbody>{[...debtGroups.entries()].map(([key, debt]) => <tr key={key}><th>{debt.description}</th><td>{debt.installments}</td><td>{debt.latest}/{debt.total}</td><td>{Math.max(0, debt.total - debt.latest)}</td><td>{currency.format(debt.pending)}</td></tr>)}</tbody></table>{debtGroups.size === 0 && <p>Nenhum compromisso parcelado fora de cartões no período.</p>}</div></div>
      <div className="family-plan__print-all">
        {projection.map(row => <section key={row.month} className="family-plan__print-month">
          <h2>{monthName(row.month)} — Receitas {currency.format(row.income)} · Despesas {currency.format(row.expenses)} · Saldo {currency.format(row.closingBalance)}</h2>
          <table className="family-plan__table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Vencimento</th><th>Parcela</th><th>Faltam</th><th>Previsto</th><th>Baixado*</th><th>Pendente*</th></tr></thead>
          <tbody>{row.items.map(item => <tr key={item.sourceKind + item.itemId}><td>{item.entryType === 'income' ? 'Entrada' : item.sourceKind === 'card_installment' ? 'Cartão' : 'Saída'}</td><td>{item.description}</td><td>{item.dueDate.split('-').reverse().join('/')}</td><td>{item.installmentNumber}/{item.installmentCount}</td><td>{item.remainingInstallments}</td><td>{currency.format(item.plannedAmount)}</td><td>{item.sourceKind === 'card_installment' ? '—' : currency.format(item.realizedAmount)}</td><td>{item.sourceKind === 'card_installment' ? '—' : currency.format(item.pendingAmount)}</td></tr>)}</tbody></table>
          {row.items.length === 0 && <p>Sem lançamentos cadastrados ou projetados.</p>}
          <p className="family-plan__print-footnote">* Para cartões, baixado e pendente dependem da conciliação da fatura. Valores previstos não representam necessariamente pagamentos ainda devidos.</p>
        </section>)}
      </div>
      <p className="family-plan__notice">Este é um orçamento bruto: o saldo projetado soma valores integrais previstos, inclusive parcelas já baixadas, e não equivale ao saldo bancário futuro nem à necessidade de caixa pendente. Para cartão, o valor previsto é a compra parcelada; a coluna de baixas não representa pagamento da fatura. Receitas futuras sem lançamento nem regra de recorrência e valores de quitação de empréstimos não podem ser presumidos. O saldo inicial é uma simulação local e não altera bancos nem lançamentos.</p>
    </>}
  </section>;
}
