begin;
-- Commercial administration is restricted to provisioned platform operators.
create or replace function public.platform_master_save_tenant(p_id uuid,p_name text,p_slug text,p_status text default 'active')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.is_platform_operator() then raise exception 'Acesso negado' using errcode='42501'; end if;
 if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_name,''))) > 160 then raise exception 'Nome inválido'; end if;
 if coalesce(p_slug,'') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>80 then raise exception 'Identificador inválido'; end if;
 if p_status not in ('active','inactive') then raise exception 'Status inválido'; end if;
 if p_id is null then
  insert into public.tenants(name,slug,status) values(trim(p_name),p_slug,p_status) returning id into v_id;
 else
  update public.tenants set name=trim(p_name),slug=p_slug,status=p_status,updated_at=now() where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Cliente não encontrado'; end if;
 end if;
 return v_id;
end;$$;
create or replace function public.platform_master_save_subscription(p_tenant uuid,p_plan uuid,p_cycle text,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.is_platform_operator() then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_cycle not in ('monthly','annual') then raise exception 'Ciclo inválido'; end if;
 if p_status not in ('pending','trial','active','past_due','suspended','cancelled') then raise exception 'Status inválido'; end if;
 if not exists(select 1 from public.tenants where id=p_tenant) then raise exception 'Cliente não encontrado'; end if;
 if not exists(select 1 from public.platform_plans where id=p_plan and ativo and publico) then raise exception 'Plano indisponível'; end if;
 -- Serialize writes per tenant to prevent two concurrent current subscriptions.
 perform 1 from public.tenants where id=p_tenant for update;
 select s.id into v_id from public.platform_tenant_subscriptions s
 where s.tenant_id=p_tenant and s.status <> 'cancelled' order by s.created_at desc limit 1;
 if v_id is null then
  insert into public.platform_tenant_subscriptions(tenant_id,plan_id,ciclo,status,inicio_em)
  values(p_tenant,p_plan,p_cycle,p_status,case when p_status in ('trial','active') then now() else null end)
  returning id into v_id;
 else
  update public.platform_tenant_subscriptions
  set plan_id=p_plan,ciclo=p_cycle,status=p_status,updated_at=now(),
      inicio_em=case when p_status in ('trial','active') then coalesce(inicio_em,now()) else inicio_em end
  where id=v_id;
 end if;
 return v_id;
end;$$;
-- Client-side entitlement check. No subscription is NOT a commercial grant.
-- Existing operational tenants are grandfathered until they are onboarded.
create table if not exists public.platform_legacy_tenant_exemptions(
 tenant_id uuid primary key references public.tenants(id) on delete cascade
);
insert into public.platform_legacy_tenant_exemptions(tenant_id)
select t.id from public.tenants t
where not exists(select 1 from public.platform_tenant_subscriptions s where s.tenant_id=t.id)
on conflict do nothing;
revoke all on public.platform_legacy_tenant_exemptions from anon,authenticated;
alter table public.platform_legacy_tenant_exemptions enable row level security;
create or replace function public.platform_module_allowed(p_tenant uuid,p_module text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_plan uuid;v_status text;v_enabled boolean;
begin
 if auth.uid() is null then return false; end if;
 if not exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant and m.user_id=auth.uid() and m.status='active' and t.status='active') then return false; end if;
 select s.plan_id,s.status into v_plan,v_status from public.platform_tenant_subscriptions s
 where s.tenant_id=p_tenant and s.status<>'cancelled' order by s.created_at desc limit 1;
 if v_plan is null then
  return exists(select 1 from public.platform_legacy_tenant_exemptions e where e.tenant_id=p_tenant);
 end if;
 if v_status not in ('active','trial') then return false; end if;
 select coalesce(o.habilitado,pm.habilitado,false) into v_enabled
 from public.platform_module_catalog c
 left join public.platform_plan_modules pm on pm.modulo=c.modulo and pm.plan_id=v_plan
 left join public.platform_tenant_module_overrides o on o.modulo=c.modulo and o.tenant_id=p_tenant
 where c.modulo=p_module and c.ativo;
 return coalesce(v_enabled,false);
end;$$;
revoke all on function public.platform_master_save_tenant(uuid,text,text,text),public.platform_master_save_subscription(uuid,uuid,text,text),public.platform_module_allowed(uuid,text) from public;
grant execute on function public.platform_master_save_tenant(uuid,text,text,text),public.platform_master_save_subscription(uuid,uuid,text,text),public.platform_module_allowed(uuid,text) to authenticated;
commit;
