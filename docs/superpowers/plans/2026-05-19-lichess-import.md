# Lichess Study Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Import from Lichess" two-step modal in the trainer's opening
study editor that parses a pasted multi-chapter Lichess PGN, lets the trainer
pick which chapters to import, and merges them into the existing study as
nodes + per-position chapter bodies.

**Architecture:** New variation-aware PGN parser on the server
(`server/pgn-tree.ts`); two new endpoints (`/import-preview` and `/import`)
that reuse the existing `upsertNode` idempotent path; new
`ImportLichessDialog` two-step React component wired into
`OpeningStudyEditor`.

**Tech Stack:** Fastify v5, pg (Postgres), chess.js, React 18, Tailwind, vitest.

---

## File map

- **Create** `server/pgn-tree.ts` — `parsePgnWithVariations(pgn) → PgnChapter[]`.
- **Create** `tests/unit/server/pgn-tree.test.ts` — covers tokenizer + parser.
- **Modify** `server/routes-trainer.ts` — register the two new endpoints.
- **Modify** `src/lib/api.ts` — typed client methods + DTO interfaces.
- **Create** `src/trainer/ImportLichessDialog.tsx` — two-step modal.
- **Modify** `src/trainer/OpeningStudyEditor.tsx` — header button wiring.
- **Modify** `docs/database.html` — note: no schema change (we only add rows).

---

## Task 1 — Variation-aware PGN tokenizer

**Files:**
- Create: `server/pgn-tree.ts`
- Create: `tests/unit/server/pgn-tree.test.ts`

- [ ] **Step 1: Write the failing test for the tokenizer**

```ts
// tests/unit/server/pgn-tree.test.ts
import { describe, it, expect } from 'vitest';
import { tokenizeMovetext } from '../../../server/pgn-tree.js';

describe('tokenizeMovetext', () => {
  it('emits SAN tokens and skips move numbers', () => {
    expect(tokenizeMovetext('1. e4 e5 2. Nf3 Nc6')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'san', value: 'e5' },
      { kind: 'san', value: 'Nf3' },
      { kind: 'san', value: 'Nc6' },
    ]);
  });

  it('emits open/close paren for variations', () => {
    expect(tokenizeMovetext('1. e4 (1. d4) e5')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'open' },
      { kind: 'san', value: 'd4' },
      { kind: 'close' },
      { kind: 'san', value: 'e5' },
    ]);
  });

  it('captures braced comments as a single token', () => {
    expect(tokenizeMovetext('1. e4 { king pawn } e5')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'comment', value: 'king pawn' },
      { kind: 'san', value: 'e5' },
    ]);
  });

  it('drops NAGs and result tokens', () => {
    expect(tokenizeMovetext('1. e4! $5 e5 1-0')).toEqual([
      { kind: 'san', value: 'e4!' },
      { kind: 'san', value: 'e5' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/unit/server/pgn-tree.test.ts`
Expected: FAIL — `server/pgn-tree` cannot be resolved.

- [ ] **Step 3: Implement the tokenizer**

Create `server/pgn-tree.ts`:

```ts
export type Token =
  | { kind: 'san'; value: string }
  | { kind: 'comment'; value: string }
  | { kind: 'open' }
  | { kind: 'close' };

const RESULT = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const MOVE_NUM = /^\d+\.{1,3}$/;
const NAG = /^\$\d+$/;

export function tokenizeMovetext(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '(') { tokens.push({ kind: 'open' }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'close' }); i++; continue; }
    if (c === '{') {
      const end = text.indexOf('}', i + 1);
      const raw = end === -1 ? text.slice(i + 1) : text.slice(i + 1, end);
      tokens.push({ kind: 'comment', value: raw.trim() });
      i = end === -1 ? n : end + 1;
      continue;
    }
    // Read a whitespace/paren/brace-delimited word.
    let j = i;
    while (j < n && !' \t\n\r(){}'.includes(text[j])) j++;
    const word = text.slice(i, j);
    i = j;
    if (RESULT.has(word) || MOVE_NUM.test(word) || NAG.test(word) || word === '') continue;
    tokens.push({ kind: 'san', value: word });
  }
  return tokens;
}
```

- [ ] **Step 4: Re-run the tokenizer tests and confirm they pass**

