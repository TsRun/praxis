# Audit run — 2026-06-05T06:06:00Z
**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** OK+MERGED

Exercised the trainer profile menu on prod at viewports 1280×900 and 375×812.
Trigger has `aria-haspopup="menu"`, `aria-controls="user-menu"`, `aria-label="Open profile menu"`, and a visible 2px amber focus outline.
Opened menu has `role="menu"`, `aria-label="Profile menu"`, and renders user name, email, three role chips, Open settings link, Quick roles button, and Sign out button.
Closes correctly on Escape and on outside click. Quick roles checkboxes are wrapped in `<label>` elements so labels remain associated.
On 375px mobile the menu measures 300px wide, anchors to the trigger's right edge (right=320, left=20), and stays inside the viewport with no horizontal document overflow.
No page errors, no application console errors. Nothing to improve this rotation.
