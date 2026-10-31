-- Executar após 01_schema_preparacao.sql e revisão de segurança.
-- A função usa exclusivamente auth.uid() e hora do servidor.
create or replace function public.employee_clock_register(
 p_latitude double precision,
 p_longitude double precision,
 p_accuracy_m double precision
) returns table(event_id uuid, event_type text, recorded_at timestamptz, receipt_code uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
 v_user uuid := (select auth.uid());
 v_access public.employee_clock_access%rowtype;
 v_site public.employee_clock_worksites%rowtype;
 v_contract public.employment_contracts%rowtype;
 v_last text;
 v_next text;
 v_distance double precision;
 v_now timestamptz := clock_timestamp();
 v_id uuid;
 v_receipt uuid;
begin
 if v_user is null then raise exception 'Autenticação obrigatória'; end if;
 if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
  raise exception 'Coordenadas inválidas';
 end if;
 if p_accuracy_m is null or p_accuracy_m <= 0 or p_accuracy_m > 50 then
  raise exception 'Precisão GPS insuficiente';
 end if;
 select * into v_access from public.employee_clock_access
 where user_id=v_user and enabled=true
 order by created_at desc limit 1;
 if not found then raise exception 'Acesso ao ponto não autorizado'; end if;
 select * into v_contract from public.employment_contracts
 where id=v_access.employment_contract_id and tenant_id=v_access.tenant_id
 and company_id=v_access.company_id and status='active'
 and hired_on <= (v_now at time zone 'America/Sao_Paulo')::date
 and (terminated_on is null or terminated_on >= (v_now at time zone 'America/Sao_Paulo')::date);
 if not found then raise exception 'Contrato não está ativo'; end if;
 select * into v_site from public.employee_clock_worksites
 where tenant_id=v_access.tenant_id and company_id=v_access.company_id
 and work_id=v_access.work_id and enabled=true;
 if not found then raise exception 'Obra não autorizada para ponto'; end if;
 -- Haversine em metros, sem extensão geoespacial.
 v_distance := 6371000 * 2 * asin(least(1.0,sqrt(
  power(sin(radians(p_latitude-v_site.latitude)/2),2)
  +cos(radians(v_site.latitude))*cos(radians(p_latitude))
  *power(sin(radians(p_longitude-v_site.longitude)/2),2))));
 if v_distance + p_accuracy_m > v_site.radius_m then
  raise exception 'Fora do perímetro permitido ou localização imprecisa';
 end if;
 -- Bloqueio serializado por usuário e dia para impedir registros concorrentes.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || (v_now at time zone 'America/Sao_Paulo')::date::text,0));
 select e.event_type into v_last from public.employee_clock_events e
 where e.user_id=v_user
 and (e.occurred_at at time zone 'America/Sao_Paulo')::date=(v_now at time zone 'America/Sao_Paulo')::date
 order by e.occurred_at desc,e.id desc limit 1;
 v_next := case v_last when 'entry' then 'lunch_out'
 when 'lunch_out' then 'lunch_in'
 when 'lunch_in' then 'exit'
 when 'exit' then null
 else 'entry' end;
 if v_next is null then raise exception 'Quatro marcações já realizadas hoje'; end if;
 insert into public.employee_clock_events(
 tenant_id,company_id,employment_contract_id,work_id,user_id,event_type,
 occurred_at,latitude,longitude,accuracy_m,distance_m)
 values(v_access.tenant_id,v_access.company_id,v_access.employment_contract_id,
 v_access.work_id,v_user,v_next,v_now,p_latitude,p_longitude,p_accuracy_m,v_distance)
 returning id,employee_clock_events.receipt_code into v_id,v_receipt;
 return query select v_id,v_next,v_now,v_receipt;
end;
$$;
revoke all on function public.employee_clock_register(double precision,double precision,double precision) from public,anon;
grant execute on function public.employee_clock_register(double precision,double precision,double precision) to authenticated;
-- Leitura somente dos próprios comprovantes.
grant select on public.employee_clock_events to authenticated;
create policy employee_clock_own_events on public.employee_clock_events
 for select to authenticated using (user_id=(select auth.uid()));
-- Sem INSERT/UPDATE/DELETE direto do cliente.
