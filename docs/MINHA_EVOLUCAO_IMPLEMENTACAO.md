# Minha Evolução — implementação isolada

## Integração ao Gestão 3.0

Módulo pessoal acessível no Gestão 3.0, usando a autenticação existente. Desenvolvimento na branch `feature/minha-evolucao-20261026`; não integrar em `main` nem executar deploy antes dos testes.

## Escopo funcional

- **Peso**: peso inicial, atual e alvo; registros datados; marcos e gráficos históricos; cálculos sem promessa de previsão clínica.
- **Diário alimentar**: pesquisa por nome, porções em gramas/unidades, calorias, proteínas, carboidratos e gorduras; refeições favoritas; repetição rápida; edição e histórico.
- **Bases externas**: Open Food Facts para produtos com código de barras; avaliação da licença da TBCA e da API USDA antes de integração. Manter cache limitado; dados nutricionais podem ser incompletos.
- **Metas pessoais**: economias, viagens, compras e projetos; valor-alvo, acumulado, prazo, etapas e histórico. Não criar movimentações bancárias reais nem interferir no Financeiro.
- **Painel**: resumos, progresso e filtros por período.

## Isolamento e privacidade

1. Tabelas próprias com prefixo `evolution_`, sem alterações em tabelas empresariais existentes.
2. Toda linha privada terá `user_id uuid not null` vinculado ao usuário autenticado, RLS com `(select auth.uid()) = user_id` para leitura, inserção, edição e exclusão; atualização com `WITH CHECK`.
3. Sem leitura ou gravação em `financial_*`, `engineering_*`, `employees`, `measurements` ou tabelas legadas.
4. Componentes carregados sob demanda; nenhum fetch do módulo na Home do Gestão 3.0.
5. Sem chaves secretas no cliente; API externa com limites, tratamento de erros e cache controlado.
6. Alterações de esquema somente após revisão de migração, índices, políticas RLS e testes de acesso cruzado.

## Plano de entrega

1. Modelagem e testes unitários de cálculos nutricionais e metas.
2. Migração reversível das tabelas novas e auditoria de RLS.
3. Páginas de peso, alimentação e metas, mantendo padrão visual do Gestão 3.0.
4. Integração da rota e menu, restrita à branch.
5. Executar typecheck, lint, testes, build e validação de navegação mobile.
6. Revisar desempenho e somente depois submeter para integração à versão principal.

## Auditoria prévia

O Supabase Gestão 3.0 já possui alertas de segurança e desempenho anteriores a este módulo. Eles não devem ser alterados automaticamente por esta implementação. Revisar separadamente duas tabelas com RLS desativada e funções SECURITY DEFINER expostas. Não confundir esses alertas preexistentes com falhas introduzidas pelo Minha Evolução.
