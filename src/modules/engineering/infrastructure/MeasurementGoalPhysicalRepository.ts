import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { MeasurementParityModel } from './LegacyMeasurementParityRepository';

export async function loadMeasurementGoalPhysicalQuantities(model:MeasurementParityModel):Promise<Map<string,{quantity:number;unit:string}>> {
 const physicalByAddendum=new Map<string,{quantity:number;unit:string}>();
 const addendumIds=[...new Set(model.origins.filter(origin=>origin.type==='addendum').flatMap(origin=>origin.services.filter(service=>service.targetKind==='addendum').map(service=>service.targetId)))];
 if(!addendumIds.length)return physicalByAddendum;
 const db=getSupabaseClient();
 const {data:links,error:linkError}=await db.from('engineering_goal_physical_service_links').select('addendum_line_id,control_item_id,physical_quantity,physical_unit').in('addendum_line_id',addendumIds);
 if(linkError)throw linkError;
 const itemIds=[...new Set((links??[]).filter(link=>link.control_item_id).map(link=>String(link.control_item_id)))];
 (links??[]).forEach(link=>{if(!link.control_item_id&&Number(link.physical_quantity)>0&&link.physical_unit)physicalByAddendum.set(String(link.addendum_line_id),{quantity:Number(link.physical_quantity),unit:String(link.physical_unit)});});
 if(!itemIds.length)return physicalByAddendum;
 const {data:items,error:itemError}=await db.from('engineering_service_control_items').select('id,unit,contracted_quantity,control_id').in('id',itemIds);
 if(itemError)throw itemError;
 const controlIds=[...new Set((items??[]).map(item=>String(item.control_id)))];
 if(!controlIds.length)return physicalByAddendum;
 const {data:controls,error:controlError}=await db.from('engineering_service_controls').select('id,contract_id').in('id',controlIds);
 if(controlError)throw controlError;
 const validControlIds=new Set((controls??[]).filter(control=>control.contract_id===model.contractId).map(control=>String(control.id)));
 const itemById=new Map((items??[]).filter(item=>validControlIds.has(String(item.control_id))).map(item=>[String(item.id),item]));
 (links??[]).forEach(link=>{const item=itemById.get(String(link.control_item_id));if(item&&Number(item.contracted_quantity)>0)physicalByAddendum.set(String(link.addendum_line_id),{quantity:Number(item.contracted_quantity),unit:String(item.unit||'m')});});
 return physicalByAddendum;
}

export async function loadExternalServiceExecution(model:MeasurementParityModel,addendumIds:string[]):Promise<Map<string,{ratio:number;value:number}>> {
 const result=new Map<string,{ratio:number;value:number}>();
 if(!addendumIds.length)return result;
 const db=getSupabaseClient();
 const {data:links,error:linkError}=await db.from('engineering_goal_physical_service_links').select('addendum_line_id,control_item_id').in('addendum_line_id',addendumIds);
 if(linkError)throw linkError;
 const linked=(links??[]).filter(row=>row.control_item_id);
 const itemIds=[...new Set(linked.map(row=>String(row.control_item_id)))];
 if(!itemIds.length)return result;
 const {data:items,error:itemError}=await db.from('engineering_service_control_items').select('id,control_id,contracted_quantity,unit_price').in('id',itemIds);
 if(itemError)throw itemError;
 const controlIds=[...new Set((items??[]).map(row=>String(row.control_id)))];
 if(!controlIds.length)return result;
 const {data:controls,error:controlError}=await db.from('engineering_service_controls').select('id,contract_id').in('id',controlIds);
 if(controlError)throw controlError;
 const validControlIds=new Set((controls??[]).filter(row=>row.contract_id===model.contractId).map(row=>String(row.id)));
 const validItems=(items??[]).filter(row=>validControlIds.has(String(row.control_id)));
 if(!validItems.length)return result;
 const {data:entries,error:entryError}=await db.from('engineering_service_control_entries').select('item_id,executed_quantity').in('item_id',validItems.map(row=>String(row.id)));
 if(entryError)throw entryError;
 const quantities=new Map<string,number>();
 for(const entry of entries??[])quantities.set(String(entry.item_id),(quantities.get(String(entry.item_id))??0)+Number(entry.executed_quantity));
 for(const link of linked){
  const item=validItems.find(row=>String(row.id)===String(link.control_item_id));
  if(!item)continue;
  const contracted=Number(item.contracted_quantity);
  if(contracted<=0)continue;
  const meters=quantities.get(String(item.id))??0;
  result.set(String(link.addendum_line_id),{ratio:meters/contracted,value:Math.round(meters*Number(item.unit_price)*100)/100});
 }
 return result;
}
