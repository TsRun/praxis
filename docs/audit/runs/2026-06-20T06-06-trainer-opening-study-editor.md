# Audit run — 2026-06-20T06:06:00Z
**Mode:** TEST_ONE
**Subject:** trainer-opening-study-editor
**Result:** IMPROVED+PENDING

Test pass on prod. Editor renders title, Tree/Chapters segmented control, Import from Lichess / Import games / Assign to student buttons, plus the chess board, Candidate replies card, and Line · siblings card with no page errors and no app console errors. Mobile (375x812) shows no horizontal overflow (scrollWidth 360 < clientWidth 375) and all header buttons remain visible. One UI quality issue stood out from the mobile screenshot: the "Line · siblings at each ply" card header is a flex row with `justify-content: space-between` but no `flex-wrap` and no `gap`. On 375px the h2 wraps to two lines ("Line · siblings at each" / "ply") and the "click any chip to jump" hint squishes vertically-centered beside the broken title. Added `flexWrap: 'wrap'` + `gap: 8` and switched `alignItems` to `baseline` so on narrow viewports the hint falls below the h2 instead of forcing the title to wrap, while desktop layout is unchanged.
