begin;
create table if not exists public.employee_bank_hour_movements(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, employment_contract_id uuid not null,
 occurred_on date not null, minutes integer not null check(minutes<>0), description text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 constraint employee_bank_hour_movements_contract_fk foreign key(tenant_id,company_id,employment_contract_id) references public.employment_contracts(tenant_id,company_id,id) on delete restrict);
create index if not exists employee_bank_hour_movements_contract_date_idx on public.employee_bank_hour_movements(tenant_id,company_id,employment_contract_id,occurred_on desc);
create table if not exists public.employee_bank_hour_closings(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, employment_contract_id uuid not null,
 competence_month date not null check(competence_month=date_trunc('month',competence_month)::date), closed_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null,
 unique(tenant_id,company_id,employment_contract_id,competence_month),
 constraint employee_bank_hour_closings_contract_fk foreign key(tenant_id,company_id,employment_contract_id) references public.employment_contracts(tenant_id,company_id,id) on delete restrict);
alter table public.employee_bank_hour_movements enable row level security; alter table public.employee_bank_hour_closings enable row level security;
grant select,insert,update,delete on public.employee_bank_hour_movements to authenticated; grant select,insert,delete on public.employee_bank_hour_closings to authenticated;
create policy employee_bank_hour_movements_select on public.employee_bank_hour_movements for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy employee_bank_hour_movements_manage on public.employee_bank_hour_movements for all to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy employee_bank_hour_closings_select on public.employee_bank_hour_closings for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy employee_bank_hour_closings_manage on public.employee_bank_hour_closings for all to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
commit;