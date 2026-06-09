# Audit run — 2026-06-09T06:12Z
**Mode:** TEST_ONE
**Subject:** trainer-students-list
**Result:** IMPROVED+PENDING+PR_OPEN

Ran the trainer-students-list Playwright spec against prod. Page renders the
Students heading, segmented filter (All / Linked / Invited) with correct
aria-pressed state, search input with aria-label, and a count meta marked
`role="status" aria-live="polite"`. No page errors, no app console errors,
mobile viewport (375×812) has no horizontal overflow.

Issue spotted in the desktop screenshot: while data is still loading, the page
shows "Loading…" in the roster slot, but the count badge already reads
"0 students". Because that span is also `aria-live="polite"`, screen readers
get told there are zero students before the request even resolves, and then
get told the real count a beat later. Fix: render "Loading…" in the count
span while `rows == null`, and only flip to "{n} students" once data arrives
(`src/trainer/StudentsPage.tsx:109-117`). Smallest possible change, no extra
imports or state. Typecheck + unit suite pass.
