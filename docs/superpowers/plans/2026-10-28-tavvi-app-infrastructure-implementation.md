# Tavvi-app Infrastructure Implementation Plan

Use the superpowers:executing-plans workflow to complete this plan task by task. Do not add or run tests. The user authorized Git, typecheck, and build commands in this workspace; use static review plus those authorized checks.

**Goal:** Configure the existing Tavvi-app repository on its preview branch, local Supabase development environment, and Vercel Preview/demo path while leaving Production unprovisioned and without a master branch.

**Architecture:** Use the existing private GitHub repository and its active preview branch; when Production work begins, create master then. Use a single generated Preview hostname with /admin and /painel prefixes and the public /{slug} root.

**Tech Stack:** Next.js 16.4.2, React 19, Tailwind CSS 4, shadcn preset base-mira, pnpm, Supabase CLI, @supabase/ssr, @supabase/supabase-js, Vercel.

**Spec:** docs/superpowers/specs/2026-10-28-tavvi-app-infrastructure-design.md

## Global Constraints

- Preserve tavvi-app as a standalone Next.js 16.4.2 / React 19 project with app/ at the repository root.
- Use the existing shadcn/Tailwind preset; add no custom CSS files or page-specific CSS rules.
- Use local Supabase via Docker for development and the empty São Paulo Supabase project only for Preview/demo.
The existing preview branch is the demo branch. Do not create master now; create it only when Production is provisioned. If Vercel accepts a custom, not-yet-existing Production Branch name, configure master; otherwise defer the Git integration deployment.
- Preview Supabase variables apply only to preview; do not create general Preview variables that grant database access to PR branches.
- Keep Production Supabase variables, a production Supabase project, production domain, and product traffic out of this phase.
- Keep Admin/Painel Auth cookies separate, named tavvi-admin-auth-token and tavvi-panel-auth-token; do not store Auth tokens in localStorage or force Supabase SSR cookies to HttpOnly.
- Use only the Supabase publishable key and project URL in the app; do not add service_role, APP_SERVER_KEY, VAPID secrets, Express, or Web Push.
- Local hosts are localhost:3000, admin.localhost:3000, and painel.localhost:3000; Preview uses one Vercel hostname with /admin, /painel, and public /{slug} paths.
- Set Vercel Function region to gru1 while Preview and future Production Supabase primaries are in São Paulo.
Do not add or run tests. Git, typecheck, and build are authorized by the user; do not run lint in this phase.

## Review Focus

- First Vercel import can create a Production deployment from the repository’s default branch; treat it as an infrastructure placeholder and do not share its generated URL.
- Branch-specific Preview variables must attach to preview only; PR branches must have no Supabase connection variables.
- The empty remote demo project must remain without schema migrations or production data during this phase.
- Supabase environment parsing must be lazy enough that a PR Preview without Supabase variables does not fail just by importing app modules or building.
- Host/path routing must preserve query strings and avoid rewriting Next assets or applying /admin or /painel twice.
- Local Auth redirect allowlists must support the three local hosts without broad wildcards that are copied to hosted production.

## Scope and External Setup

The existing private GitHub repository is https://github.com/ZamaiZ/tavvi-app.git; no repository creation is needed.
- Create/publish the local repository through an approved graphical client or provider UI. Do not run Git CLI commands under the current repository instructions.
- The initial Vercel import may treat preview as Production because it is the repository default; immediately select custom Production Branch master if Vercel permits the branch name while it does not exist. If not, defer the Git integration rather than creating master or treating preview as Production.
- Configure All Deployments protection. If the Preview branch will be shown to people outside the Vercel team, add a public exception only for its stable branch alias; keep the Production placeholder and other previews protected.
- No feature routes, pages, business tables, initial Admin bootstrap, production project, or production secrets are implemented here.

## File and Responsibility Map

All code/configuration files below are under C:\Users\Eduardo Zamai\Documents\tavvi-app. Provider-specific setup is completed in GitHub and Vercel dashboards; it is not represented by app source files.

