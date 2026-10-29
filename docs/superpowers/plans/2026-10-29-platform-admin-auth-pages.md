# Admin Authentication Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement separate, secure Admin login and first-account registration pages using the existing Tavvi shadcn UI.

**Architecture:** Keep route rendering in Next.js Server Components and auth mutations in Server Actions. Server-only Supabase operations use the Admin cookie scope and the existing identity RPCs; client components are limited to form state, password visibility, toast feedback, and restrained Motion.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, Supabase SSR/Auth, PostgreSQL RPCs, Zod, existing shadcn components, Tailwind CSS, Motion 14, react-icons/lu.

**Spec:** docs/superpowers/specs/2026-10-29-platform-admin-auth-pages-design.md

## Global Constraints

- The app uses app/ at the repository root; do not introduce src/app.
- Keep the implementation of every existing components/ui component unchanged.
- Do not add custom CSS, change app/globals.css tokens, change the shadcn preset, or add icon/form dependencies.
- Keep all user-facing copy in pt-BR and set the document language to pt-BR.
- Use tavvi-admin-auth-token for Admin and never share or overwrite tavvi-panel-auth-token.
- Keep Supabase secrets server-side; do not use service_role, Express, APP_SERVER_KEY, VAPID, or localStorage for auth state.
- Supabase email confirmation remains disabled; the identity migration must be applied before using the pages.
- Create the first Admin in each environment before making its open registration URL public; this is an operational precondition, not an in-app bootstrap secret.
- Do not add or run automated tests or lint. The user has authorized pnpm typecheck and pnpm build for tavvi-app; run them after implementation only.

## Review Focus

- Two first-account registrations race: exactly one claim succeeds; the loser is signed out and sees the closed state. Manually verify in Task 3.
- Auth signup succeeds but claim RPC fails transiently: keep the session and retry only the idempotent claim, without creating a duplicate Auth user. Manually verify in Task 3.
- A valid Auth user without platform_admins attempts Admin login: sign out that Admin session and show the generic denial message. Manually verify in Task 4.
- Invalid fields, invalid credentials, rate limits, network failure, and closed registration show useful Portuguese messages without exposing raw errors or confirming an email exists. Manually review in Tasks 2–4.
- Local host, Preview path, production Admin host, and malicious next values preserve the surface and never permit an external redirect. Manually verify in Task 4.

---

### Task 1: Define auth schemas, result states, and server operations

**Files:**
- Create: features/admin/auth/schema.ts
- Create: features/admin/auth/state.ts
- Create: features/admin/auth/server.ts
- Create: app/admin/(auth)/actions.ts

**Interfaces:**
- schema.ts exports adminLoginSchema, adminRegistrationSchema, AdminLoginInput, and AdminRegistrationInput. Registration requires name, valid email, password of at least 8 characters, and matching confirmation; login requires valid email and a non-empty password.
- state.ts exports AdminAuthFormState as a discriminated union for idle, field-validation errors, user-facing feedback codes, and success with a same-surface destination.
- server.ts exports getAdminRegistrationViewState(), signInPlatformAdmin(input), registerFirstPlatformAdmin(input), retryPlatformAdminClaim(), and signOutPlatformAdmin().
- actions.ts exports loginAdminAction(previousState, formData), registerAdminAction(previousState, formData), retryAdminClaimAction(previousState, formData), and logoutAdminAction(formData).

