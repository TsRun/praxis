# Audit run — 2026-06-20T15:04:00Z
**Mode:** TEST_ONE
**Subject:** trainer-games-free-editor
**Result:** OK

Exercised `/trainer/games` Free editor tab (gated by the "Find games passing
through this position" toggle). The Segmented `[role="group" aria-label="Position
filter source"]` exposes Free editor / Play moves with `aria-pressed` flipping
correctly on click. The piece palette is wrapped in
`[role="group" aria-label="Piece palette"]` and all 12 piece buttons carry word
aria-labels (e.g. "White queen", "Black knight") plus the Erase tile with
`aria-pressed` toggling. Hover state on idle palette tiles repaints
`background: rgba(251,191,36,0.06)` and `border-color: rgba(251,191,36,0.2)`
(yellow tint visible). Picking the white queen flips `aria-pressed=false→true`
and applies `--accent-soft`/`--accent-ring`. Empty board resets FEN to
`8/8/8/8/8/8/8/8 w - - 0 1`; Starting position resets to the canonical
`rnbqkbnr/...`. Side-to-move radiogroup has `aria-labelledby` to "Side to move"
and each radio has a wrapping `<label>`. Black-piece glyphs render at
`color: rgb(26,26,26)` with `-webkit-text-stroke: 1px rgb(247,243,227)` giving a
light outline so they read on the dark inset background. Keyboard focus
ultimately routes through the global `:focus-visible` ring; programmatic
`.focus()` returns the resting state. Desktop 1280: scrollWidth 1265 (no
overflow). Mobile 375×812: scrollWidth 360 (no overflow), palette rows fit at
six-across with 45×44 tiles; Starting position / Empty board buttons sit in a
clean row at the bottom. No application console errors, no page errors.
Decision: OK — prior cycle's word-label + palette-group improvement is holding,
bumping `lastTestedAt`.
