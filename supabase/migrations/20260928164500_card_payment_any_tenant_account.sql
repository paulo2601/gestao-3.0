begin;

create or replace function app_private.record_card_statement_payment_impl(
 p_tenant_id uuid,p_company_id uuid,p_statement_id uuid,p_account_id uuid,p_paid_on date,p_amount numeric,p_idempotency_key text,p_notes text default null
) returns table(payment_id uuid,paid_total numeric,remaining_amount numeric,payment_status text,available_limit numeric)
language plpgsql security definer set search_path to '' as $$
declare v_statement public.card_statements%rowtype;v_existing public.card_statement_payments%rowtype;v_paid_total numeric(14,2);v_remaining numeric(14,2);v_status text;v_payment_id uuid;v_available numeric(14,2);v_account_company_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.can_manage_company(p_tenant_id,p_company_id) then raise exception 'company management permission required'; end if;
 if p_paid_on is null then raise exception 'payment date is required'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'payment amount must be greater than zero'; end if;
 if round(p_amount,2)<>p_amount then raise exception 'payment amount supports at most two decimal places'; end if;
 if length(btrim(coalesce(p_idempotency_key,'')))=0 then raise exception 'idempotency key is required'; end if;
 select * into v_existing from public.card_statement_payments csp where csp.tenant_id=p_tenant_id and csp.company_id=p_company_id and csp.idempotency_key=btrim(p_idempotency_key);
 if found then
  if v_existing.statement_id<>p_statement_id or v_existing.account_id<>p_account_id or v_existing.paid_on<>p_paid_on or v_existing.amount<>p_amount then raise exception 'idempotency key already used with different statement payment data'; end if;
  select ccsb.paid_amount,ccsb.remaining_amount,ccsb.payment_status into v_paid_total,v_remaining,v_status from public.credit_card_statement_balances ccsb where ccsb.statement_id=p_statement_id;
  select ccl.available_limit into v_available from public.credit_card_limits ccl where ccl.card_id=v_existing.card_id;
  return query select v_existing.id,v_paid_total,v_remaining,v_status,v_available;return;
 end if;
 select * into v_statement from public.card_statements cs where cs.tenant_id=p_tenant_id and cs.company_id=p_company_id and cs.id=p_statement_id for update;
 if not found then raise exception 'closed card statement not found in company'; end if;
 select fa.company_id into v_account_company_id from public.financial_accounts fa where fa.tenant_id=p_tenant_id and fa.id=p_account_id and fa.status='active';
 if v_account_company_id is null then raise exception 'active payment account not found in tenant'; end if;
 select coalesce(sum(csp.amount),0)::numeric(14,2) into v_paid_total from public.card_statement_payments csp where csp.tenant_id=p_tenant_id and csp.company_id=p_company_id and csp.statement_id=p_statement_id;
 insert into public.card_statement_payments(tenant_id,company_id,statement_id,card_id,account_id,paid_on,amount,idempotency_key,notes,created_by)
 values(p_tenant_id,p_company_id,p_statement_id,v_statement.card_id,p_account_id,p_paid_on,p_amount,btrim(p_idempotency_key),nullif(btrim(p_notes),''),auth.uid()) returning id into v_payment_id;
 insert into public.financial_account_movements(tenant_id,company_id,account_id,movement_on,direction,amount,source_type,source_id,description)
 values(p_tenant_id,v_account_company_id,p_account_id,p_paid_on,'outflow',p_amount,'card_statement_payment',v_payment_id,'Pagamento de fatura de cartão');
 v_paid_total:=(v_paid_total+p_amount)::numeric(14,2);v_remaining:=greatest(v_statement.statement_amount-v_paid_total,0)::numeric(14,2);v_status:=case when v_remaining=0 then 'paid' else 'partial' end;
 insert into public.audit_log(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_company_id,auth.uid(),'card_statement_payment.recorded','card_statement_payment',v_payment_id,pg_catalog.jsonb_build_object('statement_id',p_statement_id,'card_id',v_statement.card_id,'account_id',p_account_id,'payment_account_company_id',v_account_company_id,'paid_on',p_paid_on,'amount',p_amount,'idempotency_key',btrim(p_idempotency_key),'status_after',v_status,'overpayment',greatest(v_paid_total-v_statement.statement_amount,0)));
 select ccl.available_limit into v_available from public.credit_card_limits ccl where ccl.card_id=v_statement.card_id;
 return query select v_payment_id,v_paid_total,v_remaining,v_status,v_available;
end;$$;

comment on function app_private.record_card_statement_payment_impl(uuid,uuid,uuid,uuid,date,numeric,text,text)
is 'Pays a statement from any active account in the same tenant. The statement keeps its accounting company and the selected account owns the cash outflow.';

commit;
