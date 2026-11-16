# Pedidos: finalização do chamado e tempos de atendimento — Plano de Implementação

**Objetivo:** Finalizar o chamado atomicamente ao confirmar o pedido, exibir seus dois tempos no histórico e usar o `Sheet` de tela cheia existente no fluxo de pedidos.

**Arquitetura:** Uma migração Supabase reconcilia chamados legados com pedidos e instala um gatilho transacional em `orders`. O cliente deriva os tempos dos timestamps que já recebe e, após sucesso, fecha o Sheet e mostra feedback na fila.

**Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, Base UI (`Sheet`), Supabase/PostgreSQL, Motion.

**Spec:** [2026-11-16-pedidos-finalizacao-chamado-design.md](../specs/2026-11-16-pedidos-finalizacao-chamado-design.md)

## Restrições globais

- Alterar o mínimo e preservar contratos, layout, estados e fluxo da Caixa existentes.
- Não adicionar pagamentos nem alterar o ciclo de vida da comanda.
- Não adicionar colunas de duração; usar `created_at`, `claimed_at` e `resolved_at` já persistidos.
- Respeitar `AGENTS.md`: não executar `git`, `typecheck`, `build`, `lint` ou `test`; não criar testes.

## Pontos para revisão manual

- Pedido inválido ou indisponível não pode deixar o chamado resolvido; o gatilho e a gravação precisam compartilhar a mesma transação.
- Apenas o `created_by` igual ao `claimed_by` do chamado pode confirmar um pedido da mesma mesa/restaurante para encerrá-lo.
- Reenvio idempotente de pedido já gravado deve continuar retornando sucesso, e o chamado legado associado precisa estar reconciliado.
- Chamados sem `claimed_at` ou `resolved_at` não podem mostrar intervalos incompletos.
- A conversão para `Sheet` precisa manter fechamento protegido, confirmação de descarte, suporte a movimento reduzido e layout de tela inteira.

---

### Tarefa 1: Encerrar o chamado na transação do pedido

**Arquivos:**
- Criar `supabase/migrations/20261116110000_panel_orders_resolve_call.sql`.

**Resultado esperado:**
- Antes de instalar o gatilho, atualizar chamados `in_progress` com pedidos vinculados do mesmo restaurante para `resolved`, usando o maior `orders.created_at` (limitado inferiormente por `claimed_at`) e `claimed_by` como `resolved_by`.
- Criar uma função de gatilho `SECURITY DEFINER`, com `search_path = ''`, que ignore pedidos sem `service_call_id`; para os demais, atualize apenas o chamado correspondente, no mesmo restaurante, ainda em atendimento e atribuído a `NEW.created_by`.
- Se a atualização não encontrar esse chamado, lançar SQLSTATE `P0001` e mensagem `call_conflict`; assim, a transação de `record_panel_order` reverte comanda e itens junto com o pedido.
- Instalar o gatilho `AFTER INSERT ON public.orders` condicionado a `service_call_id IS NOT NULL`; revogar execução direta da função para `PUBLIC`, `anon` e `authenticated`.

**Conferência manual:** revisar a ordem da reconciliação e instalação do gatilho, o predicado de restaurante/responsável/estado e a exceção capturada pelo RPC existente. **Concluída:** migração adicionada em `20261116110000_panel_orders_resolve_call.sql`.

### Tarefa 2: Sheet de pedido e tempos no histórico

**Arquivos:**
- Modificar `features/panel/orders/components/call-order-dialog.tsx`.
- Modificar `features/panel/calls/components/calls-workspace.tsx`.

**Interfaces:**
- Manter o contrato atual de props do componente, acrescentando apenas um callback de pedido concluído para publicar o feedback na fila.
- Reutilizar `PanelServiceCallDTO.createdAt`, `claimedAt` e `resolvedAt`; sem alterar leitura ou tipos.

**Resultado esperado:**
- Trocar `Dialog`/`DialogContent` por `Sheet`/`SheetContent` e título/descrição acessíveis do Sheet; preservar a caixa em `100dvh`, layouts responsivos, proteções para descarte/reenvio, estados de envio e redução de movimento.
- Em sucesso do RPC, informar que pedido e chamado foram concluídos, fechar o Sheet e atualizar a fila. Manter o comportamento atual em falhas e resultados incertos.
- Exibir nos chamados finalizados `Tempo até aceite` (`claimedAt - createdAt`) e `Tempo de atendimento` (`resolvedAt - claimedAt`) em duração legível pt-BR. Não renderizar intervalos incompletos; limitar diferença negativa a zero.

**Conferência manual:** reler imports/markup acessível e o caminho de sucesso, validar que a fila recebe feedback após fechar o Sheet e que os cartões ativos sem `resolvedAt` não exibem duração final. **Concluída:** pedidos agora usam `Sheet`, propagam sucesso à fila e cartões exibem os tempos derivados dos timestamps.

## Execução

Executar as duas tarefas inline, na ordem acima. Não rodar comandos proibidos nem testes, conforme `AGENTS.md`.
