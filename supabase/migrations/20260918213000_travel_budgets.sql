create table public.travel_budgets (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 company_id uuid not null,
 name text not null check(length(btrim(name))>0),
 origin text not null default '',
 destination text not null default '',
 start_date date not null,
 end_date date not null,
 travelers integer not null default 1 check(travelers>0),
 vehicle_name text not null default '',
 fuel_type text not null default 'Etanol',
 fuel_price numeric(12,2) not null default 0 check(fuel_price>=0),
 avg_consumption numeric(10,2) not null default 0 check(avg_consumption>=0),
 total_distance_km numeric(12,2) not null default 0 check(total_distance_km>=0),
 reserve_percent numeric(6,2) not null default 10 check(reserve_percent>=0),
 notes text,
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(end_date>=start_date),
 unique(tenant_id,company_id,id),
 foreign key(tenant_id,company_id) references public.companies(tenant_id,id) on delete restrict
);

create table public.travel_budget_items (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 company_id uuid not null,
 budget_id uuid not null,
 category text not null,
 description text not null,
 planned_amount numeric(14,2) not null default 0 check(planned_amount>=0),
 actual_amount numeric(14,2) not null default 0 check(actual_amount>=0),
 due_date date,
 sort_order integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,company_id,id),
 foreign key(tenant_id,company_id,budget_id) references public.travel_budgets(tenant_id,company_id,id) on delete cascade
);

create index travel_budgets_company_date_idx on public.travel_budgets(tenant_id,company_id,start_date desc);
create index travel_budget_items_budget_idx on public.travel_budget_items(tenant_id,company_id,budget_id,sort_order);

alter table public.travel_budgets enable row level security;
alter table public.travel_budget_items enable row level security;

create policy travel_budgets_select on public.travel_budgets for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy travel_budgets_insert on public.travel_budgets for insert to authenticated with check(app_private.can_manage_company(tenant_id,company_id));
create policy travel_budgets_update on public.travel_budgets for update to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy travel_budgets_delete on public.travel_budgets for delete to authenticated using(app_private.can_manage_company(tenant_id,company_id));

create policy travel_items_select on public.travel_budget_items for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy travel_items_insert on public.travel_budget_items for insert to authenticated with check(app_private.can_manage_company(tenant_id,company_id));
create policy travel_items_update on public.travel_budget_items for update to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy travel_items_delete on public.travel_budget_items for delete to authenticated using(app_private.can_manage_company(tenant_id,company_id));