import { useEffect, useMemo, useState } from 'react';
import type { CompanyScope } from '../domain/registries';
import type { FinanceMonthlySummary } from '../domain/monthly';
import type { FinancialAccountBalance } from '../domain/accounts';
import type { CreditCardLimit } from '../domain/cards';
import type { FinancialEntryListItem } from '../domain/entries';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';

interface FinanceOverviewData {
  month: string;
  summary: readonly FinanceMonthlySummary[];
  accountBalances: readonly FinancialAccountBalance[];
  cardLimits: readonly CreditCardLimit[];
  entries: readonly FinancialEntryListItem[];
}

type FinanceOverviewState =
  | { status: 'idle' | 'loading'; data: FinanceOverviewData | null; errorMessage: null }
  | { status: 'ready'; data: FinanceOverviewData; errorMessage: null }
  | { status: 'error'; data: null; errorMessage: string };

function currentMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function useFinanceOverview(scope: CompanyScope | null, refreshToken = 0): FinanceOverviewState {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const tenantId = scope?.tenantId ?? null;
  const companyId = scope?.companyId ?? null;
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const refresh = () => setSyncTick(value => value + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(onVisible, 20_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('finance-data-changed', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('finance-data-changed', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const [state, setState] = useState<FinanceOverviewState>({ status: 'idle', data: null, errorMessage: null });

  useEffect(() => {
    if (!tenantId || !companyId) { setState({ status: 'idle', data: null, errorMessage: null }); return; }
    const activeScope: CompanyScope = { tenantId, companyId };
    let cancelled = false;
    const month = currentMonthStart();

    // Em atualizações, preserva a visão já renderizada. Isso evita a tela inteira
    // voltar para "Carregando" enquanto consultas independentes são renovadas.
    setState(previous => previous.data ? previous : { status: 'loading', data: null, errorMessage: null });

    void Promise.all([
      repositories.monthly.summarize({ ...activeScope, competenceFrom: month, competenceTo: month }),
      repositories.accounts.listBalances(activeScope),
      repositories.cards.listLimits(activeScope),
      repositories.entries.list(activeScope),
    ])
      .then(([summary, accountBalances, cardLimits, entries]) => {
        if (cancelled) return;
        setState({ status: 'ready', data: { month, summary, accountBalances, cardLimits, entries }, errorMessage: null });
      })
      .catch(() => {
        if (cancelled) return;
        // Se a atualização falhar, mantém os últimos dados válidos em vez de
        // derrubar a página que o usuário já estava utilizando.
        setState(previous => previous.data ? previous : { status: 'error', data: null, errorMessage: 'Não foi possível atualizar os dados financeiros. Verifique sua conexão e tente novamente.' });
      });

    return () => { cancelled = true; };
  }, [repositories, tenantId, companyId, refreshToken, syncTick]);

  return state;
}
