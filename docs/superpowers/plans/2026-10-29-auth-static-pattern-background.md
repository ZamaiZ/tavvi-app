# Photographic Authentication Hero Integration Plan

> **For agentic workers:** Execute inline with `superpowers:executing-plans`. The repository forbids tests, Git commands, build, lint, and typecheck; verify through source inspection and manual browser review only.

**Goal:** Use the approved darkened, lightly diffused restaurant photo as the background of the desktop authentication hero.

**Architecture:** Store the image in `public/images/auth/login-hero.png`. Render it with Next.js `Image` inside the existing left `aside`, add a restrained theme-aware scrim for headline contrast, and keep the form panel plain. The shell remains shared between login and account creation.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-static-pattern-background-design.md`

## Global Constraints

- Follow `AGENTS.md`: do not execute `git`, `typecheck`, `build`, `lint`, or `test`; do not add or run tests.
- Keep the image inside the left desktop hero; never cover the form.
- Preserve authentication behavior and the existing mobile composition.
- Keep the background static, decorative, accessible, and non-interactive.

## Tasks

### 1. Add the selected image asset

- [x] Copy the approved generated image into `public/images/auth/login-hero.png` without overwriting an existing file.
- [x] Retain the generated source image in its original generated-images location.

### 2. Replace the vector illustration with the photo

**Files:**
- Modify: `features/admin/auth/components/admin-auth-shell.tsx`
- Delete: `features/admin/auth/components/auth-restaurant-illustration.tsx`
- Delete: `features/admin/auth/components/auth-restaurant-illustration.module.css`

- [x] Render the photo with `next/image`, `fill`, responsive `sizes`, empty alt text, and `object-cover` inside the left hero only.
- [x] Apply a subtle base blur and scale, then blend a stronger 10 px backdrop blur at 40% opacity above the same photo. Keep the theme-aware dark scrim and bottom gradient so the image stays atmospheric and logo/headline remain legible.
- [x] Remove the prior SVG illustration; preserve the form panel and mobile layout.

### 3. Review and record

**Files:**
- Modify: `docs/superpowers/specs/2026-10-29-auth-static-pattern-background-design.md`
- Modify: `docs/superpowers/plans/2026-10-29-auth-static-pattern-background.md`
- Modify: `.superpowers/sdd/2026-10-29-auth-static-pattern-background/progress.md`

- [x] Review login in light and dark desktop themes, confirming the image is clipped to the hero and headline contrast is good.
- [x] Confirm from the shared shell that mobile keeps its existing composition: the image remains inside the `aside`, which is hidden below `md`. (A fresh mobile screenshot attempt timed out; a prior 390 px layout review predates this image integration.)
- [x] Record manual review and limitations; run no prohibited commands.
