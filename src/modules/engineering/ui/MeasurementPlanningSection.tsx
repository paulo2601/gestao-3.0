import type { Dispatch, SetStateAction } from 'react';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';
import { loadMeasurementPlanning, recordMeasurementExecution, upsertMeasurementPlan, type PlannedService, type ExecutionEntry } from '../infrastructure/MeasurementPlanningRepository';
import { MeasurementPlanForm } from './MeasurementPlanForm';
import { MeasurementExecutionEntryForm } from './MeasurementExecutionEntryForm';
import { MeasurementExecutionPanel } from './MeasurementExecutionPanel';
import { originLabel } from './guidedMeasurementHelpers';

interface Props {
  scope: { tenantId: string; companyId: string };
  mid: string;
  model: MeasurementParityModel;
  planning: { plans: PlannedService[]; executions: ExecutionEntry[] };
  setPlanning: Dispatch<SetStateAction<{ plans: PlannedService[]; executions: ExecutionEntry[] }>>;
  planningOriginId: string | null;
  setPlanningOriginId: Dispatch<SetStateAction<string | null>>;
  selectedExecutionPlan: PlannedService | null;
  setSelectedExecutionPlan: Dispatch<SetStateAction<PlannedService | null>>;
  executionUnits: string[];
}

export function MeasurementPlanningSection({scope,mid,model,planning,setPlanning,planningOriginId,setPlanningOriginId,selectedExecutionPlan,setSelectedExecutionPlan,executionUnits}:Props) {
  return <>
    {mid&&<section className="measurement-execution-plan-actions"><strong>Planejamento mensal</strong>
      <select aria-label="Escolher origem para planejar" value={planningOriginId??''} onChange={event=>setPlanningOriginId(event.target.value||null)}>
        <option value="">Planejar por torre ou aditivo…</option>
        {model.origins.map(item=><option key={item.id} value={item.id}>{originLabel(item)}</option>)}
      </select>
      {planningOriginId&&model.origins.some(item=>item.id===planningOriginId)&&<MeasurementPlanForm origin={model.origins.find(item=>item.id===planningOriginId)!}
        onCancel={()=>setPlanningOriginId(null)}
        onSave={async input=>{
          const chosen=model.origins.find(item=>item.id===planningOriginId);
          if(!chosen)throw new Error('Origem não encontrada');
          await upsertMeasurementPlan(scope,{measurementId:mid,originType:chosen.type,originId:chosen.id,targetKind:input.targetKind,targetId:input.targetId,plannedQuantity:input.quantity});
          setPlanning(await loadMeasurementPlanning(scope,mid));
          setPlanningOriginId(null);
        }}/>}
    </section>}
    {mid&&planning.plans.length>0&&<MeasurementExecutionPanel plans={planning.plans} executions={planning.executions} onSelectPlan={setSelectedExecutionPlan}/>}
    {selectedExecutionPlan&&<MeasurementExecutionEntryForm plan={selectedExecutionPlan} availableUnits={executionUnits}
      usedUnits={planning.executions.filter(entry=>entry.planId===selectedExecutionPlan.id).map(entry=>entry.unitReference).filter((value):value is string=>Boolean(value))}
      alreadyExecuted={planning.executions.filter(entry=>entry.planId===selectedExecutionPlan.id).reduce((sum,entry)=>sum+entry.executedQuantity,0)}
      onCancel={()=>setSelectedExecutionPlan(null)}
      onSave={async input=>{
        await recordMeasurementExecution(scope,{planId:selectedExecutionPlan.id,executionDate:input.executionDate,quantity:input.quantity,unitReference:input.unitReference});
        setPlanning(await loadMeasurementPlanning(scope,selectedExecutionPlan.measurementId));
        setSelectedExecutionPlan(null);
      }}/>}
  </>;
}
