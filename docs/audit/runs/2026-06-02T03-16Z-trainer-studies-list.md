# Audit run — 2026-06-02T03:16:02Z
**Mode:** TEST_ONE
**Subject:** trainer-studies-list
**Result:** IMPROVED+PENDING+PR

Exercised /trainer/studies at 1280 and 375. No console errors, no page errors, no horizontal overflow (mobile scrollWidth 360 vs client 375), all sections rendered, search/filter/view-toggle a11y attributes are present. The dedicated check this rotation was card interactivity: the three study cards (Opening / Game / Tactical) wrap a `<Link>` with `cursor: pointer` on the inner card and a `transition: transform 120ms ease` inline style — but the className `study-card-hover` referenced by `OpeningStudyCard` had **no matching CSS rule anywhere in the repo**. The hover probe confirmed it: `transform`, `box-shadow`, and `border-color` are identical at rest vs hovered (`STUDY CARD hover changed: false`). `GameStudyCard` and `TacticSetCard` didn't even apply the class. Net effect: three clickable cards with pointer cursor but no visual feedback on hover.

Fix: defined `.study-card-hover` (+`:hover`) in `src/index.css` with a 1px lift + brighter 1px ring + soft shadow, applied the className to all three card types, and dropped the now-redundant inline transition from `OpeningStudyCard`. Typecheck and `npm test` (48/48) pass locally. The spec change only adds observation logging — it does not assert hover changed, so it still passes against the pre-deploy prod build on the PR branch.
