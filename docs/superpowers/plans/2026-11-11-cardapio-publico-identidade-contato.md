# Cardápio Público, Identidade e Contato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the public restaurant welcome-to-menu flow with two presentations, and permanent Identity and Contact editing pages for active restaurants in the existing panel.

**Architecture:** Keep the public route server-rendered and the existing public menu RPC as its data source. Normalize menu presentation to `immersive | standard`, render Standard as category sections with one horizontal item card at a time, and render Immersive as a welcome screen followed by a full-height horizontal item feed. Move draft onboarding pages under `/painel/onboarding/*`, and put active Cardápio, Identidade, and Contato routes under a shared authenticated workspace layout. Save Identity and Contact through separate authenticated RPCs so one editor cannot overwrite stale fields owned by the other.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/Postgres RPCs, shadcn/Base UI, Lucide, CSS Modules, Motion (`motion/react`), Zod.

**Spec:** `docs/superpowers/specs/2026-11-11-cardapio-publico-identidade-contato-design.md`

## Global Constraints

- Preserve the current panel auth surface, active restaurant membership rules, public RPC access, and storage bucket boundaries.
- Use the user-facing Identity mode names **Imersivo** and **Padrão**, backed by canonical values `immersive` and `standard`.
- Do not add dependencies or introduce native `<select>` controls; use existing Base UI/shadcn comboboxes and option cards.
- Respect `prefers-reduced-motion`, keep public controls available during reveal, and avoid animating offscreen menu items.
- Do not add or run tests, `git`, `typecheck`, `build`, or `lint`; these are prohibited by the repository AGENTS instructions. Validate by static inspection only.
- Work in the current workspace as explicitly requested; do not create a Git worktree or commit.

## Review Focus

- A missing-media item remains present in Immersive with a theme-based visual fallback.
- Long Immersive content scrolls vertically within its slide while horizontal item navigation remains available.
- Standard categories remain vertically discoverable, while each category's products are one large card per horizontal position.
- The welcome screen and menu reveal sequence are polished, brief, keyboard accessible, and reduced-motion safe.
- Draft onboarding routes still resolve after being moved, including route handlers, redirects, and host-based base paths.
- Active Identity and Contact saves validate the active membership in SQL, update only their own fields, and revalidate the public restaurant route.
- Brand uploads remain scoped to the active restaurant and clean up new files on failed persistence.
- Desktop navigation has Operação/Cardápio and Perfil público/Identidade/Contato; mobile exposes all three destinations.
- The Cardápio, Identidade, and Contato headers retain the existing toggle + icon + title hierarchy.

---

### Task 1: Canonical presentation values and route foundation

**Files:**

- Modify: `features/panel/onboarding/schema.ts`
- Modify: `features/panel/onboarding/model.ts`
- Modify: `features/panel/onboarding/components/identity-step.tsx`
- Modify: `features/panel/auth/navigation.ts`
- Modify: `features/panel/onboarding/components/onboarding-wizard.tsx`
- Move: `app/painel/(onboarding)/layout.tsx` to `app/painel/onboarding/layout.tsx`
- Move: `app/painel/(onboarding)/identidade/page.tsx` to `app/painel/onboarding/identidade/page.tsx`
- Move: `app/painel/(onboarding)/contato/page.tsx` to `app/painel/onboarding/contato/page.tsx`
- Create: `app/painel/(workspace)/layout.tsx`
- Move: `app/painel/cardapio/page.tsx` and its route-local error/loading/media children under `app/painel/(workspace)/cardapio/`
- Create: `supabase/migrations/20261111010000_menu_presentation_identity_contact.sql`

**Interfaces:**

- `MenuPresentation = "immersive" | "standard"` is shared by panel and public DTOs.
- Draft navigation uses `/onboarding/identidade` and `/onboarding/contato` under both `/painel` and the configured panel subdomain base.
- Shared workspace layout resolves the authenticated active restaurant, redirects drafts to onboarding and suspended restaurants to `/suspenso`, then wraps workspace pages in `PanelAppShell`.

- [x] Canonicalize UI/schema values and map the legacy `catalog-list`/`catalog-grid` DB values to `standard` in the migration.
- [x] Update onboarding routing, draft entry redirects, and wizard navigation without changing route-handler paths.
- [x] Move active Cardápio into the shared workspace route group and remove duplicate shell setup from its page.
- [x] Preserve `/painel/cardapio/error`, loading, and media route behavior after the move.
- [x] Statically inspect every route reference to onboarding and cardapio before continuing.

### Task 2: Public welcome, Standard rail, Immersive feed, and motion

**Files:**

- Modify: `features/public-profile/menu-model.ts`
- Modify: `features/public-profile/components/restaurant-public-profile.tsx`
- Modify: `features/public-profile/components/public-menu.tsx`
- Modify: `features/public-profile/styles/public-profile.module.css`
- Modify: `supabase/migrations/20261111090000_menu_media_required.sql` (remove per-item media enforcement while retaining the menu publication rule)
- Create: `supabase/migrations/20261111100000_public_menu_missing_media_fallback.sql` (preserve visible media-less items in the public DTO)
- Reuse: `features/public-profile/components/public-profile-controls.tsx`

**Interfaces:**

- Public DTO presentation is `"immersive" | "standard"`; parsing accepts old presentation values only as aliases during transition.
- The welcome section owns the first horizontal snap screen and an explicit **Ver cardápio** action; without a published menu, the current profile and construction state remain usable.
- `PublicMenu` renders Standard category rails or an Immersive category-grouped feed from the same published DTO.

