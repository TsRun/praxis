# Audit run — 2026-06-07T18:05:57Z
**Mode:** TEST_ONE
**Subject:** trainer-games-free-editor
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised /trainer/games → Free editor on prod. Functional: palette buttons, side-to-move radios, Starting/Empty board buttons all responsive; no console or page errors; no desktop or mobile overflow (1265/1280 and 360/375). Mobile screenshot exposed a real WCAG-AA issue: black palette glyphs render as `rgb(26,26,26)` on the near-black `--inset-bg` (rgba(255,255,255,0.025) over the page background) with `webkit-text-stroke-width: 0px` — the black pieces are visually indistinguishable from the button background, especially on mobile.

Fix mirrors the existing white-piece treatment: add a `1px #f7f3e3` light text-stroke to the black palette glyph style in `PositionSetupBoard.tsx`. Symmetric with the white pieces' `1px #1a1a1a` dark stroke. Typecheck + 48-test suite green; audit spec passes against prod with the legibility observation logged.