- [x] Define the Zod schemas and typed form state. Trim name/email and validate password confirmation; do not trim or log passwords.
- [x] Implement getAdminRegistrationViewState() with createSupabaseServerClient("admin"). Use getClaims() to distinguish no session from an existing session; when a session exists, check is_platform_admin() and admin_registration_open() to return open, closed, resume-claim, already-admin, or unavailable.
- [x] Implement signInPlatformAdmin(input): call signInWithPassword, then is_platform_admin(). If the RPC returns false, sign out only the Admin scope and return generic denial. If the role RPC fails, fail closed and return retryable service feedback without redirecting.
- [x] Implement registerFirstPlatformAdmin(input): validate vacancy with admin_registration_open() before Auth signup, call signUp with display_name metadata, require a returned session, then call claim_platform_admin(). On false, sign out the Admin scope and return closed. On a transient RPC error, preserve the session and return retryable feedback.
- [x] Implement retryPlatformAdminClaim(): call the no-argument idempotent claim RPC using the current Admin session. On true, return success; on false, sign out the Admin scope and return closed; on transient error, keep the session and return retryable feedback.
- [x] Keep raw Supabase error text and credential data inside the server boundary. Map known conditions to stable UI feedback codes; use the same public message for invalid credentials and valid credentials without Admin role.
- [x] Implement Server Actions that parse untrusted FormData, return field errors before network calls, delegate to server.ts, and serialize only the typed user-facing state.

**Manual review:** inspect that each Action validates authorization and input server-side; no Service Role key, raw provider message, password, token, or cross-surface cookie is returned or logged.

---

### Task 2: Build the shared auth shell and mount existing feedback UI

**Files:**
- Copy from ../tavvi/apps/web/public/brand/tavvi-lockup-horizontal-gold-on-dark.png to public/brand/
- Copy from ../tavvi/apps/web/public/brand/tavvi-lockup-horizontal-gold-on-light.png to public/brand/
- Modify: app/layout.tsx
- Create: app/admin/(auth)/layout.tsx
- Create: features/admin/auth/components/admin-auth-shell.tsx
- Create: features/admin/auth/components/password-input.tsx

**Interfaces:**
- AdminAuthShell({ children, title, description }) composes brand area, page heading, and form content responsively.
- PasswordInput consumes a field id/name/label/error and composes existing InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton, and icons; it does not edit components/ui.

- [x] Copy only the two approved Tavvi lockup images; do not copy legacy CSS, fonts, or other visual configuration.
- [x] Change html lang from en to pt-BR in app/layout.tsx and mount the existing Toaster inside ThemeProvider. Preserve the current global CSS and theme provider behavior.
- [x] Implement an auth shell in Tailwind using the current shadcn components and semantic tokens. Use the dark/light logo variants with existing theme selectors; keep the form readable and usable on small screens.
- [x] Implement password reveal using an accessible button with an explicit Portuguese aria-label and state; keep the password input's label and validation relation intact.
- [x] Use motion/react for one restrained shell entrance and feedback-state transitions only. Honor reduced motion with MotionConfig reducedMotion="user" or useReducedMotion; do not animate each input.
- [x] Keep app/globals.css and every components/ui file unchanged.

**Manual review:** view light and dark themes at mobile and desktop widths; verify labels, focus, errors, reveal control, and toast are visible and keyboard-accessible.

---

### Task 3: Implement first Admin registration and claim recovery

**Files:**
- Create: app/admin/(auth)/criar-conta/page.tsx
- Create: features/admin/auth/components/admin-registration-form.tsx
- Modify: app/admin/(auth)/actions.ts
- Modify: features/admin/auth/server.ts
- Modify: features/admin/auth/state.ts

**Interfaces:**
- The page renders one of five server-derived states: open form, closed registration, resume-claim action, confirmation that an existing Admin is already created, or unavailable verification with no form.
- AdminRegistrationForm receives only the validated state needed to render and Server Action references; it does not receive secrets or raw Supabase results.

- [x] Read getAdminRegistrationViewState() in the Server Component without caching the result between requests.
- [x] Render the closed state with a link to login when the singleton slot is occupied; never include Admin identity details.
- [x] Render a resume state for an authenticated non-Admin session while registration is still open. Its action retries only claim_platform_admin(), never signup.
- [x] Compose the open form from existing Field, FieldLabel, FieldDescription, FieldError, InputGroup, Button, Spinner, Alert, and PasswordInput components.
- [x] Use useActionState for pending/result states. Validate client-side with the shared Zod schema and repeat validation in registerAdminAction.
- [x] Show field errors inline; show mapped global status in visible page feedback and via the existing toast manager. For success, show a short success toast and navigate to the destination returned by the server.
- [x] Handle vacancy closed between render and submit, duplicate email without account enumeration, Auth rate limiting, missing session due email-confirmation misconfiguration, claim false, and transient claim failure.
- [x] On transient claim failure, preserve the Admin-scoped session and let the user retry. On false claim, sign out that scope and show the closed state.

