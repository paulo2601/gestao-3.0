import { useMemo, useState } from 'react';
import type { FixedCompensationItem, HrEmployeeRow } from '../application/HrOperationsRepository';
import { saveFortnightClosing } from '../infrastructure/HrWorkspaceService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';

export type FortnightEmployee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
type Props={employees:FortnightEmployee[];fixedItems:readonly FixedCompensationItem[];competence:string;onCloseEmployee:(employee:FortnightEmployee)=>Promise<void>};

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const uniq=(values:(string|null)[])=>[...new Set(values.filter((v):v is string=>Boolean(v)))].sort((a,b)=>a.localeCompare(b,'pt-BR'));

export function HrFortnightClosingSection({employees,fixedItems,competence,onCloseEmployee}:Props){
 const [half,setHalf]=useState('1'); const [company,setCompany]=useState(''); const [work,setWork]=useState(''); const [sector,setSector]=useState(''); const [supervisor,setSupervisor]=useState(''); const [job,setJob]=useState(''); const [employeeId,setEmployeeId]=useState(''); const [feedback,setFeedback]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 const filtered=useMemo(()=>employees.filter(e=>(!company||e.companyId===company)&&(!work||e.costCenterName===work)&&(!sector||e.sector===sector)&&(!supervisor||e.supervisor===supervisor)&&(!job||e.jobTitle===job)&&(!employeeId||e.employmentContractId===employeeId)),[employees,company,work,sector,supervisor,job,employeeId]);
 const selected=employees.find(e=>e.employmentContractId===employeeId);
 const fixedTotal=(e:FortnightEmployee)=>fixedItems.filter(i=>i.employmentContractId===e.employmentContractId&&i.active).reduce((sum,i)=>{const value=i.valueType==='percent'?e.baseSalary*i.value/100:i.value;return sum+(i.kind==='earning'?value:-value)},0);
 const projected=filtered.reduce((sum,e)=>sum+e.baseSalary/2+fixedTotal(e)/2,0);
 async function closeGroup(){if(!filtered.length){setFeedback('Nenhum colaborador encontrado para os filtros selecionados.');return;}setSaving(true);setFeedback(null);try{for(const employee of filtered)await onCloseEmployee(employee);const groups=new Map<string,FortnightEmployee[]>();filtered.forEach(e=>groups.set(e.companyId,[...(groups.get(e.companyId)??[]),e]));for(const rows of groups.values()){const first=rows[0];const total=rows.reduce((sum,e)=>sum+e.baseSalary/2+fixedTotal(e)/2,0);await saveFortnightClosing({tenantId:first.tenantId,companyId:first.companyId,competenceMonth:competence,payrollHalf:Number(half) as 1|2,filters:{work,sector,supervisor,job,employeeId},totalAmount:total});}setFeedback(`${half}ª quinzena fechada com sucesso para ${filtered.length} colaborador(es).`);}catch(error){setFeedback(error instanceof Error?error.message:'Não foi possível fechar a quinzena.');}finally{setSaving(false);}}
 return <div className="hr-workspace__content"><Card title="Fechamento quinzenal" description="Mesmo fluxo operacional do Gestão 2.0, preservando a estrutura do Gestão 3.0."><div className="hr-workspace__edit-grid">
  <Input label="Competência" type="month" value={competence.slice(0,7)} readOnly/>
  <Select label="Quinzena" value={half} onChange={e=>setHalf(e.target.value)} options={[{value:'1',label:'1ª quinzena'},{value:'2',label:'2ª quinzena'}]}/>
  <Select label="Empresa" value={company} onChange={e=>{setCompany(e.target.value);setEmployeeId('')}} options={[{value:'',label:'Todas'},...uniq(employees.map(e=>e.companyId)).map(id=>({value:id,label:employees.find(e=>e.companyId===id)?.companyName??id}))]}/>
  <Select label="Obra" value={work} onChange={e=>setWork(e.target.value)} options={[{value:'',label:'Todas'},...uniq(employees.map(e=>e.costCenterName)).map(v=>({value:v,label:v}))]}/>
  <Select label="Setor" value={sector} onChange={e=>setSector(e.target.value)} options={[{value:'',label:'Todos'},...uniq(employees.map(e=>e.sector)).map(v=>({value:v,label:v}))]}/>
  <Select label="Encarregado" value={supervisor} onChange={e=>setSupervisor(e.target.value)} options={[{value:'',label:'Todos'},...uniq(employees.map(e=>e.supervisor)).map(v=>({value:v,label:v}))]}/>
  <Select label="Função" value={job} onChange={e=>setJob(e.target.value)} options={[{value:'',label:'Todas'},...uniq(employees.map(e=>e.jobTitle)).map(v=>({value:v,label:v}))]}/>
  <Select label="Colaborador" value={employeeId} onChange={e=>setEmployeeId(e.target.value)} options={[{value:'',label:'Todos os encontrados'},...filtered.map(e=>({value:e.employmentContractId,label:e.fullName}))]}/>
 </div>
 <div className="hr-dashboard__headline"><div><span>Colaboradores encontrados</span><strong>{filtered.length}</strong><small>{selected?selected.fullName:'Fechamento em grupo'}</small></div><div><span>Total projetado da quinzena</span><strong>{money.format(projected)}</strong><small>Salário base + verbas fixas proporcionais</small></div></div>
 <div className="hr-workspace__list">{filtered.map(e=><div className="hr-workspace__list-row" key={e.employmentContractId}><div><strong>{e.fullName}</strong><span>{e.companyName} · {e.jobTitle} · {e.costCenterName??'Sem obra'}</span></div><div><strong>{money.format(e.baseSalary/2+fixedTotal(e)/2)}</strong><span>Base {money.format(e.baseSalary)} · fixos {money.format(fixedTotal(e))}</span></div></div>)}</div>
 <div className="hr-workspace__actions"><Button variant="secondary" onClick={()=>{setCompany('');setWork('');setSector('');setSupervisor('');setJob('');setEmployeeId('')}}>Limpar filtros</Button><Button onClick={()=>void closeGroup()} disabled={saving}>{saving?'Fechando...':`Fechar ${half}ª quinzena`}</Button></div>
 {feedback&&<Feedback title="Fechamento quinzenal" message={feedback} tone={feedback.includes('sucesso')?'success':'danger'}/>}
 </Card></div>;
}