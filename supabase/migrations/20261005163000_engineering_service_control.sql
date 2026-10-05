begin;
create table public.engineering_service_controls (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, contract_id uuid not null,
 name text not null, status text not null default 'active' check(status in('active','archived')),
 imported_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,company_id,contract_id) references public.engineering_contracts(tenant_id,company_id,id) on delete restrict,
 unique(tenant_id,company_id,contract_id), unique(tenant_id,company_id,id)
);
create table public.engineering_service_control_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, control_id uuid not null,
 source_contract_service_id uuid, description text not null, category text, unit text not null,
 contracted_quantity numeric(18,4) not null check(contracted_quantity>=0), unit_price numeric(18,4) not null check(unit_price>=0),
 contracted_value numeric(18,2) generated always as(round(contracted_quantity*unit_price,2)) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,company_id,control_id) references public.engineering_service_controls(tenant_id,company_id,id) on delete cascade,
 foreign key(tenant_id,company_id,source_contract_service_id) references public.contract_services(tenant_id,company_id,id) on delete set null,
 unique(tenant_id,company_id,id)
);
create table public.engineering_service_control_entries (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, company_id uuid not null, control_id uuid not null, item_id uuid not null,
 execution_date date not null, executed_quantity numeric(18,4) not null check(executed_quantity>0), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,company_id,control_id) references public.engineering_service_controls(tenant_id,company_id,id) on delete cascade,
 foreign key(tenant_id,company_id,item_id) references public.engineering_service_control_items(tenant_id,company_id,id) on delete cascade,
 unique(tenant_id,company_id,id)
);
create index engineering_service_controls_contract_idx on public.engineering_service_controls(tenant_id,company_id,contract_id);
create index engineering_service_control_items_control_idx on public.engineering_service_control_items(tenant_id,company_id,control_id);
create index engineering_service_control_entries_item_date_idx on public.engineering_service_control_entries(tenant_id,company_id,item_id,execution_date);
alter table public.engineering_service_controls enable row level security;
alter table public.engineering_service_control_items enable row level security;
alter table public.engineering_service_control_entries enable row level security;
create policy engineering_service_controls_select on public.engineering_service_controls for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_service_controls_insert on public.engineering_service_controls for insert to authenticated with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_controls_update on public.engineering_service_controls for update to authenticated using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_controls_delete on public.engineering_service_controls for delete to authenticated using(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_items_select on public.engineering_service_control_items for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_service_control_items_insert on public.engineering_service_control_items for insert to authenticated with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_items_update on public.engineering_service_control_items for update to authenticated using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_items_delete on public.engineering_service_control_items for delete to authenticated using(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_entries_select on public.engineering_service_control_entries for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy engineering_service_control_entries_insert on public.engineering_service_control_entries for insert to authenticated with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_entries_update on public.engineering_service_control_entries for update to authenticated using(app_private.can_edit_company(tenant_id,company_id)) with check(app_private.can_edit_company(tenant_id,company_id));
create policy engineering_service_control_entries_delete on public.engineering_service_control_entries for delete to authenticated using(app_private.can_edit_company(tenant_id,company_id));
grant select,insert,update,delete on public.engineering_service_controls,public.engineering_service_control_items,public.engineering_service_control_entries to authenticated;
commit;