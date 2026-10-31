-- Portal do Colaborador: estrutura preparatória. Não aplicar sem políticas de autorização e fluxo de autenticação revisados.
create table if not exists public.employee_clock_worksites (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 company_id uuid not null references public.companies(id),
 work_id uuid not null references public.works(id),
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 radius_m integer not null default 100 check (radius_m between 20 and 2000),
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (tenant_id,company_id,work_id)
);
create table if not exists public.employee_clock_access (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 company_id uuid not null references public.companies(id),
 employment_contract_id uuid not null references public.employment_contracts(id),
 user_id uuid not null references auth.users(id),
 work_id uuid not null references public.works(id),
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 unique (tenant_id,company_id,employment_contract_id),
 unique (tenant_id,company_id,user_id,employment_contract_id)
);
create table if not exists public.employee_clock_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 company_id uuid not null references public.companies(id),
 employment_contract_id uuid not null references public.employment_contracts(id),
 work_id uuid not null references public.works(id),
 user_id uuid not null references auth.users(id),
 event_type text not null check (event_type in ('entry','lunch_out','lunch_in','exit')),
 occurred_at timestamptz not null default now(),
 latitude double precision not null,
 longitude double precision not null,
 accuracy_m double precision not null check (accuracy_m>0),
 distance_m double precision not null check (distance_m>=0),
 receipt_code uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),
 unique (receipt_code)
);
create index if not exists employee_clock_events_contract_date_idx on public.employee_clock_events(tenant_id,company_id,employment_contract_id,occurred_at);
alter table public.employee_clock_worksites enable row level security;
alter table public.employee_clock_access enable row level security;
alter table public.employee_clock_events enable row level security;
-- Fail closed: sem políticas permissivas até a função de marcação e a autenticação estarem validadas.
revoke all on public.employee_clock_worksites,public.employee_clock_access,public.employee_clock_events from anon,authenticated;
