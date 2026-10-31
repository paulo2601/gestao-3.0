# Portal do Colaborador — implantação controlada

**Estado:** desenvolvimento isolado; não executar em produção sem homologação.

## Antes da migração

1. Conferir estrutura real de `companies`, `works`, `employment_contracts`, `company_memberships` e `tenant_memberships`.
2. Executar a auditoria somente-leitura `00_auditoria_pre_implantacao.sql` e avaliar os resultados.
3. Conferir duplicidades de `employee_clock_access.user_id` entre vínculos habilitados e de eventos por contrato/dia/tipo antes de criar índices únicos.
4. Verificar os papéis autorizados nas funções `security definer` e os privilégios de execução.
5. Criar backup e plano de reversão; testar primeiro em ambiente de homologação.

## Ordem prevista das migrações

`01_schema_preparacao.sql` → `02_marcacao_segura.sql` → `03_autorizacao_portal.sql` → `04_relatorio_rh.sql` → `05_admin_worksites.sql` → `06_admin_list_works.sql` → `07_admin_access.sql` → `08_integridade_vinculos.sql`.

## Testes obrigatórios

- Colaborador sem acesso não entra no portal; RH não autorizado não administra perímetros, vínculos ou relatórios.
- Quatro registros válidos, com data/hora do servidor e comprovante; quinta marcação e duplicidades são recusadas.
- GPS fora do raio, impreciso ou negado não registra ponto.
- Contrato desligado, obra desabilitada ou acesso revogado bloqueiam nova marcação.
- RH consegue revogar vínculo quando a obra está desabilitada.
- Conta não pode estar habilitada para dois contratos ao mesmo tempo.
- Relatório apresenta entrada, almoço, retorno e saída no dia correto em São Paulo, inclusive perto da meia-noite; fins de semana, feriados e faltas permanecem destacados.
- Acesso de uma empresa não expõe dados de outra; Gestão 3.0 existente continua funcional.
- Executar build TypeScript e testes automatizados antes do merge.

## Publicação

Somente depois de homologar banco e interface: preparar um único merge e uma única publicação final no Cloudflare, com validação pós-deploy. Nenhuma etapa deste documento representa autorização para implantar.
