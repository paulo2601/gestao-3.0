do $migration$
declare f text; old text; replacement text;
begin
 select pg_get_functiondef(p.oid) into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='replace_measurement_stage' and p.pronargs=7;
 if f is null then raise exception 'RPC not found'; end if;
 old := '  delete from public.measurement_lines ml where ml.tenant_id=v_measurement.tenant_id and ml.company_id=v_measurement.company_id and ml.measurement_id=v_measurement.id'
 || chr(10) || '    and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id) or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id));';
 if strpos(f,old)=0 then raise exception 'Expected delete statement not found'; end if;
 replacement := $replace$
  -- Never delete an executed unit; preserve its measurement_line_id.
  if exists (
    select 1 from public.measurement_lines ml
    where ml.measurement_id=v_measurement.id
      and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
        or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id))
      and exists (select 1 from public.engineering_measurement_line_executions x where x.measurement_line_id=ml.id)
      and (v_count>0 and not exists (
        select 1 from unnest(p_references) r(value)
        where lower(trim(r.value))=lower(trim(substring(coalesce(ml.notes,'') from 'reference=([^|]+)')))
      ) or v_count=0 and coalesce(p_quantity,0)<=0
        or v_count=0 and coalesce(p_quantity,0)>0 and ml.notes like '%reference=%')
  ) then
    raise exception 'Unidade com execução registrada: ajuste a execução antes de retirar a unidade.';
  end if;
  delete from public.measurement_lines ml
  where ml.measurement_id=v_measurement.id
    and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
      or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id))
    and not exists (select 1 from public.engineering_measurement_line_executions x where x.measurement_line_id=ml.id)
    and (v_count=0 or not exists (
      select 1 from unnest(p_references) r(value)
      where lower(trim(r.value))=lower(trim(substring(coalesce(ml.notes,'') from 'reference=([^|]+)')))
    ));
$replace$;
 f:=replace(f,old,replacement);
 old:='      insert into public.measurement_lines(tenant_id,company_id,measurement_id,contract_service_id,contract_addendum_line_id,structure_id,measured_quantity,unit_price_snapshot,exact_gross_value,notes)';
 replacement:=$replace$
      if exists (
        select 1 from public.measurement_lines ml
        where ml.measurement_id=v_measurement.id
          and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
            or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id))
          and lower(trim(substring(coalesce(ml.notes,'') from 'reference=([^|]+)')))=lower(v_reference)
      ) then
        update public.measurement_lines ml set structure_id=v_structure_id,
          notes=concat('[G2PARITY] reference=',v_reference,case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else concat(' | ',trim(p_notes)) end)
        where ml.measurement_id=v_measurement.id
          and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
            or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id))
          and lower(trim(substring(coalesce(ml.notes,'') from 'reference=([^|]+)')))=lower(v_reference);
        continue;
      end if;
$replace$||old;
 if strpos(f,old)=0 then raise exception 'Reference insert not found'; end if;
 f:=replace(f,old,replacement);
 old:='  elsif coalesce(p_quantity,0)>0 then'||chr(10)||'    insert into public.measurement_lines';
 replacement:=$replace$
  elsif coalesce(p_quantity,0)>0 then
    if exists (select 1 from public.measurement_lines ml
      where ml.measurement_id=v_measurement.id
        and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
          or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id))
        and exists (select 1 from public.engineering_measurement_line_executions x where x.measurement_line_id=ml.id)) then
      if (select count(*) from public.measurement_lines ml
        where ml.measurement_id=v_measurement.id
          and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
            or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id)))<>1 then
        raise exception 'Várias linhas com execuções: não é possível consolidar automaticamente.';
      end if;
      update public.measurement_lines ml
        set measured_quantity=p_quantity,exact_gross_value=p_exact_value,
          notes=concat('[G2PARITY]',case when nullif(trim(coalesce(p_notes,'')),'') is null then '' else concat(' ',trim(p_notes)) end)
      where ml.measurement_id=v_measurement.id
        and ((p_contract_service_id is not null and ml.contract_service_id=p_contract_service_id)
          or (p_contract_addendum_line_id is not null and ml.contract_addendum_line_id=p_contract_addendum_line_id));
      return;
    end if;
    insert into public.measurement_lines$replace$;
 if strpos(f,old)=0 then raise exception 'Quantity insert not found'; end if;
 f:=replace(f,old,replacement);
 execute f;
end $migration$;