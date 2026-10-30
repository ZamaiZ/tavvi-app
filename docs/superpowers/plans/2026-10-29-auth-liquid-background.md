# Tavvi Auth Liquid Background Implementation Plan

> **Superseded:** This animated background plan was replaced by [the static SVG pattern plan](2026-10-29-auth-static-pattern-background.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the disconnected CSS glow blobs with a restrained liquid metaball shader behind the shared desktop auth shell.

**Architecture:** Keep `AuthAmbientSurface` as the React boundary for pointer input, theme, reduced motion, and responsive canvas mounting. Put GLSL sources in a shader module and WebGL2 initialization, uniforms, resize handling, animation, cleanup, and fallback state in a focused renderer module; keep canvas layout and the static fallback in the colocated CSS Module.

**Tech Stack:** Next.js 16.4.2 App Router, React 19.3.1, TypeScript, WebGL2/GLSL, CSS Modules, existing semantic CSS variables. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-liquid-background-design.md`

## Global Constraints

- Follow `AGENTS.md`: do not execute `git`, `typecheck`, `build`, `lint`, or `test`; do not add or run tests.
- Add no runtime dependency; implement the isolated effect with WebGL2 and GLSL.
- Keep the effect decorative, `aria-hidden`, and non-interactive; pointer input must not intercept controls.
- Keep mobile presentation unchanged and do not create a WebGL context below the existing desktop breakpoint.
- Use existing theme colors and update uniforms when the theme changes; reduced motion renders one static shader frame, while missing WebGL2 uses the CSS fallback.
- Do not change authentication behavior, copy, form controls, global theme tokens, or components outside the auth shell.
- Limit canvas DPR to 1.25, pause animation while the page is hidden, and release all WebGL resources on cleanup.

## Review Focus

- The thresholded field of three lobes reads as one liquid surface instead of separate circles or internal seams; manually inspect the cluster at desktop width.
- Mouse influence is damped and modest across both columns; manually move across the hero/form seam and leave the shell.
- The glow fades into the first part of the form without tinting labels, fields, focus rings, or buttons; inspect both themes.
- Reduced motion and unavailable WebGL2 produce a static scene; manually inspect these fallback states.
- Mobile keeps the existing presentation and does not initialize the canvas; inspect at the current mobile breakpoint.

---

### Task 1: Replace the CSS blob layer with an isolated WebGL2 liquid renderer

**Files:**

- Create: `features/admin/auth/components/auth-liquid-renderer.ts`
- Modify: `features/admin/auth/components/auth-ambient-surface.tsx`
- Modify: `features/admin/auth/components/auth-ambient-surface.module.css`
- Modify: `features/admin/auth/components/admin-auth-shell.tsx`
- Create: `features/admin/auth/components/auth-liquid-shaders.ts`

**Interfaces:**

- `AuthLiquidPalette` contains normalized RGB tuples for `primary`, `highlight`, `glow`, and `shadow`, plus `darkness` in `[0, 1]` derived from `--background`; `AuthLiquidPointerSource` exposes a mutable `{ x, y, strength }` target with each value in `[0, 1]`.
- `createAuthLiquidRenderer(canvas: HTMLCanvasElement, options: AuthLiquidRendererOptions): AuthLiquidRenderer | null` initializes WebGL2 and returns `setPalette(palette)`, `setMotionEnabled(enabled)`, and `destroy()`; resize and frame scheduling stay internal. `AuthLiquidRendererOptions.onUnavailable()` reports context loss after initialization; return `null` when WebGL2 or shader setup is unavailable.
- `AuthLiquidRendererOptions` contains the initial palette, motion-enabled flag, pointer source, and `onUnavailable(): void`. The animation loop reads the pointer source directly; React does not render per frame.
- `AuthAmbientSurface({ children, className })` retains its current public interface and owns the pointer event boundary and responsive canvas mount.

- [ ] Before writing code, read the relevant client-component/browser API guide from `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- [ ] Replace the three CSS animated blobs with a transparent canvas and a single-halo CSS fallback; hide the fallback only after successful renderer initialization, keep both behind shell content, and disable canvas pointer events.
- [ ] Define the GLSL vertex and fragment sources in `auth-liquid-shaders.ts`; implement shader compilation, a full-screen quad, and a thresholded sum of three moving metaball fields with deterministic low-frequency deformation, pseudo-3D restrained highlights, soft outer glow, and horizontal fade to near-zero by 70% of the frame width.
- [ ] Animate via `requestAnimationFrame` using elapsed time and a damped local mouse target; cap pointer displacement at 14 CSS px over the hero, decay to 4 CSS px across the first 5% of the frame width after the column seam, and keep it there over the rest of the form. Use no React state updates in the frame loop.
- [ ] Resolve `--primary`, `--chart-1`, `--chart-2`, `--chart-5`, and `--background` to normalized RGB with a temporary DOM color probe; derive background darkness for shader intensity and update uniforms with a `MutationObserver` when the root theme class changes.
- [ ] Size the canvas to the auth shell, cap DPR at 1.25, reduce internal resolution when the largest axis exceeds 900 px, pause while `document.visibilityState === "hidden"`, and resume from a fresh time origin.
- [ ] In reduced-motion mode draw one static frame and skip pointer response. Use `matchMedia("(min-width: 768px)")` to avoid creating WebGL below the desktop breakpoint; on WebGL2/context/shader failure, show the CSS fallback.
- [ ] On cleanup cancel the animation frame, disconnect `ResizeObserver`, theme observers and media-query listener, remove visibility/context listeners, and delete WebGL buffers, program, shaders, and context resources.
- [ ] Make the hero tint translucent enough to reveal the canvas, keep the form content above the glow, and remove the obsolete blob/keyframe rules from the CSS Module.
- [ ] Manually review login and create-account in desktop light/dark themes, pointer movement and leave, reduced motion, WebGL fallback, mobile, and keyboard/click/focus access. Adjust shader intensity and fade only when the review identifies distraction or obscured content.

**Deliverable:** The shared desktop auth shell presents one subtle, cursor-responsive liquid surface, fades its light across the column seam, and retains static fallbacks without changing auth behavior or mobile presentation.

---

## Handoff

This is one contained visual change. Review the spec and plan before implementation. Do not run tests, builds, lint, typecheck, or Git commands; the project instructions prohibit them. Validate the result through manual visual and interaction review only.
