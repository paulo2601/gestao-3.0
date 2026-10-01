import { useMemo, useState } from 'react';
import type { HrEmployeeRow } from '../application/HrOperationsRepository';
import { listAttendanceForDate, registerAttendancePunch, type AttendanceRecord, type AttendanceStatus } from '../infrastructure/HrWorkspaceService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';

type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
const attendanceOptions=[{value:'',label:'Não registrado'},{value:'present',label:'Presente'},{value:'absence',label:'Falta'},{value:'medical_certificate',label:'Atestado'},{value:'vacation',label:'Férias'},{value:'day_off',label:'Folga'},{value:'other',label:'Outro'}];

export function HrAttendanceSection({date,setDate,search,setSearch,rows,employees,loading,feedback,onAllPresent,onChange,onRowsChange,onFeedback}:{date:string;setDate:(v:string)=>void;search:string;setSearch:(v:string)=>void;rows:AttendanceRecord[];employees:Employee[];loading:boolean;feedback:string|null;onAllPresent:()=>void;onChange:(employee:Employee,status:AttendanceStatus)=>void;onRowsChange:(rows:AttendanceRecord[])=>void;onFeedback:(message:string)=>void}){
 const [showRegistered,setShowRegistered]=useState(false);
 const registeredIds=useMemo(()=>new Set(rows.map(row=>row.employmentContractId)),[rows]);
 const pendingEmployees=useMemo(()=>employees.filter(employee=>!registeredIds.has(employee.employmentContractId)),[employees,registeredIds]);
 const registeredEmployees=employees.filter(employee=>registeredIds.has(employee.employmentContractId));
 const byContract=useMemo(()=>new Map(rows.map(row=>[row.employmentContractId,row])),[rows]);
 async function punch(employee:Employee,punch:'check_in'|'check_out'){
  try{
   await registerAttendancePunch({tenantId:employee.tenantId,companyId:employee.companyId,employmentContractId:employee.employmentContractId,attendanceDate:date,punch,time:new Date().toTimeString().slice(0,5)});
   const scopes=[...new Map(employees.map(e=>[e.tenantId+':'+e.companyId,{tenantId:e.tenantId,companyId:e.companyId}])).values()];
   onRowsChange(await listAttendanceForDate(scopes,date));
   onFeedback('Ponto registrado com sucesso.');
  }catch(error){onFeedback(error instanceof Error?error.message:'Não foi possível registrar o ponto.');}
 }
 const employeeRow=(employee:Employee)=>{
  const row=byContract.get(employee.employmentContractId);
  return <div className="hr-workspace__employee-row" key={`${employee.companyId}:${employee.employmentContractId}`}>
   <div><strong>{employee.fullName}</strong><span>{employee.companyName} · {employee.jobTitle} · {employee.costCenterName??'Sem obra'}</span></div>
   <div>
    <Select label="Presença" value={row?.status??''} options={attendanceOptions} onChange={event=>{const status=event.target.value as AttendanceStatus;if(status&&status!==row?.status)onChange(employee,status);}}/>
    <div className="hr-workspace__actions">
     <Button size="sm" variant="secondary" disabled={Boolean(row?.checkIn)} onClick={()=>void punch(employee,'check_in')}>{row?.checkIn?`Entrada ${row.checkIn.slice(0,5)}`:'Registrar entrada'}</Button>
     <Button size="sm" variant="secondary" disabled={!row?.checkIn||Boolean(row?.checkOut)} onClick={()=>void punch(employee,'check_out')}>{row?.checkOut?`Saída ${row.checkOut.slice(0,5)}`:'Registrar saída'}</Button>
    </div>
   </div>
  </div>;
 };
 return <div className="hr-workspace__content">
  <Card title="Presença e ponto" actions={<div className="hr-workspace__actions"><Button variant="secondary" onClick={()=>setShowRegistered(true)}>Registrados {rows.length}</Button></div>}>
   <div className="hr-workspace__attendance-controls"><Input label="Data" type="date" value={date} onChange={e=>setDate(e.target.value)}/><Input label="Buscar colaborador" placeholder="Digite o nome" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="hr-workspace__actions"><Button onClick={onAllPresent} disabled={loading||pendingEmployees.length===0}>Marcar todos presentes</Button></div>
   {feedback&&<Feedback title="Presença" message={feedback} tone={feedback.includes('marcado')||feedback.includes('registrado')?'success':'info'}/>} 
  </Card>
  <Card title={`Colaboradores pendentes · ${date.split('-').reverse().join('/')}`}>
   <div className="hr-workspace__list">{loading?<p className="ui-muted">Carregando colaboradores e presença do dia...</p>:pendingEmployees.length===0?<p className="ui-muted">Todos os colaboradores exibidos pelo filtro já possuem registro nesta data.</p>:pendingEmployees.map(employeeRow)}</div>
  </Card>
  <Dialog open={showRegistered} title={`Presenças de ${date.split('-').reverse().join('/')}`} description={`${rows.length} colaborador(es) registrado(s) nesta data`} onClose={()=>setShowRegistered(false)} onBack={()=>setShowRegistered(false)}>
   <div className="hr-workspace__list">{loading?<p className="ui-muted">Carregando presença do dia...</p>:registeredEmployees.length===0?<p className="ui-muted">Nenhum registro de presença encontrado nesta data.</p>:registeredEmployees.map(employeeRow)}</div>
  </Dialog>
 </div>;
}
