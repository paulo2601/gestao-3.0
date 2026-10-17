-- Restrictive commercial entitlements for additional tenant-scoped operational tables.
-- Administrative identity, memberships, and subscription tables intentionally excluded.
do $$
declare item record;
begin
 for item in select * from (values
 ('budget_annual_plans','limites'),
 ('budget_item_treatments','limites'),
 ('budget_limits','limites'),
 ('budget_planning_settings','limites'),
 ('budget_plans','limites'),
 ('card_installments','cartoes'),
 ('card_limit_manual_adjustments','cartoes'),
 ('card_statement_payments','cartoes'),
 ('compensation_terms','rh'),
 ('employee_allocations','rh'),
 ('employee_bank_hour_closings','rh'),
 ('employee_bank_hour_movements','rh'),
 ('employee_documents','rh'),
 ('employee_epi_deliveries','rh'),
 ('employee_occurrence_payroll_links','rh'),
 ('employee_profiles','rh'),
 ('employees','rh'),
 ('hr_fixed_compensation_items','rh'),
 ('hr_fortnight_closings','rh'),
 ('payroll_closing_event_snapshots','rh'),
 ('payroll_events','rh'),
 ('payroll_finance_links','rh'),
 ('payroll_finance_settings','rh'),
 ('payroll_statutory_calculations','rh'),
 ('contract_addenda','engenharia'),
 ('contract_addendum_lines','engenharia'),
 ('contract_service_allocations','engenharia'),
 ('contract_services','engenharia'),
 ('engineering_budgets','engenharia'),
 ('engineering_contract_retention_rules','engenharia'),
 ('engineering_measurement_line_executions','engenharia'),
 ('engineering_measurement_origin_profiles','engenharia'),
 ('engineering_measurement_plans','engenharia'),
 ('engineering_measurement_service_scopes','engenharia'),
 ('engineering_revenue_projections','engenharia'),
 ('engineering_service_control_items','engenharia'),
 ('provisional_contract_lines','engenharia'),
 ('provisional_contracts','engenharia'),
 ('work_structures','engenharia'),
 ('works','engenharia'),
 ('engineering_production_participants','producao'),
 ('engineering_production_prices','producao'),
 ('engineering_production_reopen_log','producao'),
 ('financial_categories','financeiro'),
 ('financial_recurrence_occurrences','financeiro'),
 ('financial_recurrence_rules','financeiro'),
 ('financial_transfers','financeiro'),
 ('cost_centers','financeiro'),
 ('personal_settlement_items','financeiro'),
 ('personal_settlement_movements','financeiro'),
 ('personal_settlements','financeiro'),
 ('travel_budget_items','financeiro'),
 ('travel_budgets','financeiro'),
 ('measurement_finance_links','medicoes'),
 ('measurement_payment_adjustments','medicoes'),
 ('measurement_reopen_log','medicoes'),
 ('measurement_retentions','medicoes')
 ) as x(table_name,module_code)
 loop
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=item.table_name and column_name='tenant_id')
   and not exists(select 1 from pg_policies where schemaname='public' and tablename=item.table_name and policyname='commercial_module_entitlement')
  then
   execute format('create policy commercial_module_entitlement on public.%I as restrictive for all to authenticated using (public.platform_module_allowed(tenant_id,%L)) with check (public.platform_module_allowed(tenant_id,%L))',item.table_name,item.module_code,item.module_code);
  end if;
 end loop;
end $$;