- [x] Separate the welcome viewport from menu content and add an accessible horizontal snap transition with a hidden scrollbar and a visible affordance/button.
- [x] Implement Standard category selection and horizontal one-item rails with large product cards.
- [x] Preserve all existing product fields and replace same-axis nested media scrolling with an explicit accessible media viewer.
- [x] Implement the Immersive full-height item feed, category jump controls, theme-based missing-media fallback, and vertical overflow within a slide.
- [x] Add sequential reveal for category/item information using Motion, reveal on first viewport entry only, and honor reduced motion.
- [x] Statically inspect mobile breakpoints, focus indicators, media labels, fallback paths, and preserved public RPC fields.

### Task 3: Shared panel navigation and page headings

**Files:**

- Create: `app/painel/(workspace)/identidade/page.tsx`
- Create: `app/painel/(workspace)/contato/page.tsx`
- Modify: `features/panel/shell/components/panel-app-shell.tsx`
- Modify: `features/panel/shell/components/panel-mobile-dock.tsx`
- Modify: `features/panel/workspace/server/restaurants.ts`
- Create: `features/panel/workspace/components/panel-page-heading.tsx`
- Modify: `features/panel/menu/components/menu-workspace.tsx`

**Interfaces:**

- Shared workspace layout passes active restaurant identity, restaurant switcher entries, route base, and the current section to `PanelAppShell`.
- Navigation groups are Operação → Cardápio and Perfil público → Identidade, Contato.
- `PanelPageHeading({ title, icon })` renders the standard sidebar toggle, title icon, and title used by all three workspace pages.

- [x] Add route-aware active states and grouped desktop sidebar links.
- [x] Add all three destinations to the mobile dock/sheet while preserving its account action.
- [x] Extract/apply the compact page heading pattern to Cardápio, Identidade, and Contato.
- [x] Keep mobile layout on the same page hierarchy with no duplicate desktop-only navigation assumptions.

### Task 4: Active Identity editor and scoped brand persistence

**Files:**

- Create: `features/panel/profile/components/identity-editor.tsx`
- Create: `features/panel/profile/server/persistence.ts`
- Create: `features/panel/profile/schema.ts`
- Create: `features/panel/profile/actions.ts`
- Create: `app/painel/profile/identity/route.ts`
- Modify: `features/panel/onboarding/identity-options.ts`
- Modify: `features/panel/onboarding/components/brand-image-dropzone.tsx` (only if shared props require it)
- Modify: `supabase/migrations/20261111010000_menu_presentation_identity_contact.sql`

**Interfaces:**

- Identity input contains `segment`, `theme`, `menuPresentation`, `logoPath`, and `coverPath`; the restaurant name/description/contact remain owned by Contact.
- `POST /painel/profile/identity` validates the same-origin request and active restaurant context, stages scoped image uploads, and calls an identity-only RPC.
- Brand upload route accepts only `logo`/`cover` images up to the current size limit and paths under `<active restaurant id>/<slot>/`.

- [x] Build the icon-input/combobox identity form and two visual presentation cards with exact labels Imersivo/Padrão.
- [x] Reuse current presets, density, and color controls; keep changes staged until the user saves.
- [x] Implement scoped upload, upload cleanup on failure, and old-file cleanup only after successful RPC persistence.
- [x] Add the SQL identity update RPC with authenticated user + active membership validation and field-level update scope.
- [x] Revalidate the public slug route after save and preserve dirty/error/saved feedback states.

### Task 5: Active Contact editor and scoped persistence

**Files:**

- Create: `features/panel/profile/components/contact-editor.tsx`
- Modify: `features/panel/profile/server/persistence.ts`
- Modify: `features/panel/profile/schema.ts`
- Modify: `features/panel/profile/actions.ts`
- Modify: `features/panel/onboarding/components/icon-input.tsx` (reuse/export field primitives only if needed)
- Modify: `supabase/migrations/20261111010000_menu_presentation_identity_contact.sql`

**Interfaces:**

- Contact input owns restaurant `name`, `description`, and `contact` fields; identity fields are never sent by this editor.
- `saveActiveRestaurantContactAction` validates the complete published profile, resolves Google review URLs when Maps changes, and calls a contact-only RPC.
- Existing CEP lookup behavior and required WhatsApp/address rules remain intact.

- [x] Build the icon-input/contact form with accessible errors, CEP assist, and Google Maps link feedback.
- [x] Save only contact/name/description fields through a separately authorized SQL RPC.
- [x] Preserve the published Google review URL if a Maps URL change cannot be resolved; clear it when Maps is removed.
- [x] Revalidate the public route and maintain explicit saving/saved/error/dirty states.

### Task 6: Static integration review and implementation handoff

**Files:**

- Review all files listed above.
- Update this plan and `.superpowers/sdd/2026-11-11-cardapio-publico-identidade-contato/progress.md`.

- [x] Trace panel draft, active, suspended, host-based and mobile routes in source; repair stale paths.
- [x] Trace identity/contact RPC parameters and SQL guards against the active membership model; ensure no `position` authorization is introduced.
- [x] Trace public presentation parsing, menu item rendering, media viewing, no-media fallback, and long-content behavior.
- [x] Check changed JSX for native `<select>`, public view for hidden-menu leaks, reduced-motion handling, and field ownership boundaries.
- [x] Request a final independent code review and resolve material findings.
- [x] Do not run prohibited tests, build, lint, typecheck, or Git commands.
