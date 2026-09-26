create or replace function public.validate_measurement_line()
returns trigger language plpgsql set search_path='' as $$
declare
  v_contract uuid; v_work uuid; v_price numeric(18,6); v_qty numeric(18,6); v_prev numeric(18,6); v_status text; v_structure_work uuid;
begin
  select m.contract_id,m.status into v_contract,v_status from public.measurements m where m.tenant_id=new.tenant_id and m.company_id=new.company_id and m.id=new.measurement_id;
  if not found then raise exception 'measurement not found'; end if;
  if v_status<>'draft' then raise exception 'only draft measurements can be edited'; end if;
  if new.manual_description is not null then
    if new.contract_service_id is not null or new.contract_addendum_line_id is not null then raise exception 'manual measurement item cannot have a contractual source'; end if;
    if nullif(btrim(new.manual_description),'') is null then raise exception 'manual item description is required'; end if;
    if nullif(btrim(new.manual_unit),'') is null then raise exception 'manual item unit is required'; end if;
    if new.measured_quantity<=0 then raise exception 'manual item quantity must be greater than zero'; end if;
    if new.unit_price_snapshot<0 then raise exception 'manual item unit price cannot be negative'; end if;
    return new;
  end if;
  if (new.contract_service_id is null)=(new.contract_addendum_line_id is null) then raise exception 'exactly one measurement source is required'; end if;
  if new.contract_service_id is not null then
    select cs.unit_price,cs.contracted_quantity,c.work_id into v_price,v_qty,v_work from public.contract_services cs join public.engineering_contracts c on c.tenant_id=cs.tenant_id and c.company_id=cs.company_id and c.id=cs.contract_id where cs.tenant_id=new.tenant_id and cs.company_id=new.company_id and cs.id=new.contract_service_id and cs.contract_id=v_contract and cs.status='active' for update of cs;
    if not found then raise exception 'contract service does not belong to measurement contract'; end if;
    select coalesce(sum(ml.measured_quantity),0) into v_prev from public.measurement_lines ml join public.measurements m on m.tenant_id=ml.tenant_id and m.company_id=ml.company_id and m.id=ml.measurement_id where ml.tenant_id=new.tenant_id and ml.company_id=new.company_id and ml.contract_service_id=new.contract_service_id and ml.id<>new.id and m.status in('draft','closed','approved');
  else
    select cal.unit_price,abs(cal.quantity_delta),c.work_id into v_price,v_qty,v_work from public.contract_addendum_lines cal join public.contract_addenda ca on ca.tenant_id=cal.tenant_id and ca.company_id=cal.company_id and ca.id=cal.addendum_id join public.engineering_contracts c on c.tenant_id=ca.tenant_id and c.company_id=ca.company_id and c.id=ca.contract_id where cal.tenant_id=new.tenant_id and cal.company_id=new.company_id and cal.id=new.contract_addendum_line_id and ca.contract_id=v_contract and ca.status='effective' for update of cal;
    if not found then raise exception 'addendum line does not belong to an effective addendum of measurement contract'; end if;
    select coalesce(sum(ml.measured_quantity),0) into v_prev from public.measurement_lines ml join public.measurements m on m.tenant_id=ml.tenant_id and m.company_id=ml.company_id and m.id=ml.measurement_id where ml.tenant_id=new.tenant_id and ml.company_id=new.company_id and ml.contract_addendum_line_id=new.contract_addendum_line_id and ml.id<>new.id and m.status in('draft','closed','approved');
  end if;
  if new.structure_id is not null then select ws.work_id into v_structure_work from public.work_structures ws where ws.tenant_id=new.tenant_id and ws.company_id=new.company_id and ws.id=new.structure_id; if not found or v_structure_work<>v_work then raise exception 'structure does not belong to contract work'; end if; end if;
  new.unit_price_snapshot:=coalesce(v_price,0);
  if v_prev+new.measured_quantity>coalesce(v_qty,0)+0.000001 then raise exception 'measured quantity exceeds contracted quantity'; end if;
  return new;
end $$;
