# Audit run — 2026-06-08T06:13:16Z
**Mode:** TEST_ONE
**Subject:** trainer-students-filters
**Result:** OK+MERGED

Exercised the All / Linked / Invited segmented control on `/trainer/students` against prod. The
container correctly exposes `role="group"` with `aria-label="Filter students by status"`; each tab
button updates `aria-pressed` and the `.active` class on click and on Space keystroke. Tab order
moves linearly between buttons (no roving tabindex pattern in use), and `:focus-visible` is defined
on `.segmented button` (`outline: 2px solid var(--accent)` with 2px offset) so keyboard focus is
visible in real use even though programmatic `.focus()` does not match `:focus-visible`. The
Invited tab's filter-aware empty state renders correctly ("No invited students" plus the
explanatory copy). No page errors and no app console errors.

At 375×812 the filter row wraps (`flex-wrap: wrap` on the container, confirmed via computed style)
so the search input sits on its own line above the segmented buttons + count, document scrollWidth
360 stays inside the 375 viewport — no horizontal overflow. Mobile tap on Linked still flips
`aria-pressed`/`.active`. Screenshots reviewed at desktop and mobile show consistent contrast for
both active and inactive states (inactive uses `--text-dim: #a0a0a8` on the dark app background,
~5.2:1 against the page bg, AA-pass). Marking OK.
