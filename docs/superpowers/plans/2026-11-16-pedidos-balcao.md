# Pedidos de balcão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar pedidos diretos no Caixa, para consumo no local ou viagem, com comanda própria quando não houver mesa e usando o mesmo catálogo, saldo, pagamento e encerramento existentes.

**Architecture:** Generalizar a gravação transacional de pedidos e permitir comanda sem mesa. A chamada existente permanece compatível; um novo contrato contextual aceita chamado opcional, modo de consumo, mesa e nome, e o Caixa reutiliza o editor de itens e o ledger atual.

**Tech Stack:** Next.js 16.4.2, React 19.3.1, Supabase/PostgreSQL, Base UI/shadcn local e Motion. Sem novas dependências.

**Spec:** `docs/superpowers/specs/2026-11-16-pedidos-balcao-design.md`

## Global Constraints

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`; não adicionar testes.
- Antes de código Next.js, ler o guia pertinente em `node_modules/next/dist/docs/`.
- Não instalar dependências.
- Chamados existentes continuam vinculados à mesa, ao responsável e ao gatilho de finalização atômica.
- Pedidos sem mesa recebem número sequencial único por restaurante, crescente e sem reinício automático.
- Valores continuam em centavos e preço/total/estoque disponível são revalidados no banco.

## Review Focus

- Pedido por chamado mantém validação de chamado, atribuição, mesa e finalização; pedido direto nunca cria/resolve chamado. Revisar os ramos da RPC e os dois contratos na camada de gravação.
- `takeaway` com mesa e número de mesa inválido são recusados antes de gravar; `dine_in` sem mesa continua permitido. Revisar schema Zod e constraints do banco.
- Repetição incerta de `request_id` devolve a mesma comanda/número sem nova gravação; mesmo ID com conteúdo diferente retorna conflito. Revisar lock, fingerprint e retorno de replay na RPC.
- Pedidos simultâneos sem mesa recebem números diferentes e únicos; falha ao salvar itens reverte sequência, comanda e pedido na mesma transação. Revisar upsert/lock e limites transacionais.
- Pagamentos parciais, liquidação e fechamento seguem operando por `comanda_id` para mesa e balcão. Revisar o contrato DTO consumido pelo diálogo de pagamento e não alterar as RPCs financeiras.

---

### Task 1: Persistência transacional de pedidos de balcão

**Files:**
- Create: `supabase/migrations/20261116130000_panel_walkup_orders.sql`

**Interfaces:**
- Produces: `record_panel_order_with_context(p_restaurant_id uuid, p_call_id uuid, p_request_id uuid, p_items jsonb, p_fulfillment_type text, p_table_number integer, p_customer_name text) returns jsonb`.
- Preserves: `record_panel_order(p_restaurant_id uuid, p_call_id uuid, p_request_id uuid, p_items jsonb) returns jsonb` for existing call clients.
- Private shared implementation: `record_panel_order_internal(p_restaurant_id uuid, p_call_id uuid, p_request_id uuid, p_items jsonb, p_fulfillment_type text, p_table_number integer, p_customer_name text) returns jsonb`, callable only by the two authenticated RPC wrappers.

- [x] **Step 1: Add compatible columns and constraints**

Allow null `comandas.table_number`; add `orders.fulfillment_type` (`dine_in`/`takeaway`, existing rows default to `dine_in`), nullable `display_number bigint` bounded to JavaScript's safe-integer maximum, nullable trimmed `customer_name` (maximum 120), and nullable `request_fingerprint` for historical compatibility. Add checks so takeaway cannot carry a table and call-linked orders are dine-in. Add a partial unique index on `(restaurant_id, display_number)` and a private per-restaurant sequence table with positive `last_number`.

- [x] **Step 2: Implement atomic number allocation and the private order function**

Move the existing item/category/variant/addition validation and snapshot writes into `record_panel_order_internal`. It must validate active membership and the expected restaurant; if `p_call_id` is present, lock and validate the call and derive its table; otherwise accept a manual positive table or, when table is null, atomically allocate the restaurant number and create a distinct comanda. A direct order with a table reuses the open comanda for that table. Compute `request_fingerprint` inside Postgres as `md5` of canonical JSONB containing call ID, fulfillment, effective table, normalized name and submitted items; use it only for idempotency equality, not authorization. Check the existing request ID before allocating a number; a matching retry returns the saved `displayNumber`, and a changed request returns `request_conflict`.

- [x] **Step 3: Keep public RPCs narrow and preserve access rules**

Make the existing four-argument RPC delegate to the private function as a dine-in call order. Add `record_panel_order_with_context` for call and direct contexts. Revoke direct execution on the private function, grant only authenticated execution on public RPCs, keep direct table writes revoked, and preserve transaction rollback and the existing order broadcast trigger.

- [x] **Step 4: Review migration invariants statically**

Read the whole migration and verify: legacy rows stay dine-in; many null-table comandas are allowed; one open table comanda remains unique; sequence allocation and request replay occur before inserts as designed; failed item insertion rolls back all writes; direct context never updates `service_calls`; call context still activates the existing resolution trigger.

### Task 2: Contextual action and validated order contract

**Files:**
- Modify: `features/panel/orders/model.ts`
- Modify: `features/panel/orders/schema.ts`
- Modify: `features/panel/orders/server/write.ts`
- Modify: `features/panel/orders/actions.ts`

**Interfaces:**
- `RecordPanelOrderInput` adds `fulfillmentType: "dine_in" | "takeaway"`, `tableNumber: number | null` and `customerName: string | null`; `callId` becomes `string | null`.
- `RecordPanelOrderResult` adds `displayNumber: number | null`.
- Server write invokes `record_panel_order_with_context` with the exact snake-case RPC arguments from Task 1.

- [x] **Step 1: Define and validate both contexts**

Extend the strict Zod schema with nullable UUID call, mode enum, positive nullable integer table, trimmed nullable name (maximum 120), and current bounded items. Refine that call-linked requests are dine-in with no separately supplied table, takeaway has no table, and a supplied table is dine-in. Keep all existing item and addition limits.

- [x] **Step 2: Parse the contextual RPC response**

Update the server action to call `record_panel_order_with_context`; parse `order.displayNumber` as a positive safe integer or null and retain current context/auth/error mapping. Add only the failure codes returned by the new RPC and keep unknown payloads as database errors.

- [x] **Step 3: Review retry and failure mapping statically**

Trace the call path and direct path through parse, server context, RPC argument mapping, success parsing and error results. Confirm retry reuses the same request ID and the returned generated number is propagated without trusting a client-supplied number.

### Task 3: Extend Caixa read models for mixed references

**Files:**
- Modify: `features/panel/orders/model.ts`
- Modify: `features/panel/orders/server/read.ts`

**Interfaces:**
- `PanelComandaDTO.tableNumber` becomes `number | null`.
- `PanelComandaOrderDTO` adds `fulfillmentType`, `displayNumber` and `customerName`.
- Raw Zod schemas/select include the new order columns and allow null `table_number`.

- [x] **Step 1: Parse and map order context**

Select the new order columns, validate their database values and map them into the DTO. Keep order item, total, payment split and balance calculations unchanged.

- [x] **Step 2: Preserve useful ordering and pagination**

Keep closed comandas ordered by most recent close. For open comandas, order table accounts by table number and no-table accounts by open time, with deterministic ID tie-breaks.

- [x] **Step 3: Review data combinations statically**

Inspect mapper behavior for legacy table rows, manually assigned table rows, dine-in without table, takeaway, empty legacy payment relations, and closed comandas. Confirm malformed persisted mode/number data fails closed through the existing unavailable path.

### Task 4: Share the item-entry surface while preserving call behavior

**Files:**
- Create: `features/panel/orders/components/order-entry-sheet.tsx`
- Modify: `features/panel/orders/components/call-order-dialog.tsx`

**Interfaces:**
- `OrderEntrySheet` owns catalog search/category selection, item composer, cart, quantity/observation/addition handling, mobile summary and uncertain retry state.
- Props: `open`, `title`, `subtitle`, optional `statusLabel`, `menu`, `cardapioHref`, `canEdit`, optional `confirmLabel`/`lockedMessage`/`headerActions`, `onEditContext`, `failureMessage(code)`, `onOpenChange(open)`, `onSubmit(requestId, items)`, and `onOrderCompleted(result)`. Counter context additionally uses `preparationStep`/`isPrepared`; call context uses `onItemsCountChange` to guard manual resolution.
- `onSubmit` is `(requestId: string, items: OrderItemInput[]) => Promise<PanelOrderActionResult<RecordPanelOrderResult>>`; the sheet owns request ID generation/retry, cart reset, and close protection. Call-specific claim/resolve controls remain owned by the call adapter and enter through `headerActions`.

- [x] **Step 1: Extract the shared order editor surface**

Move the reusable catalog/composer/cart interaction to `OrderEntrySheet`, using existing `OrderMenuCatalog`, `OrderItemComposer`, `OrderSummary`, Motion timing and reduced-motion behavior. Keep full-screen Sheet layout, fixed summary and close/discard protection.

- [x] **Step 2: Adapt call orders to the shared surface**

Keep the current call header, assignee authorization, manual resolve action and existing message semantics. Implement `onSubmit(requestId, items)` as `recordPanelOrderAction({ expectedRestaurantId, callId: call.id, requestId, fulfillmentType: "dine_in", tableNumber: null, customerName: null, items })`. On success continue reporting that the call was finalized and close the Sheet.

- [x] **Step 3: Review call regressions statically**

Compare the new call adapter to its prior guards: non-assignees remain read-only; pending request blocks close/edit; retry reuses its key; successful call order still closes only after the atomic server response; manual resolve remains unavailable while cart is nonempty.

### Task 5: Add the direct order flow to Caixa

**Files:**
- Create: `features/panel/orders/components/counter-order-dialog.tsx`
- Modify: `app/painel/(workspace)/caixa/page.tsx`
- Modify: `features/panel/orders/components/cash-workspace.tsx`

**Interfaces:**
- `CounterOrderDialog` receives restaurant ID and menu DTO; it uses `OrderEntrySheet` and submits `callId: null` with selected mode, optional table and optional name.
- `CashWorkspace` receives an optional menu (loaded only on the open view) and base path and owns open/close/success refresh for the dialog.

- [x] **Step 1: Load the catalog in the Caixa route**

Resolve the public base path from request host using the same pattern as the Chamados route, load the active restaurant's menu, and pass the menu and menu link into `CashWorkspace` without changing payment-method loading.

- [x] **Step 2: Build the counter context step**

Add a primary **Novo pedido** action. Before catalog editing, offer **Comer no local** and **Para viagem**. For dine-in show optional positive PostgreSQL `integer` table number and optional name; for takeaway show optional name and no table control. Once context is valid, render `OrderEntrySheet`; implement `onSubmit(requestId, items)` with `callId: null`, the selected mode/table/name, and the shared action. Preserve cart on uncertain request and display the returned generated number on success.

- [x] **Step 3: Connect confirmation to the existing Caixa list**

On success close the editor, refresh the route data and show a concise confirmation with amount and `Mesa N` or `Balcão #N`. Keep payment as a separate action on the open comanda, matching the current workflow.

