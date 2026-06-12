# Audit run — 2026-06-12T06:02:54Z
**Mode:** TEST_ONE
**Subject:** student-dashboard-assignments-tabs
**Result:** OK+MERGED

Exercised the Active/Completed segmented control on /student/dashboard at 1280 and 375x812. Group has `role="group"` and `aria-label="Filter assignments by state"`. `aria-pressed` toggles cleanly between the two buttons; the `.active` class swaps and Space activates the focused tab. Keyboard Tab onto the buttons triggers `:focus-visible` with a 2px amber outline (rgb(251,191,36)) at 2px offset; programmatic `.focus()` correctly does not (matches platform UX). Active label rgb(236,236,239) on rgba(255,255,255,0.06) and inactive rgb(160,160,168) on the dark card both pass AA on the card surface.

Mobile 375x812: `scrollWidth=360 < clientWidth=375` (no overflow). The "All assignments" header row wraps so the count + segmented control stack under the heading; both tabs remain comfortably tappable. No `pageerror`, no application console errors (only resource-loading entries, which the policy waives). No improvement opportunity observed within the feature's scope — bookkeeping bump only.
