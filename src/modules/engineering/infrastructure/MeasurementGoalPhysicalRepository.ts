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
