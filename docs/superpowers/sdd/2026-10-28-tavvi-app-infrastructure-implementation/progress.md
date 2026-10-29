# SDD ledger — plan: docs/superpowers/plans/2026-10-28-tavvi-app-infrastructure-implementation.md

Pre-flight: package.json and Supabase dependency setup existed before this implementation turn; retain them and extend the existing working tree.
Ruling: keep the existing repository on preview and leave master absent until Production setup — the user explicitly decided master should not exist now — cost if wrong: Vercel Production Branch configuration may need to wait if Vercel requires an existing branch.
Ruling: do not add or run tests — this project instruction and the user’s preference prohibit tests — cost if wrong: behavior checks rely on static review, typecheck, and build only.
Docker: pnpm supabase start completed successfully after initial image downloads; local Supabase services started with Postgres 17. The generated seed setting referenced a missing seed.sql and will be disabled.