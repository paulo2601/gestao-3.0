import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { ClockEventType } from './EmployeeClockService';

export interface ClockMonthlyEvent {
  employment_contract_id: string;
  event_type: ClockEventType;
  occurred_at: string;
  receipt_code: string;
}
export interface ClockDayMarks {
  entry?: string;
  lunch_out?: string;
  lunch_in?: string;
  exit?: string;
}
const localParts = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const get = (kind: string) => parts.find(part => part.type === kind)?.value ?? '';
  return { date: [get('year'), get('month'), get('day')].join('-'), time: [get('hour'), get('minute')].join(':') };
};
export async function loadClockMonthlyMarks(companyIds: string[], start: string, end: string): Promise<Map<string, ClockDayMarks>> {
  const uniqueIds = [...new Set(companyIds)];
  const result = new Map<string, ClockDayMarks>();
  for (const companyId of uniqueIds) {
    const { data, error } = await getSupabaseClient().rpc('employee_clock_monthly_report', {
      p_company_id: companyId, p_start: start, p_end: end
    });
    if (error) throw new Error('Não foi possível consultar as marcações GPS: ' + error.message);
    for (const event of (data ?? []) as ClockMonthlyEvent[]) {
      if (!['entry', 'lunch_out', 'lunch_in', 'exit'].includes(event.event_type)) continue;
      const local = localParts(event.occurred_at);
      const key = event.employment_contract_id + ':' + local.date;
      const marks = result.get(key) ?? {};
      marks[event.event_type] = local.time;
      result.set(key, marks);
    }
  }
  return result;
}