Run: `npx vitest run tests/unit/server/pgn-tree.test.ts`
Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add server/pgn-tree.ts tests/unit/server/pgn-tree.test.ts
git commit -m "feat(pgn): variation-aware tokenizer (san/comment/open/close)"
```

---

## Task 2 — Tree parser on top of the tokenizer

**Files:**
- Modify: `server/pgn-tree.ts`
- Modify: `tests/unit/server/pgn-tree.test.ts`

- [ ] **Step 1: Write the failing test for tree parsing**

Append to `tests/unit/server/pgn-tree.test.ts`:

```ts
import { parsePgnWithVariations } from '../../../server/pgn-tree.js';
import { Chess } from 'chess.js';

const START_FEN = new Chess().fen().split(' ').slice(0, 4).join(' ');

describe('parsePgnWithVariations', () => {
  it('parses a single-chapter mainline', () => {
    const [ch] = parsePgnWithVariations('[Event "Test"]\n\n1. e4 e5 2. Nf3 *');
    expect(ch.headers.Event).toBe('Test');
    expect(ch.root_fen).toBe(START_FEN);
    expect(ch.root?.san).toBe('e4');
    expect(ch.root?.is_main).toBe(true);
    expect(ch.root?.children[0].san).toBe('e5');
    expect(ch.root?.children[0].children[0].san).toBe('Nf3');
  });

  it('attaches a variation as a sibling under the parent', () => {
    const [ch] = parsePgnWithVariations('1. e4 e5 (1...c5 2. Nf3) 2. Nf3 *');
    const e4 = ch.root!;
    expect(e4.children.map((c) => c.san)).toEqual(['e5', 'c5']);
    expect(e4.children[0].is_main).toBe(true);
    expect(e4.children[1].is_main).toBe(false);
    expect(e4.children[1].children[0].san).toBe('Nf3');
  });

  it('attaches a comment to the move it follows', () => {
    const [ch] = parsePgnWithVariations('1. e4 { king pawn } e5 *');
    expect(ch.root!.comment).toBe('king pawn');
    expect(ch.root!.children[0].comment).toBeNull();
  });

  it('reads the FEN header for the chapter root', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';
    const pgn = `[Event "Mid"]\n[FEN "${fen} 0 2"]\n\n2. Nf3 Nc6 *`;
    const [ch] = parsePgnWithVariations(pgn);
    expect(ch.root_fen).toBe(fen);
    expect(ch.root?.san).toBe('Nf3');
    expect(ch.root?.ply).toBe(3);
  });

  it('returns one entry per chapter in a multi-game PGN', () => {
    const pgn = `[Event "A"]\n\n1. e4 *\n\n[Event "B"]\n\n1. d4 *`;
    const chapters = parsePgnWithVariations(pgn);
    expect(chapters.map((c) => c.headers.Event)).toEqual(['A', 'B']);
    expect(chapters.map((c) => c.index)).toEqual([0, 1]);
  });

  it('returns an empty array for empty input', () => {
    expect(parsePgnWithVariations('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/unit/server/pgn-tree.test.ts`
Expected: FAIL — `parsePgnWithVariations` not exported.

- [ ] **Step 3: Implement `parsePgnWithVariations`**

Append to `server/pgn-tree.ts`:

```ts
import { Chess } from 'chess.js';

export interface PgnNode {
  san: string;
  uci: string;
  fen: string;             // 4-field EPD
  ply: number;
  is_main: boolean;
  comment: string | null;
  children: PgnNode[];     // children[0] = mainline continuation, rest = variations
}

export interface PgnChapter {
  index: number;
  headers: Record<string, string>;
  root_fen: string;        // 4-field EPD
  root: PgnNode | null;
}

const STD_START = new Chess().fen().split(' ').slice(0, 4).join(' ');

function splitGames(pgn: string): string[] {
  // A game = header block + movetext, separated by a blank line between games.
  // We split on lines that start with [Event ...] when preceded by a blank or BOF.
  const lines = pgn.replace(/\r\n/g, '\n').split('\n');
  const games: string[][] = [];
  let cur: string[] = [];
  let prevBlank = true;
  for (const line of lines) {
    if (line.startsWith('[Event ') && prevBlank && cur.length > 0) {
      games.push(cur);
      cur = [];
    }
    cur.push(line);
    prevBlank = line.trim() === '';
  }
  if (cur.length > 0) games.push(cur);
  return games.map((g) => g.join('\n')).filter((g) => g.trim().length > 0);
}

function parseHeaders(block: string): { headers: Record<string, string>; movetext: string } {
  const headers: Record<string, string> = {};
  const lines = block.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') { i++; break; }
    const m = line.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/);
    if (m) headers[m[1]] = m[2];
  }
  return { headers, movetext: lines.slice(i).join('\n') };
}

interface Cursor {
  tokens: Token[];
  i: number;
}

function parseVariation(
  cur: Cursor,
  parentFen: string,
  parentPly: number,
  isMainLine: boolean,
): PgnNode | null {
  let firstNode: PgnNode | null = null;
  let prev: PgnNode | null = null;
  // A `prevFenForBranch` captures the FEN to use when a `(` opens — it's the
  // parent of `prev` (i.e. parentFen if no move yet, otherwise prev's parent).
  let parentFenForLast = parentFen;
  let parentPlyForLast = parentPly;

  while (cur.i < cur.tokens.length) {
    const t = cur.tokens[cur.i];
    if (t.kind === 'close') { cur.i++; return firstNode; }

    if (t.kind === 'open') {
      cur.i++;
      // Variation forks from the parent of `prev` — the move that came before
      // `prev` (or `parentFen` if prev is the very first node here).
      const branch = parseVariation(cur, parentFenForLast, parentPlyForLast, false);
      if (branch && prev) prev.children.push(branch);
      continue;
    }

    if (t.kind === 'comment') {
      cur.i++;
      if (prev) prev.comment = (prev.comment ? prev.comment + ' ' : '') + t.value;
      continue;
    }

    // t.kind === 'san'
    cur.i++;
    const chess = new Chess(parentFenForLast === STD_START
      ? new Chess().fen()
      : parentFenForLast + ' 0 1');
    let mv;
    try { mv = chess.move(t.value); } catch { mv = null; }
    if (!mv) {
      // unrecognized move — bail out of this branch quietly
      return firstNode;
    }
    const node: PgnNode = {
      san: mv.san,
      uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`,
      fen: chess.fen().split(' ').slice(0, 4).join(' '),
      ply: parentPlyForLast + 1,
      is_main: isMainLine && firstNode === null ? true : isMainLine,
      // is_main is whether this *line* is the main line; firstNode marker
      // means the variation's first move. We propagate isMainLine straight
      // through — variations stay non-main, mainline stays main.
      comment: null,
      children: [],
    };
    if (firstNode === null) firstNode = node;
    if (prev) prev.children.unshift(node); // mainline continuation in children[0]
    // Re-thread mainline pointer: next move appends as children[0] of `node`.
    // We do that by treating `prev = node` and `parentFenForLast = node.fen`.
    parentFenForLast = node.fen;
    parentPlyForLast = node.ply;
    prev = node;
  }
  return firstNode;
}

export function parsePgnWithVariations(pgn: string): PgnChapter[] {
  const games = splitGames(pgn);
  const out: PgnChapter[] = [];
  games.forEach((g, idx) => {
    const { headers, movetext } = parseHeaders(g);
    const rootFen = (headers.FEN ? headers.FEN.split(' ').slice(0, 4).join(' ') : STD_START);
    const rootPly = headers.FEN
      ? (() => {
          const parts = headers.FEN.split(' ');
          const stm = parts[1];
          const fullmove = Number(parts[5] ?? '1');
          return (fullmove - 1) * 2 + (stm === 'b' ? 1 : 0);
        })()
      : 0;
    const tokens = tokenizeMovetext(movetext);
    const cursor: Cursor = { tokens, i: 0 };
    const root = parseVariation(cursor, rootFen, rootPly, true);
    out.push({ index: idx, headers, root_fen: rootFen, root });
  });
  return out;
}
```

- [ ] **Step 4: Re-run the tests and confirm they all pass**

Run: `npx vitest run tests/unit/server/pgn-tree.test.ts`
Expected: PASS — all parser tests + the 4 tokenizer tests.

- [ ] **Step 5: Commit**

```bash
git add server/pgn-tree.ts tests/unit/server/pgn-tree.test.ts
git commit -m "feat(pgn): tree parser with variations, comments, FEN-rooted chapters"
```

---

## Task 3 — `/import-preview` endpoint

**Files:**
- Modify: `server/routes-trainer.ts`

- [ ] **Step 1: Add the preview route**

Locate the existing trainer routes (near the other `/api/trainer/studies/opening/:id/...` handlers) and add:

```ts
import { parsePgnWithVariations } from './pgn-tree.js';

// inside trainerRoutes(app, opts):
app.post<{ Params: { id: string }; Body: { pgn?: string } }>(
  '/api/trainer/studies/opening/:id/import-preview',
  { preHandler: requireAuthor(pool) },
  async (req, reply) => {
    const studyId = Number(req.params.id);
    const pgn = (req.body?.pgn ?? '').trim();
    if (!pgn) return reply.code(400).send({ error: 'pgn is required' });
    const { rows } = await pool.query<{ root_fen: string }>(
      `SELECT root_fen FROM opening_study WHERE id = $1`, [studyId]);
    const studyRoot = rows[0]?.root_fen?.split(' ').slice(0, 4).join(' ') ?? '';
    let chapters;
    try {
      chapters = parsePgnWithVariations(pgn);
    } catch (e) {
      return reply.code(400).send({ error: `parse failed: ${(e as Error).message}` });
    }
    return {
      chapters: chapters.map((c) => ({
        index: c.index,
        name: c.headers.Event ?? c.headers.Site ?? `Chapter ${c.index + 1}`,
        mainline_move_count: countMainline(c.root),
        root_fen: c.root_fen,
        matches_study_root: c.root_fen === studyRoot,
      })),
    };
  },
);

function countMainline(node: import('./pgn-tree.js').PgnNode | null): number {
  let n = 0;
  let cur = node;
  while (cur) { n++; cur = cur.children[0] ?? null; }
  return n;
}
```

Note: `requireAuthor` is the existing auth guard for trainer/self study ownership. Confirm its name with `grep -n "requireAuthor\|requireTrainer" server/auth-guards.ts`.

- [ ] **Step 2: Smoke the preview from curl**

Run the dev server (`npm run dev:server`), then:

```bash
curl -s -X POST http://127.0.0.1:5174/api/trainer/studies/opening/1/import-preview \
  -H 'cookie: sid=<your-session>' \
  -H 'content-type: application/json' \
  --data '{"pgn":"[Event \"X\"]\n\n1. e4 e5 2. Nf3 *"}' | jq
```
Expected: JSON with one chapter, `name: "X"`, `mainline_move_count: 3`, `matches_study_root: true`.

- [ ] **Step 3: Commit**

```bash
git add server/routes-trainer.ts
git commit -m "feat(trainer): /import-preview returns chapter list from pasted PGN"
```

---

## Task 4 — `/import` endpoint

**Files:**
- Modify: `server/routes-trainer.ts`

- [ ] **Step 1: Add the import endpoint**

Append to the same file:

```ts
app.post<{
  Params: { id: string };
  Body: { pgn?: string; chapter_indexes?: number[] };
}>(
  '/api/trainer/studies/opening/:id/import',
  { preHandler: requireAuthor(pool) },
  async (req, reply) => {
    const studyId = Number(req.params.id);
    const pgn = (req.body?.pgn ?? '').trim();
    const picks = new Set(req.body?.chapter_indexes ?? []);
    if (!pgn) return reply.code(400).send({ error: 'pgn is required' });
    if (picks.size === 0) return reply.code(400).send({ error: 'chapter_indexes empty' });

    const { rows } = await pool.query<{ root_fen: string }>(
      `SELECT root_fen FROM opening_study WHERE id = $1`, [studyId]);
    const studyRoot = rows[0]?.root_fen?.split(' ').slice(0, 4).join(' ') ?? '';

    const chapters = parsePgnWithVariations(pgn);
    let imported_chapters = 0;
    let imported_nodes = 0;
    let reused_nodes = 0;
    const skipped: { kind: string; name?: string; reason: string }[] = [];

    for (const ch of chapters) {
      if (!picks.has(ch.index)) continue;
      if (ch.root_fen !== studyRoot) {
        skipped.push({
          kind: 'fen-mismatch',
          name: ch.headers.Event ?? `Chapter ${ch.index + 1}`,
          reason: `starts from ${ch.root_fen}`,
        });
        continue;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await importChapter(client, studyId, ch, skipped);
        imported_chapters++;
        imported_nodes += result.created;
        reused_nodes += result.reused;
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        skipped.push({
          kind: 'parse-error',
          name: ch.headers.Event ?? `Chapter ${ch.index + 1}`,
          reason: (e as Error).message,
        });
      } finally {
        client.release();
      }
    }
    return { imported_chapters, imported_nodes, reused_nodes, skipped };
  },
);

async function importChapter(
  client: import('pg').PoolClient,
  studyId: number,
  ch: import('./pgn-tree.js').PgnChapter,
  skipped: { kind: string; name?: string; reason: string }[],
): Promise<{ created: number; reused: number }> {
  let created = 0;
  let reused = 0;
  let firstNewMainlineNodeId: number | null = null;

  async function visit(
    parentNodeId: number | null,
    parentFen: string,
    node: import('./pgn-tree.js').PgnNode,
    mainlineSoFar: boolean,
  ): Promise<void> {
    const { rows: existing } = await client.query<{ id: number; is_main: boolean }>(
      `SELECT id, is_main FROM opening_node
        WHERE study_id = $1
          AND parent_id IS NOT DISTINCT FROM $2
          AND san = $3`,
      [studyId, parentNodeId, node.san],
    );
    let nodeId: number;
    let wasCreated: boolean;
    if (existing.length > 0) {
      nodeId = existing[0].id;
      wasCreated = false;
      reused++;
    } else {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO opening_node (study_id, parent_id, parent_fen, san, uci, fen, ply, is_main)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [studyId, parentNodeId, parentFen, node.san, node.uci, node.fen, node.ply, mainlineSoFar && node.is_main],
      );
      nodeId = ins.rows[0].id;
      wasCreated = true;
      created++;
      if (mainlineSoFar && node.is_main && firstNewMainlineNodeId === null) {
        firstNewMainlineNodeId = nodeId;
      }
    }
    // Promote is_main if this is on the mainline and the existing row wasn't marked.
    if (mainlineSoFar && node.is_main && !wasCreated && existing[0]?.is_main === false) {
      await client.query(`UPDATE opening_node SET is_main = true WHERE id = $1`, [nodeId]);
    }
    // Attach a chapter for the comment if any, only if not already present.
    if (node.comment) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM opening_chapter WHERE node_id = $1`, [nodeId]);
      if (!rowCount) {
        await client.query(
          `INSERT INTO opening_chapter (node_id, title, body_md) VALUES ($1, NULL, $2)`,
          [nodeId, node.comment],
        );
      } else {
        skipped.push({ kind: 'chapter-exists', name: node.san, reason: `node ${nodeId} already has a chapter` });
      }
    }
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      await visit(nodeId, node.fen, child, mainlineSoFar && i === 0);
    }
  }

  if (ch.root) {
    await visit(null, ch.root_fen, ch.root, true);
  }

  // Attach the chapter title (Event header) to the first new mainline node.
  if (firstNewMainlineNodeId !== null) {
    const title = ch.headers.Event ?? ch.headers.Site ?? null;
    if (title) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM opening_chapter WHERE node_id = $1`, [firstNewMainlineNodeId]);
      if (!rowCount) {
        await client.query(
          `INSERT INTO opening_chapter (node_id, title, body_md) VALUES ($1, $2, '')`,
          [firstNewMainlineNodeId, title],
        );
      }
    }
  }
  return { created, reused };
}
```

- [ ] **Step 2: Smoke from curl**

```bash
curl -s -X POST http://127.0.0.1:5174/api/trainer/studies/opening/1/import \
  -H 'cookie: sid=<your-session>' \
  -H 'content-type: application/json' \
  --data '{"pgn":"[Event \"X\"]\n\n1. e4 e5 2. Nf3 *","chapter_indexes":[0]}' | jq
