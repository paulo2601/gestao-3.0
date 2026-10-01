begin;

-- Paulo e João possuem adicional fixo recorrente de R$ 6.000/mês cada.
-- O salário-base contratual permanece separado; o adicional entra no custo
-- planejado mensal do orçamento e acompanha a mesma alocação do salário.
create or replace function public.payroll_salary_projection(
  p_tenant_id uuid,
  p_company_id uuid,
  p_from_competence date,
  p_to_competence date
)
returns table(
  competence_month date,
  employment_contract_id uuid,
  employee_id uuid,
  employee_name text,
  cost_center_id uuid,
  allocation_percent numeric,
  planned_salary numeric,
  realized_salary numeric,
  variance_amount numeric,
  projection_status text
)
language sql
security invoker
set search_path = ''
as $$
  with months as (
    select gs::date as competence_month
    from pg_catalog.generate_series(
      date_trunc('month', p_from_competence)::date,
      date_trunc('month', p_to_competence)::date,
      interval '1 month'
    ) gs
    where p_from_competence is not null
      and p_to_competence is not null
      and p_from_competence <= p_to_competence
  ), eligible_contracts as (
    select m.competence_month, ec.id as employment_contract_id, ec.employee_id, e.full_name as employee_name
    from months m
    join public.employment_contracts ec
      on ec.tenant_id = p_tenant_id
     and ec.company_id = p_company_id
     and ec.hired_on <= (m.competence_month + interval '1 month - 1 day')::date
     and (ec.terminated_on is null or ec.terminated_on >= m.competence_month)
    join public.employees e on e.tenant_id = ec.tenant_id and e.id = ec.employee_id
  ), projection as (
    select
      x.*,
      a.cost_center_id,
      coalesce(a.allocation_percent,100.00)::numeric(5,2) as allocation_percent,
      ct.base_salary,
      case when upper(trim(x.employee_name)) in ('PAULO ROBERTO ALVES COSTA','JOÃO COSTA DOS SANTOS') then 6000::numeric else 0::numeric end as fixed_monthly_addition,
      pc.id as payroll_closing_id,
      pc.gross_snapshot
    from eligible_contracts x
    join lateral (
      select c.base_salary
      from public.compensation_terms c
      where c.tenant_id = p_tenant_id and c.company_id = p_company_id
        and c.employment_contract_id = x.employment_contract_id
        and c.valid_from <= (x.competence_month + interval '1 month - 1 day')::date
        and (c.valid_to is null or c.valid_to >= x.competence_month)
      order by c.valid_from desc limit 1
    ) ct on true
    left join lateral (
      select ea.cost_center_id, ea.allocation_percent
      from public.employee_allocations ea
      where ea.tenant_id = p_tenant_id and ea.company_id = p_company_id
        and ea.employment_contract_id = x.employment_contract_id
        and ea.valid_from <= (x.competence_month + interval '1 month - 1 day')::date
        and (ea.valid_to is null or ea.valid_to >= x.competence_month)
    ) a on true
    left join public.payroll_closings pc
      on pc.tenant_id = p_tenant_id and pc.company_id = p_company_id
     and pc.employment_contract_id = x.employment_contract_id
     and pc.competence_month = x.competence_month and pc.status = 'closed'
  )
  select
    p.competence_month, p.employment_contract_id, p.employee_id, p.employee_name,
    p.cost_center_id, p.allocation_percent,
    round((p.base_salary + p.fixed_monthly_addition) * p.allocation_percent / 100.00,2)::numeric(14,2) as planned_salary,
    case when p.payroll_closing_id is null then 0::numeric(14,2)
      else round(p.gross_snapshot * p.allocation_percent / 100.00,2)::numeric(14,2) end as realized_salary,
    case when p.payroll_closing_id is null
      then round((p.base_salary + p.fixed_monthly_addition) * p.allocation_percent / 100.00,2)::numeric(14,2)
      else round(((p.base_salary + p.fixed_monthly_addition) - p.gross_snapshot) * p.allocation_percent / 100.00,2)::numeric(14,2) end as variance_amount,
    case when p.payroll_closing_id is null then 'planned' else 'closed' end::text as projection_status
  from projection p
  order by p.competence_month, p.employee_name, p.cost_center_id;
$$;

revoke all on function public.payroll_salary_projection(uuid,uuid,date,date) from public, anon;
grant execute on function public.payroll_salary_projection(uuid,uuid,date,date) to authenticated;

comment on function public.payroll_salary_projection(uuid,uuid,date,date)
is 'Salary budget projection including fixed recurring monthly additions of R$ 6,000 for Paulo Roberto Alves Costa and R$ 6,000 for João Costa dos Santos.';

commit;
