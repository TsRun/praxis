# Audit run — 2026-06-05T03:08:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-opening-study-dialog
**Result:** OK+MERGED

Re-tested the New opening study dialog on prod. The dialog's structure changed since the last audit (PR #138, June 1): the side picker is now an ARIA `radiogroup` with two visually-hidden radio inputs wrapped in `<label class="role-pick">`, replacing the old button-based picker — strictly an a11y upgrade. The audit spec was rewritten to match.

Observed: name input is correctly wrapped in `<label>Study name</label>`; focus styles are clear (solid 2px gold outline plus translucent ring). The radiogroup is `aria-labelledby` the visible "Which side does the student play?" heading; arrow-key navigation switches selection (`ArrowRight` moves from white → black, as expected by WAI-ARIA). Wrapping label shows a visible focus ring (2px gold outline, 2px offset) when the hidden radio is keyboard-focused. Create button is disabled with an empty name and enables on input. At 375×812 the dialog measures 345×780 with no horizontal overflow; both side options render at 301×70. No app console errors, no page errors. Marking the feature OK — bookkeeping bump only.
