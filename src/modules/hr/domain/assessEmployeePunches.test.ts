import {describe,it,expect} from 'vitest';
import {weekdayIndex,assessEmployeePunches} from './assessEmployeePunches';
import type {WorkScheduleVersion} from '../infrastructure/HrWorkspaceService';
const weekday:import('./assessScheduledDay').ScheduleDay={active:true,entry:'07:00',lunchOut:'12:00',lunchIn:'13:00',exit:'17:00'};
const versions:WorkScheduleVersion[]=[
 {employment_contract_id:'c',effective_on:'2026-01-01',weekdays:Array.from({length:7},()=>({...weekday})),tolerance_minutes:5,review_required:true},
 {employment_contract_id:'c',effective_on:'2026-11-02',weekdays:Array.from({length:7},()=>({...weekday,entry:'08:00'})),tolerance_minutes:5,review_required:true}
];
describe('integração de escala e ponto',()=>{
 it('respeita segunda-feira e domingo',()=>{expect(weekdayIndex('2026-11-02')).toBe(0);expect(weekdayIndex('2026-11-01')).toBe(6)});
 it('seleciona a escala vigente na data',()=>{expect(assessEmployeePunches(versions,'c','2026-11-01',{entry:'07:00',lunch_out:'12:00',lunch_in:'13:00',exit:'17:00'})?.lateMinutes).toBe(0);expect(assessEmployeePunches(versions,'c','2026-11-02',{entry:'07:00',lunch_out:'12:00',lunch_in:'13:00',exit:'17:00'})?.scheduledMinutes).toBe(480)});
 it('não inventa apuração sem escala cadastrada',()=>{expect(assessEmployeePunches(versions,'outro','2026-11-02',{})).toBeNull()});
});
