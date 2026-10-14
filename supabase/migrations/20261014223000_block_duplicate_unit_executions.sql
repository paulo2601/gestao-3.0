create or replace function public.record_measurement_line_execution(p_line_id uuid,p_execution_date date,p_quantity numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_line public.measurement_lines%rowtype;v_id uuid;v_target uuid;v_existing numeric;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária';end if;
 if p_execution_date is null or p_quantity is null or p_quantity<=0 then raise exception 'Data e quantidade válidas são obrigatórias';end if;
 select * into v_line from public.measurement_lines where id=p_line_id for update;
 if not found then raise exception 'Item da medição não encontrado';end if;
 if not app_private.can_access_company(v_line.tenant_id,v_line.company_id) then raise exception 'Sem permissão';end if;
 v_target:=coalesce(v_line.contract_addendum_line_id,v_line.contract_service_id);
 if v_target is null then raise exception 'Serviço sem vínculo contratual';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_target::text,0));
 select coalesce(sum(e.executed_quantity),0) into v_existing from public.engineering_measurement_line_executions e where e.measurement_line_id=p_line_id;
 if v_existing>0 then raise exception 'Esta unidade já possui execução registrada. Consulte ou edite o lançamento existente.';end if;
 if p_quantity>v_line.measured_quantity+0.0000001 then raise exception 'Execução maior que a quantidade prevista para esta unidade';end if;
 if p_quantity>public.execution_contract_remaining(p_line_id)+0.0000001 then raise exception 'Execução maior que o saldo contratado';end if;
 insert into public.engineering_measurement_line_executions(tenant_id,company_id,measurement_line_id,execution_date,executed_quantity,notes)
 values(v_line.tenant_id,v_line.company_id,p_line_id,p_execution_date,p_quantity,nullif(trim(p_notes),'')) returning id into v_id;
 return v_id;
end $function$;