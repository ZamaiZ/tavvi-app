# SDD ledger — plan: docs/superpowers/plans/2026-11-05-panel-brand-media.md

- Ruling: implement in the current workspace without a worktree — `AGENTS.md` explicitly prohibits Git commands.
- Ruling: use static review instead of TDD/tests — `AGENTS.md` explicitly prohibits tests and check commands.
- Evidence: current client upload happens inside `uploadImage()` on selection; Storage INSERT policy requires bucket/path match, authenticated actor, active membership, and `draft` status.
- Decision: multipart Route Handler, not Server Action payloads, because local Next 16 docs set Server Action body default to 1 MB while uploads are allowed up to 5 MB.
- Task 1: complete — helper validates canonical object paths, actor membership and draft/active lifecycle; authenticated execution only.
- Task 2: complete — guarded multipart endpoint delegates to shared authenticated persistence; partial uploads are compensated and prior paths are removed only after RPC success.
- Task 3: complete — selection is local Blob state, saves are debounced/serialized, and failures retain the preview and file for retry.
- Task 4: complete — drag/drop, keyboard access, per-slot status, sequential entrance motion, and reduced-motion behavior are present.
- Task 5: complete — static review confirms Storage upload exists only in the server persistence service and database RPCs still validate restaurant-specific paths.
- Verification: static source and migration review only; no tests or prohibited checks were run, per project instructions.
- Follow-up root cause: the Storage helper declared local `restaurant_id`, which conflicts with `memberships.restaurant_id` in its SQL query and causes PL/pgSQL ambiguity (surfaced as Storage HTTP 500). Added forward migration `20261105050000_panel_brand_storage_policy_ambiguity_fix.sql`, renaming only the local variable to `v_restaurant_id`; the existing policy signature and grants remain unchanged.
