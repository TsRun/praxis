# Lichess Study Import — Design

**Status:** approved 2026-05-19 by user
**Owner:** Praxis trainer workflow

## Goal

Let a trainer paste a multi-chapter Lichess study PGN into an existing Praxis
opening study and pick which chapters to merge in. Imported chapters become
tree nodes (with main-line / variation flags) plus per-position chapter notes
extracted from PGN comments.

## Scope

- **In:** paste-PGN flow (no Lichess HTTP fetch), chapter selection UI, mainline
  + variations import, per-move comments as chapter bodies, idempotent merge
  into an existing study.
- **Out:** Lichess URL fetch, NAGs (`$1`–`$9`), arrows/circles (`[%cal …]`),
  clocks (`[%clk …]`), evals (`[%eval …]`). Strip them, keep the move SAN.

## UX

The OpeningStudyEditor header gets a new button next to the Tree / Chapters
toggle: **"Import from Lichess"**. It opens a two-step modal.

### Step 1 — Paste PGN

```
┌─ Import from Lichess ─────────────────────────────┐
│ Paste the multi-chapter PGN export from your      │
│ Lichess study (Share & export → PGN).             │
│                                                   │
│ [ textarea, ~14 rows, monospace ]                 │
│                                                   │
│                       [ Cancel ]   [ Parse PGN ]  │
└───────────────────────────────────────────────────┘
```

`Parse PGN` is disabled until the textarea has content. On click, we send the
PGN to the backend `POST /api/trainer/studies/opening/:id/import-preview` and
get back the chapter list (see API below).

### Step 2 — Pick chapters

```
┌─ 14 chapters found ─────────────────────────────────────┐
│  ☑ Najdorf 6.Be3 main           42 moves                │
│  ☑ Najdorf 6.Be3 …a6 sidelines  31 moves                │
│  ☐ Sveshnikov 7.Bg5             18 moves                │
│  ☐ KID White surprise           ⚠ starts from different │
│    (1.d4 Nf6 2.c4 g6 3.Nc3…)      position — disabled   │
│  …                                                      │
│  [ select all matching ]                                │
│                          [ Back ]   [ Import 12 ]       │
└─────────────────────────────────────────────────────────┘
```

- Chapters whose starting FEN matches the Praxis study's `root_fen` are tickable
  (default checked).
- Chapters with a mismatched FEN are shown disabled with a `⚠` and a tooltip
  giving the first few moves. They cannot be imported in v1 — the trainer can
  re-export from Lichess with the standard start if they want them.
- `Import 12` calls `POST /api/trainer/studies/opening/:id/import` with the
  selected chapter indexes. Modal shows a spinner; on success the editor
  refreshes (`trainerStudies.get`) and reports
  *"Imported 12 chapters, 287 new positions, 4 already in study"* via a small
  toast/banner inside the dialog before it closes.

## Data flow

```
Trainer paste-PGN
        │
        ▼
  POST /import-preview { pgn }
        │
        ▼  server: parsePgnWithVariations(pgn)
  { chapters: [{ index, name, root_fen, mainline_move_count,
                 matches_study_root }] }
        │
        ▼
  Dialog Step 2 renders list
        │
        ▼  trainer ticks + Import
        ▼
  POST /import { pgn, chapter_indexes }
        │
        ▼  server: re-parse, then for each picked chapter:
        │         DFS the tree, upsertNode per move,
        │         attach chapter body for each comment, attach
        │         chapter title to the first NEW node of the
        │         chapter's mainline (Event header or Site)
        ▼
  { imported_chapters, imported_nodes, reused_nodes,
    skipped: [{ kind, name|node_id, reason }] }
```

The client always re-parses on the server. The Step-1 preview parses to give
the trainer the picker, but the import endpoint re-parses from the raw PGN —
no trust in client-massaged trees.

## Backend

### `server/pgn-tree.ts` (new file)

```ts
export interface PgnNode {
  san: string;
  uci: string;
  fen: string;             // EPD (4-field), kept in DB as `parent_fen`/`fen`
  ply: number;
  is_main: boolean;        // true on the mainline path, false on variations
  comment: string | null;  // PGN { ... } comment that follows this move
  children: PgnNode[];     // first child = mainline, rest = variations
}

export interface PgnChapter {
  index: number;           // 0-based position in the multi-chapter PGN
  headers: Record<string, string>;
  root_fen: string;        // 4-field EPD (from FEN header or standard start)
  root: PgnNode | null;    // null if the chapter has no moves
}

export function parsePgnWithVariations(pgn: string): PgnChapter[];
```

Implementation notes:
- Split on blank-line-separated games (existing pattern in `pgn.ts`).
- For each game, tokenize the movetext: `tokens = string | "(" | ")" | "{...}"`.
- Recursive descent: a `walk(parentFen, parentPly)` consumes moves; on `(` it
  forks a sibling line from the *previous* move's parent; on `)` it returns.
- Use `chess.js` per branch to validate SAN and produce UCI + child FEN.
- The first move added at any level is the mainline (is_main=true); subsequent
  `(…)` siblings are variations.
- Comments preceding a move attach to no node (drop); comments following a
  move attach to that move's node.

