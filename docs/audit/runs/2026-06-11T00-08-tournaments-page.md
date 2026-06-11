# Audit run — 2026-06-11T00:08:28Z
**Mode:** TEST_ONE
**Subject:** tournaments-page
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised `/tournaments` against prod. Heading "Tournois", cadence buttons (Classique/Rapide/Blitz), Trier select, and Liste/Carte view toggle all render and operate correctly. `aria-pressed` toggles as expected on cadence + view buttons, `?cadence=rapid` reflects URL state, switching to Carte mounts the map view. Both selects already carry proper `aria-label` (Région, Trier). Cadence pill contrast vs white text: classic 5.00:1, rapid 5.09:1, blitz 4.83:1 — all pass WCAG-AA. No page errors, no application console errors.

UI observation at 375x812: the toolbar uses `flexWrap: 'wrap'` with the cadence buttons as direct siblings of the Région/Trier selects and Liste/Carte toggle. On mobile the row wraps individually so **Blitz lands on row 2 alone, sandwiched between the Trier select and the Liste/Carte toggle** — it visually reads as a view-mode option rather than the third cadence filter. Smallest fix: wrap the three cadence buttons in a `<div role="group" aria-label="Cadence">` flex container so they stay together (and wrap as a unit). Group also exposes the cadence filter as a single a11y region. Typecheck + 48 unit tests pass on the branch.
