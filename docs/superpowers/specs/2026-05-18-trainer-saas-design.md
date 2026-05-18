# ChessCoach — Trainer SaaS · Design Spec

**Date:** 2026-05-18
**Status:** Draft (autonomous brainstorm, user-confirmed direction)
**Working name:** ChessCoach (rename later if needed)

---

## 1. Goal

Pivot the existing OpeningTree codebase into a multi-trainer SaaS for chess coaches.
A coach signs up, builds **studies** for their students (opening prep and game
reviews with quiz markers), invites students by email, and tracks their progress.

The existing OpeningTree explorer becomes the **library** trainers browse when
building studies — kept and reused, not removed.

## 2. Roles

| Role | What they do |
| --- | --- |
| **Trainer** | Signs up freely. Manages a roster of students. Builds opening + game studies. Assigns studies to students. Sees per-student progress. |
| **Student** | Arrives via the trainer's email invite. Picks a password, lands on a personal dashboard, works through assigned studies. Cannot see other students' data. |

Multi-tenant: each trainer's data is isolated. A student is owned by exactly one
trainer (no shared rosters in MVP).

## 3. Two study types

### 3.1 Opening study (guided / book-style)

- Trainer picks an ECO opening (or arbitrary starting FEN) and the OpeningTree
  loads scoped to that line.
- Trainer navigates the tree, attaches **markdown notes** to specific FENs
  ("annotation").
- Student opens the study, navigates the same scoped tree, sees the
  trainer's note rendered inline when they reach an annotated FEN.
- Progress is tracked as "% of annotations the student has visited."

> _Out of MVP:_ active-recall quiz mode (Chessable-style). User chose
> book-style for v1.

### 3.2 Game study (read + quiz)

- Trainer uploads a PGN file (or pastes PGN text). System parses moves + tags.
- Trainer steps through the game; at any ply they can:
  - Attach a markdown comment.
  - Mark the move as a "quiz point" (the student must find this move).
  - Both at the same ply.
- Student opens the study:
  - Default mode is **read-through** — comments appear inline next to the move list.
  - At quiz points, the system **hides the played move**, presents the position
    on the board, and asks "what would you play?"
  - Student plays a move on the board. System checks: match → mark correct,
    reveal comment, advance. Wrong → reveal expected move + comment, mark wrong, advance.
- Progress tracked as `(quizzes_attempted, quizzes_correct, completed_at)`.

## 4. Auth & onboarding

- Trainer signs up with email + password. `bcrypt` hash, session cookie
  (`HttpOnly`, `SameSite=Lax`, 30 days).
- Trainer invites student by typing email + display name. System creates an
  `invite` row with a single-use signed token (32-byte random hex).
- Email sent via **Resend** (free tier dev-friendly). Contains
  `https://<host>/invite/<token>`.
- Student clicks link → lands on `/invite/<token>` → sets password → backend
  creates `student` row tied to the inviting trainer + active session cookie →
  redirects to `/student/dashboard`.
- Invite token is short-lived (14 days) and consumed on acceptance.

## 5. Data model (additions on top of OpeningTree schema)

