begin;

-- Commercial licensing is additive; no existing business records are changed.
create table if not exists public.saas_modules (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  active boolean not null default true
);
insert into public.saas_modules(code,name) values
 ('financeiro','Financeiro'),('rh','Recursos Humanos'),('engenharia','Engenharia'),
 ('producao','Produção'),('controle_servico','Controle de Serviço'),
 ('relatorios','Relatórios'),('orcamento','Orçamento')
on conflict (code) do nothing;

create table if not exists public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.saas_plan_modules (
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  module_code text not null references public.saas_modules(code),
  primary key(plan_id,module_code)
);
create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  plan_id uuid references public.saas_plans(id) on delete restrict,
  status text not null check(status in ('trialing','active','past_due','suspended','canceled','legacy')),
  period_start timestamptz,
  period_end timestamptz,
  provider text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id)
);
create unique index if not exists saas_subscriptions_provider_key
on public.saas_subscriptions(provider,provider_subscription_id)
where provider is not null and provider_subscription_id is not null;

create table if not exists public.saas_tenant_module_grants (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  module_code text not null references public.saas_modules(code),
  enabled boolean not null default false,
  reason text not null default 'subscription',
  updated_at timestamptz not null default now(),
  primary key(tenant_id,module_code)
);

-- Existing tenants are grandfathered, preserving current functionality.
insert into public.saas_subscriptions(tenant_id,status)
select id,'legacy' from public.tenants
on conflict(tenant_id) do nothing;
insert into public.saas_tenant_module_grants(tenant_id,module_code,enabled,reason)
select t.id,m.code,true,'legacy_migration'
from public.tenants t cross join public.saas_modules m
on conflict(tenant_id,module_code) do nothing;

create trigger saas_subscriptions_updated_at before update on public.saas_subscriptions
for each row execute function public.set_updated_at();

alter table public.saas_modules enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_plan_modules enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.saas_tenant_module_grants enable row level security;

create policy saas_modules_read on public.saas_modules for select to authenticated using (active);
create policy saas_plans_read on public.saas_plans for select to authenticated using (active);
create policy saas_plan_modules_read on public.saas_plan_modules for select to authenticated
using (exists(select 1 from public.saas_plans p where p.id=plan_id and p.active));
create policy saas_subscriptions_read on public.saas_subscriptions for select to authenticated
using (app_private.is_tenant_member(tenant_id));
create policy saas_grants_read on public.saas_tenant_module_grants for select to authenticated
using (app_private.is_tenant_member(tenant_id));

-- Clients cannot self-activate licenses or alter prices from the browser.
revoke all on public.saas_modules,public.saas_plans,public.saas_plan_modules,
 public.saas_subscriptions,public.saas_tenant_module_grants from anon,authenticated;
grant select on public.saas_modules,public.saas_plans,public.saas_plan_modules,
 public.saas_subscriptions,public.saas_tenant_module_grants to authenticated;

-- Server-side check for future API/RPC authorization; never trust a hidden menu.
create or replace function public.has_saas_module(p_tenant_id uuid,p_module text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select app_private.is_tenant_member(p_tenant_id)
 and exists (
  select 1 from public.saas_tenant_module_grants g
  join public.saas_subscriptions s on s.tenant_id=g.tenant_id
  where g.tenant_id=p_tenant_id and g.module_code=p_module and g.enabled
  and (
   s.status='legacy'
   or (s.status in ('active','trialing') and (s.period_end is null or s.period_end>now()))
  )
 );
$$;
revoke all on function public.has_saas_module(uuid,text) from public,anon;
grant execute on function public.has_saas_module(uuid,text) to authenticated;
commit;
