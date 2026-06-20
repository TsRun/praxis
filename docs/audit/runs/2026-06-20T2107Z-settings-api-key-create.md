# Audit run — 2026-06-20T21:07:29Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** IMPROVED

Re-exercised the New API key flow on `/settings` end-to-end. Sign-in →
`/settings` (200) → "New key" button opens the dialog (aria-modal, focus
trapped, ESC closes via shared Dialog), input is autofocused with an
implicit wrapping `<label>` "Label", Mint key stays disabled while the
trimmed value is empty (`disabled` true for both empty and whitespace-only),
becomes enabled with a name, mints a 39-char token, copy-to-clipboard works
(clipboard length 39, button label flips Copy → Copied), the key appears in
the list with its prefix, and revoke through the confirm dialog removes it
cleanly. Mobile 375×812: scrollWidth=360 (no horizontal overflow), dialog
345×209 centered, button row reachable. No app console errors, no page
errors.

Observation: in `MintedKeyDialog` the freshly-minted token is shown once and
the user must copy it. Two small UI/a11y wins are observable:
  1. The token block is plain text — selecting it on mobile requires a
     long-press drag, fiddly for a `chess_…<sha>` style string.
  2. The "Copy" button label flips to "Copied" for 1.5s, but there is no
     live region — screen-reader users get no confirmation that the copy
     happened.

Fix (src/auth/SettingsPage.tsx, MintedKeyDialog only):
  - Token block gains `userSelect: 'all'` so a single click/tap selects
    the entire token.
  - Adds a visually-hidden `<span role="status" aria-live="polite">` that
    announces "API key copied to clipboard" while `copied === true`.

Smallest-change-first, single file, additive only. `npm run typecheck`
clean. `npm test` 48/48 green. The existing audit spec passes unchanged
(Copy → "Copied" assertion still holds, clipboard contents still verified).
Decision: IMPROVED.
