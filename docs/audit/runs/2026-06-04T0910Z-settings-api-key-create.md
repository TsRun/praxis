# Audit run — 2026-06-04T09:10:17Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** OK+MERGED

Exercised the `/settings` API keys "New key" flow end-to-end as the bot
trainer — opened the create dialog, verified disabled-state on empty and
whitespace-only input (`cursor: not-allowed, opacity: 0.5`), minted a real
key, confirmed the 39-char token rendered and copied to clipboard, then
revoked it via the per-row revoke confirmation. Mobile pass at 375x812
also opened the dialog cleanly. No page errors, no application console
errors, no mobile overflow (scrollWidth 360 at 375 viewport).

UI checks: the dialog uses `role="dialog"`, `aria-modal="true"`, and
`aria-label="New API key"`. The "Label" input is wrapped in a `<label>`
element (valid implicit association), autofocused on open, and the Mint
key button is correctly disabled until non-whitespace text is entered.
Revoke buttons carry both `title` and `aria-label` and clear at 32x32 —
above the WCAG 2.5.8 AA minimum target. Mobile dialog buttons at 36px
height (Cancel 73×36, Mint key 83×36, Close 36×36) likewise clear AA.
Marking OK; no code change needed this rotation.
