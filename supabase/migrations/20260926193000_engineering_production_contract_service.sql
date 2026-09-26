begin;

alter table public.engineering_production_entries
  add column if not exists contract_service_id uuid;

alter table public.engineering_production_entries
  add constraint engineering_production_entries_contract_service_fk
  foreign key (tenant_id,company_id,contract_service_id)
  references public.contract_services(tenant_id,company_id,id) on delete restrict;

create index if not exists engineering_production_entries_contract_service_idx
  on public.engineering_production_entries(tenant_id,company_id,contract_service_id,structure_id);

create or replace function public.validate_engineering_production_entry()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_work uuid;
  v_status text;
  v_structure_work uuid;
  v_hired date;
  v_terminated date;
  v_service_id uuid;
  v_unit_price numeric;
  v_service_allocated boolean;
begin
  select work_id,status into v_work,v_status
  from public.engineering_production_periods
  where tenant_id=new.tenant_id and company_id=new.company_id and id=new.production_period_id;
  if not found then raise exception 'production period not found'; end if;
  if v_status<>'open' then raise exception 'closed production period is locked'; end if;

  select work_id into v_structure_work
  from public.work_structures
  where tenant_id=new.tenant_id and company_id=new.company_id and id=new.structure_id;
  if not found or v_structure_work<>v_work then raise exception 'structure does not belong to production work'; end if;

  if new.contract_service_id is not null then
    select cs.service_id,cs.unit_price into v_service_id,v_unit_price
    from public.contract_services cs
    join public.engineering_contracts c on c.tenant_id=cs.tenant_id and c.company_id=cs.company_id and c.id=cs.contract_id
    where cs.tenant_id=new.tenant_id and cs.company_id=new.company_id and cs.id=new.contract_service_id
      and c.work_id=v_work and cs.status='active';
    if not found then raise exception 'contract service does not belong to production work'; end if;

    select exists(
      select 1 from public.contract_service_allocations a
      where a.tenant_id=new.tenant_id and a.company_id=new.company_id and a.work_id=v_work
        and a.structure_id=new.structure_id and a.contract_service_id=new.contract_service_id and a.status='active'
    ) or exists(
      select 1 from public.measurement_lines ml
      join public.measurements m on m.tenant_id=ml.tenant_id and m.company_id=ml.company_id and m.id=ml.measurement_id
      join public.engineering_contracts c on c.tenant_id=m.tenant_id and c.company_id=m.company_id and c.id=m.contract_id
      where ml.tenant_id=new.tenant_id and ml.company_id=new.company_id and ml.structure_id=new.structure_id
        and ml.contract_service_id=new.contract_service_id and c.work_id=v_work
    ) into v_service_allocated;
    if not v_service_allocated then raise exception 'contract service is not allocated to production structure'; end if;

    new.service_id:=v_service_id;
    new.unit_value:=v_unit_price;
  elsif new.service_id is not null then
    select exists(
      select 1 from public.contract_service_allocations a
      join public.contract_services cs on cs.tenant_id=a.tenant_id and cs.company_id=a.company_id and cs.id=a.contract_service_id
      where a.tenant_id=new.tenant_id and a.company_id=new.company_id and a.work_id=v_work
        and a.structure_id=new.structure_id and a.status='active' and cs.service_id=new.service_id
    ) into v_service_allocated;
    if not v_service_allocated then raise exception 'service is not allocated to production structure'; end if;
  else
    raise exception 'production contract service is required';
  end if;

  select hired_on,terminated_on into v_hired,v_terminated
  from public.employment_contracts
  where tenant_id=new.tenant_id and company_id=new.company_id and id=new.employment_contract_id;
  if not found then raise exception 'employee contract not found in company scope'; end if;
  if new.production_date<v_hired or(v_terminated is not null and new.production_date>v_terminated) then raise exception 'production date outside employment contract period'; end if;
  if date_trunc('month',new.production_date)::date<>(select competence from public.engineering_production_periods where id=new.production_period_id) then raise exception 'production date must belong to period competence'; end if;
  return new;
end
$$;

create or replace function public.create_engineering_production_shared_entry(
  p_tenant_id uuid,p_company_id uuid,p_period_id uuid,p_structure_id uuid,p_contract_service_id uuid,p_service_id uuid,
  p_production_date date,p_executed_quantity numeric,p_unit_value numeric,p_notes text,p_division_mode text,p_participants jsonb
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare
  v_entry_id uuid; v_primary_employee uuid; v_total numeric(14,2); v_count integer; v_sum numeric;
  v_item jsonb; v_employee uuid; v_percentage numeric; v_value numeric;
begin
  if not app_private.can_edit_company(p_tenant_id,p_company_id) then raise exception 'access denied'; end if;
  if p_contract_service_id is null then raise exception 'contract service required'; end if;
  if p_executed_quantity is null or p_executed_quantity<=0 then raise exception 'invalid quantity'; end if;
  if p_unit_value is null or p_unit_value<0 then raise exception 'invalid unit value'; end if;
  if p_division_mode not in ('equal','percentage','value') then raise exception 'invalid division mode'; end if;
  if jsonb_typeof(p_participants)<>'array' or jsonb_array_length(p_participants)=0 then raise exception 'participants required'; end if;
  select count(*) into v_count from jsonb_array_elements(p_participants);
  v_total:=round((p_executed_quantity*p_unit_value)::numeric,2);
  select (value->>'employmentContractId')::uuid into v_primary_employee from jsonb_array_elements(p_participants) limit 1;
  if p_division_mode='percentage' then
    select coalesce(sum((value->>'percentage')::numeric),0) into v_sum from jsonb_array_elements(p_participants);
    if abs(v_sum-100)>0.01 then raise exception 'participant percentages must total 100'; end if;
  elsif p_division_mode='value' then
    select coalesce(sum((value->>'value')::numeric),0) into v_sum from jsonb_array_elements(p_participants);
    if abs(v_sum-v_total)>0.01 then raise exception 'participant values must equal production total'; end if;
  end if;
  insert into public.engineering_production_entries(
    tenant_id,company_id,production_period_id,employment_contract_id,structure_id,contract_service_id,service_id,
    production_date,executed_quantity,unit_value,production_value,notes
  ) values (
    p_tenant_id,p_company_id,p_period_id,v_primary_employee,p_structure_id,p_contract_service_id,p_service_id,
    p_production_date,p_executed_quantity,p_unit_value,v_total,nullif(trim(p_notes),'')
  ) returning id into v_entry_id;
  for v_item in select value from jsonb_array_elements(p_participants) loop
    v_employee:=(v_item->>'employmentContractId')::uuid;
    if p_division_mode='equal' then v_percentage:=100.0/v_count;v_value:=round(v_total/v_count,2);
    elsif p_division_mode='percentage' then v_percentage:=(v_item->>'percentage')::numeric;v_value:=round(v_total*v_percentage/100.0,2);
    else v_value:=(v_item->>'value')::numeric;v_percentage:=case when v_total=0 then 100.0/v_count else v_value/v_total*100.0 end;
    end if;
    insert into public.engineering_production_participants(tenant_id,company_id,production_entry_id,employment_contract_id,percentage,participant_value)
    values(p_tenant_id,p_company_id,v_entry_id,v_employee,v_percentage,v_value);
  end loop;
  return v_entry_id;
end;
$$;

grant execute on function public.create_engineering_production_shared_entry(uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,numeric,text,text,jsonb) to authenticated;

commit;
