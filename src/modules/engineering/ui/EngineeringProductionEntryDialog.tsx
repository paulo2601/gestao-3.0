import { useMemo, useState } from 'react';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import type { EngineeringProductionSnapshot } from '../infrastructure/EngineeringProductionReadRepository';
import { createManualProductionEntry, createSharedProductionEntry, type SharedProductionParticipantInput } from '../infrastructure/EngineeringProductionWriteRepository';
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
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const numberValue=(value:string)=>{const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?parsed:0;};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const competenceDate=(competence:string)=>`${competence.slice(0,7)}-01`;

export function EngineeringProductionEntryDialog({open,scope,snapshot,onClose,onSaved}:Props){
  const now=new Date();const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const currentPeriod=snapshot.periods.find(item=>item.status==='open'&&item.competence.slice(0,7)===currentMonth);const [periodId,setPeriodId]=useState(currentPeriod?.id??'');
  const [structureId,setStructureId]=useState('');
  const [unitIds,setUnitIds]=useState<string[]>([]);
  const [unitPickerOpen,setUnitPickerOpen]=useState(false);
  const [serviceId,setServiceId]=useState('');
  const [productionDate,setProductionDate]=useState(currentPeriod?competenceDate(currentPeriod.competence):today());
  const [executedQuantity,setExecutedQuantity]=useState('');
  const [unitValue,setUnitValue]=useState('');
  const [notes,setNotes]=useState('');
  const [divisionMode,setDivisionMode]=useState<DivisionMode>('equal');
  const [participants,setParticipants]=useState<ParticipantDraft[]>([]);
  const [employeeSearch,setEmployeeSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const openPeriods=snapshot.periods.filter(item=>item.status==='open');
  const filteredEmployees=useMemo(()=>snapshot.employees.filter(item=>item.name.toLocaleLowerCase('pt-BR').includes(employeeSearch.trim().toLocaleLowerCase('pt-BR'))),[snapshot.employees,employeeSearch]);
  const periodOptions=[{value:'',label:'Selecione…'},...openPeriods.map(item=>({value:item.id,label:item.competence.slice(0,7).split('-').reverse().join('/')}))];
  const generalServices=snapshot.productionPrices.filter(item=>item.structureId===null&&item.productionServiceId&&item.productionServiceKind!=='linked');
  const structureOptions=[{value:'',label:'Selecione…'},...(generalServices.length?[{value:'__GENERAL__',label:'SEM ESTRUTURA / SERVIÇOS GERAIS'}]:[]),...snapshot.structures.map(item=>({value:item.id,label:item.name}))];
  const manualServices=snapshot.productionPrices.filter(item=>item.structureId===structureId&&item.productionServiceId&&item.productionServiceKind==='manual');
  const allowedServiceIds=new Set(snapshot.serviceIdsByStructure[structureId]??[]);
  const pricedContractServiceIds=new Set(snapshot.productionPrices.filter(item=>item.structureId===structureId).map(item=>item.contractServiceId));
  const allowedServices=snapshot.services.filter(item=>allowedServiceIds.has(item.id)&&pricedContractServiceIds.has(item.contractServiceId));
  const isGeneral=structureId==='__GENERAL__';
  const selectedManual=manualServices.find(item=>('manual:'+item.productionServiceId)===serviceId);
  const selectedService=allowedServices.find(item=>item.id===serviceId);
  const selectedServiceUnit=(selectedManual?.unit??selectedService?.unit)?.toUpperCase()??'';
  const usesApartmentUnits=!isGeneral&&['APTO','APT','APARTAMENTO'].includes(selectedServiceUnit);
  const baseQuantity=usesApartmentUnits?unitIds.length:numberValue(executedQuantity);
  const manualValueMode=Boolean(selectedManual)&&!usesApartmentUnits;const alreadyProduced=selectedManual?snapshot.entries.filter(e=>e.productionServiceId===selectedManual.productionServiceId).reduce((sum,e)=>sum+(e.productionValue??0),0):0;const serviceTotal=selectedManual?(selectedManual.plannedQuantity??1)*selectedManual.unitValue:0;const serviceBalance=Math.max(0,serviceTotal-alreadyProduced);const total=manualValueMode?numberValue(executedQuantity):baseQuantity*numberValue(unitValue);
  const physicalFloors=snapshot.structureNodes.filter(item=>item.parentId===structureId&&item.structureType==='floor');
  const selectedStructure=snapshot.structures.find(item=>item.id===structureId);
  const towerConfig=(selectedStructure?.metadata?.towerConfig??null) as {floorCount?:number;unitsPerFloor?:number;hasGroundFloor?:boolean;groundFloorUnits?:number;firstFloor?:number}|null;
  const virtualFloors=physicalFloors.length===0&&towerConfig?[
    ...(towerConfig.hasGroundFloor?[{id:`virtual:${structureId}:TR`,name:'Térreo',parentId:structureId,structureType:'floor'}]:[]),
    ...Array.from({length:towerConfig.floorCount??0},(_,index)=>{const floor=(towerConfig.firstFloor??1)+index;return{id:`virtual:${structureId}:${floor}`,name:`${floor}º Pavimento`,parentId:structureId,structureType:'floor'};}),
  ]:[];
  const floors=physicalFloors.length?physicalFloors:virtualFloors;
  const allFloorUnits=floors.map((floor,index)=>{const physical=snapshot.structureNodes.filter(item=>item.parentId===floor.id&&item.structureType==='unit');if(physical.length)return{floor,units:physical};const isGround=floor.id.endsWith(':TR');const count=isGround?(towerConfig?.groundFloorUnits??towerConfig?.unitsPerFloor??0):(towerConfig?.unitsPerFloor??0);const floorNumber=isGround?1:(towerConfig?.firstFloor??1)+(index-(towerConfig?.hasGroundFloor?1:0));return{floor,units:Array.from({length:count},(_,unitIndex)=>({id:`virtual-unit:${structureId}:${floor.id}:${unitIndex+1}`,name:String(floorNumber*100+unitIndex+1),parentId:floor.id,structureType:'unit'}))};});
  const launchedUnitNames=new Set(snapshot.entries.filter(e=>e.structureId===structureId&&((selectedManual&&e.productionServiceId===selectedManual.productionServiceId)||(selectedService&&e.serviceId===selectedService.serviceId))).flatMap(e=>e.selectedUnits));
  const unitKey=(floorName:string,unitName:string)=>`${floorName.toUpperCase()}|${unitName}`;
  const availableFloorUnits=allFloorUnits.map(group=>({...group,units:group.units.filter(unit=>!launchedUnitNames.has(unitKey(group.floor.name,unit.name))&&!launchedUnitNames.has(unit.name))})).filter(group=>group.units.length>0);
  const allUnitIds=availableFloorUnits.flatMap(group=>group.units.map(item=>item.id));
  const toggleFloor=(ids:string[],checked:boolean)=>setUnitIds(current=>checked?Array.from(new Set([...current,...ids])):current.filter(id=>!ids.includes(id)));
  const completedApartmentServiceIds=new Set(snapshot.entries.filter(e=>e.structureId===structureId&&e.selectedUnits.length>0).filter(e=>{const price=snapshot.productionPrices.find(p=>p.productionServiceId===e.productionServiceId);return price&&['APTO','APT','APARTAMENTO'].includes((price.unit??'').toUpperCase())&&e.selectedUnits.length>=allFloorUnits.flatMap(g=>g.units).length;}).map(e=>e.productionServiceId));
  const visibleManualServices=manualServices.filter(item=>!item.productionServiceId||!completedApartmentServiceIds.has(item.productionServiceId));
  const towerServices=[...visibleManualServices.map(item=>({value:`manual:${item.productionServiceId}`,label:`${item.productionServiceName??'Serviço manual'}${item.unit?` · ${item.unit}`:''}`})),...allowedServices.map(item=>({value:item.id,label:`${item.name}${item.unit?` · ${item.unit}`:''}`}))];
  const serviceOptions=[{value:'',label:structureId?((isGeneral?generalServices.length:towerServices.length)?'Selecione…':'Nenhum serviço com valor de produção cadastrado nesta estrutura'):'Selecione a estrutura primeiro'},...(isGeneral?generalServices.map(item=>({value:`general:${item.productionServiceId}`,label:`${item.productionServiceKind==='discount'?'Desconto · ':''}${item.productionServiceName??'Serviço manual'}${item.unit?` · ${item.unit}`:''}`})):towerServices)];
  function changeStructure(id:string){setStructureId(id);setUnitIds([]);setServiceId('');setUnitValue('');}
  async function changeService(id:string){setServiceId(id);setUnitValue('');if(!id||!structureId)return;if(structureId==='__GENERAL__'){const price=generalServices.find(item=>`general:${item.productionServiceId}`===id);setUnitValue(price?String(price.unitValue):'');setError(price?null:'Serviço geral sem valor cadastrado.');return;}if(id.startsWith('manual:')){const price=manualServices.find(item=>`manual:${item.productionServiceId}`===id);setUnitValue(price?String(price.unitValue):'');setError(price?null:'Serviço manual sem valor cadastrado.');return;}const service=snapshot.services.find(item=>item.id===id);if(!service)return;try{const price=await resolveEngineeringProductionPrice({...scope,workId:snapshot.workId,contractServiceId:service.contractServiceId,structureId});setUnitValue(price===null?'':String(price));if(price===null)setError('Este serviço ainda não possui valor de produção cadastrado para a estrutura selecionada.');else setError(null);}catch(c){setError(c instanceof Error?c.message:'Não foi possível carregar o valor de produção.');}}

  function addParticipant(id:string){
    const employee=snapshot.employees.find(item=>item.id===id);if(!employee)return;
    const next=[...participants,{id:employee.id,name:employee.name,percentage:'',value:''}];
    setParticipants(next);
    if(divisionMode==='percentage'){const share=(100/next.length).toFixed(2);setParticipants(next.map(item=>({...item,percentage:share})));}
    if(divisionMode==='value'&&total>0){const share=(total/next.length).toFixed(2);setParticipants(next.map(item=>({...item,value:share})));}
  }
  function removeParticipant(id:string){setParticipants(current=>current.filter(item=>item.id!==id));}
  function toggleParticipant(id:string){if(participants.some(item=>item.id===id)){removeParticipant(id);return;}addParticipant(id);}
  function updateParticipant(id:string,key:'percentage'|'value',value:string){setParticipants(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));}
  function changeDivision(mode:DivisionMode){setDivisionMode(mode);if(mode==='percentage'&&participants.length){const share=(100/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,percentage:share})));}if(mode==='value'&&participants.length&&total>0){const share=(total/participants.length).toFixed(2);setParticipants(current=>current.map(item=>({...item,value:share})));}}
  function resetEntry(keepContext=false){if(!keepContext){setPeriodId(currentPeriod?.id??'');setStructureId('');}setUnitIds([]);setServiceId('');setProductionDate(currentPeriod?competenceDate(currentPeriod.competence):today());setExecutedQuantity('');setUnitValue('');setNotes('');if(!keepContext){setDivisionMode('equal');setParticipants([]);setEmployeeSearch('');}setError(null);}
  function resetForAnotherService(){setUnitIds([]);setServiceId('');setExecutedQuantity('');setUnitValue('');setNotes('');setError(null);}
  function reset(){resetEntry(false);}
  function close(){if(busy)return;reset();onClose();}

  async function submit(addAnother=false){
    setError(null);
    if(!periodId||!structureId||!serviceId){setError('Selecione competência, estrutura e serviço.');return;}const selectedPeriod=openPeriods.find(item=>item.id===periodId);if(!selectedPeriod){setError('A competência selecionada não está aberta.');return;}if(productionDate.slice(0,7)!==selectedPeriod.competence.slice(0,7)){setError(`A data do serviço deve pertencer à competência ${selectedPeriod.competence.slice(0,7).split('-').reverse().join('/')}.`);return;}
    if(usesApartmentUnits&&unitIds.length===0){setError('Selecione ao menos um apartamento/unidade.');return;}if(!usesApartmentUnits&&numberValue(executedQuantity)<=0){setError(manualValueMode?'Informe o valor que deseja pagar.':'Informe uma quantidade maior que zero.');return;}if(manualValueMode&&numberValue(executedQuantity)>serviceBalance+0.009){setError(`O valor informado ultrapassa o saldo de ${currency.format(serviceBalance)}.`);return;}
    if(numberValue(unitValue)<0||unitValue.trim()===''){setError('Cadastre o valor de produção deste serviço antes de lançar.');return;}
    if(participants.length===0){setError('Selecione ao menos um colaborador.');return;}
    const payload:SharedProductionParticipantInput[]=participants.map(item=>({employmentContractId:item.id,...(divisionMode==='percentage'?{percentage:numberValue(item.percentage)}:{}),...(divisionMode==='value'?{value:numberValue(item.value)}:{})}));
    if(divisionMode==='percentage'&&Math.abs(payload.reduce((sum,item)=>sum+(item.percentage??0),0)-100)>0.01){setError('A soma dos percentuais deve ser 100%.');return;}
    if(divisionMode==='value'&&Math.abs(payload.reduce((sum,item)=>sum+(item.value??0),0)-total)>0.01){setError(`A soma dos valores deve ser ${currency.format(total)}.`);return;}
    setBusy(true);
    try{const common={tenantId:scope.tenantId,companyId:scope.companyId,periodId,structureId,productionDate,executedQuantity:usesApartmentUnits?unitIds.length:manualValueMode?1:numberValue(executedQuantity),unitValue:manualValueMode?numberValue(executedQuantity):numberValue(unitValue),notes:notes||null,divisionMode,participants:payload,selectedUnits:availableFloorUnits.flatMap(group=>group.units.filter(unit=>unitIds.includes(unit.id)).map(unit=>unitKey(group.floor.name,unit.name)))};if(serviceId.startsWith('manual:'))await createManualProductionEntry({...common,productionServiceId:serviceId.slice(7)});else{const selected=snapshot.services.find(item=>item.id===serviceId);if(!selected)throw new Error('Serviço não encontrado.');await createSharedProductionEntry({...common,contractServiceId:selected.contractServiceId,serviceId:selected.serviceId});}onSaved();if(addAnother)resetForAnotherService();else{reset();onClose();}}
    catch(cause){const rawMessage=typeof cause==='object'&&cause!==null&&'message' in cause?(cause as {message?:unknown}).message:undefined;const details=typeof rawMessage==='string'?rawMessage:'';setError(details||'Não foi possível salvar a produção. Tente novamente.');}
    finally{setBusy(false);}
  }

  return <Dialog open={open} title="Lançar produção" description="Selecione o serviço executado e divida entre um ou mais colaboradores." onClose={close} onBack={close} footer={<><Button type="button" variant="secondary" onClick={()=>void submit(true)} disabled={busy}>＋ Salvar e adicionar outro serviço</Button><Button type="button" onClick={()=>void submit(false)} loading={busy}>Salvar e finalizar</Button></>} loading={busy}>
    <div className="engineering-production-entry-form">
      {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>} 
      <div className="engineering-production-entry-form__grid">
        <Select label="Competência" value={periodId} onChange={event=>{const nextId=event.target.value;setPeriodId(nextId);const nextPeriod=openPeriods.find(item=>item.id===nextId);if(nextPeriod&&productionDate.slice(0,7)!==nextPeriod.competence.slice(0,7))setProductionDate(competenceDate(nextPeriod.competence));setError(null);}} options={periodOptions} required/>
        <Select label="Estrutura" value={structureId} onChange={event=>changeStructure(event.target.value)} options={structureOptions} required/>
        <Select label="Serviço" value={serviceId} onChange={event=>void changeService(event.target.value)} options={serviceOptions} required disabled={!structureId||(isGeneral?generalServices.length===0:towerServices.length===0)}/>
        <Input label="Data" type="date" value={productionDate} onChange={event=>setProductionDate(event.target.value)} required/>
        {manualValueMode?<Input label="Valor a pagar nesta produção" type="number" value={executedQuantity} onChange={event=>setExecutedQuantity(event.target.value)} required/>:usesApartmentUnits?<div className="engineering-production-entry-form__unit-trigger"><span>Apartamentos / Unidades</span><button type="button" onClick={()=>setUnitPickerOpen(true)}>{unitIds.length?`${unitIds.length} apartamento(s) selecionado(s)`:'Selecionar apartamentos'}</button></div>:<Input label="Quantidade" type="number" value={executedQuantity} onChange={event=>setExecutedQuantity(event.target.value)} required/>}
        {!manualValueMode&&<Input label={`Valor unitário${selectedService?.unit?` (${selectedService.unit})`:''}`} type="number" value={unitValue} readOnly required/>}
      </div>
      {manualValueMode&&<div className="engineering-production-entry-form__total"><span>Valor cadastrado: {currency.format(serviceTotal)} · Já produzido: {currency.format(alreadyProduced)} · Saldo após lançamento: {currency.format(Math.max(0,serviceBalance-total))}</span><strong>{currency.format(total)}</strong></div>}{!manualValueMode&&<div className="engineering-production-entry-form__total"><span>Total da produção</span><strong>{currency.format(total)}</strong></div>}
      <section className="engineering-production-entry-form__participants">
        <div className="engineering-production-entry-form__participant-head"><div><h3>Colaboradores</h3><p className="ui-muted">O mesmo serviço pode ser dividido entre várias pessoas.</p></div><Select label="Divisão" value={divisionMode} onChange={event=>changeDivision(event.target.value as DivisionMode)} options={[{value:'equal',label:'Igual'},{value:'percentage',label:'Percentual'},{value:'value',label:'Valor'}]}/></div>
        <div className="engineering-production-entry-form__employee-picker">
          <div className="engineering-production-entry-form__employee-picker-head"><strong>Selecionar colaboradores</strong><Input label="Buscar colaborador" value={employeeSearch} onChange={event=>setEmployeeSearch(event.target.value)} placeholder="Buscar por nome..."/></div>
          <div className="engineering-production-entry-form__employee-list">{filteredEmployees.map(employee=>{const selected=participants.find(item=>item.id===employee.id);return <div key={employee.id} className={selected?'engineering-production-entry-form__employee-chip is-selected':'engineering-production-entry-form__employee-chip'}><label><input type="checkbox" checked={Boolean(selected)} onChange={()=>toggleParticipant(employee.id)}/><span>{employee.name}</span></label>{selected&&divisionMode==='equal'&&<small>{(100/participants.length).toFixed(2)}% · {currency.format(total/participants.length)}</small>}{selected&&divisionMode==='percentage'&&<Input label="%" type="number" value={selected.percentage} onChange={event=>updateParticipant(selected.id,'percentage',event.target.value)}/>} {selected&&divisionMode==='value'&&<Input label="R$" type="number" value={selected.value} onChange={event=>updateParticipant(selected.id,'value',event.target.value)}/>}</div>;})}</div>
          {participants.length>0&&<div className="engineering-production-entry-form__participant-summary"><strong>{participants.length} colaborador(es) selecionado(s)</strong><span>{divisionMode==='percentage'?participants.reduce((sum,item)=>sum+numberValue(item.percentage),0).toFixed(2)+'%':'100,00%'} · {currency.format(total)}</span></div>}
        </div>
      </section>
      <Input label="Observações" value={notes} onChange={event=>setNotes(event.target.value)}/>
      <Dialog open={unitPickerOpen} title="Selecionar apartamentos" description="Marque todos, um pavimento inteiro ou apartamentos individualmente." onClose={()=>setUnitPickerOpen(false)} onBack={()=>setUnitPickerOpen(false)} onConfirm={()=>setUnitPickerOpen(false)} confirmLabel="Confirmar seleção">
        <div className="engineering-production-unit-picker"><div className="engineering-production-unit-picker__all"><label><input type="checkbox" checked={allUnitIds.length>0&&allUnitIds.every(id=>unitIds.includes(id))} onChange={event=>toggleFloor(allUnitIds,event.target.checked)}/><strong>Selecionar todos</strong></label><span>{unitIds.length} selecionado(s)</span></div>{availableFloorUnits.map(({floor,units:floorUnits})=><section key={floor.id}><div className="engineering-production-unit-picker__floor"><label><input type="checkbox" checked={floorUnits.length>0&&floorUnits.every(item=>unitIds.includes(item.id))} onChange={event=>toggleFloor(floorUnits.map(item=>item.id),event.target.checked)}/><strong>{floor.name}</strong></label><span>{floorUnits.filter(item=>unitIds.includes(item.id)).length}/{floorUnits.length}</span></div><div className="engineering-production-unit-picker__units">{floorUnits.map(item=><label key={item.id}><input type="checkbox" checked={unitIds.includes(item.id)} onChange={event=>setUnitIds(current=>event.target.checked?Array.from(new Set([...current,item.id])):current.filter(id=>id!==item.id))}/><span>{item.name}</span></label>)}</div></section>)}</div>
      </Dialog>
    </div>
  </Dialog>;
}