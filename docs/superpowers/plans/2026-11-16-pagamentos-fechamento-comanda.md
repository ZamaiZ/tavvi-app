# Pagamentos e fechamento de comanda Implementation Plan

> Para agentes de execução: implementar cada tarefa em ordem conforme superpowers:executing-plans. Este projeto proíbe criar ou executar testes e também proíbe comandos git, typecheck, build e lint.

**Goal:** Registrar pagamentos manuais integrais/parciais divididos entre formas configuráveis, fechar comandas quitadas e consultar o histórico encerrado no Caixa.

**Architecture:** Guardar métodos habilitados no restaurante e pagamentos em eventos imutáveis com linhas de divisão. RPCs Supabase autenticadas validam membership, método, idempotência e saldo sob bloqueio transacional; a UI usa Server Components para leitura, Server Actions para mutação e o Realtime atual do Caixa.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, TypeScript, Zod, Supabase/Postgres RPC e RLS, Base UI/shadcn local, Motion e react-icons.

**Spec:** docs/superpowers/specs/2026-11-16-pagamentos-fechamento-comanda-design.md

## Global Constraints

- Implementar no checkout atual, usando as convenções locais de Next.js e Supabase.
- Não instalar dependências.
- Não criar nem executar testes. Não executar git, typecheck, build ou lint.
- Revisar estaticamente SQL, contratos de dados, autorização, estados de UI e consistência entre os fluxos.

## Review Focus

- Duas tentativas concorrentes não podem consumir saldo em excesso; a RPC deve bloquear a mesma comanda antes de recalcular o saldo.
- Reenvio com o mesmo request_id deve retornar o lançamento existente, sem duplicar.
- Se a resposta se perder, persistir na sessão a solicitação exata e restaurá-la bloqueada para reenvio idempotente, mesmo após fechar o Sheet ou recarregar a página.
- Uma forma desabilitada não pode ser usada em novo pagamento, mas deve continuar visível em pagamentos antigos.
- Parcial mantém aberto; valor exato pode encerrar quando marcado; excesso é recusado; saldo zero pode ser encerrado depois sem outro lançamento.
- Histórico encerrado deve ser isolado por restaurante ativo, ordenado por fechamento e paginado em 25 registros.

## Mapa de arquivos

- Criar uma migração Supabase para configuração, status de fechamento, ledger, RLS, RPCs e broadcast.
- Criar features/panel/payments/model.ts com identificadores e rótulos compartilhados; criar features/panel/payments/lib/currency.ts e components/payment-amount-input.tsx para valores que podem exceder o limite unitário do cardápio.
- Ampliar features/panel/orders/model.ts, schema.ts, actions.ts e server/read.ts.
- Criar features/panel/orders/server/payment-write.ts para manter as duas RPCs de pagamento e fechamento fora da gravação de pedidos.
- Criar features/panel/settings com leitura, ação, persistência, modelo e interface de configuração.
- Criar app/painel/(workspace)/configuracoes/page.tsx, loading.tsx e error.tsx.
- Alterar features/panel/shell/components/panel-app-shell.tsx e panel-mobile-dock.tsx para rota e seção ativas.
- Criar features/panel/orders/components/comanda-payment-sheet.tsx; ampliar cash-workspace.tsx e app/painel/(workspace)/caixa/page.tsx, loading.tsx e error.tsx para pagamento, abas e histórico paginado.
- Atualizar a especificação anterior de pedidos/caixa e o documento de finalização para refletir o novo escopo, sem alterar o ciclo de chamados.

## Interfaces compartilhadas

- PanelPaymentMethod é a união de cash, debit, credit, meal_voucher, food_voucher e partnership.
- PaymentSplitInput contém method: PanelPaymentMethod e amountCents: number.
- PanelComandaPaymentSplitDTO contém id, method e amountCents.
- PanelComandaPaymentDTO contém id, createdAt, createdBy, createdByName, amountCents e splits: PanelComandaPaymentSplitDTO[].
- PanelComandaDTO contém id, restaurantId, tableNumber, status: open | closed, openedAt, closedAt, closedBy, orders, orderCount, itemCount, totalCents, paidCents, balanceCents e payments: PanelComandaPaymentDTO[].
- PanelComandasPage contém comandas: PanelComandaDTO[], page, pageSize e totalRows.
- getPanelComandasPage(restaurant, { status, page }) retorna PanelComandasPage; para status open, retorna todas as comandas abertas e page 1; a consulta de encerradas usa 25 registros.
- recordPanelComandaPaymentAction recebe expectedRestaurantId, comandaId, requestId, splits e closeIfPaid; retorna closed, paidCents, balanceCents e paymentId no sucesso.
- closePaidComandaAction recebe expectedRestaurantId e comandaId; retorna sucesso ou erro de conflito se o saldo não for zero.
- updatePanelPaymentMethodsAction recebe expectedRestaurantId e enabledMethods: PanelPaymentMethod[]; getPanelPaymentMethods(restaurantId) retorna PanelPaymentMethod[].

## Tarefas

### Task 1: Persistência e contratos transacionais

**Arquivos:**

- Criar supabase/migrations/20261116120000_panel_comanda_payments.sql
- Alterar features/panel/orders/model.ts, schema.ts, actions.ts e server/read.ts
- Criar features/panel/payments/model.ts, lib/currency.ts e components/payment-amount-input.tsx
- Criar features/panel/settings/model.ts, schema.ts, actions.ts, server/read.ts e server/write.ts
- Criar features/panel/orders/server/payment-write.ts

