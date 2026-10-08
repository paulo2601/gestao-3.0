import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import type { PlannedService } from '../infrastructure/MeasurementPlanningRepository';

interface Props {
  plan:PlannedService;
  alreadyExecuted:number;
  onCancel:()=>void;
  onSave:(input:{quantity:number;executionDate:string;unitReference?:string})=>Promise<void>;
}
export function MeasurementExecutionEntryForm({plan,alreadyExecuted,onCancel,onSave}:Props){
  const [quantity,setQuantity]=useState('1');
  const [executionDate,setExecutionDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [unitReference,setUnitReference]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const remaining=Math.max(0,plan.plannedQuantity-alreadyExecuted);
  async function submit(){
    const amount=Number(quantity.replace(',','.'));
    if(!Number.isFinite(amount)||amount<=0||amount>remaining){
      setError('Informe uma quantidade maior que zero e até o saldo da meta.');return;
    }
    if(!executionDate){setError('Informe a data da execução.');return;}
    setSaving(true);setError(null);
    try{await onSave({quantity:amount,executionDate,unitReference:unitReference.trim()||undefined});}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível registrar a execução.');}
    finally{setSaving(false);}
  }
  return <section className="measurement-execution-entry">
    <header><strong>Registrar execução</strong><small>Saldo da meta: {remaining.toLocaleString('pt-BR')}</small></header>
    <label>Quantidade executada<input type="text" inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)} /></label>
    <label>Data da execução<input type="date" value={executionDate} onChange={event=>setExecutionDate(event.target.value)} /></label>
    <label>Apartamento/unidade (opcional)<input type="text" value={unitReference} onChange={event=>setUnitReference(event.target.value)} placeholder="Ex.: 101" /></label>
    {error&&<p role="alert">{error}</p>}
    <footer><Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button><Button onClick={()=>void submit()} disabled={saving||remaining<=0}>{saving?'Salvando…':'Confirmar execução'}</Button></footer>
  </section>;
}
