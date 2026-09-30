begin;

create or replace view public.budget_limit_transaction_details as
with category_map as (
 select fc.tenant_id,fc.company_id,fc.id source_category_id,fc.name source_category_name,
 case when upper(fc.name) like 'COMBUSTÍVEL%' then coalesce((select root.id from public.financial_categories root where root.tenant_id=fc.tenant_id and root.company_id=fc.company_id and upper(root.name)='COMBUSTÍVEL' and root.status='active' order by root.created_at limit 1),fc.id) else fc.id end budget_category_id
 from public.financial_categories fc
), rows as (
 select fmi.tenant_id,fmi.company_id,fmi.cost_center_id,coalesce(cm.budget_category_id,fmi.category_id) budget_category_id,
 fmi.competence_month,fmi.source_kind,('monthly:'||fmi.source_kind||':'||fmi.item_id::text) detail_id,
 case when fmi.source_kind='card_installment' then ct.purchase_date else fmi.due_date end movement_date,
 fmi.due_date,fmi.installment_number,fmi.installment_count,fmi.description,fmi.counterparty_name,
 coalesce(cm.source_category_name,fc.name) source_category_name,
 fmi.planned_amount::numeric(18,2) amount,
 case when fmi.source_kind='card_installment' then 'Cartão de crédito' else coalesce(nullif(fe.payment_method,''),'Lançamento financeiro') end payment_method,
 cc.name card_name
 from public.finance_monthly_items fmi
 left join category_map cm on cm.tenant_id=fmi.tenant_id and cm.company_id=fmi.company_id and cm.source_category_id=fmi.category_id
 left join public.financial_categories fc on fc.id=fmi.category_id
 left join public.financial_entries fe on fmi.source_kind='financial_installment' and fe.tenant_id=fmi.tenant_id and fe.company_id=fmi.company_id and fe.id=fmi.parent_id
 left join public.card_installments ci on fmi.source_kind='card_installment' and ci.id=fmi.item_id
 left join public.card_transactions ct on ci.tenant_id=ct.tenant_id and ci.company_id=ct.company_id and ci.transaction_id=ct.id
 left join public.credit_cards cc on ci.tenant_id=cc.tenant_id and ci.company_id=cc.company_id and ci.card_id=cc.id
 where fmi.entry_type='expense'
   and (fmi.source_kind<>'financial_installment' or coalesce(fe.include_in_budget,true))
)
select bl.id limit_id,bl.tenant_id,bl.company_id,bl.cost_center_id,bl.category_id,bl.competence_month,
 r.detail_id,r.movement_date,r.description,r.counterparty_name,r.source_category_name,r.amount,r.payment_method,r.card_name,
 r.source_kind,r.installment_number,r.installment_count,r.competence_month,r.due_date
from public.budget_limits bl
join rows r on r.tenant_id=bl.tenant_id and r.company_id=bl.company_id
 and r.cost_center_id is not distinct from bl.cost_center_id
 and r.budget_category_id is not distinct from bl.category_id
 and r.competence_month=bl.competence_month
where bl.status='active';

revoke all on public.budget_limit_transaction_details from public,anon;
grant select on public.budget_limit_transaction_details to authenticated;

commit;
