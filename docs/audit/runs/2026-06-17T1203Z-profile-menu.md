# Audit run — 2026-06-17T12:03:10Z
**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** OK+MERGED

Exercised the profile menu dropdown at desktop (1280x900) and at
viewport 375x812. The trigger is a `button` with `aria-haspopup="menu"`,
`aria-controls="user-menu"`, `aria-label="Open profile menu"`, and a
toggling `aria-expanded`. On `:focus` it draws a 2px solid amber outline
(`rgb(251, 191, 36)`) with 2px offset — clearly visible.

Opening the menu reveals the user's display name, email, three role
chips (Trainer / Student / Own trainer), an Open settings link, a
Quick roles button, and a Sign out button. The menu has `role="menu"`
with `aria-label="Profile menu"`. Pressing Escape closes the menu and
flips `aria-expanded` back to `false`; clicking outside also closes it.
The Quick roles editor renders checkboxes inside wrapping `<label>`
elements with the role names, which is a valid label association even
though the inputs themselves have no id/aria-label.

On mobile 375 the menu is 300px wide and positions itself entirely
within the viewport (left=20, right=320, no overflow); document
scrollWidth stays under clientWidth. No page errors, no application
console errors. Marking OK with no source change.
