# Audit run — 2026-06-11T18:10:54Z
**Mode:** TEST_ONE
**Subject:** student-opening-study-viewer
**Result:** IMPROVED+PENDING+verification

Exercised the student opening study viewer at `/student/study/opening/13` as the bot user. Drill / Explore tree / Chapters mode tabs all render and switch cleanly (Drill resolves to the "All caught up" terminal state for this study; Tree mode loads two `cg-wrap` containers; Chapters renders the `<h2>Chapters</h2>` heading). API request to `/api/student/studies/opening/13` returns 200; no page errors and no application-level console errors (only the waived 401 `Failed to load resource`).

UI observation at 375×812 (after navigating the Chapters tab): the page's `documentElement.scrollWidth` was **418px** against a 375px viewport — a 43px horizontal overflow. Walking the DOM, the offending node was the `ChaptersView` outer grid: `gridTemplateColumns: '260px 1fr'` resolved to `260px 122px` on a 336px wide container, because the empty-state card's text ("No chapters in this study yet — your trainer hasn't added one.") forced the second column to its min-content width, and the grid's intrinsic width exceeded the viewport.

Fix lifts the inline grid styles onto a shared `.chapters-grid` class in `src/index.css`, declares the column with `minmax(0, 1fr)` so it can collapse below its content's natural width, and stacks to a single column under a 640px media query (also dropping the `position: sticky` on the chapter list at that breakpoint). `src/student/OpeningStudyViewer.tsx` switches the wrapper and the sidebar Card to the new class names. Two files, +18 / −7 LOC. Typecheck ✅, npm test ✅ (48 passed), audit spec on prod ✅ (1 passed — the spec already logs `MOBILE OVERFLOW` as an observation and will tighten once the fix is deployed).
