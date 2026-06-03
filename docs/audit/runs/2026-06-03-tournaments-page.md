# Audit run — 2026-06-03T12:16:30Z
**Mode:** TEST_ONE
**Subject:** tournaments-page
**Result:** IMPROVED+PENDING

Tested /tournaments at desktop (1280) and mobile (375x812). The page renders the "Tournois" heading, the Classique/Rapide/Blitz cadence buttons, and the Liste/Carte view toggle without app console errors or page errors. Cadence selection correctly toggles aria-pressed and the URL parameter (cadence=rapid). The map view loads and the SVG mounts.

UI quality findings:
- Inactive view-toggle buttons (Liste/Carte) had no hover state at all — `background` and `color` were identical to the rest state, giving no affordance. The cadence pill buttons likewise had no hover styling.
- Mobile tap targets fell below the 36px minimum: cadence pills measured 28.1px tall, Liste/Carte toggles 30.8px tall at 375px width.

Fix: extracted the inline button styles into two small CSS classes (`.pill-btn` and `.seg-toggle-btn` in src/index.css) that provide hover, focus-visible, and min-height: 36px. `TournamentsPage.tsx` now uses these classes instead of computed inline styles. Mobile tap targets land at the 36px floor and inactive states get a subtle background on hover plus the existing accent focus ring.