**Interfaces:**

- Produz os métodos, DTOs, resultados e Server Actions definidos em Interfaces compartilhadas.
- As leituras permanecem no servidor e validam a resposta Supabase com Zod.
- Os métodos de escrita resolvem getActivePanelRestaurant(expectedRestaurantId) antes da RPC e mapeiam falhas tipadas sem expor detalhes SQL.

- [x] Adicionar enabled_payment_methods com seis opções padrão e constraint para métodos permitidos; RPC de configuração exige membership ativa e ao menos um método.
- [x] Permitir status open/closed, adicionar closed_at/closed_by e preservar o índice parcial de uma comanda aberta por mesa.
- [x] Criar comanda_payments e comanda_payment_splits com valores positivos em centavos, request_id idempotente, chaves compostas por restaurante e RLS de leitura para membros ativos; revogar escrita direta.
- [x] Implementar RPC record_panel_comanda_payment: validar payload e métodos; serializar por request; bloquear comanda; verificar o request anterior; recalcular total e saldo; rejeitar excesso; persistir evento/splits; fechar somente quando saldo zero e solicitado; retornar estado calculado.
- [x] Implementar RPC close_paid_panel_comanda: bloquear comanda, recalcular saldo, fechar sem novo lançamento somente se quitada e aberta.
- [x] Adicionar gatilhos Realtime para pagamentos/splits e fechamento usando panel_orders_broadcast no tópico privado existente.
- [x] Implementar leitura de configurações e página de comandas com filtros status e paginação de 25 para encerradas; retornar pagamentos/splits junto aos snapshots de itens.
- [x] Revisar estaticamente restrições SQL, checks, RLS, SECURITY DEFINER, search_path, idempotência, casts e contratos TS/Zod.

### Task 2: Configurações e navegação Restaurante

**Arquivos:**

- Criar app/painel/(workspace)/configuracoes/page.tsx, loading.tsx e error.tsx
- Criar features/panel/settings/components/payment-settings-page.tsx
- Alterar features/panel/shell/components/panel-app-shell.tsx e panel-mobile-dock.tsx

**Interfaces:**

- A rota carrega o restaurante ativo e a configuração no Server Component, e entrega expectedRestaurantId e enabledMethods ao componente interativo.
- O componente chama updatePanelPaymentMethodsAction e atualiza props com router.refresh após sucesso.

- [x] Criar rota /configuracoes dentro do route group workspace, metadata, estado loading skeleton e error retry.
- [x] Construir página com seis switches rotulados, ícones, descrição de lançamento manual, alterações pendentes, erro/sucesso e botão salvar.
- [x] Desabilitar o salvamento quando todos os métodos estiverem desativados; bloquear controles enquanto a Server Action está pendente.
- [x] Incluir Configurações no grupo Restaurante da navegação desktop e móvel; estender activeSection e links com publicBasePath.
- [x] Conferir foco, labels, alvos de toque, mensagem sem depender de cor, movimento reduzido e cadência de transição.

### Task 3: Pagamento, saldo e histórico no Caixa

**Arquivos:**

- Criar features/panel/orders/components/comanda-payment-sheet.tsx
- Alterar features/panel/orders/components/cash-workspace.tsx
- Alterar app/painel/(workspace)/caixa/page.tsx, loading.tsx e error.tsx

**Interfaces:**

- CashWorkspace recebe a página filtrada, status aberto/encerrado, página atual e metadados de paginação.
- ComandaPaymentSheet recebe comanda, enabledMethods, expectedRestaurantId e fechamento disponível; submete splits em centavos e um requestId estável por tentativa.

- [x] Adicionar abas Abertas e Encerradas com links de busca/status; abrir query da página no Server Component.
- [x] Paginar encerradas em 25 itens por closed_at decrescente; manter a lista atual de abertas e a busca por mesa.
- [x] Mostrar total, pago e saldo em comandas abertas; mostrar pagamentos e horário de fechamento nas encerradas.
- [x] Construir sheet responsivo com uma linha inicial forma/valor, adição e remoção de linhas, no máximo uma por forma ativa, máscara PaymentAmountInput e resumo derivado.
- [x] Validar parcial, quitação, excesso e fechamento antes do envio; deixar a validação definitiva para a RPC.
- [x] Oferecer Fechar comanda junto ao lançamento que zera o saldo; para saldo já zero, oferecer fechamento sem novo pagamento.
- [x] Durante envio, travar controles e indicar loading; em sucesso fechar o sheet e sincronizar; em conflito preservar dados, explicar saldo desatualizado e permitir atualizar/repetir com segurança.
- [x] Respeitar prefers-reduced-motion, focus/focus-return do Sheet, labels e áreas seguras móveis.

### Task 4: Consolidação documental e revisão estática

**Arquivos:**

- Alterar docs/superpowers/specs/2026-11-16-pedidos-e-caixa-design.md
- Alterar docs/superpowers/specs/2026-11-16-pedidos-finalizacao-chamado-design.md
- Revisar os arquivos alterados das tarefas anteriores

- [x] Atualizar exclusões e invariantes antigas para que não contradigam o ledger, o fechamento e a aba Encerradas.
- [x] Conferir cobertura ponto a ponto da spec aprovada contra persistência, UI, navegação, loading/error e Realtime.
- [x] Fazer revisão estática dos cenários em Review Focus; não executar testes, typecheck, build, lint ou comandos git.
