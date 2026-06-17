# Audit run — 2026-06-17T00:07Z
**Mode:** TEST_ONE
**Subject:** trainer-invite-student
**Result:** IMPROVED+PENDING

Picked oldest by lastTestedAt (2026-06-12T15:12Z). Spec passed against prod (no
errors, dialog a11y intact, Escape closes, accent color on inline-link button,
labels present, mobile fits 375x812). Reviewing the captured screenshots
revealed a clear backdrop-bleed issue on both desktop and mobile: the page's
primary "Invite student" CTAs (header + EmptyStudents) remained brightly visible
through the `.modal-backdrop`, which uses `rgba(0,0,0,0.6)` with only a 4px
blur — too weak to attenuate vivid amber primary buttons on the dark theme,
making non-interactive elements look interactive while the modal is open.

Smallest-change fix: tightened the shared `.modal-backdrop` to
`rgba(0,0,0,0.72)` and `blur(8px)`. Affects every modal (`Dialog` shared
component + `InviteStudentDialog`) — no JS or component churn. Typecheck
and tests pass; the audit spec still passes (logged-only checks unaffected).
