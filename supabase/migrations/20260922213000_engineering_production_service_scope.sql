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

  if not found or v_structure_work<>v_work then
    raise exception 'structure does not belong to production work';
  end if;

  if new.service_id is not null then
    select exists(
      select 1
      from public.contract_service_allocations a
      join public.contract_services cs
        on cs.tenant_id=a.tenant_id
       and cs.company_id=a.company_id
       and cs.id=a.contract_service_id
      where a.tenant_id=new.tenant_id
        and a.company_id=new.company_id
        and a.work_id=v_work
        and a.structure_id=new.structure_id
        and a.status='active'
        and cs.service_id=new.service_id
    ) into v_service_allocated;

    if not v_service_allocated then
      raise exception 'service is not allocated to production structure';
    end if;
  end if;

  select hired_on,terminated_on into v_hired,v_terminated
  from public.employment_contracts
  where tenant_id=new.tenant_id and company_id=new.company_id and id=new.employment_contract_id;

  if not found then raise exception 'employee contract not found in company scope'; end if;
  if new.production_date<v_hired or(v_terminated is not null and new.production_date>v_terminated) then
    raise exception 'production date outside employment contract period';
  end if;
  if date_trunc('month',new.production_date)::date<>(select competence from public.engineering_production_periods where id=new.production_period_id) then
    raise exception 'production date must belong to period competence';
  end if;

  return new;
end
$$;