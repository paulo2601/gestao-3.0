import {describe,expect,it} from 'vitest';
import {assessScheduledDay,type ScheduleDay} from './assessScheduledDay';
const day:ScheduleDay={active:true,entry:'07:00',lunchOut:'12:00',lunchIn:'13:00',exit:'17:00'};
describe('apuração preliminar de jornada',()=>{
 it('calcula 9 horas para 07-12 e 13-17',()=>{expect(assessScheduledDay(day,{entry:'07:00',lunchOut:'12:00',lunchIn:'13:00',exit:'17:00'})).toMatchObject({status:'complete',workedMinutes:540,scheduledMinutes:540,lateMinutes:0,requiresReview:false})});
 it('sinaliza atraso sem descontar automaticamente',()=>{expect(assessScheduledDay(day,{entry:'07:12',lunchOut:'12:00',lunchIn:'13:00',exit:'17:00'})).toMatchObject({lateMinutes:12,requiresReview:true})});
 it('não calcula jornada incompleta como ausência',()=>{expect(assessScheduledDay(day,{entry:'07:00'})).toMatchObject({status:'incomplete',workedMinutes:null,requiresReview:true})});
 it('identifica marcação em dia de folga',()=>{expect(assessScheduledDay({...day,active:false},{entry:'07:00'})).toMatchObject({status:'rest',requiresReview:true})});
 it('contabiliza atraso no retorno do almoço',()=>{expect(assessScheduledDay(day,{entry:'07:00',lunchOut:'12:00',lunchIn:'13:12',exit:'17:00'})).toMatchObject({lateMinutes:12,workedMinutes:528,requiresReview:true})});
 it('contabiliza saída antecipada para o almoço',()=>{expect(assessScheduledDay(day,{entry:'07:00',lunchOut:'11:50',lunchIn:'13:00',exit:'17:00'})).toMatchObject({earlyExitMinutes:10,workedMinutes:530,requiresReview:true})});
 it('preserva tempo excedente mesmo quando compensado por atraso',()=>{expect(assessScheduledDay(day,{entry:'07:15',lunchOut:'12:00',lunchIn:'13:00',exit:'17:15'})).toMatchObject({workedMinutes:540,lateMinutes:15,extraMinutes:15,requiresReview:true})});

});
