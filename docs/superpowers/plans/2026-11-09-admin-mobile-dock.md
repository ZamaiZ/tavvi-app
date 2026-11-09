# Admin Mobile Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated, accessible bottom dock to the authenticated Admin on mobile while retaining the existing desktop sidebar.

**Architecture:** Extract the existing account menu into a shared component with sidebar and dock presentations. Add a focused mobile dock with a Base UI Sheet for route choices, Motion feedback, existing route helpers, theme provider, and logout action; integrate it only in `AdminAppShell`.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, Tailwind CSS 4, Motion 14.7.1, Base UI Sheet/DropdownMenu, `next-themes`, `react-icons/lu`.

**Spec:** `docs/superpowers/specs/2026-11-09-admin-mobile-dock-design.md`

## Global Constraints

- Do not execute `git`, `typecheck`, `build`, `lint`, or `test`.
- Do not create or run tests.
- Keep the shell behind the existing authenticated route gates; do not move it into `app/admin/layout.tsx`.
- Keep desktop sidebar behavior and all `/painel`, auth, public, and backend behavior unchanged.
- Use current semantic theme tokens and installed packages; add no dependencies.
- Respect the 768 px breakpoint, safe areas, at least 44 px touch targets, and reduced motion.

## Review Focus

- **Host-aware home routing:** Confirm the central Convites action uses `getAdminHomePath(publicBasePath)` and Restaurantes uses its existing helper.
- **Responsive duplication:** Confirm dock is mobile-only, desktop sidebar remains, both page header triggers are hidden below 768 px, and Ctrl/Cmd+B cannot open the mobile sidebar.
- **Account actions:** Confirm all three theme values still call `setTheme`, and Sair submits `logoutAdminAction`.
- **Overlay lifecycle:** Confirm nav and account controls cannot remain open together, selecting a route closes navigation, and Escape/outside dismissal and focus behavior come from Base UI; dock theme choices stay inline rather than opening a nested flyout.
- **Motion and occlusion:** Confirm reduced motion removes spatial movement/stagger, safe-area padding is applied, and page-end controls have room above the dock.

## Files and Responsibilities

- Create `features/admin/shell/components/admin-account-menu.tsx`: shared sidebar/dock account trigger, theme options, and logout action.
- Create `features/admin/shell/components/admin-mobile-dock.tsx`: mobile dock bar, nav Sheet, active states, link feedback, and animations.
- Modify `features/admin/shell/components/admin-app-shell.tsx`: use the shared account menu, mount the dock, and reserve mobile bottom space.
- Modify `components/ui/sheet.tsx`: add an optional per-Sheet overlay class so the dock can use a lighter branded scrim without changing other Sheet consumers.
- Modify `components/ui/sidebar.tsx`: add a backwards-compatible option to disable the mobile toggle path while retaining desktop toggle and shortcut behavior.
- Modify `features/admin/invites/components/admin-invites-page.tsx`: retain the sidebar trigger only at desktop widths.
- Modify `features/admin/restaurants/components/admin-restaurants-page.tsx`: retain the sidebar trigger only at desktop widths.

## Tasks

### Task 1: Extract the account menu

**Files:**
- Create: `features/admin/shell/components/admin-account-menu.tsx`
- Modify: `features/admin/shell/components/admin-app-shell.tsx`

**Interfaces:**
- Produces `AdminAccountMenu({ variant }: { variant: "sidebar" | "dock" })`.
- `variant="sidebar"` keeps the current full-width profile trigger and right-side popup.
- `variant="dock"` renders a compact, labeled account trigger and positions the existing menu above it.

- [x] Move the current appearance radio group and logout form without changing values, labels, theme provider, or server action; show dock theme radio options inline while keeping the sidebar submenu.
- [x] Give the sidebar and dock variants their matching trigger layout and popup placement; anchor the dock popup above its trigger.
- [x] Replace the inline profile-menu implementation in `admin-app-shell.tsx` with `AdminAccountMenu variant="sidebar"`.
- [x] Manually inspect the extracted JSX against the current implementation for unchanged Claro/Escuro/Sistema and Sair behavior.

**Deliverable:** Desktop account menu uses a shared component with the same theme and logout behavior.

### Task 2: Build the mobile dock and navigation panel

**Files:**
- Create: `features/admin/shell/components/admin-mobile-dock.tsx`
- Modify: `components/ui/sheet.tsx`

**Interfaces:**
- Export `AdminMobileDock({ invitesHref, restaurantsHref, activeItem })` where `activeItem` is `"invites" | "restaurants"`.
- Consume `AdminAccountMenu variant="dock"`, Next `<Link>`, `useLinkStatus`, the existing Base UI `Sheet`, and installed Motion/icons.

- [x] Render a fixed three-slot mobile bar: account trigger, elevated Convites home link, and navigation trigger.
- [x] Render Convites and Restaurantes as icon-and-label links in a bottom Sheet with a softened dock-specific scrim, semantic title, active state, route close behavior, and accessible dismissal.
- [x] Add an optional `overlayClassName` prop to `SheetContent`, defaulting to all current overlays unchanged.
- [x] Coordinate controlled account and navigation open state so only one can be open at once.
- [x] Add restrained spring/ease-out dock entry, press feedback, sheet entry, and short staggered item entry; make reduced motion remove transforms and stagger.
- [x] Add a subtle pending-link indicator without blocking interaction; keep touch targets at least 44 px.
- [x] Manually inspect component states: active Convites, active Restaurantes, each panel open, and reduced-motion branch.

**Deliverable:** Standalone mobile dock with working route choices and account actions, not yet mounted.

### Task 3: Integrate the dock into authenticated Admin pages

**Files:**
- Modify: `features/admin/shell/components/admin-app-shell.tsx`
- Modify: `features/admin/invites/components/admin-invites-page.tsx`
- Modify: `features/admin/restaurants/components/admin-restaurants-page.tsx`
- Modify: `components/ui/sidebar.tsx`

**Interfaces:**
- Pass `getAdminHomePath(publicBasePath)`, `getAdminRestaurantsPath(publicBasePath)`, and the current `activeItem` from `AdminAppShell` to the dock.
- Keep the current `SidebarProvider`, desktop `Sidebar`, `SidebarInset`, and page authorization calls in place.

- [x] Mount `AdminMobileDock` in `AdminAppShell` and reserve mobile bottom space including `env(safe-area-inset-bottom)`; remove that reserve at desktop widths.
- [x] Hide each page's `SidebarTrigger` below 768 px and disable `SidebarProvider` mobile toggling in this shell; preserve desktop trigger and Ctrl/Cmd+B behavior.
- [x] Manually inspect route composition for both authenticated pages, host-aware links, desktop/mobile visibility, and page-end clearance.
- [x] Review all touched source and spec criteria without running prohibited commands.

**Deliverable:** The Admin uses the dock on mobile and the existing sidebar on desktop.
