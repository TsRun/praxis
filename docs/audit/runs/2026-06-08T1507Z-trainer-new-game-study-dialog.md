# Audit run — 2026-06-08T15:07:43Z
**Mode:** TEST_ONE
**Subject:** trainer-new-game-study-dialog
**Result:** IMPROVED+PENDING

Picked feature with oldest lastTestedAt (2026-06-05T00:15:17Z). Ran the audit
spec against prod: navigation, login, opening the dialog from the studies
page all worked, and a11y/UI checks captured the close button label, label
wrapping of inputs/textarea, focus styles, and mobile fit at 375x812
(dialog box 345 wide centred at x=7.5 — comfortably inside the viewport).
No uncaught page errors, no app console errors.

Real finding: when form validation fails (empty name/PGN, submitted via
Enter while the Import button is disabled), the resulting error message
renders as a plain `<span>` with no live-region semantics. Screen-reader
users won't hear the error announced. Fix: add `role="alert"` to the
error span in `src/trainer/NewGameStudyDialog.tsx`. One-line a11y bump,
typecheck + unit tests pass.
