alter table public.measurement_lines
  add column if not exists exact_gross_value numeric(18,2)
  check (exact_gross_value is null or exact_gross_value >= 0);

comment on column public.measurement_lines.exact_gross_value is
  'Valor monetário exato informado no modo Valor; não deve ser reconstruído pela quantidade fracionária.';

create or replace function public.sync_measurement_retention()
returns trigger language plpgsql set search_path='' as $$
declare v_status text;v_gross numeric(18,2);
begin
  select status into v_status from public.measurements where tenant_id=new.tenant_id and company_id=new.company_id and id=new.measurement_id;
  if not found then raise exception 'measurement not found';end if;
  if v_status<>'draft' then raise exception 'retentions can only change while measurement is draft';end if;
  select coalesce(sum(coalesce(exact_gross_value,gross_value)),0) into v_gross from public.measurement_lines where tenant_id=new.tenant_id and company_id=new.company_id and measurement_id=new.measurement_id;
  new.base_amount:=v_gross;
  if new.calculation_type='percentage' then new.amount:=round(v_gross*new.rate/100,2);else new.amount:=new.fixed_amount;end if;
  return new;
end $$;

-- The production database also receives the updated replace_measurement_stage RPC.
-- Its seventh optional argument, p_exact_value, is persisted in exact_gross_value.
-- See the applied Supabase migration exact_measurement_value for the full atomic RPC body.
