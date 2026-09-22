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
