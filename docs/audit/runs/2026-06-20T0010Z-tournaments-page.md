# Audit run — 2026-06-20T00:10:00Z
**Mode:** TEST_ONE
**Subject:** tournaments-page
**Result:** IMPROVED+PENDING (PR opened)

Re-exercised `/tournaments` after sign-in. Heading "Tournois", cadence group (Classique/Rapide/Blitz), view toggle (Liste/Carte), and both region/sort selects render as expected with aria-labels and 36px tap targets. Mobile 375×812 fits (scroll 360 ≤ client 375); no horizontal overflow. Cadence-pill WCAG ratios on white text remain ≥ 4.5:1 (classic 5.00, rapid 5.09, blitz 4.83). No uncaught page errors and no application console errors.

UI issue observed: with no filters applied (URL `/tournaments`, no `region` or `cadence` query string), the empty list still renders "Aucun tournoi ne correspond à ces filtres." That copy blames filters that don't exist, making the empty state read as a filtering result rather than an honest "nothing to show". Fix: `TournamentList` now accepts an `emptyMessage` prop, and `TournamentsPage` passes "Aucun tournoi à venir pour le moment." when `region || cadence` is empty, keeping the original filter-aware message only when filters are actually active. Tiny, copy-only change in `src/tournaments/`. Audit spec now logs the empty-state text and warns (without failing) when it mentions filters with none applied, so the spec continues to pass on the current prod and will go quiet once the new copy deploys.
