# Audit run — 2026-06-14T03:05:37Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** OK+MERGED

Exercised `/settings` API keys flow as the bot — clicked **New key**, filled a
unique label, minted the key, copied to clipboard, verified the new row
appeared in the list, then revoked it cleanly. Repeated the open at 375x812
to check mobile layout. No page errors, no application console errors.

UI observations: `NewKeyDialog` input has an implicit wrapping `<label>`
("Label"), autoFocus on open, and `aria-describedby` wired to the error span
only when an error is present — fine. **Mint key** is correctly disabled for
empty input and for whitespace-only input (cursor `not-allowed`, opacity 0.5).
Dialog has `role=dialog`, `aria-modal=true`, focus trap, scroll lock, and
Escape-to-close from the surrounding `Dialog` atom. Revoke button carries
`aria-label="Revoke key ..."` and a matching `title`; minted-dialog **Copy**
flips to **Copied** after writing the token to clipboard (39-char token
captured in clipboard at runtime).

Mobile pass at 375x812: `document.scrollWidth=360` (no overflow), dialog
sized to 345x209 with footer buttons 73x36 (Cancel) and 83x36 (Mint key) —
both above the WCAG 2.5.8 24x24 minimum, below the AAA 44x44 target. The
"New key" trigger renders 91x28 with 12.5px font, which is comfortably
inside its card header on both 1280 and 375 viewports. Nothing visible
warrants a code change this rotation.
