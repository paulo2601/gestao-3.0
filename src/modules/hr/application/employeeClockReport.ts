import type { ClockEvent, ClockEventType } from '../infrastructure/EmployeeClockService';

export interface DailyClockSummary {
  date: string;
  entry: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  exit: string | null;
  minutesWorked: number | null;
  incomplete: boolean;
  receipts: string[];
}
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
});
const formatDate = (timestamp: string) => formatter.format(new Date(timestamp));
const minutes = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));

/** Consolidates raw server events without generating absences or modifying payroll. */
export function summarizeClockEvents(events: readonly ClockEvent[]): DailyClockSummary[] {
  const grouped = new Map<string, ClockEvent[]>();
  for (const event of events) {
    const date = formatDate(event.occurred_at);
    grouped.set(date, [...(grouped.get(date) ?? []), event]);
  }
  return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, day]) => {
    const byType = new Map<ClockEventType, ClockEvent>();
    for (const event of [...day].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
      if (!byType.has(event.event_type)) byType.set(event.event_type, event);
    }
    const entry = byType.get('entry')?.occurred_at ?? null;
    const lunchOut = byType.get('lunch_out')?.occurred_at ?? null;
    const lunchIn = byType.get('lunch_in')?.occurred_at ?? null;
    const exit = byType.get('exit')?.occurred_at ?? null;
    const complete = Boolean(entry && lunchOut && lunchIn && exit);
    return {
      date, entry, lunchOut, lunchIn, exit,
      minutesWorked: complete ? minutes(entry!, lunchOut!) + minutes(lunchIn!, exit!) : null,
      incomplete: !complete,
      receipts: day.map(event => event.receipt_code)
    };
  });
}
