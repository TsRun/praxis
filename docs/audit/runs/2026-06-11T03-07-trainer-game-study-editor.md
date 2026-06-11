# Audit run — 2026-06-11T03:07:39Z
**Mode:** TEST_ONE
**Subject:** trainer-game-study-editor
**Result:** IMPROVED+PENDING+verification-check

Exercised the trainer game-study editor at `/trainer/studies/game/7` on prod with the bot account. The
editor itself renders cleanly: chess board, move list, "Annotation at ply N" panel, "Save annotations"
and "Assign to student" header buttons. No page errors, no app-level console errors. Mobile pass at
375×812 had no horizontal overflow (scrollWidth 360 ≤ clientWidth 375). Focus indicator on the
annotation textarea and the per-ply buttons works (global gold outline). Quiz checkbox is wrapped in
a `<label>` and properly labelled.

Observed UI quality issue: the per-ply move buttons in the Move list have **no hover feedback** at
all. The probe (`hover` then read computed background) returned `rgba(0, 0, 0, 0)` — fully
transparent. These are interactive `<button>`s the user clicks frequently to jump plies; a transparent
hover makes them feel non-interactive. The fix adds a `.ply-btn` class with a `:hover` background
using the existing `--chip-bg-hover` token (the same token used by `.movechip` and `.movechip-row`),
plus a `.current` modifier preserving the existing `--accent-soft` highlight. The inline styles in
PlyList collapse to a single className, shrinking the JSX. Audit spec now also asserts the hover
background is non-transparent on a non-current ply button.
