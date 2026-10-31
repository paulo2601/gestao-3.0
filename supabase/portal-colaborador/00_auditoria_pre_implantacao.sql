-- SOMENTE LEITURA. Executar e revisar resultados antes de qualquer migração.
-- 1. Estrutura de autorização efetivamente disponível.
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
and table_name in ('company_memberships','tenant_memberships','companies','works','employment_contracts')
and column_name in ('id','tenant_id','company_id','user_id','role','status','work_id','hired_on','terminated_on')
order by table_name,column_name;

-- 2. Papéis e estados existentes, sem expor identificadores de usuários.
select 'company_memberships' as origem, role::text as papel, count(*) as quantidade
from public.company_memberships group by role
union all
select 'tenant_memberships',role::text,count(*) from public.tenant_memberships group by role
order by origem,papel;

-- 3. Vínculos inconsistentes entre contratos e empresas.
select count(*) as contratos_com_empresa_incompativel
from public.employment_contracts ec
join public.companies c on c.id=ec.company_id
where ec.tenant_id is distinct from c.tenant_id;

-- 4. Obras inconsistentes entre tenant e empresa.
select count(*) as obras_com_empresa_incompativel
from public.works w
join public.companies c on c.id=w.company_id
where w.tenant_id is distinct from c.tenant_id;

-- 5. Funções do portal já existentes (não prova que estão autorizadas).
select p.proname as funcao, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'employee_clock_%'
order by p.proname;
