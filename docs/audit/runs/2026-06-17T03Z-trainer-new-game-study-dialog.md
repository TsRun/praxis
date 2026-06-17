# Audit run — 2026-06-17T03:10:26Z
**Mode:** TEST_ONE
**Subject:** trainer-new-game-study-dialog
**Result:** OK+MERGED

Exercised the New game study dialog at desktop and at viewport 375x812.
The dialog renders with role=dialog, aria-modal=true, aria-labelledby
pointing at the title, and a Close button with aria-label="Close".
Both inputs have explicit ids matched to their `htmlFor` labels, are
marked required + aria-required, and the PGN textarea is associated to
its helper text via aria-describedby. Required-marker asterisks are
present on both fields and the submit button is correctly disabled
until both name and PGN are filled.

Focus indicators are visible on both fields — the inputs get a 2px
amber border plus a soft amber halo via box-shadow (the latter only
becomes fully painted after the 120ms transition completes, which an
earlier probe initially read as missing). Tab order goes name → PGN →
Cancel → Import game → Close, wrapping inside the focus trap. No
page errors, no application console errors, no horizontal overflow at
375. Marking OK with no source change.
