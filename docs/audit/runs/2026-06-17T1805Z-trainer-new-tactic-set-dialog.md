# Audit run — 2026-06-17T18:04:54Z
**Mode:** TEST_ONE
**Subject:** trainer-new-tactic-set-dialog
**Result:** OK+MERGED

Signed in as the audit bot and opened the New study → Tactical set dialog
from /trainer/studies at desktop (1280x800) and at viewport 375x812. The
dialog renders with `role="dialog"` and `aria-labelledby` pointing at the
"New tactical set" heading; the name input is wrapped in a real
`<label>Set name *</label>`, carries `required` plus `aria-required="true"`,
and is wired to its help text via `aria-describedby="tactic-set-name-help"`.
The Close (X) button has `aria-label="Close"`, the helper paragraph is
rgb(160,160,168) at 13px (clears AA on the dialog's near-black surface),
and the Create set button is correctly disabled while the name field is
empty and enables once filled.

Keyboard order from the name input goes Name → Cancel → Create set →
Close (X), each landing with `:focus-visible` and the standard 2px amber
outline plus a soft amber box-shadow halo. At 375x812 the dialog reflows
to a 345px-wide card (8px gutters) inside a 375px viewport — no
horizontal overflow (scrollWidth 360 vs clientWidth 375). No page errors
and no application console errors (only the usual `Failed to load
resource` browser-level waivers). Marking OK with no source change.