- .nvmrc: pin Node 22 for local consistency.
- package.json: declare the supported Node range and exact pnpm package manager; add the Supabase CLI and SSR/client packages.
- pnpm-lock.yaml: resolve the pinned toolchain and dependencies; preserve the current workspace lockfile format.
- pnpm-workspace.yaml: retain existing settings, including allowBuilds; do not convert the standalone project into a monorepo.
- .gitignore: ignore .env* except .env.example, Vercel local state, and Supabase local temporary state.
- .env.example: list only public configuration names with fake/local placeholders.
- README.md: document prerequisites, local startup/stop/status commands, and environment separation.
- supabase/config.toml: local Supabase services, Auth email confirmation setting, local redirect allowlist, and project identifier.
lib/supabase/config.ts: lazily validate the public Supabase URL/key and define cookie names shared by server and browser.
- lib/supabase/server.ts: create a per-request SSR Supabase client using request cookies.
- lib/supabase/browser.ts: create a browser Supabase client only for authenticated Admin/Painel surfaces when a feature needs it.
- lib/supabase/proxy.ts: adapt Supabase cookie refresh to Next Proxy without exposing server credentials.
- proxy.ts: host/path dispatch and minimal session refresh; no database fetch or full authorization policy.
- vercel.json: pin Functions to gru1 and retain the Vercel schema reference.
- next.config.ts: only development host allowances or settings proven necessary by the installed Next 16.4.2 documentation; do not add unrelated configuration.

## Tasks

### Task 1: Use the existing repository and preview branch

**Files:**
- No application file changes; use the existing remote and branch.

**Interfaces:**
- Consumes: the existing standalone tavvi-app boilerplate directory.
- Produces: the existing GitHub remote configured, preview as the active branch, and master absent until Production work begins.

- [x] Confirm the existing private GitHub repository ZamaiZ/tavvi-app and origin URL.
- [x] Preserve the existing local repository and boilerplate; no new repository initialization is needed.
- [x] Keep the local working branch on preview; do not create master.
- [ ] Publish the completed setup to the remote preview branch after local review.
- [ ] Confirm remote visibility and that only the intended preview branch is published; master must remain absent.

### Task 2: Pin the local toolchain and protect environment files

**Files:**
- Modify: tavvi-app/package.json
- Create: tavvi-app/.nvmrc
- Modify: tavvi-app/.gitignore
- Create: tavvi-app/.env.example
- Modify: tavvi-app/README.md
- Preserve: tavvi-app/pnpm-workspace.yaml

**Interfaces:**
- Consumes: Task 1’s private repository and existing pnpm boilerplate.
- Produces: a reproducible Node/pnpm baseline and a documented, non-secret environment template.

- [ ] Pin Node 22 in .nvmrc; set engines.node to the supported Node 22 range and packageManager to the installed and agreed pnpm@10.34.5.
- [ ] Update .gitignore so .env* remains ignored except .env.example; ignore .vercel/ and Supabase CLI local state such as supabase/.temp/.
- [ ] Add .env.example with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY using local-only sample values; do not place real keys there.
- [ ] Keep the existing pnpm-workspace.yaml allowBuilds configuration and standalone package structure intact.
- [ ] Document Docker Desktop, the pinned Node/pnpm versions, and the local Supabase command sequence in README.md without documenting or storing any remote secret.
- [ ] Review the changed environment ignore rules and example file contents statically; confirm no value from either Supabase project is copied into source.

### Task 3: Add Supabase packages and configure local Supabase

**Files:**
- Modify: tavvi-app/package.json
- Modify: tavvi-app/pnpm-lock.yaml
- Create: tavvi-app/supabase/config.toml
- Modify: tavvi-app/.env.example
- Modify: tavvi-app/README.md

**Interfaces:**
- Consumes: Task 2’s pinned package manager and environment-file policy.
- Produces: a project-scoped Supabase CLI and a local Docker-based Supabase configuration; no domain schema yet.

- [ ] Add supabase as a pinned development dependency and add @supabase/ssr plus @supabase/supabase-js as application dependencies using pnpm; preserve lockfile format and existing build-approval settings.
- [ ] Create supabase/config.toml with the new local project ID, local Auth enabled, email confirmation disabled, and explicit redirects for http://localhost:3000/**, http://admin.localhost:3000/**, and http://painel.localhost:3000/**.
- [ ] Match the local database major version to the empty São Paulo project’s current Postgres major after reading it from Supabase Dashboard; do not inherit the Oregon legacy project’s configuration by assumption.
- [ ] Keep supabase/migrations/ empty until the first approved domain schema. Do not add an empty seed, baseline schema, bootstrap Admin, or legacy SQL.
- [ ] Document how a developer copies local URL and publishable key values from pnpm supabase status into the ignored .env.local; keep the remote project unlinked from the local CLI in this phase.
- [ ] Record in the README that local Supabase is development-only and Docker-backed, with no exposure to external traffic.

