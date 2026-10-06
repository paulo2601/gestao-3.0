begin;
alter table public.engineering_service_control_items
  add column if not exists notes text;

alter table public.engineering_service_control_entries
  drop constraint if exists engineering_service_control_entries_tenant_id_company_id_item_id_fkey;

alter table public.engineering_service_control_entries
  add constraint engineering_service_control_entries_tenant_id_company_id_item_id_fkey
  foreign key(tenant_id,company_id,item_id)
  references public.engineering_service_control_items(tenant_id,company_id,id)
  on delete restrict;
commit;
