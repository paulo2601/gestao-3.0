# Medições — Planejamento e Execução (especificação de implantação)

Status: em desenvolvimento, NÃO publicado em produção.

## Regra central
Planejamento mensal é separado de execução confirmada e de medição aprovada. Nunca incluir planejamento em `measurement_lines` ou no bruto da medição antes da confirmação de execução e do ato de medir. Dados anteriores são legados e não podem ser reinterpretados retroativamente.

## Dados complementares propostos (migração aditiva, sujeita à auditoria do schema)
- `engineering_measurement_plans`: id, tenant_id, contract_id, measurement_id, competence, origin_kind, origin_id, target_kind, target_id, planned_quantity, planned_value_override (somente itens globais), created_at, updated_at.
- `engineering_execution_entries`: id, tenant_id, contract_id, plan_id, execution_date, executed_quantity, executed_percent (somente itens globais), unit_id nullable, notes, created_by, created_at.
- Chave de idempotência por lançamento e controle transacional para evitar dupla contagem.
- RLS e escopo tenant/empresa compatíveis com os repositórios existentes.

## Interface
Na tela `GuidedMeasurementFlow`, manter cabeçalho, seleção de origem, ações e impressão. Transformar os cards das origens em painéis expansíveis com serviço, planejado, executado, pendente, percentual e ação.
- Check completo: confirmar quantidade restante prevista, exigindo confirmação antes de persistir.
- Execução parcial: modal com quantidade/data e seleção de apartamentos quando aplicável.
- Não usar checkbox marcado para serviço parcialmente executado; exibir estado `Parcial`.
- Auto-salvar após confirmação de cada lançamento, com feedback de erro/sucesso.
- Quatro cards: Planejado do mês, Executado do mês, Falta executar da meta, % da meta financeira. Avanço físico separado por quantidade/unidade ou ponderação contratual explícita; não somar metros com unidades.
- `Medido` permanece no fechamento financeiro, sem duplicar o painel de execução.

## Cálculos
- planejado financeiro = soma (quantidade planejada × preço unitário) ou percentual global × preço global.
- executado financeiro = soma das execuções confirmadas × preço unitário, limitado pelo saldo físico e sem duplicação.
- pendente da meta = max(0, planejado - executado referente à meta).
- progresso financeiro = executado da meta / planejado, quando planejado > 0.
- Não confundir execução do mês com execução acumulada nem saldo do aditivo com saldo do planejamento.
- Serviços por apartamento devem registrar seleção granular, inclusive parcial por unidade se o contrato permitir.

## Compatibilidade e aceite
1. Medições anteriores preservadas byte a byte; não alterar saldos, impostos, relatórios e contas a receber.
2. Planejar sem aumentar bruto, medido ou recebível.
3. Executar parcialmente, recarregar, manter quantidade e histórico.
4. Marcar unidades 101/102 e depois 103, sem duplicar.
5. Concluir e reabrir sem perder execuções nem gerar faturamento automático.
6. Testes de mobile e desktop, RLS, concorrência e deploy antes de merge em main.

## Referências de código identificadas
- `src/modules/engineering/ui/GuidedMeasurementFlow.tsx`
- `src/modules/engineering/ui/EngineeringContractWorkspace.tsx`
- `src/modules/engineering/ui/engineering-parity-measurement.css`
- `src/modules/engineering/infrastructure/LegacyMeasurementParityRepository.ts`

Próximo passo: ler implementações e migrations reais, ajustar modelo e somente então codificar e testar. Não habilitar em produção antes de testes.
