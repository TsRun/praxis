# Audit run — 2026-06-09T09:07:21Z
**Mode:** TEST_ONE
**Subject:** trainer-studies-list
**Result:** OK+MERGED

Exercised /trainer/studies on prod. Heading, three stat tiles (studies authored, students linked, chapters total), and three sections (Opening studies, Game studies, Tactical sets) render. Filter row exposes correct a11y: search input has aria-label "Search studies", filter buttons use aria-pressed, view-toggle icon buttons have aria-label "Grid view" / "List view", and the New study trigger has aria-haspopup/aria-expanded/aria-controls. Focus indicator on inputs and buttons is a 2px solid amber outline plus halo. Card hover applies a -1px translate and elevated shadow.

At 375x812 there is no horizontal overflow (scrollWidth 360 < clientWidth 375); the filter row wraps cleanly to multi-row. No page errors and no application-level console errors. No improvement landed this run.
