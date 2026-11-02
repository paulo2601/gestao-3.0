-- Configuração versionada de jornada por vínculo. Não altera registros históricos.
create table if not exists public.employee_work_schedules (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 company_id uuid not null,
 employment_contract_id uuid not null references public.employment_contracts(id),
 effective_on date not null,
 weekdays jsonb not null,
 tolerance_minutes integer not null default 5 check (tolerance_minutes between 0 and 30),
 review_required boolean not null default true,
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 unique (employment_contract_id,effective_on),
 constraint weekdays_array check (jsonb_typeof(weekdays)='array' and jsonb_array_length(weekdays)=7)
);
create index if not exists employee_work_schedules_lookup on public.employee_work_schedules(employment_contract_id,effective_on desc);
alter table public.employee_work_schedules enable row level security;
create policy employee_work_schedules_read on public.employee_work_schedules for select to authenticated
 using (app_private.can_access_company(tenant_id,company_id) and platform_module_allowed(tenant_id,'rh'));
create policy employee_work_schedules_insert on public.employee_work_schedules for insert to authenticated
 with check (app_private.can_edit_company(tenant_id,company_id) and platform_module_allowed(tenant_id,'rh')
 and exists(select 1 from public.employment_contracts c where c.id=employment_contract_id and c.tenant_id=tenant_id and c.company_id=company_id));
create policy employee_work_schedules_update on public.employee_work_schedules for update to authenticated
 using (app_private.can_edit_company(tenant_id,company_id) and platform_module_allowed(tenant_id,'rh'))
 with check (app_private.can_edit_company(tenant_id,company_id) and platform_module_allowed(tenant_id,'rh'));
grant select,insert,update on public.employee_work_schedules to authenticated;
