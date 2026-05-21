# Tactical sets — design

A third study kind alongside opening (tree) and game (PGN). Trainers author
flat sets of puzzles by hand; students walk the set front-to-back and the
server logs whether each attempt was correct.

## Decisions (from brainstorming)

- Source: **trainer-authored from FEN + solution**. No Lichess Puzzle DB.
- Drill: **linear playthrough, no SR**. One attempt per puzzle counts;
  solved puzzles do not come back.
- Solution shape: **multi-ply SAN line**. Student plays each of their
  moves; the board auto-plays the expected opponent reply between them.
- Assignable like opening/game studies (`assignment.study_kind = 'tactic'`).
- No themes, no difficulty, no hints — minimal MVP, easy to extend later.

## Schema (`server/schema.sql` + `server/migrations/0002-tactic-sets.sql`)

```sql
CREATE TABLE IF NOT EXISTS tactic_set (
  id          BIGSERIAL PRIMARY KEY,
  owner_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tactic_puzzle (
  id            BIGSERIAL PRIMARY KEY,
  set_id        BIGINT NOT NULL REFERENCES tactic_set(id) ON DELETE CASCADE,
  ord           INTEGER NOT NULL,
  fen           TEXT NOT NULL,
  solution_san  TEXT[] NOT NULL,
  comment_md    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tactic_puzzle_set ON tactic_puzzle(set_id, ord);

CREATE TABLE IF NOT EXISTS tactic_attempt (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  puzzle_id     BIGINT NOT NULL REFERENCES tactic_puzzle(id) ON DELETE CASCADE,
  correct       BOOLEAN NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tactic_attempt_user_puzzle
  ON tactic_attempt(user_id, puzzle_id);
```

The existing `assignment.study_kind` is `TEXT` with a `CHECK IN ('opening','game')`
constraint. The migration drops + re-adds the check to include `'tactic'`.

## Backend endpoints

Trainer (`requireAuthor`):

- `GET    /api/trainer/studies/tactic` — list owner's sets with `puzzle_count`
- `POST   /api/trainer/studies/tactic` — body `{ name }` → `{ id }`
- `GET    /api/trainer/studies/tactic/:id` — set + ordered puzzles
- `PUT    /api/trainer/studies/tactic/:id` — body `{ name }` rename
- `DELETE /api/trainer/studies/tactic/:id` — cascade delete
- `POST   /api/trainer/studies/tactic/:id/puzzles` — body
  `{ fen, solution_san: string[], comment_md? }` → `{ id }`. Validates the
  solution is legal from the FEN by replaying with `chess.js`; rejects 400
  if any move is illegal.
- `PUT    /api/trainer/studies/tactic/:id/puzzles/:pid` — same validation
- `DELETE /api/trainer/studies/tactic/:id/puzzles/:pid`

Student (`requireUser` + access check on the assignment / ownership):

- `GET  /api/student/studies/tactic/:id` — returns set + puzzles + a
  `solved_ids: number[]` of puzzle ids the student has answered correctly
  at least once.
- `POST /api/student/studies/tactic/:id/attempt` — body
  `{ puzzle_id, correct }`; logs one row in `tactic_attempt`. The server
  does not re-validate the solution (the client already does). Returns
  `{ ok: true }`.

Progress for `/api/student/assignments` adds a `'tactic'` branch:
`100 * distinct(puzzle_id where correct) / puzzle_count`. Trainer's studies
list `annotation_count` for a tactic set = puzzle count.

## Frontend

Routes (added in `TrainerLayout` + `StudentLayout`):
- `/trainer/studies/tactic/:id` → `TacticSetEditor`
- `/student/study/tactic/:id` → `TacticSetViewer`

API client (`src/lib/api.ts`): a `trainerTactics` object mirroring
`trainerStudies` / `trainerGames`, plus `student.tactic*` for the viewer.

**StudiesPage:**
- Re-add the `IconBolt` "Tactical study" item in the "+ New study" menu;
  click → opens `NewTacticSetDialog` (just a name input) → on create,
  navigate to the editor.
