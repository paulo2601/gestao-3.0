import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type ClockEventType = 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
export interface ClockReceipt {
  event_id: string;
  event_type: ClockEventType;
  recorded_at: string;
  receipt_code: string;
}
export interface ClockEvent {
  id: string;
  event_type: ClockEventType;
  occurred_at: string;
  receipt_code: string;
}
export const CLOCK_LABELS: Record<ClockEventType, string> = {
  entry: 'Entrada', lunch_out: 'Saída para almoço',
  lunch_in: 'Retorno do almoço', exit: 'Saída'
};
export const CLOCK_SEQUENCE: ClockEventType[] = ['entry', 'lunch_out', 'lunch_in', 'exit'];

export async function registerClockPosition(position: GeolocationPosition): Promise<ClockReceipt> {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, accuracy].every(Number.isFinite)) throw new Error('Localização inválida.');
  const response = await getSupabaseClient().rpc('employee_clock_register', {
    p_latitude: latitude, p_longitude: longitude, p_accuracy_m: accuracy
  });
  if (response.error) throw new Error(response.error.message);
  const receipt = (response.data as ClockReceipt[] | null)?.[0];
  if (!receipt?.event_id || !receipt.receipt_code) throw new Error('O servidor não confirmou a marcação.');
  return receipt;
}
export async function loadOwnClockEvents(): Promise<ClockEvent[]> {
  const { data: auth, error: authError } = await getSupabaseClient().auth.getUser();
  if (authError || !auth.user) throw new Error('Faça login para consultar seu ponto.');
  const { data, error } = await getSupabaseClient()
    .from('employee_clock_events')
    .select('id,event_type,occurred_at,receipt_code')
    .eq('user_id', auth.user.id)
    .order('occurred_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClockEvent[];
}
export function requestClockPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) return Promise.reject(new Error('Seu aparelho não permite acessar o GPS.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, error => {
      reject(new Error(error.code === 1 ? 'Autorize a localização para registrar o ponto.' : 'Não foi possível obter sua localização. Tente novamente em local aberto.'));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}
