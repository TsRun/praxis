# Audit run — 2026-06-15T09:08:00Z
**Mode:** TEST_ONE
**Subject:** trainer-opening-study-editor
**Result:** IMPROVED+PENDING

Exercised the opening study editor on prod (https://praxis.tsrun.dev/trainer/studies/opening/16). All primary controls render at both 1280 and 375 viewports; no uncaught page errors and no APPLICATION console errors. Board renders 478x478 desktop / 294x294 mobile. No horizontal overflow at 375 (scrollWidth 360 < clientWidth 375).

A11y observation drove the fix: `.link`-styled buttons used in the editor (`Set opening prefix…`, `Edit prefix`) have a color+hover-underline style but no `:focus-visible` rule, so keyboard users tabbing through these get no visible focus indicator. Added a `:focus-visible` rule for `a.link, button.link` in src/index.css (2px accent outline + offset + underline). Smallest possible change; matches the existing pattern used by `.btn:focus-visible`.

Typecheck ✅, npm test ✅ (48/48), audit spec on PR branch ✅.
