# Audit run — 2026-06-21T18:04:17Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** OK+MERGED

Picked oldest non-removed feature (`trainer-new-study-menu`, lastTestedAt `2026-06-17T09:04:26Z`). Exercised the dropdown on prod at 1280×900 and 375×812.

Findings (all healthy):
- Trigger button `#new-study-trigger` carries `aria-haspopup="menu"`, `aria-controls="new-study-menu"`, and toggles `aria-expanded` (false ⇄ true) on open/close.
- Trigger focus indicator: solid 2 px amber outline (`rgb(251, 191, 36)`) plus a 24 px amber halo box-shadow — strongly visible against the dark surface.
- Menu has `role="menu"` and `aria-labelledby="new-study-trigger"`. Contains exactly three items: Opening study, Game study, Tactical set, each `<button type="button" role="menuitem" tabindex="0">` at 60 px tall (well above 44 px touch-target).
- Initial focus on open lands on the first menuitem (Opening study). ArrowDown advances focus to the next item (Game study).
- Hover on a menuitem changes background to `rgb(28, 28, 32)` and remains highlighted (the first item retains its pre-focused highlight after pointer leaves, which is the keyboard-focused state — not a bug).
- Escape closes the menu (count 0, trigger `aria-expanded="false"`). Outside click also closes the menu.
- Mobile 375×812: menu opens at x=16..336 (width 320), no horizontal overflow (`scrollWidth=360 ≤ clientWidth=375`).
- Clicking the "Opening study" item dismisses the menu and opens a `role=dialog`.
- No page errors. No application console errors.
