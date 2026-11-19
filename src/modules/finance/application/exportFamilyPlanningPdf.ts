import type { FamilyMonthProjection } from './familyProjection';

/** Generate a downloadable, paginated report without changing finance records. */
export async function exportFamilyPlanningPdf(months: readonly FamilyMonthProjection[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const margin = 12;
  const bottom = 194;
  let y = 15;
  const newPage = () => { pdf.addPage(); y = 15; };
  const line = (value: string, size = 9, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const wrapped = pdf.splitTextToSize(value, 270) as string[];
    for (const part of wrapped) {
      if (y > bottom) newPage();
      pdf.text(part, margin, y);
      y += size <= 8 ? 4.2 : 5.4;
    }
  };
  line('GESTÃO 3.0  |  PLANEJAMENTO FINANCEIRO FAMILIAR', 15, true);
  line('Empresa: Pessoal  |  Orçamento bruto projetado de 12 meses', 9);
  line('O saldo projetado não é o saldo bancário futuro. Compras de cartão não devem ser somadas novamente aos pagamentos das faturas.', 8);
  y += 3;
  line('RESUMO MENSAL', 11, true);
  for (const month of months) {
    const pendingNonCard = month.items.filter(item => item.entryType === 'expense' && item.sourceKind === 'financial_installment')
      .reduce((sum, item) => sum + Math.max(0, item.pendingAmount), 0);
    line(`${month.month}  |  Receitas: ${money(month.income)}  |  Despesas: ${money(month.expenses)}  |  Resultado: ${money(month.net)}  |  Saldo projetado: ${money(month.closingBalance)}`, 8);
    line(`  Pendente fora cartões: ${money(pendingNonCard)}  |  Cartões: conferir pagamentos por fatura`, 8);
  }
  const allItems = months.flatMap(month => month.items);
  const debts = new Map<string, { description: string; count: number; last: number; total: number; pending: number }>();
  for (const item of allItems) {
    if (item.entryType !== 'expense' || item.sourceKind !== 'financial_installment' || item.installmentCount <= 1) continue;
    const existing = debts.get(item.parentId);
    if (existing) {
      existing.count++;
      existing.last = Math.max(existing.last, item.installmentNumber);
      existing.pending += Math.max(0, item.pendingAmount);
    } else {
      debts.set(item.parentId, { description: item.description, count: 1, last: item.installmentNumber, total: item.installmentCount, pending: Math.max(0, item.pendingAmount) });
    }
  }
  y += 4;
  line('COMPROMISSOS PARCELADOS FORA DOS CARTÕES', 11, true);
  line('O saldo pendente corresponde apenas às parcelas dentro do período; não é valor de quitação do contrato.', 8);
  if (!debts.size) line('Nenhum compromisso parcelado identificado.', 8);
  for (const debt of debts.values()) {
    line(`${debt.description} | ${debt.count} parcelas no período | última ${debt.last}/${debt.total} | após período: ${Math.max(0, debt.total - debt.last)} | pendente no período: ${money(debt.pending)}`, 8);
  }
  for (const month of months) {
    newPage();
    line(`LANÇAMENTOS  |  ${month.month}`, 13, true);
    line(`Receitas: ${money(month.income)}   Despesas: ${money(month.expenses)}   Saldo projetado: ${money(month.closingBalance)}`, 9);
    y += 3;
    if (!month.items.length) line('Nenhum lançamento cadastrado ou projetado.', 9);
    for (const item of month.items) {
      const type = item.entryType === 'income' ? 'ENTRADA' : item.sourceKind === 'card_installment' ? 'CARTÃO' : 'SAÍDA';
      const pending = item.sourceKind === 'card_installment' ? 'Conferir fatura' : `Pendente: ${money(item.pendingAmount)}`;
      line(`${type} | ${item.dueDate} | ${item.description} | ${item.installmentNumber}/${item.installmentCount} (faltam ${item.remainingInstallments}) | ${money(item.plannedAmount)} | ${pending}`, 8);
    }
    y += 3;
    line('Valores de cartão dependem da conciliação da fatura; o pagamento da fatura não foi contabilizado como nova despesa.', 8);
  }
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Gestão 3.0  •  Página ${page} de ${count}`, margin, 202);
  }
  pdf.save(`planejamento-familiar-${months[0]?.month ?? '12-meses'}.pdf`);
}
