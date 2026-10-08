import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import type { PlannedService } from '../infrastructure/MeasurementPlanningRepository';

interface Props {
  plan: PlannedService;
  alreadyExecuted: number;
  usedUnits?: string[];
  availableUnits?: string[];
  onCancel: () => void;
  onSave: (input: { quantity: number; executionDate: string; unitReference?: string }) => Promise<void>;
}

export function MeasurementExecutionEntryForm({
  plan, alreadyExecuted, usedUnits = [], availableUnits = [], onCancel, onSave
}: Props) {
  const [quantity, setQuantity] = useState('1');
  const [executionDate, setExecutionDate] = useState(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  });
  const [unitReference, setUnitReference] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, plan.plannedQuantity - alreadyExecuted);
  const selectableUnits = availableUnits.filter(unit => !usedUnits.includes(unit));
  const usesUnitPicker = availableUnits.length > 0;

  async function submit() {
    const amount = usesUnitPicker ? 1 : Number(quantity.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      setError('Quantidade maior que o saldo da meta.'); return;
    }
    if (usesUnitPicker && !selectedUnit) {
      setError('Selecione um apartamento.'); return;
    }
    if (!executionDate) {
      setError('Informe a data de execução.'); return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        quantity: amount,
        executionDate,
        unitReference: usesUnitPicker ? selectedUnit : unitReference.trim() || undefined
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a execução.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="measurement-execution-entry">
    <header><strong>Registrar execução</strong><small>Saldo: {remaining.toLocaleString('pt-BR')}</small></header>
    {usesUnitPicker ? <fieldset className="measurement-execution-unit-picker">
      <legend>Selecione um apartamento</legend>
      <div>{availableUnits.map(unit => {
        const used = usedUnits.includes(unit);
        return <button key={unit} type="button" disabled={used || saving}
          aria-pressed={selectedUnit === unit} onClick={() => setSelectedUnit(unit)}>
          {unit}{used ? ' ✓' : ''}
        </button>;
      })}</div>
      {selectableUnits.length === 0 && <small>Todos os apartamentos disponíveis já foram registrados.</small>}
    </fieldset> : <>
      <label>Quantidade executada<input type="text" inputMode="decimal" value={quantity}
        onChange={event => setQuantity(event.target.value)} /></label>
      <label>Apartamento/unidade (opcional)<input type="text" value={unitReference}
        onChange={event => setUnitReference(event.target.value)} placeholder="Ex.: 101" /></label>
    </>}
    <label>Data da execução<input type="date" value={executionDate}
      onChange={event => setExecutionDate(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <footer><Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
      <Button onClick={() => void submit()} disabled={saving || remaining <= 0}>
        {saving ? 'Salvando…' : 'Confirmar execução'}
      </Button></footer>
  </section>;
}
