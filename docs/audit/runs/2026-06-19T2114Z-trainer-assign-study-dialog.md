# Audit run — 2026-06-19T21:14:16Z
**Mode:** TEST_ONE
**Subject:** trainer-assign-study-dialog
**Result:** OK

Exercised `/trainer/studies/opening/18` (an opening study created in-run because the bot has no opening studies). Clicked "Assign to student" → dialog opened with `aria-modal=true`, autofocused the "search students…" input (aria-label="Search students"), and rendered the empty-roster meta with the "invite one from the Students page" link to /trainer/students. Cancel + Assign footer buttons render; Assign correctly starts disabled (no pick) and stays disabled because the roster is empty. Title "Assign Audit run — assign dialog probe" renders in the h2. Esc + Cancel both dismiss the dialog. Mobile 375×812: doc scrollWidth 360 ≤ client 375, dialog box (x=7.5, w=345) fits within the viewport, footer buttons visible at the bottom (Cancel 73×36, Assign 72×36). Focus indicator on `.btn` is supplied via `.btn:focus-visible` in `src/index.css` (programmatic `.focus()` does not engage `:focus-visible`, hence the logged `outline-style: none` — expected, not a defect). No uncaught page errors and no application console errors. Decision: OK — bumping `lastTestedAt`.
