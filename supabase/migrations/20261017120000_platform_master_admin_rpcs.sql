begin;
-- Grant access to the private catalog only through operator-checked RPCs.
create or replace function public.platform_master_catalog()
returns table(id uuid,nome text,slug text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 return query select p.id,p.nome,p.slug from public.platform_plans p where p.ativo order by p.ordem;
end;$$;
create or replace function public.platform_master_tenants()
returns table(id uuid,name text,slug text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 return query select t.id,t.name,t.slug,t.status,t.created_at from public.tenants t order by t.created_at desc;
end;$$;
create or replace function public.platform_master_assign_plan(p_tenant uuid,p_plan uuid,p_cycle text default 'monthly')
returns uuid language plpgsql security definer set search_path='' as $$
declare subscription_id uuid;
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 if p_cycle not in ('monthly','annual') then raise exception 'Ciclo inválido'; end if;
 if not exists(select 1 from public.tenants where id=p_tenant) then raise exception 'Cliente não encontrado'; end if;
 if not exists(select 1 from public.platform_plans where id=p_plan and ativo and publico) then raise exception 'Plano indisponível'; end if;
 if exists(select 1 from public.platform_tenant_subscriptions where tenant_id=p_tenant and status in ('active','trial','past_due','pending')) then
  raise exception 'Já existe uma assinatura vigente ou pendente para este cliente';
 end if;
 insert into public.platform_tenant_subscriptions(tenant_id,plan_id,status,ciclo)
 values(p_tenant,p_plan,'pending',p_cycle) returning id into subscription_id;
 return subscription_id;
end;$$;
revoke all on function public.platform_master_catalog(),public.platform_master_tenants(),public.platform_master_assign_plan(uuid,uuid,text) from public;
grant execute on function public.platform_master_catalog(),public.platform_master_tenants(),public.platform_master_assign_plan(uuid,uuid,text) to authenticated;
commit;