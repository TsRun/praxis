# Audit run — 2026-06-10T12:07:22Z
**Mode:** TEST_ONE
**Subject:** student-game-study-viewer
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised `/student/study/game/6` against prod as the bot student. API returned 200, the viewer rendered `h1 = "Audit run — game editor probe"`, two board containers, the Move list `<h2>` and Progress `<h3>`, and the move list populated (1.e4 e5 / 2.Nf3 Nc6 / 3.Bb5 a6 / 4.Ba4 Nf6 / 5.O-O Be7). Focus ring visible on first focusable (2px solid amber). Mobile pass at 375×812 had no horizontal overflow (scrollWidth 360 < innerWidth 375). No `pageerror`s, no app console errors (the one 401 is the waived `Failed to load resource:` floor).

UI observation: the comments toggle next to "Move list" was labeled with bare lowercase **"comments"**. Every sibling label in the same panel uses sentence/proper case ("Move list", "Progress") and the move list header uses all-caps "MOVES"; the lone lowercase "comments" reads as unfinished copy. Visible in both desktop and mobile screenshots.

Fix: in `src/student/GameStudyViewer.tsx` (line 225) the checkbox label text changed from `comments` to `Show comments`. The label still wraps the `<input>` (the existing accessible name pattern), and the meaning sharpens — the toggle reveals annotation cards, so "Show comments" matches the affordance.
