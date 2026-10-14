import { Dialog } from '../../../shared/ui/Dialog';
import { useEffect, useMemo, useState } from 'react';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';
import { chooseActiveExecutionMeasurement, deriveExecutionProjection } from '../domain/measurementExecutionProjection';
import { loadLineExecutions, saveLineExecution, updateLineExecution, deleteLineExecution, type LineExecution } from '../infrastructure/MeasurementLineExecutionRepository';
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
interface Props {model:MeasurementParityModel;measurementId?:string;scope:{tenantId:string;companyId:string}}
const formatMoneyInput=(raw:string)=>{const digits=raw.replace(/\D/g,'');return digits?money.format(Number(digits)/100):''};
const parseMoneyInput=(raw:string)=>Number(raw.replace(/[^\d]/g,''))/100;
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
 const [notice,setNotice]=useState<string|null>(null);
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
 const contractStages=useMemo(()=>new Map(model.origins.flatMap(origin=>origin.services.map(service=>[service.targetKind+':'+service.targetId,service] as const))),[model]);
 const contractUnitPrice=(item:typeof items[number])=>contractStages.get(item.targetKind+':'+item.targetId)?.unitPrice??item.unitPrice;
 const contractValue=(item:typeof items[number])=>{const stage=contractStages.get(item.targetKind+':'+item.targetId);return stage?stage.contractedQuantity*stage.unitPrice:item.plannedValue;};
 const groupContractValue=(lines:typeof items)=>[...new Map(lines.map(line=>[line.targetKind+':'+line.targetId,contractValue(line)])).values()].reduce((sum,value)=>sum+value,0);
 const financialExecuted=(item:typeof items[number])=>Math.max(0,doneByLine.get(item.measurementLineId)??0)*(item.targetKind==='addendum'?contractUnitPrice(item):(item.plannedQuantity>0?item.plannedValue/item.plannedQuantity:0));
 const projected=items.reduce((sum,item)=>sum+item.plannedValue,0);
 const executed=items.reduce((sum,item)=>sum+financialExecuted(item),0);
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
 const groupCandidates=(activeGroup?.lines??[]).filter(item=>Math.max(0,item.plannedQuantity-(doneByLine.get(item.measurementLineId)??0))>0.0000001);
 const floorOf=(reference:string|null)=>{const value=(reference??'').trim();const match=value.match(/^(\d+)$/);return match&&match[1]!.length>=3?Number(match[1]!.slice(0,-2))+'º pavimento':/^0?[1-8]$/.test(value)?'Térreo':'Outros'};
 const floorGroups=[...new Set(groupCandidates.map(item=>floorOf(item.reference)))].sort((a,b)=>{const n=(x:string)=>x==='Outros'?-1:parseInt(x,10);return n(a)-n(b)}).map(floor=>({floor,lines:groupCandidates.filter(item=>floorOf(item.reference)===floor).sort((a,b)=>(a.reference??'').localeCompare(b.reference??'','pt-BR',{numeric:true}))}));
 const groupRemaining=groupCandidates.reduce((sum,line)=>sum+Math.max(0,line.plannedQuantity-(doneByLine.get(line.measurementLineId)??0)),0);
 const remaining=current?Math.max(0,(current.targetKind==='addendum'?(contractStages.get(current.targetKind+':'+current.targetId)?.contractedQuantity??current.plannedQuantity):current.plannedQuantity)-(doneByLine.get(current.measurementLineId)??0)+(editing?entries.find(entry=>entry.id===editing)?.executedQuantity??0:0)):0;
 async function submit(){
  if(!current)return;
  const entered=entryMode==='value'?parseMoneyInput(quantity):Number(quantity.trim().replace(/\s/g,'').includes(',')?quantity.trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.'):quantity.trim().replace(/\s/g,''));
  const batch=activeGroup&&!editing?groupCandidates.filter(item=>selectedReferences.includes(item.measurementLineId)):[];
  const selectedLines=activeGroup&&!editing?batch:[current];
  const value=entered;
  const totalSelectedValue=selectedLines.reduce((sum,line)=>sum+line.plannedValue,0);
  const contractBase=groupContractValue(activeGroup?.lines??[current]);
  const financialAmount=entryMode==='percent'&&current.targetKind==='addendum'?contractBase*entered/100:entryMode==='percent'?totalSelectedValue*entered/100:entered;
  const quantities=selectedLines.map(line=>{
   if(entryMode==='quantity')return value;
   const unitPrice=line.targetKind==='addendum'?contractUnitPrice(line):line.plannedQuantity>0?line.plannedValue/line.plannedQuantity:0;
   if(entryMode==='percent'){
    // Percentual por linha: 100% representa a quantidade total contratada/projetada.
    const base=line.targetKind==='addendum'?(contractStages.get(line.targetKind+':'+line.targetId)?.contractedQuantity??line.plannedQuantity):line.plannedQuantity;
    return base*entered/100;
   }
   return totalSelectedValue>0&&unitPrice>0?financialAmount*(line.plannedValue/totalSelectedValue)/unitPrice:NaN;
  });
  if(activeGroup&&!editing&&batch.length===0){setError('Selecione ao menos uma unidade.');return}
  if(!Number.isFinite(entered)||entered<=0||quantities.some(q=>!Number.isFinite(q)||q<=0)){setError('Informe uma quantidade, valor ou percentual válido.');return}
  if(!date){setError('Informe a data da execução.');return}
  setSaving(true);setError(null);setNotice(null);
  try{if(editing){await updateLineExecution({id:editing,executionDate:date,quantity:quantities[0]!})}else if(activeGroup){for(let i=0;i<batch.length;i++)await saveLineExecution({measurementLineId:batch[i]!.measurementLineId,executionDate:date,quantity:quantities[i]!})}else{await saveLineExecution({measurementLineId:current.measurementLineId,executionDate:date,quantity:quantities[0]!})}
   const refreshed=await loadLineExecutions(scope,ids);setEntries(refreshed);setSelectedReferences([]);setEditing(null);setQuantity('');setNotice('Execução salva com sucesso. Selecione as próximas unidades para continuar.')}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar')}
  finally{setSaving(false)}
 }
 return <section className="measurement-execution-overview">
  <style>{` .measurement-execution-overview__error{color:#b91c1c;font-weight:600}.measurement-execution-overview__notice{color:#047857;font-weight:600} .measurement-execution-overview__cards{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:9px!important}.measurement-execution-overview__cards>div{min-width:0;border:1px solid #d8e5f1;border-radius:9px;padding:12px;background:#fff}.measurement-execution-overview__cards>div:nth-child(1) strong{color:#1464d9}.measurement-execution-overview__cards>div:nth-child(2) strong{color:#078653}.measurement-execution-overview__cards>div:nth-child(3) strong{color:#dc2646}.measurement-execution-overview__items{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important}.measurement-execution-overview__service{display:flex!important;flex-direction:column!important;text-align:left!important;align-items:stretch!important;min-width:0;gap:9px!important;border:1px solid #dce6f0;border-left:4px solid #3289d9;border-radius:10px;padding:13px;background:#fff}.measurement-execution-overview__service.is-done{border-left-color:#10a76a;background:#f5fdfa}.ex-card-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;border-top:1px solid #e4eaf2;padding-top:9px}.ex-card-metrics>span{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}.ex-card-metrics>span+span{border-left:1px solid #dce5ef;padding-left:6px}.ex-card-metrics strong{font-size:15px}.ex-card-metrics small{font-size:11px}.ex-card-done{color:#078653}.ex-card-pending{color:#dc2646}.ex-card-progress{display:block!important;width:100%;height:8px;appearance:none;border:0;background:#dce7f0;border-radius:10px;overflow:hidden}.ex-card-progress::-webkit-progress-bar{background:#dce7f0;border-radius:10px}.ex-card-progress::-webkit-progress-value{background:#10b981;border-radius:10px}.ex-card-progress::-moz-progress-bar{background:#10b981;border-radius:10px}@media(max-width:1100px){.measurement-execution-overview__items{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:620px){.measurement-execution-overview__items{grid-template-columns:1fr!important}.measurement-execution-overview__cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}} `}</style>
  <style>{` .measurement-execution-overview__mode{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;width:100%!important;align-items:stretch!important}.measurement-execution-overview__mode>button{display:flex!important;justify-content:center!important;align-items:center!important;min-width:0!important;width:100%!important;min-height:42px!important;height:42px!important;padding:5px 4px!important;margin:0!important;border:1px solid #2563eb!important;border-radius:8px!important;background:#2563eb!important;color:#fff!important;font-size:clamp(10px,2.7vw,13px)!important;line-height:1.1!important;text-align:center!important;white-space:normal!important}.measurement-execution-overview__mode>button[aria-pressed="true"]{background:#fff!important;color:#2563eb!important;border-color:#2563eb!important}.measurement-execution-overview__mode>button:focus-visible{outline:2px solid #2563eb!important;outline-offset:2px!important} `}</style>
  <header><strong>Executado</strong><small>Medição {measurement?.measurementNumber??'—'} · {measurement?.competence?.slice(0,7)??'Sem competência'}</small></header>
  <div className="measurement-execution-overview__cards">
   <div><small>Projetado</small><strong>{money.format(projected)}</strong></div>
   <div><small>Executado</small><strong>{money.format(executed)}</strong></div>
   <div><small>Pendente</small><strong>{money.format(Math.max(0,projected-executed))}</strong></div>
   <div><small>Conclusão</small><strong>{projected>0?(executed/projected*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):'0'}%</strong><progress className="ex-card-progress" max={100} value={projected>0?Math.min(100,executed/projected*100):0}/></div>
  </div>
  <div className="measurement-execution-overview__filters">
   <label>Buscar serviço ou apartamento<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ex.: 1102 ou esgoto"/></label>
   <label>Situação<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|'pending'|'done')}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="done">Concluídos</option></select></label>
  </div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading?<p>Carregando execução…</p>:items.length===0?<p>Nenhum serviço lançado nesta medição.</p>:filteredGroups.length===0?<p>Nenhum serviço corresponde aos filtros.</p>:<div className="measurement-execution-overview__items">{filteredGroups.map(group=>{
   const planned=group.lines.reduce((sum,item)=>sum+item.plannedQuantity,0);
   const done=group.lines.reduce((sum,item)=>sum+(doneByLine.get(item.measurementLineId)??0),0);
   const value=group.lines.reduce((sum,item)=>sum+item.plannedValue,0);
   const executedValue=group.lines.reduce((sum,item)=>sum+financialExecuted(item),0);
   const pendingValue=value-executedValue;
   const progress=value>0?Math.max(0,executedValue/value*100):0;
   const contractTotal=groupContractValue(group.lines);
   const contractProgress=contractTotal>0?executedValue/contractTotal*100:0;
   return <button type="button" key={group.key} className={`measurement-execution-overview__service ${done>=planned?'is-done':'is-pending'}`} onClick={()=>{setSelected(group.key);setSelectedReferences([]);setEditing(null);setEntryMode('quantity');setQuantity('1');setError(null);setNotice(null)}} disabled={saving}>
    <small>{group.lines[0]?.originName} · {group.lines[0]?.unitKind==='hall'?'Halls / área comum':group.lines[0]?.unitKind==='apartamento'?'Apartamentos':'Unidades'}</small>
    <strong>{group.lines[0]?.description}</strong>
    <span className="ex-card-metrics">
     <span><small>Projetado</small><strong>{planned.toLocaleString('pt-BR')}</strong><small>{money.format(value)}</small></span>
     <span className="ex-card-done"><small>Executado</small><strong>{done.toLocaleString('pt-BR')}</strong><small>{money.format(executedValue)}</small></span>
     <span className="ex-card-pending"><small>Pendente</small><strong>{(planned-done).toLocaleString('pt-BR')}</strong><small>{money.format(pendingValue)}</small></span>
    </span>
    <progress className="ex-card-progress" max={100} value={Math.min(100,progress)}/>
    <small>{progress.toLocaleString('pt-BR',{maximumFractionDigits:1})}% do projetado · {contractProgress.toLocaleString('pt-BR',{maximumFractionDigits:1})}% do contrato</small>
    <span>{done>=planned?'Concluído · Consultar':'Selecionar unidades ›'}</span>
   </button>})}</div>}
  <Dialog open={Boolean(current)} title={editing?"Editar execução":"Registrar execução"} description={current?`${current.originName} · ${current.description} · Medição ${measurement?.measurementNumber??"—"}`:undefined} onClose={()=>{if(!saving){setSelected(null);setEditing(null)}}}>
  {current&&<div className="measurement-execution-overview__entry" role="group" aria-label="Registrar execução">
   {error&&<p role="alert" className="measurement-execution-overview__error">{error}</p>}
   {notice&&<p role="status" className="measurement-execution-overview__notice">{notice}</p>}
   {activeGroup&&!editing&&<div className="measurement-execution-overview__units"><strong>{current.originName} · Selecione {current.unitKind==='hall'?'os halls':current.unitKind==='apartamento'?'os apartamentos':'as unidades'} executados</strong>
    <button type="button" onClick={()=>setSelectedReferences(groupCandidates.map(item=>item.measurementLineId))}>Marcar todas as pendentes</button>
    <button type="button" onClick={()=>setSelectedReferences([])}>Limpar seleção</button>
    {floorGroups.map(group=><fieldset key={group.floor}><legend>{group.floor}</legend>
     <label><input type="checkbox" checked={group.lines.every(item=>selectedReferences.includes(item.measurementLineId))} onChange={event=>setSelectedReferences(old=>event.target.checked?[...new Set([...old,...group.lines.map(item=>item.measurementLineId)])]:old.filter(id=>!group.lines.some(item=>item.measurementLineId===id)))}/> Todo o pavimento</label>
     <div className="measurement-execution-overview__unit-grid">{group.lines.map(item=><label key={item.measurementLineId}><input type="checkbox" checked={selectedReferences.includes(item.measurementLineId)} onChange={event=>setSelectedReferences(old=>event.target.checked?[...old,item.measurementLineId]:old.filter(id=>id!==item.measurementLineId))}/>{item.reference??'Serviço geral'}</label>)}</div>
    </fieldset>)}
   </div>}
   <strong>{current.description}</strong><small>Previsto ainda não executado: {(activeGroup&&!editing?groupRemaining:remaining).toLocaleString('pt-BR')} {current.unit}</small>{activeGroup&&!editing&&<small>Selecionadas: {selectedReferences.length} · {entryMode==='percent'?'Percentual informado':entryMode==='value'?'Valor informado':'Quantidade solicitada'}: {entryMode==='quantity'?(selectedReferences.length*Number(quantity.replace(',','.'))||0).toLocaleString('pt-BR') :(entryMode==='value'?(quantity||money.format(0)):(quantity||'0'))}{entryMode==='percent'?'%':''}</small>}
   <label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
   <div role="group" aria-label="Forma de lançamento" className="measurement-execution-overview__mode">{(['quantity','value','percent'] as const).map(mode=><button key={mode} type="button" aria-pressed={entryMode===mode} onClick={()=>{setEntryMode(mode);setQuantity('');setError(null);setNotice(null)}}>{mode==='quantity'?'Quantidade':mode==='value'?'Valor (R$)':'Porcentagem (%)'}</button>)}</div>
   {entryMode==='percent'&&current.targetKind==='addendum'&&<small>Base: {money.format(groupContractValue(activeGroup?.lines??[current]))} do contrato do serviço. O avanço exibido compara o valor executado com o projetado.</small>}
   {entryMode==='percent'&&current.targetKind==='addendum'&&<small>O percentual é aplicado ao contrato completo deste serviço; selecione as unidades que receberão o valor. Não é percentual do projetado.</small>}
   <label>{entryMode==='quantity'?'Quantidade por unidade':entryMode==='value'?'Valor total executado (R$)' :current.targetKind==='addendum'?'Percentual do contratado (%)':'Percentual do projetado (%)'}<input inputMode="decimal" value={quantity} onChange={event=>setQuantity(entryMode==='value'?formatMoneyInput(event.target.value):event.target.value)}/></label>
   <div><button type="button" onClick={()=>{setSelected(null);setEditing(null)}} disabled={saving}>Cancelar</button><button type="button" onClick={()=>void submit()} disabled={saving||(activeGroup&&!editing?selectedReferences.length===0:remaining<=0)}>{saving?'Salvando…':editing?'Salvar alteração':'Salvar execução'}</button></div>
  </div>}
  </Dialog>
  <details><summary>Histórico diário ({entries.length})</summary>{[...entries].sort((a,b)=>b.executionDate.localeCompare(a.executionDate)).map(entry=><div className="measurement-execution-overview__history-row" key={entry.id}><span>{entry.executionDate.split('-').reverse().join('/')} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.description??'Serviço'} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.originName??'Origem não identificada'} · {items.find(item=>item.measurementLineId===entry.measurementLineId)?.reference??'Geral'} · {entry.executedQuantity.toLocaleString('pt-BR')}</span><button type="button" disabled={saving} onClick={()=>{setSelected(entry.measurementLineId);setEditing(entry.id);setEntryMode('quantity');setQuantity(String(entry.executedQuantity));setDate(entry.executionDate);setError(null)}}>Editar</button><button type="button" disabled={saving} onClick={()=>setPendingDelete(entry.id)}>Excluir</button></div>)}</details>
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
