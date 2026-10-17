# Gestão 3.0 — comercialização SaaS (implantação progressiva)

## Estado
A migração `20261017090000_saas_commercial_foundation.sql` cria apenas tabelas e funções novas. **Não significa que o licenciamento já esteja em produção**. É preciso executar a migração no Supabase, validar políticas e implementar a aplicação, o checkout e a cobrança.

## Regras aprovadas
- Assinaturas mensal e anual, com desconto anual parametrizável; preços não definidos.
- Módulos: Financeiro, RH, Engenharia, Produção, Controle de Serviço, Relatórios e Orçamento.
- Cada cliente é um tenant, com empresas e usuários próprios.
- Tenants existentes recebem status `legacy` e grants de todos os módulos na migração, sem alteração das tabelas de negócios.
- Tenants novos não recebem grants automaticamente. Cobranças e atualizações de grants só por serviço confiável; nunca por cliente.
- Suspensão/cancelamento devem ser operados por processo de cobrança confiável, com webhook autenticado, idempotência e política explícita de carência.
- `has_saas_module(tenant_id,module)` é verificação do banco para futura integração. **Não substitui políticas RLS nas tabelas de domínio nem protege endpoints automaticamente.** Antes da venda, aplicar controle de licença em cada API/RPC, exportação e rota; negar acesso sem grant válido.
- Definir painel exclusivo de operador da plataforma, sem conceder aos administradores de tenants permissões para gerenciar licenças de terceiros.

## Biometria / passkeys
- Implementar WebAuthn com desafio aleatório emitido e validado no servidor, credencial vinculada ao usuário e à origem RP ID.
- Verificar assinatura, challenge, origin, RP ID, user presence/verification e proteção contra replay.
- A integração com Supabase Auth exige arquitetura de sessão confiável e recuperação por senha/email; **não simular biometria apenas com prompt local**.
- Android/PWA e desktop podem usar autenticador da plataforma; nunca armazenar dados biométricos.
- Antes de habilitar para clientes, executar testes em dispositivos reais e confirmar comportamento do domínio HTTPS final.

## Checklist antes de disponibilizar comercialmente
1. Aplicar e testar migração em ambiente de homologação com backup verificado.
2. Testar tenant legado e novo, permissões cruzadas, URL direta, APIs, relatórios e arquivos.
3. Implementar telas de catálogo, contratação e painel de licenças.
4. Integrar gateway de cobrança, webhooks assinados, reconciliação e renovação anual/mensal.
5. Integrar passkeys reais e fluxo de recuperação.
6. Validar LGPD, termos, política de privacidade, suporte, cobrança e emissão fiscal.
7. Passar typecheck, lint, testes, build e deploy em homologação antes de produção.

## Não fazer
Não editar registros financeiros, RH, engenharia ou produção para conceder licenças. Não armazenar preço em lógica de frontend como autoridade. Não remover dados de cliente suspenso automaticamente.
