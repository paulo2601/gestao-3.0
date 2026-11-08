begin;
create table if not exists public.hr_epi_products(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,company_id uuid not null,
 name text not null,ca_number text,manufacturer text,size text,minimum_stock integer not null default 0 check(minimum_stock>=0),
 quantity integer not null default 0 check(quantity>=0),active boolean not null default true,
 created_at timestamptz not null default now(),unique(id,tenant_id,company_id));
create index if not exists hr_epi_products_company_idx on public.hr_epi_products(tenant_id,company_id,name);
create table if not exists public.hr_epi_stock_movements(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,company_id uuid not null,
 product_id uuid not null,kind text not null check(kind in ('entry','delivery','return','adjustment')),
 quantity integer not null check(quantity<>0),delivery_id uuid references public.employee_epi_deliveries(id),
 notes text,created_at timestamptz not null default now(),created_by uuid default auth.uid(),
 foreign key(product_id,tenant_id,company_id) references public.hr_epi_products(id,tenant_id,company_id));
alter table public.employee_epi_deliveries add column if not exists epi_product_id uuid references public.hr_epi_products(id);
alter table public.hr_epi_products enable row level security;
alter table public.hr_epi_stock_movements enable row level security;
grant select,insert,update on public.hr_epi_products to authenticated;
grant select on public.hr_epi_stock_movements to authenticated;
create policy hr_epi_products_read on public.hr_epi_products for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create policy hr_epi_products_write on public.hr_epi_products for insert to authenticated with check(app_private.can_manage_company(tenant_id,company_id));
create policy hr_epi_products_update on public.hr_epi_products for update to authenticated using(app_private.can_manage_company(tenant_id,company_id)) with check(app_private.can_manage_company(tenant_id,company_id));
create policy hr_epi_movements_read on public.hr_epi_stock_movements for select to authenticated using(app_private.can_access_company(tenant_id,company_id));
create or replace function public.hr_epi_register_entry(p_product uuid,p_quantity integer,p_notes text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.hr_epi_products%rowtype;
begin
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade inválida';end if;
 select * into v from public.hr_epi_products where id=p_product for update;
 if not found or not app_private.can_manage_company(v.tenant_id,v.company_id) then raise exception 'Sem permissão';end if;
 update public.hr_epi_products set quantity=quantity+p_quantity where id=p_product;
 insert into public.hr_epi_stock_movements(tenant_id,company_id,product_id,kind,quantity,notes)
 values(v.tenant_id,v.company_id,p_product,'entry',p_quantity,p_notes);
end $$;
create or replace function public.hr_epi_register_delivery(p_product uuid,p_contract uuid,p_quantity integer,p_date date,p_notes text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.hr_epi_products%rowtype;v_delivery uuid;
begin
 if p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'Dados de entrega inválidos';end if;
 select * into v from public.hr_epi_products where id=p_product and active for update;
 if not found or not app_private.can_manage_company(v.tenant_id,v.company_id) then raise exception 'Sem permissão';end if;
 if v.quantity<p_quantity then raise exception 'Estoque insuficiente';end if;
 insert into public.employee_epi_deliveries(tenant_id,company_id,employment_contract_id,epi_name,quantity,delivered_on,ca_number,notes,epi_product_id,created_by)
 values(v.tenant_id,v.company_id,p_contract,v.name,p_quantity,p_date,v.ca_number,p_notes,p_product,auth.uid()) returning id into v_delivery;
 update public.hr_epi_products set quantity=quantity-p_quantity where id=p_product;
 insert into public.hr_epi_stock_movements(tenant_id,company_id,product_id,kind,quantity,delivery_id,notes)
 values(v.tenant_id,v.company_id,p_product,'delivery',-p_quantity,v_delivery,p_notes);
end $$;
revoke all on function public.hr_epi_register_entry(uuid,integer,text) from public;
revoke all on function public.hr_epi_register_delivery(uuid,uuid,integer,date,text) from public;
grant execute on function public.hr_epi_register_entry(uuid,integer,text) to authenticated;
grant execute on function public.hr_epi_register_delivery(uuid,uuid,integer,date,text) to authenticated;
commit;