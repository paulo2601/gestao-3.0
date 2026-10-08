-- Planejamento e execução: estrutura aditiva, sem alterar medições existentes.
create table if not exists public.engineering_measurement_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  contract_id uuid not null references public.engineering_contracts(id),
  measurement_id uuid not null references public.measurements(id),
  competence date not null,
  origin_type text not null check (origin_type in ('tower','addendum','provisional','other')),
  origin_id text not null,
  target_kind text not null check (target_kind in ('contract','addendum')),
  target_id uuid not null,
  planned_quantity numeric(18,3) not null check (planned_quantity >= 0),
  unit_price_snapshot numeric(18,4) not null check (unit_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(measurement_id,origin_type,origin_id,target_kind,target_id)
);
create table if not exists public.engineering_execution_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  plan_id uuid not null references public.engineering_measurement_plans(id) on delete restrict,
  execution_date date not null,
  executed_quantity numeric(18,3) not null check (executed_quantity > 0),
  unit_reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists engineering_plans_contract_month_idx on public.engineering_measurement_plans(tenant_id,company_id,contract_id,competence);
create index if not exists engineering_execution_plan_idx on public.engineering_execution_entries(plan_id,execution_date);
alter table public.engineering_measurement_plans enable row level security;
alter table public.engineering_execution_entries enable row level security;
create policy engineering_plans_select on public.engineering_measurement_plans for select using (app_private.can_access_company(tenant_id,company_id));
create policy engineering_plans_insert on public.engineering_measurement_plans for insert with check (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_plans_update on public.engineering_measurement_plans for update using (app_private.can_edit_company(tenant_id,company_id)) with check (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_plans_delete on public.engineering_measurement_plans for delete using (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_execution_select on public.engineering_execution_entries for select using (app_private.can_access_company(tenant_id,company_id));
create policy engineering_execution_insert on public.engineering_execution_entries for insert with check (app_private.can_edit_company(tenant_id,company_id) and exists(select 1 from public.engineering_measurement_plans p where p.id=plan_id and p.tenant_id=tenant_id and p.company_id=company_id));
create policy engineering_execution_update on public.engineering_execution_entries for update using (app_private.can_edit_company(tenant_id,company_id)) with check (app_private.can_edit_company(tenant_id,company_id));
create policy engineering_execution_delete on public.engineering_execution_entries for delete using (app_private.can_edit_company(tenant_id,company_id));
-- IMPORTANTE: exigir RPC transacional para validar quantidade acumulada e status antes de habilitar UI.
