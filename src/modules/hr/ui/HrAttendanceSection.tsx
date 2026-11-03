import {listDailyScheduleAssessments,type DailyScheduleAssessment} from '../infrastructure/listDailyScheduleAssessments';
import { useEffect, useMemo, useState } from 'react';
import type { HrEmployeeRow } from '../application/HrOperationsRepository';
import { listAttendanceForDate, listAttendanceForPeriod, listClockReportEvents, listClockAdjustments, listClockCorrectionRequests, decideClockCorrectionRequest, type ClockCorrectionRequest, listClockCancellations, cancelClockPunch, saveClockAdjustment, registerAttendancePunch, type ClockPunchKind, type AttendanceRecord, type AttendanceStatus } from '../infrastructure/HrWorkspaceService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { installReportShareButton } from '../../../shared/utils/reportShare';

type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
const attendanceOptions=[{value:'',label:'Não registrado'},{value:'present',label:'Presente'},{value:'absence',label:'Falta'},{value:'medical_certificate',label:'Atestado'},{value:'vacation',label:'Férias'},{value:'day_off',label:'Folga'},{value:'other',label:'Outro'}];
const statusLabel=new Map(attendanceOptions.map(item=>[item.value,item.label]));
function safeFileName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Relatorio de Presenca';}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[char]??char));}
// Feriados nacionais fixos e móveis (Páscoa calculada pelo algoritmo gregoriano).
function nationalHolidayName(date:string):string|null {
 const [yearText='0',monthText='0',dayText='0']=date.split('-');const year=Number(yearText),month=Number(monthText),day=Number(dayText);
 const fixed:Record<string,string>={'01-01':'Confraternização Universal','04-21':'Tiradentes','05-01':'Dia do Trabalho','09-07':'Independência do Brasil','10-12':'Nossa Senhora Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Consciência Negra','12-25':'Natal'};
 const fixedName=fixed[`${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`];if(fixedName)return fixedName;
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
 const easter=new Date(Date.UTC(year,Math.floor(n/31)-1,(n%31)+1));
 const goodFriday=new Date(easter.getTime()-2*86400000).toISOString().slice(0,10);
 return date===goodFriday?'Paixão de Cristo':null;
}
async function openAttendanceReport(date:string,employees:Employee[]){
 const reportWindow=window.open('','_blank');if(!reportWindow)return;reportWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Preparando relatório...</title></head><body style="font-family:Arial;padding:24px;color:#172033">Preparando relatório mensal...</body></html>');reportWindow.document.close();
 try{
 const month=date.slice(0,7);const start=month+'-01';const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0);const end=`${month}-${String(d.getDate()).padStart(2,'0')}`;
 const scopes=[...new Map(employees.map(e=>[e.tenantId+':'+e.companyId,{tenantId:e.tenantId,companyId:e.companyId}])).values()];
 const data=await listAttendanceForPeriod(scopes,start,end);const byEmployee=new Map<string,AttendanceRecord[]>();data.forEach(row=>byEmployee.set(row.employmentContractId,[...(byEmployee.get(row.employmentContractId)??[]),row]));
 const clockEvents=await listClockReportEvents(employees.map(e=>e.employmentContractId),start,end);
 const adjustments=await listClockAdjustments(employees.map(e=>e.employmentContractId),start,end);
 const cancellations=await listClockCancellations(employees.map(e=>e.employmentContractId),start,end);
 const punches=new Map<string,Map<string,Map<string,string>>>();
 for(const event of clockEvents){const local=new Date(event.captured_at).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',hour12:false});const dateKey=local.slice(0,10);const time=local.slice(11,19);if(!punches.has(event.employment_contract_id))punches.set(event.employment_contract_id,new Map());const days=punches.get(event.employment_contract_id)!;if(!days.has(dateKey))days.set(dateKey,new Map());days.get(dateKey)!.set(event.punch_kind,time);}
 for(const adjustment of adjustments){if(!punches.has(adjustment.employment_contract_id))punches.set(adjustment.employment_contract_id,new Map());const days=punches.get(adjustment.employment_contract_id)!;if(!days.has(adjustment.attendance_date))days.set(adjustment.attendance_date,new Map());days.get(adjustment.attendance_date)!.set(adjustment.punch_kind,adjustment.corrected_time);}
 for(const cancellation of cancellations){const day=punches.get(cancellation.employment_contract_id)?.get(cancellation.attendance_date);if(cancellation.punch_kind==='all'){day?.clear();}else{day?.delete(cancellation.punch_kind);}}
 const cancelledDays=new Set(cancellations.filter(c=>c.punch_kind==='all').map(c=>c.employment_contract_id+':'+c.attendance_date));
 const cancelledPunches=new Set(cancellations.map(c=>c.employment_contract_id+':'+c.attendance_date+':'+c.punch_kind));
 const title=`Relatório mensal de presença e ponto - ${month.split('-').reverse().join('/')}`;const fileName=safeFileName(title);
 const sortedEmployees=[...employees].sort((a,b)=>a.fullName.localeCompare(b.fullName,'pt-BR',{sensitivity:'base'}));
 const pages=sortedEmployees.map((employee,index)=>{const map=new Map((byEmployee.get(employee.employmentContractId)??[]).map(r=>[r.attendanceDate,r]));let reportRows='';for(let day=1;day<=d.getDate();day++){const ds=`${month}-${String(day).padStart(2,'0')}`;const r=map.get(ds);const cancelled=cancelledDays.has(employee.employmentContractId+':'+ds);const punch=punches.get(employee.employmentContractId)?.get(ds);const weekday=new Date(ds+'T12:00:00').getDay();const weekend=weekday===0||weekday===6;const holiday=nationalHolidayName(ds);const absence=r?.status==='absence';const highlight=absence||weekend||Boolean(holiday);const shortDays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];const label=shortDays[weekday]??'—';const observation=[holiday,r?.notes].filter(Boolean).join(' · ');reportRows+=`<tr class="${highlight?'alert-row':''}"><td>${ds.split('-').reverse().join('/')}</td><td>${escapeHtml(label)}</td><td>${cancelled?'Cancelado':r?escapeHtml(statusLabel.get(r.status)??r.status):'Sem registro'}</td><td>${cancelled||cancelledPunches.has(employee.employmentContractId+':'+ds+':entry')?'—':punch?.get('entry')?.slice(0,5)??(r?.checkIn?escapeHtml(r.checkIn.slice(0,5)):'—')}</td><td>${punch?.get('lunch_out')?.slice(0,5)??'—'}</td><td>${punch?.get('lunch_in')?.slice(0,5)??'—'}</td><td>${cancelled||cancelledPunches.has(employee.employmentContractId+':'+ds+':exit')?'—':punch?.get('exit')?.slice(0,5)??(r?.checkOut?escapeHtml(r.checkOut.slice(0,5)):'—')}</td><td>${escapeHtml(observation)}</td></tr>`;}const logos:Record<string,string>={'1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.webp','68e55f19-6d77-45cf-a86b-6a661f4c285a':'/company-pr.webp'};const logo=logos[employee.companyId]??'/gestao-brand.svg';return `<section class="page ${index?'break':''}"><div class="watermark"><img src="${logo}" alt=""></div><header><div class="brand"><img src="${logo}" alt="Logo da empresa"></div><span>Relatório mensal de presença e ponto · ${month.split('-').reverse().join('/')}</span></header><h2>${escapeHtml(employee.fullName)}</h2><p>${escapeHtml(employee.jobTitle)} · ${escapeHtml(employee.costCenterName??'Sem obra')}</p><table><colgroup><col style="width:12%"><col style="width:6%"><col style="width:12%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:26%"></colgroup><thead><tr><th>Data</th><th>Dia</th><th>Status</th><th>Entrada</th><th>Saída almoço</th><th>Retorno</th><th>Saída</th><th>Observação</th></tr></thead><tbody>${reportRows}</tbody></table><div class="sign"></div><b>${escapeHtml(employee.fullName)}</b><small>Assinatura do colaborador</small></section>`;}).join('');
 reportWindow.document.open();reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title><style>*{box-sizing:border-box}body{font-family:Arial;color:#172033;margin:0;padding:8mm}.page{width:194mm;height:281mm;display:flex;flex-direction:column;position:relative;overflow:hidden;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}.page>*:not(.watermark){position:relative;z-index:1}.watermark{position:absolute;inset:13% 10%;display:flex;align-items:center;justify-content:center;opacity:.055;pointer-events:none;z-index:0}.watermark img{width:105mm;max-height:105mm;object-fit:contain}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #185adb;padding-bottom:7px}.brand{display:flex;align-items:center}.brand img{max-width:120px;max-height:48px;object-fit:contain}header span,p,small{color:#64748b}h2{font-size:15px;margin:10px 0 2px}p{font-size:10px;margin:0 0 7px}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:7.5px}th,td{overflow-wrap:break-word}th:nth-child(2),td:nth-child(2){text-align:center;white-space:nowrap}th:nth-child(n+4):nth-child(-n+7),td:nth-child(n+4):nth-child(-n+7){text-align:center;white-space:nowrap}th,td{border:1px solid #d8e1eb;padding:3px 4px}th{background:#f4f7fb}tr.alert-row td{background:#fee2e2!important;color:#991b1b!important;font-weight:700}tr.alert-row td{border-color:#fca5a5!important}.sign{border-top:1px solid #172033;width:55%;margin:auto auto 5px}.page>b,.page>small{text-align:center}@page{size:A4 portrait;margin:8mm}@media print{body{padding:0}button{display:none}tr.alert-row td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`);reportWindow.document.close();installReportShareButton(reportWindow,fileName,'portrait');
 reportWindow.focus();
 }catch(error){reportWindow.document.body.innerHTML=`<p style="font-family:Arial;color:#b91c1c">${escapeHtml(error instanceof Error?error.message:'Não foi possível gerar o relatório.')}</p>`;}
}

