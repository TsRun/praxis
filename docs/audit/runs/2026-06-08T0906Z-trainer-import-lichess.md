# Audit run — 2026-06-08T09:06:40Z
**Mode:** TEST_ONE
**Subject:** trainer-import-lichess
**Result:** OK+MERGED

Re-tested the Lichess import dialog at https://praxis.tsrun.dev/trainer/studies. The previous spec asserted on `button[aria-pressed]` side-picker buttons; the dialog has since been refactored to a proper `<div role="radiogroup" aria-labelledby="…">` containing two visually-hidden `<input type="radio">` controls wrapped in `label.role-pick` tiles. The new spec was rewritten against that structure and now passes cleanly. Observations:

- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-label="Import from Lichess"`, header has visible h2 and 36×36 close button.
- Name input: implicit `<label>` wrap with visible "Study name" text — accessible name resolves through the wrapping label.
- Hint paragraph reads: "Name the study and pick the student's side. The next screen will ask for the Lichess PGN."
- Side picker: `aria-labelledby` resolves to "Which side does the student play?". Two radio inputs (`w` default-checked, `b`). Tab from the name input lands on the first radio.
- Focus visibility: `.role-pick:has(input:focus-visible)` paints a 2px solid `rgb(251,191,36)` outline at `outline-offset: 2px` on the visible label — focus is plainly visible despite the radio being clipped.
- CTA "Create + import PGN →" is disabled when the name is empty, enabled after filling.
- Escape closes the dialog.
- Mobile 375×812: dialog box 345 wide centered with 8/8 inset gutter, no horizontal overflow (scrollWidth 360 ≤ clientWidth 375), side-option labels stack to two 70px-tall rows (good tap target), sticky CTA footer remains within the viewport at top 728 / bottom 764.
- No `pageerror` events, no application-level console errors.

No code change; bookkeeping only.
