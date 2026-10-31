-- Reprice only OPEN production entries when the configured unit price changes.
-- Runs in the same transaction as the price edit. Closed periods are immutable.
begin;

create or replace function public.recalculate_open_production_on_price_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry record;
  v_total numeric(18,2);
  v_count integer;
begin
  if tg_op <> 'UPDATE' or new.unit_value is not distinct from old.unit_value
     or new.status <> 'active' then
    return new;
  end if;

  -- An ordinary user must never gain permission to edit production by editing prices.
  if not app_private.can_edit_company(new.tenant_id,new.company_id) then
    raise exception 'production price update not authorized' using errcode='42501';
  end if;

  for v_entry in
    select e.id,e.executed_quantity
    from public.engineering_production_entries e
    join public.engineering_production_periods period
      on period.id=e.production_period_id
     and period.tenant_id=e.tenant_id
     and period.company_id=e.company_id
     and period.work_id=new.work_id
    where e.tenant_id=new.tenant_id
      and e.company_id=new.company_id
      and e.production_service_id=new.production_service_id
      and e.structure_id=new.structure_id
      and period.status='open'
    order by e.id
    for update of e
  loop
    update public.engineering_production_entries
       set unit_value=new.unit_value,updated_at=now()
     where id=v_entry.id;

    v_total:=round(v_entry.executed_quantity*new.unit_value,2);
    select count(*) into v_count
      from public.engineering_production_participants
     where tenant_id=new.tenant_id and company_id=new.company_id
       and production_entry_id=v_entry.id;

    if v_count=0 then
      -- Legacy entry without participant rows: preserve the entry's primary employee.
      insert into public.engineering_production_participants
        (tenant_id,company_id,production_entry_id,employment_contract_id,percentage,participant_value)
      select e.tenant_id,e.company_id,e.id,e.employment_contract_id,100,v_total
        from public.engineering_production_entries e where e.id=v_entry.id;
    else
      -- Preserve percentages; assign rounding residue to the last participant
      -- so the participants always sum to the exact production total.
      with shares as (
        select p.id,p.percentage,
          row_number() over(order by p.id) as rn,
          count(*) over() as cnt,
          round(v_total*p.percentage/100,2) as amount
        from public.engineering_production_participants p
        where p.tenant_id=new.tenant_id and p.company_id=new.company_id
          and p.production_entry_id=v_entry.id
      ), adjusted as (
        select id,case when rn=cnt then
          v_total-coalesce(sum(amount) over(order by rn rows between unbounded preceding and 1 preceding),0)
          else amount end as amount
        from shares
      )
      update public.engineering_production_participants p
         set participant_value=a.amount,updated_at=now()
        from adjusted a where p.id=a.id;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists engineering_production_prices_recalculate_open on public.engineering_production_prices;
create trigger engineering_production_prices_recalculate_open
after update of unit_value on public.engineering_production_prices
for each row execute function public.recalculate_open_production_on_price_change();

revoke all on function public.recalculate_open_production_on_price_change() from public,anon,authenticated;
commit;
