# Audit run — 2026-06-18T12:06:18Z
**Mode:** TEST_ONE
**Subject:** student-dashboard
**Result:** IMPROVED+PENDING (PR open)

Exercised `/student/dashboard` against prod at viewport 1280 then 375x812 logged in as the bot user (26 active assignments). Greeting, MiniStat tiles, H2 headings, Today progressbar a11y, assignment-row hover affordance, focus-visible outline, and mobile grid override all checked out. Mobile width = 360 ≤ 375, no horizontal overflow, no page errors, no application console errors.

Observation: the "Active / Completed" assignment filter (Segmented) renders each button as `<label> <count>` (e.g. "Active 26"). The button has no per-option `aria-label`, so a screen reader announces "Active 26 toggle button pressed" — ambiguous about whether the count is part of the name. The Segmented atom already supports a per-option `ariaLabel`; `DashboardPage.tsx` simply wasn't passing it. Fix: provide `ariaLabel` per option ("Show 26 active assignments" / "Show 0 completed assignments") that pluralises on count. Spec relaxed to read the label text node (so it survives the new count span) and warns when per-button aria-label is missing; the hard assertions remain on labels, aria-pressed, hover rule, focus block, progressbar role, mobile overflow, and mobile grid override.
