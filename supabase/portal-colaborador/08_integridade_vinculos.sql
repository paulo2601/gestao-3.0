-- Integridade de vínculos e marcações. Executar apenas após auditoria e backup.
-- Falhar explicitamente se houver duplicidades pré-existentes.
do $$
begin
 if exists (
  select 1 from public.employee_clock_access
  where enabled = true group by user_id having count(*) > 1
 ) then raise exception 'Existem contas habilitadas para mais de um contrato; corrija antes da migração'; end if;
 if exists (
  select 1 from public.employee_clock_events
  group by employment_contract_id, (occurred_at at time zone 'America/Sao_Paulo')::date, event_type
  having count(*) > 1
 ) then raise exception 'Existem marcações duplicadas no mesmo dia local; corrija antes da migração'; end if;
end $$;
create unique index if not exists employee_clock_one_active_access_per_user
 on public.employee_clock_access(user_id) where enabled = true;
-- Evita duplicidade por dia local de São Paulo, inclusive nas viradas de data.
alter table public.employee_clock_events
 add column if not exists local_day date generated always as ((occurred_at at time zone 'America/Sao_Paulo')::date) stored;
create unique index if not exists employee_clock_one_event_type_per_day
 on public.employee_clock_events(employment_contract_id,local_day,event_type);
