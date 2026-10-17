-- Additive, restrictive commercial RLS: existing company/tenant policies still apply.
-- Legacy tenant exemption is evaluated by platform_module_allowed.
do $$
declare item record;
begin
 for item in
  select * from (values
   ('finance_counterparties','financeiro'),
   ('engineering_contracts','engenharia'),
   ('engineering_services','engenharia'),
   ('engineering_production_entries','producao')
  ) as x(table_name,module_code)
 loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=item.table_name and policyname='commercial_module_entitlement') then
   execute format('create policy commercial_module_entitlement on public.%I as restrictive for all to authenticated using (public.platform_module_allowed(tenant_id,%L)) with check (public.platform_module_allowed(tenant_id,%L))',item.table_name,item.module_code,item.module_code);
  end if;
 end loop;
end $$;
