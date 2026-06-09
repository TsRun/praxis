# Audit run — 2026-06-09T12:15:23Z
**Mode:** TEST_ONE
**Subject:** landing-page-render
**Result:** OK+MERGED

Playwright spec passed against prod. Hero (`Build chess studies.`), feature cards (Opening trees / Game studies / Spaced repetition), and the auth form (Sign in / Create account toggle, role-picker with `aria-pressed` + `aria-label`) all render. No page errors, no app-level console errors. Email + password inputs are programmatically labelled (`labelsFor=1`) and `autocomplete="email"` is set on the email field; focus on the email input shows a 2px solid amber outline (`rgb(251,191,36)`). Mode toggle exposes `aria-pressed`. Footer color `rgb(160,160,168)` on body `#0a0a0c` resolves to ≈7.9:1 — passes WCAG-AA for normal text.

Mobile viewport (375x812) renders without horizontal overflow (scrollWidth=360 ≤ client=375 — gap is `scrollbar-gutter: stable` reserving 15px). The hero board (`.board-cap-400`) renders inside its rounded card, hero stack falls to a single column, and the auth card spans the column nicely. The desktop nav links (Features / Tour / Sign in) carry the previously-added `.landing-nav-link` class so they keep the hover background + amber `:focus-visible` outline. Nothing to fix this round — declaring OK and bumping `lastTestedAt`.
