import { useMemo } from 'react';
import { summarizeExecution } from '../domain/measurementExecutionProgress';
import type { PlannedService, ExecutionEntry } from '../infrastructure/MeasurementPlanningRepository';

const currency = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
interface Props {
  plans: PlannedService[];
  executions: ExecutionEntry[];
  onSelectPlan: (plan: PlannedService) => void;
}
/** Painel de execução separado dos valores já medidos/faturados. */
export function MeasurementExecutionPanel({plans,executions,onSelectPlan}:Props){
  const summary=useMemo(()=>summarizeExecution(plans.map(plan=>({
    id:plan.id,plannedQuantity:plan.plannedQuantity,unitPrice:plan.unitPriceSnapshot,
    executedQuantity:executions.filter(entry=>entry.planId===plan.id)
      .reduce((sum,entry)=>sum+entry.executedQuantity,0)
  }))),[plans,executions]);
  return <section className="measurement-execution-panel">
    <header><strong>Acompanhamento da execução</strong><small>Não altera o bruto da medição.</small></header>
    <div className="measurement-execution-panel__cards">
      <div><small>Planejado</small><strong>{currency.format(summary.plannedValue)}</strong></div>
      <div><small>Executado</small><strong>{currency.format(summary.executedValue)}</strong></div>
      <div><small>Falta executar</small><strong>{currency.format(summary.remainingValue)}</strong></div>
      <div><small>Progresso</small><strong>{summary.financialProgressPercent.toLocaleString('pt-BR')}%</strong></div>
    </div>
    <div className="measurement-execution-panel__items">
      {plans.map(plan=>{
        const done=executions.filter(entry=>entry.planId===plan.id)
          .reduce((sum,entry)=>sum+entry.executedQuantity,0);
        const status=done>=plan.plannedQuantity?'Concluído':done>0?'Parcial':'Pendente';
        return <button type="button" key={plan.id} onClick={()=>onSelectPlan(plan)}>
          <span><strong>{status}</strong><small>{done.toLocaleString('pt-BR')} / {plan.plannedQuantity.toLocaleString('pt-BR')}</small></span>
          <span>Registrar execução ›</span>
        </button>;
      })}
    </div>
  </section>;
}
