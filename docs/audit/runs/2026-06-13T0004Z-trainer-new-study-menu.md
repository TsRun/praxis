# Audit run — 2026-06-13T00:04:55Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** OK+MERGED

Re-exercised the "New study" dropdown on `/trainer/studies` at desktop 1280×900 and mobile 375×812. Trigger `#new-study-trigger` exposes `aria-haspopup="menu"` and toggles `aria-expanded` between `false` (collapsed) and `true` (open). Activating the trigger reveals `#new-study-menu` with `role="menu"` and exactly three `role="menuitem"` items — Opening study, Game study, Tactical set — each a 60px-tall `<button type="button" tabindex="0">`. On open, focus lands on the first item (Radix menu default), giving it the highlighted `rgb(28,28,32)` background; the other two start transparent and brighten on hover, which is the expected behavior.

Keyboard semantics are sound: Escape closes the menu (count drops to 0 and `aria-expanded` returns to `false`); reopening lands focus on the first item again; ArrowDown moves focus to the Game study item. An outside click on the page heading closes the menu. Mobile rect at 375 viewport: 320×… aligned at left=16, right=336, so it sits inside the gutter with no horizontal overflow (scrollWidth=360 < clientWidth=375). Selecting "Opening study" dismisses the menu and opens the new-study dialog (`role=dialog` present). No `pageerror`s, no application console errors. Nothing actionable to improve — rotating the cursor with an OK bookkeeping PR.
