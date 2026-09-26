begin;
alter table public.engineering_production_entries add column if not exists production_service_id uuid;
alter table public.engineering_production_entries add column if not exists unit_structure_id uuid;
alter table public.engineering_production_entries add constraint engineering_production_entries_production_service_fk foreign key(tenant_id,company_id,production_service_id) references public.engineering_production_services(tenant_id,company_id,id) on delete restrict;
alter table public.engineering_production_entries add constraint engineering_production_entries_unit_structure_fk foreign key(unit_structure_id) references public.work_structures(id) on delete restrict;
create index engineering_production_entries_unit_idx on public.engineering_production_entries(tenant_id,company_id,production_service_id,unit_structure_id) where unit_structure_id is not null;

do $$
declare v_tenant uuid:='5ebdb7ac-1909-42f2-b58a-ea947d01aa06';v_company uuid:='1ac1cde3-30fa-4fab-9ea0-8afbb34732e5';v_work uuid:='0b1d16b8-0cd4-4177-aeeb-1faac6d8a9ec';v_tower uuid:='696082b2-9e29-499f-8295-2bd8177e204b';v_floor uuid;v_label text;v_floor_no int;v_unit int;
begin
 for v_floor_no in 0..11 loop
  v_label:=case when v_floor_no=0 then 'TR' else v_floor_no::text||'º PAVIMENTO' end;
  select id into v_floor from public.work_structures where tenant_id=v_tenant and company_id=v_company and work_id=v_work and parent_id=v_tower and name=v_label and status='active' limit 1;
  if v_floor is null then
   insert into public.work_structures(tenant_id,company_id,work_id,parent_id,structure_type,name,sort_order,status) values(v_tenant,v_company,v_work,v_tower,'floor',v_label,v_floor_no,'active') returning id into v_floor;
  end if;
  for v_unit in 1..8 loop
   insert into public.work_structures(tenant_id,company_id,work_id,parent_id,structure_type,name,sort_order,status)
   select v_tenant,v_company,v_work,v_floor,'unit',(case when v_floor_no=0 then 100 else v_floor_no*100 end)+v_unit||'',v_unit,'active'
   where not exists(select 1 from public.work_structures where tenant_id=v_tenant and company_id=v_company and work_id=v_work and parent_id=v_floor and name=((case when v_floor_no=0 then 100 else v_floor_no*100 end)+v_unit)::text and status='active');
  end loop;
 end loop;
end $$;
commit;