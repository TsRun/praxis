# Audit run — 2026-06-02T00:14:56Z
**Mode:** TEST_ONE
**Subject:** trainer-students-list
**Result:** IMPROVED+PENDING (PR opened, verification to run)

Ran the audit spec for /trainer/students on prod. Functional state was clean — heading renders, filter tabs All/Linked/Invited render with `aria-pressed`, search input has `aria-label="Find student by nickname"`, focus styles visible (2px amber outline + box-shadow), tab order from search → All filter button works, no console/page errors. Mobile 375×812: no horizontal overflow (scrollWidth 360 ≤ 375). Empty state is announced (`role="status" aria-live="polite"` on the EmptyStudents region).

a11y observation: the result-count text "{n} students" sits in the filter row and updates when the user types in the search box or clicks a filter tab — but it is a plain `<span className="meta">` with no role and no aria-live (`COUNT SPAN: { role: null, ariaLive: null, text: '0 students' }`). Sighted users see the count change in real time; screen reader users get no announcement when the visible list silently shrinks from "12 students" to "3 students".

Fix: give the count span `role="status" aria-live="polite" aria-atomic="true"` so the new total is announced politely after each filter/search update. One file, ~5 LOC. Typecheck + 48 unit tests pass. Audit spec still passes against prod (assertion-free observation; the new behavior will be observable on the next rotation after deploy).
