begin;

drop policy if exists work_structures_delete on public.work_structures;

create policy work_structures_delete
on public.work_structures
for delete
to authenticated
using (
  exists (
    select 1
    from public.company_memberships cm
    where cm.tenant_id = work_structures.tenant_id
      and cm.company_id = work_structures.company_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and cm.role in ('company_admin','manager','operator')
  )
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = work_structures.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role in ('tenant_owner','tenant_admin')
  )
);

commit;