export function HrAttendanceSection({date,setDate,search,setSearch,rows,employees,loading,feedback,onAllPresent,onChange,onRowsChange,onFeedback}:{date:string;setDate:(v:string)=>void;search:string;setSearch:(v:string)=>void;rows:AttendanceRecord[];employees:Employee[];loading:boolean;feedback:string|null;onAllPresent:()=>void;onChange:(employee:Employee,status:AttendanceStatus)=>void;onRowsChange:(rows:AttendanceRecord[])=>void;onFeedback:(message:string)=>void}){
 const [showRegistered,setShowRegistered]=useState(false);
 const [expandedEmployee,setExpandedEmployee]=useState<string|null>(null);
 const [registeredSearch,setRegisteredSearch]=useState('');
 const [registeredPage,setRegisteredPage]=useState(1);
 const [cancelled,setCancelled]=useState<Map<string,Set<ClockPunchKind|'all'>>>(new Map());
 const [cancelling,setCancelling]=useState<{employee:Employee;kind:ClockPunchKind|'all'}|null>(null);
 const [cancelReason,setCancelReason]=useState('');
 const [cancelSaving,setCancelSaving]=useState(false);
 const [clockData,setClockData]=useState<Map<string,Map<ClockPunchKind,string>>>(new Map());
 const [editing,setEditing]=useState<{employee:Employee;kind:ClockPunchKind}|null>(null);
 const [correctedTime,setCorrectedTime]=useState('');
 const [reason,setReason]=useState('');
 const [saving,setSaving]=useState(false);
 const [clockRefresh,setClockRefresh]=useState(0);
 const [showCorrectionRequests,setShowCorrectionRequests]=useState(false);
 const [correctionRequests,setCorrectionRequests]=useState<ClockCorrectionRequest[]>([]);
 const [correctionLoading,setCorrectionLoading]=useState(false);
 const [correctionBusy,setCorrectionBusy]=useState<string|null>(null);
 const [correctionReason,setCorrectionReason]=useState('');
 const [correctionTime,setCorrectionTime]=useState('');
 const [selectedCorrection,setSelectedCorrection]=useState<ClockCorrectionRequest|null>(null);
 async function loadCorrectionRequests(){
  setCorrectionLoading(true);
  try {
   const ids=employees.map(e=>e.employmentContractId);
   const month=date.slice(0,7);
   const first=month+'-01';
   const last=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0);
   const end=month+'-'+String(last.getDate()).padStart(2,'0');
   setCorrectionRequests(await listClockCorrectionRequests(ids,first,end));
  }catch(error){onFeedback(error instanceof Error?error.message:'Falha ao carregar solicitações.');}
  finally{setCorrectionLoading(false);}
 }
 async function resolveCorrection(decision:'approved'|'rejected'){
  if(!selectedCorrection)return;
  setCorrectionBusy(selectedCorrection.id);
  try {
   await decideClockCorrectionRequest({requestId:selectedCorrection.id,decision,reason:correctionReason,approvedTime:correctionTime});
   setSelectedCorrection(null);setCorrectionReason('');setCorrectionTime('');
   await loadCorrectionRequests();setClockRefresh(v=>v+1);
   onFeedback(decision==='approved'?'Correção aprovada e registrada.':'Solicitação rejeitada.');
  }catch(error){onFeedback(error instanceof Error?error.message:'Falha ao analisar solicitação.');}
  finally{setCorrectionBusy(null);}
 }

 const [scheduleAssessments,setScheduleAssessments]=useState<Map<string,DailyScheduleAssessment>>(new Map());
 useEffect(()=>{let active=true;const ids=employees.map(e=>e.employmentContractId);
 void listDailyScheduleAssessments(ids,date,date).then(items=>{
  if(active)setScheduleAssessments(new Map(items.map(item=>[item.contractId,item])));
 }).catch(error=>{if(active){setScheduleAssessments(new Map());onFeedback(error instanceof Error?error.message:'Falha ao apurar jornada.');}});
 return()=>{active=false};
 },[date,employees,clockRefresh,onFeedback]);

 useEffect(()=>{let active=true;void (async()=>{try{
 const ids=employees.map(e=>e.employmentContractId);
 const [events,adjustments,cancellations]=await Promise.all([listClockReportEvents(ids,date,date),listClockAdjustments(ids,date,date),listClockCancellations(ids,date,date)]);
 const data=new Map<string,Map<ClockPunchKind,string>>();
 const removed=new Map<string,Set<ClockPunchKind|'all'>>();
 const latestCancellation=new Map<string,number>();
 for(const c of cancellations){const key=c.employment_contract_id+'|'+c.punch_kind;const time=new Date(c.cancelled_at).getTime();latestCancellation.set(key,Math.max(latestCancellation.get(key)??0,time));}
 const lastCancel=(id:string,kind:ClockPunchKind)=>Math.max(latestCancellation.get(id+'|all')??0,latestCancellation.get(id+'|'+kind)??0);
 const activePunches=new Set<string>();
 for(const event of events){
  const local=new Date(event.captured_at).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',hour12:false});
  if(local.slice(0,10)!==date)continue;
  const kind=event.punch_kind;
  if(kind!=='entry'&&kind!=='lunch_out'&&kind!=='lunch_in'&&kind!=='exit')continue;
  if(new Date(event.captured_at).getTime()<=lastCancel(event.employment_contract_id,kind))continue;
  if(!data.has(event.employment_contract_id))data.set(event.employment_contract_id,new Map());
  data.get(event.employment_contract_id)!.set(kind,local.slice(11,16));
  activePunches.add(event.employment_contract_id+'|'+kind);
 }
 for(const a of adjustments){
  const key=a.employment_contract_id+'|'+a.punch_kind;
  if(!activePunches.has(key)&&lastCancel(a.employment_contract_id,a.punch_kind)>0)continue;
  if(!data.has(a.employment_contract_id))data.set(a.employment_contract_id,new Map());
  data.get(a.employment_contract_id)!.set(a.punch_kind,a.corrected_time.slice(0,5));
 }
 for(const c of cancellations){
  const id=c.employment_contract_id;
  if(!removed.has(id))removed.set(id,new Set());
  for(const kind of (['entry','lunch_out','lunch_in','exit'] as ClockPunchKind[])){
   if(c.punch_kind!==kind&&c.punch_kind!=='all')continue;
   if(!data.get(id)?.has(kind))removed.get(id)!.add(kind);
  }
 }
 if(active){setClockData(data);setCancelled(removed);}
 }catch(error){if(active)onFeedback(error instanceof Error?error.message:'Erro ao carregar marcações.');}})();return()=>{active=false};},[date,employees,clockRefresh,onFeedback]);
 const punchKinds:ClockPunchKind[]=['entry','lunch_out','lunch_in','exit'];
 const punchLabels:Record<ClockPunchKind,string>={entry:'Entrada',lunch_out:'Saída para almoço',lunch_in:'Retorno do almoço',exit:'Saída'};
 function requestCancel(employee:Employee,kind:ClockPunchKind|'all'){setCancelling({employee,kind});setCancelReason('');}
 async function confirmCancel(){if(!cancelling)return;try{setCancelSaving(true);await cancelClockPunch({tenantId:cancelling.employee.tenantId,companyId:cancelling.employee.companyId,employmentContractId:cancelling.employee.employmentContractId,attendanceDate:date,punchKind:cancelling.kind,reason:cancelReason});setCancelling(null);setClockRefresh(v=>v+1);const scopes=[...new Map(employees.map(e=>[e.tenantId+':'+e.companyId,{tenantId:e.tenantId,companyId:e.companyId}])).values()];onRowsChange(await listAttendanceForDate(scopes,date));onFeedback('Cancelamento registrado com justificativa e auditoria.');}catch(error){onFeedback(error instanceof Error?error.message:'Não foi possível cancelar.');}finally{setCancelSaving(false);}}
 function editPunch(employee:Employee,kind:ClockPunchKind){setEditing({employee,kind});setCorrectedTime(clockData.get(employee.employmentContractId)?.get(kind)??'');setReason('');}
 async function saveCorrection(){if(!editing)return;const {employee,kind}=editing;const existing=clockData.get(employee.employmentContractId)??new Map<ClockPunchKind,string>();
 const proposed=new Map(existing);proposed.set(kind,correctedTime);
 const values=punchKinds.map(k=>proposed.get(k)).filter((v):v is string=>Boolean(v));
 if(values.some((v,i)=>i>0&&v<values[i-1]!)){onFeedback('Os horários devem seguir a ordem da jornada.');return;}
 try{setSaving(true);await saveClockAdjustment({tenantId:employee.tenantId,companyId:employee.companyId,employmentContractId:employee.employmentContractId,attendanceDate:date,punchKind:kind,correctedTime,originalTime:existing.get(kind)??null,reason});setEditing(null);setClockRefresh(v=>v+1);onFeedback('Ajuste registrado com justificativa e histórico de auditoria.');}
 catch(error){onFeedback(error instanceof Error?error.message:'Não foi possível salvar o ajuste.');}finally{setSaving(false);}
 }

 const activeRows=useMemo(()=>rows.filter(row=>{const removed=cancelled.get(row.employmentContractId);if(!removed?.size)return true;return (clockData.get(row.employmentContractId)?.size??0)>0;}),[rows,cancelled,clockData]);
 const registeredIds=useMemo(()=>{const ids=new Set(activeRows.map(row=>row.employmentContractId));for(const [contractId,punches] of clockData){if(punches.size>0)ids.add(contractId);}return ids;},[activeRows,clockData]);
 const pendingEmployees=useMemo(()=>employees.filter(employee=>!registeredIds.has(employee.employmentContractId)),[employees,registeredIds]);
 const registeredEmployees=employees.filter(employee=>registeredIds.has(employee.employmentContractId));
 const byContract=useMemo(()=>new Map(activeRows.map(row=>[row.employmentContractId,row])),[activeRows]);
 async function punch(employee:Employee,punch:'check_in'|'check_out'){try{await registerAttendancePunch({tenantId:employee.tenantId,companyId:employee.companyId,employmentContractId:employee.employmentContractId,attendanceDate:date,punch,time:new Date().toTimeString().slice(0,5)});const scopes=[...new Map(employees.map(e=>[e.tenantId+':'+e.companyId,{tenantId:e.tenantId,companyId:e.companyId}])).values()];onRowsChange(await listAttendanceForDate(scopes,date));onFeedback('Ponto registrado com sucesso.');}catch(error){onFeedback(error instanceof Error?error.message:'Não foi possível registrar o ponto.');}}
 const registeredFiltered=registeredEmployees.filter(e=>(e.fullName+' '+e.companyName+' '+e.jobTitle).toLowerCase().includes(registeredSearch.toLowerCase()));
 const registeredPages=Math.max(1,Math.ceil(registeredFiltered.length/15));
 const registeredVisible=registeredFiltered.slice((Math.min(registeredPage,registeredPages)-1)*15,Math.min(registeredPage,registeredPages)*15);
 const compactRow=(employee:Employee)=>{const assessment=scheduleAssessments.get(employee.employmentContractId)?.result;const row=byContract.get(employee.employmentContractId);const id=employee.employmentContractId;const expanded=expandedEmployee===id;const cancelledKinds=cancelled.get(id);return <div className="hr-clock-card" key={id}><button type="button" className="hr-clock-card__head" onClick={()=>setExpandedEmployee(expanded?null:id)} aria-expanded={expanded}><span className="hr-clock-card__avatar">{employee.fullName.slice(0,1)}</span><span className="hr-clock-card__identity"><strong>{employee.fullName}</strong><small>{employee.companyName} · {employee.jobTitle}</small><small>{statusLabel.get(row?.status??'')??'Não registrado'} · {punchKinds.filter(k=>clockData.get(id)?.get(k)).length} marcações</small>{assessment&&<small>Jornada: {assessment.status==='incomplete'?'Marcações incompletas':assessment.status==='rest'?'Folga':`${Math.floor((assessment.workedMinutes??0)/60)}h${String((assessment.workedMinutes??0)%60).padStart(2,'0')}`} · {assessment.requiresReview?'Revisão RH necessária':'Sem divergência detectada'} · Sem desconto automático</small>}</span><span>{expanded?'⌃':'⌄'}</span></button>{expanded&&<div className="hr-clock-card__body">{punchKinds.map(kind=><div className="hr-clock-card__punch" key={kind}><span>{punchLabels[kind]}</span><strong>{cancelledKinds?.has(kind)?'Excluído':clockData.get(id)?.get(kind)??(kind==='entry'?row?.checkIn?.slice(0,5):kind==='exit'?row?.checkOut?.slice(0,5):undefined)??'—'}</strong><Button size="sm" variant="secondary" disabled={Boolean(cancelledKinds?.has(kind))} onClick={()=>editPunch(employee,kind)}>Editar</Button><Button size="sm" variant="secondary" disabled={Boolean(cancelledKinds?.has(kind))} onClick={()=>requestCancel(employee,kind)}>Excluir</Button></div>)}<Button variant="secondary" disabled={Boolean(cancelledKinds?.has('all'))} onClick={()=>requestCancel(employee,'all')}>Excluir dia inteiro</Button><Select label="Presença" value={row?.status??''} options={attendanceOptions} onChange={event=>{const status=event.target.value as AttendanceStatus;if(status&&status!==row?.status)onChange(employee,status);}}/></div>}</div>;};
 const employeeRow=(employee:Employee)=>{const row=byContract.get(employee.employmentContractId);return <div className="hr-workspace__employee-row" key={`${employee.companyId}:${employee.employmentContractId}`}><div><strong>{employee.fullName}</strong><span>{employee.companyName} · {employee.jobTitle} · {employee.costCenterName??'Sem obra'}</span></div><div><Select label="Presença" value={row?.status??''} options={attendanceOptions} onChange={event=>{const status=event.target.value as AttendanceStatus;if(status&&status!==row?.status)onChange(employee,status);}}/><div className="hr-workspace__actions"><Button size="sm" variant="secondary" disabled={Boolean(row?.checkIn)} onClick={()=>void punch(employee,'check_in')}>{row?.checkIn?`Entrada ${row.checkIn.slice(0,5)}`:'Registrar entrada'}</Button><Button size="sm" variant="secondary" disabled={!row?.checkIn||Boolean(row?.checkOut)} onClick={()=>void punch(employee,'check_out')}>{row?.checkOut?`Saída ${row.checkOut.slice(0,5)}`:'Registrar saída'}</Button></div><div className="hr-workspace__actions hr-workspace__clock-actions">{punchKinds.map(kind=><Button key={kind} size="sm" variant="secondary" onClick={()=>editPunch(employee,kind)}>{punchLabels[kind]}: {clockData.get(employee.employmentContractId)?.get(kind)??(kind==='entry'?row?.checkIn?.slice(0,5):kind==='exit'?row?.checkOut?.slice(0,5):undefined)??'—'} · Editar</Button>)}</div></div></div>;};
 return <div className="hr-workspace__content"><Card title="Presença e ponto" actions={<div className="hr-workspace__actions"><Button variant="secondary" onClick={()=>{setShowCorrectionRequests(true);void loadCorrectionRequests();}}>Solicitações de correção</Button><Button variant="secondary" onClick={()=>setShowRegistered(true)}>Registrados {registeredEmployees.length}</Button><Button disabled={loading} onClick={()=>void openAttendanceReport(date,employees)}>Gerar relatório</Button></div>}><div className="hr-workspace__attendance-controls"><Input label="Data" type="date" value={date} onChange={e=>setDate(e.target.value)}/><Input label="Buscar colaborador" placeholder="Digite o nome" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="hr-workspace__actions"><Button onClick={onAllPresent} disabled={loading||pendingEmployees.length===0}>Marcar todos presentes</Button></div>{feedback&&<Feedback title="Presença" message={feedback} tone={feedback.includes('marcado')||feedback.includes('registrado')?'success':'info'}/>}</Card><Card title={`Colaboradores pendentes · ${date.split('-').reverse().join('/')}`}><div className="hr-workspace__list">{loading?<p className="ui-muted">Carregando colaboradores e presença do dia...</p>:pendingEmployees.length===0?<p className="ui-muted">Todos os colaboradores exibidos pelo filtro já possuem registro nesta data.</p>:pendingEmployees.map(employeeRow)}</div></Card><Dialog open={showCorrectionRequests} title="Solicitações de correção de ponto" description="Pedidos enviados pelos colaboradores no mês selecionado" onClose={()=>{setShowCorrectionRequests(false);setSelectedCorrection(null);}} onBack={()=>{setShowCorrectionRequests(false);setSelectedCorrection(null);}}>
 <div className="hr-clock-correction-list">
 <Button variant="secondary" disabled={correctionLoading} onClick={()=>void loadCorrectionRequests()}>{correctionLoading?'Carregando...':'Atualizar solicitações'}</Button>
 {correctionRequests.length===0?<p className="ui-muted">Nenhuma solicitação encontrada para o período.</p>:correctionRequests.map(request=>{
  const employee=employees.find(e=>e.employmentContractId===request.employment_contract_id);
  return <div key={request.id} className="hr-clock-correction-card">
   <strong>{employee?.fullName??'Colaborador'} · {request.attendance_date.split('-').reverse().join('/')}</strong>
   <span>{punchLabels[request.punch_kind]} · {request.requested_time.slice(0,5)} · {request.status==='pending'?'Pendente':request.status==='approved'?'Aprovada':'Rejeitada'}</span>
   <span>Justificativa: {request.reason}</span>
   {request.decision_reason&&<span>Decisão: {request.decision_reason}</span>}
   {request.status==='pending'&&<Button size="sm" onClick={()=>{setSelectedCorrection(request);setCorrectionTime(request.requested_time.slice(0,5));setCorrectionReason('');}}>Analisar solicitação</Button>}
  </div>;
 })}
 {selectedCorrection&&<div className="hr-clock-correction-decision">
  <strong>Analisar: {employees.find(e=>e.employmentContractId===selectedCorrection.employment_contract_id)?.fullName??'Colaborador'}</strong>
  <Input label="Horário para aprovação" type="time" value={correctionTime} onChange={e=>setCorrectionTime(e.target.value)}/>
  <Input label="Justificativa da decisão" value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/>
  <Button disabled={Boolean(correctionBusy)||correctionReason.trim().length<5||!correctionTime} onClick={()=>void resolveCorrection('approved')}>Aprovar correção</Button>
  <Button variant="secondary" disabled={Boolean(correctionBusy)||correctionReason.trim().length<5} onClick={()=>void resolveCorrection('rejected')}>Rejeitar solicitação</Button>
  <Button variant="secondary" onClick={()=>setSelectedCorrection(null)}>Cancelar análise</Button>
 </div>}
 </div>
 </Dialog><Dialog open={showRegistered} title={`Presenças de ${date.split('-').reverse().join('/')}`} description={`${registeredEmployees.length} colaborador(es) registrado(s) nesta data`} onClose={()=>setShowRegistered(false)} onBack={()=>setShowRegistered(false)}><div className="hr-clock-register"><div className="hr-clock-summary"><span><strong>{registeredEmployees.filter(e=>byContract.get(e.employmentContractId)?.status==='present').length}</strong> Presentes</span><span><strong>{registeredEmployees.filter(e=>byContract.get(e.employmentContractId)?.status==='absence').length}</strong> Faltas</span><span><strong>{registeredEmployees.length}</strong> Registrados</span></div><Input label="Buscar colaborador" value={registeredSearch} onChange={e=>{setRegisteredSearch(e.target.value);setRegisteredPage(1);}} placeholder="Nome, empresa ou função"/><div className="hr-clock-register__list">{loading?<p className="ui-muted">Carregando...</p>:registeredVisible.length===0?<p className="ui-muted">Nenhum colaborador encontrado.</p>:registeredVisible.map(compactRow)}</div><div className="hr-clock-pagination"><span>{registeredVisible.length} de {registeredFiltered.length}</span><Button size="sm" variant="secondary" disabled={registeredPage<=1} onClick={()=>setRegisteredPage(v=>v-1)}>Anterior</Button><span>{Math.min(registeredPage,registeredPages)} / {registeredPages}</span><Button size="sm" variant="secondary" disabled={registeredPage>=registeredPages} onClick={()=>setRegisteredPage(v=>v+1)}>Próxima</Button></div></div></Dialog><Dialog open={Boolean(cancelling)} title={cancelling?.kind==='all'?'Excluir jornada inteira':'Excluir marcação'} description={cancelling?.employee.fullName??''} onClose={()=>setCancelling(null)} onBack={()=>setCancelling(null)}><div className="hr-clock-cancel-dialog"><p>Esta ação cancela o registro para os cálculos e relatórios, mas preserva o histórico original para auditoria.</p><Input label="Justificativa obrigatória" value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Informe o motivo do cancelamento"/><Button disabled={cancelSaving||cancelReason.trim().length<5} onClick={()=>void confirmCancel()}>{cancelSaving?'Salvando...':'Confirmar exclusão'}</Button><Button variant="secondary" onClick={()=>setCancelling(null)}>Voltar sem excluir</Button></div></Dialog><Dialog open={Boolean(editing)} title={editing?`Corrigir ${punchLabels[editing.kind]}`:'Corrigir marcação'} description={editing?.employee.fullName??''} onClose={()=>setEditing(null)} onBack={()=>setEditing(null)}><div className="hr-workspace__clock-edit-fields"><Input label="Horário correto" type="time" value={correctedTime} onChange={e=>setCorrectedTime(e.target.value)}/><Input label="Justificativa obrigatória" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: Colaborador esqueceu de registrar"/><Button disabled={saving||reason.trim().length<5||!correctedTime} onClick={()=>void saveCorrection()}>{saving?'Salvando...':'Salvar correção'}</Button></div></Dialog></div>;
}
