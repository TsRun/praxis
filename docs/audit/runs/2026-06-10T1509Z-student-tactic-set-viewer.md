# Audit run — 2026-06-10T15:09:00Z
**Mode:** TEST_ONE
**Subject:** student-tactic-set-viewer
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised `/student/study/tactic/7` against prod as the bot student. API returned 200; the only tactic set assigned to the bot account is currently empty (zero puzzles), so the viewer rendered its empty-state branch: H1 set name, an "End of set"-style `<Card>` with H2 "No puzzles yet", a meta paragraph ("This tactical set is empty. Your trainer hasn't added any puzzles to drill."), and a primary "Back to dashboard" button. Focus ring visible on first focusable (2px solid amber, rgb(251,191,36)). Mobile pass at 375×812 had no horizontal overflow (scrollWidth 360 < innerWidth 375). No `pageerror`s; no app console errors (only the waived `Failed to load resource: 401` floor).

UI observation: the header above the empty-state card still rendered two redundant counter chips — `0 / 0` (puzzle index) and `0 solved` — alongside the "Tactical set" label and the set name. With zero puzzles in the set those chips communicate nothing the body card doesn't already say (and the explicit "No puzzles yet" message). They add visual noise to what should be a calm "nothing here yet" screen.

Fix: in `src/student/TacticSetViewer.tsx` the two counter chips (`{n}/{total}` and `{solved} solved`) are now wrapped in `set.puzzles.length > 0 && …` and only render when the set actually contains puzzles. The non-empty branch is unchanged. Also tightened the spec to recognise the "No puzzles yet" empty state alongside the normal board / "End of set" branches so future runs of this audit cleanly assert empty-set parity.
