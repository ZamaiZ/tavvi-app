# SDD ledger — plan: docs/superpowers/plans/2026-11-09-cardapio.md

Spec: `docs/superpowers/specs/2026-11-09-cardapio-design.md`; builder check: “nothing important left”.

Ruling: implement in the authorized checkout — Git is explicitly forbidden by the project instructions, so an isolated Git worktree cannot be created; cost if wrong: changes are not isolated from unrelated uncommitted work.

Ruling: use `@dnd-kit/*` and `mediabunny` — the app does not include a DnD package or the legacy media preparation dependency; these match the existing product behavior and interaction requirements; cost if wrong: additional bundle/dependency weight.

Pre-flight: schema → DAL/actions → workspace → DnD → batch → public renderer. The DTO boundary and RPC names are defined by the plan; no shared-interface mismatch found in the plan/spec review.

Static-review constraint: do not run `git`, tests, `typecheck`, `build`, or `lint`.

Task 1: complete (static SQL review of `supabase/migrations/20261109050000_menu_domain.sql`; no database migration execution permitted/needed in this source-only phase). The migration separates menu state, scopes member access, uses per-restaurant locks for content invariants, blocks non-empty category deletion, preserves availability separately, and returns removed storage paths for cleanup.

Task 2: complete. Added typed DTOs/schemas, authenticated read/write boundaries, upload preparation/compression and short-lived media tickets. `save_menu_batch` is in `supabase/migrations/20261109060000_menu_batch.sql`.

Task 3: complete. `/painel/cardapio` now uses the responsive workspace, desktop Index/list/grid, grouped mobile list, editing/actions, filters, publication state, and category creation defaults. The new-item-from-category action carries the selected category through the editor. Public profile URL construction respects both supported panel base URL layouts.

Task 4: complete. Quadro supports accessible category/item reordering, same-category item drag, per-item category combobox, media thumbnails, rollback feedback, and reduced-motion behavior.

Task 5: complete. Full-screen batch authoring supports multiple categories/items, essential fields, media, row validation, bounded uploads, IndexedDB draft recovery and partial-upload cleanup. Draft deletion occurs only after a completed database commit or explicit discard.

Task 6: complete. Public presentation is integrated in the existing profile shell, with a separate published-only DTO/read path, public presentation modes, guarded media routes, and every eligible item's linked media. `supabase/migrations/20261109070000_public_menu.sql` adds the public RPC/policy boundary.

Task 7: complete by static review. Added responsive loading/error surfaces, sequenced workspace/public transitions, and reduced-motion handling. The initial skeleton is Index-like on desktop and grouped-list on mobile; the batch screen represents restore/upload progress within its own flow.

Independent review found a concurrent duplicate-batch race: ID existence checks occurred before the restaurant transaction lock. The check now runs after that lock in `20261109060000_menu_batch.sql`, so a competing save sees the committed IDs. Follow-up review confirmed the ordering addresses the finding.

Final verification boundary: source and SQL were reviewed statically. No database migration, browser/runtime session, tests, typecheck, build, lint, or Git command was run, per the project instructions.

Migration correction: PostgreSQL derived `menu_items_price_mode_check` from the inline `price_mode` check, and `menu_item_attributes_qualifier_check` from the inline `qualifier` check; each collided with a separately declared constraint using that name. Renamed the explicit checks to `menu_items_pricing_configuration_check` and `menu_item_attributes_qualifier_kind_check`, preserving both allowed-value and cross-field validation. Made the earlier `menu_status` column addition `IF NOT EXISTS` so a SQL-editor run that committed that statement before failing can be retried. Reviewed all other inline and explicit check names in this migration for the same collision pattern.

UI refinement: corrected the batch dialog's inherited center transform so its full-screen panel anchors to all four viewport edges; standardized menu pickers on the shared icon Combobox, added leading icons to editable fields, and applied the same BRL price mask to batch and single-item/variant editors. Added the desktop `Ctrl+I`/`Meta+I` Index toggle, guarded outside form fields and dialogs.
