# Audit run — 2026-06-04T18:10:35Z
**Mode:** TEST_ONE
**Subject:** trainer-import-lichess
**Result:** IMPROVED+PENDING+PR

The "Import from Lichess" flow on /trainer/studies first opens the
NewOpeningStudyDialog with `lichessHint=true` so the user names the
destination study and picks the student's side before pasting PGN.

Observed at desktop and mobile (375x812): no console/page errors, dialog
has `role=dialog`/`aria-modal=true`/`aria-label="Import from Lichess"`,
ESC closes, focus trap works, sticky footer keeps Cancel/Create reachable
on short viewports. CTA "Create + import PGN →" disabled until name has
content. No horizontal overflow on mobile, side options render at
301×70px (above touch-target minimum).

One a11y issue: the White/Black side picker used `aria-pressed` toggle
buttons inside a `role="group"` container. Side is mutually exclusive
(exactly one of White/Black), so the proper ARIA semantics are
`role="radiogroup"` with native radios — matching the pattern PR #188
landed on PositionSetupBoard. Without radio semantics the picker is
not announced as a single-select group and lacks arrow-key navigation.

**Fix:** Replaced the `<button aria-pressed>` SideOption with a
`<label>` wrapping a visually-hidden `<input type="radio" name=…>`,
both options sharing a `useId()`-scoped name. Container changed to
`role="radiogroup"` with a `useId()` label association. Added
`.role-pick:has(input:focus-visible)` so the visible label still shows
a 2px focus outline when the hidden radio is focused — preserves the
existing focus affordance on the button-based role-pick uses
(SettingsPage role tiles) untouched.
