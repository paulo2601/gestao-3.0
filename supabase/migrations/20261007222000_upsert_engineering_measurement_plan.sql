-- Cadastro de metas isolado das linhas financeiras.
create or replace function public.upsert_engineering_measurement_plan(
 p_measurement_id uuid,p_origin_type text,p_origin_id text,
 p_target_kind text,p_target_id uuid,p_planned_quantity numeric
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_measurement public.measurements%rowtype;
 v_price numeric;
 v_id uuid;
begin
 if p_planned_quantity is null or p_planned_quantity<=0 then
  raise exception 'Quantidade planejada deve ser positiva';
 end if;
 if p_origin_type not in ('tower','addendum','provisional','other')
    or p_target_kind not in ('contract','addendum')
    or nullif(btrim(p_origin_id),'') is null then
  raise exception 'Origem ou serviço inválido';
 end if;
 select * into v_measurement from public.measurements where id=p_measurement_id for update;
 if not found or v_measurement.status<>'draft' then
  raise exception 'Planejamento disponível somente para medição em rascunho';
 end if;
 if not app_private.can_edit_company(v_measurement.tenant_id,v_measurement.company_id) then
  raise exception 'Sem permissão';
 end if;
 if p_target_kind='contract' then
  select unit_price into v_price from public.contract_services
  where id=p_target_id and contract_id=v_measurement.contract_id
  and tenant_id=v_measurement.tenant_id and company_id=v_measurement.company_id;
 else
  select l.unit_price into v_price from public.contract_addendum_lines l
  join public.contract_addenda a on a.id=l.addendum_id
  where l.id=p_target_id and a.contract_id=v_measurement.contract_id
  and l.tenant_id=v_measurement.tenant_id and l.company_id=v_measurement.company_id
  and a.tenant_id=v_measurement.tenant_id and a.company_id=v_measurement.company_id;
 end if;
 if v_price is null then raise exception 'Serviço não pertence ao contrato'; end if;
 insert into public.engineering_measurement_plans
 (tenant_id,company_id,contract_id,measurement_id,competence,origin_type,origin_id,
 target_kind,target_id,planned_quantity,unit_price_snapshot)
 values(v_measurement.tenant_id,v_measurement.company_id,v_measurement.contract_id,
 p_measurement_id,v_measurement.competence,p_origin_type,btrim(p_origin_id),
 p_target_kind,p_target_id,p_planned_quantity,v_price)
 on conflict(measurement_id,origin_type,origin_id,target_kind,target_id)
 do update set planned_quantity=excluded.planned_quantity,
 unit_price_snapshot=excluded.unit_price_snapshot,updated_at=now()
 returning id into v_id;
 if (select coalesce(sum(executed_quantity),0) from public.engineering_execution_entries where plan_id=v_id)>p_planned_quantity then
  raise exception 'Meta inferior à quantidade já executada';
 end if;
 return v_id;
end;
$$;
revoke all on function public.upsert_engineering_measurement_plan(uuid,text,text,text,uuid,numeric) from public;
grant execute on function public.upsert_engineering_measurement_plan(uuid,text,text,text,uuid,numeric) to authenticated;
-- Não permitir gravações diretas pelo cliente: a RPC valida contrato, competência e saldo.
drop policy if exists engineering_plans_insert on public.engineering_measurement_plans;
drop policy if exists engineering_plans_update on public.engineering_measurement_plans;
drop policy if exists engineering_plans_delete on public.engineering_measurement_plans;
revoke insert,update,delete on public.engineering_measurement_plans from anon,authenticated;
