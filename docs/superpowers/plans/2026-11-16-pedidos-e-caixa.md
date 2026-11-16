# Pedidos da Mesa e Caixa Implementation Plan

> Implementação direta em tarefas na sequência abaixo. Nenhum comando de teste ou git deve ser adicionado ou executado.

**Goal:** Registrar pedidos associados a chamados, abrir/reutilizar a comanda da mesa e consultar comandas abertas em Caixa.

**Architecture:** Entidades próprias para comanda, pedido, linha e acréscimo; uma RPC transacional e idempotente grava a confirmação. O painel de Chamados abre um Dialog full-screen com catálogo e resumo; Caixa carrega as comandas abertas no servidor e atualiza por Realtime.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, Supabase PostgreSQL/RPC/Realtime, Zod, Base UI local, Tailwind e Motion.

**Spec:** docs/superpowers/specs/2026-11-16-pedidos-e-caixa-design.md

## Global Constraints

- Não executar git, typecheck, build, lint ou test.
- Não adicionar nem executar testes.
- Não instalar dependências.
- Sem pagamentos, sessão de caixa, liquidação ou fechamento de comanda.
- A comanda só nasce na confirmação do primeiro pedido; chamado e comanda seguem ciclos separados.
- Somente a pessoa atribuída lança pedido e conclui o chamado.
- Preço de catálogo e disponibilidade são revalidados no banco; acréscimos livres guardam descrição, quantidade e preço unitário submetido pela pessoa responsável.

## Review Focus

- Repetição da confirmação após timeout não duplica o pedido: conferir request_id único e retorno idempotente da RPC.
- Duas confirmações concorrentes na primeira compra da mesa convergem para uma comanda: conferir índice parcial e tratamento de unique_violation.
- Item, categoria ou variação ocultos/esgotados entre a leitura e a confirmação falham sem perder o carrinho.
- Uma pessoa de outro restaurante ou não atribuída ao chamado não consegue gravar nem concluir; conferir membership, claimed_by e RLS.
- Em viewport estreita, barra fixa não encobre foco, conteúdo ou botão principal; conferir classes e composição responsiva.

## Mapa de arquivos

- Criar docs/superpowers/specs/2026-11-16-pedidos-e-caixa-design.md e docs/superpowers/plans/2026-11-16-pedidos-e-caixa.md.
- Criar supabase/migrations/20261116100000_panel_orders_and_comandas.sql para tabelas, índices, RLS, funções transacionais e broadcasts.
- Criar features/panel/orders/model.ts e schema.ts para contratos DTO/entrada; actions.ts e server/read.ts e server/write.ts para Server Actions e acesso aos dados.
- Criar features/panel/orders/components/call-order-dialog.tsx, order-item-composer.tsx, order-menu-catalog.tsx, order-summary.tsx e cash-workspace.tsx (inclui o provider Realtime e seus estados de interface).
- Criar app/painel/(workspace)/caixa/page.tsx, loading.tsx e error.tsx.
- Modificar features/panel/calls/model.ts, actions.ts, server/write.ts, components/calls-workspace.tsx e app/painel/(workspace)/chamados/page.tsx para seleção de chamado, acesso ao catálogo e conclusão separada.
- Modificar features/panel/shell/components/panel-app-shell.tsx e panel-mobile-dock.tsx para rota e seleção ativa Caixa.

## Interfaces

- Menu da tela de Chamados recebe PanelMenuDTO e mostra todas as categorias e itens; conserva ocultos, indisponíveis e sem mídia visíveis porém desabilitados. O nome da variação exibe a medida cadastrada, quando aplicável.
- recordPanelOrderAction recebe entrada validada por Zod com expectedRestaurantId, callId, requestId e itens { menuItemId, variantId, quantity, observations, additions: { name, quantity, unitPriceCents }[] }. Retorna { orderId, comandaId, totalCents }.
- getPanelOpenComandas(restaurantId) retorna PanelComandaDTO[] com id, tableNumber, openedAt, orders e totalCents; os pedidos contêm snapshots de linhas e acréscimos.
- A função SQL record_panel_order valida a entrada e devolve um JSON de resultado estreito, nunca linhas cruas para o browser.
- CashRealtimeProvider recebe restaurantId e atualiza a rota ao receber broadcast privado do restaurante.

