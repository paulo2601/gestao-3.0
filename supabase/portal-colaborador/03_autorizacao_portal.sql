-- Pré-requisito: 01_schema_preparacao.sql
-- A função retorna apenas um booleano, sem expor dados de colaboradores ou empresas.
create or replace function public.employee_clock_can_access()
returns boolean language sql security definer set search_path = ''
stable as $$
 select exists (
  select 1
  from public.employee_clock_access a
  join public.employment_contracts c on c.id = a.employment_contract_id
    and c.tenant_id = a.tenant_id and c.company_id = a.company_id
  join public.employee_clock_worksites w on w.work_id = a.work_id
    and w.tenant_id = a.tenant_id and w.company_id = a.company_id
  where a.user_id = (select auth.uid()) and a.enabled = true
    and w.enabled = true and c.status = 'active'
    and c.hired_on <= (now() at time zone 'America/Sao_Paulo')::date
    and (c.terminated_on is null or c.terminated_on >= (now() at time zone 'America/Sao_Paulo')::date)
 );
$$;
revoke all on function public.employee_clock_can_access() from public, anon;
grant execute on function public.employee_clock_can_access() to authenticated;