```
Expected: `{"imported_chapters":1,"imported_nodes":3,"reused_nodes":0,"skipped":[]}`.

Re-run the same command; expected on the second call:
`{"imported_chapters":1,"imported_nodes":0,"reused_nodes":3,"skipped":[{"kind":"chapter-exists",...}]}`.

- [ ] **Step 3: Commit**

```bash
git add server/routes-trainer.ts
git commit -m "feat(trainer): /import merges Lichess chapters into the study tree"
```

---

## Task 5 — Client API + types

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add types and methods**

In `src/lib/api.ts`, near the existing `trainerStudies` block, add inside it (and add the interfaces at the top of the trainerStudies section):

```ts
export interface LichessChapterPreview {
  index: number;
  name: string;
  mainline_move_count: number;
  root_fen: string;
  matches_study_root: boolean;
}

export interface ImportResult {
  imported_chapters: number;
  imported_nodes: number;
  reused_nodes: number;
  skipped: { kind: 'chapter-exists' | 'fen-mismatch' | 'parse-error';
             name?: string; reason: string }[];
}

// inside the trainerStudies = { ... } object literal:
  importPreview: (id: number, pgn: string) =>
    api.post<{ chapters: LichessChapterPreview[] }>(
      `/api/trainer/studies/opening/${id}/import-preview`, { pgn }),
  importLichess: (id: number, pgn: string, chapter_indexes: number[]) =>
    api.post<ImportResult>(
      `/api/trainer/studies/opening/${id}/import`,
      { pgn, chapter_indexes }),
