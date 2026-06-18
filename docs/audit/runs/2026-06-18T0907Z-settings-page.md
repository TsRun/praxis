# Audit run — 2026-06-18T09:07:57Z
**Mode:** TEST_ONE
**Subject:** settings-page
**Result:** IMPROVED+PENDING+verification

Ran `tests/audit/settings-page.spec.ts` against https://praxis.tsrun.dev. All assertions passed (4 section headings visible, profile/password inputs labelled, role group has 3 aria-pressed buttons with aria-labels, focus ring visible on Nickname, Save disabled when not dirty, no console/page errors, mobile layout fits 375px).

Observation: the Roles picker grid (`gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'`) produces an asymmetric 2-column layout at 375px viewport — Trainer + Student on row 1, Solo alone on row 2 with an empty cell to its right. Desktop computed style also reports a phantom 4th 0px track (`'201.328px 201.328px 201.328px 0px'`). Switched to `repeat(3, minmax(0, 1fr))` so the three role tiles always lay out as a balanced row, with each tile ~89px wide at the 375px viewport (still well above the 60px floor the spec asserts). One-line change in `src/auth/SettingsPage.tsx`.
