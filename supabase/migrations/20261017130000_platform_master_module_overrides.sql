begin;
create or replace function public.platform_master_modules(p_tenant uuid)
returns table(modulo text,nome text,habilitado boolean,personalizado boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 if not exists(select 1 from public.tenants t where t.id=p_tenant) then raise exception 'Cliente não encontrado'; end if;
 return query
 select m.modulo,m.nome,
 coalesce(o.habilitado,pm.habilitado,false) as habilitado,
 o.modulo is not null as personalizado
 from public.platform_module_catalog m
 left join lateral (
   select s.plan_id from public.platform_tenant_subscriptions s
   where s.tenant_id=p_tenant and s.status in ('active','trial','past_due','pending')
   order by s.created_at desc limit 1
 ) sub on true
 left join public.platform_plan_modules pm on pm.plan_id=sub.plan_id and pm.modulo=m.modulo
 left join public.platform_tenant_module_overrides o on o.tenant_id=p_tenant and o.modulo=m.modulo
 where m.ativo and m.vendavel
 order by m.ordem,m.nome;
end;$$;
create or replace function public.platform_master_set_module(p_tenant uuid,p_modulo text,p_habilitado boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 if not exists(select 1 from public.tenants where id=p_tenant) then raise exception 'Cliente não encontrado'; end if;
 if not exists(select 1 from public.platform_module_catalog where modulo=p_modulo and ativo and vendavel) then raise exception 'Módulo indisponível'; end if;
 insert into public.platform_tenant_module_overrides(tenant_id,modulo,habilitado)
 values(p_tenant,p_modulo,p_habilitado)
 on conflict(tenant_id,modulo) do update set habilitado=excluded.habilitado;
end;$$;
create or replace function public.platform_master_reset_module(p_tenant uuid,p_modulo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 delete from public.platform_tenant_module_overrides where tenant_id=p_tenant and modulo=p_modulo;
end;$$;
revoke all on function public.platform_master_modules(uuid),public.platform_master_set_module(uuid,text,boolean),public.platform_master_reset_module(uuid,text) from public;
grant execute on function public.platform_master_modules(uuid),public.platform_master_set_module(uuid,text,boolean),public.platform_master_reset_module(uuid,text) to authenticated;
commit;