# Praxis — design brief for a fresh, modern UI

> Paste this whole document into a new Claude conversation and ask for
> redesigned screens. Claude can return HTML+Tailwind artifacts you can drop
> into the React app one screen at a time. The current implementation
> already uses React 18, Tailwind, and chessground, so you don't need to
> ship a different stack — only a different visual language and layout.

---

## TL;DR

Praxis is a small SaaS for chess coaching. A trainer builds **opening studies**
(branching move trees + per-position chapters) and **game studies** (an
annotated PGN with optional per-ply quizzes). They assign those studies to
students by nickname. Students drill them with Chessable-style spaced-
repetition quizzes.

The current UI is functional but feels dense and a little engineering-
draftish — too many small zinc panels stacked, dim text-xs labels everywhere,
no warmth, no clear visual hierarchy. The redesign should keep the same
information density but feel like a modern product (think Linear / Vercel /
Lichess study but with cleaner spacing).

It's live at **https://praxis.tsrun.dev**.

---

## Brand identity (today, keep what works)

- Dark UI, single theme. No light mode.
- Wordmark: **"Praxis"** in amber, semibold, slightly tracked.
- Page background: charcoal `#0a0a0c` with two soft radial gradients
  (amber top-left, blue-ish bottom-right).
- Accent: amber-400 `#fbbf24` for actions / current selection / "main line".
- Success / "has content": emerald-400.
- Destructive: red-400.
- Typography: Inter Variable for UI, JetBrains Mono for SAN moves + code.

Move pieces themselves are the **chessground cburnett** set on a cool
slate board (`#475569` dark / `#d2dbe7` light). The board is the visual
anchor of every workspace screen — keep its prominence; tone everything
around it down.

**Things to redesign:**
- The pervasive `.panel` utility (translucent zinc + 14px radius + heavy
  blur). It's used 30+ times and gives the page a "lots of small floating
  rectangles" feel.
- The `text-xs uppercase tracking-wider text-zinc-500` label style — used
  for EVERY section header. Find 1–2 better hierarchy levels.
- The Tree/Chapters / Moves/Tree segmented controls. They look like inline
  pill buttons; could be tabs, side rail, or just keyboard-driven.

---

## Personas / roles

A single `app_user` has a `roles` array containing one or more of:
`'trainer'`, `'student'`, `'self'`. The product surfaces two workspaces:

- **Coach workspace** (trainer or self-trainer): authors studies, builds
  trees, attaches chapter titles, assigns studies to students.
- **Student workspace**: receives assignments, browses the same tree
  read-only, drills the position via SR quizzes.

A signed-in user with both roles can flip workspaces via a top-bar
"Coach ⇄ Student" segmented control.

---

## Sitemap

```
/                                  → landing + sign in / sign up
/invite/:token                     → trainer-link landing page
/trainer/                          → redirects to /trainer/studies
  /trainer/studies                 → list of opening + game studies
  /trainer/studies/opening/:id     → ★ OpeningStudyEditor (the workhorse)
  /trainer/studies/game/:id        → GameStudyEditor
  /trainer/students                → roster (table of nicknames)
  /trainer/students/:id            → per-student detail + assigned studies
/student/                          → dashboard of assignments
  /student/studies/opening/:id     → OpeningStudyViewer (Tree / Chapters / Quiz)
  /student/studies/game/:id        → GameStudyViewer
```

---

## Data shapes (just enough to design)

```ts
type Role = 'trainer' | 'student' | 'self';

interface CurrentUser { id, email, name /* nickname */, roles: Role[] }

interface OpeningStudy {
  id, name, root_fen, eco: string|null, side: 'w'|'b',
  nodes:    OpeningNode[],
  chapters: OpeningChapter[],
}

interface OpeningNode {
  id, parent_id: number|null,
  san: string,            // 'Nf3'
  uci: string,            // 'g1f3'
  fen: string,            // 4-field EPD after the move
  ply: number,            // 1 = white's first
  is_main: boolean,       // ★ "main line" flag
}
interface OpeningChapter { node_id, title: string|null }
                          // body_md exists in DB but is no longer used —
                          // chapters are title-only

interface GameStudy {
  id, name, pgn, headers_json,
  annotations: { ply, comment_md, is_quiz: boolean }[],
}

interface AssignmentRow {
  id, study_kind: 'opening'|'game', study_id, name,
  assigned_at, completed_at: string|null, progress_pct: number,
}

interface QuizCard {        // student SR drilling
  node_id, parent_fen, ply, opponent_line: string[], root_fen,
}
```

