# Admin Restaurants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, responsive restaurant administration page consistent with the existing Convites experience.

**Architecture:** Keep data access and authorization on the server, using validated Supabase RPCs for filtered reads and privileged mutations. Build a localized Admin route that reuses the existing shell, shadcn components, and `motion/react` patterns; keep restaurant creation/activation in the future Panel flow.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, Supabase/Postgres, Zod 4, shadcn Base Mira, Tailwind CSS 4, `motion/react` 14.7.1.

**Spec:** `docs/superpowers/specs/2026-11-05-admin-restaurants-design.md`

## Global Constraints

- Do not run `git`, `typecheck`, `build`, `lint`, or test commands.
- Do not add tests; validate with static inspection only.
- Before changing Next.js code, read the relevant guide under `node_modules/next/dist/docs/` and follow this repository's Next.js 16 conventions.
- Keep Admin and Panel sessions separate; use the authenticated Admin Supabase client and never expose service-role values.
- Every database mutation verifies `is_platform_admin()` in the database and writes its audit record atomically.
- This page may suspend/restore and edit a slug; it must not create, activate, or remove a restaurant.
- Restoring a suspension returns the prior `draft` or `active` state; a legacy suspended row without a prior state restores to `draft`.
- Preserve shadcn Base Mira usage and `motion/react` motion-reduction behavior from Convites.

## Review Focus

- An Admin-host route and a path-prefixed Preview route resolve to the correct restaurant URL and login redirect; manually inspect helper usage and resulting href composition.
- A suspended draft must restore as `draft`, while a suspended active restaurant must restore as `active`; manually inspect both SQL transitions and the matching UI labels.
- Invalid or duplicate slugs must not update data; manually inspect Zod validation, database constraints, RPC error mapping, and field feedback.
- Unauthorized reads and writes must fail safely; manually inspect each DAL and RPC authorization check and ensure UI errors reveal no database internals.
- Failed reads, failed writes, and empty search/filter results must remain distinct; manually inspect loading/error/empty branches and their recovery controls.

---

### Task 1: Add secure restaurant administration RPCs

**Files:**
- Create: `supabase/migrations/20261105010000_admin_restaurants.sql`

**Interfaces:**
- Produces `public.list_platform_restaurants(p_search text, p_status text, p_page integer, p_page_size integer) returns jsonb` with `{ rows, counts, totalRows, page, pageSize }`.
- Produces `public.set_platform_restaurant_status(p_restaurant_id uuid, p_action text) returns jsonb`, where action is `suspend` or `restore` and response includes the resulting status.
- Produces `public.update_platform_restaurant_slug(p_restaurant_id uuid, p_slug text) returns jsonb` with a success result and updated slug.

- [x] **Step 1: Read the repository's Next.js guide before any application-code edits**

Read the relevant page, `searchParams`, loading, and Server Action guides under `node_modules/next/dist/docs/`. Record any constraints that affect later tasks in this plan's implementation notes.

- [x] **Step 2: Add and constrain the suspension return-state column**

Add nullable `restaurants.status_before_suspension` restricted to `draft`/`active`. Backfill any existing `suspended` rows with `draft` so restoration cannot publish a restaurant accidentally. Add a check constraint requiring this column to be null unless `status = 'suspended'` and non-null for suspended rows.

- [x] **Step 3: Implement the list RPC**

