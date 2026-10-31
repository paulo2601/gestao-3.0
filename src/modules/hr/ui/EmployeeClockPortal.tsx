import './employee-clock-portal.css';
import { useCallback, useEffect, useState } from 'react';
import { CLOCK_LABELS, CLOCK_SEQUENCE, loadOwnClockEvents, registerClockPosition, requestClockPosition, type ClockEvent } from '../infrastructure/EmployeeClockService';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

const saoPauloDate = (value: string) => { const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)); const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''; return [get('year'), get('month'), get('day')].join('-'); };
const timeLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));

export function EmployeeClockPortal() {
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setEvents(await loadOwnClockEvents()); setError(''); }
    catch (cause) { setEvents([]); setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os registros.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const today = saoPauloDate(new Date().toISOString());
  const marks = events.filter(item => saoPauloDate(item.occurred_at) === today).reverse();
  const validSequence = marks.length <= 4 && marks.every((mark, index) => mark.event_type === CLOCK_SEQUENCE[index]);
  const next = validSequence ? CLOCK_SEQUENCE[marks.length] : undefined;
  const register = async () => {
    if (!next || busy || loading || error) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const position = await requestClockPosition();
      const receipt = await registerClockPosition(position);
      setMessage(`Ponto registrado: ${CLOCK_LABELS[receipt.event_type]} às ${timeLabel(receipt.recorded_at)}. Comprovante: ${receipt.receipt_code}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o ponto.');
    } finally { setBusy(false); }
  };
  return <main className="employee-clock-portal">
    <header className="employee-clock-portal__header">
      <div><small>GESTÃO 3.0</small><h1>Meu ponto</h1></div>
      <button type="button" onClick={() => void getSupabaseClient().auth.signOut()}>Sair</button>
    </header>
    <section className="employee-clock-portal__panel" aria-label="Marcações do dia">
      <h2>Marcações de hoje</h2>
      <p>Horários oficiais registrados pelo servidor. O GPS é solicitado apenas ao marcar o ponto.</p>
      <ol>{CLOCK_SEQUENCE.map(kind => <li key={kind}>
        <span>{CLOCK_LABELS[kind]}</span>
        <strong>{marks.find(mark => mark.event_type === kind) ? timeLabel(marks.find(mark => mark.event_type === kind)!.occurred_at) : '—'}</strong>
      </li>)}</ol>
      {!validSequence && <p role="alert">Há inconsistência nas marcações de hoje. Solicite revisão ao RH.</p>}
      <button type="button" disabled={!next || busy || loading || Boolean(error)} onClick={() => void register()}>
        {busy ? 'Validando GPS e registrando...' : next ? `Registrar ${CLOCK_LABELS[next].toLowerCase()}` : 'Jornada registrada'}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => void refresh()} disabled={busy || loading}>Atualizar registros</button>
    </section>
    <section className="employee-clock-portal__panel">
      <h2>Meus comprovantes</h2>
      <ul>{events.slice(0, 20).map(item => <li key={item.id}>
        {CLOCK_LABELS[item.event_type]} — {new Date(item.occurred_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        <small> Código: {item.receipt_code}</small>
      </li>)}</ul>
    </section>
  </main>;
}