```sql
CREATE TABLE trainer (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student (
  id            BIGSERIAL PRIMARY KEY,
  trainer_id    BIGINT NOT NULL REFERENCES trainer(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT,              -- null until they accept the invite
  name          TEXT NOT NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at     TIMESTAMPTZ,
  UNIQUE (trainer_id, email)
);
CREATE INDEX ON student(email);

CREATE TABLE invite (
  token       TEXT PRIMARY KEY,    -- random hex
  student_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE session (
  id          TEXT PRIMARY KEY,    -- 32-byte hex
  user_kind   TEXT NOT NULL,       -- 'trainer' | 'student'
  user_id     BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE opening_study (
  id          BIGSERIAL PRIMARY KEY,
  trainer_id  BIGINT NOT NULL REFERENCES trainer(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  root_fen    TEXT NOT NULL,        -- starting position for the study
  eco         TEXT,                 -- optional ECO code
  side        CHAR(1) NOT NULL,     -- 'w' | 'b' — which side the student is preparing
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opening_annotation (
  id          BIGSERIAL PRIMARY KEY,
  study_id    BIGINT NOT NULL REFERENCES opening_study(id) ON DELETE CASCADE,
  fen         TEXT NOT NULL,        -- EPD of the position the note is anchored to
  comment_md  TEXT NOT NULL,
  UNIQUE (study_id, fen)
);

CREATE TABLE game_study (
  id           BIGSERIAL PRIMARY KEY,
  trainer_id   BIGINT NOT NULL REFERENCES trainer(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  pgn          TEXT NOT NULL,
  headers_json JSONB NOT NULL,      -- parsed PGN tags
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE game_annotation (
  id          BIGSERIAL PRIMARY KEY,
  study_id    BIGINT NOT NULL REFERENCES game_study(id) ON DELETE CASCADE,
  ply         SMALLINT NOT NULL,    -- 1-indexed half-move number
  comment_md  TEXT,
  is_quiz     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (study_id, ply)
);

CREATE TABLE assignment (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  study_kind  TEXT NOT NULL,        -- 'opening' | 'game'
  study_id    BIGINT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, study_kind, study_id)
);

CREATE TABLE quiz_attempt (
  id             BIGSERIAL PRIMARY KEY,
  student_id     BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  game_study_id  BIGINT NOT NULL REFERENCES game_study(id) ON DELETE CASCADE,
  ply            SMALLINT NOT NULL,
  attempted_san  TEXT NOT NULL,
  correct        BOOLEAN NOT NULL,
  attempted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON quiz_attempt(student_id, game_study_id);
```

Existing OpeningTree tables (`player`, `game`, `game_move`, `move_stats`) stay
read-only from the trainer-app's perspective and continue serving the explorer.

## 6. Backend (Fastify extensions)

### 6.1 Auth

- `POST /api/auth/signup`           — trainer self-signup
- `POST /api/auth/signin`           — either role; sets session cookie
- `POST /api/auth/signout`          — clears cookie + deletes session row
- `GET  /api/auth/me`               — returns the current user
- `POST /api/trainer/invites`       — { email, name } → creates student stub + invite token, sends email
- `GET  /api/invites/:token`        — public, returns trainer name + student email (for the landing page)
- `POST /api/invites/:token/accept` — { password } → sets `student.password_hash`, consumes token, returns session cookie

### 6.2 Trainer

- `GET  /api/trainer/students`                          — roster + last-activity
- `GET  /api/trainer/students/:id`                      — per-student detail + progress
- `POST /api/trainer/students/:id/assignments`          — { study_kind, study_id }
- `DELETE /api/trainer/students/:id/assignments/:aid`
- `GET  /api/trainer/studies`                           — list
- `POST /api/trainer/studies/opening`                   — create
- `PUT  /api/trainer/studies/opening/:id`               — rename / change root
- `PUT  /api/trainer/studies/opening/:id/annotations`   — bulk upsert
- `POST /api/trainer/studies/game`                      — upload PGN
- `PUT  /api/trainer/studies/game/:id/annotations`      — bulk upsert

### 6.3 Student

- `GET  /api/student/assignments`             — assigned studies + progress flag
- `GET  /api/student/studies/opening/:id`     — study + annotations + student progress
- `GET  /api/student/studies/game/:id`        — pgn + annotations + own attempts
- `POST /api/student/studies/game/:id/attempt` — { ply, attempted_san } → { correct, expected_san, comment_md }
- `POST /api/student/studies/opening/:id/visited` — { fen } → marks annotation as seen

### 6.4 Existing endpoints — unchanged

- `GET /api/explorer`, `GET /api/players`, `GET /api/health`

## 7. Frontend (React + Vite)

### 7.1 Routes

```
/                       landing + sign-in / sign-up (trainer-facing)
/invite/:token          student lands here from email; sets password
/trainer                redirect to /trainer/students
/trainer/students       roster
/trainer/students/:id   per-student page
/trainer/studies        all studies
/trainer/studies/opening/new       opening study editor
/trainer/studies/opening/:id       opening study editor
/trainer/studies/game/new          game study editor (upload PGN)
/trainer/studies/game/:id          game study editor
/student                redirect to /student/dashboard
/student/dashboard      assigned studies
/student/study/opening/:id         opening study viewer
/student/study/game/:id            game study viewer
```