### Task 4: Create environment validation and Supabase client boundaries

**Files:**
Create: tavvi-app/lib/supabase/config.ts
- Create: tavvi-app/lib/supabase/server.ts
- Create: tavvi-app/lib/supabase/browser.ts
- Create: tavvi-app/lib/supabase/proxy.ts

**Interfaces:**
- Consumes: Task 3’s environment names and Supabase dependencies.
- Produces: request-scoped SSR and browser client factories with explicit Admin/Painel cookie namespaces.

- [ ] Define a lazy getSupabasePublicEnv() accessor that validates NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY only when a client is requested; keep missing variables from breaking module import in unrelated Preview branches.
- [ ] Implement createSupabaseServerClient(scope: 'admin' | 'panel') using the request cookie store and no shared/global client instance.
- [ ] Set distinct names tavvi-admin-auth-token and tavvi-panel-auth-token for both server and browser clients, with host-only scope; do not set Domain, do not copy tokens to localStorage, and do not force Supabase session cookies to HttpOnly.
- [ ] Add createSupabaseBrowserClient(scope) only for future authenticated surfaces; public menu/request paths must not instantiate a signed-in client.
- [ ] Add a Proxy-specific SSR adapter for propagating refreshed cookies. Keep it free of service-role credentials and domain authorization logic.
- [ ] Mark server-only modules with server-only where they can access request/session state; keep all public browser configuration limited to the publishable key and URL.

### Task 5: Add host/path routing and Vercel region config

**Files:**
- Create: tavvi-app/proxy.ts
- Modify: tavvi-app/next.config.ts
- Create: tavvi-app/vercel.json

**Interfaces:**
- Consumes: Task 4’s Proxy cookie adapter and the agreed local/Preview/Production host mapping.
- Produces: one deterministic surface-routing boundary without product pages or domain authorization.

- [ ] Map admin.localhost:3000 to the internal /admin surface, painel.localhost:3000 to /painel, and leave localhost:3000 on the public root.
- [ ] On the generated Vercel host, preserve /admin, /painel, and public /{slug} as path-based surfaces; reserve the /admin and /painel slugs from the public restaurant namespace.
- [ ] Prepare Production host matching for Admin and Painel subdomains when the domain exists; reject or safely fall back on unknown hosts instead of trusting arbitrary forwarded host values.
- [ ] Preserve query parameters and route suffixes during rewrites; exclude Next static assets and public assets from surface rewriting.
- [ ] Let Proxy perform host/path rewriting and minimal Supabase session refresh only. Do not fetch restaurant/domain data or treat Proxy as the authorization boundary; future Server Actions and DAL/RLS must authorize their own operations.
- [ ] Add vercel.json with the Vercel schema reference and regions: ["gru1"].
- [ ] Modify next.config.ts only if the installed Next 16.4.2 documentation requires an explicit allowedDevOrigins or related development setting for the two *.localhost aliases; avoid unsupported legacy Middleware configuration.

### Task 6: Create and configure the Vercel project from the existing repository

**Files:**
- No application file changes beyond Task 5; complete project settings in the Vercel dashboard.

**Interfaces:**
- Consumes: Task 1’s private repository and Task 5’s versioned route/region configuration.
- Produces: one Vercel project connected to the repository with explicit branch/environment mapping.

- [ ] Connect the Vercel Git integration to the private repository; grant repository-only access if the provider UI offers that choice.
- [ ] Set the root directory to the repository root and framework to Next.js; preserve default Next build/output settings.
- [ ] Set master as the custom Production Branch only if Vercel accepts it while the branch is absent; otherwise defer Git-connected deployment until Production work begins. Do not create master now or treat preview as Production.
- [ ] Set the project’s Function Region to São Paulo (gru1) and keep one compute region while the database has one primary region.
- [ ] Treat any Production deployment created during initial import as an empty infrastructure placeholder; do not share its generated URL, attach a domain, or set Production Supabase variables.
- [ ] Enable Vercel Authentication with All Deployments protection so the automatically generated Production placeholder is not publicly reachable.
- [ ] Do not add a custom domain. Use the branch-specific generated Vercel URL for preview; paths are /admin, /painel, and /{slug}.
- [ ] Configure no general Preview Supabase variables. Add the two public Supabase variables only as branch-specific Preview variables for preview.
- [ ] Keep the Preview branch demo link as the only URL used for full-stack demonstration; PR previews have no Supabase connection and database-dependent flows remain unavailable there.

