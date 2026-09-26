create table if not exists public.hr_fortnight_closings(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null,
 competence_month date not null check (competence_month=date_trunc('month',competence_month)::date),
 payroll_half smallint not null check(payroll_half in(1,2)), status text not null default 'draft' check(status in('draft','closed','cancelled')),
 filters jsonb not null default '{}'::jsonb,total_amount numeric(14,2) not null default 0,closed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,company_id,competence_month,payroll_half),foreign key(tenant_id,company_id) references public.companies(tenant_id,id) on delete restrict);
alter table public.hr_fortnight_closings enable row level security;
create policy hr_fortnight_closings_select on public.hr_fortnight_closings for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy hr_fortnight_closings_write on public.hr_fortnight_closings for all to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
grant select,insert,update,delete on public.hr_fortnight_closings to authenticated;
create index hr_fortnight_closings_scope_idx on public.hr_fortnight_closings(tenant_id,company_id,competence_month,payroll_half);