# Refinamento de Caixa, Financeiro e Gorjeta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Simplificar Caixa e Financeiro, carregar detalhes sob demanda e implementar gorjeta opcional configurável por restaurante.

**Architecture:** Caixa passa a carregar uma lista agregada de comandas e abre detalhes/catalog only on interaction. Financeiro starts with a small date-range summary and offers separate lazy-loaded analysis and physical-cash views. PostgreSQL remains authoritative for money, tip decisions, command lifecycle, idempotency, and restaurant isolation.

**Tech Stack:** Next.js 16.4.6 App Router, React Server/Client Components, Server Actions, Supabase/Postgres RPCs with RLS, Zod, local shadcn components, Motion and Recharts.

**Spec:** `docs/superpowers/specs/2026-11-17-caixa-financeiro-refino-design.md`

## Global Constraints

- `AGENTS.md`: do not execute `git`, tests, lint, build, or typecheck; do not add tests.
- Work in the current workspace because Git worktrees/commands are forbidden and the user requested implementation in this session.
- Read relevant local Next.js 16.4.6 docs before changing App Router code.
- Use integer cents and server/database recalculation for monetary values; preserve RLS, membership checks, idempotency, snapshots, and atomic writes.
- A gratuity rule is a suggestion. Only an explicit customer acceptance adds it; decline remains valid. Disabled mode asks no question.
- Close consumption and close the comanda are separate transitions. `open` allows orders; `pending` is closed to orders and awaits settlement; `closed` is fully settled.
- Do not commit changes or use prohibited verification commands. Final review is static source review only.

## Review Focus

- Disabled rule and pending comandas: no implicit gratuity or stale value after configuration changes; inspect settings read/write and both settlement paths.
- Accepted/declined rules with partial payments and zero balance: balance, close state, and payment totals remain consistent; inspect RPC branches and UI conditions.
- Repeated or concurrent close/payment requests: one decision/payment only; inspect request IDs, unique keys, and row/advisory locks.
- Old closed comandas and captured gratuity snapshots: historical totals remain stable after settings change; inspect migrations and report queries.
- First render and clicked detail states: Caixa excludes catalog/event/detail payloads, and Financeiro excludes analysis/cash-operation payloads until selection; inspect page calls and action boundaries.

---

### Task 1: Database contracts for tip decisions and compact reports

**Files:**
- Create: `supabase/migrations/20261117110000_panel_finance_cash_tip_refinement.sql`

**Interfaces:**
- `update_panel_financial_settings_v2(p_restaurant_id uuid, p_enabled_methods jsonb, p_custom_methods jsonb, p_tip_mode text, p_tip_percentage_bps integer, p_tip_fixed_cents bigint) -> jsonb` saves payment methods and the restaurant tip rule atomically.
- `close_panel_comanda_consumption(p_restaurant_id uuid, p_comanda_id uuid, p_request_id uuid, p_tip_decision text) -> jsonb` moves an open comanda into settlement, applying an explicit decision when the configured mode is enabled.
- `resolve_panel_comanda_tip(p_restaurant_id uuid, p_comanda_id uuid, p_request_id uuid, p_tip_decision text) -> jsonb` resolves a pending comanda with no payment, including zero-balance decline/close.
- `record_panel_comanda_payment_v3(p_restaurant_id uuid, p_comanda_id uuid, p_request_id uuid, p_splits jsonb, p_close_if_paid boolean, p_tip_decision text) -> jsonb` validates and records payment with a first-receipt tip decision atomically when needed.
- `get_panel_comandas_page_summary(p_restaurant_id uuid, p_status text, p_page integer) -> jsonb` returns summary-only rows and exact page metadata.
- `get_panel_finance_overview(p_restaurant_id uuid, p_from date, p_to date) -> jsonb` returns headline totals and daily trend only.

