create or replace view public.engineering_contract_financial_summary as
with ad as (
  select a.tenant_id,a.company_id,a.contract_id,
    sum(case when a.status='effective' then coalesce(a.stated_value,x.lines_value,0) else 0 end) addenda_net
  from public.contract_addenda a
  left join (
    select tenant_id,company_id,addendum_id,sum(line_total) lines_value
    from public.contract_addendum_lines group by tenant_id,company_id,addendum_id
  ) x on x.tenant_id=a.tenant_id and x.company_id=a.company_id and x.addendum_id=a.id
  group by a.tenant_id,a.company_id,a.contract_id
),
meas as (
  select m.tenant_id,m.company_id,m.contract_id,
    sum(case when m.status in ('closed','approved') then fs.gross_amount else 0 end) measured_gross,
    sum(case when m.status in ('closed','approved') then fs.retained_amount else 0 end) retained_amount,
    sum(case when m.status in ('closed','approved') then fs.net_amount else 0 end) measured_net
  from public.measurements m
  join public.measurement_financial_summary fs on fs.tenant_id=m.tenant_id and fs.company_id=m.company_id and fs.measurement_id=m.id
  group by m.tenant_id,m.company_id,m.contract_id
),
contract_meas as (
  select m.tenant_id,m.company_id,m.contract_id,
    sum(case when m.status in ('closed','approved') and (ml.contract_service_id is not null or ml.contract_addendum_line_id is not null)
      then ml.gross_value else 0 end) contract_measured_gross
  from public.measurements m
  left join public.measurement_lines ml on ml.tenant_id=m.tenant_id and ml.company_id=m.company_id and ml.measurement_id=m.id
  group by m.tenant_id,m.company_id,m.contract_id
)
select c.tenant_id,c.company_id,c.work_id,c.id contract_id,c.contract_number,c.status,
 c.base_value original_contract_value,
 coalesce(ad.addenda_net,0)::numeric(18,2) addenda_net,
 (c.base_value+coalesce(ad.addenda_net,0))::numeric(18,2) updated_contract_value,
 coalesce(meas.measured_gross,0)::numeric(18,2) measured_gross,
 coalesce(meas.retained_amount,0)::numeric(18,2) retained_amount,
 coalesce(meas.measured_net,0)::numeric(18,2) measured_net,
 (c.base_value+coalesce(ad.addenda_net,0)-coalesce(contract_meas.contract_measured_gross,0))::numeric(18,2) gross_balance,
 case when c.base_value+coalesce(ad.addenda_net,0)>0
   then round(coalesce(contract_meas.contract_measured_gross,0)*100/(c.base_value+coalesce(ad.addenda_net,0)),2)
   else 0 end measured_percent
from public.engineering_contracts c
left join ad on ad.tenant_id=c.tenant_id and ad.company_id=c.company_id and ad.contract_id=c.id
left join meas on meas.tenant_id=c.tenant_id and meas.company_id=c.company_id and meas.contract_id=c.id
left join contract_meas on contract_meas.tenant_id=c.tenant_id and contract_meas.company_id=c.company_id and contract_meas.contract_id=c.id;
