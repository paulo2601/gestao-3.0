import {useEffect,useMemo,useState} from 'react';
import type {HrEmployeeRow} from '../application/HrOperationsRepository';
import {listDailyScheduleAssessments} from '../infrastructure/listDailyScheduleAssessments';
import {listWorkSchedulesForPeriod} from '../infrastructure/HrWorkspaceService';
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
 const [revision,setRevision]=useState(0);
 const scopes=useMemo(()=>employees.map(e=>e.employmentContractId).filter(Boolean),[employees]);
 useEffect(()=>{let cancelled=false;const run=async()=>{
  setLoading(true);setError('');
  try{
   const start=month+'-01',end=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
   const [assessments,versions]=await Promise.all([listDailyScheduleAssessments(scopes,start,end),listWorkSchedulesForPeriod(scopes,start,end)]);
   if(cancelled)return;
   const byKey=new Map(assessments.map(a=>[a.contractId+'|'+a.date,a.result]));
   const result:Summary[]=employees.map(employee=>{
    const id=employee.employmentContractId;const days:Day[]=[];let planned=0,worked=0,positive=0,negative=0,incomplete=0,hasSchedule=false;
    const lastDay=Number(end.slice(8));
    for(let n=1;n<=lastDay;n++){
     const date=month+'-'+String(n).padStart(2,'0');
     const version=versions.filter(v=>v.employment_contract_id===id&&v.effective_on<=date).sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0];
     if(!version)continue;
     hasSchedule=true;
     const schedule=version.weekdays[weekdayIndex(date)];
     if(!schedule?.active)continue;
     const parse=(v:string)=>{const [h,m]=v.split(':').map(Number);return h*60+m;};
     const scheduled=Math.max(0,parse(schedule.lunchOut)-parse(schedule.entry)+parse(schedule.exit)-parse(schedule.lunchIn));
     planned+=scheduled;
     const result=byKey.get(id+'|'+date);
     if(!result){days.push({date,scheduled,worked:null,status:'Sem marcações',difference:null});continue;}
     if(result.status!=='complete'||result.workedMinutes===null){incomplete++;days.push({date,scheduled,worked:null,status:'Ponto incompleto',difference:null});continue;}
     const diff=result.workedMinutes-scheduled;
     worked+=result.workedMinutes;if(diff>0)positive+=diff;else negative+=-diff;
     days.push({date,scheduled,worked:result.workedMinutes,status:'Completo',difference:diff});
    }
    return {employee,planned,worked,positive,negative,days,incomplete,hasSchedule};
   });
   setRows(result);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Falha ao consultar o ponto.');}
  finally{if(!cancelled)setLoading(false);}
 };void run();return()=>{cancelled=true;};},[month,scopes,employees,revision]);
 const visible=rows.filter(r=>(!company||r.employee.companyId===company)&&(!work||r.employee.costCenterName===work)&&r.employee.fullName.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.employee.fullName.localeCompare(b.employee.fullName,'pt-BR'));
 const current=visible.find(r=>r.employee.employmentContractId===selected);
 const totals=visible.reduce((a,r)=>({planned:a.planned+r.planned,worked:a.worked+r.worked,positive:a.positive+r.positive,negative:a.negative+r.negative}),{planned:0,worked:0,positive:0,negative:0});
 const exportCsv=()=>{const lines=[['Colaborador','Empresa','Obra','Previstas','Trabalhadas','Excedentes','Faltantes','Saldo preliminar','Pendências'],...visible.map(r=>[r.employee.fullName,r.employee.companyName,r.employee.costCenterName??'',fmt(r.planned),fmt(r.worked),fmt(r.positive),fmt(r.negative),fmt(r.positive-r.negative),String(r.incomplete)])];const csv='\uFEFF'+lines.map(line=>line.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fechamento-ponto-'+month+'.csv';a.click();URL.revokeObjectURL(url);};
 return <div className="hr-workspace__content" style={{display:'grid',gap:16}}>
  <Card><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:0}}>Ponto Digital — Fechamento Mensal</h2><p className="ui-muted">Conferência mensal de horas por colaborador. Saldos preliminares, sem alterar folha ou banco de horas.</p></div><div style={{display:'flex',gap:8}}><Button onClick={()=>setRevision(n=>n+1)}>Atualizar</Button><Button onClick={exportCsv} disabled={loading||!visible.length}>Exportar CSV</Button></div></div>
  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:12}}>
   <label>Competência <input aria-label="Competência" type="month" value={month} onChange={e=>setMonth(e.target.value)} /></label>
   <label>Empresa <select value={company} onChange={e=>setCompany(e.target.value)}><option value="">Todas</option>{[...new Map(employees.map(e=>[e.companyId,e.companyName])).entries()].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Obra <select value={work} onChange={e=>setWork(e.target.value)}><option value="">Todas</option>{[...new Set(employees.map(e=>e.costCenterName).filter((v):v is string=>Boolean(v)))].sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   <label>Colaborador <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome" /></label>
  </div></Card>
  {error&&<Card><p role="alert" style={{color:'#b91c1c'}}>{error}</p></Card>}
  {loading&&<Card><p>Consultando marcações e jornadas cadastradas...</p></Card>}
  {!loading&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10}}>
   {[['Colaboradores',String(visible.length)],['Horas previstas',fmt(totals.planned)],['Trabalhadas',fmt(totals.worked)],['Excedentes',fmt(totals.positive)],['Faltantes',fmt(totals.negative)],['Saldo preliminar',fmt(totals.positive-totals.negative)]].map(([label,value])=><Card key={label}><small>{label}</small><h3 style={{margin:'6px 0'}}>{value}</h3></Card>)}
  </div><Card><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',minWidth:730}}><thead><tr>{['Colaborador','Previstas','Trabalhadas','Excedente','Faltante','Saldo','Situação'].map(t=><th key={t} style={{padding:10,borderBottom:'1px solid #cbd5e1'}}>{t}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.employee.employmentContractId} style={{background:selected===r.employee.employmentContractId?'#dbeafe':undefined}}><td style={{padding:10,borderBottom:'1px solid #e2e8f0'}}><button type="button" onClick={()=>setSelected(r.employee.employmentContractId)} style={{border:0,background:'transparent',color:'#1d4ed8',cursor:'pointer',fontWeight:700,textAlign:'left'}}>{r.employee.fullName}</button><div><small>{r.employee.costCenterName??r.employee.companyName}</small></div></td>{[fmt(r.planned),fmt(r.worked),fmt(r.positive),fmt(r.negative),fmt(r.positive-r.negative)].map((v,i)=><td key={i} style={{padding:10,borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{v}</td>)}<td style={{padding:10,borderBottom:'1px solid #e2e8f0'}}>{!r.hasSchedule?'Sem jornada':r.incomplete?'Pendente de revisão':'Preliminar'}</td></tr>)}</tbody></table></div>{!visible.length&&<p>Nenhum colaborador encontrado.</p>}</Card>
  {current&&<Card><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h3 style={{margin:0}}>{current.employee.fullName} — Detalhamento</h3><p className="ui-muted">Diferenças por dia na competência {month.slice(5)}/{month.slice(0,4)}</p></div><Button onClick={()=>setSelected(null)}>Fechar</Button></div><div style={{overflowX:'auto',maxHeight:380,overflowY:'auto'}}><table style={{width:'100%',minWidth:500,textAlign:'left'}}><thead><tr><th>Dia</th><th>Previstas</th><th>Trabalhadas</th><th>Diferença</th><th>Situação</th></tr></thead><tbody>{current.days.filter(d=>d.difference!==0||d.status!=='Completo').map(d=><tr key={d.date}><td>{dateLabel(d.date)}</td><td>{fmt(d.scheduled)}</td><td>{d.worked===null?'—':fmt(d.worked)}</td><td>{d.difference===null?'—':(d.difference>0?'+':'')+fmt(d.difference)}</td><td>{d.status}</td></tr>)}</tbody></table></div></Card>}
  <p className="ui-muted" style={{fontSize:12}}>Apuração preliminar baseada nas quatro marcações e na jornada cadastrada. Dias sem ponto ou incompletos exigem conferência; folgas, feriados, ausências justificadas, tolerâncias e regras de compensação devem ser validados pelo RH antes do fechamento. Nenhuma hora extra é aprovada ou paga automaticamente nesta tela.</p></>}
 </div>;
}