**Manual review:** verify open/closed/resume states, normal signup, race-loser behavior, and claim retry after a simulated transient RPC failure without a second Auth signup. Do not make the Preview signup page public before the responsible Admin account is claimed.

---

### Task 4: Implement login, protected destination, and route-safe redirects

**Files:**
- Create: app/admin/(auth)/entrar/page.tsx
- Create: features/admin/auth/components/admin-login-form.tsx
- Create: features/admin/auth/navigation.ts
- Create: app/admin/page.tsx
- Modify: app/admin/(auth)/actions.ts
- Modify: proxy.ts

**Interfaces:**
- admin-login-form.tsx exports AdminLoginForm({ nextPath, publicBasePath }).
- navigation.ts exports normalizeAdminNextPath(value, publicBasePath): string | null, which returns a safe surface-relative path, and getAdminPublicBasePath(hostname): "" | "/admin". In Admin context, Admin subdomains use short paths; all other hosts use the /admin prefix.
- The protected app/admin/page.tsx derives identity from the Admin session, verifies is_platform_admin(), and redirects unauthorized users to login.

- [x] Implement the login page as a Server Component with AdminAuthShell. Sanitize next on the server and redirect an already-authenticated Admin to its safe destination.
- [x] Implement AdminLoginForm with useActionState, shared schema validation, InputGroup icons, PasswordInput, pending state, and mapped error feedback.
- [x] On successful login, show a toast and navigate to the validated destination. Use only local paths and preserve /admin in Preview while keeping root paths on Admin subdomains.
- [x] Implement normalizeAdminNextPath() to reject absolute, protocol-relative, backslash, control-character, and cross-surface destinations; strip /admin only when publicBasePath is /admin. Compose the validated relative destination with the detected public base. Fall back to / on Admin subdomains and /admin on Preview.
- [x] Add a minimal protected app/admin/page.tsx with clear Portuguese placeholder content and an Admin-scoped logout form. Do not add invitations, restaurant management, or dashboard features.
- [x] Extend proxy.ts host detection so admin.<domain> rewrites short root paths to internal /admin paths, while preserving admin.localhost rewriting and Preview's existing /admin prefix behavior. Do not rewrite public or Painel hosts.
- [x] Confirm Admin login and logout read/write only tavvi-admin-auth-token. Do not use a browser/localStorage token or make Proxy the authorization boundary.

**Manual review:** local `admin.localhost` short routes and path-prefixed Admin route were opened in the browser. Preview-prefixed routes, production-host rewrite logic, redirect cases, and non-Admin authorization still need manual validation.

---

### Task 5: Verify the integrated local flow

**Files:**
- Review: app/admin/(auth)/*
- Review: features/admin/auth/*
- Review: app/layout.tsx, app/admin/page.tsx, proxy.ts, __BASE.MD

- [x] Confirm `supabase/migrations/20261029000000_platform_admin_identity.sql` is present and applied in the local Supabase project. No remote migration was applied.
- [ ] Manually walk through first signup, login, closed registration, non-Admin login denial, logout, and retry after a transient claim failure. Signup was intentionally not submitted so the user can create the initial Admin account themselves. Local route rendering was checked without submitting the form.
- [x] Inspect that Auth errors are mapped to Portuguese messages without leaking provider text, and that form feedback is not toast-only.
- [x] Run pnpm typecheck and pnpm build after implementation; both were authorized for tavvi-app. Do not run tests or lint.
- [x] Review the diff statically for component/CSS edits, service keys, unsafe redirects, missing server-side validation, and accidental Panel-cookie access.

---

## Handoff

Tasks 1 and 2 establish the typed contract and shared shell. Tasks 3 and 4 build the two flows against that contract. Task 5 verifies them locally. Create no page-level CSS and no extra form/icon dependency.
