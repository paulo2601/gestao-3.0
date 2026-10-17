begin;
-- Compatible commercial catalog from Gestão 2.0, isolated from operational data.
create table if not exists public.platform_module_catalog (
 modulo text primary key, nome text not null, descricao text, categoria text not null default 'Geral',
 vendavel boolean not null default true, ativo boolean not null default true,
 ordem integer not null default 0, preco_adicional_mensal numeric(12,2),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.platform_plans (
 id uuid primary key default gen_random_uuid(), nome text not null,
 slug text not null unique, descricao text, ativo boolean not null default true,
 publico boolean not null default false, ordem integer not null default 0,
 preco_mensal numeric(12,2), preco_anual numeric(12,2),
 moeda text not null default 'BRL',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(preco_mensal is null or preco_mensal>=0),
 check(preco_anual is null or preco_anual>=0)
);
create table if not exists public.platform_plan_modules (
 plan_id uuid not null references public.platform_plans(id) on delete cascade,
 modulo text not null references public.platform_module_catalog(modulo),
 habilitado boolean not null default true,
 primary key(plan_id,modulo)
);
alter table public.platform_module_catalog enable row level security;
alter table public.platform_plans enable row level security;
alter table public.platform_plan_modules enable row level security;
-- No direct client writes to commercial catalogs.
revoke all on public.platform_module_catalog,public.platform_plans,public.platform_plan_modules from anon,authenticated;
grant select on public.platform_module_catalog,public.platform_plans,public.platform_plan_modules to authenticated;
create policy platform_module_catalog_read on public.platform_module_catalog
 for select to authenticated using (ativo);
create policy platform_plans_read on public.platform_plans
 for select to authenticated using (ativo and publico);
create policy platform_plan_modules_read on public.platform_plan_modules
 for select to authenticated using (exists(select 1 from public.platform_plans p where p.id=plan_id and p.ativo and p.publico));
commit;
