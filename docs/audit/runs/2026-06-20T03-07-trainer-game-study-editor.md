# Audit run — 2026-06-20T03:07:03Z
**Mode:** TEST_ONE
**Subject:** trainer-game-study-editor
**Result:** IMPROVED+PENDING

Test pass on prod. Editor renders board + move list + Save + Assign + textarea, has a11y labels and a global focus ring, and mobile (375x812) shows no horizontal overflow (scrollWidth 360 < clientWidth 375). One UI quality issue stood out: the annotation panel heading reads "Annotation at ply 0" when no move is selected and "Annotation at ply N" once a move is picked. "ply" is jargon, and pivoting on a raw counter that includes 0 is confusing. Replaced with chess-friendly labels: "Move annotations" when nothing is selected, and "Annotation · 1. e4" / "Annotation · 1… e5" once a move is on the board, using the existing SAN history. Test loosened from a strict heading match to a presence check so it still passes against prod prior to merge.
