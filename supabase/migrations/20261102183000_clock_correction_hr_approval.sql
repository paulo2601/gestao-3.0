begin;
-- RH vê solicitações somente de contratos de empresas autorizadas.
drop policy if exists clock_correction_hr_select on public.employee_clock_correction_requests;
create policy clock_correction_hr_select on public.employee_clock_correction_requests
for select to authenticated using (
 exists (
  select 1 from public.employment_contracts c
  where c.id=employment_contract_id
    and app_private.can_manage_company(c.tenant_id,c.company_id)
 )
);

-- Decisão atômica: bloqueio de linha, verificação de escopo e ajuste da jornada.
create or replace function public.hr_decide_clock_correction_request(
 p_request_id uuid, p_decision text, p_reason text, p_approved_time text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare
 v_request public.employee_clock_correction_requests%rowtype;
 v_contract public.employment_contracts%rowtype;
 v_time time;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decisão inválida'; end if;
 if char_length(btrim(coalesce(p_reason,''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
 select * into v_request from public.employee_clock_correction_requests
 where id=p_request_id for update;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 if v_request.status<>'pending' then raise exception 'Solicitação já analisada'; end if;
 select * into v_contract from public.employment_contracts where id=v_request.employment_contract_id;
 if not found or not (app_private.can_edit_company(v_contract.tenant_id,v_contract.company_id) and public.platform_module_allowed(v_contract.tenant_id,'rh'))
 then raise exception 'Acesso negado'; end if;
 if p_decision='approved' then
   if coalesce(p_approved_time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   then raise exception 'Horário inválido'; end if;
   v_time:=p_approved_time::time;
   insert into public.employee_clock_adjustments(
    tenant_id,company_id,employment_contract_id,attendance_date,punch_kind,
    corrected_time,original_time,reason,changed_by
   ) values (
    v_contract.tenant_id,v_contract.company_id,v_request.employment_contract_id,
    v_request.attendance_date,v_request.punch_kind,v_time,null,
    'Solicitação '||v_request.id::text||': '||btrim(p_reason),auth.uid()
   ) on conflict (employment_contract_id,attendance_date,punch_kind)
   do update set corrected_time=excluded.corrected_time,reason=excluded.reason,changed_by=auth.uid();
 end if;
 update public.employee_clock_correction_requests
 set status=p_decision,decided_at=now(),decided_by=auth.uid(),
 decision_reason=btrim(p_reason),approved_time=case when p_decision='approved' then v_time else null end
 where id=p_request_id;
end;
$$;
revoke all on function public.hr_decide_clock_correction_request(uuid,text,text,text) from public,anon;
grant execute on function public.hr_decide_clock_correction_request(uuid,text,text,text) to authenticated;
commit;