Require authenticated platform Admin, validate search length, status (`all`, `draft`, `active`, `suspended`), page (1–1,000,000), and page size (1–100). Escape `\`, `%`, and `_` in search. Return rows ordered by `created_at DESC, id DESC`, counts across all rows by status, and filtered `totalRows`/page metadata. Search only `name` and `slug`.

- [x] **Step 4: Implement status transitions and audit**

Use `SECURITY DEFINER`, empty `search_path`, qualified names, strict inputs, and an `is_platform_admin()` check. `suspend` stores the current `draft`/`active` status and changes to `suspended`; repeated suspension is a no-op. `restore` uses the stored status (fallback `draft`), clears it, and does not grant/remove memberships. Write a corresponding `audit_log` entry in the same transaction only when a transition occurs.

- [x] **Step 5: Implement protected slug update and audit**

Validate 1–80 characters and the format `^[a-z0-9]+(-[a-z0-9]+)*$`, update only the requested row, return a conflict result for duplicate slug, and record `restaurant.slug_changed` in the same transaction. Add explicit execute grants for authenticated users and revoke the default `PUBLIC`/`anon` access from the RPCs.

- [x] **Step 6: Inspect the migration statically**

Review function qualification, grants/revokes, constraints, status restoration, audit fields, and escaped search patterns against the existing migrations. Do not apply the migration or run commands that are prohibited by `AGENTS.md`.

### Task 2: Add restaurant domain, read DAL, and Server Actions

**Files:**
- Create: `features/admin/restaurants/model.ts`
- Create: `features/admin/restaurants/schema.ts`
- Create: `features/admin/restaurants/server/restaurants.ts`
- Create: `features/admin/restaurants/actions.ts`

**Interfaces:**
- `RestaurantStatus = "draft" | "active" | "suspended"`; `RestaurantFilter = "all" | RestaurantStatus`.
- `RestaurantListQuery = { search: string; status: RestaurantFilter; page: number; pageSize: number }`.
- Default `pageSize` is 25, matching Convites; accepted values remain 1–100.
- `RestaurantAdmin` contains `id`, `name`, `slug`, `status`, `statusBeforeSuspension`, `createdAt`, and `updatedAt`.
- `RestaurantListResult = { rows: RestaurantAdmin[]; counts: Record<RestaurantFilter, number>; totalRows: number; page: number; pageSize: number }`.
- Export `listPlatformRestaurants(query)`, `suspendPlatformRestaurantAction(rawRestaurantId: unknown)`, `restorePlatformRestaurantAction(rawRestaurantId: unknown)`, and `updatePlatformRestaurantSlugAction(rawInput: unknown)`.

- [x] **Step 1: Define and validate the restaurant DTOs and query**

Mirror the invite model's strict response schemas. Bound search to 120 characters, page to 1–1,000,000, page size to 1–100, use `z.string().uuid()` for UUIDs, and define a feature-local slug schema with 1–80 characters and the database slug pattern. Do not expose raw database rows.

- [x] **Step 2: Implement server-only RPC adapters**

Use `createSupabaseServerClient("admin")`; validate every RPC response with Zod. Map authorization, invalid input, duplicate slug, and service errors to internal typed errors without returning raw Postgres messages.

- [x] **Step 3: Implement thin Server Actions**

Parse unknown action input with schemas, call the corresponding server-only adapter, and revalidate only the restaurant Admin route on success. Return discriminated `{ ok: true, ... } | { ok: false, code, fieldErrors? }` results.

- [x] **Step 4: Inspect authorization and error paths statically**

Confirm the client bundle imports no server-only module, actions accept no actor ID, values are validated at both layers, and each safe error code maps to a user-facing message.

### Task 3: Add the localized route and shell navigation

**Files:**
- Create: `app/admin/restaurantes/page.tsx`
- Create: `app/admin/restaurantes/loading.tsx`
- Create: `features/admin/restaurants/components/admin-restaurants-page-skeleton.tsx`
- Modify: `features/admin/auth/navigation.ts`
- Modify: `features/admin/shell/components/admin-app-shell.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Add `getAdminRestaurantsPath(publicBasePath: "" | "/admin"): string`, returning `/restaurantes` on the Admin host and `/admin/restaurantes` on path-prefixed environments.
- Add a required shell navigation state `activeItem: "invites" | "restaurants"`.

- [x] **Step 1: Add the restaurant path helper and active shell state**

Replace the disabled Restaurants menu entry with a working `Link`; keep Convites and Restaurants active states mutually exclusive. Leave theme and logout behavior intact.

- [x] **Step 2: Build the protected server route**

Parse `search`, `status`, `page`, and `pageSize` from promised `searchParams` using the new query schema. Fetch the list on the server, pass only DTOs, render an error state for service failures, and use the existing Admin access-error cleanup and host-based login path for authorization failures. Set metadata title to `Restaurantes`.

- [x] **Step 3: Wire both Admin entries to the shared shell**

Pass `activeItem="invites"` from `/admin` and `activeItem="restaurants"` from the new route, with `publicBasePath` from the existing hostname helper.

- [x] **Step 4: Add a route-matched loading skeleton**

Create a skeleton preserving the list page's heading, three status cards, toolbar, and table/card hierarchy. Reuse shadcn `Skeleton` and the reduced-motion pattern from `AdminInvitesPageSkeleton`.

- [x] **Step 5: Manually inspect route composition**

Trace `/admin` and the custom Admin-host path through the helper and shell links; confirm login redirects retain the destination and the auth pages remain outside the Admin shell.

### Task 4: Build the animated list, summaries, search, and filters

