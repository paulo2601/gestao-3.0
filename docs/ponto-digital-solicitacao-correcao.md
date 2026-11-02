# Solicitação de correção de ponto — implementação

## Objetivo
O colaborador solicita uma marcação esquecida; apenas o RH pode aprovar ou rejeitar. Nenhuma solicitação altera o ponto automaticamente.

## Fluxo
1. Ponto Digital: botão **Solicitar correção**, data, tipo (entrada, saída almoço, retorno almoço, saída final), horário HH:mm e justificativa obrigatória.
2. Persistir a solicitação no Supabase com ID único, colaborador/contrato, data, tipo, horário, justificativa, status pending e timestamps. A identidade do colaborador deve vir de auth.uid() e do vínculo ativo em employee_clock_accounts, nunca de um user_id enviado pelo cliente.
3. Impedir solicitações duplicadas pendentes para o mesmo contrato/data/tipo e impedir solicitação quando já houver marcação válida (salvo fluxo específico de contestação).
4. RH do Gestão 3.0: fila de pendências com filtro por empresa, colaborador e período. Permitir aprovar/rejeitar, registrando responsável, data, justificativa da decisão e horário efetivamente aprovado.
5. Aprovação deve ser transacional no banco: verificar autorização RH e escopo da empresa, impedir dupla aprovação, registrar ajuste auditável e atualizar a fonte usada pelos relatórios. Nunca sobrescrever evento bruto capturado por GPS.
6. Ponto Digital: mostrar status pendente/aprovado/rejeitado e o motivo. Recalcular presença, atraso, horas extras e banco de horas após aprovação.
7. Pedidos devem exigir conexão online, com erro claro em modo offline. Batidas normais offline permanecem intactas.

## Critérios de aceitação
- Colaborador não consegue aprovar a própria solicitação nem acessar dados de outros colaboradores.
- RH de uma empresa não consegue consultar ou aprovar solicitações de outra empresa.
- Reenvio de pedido ou aprovação não duplica marcações.
- Auditoria preserva valor solicitado, valor aprovado, motivo e ator.
- Relatórios do RH e histórico do Ponto Digital apresentam o mesmo resultado após aprovação.
- Fluxos existentes de quatro batidas, offline, login persistente, exclusão e ajustes manuais continuam funcionando.

## Implantação
Documento de especificação técnica, não representa funcionalidade concluída. Implementar migração SQL/RLS, UI do colaborador, UI do RH, testes automatizados e validação em ambiente de teste antes do merge e deploy.
