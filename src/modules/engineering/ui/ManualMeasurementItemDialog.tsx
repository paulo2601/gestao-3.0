import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { addManualMeasurementItem, updateManualMeasurementItem } from '../infrastructure/ManualMeasurementItemRepository';

interface Props { open:boolean; scope:{tenantId:string;companyId:string}; measurementId:string; item?:{id:string;description:string;unit:string;quantity:number;unitPrice:number;notes?:string|null}|null; onSaved:()=>Promise<void>|void; onClose:()=>void; }
const money=(value:string)=>Number(value.replace(/\./g,'').replace(',','.'))||0;
const brl=(value:string)=>{const digits=value.replace(/\D/g,'');return (Number(digits||'0')/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};

export function ManualMeasurementItemDialog({open,scope,measurementId,item,onSaved,onClose}:Props){
  const [description,setDescription]=useState(item?.description??''); const [unit,setUnit]=useState(item?.unit??'UN'); const [quantity,setQuantity]=useState(item?String(item.quantity):'1'); const [unitPrice,setUnitPrice]=useState(item?item.unitPrice.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''); const [notes,setNotes]=useState(item?.notes?.replace(/^\[ITEM AVULSO\]\s*/,'')??''); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  const total=(Number(quantity.replace(',','.'))||0)*money(unitPrice);
  async function save(){
    const qty=Number(quantity.replace(',','.'))||0; const price=money(unitPrice);
    if(!description.trim()){setError('Informe a descrição do serviço.');return;} if(!unit.trim()){setError('Informe a unidade.');return;} if(qty<=0){setError('Informe uma quantidade maior que zero.');return;} if(price<0){setError('Informe um valor unitário válido.');return;}
    setSaving(true);setError(null);
    try{
      if(item)await updateManualMeasurementItem(scope,item.id,{description,unit,quantity:qty,unitPrice:price,notes});else await addManualMeasurementItem(scope,measurementId,{description,unit,quantity:qty,unitPrice:price,notes}); await onSaved(); onClose();
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível adicionar o item avulso.');}finally{setSaving(false);}
  }
  return <Dialog open={open} onClose={onClose} title={item?"Editar item avulso":"Adicionar item avulso"}><div className="form-grid">
    {error&&<Feedback tone="danger" title="Não foi possível adicionar" message={error}/>}
    <Input label="Descrição do serviço" value={description} onChange={event=>setDescription(event.target.value)} placeholder="Serviço não cadastrado no contrato"/>
    <Input label="Unidade" value={unit} onChange={event=>setUnit(event.target.value)} placeholder="UN"/>
    <Input label="Quantidade" value={quantity} onChange={event=>setQuantity(event.target.value)} inputMode="decimal"/>
    <Input label="Valor unitário" value={unitPrice} onChange={event=>setUnitPrice(brl(event.target.value))} inputMode="decimal" placeholder="0,00"/>
    <Input label="Observação" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Opcional"/>
    <div><strong>Total: {total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong><p>Item avulso desta medição. Não altera o saldo do contrato.</p></div>
    <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={()=>void save()} disabled={saving}>{saving?'Salvando…':item?'Salvar correção':'Adicionar à medição'}</Button></div>
  </div></Dialog>;
}