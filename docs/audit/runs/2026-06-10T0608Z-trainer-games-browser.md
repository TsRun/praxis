# Audit run — 2026-06-10T06:08:30Z
**Mode:** TEST_ONE
**Subject:** trainer-games-browser
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised /trainer/games against prod. Page renders cleanly: Browse games heading, Chess.com/Lichess/Database tabs, all filter inputs labelled, focus rings visible, Search button correctly disabled with title tooltip when no Chess.com username is entered. No console errors, no page errors. Mobile (375x812) layout has no horizontal overflow (scrollWidth 360 < clientWidth 375) and the import grid stacks cleanly.

Found one a11y issue in the source: the **Color** radio group (White / Black / Either) in `FilterControls` lacked a `name` attribute on its `<input type="radio">` elements. Without a shared `name`, the browser treats them as three independent radios — each occupies its own tab stop and arrow-key navigation between them is broken, and assistive tech doesn't pair them as a single radio group. Probe at `tests/audit/trainer-games-browser.spec.ts` against prod confirmed: `UNIQUE COLOR RADIO NAMES: []`. Other radio groups in the codebase (`NewOpeningStudyDialog`, `PositionSetupBoard`) already follow the shared-`name` pattern.

Fix: added a `useId()`-derived `name` (and `value`) to the three Color radios in `src/trainer/ImportGamesPage.tsx`. Typecheck + npm test pass.
