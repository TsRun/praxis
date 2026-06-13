# Audit run — 2026-06-13T21:06:58Z
**Mode:** TEST_ONE
**Subject:** settings-page
**Result:** IMPROVED+PENDING

Exercised /settings against prod at 1280 + 375. All four sections render
correctly with no console/page errors. Profile and Password inputs are
properly label-wrapped; role buttons carry aria-pressed + aria-label;
revoke buttons have aria-label and 32px touch target; focus styles use a
visible amber outline + ring. Save button is disabled when the form is
not dirty.

At 375x812 the Roles grid renders 3 cards at 89px each, forcing
"A coach assigns me" to wrap onto 3 lines and crowding the card content.
Fix: change the Roles grid from `1fr 1fr 1fr` to
`repeat(auto-fit, minmax(120px, 1fr))` so cards keep their desktop
3-up layout but wrap to 2-up on narrow viewports (≈138px each). Single
inline-style change to src/auth/SettingsPage.tsx; no behavior change.
