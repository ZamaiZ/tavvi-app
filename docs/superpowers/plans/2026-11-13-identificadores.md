# Identificadores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive identifier registry to the restaurant panel, with stable public links and a one-presentation NFC write-and-lock flow.

**Architecture:** Add a restaurant-scoped `menu_tags` domain and narrow database RPCs for mutations, NFC operation recovery, and public token resolution. Keep panel reads in Server Components and mutations behind Zod-validated Server Actions. Build the responsive workspace using the existing panel shell, design system, and Motion patterns; use the browser Web NFC API only for NFC-capable Android Chrome sessions.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, Zod, Supabase/Postgres, Tailwind CSS, `motion/react`, Web NFC.

**Spec:** `docs/superpowers/specs/2026-11-13-identificadores-design.md`

## Global Constraints

- Scope is identifiers only; no table context, calls, orders, accounts, payments, native Android app, QR generation, or printing.
- Use the existing `/t/{token}` public path; active tokens redirect to `/{slug}` without table metadata.
- Keep a single active identifier per table per restaurant, stable unguessable token, and globally unique NFC serial.
- Treat the NFC lock as irreversible. Separate the server claim (`authorizing`) from the physical-start transition (`writing`); cancellation can only release the claim before `writing`. After a physical call starts, preserve the serial reservation on every uncertain outcome; recovery never calls `write()`.
- Derive restaurant authorization from the active panel session on the server; database policies/RPCs enforce restaurant membership and invariants.
- Use the existing design system and `motion/react`; honor reduced motion and keep the mobile experience responsive inside the web app.
- Do not add or run tests, Git, typecheck, build, or lint commands. Validation is limited to static inspection because project instructions forbid those commands.
- Read the installed Next.js 16 guide relevant to each route or client API before editing Next.js code.

## Review Focus (static inspection only)

- Concurrent attempts or existing registrations with the same NFC serial: ensure the serial reservation and unique index prevent a second identifier from claiming it (Task 1, Task 2).
- Wrong tag presented after the initial read: ensure serial mismatch stops the lock and the client never calls `makeReadOnly()` for that operation (Task 5).
- Browser close or lost server response after `write()`/`makeReadOnly()`: ensure the state remains pending/uncertain, the serial remains reserved, and recovery does not write again (Task 1, Task 5).
- Recovery of `ready` operations: ensure the tag is read and visibly confirmed before claiming the lock, while cancellation and lock attempts serialize through the operation row (Task 1, Task 5).
- Supabase row limits: paginate the identifier list and query only active NFC operations in bounded batches (Task 2).
- Inactive, malformed, or unknown public token, including public-root routing from dedicated/shared panel hosts: ensure the resolver returns no destination and reveals no identifier data (Task 1, Task 2, Task 3).
- Duplicate active table and inactive historical identifier for the same table: ensure database uniqueness allows only the intended active row and panel errors remain understandable (Task 1, Task 2, Task 4).

---

### Task 1: Identifier and NFC persistence

**Files:**
- Create: `supabase/migrations/20261113090000_panel_identifiers.sql`

**Interfaces:**
- Create `public.menu_tags` with `id`, `restaurant_id`, stable unique `public_token`, positive `table_number`, `is_active`, `nfc_serial`, `nfc_protected_at`, `nfc_protected_by`, and timestamps.
- Create `public.menu_tag_nfc_operations` with `operation_id`, `tag_id`, `restaurant_id`, `actor_id`, `serial`, status (`ready`, `authorizing`, `writing`, `uncertain`, `failed`, `protected`), `write_attempt_id`, `write_attempt_origin`, optional failure reason, and timestamps. Keep operation history needed for recovery; do not add a UI history requirement.
- Create exact RPC interfaces:
  - `create_menu_tag(p_restaurant_id uuid, p_table_number integer) returns jsonb` — generates and returns the public token inside the database RPC.
  - `update_menu_tag_table_number(p_restaurant_id uuid, p_tag_id uuid, p_table_number integer) returns jsonb`
  - `set_menu_tag_active(p_restaurant_id uuid, p_tag_id uuid, p_is_active boolean) returns jsonb`
  - `begin_menu_tag_nfc_operation(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_serial text) returns jsonb`
  - `mark_menu_tag_nfc_write_started(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_attempt_id uuid) returns jsonb`
  - `mark_menu_tag_nfc_physical_started(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_attempt_id uuid) returns jsonb`
  - `cancel_menu_tag_nfc_operation(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid) returns jsonb`
  - `cancel_menu_tag_nfc_write_claim(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_attempt_id uuid) returns jsonb`
  - `mark_menu_tag_nfc_uncertain(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_attempt_id uuid, p_reason text) returns jsonb`
  - `complete_menu_tag_nfc_protection(p_restaurant_id uuid, p_tag_id uuid, p_operation_id uuid, p_serial text, p_attempt_id uuid) returns jsonb`
  - `resolve_menu_tag_token(p_token text) returns table (restaurant_slug text)`
