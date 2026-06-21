# Audit run — 2026-06-21T15:27:04Z
**Mode:** TEST_ONE
**Subject:** trainer-new-opening-study-dialog
**Result:** OK+MERGED

Picked oldest non-removed feature (`trainer-new-opening-study-dialog`, lastTestedAt `2026-06-17T06:10:25Z`). Exercised the dialog on prod at 1280×800 and 375×812.

Findings (all healthy):
- Dialog renders with `role=dialog`, `aria-modal=true`, and `aria-labelledby` referencing the `New opening study` heading.
- Side picker is now a proper `<input type=radio>` pair wrapped in `<label class="role-pick">`, inside a `role="radiogroup"` labelled by "Which side does the student play?". Default-checked is White.
- Hidden radios carry `aria-label="White — You're preparing 1.e4 / 1.d4 / etc."` (and the Black equivalent) so screen readers announce the full hint.
- Keyboard focus on the radio gives the label a visible 2 px solid amber outline (via the `.role-pick:has(input:focus-visible)` rule in the prod stylesheet). Verified by tabbing from the name input and capturing a focus screenshot.
- Hover on the unchecked label adds an inset accent ring (`box-shadow: inset 0 0 0 1px var(--accent-ring)`).
- `Study name` input is wrapped in a real `<label>` with text "Study name"; autofocused on open; focus border is amber with a 3 px box-shadow halo.
- Close button is 36×36 with `aria-label="Close"`.
- Create button is disabled with whitespace-only input (`name.trim()` guard) and enables once a real name is entered.
- Sticky/static footer keeps Cancel + Create reachable: Create at y=738/774 on mobile 375×812 viewport even when the scroll body is at top or bottom.
- Mobile dialog fits within the viewport (width 345 ≤ 375, content does not overflow the dialog's 780 px max-height on 812 px screens). Side-option labels are 301×70 (well above touch-target minimums).
- No page errors. No application console errors.

Note for next rotation: the prod build is ahead of `origin/main` for this file — main still has the `<button aria-pressed>` SideOption while prod has migrated to native radios inside a `radiogroup`. The on-prod implementation is what was audited; main will catch up on the next merge.