---

## Screen-by-screen brief

### 1. Landing / sign-in (`/`)

**Now:** single centered card with the wordmark + tagline + a Sign in / Create
account tab pair + email/password fields. Background gradients give it a bit
of life. Sign-up adds a [Trainer / Student / Own trainer] checklist.

**Asks:**
- Stronger first impression. The hero copy "Build chess studies. Coach
  others, learn from a coach, or work through your own materials solo." is
  good — make it bigger. Add a screenshot strip or animated board on the
  right.
- Roles picker is currently three checkboxes with a long description each.
  Reduce visual weight. Maybe three large clickable cards with an icon
  (mortarboard / student / solo).
- Form: smaller, more affordant. Bigger primary button.

### 2. Trainer Studies index (`/trainer/studies`)

**Now:** H1 "Studies", two amber buttons `+ Opening` / `+ Game`, then two
sections "Opening studies" / "Game studies" each rendering a stack of
link-cards (rounded `.panel`s). When empty, just a "No opening studies yet."

**Asks:**
- Hero stat row at the top? (X studies, Y students assigned, Z chapters)
- A real card design: title + ECO chip + "plays white/black" + chapter
  count + recently-touched date + a thumbnail board showing the start
  position.
- Tighter empty-state with an inline call-to-action.

### 3. Trainer OpeningStudyEditor ★ (`/trainer/studies/opening/:id`)

The workhorse screen. Spends 80% of trainer time.

**Now (Tree mode):** Two-column grid.
- **Left column (~440px)** stacks: a chessboard, a "⇅ flip" pill above it,
  a row of breadcrumb path-pills under it, a chapter-title-only editor
  (just an input + Save button), then two stacked buttons "Import from
  Lichess" and "Assign to student".
- **Right column (sticky, fills remaining width)** has a Moves | Tree
  segmented control. **Moves**: candidate replies from the current node
  as one row per move, with subtree stats (`N chapters · M sub-positions`
  + a tiny share bar). **Tree**: one row per ply along the current line
  with all sibling variations side-by-side as chips.
- Header: study name + meta + Tree | Chapters mode toggle.
- Chapters mode (separate from Tree): two-pane outline of all chapters
  nested by tree depth, with a chapter-title editor on the right.

**Asks:**
- This is the most polished part already — keep the structure but make it
  feel less cramped. Right panel uses `.panel p-3` and reads like a
  spreadsheet — softer typography + more whitespace would help.
- The Moves view rows currently squeeze [SAN] [★] [●] [stat text] [bar]
  into one row. Consider a card-style layout (SAN big, stats below).
- The path-pills under the board are tiny mono text. They're how the
  trainer navigates back. Could become a real breadcrumb component.
- The chapter-title editor takes 380px and shows a single input — feels
  oversized when empty. Inline-edit pattern would be nicer (click the
  title in the header to edit it).
- The "Assign to student" amber button is the most important CTA on this
  screen, but the placement (left column under "Import from Lichess")
  isn't the natural eye-path. Move to a header / top-right action.

### 4. Student OpeningStudyViewer (`/student/studies/opening/:id`)

**Now:** Same Tree / Chapters / Quiz mode tabs as trainer. Tree mode is a
read-only mirror (no ★ / ✕ hover actions). Quiz mode shows just a board +
"drag a piece to play your prepared move", reveals correct/incorrect + the
chapter title on the next position.

**Asks:**
- The Quiz card feels too plain. Add: opponent line so far (already
  there as small mono row under board), turn-to-move indicator on the
  board, success streak / due-count badge, "Skip / I don't know" button.