A `<RequireRole>` wrapper guards the `/trainer/*` and `/student/*` route trees.

### 7.2 Components reused from OpeningTree

- `ChessBoard` (chessground wrapper)
- `MoveList` (now reused for game studies)
- `MoveSelection` (reused inside the opening-study editor as the candidate-move panel)
- `OpeningTree` data hook (`useExplorer`)
- `OpeningHeader` (ECO + name)

### 7.3 New components

- `AuthForms` (`SignInForm`, `SignUpForm`, `InviteAcceptForm`)
- `TrainerNav`, `StudentNav` — top-bar with role-appropriate links
- `StudentRoster`, `StudentDetail`, `InviteStudentDialog`
- `StudiesList`, `StudyCard`
- `OpeningStudyEditor` — board + tree + annotation side-panel (markdown textarea per FEN)
- `GameStudyEditor` — board + move list + comment editor + "Quiz here" toggle per ply
- `OpeningStudyViewer` — board + tree + read-only annotation panel
- `GameStudyViewer` — board + move list (with comment toggles) + quiz prompt overlay
- `Markdown` — small renderer (just bold/italic/links/lists; no XSS)

## 8. Email

- **Resend** SDK (`@resend/node` or `resend`).
- One template: invite email — subject `<TrainerName> invited you to ChessCoach`, body has the magic link.
- Env: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`.
- For dev without an API key, log the link to stdout instead of sending (so flows work offline).

## 9. UX details that matter

- Markdown annotations: support `**bold**`, `*italic*`, `[link](url)`, `- list`,
  `\n\n` paragraphs. No raw HTML.
- Quiz prompt UX: board shows position, drag-piece on chessground gives a SAN
  attempt; submit reveals expected move and any annotation. No multiple
  attempts — first try counts (records `correct = true/false`); student can
  always retry the whole study later.
- Game viewer comment toggle: comments are dim by default, click "show comments"
  to reveal trainer's notes inline.
- Trainer's roster card per student: name, email, joined/invited state, count
  of assignments, last activity timestamp.

## 10. Out of MVP scope

- Billing / subscription tiers
- Multi-trainer collaboration on a single study
- Spaced repetition / Chessable-style active recall on openings (study mode is
  read-only in MVP)
- Tactical puzzle library (user explicitly dropped this from MVP)
- Stockfish / engine integration
- Mobile / responsive layout — desktop only
- Live updates / WebSockets (refresh to see new assignments)
- Public study marketplace

## 11. Testing

- Unit: auth helpers (password hash, token gen, session lookup), markdown
  renderer, PGN parser, annotation upsert logic, quiz-attempt resolution.
- Integration: invite-accept flow (mock email), trainer creates study + assigns
  + student opens, quiz-attempt scoring.
- E2E (Playwright): trainer signup → invite → student signup → trainer creates
  game study with quiz → student opens, fails one quiz, passes one — verify
  progress on trainer's roster reflects it.

## 12. Risks / open questions

- **Email deliverability** — Resend's free tier requires a verified domain
  before "from" addresses outside test mode work; document a `noreply@your-domain`
  setup step. Until set up, dev mode logs to stdout.
- **Session storage** — DB-backed sessions are fine for MVP but add per-request
  DB hits. Acceptable; revisit with caching if it shows up in slow queries.
- **PGN edge cases** — variations and NAGs are common in master PGNs; for MVP
  we ingest the main line only and ignore variations (chess.js's `loadPgn`
  already does this).
- **Trainer-student data shape** — each student gets a row even before they
  accept the invite. The "invited but not joined" state is fine; lets the
  trainer pre-assign studies.

## 13. Next step

Hand off to `writing-plans` to produce a sequenced implementation plan
(auth + schema → trainer flows → student flows → polish + E2E).
