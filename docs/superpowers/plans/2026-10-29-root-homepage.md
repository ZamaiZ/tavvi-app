# Tavvi Root Informational Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`, according to the execution method selected by the user. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the starter at `/` with one short, non-interactive Tavvi card-menu information page, consistently shown on public local and online roots.

**Architecture:** Keep the page as a server-rendered App Router page. Use the existing theme variables for a single decorative green radial gradient, with a slow CSS-only drift and a static state for reduced motion; do not change theme tokens or routing middleware.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, Tailwind CSS 4, existing CSS and `next-themes` setup.

**Spec:** `docs/superpowers/specs/2026-10-29-root-homepage-design.md`

## Global Constraints

- Show exactly the fixed Portuguese label, title, and supporting sentence from the spec.
- Render no links, buttons, forms, navigation, calls to action, or other interactive controls.
- Use existing `--primary` green and theme surfaces; add no gold, fixed theme colors, images beyond the two existing wordmark variants, dependencies, or global palette changes.
- Keep the gradient decorative, behind the content, and static when `prefers-reduced-motion: reduce` is active.
- Do not change `proxy.ts`, Admin routes, or authentication behavior.
- Follow `AGENTS.md`: do not execute `git`, `typecheck`, `build`, `lint`, or `test`; do not add or run tests.

## Review Focus

- Theme and contrast: in light and dark mode, the text remains legible and the green glow stays quiet.
- Wordmark theme variant: show the `on-light` Tavvi wordmark in light mode and `on-dark` in dark mode, with accessible alternative text.
- Reduced motion: the gradient remains visible but stops drifting when the OS preference requests reduced motion.
- Mobile width: the centered copy wraps naturally and causes no horizontal scrolling or clipped text.
- No navigation: the rendered page contains no anchors, buttons, or controls.
- Route boundaries: public `/` no longer branches on `VERCEL_ENV`, while the existing Admin host rewrite and `/admin` routes remain unchanged.

---

### Task 1: Check the installed Next.js conventions

**Files:**

- Read: `node_modules/next/dist/docs/01-app/` page, metadata, rendering, and CSS guides
- Read: `app/page.tsx`, `app/globals.css`, `components/theme-provider.tsx`

- [x] Read the guides from the installed Next.js package that cover App Router pages, static rendering or route segment config, metadata exports, and CSS. Confirm how this version handles a static page after removing `force-dynamic`.
- [x] Confirm the existing page structure, `--primary` light/dark values, theme class behavior, and reduced-motion convention before editing.

**Deliverable:** implementation choices match the installed Next.js version and current app tokens.

### Task 2: Replace the public root starter

**Files:**

- Modify: `app/page.tsx`
- Create: `app/page.module.css`
- Read: `public/brand/tavvi-wordmark-light.png`
- Read: `public/brand/tavvi-wordmark-dark.png`

**Interfaces:**

- `app/page.tsx` remains a server page and exports page metadata with title `Tavvi — Cardápio digital` plus a short QR Code/NFC description. It imports `Image` from `next/image` and uses the two existing 420×152 wordmark PNGs at a small fixed display height.
- The page consumes `--background`, `--foreground`, and `--primary` from the existing theme; it adds no new shared component or global token.
- `app/page.module.css` defines the route-scoped `.rootAmbient` decoration and its keyframes; no global CSS or theme variables change.

- [x] Remove the `redirect` import, the `VERCEL_ENV === "preview"` branch, and `export const dynamic = "force-dynamic"` after Task 1 confirms the static route convention.
- [x] Replace the starter copy and button with one centered `main` containing the active theme's Tavvi wordmark plus `CARDÁPIO DIGITAL`, the single `h1` `O cardápio está na mesa`, and the paragraph `Acesse pelo QR Code ou NFC do restaurante, sem instalar nada.`
- [x] Add one absolutely positioned decorative element marked `aria-hidden="true"` and `pointer-events: none`; keep it behind the text and within the page's clipped background.
- [x] Add `.rootAmbient` CSS using one radial gradient mixed from `var(--primary)` at an initial 14% intensity. Drift it with a 36-second ease-in-out alternate animation using only a small `transform` translation; disable animation under `prefers-reduced-motion: reduce` while preserving the static gradient.
- [x] Keep the layout centered, spacious, mobile-safe, and free of cards, images, gold assets, anchors, buttons, or added controls. Leave `proxy.ts`, Admin routes, and all theme tokens unchanged.

**Deliverable:** `/` renders the fixed informational page with a low-key green ambient gradient in both themes and no interactive elements.

### Task 3: Review the page manually in the browser

**Files:**

- Review: `/` in the existing local browser session
- Review: `/` on an available online Preview URL, if one exists after implementation

- [x] Inspect the local root at desktop widths in light and dark themes. Confirm the exact copy, contrast, spacing, and absence of app links or buttons. Review mobile wrapping from the responsive source; this browser session did not provide viewport emulation.
- [x] Inspect the `prefers-reduced-motion` rule and confirm it disables gradient animation while retaining the static gradient.
- [x] Inspect the rendered page for any app link, button, or other control; confirm the root page no longer depends on `VERCEL_ENV`.
- [x] No online Preview URL was provided, so online inspection was unavailable. Do not deploy as part of this task.
- [x] Do not run or add automated tests or any command forbidden by `AGENTS.md`.

**Deliverable:** manual visual review covers the theme, motion, responsive layout, and public-root behavior without automated tests.

---

## Handoff

This is one contained route and stylesheet change. Review this plan and choose an execution method before implementation; no application code has been changed as part of writing it.
