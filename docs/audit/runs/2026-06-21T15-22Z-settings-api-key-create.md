# Audit run — 2026-06-21T15:22:21Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** OK+MERGED

Picked oldest non-removed feature (`settings-api-key-create`, lastTestedAt `2026-05-31T18:13:56Z`) and exercised the full create → copy → revoke loop against prod at viewport 1280×800 and 375×812.

Findings (all healthy):
- `/settings` returns 200 and renders the `API keys` heading.
- The `New API key` dialog has `role=dialog`, `aria-modal=true`, and `aria-labelledby` referencing the `New API key` heading.
- The `Label` input is wrapped in a `<label>` ("Label") and is autofocused on open.
- Mint button is disabled with `cursor: not-allowed` and `opacity: 0.5` for empty and whitespace-only input; enables once a real label is entered.
- Minting returns a 39-char token, the Copy button writes it to the clipboard (39 chars verified) and switches to a `Copied` state. Done closes the dialog cleanly.
- The new row appears in the API keys list; the Revoke button has both `title` and `aria-label` set ("Revoke key \"<name>\""). Cleanup via Revoke confirm works and the row disappears.
- Mobile (375×812): no page-level overflow (scrollWidth 360 ≤ clientWidth 375). Dialog renders within viewport (345w, height 209). Cancel/Mint buttons keep their 36px height. The (×) close keeps a 36×36 hit area.
- No page errors, no application console errors.
