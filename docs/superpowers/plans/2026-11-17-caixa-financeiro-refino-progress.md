# SDD ledger — plan: docs/superpowers/plans/2026-11-17-caixa-financeiro-refino.md

User requested implementation in the current session. The documented design was approved. The normal SDD workspace script/worktree is unavailable because `AGENTS.md` forbids Git commands; tracking this execution here instead. Tests, lint, build, typecheck, and Git commands are forbidden and will not be run.

Pre-flight: the plan tasks share interfaces: Task 1 publishes tip/report RPCs consumed by Tasks 2–5; Task 2 publishes `PanelTipPolicy` consumed by Tasks 3–4; Task 3 publishes pending/closed command DTOs consumed by Task 4; Task 1 publishes overview/details report contracts consumed by Task 5.

Ruling: keep implementation in the current workspace — Git/worktree commands are explicitly forbidden and the user authorized this workspace. Cost if wrong: changes are immediately visible in the shared checkout and lack worktree isolation.

Ruling: allocate partial payments to the consumption subtotal first, then to accepted gratuity — this yields a deterministic tip-received amount per payment and keeps date-based reporting tied to actual payment rows. Cost if wrong: a restaurant expecting proportional allocation would see gratuity recognized later across partial payments.

## Execution complete

- Task 1: added restaurant tip-policy persistence, audited per-comanda decisions, atomic payment attribution, summary RPCs, and force-close audit updates. Revoked the old payment/close RPCs so they cannot bypass the new tip lifecycle.
- Task 2: added disabled, percentage, and fixed tip modes to financial settings with exact cent/basis-point parsing.
- Task 3: split consumption closure from settlement, added accept/decline and pending-tip resolution, and retained idempotent retries.
- Task 4: reduced Caixa to a compact session strip, three summary metrics, and comanda cards; catalog, movement rows, and individual details load only when requested.
- Task 5: made Financeiro start with date-range totals and a trend; detailed breakdowns load on disclosure, while physical cash controls live in the Financeiro cash view.
- Task 6: updated the product base and superseded/historical specs, then reviewed the changed database, DTO, action, and page flows statically.

Static review covered disabled/accepted/declined tips, partial settlement, zero-balance closure, force-close transport, stale retries, and route-level deferred reads. No test, lint, build, typecheck, or Git command was run, per `AGENTS.md`.
