begin;

create or replace function public.delete_financial_installment_scope(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_scope text
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_entry_id uuid;
  v_number integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_scope not in ('single','following') then raise exception 'invalid maintenance scope'; end if;

  select i.entry_id,i.installment_number into v_entry_id,v_number
  from public.financial_installments i
  where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.id=p_installment_id
  for update;
  if not found then raise exception 'financial installment not found'; end if;

  if exists (
    select 1 from public.financial_installments i
    join public.financial_settlements s on s.tenant_id=i.tenant_id and s.company_id=i.company_id and s.installment_id=i.id
    where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry_id
      and (i.installment_number=v_number or (p_scope='following' and i.installment_number>=v_number))
  ) then raise exception 'settled financial installments cannot be deleted'; end if;

  if exists (select 1 from public.payroll_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=v_entry_id)
     or exists (select 1 from public.measurement_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=v_entry_id)
     or exists (select 1 from public.financial_recurrence_occurrences o where o.tenant_id=p_tenant_id and o.company_id=p_company_id and o.entry_id=v_entry_id)
  then raise exception 'linked financial entry cannot be deleted manually'; end if;

  delete from public.financial_installments i
  where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry_id
    and (i.installment_number=v_number or (p_scope='following' and i.installment_number>=v_number));

  if not exists (select 1 from public.financial_installments i where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry_id) then
    delete from public.financial_entries e where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=v_entry_id;
  end if;
end;
$$;

create or replace function public.update_financial_installment_scope(
  p_tenant_id uuid,
  p_company_id uuid,
  p_installment_id uuid,
  p_scope text,
  p_description text,
  p_counterparty_name text,
  p_category_id uuid,
  p_cost_center_id uuid,
  p_due_date date,
  p_amount numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_entry public.financial_entries%rowtype;
  v_number integer;
  v_new_entry_id uuid;
  v_kind text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'not authorized for company'; end if;
  if p_scope not in ('single','following') then raise exception 'invalid maintenance scope'; end if;
  if length(btrim(coalesce(p_description,'')))=0 then raise exception 'description is required'; end if;
  if p_due_date is null then raise exception 'due date is required'; end if;
  if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'amount must be positive with at most two decimal places'; end if;

  select e.*,i.installment_number into v_entry,v_number
  from public.financial_installments i
  join public.financial_entries e on e.tenant_id=i.tenant_id and e.company_id=i.company_id and e.id=i.entry_id
  where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.id=p_installment_id
  for update of i,e;
  if not found then raise exception 'financial installment not found'; end if;

  if exists (
    select 1 from public.financial_installments i
    join public.financial_settlements s on s.tenant_id=i.tenant_id and s.company_id=i.company_id and s.installment_id=i.id
    where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry.id
      and (i.installment_number=v_number or (p_scope='following' and i.installment_number>=v_number))
  ) then raise exception 'settled financial installments cannot be edited'; end if;

  if exists (select 1 from public.payroll_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=v_entry.id)
     or exists (select 1 from public.measurement_finance_links l where l.tenant_id=p_tenant_id and l.company_id=p_company_id and l.financial_entry_id=v_entry.id)
     or exists (select 1 from public.financial_recurrence_occurrences o where o.tenant_id=p_tenant_id and o.company_id=p_company_id and o.entry_id=v_entry.id)
  then raise exception 'linked financial entry cannot be edited manually'; end if;

  select fc.kind into v_kind from public.financial_categories fc
  where fc.tenant_id=p_tenant_id and fc.company_id=p_company_id and fc.id=p_category_id and fc.status='active';
  if not found or not (v_kind='both' or v_kind=v_entry.entry_type) then raise exception 'active category is incompatible with financial entry type'; end if;
  if p_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.tenant_id=p_tenant_id and cc.company_id=p_company_id and cc.id=p_cost_center_id and cc.status='active'
  ) then raise exception 'active cost center not found in company'; end if;

  insert into public.financial_entries(
    tenant_id,company_id,entry_type,description,counterparty_name,category_id,cost_center_id,competence_month,notes,created_by,
    work_id,engineering_contract_id,measurement_id,planned_account_id,payment_method,planned_account_company_id,include_in_budget
  ) values (
    p_tenant_id,p_company_id,v_entry.entry_type,btrim(p_description),nullif(btrim(p_counterparty_name),''),p_category_id,p_cost_center_id,
    date_trunc('month',p_due_date)::date,nullif(btrim(p_notes),''),auth.uid(),v_entry.work_id,v_entry.engineering_contract_id,v_entry.measurement_id,
    v_entry.planned_account_id,v_entry.payment_method,v_entry.planned_account_company_id,v_entry.include_in_budget
  ) returning id into v_new_entry_id;

  update public.financial_installments i
  set entry_id=v_new_entry_id,
      due_date=(p_due_date + make_interval(months=>i.installment_number-v_number))::date,
      competence_month=date_trunc('month',(p_due_date + make_interval(months=>i.installment_number-v_number))::date)::date,
      amount=p_amount,
      updated_at=now()
  where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry.id
    and (i.installment_number=v_number or (p_scope='following' and i.installment_number>=v_number));

  if not exists (select 1 from public.financial_installments i where i.tenant_id=p_tenant_id and i.company_id=p_company_id and i.entry_id=v_entry.id) then
    delete from public.financial_entries e where e.tenant_id=p_tenant_id and e.company_id=p_company_id and e.id=v_entry.id;
  end if;

  return v_new_entry_id;
end;
$$;

revoke all on function public.delete_financial_installment_scope(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.delete_financial_installment_scope(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.update_financial_installment_scope(uuid,uuid,uuid,text,text,text,uuid,uuid,date,numeric,text) from public,anon;
grant execute on function public.update_financial_installment_scope(uuid,uuid,uuid,text,text,text,uuid,uuid,date,numeric,text) to authenticated;

commit;