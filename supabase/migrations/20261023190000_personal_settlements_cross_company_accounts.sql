begin;
create or replace function app_private.create_personal_finance_link(
  p_tenant_id uuid,p_company_id uuid,p_account_id uuid,p_event_date date,p_entry_type text,
  p_person_name text,p_description text,p_notes text,p_reference text)
returns table(financial_entry_id uuid, financial_settlement_id uuid, financial_account_id uuid)
language plpgsql security definer set search_path='' as $$
declare v_category uuid; v_entry uuid; v_installment uuid; v_fin_settlement uuid; v_amount numeric(14,2); v_account_company uuid;
begin
  if p_entry_type not in ('income','expense') then raise exception 'invalid personal settlement financial type'; end if;
  if p_event_date is null or p_event_date>current_date then raise exception 'A movimentação bancária não pode ter data futura.'; end if;
  select a.company_id into v_account_company from public.financial_accounts a where a.tenant_id=p_tenant_id and a.id=p_account_id and a.status='active'; if v_account_company is null or not app_private.can_manage_company(p_tenant_id,v_account_company) then raise exception 'Conta financeira não encontrada ou sem permissão.'; end if;
  v_amount := nullif(split_part(p_reference,'|',1),'')::numeric;
  if v_amount is null or v_amount<=0 then raise exception 'invalid personal settlement amount'; end if;
  v_category:=app_private.personal_settlement_category(p_tenant_id,v_account_company);
  select r.entry_id,r.installment_id into v_entry,v_installment from public.create_single_financial_entry(
    p_tenant_id,v_account_company,p_entry_type,
    'Acerto pessoal · '||btrim(p_person_name)||' · '||btrim(p_description),
    btrim(p_person_name),v_category,null,date_trunc('month',p_event_date)::date,p_event_date,v_amount,
    nullif(btrim(coalesce(p_notes,'')),'')
  ) r;
  select r.settlement_id into v_fin_settlement from public.record_financial_settlement(
    p_tenant_id,v_account_company,v_installment,p_account_id,p_event_date,v_amount,
    'personal-settlement:'||split_part(p_reference,'|',2),nullif(btrim(coalesce(p_notes,'')),'')
  ) r;
  return query select v_entry,v_fin_settlement,p_account_id;
end;$$;
create or replace function app_private.delete_personal_finance_link(p_tenant_id uuid,p_company_id uuid,p_entry_id uuid,p_financial_settlement_id uuid)
returns void language plpgsql security definer set search_path='' as $
declare v_account_company uuid;
begin
  select company_id into v_account_company from public.financial_entries where tenant_id=p_tenant_id and id=p_entry_id;
  if v_account_company is null then v_account_company:=p_company_id; end if;
  if not app_private.can_manage_company(p_tenant_id,v_account_company) then raise exception 'Sem permissão para estornar nesta empresa.'; end if;
  if p_financial_settlement_id is not null then
    delete from public.financial_account_movements where tenant_id=p_tenant_id and company_id=v_account_company and source_type='settlement' and source_id=p_financial_settlement_id;
    delete from public.financial_settlements where tenant_id=p_tenant_id and company_id=v_account_company and id=p_financial_settlement_id;
  end if;
  if p_entry_id is not null then
    delete from public.financial_installments where tenant_id=p_tenant_id and company_id=v_account_company and entry_id=p_entry_id;
    delete from public.financial_entries where tenant_id=p_tenant_id and company_id=v_account_company and id=p_entry_id;
  end if;
end;$$;
commit;
