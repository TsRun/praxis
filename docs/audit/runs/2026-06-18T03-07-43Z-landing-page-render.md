# Audit run — 2026-06-18T03:07:43Z
**Mode:** TEST_ONE
**Subject:** landing-page-render
**Result:** OK+MERGED

Selected oldest feature with `lastTestedAt=2026-06-13T15:06:00Z`. Ran the existing audit spec against `https://praxis.tsrun.dev/`. After repairing a stale selector (`div.hide-mobile` → `nav.hide-mobile`, since the desktop nav lives in a `<nav>` element), the spec passed in 3.2s.

Findings: hero h1/h2 render, three feature cards present, sign-in form renders with programmatically associated `<label for=…>` on email and password, mode toggle has `aria-pressed`, role-picker buttons carry `aria-label` (e.g. "Trainer — I coach others") and `aria-pressed`. Email focus shows the 2px accent outline + soft glow. Nav links resolve to `#features`, `/tour`, `#auth`. Hero paragraph + footer use `rgb(160,160,168)` on dark — adequate AA contrast. At 375×812 there is no horizontal overflow (scroll=360 ≤ client=375) and the desktop nav is `display:none` as expected. Zero page errors, zero app console errors. Landing page is healthy.
