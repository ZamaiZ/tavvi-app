# Superseded: Tavvi Auth Ambient Background Implementation Plan

> This plan describes the earlier CSS-gradient approach and must not be executed. Use [the liquid background plan](2026-10-29-auth-liquid-background.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the auth shell's moving dot/ring backdrop with restrained, cursor-responsive fluid gradients on desktop.

**Architecture:** Add an `AuthAmbientSurface` client wrapper that owns pointer tracking and the decorative layer. Keep its visual rules in a colocated CSS Module; use Motion springs for pointer response and CSS keyframes for slow independent drift. Integrate it around the existing auth grid so the background can fade across the form while all content remains above it.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, Motion 14.7.1, CSS Modules, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-ambient-background-design.md`

## Global Constraints

- Follow `AGENTS.md`: do not execute `git`, `typecheck`, `build`, `lint`, or `test`; do not add or run tests.
- Add no package or icon dependency; Motion is already installed.
- Keep the background decorative, `aria-hidden`, and non-interactive; pointer events must reach the existing form controls.
- Keep mobile layout and behavior unchanged; the animation is desktop-only.
- Use existing theme variables and provide a static presentation for `prefers-reduced-motion: reduce`.
- Do not change authentication behavior, copy, form controls, global color tokens, or `components/ui`.
- Assume the shared auth shell gives the desktop creation-account page the same treatment; if the scope is login-only, add an opt-in prop instead.

## Review Focus

- Light and dark theme color tokens keep the glow visible but subdued against each surface.
- Pointer movement across the column boundary and over the form produces a smaller, smooth response without a jump.
- Pointer leave returns the composition to its resting drift without snapping.
- Reduced-motion preference removes all continuous and pointer-driven movement while retaining a static composition.
- Decorative layers do not intercept clicks, text selection, field focus, or keyboard navigation.
- Mobile and touch layouts retain the current presentation without a pointer-driven effect.
- The halo fades into the form instead of appearing as a hard seam or tinting the entire right column.

---

### Task 1: Build and integrate the ambient auth surface

**Files:**

- Create: `features/admin/auth/components/auth-ambient-surface.tsx`
- Create: `features/admin/auth/components/auth-ambient-surface.module.css`
- Modify: `features/admin/auth/components/admin-auth-shell.tsx`
- Modify: `app/globals.css` to remove the old `.auth-ambient` rules and keyframes

**Interfaces:**

- `AuthAmbientSurface({ children, className })` receives `{ children: React.ReactNode; className?: string }`. It renders the frame wrapper, a decorative layer, and the supplied grid children directly; merge base and passed classes with the existing `cn` utility from `@/lib/utils`.
- `AdminAuthShell` replaces the existing outer grid `div` with `AuthAmbientSurface`, passing the current frame/grid classes; it does not add a nested grid or frame.

- [ ] Implement pointer normalization in `AuthAmbientSurface` against the full wrapper. Track mouse input across both columns with Motion Values and springs (`stiffness: 60`, `damping: 22`); ignore non-mouse input and ease to center on pointer leave. Reduce pointer strength linearly from 1.0 on the hero side to 0.25 on the far form side.
- [ ] Render three independent bubble layers with maximum motion of roughly 12–18 px over the hero and 3–6 px over the form. Use parallax factors 0.35, 0.65, and 1.0, and drift durations of 24 s, 31 s, and 39 s.
- [ ] Define green radial gradients with existing `--primary` and `--chart-*` variables. Keep each blob's alpha falloff local to its center; add a horizontal mask that begins fading near the column boundary, leaves about 20% intensity at the split, and reaches transparency by about 78% of the frame width.
- [ ] Keep the hero's theme tint translucent in both themes so the animation remains visible behind it; leave the form surface on the frame's base background and put its content above the ambient layer.
- [ ] Keep blur fixed at an initial 36–56 px; animate transform, scale, and organic shape only. Use Motion's `useReducedMotion` to disable pointer response, plus CSS reduced-motion rules to leave a static composition.
- [ ] Mark the visual layer `aria-hidden`, set `pointer-events: none`, and establish a stacking order that puts the hero and form above it.
- [ ] Integrate the wrapper in place of the existing outer grid `div`, preserving its responsive classes and the hidden mobile hero. Remove the old global pattern styles from `app/globals.css`.
- [ ] Manually review login and create-account at desktop widths in light and dark themes. Inspect pointer movement across the hero/form boundary and while over the form, pointer leave, reduced motion, mobile/touch layout, and click/focus/keyboard access to controls. Adjust opacity and fade distance only if the review shows distraction, a visible seam, or obscured form content.

**Deliverable:** the shared auth shell has a soft fluid background with local pointer response, distance-based glow fade, theme support, and no changes to form behavior or mobile layout.

---

## Handoff

This plan describes one contained UI change. Review the spec and plan before implementation; no application code has been changed as part of writing them.
