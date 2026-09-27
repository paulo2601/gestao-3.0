import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const labels:Record<string,string>={draft:'Rascunho',closed:'Fechado',approved:'Aprovado',cancelled:'Cancelado'};
function monthLabel(value:string){if(!value)return'—';const [y,m]=value.slice(0,7).split('-');return m&&y?`${m}/${y}`:value;}

interface MeasurementRow {id:string;measurementNumber:string;competence:string;status:string}
interface Props {
 rows:MeasurementRow[];
 busy:boolean;
 financial:(id:string)=>{gross:number;net:number};
 onOpen:(id:string)=>void;
 onCloseOne:(id:string)=>Promise<unknown>;
 onApproveOne:(id:string)=>Promise<unknown>;
 onReopen:(id:string)=>void;
 onBatch:(ids:string[],action:'close'|'approve')=>Promise<unknown>;
 onChanged:()=>void;
}
export function EngineeringMeasurementClosingPanel({rows,busy,financial,onOpen,onCloseOne,onApproveOne,onReopen,onBatch,onChanged}:Props){
 const [selected,setSelected]=useState<string[]>([]);
 const actionable=rows.filter(item=>item.status==='draft'||item.status==='closed');
 const chosen=actionable.filter(item=>selected.includes(item.id));
 const canClose=chosen.length>0&&chosen.every(item=>item.status==='draft');
 const canApprove=chosen.length>0&&chosen.every(item=>item.status==='closed');
 const finish=()=>{setSelected([]);onChanged();};
 return <><div className="engineering-closing-toolbar"><div><strong>Fechar e aprovar medições</strong><span>Selecione uma ou várias medições para processar em lote.</span></div><div className="engineering-closing-toolbar__actions"><Button size="sm" variant="secondary" disabled={!actionable.length} onClick={()=>setSelected(selected.length===actionable.length?[]:actionable.map(item=>item.id))}>{selected.length===actionable.length&&actionable.length?'Limpar seleção':'Selecionar todas'}</Button><Button size="sm" variant="secondary" disabled={!canClose||busy} onClick={()=>void onBatch(chosen.map(item=>item.id),'close').then(finish)}>Fechar selecionadas ({chosen.length})</Button><Button size="sm" disabled={!canApprove||busy} onClick={()=>void onBatch(chosen.map(item=>item.id),'approve').then(finish)}>Aprovar selecionadas ({chosen.length})</Button></div></div><div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table engineering-closing-table"><thead><tr><th className="engineering-closing-table__check">Selecionar</th><th>Nº medição</th><th>Competência</th><th>Status</th><th>Bruto</th><th>Líquido</th><th>Etapa</th><th>Ações</th></tr></thead><tbody>{rows.map(item=>{const value=financial(item.id);const selectable=item.status==='draft'||item.status==='closed';return <tr key={item.id}><td className="engineering-closing-table__check"><input type="checkbox" aria-label={`Selecionar medição ${item.measurementNumber}`} disabled={!selectable} checked={selected.includes(item.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/></td><td><strong>{item.measurementNumber||'—'}</strong></td><td>{monthLabel(item.competence)}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labels[item.status]??item.status}</span></td><td>{currency.format(value.gross)}</td><td><strong>{currency.format(value.net)}</strong></td><td>{item.status==='draft'?'Pronta para fechar':item.status==='closed'?'Pronta para aprovar':item.status==='approved'?'Aprovada':'—'}</td><td><div className="engineering-sheet__row-actions"><Button size="sm" variant="tertiary" onClick={()=>onOpen(item.id)}>Ver</Button>{item.status==='draft'&&<Button size="sm" variant="secondary" onClick={()=>void onCloseOne(item.id).then(()=>onChanged())}>Fechar</Button>}{item.status==='closed'&&<Button size="sm" onClick={()=>void onApproveOne(item.id).then(()=>onChanged())}>Aprovar</Button>}{(item.status==='closed'||item.status==='approved')&&<Button size="sm" variant="secondary" onClick={()=>onReopen(item.id)}>Reabrir</Button>}</div></td></tr>})}</tbody></table>{rows.length===0&&<div className="engineering-sheet__empty">As medições aparecerão aqui para fechamento e aprovação.</div>}</div></>;
}