# Audit run — 2026-06-04T12:13:00Z
**Mode:** TEST_ONE
**Subject:** student-dashboard-assignments-tabs
**Result:** OK+MERGED

Exercised the Active/Completed segmented control inside the "All assignments" card on /student/dashboard at viewport 1280x720 and 375x812. The group is correctly marked `role="group"` with `aria-label="Filter assignments by state"`; clicking either button (or pressing Space when focused) flips both `.active` class and `aria-pressed` on the pair, matching ARIA expectations for a single-select toggle group. Keyboard Tab navigation reaches both buttons and triggers `:focus-visible` with a solid 2px amber outline (rgb(251,191,36)) at 2px offset — visible against the dark card background.

Active label uses `rgb(236,236,239)` on a faint white overlay, inactive uses `rgb(160,160,168)` on transparent card background — both above WCAG-AA against the page's dark surface. Empty-state copy ("No completed assignments.") renders when the Completed tab is selected for this account. At 375x812 the header reflows to a two-line layout (title row + segmented row) with no horizontal overflow (scrollWidth 360 ≤ clientWidth 375), and both tabs remain tappable. No application console errors, no page errors. No change required.
