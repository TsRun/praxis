# Audit run — 2026-06-05T12:09:24Z
**Mode:** TEST_ONE
**Subject:** trainer-new-tactic-set-dialog
**Result:** OK+MERGED

Re-ran the audit spec for the "New tactical set" dialog opened from `/trainer/studies → New study → Tactical set` against production. The dialog has `role="dialog"`, `aria-modal`, and `aria-label="New tactical set"`. The name input is properly associated: wrapping `<label>` with `htmlFor="tactic-set-name"` (labelFor count = 1), `required + aria-required="true"`, `aria-describedby="tactic-set-name-help"` pointing at the helper paragraph. The header close button has `aria-label="Close"`. Focus styling on the input is visible: 2px amber outline + amber 3px box-shadow ring + amber border. The Create button is correctly `disabled` while the trimmed name is empty and enables after typing; Tab order goes input → Cancel → Create set → header Close, all with `:focus-visible`. The dialog has no stale live regions, so the inline `role="alert"` only appears on real error states.

Mobile pass at 375x812: dialog measured 345×275 at left=8/right=353 (8px gutters per side, no clipping), document scrollWidth 360 < clientWidth 375 (no horizontal overflow). No `pageerror` events, no application console errors (resource 4xx waived per policy). Helper text (`#a0a0a8` on `#141416`) clears WCAG-AA contrast at ~7:1. Nothing actionable; marking OK.
