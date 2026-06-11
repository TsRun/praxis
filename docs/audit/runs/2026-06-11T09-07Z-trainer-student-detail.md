# Audit run — 2026-06-11T09:07:17Z
**Mode:** TEST_ONE
**Subject:** trainer-student-detail
**Result:** IMPROVED+PENDING+PR

Test rendered the access-denied error state against prod (bot is not linked to student id 1). Page errors 0, app console errors 0, mobile overflow OK (375x812). The error card itself looked fine, but the sibling **loading** state showed two UI-quality issues that the run surfaced:

- `color: var(--text-faint)` (#6b6b73 on #141416 ≈ 3.4:1) — below WCAG AA 4.5:1 for normal text.
- Bare `padding: 28` div in the top-left, visually inconsistent with the error and loaded states which both use `page-wrap` + a `Card`.

Fix: wrap the loading state in the same `page-wrap` + `Card` shell as the error state, and switch its text color to `var(--text-dim)` (#a0a0a8 ≈ 7.6:1).
