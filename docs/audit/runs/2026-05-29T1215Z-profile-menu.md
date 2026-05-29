# Audit run — 2026-05-29T12:15:22Z
**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** IMPROVED+PENDING+pr-not-yet-open

Ran `tests/audit/profile-menu.spec.ts` against https://praxis.tsrun.dev. Test passed: trigger has correct ARIA (haspopup/expanded/controls/label), focus ring visible, ESC closes, outside click closes, menu fits at 375x812 (300px width, no horizontal overflow), no page or app console errors.

Observed gap: the Quick roles editor's three checkboxes were each individually labeled by their wrapping `<label>` but the "Your roles" heading wasn't programmatically associated with the group. Added `role="group"` + `aria-labelledby` in `src/auth/UserMenu.tsx::RolesEditor`. Typecheck + 37 unit tests pass.
