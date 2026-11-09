# Panel Shell and Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated, restaurant-branded desktop sidebar and mobile dock to the active Panel workspace without changing menu behavior.

**Architecture:** Create Panel-specific account, restaurant-switcher, dock, and shell components using the app's existing Sidebar, Sheet, Popover, DropdownMenu, Motion, theme, route, and server-action primitives. Mount the shell only after the current Cardápio page has validated authentication, active restaurant, and status; pass the already-loaded restaurant and the existing membership list into the shell.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, Tailwind CSS 4, Motion 14.7.1, Base UI Sidebar/Sheet/Popover/DropdownMenu, `next-themes`, `react-icons/lu`.

**Spec:** `docs/superpowers/specs/2026-11-09-panel-shell-mobile-navigation-design.md`

## Global Constraints

- Do not execute `git`, `typecheck`, `build`, `lint`, or `test`.
- Do not create or run tests.
- Keep the shell behind the existing `/painel/cardapio` authentication, restaurant, and status guards; do not add it to `app/painel/layout.tsx`.
- Keep login routing, the initial restaurant picker, onboarding, suspended state, and all Cardápio content/logic unchanged.
- Use `getPanelPublicBasePath`, `selectPanelRestaurantAction`, and `signOutPanelAction` for the existing host, selection, and logout behavior.
- Use the public `/{slug}/media/logo` route for the active restaurant logo; never expose `logoPath` as if it were an image URL. Keep the public media route out of host rewriting on the dedicated Panel host.
- Add no dependencies. At desktop widths, share the Admin sidebar width, navigation row, toggle, account trigger, dropdown dimensions, spacing, and content frame. Keep 44 × 44 px targets in the mobile dock; preserve mobile page spacing and reduced-motion behavior.

## Review Focus

- **Route and status scope:** Verify the shell mounts only after the page resolves an active restaurant; draft, suspended, unauthenticated, and no-selection paths continue their existing redirects.
- **Restaurant selection:** Verify a multi-restaurant selector uses `selectPanelRestaurantAction`, active membership validation, current-row feedback, and the server-returned destination for active/draft/suspended restaurants.
- **Hostname routing:** Verify dock Cardápio and mobile Trocar restaurante hrefs preserve the dedicated Panel host and `/painel` prefix behavior.
- **Logo delivery:** Verify only the active restaurant's slug-based public route is used, the dedicated Panel host does not rewrite public media, missing/unavailable media falls back to initials, and other restaurants do not receive private media paths.
- **Responsive and overlay behavior:** Verify mobile cannot open the Sidebar through controls or Ctrl/Cmd+B; dock account and navigation overlays close on desktop breakpoint changes, and desktop sidebar geometry matches Admin in expanded/collapsed states.

## Files and Responsibilities

- Create `features/panel/shell/components/panel-account-menu.tsx`: sidebar/dock account control, theme options, conditional restaurant-picker link, and Panel logout action.
- Create `features/panel/shell/components/panel-restaurant-switcher.tsx`: desktop restaurant Popover for accounts with multiple memberships, active marker, pending state, and validated selection action.
- Create `features/panel/shell/lib/restaurant-initials.ts`: shared restaurant monogram fallback for the shell brand and selector.
- Create `features/panel/shell/components/panel-mobile-dock.tsx`: fixed mobile dock, Cardápio home action, bottom Sheet with active Cardápio item, and entry/interaction motion.
- Create `features/panel/shell/components/panel-app-shell.tsx`: desktop Sidebar, restaurant identity/selector, active Cardápio link, SidebarInset, mobile toggle suppression, content reserve, and dock integration.
- Modify `app/painel/cardapio/page.tsx`: preserve its existing guards, load the current restaurant list for this authenticated workspace route, and pass minimal identity data into `PanelAppShell`.
- Modify `features/panel/workspace/components/panel-menu-template.tsx`: add a desktop-only SidebarTrigger, remove the page-level ThemeToggle, retain the visual content, and change its root wrapper to `<div>` because `SidebarInset` supplies the page's sole `<main>` landmark.

## Tasks

### Task 1: Add Panel account and restaurant switching controls

**Files:**
- Create: `features/panel/shell/components/panel-account-menu.tsx`
- Create: `features/panel/shell/components/panel-restaurant-switcher.tsx`

**Interfaces:**
- `PanelAccountMenu({ variant, restaurantsHref, canSwitchRestaurants, open?, onOpenChange? })`, where `variant` is `"sidebar" | "dock"` and dock state can be controlled by the parent.
- `PanelRestaurantSwitcher({ restaurants, currentRestaurantId, onClose })`, consuming `PanelRestaurantListItem[]` and using the existing selection action; `onClose` closes the parent Popover after selecting the current entry or starting a successful route change.
- `restaurantInitials(name: string): string`, shared by the active brand mark and selector rows.

