begin;

-- Sincroniza o planejamento salarial de outubro com a projeção oficial da folha.
-- A categoria usada pelo orçamento é PAGAMENTO DE SALÁRIO.
-- Paulo e João mantêm R$ 6.000/mês fixos na payroll_salary_projection,
-- separados do salário-base contratual.
with target as (
  select bp.id,bp.tenant_id,bp.company_id,bp.cost_center_id
  from public.budget_plans bp
  join public.financial_categories c on c.id=bp.category_id
  where bp.competence_month=date '2026-10-01'
    and bp.flow_type='expense'
    and upper(trim(c.name))='PAGAMENTO DE SALÁRIO'
), projected as (
  select t.id,round(sum(p.planned_salary),2)::numeric(14,2) as total
  from target t
  cross join lateral public.payroll_salary_projection(
    t.tenant_id,t.company_id,date '2026-10-01',date '2026-10-01'
  ) p
  where p.cost_center_id is not distinct from t.cost_center_id
  group by t.id
)
update public.budget_plans bp
set planned_amount=p.total,updated_at=now()
from projected p
where bp.id=p.id;

commit;
