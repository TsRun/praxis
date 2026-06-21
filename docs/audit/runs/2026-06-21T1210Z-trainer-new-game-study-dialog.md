# Audit run — 2026-06-21T12:10:37Z

**Mode:** TEST_ONE
**Subject:** trainer-new-game-study-dialog
**Result:** IMPROVED+PENDING+verification

UI/a11y pass on the New game study dialog (opened from Studies → New study → Game study). Sign-in, dialog open, focus styles, button enablement matrix, Esc/backdrop close, and mobile 375x812 layout all pass; no console or page errors.

The actionable finding: in `src/trainer/NewGameStudyDialog.tsx`, the `<p id="game-study-pgn-help">` help paragraph is rendered INSIDE the `<label htmlFor="game-study-pgn">`. Because the textarea's accessible name is derived from the entire label content, screen readers announce the field as `"PGN * Paste a PGN to import the moves of a single game — copy it from chess.com, Lichess, or any other source."` instead of just `"PGN *"`. The help is also already referenced via `aria-describedby="game-study-pgn-help"`, so it would be announced a second time as the description — verbose and redundant. The sibling `NewTacticSetDialog.tsx` already follows the cleaner pattern (help paragraph as a sibling AFTER the label, referenced via aria-describedby).

Fix: move the `<p>` out of the `<label>` so the label only contains the visible label span and the textarea. `aria-describedby` continues to point at it. No visual change beyond a minor `marginTop: -8` to keep the previous gap.