- Cancellation RPCs return `serial_reservation` as `released` or `retained`; the UI follows this database result instead of inferring it from a local receipt.
- Mutating RPCs check active restaurant membership, validate operation ownership, and return stable machine-readable failures.
- Public resolution returns only an active restaurant slug. It does not return mesa, serial, operation, or audit fields.

- [x] **Step 1: Add the restaurant-scoped identifier schema and invariants** — unique token, partial unique active table per restaurant, unique serial, positive table number, immutable restaurant/token, and constraints tying protected state to a serial.
- [x] **Step 2: Add operation records and guarded RPCs** — start reserves a serial; an idempotent attempt first enters `authorizing`, then transitions to `writing` immediately before any physical NFC call; cancellation only releases `authorizing`, with a row lock serializing it against physical start; stale `writing` can be reclaimed after 90 seconds as an uncertain lock-only recovery; uncertain outcomes preserve the serial; completion and uncertainty RPCs validate the in-memory attempt ID; completion atomically marks protected and records the operation.
- [x] **Step 3: Add membership policies and the public resolver** — authenticated panel reads/mutations stay restaurant-scoped; anonymous resolution returns only the slug for active tokens.
- [x] **Step 4: Statically inspect migration grants, security-definer search paths, RLS, unique-index behavior, and failure codes** against the approved spec and existing migration conventions.

**Static review result:** all RPC paths must remain tenant-scoped; no public grant may expose private identifier or NFC fields.

---

### Task 2: Identifier domain and server operations

**Files:**
- Create: `features/panel/identifiers/model.ts`
- Create: `features/panel/identifiers/schema.ts`
- Create: `features/panel/identifiers/actions.ts`
- Create: `features/panel/identifiers/server/read.ts`
- Create: `features/panel/identifiers/server/write.ts`
- Modify: `lib/routing/panel.ts`

**Interfaces:**
- `IdentifierDTO = { id: string; publicToken: string; publicUrl: string; tableNumber: number; isActive: boolean; nfcSerial: string | null; nfcProtectedAt: string | null; nfcStatus: "pending" | "protected" | "uncertain"; nfcOperationId: string | null; nfcOperationStatus: "ready" | "authorizing" | "writing" | "uncertain" | "failed" | "protected" | null }`.
- `PanelIdentifiersDTO = { restaurantId: string; restaurantName: string; slug: string; identifiers: IdentifierDTO[]; counts: { all: number; pending: number; protected: number; inactive: number } }`.
- `IdentifierActionResult<T> = { ok: true; data: T } | { ok: false; code: IdentifierActionFailureCode }`.
- Export `getPanelIdentifiers(restaurant: PanelRestaurantDTO): Promise<PanelIdentifiersDTO>` from `server/read.ts`.
- Export Zod-validated actions `createIdentifierAction(rawInput: unknown)`, `updateIdentifierAction(rawInput: unknown)`, `beginIdentifierNfcAction(rawInput: unknown)`, `cancelIdentifierNfcAction(rawInput: unknown)`, `markIdentifierNfcUncertainAction(rawInput: unknown)`, and `completeIdentifierNfcAction(rawInput: unknown)`.
- Also export `markIdentifierNfcWriteStartedAction(rawInput: unknown)` to transition the reserved operation before completion.
- Also export `markIdentifierNfcPhysicalStartedAction(rawInput: unknown)` to serialize the physical NFC call against claim cancellation.
- Pass the in-memory attempt ID to completion/uncertainty RPCs; do not expose it through the authenticated operation-table select grant or save it to localStorage.
- Export `createPublicMenuTagUrl(token: string): string` from `lib/routing/panel.ts`, using the existing validated public root derived from `TAVVI_PANEL_BASE_URL`; token creation uses secure server-side randomness and collision retry.

