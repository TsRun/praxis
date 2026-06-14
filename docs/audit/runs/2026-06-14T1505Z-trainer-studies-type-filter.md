# Audit run — 2026-06-14T15:05:04Z
**Mode:** TEST_ONE
**Subject:** trainer-studies-type-filter
**Result:** OK+MERGED

Exercised the All / Opening / Game / Tactic filter chips above the studies list on `/trainer/studies` against prod after signing in with the bot account. The `.segmented[aria-label="Filter studies by type"]` group rendered four `<button>` chips in the expected order; clicking each one moved `aria-pressed="true"` to the active chip while the other three flipped to `aria-pressed="false"`, and the page sections re-rendered to match — "Opening" hid the Game studies / Tactical sets section headings, "Game" hid the other two, "Tactic" hid the other two, and "All" brought all three back. The `Segmented` atom's `:focus-visible` rule was inspected in `src/index.css:342`: `outline: 2px solid var(--accent); outline-offset: 2px` — keyboard focus has a real ring. Active vs inactive contrast (white-ish `rgb(236, 236, 239)` on a subtle white-tint background vs dim `rgb(160, 160, 168)` on transparent) is muted but the text-color delta carries the state. No application console errors and no uncaught page errors were observed.

At the 375×812 mobile viewport, the `.segmented` group measured 262×44 px and sat fully inside the 375 px client width; `document.documentElement.scrollWidth` was 360 (no horizontal overflow). The four chips measured 43×36, 80×36, 62×36, 63×36 — each exceeds the WCAG 2.5.5 24×24 minimum tap target. Mobile click cycle (Game → All) confirmed `aria-pressed` continued to update correctly. No improvements warranted this rotation.
