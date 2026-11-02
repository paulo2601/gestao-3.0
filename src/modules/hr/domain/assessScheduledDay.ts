/** Apuração preliminar de jornada: nunca altera o ponto original nem a folha. */
export type ScheduleDay = {active:boolean;entry:string;lunchOut:string;lunchIn:string;exit:string};
export type PunchTimes = {entry?:string|null;lunchOut?:string|null;lunchIn?:string|null;exit?:string|null};
export type DayAssessment = {status:'rest'|'incomplete'|'complete';scheduledMinutes:number;workedMinutes:number|null;lateMinutes:number|null;earlyExitMinutes:number|null;extraMinutes:number|null;requiresReview:boolean};
const toMinutes=(time:string):number|null=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;const [h=0,m=0]=time.split(':').map(Number);return h*60+m;};
export function assessScheduledDay(day:ScheduleDay,punches:PunchTimes,toleranceMinutes=5):DayAssessment{
 const scheduled=[day.entry,day.lunchOut,day.lunchIn,day.exit].map(toMinutes);
 const scheduledMinutes=scheduled.every(v=>v!==null)?Math.max(0,(scheduled[1]!-scheduled[0]!)+(scheduled[3]!-scheduled[2]!)):0;
 if(!day.active)return {status:'rest',scheduledMinutes:0,workedMinutes:null,lateMinutes:null,earlyExitMinutes:null,extraMinutes:null,requiresReview:Object.values(punches).some(Boolean)};
 const actual=[punches.entry,punches.lunchOut,punches.lunchIn,punches.exit].map(v=>v?toMinutes(v):null);
 if(scheduled.some(v=>v===null)||actual.some(v=>v===null)||!(actual[0]!<=actual[1]!&&actual[1]!<=actual[2]!&&actual[2]!<=actual[3]!))
 return {status:'incomplete',scheduledMinutes,workedMinutes:null,lateMinutes:null,earlyExitMinutes:null,extraMinutes:null,requiresReview:true};
 const workedMinutes=(actual[1]!-actual[0]!)+(actual[3]!-actual[2]!);
 const lateMinutes=Math.max(0,actual[0]!-scheduled[0]!);
 const earlyExitMinutes=Math.max(0,scheduled[3]!-actual[3]!);
 const extraMinutes=Math.max(0,workedMinutes-scheduledMinutes);
 return {status:'complete',scheduledMinutes,workedMinutes,lateMinutes,earlyExitMinutes,extraMinutes,requiresReview:lateMinutes>toleranceMinutes||earlyExitMinutes>toleranceMinutes||extraMinutes>0};
}
