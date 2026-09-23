export interface MeasurementStructureConfig {
  name:string;
  type:'tower'|'addendum'|'provisional'|'other';
  floorCount:number;
  hasGround:boolean;
  unitsPerFloor:number;
  enterpriseType:string;
  houses:string[];
}

export function buildMeasurementReferences(config:MeasurementStructureConfig):string[]{
  if(config.enterpriseType==='casas'&&config.houses.length)return Array.from(new Set(config.houses.map(value=>value.trim()).filter(Boolean)));
  if(config.type!=='tower'||config.unitsPerFloor<=0||config.floorCount<=0)return [];

  const unitsPerFloor=Math.floor(config.unitsPerFloor);
  const upperFloorCount=Math.max(0,Math.floor(config.floorCount));
  const references:string[]=[];
  if(config.hasGround){
    for(let unit=1;unit<=unitsPerFloor;unit++)references.push(`TR-${String(unit).padStart(2,'0')}`);
  }
  for(let floor=1;floor<=upperFloorCount;floor++){
    for(let unit=1;unit<=unitsPerFloor;unit++)references.push(`${floor}${String(unit).padStart(2,'0')}`);
  }
  return references;
}


export function filterMeasurementReferencesByFloors(references:string[], floors:string[]):string[]{
  if(!floors.length)return references;
  const allowed=new Set(floors.map(value=>{
    const normalized=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
    if(normalized==='terreo'||normalized==='0')return '0';
    const numeric=Number(value);
    return Number.isFinite(numeric)?String(numeric):normalized;
  }));
  return references.filter(reference=>{
    if(reference.startsWith('TR-'))return allowed.has('0');
    const match=reference.match(/^(\d{1,2})\d{2}$/);
    return match?allowed.has(String(Number(match[1]))):false;
  });
}
