# Audit run — 2026-06-08T21:11:15Z
**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** IMPROVED+PENDING+merge-after-verify

Ran `tests/audit/profile-menu.spec.ts` against prod. Trigger has correct ARIA
(`aria-haspopup=menu`, `aria-expanded`, `aria-controls=user-menu`,
`aria-label="Open profile menu"`), focus outline is visible (2px solid amber,
2px offset), Escape closes, outside click closes, menu fits the 375x812
viewport (300w at left=20, right=320), no page errors, no application console
errors.

UI quality issue observed in the desktop and mobile screenshots: the
"Open settings →" link inside the menu was styled at fontSize 12 with
`var(--text-dim)` and zero padding, sandwiched between the amber role chips
and the bottom button row. It read as a caption rather than an actionable
menu item and lacked any hover affordance, while the `Quick roles` and
`Sign out` buttons immediately below it have proper button chrome. Promoted
it to a real menu-item: `var(--text)` color, fontSize 13, padding `6px 8px`
with negative horizontal margin to keep edge alignment, rounded hover
background (`var(--inset-bg)` on mouseover, matching the trigger's existing
hover pattern), and split the arrow into an `aria-hidden` span so screen
readers announce just "Open settings". One file changed, ~20 LOC.
