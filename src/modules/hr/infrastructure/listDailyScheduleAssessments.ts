import {assessEmployeePunches} from '../domain/assessEmployeePunches';
import type {DayAssessment} from '../domain/assessScheduledDay';
import {listClockReportEvents,listClockAdjustments,listClockCancellations,listWorkSchedulesForPeriod} from './HrWorkspaceService';
export type DailyScheduleAssessment={contractId:string;date:string;result:DayAssessment};
type Kind='entry'|'lunch_out'|'lunch_in'|'exit';
/** Consulta os registros reais e correções autorizadas, sem gravar descontos. */
export async function listDailyScheduleAssessments(contractIds:string[],start:string,end:string):Promise<DailyScheduleAssessment[]>{
 if(!contractIds.length)return [];
 const [events,adjustments,cancellations,versions]=await Promise.all([
  listClockReportEvents(contractIds,start,end),listClockAdjustments(contractIds,start,end),
  listClockCancellations(contractIds,start,end),listWorkSchedulesForPeriod(contractIds,start,end)
 ]);
 const records=new Map<string,Partial<Record<Kind,string>>>();
 for(const event of events){
  const local=new Date(event.captured_at).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',hour12:false});
  const date=local.slice(0,10);if(date<start||date>end)continue;
  const key=event.employment_contract_id+'|'+date;
  const punches=records.get(key)??{};punches[event.punch_kind as Kind]=local.slice(11,16);records.set(key,punches);
 }
 for(const correction of adjustments){
  const key=correction.employment_contract_id+'|'+correction.attendance_date;
  const punches=records.get(key)??{};punches[correction.punch_kind]=correction.corrected_time.slice(0,5);records.set(key,punches);
 }
 for(const cancellation of cancellations){
  const key=cancellation.employment_contract_id+'|'+cancellation.attendance_date;
  const punches=records.get(key)??{};
  if(cancellation.punch_kind==='all')records.set(key,{});
  else {delete punches[cancellation.punch_kind];records.set(key,punches);}
 }
 const result:DailyScheduleAssessment[]=[];
 for(const [key,punches] of records){
  const separator=key.lastIndexOf('|'),contractId=key.slice(0,separator),date=key.slice(separator+1);
  // Dia integralmente cancelado não é ponto incompleto: não existem marcações válidas a apurar.
  if(!Object.values(punches).some(Boolean))continue;
  const assessment=assessEmployeePunches(versions,contractId,date,punches);
  if(assessment)result.push({contractId,date,result:assessment});
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.contractId.localeCompare(b.contractId));
}
