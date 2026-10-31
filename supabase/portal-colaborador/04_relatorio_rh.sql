-- Consulta de eventos para relatórios RH, sem expor GPS ao relatório.
-- Revisar autorização de papéis antes da implantação.
create or replace function public.employee_clock_monthly_report(
 p_company_id uuid, p_start date, p_end date
) returns table (
 employment_contract_id uuid,
 work_id uuid,
 event_type text,
 occurred_at timestamptz,
 receipt_code uuid
) language plpgsql security definer set search_path = '' stable as $$
begin
 if (select auth.uid()) is null then raise exception 'Autenticação obrigatória'; end if;
 if p_start is null or p_end is null or p_end < p_start or p_end > p_start + 35 then
   raise exception 'Período inválido: máximo de 36 dias';
 end if;
 if not exists (
  select 1 from public.company_memberships cm
  where cm.company_id = p_company_id and cm.user_id = (select auth.uid())
    and cm.status = 'active' and cm.role in ('company_admin')
 ) and not exists (
  select 1 from public.tenant_memberships tm
  join public.companies c on c.tenant_id = tm.tenant_id
  where c.id = p_company_id and tm.user_id = (select auth.uid())
    and tm.status = 'active' and tm.role = 'tenant_owner'
 ) then raise exception 'Sem autorização para o relatório'; end if;
 return query
 select e.employment_contract_id,e.work_id,e.event_type,e.occurred_at,e.receipt_code
 from public.employee_clock_events e
 where e.company_id=p_company_id
   and exists (select 1 from public.employment_contracts ec where ec.id=e.employment_contract_id and ec.company_id=e.company_id and ec.tenant_id=e.tenant_id)
   and (e.occurred_at at time zone 'America/Sao_Paulo')::date between p_start and p_end
 order by e.employment_contract_id,e.occurred_at;
end;
$$;
revoke all on function public.employee_clock_monthly_report(uuid,date,date) from public,anon;
grant execute on function public.employee_clock_monthly_report(uuid,date,date) to authenticated;
