-- Preparatório. Não aplicar sem auditar os papéis e as políticas do ambiente.
-- Acesso restrito ao administrador da empresa/tenant, sem acesso direto às tabelas.
create or replace function public.employee_clock_admin_list_worksites(p_company_id uuid)
returns setof public.employee_clock_worksites
language plpgsql security definer set search_path = '' stable as $$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.company_memberships cm
  where cm.user_id = (select auth.uid()) and cm.company_id = p_company_id
    and cm.role in ('owner','admin')
 ) then raise exception 'Sem permissão para administrar obras'; end if;
 return query select w.* from public.employee_clock_worksites w where w.company_id=p_company_id order by w.work_id;
end; $$;
create or replace function public.employee_clock_admin_save_worksite(
 p_tenant_id uuid,p_company_id uuid,p_work_id uuid,
 p_latitude double precision,p_longitude double precision,
 p_radius_m integer,p_enabled boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.company_memberships cm
  join public.companies c on c.id=cm.company_id
  where cm.user_id=(select auth.uid()) and cm.company_id=p_company_id
    and c.tenant_id=p_tenant_id and cm.role in ('owner','admin')
 ) then raise exception 'Sem permissão para administrar obras'; end if;
 if not exists(select 1 from public.works w where w.id=p_work_id and w.company_id=p_company_id and w.tenant_id=p_tenant_id)
 then raise exception 'Obra não pertence à empresa'; end if;
 insert into public.employee_clock_worksites(tenant_id,company_id,work_id,latitude,longitude,radius_m,enabled)
 values(p_tenant_id,p_company_id,p_work_id,p_latitude,p_longitude,p_radius_m,p_enabled)
 on conflict (tenant_id,company_id,work_id) do update set
 latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m,
 enabled=excluded.enabled,updated_at=now();
end; $$;
revoke all on function public.employee_clock_admin_list_worksites(uuid) from public,anon;
revoke all on function public.employee_clock_admin_save_worksite(uuid,uuid,uuid,double precision,double precision,integer,boolean) from public,anon;
grant execute on function public.employee_clock_admin_list_worksites(uuid) to authenticated;
grant execute on function public.employee_clock_admin_save_worksite(uuid,uuid,uuid,double precision,double precision,integer,boolean) to authenticated;
