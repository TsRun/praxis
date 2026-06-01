# Audit run — 2026-06-01T21:14:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-tactic-set-dialog
**Result:** IMPROVED+PENDING (PR opened, verification to run)

Ran the audit spec for the New tactical set dialog on prod. Functional state was clean — no console/page errors, dialog opens, Create button correctly disabled/enabled by name presence, tab order Cancel → Create set → Close, focus styles visible (2px amber outline + box-shadow ring), mobile dialog 345px wide centered in a 375px viewport with no horizontal overflow.

a11y observation: the name input had `aria-describedby={err ? 'tactic-set-name-error' : undefined}`, so the helpful explanatory text "You'll author the puzzles by hand on the next screen — paste a FEN and play the solution moves on the board." was visually present but never announced by screen readers — `ariaDescribedby` was `null` whenever the input was focused without an error. Sighted users get the context, screen reader users do not.

Fix: gave the helper `<p>` an id (`tactic-set-name-help`) and wired the input's `aria-describedby` to include it unconditionally, appending the error id only when an error is set. One file, ~7 LOC. Typecheck + 48 unit tests pass.
