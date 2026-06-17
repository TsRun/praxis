# Audit run — 2026-06-17T09:04:26Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** OK+MERGED

Ran the existing audit spec against prod (`https://praxis.tsrun.dev/trainer/studies`). The "New study" trigger exposes the correct ARIA contract (`aria-haspopup="menu"`, `aria-expanded` toggled true on open / false on Escape, `aria-controls="new-study-menu"`), the menu element has `role="menu"` with `aria-labelledby` back to the trigger, and the three menuitems ("Opening study", "Game study", "Tactical set") render with type=button, tabIndex=0, and 60px-tall touch targets. Focus is placed on the first menuitem on open; ArrowDown advances to the next; Escape and outside-click both close the menu. Focus ring on the trigger is a visible 2px amber outline plus shadow.

At mobile viewport 375×812 the panel is 320px wide, left=16, right=336 — fully within the 375px viewport with no horizontal document overflow. Clicking "Opening study" dismisses the menu and opens the dialog. Zero page errors, zero application console errors. No UI issues observed at 1280×900 or 375×812.
