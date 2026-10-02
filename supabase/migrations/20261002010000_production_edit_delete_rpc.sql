begin;
create or replace function public.update_engineering_production_entry(
 p_tenant_id uuid,p_company_id uuid,p_entry_id uuid,p_period_id uuid,p_structure_id uuid,
 p_production_date date,p_executed_quantity numeric,p_unit_value numeric,p_notes text,
 p_division_mode text,p_participants jsonb,p_selected_units text[]
) returns void language plpgsql security invoker set search_path='' as $$
declare v_entry public.engineering_production_entries%rowtype;v_primary uuid;v_total numeric(14,2);v_count int;v_item jsonb;v_employee uuid;v_percentage numeric;v_value numeric;v_sum numeric;
begin
 if not app_private.can_edit_company(p_tenant_id,p_company_id) then raise exception 'access denied';end if;
 select * into v_entry from public.engineering_production_entries where tenant_id=p_tenant_id and company_id=p_company_id and id=p_entry_id for update;
 if not found then raise exception 'production entry not found';end if;
 perform 1 from public.engineering_production_periods where tenant_id=p_tenant_id and company_id=p_company_id and id=p_period_id and status='open';
 if not found then raise exception 'closed production period is locked';end if;
 if p_executed_quantity<=0 or p_unit_value<0 then raise exception 'invalid production values';end if;
 if jsonb_typeof(p_participants)<>'array' or jsonb_array_length(p_participants)=0 then raise exception 'participants required';end if;
 v_count:=jsonb_array_length(p_participants);v_total:=round(p_executed_quantity*p_unit_value,2);
 select (value->>'employmentContractId')::uuid into v_primary from jsonb_array_elements(p_participants) limit 1;
 if p_division_mode='percentage' then select coalesce(sum((value->>'percentage')::numeric),0) into v_sum from jsonb_array_elements(p_participants);if abs(v_sum-100)>0.01 then raise exception 'participant percentages must total 100';end if;end if;
 if p_division_mode='value' then select coalesce(sum((value->>'value')::numeric),0) into v_sum from jsonb_array_elements(p_participants);if abs(v_sum-v_total)>0.01 then raise exception 'participant values must equal production total';end if;end if;
 update public.engineering_production_entries set production_period_id=p_period_id,employment_contract_id=v_primary,structure_id=p_structure_id,production_date=p_production_date,executed_quantity=p_executed_quantity,unit_value=p_unit_value,production_value=v_total,notes=nullif(trim(p_notes),''),selected_units=coalesce(p_selected_units,'{}'::text[]),updated_at=now() where id=p_entry_id;
 delete from public.engineering_production_participants where tenant_id=p_tenant_id and company_id=p_company_id and production_entry_id=p_entry_id;
 for v_item in select value from jsonb_array_elements(p_participants) loop
  v_employee:=(v_item->>'employmentContractId')::uuid;
  if p_division_mode='equal' then v_percentage:=100.0/v_count;v_value:=round(v_total/v_count,2);elsif p_division_mode='percentage' then v_percentage:=(v_item->>'percentage')::numeric;v_value:=round(v_total*v_percentage/100,2);else v_value:=(v_item->>'value')::numeric;v_percentage:=case when v_total=0 then 100.0/v_count else v_value/v_total*100 end;end if;
  insert into public.engineering_production_participants(tenant_id,company_id,production_entry_id,employment_contract_id,percentage,participant_value) values(p_tenant_id,p_company_id,p_entry_id,v_employee,v_percentage,v_value);
 end loop;
end $$;
grant execute on function public.update_engineering_production_entry(uuid,uuid,uuid,uuid,uuid,date,numeric,numeric,text,text,jsonb,text[]) to authenticated;

create or replace function public.delete_engineering_production_entry(p_tenant_id uuid,p_company_id uuid,p_entry_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not app_private.can_edit_company(p_tenant_id,p_company_id) then raise exception 'access denied';end if;
 perform 1 from public.engineering_production_entries e join public.engineering_production_periods p on p.id=e.production_period_id and p.tenant_id=e.tenant_id and p.company_id=e.company_id where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=p_entry_id and p.status='open';
 if not found then raise exception 'production entry not found or period is closed';end if;
 delete from public.engineering_production_entries where tenant_id=p_tenant_id and company_id=p_company_id and id=p_entry_id;
end $$;
revoke all on function public.delete_engineering_production_entry(uuid,uuid,uuid) from public,anon;
grant execute on function public.delete_engineering_production_entry(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;