- [x] Build the sidebar and dock account triggers with the Admin's visual pattern; use System/Claro/Escuro from `next-themes`, show theme choices inline in the dock popup, and use `signOutPanelAction` for Sair.
- [x] Add Trocar restaurante only when `canSwitchRestaurants` is true; link to the existing `getPanelRestaurantsPath(publicBasePath)` destination.
- [x] Build the desktop brand selector as a Base UI Popover for multiple restaurants with the current row marked, restaurant name/status, a pending affordance, and a concise recoverable error state.
- [x] Sort the current restaurant first, keep the remaining names stable alphabetically, and stagger selector rows briefly with reduced-motion support.
- [x] On selection, call `selectPanelRestaurantAction(id)` and navigate to its returned destination; keep the active restaurant selectable only as a close/no-op.
- [x] Review source labels, Base UI keyboard/focus behavior, pending state, active row, and constrained popover sizing.

**Deliverable:** Panel-specific account controls and a working desktop restaurant selector, without changing membership or routing logic.

### Task 2: Build the Panel mobile dock

**Files:**
- Create: `features/panel/shell/components/panel-mobile-dock.tsx`

**Interfaces:**
- `PanelMobileDock({ cardapioHref, restaurantsHref, canSwitchRestaurants })`.
- Consume `PanelAccountMenu variant="dock"`, Next `<Link>`/`useLinkStatus`, the existing Base UI `Sheet`, Motion, and Lucide icons.

- [x] Render a fixed three-slot bar: account trigger, elevated Cardápio link, and navigation trigger.
- [x] Render one Cardápio destination in the bottom Sheet with icon, label, active state, close behavior, and accessible title.
- [x] Coordinate account and navigation state so only one is open; close both on route selection and preserve Base UI Escape/outside/focus behavior.
- [x] Add restrained entry, active/press feedback, a short item stagger, and pending-route feedback; reduced motion removes spatial movement, scale, and stagger.
- [x] Keep interactive controls at least 44 × 44 px and apply the dock and Sheet safe-area offsets.
- [x] Review source state coordination, active/pending/reduced-motion branches, safe-area offsets, and the single-destination menu.

**Deliverable:** A standalone mobile dock matching the Admin's dock pattern while using Panel routes/actions.

### Task 3: Integrate the restaurant-branded shell on Cardápio

**Files:**
- Create: `features/panel/shell/components/panel-app-shell.tsx`
- Modify: `app/painel/cardapio/page.tsx`
- Modify: `features/panel/workspace/components/panel-menu-template.tsx`

**Interfaces:**
- `PanelAppShell({ children, publicBasePath, restaurant, restaurants })`, with `restaurant` narrowed to `{ id, name, slug, hasLogo }` and `restaurants` typed as `PanelRestaurantListItem[]`.
- Sidebar brand uses `BrandImage` with `slug`, `slot="logo"`, and initials fallback only when the active restaurant has a logo path; other switcher entries use monograms.

- [x] Compose `SidebarProvider defaultOpen disableMobileToggle`, collapsible desktop Sidebar, Cardápio menu item, account footer, `SidebarInset`, and `PanelMobileDock`.
- [x] Use the restaurant logo/name as sidebar identity; show the switcher trigger only when the list has more than one restaurant, and use the public media route plus initials fallback for the active restaurant.
- [x] Build Cardápio and restaurant-picker hrefs from `getPanelPublicBasePath`/`getPanelRestaurantsPath`; keep the sidebar active and dock home on Cardápio.
- [x] Mount the shell only in the already-guarded Cardápio page after its existing redirects; pass the minimal active identity and restaurant list. Treat the list lookup as optional and keep the active restaurant as a one-item fallback when unavailable. Do not add a parent `/painel` layout.
- [x] Add a SidebarTrigger to the existing Cardápio header for desktop only; reserve mobile content space for the dock and safe area; keep the existing visual content, remove its duplicate ThemeToggle, and use a `<div>` root under `SidebarInset` to avoid nested `<main>` landmarks.
- [x] Add a brief stagger for shell identity/navigation/account entrance with reduced-motion handling and no layout shifts.
- [x] Review source for desktop expanded/collapsed states, mobile breakpoint, host/prefix route composition, logo fallback, and content clearance.

**Deliverable:** Authenticated active Panel Cardápio uses the desktop restaurant sidebar and the mobile bottom dock.

### Task 4: Static source review

**Files:**
- Review the created and modified files above.

- [x] Search touched source for route-helper use, `disableMobileToggle`, the single active Cardápio item, panel-specific logout, active-only public logo URL, and reduced-motion overrides.
- [x] Confirm no changes were made to auth/onboarding/restaurant-picker/cardápio logic and no unrelated routes mount the shell.
- [x] Review the spec acceptance criteria against the implementation; do not run tests, build, lint, typecheck, or Git commands.

**Deliverable:** Source-level review complete under the repository's no-test/no-build constraints.

## Approved visual parity follow-up

- [x] Restore the default Admin collapsed-sidebar width and navigation row dimensions in the Panel; keep larger touch targets in the mobile dock.
- [x] Keep only the restaurant logo and name in the Panel brand row; remove its subtitle.
- [x] Use the Admin breadcrumb and compact SidebarTrigger pattern for the Cardápio page header.
- [x] Use the Admin desktop content widths/gutters while preserving the existing Cardápio card and mobile spacing.
- [x] Keep Panel-specific restaurant switching, theme options, logout, and the approved mobile dock behavior.
