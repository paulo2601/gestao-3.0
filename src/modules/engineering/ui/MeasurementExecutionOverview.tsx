import { useEffect, useMemo, useState } from 'react';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';
import { chooseActiveExecutionMeasurement, deriveExecutionProjection } from '../domain/measurementExecutionProjection';
import { loadLineExecutions, saveLineExecution, type LineExecution } from '../infrastructure/MeasurementLineExecutionRepository';
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
interface Props {model:MeasurementParityModel;measurementId?:string;scope:{tenantId:string;companyId:string}}
const today=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')};
export function MeasurementExecutionOverview({model,measurementId,scope}:Props){
 const activeId=measurementId||chooseActiveExecutionMeasurement(model);
 const measurement=model.measurements.find(item=>item.id===activeId);
 const items=useMemo(()=>activeId?deriveExecutionProjection(model,activeId):[],[model,activeId]);
 const [entries,setEntries]=useState<LineExecution[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [quantity,setQuantity]=useState('1');
 const [date,setDate]=useState(today);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const ids=useMemo(()=>items.map(item=>item.measurementLineId),[items]);
 const idsKey=ids.join(',');
 useEffect(()=>{let live=true;setLoading(true);setError(null);void loadLineExecutions(scope,ids)
 .then(rows=>{if(live)setEntries(rows)})
 .catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'Falha ao carregar execução')})
 .finally(()=>{if(live)setLoading(false)});
 return()=>{live=false};},[scope.tenantId,scope.companyId,idsKey]);
 const doneByLine=useMemo(()=>{const sums=new Map<string,number>();for(const entry of entries)sums.set(entry.measurementLineId,(sums.get(entry.measurementLineId)??0)+entry.executedQuantity);return sums},[entries]);
 const projected=items.reduce((sum,item)=>sum+item.plannedValue,0);
 const executed=items.reduce((sum,item)=>sum+Math.min(item.plannedQuantity,doneByLine.get(item.measurementLineId)??0)*(item.plannedQuantity>0?item.plannedValue/item.plannedQuantity:0),0);
 const current=items.find(item=>item.measurementLineId===selected);
 const remaining=current?Math.max(0,current.plannedQuantity-(doneByLine.get(current.measurementLineId)??0)):0;
 async function submit(){
  if(!current)return;
  const value=Number(quantity.replace(',','.'));
  if(!Number.isFinite(value)||value<=0||value>remaining){setError('Quantidade inválida ou acima do saldo projetado.');return}
  if(!date){setError('Informe a data da execução.');return}
  setSaving(true);setError(null);
  try{await saveLineExecution({measurementLineId:current.measurementLineId,executionDate:date,quantity:value});
   setEntries(await loadLineExecutions(scope,ids));setSelected(null);setQuantity('1')}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar')}
  finally{setSaving(false)}
 }
 return <section className="measurement-execution-overview">
  <header><strong>Executado</strong><small>Medição {measurement?.measurementNumber??'—'} · {measurement?.competence?.slice(0,7)??'Sem competência'}</small></header>
  <div className="measurement-execution-overview__cards">
   <div><small>Projetado</small><strong>{money.format(projected)}</strong></div>
   <div><small>Executado</small><strong>{money.format(executed)}</strong></div>
   <div><small>Pendente</small><strong>{money.format(Math.max(0,projected-executed))}</strong></div>
   <div><small>Conclusão</small><strong>{projected>0?(executed/projected*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):'0'}%</strong></div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {loading?<p>Carregando execução…</p>:items.length===0?<p>Nenhum serviço lançado nesta medição.</p>:<div className="measurement-execution-overview__items">{items.map(item=>{
   const done=doneByLine.get(item.measurementLineId)??0;
   return <button type="button" key={item.measurementLineId} onClick={()=>{setSelected(item.measurementLineId);setError(null)}} disabled={saving}>
    <strong>{item.description}</strong><small>{item.reference||'Serviço geral'}</small>
    <span>Projetado: {item.plannedQuantity.toLocaleString('pt-BR')} {item.unit} · {money.format(item.plannedValue)}</span>
    <span>Executado: {done.toLocaleString('pt-BR')} · Pendente: {Math.max(0,item.plannedQuantity-done).toLocaleString('pt-BR')}</span>
    <span>{done>=item.plannedQuantity?'Concluído':'Registrar execução ›'}</span>
   </button>})}</div>}
  {current&&<div className="measurement-execution-overview__entry" role="group" aria-label="Registrar execução">
   <strong>{current.description}</strong><small>Saldo: {remaining.toLocaleString('pt-BR')} {current.unit}</small>
   <label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
   <label>Quantidade executada<input inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
   <div><button type="button" onClick={()=>setSelected(null)} disabled={saving}>Cancelar</button><button type="button" onClick={()=>void submit()} disabled={saving||remaining<=0}>{saving?'Salvando…':'Salvar execução'}</button></div>
  </div>}
  <details><summary>Histórico diário ({entries.length})</summary>{[...entries].sort((a,b)=>b.executionDate.localeCompare(a.executionDate)).map(entry=><p key={entry.id}>{entry.executionDate.split('-').reverse().join('/')} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.description??'Serviço'} · {entry.executedQuantity.toLocaleString('pt-BR')}</p>)}</details>
 </section>;
}
