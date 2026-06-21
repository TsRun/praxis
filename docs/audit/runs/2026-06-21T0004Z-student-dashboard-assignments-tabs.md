# Audit run — 2026-06-21T00:04:00Z
**Mode:** TEST_ONE
**Subject:** student-dashboard-assignments-tabs
**Result:** OK

Re-exercised the Active/Completed segmented control under "All
assignments" on `/student/dashboard`. Sign-in → dashboard (200) → the
segmented control carries `role="group"` with
`aria-label="Filter assignments by state"`, each button has a per-tab
`aria-label` ("Show 32 active assignments" / "Show 0 completed
assignments") and `aria-pressed` that flips with state. Clicking
Completed toggles `aria-pressed`, swaps the `.active` class, and the
list region switches to the "No completed assignments." empty state.
Switching back to Active restores the 32-row list. Keyboard activation
via Space on a focused button works.

UI checks: keyboard focus shows a 2px amber `outline: solid` at offset
2px (matches `:focus-visible`); active label color
`rgb(236, 236, 239)` on a subtle white-6% inset, inactive label
`rgb(160, 160, 168)` — both pass WCAG-AA against the dark surface.
Mobile 375×812 has `scrollWidth=360` (no horizontal overflow); the "All
assignments" header row wraps so the H2 sits above the segmented
control, segmented width 202 inside a 300-wide card row, tap targets
36px tall. No `pageerror`, no app `console.error` (network 404s for
images and the like are waived).

Nothing observed to improve in this run.
