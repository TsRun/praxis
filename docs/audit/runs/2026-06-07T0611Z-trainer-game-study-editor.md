# Audit run — 2026-06-07T06:11:39Z
**Mode:** TEST_ONE
**Subject:** trainer-game-study-editor
**Result:** IMPROVED+PENDING+verification-on-PR

Editor page at `/trainer/studies/game/:id` renders cleanly on desktop (1280) and
mobile (375x812). No page errors or app console errors. Layout is correct; the
chessboard, move list, and annotation pane stack on mobile without overflow.
Textarea has an `aria-label`, the quiz checkbox is wrapped in a `<label>`,
and focus styling is visible.

One opaque element noticed: the per-ply annotation indicators in the move
list — `●Q` (quiz) and `●` (has comment) — were 10px color-coded glyphs
inside the move buttons with no `title` and no screen-reader text, so a
trainer hovering them got no hint and assistive tech only heard the SAN
move name. Smallest-change fix: each glyph now carries `aria-hidden`
plus a hover `title` ("Quiz on this move" / "Has a comment"), and a
companion `.sr-only` span appends ", quiz" / ", has comment" to the
button's accessible name. Typecheck + unit tests + audit spec all green.
