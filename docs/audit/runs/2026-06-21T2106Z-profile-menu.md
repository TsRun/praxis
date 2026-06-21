# Audit run — 2026-06-21T21:06:38Z

**Mode:** TEST_ONE
**Subject:** profile-menu
**Result:** IMPROVED+PENDING+verification

UI/a11y pass on the profile menu (top-right avatar trigger on every authed page). Sign-in, menu open via click, Escape close + return-focus to trigger, outside-click close, Quick Roles editor open/cancel, and mobile 375x812 layout all pass. No console or page errors. Trigger focus indicator (`outline: 2px solid rgb(251,191,36)` with 2px offset) is visible. On 375px viewport the menu sits within the viewport (left 20, right 320, width 300) with no horizontal overflow.

The actionable finding: in `src/auth/UserMenu.tsx`, the popover declares `role="menu"` (and the trigger advertises `aria-haspopup="menu"`), but none of the actionable children — `Open settings` link, `Quick roles` button, `Sign out` button — carry `role="menuitem"`. WAI-ARIA APG requires that a `menu` contain `menuitem`/`menuitemcheckbox`/`menuitemradio` children; otherwise the container is announced as a "menu" with zero items. The test confirmed the trigger is properly wired (`aria-haspopup=menu`, `aria-controls=user-menu`, `aria-expanded` flips on toggle) and the popover correctly carries `aria-label="Profile menu"`, so the only thing missing for a minimally-conformant menu pattern is the `role="menuitem"` annotation on the three actionable items.

Fix: add `role="menuitem"` to the `Open settings` `Link`, and to the `Quick roles` and `Sign out` `Btn`s inside the open-menu branch of `UserMenu.tsx`. No visual change; no behavior change for sighted/mouse users; screen-reader users now hear the menu correctly enumerate its three actions.
