# Audit run — 2026-06-11T21:08:26Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** OK+MERGED

Exercised `/settings` API keys section. Sign-in → settings page → API keys card → "New key" button opens dialog with `role="dialog"`, `aria-modal="true"`, `aria-labelledby` linked to the "New API key" heading. Input is autofocused, wrapped in a `<label>` whose visible text is "Label" (implicit association works), placeholder "e.g. Claude Code MCP". Mint button is disabled on empty input AND on whitespace-only input (`cursor: not-allowed`, `opacity: 0.5`). Filling a name enables it; submit returns a 39-char token shown in a `.mono` block. Copy button writes to clipboard (verified 39 chars in clipboard), then flips to "Copied". Done closes the minted dialog. The new key appears in the list with the right `aria-label="Revoke key "<name>""` on a 32×32 trash button. Revoke confirm dialog mints/clears correctly.

Mobile 375×812: dialog renders at `x=7.5, width=345`, page `scrollWidth=360 < clientWidth=375` (no horizontal overflow). Dialog buttons are 36px tall (Close 36×36, Cancel 73×36, Mint key 83×36) — slightly below the 44px tap-target ideal but consistent with the rest of the app and still hittable. No PAGE ERRORS, no APP CONSOLE ERRORS (filtered for resource loads). Marking OK; the small revoke icon-button and mobile dialog-button heights are app-wide patterns rather than feature-specific bugs.