**Files:**
- Create: `features/admin/restaurants/components/admin-restaurants-page.tsx`
- Create: `features/admin/restaurants/components/restaurants-table-toolbar.tsx`
- Create: `features/admin/restaurants/components/restaurants-data-table.tsx`
- Modify: `app/admin/restaurantes/page.tsx`

**Interfaces:**
- `AdminRestaurantsPage` accepts `initialQuery`, `initialData`, and `initialError`.
- Toolbar receives counts, query, selected filter, pending state, and callbacks; table receives rows and an `onOpenRestaurant` callback.

- [x] **Step 1: Implement URL-backed search and status filtering**

Follow `AdminInvitesPage`: debounce text search, reset to page 1 when search/filter changes, preserve page size, use `router.replace(..., { scroll: false })`, and show a subtle pending indicator. Filter labels are `Todos`, `Rascunhos`, `Ativos`, and `Suspensos`.

- [x] **Step 2: Add the animated page header and status summaries**

Use SidebarTrigger, Breadcrumb, the title/description, and three count cards for `draft`, `active`, and `suspended`. Cards select the corresponding filter, expose `aria-pressed`, and use restrained hover/tap transforms.

- [x] **Step 3: Implement the shadcn toolbar**

Reuse the Invite toolbar patterns: labelled `InputGroup`, accessible clear/search actions, shadcn `Tabs`, counts in tabs, and horizontal scrolling on narrow screens.

- [x] **Step 4: Implement desktop table, mobile cards, and pagination**

Show restaurant name/initials, slug, situation badge, and created date. Make rows/cards keyboard-operable and open details without nested action controls. Add accessible previous/next controls and page status using `totalRows`, `page`, and `pageSize`. Add distinct global empty, filtered empty, and load-error states with a retry action.

- [x] **Step 5: Apply motion and manually inspect state branches**

Use `MotionConfig reducedMotion="user"`, `useReducedMotion`, short opacity/transform transitions, and the invite entrance/stagger tokens. Inspect all status filters, clear search, keyboard activation, reduced motion, and error/empty copy statically.

### Task 5: Implement the detail Sheet and restaurant management actions

**Files:**
- Create: `features/admin/restaurants/components/restaurant-details-sheet.tsx`
- Create: `features/admin/restaurants/components/restaurant-status-badge.tsx`
- Modify: `features/admin/restaurants/components/admin-restaurants-page.tsx`

**Interfaces:**
- `RestaurantDetailsSheet` accepts a `RestaurantAdmin | null`, open state, and `onOpenChange`; it invokes the validated Task 2 actions directly and refreshes on success.
- Use the action result unions from Task 2; keep action state scoped to the selected restaurant.

- [x] **Step 1: Implement responsive details content**

Use shadcn Sheet, full viewport width at mobile breakpoints and a bounded right panel on desktop. Show name, current slug, status, created/updated dates, and no public-link or team claims.

- [x] **Step 2: Implement slug editing**

Provide edit/save/cancel states. Validate format before submit and on the server; disable conflicting controls while pending; keep the edited value after errors; on duplicate conflict show an inline field error; on success refresh the server data and show a success toast.

- [x] **Step 3: Implement suspend and restore actions**

Show `Suspender` for `draft` or `active`; require AlertDialog confirmation; show `Restaurar` for `suspended`, with helper text identifying the return state. Keep the Sheet open during the request, show a pending label/spinner, then refresh and toast on success; keep status unchanged on failure.

- [x] **Step 4: Inspect no-activation/no-removal behavior**

Check every rendered branch and action callback: there must be no create, activate, remove, public-link, or membership action. Confirm a failed action does not optimistically change the row or status counts.

### Task 6: Static implementation review

**Files:**
- Review only: all files listed in Tasks 1–5.

- [x] **Step 1: Trace one list request and each mutation end to end**

Manually trace query parsing → page → authorized RPC → validated DTO → UI, and slug/suspend/restore UI → Server Action → validation → authenticated Admin client → secured RPC → audit/revalidation → feedback.

- [x] **Step 2: Inspect responsive/accessibility/motion branches**

Review desktop and mobile markup, keyboard/focus behavior, status text, live regions, reduced-motion behavior, Sheet close behavior, and independent loading/error/empty states.

- [x] **Step 3: Report validation limits**

Do not run Git, typecheck, build, lint, or tests. Report that verification was limited to source and migration inspection, and list any risk that cannot be resolved under those constraints.
