-- SaaS management foundation. Existing tenant/company data is untouched.
begin;
create table if not exists public.platform_operators (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.platform_tenant_subscriptions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 plan_id uuid not null references public.platform_plans(id),
 status text not null default 'pending' check(status in ('pending','trial','active','past_due','suspended','cancelled')),
 ciclo text not null default 'monthly' check(ciclo in ('monthly','annual')),
 inicio_em timestamptz,
 renova_em timestamptz,
 termina_em timestamptz,
 observacoes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists platform_tenant_subscriptions_tenant_idx on public.platform_tenant_subscriptions(tenant_id);
create table if not exists public.platform_tenant_module_overrides (
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 modulo text not null references public.platform_module_catalog(modulo),
 habilitado boolean not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,modulo)
);
create or replace function public.is_platform_operator()
returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from public.platform_operators o where o.user_id=(select auth.uid()));
$$;
revoke all on function public.is_platform_operator() from public;
grant execute on function public.is_platform_operator() to authenticated;
alter table public.platform_operators enable row level security;
alter table public.platform_tenant_subscriptions enable row level security;
alter table public.platform_tenant_module_overrides enable row level security;
revoke all on public.platform_operators,public.platform_tenant_subscriptions,public.platform_tenant_module_overrides from anon,authenticated;
grant select on public.platform_operators,public.platform_tenant_subscriptions,public.platform_tenant_module_overrides to authenticated;
create policy platform_operators_self_read on public.platform_operators for select to authenticated using(user_id=(select auth.uid()));
create policy platform_subscriptions_operator_read on public.platform_tenant_subscriptions for select to authenticated using((select public.is_platform_operator()));
create policy platform_overrides_operator_read on public.platform_tenant_module_overrides for select to authenticated using((select public.is_platform_operator()));
-- Operator provisioning and commercial writes intentionally require privileged server-side setup.
commit;
