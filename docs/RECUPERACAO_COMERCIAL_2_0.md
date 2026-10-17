# Recuperacao do licenciamento do Gestao 2.0

## Auditoria

O Gestao 2.0 possui PortalMasterPage, PlanManagementPage, catalogo de modulos, planos, assinaturas, cobranca e regras de permissao no Supabase. O Gestao 3.0 possui rotas provisórias para clientes SaaS e planos, mas ainda nao possui as tabelas comerciais antigas. O banco do 3.0 possui 1 tenant.

## Sequencia de implantacao segura

1. Comparar as tabelas e funcoes de licenciamento do 2.0 com os tenants, companies e memberships do 3.0.
2. Consolidar um unico esquema comercial no 3.0; nao instalar modelos paralelos saas_* e platform_* como fontes independentes de verdade.
3. Preparar migracao aditiva, reversivel e testada em homologacao. Preservar todos os registros atuais.
4. Portar o Portal Master e Planos e Modulos para os componentes e autenticacao do 3.0.
5. Restringir telas administrativas a operadores autorizados da plataforma; nao basta ser administrador de uma empresa cliente.
6. Verificar licencas no servidor e RLS, inclusive em acesso direto por URL, RPC e exportacoes.
7. Integrar pagamentos e assinaturas mensal e anual, com desconto anual configuravel e webhooks verificados.
8. Testar isolamento entre clientes, expiracao, renovacao, bloqueio e reativacao antes do deploy.

## Estado

Este arquivo documenta a auditoria. Nenhuma migracao foi aplicada ao banco de producao e nenhum modulo comercial foi ativado.
