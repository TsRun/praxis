# Audit run — 2026-06-21T09:09:39Z
**Mode:** TEST_ONE
**Subject:** trainer-invite-student
**Result:** OK+MERGED

Re-exercised the "Invite student" dialog on `/trainer/students` against
production. The CTA in the page header (137×36, amber on dark-brown ink)
opens a real `role="dialog" aria-modal="true" aria-labelledby` modal
backed by `.modal-backdrop` with rgba(0,0,0,0.72) + `backdrop-filter:
blur(8px)`. The dialog panel paints as solid `rgb(20,20,22)` at
`opacity: 1` (verified by computed style) — the earlier impression of
bleed-through in the first screenshot was the 140ms fadein animation
caught mid-frame; with a 250ms settle the panel is fully opaque and the
underlying page is properly blurred.

Nickname mode: input has `id="invite-nickname"`, autofocus, and
`aria-label="Student nickname"` (no visible `<label>`, but the
accessible name is set). "Send invite" is correctly disabled when the
field is empty, with `opacity: 0.5` + `cursor: not-allowed` — clear
disabled affordance. Switching to email mode swaps the body and reveals
the EmailForm with proper visible `<label htmlFor>` on both the email
and "Suggested nickname" inputs (labels-for count = 1 each). Email input
is `type="email"`; "Send invite" only enables once the value contains
`@`. Typing `test@example.com` auto-fills the suggested nickname as
`test`. The email input shows a strong focus state — solid 2px amber
outline plus a 3px box-shadow glow.

Close button is a 36×36 button with `aria-label="Close"`. Escape closes
the dialog. Backdrop click closes the dialog without dismissing the
input value of the underlying page. Switch-mode buttons ("Invite by
email" / "← Search by nickname instead") work bidirectionally.

Mobile (375×812): dialog renders at x=7.5, width=345 — fits the viewport
with even side gutters. No horizontal overflow (scroll 360 ≤ client
375). Send-invite, Cancel, and Close all maintain a 36px tap height on
mobile. Switch-mode link is 188×18.84 (small but it's a text link, not a
primary action). Zero page errors, zero application console errors on
the prod run. No UI regression observed.
