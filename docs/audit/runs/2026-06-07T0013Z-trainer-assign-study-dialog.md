# Audit run — 2026-06-07T00:13:00Z
**Mode:** TEST_ONE
**Subject:** trainer-assign-study-dialog
**Result:** IMPROVED+PENDING+PR

Exercised the `Assign to student` dialog from `/trainer/studies/opening/:id` on prod. Dialog opens with a `role="dialog"`/`aria-modal="true"` shell, title `Assign <studyName>`, autofocused search input, Cancel + Assign footer, and X-close. Esc + Cancel + click-outside all dismiss. Mobile 375x812: dialog fits (345px wide), no horizontal overflow. No page errors, no app console errors.

Observation: when the trainer's roster is genuinely empty (no students linked yet), the dialog renders the same `meta` line — "No students match that search." — that's used for an active no-match filter. That's misleading copy: there's no search active, the roster is just empty. Fix in `src/trainer/AssignStudyDialog.tsx`: branch on `students.length === 0` and show "No students yet — invite one from the Students page." in the empty-roster case, keeping the original copy for the genuine no-match filter case. Typecheck + tests green.
