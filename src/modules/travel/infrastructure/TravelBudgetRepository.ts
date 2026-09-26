import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type TravelBudgetItem={id:string;category:string;description:string;plannedAmount:number;actualAmount:number;dueDate:string|null;sortOrder:number};
export type TravelBudget={id:string;tenantId:string;companyId:string;name:string;origin:string;destination:string;startDate:string;endDate:string;travelers:number;vehicleName:string;fuelType:string;fuelPrice:number;avgConsumption:number;totalDistanceKm:number;reservePercent:number;notes:string;items:TravelBudgetItem[]};
export type TravelBudgetDraft=Omit<TravelBudget,'id'|'items'> & {id?:string;items:Array<Omit<TravelBudgetItem,'id'>>};
type BudgetRow={id:string;tenant_id:string;company_id:string;name:string;origin:string;destination:string;start_date:string;end_date:string;travelers:number;vehicle_name:string;fuel_type:string;fuel_price:number|string;avg_consumption:number|string;total_distance_km:number|string;reserve_percent:number|string;notes:string|null};
type ItemRow={id:string;budget_id:string;category:string;description:string;planned_amount:number|string;actual_amount:number|string;due_date:string|null;sort_order:number};
export async function listTravelBudgets(tenantId:string,companyId:string):Promise<TravelBudget[]>{
 const client=getSupabaseClient();
 const b=await client.from('travel_budgets').select('*').eq('tenant_id',tenantId).eq('company_id',companyId).order('start_date',{ascending:false}).returns<BudgetRow[]>();
 if(b.error)throw b.error; const ids=(b.data??[]).map(x=>x.id); let items:ItemRow[]=[];
 if(ids.length){const r=await client.from('travel_budget_items').select('*').eq('tenant_id',tenantId).eq('company_id',companyId).in('budget_id',ids).order('sort_order').returns<ItemRow[]>();if(r.error)throw r.error;items=r.data??[];}
 return (b.data??[]).map(x=>({id:x.id,tenantId:x.tenant_id,companyId:x.company_id,name:x.name,origin:x.origin,destination:x.destination,startDate:x.start_date,endDate:x.end_date,travelers:x.travelers,vehicleName:x.vehicle_name,fuelType:x.fuel_type,fuelPrice:Number(x.fuel_price),avgConsumption:Number(x.avg_consumption),totalDistanceKm:Number(x.total_distance_km),reservePercent:Number(x.reserve_percent),notes:x.notes??'',items:items.filter(i=>i.budget_id===x.id).map(i=>({id:i.id,category:i.category,description:i.description,plannedAmount:Number(i.planned_amount),actualAmount:Number(i.actual_amount),dueDate:i.due_date,sortOrder:i.sort_order}))}));
}
export async function saveTravelBudget(d:TravelBudgetDraft):Promise<string>{
 const client=getSupabaseClient(); const payload={tenant_id:d.tenantId,company_id:d.companyId,name:d.name.trim(),origin:d.origin.trim(),destination:d.destination.trim(),start_date:d.startDate,end_date:d.endDate,travelers:d.travelers,vehicle_name:d.vehicleName.trim(),fuel_type:d.fuelType.trim(),fuel_price:d.fuelPrice,avg_consumption:d.avgConsumption,total_distance_km:d.totalDistanceKm,reserve_percent:d.reservePercent,notes:d.notes.trim()||null,updated_at:new Date().toISOString()};
 let id=d.id;
 if(id){const r=await client.from('travel_budgets').update(payload).eq('id',id).eq('tenant_id',d.tenantId).eq('company_id',d.companyId);if(r.error)throw r.error;const del=await client.from('travel_budget_items').delete().eq('budget_id',id).eq('tenant_id',d.tenantId).eq('company_id',d.companyId);if(del.error)throw del.error;}
 else{const r=await client.from('travel_budgets').insert(payload).select('id').single();if(r.error)throw r.error;id=String(r.data.id);}
 if(d.items.length){const r=await client.from('travel_budget_items').insert(d.items.map((i,n)=>({tenant_id:d.tenantId,company_id:d.companyId,budget_id:id,category:i.category,description:i.description,planned_amount:i.plannedAmount,actual_amount:i.actualAmount,due_date:i.dueDate,sort_order:n+1})));if(r.error)throw r.error;}
 if (!id) throw new Error('Não foi possível identificar o orçamento de viagem salvo.');
 return id;
}
export async function deleteTravelBudget(tenantId:string,companyId:string,id:string){const r=await getSupabaseClient().from('travel_budgets').delete().eq('id',id).eq('tenant_id',tenantId).eq('company_id',companyId);if(r.error)throw r.error;}
