-- Commercial entitlements are restrictive additions to existing tenant/company RLS.
-- Existing exempt legacy tenants remain usable; new SaaS tenants require an active plan.
do $$
declare item record;
begin
 for item in select * from (values ('financial_entries','financeiro'),
('financial_accounts','bancos'),
('financial_account_movements','bancos'),
('financial_settlements','financeiro'),
('financial_installments','financeiro'),
('credit_cards','cartoes'),
('card_transactions','cartoes'),
('card_statements','cartoes'),
('employment_contracts','rh'),
('employee_attendance_daily','rh'),
('employee_occurrences','rh'),
('payroll_closings','rh'),
('engineering_execution_entries','engenharia'),
('engineering_service_controls','engenharia'),
('engineering_service_control_entries','engenharia'),
('measurements','medicoes'),
('measurement_lines','medicoes'),
('engineering_production_periods','producao'),
('engineering_production_allocations','producao'),
('engineering_production_services','producao')) as x(table_name,module_code)
 loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=item.table_name and policyname='commercial_module_entitlement') then
   execute format('create policy commercial_module_entitlement on public.%I as restrictive for all to authenticated using (public.platform_module_allowed(tenant_id,%L)) with check (public.platform_module_allowed(tenant_id,%L))',item.table_name,item.module_code,item.module_code);
  end if;
 end loop;
end $$;
