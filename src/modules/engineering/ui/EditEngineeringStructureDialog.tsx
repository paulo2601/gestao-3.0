import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { useEngineeringOperations } from './useEngineeringOperations';

interface Props { open:boolean; scope:{tenantId:string;companyId:string}; structure:{id:string;name:string;code:string|null;metadata:Record<string,unknown>|null}; onClose:()=>void; onSaved:()=>void; }
type TowerConfig={floorCount:number;firstFloor:number;unitsPerFloor:number;hasGroundFloor:boolean;groundFloorUnits:number;hasRoof:boolean;roofUnits:number};
function readConfig(metadata:Record<string,unknown>|null):TowerConfig{const raw=metadata?.towerConfig;const cfg=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};const n=(key:string,fallback:number)=>{const value=Number(cfg[key]);return Number.isFinite(value)?value:fallback;};return{floorCount:Math.max(0,n('floorCount',0)),firstFloor:Math.max(0,n('firstFloor',1)),unitsPerFloor:Math.max(0,n('unitsPerFloor',0)),hasGroundFloor:Boolean(cfg.hasGroundFloor??false),groundFloorUnits:Math.max(0,n('groundFloorUnits',0)),hasRoof:Boolean(cfg.hasRoof??false),roofUnits:Math.max(0,n('roofUnits',0))};}

export function EditEngineeringStructureDialog({open,scope,structure,onClose,onSaved}:Props){
  const operations=useEngineeringOperations(scope);
  const initial=useMemo(()=>readConfig(structure.metadata),[structure.metadata]);
  const[name,setName]=useState(structure.name);
  const[floorCount,setFloorCount]=useState(String(initial.floorCount));
  const[unitsPerFloor,setUnitsPerFloor]=useState(String(initial.unitsPerFloor));
  const[hasGroundFloor,setHasGroundFloor]=useState(initial.hasGroundFloor);
  const[groundFloorUnits,setGroundFloorUnits]=useState(String(initial.groundFloorUnits||initial.unitsPerFloor));
  const[hasRoof,setHasRoof]=useState(initial.hasRoof);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!open)return;const next=readConfig(structure.metadata);setName(structure.name);setFloorCount(String(next.floorCount));setUnitsPerFloor(String(next.unitsPerFloor));setHasGroundFloor(next.hasGroundFloor);setGroundFloorUnits(String(next.groundFloorUnits||next.unitsPerFloor));setHasRoof(next.hasRoof);setError(null);},[open,structure]);
  const floors=Math.max(0,Number(floorCount)||0), units=Math.max(0,Number(unitsPerFloor)||0), ground=hasGroundFloor?Math.max(0,Number(groundFloorUnits)||units):0;
  const total=floors*units+ground;
  async function save(){if(!name.trim()){setError('Informe o nome da torre.');return;}if(floors<=0||units<=0){setError('Informe a quantidade de pavimentos e apartamentos por pavimento.');return;}setBusy(true);setError(null);try{await operations.updateStructure({structureId:structure.id,name:name.trim(),code:structure.code,metadata:{...(structure.metadata??{}),towerConfig:{floorCount:floors,firstFloor:1,unitsPerFloor:units,hasGroundFloor,groundFloorUnits:ground,hasRoof,roofUnits:0,totalUnits:total}}});onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a estrutura da torre.');}finally{setBusy(false);}}
  return <Dialog open={open} variant="quick-entry" title="Editar Torre" description="Configure a estrutura da torre. O sistema usará estes dados nos pavimentos e unidades." onClose={onClose} onBack={onClose} loading={busy} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={()=>void save()}>Salvar estrutura</Button></>}>
    <div className="engineering-tower-quick-form">
      {error&&<Feedback tone="danger" title="Não foi possível salvar" message={error}/>}
      <Input label="Nome da torre" value={name} onChange={e=>setName(e.target.value)} required/>
      <div className="engineering-tower-quick-form__row">
        <Input label="Quantidade de pavimentos" type="number" min="1" value={floorCount} onChange={e=>setFloorCount(e.target.value)} required/>
        <fieldset><legend>Térreo</legend><label><input type="radio" name="ground" checked={hasGroundFloor} onChange={()=>setHasGroundFloor(true)}/> Sim</label><label><input type="radio" name="ground" checked={!hasGroundFloor} onChange={()=>setHasGroundFloor(false)}/> Não</label></fieldset>
        <fieldset><legend>Cobertura</legend><label><input type="radio" name="roof" checked={hasRoof} onChange={()=>setHasRoof(true)}/> Sim</label><label><input type="radio" name="roof" checked={!hasRoof} onChange={()=>setHasRoof(false)}/> Não</label></fieldset>
      </div>
      <div className="engineering-tower-quick-form__row engineering-tower-quick-form__row--units">
        <Input label="Apartamentos por pavimento" type="number" min="1" value={unitsPerFloor} onChange={e=>setUnitsPerFloor(e.target.value)} required/>
        {hasGroundFloor&&<Input label="Apartamentos no térreo" type="number" min="0" value={groundFloorUnits} onChange={e=>setGroundFloorUnits(e.target.value)}/>}
      </div>
      <div className="engineering-tower-quick-form__preview"><strong>O que será criado automaticamente</strong><span>{hasGroundFloor?`1 pavimento térreo (TR) com ${ground} unidade(s) · `:''}Pavimentos 1º ao {floors}º com {units} unidade(s) cada{hasRoof?' · Cobertura incluída':''}.</span><b>Total de {total} unidades na torre</b></div>
    </div>
  </Dialog>;
}
