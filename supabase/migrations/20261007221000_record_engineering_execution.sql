-- Operações transacionais para planejamento/execução. Executar após a migração de tabelas.
create or replace function public.record_engineering_execution(
 p_plan_id uuid, p_execution_date date, p_quantity numeric,
 p_unit_reference text default null, p_notes text default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_plan public.engineering_measurement_plans%rowtype;
 v_total numeric;
 v_existing integer;
 v_id uuid;
begin
 if p_quantity is null or p_quantity<=0 or p_execution_date is null then
   raise exception 'Quantidade positiva e data são obrigatórias';
 end if;
 select * into v_plan from public.engineering_measurement_plans where id=p_plan_id for update;
 if not found then raise exception 'Planejamento não encontrado ou acesso negado'; end if;
 if not app_private.can_edit_company(v_plan.tenant_id,v_plan.company_id) then
   raise exception 'Sem permissão para registrar execução';
 end if;
 if p_execution_date < v_plan.competence or p_execution_date >= (v_plan.competence + interval '1 month')::date then
   raise exception 'Data fora da competência planejada';
 end if;
 select coalesce(sum(executed_quantity),0) into v_total
 from public.engineering_execution_entries where plan_id=p_plan_id;
 if v_total+p_quantity > v_plan.planned_quantity then
   raise exception 'Quantidade executada excede o planejamento';
 end if;
 if nullif(btrim(coalesce(p_unit_reference,'')),'') is not null then
   select count(*) into v_existing from public.engineering_execution_entries
   where plan_id=p_plan_id and unit_reference=btrim(p_unit_reference);
   if v_existing>0 then raise exception 'Unidade já registrada nesta meta'; end if;
 end if;
 insert into public.engineering_execution_entries
 (tenant_id,company_id,plan_id,execution_date,executed_quantity,unit_reference,notes)
 values(v_plan.tenant_id,v_plan.company_id,p_plan_id,p_execution_date,p_quantity,
 nullif(btrim(coalesce(p_unit_reference,'')),''),p_notes)
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.record_engineering_execution(uuid,date,numeric,text,text) from public;
grant execute on function public.record_engineering_execution(uuid,date,numeric,text,text) to authenticated;
create unique index if not exists engineering_execution_unique_unit_idx
on public.engineering_execution_entries(plan_id,unit_reference) where unit_reference is not null;
-- Impedir que um cliente bypass o RPC para registrar quantidades sem validar saldo:
drop policy if exists engineering_execution_insert on public.engineering_execution_entries;
create policy engineering_execution_insert on public.engineering_execution_entries
for insert with check (
 app_private.can_edit_company(tenant_id,company_id)
 and exists(select 1 from public.engineering_measurement_plans p
 where p.id=plan_id and p.tenant_id=tenant_id and p.company_id=company_id)
);
-- Atenção: INSERT direto ainda é possível com esta política.
-- Bloquear insert direto exigirá política/arquitetura específica de privilégios
-- antes de habilitar escrita no cliente.
