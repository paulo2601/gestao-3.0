import type { HrComplianceRecord } from '../infrastructure/HrWorkspaceService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';

type EmployeeRef={employmentContractId:string;fullName:string};
export function HrComplianceSection({loading,records,employees,feedback,onNew}:{loading:boolean;records:HrComplianceRecord[];employees:EmployeeRef[];feedback:string|null;onNew:(kind:'aso'|'nr'|'vacation')=>void}){
 return <div className="hr-workspace__content"><Card title="Saúde, segurança e férias"><div className="hr-workspace__segment"><Button variant="secondary" onClick={()=>onNew('aso')}>＋ ASO</Button><Button variant="secondary" onClick={()=>onNew('nr')}>＋ NR / treinamento</Button><Button variant="secondary" onClick={()=>onNew('vacation')}>＋ Férias</Button></div>{feedback&&<Feedback title="Compliance RH" message={feedback} tone={feedback.includes('sucesso')?'success':'danger'}/>} {loading?<p className="ui-muted">Carregando registros...</p>:records.length===0?<div className="hr-workspace__empty">Nenhum registro nesta área.</div>:<div className="hr-workspace__list">{records.map(row=>{const employee=employees.find(item=>item.employmentContractId===row.employmentContractId);return <div className="hr-workspace__employee-row" key={row.id}><div className="hr-workspace__employee-main"><div><strong>{row.title}</strong><span>{employee?.fullName??'Colaborador'} · {row.kind==='vacation'?'Férias':row.kind==='aso'?'ASO':'NR / treinamento'}</span></div><div><strong>{row.startsOn?.split('-').reverse().join('/')??'—'}</strong><span>{row.endsOn?`até ${row.endsOn.split('-').reverse().join('/')}`:row.expiresOn?`vence ${row.expiresOn.split('-').reverse().join('/')}`:'Sem vencimento'}</span></div></div></div>})}</div>}</Card></div>;
}

