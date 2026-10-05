// Budget workspace entry point.
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { BudgetWorkspacePage as BudgetWorkspacePageImpl } from './BudgetWorkspacePageImpl';
import './budget-entry-v2.css';
import './budget-personal.css';
import './budget-save-action.css';

export function BudgetWorkspacePage({companies,initialCompanyId}:{companies:readonly CompanySummary[];initialCompanyId?:string|undefined}){
  return <BudgetWorkspacePageImpl companies={companies} initialCompanyId={initialCompanyId}/>;
}