- Re-add the `Tactic` filter chip in the Segmented filter.
- Re-add the `<Section title="Tactical sets">` between game and assignment
  sections. Empty state has an Add card that opens the same dialog.
- `AssignStudyDialog` already takes `study_kind`; just include tactic sets
  in its option list.

**TacticSetEditor** (the workhorse):
- Header: rename + delete + assign-to-student.
- Left column: ordered list of puzzles (`#1`, `#2`, …) with FEN preview
  and "delete" icon. Click to load the puzzle into the right pane.
- Right column "Add puzzle" mode:
  1. Trainer pastes a FEN into an input. Validate (chess.js); show the
     position on a Chessground board with `turnColor` set from the FEN.
  2. Trainer drags moves on the board. Each drag is validated by a
     chess.js instance seeded from the FEN. Each accepted move is pushed
     into a SAN array displayed under the board as a movechip row
     (`1. Qxh7+ Kxh7 2. Rh3#`). An "undo" button pops the last move.
  3. Optional comment_md textarea.
  4. "Save puzzle" disabled until `solution_san.length >= 1`; on click,
     POST and re-fetch the set.
- Right column "Edit puzzle" mode (when clicking a list item): same UI
  pre-populated, PUT on save.

**TacticSetViewer** (student):
- Top: "Puzzle N of M · solved K/M" + a "Skip" button.
- Center: Chessground board at current puzzle's FEN; legal moves enforced
  via chess.js dests; user can only play their side.
- On student move: compare SAN against `solution_san[expectedIndex]`.
  - Wrong → flash red, mark the attempt `{correct:false}`, show the full
    solution as a movechip row, show comment, expose "Next puzzle" CTA.
  - Right → flash green, advance `expectedIndex`. If next index is an
    opponent ply (i.e. odd index for "white to solve" puzzles, or vice
    versa), the board auto-plays `solution_san[expectedIndex]` after a
    400 ms beat, then advances again. When all plies are consumed, mark
    attempt `{correct:true}`, show "Solved" banner + "Next puzzle" CTA.
- "Next puzzle" advances ordinal; if past the last puzzle, show the
  end-of-set summary (`solved K/M`).

## Error handling / edge cases

- **Invalid FEN on add**: client + server both call `new Chess(fen)`; bad
  FEN throws → 400 with a clear message; UI surfaces it.
- **Invalid solution from FEN**: server replays each SAN — on a throw or
  null move return, 400.
- **Empty set**: editor still saves; viewer shows "No puzzles yet" with a
  link back to dashboard.
- **Student plays a non-solution but legal move**: treated as wrong. The
  trainer's authored line is canonical for MVP. Multi-solution support is
  a follow-up.
- **Skip**: logs `correct:false` and advances. Same as a wrong attempt.
- **Cascade delete**: set delete → puzzles + attempts cascade. The
  `assignment` row (study_kind='tactic', study_id=set.id) becomes a soft
  orphan; the viewer hits `/api/student/studies/tactic/:id` which
  returns 404 → UI shows "this set was deleted by the author".

## Testing

- **Unit (server)**: a new `tests/unit/server/tactic.test.ts` covers:
  - solution legality validation accepts a real mate-in-2,
  - rejects when an interior move is illegal,
  - rejects when the FEN itself is malformed.
- **Unit (frontend)**: extend gameStore tests? Probably not — most editor
  logic is in chess.js. A small unit test for the "is this SAN the next
  expected move?" comparator covers the SAN-equality case (it's just
  string equality after the server-side validation, but a test pins it).
- **Smoke (Playwright)** at the end: trainer creates set → adds a 3-ply
  puzzle → student is assigned → opens viewer → solves → progress
  recorded. Run inline with the dev server, not added to the e2e suite
  (to keep CI fast).

## Scope explicitly out

- Lichess Puzzle DB import
- Themes, motif tags
- Difficulty band
- Hints / show-solution-then-replay
- Spaced repetition
- Multi-solution puzzles
- Puzzle reorder (no drag handle — delete + re-add)