---

### Task 1: Persistência transacional de pedido e comanda

**Files:**
- Create: supabase/migrations/20261116100000_panel_orders_and_comandas.sql
- Modify: features/panel/calls/model.ts
- Modify: features/panel/calls/server/write.ts

- Criar comandas com restaurant_id, table_number, status open, opened_at e opened_by; índice único parcial por restaurant_id/table_number enquanto status for open.
- Criar orders com comanda_id, service_call_id, restaurant_id, request_id, created_by e created_at; unique restaurant_id/request_id.
- Criar order_items com snapshots de nome/categoria/variação/preço, quantidade e observations. Criar order_item_additions com nome, quantidade por unidade e unit_price_cents.
- Adicionar constraints para quantidade positiva, valores inteiros não negativos limitados por MENU_MAX_PRICE_CENTS e limites de texto coerentes com a entrada Zod.
- Habilitar RLS com leitura por panel_menu_member; revogar escrita direta de public/anon/authenticated.
- Criar RPC record_panel_order: autenticar, validar membership, retornar pedido existente para request_id do mesmo autor, bloquear o chamado, exigir estado in_progress e claimed_by igual a auth.uid(), validar todos os itens e preços atuais, abrir/reutilizar comanda sob índice único, gravar snapshots e retornar id/total.
- Rejeitar itens sem mídia, categoria/item invisível, item indisponível e variação ausente/inválida/indisponível.
- Atualizar resolve_service_call para recusar pessoa que não seja claimed_by; adicionar o código not_assignee ao contrato de falha do chamado.
- Criar broadcast privado no tópico comandas:<restaurant_id> para INSERT nas tabelas de comanda/pedido/linhas/acréscimos e política de leitura do tópico por membership.
- Fazer leitura estática do SQL criado para confirmar grants, constraints, caminho de idempotência e branches de validação. Não executar SQL remoto.

### Task 2: Contratos, ações e leituras do domínio

**Files:**
- Create: features/panel/orders/model.ts
- Create: features/panel/orders/schema.ts
- Create: features/panel/orders/actions.ts
- Create: features/panel/orders/server/read.ts
- Create: features/panel/orders/server/write.ts

- Definir DTOs mínimos para comanda, pedido, linha e acréscimo e unions de erro para sessão/contexto, responsável, chamado, catálogo e disponibilidade.
- Validar expectedRestaurantId, callId, requestId UUID, 1–80 caracteres para nome do acréscimo, quantidade 1–99, até 10 acréscimos por linha, observação até 500 caracteres e preço em centavos não negativo até MENU_MAX_PRICE_CENTS.
- Implementar action segura no padrão das features existentes: resolver restaurante ativo, validar contexto, chamar RPC e converter resultado para DTO/erro.
- Implementar leitura server-only de comandas abertas com pedidos e linhas; ordenar por mesa, horário e posição e calcular subtotal dos snapshots sem expor registros brutos.
- Usar a leitura atual de menu para abastecer chamadas; não criar um segundo modelo de cardápio.
- Revisar serialização, acesso server-only e formato dos RPCs por inspeção estática.

### Task 3: Editor de pedidos full-screen em Chamados

**Files:**
- Create: features/panel/orders/components/call-order-dialog.tsx
- Create: features/panel/orders/components/order-menu-catalog.tsx
- Create: features/panel/orders/components/order-item-composer.tsx
- Create: features/panel/orders/components/order-summary.tsx
- Modify: app/painel/(workspace)/chamados/page.tsx
- Modify: features/panel/calls/components/calls-workspace.tsx
- Modify: features/panel/calls/model.ts
- Modify: features/panel/calls/actions.ts
- Modify: features/panel/calls/server/write.ts

