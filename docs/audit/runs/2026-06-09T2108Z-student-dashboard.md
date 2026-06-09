# Audit run — 2026-06-09T21:08:39Z
**Mode:** TEST_ONE
**Subject:** student-dashboard
**Result:** IMPROVED+PENDING+verification

Tested `/student/dashboard` at 1280 and 375. Desktop layout looks clean. At 375 the
assignment-row grid resolved to `56px 99px 99px` — the chip in column 3
("not started" / "in progress") consumed ~99px of horizontal space, squeezing
the assignment-name column to 99px and causing names like "Audit run — opening
editor probe" to wrap across 3–4 lines on every row.

Fix: gave the three status spans a shared `.assignment-row-status` class and
restructured the mobile grid (`@media (max-width: 640px)`) to use a 2-column
layout (`56px minmax(0,1fr)`), spanning the board across both rows and placing
the status on row 2, column 2 below the name. Name now gets the full remaining
inline width on mobile; the status remains visible just beneath. Typecheck and
unit tests pass. The audit spec passes against the still-old prod build (the
mobile-grid soft logs will pick up the new shape on the next rotation once the
fix deploys).