- [x] Add restaurant tip mode/value columns with checks for `disabled`, `percentage`, and `fixed`; represent percentage in basis points and fixed money in cents.
- [x] Add append-only per-comanda tip decision snapshots and payment-level tip allocation fields; preserve old closed comandas as having no historical tip.
- [x] Add consumption closure actor/time/request fields to comandas and enforce the open → pending → closed lifecycle.
- [x] Preserve force-close behavior while writing consumption-closure audit fields for every comanda transported to `pending`.
- [x] Implement the six RPC contracts above with membership checks, row locks, idempotency, overflow checks, snapshots, and explicit failure codes.
- [x] Ensure order insertion and consumption closure serialize on the comanda so a newly pending comanda cannot receive another order.
- [x] Keep sales excluding gratuity, received including accepted gratuity, and pending balances including unpaid gratuity; expose gratuity receipts as a subset, never as a second sum.
- [x] Revoke public/anonymous access and grant authenticated execution only; notify PostgREST to reload the schema.

### Task 2: Gratuity settings in Financeiro

**Files:**
- Modify: `features/panel/payments/model.ts`
- Modify: `features/panel/settings/model.ts`, `schema.ts`, `actions.ts`, `server/read.ts`, `server/write.ts`
- Modify: `features/panel/settings/components/payment-settings-page.tsx`
- Modify: `app/painel/(workspace)/financeiro/configuracoes/page.tsx`

**Interfaces:**
- `PanelTipPolicy = { mode: "disabled" } | { mode: "percentage"; percentageBps: number } | { mode: "fixed"; fixedCents: number }`.
- `PanelPaymentConfiguration` includes `tipPolicy: PanelTipPolicy`.
- Settings action accepts the existing payment method fields plus `tipPolicy` and calls `update_panel_financial_settings_v2`.

- [x] Extend settings DTOs and Zod input/output schemas with the discriminated tip policy; reject values incompatible with the selected mode.
- [x] Load restaurant tip columns together with enabled payment methods and custom methods.
- [x] Save methods and tip policy in the same authenticated Server Action/RPC.
- [x] Add a compact, accessible settings section with disabled/percentage/fixed choices and one conditional value input.
- [x] Include tip policy in dirty-state, saved-state, error handling, and success feedback.

### Task 3: Explicit consumption closure and optional gratuity settlement

**Files:**
- Modify: `features/panel/orders/model.ts`, `schema.ts`, `actions.ts`, `server/read.ts`, `server/payment-write.ts`
- Modify: `features/panel/orders/components/cash-workspace.tsx`
- Modify: `features/panel/orders/components/comanda-payment-dialog.tsx`
- Create: `features/panel/orders/components/comanda-consumption-dialog.tsx`

**Interfaces:**
- `PanelComandaSummaryDTO` carries id, table, status, opened/closed times, latest-order labels, counts, subtotal/total/paid/balance cents.
- `PanelComandaDTO` is the selected detail DTO and adds orders, payments, tip decision, tip cents, and payment totals. The current restaurant tip policy is loaded separately from payment configuration.
- `closePanelComandaConsumptionAction({ expectedRestaurantId, comandaId, requestId, tipDecision })` closes order intake and records the tip choice.
- `resolvePanelComandaTipAction({ expectedRestaurantId, comandaId, requestId, tipDecision })` resolves a pending tip without a payment.
- Payment action carries optional `tipDecision` and calls `record_panel_comanda_payment_v3`.

- [x] Add the close-consumption and resolve-tip schemas/actions/server calls, mapping tip-required and stale-comanda failures to clear UI messages.
- [x] Show `Aberta`, `Em liquidação`, and `Encerrada` distinctly; open commandas can add orders, pending commandas cannot.
- [x] Add the explicit “Encerrar consumo” action and acceptance/decline prompt; display the suggested amount and its optional nature without preselecting acceptance.
- [x] For pending commandas without a decision, collect the choice before payment; include the choice in the payment request so the database commits it atomically with the first receipt.
- [x] Attribute payment cents to subtotal first and gratuity after subtotal is paid; display gratuity in the total/balance without adding it as another payment method.
- [x] Remove “close comanda after paying” from open consumption; payment only closes a pending comanda when its remaining balance reaches zero.
- [x] Handle a declined or zero-cent accepted tip with zero remaining subtotal by closing without generating a zero-value payment.

