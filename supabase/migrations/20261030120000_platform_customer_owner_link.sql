-- SaaS customer owner linking: only platform operators can bind a verified existing user.
create or replace function public.platform_master_link_customer_owner(p_tenant uuid,p_email text,p_company_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid;v_company uuid;v_email text:=lower(btrim(coalesce(p_email,'')));v_name text:=btrim(coalesce(p_company_name,''));
begin
 if not public.is_platform_operator() then raise exception 'Acesso administrativo negado' using errcode='42501'; end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(v_email)>320 or length(v_name)<2 or length(v_name)>160 then raise exception 'E-mail ou empresa inválidos'; end if;
 perform 1 from public.tenants where id=p_tenant and status='active' for update;
 if not found then raise exception 'Cliente inexistente ou inativo'; end if;
 select id into v_user from auth.users where lower(email)=v_email and email_confirmed_at is not null;
 if v_user is null then raise exception 'Usuário não encontrado ou e-mail não confirmado'; end if;
 if exists(select 1 from public.tenant_memberships where user_id=v_user and tenant_id<>p_tenant and status='active') then raise exception 'Usuário já vinculado a outro cliente'; end if;
 if exists(select 1 from public.tenant_memberships where tenant_id=p_tenant and role='tenant_owner' and user_id<>v_user and status='active') then raise exception 'Cliente já possui responsável'; end if;
 select id into v_company from public.companies where tenant_id=p_tenant and legal_name=v_name and status='active' order by created_at limit 1;
 if v_company is null and exists(select 1 from public.companies where tenant_id=p_tenant and legal_name=v_name and status='inactive') then raise exception 'Empresa inativa; reative antes de vincular'; end if;
 if v_company is null then insert into public.companies(tenant_id,legal_name,trade_name,status) values(p_tenant,v_name,v_name,'active') returning id into v_company; end if;
 insert into public.tenant_memberships(tenant_id,user_id,role,status) values(p_tenant,v_user,'tenant_owner','active')
 on conflict(tenant_id,user_id) do update set role='tenant_owner',status='active',updated_at=now();
 insert into public.company_memberships(tenant_id,company_id,user_id,role,status) values(p_tenant,v_company,v_user,'company_admin','active')
 on conflict(company_id,user_id) do update set role='company_admin',status='active',updated_at=now();
 return v_company;
end;$$;
revoke all on function public.platform_master_link_customer_owner(uuid,text,text) from public,anon,authenticated;
grant execute on function public.platform_master_link_customer_owner(uuid,text,text) to authenticated;
