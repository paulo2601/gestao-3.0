begin;

-- Outubro/2026 é o marco inicial do orçamento vigente.
-- Cada competência lê a última definição existente entre 2026-10-01 e o mês consultado.
-- Assim, sem alteração o valor continua; uma nova definição passa a valer dali em diante,
-- sem reescrever competências anteriores.
create or replace view public.budget_effective_plans_v2 with (security_invoker=true) as
with months as (
  select generate_series(date '2026-10-01', date_trunc('month', current_date)::date + interval '24 months', interval '1 month')::date competence_month
), scopes as (
  select distinct tenant_id, company_id, cost_center_id, category_id, flow_type
  from public.budget_plans
  where competence_month >= date '2026-10-01'
), effective as (
  select s.tenant_id,s.company_id,s.cost_center_id,s.category_id,s.flow_type,m.competence_month,
    (
      select bp.planned_amount
      from public.budget_plans bp
      where bp.tenant_id=s.tenant_id and bp.company_id=s.company_id
        and bp.cost_center_id is not distinct from s.cost_center_id
        and bp.category_id is not distinct from s.category_id
        and bp.flow_type=s.flow_type
        and bp.competence_month between date '2026-10-01' and m.competence_month
      order by bp.competence_month desc, bp.updated_at desc nulls last, bp.created_at desc
      limit 1
    ) planned_amount
  from scopes s cross join months m
)
select tenant_id,company_id,cost_center_id,category_id,flow_type,competence_month,
       coalesce(planned_amount,0)::numeric(18,2) planned_amount
from effective
where planned_amount is not null;
revoke all on public.budget_effective_plans_v2 from public,anon;
grant select on public.budget_effective_plans_v2 to authenticated;

-- Uma única fonte mensal para os cards: entradas e saídas previstas vêm do orçamento efetivo;
-- realizadas vêm dos movimentos da própria competência.
create or replace view public.budget_monthly_control with (security_invoker=true) as
with planned as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month,
 sum(case when flow_type='income' then planned_amount else 0 end)::numeric(18,2) planned_income,
 sum(case when flow_type='expense' then planned_amount else 0 end)::numeric(18,2) planned_expense
 from public.budget_effective_plans_v2
 group by tenant_id,company_id,cost_center_id,category_id,competence_month
), expense_actual as (
 select bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,coalesce(sum(d.amount),0)::numeric(18,2) actual_expense
 from public.budget_limits bl left join public.budget_limit_transaction_details_v2 d on d.limit_id=bl.id
 where bl.status='active' group by bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month
), income_actual as (
 select fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',fs.settled_on)::date competence_month,coalesce(sum(fs.amount),0)::numeric(18,2) actual_income
 from public.financial_settlements fs join public.financial_installments fi on fi.id=fs.installment_id and fi.tenant_id=fs.tenant_id and fi.company_id=fs.company_id
 join public.financial_entries fe on fe.id=fi.entry_id and fe.tenant_id=fi.tenant_id and fe.company_id=fi.company_id
 where fe.entry_type='income' and fe.include_in_budget=true
 group by fe.tenant_id,fe.company_id,fe.cost_center_id,fe.category_id,date_trunc('month',fs.settled_on)::date
), keys as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month from planned union
 select tenant_id,company_id,cost_center_id,category_id,competence_month from expense_actual union
 select tenant_id,company_id,cost_center_id,category_id,competence_month from income_actual
)
select k.tenant_id,k.company_id,k.cost_center_id,k.category_id,k.competence_month,
 coalesce(p.planned_expense,0)::numeric(18,2) planned_amount,coalesce(e.actual_expense,0)::numeric(18,2) actual_expense,coalesce(i.actual_income,0)::numeric(18,2) actual_income,
 (coalesce(p.planned_expense,0)-coalesce(e.actual_expense,0))::numeric(18,2) expense_budget_balance,
 case when coalesce(p.planned_expense,0)>0 then round(coalesce(e.actual_expense,0)*100/coalesce(p.planned_expense,0),2) else 0 end execution_percent,
 coalesce(p.planned_income,0)::numeric(18,2) planned_income,coalesce(p.planned_expense,0)::numeric(18,2) planned_expense,
 (coalesce(p.planned_income,0)-coalesce(i.actual_income,0))::numeric(18,2) income_budget_balance,
 (coalesce(p.planned_income,0)-coalesce(p.planned_expense,0))::numeric(18,2) planned_result,
 (coalesce(i.actual_income,0)-coalesce(e.actual_expense,0))::numeric(18,2) actual_result,
 case when coalesce(p.planned_income,0)>0 then round(coalesce(i.actual_income,0)*100/coalesce(p.planned_income,0),2) else 0 end income_execution_percent
from keys k
left join planned p on p.tenant_id=k.tenant_id and p.company_id=k.company_id and p.cost_center_id is not distinct from k.cost_center_id and p.category_id is not distinct from k.category_id and p.competence_month=k.competence_month
left join expense_actual e on e.tenant_id=k.tenant_id and e.company_id=k.company_id and e.cost_center_id is not distinct from k.cost_center_id and e.category_id is not distinct from k.category_id and e.competence_month=k.competence_month
left join income_actual i on i.tenant_id=k.tenant_id and i.company_id=k.company_id and i.cost_center_id is not distinct from k.cost_center_id and i.category_id is not distinct from k.category_id and i.competence_month=k.competence_month;

commit;
