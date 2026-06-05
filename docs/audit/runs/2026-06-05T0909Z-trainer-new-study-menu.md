# Audit run — 2026-06-05T09:09:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** OK+MERGED

Re-ran the existing audit spec for the "New study" dropdown on `/trainer/studies` against production. The trigger exposes correct ARIA (`aria-haspopup="menu"`, `aria-controls`, toggling `aria-expanded`), focus styles are visible (2px amber outline + amber shadow). Clicking opens a menu with three menuitems — Opening study, Game study, Tactical set — focus lands on the first item, ArrowDown moves to the second, Escape closes and restores `aria-expanded=false`, and an outside click also dismisses. Hover background lights up the active row.

Mobile pass at 375x812: menu measures 320px wide, sits at left=16/right=336 (no horizontal overflow); doc scrollWidth 360 < clientWidth 375. Clicking the Opening study item closes the menu and surfaces the New opening study dialog (`[role="dialog"]` count = 1). No page errors, no application console errors. Marking OK.
