# SDD ledger — plan: docs/superpowers/plans/2026-11-05-panel-onboarding.md

- Pre-flight: Task 1 schemas/RPCs feed Tasks 2, 3, and 4; Task 2 auth consumes Task 1 DTOs and feeds Task 3; Task 3 active-cookie guard feeds Tasks 4, 5, and 6; Task 5 invite acceptance sets context for Task 4; Task 6 consumes Task 3 guards.
- Ruling: use short Panel routes and `active_restaurant_id` cookie instead of restaurant IDs in paths — `__BASE.MD` explicitly sets this architecture — cost if wrong: routing and context handling would need redesign.
- Ruling: provide a restaurant chooser only when a user has multiple memberships — `__BASE.MD` supports multiple restaurants and an explicit active-context selection — cost if wrong: one extra selection screen for multi-restaurant accounts.
- Ruling: no TDD, tests, Git, build, lint, or typecheck workflows — project `AGENTS.md` explicitly prohibits them — validation is limited to static review.
- Task 1: complete — additive profile columns, value constraints, server RPCs, typed client schemas; static review confirmed the DB rejects unauthenticated users, non-members, non-draft autosaves, malformed profile data and client attempts to set status.
- Task 2: complete — separate Panel credential auth/cookie, shared Admin login shell, invite-only informational page and explicit auth isolation.
- Task 3: complete — host rewrites, validated active-restaurant cookie, RLS-scoped reads, status routing and explicit chooser for multiple memberships.
- Task 4: complete — two-step animated identity/contact wizard, 2.5-second draft autosave serialized to prevent out-of-order snapshots, protected brand uploads/previews, and atomic activation. Static review only.
- Task 5: complete — invite acceptance sets the server-side active restaurant cookie and routes directly to the correct panel destination without another login.
- Task 6: complete — active users reach the empty Cardápio template, drafts return to their saved wizard step, and suspended restaurants receive a guarded unavailable state. No public `/{slug}` page was added.
- Task 7: complete — reviewed invite, login, restaurant chooser, draft, activation, active and suspended routes, and persistence fields by source inspection. Automated checks were not run per `AGENTS.md`.