# Audit run — 2026-06-12T09:07:37Z
**Mode:** TEST_ONE
**Subject:** trainer-students-filters
**Result:** IMPROVED+PENDING+self-merge-after-verification

Exercised All / Linked / Invited segmented control on /trainer/students at 1280 and 375x812. Group has `role="group"` with `aria-label="Filter students by status"`; `aria-pressed` toggles correctly across all three tabs. Active "All" reads rgb(236,236,239) on rgba(255,255,255,0.06) inset; inactive "Linked" reads rgb(160,160,168) — distinguishable. Search input has `aria-label="Find student by nickname"`. Invited tab renders the documented "No invited students" empty state with role="status" aria-live="polite". No `pageerror`, no application console errors.

Mobile 375x812: `scrollWidth=360 < clientWidth=375` (no horizontal overflow). However, the segmented tab buttons measure **28px tall** on mobile — below the 32px floor flagged by the spec and well under the WCAG 2.5.5 (Level AAA) 44px touch target guideline. Fix: added a `@media (max-width: 640px)` rule in `src/index.css` bumping `.segmented button, .segmented a` to `height: 36px; padding: 0 14px;`. This mirrors the existing pattern that bumps `.input` to 44px on the same breakpoint and applies uniformly to every segmented control across the app (trainer studies, students, student dashboard, etc.). Typecheck + 48 unit tests + audit spec all pass.
