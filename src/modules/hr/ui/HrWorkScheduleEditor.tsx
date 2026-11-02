import './hr-work-schedule.css';
import {useEffect,useState} from 'react';
import {loadEmployeeWorkSchedule,saveEmployeeWorkSchedule} from '../infrastructure/HrWorkspaceService';
import type {ScheduleDay} from '../domain/assessScheduledDay';

type Day=ScheduleDay;
const labels=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const initial:Day[]=labels.map((_,i)=>({active:i<5,entry:'07:00',lunchOut:'12:00',lunchIn:'13:00',exit:'17:00'}));
const validTime=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3,5));
export function HrWorkScheduleEditor({contractId,tenantId,companyId}:{contractId:string;tenantId:string;companyId:string}){
 const [days,setDays]=useState<Day[]>(initial);const [effectiveOn,setEffectiveOn]=useState(()=>[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'));const [loading,setLoading]=useState(true);
 const [loadFailed,setLoadFailed]=useState(false);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [reviewRequired,setReviewRequired]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setLoadFailed(false);setMessage('');loadEmployeeWorkSchedule(contractId,tenantId,companyId).then(data=>{if(!active)return;if(data){const saved:unknown=data.weekdays;if(Array.isArray(saved)&&saved.length===7&&saved.every((value:unknown):value is Day=>typeof value==='object'&&value!==null&&'active' in value&&typeof value.active==='boolean'&&'entry' in value&&typeof value.entry==='string'&&'lunchOut' in value&&typeof value.lunchOut==='string'&&'lunchIn' in value&&typeof value.lunchIn==='string'&&'exit' in value&&typeof value.exit==='string'))setDays(saved);setEffectiveOn(data.effective_on);setReviewRequired(data.review_required);}setLoading(false);}).catch(error=>{if(!active)return;setLoadFailed(true);setMessage('Não foi possível carregar a jornada: '+(error instanceof Error?error.message:String(error)));setLoading(false);});return()=>{active=false};},[contractId,tenantId,companyId]);
 const change=(index:number,patch:Partial<Day>)=>setDays(previous=>previous.map((day,i)=>i===index?{...day,...patch}:day));
 async function save(){setMessage('');if(loadFailed){setMessage('Não é possível salvar sem carregar o histórico da jornada.');return;}if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)){setMessage('Informe a data de vigência.');return}
 for(let i=0;i<7;i++){const d=days[i];if(!d||!d.active)continue;if(![d.entry,d.lunchOut,d.lunchIn,d.exit].every(validTime)||!(minutes(d.entry)<minutes(d.lunchOut)&&minutes(d.lunchOut)<minutes(d.lunchIn)&&minutes(d.lunchIn)<minutes(d.exit))){setMessage('Revise os horários de '+labels[i]+'.');return}}
 setSaving(true);try{await saveEmployeeWorkSchedule({tenantId,companyId,contractId,effectiveOn,weekdays:days,reviewRequired});setMessage('Jornada salva com sucesso.');}catch(error){setMessage('Erro ao salvar jornada: '+(error instanceof Error?error.message:String(error)))}finally{setSaving(false)}}
 return <section className="hr-work-schedule">
 <h3>Jornada de trabalho</h3><p>Defina os quatro horários de cada dia. Os registros reais do ponto não serão alterados.</p>
 {loading?<p>Carregando jornada...</p>:loadFailed?<p role="alert">{message}</p>:<><label className="hr-work-schedule__effective">Vigência a partir de <input type="date" value={effectiveOn} onChange={e=>setEffectiveOn(e.target.value)}/></label>
 <button type="button" onClick={()=>setDays(previous=>previous.map((day,i)=>i>0&&i<5&&previous[0]?{...previous[0],active:day.active}:day))}>Copiar horários de segunda para terça a sexta</button>
 {days.map((day,i)=><div className="hr-work-schedule__day" key={labels[i]}><label><input type="checkbox" checked={day.active} onChange={e=>change(i,{active:e.target.checked})}/> {labels[i]}</label>{day.active&&<div className="hr-work-schedule__times">{([['entry','Entrada'],['lunchOut','Saída almoço'],['lunchIn','Retorno almoço'],['exit','Saída trabalho']] as const).map(([key,label])=><label key={key}>{label}<input type="time" value={day[key]} onChange={e=>change(i,{[key]:e.target.value})}/></label>)}</div>}</div>)}
 <label className="hr-work-schedule__review"><input type="checkbox" checked={reviewRequired} onChange={e=>setReviewRequired(e.target.checked)}/> Encaminhar divergências ao RH para análise, sem desconto automático</label>
 {message&&<p role="status">{message}</p>}
 <button type="button" disabled={saving} onClick={()=>{void save()}}>{saving?'Salvando...':'Salvar jornada de trabalho'}</button></>}
 </section>
}