- [x] **Step 1: Define identifier DTOs, failure codes, and strict Zod input schemas** — include expected restaurant ID, UUID operation IDs, positive integer table numbers, and normalized 14-hex serials matching the legacy NTAG213 flow.
- [x] **Step 2: Implement scoped list loading** — query only the restaurant passed from `getActivePanelRestaurant`, map NFC uncertainty before protected/pending, and sort by table number.
- [x] **Step 3: Implement create/update/activation server operations** — validate active restaurant context, get the stable 32-character hex token from the database RPC, separate table-number and activation updates, use `createPublicMenuTagUrl` for links, and revalidate the identifier route.
- [x] **Step 4: Implement NFC server actions** — verify expected restaurant context and delegate ready, authorizing, writing, cancelled, uncertain, and protected transitions to the matching RPC; map duplicate serial/table, expired session, and context errors to stable action codes.
- [x] **Step 5: Statically inspect each exported action and read path** for user-controlled restaurant IDs, RPC response shape assumptions, and serial reservation cleanup.

**Consumes:** Task 1 RPCs.  
**Produces:** the DTO/actions used by Tasks 3–5.

---

### Task 3: Public token route

**Files:**
- Create: `features/public-profile/server/public-tag.ts`
- Create: `app/t/[token]/page.tsx`

**Interfaces:**
- Export `resolvePublicTagDestination(token: unknown): Promise<{ restaurantSlug: string } | null>` from `public-tag.ts`; validate token format, call `resolve_menu_tag_token`, and return no private fields.
- `/t/[token]` redirects active tokens to `/${restaurantSlug}` and calls `notFound()` for invalid, inactive, or unresolved tokens.

- [x] **Step 1: Implement the server-only resolver with input validation and a public Supabase client** — log only non-sensitive error codes.
- [x] **Step 2: Add the App Router page that resolves and redirects** without reading or forwarding table context.
- [x] **Step 3: Read the installed Next.js 16 route and redirect guide, then statically inspect routing precedence and the inactive-token path.**

**Consumes:** Task 1 `resolve_menu_tag_token`.  
**Produces:** working public destination for links from Task 2 and NFC writes in Task 5.

---

### Task 4: Identifier workspace and visual states

**Files:**
- Create: `app/painel/(workspace)/identificadores/page.tsx`
- Create: `app/painel/(workspace)/identificadores/loading.tsx`
- Create: `app/painel/(workspace)/identificadores/error.tsx`
- Create: `features/panel/identifiers/components/identifiers-workspace.tsx`
- Create: `features/panel/identifiers/components/identifiers-workspace-skeleton.tsx`
- Create: `features/panel/identifiers/components/identifier-editor-dialog.tsx`
- Create: `features/panel/identifiers/components/identifier-details-dialog.tsx`
- Create: `features/panel/identifiers/components/identifier-list-item.tsx`

**Interfaces:**
- `IdentifiersWorkspace({ initialData }: { initialData: PanelIdentifiersDTO })` owns search, status filter, dialogs, pending operations, and refresh behavior.
- `IdentifierEditorDialog({ open, identifier, onOpenChange, onSaved })` handles create and table-number changes via Task 2 actions.
- `IdentifierDetailsDialog({ identifier, open, onOpenChange, onSaved })` displays link, state, copy, activation, and NFC registration.
- `IdentifierListItem({ identifier, onOpen, onCopy, onToggleActive })` renders a responsive row/card with explicit NFC and activation states.
- Page remains a Server Component, obtains the active restaurant, loads identifiers, and passes the DTO to the client workspace.

- [x] **Step 1: Add the Server Component route and responsive loading skeleton** using the existing active-restaurant guard and `PanelIdentifiersDTO`.
- [x] **Step 2: Build the title, create action, search field, and four filter choices** with counts; search matches mesa number and filters distinguish all, active pending/uncertain, active protected, and inactive records.
- [x] **Step 3: Build desktop rows, mobile cards, and the details dialog** for copying the stable link, editing table number, opening NFC registration, and activating/deactivating.
- [x] **Step 4: Add empty, filtered-empty, load, action-pending, error, and disabled states** using existing UI components and concise Portuguese copy.
- [x] **Step 5: Apply short sequential entry/transitions with `MotionConfig` and reduced-motion support**; statically inspect keyboard access, labels, and minimum mobile targets.

