# Admin Invites Visual Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the visual-only Admin Convites landing page, align Motion across Entrar/Criar conta/Convites, and implement the table toolbar, contextual actions and invitation creation Sheet.

**Architecture:** Keep the protected Admin home as a Server Component and render a focused client feature with local demonstration data. Use the installed shadcn components and TanStack React Table v9; leave Supabase invitation operations for a later scope.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, shadcn Base UI components, Tailwind 4, Motion 14.7.1, @tanstack/react-table 9.3.1, react-icons/lu.

**Spec:** docs/superpowers/specs/2026-10-29-admin-invites-visual-design.md

## Global Constraints

- Preserve the server-side platform Admin authorization in app/admin/page.tsx.
- Keep the existing app/ route tree and Admin host/path-prefix behavior.
- Use the current Outfit font, theme tokens, shadcn components and Tailwind utilities; do not edit app/globals.css or generated components/ui files.
- Do not copy legacy tv-* CSS or import legacy styles.
- This scope uses local demonstration data only; do not call Supabase or create invitation operations.
- Use Motion 14 through motion/react across the Admin auth shell/forms and the Convites page; respect the user's reduced-motion preference.
- Do not add or run tests, git, build, lint or typecheck commands.
- Keep the entrance sequential and quick; interactive elements stay usable while their entrance runs.

## Review Focus

- A recipient with no email must remain clear as Qualquer e-mail in the table and detail view.
- A search or selected tab with no matching rows must show a useful empty-result state.
- Long e-mail addresses and the toolbar must remain usable at narrow widths without page-level horizontal overflow.
- Admin-host / and path-prefixed /admin must retain their existing route fallback and metadata hierarchy.
- Keyboard focus, tab selection, contextual actions and reduced-motion display must remain understandable without hover or animation.

---

### Task 1: Admin document titles and protected home composition

**Files:**

- Create: app/admin/layout.tsx
- Modify: app/admin/(auth)/entrar/page.tsx
- Modify: app/admin/(auth)/criar-conta/page.tsx
- Modify: features/admin/auth/components/admin-auth-shell.tsx
- Create: features/admin/auth/components/auth-motion.ts
- Modify: features/admin/auth/components/admin-login-form.tsx
- Modify: features/admin/auth/components/admin-registration-form.tsx
- Modify: package.json
- Modify: pnpm-lock.yaml
- Modify: app/admin/page.tsx

**Interfaces:**

- app/admin/layout.tsx supplies the metadata template %s · Tavvi — Gestão with default title Tavvi — Gestão.
- The child pages supply the titles Entrar, Criar conta and Convites.
- The protected home continues to own server authentication; its visual content delegates to features/admin/invites/components/admin-invites-page.tsx.

- [x] Declare the already available Motion 14.7.1 package directly for motion/react.
- [x] Add a minimal Admin layout exporting the metadata template and returning its children unchanged.
- [x] Export page metadata for login, signup and the protected Admin home.
- [x] Add MotionConfig and a short sequential entrance to the shared auth shell, headline, form groups and feedback states; add hover/press transitions to auth actions and preserve reduced-motion behavior.
- [x] Preserve the current auth form validation, Server Actions, host-aware redirect and protected Admin authorization; replace only the home placeholder presentation and widen the content region.

### Task 2: Invitation demo data, summary and toolbar

**Files:**

- Create: features/admin/invites/data.ts
- Create: features/admin/invites/components/admin-invites-page.tsx
- Create: features/admin/invites/components/invites-table-toolbar.tsx

**Interfaces:**

- PlatformInviteStatus = "pending" | "redeemed" | "expired" | "revoked".
- PlatformInvite contains id, email: string | null, status, createdAt and expiresAt.
- admin-invites-page.tsx owns local query, status tab, selected detail, creation sheet and demo counts.
- invites-table-toolbar.tsx receives the query, query callback, selected status, status callback and counts.

- [x] Add illustrative invitation rows and the four display counts without coupling them to server data.
- [x] Build the page header and four clickable summary cards using the current shadcn theme tokens and Lucide icons.
- [x] Build the search + Tabs toolbar with Todos selected initially and all five status labels/counts.
- [x] Keep the summary, toolbar and table visually separated with the responsive spacing defined in the spec.

### Task 3: TanStack data table and contextual detail actions

**Files:**

- Create: features/admin/invites/components/invites-data-table.tsx
- Create: features/admin/invites/components/invite-details-sheet.tsx
- Modify: features/admin/invites/components/admin-invites-page.tsx

**Interfaces:**

- InvitesDataTable receives invites, onOpen(invite) and onCreateFromInvite(invite).
- The v9 table uses module-scoped tableFeatures({}), column definitions and useTable; shadcn Table primitives own the HTML markup.
- The detail Sheet receives invite: PlatformInvite | null and onOpenChange.

- [x] Compose semantic table columns for recipient, status, creation date, expiry date and row actions.
- [x] Add right-click ContextMenu actions for opening an invite and pre-filling the creation Sheet; expose an equivalent visible row action for pointer/keyboard users.
- [x] Render a clear no-invites state and a separate no-search-results state.
- [x] Format demo dates in Brazilian Portuguese and provide a readable label for invitations without an email.

### Task 4: Invitation creation Sheet and motion/responsive polish

**Files:**

- Create: features/admin/invites/components/invite-create-sheet.tsx
- Modify: features/admin/invites/components/admin-invites-page.tsx
- Modify: features/admin/invites/components/invites-table-toolbar.tsx
- Modify: features/admin/invites/components/invites-data-table.tsx

**Interfaces:**

- InviteCreateSheet receives open, onOpenChange and optional initialEmail.
- The form starts at 7 days, permits 1–30 days and offers a local demonstration success/link state only.

- [x] Build the right-side Sheet with labeled optional email, validity controls, helper copy, error placement and primary/secondary actions.
- [x] Add a local preview success state and copy feedback without persistence, server actions or Supabase calls.
- [x] Add a short sequenced Motion entrance for the header, metric row, toolbar and table area; use light whileHover/whileTap states on actions, transitions on tabs/rows and reduced-motion variants.
- [x] Ensure the mobile toolbar wraps and the table overflow stays inside the table container.
- [x] Review the modified files manually against the spec and the five Review Focus items. Do not invoke prohibited test/build/lint/typecheck/git commands.
