-- Prevent a cancelled SaaS subscription from re-enabling access through
-- the legacy exemption. The exemption applies only before any subscription exists.
create or replace function public.platform_module_allowed(p_tenant uuid,p_module text)
returns boolean language plpgsql stable security definer set search_path = ''
as $function$
declare v_plan uuid;v_status text;v_enabled boolean;
begin
 if auth.uid() is null then return false; end if;
 if not exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant and m.user_id=auth.uid() and m.status='active' and t.status='active') then return false; end if;
 select s.plan_id,s.status into v_plan,v_status from public.platform_tenant_subscriptions s
 where s.tenant_id=p_tenant order by s.created_at desc,s.id desc limit 1;
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
end;$function$;
