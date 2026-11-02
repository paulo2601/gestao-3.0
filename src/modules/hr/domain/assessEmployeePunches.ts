import {assessScheduledDay,type DayAssessment,type PunchTimes} from './assessScheduledDay';
import type {WorkScheduleVersion} from '../infrastructure/HrWorkspaceService';
type PunchKind='entry'|'lunch_out'|'lunch_in'|'exit';
/** Convert a YYYY-MM-DD to a Monday-first weekday index, independently of browser timezone. */
export function weekdayIndex(date:string):number{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Data inválida');
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 return (weekday+6)%7;
}
export function assessEmployeePunches(
 versions:WorkScheduleVersion[],contractId:string,date:string,punches:Partial<Record<PunchKind,string>>
):DayAssessment|null{
 const applicable=versions.filter(v=>v.employment_contract_id===contractId&&v.effective_on<=date)
  .sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0];
 if(!applicable)return null;
 const day=applicable.weekdays[weekdayIndex(date)];
 if(!day)return null;
 const normalized:PunchTimes={entry:punches.entry??null,lunchOut:punches.lunch_out??null,lunchIn:punches.lunch_in??null,exit:punches.exit??null};
 return assessScheduledDay(day,normalized,applicable.tolerance_minutes);
}
