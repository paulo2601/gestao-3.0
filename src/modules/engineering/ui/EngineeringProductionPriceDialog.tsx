import { useMemo,useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { saveEngineeringProductionPrice } from '../infrastructure/EngineeringProductionPriceRepository';

interface Props{open:boolean;scope:{tenantId:string;companyId:string};snapshot:EngineeringProductionSnapshot;onClose:()=>void;onSaved:()=>void;}
const numberValue=(v:string)=>{const n=Number(v.replace(',','.'));return Number.isFinite(n)?n:NaN;};

export function EngineeringProductionPriceDialog({open,scope,snapshot,onClose,onSaved}:Props){
 const [structureId,setStructureId]=useState('');const[serviceId,setServiceId]=useState('');const[value,setValue]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);
 const structureOptions=[{value:'',label:'Selecione…'},...snapshot.structures.map(s=>({value:s.id,label:s.name}))];
 const allowed=new Set(snapshot.serviceIdsByStructure[structureId]??[]);
 const services=useMemo(()=>snapshot.services.filter(s=>allowed.has(s.id)),[snapshot.services,structureId]);
 const serviceOptions=[{value:'',label:structureId?(services.length?'Selecione…':'Nenhum serviço nesta estrutura'):'Selecione a estrutura primeiro'},...services.map(s=>({value:s.id,label:`${s.name}${s.unit?` · ${s.unit}`:''}`}))];
 const existing=serviceId?snapshot.productionPrices.find(p=>p.structureId===structureId&&p.contractServiceId===serviceId):undefined;
 function changeStructure(id:string){setStructureId(id);setServiceId('');setValue('');setError(null);}
 function changeService(id:string){setServiceId(id);const found=snapshot.productionPrices.find(p=>p.structureId===structureId&&p.contractServiceId===id);setValue(found?String(found.unitValue):'');setError(null);}
 async function submit(){const unitValue=numberValue(value);if(!structureId||!serviceId){setError('Selecione a estrutura e o serviço.');return;}if(!Number.isFinite(unitValue)||unitValue<0){setError('Informe um valor de produção válido.');return;}setBusy(true);setError(null);try{await saveEngineeringProductionPrice({...scope,workId:snapshot.workId,contractServiceId:serviceId,structureId,unitValue});onSaved();setServiceId('');setValue('');}catch(c){setError(c instanceof Error?c.message:'Não foi possível salvar o valor.');}finally{setBusy(false);}}
 return <Dialog open={open} title="Cadastrar valores de produção" description="Use a estrutura e os serviços do contrato e informe somente o valor que será pago na Produção." onClose={onClose} onBack={onClose} onConfirm={()=>void submit()} confirmLabel={existing?'Atualizar valor':'Salvar valor'} loading={busy}>
  <div className="engineering-production-entry-form">
   {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>}
   <div className="engineering-production-entry-form__grid">
    <Select label="Torre / Estrutura" value={structureId} onChange={e=>changeStructure(e.target.value)} options={structureOptions} required/>
    <Select label="Serviço" value={serviceId} onChange={e=>changeService(e.target.value)} options={serviceOptions} disabled={!structureId||services.length===0} required/>
    <Input label="Valor unitário de produção (R$)" type="number" value={value} onChange={e=>setValue(e.target.value)} required/>
   </div>
   {structureId&&<section><h3>Valores cadastrados nesta estrutura</h3>{snapshot.productionPrices.filter(p=>p.structureId===structureId).length===0?<p className="ui-muted">Nenhum valor de produção cadastrado.</p>:snapshot.productionPrices.filter(p=>p.structureId===structureId).map(p=>{const s=snapshot.services.find(x=>x.contractServiceId===p.contractServiceId);return <div key={p.contractServiceId} className="engineering-production-entry-form__participant"><strong>{s?.name??'Serviço'}</strong><span>R$ {p.unitValue.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span><Button size="sm" variant="tertiary" onClick={()=>changeService(p.contractServiceId)}>Editar</Button></div>})}</section>}
  </div>
 </Dialog>;
}
