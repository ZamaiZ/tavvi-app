# Admin Invites Shell and Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the authenticated Admin sidebar and polish the existing Convites visual flow without connecting invitation operations to the backend.

**Architecture:** Keep the Admin route as a Server Component that authorizes the user before rendering a new client shell. The shell composes the existing shadcn Sidebar primitives around the Motion-enabled invites page; the invites feature keeps its existing local form/filter state and data table.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, shadcn Base UI components, Tailwind 4, Motion 14.7.1, `next-themes`, TanStack React Table 9.3.1.

**Spec:** `docs/superpowers/specs/2026-10-29-admin-invites-visual-design.md`

## Global Constraints

- Preserve the Admin server authorization gate and `logoutAdminAction`.
- Mount the sidebar only after successful authorization; Entrar and Criar conta stay outside the shell.
- Keep invitation data and form feedback local; do not connect Supabase or add invitation server operations.
- Preserve Motion in auth, invites, dialogs, and details; honor reduced motion.
- Use existing brand assets and shadcn components; do not edit `components/ui/sidebar.tsx`, `app/globals.css`, or add dependencies.
- Do not run or add tests, `git`, `build`, `lint`, or `typecheck` commands.
- Apply edits in the current workspace as requested; do not create a git worktree or commits.

## Review Focus

- Auth pages must not inherit the sidebar through `app/admin/layout.tsx`.
- Ctrl+B/Cmd+B must keep working while text fields have focus without breaking text editing.
- Clicking row action controls must not trigger the row’s detail action.
- The collapsed sidebar must show only the theme-correct brandmark; the expanded sidebar must show the theme-correct lockup.
- The open mobile drawer must show the lockup even when the saved desktop sidebar state is collapsed.
- The details and create Sheets must stay usable at narrow widths and with reduced motion enabled.

---

### Task 1: Authenticated Admin shell and navigation

**Files:**

- Create: `features/admin/shell/components/admin-app-shell.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `features/admin/invites/components/admin-invites-page.tsx`
- Modify: `features/admin/auth/components/admin-auth-shell.tsx` (repair only the missing light-theme lockup asset path)

**Interfaces:**

- `AdminAppShell({ children, publicBasePath }: { children: ReactNode; publicBasePath: "" | "/admin" })` wraps protected Admin content in `SidebarProvider`, `Sidebar`, and `SidebarInset`.
- `app/admin/page.tsx` continues to resolve `publicBasePath` and perform authorization before rendering the shell.
- The shell imports the existing `logoutAdminAction`; it does not add or change authentication operations.

- [x] Build the collapsible sidebar with theme-aware brandmark/lockup, active Convites, disabled Restaurantes, profile theme menu, and existing logout action.
- [x] Include a visible `SidebarTrigger`; rely on the installed SidebarProvider Ctrl+B/Cmd+B shortcut.
- [x] Move the page into `SidebarInset` and remove the old top brand/logout header and debug footer.
- [x] Keep the page’s Motion sequence and avoid nested semantic `<main>` elements.
- [x] Replace the missing auth lockup asset with the matching light and dark assets without changing auth Motion.
- [x] Manually inspect route composition: authenticated Admin gets the sidebar; Entrar/Criar conta do not.

### Task 2: Exclusive summary selection, row activation, and compact layout

**Files:**

- Modify: `features/admin/invites/components/admin-invites-page.tsx`
- Modify: `features/admin/invites/components/invites-data-table.tsx`
- Modify: `features/admin/invites/components/invites-table-toolbar.tsx`
- Modify: `features/admin/invites/data.ts`

**Interfaces:**

- Keep the shared `InviteFilter` state as the single source for summary-card and Tabs selection.
- Keep `InvitesDataTable` callbacks `onOpen(invite)` and `onCreateFromInvite(invite)`.

- [x] Render a summary card as selected only when `selectedFilter === card.status`; initial `all` highlights no status card.
- [x] Add row click and Enter/Space activation to open the existing details Sheet; stop row click propagation from dropdown action controls.
- [x] Preserve context menu and dropdown actions.
- [x] Set the heading to `text-2xl sm:text-3xl`, metrics to `text-2xl`, cards to `p-3 sm:p-4`, and section gaps to `gap-6 sm:gap-7` so the list appears earlier with the sidebar present.
- [x] Contain table horizontal overflow within its own panel and keep toolbar tabs horizontally scrollable on narrow screens.
- [x] Derive summary and tab counts from the displayed local invite records.
- [x] Manually inspect filter changes, row activation, actions, focus indication, and compact desktop hierarchy.

### Task 3: Remove prototype copy from invitation surfaces

**Files:**

- Modify: `features/admin/invites/components/admin-invites-page.tsx`
- Modify: `features/admin/invites/components/invite-create-sheet.tsx`
- Modify: `features/admin/invites/components/invite-details-sheet.tsx`

**Interfaces:**

- Keep the existing Sheet APIs and local form state; do not add a server action or database call.

- [x] Remove visible “prévia”, “demonstrativo”, “próxima etapa” and “registros ilustrativos” copy and remove the matching badge.
- [x] Keep the local creation form, success/link state, copy feedback, and details content visually complete with product-facing labels.
- [x] Preserve the Motion entrance/transition of the Sheet and form states.
- [x] Manually inspect the create and detail Sheets to confirm no prototype disclosure copy remains and no fake operation is wired to the server.

### Task 4: Manual visual review in the browser

**Files:**

- No additional source files.

**Interfaces:**

- Use the local development preview only; do not run prohibited verification commands.

- [x] Review expanded/collapsed sidebar in light and dark themes and toggle with Ctrl+B.
- [x] Review the page at desktop width and confirm the first table row is visible in the first viewport.
- [x] Review selected-card/tab synchronization, clicking a row, context menu, action menu, and both Sheets.
- [x] Confirm login and registration retain sequential Motion and have no sidebar.
- [ ] Confirm layout in a narrow browser viewport (the browser control session stopped before this last visual check; responsive width constraints were corrected in the source).
- [x] Do not run tests, `git`, `build`, `lint`, or `typecheck`.

### Final review adjustments

- `SidebarInset` now uses `min-w-0` so the table's 720px minimum width stays inside its own horizontal scroller.
- The create and details Sheets use right-side width variants to provide full mobile width and a 32rem desktop maximum.
- The brand lockup now uses `isMobile`, so the open mobile drawer shows the full lockup even when the desktop sidebar preference is collapsed.
- The mobile auth logo uses the matching light/dark image assets.
