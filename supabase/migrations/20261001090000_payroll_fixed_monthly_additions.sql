-- Orçamento mensal: Paulo e João possuem adicional fixo recorrente de R$ 6.000/mês cada.
-- Mantém o salário-base contratual separado do adicional e incorpora o custo fixo
-- somente na projeção mensal da folha/orçamento.

create or replace function public.payroll_salary_projection(
  p_tenant_id uuid,
  p_company_id uuid,
  p_competence_month date
)
returns table (
  competence_month date,
  employee_id uuid,
  employee_name text,
  cost_center_id uuid,
  allocation_percent numeric,
  planned_salary numeric,
  realized_salary numeric,
  projection_status text
)
language sql
stable
security invoker
set search_path = public
as $$
  with active_contracts as (
    select
      e.id as employee_id,
      e.full_name as employee_name,
      c.id as contract_id,
      c.cost_center_id,
      ct.base_salary,
      case
        when upper(trim(e.full_name)) in (
          'PAULO ROBERTO ALVES COSTA',
          'JOÃO COSTA DOS SANTOS'
        ) then 6000::numeric
        else 0::numeric
      end as fixed_monthly_addition
    from public.hr_employees e
    join public.hr_contracts c
      on c.employee_id = e.id
     and c.tenant_id = p_tenant_id
     and c.company_id = p_company_id
     and c.admission_date <= (p_competence_month + interval '1 month - 1 day')::date
     and (c.termination_date is null or c.termination_date >= p_competence_month)
    join lateral (
      select t.base_salary
      from public.hr_compensation_terms t
      where t.contract_id = c.id
        and t.tenant_id = p_tenant_id
        and t.company_id = p_company_id
        and t.valid_from <= (p_competence_month + interval '1 month - 1 day')::date
        and (t.valid_to is null or t.valid_to >= p_competence_month)
      order by t.valid_from desc
      limit 1
    ) ct on true
    where e.tenant_id = p_tenant_id
      and e.company_id = p_company_id
  ), allocated as (
    select
      a.*,
      coalesce(sum(al.allocation_percent), 0) as explicit_allocation
    from active_contracts a
    left join public.hr_cost_allocations al
      on al.contract_id = a.contract_id
     and al.tenant_id = p_tenant_id
     and al.company_id = p_company_id
     and al.valid_from <= (p_competence_month + interval '1 month - 1 day')::date
     and (al.valid_to is null or al.valid_to >= p_competence_month)
    group by a.employee_id, a.employee_name, a.contract_id, a.cost_center_id, a.base_salary, a.fixed_monthly_addition
  )
  select
    p_competence_month,
    a.employee_id,
    a.employee_name,
    coalesce(al.cost_center_id, a.cost_center_id) as cost_center_id,
    coalesce(al.allocation_percent, case when a.explicit_allocation = 0 then 100 else 0 end)::numeric as allocation_percent,
    round(
      (a.base_salary + a.fixed_monthly_addition)
      * coalesce(al.allocation_percent, case when a.explicit_allocation = 0 then 100 else 0 end)
      / 100,
      2
    ) as planned_salary,
    0::numeric as realized_salary,
    'planned'::text as projection_status
  from allocated a
  left join public.hr_cost_allocations al
    on al.contract_id = a.contract_id
   and al.tenant_id = p_tenant_id
   and al.company_id = p_company_id
   and al.valid_from <= (p_competence_month + interval '1 month - 1 day')::date
   and (al.valid_to is null or al.valid_to >= p_competence_month)
  where coalesce(al.allocation_percent, case when a.explicit_allocation = 0 then 100 else 0 end) > 0;
$$;
