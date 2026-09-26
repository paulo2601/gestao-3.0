import { useMemo,useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { createManualProductionService,saveEngineeringProductionPrice,type ProductionServiceKind } from '../infrastructure/EngineeringProductionPriceRepository';

interface Props{open:boolean;scope:{tenantId:string;companyId:string};snapshot:EngineeringProductionSnapshot;onClose:()=>void;onSaved:()=>void;}
const cents=(digits:string)=>Number(digits||'0')/100;
const money=(digits:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents(digits));

export function EngineeringProductionPriceDialog({open,scope,snapshot,onClose,onSaved}:Props){
 const[type,setType]=useState<ProductionServiceKind>('linked');const[structureId,setStructureId]=useState('');const[serviceId,setServiceId]=useState('');const[name,setName]=useState('');const[unit,setUnit]=useState('');const[valueDigits,setValueDigits]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null);
 const structureOptions=[{value:'',label:type==='linked'?'Selecione…':'Sem vínculo com estrutura'},...snapshot.structures.map(s=>({value:s.id,label:s.name}))];
 const services=useMemo(()=>{const allowed=new Set(snapshot.serviceIdsByStructure[structureId]??[]);return snapshot.services.filter(s=>allowed.has(s.id));},[snapshot.services,snapshot.serviceIdsByStructure,structureId]);
 const serviceOptions=[{value:'',label:structureId?(services.length?'Selecione…':'Nenhum serviço nesta estrutura'):'Selecione a estrutura primeiro'},...services.map(s=>({value:s.id,label:`${s.name}${s.unit?` · ${s.unit}`:''}`}))];
 const existing=type==='linked'&&serviceId?snapshot.productionPrices.find(p=>p.structureId===structureId&&p.contractServiceId===serviceId):undefined;
 function changeType(next:ProductionServiceKind){setType(next);setStructureId('');setServiceId('');setName('');setUnit('');setValueDigits('');setError(null);}
 function changeStructure(id:string){setStructureId(id);setServiceId('');setValueDigits('');setError(null);}
 function changeService(id:string){setServiceId(id);const found=snapshot.productionPrices.find(p=>p.structureId===structureId&&p.contractServiceId===id);setValueDigits(found?String(Math.round(found.unitValue*100)):'');setError(null);}
 async function submit(){const unitValue=cents(valueDigits);if(type==='linked'&&(!structureId||!serviceId)){setError('Selecione a estrutura e o serviço.');return;}if(type!=='linked'&&!name.trim()){setError(type==='discount'?'Informe o nome do desconto.':'Informe o nome do serviço manual.');return;}if(unitValue<0){setError('Informe um valor válido.');return;}setBusy(true);setError(null);try{if(type==='linked')await saveEngineeringProductionPrice({...scope,workId:snapshot.workId,contractServiceId:serviceId,structureId,unitValue});else await createManualProductionService({...scope,workId:snapshot.workId,name,unit:unit||null,kind:type,structureId:structureId||null,unitValue});onSaved();setServiceId('');setName('');setUnit('');setValueDigits('');}catch(c){setError(c instanceof Error?c.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 return <Dialog open={open} title="Cadastrar valores de produção" description="Cadastre valores vinculados ao contrato, serviços manuais ou descontos." onClose={onClose} onBack={onClose} onConfirm={()=>void submit()} confirmLabel={existing?'Atualizar valor':'Salvar'} loading={busy}>
  <div className="engineering-production-entry-form">
   {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>}
   <div className="engineering-production-entry-form__grid">
    <Select label="Tipo" value={type} onChange={e=>changeType(e.target.value as ProductionServiceKind)} options={[{value:'linked',label:'Serviço do contrato'},{value:'manual',label:'Serviço manual'},{value:'discount',label:'Desconto'}]}/>
    <Select label={type==='linked'?'Torre / Estrutura':'Torre / Estrutura (opcional)'} value={structureId} onChange={e=>changeStructure(e.target.value)} options={structureOptions} required={type==='linked'}/>
    {type==='linked'?<Select label="Serviço" value={serviceId} onChange={e=>changeService(e.target.value)} options={serviceOptions} disabled={!structureId||services.length===0} required/>:<Input label={type==='discount'?'Descrição do desconto':'Nome do serviço'} value={name} onChange={e=>setName(e.target.value)} required/>}
    {type==='manual'&&<Input label="Unidade (opcional)" value={unit} onChange={e=>setUnit(e.target.value)} placeholder="APTO, UN, M²..."/>}
    <Input label="Valor unitário de produção" inputMode="numeric" value={money(valueDigits)} onChange={e=>setValueDigits(e.target.value.replace(/\D/g,''))} required/>
   </div>
   {structureId&&type==='linked'&&<section><h3>Valores cadastrados nesta estrutura</h3>{snapshot.productionPrices.filter(p=>p.structureId===structureId).length===0?<p className="ui-muted">Nenhum valor de produção cadastrado.</p>:snapshot.productionPrices.filter(p=>p.structureId===structureId).map(p=>{const s=snapshot.services.find(x=>x.contractServiceId===p.contractServiceId);return <div key={p.contractServiceId} className="engineering-production-entry-form__participant"><strong>{s?.name??'Serviço'}</strong><span>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.unitValue)}</span><Button size="sm" variant="tertiary" onClick={()=>p.contractServiceId&&changeService(p.contractServiceId)}>Editar</Button></div>})}</section>}
  </div>
 </Dialog>;
}
