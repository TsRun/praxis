# Audit run — 2026-06-21T06:05:30Z
**Mode:** TEST_ONE
**Subject:** trainer-import-lichess
**Result:** OK+MERGED

Re-tested the "Import from Lichess" entry on `/trainer/studies` against
production. The dialog opens with role=dialog / aria-modal=true /
aria-labelledby set, header reads "Import from Lichess", the CTA
"Create + import PGN →" is correctly disabled with an empty name and
enables when the user types. Side picker is a true `role="radiogroup"`
with two native radio inputs; clicking the Black label toggles checked
state and the label background paint differs from White
(amber vs near-transparent). Tab from the name input lands on the
checked radio with `:focus-visible` true and a solid 2px outline on the
wrapping label. Close button is a 36×36 tap target with aria-label="Close";
Escape closes the dialog cleanly. At 375×812 there is no horizontal
overflow (scroll 360 ≤ client 375), both side labels are 301×70 (well
above the 44px floor), the CTA is 36px tall, and the name input is
wrapped in a real `<label>` reading "Study name". Zero page errors, zero
application console errors. No UI regression observed.
