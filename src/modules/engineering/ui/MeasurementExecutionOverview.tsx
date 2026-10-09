import { Dialog } from '../../../shared/ui/Dialog';
import { useEffect, useMemo, useState } from 'react';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';
import { chooseActiveExecutionMeasurement, deriveExecutionProjection } from '../domain/measurementExecutionProjection';
import { loadLineExecutions, saveLineExecution, saveLineExecutionsBatch, updateLineExecution, deleteLineExecution, type LineExecution } from '../infrastructure/MeasurementLineExecutionRepository';
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
interface Props {model:MeasurementParityModel;measurementId?:string;scope:{tenantId:string;companyId:string}}
const today=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')};
export function MeasurementExecutionOverview({model,measurementId,scope}:Props){
 const activeId=measurementId||chooseActiveExecutionMeasurement(model);
 const measurement=model.measurements.find(item=>item.id===activeId);
 const items=useMemo(()=>activeId?deriveExecutionProjection(model,activeId):[],[model,activeId]);
 const [entries,setEntries]=useState<LineExecution[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [selectedReferences,setSelectedReferences]=useState<string[]>([]);
 const [editing,setEditing]=useState<string|null>(null);
 const [pendingDelete,setPendingDelete]=useState<string|null>(null);
 const [quantity,setQuantity]=useState('1');
 const [entryMode,setEntryMode]=useState<'quantity'|'value'|'percent'>('quantity');
 const [date,setDate]=useState(today);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState<'all'|'pending'|'done'>('all');
 const ids=useMemo(()=>items.map(item=>item.measurementLineId),[items]);
 useEffect(()=>{let live=true;setLoading(true);setError(null);void loadLineExecutions(scope,ids)
 .then(rows=>{if(live)setEntries(rows)})
 .catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'Falha ao carregar execução')})
 .finally(()=>{if(live)setLoading(false)});
 return()=>{live=false};},[scope,ids]);
 const doneByLine=useMemo(()=>{const sums=new Map<string,number>();for(const entry of entries)sums.set(entry.measurementLineId,(sums.get(entry.measurementLineId)??0)+entry.executedQuantity);return sums},[entries]);
 const projected=items.reduce((sum,item)=>sum+item.plannedValue,0);
 const executed=items.reduce((sum,item)=>sum+Math.min(item.plannedQuantity,doneByLine.get(item.measurementLineId)??0)*(item.plannedQuantity>0?item.plannedValue/item.plannedQuantity:0),0);
 const filtered=items.filter(item=>{
  const done=doneByLine.get(item.measurementLineId)??0;
  if(statusFilter==='pending'&&done>=item.plannedQuantity)return false;
  if(statusFilter==='done'&&done<item.plannedQuantity)return false;
  const query=search.trim().toLocaleLowerCase('pt-BR');
  return !query||[item.description,item.reference??'',item.unit].some(value=>value.toLocaleLowerCase('pt-BR').includes(query));
 });
 const groups=useMemo(()=>{
  const map=new Map<string,typeof items>();
  for(const item of items){const key=item.originName+':'+item.targetKind+':'+item.targetId;map.set(key,[...(map.get(key)??[]),item]);}
  return [...map.entries()].map(([key,lines])=>({key,lines}));
 },[items]);
 const filteredGroups=groups.filter(group=>group.lines.some(item=>filtered.includes(item)));
 const activeGroup=groups.find(group=>group.key===selected);
 const current=items.find(item=>item.measurementLineId===selected)??activeGroup?.lines[0];
 const groupCandidates=activeGroup?.lines.filter(item=>(doneByLine.get(item.measurementLineId)??0)<item.plannedQuantity)??[];
 const floorOf=(reference:string|null)=>{const value=(reference??'').trim();const match=value.match(/^(\d+)$/);return match&&match[1]!.length>=3?Number(match[1]!.slice(0,-2))+'º pavimento':/^0?[1-8]$/.test(value)?'Térreo':'Outros'};
 const floorGroups=[...new Set(groupCandidates.map(item=>floorOf(item.reference)))].sort((a,b)=>{const n=(x:string)=>x==='Outros'?-1:parseInt(x,10);return n(a)-n(b)}).map(floor=>({floor,lines:groupCandidates.filter(item=>floorOf(item.reference)===floor).sort((a,b)=>(a.reference??'').localeCompare(b.reference??'','pt-BR',{numeric:true}))}));
 const groupRemaining=activeGroup?.lines.reduce((sum,line)=>sum+Math.max(0,line.plannedQuantity-(doneByLine.get(line.measurementLineId)??0)),0)??0;
 const remaining=current?Math.max(0,current.plannedQuantity-(doneByLine.get(current.measurementLineId)??0)+(editing?entries.find(entry=>entry.id===editing)?.executedQuantity??0:0)):0;
 async function submit(){
  if(!current)return;
  const entered=Number(quantity.replace(/\./g,'').replace(',','.'));
  const batch=activeGroup&&!editing?groupCandidates.filter(item=>selectedReferences.includes(item.measurementLineId)):[];
  const selectedLines=activeGroup&&!editing?batch:[current];
  const value=entryMode==='quantity'?Number(quantity.replace(',','.')):selectedLines.length?entered/(entryMode==='percent'?100: selectedLines.reduce((sum,line)=>sum+line.plannedValue,0))* (entryMode==='percent'?1:1):NaN;
  const quantities=selectedLines.map(line=>entryMode==='quantity'?value:entryMode==='percent'?line.plannedQuantity*entered/100:line.plannedValue>0?entered*line.plannedQuantity/selectedLines.reduce((sum,item)=>sum+item.plannedValue,0):NaN);
  if(activeGroup&&!editing&&batch.length===0){setError('Selecione ao menos uma unidade.');return}
  if(!Number.isFinite(entered)||entered<=0||quantities.some((q,i)=>!Number.isFinite(q)||q<=0||q>selectedLines[i]!.plannedQuantity-(doneByLine.get(selectedLines[i]!.measurementLineId)??0)+(editing?entries.find(e=>e.id===editing)?.executedQuantity??0:0)+0.0000001)){setError('Quantidade inválida ou acima do saldo projetado.');return}
  if(!date){setError('Informe a data da execução.');return}
  setSaving(true);setError(null);
  try{if(editing){await updateLineExecution({id:editing,executionDate:date,quantity:quantities[0]!})}else if(activeGroup){for(let i=0;i<batch.length;i++)await saveLineExecution({measurementLineId:batch[i]!.measurementLineId,executionDate:date,quantity:quantities[i]!})}else{await saveLineExecution({measurementLineId:current.measurementLineId,executionDate:date,quantity:quantities[0]!})}
   setEntries(await loadLineExecutions(scope,ids));setSelected(null);setSelectedReferences([]);setEditing(null);setQuantity('1')}
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
  <div className="measurement-execution-overview__filters">
   <label>Buscar serviço ou apartamento<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 1102 ou esgoto"/></label>
   <label>Situação<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|'pending'|'done')}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="done">Concluídos</option></select></label>
  </div>
  {error&&<p role="alert">{error}</p>}
  {loading?<p>Carregando execução…</p>:items.length===0?<p>Nenhum serviço lançado nesta medição.</p>:filteredGroups.length===0?<p>Nenhum serviço corresponde aos filtros.</p>:<div className="measurement-execution-overview__items">{filteredGroups.map(group=>{
   const planned=group.lines.reduce((sum,item)=>sum+item.plannedQuantity,0);
   const done=group.lines.reduce((sum,item)=>sum+(doneByLine.get(item.measurementLineId)??0),0);
   const value=group.lines.reduce((sum,item)=>sum+item.plannedValue,0);
   return <button type="button" key={group.key} className={`measurement-execution-overview__service ${done>=planned?'is-done':'is-pending'}`} onClick={()=>{setSelected(group.key);setSelectedReferences([]);setEditing(null);setQuantity('1');setError(null)}} disabled={saving}>
    <small>{group.lines[0]?.originName} · {group.lines[0]?.unitKind==='hall'?'Halls / área comum':group.lines[0]?.unitKind==='apartamento'?'Apartamentos':'Unidades'}</small>
    <strong>{group.lines[0]?.description}</strong>
    <small>{planned.toLocaleString('pt-BR')} {group.lines[0]?.unitKind==='hall'?'hall(s)': 'unidade(s)'} previsto(s)</small>
    <span>Projetado: {planned.toLocaleString('pt-BR')} · {money.format(value)}</span>
    <span>Executado: {done.toLocaleString('pt-BR')} · Pendente: {Math.max(0,planned-done).toLocaleString('pt-BR')}</span>
    <span>{done>=planned?'Concluído · Consultar':'Selecionar unidades ›'}</span>
   </button>})}</div>}
  <Dialog open={Boolean(current)} title={editing?"Editar execução":"Registrar execução"} description={current?`${current.originName} · ${current.description} · Medição ${measurement?.measurementNumber??"—"}`:undefined} onClose={()=>{if(!saving){setSelected(null);setEditing(null)}}}>
  {current&&<div className="measurement-execution-overview__entry" role="group" aria-label="Registrar execução">
   {activeGroup&&!editing&&<div className="measurement-execution-overview__units"><strong>{current.originName} · Selecione {current.unitKind==='hall'?'os halls':current.unitKind==='apartamento'?'os apartamentos':'as unidades'} executados</strong>
    <button type="button" onClick={()=>setSelectedReferences(groupCandidates.map(item=>item.measurementLineId))}>Marcar todas as pendentes</button>
    <button type="button" onClick={()=>setSelectedReferences([])}>Limpar seleção</button>
    {floorGroups.map(group=><fieldset key={group.floor}><legend>{group.floor}</legend>
     <label><input type="checkbox" checked={group.lines.every(item=>selectedReferences.includes(item.measurementLineId))} onChange={event=>setSelectedReferences(old=>event.target.checked?[...new Set([...old,...group.lines.map(item=>item.measurementLineId)])]:old.filter(id=>!group.lines.some(item=>item.measurementLineId===id)))}/> Todo o pavimento</label>
     <div className="measurement-execution-overview__unit-grid">{group.lines.map(item=><label key={item.measurementLineId}><input type="checkbox" checked={selectedReferences.includes(item.measurementLineId)} onChange={event=>setSelectedReferences(old=>event.target.checked?[...old,item.measurementLineId]:old.filter(id=>id!==item.measurementLineId))}/>{item.reference??'Serviço geral'}</label>)}</div>
    </fieldset>)}
   </div>}
   <strong>{current.description}</strong><small>Saldo: {(activeGroup&&!editing?groupRemaining:remaining).toLocaleString('pt-BR')} {current.unit}</small>{activeGroup&&!editing&&<small>Selecionadas: {selectedReferences.length} · Quantidade solicitada: {(selectedReferences.length*Number(quantity.replace(',','.'))||0).toLocaleString('pt-BR')}</small>}
   <label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
   <div role="group" aria-label="Forma de lançamento" className="measurement-execution-overview__mode">{(['quantity','value','percent'] as const).map(mode=><button key={mode} type="button" aria-pressed={entryMode===mode} onClick={()=>{setEntryMode(mode);setQuantity('')}}>{mode==='quantity'?'Quantidade':mode==='value'?'Valor (R$)':'Porcentagem (%)'}</button>)}</div>
   <label>{entryMode==='quantity'?'Quantidade por unidade':entryMode==='value'?'Valor total executado (R$)':'Percentual do contratado (%)'}<input inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
   <div><button type="button" onClick={()=>{setSelected(null);setEditing(null)}} disabled={saving}>Cancelar</button><button type="button" onClick={()=>void submit()} disabled={saving||(activeGroup&&!editing?selectedReferences.length===0:remaining<=0)}>{saving?'Salvando…':editing?'Salvar alteração':'Salvar execução'}</button></div>
  </div>}
  </Dialog>
  <details><summary>Histórico diário ({entries.length})</summary>{[...entries].sort((a,b)=>b.executionDate.localeCompare(a.executionDate)).map(entry=><div className="measurement-execution-overview__history-row" key={entry.id}><span>{entry.executionDate.split('-').reverse().join('/')} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.description??'Serviço'} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.originName??'Origem não identificada'} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.reference??'Geral'} · {entry.executedQuantity.toLocaleString('pt-BR')}</span><button type="button" disabled={saving} onClick={()=>{setSelected(entry.measurementLineId);setEditing(entry.id);setQuantity(String(entry.executedQuantity));setDate(entry.executionDate);setError(null)}}>Editar</button><button type="button" disabled={saving} onClick={()=>setPendingDelete(entry.id)}>Excluir</button></div>)}</details>
  <Dialog open={Boolean(pendingDelete)} title="Excluir execução" description="Esta ação excluirá apenas o registro físico de execução, sem alterar a medição financeira." onClose={()=>{if(!saving)setPendingDelete(null)}}>
   <div className="measurement-execution-overview__entry">
    <p>Deseja realmente excluir este lançamento do histórico?</p>
    <div>
     <button type="button" disabled={saving} onClick={()=>setPendingDelete(null)}>Cancelar</button>
     <button type="button" disabled={saving} onClick={()=>{if(!pendingDelete)return;setSaving(true);setError(null);void deleteLineExecution(pendingDelete).then(()=>loadLineExecutions(scope,ids)).then(rows=>{setEntries(rows);setPendingDelete(null)}).catch(cause=>setError(cause instanceof Error?cause.message:'Falha ao excluir')).finally(()=>setSaving(false))}}>{saving?'Excluindo…':'Confirmar exclusão'}</button>
    </div>
   </div>
  </Dialog>
 </section>;
}
