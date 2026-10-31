-- Administração de perímetros por company_admin ou tenant_owner ativos.
create or replace function public.employee_clock_admin_list_worksites(p_company_id uuid)
returns setof public.employee_clock_worksites
language plpgsql security definer set search_path='' stable as $$
begin
 if (select auth.uid()) is null or (
  not exists (select 1 from public.company_memberships cm where cm.company_id=p_company_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role='company_admin')
  and not exists (select 1 from public.tenant_memberships tm join public.companies c on c.tenant_id=tm.tenant_id where c.id=p_company_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role='tenant_owner')
 ) then raise exception 'Sem permissão para consultar perímetros'; end if;
 return query select w.* from public.employee_clock_worksites w where w.company_id=p_company_id order by w.work_id;
end; $$;
create or replace function public.employee_clock_admin_save_worksite(
 p_tenant_id uuid,p_company_id uuid,p_work_id uuid,
 p_latitude double precision,p_longitude double precision,p_radius_m integer,p_enabled boolean
) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or (
  not exists (select 1 from public.company_memberships cm join public.companies c on c.id=cm.company_id where cm.company_id=p_company_id and c.tenant_id=p_tenant_id and cm.user_id=(select auth.uid()) and cm.status='active' and cm.role='company_admin')
  and not exists (select 1 from public.tenant_memberships tm join public.companies c on c.tenant_id=tm.tenant_id where c.id=p_company_id and c.tenant_id=p_tenant_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role='tenant_owner')
 ) then raise exception 'Sem permissão para configurar perímetros'; end if;
 if not exists (select 1 from public.works w where w.id=p_work_id and w.company_id=p_company_id and w.tenant_id=p_tenant_id)
 then raise exception 'Obra não pertence à empresa'; end if;
 if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_latitude = 'Infinity'::float8 or p_latitude = '-Infinity'::float8 or p_latitude = 'NaN'::float8 or p_longitude is null or p_longitude < -180 or p_longitude > 180 or p_longitude = 'Infinity'::float8 or p_longitude = '-Infinity'::float8 or p_longitude = 'NaN'::float8 or p_radius_m is null or p_radius_m < 20 or p_radius_m > 2000
 then raise exception 'Coordenadas ou raio inválidos'; end if;
 insert into public.employee_clock_worksites(tenant_id,company_id,work_id,latitude,longitude,radius_m,enabled)
 values(p_tenant_id,p_company_id,p_work_id,p_latitude,p_longitude,p_radius_m,p_enabled)
 on conflict (tenant_id,company_id,work_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m,enabled=excluded.enabled,updated_at=now();
end; $$;
revoke all on function public.employee_clock_admin_list_worksites(uuid) from public,anon;
revoke all on function public.employee_clock_admin_save_worksite(uuid,uuid,uuid,double precision,double precision,integer,boolean) from public,anon;
grant execute on function public.employee_clock_admin_list_worksites(uuid) to authenticated;
grant execute on function public.employee_clock_admin_save_worksite(uuid,uuid,uuid,double precision,double precision,integer,boolean) to authenticated;