### Task 7: Connect the Preview branch to the empty São Paulo project

**Files:**
- No application file changes; configure Supabase Dashboard and Vercel branch environment settings.

**Interfaces:**
- Consumes: Task 6’s branch preview deployment hostname and the existing empty remote Supabase project in São Paulo.
- Produces: an isolated Preview/demo connection using only the public Supabase project URL and publishable key.

- [ ] Confirm the selected Supabase project identifier and region in its dashboard before copying values.
- [ ] Disable hosted email confirmation for this demo project to match the product decision; keep invite redemption as the future application-level gate to restaurant access.
- [ ] Set Supabase Auth Site URL to the stable generated preview branch hostname and allow only required callback URLs for that hostname; do not permit arbitrary deployment URLs or broad production wildcards.
- [ ] If the Preview branch is intended for external demonstration, add one Deployment Protection exception for its stable branch alias only; do not exempt the project’s default Production URL or PR Preview URLs.
- [ ] Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as Vercel Preview variables scoped only to the preview Git branch.
- [ ] Leave the remote schema empty; do not run migrations, seed, bootstrap an Admin, or link the project to an automatic deploy action.
- [ ] Confirm in Vercel settings that the values are branch-scoped and that Production environment values remain absent.

### Task 8: Document the operator workflow and perform static review

**Files:**
- Modify: tavvi-app/README.md
Review: .gitignore, .env.example, package.json, pnpm-lock.yaml, supabase/config.toml, lib/supabase/config.ts

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: one concise source-of-truth for local startup and Preview/Production separation, plus a static configuration review record.

- [ ] Document local startup (pnpm install, pnpm supabase start, copy local URL/key to .env.local, then pnpm dev), shutdown/status commands, and the three local URLs.
- [ ] Document that Vercel deploys preview as Preview and only this branch receives demo Supabase variables; master is created later with the Production environment.
- [ ] Inspect tracked example/config files for real keys, legacy connection strings, Oregon references, Web Push secrets, and Production Supabase values.
- [ ] Inspect route rules for one-pass rewrites and asset exclusions; inspect cookie names/options for cross-surface separation.
- [ ] Record which dashboard choices could not be verified without access to the user’s GitHub/Vercel/Supabase accounts.
- [ ] Do not add or run tests. Run the user-authorized pnpm typecheck and pnpm build when the implementation is complete; do not run lint.

## Manual Completion Criteria

- The existing private repository is on branch preview
- The app has a pinned Node/pnpm toolchain and an ignored local environment file template.
- Supabase CLI is project-scoped; local Auth is configured without email confirmation and recognizes the three local hosts.
- The São Paulo Preview project remains empty
- Vercel has one project, configures preview for demo Preview and runs Functions in gru1; Production branch master is created only in the future Production step.
- Vercel Authentication protects deployments until external demo access is explicitly configured; an exception may be limited to the stable preview alias.
- Local routing uses subdomains; Preview uses path prefixes on its generated hostname; future Production can use subdomains under a domain acquired later.
- No product pages, domain tables, Admin bootstrap, Express service, Web Push, or APP_SERVER_KEY are added.
- Static review finds no secrets and confirms that Proxy is not treated as the data authorization boundary.

## Sources

- Vercel Git deployments and Production/Preview branch configuration: https://vercel.com/docs/git
- Branch-specific Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Function regions and gru1: https://vercel.com/docs/functions/configuring-functions/region
- Vercel Deployment Protection and exceptions: https://vercel.com/docs/deployment-protection
- All-deployment protection on Hobby: https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan
- Supabase CLI project dependency and local stack: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase local Auth configuration: https://supabase.com/docs/guides/local-development/cli/config
- Supabase redirect URL allowlist: https://supabase.com/docs/guides/auth/redirect-urls
