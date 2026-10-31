-- Aplicar apos 01_schema_preparacao.sql. Conferir duplicidades antes de executar.
create unique index if not exists employee_clock_one_active_access_per_user on public.employee_clock_access(user_id) where enabled = true;
-- O dia local e calculado a partir de occurred_at pelo fuso fixo da operacao.
-- A coluna gerada evita usar uma expressao dependente de timezone em indice.
alter table public.employee_clock_events add column if not exists local_day date generated always as ((occurred_at at time zone 'America/Sao_Paulo')::date) stored;
create unique index if not exists employee_clock_one_event_type_per_day on public.employee_clock_events(employment_contract_id,local_day,event_type);
