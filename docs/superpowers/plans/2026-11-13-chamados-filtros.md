# Filtros e histórico de chamados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The project explicitly prohibits adding or running tests; use static review checkpoints instead. No Git commands may be run.

**Goal:** Keep all call filters visible on narrow screens and add a paginated, read-only history of resolved calls.

**Architecture:** Keep active-call reads in the existing protected Server Component. Add a server action for the resolved history that verifies the active restaurant and queries one stable cursor page under existing membership RLS. Extend the current client workspace with a responsive three-tab filter and on-demand history states.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, Supabase JS 2.118, Zod 4, Base UI Tabs, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-13-chamados-filtros-design.md`

## Global Constraints

- Do not run Git commands, `typecheck`, `build`, `lint`, or `test` commands.
- Do not add or run tests.
- Do not alter the service calls database schema or active claim/resolve behavior.
- The active call list stays limited to `pending` and `in_progress`.
- Resolved history loads on demand in pages of 25 ordered by `resolved_at DESC, id DESC`.
- Staff history reads must revalidate the active restaurant and rely on authenticated member RLS.

## Review Focus

1. A stale/cross-restaurant expected ID must return a context failure before querying history.
2. Equal/high-precision `resolved_at` values must page by `id` without overlap or gaps; the cursor must preserve the database timestamp precision.
3. The query must return only `resolved` rows and cap each response at 25 items.
4. A failed history request must preserve loaded rows, expose retry feedback, and retry the same cursor that failed.
5. Finalized cards must never render the active claim/resolve mutation button.
6. Realtime reconnection while the resolved tab is open must refresh the first history page.

---

### Task 1: Authorized cursor-paginated history query

**Files:**
- Modify: `features/panel/calls/model.ts`
- Modify: `features/panel/calls/schema.ts`
- Modify: `features/panel/calls/actions.ts`
- Modify: `features/panel/calls/server/read.ts`
- Modify: `features/panel/calls/server/write.ts`

**Interfaces:**
- `PanelServiceCallDTO.status` becomes `"pending" | "in_progress" | "resolved"`; add `resolvedAt: string | null` and `resolvedBy: string | null`.
- `PanelServiceCallCursor = { resolvedAt: string; id: string }`.
- `PanelResolvedCallsPage = { calls: PanelServiceCallDTO[]; nextCursor: PanelServiceCallCursor | null }`.
- `getResolvedServiceCallsAction(rawInput: unknown): Promise<ServiceCallActionResult<PanelResolvedCallsPage>>` accepts strict `{ expectedRestaurantId, cursor }` input, with `cursor` nullable.
- `getPanelResolvedServiceCallsForAction(input)` revalidates the active restaurant, then queries resolved rows only using a 25-row page and one-row lookahead.

- [x] Extend the DTO and add strict Zod validation for a UUID cursor ID and offset-aware ISO `resolvedAt`.
- [x] Add the server read ordered by `resolved_at DESC, id DESC`; apply a tuple cursor predicate and fetch 26 rows, returning at most 25 with the last visible row as the next cursor when the lookahead exists.
- [x] Add the server action and active-restaurant authorization wrapper; reuse existing context failure mapping and the current authenticated Supabase client.
- [x] Static review: trace malformed cursor, restaurant mismatch, same-timestamp pagination, empty last page, and the 25-row response cap.

### Task 2: Responsive filter and finalized-call states

**Files:**
- Modify: `features/panel/calls/components/calls-workspace.tsx`

**Consumes:** `getResolvedServiceCallsAction`, `PanelResolvedCallsPage`, and `PanelServiceCallDTO` from Task 1.

**Produces:** Three tab states `pending`, `in_progress`, and `resolved`; resolved history fetched on first selection and on “Carregar mais”.

- [x] Replace the hidden horizontal-scroll wrapper with a full-width three-column filter that keeps all labels visible on small screens; hide only redundant icon/count details at the narrow breakpoint.
- [x] Add resolved-history state for loaded rows, cursor, loading, and recoverable error; fetch page one only when the resolved tab is selected, refresh after reconnect while open, and append later pages without replacing loaded rows.
- [x] Render finalized calls as read-only cards with mesa and conclusion time; keep existing actions available only for active calls.
- [x] Add loading, empty, retry, and “Carregar mais” states; preserve current active queue empty states and realtime refresh behavior.
- [x] Static review: inspect all three tab values, keyboard/focus behavior through Base UI Tabs, loading/error transitions, and finalized cards for any mutation path.

### Task 3: Align the short design with the implementation

**Files:**
- Modify: `docs/superpowers/specs/2026-11-13-chamados-filtros-design.md`

- [x] Mark the approved short design as implemented and record that the project-mandated validation was static review only.

### Final review

- [x] Read back the design and all touched code; confirm every objective and review focus has a corresponding implementation.
- [x] Do not run Git, tests, lint, typecheck, or build commands.
