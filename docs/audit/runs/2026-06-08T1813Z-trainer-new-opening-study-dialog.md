# Audit run — 2026-06-08T18:13:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-opening-study-dialog
**Result:** IMPROVED+PENDING

Ran the audit spec against prod. Login → New study → Opening study opens the dialog cleanly; name input is wrapped in a `<label>Study name</label>`, the side picker is a proper `role=radiogroup` with two radios labelled "Which side does the student play?", `aria-label='Close'` is set on the dialog close button, and form validation gates the Create button on a non-empty name. Keyboard tabbing from the name input lands on the W radio with `:focus-visible` matching, and the wrapping `.role-pick` label picks up the outline via the existing `:has(input:focus-visible)` rule. No page errors, no app console errors, no `Failed to load resource:` noise. Mobile 375×812 layout fits within the viewport (dialog 345w, board scales).

UI weakness observed: the **unpicked** side-option card has an effectively invisible boundary — `border: 1px solid var(--inset-border)` resolves to `rgba(255,255,255,0.04)`, well below what's needed to read as a tap target at rest. The picked state pops via the accent ring, but at rest the two cards visually blur into the dialog surface. Smallest fix: bump the unpicked border to `var(--hairline-2)` (`rgba(255,255,255,0.10)`), still subtle but actually visible. One-line change in `NewOpeningStudyDialog.tsx`. Typecheck + 48 unit tests pass. Self-verification will run on the PR branch.
