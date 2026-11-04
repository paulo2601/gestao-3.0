import {useEffect,useMemo,useState} from 'react';
import type {HrEmployeeRow} from '../application/HrOperationsRepository';
import {assessEmployeePunches} from '../domain/assessEmployeePunches';
import {listWorkSchedulesForPeriod,listClockReportEvents,listClockAdjustments,listClockCancellations} from '../infrastructure/HrWorkspaceService';
import {weekdayIndex} from '../domain/assessEmployeePunches';
import {Button} from '../../../shared/ui/Button';
import {Card} from '../../../shared/ui/Card';

type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
type Day={date:string;scheduled:number;worked:number|null;status:string;difference:number|null};
type Summary={employee:Employee;planned:number;worked:number;positive:number;negative:number;days:Day[];incomplete:number;hasSchedule:boolean};
const fmt=(minutes:number)=>{const abs=Math.abs(Math.round(minutes));return (minutes<0?'-':'')+String(Math.floor(abs/60)).padStart(2,'0')+'h'+String(abs%60).padStart(2,'0');};
const dateLabel=(value:string)=>value.slice(8,10)+'/'+value.slice(5,7);
export function HrMonthlyClockClosing({employees}:{employees:Employee[]}){
 const [month,setMonth]=useState(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7));
 const [search,setSearch]=useState('');
 const [company,setCompany]=useState('');
 const [work,setWork]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const [rows,setRows]=useState<Summary[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 const scopes=useMemo(()=>employees.map(e=>e.employmentContractId).filter(Boolean),[employees]);
 useEffect(()=>{let cancelled=false;const run=async()=>{
  setLoading(true);setError('');
  try{
   const start=month+'-01',end=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
   const [versions,events,adjustments,cancellations]=await Promise.all([listWorkSchedulesForPeriod(scopes,start,end),listClockReportEvents(scopes,start,end),listClockAdjustments(scopes,start,end),listClockCancellations(scopes,start,end)]);
   if(cancelled)return;
   type Punch='entry'|'lunch_out'|'lunch_in'|'exit';
   const punchMap=new Map<string,Partial<Record<Punch,string>>>();
   for(const e of events){const local=new Date(e.captured_at).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',hour12:false});const key=e.employment_contract_id+'|'+local.slice(0,10);const p=punchMap.get(key)??{};p[e.punch_kind as Punch]=local.slice(11,16);punchMap.set(key,p);}
   for(const a of adjustments){const key=a.employment_contract_id+'|'+a.attendance_date;const p=punchMap.get(key)??{};p[a.punch_kind]=a.corrected_time.slice(0,5);punchMap.set(key,p);}
   const fullyCancelled=new Set(cancellations.filter(c=>c.punch_kind==='all').map(c=>c.employment_contract_id+'|'+c.attendance_date));
   for(const c of cancellations){const key=c.employment_contract_id+'|'+c.attendance_date;const p=punchMap.get(key)??{};if(c.punch_kind==='all')punchMap.set(key,{});else{delete p[c.punch_kind];punchMap.set(key,p);}}
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
      const recorded=Boolean(punch&&Object.values(punch).some(Boolean));
      if(!version){if(recorded){const raw=rawWorked(punch??{});if(raw!==null)worked+=raw;else incomplete++;days.push({date,scheduled:0,worked:raw,status:raw===null?'Ponto incompleto · sem jornada':'Sem jornada cadastrada',difference:null});}continue;}
      hasSchedule=true;
      const schedule=version.weekdays[weekdayIndex(date)];
      if(!schedule?.active){if(recorded){const raw=rawWorked(punch??{});if(raw!==null)worked+=raw;else incomplete++;days.push({date,scheduled:0,worked:raw,status:'Registro em folga · revisar',difference:null});}continue;}
     const scheduled=Math.max(0,parse(schedule.lunchOut)-parse(schedule.entry)+parse(schedule.exit)-parse(schedule.lunchIn));
     planned+=scheduled;
     if(!recorded){if(date<=today)days.push({date,scheduled,worked:null,status:fullyCancelled.has(id+'|'+date)?'Registros cancelados':'Sem marcações · revisar',difference:null});continue;}
     const result=assessEmployeePunches(versions,id,date,punch??{});
     if(!result||result.status!=='complete'||result.workedMinutes===null){incomplete++;const missing=([['entry','entrada'],['lunch_out','saída almoço'],['lunch_in','retorno almoço'],['exit','saída final']] as const).filter(([kind])=>!punch?.[kind]).map(([,label])=>label);days.push({date,scheduled,worked:null,status:missing.length?'Ponto incompleto · falta '+missing.join(', '):'Ponto inconsistente · revisar',difference:null});continue;}
     const diff=result.workedMinutes-scheduled;
     worked+=result.workedMinutes;if(diff>0)positive+=diff;else negative+=-diff;
     days.push({date,scheduled,worked:result.workedMinutes,status:'Completo',difference:diff});
    }
    return {employee,planned,worked,positive,negative,days,incomplete,hasSchedule};
   });
   setRows(result);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Falha ao consultar o ponto.');}
  finally{if(!cancelled)setLoading(false);}
 };void run();return()=>{cancelled=true;};},[month,scopes,employees]);
 const visible=rows.filter(r=>(!company||r.employee.companyId===company)&&(!work||r.employee.costCenterName===work)&&r.employee.fullName.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.employee.fullName.localeCompare(b.employee.fullName,'pt-BR'));
 const current=visible.find(r=>r.employee.employmentContractId===selected);
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
  {!loading&&<><div className="hr-monthly__metrics">
   {[['Colaboradores',String(visible.length)],['Horas previstas',fmt(totals.planned)],['Trabalhadas',fmt(totals.worked)],['Excedentes',fmt(totals.positive)],['Faltantes',fmt(totals.negative)],['Saldo preliminar',fmt(totals.positive-totals.negative)]].map(([label,value])=><Card key={label}><small>{label}</small><h3 className="hr-monthly__metric-value">{value}</h3></Card>)}
  </div><Card><div className="hr-monthly__scroll"><table className="hr-monthly__table"><thead><tr>{['Colaborador','Previstas','Trabalhadas','Excedente','Faltante','Saldo','Situação'].map(t=><th key={t} className="hr-monthly__th">{t}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.employee.employmentContractId} className={selected===r.employee.employmentContractId?'hr-monthly__selected':''}><td className="hr-monthly__td hr-monthly__name"><button type="button" onClick={()=>setSelected(r.employee.employmentContractId)} className="hr-monthly__employee">{r.employee.fullName}</button><div><small>{r.employee.costCenterName??r.employee.companyName}</small></div></td>{[r.hasSchedule?fmt(r.planned):'—',r.days.some(d=>d.worked!==null)?fmt(r.worked):'—',r.hasSchedule?fmt(r.positive):'—',r.hasSchedule?fmt(r.negative):'—',r.hasSchedule?fmt(r.positive-r.negative):'—'].map((v,i)=><td key={i} data-label={['Previstas','Trabalhadas','Excedente','Faltante','Saldo'][i]} className="hr-monthly__td hr-monthly__nowrap">{v}</td>)}<td data-label="Situação" className="hr-monthly__td">{!r.hasSchedule?'Jornada não cadastrada':r.incomplete?'Ponto incompleto':r.days.some(d=>d.status.includes('revisar'))?'Revisar registros':'Preliminar'}</td></tr>)}</tbody></table></div>{!visible.length&&<p>Nenhum colaborador encontrado.</p>}</Card>
  {current&&<Card><div className="hr-monthly__detail-head"><div><h3 className="hr-monthly__title">{current.employee.fullName} — Detalhamento</h3><p className="ui-muted">Diferenças por dia na competência {month.slice(5)}/{month.slice(0,4)}</p></div><Button onClick={()=>setSelected(null)}>Fechar</Button></div><div className="hr-monthly__detail-scroll"><table className="hr-monthly__detail-table"><thead><tr><th>Dia</th><th>Previstas</th><th>Trabalhadas</th><th>Diferença</th><th>Situação</th></tr></thead><tbody>{current.days.filter(d=>d.difference!==0||d.status!=='Completo').map(d=><tr key={d.date}><td>{dateLabel(d.date)}</td><td>{fmt(d.scheduled)}</td><td>{d.worked===null?'—':fmt(d.worked)}</td><td>{d.difference===null?'—':(d.difference>0?'+':'')+fmt(d.difference)}</td><td>{d.status}</td></tr>)}</tbody></table></div></Card>}
  <p className="ui-muted hr-monthly__note">Apuração preliminar baseada nas quatro marcações e na jornada cadastrada. Dias sem ponto ou incompletos exigem conferência; folgas, feriados, ausências justificadas, tolerâncias e regras de compensação devem ser validados pelo RH antes do fechamento. Nenhuma hora extra é aprovada ou paga automaticamente nesta tela.</p></>}
 </div>;
}
