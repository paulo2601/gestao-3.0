import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import type { MeasurementParityOrigin } from '../infrastructure/LegacyMeasurementParityRepository';

interface Props {
  origin:MeasurementParityOrigin;
  onCancel:()=>void;
  onSave:(input:{targetKind:'contract'|'addendum';targetId:string;quantity:number})=>Promise<void>;
}
export function MeasurementPlanForm({origin,onCancel,onSave}:Props){
  const [target,setTarget]=useState('');
  const [quantity,setQuantity]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function submit(){
    const stage=origin.services.find(service=>service.targetKind+':'+service.targetId===target);
    const parsed=Number(quantity.replace(',','.'));
    if(!stage){setError('Selecione um serviço.');return;}
    if(!Number.isFinite(parsed)||parsed<=0){setError('Informe uma quantidade válida.');return;}
    if(stage.targetKind!=='contract'&&stage.targetKind!=='addendum'){setError('Tipo de serviço não suportado.');return;}
    setSaving(true);setError(null);
    try{await onSave({targetKind:stage.targetKind,targetId:stage.targetId,quantity:parsed});}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar a meta.');}
    finally{setSaving(false);}
  }
  return <section className="measurement-execution-entry">
    <header><strong>Planejar serviço</strong><small>{origin.name}</small></header>
    <label>Serviço<select value={target} onChange={event=>setTarget(event.target.value)}>
      <option value="">Selecione</option>
      {origin.services.map(service=><option key={service.targetKind+':'+service.targetId} value={service.targetKind+':'+service.targetId}>{service.description}</option>)}
    </select></label>
    <label>Quantidade planejada<input type="text" inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)} placeholder="Ex.: 8" /></label>
    {error&&<p role="alert">{error}</p>}
    <footer><Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button><Button onClick={()=>void submit()} disabled={saving}>{saving?'Salvando…':'Salvar planejamento'}</Button></footer>
  </section>;
}
