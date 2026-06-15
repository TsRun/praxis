# Audit run — 2026-06-15T06:07:18Z
**Mode:** TEST_ONE
**Subject:** trainer-game-study-editor
**Result:** IMPROVED+PENDING+PR

Re-tested `/trainer/studies/game/:id` after login. The editor rendered correctly, the move list buttons worked, the annotation textarea had a visible focus outline and an `aria-label`, the Quiz checkbox was wrapped in a `<label>`, and no console/page errors fired (desktop + 375x812 mobile pass — no horizontal overflow).

The remaining UI/a11y gaps observed in this run were small but real: (1) the move list rendered as plain divs with no list semantics, so screen-reader users had no way to perceive the structure or count of plies; (2) the active ply button only signalled its selected state visually via a `.current` class — `aria-current` was not exposed; (3) the "Save annotations" button gave no busy hint to AT while saving; (4) the "saved <time>" confirmation appeared silently with no live region, so SR users would not hear it announced. Applied a small a11y patch in `src/trainer/GameStudyEditor.tsx`: `role="list"` + `aria-label="Move list"` on the rows container, `role="listitem"` on each row, `aria-current="true"` on the active ply button, `aria-busy` on the Save button, and `role="status" aria-live="polite"` on the saved-at confirmation. Typecheck + 48-test unit suite + audit Playwright spec all pass on the PR branch.
