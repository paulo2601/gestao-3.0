begin;
alter table public.engineering_production_services add column if not exists planned_quantity numeric(14,3);
create table if not exists public.engineering_production_allocations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,company_id uuid not null,work_id uuid not null,production_service_id uuid not null,structure_id uuid not null,quantity numeric(14,3) not null check(quantity>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,company_id,production_service_id,structure_id),
 foreign key(tenant_id,company_id,production_service_id) references public.engineering_production_services(tenant_id,company_id,id) on delete cascade,
 foreign key(structure_id) references public.work_structures(id) on delete restrict);
alter table public.engineering_production_allocations enable row level security;
create policy engineering_production_allocations_select on public.engineering_production_allocations for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_production_allocations_insert on public.engineering_production_allocations for insert to authenticated with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_allocations_update on public.engineering_production_allocations for update to authenticated using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_allocations_delete on public.engineering_production_allocations for delete to authenticated using(app_private.can_edit_company(tenant_id,company_id));
commit;