Reuse the existing `server/pgn.ts` only for the trivial header parser; the
new file owns variation-aware tokenization.

### Routes (in `server/routes-trainer.ts`)

```ts
POST /api/trainer/studies/opening/:id/import-preview
  body: { pgn: string }
  resp: { chapters: { index, name, mainline_move_count, root_fen,
                      matches_study_root }[] }

POST /api/trainer/studies/opening/:id/import
  body: { pgn: string, chapter_indexes: number[] }
  resp: { imported_chapters: number,
          imported_nodes: number,
          reused_nodes: number,
          skipped: { kind: 'chapter-exists'|'fen-mismatch'|'parse-error',
                     name?: string, reason: string }[] }
```

Both routes are `requireAuthor` (trainer or self, must own the study).

`name` for the picker comes from `headers.Event ?? headers.Site ?? "Chapter N"`.
The mainline move count is for the dialog UI only (helps the trainer judge
which chapters are substantive).

### Import algorithm

For each selected chapter:
1. Confirm `chapter.root_fen === study.root_fen`. If not, skip with
   `{ kind: 'fen-mismatch', name, reason }`.
2. Walk `chapter.root` depth-first. For each `PgnNode n`:
   - Call `upsertNode(study_id, parent_node_id, n.san, n.uci, n.fen, n.ply)`.
     The existing `UNIQUE (study_id, parent_id, san)` constraint makes this
     idempotent; `created: boolean` in the response tells us if it was new.
   - If `n.is_main`, also `setIsMain(study_id, node_id, true)`. Variations stay
     at the existing flag value (don't downgrade an existing mainline).
   - If `n.comment != null`:
     - If the node has no existing Praxis chapter: insert a chapter with
       `title=null, body_md=n.comment`.
     - If it has one: skip and record `{ kind: 'chapter-exists', node_id,
       reason: 'trainer note already present' }`.
3. Attach a Praxis chapter to the **first newly created node along the
   chapter's mainline** with `title = chapter.headers.Event ?? Site ?? null`
   and `body_md = ''`. If the entire mainline was reused (no new nodes), no
   title chapter is attached — the import only added variations underneath
   existing nodes, so a "this is the Najdorf" title would land mid-tree
   confusingly.

All steps run inside one Postgres transaction per chapter. A failure rolls
back that chapter and continues with the next; the API returns partial
success with `skipped` populated.

## Client

### Types (in `src/lib/api.ts`)

```ts
export interface LichessChapterPreview {
  index: number;
  name: string;
  mainline_move_count: number;
  root_fen: string;
  matches_study_root: boolean;
}

trainerStudies.importPreview(study_id: number, pgn: string)
  : Promise<{ chapters: LichessChapterPreview[] }>;

trainerStudies.import(study_id: number, pgn: string, chapter_indexes: number[])
  : Promise<{
      imported_chapters: number;
      imported_nodes: number;
      reused_nodes: number;
      skipped: { kind: 'chapter-exists'|'fen-mismatch'|'parse-error';
                 name?: string; reason: string }[];
    }>;
```

### New components

- `src/trainer/ImportLichessDialog.tsx` — the two-step dialog. Internal state
  machine: `'paste' | 'picking' | 'importing'`. Reuses `Dialog` shell from
  `src/components/ui/Dialog.tsx`.
- Button wired into `src/trainer/OpeningStudyEditor.tsx` header.

## Testing

- **Unit** (`tests/unit/server/pgn-tree.test.ts`):
  - Single mainline: `1.e4 e5 2.Nf3 Nc6`
  - One variation: `1.e4 (1.d4) e5`
  - Nested variations: `1.e4 e5 (1...c5 2.Nf3 (2.Nc3) d6) 2.Nf3`
  - Comment after move: `1.e4 { king's pawn } e5`
  - Multi-chapter PGN with FEN header on chapter 2
  - Malformed PGN returns informative error, not crash.
- **Unit** (`tests/unit/server/lichess-import.test.ts`): the import algorithm
  against an in-memory tree (no DB), asserting node creation order, mainline
  flags, and chapter attachment for first-new-node-on-mainline.
- **Manual smoke**: paste a real Najdorf Lichess study export and verify the
  Tree view picks it up, mainline is starred ★, and chapter titles render.

## Risks & edges

- **Huge studies** (50+ chapters, thousands of nodes): import latency. Mitigate
  with one transaction per chapter (already in plan) so partial progress is
  visible; client UI shows the spinner until the response returns. Don't add
  pagination yet — defer until someone complains.
- **Promotions in UCI**: chess.js `move.promotion` is the lowercase piece. We
  already append it (`${from}${to}${promotion}`) in `OpeningStudyEditor`'s
  `upsertNode` call. Match that.
- **Comments with markdown special chars**: PGN comments are plain text; we
  drop them into `body_md` as-is. The `Markdown` renderer treats them safely.
- **PGN with CRLF**: tokenizer must accept `\r\n` and `\n`.

## Out of scope (future)

- Lichess URL fetch (server-side `fetch` of `https://lichess.org/api/study/:id.pgn`).
- Importing into a **new** Praxis study from a Lichess study (creates the
  study + imports in one step). Easy follow-up once paste-into-existing is solid.
- Round-tripping Praxis → Lichess (export PGN).
