# Audit run — 2026-06-12T15:12:15Z
**Mode:** TEST_ONE
**Subject:** trainer-invite-student
**Result:** IMPROVED+PENDING (PR open)

Exercised the Invite student dialog on /trainer/students at desktop 1280×720 and mobile 375×812. Dialog a11y is solid (role=dialog, aria-modal=true, aria-labelledby linked to the visible h2, Esc closes, focus is trapped, autoFocus lands on the first input). The nickname input has `aria-label="Student nickname"`, the email input has a proper `<label htmlFor>`, and the "Invite by email" inline link reads in accent yellow distinct from the surrounding hint-box dim text. No `pageerror` events, no application-level console errors, no horizontal overflow on mobile.

Two real defects on the *email* form's "Suggested nickname" label:

1. **Layout — mobile wrap is broken.** The `<label>` declared `display: flex; gap: 6; alignItems: baseline` with the parenthetical "(we'll suggest this if they don't pick their own)" as a sibling `<span>`. On a 375×812 viewport the dialog content area is ~297px wide; flex prevents the parenthetical from flowing inline with the label, and instead lays the two children side-by-side at fixed columns, each wrapping to two lines (`Suggested\nnickname  (we'll suggest this if they don't pick\n  their own)`). That stacks the label awkwardly and adds 34.78px label height to a dialog already tight on mobile.

2. **Contrast — fails WCAG-AA.** The parenthetical span uses `color: var(--text-faint)` (#6b6b73) on `--card-bg` (#141416) at 12px regular. Measured contrast ratio ≈ 3.27:1, below the 4.5:1 floor for normal text. (The label itself is `--text-dim` (#a0a0a8) which is fine at ~6.9:1.)

Fix in `src/trainer/InviteStudentDialog.tsx` (~5 lines): drop the flex/gap/alignItems on the label so the parenthetical flows naturally and wraps below "Suggested nickname" on narrow widths, and change the span color from `--text-faint` to `--text-dim` so the 12px text meets WCAG-AA. The spec was extended with a `SUGGESTED LABEL` log so the change is verifiable post-deploy (still passes against pre-fix prod). PR opened.
