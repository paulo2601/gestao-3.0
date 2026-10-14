create or replace function public.prevent_duplicate_apartment_execution()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
declare v_line public.measurement_lines%rowtype;v_origin text;v_unit text;v_source uuid;
begin
 select * into v_line from public.measurement_lines where id=new.measurement_line_id;
 if not found then raise exception 'Linha da medição inexistente';end if;
 v_source:=coalesce(v_line.contract_service_id,v_line.contract_addendum_line_id);
 v_origin:=lower(trim(substring(coalesce(v_line.notes,'') from 'origin=([^|]+)')));
 v_unit:=lower(trim(substring(coalesce(v_line.notes,'') from 'reference=([^|]+)')));
 if v_source is not null and v_unit is not null and v_unit<>'' then
   perform pg_advisory_xact_lock(hashtextextended(v_line.tenant_id::text||':'||v_line.company_id::text||':'||v_source::text||':'||coalesce(v_origin,'')||':'||v_unit,0));
   if exists(
     select 1 from public.engineering_measurement_line_executions e
     join public.measurement_lines ml on ml.id=e.measurement_line_id
     where e.id is distinct from new.id and ml.tenant_id=v_line.tenant_id and ml.company_id=v_line.company_id
       and coalesce(ml.contract_service_id,ml.contract_addendum_line_id)=v_source
       and lower(trim(substring(coalesce(ml.notes,'') from 'origin=([^|]+)'))) is not distinct from v_origin
       and lower(trim(substring(coalesce(ml.notes,'') from 'reference=([^|]+)')))=v_unit
   ) then raise exception 'Esta unidade já possui execução registrada para este serviço.';end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_prevent_duplicate_apartment_execution on public.engineering_measurement_line_executions;
create trigger trg_prevent_duplicate_apartment_execution before insert or update of measurement_line_id on public.engineering_measurement_line_executions for each row execute function public.prevent_duplicate_apartment_execution();