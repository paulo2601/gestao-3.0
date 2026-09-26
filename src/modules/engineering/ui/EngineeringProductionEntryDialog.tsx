import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { SearchableSelect } from '../../../shared/ui/SearchableSelect';
import { Select } from '../../../shared/ui/Select';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { createSharedProductionEntry, type SharedProductionParticipantInput } from '../infrastructure/EngineeringProductionWriteRepository';
import { resolveEngineeringProductionPrice } from '../infrastructure/EngineeringProductionPriceRepository';
import './engineering-production-entry-dialog.css';

type DivisionMode='equal'|'percentage'|'value';
interface ParticipantDraft { id:string; name:string; percentage:string; value:string; }
interface Props {
  open:boolean;
  scope:{tenantId:string;companyId:string};
  snapshot:EngineeringProductionSnapshot;
  onClose:()=>void;
  onSaved:()=>void;
}
const today=()=>new Date().toISOString().slice(0,10);
const numberValue=(value:string)=>{const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?parsed:0;};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function EngineeringProductionEntryDialog({open,scope,snapshot,onClose,onSaved}:Props){
  const [periodId,setPeriodId]=useState('');
  const [structureId,setStructureId]=useState('');
  const [serviceId,setServiceId]=useState('');
  const [productionDate,setProductionDate]=useState(today());
  const [executedQuantity,setExecutedQuantity]=useState('');
  const [unitValue,setUnitValue]=useState('');
  const [notes,setNotes]=useState('');
  const [divisionMode,setDivisionMode]=useState<DivisionMode>('equal');
  const [participants,setParticipants]=useState<ParticipantDraft[]>([]);
  const [employeeSearch,setEmployeeSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const total=numberValue(executedQuantity)*numberValue(unitValue);
  const openPeriods=snapshot.periods.filter(item=>item.status==='open');
  const availableEmployees=useMemo(()=>snapshot.employees.filter(item=>!participants.some(p=>p.id===item.id)).map(item=>({value:item.id,label:item.name})),[snapshot.employees,participants]);
  const periodOptions=[{value:'',label:'Selecione…'},...openPeriods.map(item=>({value:item.id,label:item.competence.slice(0,7).split('-').reverse().join('/')}))];
  const generalServices=snapshot.productionPrices.filter(item=>item.structureId===null&&item.productionServiceId&&item.productionServiceKind!=='linked');
  const structureOptions=[{value:'',label:'Selecione…'},...(generalServices.length?[{value:'__GENERAL__',label:'SEM ESTRUTURA / SERVIÇOS GERAIS'}]:[]),...snapshot.structures.map(item=>({value:item.id,label:item.name}))];
  const allowedServiceIds=new Set(snapshot.serviceIdsByStructure[structureId]??[]);
  const pricedContractServiceIds=new Set(snapshot.productionPrices.filter(item=>item.structureId===structureId).map(item=>item.contractServiceId));
  const allowedServices=snapshot.services.filter(item=>allowedServiceIds.has(item.id)&&pricedContractServiceIds.has(item.contractServiceId));
  const isGeneral=structureId==='__GENERAL__';
  const selectedService=allowedServices.find(item=>item.id===serviceId);
  const floors=snapshot.structureNodes.filter(item=>item.parentId===structureId&&item.structureType==='floor');
  const units=snapshot.structureNodes.filter(item=>item.parentId===floorId&&item.structureType==='unit');
  const serviceOptions=[{value:'',label:structureId?((isGeneral?generalServices.length:allowedServices.length)?'Selecione…':'Nenhum serviço com valor de produção cadastrado nesta estrutura'):'Selecione a estrutura primeiro'},...(isGeneral?generalServices.map(item=>({value:`general:${item.productionServiceId}`,label:`${item.productionServiceKind==='discount'?'Desconto · ':''}${item.productionServiceName??'Serviço manual'}${item.unit?` · ${item.unit}`:''}`})):allowedServices.map(item=>({value:item.id,label:`${item.name}${item.unit?` · ${item.unit}`:''}`})))];
  function changeStructure(id:string){setStructureId(id);setFloorId('');setUnitIds([]);setServiceId('');setUnitValue('');}
  async function changeService(id:string){setServiceId(id);setUnitValue('');if(!id||!structureId)return;if(structureId==='__GENERAL__'){const price=generalServices.find(item=>`general:${item.productionServiceId}`===id);setUnitValue(price?String(price.unitValue):'');setError(price?null:'Serviço geral sem valor cadastrado.');return;}const service=snapshot.services.find(item=>item.id===id);if(!service)return;try{const price=await resolveEngineeringProductionPrice({...scope,workId:snapshot.workId,contractServiceId:service.contractServiceId,structureId});setUnitValue(price===null?'':String(price));if(price===null)setError('Este serviço ainda não possui valor de produção cadastrado para a estrutura selecionada.');else setError(null);}catch(c){setError(c instanceof Error?c.message:'Não foi possível carregar o valor de produção.');}}

  function addParticipant(id:string){
    const employee=snapshot.employees.find(item=>item.id===id);if(!employee)return;
    const next=[...participants,{id:employee.id,name:employee.name,percentage:'',value:''}];
    setParticipants(next);setEmployeeSearch('');
    if(divisionMode==='percentage'){const share=(100/next.length).toFixed(2);setParticipants(next.map(item=>({...item,percentage:share})));}
    if(divisionMode==='value'&&total>0){const share=(total/next.length).toFixed(2);setParticipants(next.map(item=>({...item,value:share})));}
  }
  function removeParticipant(id:string){setParticipants(current=>current.filter(item=>item.id!==id));}
  function updateParticipant(id:string,key:'percentage'|'value',value:string){setParticipants(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));}
  function changeDivision(mode:DivisionMode){setDivisionMode(mode);if(mode==='percentage'&&participants.length){const share=(100/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,percentage:share})));}if(mode==='value'&&participants.length&&total>0){const share=(total/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,value:share})));}}
  function reset(){setPeriodId('');setStructureId('');setServiceId('');setProductionDate(today());setExecutedQuantity('');setUnitValue('');setNotes('');setDivisionMode('equal');setParticipants([]);setEmployeeSearch('');setError(null);}
  function close(){if(busy)return;reset();onClose();}

  async function submit(){
    setError(null);
    if(!periodId||!structureId||!serviceId){setError('Selecione competência, estrutura e serviço.');return;}
    if(usesApartmentUnits&&unitIds.length===0){setError('Selecione ao menos um apartamento/unidade.');return;}if(!usesApartmentUnits&&numberValue(executedQuantity)<=0){setError('Informe uma quantidade maior que zero.');return;}
    if(numberValue(unitValue)<0||unitValue.trim()===''){setError('Cadastre o valor de produção deste serviço antes de lançar.');return;}
    if(participants.length===0){setError('Selecione ao menos um colaborador.');return;}
    const payload:SharedProductionParticipantInput[]=participants.map(item=>({employmentContractId:item.id,...(divisionMode==='percentage'?{percentage:numberValue(item.percentage)}:{}),...(divisionMode==='value'?{value:numberValue(item.value)}:{})}));
    if(divisionMode==='percentage'&&Math.abs(payload.reduce((sum,item)=>sum+(item.percentage??0),0)-100)>0.01){setError('A soma dos percentuais deve ser 100%.');return;}
    if(divisionMode==='value'&&Math.abs(payload.reduce((sum,item)=>sum+(item.value??0),0)-total)>0.01){setError(`A soma dos valores deve ser ${currency.format(total)}.`);return;}
    setBusy(true);
    try{const selected=snapshot.services.find(item=>item.id===serviceId);if(!selected)throw new Error('Serviço contratual não encontrado.');await createSharedProductionEntry({tenantId:scope.tenantId,companyId:scope.companyId,periodId,structureId,contractServiceId:selected.contractServiceId,serviceId:selected.serviceId,productionDate,executedQuantity:usesApartmentUnits?unitIds.length:numberValue(executedQuantity),unitValue:numberValue(unitValue),notes:notes||null,divisionMode,participants:payload});reset();onSaved();onClose();}
    catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar a produção.');}
    finally{setBusy(false);}
  }

  return <Dialog open={open} title="Lançar produção" description="Selecione o serviço executado e divida entre um ou mais colaboradores." onClose={close} onBack={close} onConfirm={()=>void submit()} confirmLabel="Salvar produção" loading={busy}>
    <div className="engineering-production-entry-form">
      {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>} 
      <div className="engineering-production-entry-form__grid">
        <Select label="Competência" value={periodId} onChange={event=>setPeriodId(event.target.value)} options={periodOptions} required/>
        <Select label="Estrutura" value={structureId} onChange={event=>changeStructure(event.target.value)} options={structureOptions} required/>
        <Select label="Serviço" value={serviceId} onChange={event=>void changeService(event.target.value)} options={serviceOptions} required disabled={!structureId||(isGeneral?generalServices.length===0:allowedServices.length===0)}/>
        <Input label="Data" type="date" value={productionDate} onChange={event=>setProductionDate(event.target.value)} required/>
        <Input label="Quantidade" type="number" value={executedQuantity} onChange={event=>setExecutedQuantity(event.target.value)} required/>
        <Input label={`Valor unitário${selectedService?.unit?` (${selectedService.unit})`:''}`} type="number" value={unitValue} readOnly required/>
      </div>
      <div className="engineering-production-entry-form__total"><span>Total da produção</span><strong>{currency.format(total)}</strong></div>
      <section className="engineering-production-entry-form__participants">
        <div className="engineering-production-entry-form__participant-head"><div><h3>Colaboradores</h3><p className="ui-muted">O mesmo serviço pode ser dividido entre várias pessoas.</p></div><Select label="Divisão" value={divisionMode} onChange={event=>changeDivision(event.target.value as DivisionMode)} options={[{value:'equal',label:'Igual'},{value:'percentage',label:'Percentual'},{value:'value',label:'Valor'}]}/></div>
        <SearchableSelect label="Adicionar colaborador" options={availableEmployees} value={employeeSearch} onChange={addParticipant} placeholder="Digite o nome do colaborador" emptyMessage="Todos os colaboradores já foram selecionados."/>
        {participants.length===0?<p className="ui-muted engineering-production-entry-form__empty">Nenhum colaborador selecionado.</p>:<div className="engineering-production-entry-form__participant-list">{participants.map(item=><div key={item.id} className="engineering-production-entry-form__participant"><strong>{item.name}</strong><span>{divisionMode==='equal'?`${(100/participants.length).toFixed(2)}% · ${currency.format(participants.length?total/participants.length:0)}`:''}</span>{divisionMode==='percentage'&&<Input label="Percentual (%)" type="number" value={item.percentage} onChange={event=>updateParticipant(item.id,'percentage',event.target.value)}/>} {divisionMode==='value'&&<Input label="Valor" type="number" value={item.value} onChange={event=>updateParticipant(item.id,'value',event.target.value)}/>}<Button size="sm" variant="tertiary" onClick={()=>removeParticipant(item.id)}>Remover</Button></div>)}</div>}
      </section>
      <Input label="Observações" value={notes} onChange={event=>setNotes(event.target.value)}/>
    </div>
  </Dialog>;
}