begin;

create policy measurement_reopen_log_insert
on public.measurement_reopen_log
for insert
to authenticated
with check (
  app_private.can_edit_company(tenant_id,company_id)
  and actor_user_id = auth.uid()
);

commit;
