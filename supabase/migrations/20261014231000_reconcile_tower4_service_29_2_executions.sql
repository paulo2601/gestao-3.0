create table if not exists public.engineering_execution_duplicate_audit_20261014 (like public.engineering_measurement_line_executions including defaults);
do $$
declare v_count integer;
begin
 with ranked as (
 select e.id,row_number() over(partition by ml.contract_service_id,lower(trim(substring(ml.notes from 'reference=([^|]+)'))) order by e.execution_date,e.created_at,e.id) rn
 from public.engineering_measurement_line_executions e join public.measurement_lines ml on ml.id=e.measurement_line_id
 where ml.contract_service_id='d99b1d48-88d7-4eac-a701-bb32846bdb63'
 )
 select count(*) into v_count from ranked where rn>1;
 if v_count<>16 then raise exception 'Expected 16 duplicates, found %',v_count;end if;
 insert into public.engineering_execution_duplicate_audit_20261014
 select e.* from public.engineering_measurement_line_executions e
 where e.id in (with ranked as (
 select e.id,row_number() over(partition by ml.contract_service_id,lower(trim(substring(ml.notes from 'reference=([^|]+)'))) order by e.execution_date,e.created_at,e.id) rn
 from public.engineering_measurement_line_executions e join public.measurement_lines ml on ml.id=e.measurement_line_id
 where ml.contract_service_id='d99b1d48-88d7-4eac-a701-bb32846bdb63') select id from ranked where rn>1);
 delete from public.engineering_measurement_line_executions e where e.id in (with ranked as (
 select e.id,row_number() over(partition by ml.contract_service_id,lower(trim(substring(ml.notes from 'reference=([^|]+)'))) order by e.execution_date,e.created_at,e.id) rn
 from public.engineering_measurement_line_executions e join public.measurement_lines ml on ml.id=e.measurement_line_id
 where ml.contract_service_id='d99b1d48-88d7-4eac-a701-bb32846bdb63') select id from ranked where rn>1);
end $$;