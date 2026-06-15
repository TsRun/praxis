# Audit run — 2026-06-15T15:08:00Z
**Mode:** TEST_ONE
**Subject:** trainer-tactic-set-editor
**Result:** IMPROVED+PENDING+awaiting-deploy

Exercised the trainer tactic set editor at `/trainer/studies/tactic/<id>`. The page renders title, breadcrumb chip, header actions (Studies back, Delete set, Assign to student, Add puzzle) and the empty-state callout. Three observable a11y issues were captured:

1. The empty-state callout wraps its entire region — including the "Add puzzle" call-to-action button — in `role="status" aria-live="polite"`. Putting an interactive control inside a live region causes screen readers to re-announce the button label on every render, masking the actual status update.
2. When the set contains puzzles, the puzzle rows render as plain `<div>` cards with no list semantics (no `role="list"`/`role="listitem"`), so SR users can't navigate them as a list.
3. The per-row delete button is icon-only (`IconTrash`) with only a `title` attribute as its accessible name. `title` is unreliable across assistive tech — `aria-label` is needed.

Fix scopes `role="status"` to the "No puzzles yet" message only, wraps the populated puzzle list in `role="list" aria-label="Puzzles in this set"` with each row as `role="listitem"`, and adds `aria-label="Delete puzzle N"` plus `aria-label="Edit puzzle N"` for screen readers. Diff: 1 source file (~12 LOC). Typecheck + 48/48 unit tests pass locally. PR opened against main for review; the audit spec also asserts list semantics and the per-row aria-label and will validate the fix on prod after deploy.
