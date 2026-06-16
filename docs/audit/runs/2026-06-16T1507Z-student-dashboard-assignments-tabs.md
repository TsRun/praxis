# Audit run — 2026-06-16T15:07:31Z
**Mode:** TEST_ONE
**Subject:** student-dashboard-assignments-tabs
**Result:** IMPROVED+PENDING+verification

Selected oldest feature (lastTestedAt 2026-06-12T06:02:54Z). Spec passed against
prod on origin/main: the "Filter assignments by state" segmented group renders
both tabs, `aria-pressed` toggles correctly on click, `.active` class follows,
keyboard Tab lands `:focus-visible` with a 2px accent outline, Space activates,
and the empty-state copy switches between "No active assignments." and
"No completed assignments." (the bot account had 26 active / 0 completed). No
app console errors, no page errors, no mobile overflow at 375x812
(docW 360, winW 375).

Observation that drove the fix: the Active/Completed tabs carry no per-tab
counts, so the user can't see at a glance how many items each tab holds — they
have to mentally cross-reference the MiniStat tiles at the top of the page (or
the small "X done · Y active" chips in the Today card on the right column). The
shared `Segmented` atom already supports a `count` prop (`SegmentedOption.count`
in `src/components/ui/atoms.tsx`), but it had no consumer and no CSS, so the
count would have rendered as plain inline text next to the label.

Smallest-change fix:
- `src/student/DashboardPage.tsx`: pass `count: active.length` /
  `count: done.length` to the two segmented options.
- `src/index.css`: minimal `.segmented .num` styling — mono font, 11px,
  `--text-faint` for inactive and `--text-dim` for the active tab so the count
  reads as a secondary number without competing with the label.

Diff: 2 files, +9/-2. Typecheck ✅, npm test ✅ (48 passed).
