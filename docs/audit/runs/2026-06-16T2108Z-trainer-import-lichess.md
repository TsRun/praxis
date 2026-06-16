# Audit run — 2026-06-16T21:08:46Z
**Mode:** TEST_ONE
**Subject:** trainer-import-lichess
**Result:** OK+MERGED

Re-tested the "Import from Lichess" dialog launched from /trainer/studies.
The first stage is `NewOpeningStudyDialog` rendered with `lichessHint=true`,
so the header reads "Import from Lichess" and the CTA reads
"Create + import PGN →". Dialog carries `role="dialog"`,
`aria-modal="true"`, and `aria-labelledby` pointing at the heading.

The side picker is a proper native radio group: a `[role="radiogroup"]`
container with two visually-hidden `<input type="radio">` elements wrapped
by labelled tiles. Clicking the Black tile flips the React state — radios
become `[{w:false},{b:true}]` and the visible label paint follows
(picked tile = `rgba(251,191,36,0.12)` accent-soft, unpicked tile =
`rgba(255,255,255,0.024)` inset). Tab from the name input lands on the
checked radio and the wrapping label paints a 2px solid `:focus-visible`
outline.

CTA is disabled with empty name, enabled after filling. Header Close button
is 36×36 (≥ 24 tap target). Escape closes the dialog. At 375×812 the dialog
fits the viewport with no horizontal overflow (scrollWidth 360 ≤ client 375)
and side tiles are 301×70 each — comfortable tap targets. Zero page errors,
zero application console errors. No fixable UI issues observed.
