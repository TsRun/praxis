# Audit run — 2026-06-03T18:18:00Z
**Mode:** TEST_ONE
**Subject:** trainer-opening-study-editor
**Result:** IMPROVED+PENDING

Exercised /trainer/studies/opening/<id> end-to-end at desktop 1280 and mobile
375x812. No page errors, no app console errors, no overflow. Editor renders
header (editable title, side/positions/chapters chips), Tree/Chapters segmented,
Import from Lichess, Import games, Assign to student, crumbs, board (.cg-wrap
478px desktop / 294px mobile), Candidate replies card and Line · siblings card.
Chapters mode renders sidebar + empty walker without errors.

Observation: the Candidate replies card header rendered an "Add move" button
with no `onClick` handler — pure dead UI. Clicking it does nothing while the
empty-state copy and the card body both correctly direct users to drag on the
board. Removed the no-op button (and the now-unused `IconPlus` import) so the
card no longer promises an action that isn't there. The empty-state hint
"No replies yet — drag a piece on the board to add one." plus the dashed-box
empty state still guide the user.
