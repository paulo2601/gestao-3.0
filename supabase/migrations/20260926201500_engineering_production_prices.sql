begin;

create table public.engineering_production_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid not null,
  work_id uuid not null,
  contract_service_id uuid not null,
  structure_id uuid not null,
  unit_value numeric(18,6) not null check(unit_value>=0),
  status text not null default 'active' check(status in('active','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(tenant_id,company_id,work_id,structure_id)
    references public.work_structures(tenant_id,company_id,work_id,id) on delete restrict,
  foreign key(tenant_id,company_id,contract_service_id)
    references public.contract_services(tenant_id,company_id,id) on delete restrict,
  unique(tenant_id,company_id,contract_service_id,structure_id)
);
create index engineering_production_prices_work_idx
  on public.engineering_production_prices(tenant_id,company_id,work_id,structure_id,status);
alter table public.engineering_production_prices enable row level security;
create policy engineering_production_prices_select on public.engineering_production_prices for select to authenticated
  using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_production_prices_insert on public.engineering_production_prices for insert to authenticated
  with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_prices_update on public.engineering_production_prices for update to authenticated
  using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_prices_delete on public.engineering_production_prices for delete to authenticated
  using(app_private.can_edit_company(tenant_id,company_id));

create or replace function public.resolve_engineering_production_price(
 p_tenant_id uuid,p_company_id uuid,p_work_id uuid,p_contract_service_id uuid,p_structure_id uuid
) returns numeric
language sql stable security invoker set search_path=''
as $$
 with recursive ancestry as (
   select ws.id,ws.parent_id,0 depth
   from public.work_structures ws
   where ws.tenant_id=p_tenant_id and ws.company_id=p_company_id and ws.work_id=p_work_id and ws.id=p_structure_id
   union all
   select parent.id,parent.parent_id,a.depth+1
   from ancestry a
   join public.work_structures parent on parent.tenant_id=p_tenant_id and parent.company_id=p_company_id and parent.work_id=p_work_id and parent.id=a.parent_id
 )
 select pp.unit_value
 from ancestry a
 join public.engineering_production_prices pp on pp.tenant_id=p_tenant_id and pp.company_id=p_company_id
  and pp.work_id=p_work_id and pp.contract_service_id=p_contract_service_id and pp.structure_id=a.id and pp.status='active'
 order by a.depth asc limit 1
$$;
grant execute on function public.resolve_engineering_production_price(uuid,uuid,uuid,uuid,uuid) to authenticated;

create trigger engineering_production_prices_set_updated_at before update on public.engineering_production_prices
for each row execute function public.set_updated_at();

commit;
