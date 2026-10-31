-- Aplicar apos 01_schema_preparacao.sql. Conferir duplicidades antes de executar.
create unique index if not exists employee_clock_one_active_access_per_user on public.employee_clock_access(user_id) where enabled = true;
create unique index if not exists employee_clock_one_event_type_per_day on public.employee_clock_events(employment_contract_id, ((occurred_at at time zone 'America/Sao_Paulo')::date), event_type);