```

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): typed Lichess import preview + import methods"
```

---

## Task 6 — `ImportLichessDialog` component

**Files:**
- Create: `src/trainer/ImportLichessDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import {
  trainerStudies,
  type LichessChapterPreview,
  type ImportResult,
} from '../lib/api';

interface Props {
  open: boolean;
  studyId: number;
  onClose: () => void;
  onImported: () => void; // parent should refetch the study
}

type Stage =
  | { kind: 'paste' }
  | { kind: 'picking'; pgn: string; chapters: LichessChapterPreview[]; picked: Set<number> }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

export function ImportLichessDialog({ open, studyId, onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'paste' });
  const [pgn, setPgn] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStage({ kind: 'paste' });
    setPgn('');
    setErr(null);
    setBusy(false);
  }

  async function onParse() {
    setBusy(true);
    setErr(null);
    try {
      const { chapters } = await trainerStudies.importPreview(studyId, pgn);
      const picked = new Set(
        chapters.filter((c) => c.matches_study_root).map((c) => c.index),
      );
      setStage({ kind: 'picking', pgn, chapters, picked });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (stage.kind !== 'picking') return;
    setBusy(true);
    setErr(null);
    const picks = Array.from(stage.picked);
    setStage({ kind: 'importing' });
    try {
      const result = await trainerStudies.importLichess(studyId, stage.pgn, picks);
      setStage({ kind: 'done', result });
      onImported();
    } catch (e) {
      setErr((e as Error).message);
      setStage({ kind: 'picking', pgn: stage.pgn, chapters: stage.chapters, picked: stage.picked });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : () => { reset(); onClose(); }}
      title="Import from Lichess"
      width="w-[36rem]"
    >
      {stage.kind === 'paste' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            Lichess study → Share &amp; export → PGN. Paste the multi-chapter PGN below.
          </p>
          <textarea
            rows={14}
            autoFocus
            className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-xs"
            placeholder={'[Event "Najdorf 6.Be3"]\n\n1. e4 c5 2. Nf3 d6 …'}
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
          />
          {err && <span className="text-xs text-red-400">{err}</span>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { reset(); onClose(); }} disabled={busy}
              className="text-zinc-400 px-3 py-1.5 disabled:opacity-50">Cancel</button>
            <button onClick={onParse} disabled={busy || !pgn.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50">
              {busy ? 'Parsing…' : 'Parse PGN'}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'picking' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            {stage.chapters.length} chapters found.
            Chapters from a different starting position can't be merged here.
          </p>
          <div className="max-h-[50vh] overflow-auto flex flex-col gap-1">
            {stage.chapters.map((c) => {
              const disabled = !c.matches_study_root;
              const checked = stage.picked.has(c.index);
              return (
                <label
                  key={c.index}
                  className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/60 cursor-pointer'
                  }`}
                  title={disabled ? `Starts from ${c.root_fen}` : undefined}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => {
                      const next = new Set(stage.picked);
                      if (next.has(c.index)) next.delete(c.index); else next.add(c.index);
                      setStage({ ...stage, picked: next });
                    }}
                  />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-zinc-500">{c.mainline_move_count} moves</span>
                  {disabled && <span className="text-xs text-amber-400">⚠ different start</span>}
                </label>
              );
            })}
          </div>
          {err && <span className="text-xs text-red-400">{err}</span>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setStage({ kind: 'paste' })} disabled={busy}
              className="text-zinc-400 px-3 py-1.5 disabled:opacity-50">Back</button>
            <button onClick={onImport} disabled={busy || stage.picked.size === 0}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50">
              Import {stage.picked.size}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'importing' && (
        <p className="text-sm text-zinc-400 text-center py-8">Importing…</p>
      )}

      {stage.kind === 'done' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">
            ✓ {stage.result.imported_chapters} chapters · {stage.result.imported_nodes} new positions
            · {stage.result.reused_nodes} already in study
          </p>
          {stage.result.skipped.length > 0 && (
            <details className="text-xs text-zinc-500">
              <summary>{stage.result.skipped.length} skipped</summary>
              <ul className="ml-4 mt-1 list-disc">
                {stage.result.skipped.map((s, i) => (
                  <li key={i}><strong>{s.kind}</strong> {s.name ? `(${s.name})` : ''}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end">
            <button onClick={() => { reset(); onClose(); }}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium">
              Done
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/trainer/ImportLichessDialog.tsx
git commit -m "feat(trainer): ImportLichessDialog — paste PGN, pick chapters, import"
```

---

## Task 7 — Wire button into the OpeningStudyEditor

**Files:**
- Modify: `src/trainer/OpeningStudyEditor.tsx`

- [ ] **Step 1: Add import dialog state and button**

In `src/trainer/OpeningStudyEditor.tsx`:

- Add import:
  ```tsx
  import { ImportLichessDialog } from './ImportLichessDialog';
  ```

- Add state inside `OpeningStudyEditor`:
  ```tsx
  const [showImport, setShowImport] = useState(false);
  ```

- In the header `<div className="ml-auto inline-flex bg-zinc-900/60 ...">` segment, add a new button **before** the segmented control:
  ```tsx
  <button
    onClick={() => setShowImport(true)}
    className="text-xs text-zinc-400 hover:text-amber-300 px-3 py-1 rounded ring-1 ring-zinc-800 hover:ring-amber-400/40 mr-2"
  >
    Import from Lichess
  </button>
  ```
  Adjust the parent `ml-auto inline-flex` container so it can host both the button and the toggle; wrap them in a flex container if needed:
  ```tsx
  <div className="ml-auto flex items-center gap-2">
    <button
      onClick={() => setShowImport(true)}
      className="text-xs text-zinc-400 hover:text-amber-300 px-3 py-1 rounded ring-1 ring-zinc-800 hover:ring-amber-400/40"
    >
      Import from Lichess
    </button>
    <div className="inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs">
      {/* existing Tree/Chapters buttons */}
    </div>
  </div>
  ```

- At the bottom of the returned JSX (next to `<ConfirmDialog ... />`), render:
  ```tsx
  <ImportLichessDialog
    open={showImport}
    studyId={study.id}
    onClose={() => setShowImport(false)}
    onImported={async () => {
      const refreshed = await trainerStudies.get(study.id);
      setStudy(refreshed);
    }}
  />
  ```

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/trainer/OpeningStudyEditor.tsx
git commit -m "feat(trainer): wire 'Import from Lichess' into the study editor header"
```

---

## Task 8 — Ship via PR

- [ ] **Step 1: Push branch and open PR**

Run:

```bash
git push -u origin feat/railway-deploy
gh pr create --title "feat(opening): import Lichess studies via paste-PGN" --body "$(cat <<'EOF'
## Summary
- New PGN parser with variation + comment support (`server/pgn-tree.ts`)
- `/import-preview` returns chapter list with FEN-match flag
- `/import` merges picked chapters into an existing opening study (idempotent via existing UNIQUE on `opening_node`)
- New `ImportLichessDialog` two-step modal in the trainer editor

## Test plan
- [ ] Unit: `npx vitest run tests/unit/server/pgn-tree.test.ts` — all parser cases green
- [ ] Manual: paste a real Lichess Najdorf study, pick 2 chapters, confirm tree shows mainline ★ and chapter titles render
- [ ] Manual: re-import the same PGN → expect 0 new positions, all reused, chapter-exists in skipped
- [ ] Manual: import a PGN whose chapter has a different FEN → expect ⚠ disabled in step 2 and `fen-mismatch` in skipped if forced

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 2: Merge the PR**

Run:

```bash
gh pr merge --merge --delete-branch
```
Expected: PR merged, branch deleted on remote.

- [ ] **Step 3: Verify Railway redeploys cleanly**

Watch the praxis service via `railway service status --project d84f81c6-c437-4ee3-b763-1992c7ec91c0 --environment cbe13e63-ffde-4b3b-be51-71ed961d3a44 --service a270ee6e-6b76-4bd3-9c33-400cdbca3a95 --json` until status is `SUCCESS`.

Then probe live:

```bash
curl -sS -i -X POST https://praxis.tsrun.dev/api/auth/me
# expect 401 JSON (still unauth)
```

That confirms the new bundle is shipped and the API still answers.
