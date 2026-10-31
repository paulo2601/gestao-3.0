-- Aplicar somente após revisar as regras de associação e papéis do ambiente.
create or replace function public.employee_clock_admin_list_works(p_company_id uuid)
returns table(id uuid, name text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.company_memberships cm
   where cm.user_id = (select auth.uid()) and cm.company_id = p_company_id
     and cm.role in ('owner','admin')
 ) then raise exception 'Sem permissão para consultar obras'; end if;
 return query select w.id, w.name from public.works w
 where w.company_id = p_company_id order by w.name;
end; $$;
revoke all on function public.employee_clock_admin_list_works(uuid) from public, anon;
grant execute on function public.employee_clock_admin_list_works(uuid) to authenticated;
