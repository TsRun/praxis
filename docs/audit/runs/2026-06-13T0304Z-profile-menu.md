# Audit run — 2026-06-13T03:04:16Z
**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** OK+MERGED

Re-exercised the avatar/name button in the top-right header on `/trainer/studies` at desktop 1280×900 and mobile 375×812. The trigger advertises `aria-haspopup="menu"`, `aria-controls="user-menu"`, and `aria-label="Open profile menu"`; `aria-expanded` toggles `false` → `true` on click. The menu element carries `id="user-menu"`, `role="menu"`, `aria-label="Profile menu"`. Visible content: full name, lower-cased email, three role chips (Trainer / Student / Own trainer), an "Open settings" link, a "Quick roles" editor toggle, and a "Sign out" button — all of which are present and reachable. Focus styles on the trigger are an amber `2px solid rgb(251,191,36)` outline at `2px` offset, clearly visible on the dark background.

Closing semantics are correct: pressing Escape drops the menu count to 0 and resets `aria-expanded` to `false`; clicking the page heading also closes it. Opening the Quick roles editor reveals three checkboxes — each wrapped in a `<label>` with text "Trainer" / "Student" / "Own trainer", which screen readers will associate via the label parent. Cancel restores the menu. At 375×812 the trigger sits at x=181→320 (139px wide) and the menu renders at left=20, right=320, width=300, comfortably inside the 375px viewport — no overflow left or right; `document.scrollWidth` (360) is even narrower than the viewport (375). Zero `pageerror`s and zero application console errors. Nothing actionable — rotating the cursor with an OK bookkeeping PR.
