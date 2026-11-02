-- Solicitações de correção de ponto: nunca alteram eventos brutos.
create table if not exists public.employee_clock_correction_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 employment_contract_id uuid not null,
 attendance_date date not null,
 punch_kind text not null check (punch_kind in ('entry','lunch_out','lunch_in','exit')),
 requested_time time not null,
 reason text not null check (char_length(trim(reason)) between 10 and 1000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id),
 decision_reason text,
 approved_time time,
 constraint correction_decision_consistency check (
   (status='pending' and decided_at is null and decided_by is null and approved_time is null)
   or (status='approved' and decided_at is not null and decided_by is not null and approved_time is not null)
   or (status='rejected' and decided_at is not null and decided_by is not null)
 )
);
create unique index if not exists employee_clock_correction_one_pending
 on public.employee_clock_correction_requests (employment_contract_id,attendance_date,punch_kind)
 where status='pending';
create index if not exists employee_clock_correction_user_created
 on public.employee_clock_correction_requests(user_id,created_at desc);
alter table public.employee_clock_correction_requests enable row level security;
revoke all on public.employee_clock_correction_requests from anon;
grant select,insert on public.employee_clock_correction_requests to authenticated;
drop policy if exists clock_correction_employee_select on public.employee_clock_correction_requests;
create policy clock_correction_employee_select on public.employee_clock_correction_requests
 for select to authenticated using (user_id=auth.uid());
drop policy if exists clock_correction_employee_insert on public.employee_clock_correction_requests;
create policy clock_correction_employee_insert on public.employee_clock_correction_requests
 for insert to authenticated with check (
  user_id=auth.uid() and status='pending' and decided_by is null and decided_at is null
  and approved_time is null and
  exists(select 1 from public.employee_clock_accounts a
    where a.user_id=auth.uid() and a.enabled=true
    and a.employment_contract_id=employee_clock_correction_requests.employment_contract_id)
 );
-- Aprovação pelo RH deverá ocorrer via função transacional SECURITY DEFINER
-- com validação explícita de escopo, papel e trilha de auditoria.
-- Não criar política de UPDATE/DELETE para colaboradores.
