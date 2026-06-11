# Audit run — 2026-06-11T06:07:04Z
**Mode:** TEST_ONE
**Subject:** trainer-opening-study-editor
**Result:** IMPROVED+PENDING+pr-open

Exercised the trainer opening-study editor on prod. Playwright spec passed (1/1, no page errors, no app console errors, no mobile overflow at 375×812). Observation worth fixing: the "Set opening prefix…" trigger that appears when a study has no opening prefix yet was rendered grey (`color: rgb(160, 160, 168)` = `var(--text-dim)`), but it carried `className="link"` whose CSS sets `color: var(--accent)`. An inline `color` override in `OpeningStudyEditor.tsx` was defeating the link styling, so the call-to-action did not look like a link — and was visually inconsistent with the sibling "Edit prefix" button shown when a prefix exists, which is correctly amber.

Fix: dropped the inline `color: 'var(--text-dim)'` override from the "Set opening prefix…" button so the `.link` class takes effect, giving it the amber accent color matching the existing "Edit prefix" affordance. One-line change, typecheck and `npm test` both pass (48/48).
