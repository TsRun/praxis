# Audit run — 2026-06-15T12:11:52Z
**Mode:** TEST_ONE
**Subject:** trainer-student-detail
**Result:** IMPROVED+PENDING

Exercised the trainer student detail route on prod (https://praxis.tsrun.dev/trainer/students/1). Route returns 200, page errors 0, app console errors 0, mobile overflow OK (375 < 375+1). The bot account isn't linked to that student id, so the page renders the access-denied error card with role="alert", h1 "Couldn't load this student", a meta-text reason, and a "← Back to students" affordance.

A11y observation drove the fix: the back affordance was rendered as `<Link><Btn variant="secondary">…</Btn></Link>`, producing `<a href><button type="button">…</button></a>` in the DOM. That's invalid HTML (interactive content nested in an anchor) and creates two tab stops for one navigation. Fix: render the Link itself with `className="btn btn-secondary"` instead of wrapping a Btn inside, matching the established pattern used by LandingPage / TourPage. Visual appearance unchanged (same .btn rules apply to `<a>`).

Typecheck ✅, npm test ✅ (48/48), audit spec on PR branch ✅ (passes against prod pre-deploy; logs nested-button observation, asserts route health + mobile + focus indicator).
