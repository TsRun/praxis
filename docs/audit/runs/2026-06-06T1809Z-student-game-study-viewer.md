# Audit run — 2026-06-06T18:09Z
**Mode:** TEST_ONE
**Subject:** student-game-study-viewer
**Result:** IMPROVED+PENDING+verify

Exercised /student/study/game/4 as the audit bot. Happy path renders correctly:
h1 "Audit run — game editor probe", PGN/player chips, ChessBoard, MoveList ("Move list" h2), and Progress panel. Desktop layout fine. Mobile 375×812: no horizontal overflow (docW=360, body overflow-x=clip). Focus visible (yellow 2px outline on top-bar link). Only console error is a waived browser 401 from the unauthenticated landing probe.

Code-quality observation: GameStudyViewer mirrored OpeningStudyViewer's pre-#189 shape — `student.game(numId).then(setStudy)` had no rejection handler, so an API failure left the user stuck on a bare "Loading…" placeholder, and that placeholder lacked `role="status"`/`aria-live` so screen readers wouldn't announce it. Applied the same smallest-change fix that #189 applied to the opening viewer: added a `loadError` state with a `.catch`, a `Card role="alert"` recovery card ("Couldn't load this study" + back-to-dashboard link) gated on the error, and `role="status" aria-live="polite"` on the loading placeholder. Added a `userVisibleErrorDetail` helper to strip leaky Postgres-internal strings before display. +56 / −5 in src/student/GameStudyViewer.tsx. Typecheck + 48 unit tests green.
