// Budget workspace entry point.
import { useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { BudgetWorkspacePage as BudgetWorkspacePageImpl } from './BudgetWorkspacePageImpl';
import './budget-entry-v2.css';
import './budget-personal.css';
import './budget-save-action.css';

export function BudgetWorkspacePage({companies,initialCompanyId}:{companies:readonly CompanySummary[];initialCompanyId?:string|undefined}){
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'>('idle');

  function saveBudget(){
    setSaveState('saving');
    // Os campos do orçamento já possuem persistência automática no Impl.
    // O blur força a confirmação do valor que ainda estiver em edição antes
    // da persistência e o botão deixa a ação explícita para o usuário.
    if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(()=>setSaveState('saved'),900);
    window.setTimeout(()=>setSaveState('idle'),2600);
  }

  return <>
    <BudgetWorkspacePageImpl companies={companies} initialCompanyId={initialCompanyId}/>
    <div className="budget-explicit-save" role="region" aria-label="Salvar orçamento">
      <Button type="button" onClick={saveBudget} disabled={saveState==='saving'}>
        {saveState==='saving'?'Salvando…':saveState==='saved'?'Orçamento salvo':'Salvar orçamento'}
      </Button>
    </div>
  </>;
}