**Consumes:** Task 2 domain and actions.  
**Produces:** usable identifier list and management surface; NFC registration is supplied by Task 5.

---

### Task 5: One-presentation NFC registration and recovery

**Files:**
- Create: `features/panel/identifiers/components/identifier-nfc-registration.tsx`
- Create: `features/panel/identifiers/lib/nfc.ts`
- Modify: `features/panel/identifiers/components/identifier-details-dialog.tsx`

**Interfaces:**
- `readIdentifierTag(signal: AbortSignal): Promise<{ serial: string; url: string | null }>` validates the legacy NTAG213 serial format, reads one URL record, and keeps observing serial changes in the same reader session.
- `writeAndProtectIdentifierTag(url: string, expectedSerial: string, signal: AbortSignal, onPhysicalStart: () => Promise<void>): Promise<void>` verifies the still-observed serial, asks the server to enter `writing` immediately before the first physical call, skips `write()` when the URL already matches, then calls Web NFC `write()` and `makeReadOnly()` sequentially; timeouts abort pending NFC operations.
- `protectSelectedIdentifierTag(expected: { serial: string; url: string }, signal: AbortSignal, onLockStarted: () => Promise<void>): Promise<void>` verifies the pending tag before and after the server physical-start transition and calls only `makeReadOnly()`; it never writes.
- `IdentifierNfcRegistration` receives one identifier and Task 2 NFC actions; it reports status changes to the workspace.

- [x] **Step 1: Read the installed Next.js 16 Client Components guide and inspect current Web NFC APIs before adding client code.** Feature-detect secure context, `NDEFReader`, NFC serial, and `makeReadOnly` at runtime.
- [x] **Step 2: Implement the initial read state** — one user-started scan captures serial/current URL, starts a server operation, reserves the serial, and shows a confirmation with the table, target URL, replacement notice, and irreversible-lock copy.
- [x] **Step 3: Implement confirmation as one NFC sequence** — claim the operation under a unique in-memory attempt ID, transition to `writing` immediately before the first physical call, then call `write()` only if the live reader still reports the reserved serial and await `makeReadOnly()` without requiring a post-write user rescan.
- [x] **Step 4: Implement operation outcomes** — success calls the completion action; claim cancellation can release only before the physical-start transition; any result after a physical call begins records or leaves an uncertain operation and preserves the serial reservation.
- [x] **Step 5: Implement recovery UI** — persist a best-effort local receipt without an attempt capability, surface pending/uncertain state from server data, reread serial and URL, and offer lock-only recovery on this or another authorized device.
- [x] **Step 6: Statically inspect every transition** for wrong serial, no serial, permission denied, NFC disabled, unsupported lock, wrong URL, write error, lock error, server error, page close, retry, and reduced-motion behavior; ensure recovery never invokes `write()`.

**Consumes:** Task 2 NFC actions and Task 4 detail surface.  
**Produces:** the agreed one-read/one-confirm NFC experience with safe recovery.

---

### Task 6: Panel navigation integration

**Files:**
- Modify: `features/panel/shell/components/panel-app-shell.tsx`
- Modify: `features/panel/shell/components/panel-mobile-dock.tsx`

**Interfaces:**
- Extend active sections with `identifiers`, add the base-path-aware identifiers href, and add the destination under the existing Operação group in desktop sidebar and mobile navigation sheet.
- Keep the mobile dock's three primary controls unchanged; Identificadores appears in its existing Navegar sheet.

- [x] **Step 1: Add the identifiers sidebar entry and route-active state** using the existing sidebar link and tooltip pattern.
- [x] **Step 2: Add Identificadores to the mobile Navegar sheet** with an icon, active indication, accessible label, and close-on-navigation behavior.
- [x] **Step 3: Statically inspect the dedicated-host and shared-host route paths and the mobile/desktop breakpoint behavior.**

**Consumes:** Task 4 route.  
**Produces:** sidebar and mobile navigation access to the new workspace.

---

## Final static review

- [x] Trace create, edit, activate/deactivate, NFC start, cancellation, uncertain recovery, completion, and public resolution from UI through action, server layer, RPC, and DTO.
- [x] Check migration/RPC security against existing Supabase patterns and ensure the public function exposes only the slug for active tokens.
- [x] Review the resulting changes by reading the touched files. Validation remained static; no prohibited commands or tests were run.
