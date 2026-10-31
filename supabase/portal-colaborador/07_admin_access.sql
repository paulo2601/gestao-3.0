-- Acesso administrativo restrito por empresa ou tenant. Executar após 01_schema_preparacao.sql.
create or replace function public.employee_clock_admin_list_access(p_company_id uuid)
returns setof public.employee_clock_access
language plpgsql security definer set search_path='' stable as $$
begin
 if (select auth.uid()) is null or (
  not exists (select 1 from public.company_memberships cm where cm.company_id=p_company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role='company_admin')
  and not exists (select 1 from public.tenant_memberships tm join public.companies c on c.tenant_id=tm.tenant_id where c.id=p_company_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role='tenant_owner')
 ) then raise exception 'Sem permissão para consultar acessos'; end if;
 return query select a.* from public.employee_clock_access a where a.company_id=p_company_id order by a.created_at desc;
end; $$;
create or replace function public.employee_clock_admin_save_access(
 p_tenant_id uuid,p_company_id uuid,p_employment_contract_id uuid,
 p_user_id uuid,p_work_id uuid,p_enabled boolean
) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or (
  not exists (select 1 from public.company_memberships cm join public.companies c on c.id=cm.company_id where cm.company_id=p_company_id and c.tenant_id=p_tenant_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role='company_admin')
  and not exists (select 1 from public.tenant_memberships tm join public.companies c on c.tenant_id=tm.tenant_id where c.id=p_company_id and c.tenant_id=p_tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role='tenant_owner')
 ) then raise exception 'Sem permissão para administrar acessos'; end if;
 -- Revogação deve funcionar mesmo após desligamento ou desativação da obra.
 if p_enabled is false then
  update public.employee_clock_access a set enabled=false
  where a.tenant_id=p_tenant_id and a.company_id=p_company_id
    and a.employment_contract_id=p_employment_contract_id and a.user_id=p_user_id;
  if not found then raise exception 'Vínculo de ponto não encontrado para revogação'; end if;
  return;
 end if;
 if not exists (select 1 from public.employment_contracts ec where ec.id=p_employment_contract_id and ec.tenant_id=p_tenant_id and ec.company_id=p_company_id and ec.status='active')
 then raise exception 'Contrato não ativo nesta empresa'; end if;
 if not exists (select 1 from public.employee_clock_worksites w where w.work_id=p_work_id and w.tenant_id=p_tenant_id and w.company_id=p_company_id and (w.enabled or p_enabled = false))
 then raise exception 'Obra não habilitada para ponto GPS'; end if;
 if not exists (select 1 from auth.users u where u.id=p_user_id)
 then raise exception 'Conta de autenticação inexistente'; end if;
 if p_enabled and exists (select 1 from public.employee_clock_access a where a.user_id=p_user_id and a.employment_contract_id<>p_employment_contract_id and a.enabled)
 then raise exception 'Conta já vinculada a outro contrato ativo'; end if;
 insert into public.employee_clock_access(tenant_id,company_id,employment_contract_id,user_id,work_id,enabled)
 values(p_tenant_id,p_company_id,p_employment_contract_id,p_user_id,p_work_id,p_enabled)
 on conflict (tenant_id,company_id,employment_contract_id)
 do update set user_id=excluded.user_id,work_id=excluded.work_id,enabled=excluded.enabled;
end; $$;
revoke all on function public.employee_clock_admin_list_access(uuid) from public,anon;
revoke all on function public.employee_clock_admin_save_access(uuid,uuid,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.employee_clock_admin_list_access(uuid) to authenticated;
grant execute on function public.employee_clock_admin_save_access(uuid,uuid,uuid,uuid,uuid,boolean) to authenticated;
