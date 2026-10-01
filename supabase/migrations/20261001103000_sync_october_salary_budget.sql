begin;

-- Sincroniza o planejamento salarial já criado para a competência com a
-- projeção oficial da folha. Mantém os R$ 6.000 fixos de Paulo e João na
-- função payroll_salary_projection, sem alterar salário-base contratual.
with salary_category as (
  select id, tenant_id, company_id
  from public.categories
  where upper(trim(name)) in ('SALÁRIO','SALARIOS','SALÁRIOS','SALARIO')
), projected as (
  select
    sc.tenant_id,
    sc.company_id,
    sc.id as category_id,
    p.cost_center_id,
    p.competence_month,
    sum(p.planned_salary)::numeric(14,2) as planned_salary
  from salary_category sc
  cross join lateral public.payroll_salary_projection(
    sc.tenant_id,
    sc.company_id,
    date '2026-10-01',
    date '2026-10-01'
  ) p
  group by sc.tenant_id,sc.company_id,sc.id,p.cost_center_id,p.competence_month
)
update public.budget_plans bp
set planned_amount = p.planned_salary,
    updated_at = now()
from projected p
where bp.tenant_id=p.tenant_id
  and bp.company_id=p.company_id
  and bp.category_id=p.category_id
  and bp.competence_month=p.competence_month
  and bp.flow_type='expense'
  and bp.cost_center_id is not distinct from p.cost_center_id;

commit;
