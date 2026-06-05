# Audit run — 2026-06-05T00:15:17Z
**Mode:** TEST_ONE
**Subject:** trainer-new-game-study-dialog
**Result:** IMPROVED+PENDING+merge-after-verification

Exercised the "New game study" dialog from /trainer/studies on prod at both
1280x800 and 375x812. No console errors, no page errors, the form's empty-state
disabled-submit and the close button's `aria-label="Close"` are both correct,
and the dialog fits the 375 viewport (345x454 in a 375x812 frame). A11y micro
checks pass: both fields are wrapped in a `<label>`, the Cancel/Import buttons
expose their accessible names. The only thing the dialog lacks is any explanation
of what PGN is or where to copy one from — the field is just labelled "PGN" with a
formatted placeholder. Users who haven't met the term before have no affordance
beyond guessing. The sister NewOpeningStudyDialog already uses a `.meta`
paragraph for context when an import flow is in play, so the codebase has
precedent for that pattern.

Added a one-line `.meta` intro under the dialog title: "Paste a PGN to import
the moves of a single game — copy it from chess.com, Lichess, or any other
source." Same visual weight as the existing meta hints, no layout shift on
mobile, no new strings beyond this introduction. Typecheck + unit tests
(48/48) pass on the branch. PR opens for self-verification before squash-merge.
