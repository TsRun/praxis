# Audit run — 2026-06-22T03:04:06Z

**Mode:** TEST_ONE
**Subject:** trainer-new-tactic-set-dialog
**Result:** OK+MERGED

UI/a11y pass on the New tactical set dialog (opened from /trainer/studies → New study → Tactical set). Login succeeds, dialog opens with `role="dialog"` and `aria-labelledby` pointing at the "New tactical set" title. The Set name input has `id="tactic-set-name"`, a matched `<label for>` ("Set name *"), `required`, `aria-required="true"`, and `aria-describedby="tactic-set-name-help"` wiring the helper paragraph as its description. The header close affordance is a real `<button>` carrying `aria-label="Close"`. No console errors and no uncaught page errors during the run.

Focus indicator on the name input is strong and clearly visible: 2px solid `rgb(251,191,36)` outline plus matching `box-shadow` halo and amber border on focus. Form validation works: the "Create set" button is `disabled` when the name is empty and enabled once the field is filled. Keyboard tab order from the name input progresses through Cancel → Create set → Close (X), and every stop reports `matches(:focus-visible) === true`, so AT users get a clear focus ring on each control.

Mobile (375x812) pass: no horizontal overflow (`scrollWidth=360, clientWidth=375`). The dialog reflows to width 345 within the 375 viewport (8px gutter on each side), height 283 — comfortably above the keyboard area — and stays vertically centred with the helper text legible at 13px/`rgb(160,160,168)` against the dark surface. Live-region probe inside the dialog returns empty, but since the only failure mode surfaced today is "Create set" being disabled until a name is typed (no inline error string ever renders), there is nothing for a live region to announce; no action needed.
