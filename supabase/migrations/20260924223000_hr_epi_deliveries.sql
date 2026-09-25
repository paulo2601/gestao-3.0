begin;

create table if not exists public.employee_epi_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  employment_contract_id uuid not null,
  epi_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  delivered_on date not null,
  ca_number text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint employee_epi_deliveries_contract_fk foreign key (tenant_id,company_id,employment_contract_id)
    references public.employment_contracts(tenant_id,company_id,id) on delete restrict
);

create index if not exists employee_epi_deliveries_contract_date_idx
  on public.employee_epi_deliveries(tenant_id,company_id,employment_contract_id,delivered_on desc);

alter table public.employee_epi_deliveries enable row level security;
revoke all on table public.employee_epi_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.employee_epi_deliveries to authenticated;

create policy employee_epi_deliveries_select on public.employee_epi_deliveries for select to authenticated
  using (app_private.can_access_company(tenant_id,company_id));
create policy employee_epi_deliveries_insert on public.employee_epi_deliveries for insert to authenticated
  with check (app_private.can_manage_company(tenant_id,company_id));
create policy employee_epi_deliveries_update on public.employee_epi_deliveries for update to authenticated
  using (app_private.can_manage_company(tenant_id,company_id))
  with check (app_private.can_manage_company(tenant_id,company_id));
create policy employee_epi_deliveries_delete on public.employee_epi_deliveries for delete to authenticated
  using (app_private.can_manage_company(tenant_id,company_id));

comment on table public.employee_epi_deliveries is 'Historical EPI/PPE deliveries per employment contract.';

commit;
