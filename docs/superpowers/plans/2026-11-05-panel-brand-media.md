# Panel Brand Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep logo/cover selection local as a Blob until autosave/finalization, upload them through a guarded server path, fix the Storage policy boundary, and give the dropzones polished states and sequenced motion.

**Architecture:** A multipart Route Handler validates the Panel session and active restaurant, then a server-only persistence service uploads pending images with the user's authenticated Supabase client and calls the existing draft/complete RPC. A new Storage policy helper checks canonical paths, authenticated membership, and draft status without relying on caller-visible table RLS. The client keeps `File`/object URLs in the wizard context and sends them only when a save occurs.

**Tech Stack:** Next.js 16 Route Handler, React, Motion, existing Supabase SSR clients/Storage/RPC, Zod, existing Tavvi components and motion variants.

**Spec:** `docs/superpowers/specs/2026-11-05-panel-brand-media-design.md`

## Global Constraints

- Do not run `git`, `typecheck`, `build`, `lint`, or `test`; do not add tests.
- Keep the existing 5 MB limit and JPEG/PNG/WebP formats.
- Keep Storage private and RLS enforced; do not use service role.
- Upload only during 2.5-second autosave, step navigation save, or finalization.
- Do not add a public `/{slug}` page or new dependencies.
- Use local Next 16 docs and native workspace; no worktree/Git.

## Review Focus

- Session/cookie mismatch: unauthenticated or other-user requests cannot create an object.
- Context switch in another tab: expected restaurant ID must match the active cookie before upload and RPC.
- Storage policy rollout: the new policy helper and grants must be installed with the migration; absent migration remains a clear storage failure.
- Two images or a replace/remove while a save is in flight: later saves must not restore a stale path or discard the newest pending Blob.
- Network/RPC failure after upload: new objects are compensated where possible; existing objects and local previews remain usable.
- Reduced motion and keyboard-only dragzone access must remain functional.

## Tasks

### Task 1: Harden Storage write authorization

**Files:**
- Create: `supabase/migrations/20261105040000_panel_brand_storage_write_policy.sql`

**Interfaces:**
- Produces helper `public.panel_brand_storage_can_write(p_object_name text) returns boolean` for Storage policies.
- Consumes the existing private `restaurant-brand` bucket and the Panel membership/status schema.

- [x] **Step 1: Add a safe policy helper** — security definer, stable, empty search path; reject malformed object paths before UUID conversion; return true only for `auth.uid()` with active membership on a draft restaurant.
- [x] **Step 2: Replace insert/delete policies** — require bucket `restaurant-brand` and the helper for generated logo/cover paths; keep MIME and 5 MB enforcement in bucket configuration.
- [x] **Step 3: Review permissions statically** — revoke default public execution and grant only the role needed by the authenticated Storage policy; ensure no client-provided user ID is trusted.

### Task 2: Server-side save/upload pipeline

**Files:**
- Create: `features/panel/onboarding/server/persistence.ts`
- Create: `app/painel/onboarding/save/route.ts`
- Modify: `features/panel/onboarding/actions.ts`
- Modify: `features/panel/onboarding/model.ts` if response schema needs saved paths/media-denied status.

**Interfaces:**
- Produces `POST /painel/onboarding/save` multipart endpoint for `intent=draft|complete`, identity/context IDs, step, JSON profile, and optional logo/cover `File`s.
- Reuses `save_panel_restaurant_draft` and `complete_panel_restaurant_onboarding`; returns limited status, code, restaurant ID, and only paths saved by this request.

- [x] **Step 1: Extract shared persistence service** — validate expected active context and draft status, upload pending files with the authenticated Panel Supabase client, generate UUID paths on the server, then call the matching RPC.
- [x] **Step 2: Compensate failed writes** — if either upload or RPC fails, remove only objects created by this request; remove replaced objects only after the profile RPC succeeds.
- [x] **Step 3: Add multipart Route Handler** — parse `request.formData()`, validate same-origin request, IDs, intent, step, profile Zod schema, file type and per-file 5 MB limit; never accept client paths.
- [x] **Step 4: Map errors to safe responses** — distinguish invalid input, changed context, and unavailable/storage failure without returning raw Supabase details.

### Task 3: Blob-first image state

**Files:**
- Modify: `features/panel/onboarding/components/onboarding-wizard.tsx`
- Modify: `features/panel/onboarding/components/identity-step.tsx`
- Modify: `features/panel/onboarding/actions.ts` or add a small client request helper in `features/panel/onboarding/`.

**Interfaces:**
- Wizard owns `pendingFiles` keyed by `logo|cover`, object URL lifecycle, and autosave state.
- `selectImage(slot, file)` validates locally, creates a Blob URL, and schedules draft save without calling Storage.

- [x] **Step 1: Replace immediate upload with local selection** — keep files in context and keep the Blob preview on failures; revoke Blob URLs on replacement, removal, or unmount.
- [x] **Step 2: Send files only from persistence** — include all current pending files in the save request; on success reconcile returned paths without overwriting newer edits; on failure retain files for retry.
- [x] **Step 3: Preserve save ordering** — serialize snapshots and resolve pending file state at queue execution so concurrent field edits, replace/remove, and two-slot saves cannot write stale paths.
- [x] **Step 4: Handle remove/replace safely** — remove locally immediately, persist a null/new path on save, and let the server remove the prior object after RPC success.

### Task 4: Premium accessible dropzones and motion

**Files:**
- Create: `features/panel/onboarding/components/brand-image-dropzone.tsx`
- Modify: `features/panel/onboarding/components/identity-step.tsx`
- Modify: `features/panel/onboarding/components/contact-step.tsx`
- Modify: `features/panel/onboarding/components/onboarding-wizard.tsx`

**Interfaces:**
- Dropzone receives slot, label, current preview, pending name/size, saving/error state, and select/remove callbacks.
- Reuses `authStaggerVariants` and `authItemVariants`; no new animation dependency.

- [x] **Step 1: Build drag-and-drop and browse interaction** — support pointer drop, click, keyboard browse, drag state, replace/remove, JPG/PNG/WebP and 5 MB feedback.
- [x] **Step 2: Add refined states** — distinct idle/dragging/preview-pending/saving/saved/error visuals, status text, retry action, logo contain and cover crop.
- [x] **Step 3: Sequence screen entry** — animate shell, stepper, section headings, controls, dropzones and footer with short stagger and reduced-motion behavior.
- [x] **Step 4: Review focus, announcements, and error states statically** — drop interaction must remain keyboard reachable and screen-reader understandable; saving must not block editing longer than necessary.

### Task 5: Final static review

**Files:**
- Review the files from Tasks 1–4.

- [x] **Step 1: Review authorization and migration** — trace each write from authenticated route through Storage policy and RPC; verify no status or path is client-authoritative.
- [x] **Step 2: Review image lifecycle** — selection has no Storage call; debounce/navigation/finalization include the Blob; failures retain local preview; successful RPC updates paths and cleans old objects.
- [x] **Step 3: Review motion and project constraints** — all relevant UI groups enter sequentially, reduced motion remains supported, and no prohibited command or test was run.
