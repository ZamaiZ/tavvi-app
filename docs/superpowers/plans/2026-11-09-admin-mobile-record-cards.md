# Admin mobile record cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is being implemented inline in the current checkout. The project forbids Git, tests, typecheck, build, and lint commands; use the manual review steps below and do not run those commands.

**Goal:** Improve mobile filtering and records in Admin Convites and Restaurantes with scrollbar-free swipeable tabs, concise responsive cards, contextual actions, and matching skeletons.

**Architecture:** Keep server queries, DTOs, pagination, URL synchronization, and detail sheets unchanged. Keep desktop tables at `md` and above; render cards below `md`, reusing current models, badges, menu primitives, Tailwind tokens, and Motion patterns.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, Tailwind CSS 4, Motion 14.7.1, React Icons, Base UI context menus, shadcn components.

**Spec:** `docs/superpowers/specs/2026-11-09-admin-mobile-record-cards-design.md`

## Global Constraints

- Do not run `git`, `typecheck`, `build`, `lint`, or `test`; do not add automated tests.
- Keep horizontal touch scrolling on both filter tab strips while hiding the native scrollbar.
- Use `md` as the table/card breakpoint; use one card column on narrow screens and two columns from `sm` where content remains legible.
- Keep existing data, filters, counts, URL state, pagination, loading/error/empty behavior, and detail sheet actions.
- Keep desktop table behavior and existing authorization/server logic intact.
- Respect reduced motion, keyboard access, visible focus, and text labels for status.
- Do not add dependencies or modify shared `components/ui` or global CSS files.

## Review Focus

These cases require manual code review (automated tests are prohibited by project instructions):

1. At 320–390 px, each tab strip has no visible scrollbar, remains horizontally swipeable, and does not clip counts or focus outlines. Inspect both toolbar wrappers.
2. Long email, restaurant name, and slug values do not push a card outside its grid or overlap the status/menu. Inspect both card components.
3. Opening a card and opening its action menu are separate interactions; choosing a menu item must not also open the card. Inspect both mobile card components and invite table action propagation.
4. Global empty, filtered empty, recoverable error, pagination, and busy states still render through their existing page flows. Inspect both admin page components and list components.
5. Reduced-motion preferences remove entry/press motion without hiding records or controls. Inspect each new motion branch and both skeleton components.

---

### Task 1: Swipeable filters and responsive loading skeletons

**Files:**

- Modify: `features/admin/invites/components/invites-table-toolbar.tsx`
- Modify: `features/admin/restaurants/components/restaurants-table-toolbar.tsx`
- Modify: `features/admin/invites/components/admin-invites-page-skeleton.tsx`
- Modify: `features/admin/restaurants/components/admin-restaurants-page-skeleton.tsx`

**Interfaces:**

- Consumes: Existing controlled tab values/counts and current skeleton layouts.
- Produces: No API or prop changes.

- [x] Keep `overflow-x-auto`, `w-max`, and the current tab sizing in both toolbar wrappers. Hide native scrollbar display using scoped Tailwind arbitrary selectors for `scrollbar-width: none` and `::-webkit-scrollbar`; retain touch panning.
- [x] Keep the existing table-shaped skeleton visible at `md` and above. Add a mobile card-shaped skeleton grid below `md`, with `sm:grid-cols-2` matching the planned data cards.
- [x] Manually inspect both responsive branches in the source for matching breakpoints, accessible busy state, and reduced-motion behavior.

### Task 2: Invitation cards and contextual actions

**Files:**

- Create: `features/admin/invites/components/invite-status-badge.tsx`
- Create: `features/admin/invites/components/invite-record-menus.tsx`
- Create: `features/admin/invites/components/invite-mobile-card.tsx`
- Modify: `features/admin/invites/components/invites-data-table.tsx`

**Interfaces:**

- `InviteStatusBadge({ status }: { status: PlatformInviteStatus })` shares the existing status icon, label, and color treatment between table and card.
- `InviteMobileCard({ invite, index, onOpen, onCreateFromInvite }: { invite: PlatformInvite; index: number; onOpen: (invite: PlatformInvite) => void; onCreateFromInvite: (invite: PlatformInvite) => void })` renders one responsive mobile record with staggered entry.
- The feature-local menu module owns the existing “Abrir detalhes” and “Gerar novo convite” actions for both context and visible action menus.
- Existing `InvitesDataTableProps` and page callbacks remain unchanged.

- [x] Move the existing invitation badge and action-menu presentation into feature-local reusable modules without changing labels or actions.
- [x] Build a focused card with recipient, status, creation date, and expiry date; use `getInviteRecipient` so null email remains “Qualquer e-mail”. Add a separate visible actions trigger.
- [x] Keep the card’s details trigger and menu trigger as separate controls. Apply the context menu to the card trigger and preserve the existing keyboard details activation.
- [x] Render the table only at `md` and above and the card grid below `md`; retain the existing empty state and pagination outside both responsive list branches.
- [x] Manually trace card click, keyboard activation, context menu, visible menu actions, and pagination callbacks against the existing page props.

### Task 3: Restaurant card refinement and contextual actions

**Files:**

- Create: `features/admin/restaurants/components/restaurant-mobile-card.tsx`
- Modify: `features/admin/restaurants/components/restaurants-data-table.tsx`

**Interfaces:**

- `RestaurantMobileCard({ restaurant, index, onOpenRestaurant }: { restaurant: RestaurantAdmin; index: number; onOpenRestaurant: (restaurantId: string) => void })` renders one mobile record with staggered entry.
- Existing `RestaurantsDataTableProps`, detail selection, pagination, and restaurant DTO remain unchanged.

- [x] Refine the existing mobile card into a responsive grid item with initials/name, status badge, slug, and a quieter creation date.
- [x] Add a card context menu and a separate visible action trigger for “Abrir detalhes”; keep slug editing and suspend/restore actions in the existing details sheet.
- [x] Preserve the desktop table, current pagination, and one-click detail behavior. Ensure the card body is a real button and the menu button is a sibling, never nested.
- [x] Add short entry and press feedback with `useReducedMotion`; avoid layout animation and keep status text visible.
- [x] Manually trace details and menu actions and inspect long names/slugs against the grid’s `min-w-0`/truncation behavior.

## Implementation Ruling

- Use explicit scoped scrollbar selectors instead of relying on the project’s `scrollbar-none` class usage: the class appears in one component, but no local utility definition was found. If an external utility does supply it, the cost is only two redundant selectors per tab wrapper; the chosen selectors still hide the native bar.
- Treat the reviewer’s `aria-busy` and narrow skeleton-width findings as requirement fixes, although classified Minor: both are explicit spec acceptance criteria. If this is stricter than needed, the cost is only one accessibility state attribute and responsive skeleton sizing; no product action changes.

## Completion Review

- [x] Re-read the spec and the touched components against the acceptance criteria.
- [x] Review the change inventory from the task file lists; do not invoke Git.
- [x] Format the spec, plan, and changed components with Prettier.
- [x] Complete a fresh static review and address its findings: restore the invite date formatter import, separate card status from record names, add `aria-busy` to the pending tab panel, and align narrow card skeletons with the final card layout.
- [x] Do not claim build, lint, typecheck, automated-test, or live-browser verification.
