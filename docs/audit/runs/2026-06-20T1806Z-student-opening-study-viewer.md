# Audit run — 2026-06-20T18:06:00Z
**Mode:** TEST_ONE
**Subject:** student-opening-study-viewer
**Result:** IMPROVED

Re-exercised `/student/study/opening/20` (the bot's own "Audit run — opening
editor probe" study) as Claude Bot. Sign-in + viewer load succeed end-to-end:
`GET /api/student/studies/opening/20` → 200, segmented mode tabs render with
correct `aria-pressed` (Drill active, Explore tree / Chapters reachable),
Drill mode reaches its terminal "All caught up" status (0 cards due), and
switching to Explore tree spawns a `cg-wrap` board container. The progressbar
has full ARIA (`role=progressbar`, `aria-valuenow=0`, `aria-valuemin/max`,
named via `aria-label`). Mobile 375×812: `docW=360`, no horizontal overflow.
No application console errors, no page errors.

Observation: in the **Chapters** tab on a study with 0 chapters the empty
state is **duplicated** — the left sidebar list renders "No chapters in this
study yet." *and* the right pane simultaneously renders a centered
"No chapters in this study yet — your trainer hasn't added one." card. The
two messages stack side-by-side and repeat the same fact, with the right pane
already telling the user why (trainer hasn't added one).

Fix: in `OpeningStudyView` (src/student/OpeningStudyViewer.tsx) added an
early-return that, when `chapters.length === 0`, renders only the
informative full-width empty-state Card and skips the `.chapters-grid`
two-column layout entirely. The left sidebar's redundant `"No chapters in
this study yet."` branch is removed (the surviving `chapters.map(...)` is
now reached unconditionally inside the grid render). Diff: one file,
src/student/OpeningStudyViewer.tsx, smallest-change-first. Typecheck +
`npm test` (48/48) green on the branch. Decision: IMPROVED.
