import './HrMonthlyClockClosing.css';
import {useEffect,useMemo,useState} from 'react';
import type {HrEmployeeRow} from '../application/HrOperationsRepository';
import {assessEmployeePunches} from '../domain/assessEmployeePunches';
import {listWorkSchedulesForPeriod,listClockReportEvents,listClockAdjustments,listClockCancellations,listAttendanceForPeriod,saveClockAdjustment} from '../infrastructure/HrWorkspaceService';
import {weekdayIndex} from '../domain/assessEmployeePunches';
import {Button} from '../../../shared/ui/Button';
import {Card} from '../../../shared/ui/Card';

type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
type Day={date:string;scheduled:number;worked:number|null;status:string;difference:number|null};
type Punch='entry'|'lunch_out'|'lunch_in'|'exit';
const punchLabels:Record<Punch,string>={entry:'Entrada',lunch_out:'Saída para almoço',lunch_in:'Retorno do almoço',exit:'Saída final'};
type Summary={employee:Employee;planned:number;worked:number;positive:number;negative:number;days:Day[];incomplete:number;hasSchedule:boolean};
const fmt=(minutes:number)=>{const abs=Math.abs(Math.round(minutes));return (minutes<0?'-':'')+String(Math.floor(abs/60)).padStart(2,'0')+'h'+String(abs%60).padStart(2,'0');};
const dateLabel=(value:string)=>value.slice(8,10)+'/'+value.slice(5,7);
const isNationalHoliday=(date:string)=>{const [year=0]=date.split('-').map(Number);const fixed=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25']);if(fixed.has(date.slice(5)))return true;const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);const easterMonth=Math.floor((h+l-7*m+114)/31);const easterDay=(h+l-7*m+114)%31+1;const easter=new Date(Date.UTC(year,easterMonth-1,easterDay));const friday=new Date(easter.getTime()-2*86400000).toISOString().slice(0,10);return date===friday;};
const statusOf=(r:Summary)=>!r.hasSchedule?'Jornada não cadastrada':r.incomplete?'Ponto incompleto':r.days.some(d=>d.status.includes('revisar'))?'Revisar registros':'Preliminar';
const statusClass=(status:string)=>status==='Ponto incompleto'?'hr-monthly__status--danger':status==='Revisar registros'?'hr-monthly__status--warning':status==='Preliminar'?'hr-monthly__status--ok':'hr-monthly__status--neutral';
export function HrMonthlyClockClosing({employees}:{employees:Employee[]}){
 const [month,setMonth]=useState(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7));
 const [search,setSearch]=useState('');
 const [company,setCompany]=useState('');
 const [work,setWork]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const [rows,setRows]=useState<Summary[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [editDate,setEditDate]=useState<string|null>(null);
 const [editPunch,setEditPunch]=useState<Punch>('entry');
 const [editTime,setEditTime]=useState('');
 const [editReason,setEditReason]=useState('');
 const [saving,setSaving]=useState(false);
 const [editError,setEditError]=useState('');
 const [editSuccess,setEditSuccess]=useState('');
 const [punchesByDay,setPunchesByDay]=useState<Map<string,Partial<Record<Punch,string>>>>(new Map());

 const scopes=useMemo(()=>employees.map(e=>e.employmentContractId).filter(Boolean),[employees]);
 useEffect(()=>{let cancelled=false;const run=async()=>{
  if(!rows.length)setLoading(true);setError('');
  try{
   const start=month+'-01',end=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
   const attendanceScopes=[...new Map(employees.map(e=>[e.tenantId+'|'+e.companyId,{tenantId:e.tenantId,companyId:e.companyId}])).values()];
   const [versions,events,adjustments,cancellations,attendance]=await Promise.all([listWorkSchedulesForPeriod(scopes,start,end),listClockReportEvents(scopes,start,end),listClockAdjustments(scopes,start,end),listClockCancellations(scopes,start,end),listAttendanceForPeriod(attendanceScopes,start,end)]);
   if(cancelled)return;
   const punchMap=new Map<string,Partial<Record<Punch,string>>>();
   for(const e of events){const local=new Date(e.captured_at).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',hour12:false});const key=e.employment_contract_id+'|'+local.slice(0,10);const p=punchMap.get(key)??{};p[e.punch_kind as Punch]=local.slice(11,16);punchMap.set(key,p);}
   for(const a of adjustments){const key=a.employment_contract_id+'|'+a.attendance_date;const p=punchMap.get(key)??{};p[a.punch_kind]=a.corrected_time.slice(0,5);punchMap.set(key,p);}
   const attendanceMap=new Map(attendance.map(a=>[a.employmentContractId+'|'+a.attendanceDate,a]));
   const fullyCancelled=new Set(cancellations.filter(c=>c.punch_kind==='all').map(c=>c.employment_contract_id+'|'+c.attendance_date));
   for(const c of cancellations){const key=c.employment_contract_id+'|'+c.attendance_date;const p=punchMap.get(key)??{};if(c.punch_kind==='all')punchMap.set(key,{});else{delete p[c.punch_kind];punchMap.set(key,p);}}
   setPunchesByDay(new Map(punchMap));
   const parse=(v:string)=>{const [h=0,m=0]=v.split(':').map(Number);return h*60+m;};
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
   const rawWorked=(p:Partial<Record<Punch,string>>)=>p.entry&&p.lunch_out&&p.lunch_in&&p.exit&&parse(p.entry)<=parse(p.lunch_out)&&parse(p.lunch_out)<=parse(p.lunch_in)&&parse(p.lunch_in)<=parse(p.exit)?parse(p.lunch_out)-parse(p.entry)+parse(p.exit)-parse(p.lunch_in):null;
   const result:Summary[]=employees.map(employee=>{
    const id=employee.employmentContractId;const days:Day[]=[];let planned=0,worked=0,positive=0,negative=0,incomplete=0,hasSchedule=false;
    const lastDay=Number(end.slice(8));
    for(let n=1;n<=lastDay;n++){
     const date=month+'-'+String(n).padStart(2,'0');
     const version=versions.filter(v=>v.employment_contract_id===id&&v.effective_on<=date).sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0];
     const punch=punchMap.get(id+'|'+date);
     const attendanceDay=attendanceMap.get(id+'|'+date);
     const justified=attendanceDay?.status==='medical_certificate'||attendanceDay?.status==='vacation'||attendanceDay?.status==='day_off';
     const justifiedLabel=attendanceDay?.status==='medical_certificate'?'Atestado médico':attendanceDay?.status==='vacation'?'Férias':'Folga registrada';
      const recorded=Boolean(punch&&Object.values(punch).some(Boolean));
      if(!version){if(recorded){const raw=rawWorked(punch??{});if(raw!==null)worked+=raw;else incomplete++;days.push({date,scheduled:0,worked:raw,status:raw===null?'Ponto incompleto · sem jornada':'Sem jornada cadastrada',difference:null});}continue;}
      hasSchedule=true;
      const schedule=version.weekdays[weekdayIndex(date)];
      if(!schedule?.active){if(recorded){const raw=rawWorked(punch??{});if(raw!==null)worked+=raw;else incomplete++;days.push({date,scheduled:0,worked:raw,status:'Registro em folga · revisar',difference:null});}continue;}
     const scheduled=Math.max(0,parse(schedule.lunchOut)-parse(schedule.entry)+parse(schedule.exit)-parse(schedule.lunchIn));
     planned+=scheduled;
     if(!recorded){if(justified){days.push({date,scheduled,worked:null,status:justifiedLabel,difference:null});continue;}if(date<today){const canceled=fullyCancelled.has(id+'|'+date);const holiday=isNationalHoliday(date);days.push({date,scheduled,worked:null,status:canceled?'Registros cancelados':holiday?'Feriado nacional · sem marcações':'Sem marcações · revisar',difference:null});}continue;}
     const result=assessEmployeePunches(versions,id,date,punch??{});
     if(!result||result.status!=='complete'||result.workedMinutes===null){incomplete++;const missing=([['entry','entrada'],['lunch_out','saída almoço'],['lunch_in','retorno almoço'],['exit','saída final']] as const).filter(([kind])=>!punch?.[kind]).map(([,label])=>label);days.push({date,scheduled,worked:null,status:missing.length?'Ponto incompleto · falta '+missing.join(', '):'Ponto inconsistente · revisar',difference:null});continue;}
     // CLT art. 58, §1º: desconsiderar pequenas variações somente quando
     // CADA marcação estiver dentro da tolerância e a soma absoluta do dia <= 10 min.
     // Ultrapassado qualquer limite, considerar a diferença integral, sem deduzir franquia.
     const scheduledPunches=[schedule.entry,schedule.lunchOut,schedule.lunchIn,schedule.exit].map(parse);
     const actualPunches=[punch!.entry!,punch!.lunch_out!,punch!.lunch_in!,punch!.exit!].map(parse);
     const deviations=actualPunches.map((actual,i)=>Math.abs(actual-scheduledPunches[i]!));
     const tolerance=Math.min(5,Math.max(0,version.tolerance_minutes??5));
     const withinTolerance=deviations.every(minutes=>minutes<=tolerance)&&deviations.reduce((sum,minutes)=>sum+minutes,0)<=10;
     const diff=withinTolerance?0:result.workedMinutes-scheduled;
     worked+=result.workedMinutes;if(diff>0)positive+=diff;else if(diff<0)negative+=-diff;
     days.push({date,scheduled,worked:result.workedMinutes,status:'Completo',difference:diff});
    }
    return {employee,planned,worked,positive,negative,days,incomplete,hasSchedule};
   });
   setRows(result);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Falha ao consultar o ponto.');}
  finally{if(!cancelled)setLoading(false);}
 };void run();return()=>{cancelled=true;};},[month,scopes,employees,refresh]);
 const visible=rows.filter(r=>(!company||r.employee.companyId===company)&&(!work||r.employee.costCenterName===work)&&r.employee.fullName.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.employee.fullName.localeCompare(b.employee.fullName,'pt-BR'));
 const current=visible.find(r=>r.employee.employmentContractId===selected);
 const editingPunches=editDate&&current?punchesByDay.get(current.employee.employmentContractId+'|'+editDate):null;
 const openDay=(date:string)=>{setEditDate(date);setEditPunch('entry');setEditTime(punchesByDay.get(current!.employee.employmentContractId+'|'+date)?.entry??'');setEditReason('');setEditError('');setEditSuccess('');};
 const saveDay=async()=>{if(!current||!editDate)return;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(editTime)){setEditError('Informe um horário válido.');return;}if(editReason.trim().length<5){setEditError('Informe uma justificativa com pelo menos 5 caracteres.');return;}
 try{setSaving(true);setEditError('');await saveClockAdjustment({tenantId:current.employee.tenantId,companyId:current.employee.companyId,employmentContractId:current.employee.employmentContractId,attendanceDate:editDate,punchKind:editPunch,correctedTime:editTime,originalTime:editingPunches?.[editPunch]??null,reason:editReason});setPunchesByDay(previous=>{const next=new Map(previous);const key=current.employee.employmentContractId+'|'+editDate;next.set(key,{...(next.get(key)??{}),[editPunch]:editTime});return next;});setEditSuccess('Correção salva. Atualizando os totais sem sair desta tela.');setRefresh(v=>v+1);}catch(e){setEditError(e instanceof Error?e.message:'Falha ao salvar ajuste.');}finally{setSaving(false);}};
 const pendingCount=visible.filter(r=>r.incomplete||r.days.some(d=>d.status.includes('revisar'))).length;
 const totals=visible.reduce((a,r)=>({planned:a.planned+r.planned,worked:a.worked+r.worked,positive:a.positive+r.positive,negative:a.negative+r.negative}),{planned:0,worked:0,positive:0,negative:0});
 const exportCsv=()=>{const lines=[['Colaborador','Empresa','Obra','Previstas','Trabalhadas','Excedentes','Faltantes','Saldo preliminar','Pendências'],...visible.map(r=>[r.employee.fullName,r.employee.companyName,r.employee.costCenterName??'',fmt(r.planned),fmt(r.worked),fmt(r.positive),fmt(r.negative),fmt(r.positive-r.negative),String(r.incomplete)])];const csv='\uFEFF'+lines.map(line=>line.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fechamento-ponto-'+month+'.csv';a.click();URL.revokeObjectURL(url);};
 return <div className="hr-workspace__content hr-monthly">
  <Card><div className="hr-monthly__header"><h2 className="hr-monthly__title">Ponto Digital</h2><div className="hr-monthly__actions"><Button onClick={exportCsv} disabled={loading||!visible.length}>Exportar CSV</Button></div></div>
  <div className="hr-monthly__filters">
   <label>Competência <input aria-label="Competência" type="month" value={month} onChange={e=>setMonth(e.target.value)} /></label>
   <label>Empresa <select value={company} onChange={e=>setCompany(e.target.value)}><option value="">Todas</option>{[...new Map(employees.map(e=>[e.companyId,e.companyName])).entries()].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Obra <select value={work} onChange={e=>setWork(e.target.value)}><option value="">Todas</option>{[...new Set(employees.map(e=>e.costCenterName).filter((v):v is string=>Boolean(v)))].sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   <label>Colaborador <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome" /></label>
  </div></Card>
  {error&&<Card><p role="alert" className="hr-monthly__error">{error}</p></Card>}
  {loading&&<Card><p>Consultando marcações e jornadas cadastradas...</p></Card>}
  {(!loading||rows.length>0)&&<><div className="hr-monthly__metrics">
   {[['Colaboradores',String(visible.length)],['Horas previstas',fmt(totals.planned)],['Trabalhadas',fmt(totals.worked)],['Excedentes',fmt(totals.positive)],['Faltantes',fmt(totals.negative)],['Saldo preliminar',fmt(totals.positive-totals.negative)]].map(([label,value])=><Card key={label}><small>{label}</small><h3 className="hr-monthly__metric-value">{value}</h3></Card>)}
  </div><Card><div className="hr-monthly__list-head"><div><h3 className="hr-monthly__list-title">Colaboradores</h3><span className="ui-muted">Selecione um nome para conferir os dias e horários.</span></div><span className="hr-monthly__pending">{pendingCount} com pendências</span></div><div className="hr-monthly__scroll"><table className="hr-monthly__table"><thead><tr>{['Colaborador','Previstas','Trabalhadas','Excedente','Faltante','Saldo','Situação'].map(t=><th key={t} className="hr-monthly__th">{t}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.employee.employmentContractId} className={selected===r.employee.employmentContractId?'hr-monthly__selected':''}><td className="hr-monthly__td hr-monthly__name"><button type="button" onClick={()=>setSelected(selected===r.employee.employmentContractId?null:r.employee.employmentContractId)} className="hr-monthly__employee">{r.employee.fullName} <span aria-hidden="true">{selected===r.employee.employmentContractId?'▴':'▾'}</span></button><div><small>{r.employee.costCenterName??r.employee.companyName}</small></div></td>{[r.hasSchedule?fmt(r.planned):'—',r.days.some(d=>d.worked!==null)?fmt(r.worked):'—',r.hasSchedule?fmt(r.positive):'—',r.hasSchedule?fmt(r.negative):'—',r.hasSchedule?fmt(r.positive-r.negative):'—'].map((v,i)=><td key={i} data-label={['Previstas','Trabalhadas','Excedente','Faltante','Saldo'][i]} className="hr-monthly__td hr-monthly__nowrap">{v}</td>)}<td data-label="Situação" className="hr-monthly__td"><span className={'hr-monthly__status '+statusClass(statusOf(r))}>{statusOf(r)}</span></td></tr>)}</tbody></table></div>{!visible.length&&<p>Nenhum colaborador encontrado.</p>}</Card>
  {current&&<Card><div className="hr-monthly__detail-head"><div><h3 className="hr-monthly__title">{current.employee.fullName} — Detalhamento</h3><p className="ui-muted">Dias com diferenças, registros ausentes ou cancelamentos · {month.slice(5)}/{month.slice(0,4)}</p></div><Button onClick={()=>setSelected(null)}>Fechar</Button></div><div className="hr-monthly__detail-scroll"><table className="hr-monthly__detail-table"><thead><tr><th>Dia</th><th>Previstas</th><th>Trabalhadas</th><th>Diferença</th><th>Situação</th></tr></thead><tbody>{current.days.filter(d=>d.difference!==0||d.status!=='Completo').map(d=><tr key={d.date} onClick={()=>openDay(d.date)} title="Toque para visualizar e corrigir marcações"><td><button type="button" onClick={()=>openDay(d.date)} aria-label={'Corrigir ponto de '+dateLabel(d.date)}>{dateLabel(d.date)} ✎</button></td><td>{fmt(d.scheduled)}</td><td>{d.worked===null?'—':fmt(d.worked)}</td><td>{d.difference===null?'—':(d.difference>0?'+':'')+fmt(d.difference)}</td><td>{d.status}</td></tr>)}</tbody></table></div></Card>}
  {editSuccess&&<p role="status" className="hr-clock-edit__success">{editSuccess}</p>}
  {current&&editDate&&<Card><section className="hr-clock-edit" aria-label="Correção de ponto"><h3>Corrigir ponto — {dateLabel(editDate)}</h3><p className="ui-muted">{current.employee.fullName}</p><div className="hr-clock-edit__punches">{(Object.keys(punchLabels) as Punch[]).map(kind=><button className={'hr-clock-edit__punch'+(editPunch===kind?' hr-clock-edit__punch--active':'')} key={kind} type="button" onClick={()=>{setEditPunch(kind);setEditTime(editingPunches?.[kind]??'');setEditError('');}}><span>{punchLabels[kind]}</span><strong>{editingPunches?.[kind]??'Sem registro'}</strong></button>)}</div><label className="hr-clock-edit__field">Novo horário — {punchLabels[editPunch]}<input type="time" value={editTime} onChange={e=>{setEditTime(e.target.value);setEditError('');}}/></label><label className="hr-clock-edit__field">Justificativa da correção<textarea value={editReason} onChange={e=>{setEditReason(e.target.value);setEditError('');}} placeholder="Descreva o motivo da correção (mínimo 5 caracteres)" rows={3}/></label>{editSuccess&&<p role="status" className="hr-clock-edit__success">{editSuccess}</p>}{editError&&<p role="alert" className="hr-clock-edit__error">{editError}</p>}<div className="hr-clock-edit__actions"><Button onClick={()=>void saveDay()} disabled={saving}>{saving?'Salvando...':'Salvar correção'}</Button><Button onClick={()=>{setEditDate(null);setEditError('');}} disabled={saving}>Cancelar</Button></div></section></Card>}
  <p className="ui-muted hr-monthly__note">Saldos provisórios. Dias sem marcação são sinalizados somente após o dia transcorrer; feriados nacionais são identificados separadamente. Ausências justificadas, escalas especiais, compensações e aprovação de horas extras dependem de validação do RH. Nenhuma hora é paga automaticamente.</p></>}
 </div>;
}
