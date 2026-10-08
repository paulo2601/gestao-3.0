import { useMemo } from 'react';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';
import { chooseActiveExecutionMeasurement, deriveExecutionProjection } from '../domain/measurementExecutionProjection';
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
interface Props {model:MeasurementParityModel;measurementId?:string}
export function MeasurementExecutionOverview({model,measurementId}:Props){
 const activeId=measurementId||chooseActiveExecutionMeasurement(model);
 const measurement=model.measurements.find(item=>item.id===activeId);
 const items=useMemo(()=>activeId?deriveExecutionProjection(model,activeId):[],[model,activeId]);
 const projected=items.reduce((sum,item)=>sum+item.plannedValue,0);
 return <section className="measurement-execution-overview">
  <header><strong>Executado</strong><small>Medição {measurement?.measurementNumber??'—'} · {measurement?.competence?.slice(0,7)??'Sem competência'}</small></header>
  <div className="measurement-execution-overview__cards">
   <div><small>Projetado</small><strong>{money.format(projected)}</strong></div>
   <div><small>Serviços previstos</small><strong>{items.length}</strong></div>
  </div>
  <p>O projetado é lido diretamente da medição. Não é necessário cadastrar outro planejamento.</p>
  {items.length===0?<p>Nenhum serviço lançado nesta medição.</p>:<div className="measurement-execution-overview__items">{items.map(item=>
   <article key={item.measurementLineId}>
    <strong>{item.description}</strong>
    <small>{item.reference||'Serviço geral'}</small>
    <span>Projetado: {item.plannedQuantity.toLocaleString('pt-BR')} {item.unit} · {money.format(item.plannedValue)}</span>
   </article>)}</div>}
  <p role="status">Registro diário da execução em preparação. Os valores financeiros da medição permanecem intactos.</p>
 </section>;
}