- [x] **Step 4: Review direct-order context statically**

Verify no direct path calls claim/resolve APIs, no user-entered display number reaches the RPC, takeaway cannot carry a table, dine-in without table receives a number, and table assignment never requires a tag lookup.

### Task 6: Present tables and counter accounts consistently

**Files:**
- Modify: `features/panel/orders/components/cash-workspace.tsx`
- Modify: `features/panel/orders/components/comanda-payment-dialog.tsx`

- [x] **Step 1: Update comanda labels, search and ordering**

Render `Mesa N` for table accounts and `Balcão #N` for accounts without a table. Show fulfillment mode and optional customer name where available. Extend search to match table number, generated number and name. Keep totals, partial-payment state, closed history and existing staggered/reduced-motion treatment.

- [x] **Step 2: Update payment dialog context**

Replace its unconditional `Mesa N` description with the same comanda label and fulfillment context. Keep payment split inputs, payment submission, close-only flow and balance copy unchanged.

- [x] **Step 3: Review payment and historical display statically**

Trace a table comanda with multiple orders and a no-table comanda with one order through open card, expanded details, payment dialog and closed history. Confirm totals and payment IDs continue to use the existing DTO fields.

### Task 7: Final static review against the approved spec

**Files:**
- Review all files above; no additional changes unless the review finds a specific mismatch.

- [x] **Step 1: Check coverage and contracts**

Compare every rule in the spec to the migration, input schema, result DTO, call adapter, direct dialog, Caixa list and payment context. Inspect SQL grants/RLS, atomicity, numbering and call-trigger behavior by reading source only.

- [x] **Step 2: Check accessible and responsive states**

Read the rendered component tree and styles for desktop/mobile layout, focus/labels, 44-pixel touch targets, loading/error/success states, safe-area padding, sequential motion and `prefers-reduced-motion` handling. Do not execute tests or prohibited project commands.

- [x] **Step 3: Report limits accurately**

Report that verification was static because the repository instructions prohibit tests, `typecheck`, `build`, `lint` and `git`. Do not claim runtime or database validation that was not performed.
