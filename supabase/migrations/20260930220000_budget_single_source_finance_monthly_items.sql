begin;

-- Uma única fonte para consumo e detalhamento: finance_monthly_items.
-- "Realizado" continua sendo liquidação; "comprometido" usa previsto/pendente/realizado.
create or replace view public.budget_limit_transaction_details as
with category_map as (
 select fc.tenant_id,fc.company_id,fc.id source_category_id,fc.name source_category_name,
 case when upper(fc.name) like 'COMBUSTÍVEL%' then coalesce((select root.id from public.financial_categories root where root.tenant_id=fc.tenant_id and root.company_id=fc.company_id and upper(root.name)='COMBUSTÍVEL' and root.status='active' order by root.created_at limit 1),fc.id) else fc.id end budget_category_id
 from public.financial_categories fc
), items as (
 select fmi.tenant_id,fmi.company_id,fmi.cost_center_id,coalesce(cm.budget_category_id,fmi.category_id) budget_category_id,
 fmi.competence_month,fmi.source_kind,('monthly:'||fmi.source_kind||':'||fmi.item_id::text) detail_id,
 fmi.due_date movement_date,fmi.due_date,fmi.installment_number,fmi.installment_count,fmi.description,fmi.counterparty_name,
 coalesce(cm.source_category_name,fc.name) source_category_name,
 greatest(coalesce(fmi.planned_amount,0),coalesce(fmi.pending_amount,0)+coalesce(fmi.realized_amount,0))::numeric(18,2) amount,
 coalesce(fmi.realized_amount,0)::numeric(18,2) realized_amount,
 coalesce(fmi.pending_amount,0)::numeric(18,2) pending_amount,
 case when fmi.source_kind='card_installment' then 'Cartão de crédito' else coalesce(nullif(fe.payment_method,''),'Lançamento financeiro') end payment_method,
 cc.name card_name
 from public.finance_monthly_items fmi
 left join category_map cm on cm.tenant_id=fmi.tenant_id and cm.company_id=fmi.company_id and cm.source_category_id=fmi.category_id
 left join public.financial_categories fc on fc.id=fmi.category_id
 left join public.financial_entries fe on fmi.source_kind='financial_installment' and fe.tenant_id=fmi.tenant_id and fe.company_id=fmi.company_id and fe.id=fmi.parent_id
 left join public.card_installments ci on fmi.source_kind='card_installment' and ci.id=fmi.item_id
 left join public.card_transactions ct on ci.transaction_id=ct.id
 left join public.credit_cards cc on ct.card_id=cc.id
 where fmi.entry_type='expense' and (fmi.source_kind<>'financial_installment' or coalesce(fe.include_in_budget,true))
)
select bl.id limit_id,bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,
 i.detail_id,i.movement_date,i.description,i.counterparty_name,i.source_category_name,i.amount,i.payment_method,i.card_name,
 i.source_kind,i.installment_number,i.installment_count,i.competence_month,i.due_date,i.realized_amount,i.pending_amount
from public.budget_limits bl join items i on i.tenant_id=bl.tenant_id and i.company_id=bl.company_id
 and i.cost_center_id is not distinct from bl.cost_center_id and i.budget_category_id is not distinct from bl.category_id
 and i.competence_month=bl.competence_month where bl.status='active';

revoke all on public.budget_limit_transaction_details from public,anon;
grant select on public.budget_limit_transaction_details to authenticated;

create or replace view public.budget_monthly_control as
with planned as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month,
 sum(case when flow_type='income' then planned_amount else 0 end)::numeric(18,2) planned_income,
 sum(case when flow_type='expense' then planned_amount else 0 end)::numeric(18,2) planned_expense
 from public.budget_plans group by tenant_id,company_id,cost_center_id,category_id,competence_month
), actual_expense as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month,sum(realized_amount)::numeric(18,2) actual_expense
 from public.budget_limit_transaction_details group by tenant_id,company_id,cost_center_id,category_id,competence_month
), actual_income as (
 select fmi.tenant_id,fmi.company_id,fmi.cost_center_id,fmi.category_id,fmi.competence_month,
 sum(fmi.realized_amount)::numeric(18,2) actual_income from public.finance_monthly_items fmi
 left join public.financial_entries fe on fmi.source_kind='financial_installment' and fe.id=fmi.parent_id
 where fmi.entry_type='income' and (fmi.source_kind<>'financial_installment' or coalesce(fe.include_in_budget,true))
 group by fmi.tenant_id,fmi.company_id,fmi.cost_center_id,fmi.category_id,fmi.competence_month
), keys as (
 select tenant_id,company_id,cost_center_id,category_id,competence_month from planned union
 select tenant_id,company_id,cost_center_id,category_id,competence_month from actual_expense union
 select tenant_id,company_id,cost_center_id,category_id,competence_month from actual_income
)
select k.tenant_id,k.company_id,k.cost_center_id,k.category_id,k.competence_month,
 coalesce(p.planned_expense,0)::numeric(18,2) planned_amount,coalesce(e.actual_expense,0)::numeric(18,2) actual_expense,
 coalesce(i.actual_income,0)::numeric(18,2) actual_income,
 (coalesce(p.planned_expense,0)-coalesce(e.actual_expense,0))::numeric(18,2) expense_budget_balance,
 case when coalesce(p.planned_expense,0)>0 then round(coalesce(e.actual_expense,0)*100/coalesce(p.planned_expense,0),2) else 0 end execution_percent,
 coalesce(p.planned_income,0)::numeric(18,2) planned_income,coalesce(p.planned_expense,0)::numeric(18,2) planned_expense,
 (coalesce(p.planned_income,0)-coalesce(i.actual_income,0))::numeric(18,2) income_budget_balance,
 (coalesce(p.planned_income,0)-coalesce(p.planned_expense,0))::numeric(18,2) planned_result,
 (coalesce(i.actual_income,0)-coalesce(e.actual_expense,0))::numeric(18,2) actual_result,
 case when coalesce(p.planned_income,0)>0 then round(coalesce(i.actual_income,0)*100/coalesce(p.planned_income,0),2) else 0 end income_execution_percent
from keys k left join planned p on p.tenant_id=k.tenant_id and p.company_id=k.company_id and p.cost_center_id is not distinct from k.cost_center_id and p.category_id is not distinct from k.category_id and p.competence_month=k.competence_month
left join actual_expense e on e.tenant_id=k.tenant_id and e.company_id=k.company_id and e.cost_center_id is not distinct from k.cost_center_id and e.category_id is not distinct from k.category_id and e.competence_month=k.competence_month
left join actual_income i on i.tenant_id=k.tenant_id and i.company_id=k.company_id and i.cost_center_id is not distinct from k.cost_center_id and i.category_id is not distinct from k.category_id and i.competence_month=k.competence_month;

commit;