- Carregar PanelMenuDTO e currentUserId no Server Component de Chamados junto das filas.
- Manter o botão Assumir em chamados pendentes. Em atendimento, tornar o card botão acessível que abre o diálogo; mover Concluir atendimento para o diálogo.
- Usar DialogContent com override local para fixed inset-0, 100vw, 100dvh, sem max-width/radius, safe areas e rolagem interna. Não modificar Dialog global nem usar Sheet para pedido.
- Construir cabeçalho fixo da mesa e layouts desktop/mobile conforme spec.
- Construir tabs horizontais Base UI/shadcn com scrollbar escondida, categoria Todos e filtro combinado com busca local debounce 250 ms.
- Construir linhas de catálogo inspiradas em MenuItemRow, com foto/poster ou placeholder, categoria, nome, descrição, preço ou opções de variação. Nomes de variação aparecem com seus preços; ocultos, indisponíveis e sem mídia ficam identificados e desabilitados.
- Construir configurador com seletor de variação obrigatória, stepper, textarea de observações e linhas independentes de acréscimos livres (descrição, quantidade e preço).
- Construir resumo editável, subtotal, barra fixa mobile e confirmação disabled sem itens, durante salvamento e para pessoa não atribuída.
- Gerar requestId uma vez por confirmação e conservá-lo até resposta definitiva; preservar o carrinho em erro; após sucesso, limpar carrinho, atualizar a comanda exibida e manter o chamado aberto para novo pedido.
- Mostrar feedback distinto para responsável, chamado concluído, item/preço alterado, falha de rede e sucesso.
- Concluir atendimento em ação separada, fechar o diálogo após sucesso e atualizar as filas.
- Aplicar Motion com stagger curto, transições de estado, estados skeleton/empty/error e prefers-reduced-motion. Inspecionar teclado e foco visível no código.

### Task 4: Página Caixa com comandas abertas

**Files:**
- Create: app/painel/(workspace)/caixa/page.tsx
- Create: app/painel/(workspace)/caixa/loading.tsx
- Create: app/painel/(workspace)/caixa/error.tsx
- Create: features/panel/orders/components/cash-workspace.tsx
- Modify: features/panel/shell/components/panel-app-shell.tsx
- Modify: features/panel/shell/components/panel-mobile-dock.tsx

- Criar a página Server Component que exige restaurante ativo e carrega DTOs iniciais de comandas; manter o provider Realtime junto da CashWorkspace e a skeleton na rota.
- Apresentar grade responsiva, estado vazio, retry de erro, skeleton e cartões de mesa com horário, pedidos/itens e subtotal.
- Expandir detalhes em linha mostrando snapshots, variações, quantidades, observações e acréscimos separados.
- Assinar o tópico privado por restaurante; em INSERT/update, agrupar eventos e chamar router.refresh; ressincronizar ao reconectar ou tornar a aba visível.
- Adicionar link Caixa ao grupo Operação no desktop e navegação móvel, href contextual, activeSection e ícone consistente.
- Não incluir botões de pagamento, abertura/fechamento de sessão ou encerramento de comanda.

### Task 5: Revisão final estática e visual

- Rever manualmente todos os fluxos de erro, disabled, salvamento, sucesso e estados vazios no código.
- Se ambiente e sessão local permitirem, abrir Chamados e Caixa no navegador para inspeção visual manual em 375, 768, 1024 e 1440 px; não adicionar automação nem testes.
- Revisar especificamente os cinco casos da seção Review Focus e corrigir falhas encontradas.
- Fazer busca final por rotas e imports recém-criados e reler migração, actions e componentes. Não executar git, build, lint, typecheck ou testes.
