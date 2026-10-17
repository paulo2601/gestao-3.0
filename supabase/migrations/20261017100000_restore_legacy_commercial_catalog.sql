-- Restore the non-sensitive commercial catalog from Gestão 2.0.
-- No tenant, membership, invoice or subscription is copied.
begin;
insert into public.platform_module_catalog(modulo,nome,descricao,categoria,vendavel,ativo,ordem)
values
('financeiro','Financeiro',null,'Financeiro',true,true,10),
('bancos','Bancos',null,'Financeiro',true,true,20),
('cartoes','Cartões',null,'Financeiro',true,true,30),
('dashboard','Dashboard',null,'Financeiro',true,true,40),
('rh_operacional','RH Operacional',null,'Recursos Humanos',false,false,50),
('rh_financeiro','RH Financeiro',null,'Recursos Humanos',false,false,60),
('rh','RH','Recursos Humanos operacional e financeiro em um único módulo.','Recursos Humanos',true,true,60),
('engenharia','Engenharia',null,'Engenharia',true,true,70),
('medicoes','Medições',null,'Engenharia',true,true,80),
('producao','Produção',null,'Engenharia',true,true,90),
('usuarios','Usuários e permissões',null,'Administração',true,true,100),
('configuracoes','Configurações',null,'Administração',true,true,110),
('limites','Limites',null,'Administração',true,true,120),
('auditoria','Auditoria',null,'Administração',true,true,130),
('relatorios','Relatórios',null,'Relatórios',true,true,140)
on conflict(modulo) do nothing;

insert into public.platform_plans(nome,slug,descricao,ativo,publico,ordem,preco_mensal,preco_anual,moeda)
values
('Proprietário','owner','Plano interno do proprietário da plataforma, sem limites.',true,false,0,null,null,'BRL'),
('RH','rh',null,true,true,1,100.00,1200.00,'BRL'),
('Starter','starter','Plano inicial com Financeiro e recursos essenciais.',true,true,10,99.90,999.00,'BRL'),
('Professional','professional','Plano completo para empresas com Financeiro, RH e Engenharia.',true,true,20,249.90,2499.00,'BRL'),
('Enterprise','enterprise','Plano avançado com todos os módulos e limites ampliados.',true,true,30,499.90,4999.00,'BRL')
on conflict(slug) do nothing;

-- Only modules present in the catalog are inserted; platform administration is separate.
with associations(slug,modulo) as (values
('rh','rh'),
('starter','bancos'),('starter','cartoes'),('starter','dashboard'),('starter','financeiro'),('starter','limites'),
('professional','bancos'),('professional','cartoes'),('professional','dashboard'),('professional','engenharia'),('professional','financeiro'),('professional','limites'),('professional','medicoes'),('professional','rh'),('professional','rh_financeiro'),('professional','rh_operacional'),
('enterprise','bancos'),('enterprise','cartoes'),('enterprise','configuracoes'),('enterprise','dashboard'),('enterprise','engenharia'),('enterprise','financeiro'),('enterprise','limites'),('enterprise','medicoes'),('enterprise','producao'),('enterprise','rh'),('enterprise','rh_financeiro'),('enterprise','rh_operacional'),('enterprise','usuarios'),
('owner','bancos'),('owner','cartoes'),('owner','configuracoes'),('owner','dashboard'),('owner','engenharia'),('owner','financeiro'),('owner','limites'),('owner','medicoes'),('owner','producao'),('owner','rh'),('owner','rh_financeiro'),('owner','rh_operacional'),('owner','usuarios')
)
insert into public.platform_plan_modules(plan_id,modulo,habilitado)
select p.id,a.modulo,true from associations a join public.platform_plans p on p.slug=a.slug
join public.platform_module_catalog m on m.modulo=a.modulo
on conflict(plan_id,modulo) do nothing;
commit;