- A subtle progress bar at the top of the page (how far through this
  study's chapters the student has seen).

### 5. Roster + invite flow

**Now:** Students page is a table with columns [Nickname, Linked,
Assignments]. `+ Add student` opens a small modal — a single nickname
input. Server looks up signed-in users by exact name match; if multiple,
the modal switches to a candidate picker; on success, an email goes to
the student's stored address.

**Asks:**
- Roster table is fine but feels old-school. Card grid with each
  student's nickname avatar (LT-style monogram already exists), assigned
  count, last-seen, and a quick-action menu (Assign new study, Open
  detail, Unlink).
- Add-student modal: replace the "type then disambiguate" pattern with a
  typeahead/combobox that hits a search endpoint as the trainer types.
- StudentDetailPage hasn't been polished — currently a name header + a
  list of assignments + an "Assign new" sub-form.

### 6. Student dashboard (`/student`)

**Now:** Simple list of `AssignmentRow`s. Each row has the study name,
kind, assigned date, progress %.

**Asks:**
- Two-column dashboard: left = "Due now" cards (chapters with SR cards
  due), right = "All assignments" list. A small Lichess-puzzle-style
  hero "Today's drill" prompt that opens straight into Quiz mode for the
  first study with cards due.

---

## Patterns to invent / refine

1. **Cards over panels.** Replace the universal `.panel` glass utility
   with two or three card variants: `<Card>` for top-level surfaces (more
   solid), `<Inset>` for nested groups (almost transparent), `<Chip>` for
   inline items. Tighter borders, less blur.

2. **Headings.** Stop using `text-xs uppercase tracking-wider text-zinc-500`
   for EVERY section. Establish a clear h1 / h2 / overline tier and use it.

3. **Empty states.** Currently a one-liner "No X yet." Each empty state
   should include a primary CTA and a short hint.

4. **Color usage.** Amber should be reserved for ★ main-line, current
   selection, and the single primary CTA per screen. Currently amber leaks
   into "Save chapter", "Assign", "Import", "Done", "Create study", "Next",
   "+ Opening", "+ Game", etc. — every secondary button is amber too.
   Introduce a calmer secondary (probably zinc-800 ring with light text).

5. **Move chips.** SAN chips are everywhere. They're functional but they
   read as "form elements". Lean into them as the brand element — give
   them a refined treatment with subtle gradients, mainline glow, and a
   distinct "has chapter" badge that doesn't compete with the SAN.

6. **Keyboard cues.** Every Tree-view click can also be done with arrow
   keys (← parent, → first child, ↑/↓ sibling, Home, End). Surface this
   somewhere — small `?` overlay or a status bar.

---

## Constraints

- **Stack:** React 18 + Tailwind 3 + Vite + chessground. No other UI libs
  installed (no shadcn, radix, headlessui). Tailwind config is bare —
  feel free to extend it (custom color tokens are fine).
- **Dark only.** Don't waste time on a light mode.
- **No fixed sidebar.** Top nav only. Workspace switch in the top-right.
- **Mobile is secondary** but please don't make the desktop layout
  un-responsive. The board is 440px in current layouts.
- **No new dependencies** unless absolutely needed.

---

## Deliverables we want from this design pass

Pick whichever format you can produce. In order of preference:

1. **One single-file HTML+Tailwind artifact per screen** showing the
   redesigned mockup with realistic placeholder data. We'll port the
   markup back into the React components.
2. **A small design-system page** (a "Storybook in one HTML file") that
   shows the new tokens: card variants, button variants, headings, move
   chips, board chrome, dialog shell.
3. **A short rationale** (3–5 bullets) per screen explaining what
   changed and why.

Priority order of screens to redesign:
1. Trainer OpeningStudyEditor (Tree mode + Chapters mode)
2. Student OpeningStudyViewer (especially Quiz mode)
3. Trainer Studies index
4. Roster + Add-student dialog
5. Landing / sign-in
6. Student dashboard

---

## Reference: current screenshots / live URLs

- Live app: https://praxis.tsrun.dev — sign up to see all roles.
- Source: https://github.com/TsRun/praxis — components live in
  `src/trainer/`, `src/student/`, `src/components/opening/`, `src/auth/`.

If you're working from the live site, the test account
`layout-test+praxis@example.com` / `layoutcheck123` already has a few
studies imported.