### Task 4: Lean Caixa list and true on-demand details

**Files:**
- Modify: `features/panel/orders/server/read.ts`, `actions.ts`, `model.ts`
- Modify: `features/panel/orders/components/cash-workspace.tsx`
- Modify: `features/panel/cash/model.ts`, `server/read.ts`
- Modify: `app/painel/(workspace)/caixa/page.tsx`
- Modify or create: a Server Action for loading the counter-order menu on demand.

- [x] Replace nested initial commanda reads with `get_panel_comandas_page_summary`; calculate totals/counts in Postgres and keep closed-history page totals honest for the current page label.
- [x] Add an authenticated selected-comanda read action that fetches orders, item additions, payments, and tip state for one comanda only.
- [x] Fetch selected details when a card expands or payment/finalization opens; retain a per-page detail cache and visible loading/error states.
- [x] Split session summary from session movement reads; Caixa receives only the session status/expected amount needed for the top strip.
- [x] Remove `getPanelMenu` from the initial Caixa page load and fetch it only when “Novo pedido” opens.
- [x] Reorder Caixa to a compact session strip, at most three operational numbers, commanda filters/search, then the comanda list; link session management to `/financeiro?view=cash`.
- [x] Keep commanda payment on Caixa and offer the direct Financeiro link when no cash session is open.

### Task 5: Progressive Financeiro and physical-cash view

**Files:**
- Modify: `features/panel/finance/model.ts`, `server/read.ts`
- Create: `features/panel/finance/actions.ts`
- Create: `features/panel/finance/components/finance-overview-dashboard.tsx`
- Keep: `features/panel/finance/components/finance-dashboard.tsx` as an unused legacy component until a later cleanup.
- Modify: `app/painel/(workspace)/financeiro/page.tsx`
- Modify: `features/panel/cash/components/cash-session-panel.tsx`
- Reuse existing loading/error UI unless route branching needs a matching state.

- [x] Load only `get_panel_finance_overview` for the default view and retain the date filter, three main indicators, small pending indicator, and sales/receipts trend.
- [x] Add a “Análises detalhadas” disclosure that fetches the existing detailed dashboard RPC only on first open and resets its cached payload when the date range changes.
- [x] Put method/category breakdowns and period cash reconciliation inside the details area; show received gratuity as a subindicator without double counting.
- [x] Add direct `?view=cash` Financeiro mode with a link back to analysis; load payment settings, session controls, and event history only in this mode.
- [x] Reuse `CashSessionPanel` for physical cash operations in Financeiro and ensure refresh works without a Caixa-only context provider.
- [x] Preserve keyboard operation, labeled controls, visible pending/errors, responsive layout, reduced-motion support, and consistent heading levels.

### Task 6: Product records and final static review

**Files:**
- Modify: `__BASE.MD`
- Modify: `docs/superpowers/specs/2026-11-17-financeiro-caixa-design.md`
- Modify: `docs/superpowers/specs/2026-11-17-caixa-financeiro-refino-design.md`
- Modify: this plan as implementation details settle.

- [x] Update the product base to move physical-cash controls into Financeiro and include configured, optional gratuity plus the explicit consumption-close stage.
- [x] Mark the older Financeiro/Caixa spec as superseded for these responsibilities and preserve its historical implementation notes.
- [x] Read every changed UI/action/DTO/RPC path and trace disabled, accepted, declined, partial payment, zero balance, force-close, and stale-retry branches by static inspection.
- [x] Confirm through source inspection that initial routes no longer call deferred detail/catalog/movement reads and that all new RPCs are scoped/granted correctly.
- [x] Record that no tests, lint, build, typecheck, or Git commands were run, per project instruction.
