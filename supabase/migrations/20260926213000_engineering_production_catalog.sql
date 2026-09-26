begin;
create table public.engineering_production_services (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 company_id uuid not null,
 work_id uuid not null,
 contract_service_id uuid,
 name text not null,
 unit text,
 kind text not null default 'linked' check(kind in('linked','manual','discount')),
 status text not null default 'active' check(status in('active','inactive')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,company_id,work_id) references public.works(tenant_id,company_id,id) on delete restrict,
 foreign key(tenant_id,company_id,contract_service_id) references public.contract_services(tenant_id,company_id,id) on delete restrict
);
alter table public.engineering_production_services add constraint engineering_production_services_tenant_company_id_uq unique(tenant_id,company_id,id);
create unique index engineering_production_services_linked_uq on public.engineering_production_services(tenant_id,company_id,work_id,contract_service_id) where contract_service_id is not null and status='active';
create index engineering_production_services_work_idx on public.engineering_production_services(tenant_id,company_id,work_id,status);
alter table public.engineering_production_services enable row level security;
create policy engineering_production_services_select on public.engineering_production_services for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_production_services_insert on public.engineering_production_services for insert to authenticated with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_services_update on public.engineering_production_services for update to authenticated using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_production_services_delete on public.engineering_production_services for delete to authenticated using(app_private.can_edit_company(tenant_id,company_id));
create trigger engineering_production_services_set_updated_at before update on public.engineering_production_services for each row execute function public.set_updated_at();

alter table public.engineering_production_prices add column production_service_id uuid;
alter table public.engineering_production_prices alter column contract_service_id drop not null;
alter table public.engineering_production_prices alter column structure_id drop not null;
alter table public.engineering_production_prices add constraint engineering_production_prices_production_service_fk foreign key(tenant_id,company_id,production_service_id) references public.engineering_production_services(tenant_id,company_id,id) on delete restrict;
drop index if exists public.engineering_production_prices_tenant_id_company_id_contract_key;
create unique index engineering_production_prices_service_structure_uq on public.engineering_production_prices(tenant_id,company_id,production_service_id,coalesce(structure_id,'00000000-0000-0000-0000-000000000000'::uuid)) where production_service_id is not null;

insert into public.engineering_production_services(tenant_id,company_id,work_id,contract_service_id,name,unit,kind)
select distinct pp.tenant_id,pp.company_id,pp.work_id,pp.contract_service_id,cs.description,cs.unit,'linked'
from public.engineering_production_prices pp join public.contract_services cs on cs.tenant_id=pp.tenant_id and cs.company_id=pp.company_id and cs.id=pp.contract_service_id
where pp.contract_service_id is not null
on conflict do nothing;
update public.engineering_production_prices pp set production_service_id=ps.id
from public.engineering_production_services ps
where ps.tenant_id=pp.tenant_id and ps.company_id=pp.company_id and ps.work_id=pp.work_id and ps.contract_service_id=pp.contract_service_id and ps.status='active' and pp.production_service_id is null;
commit;