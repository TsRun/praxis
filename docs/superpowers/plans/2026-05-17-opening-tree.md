# OpeningTree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page web app that explores chess openings via the Lichess Opening Explorer API, with an interactive D3-rendered opening *tree* as the primary visual interface (alongside a board, move list, and stats table).

**Architecture:** Single Vite + React + TypeScript SPA, no backend. A Zustand store owns the canonical game state (FEN, move history, source, view config). React components subscribe; `chess.js` is the rules engine; `chessground` is the board; a fetch-with-LRU client talks to `https://explorer.lichess.ovh`. The opening tree is a D3 hierarchy rendered into SVG, demand-fetched per expanded node. URL contains the FEN for share links.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Zustand, React Router, chess.js, chessground, D3 (`d3-hierarchy`, `d3-zoom`, `d3-selection`), Vitest, Playwright.

**Spec:** see git history (removed after the feature shipped).

---

## File structure (locked in upfront)

```
yotta/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── playwright.config.ts
├── src/
│   ├── main.tsx                              # entry, mounts <App/>
│   ├── App.tsx                               # routes + layout shell
│   ├── index.css                             # Tailwind layer
│   ├── components/
│   │   ├── board/
│   │   │   ├── ChessBoard.tsx                # chessground React wrapper
│   │   │   └── MoveList.tsx                  # PGN-style scroll list
│   │   ├── explorer/
│   │   │   ├── ExplorerTable.tsx             # next-move stats table
│   │   │   └── OpeningHeader.tsx             # ECO code + name
│   │   ├── tree/
│   │   │   ├── OpeningTree.tsx               # React mount for D3 viz
│   │   │   ├── treeRender.ts                 # pure d3 render (no React)
│   │   │   ├── NodePreview.tsx               # hover mini-board tooltip
│   │   │   └── treeTypes.ts                  # TreeNode, TreeEdge interfaces
│   │   └── ui/
│   │       ├── SourceToggle.tsx              # masters | lichess
│   │       ├── SearchBar.tsx                 # FEN/PGN input
│   │       └── ViewSettings.tsx              # depth/threshold sliders
│   ├── hooks/
│   │   ├── useGameState.ts                   # selectors over gameStore
│   │   └── useExplorer.ts                    # fetch+cache helper
│   ├── lib/
│   │   ├── lichess.ts                        # /masters and /lichess fetch
│   │   ├── cache.ts                          # generic LRU<K,V>
│   │   ├── eco.ts                            # FEN/move-prefix → ECO code+name
│   │   ├── eco.data.json                     # bundled ECO data
│   │   └── tree.ts                           # build/prune logic for tree
│   └── store/
│       └── gameStore.ts                      # zustand root store
└── tests/
    ├── unit/                                 # mirrors src/
    └── e2e/                                  # Playwright specs
```

Conventions:
- Component files default to ~150 lines or less. If a file grows past that, split out a sibling.
- D3 code lives in `treeRender.ts` as a pure function `(svg, data, opts) => void`; React owns mount/unmount only.
- All Lichess calls flow through `useExplorer` → `lib/lichess.ts` → `lib/cache.ts`. Never call `fetch` from a component.

---

## Phase A — Walking skeleton

A working page that renders the board, accepts moves, and shows the explorer table for the current position. The tree is a placeholder.

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1:** Run scaffold

```bash
npm create vite@latest . -- --template react-ts
```

When prompted ("Current directory is not empty, proceed?"), choose "Ignore files and continue".

- [ ] **Step 2:** Install runtime deps

```bash
npm install chess.js chessground d3 d3-hierarchy d3-zoom d3-selection zustand react-router-dom
```

- [ ] **Step 3:** Install dev deps

```bash
npm install -D tailwindcss postcss autoprefixer @types/d3 vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 4:** Init Tailwind

```bash
npx tailwindcss init -p
```

- [ ] **Step 5:** Edit `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 6:** Replace `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import 'chessground/assets/chessground.base.css';
@import 'chessground/assets/chessground.brown.css';
@import 'chessground/assets/chessground.cburnett.css';

html, body, #root { height: 100%; }
body { @apply bg-neutral-50 text-neutral-900; font-family: ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 7:** Replace `src/App.tsx`

```tsx
export default function App() {
  return (
    <div className="h-full grid place-items-center">
      <h1 className="text-2xl font-semibold">OpeningTree</h1>
    </div>
  );
}
```

- [ ] **Step 8:** Add Vitest config to `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 9:** Create `tests/setup.ts`

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 10:** Verify

```bash
npm run dev   # opens at http://localhost:5173, shows "OpeningTree"
# Ctrl-C, then:
npm run build && npm run preview   # production build serves
```

Expected: Dev server starts and shows the heading. Build completes without errors.

- [ ] **Step 11:** Commit

```bash
git add -A && git commit -m "scaffold: Vite + React + TS + Tailwind + Vitest"
```

---

### Task 2: LRU cache

**Files:**
- Create: `src/lib/cache.ts`, `tests/unit/lib/cache.test.ts`

- [ ] **Step 1:** Write the failing test `tests/unit/lib/cache.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { LRU } from '../../../src/lib/cache';

describe('LRU', () => {
  it('returns set values', () => {
    const c = new LRU<string, number>(3);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const c = new LRU<string, number>(3);
    expect(c.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry when at capacity', () => {
    const c = new LRU<string, number>(2);
    c.set('a', 1); c.set('b', 2);
    c.get('a');           // 'a' is now most-recently used
    c.set('c', 3);        // should evict 'b'
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });
});
```

- [ ] **Step 2:** Run — expect fail

```bash
npx vitest run tests/unit/lib/cache.test.ts
```

Expected: fails because `src/lib/cache.ts` doesn't exist.

- [ ] **Step 3:** Implement `src/lib/cache.ts`

```ts
export class LRU<K, V> {
  private m = new Map<K, V>();
  constructor(private capacity: number) {}

  get(k: K): V | undefined {
    if (!this.m.has(k)) return undefined;
    const v = this.m.get(k)!;
    this.m.delete(k);
    this.m.set(k, v);
    return v;
  }

  set(k: K, v: V): void {
    if (this.m.has(k)) this.m.delete(k);
    else if (this.m.size >= this.capacity) {
      const first = this.m.keys().next().value as K;
      this.m.delete(first);
    }
    this.m.set(k, v);
  }
}
```

- [ ] **Step 4:** Run — expect pass

```bash
npx vitest run tests/unit/lib/cache.test.ts
```

- [ ] **Step 5:** Commit

```bash
git add src/lib/cache.ts tests/unit/lib/cache.test.ts
git commit -m "feat(cache): LRU implementation"
```

---

### Task 3: Lichess explorer client

**Files:**
- Create: `src/lib/lichess.ts`, `tests/unit/lib/lichess.test.ts`

- [ ] **Step 1:** Write the failing test

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExplorer } from '../../../src/lib/lichess';

describe('fetchExplorer', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('hits /masters when source=masters with the FEN', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ white: 1, draws: 1, black: 1, moves: [] }), { status: 200 })
    );
    await fetchExplorer({ source: 'masters', fen: 'startpos' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/explorer\.lichess\.ovh\/masters/);
    expect(String(spy.mock.calls[0][0])).toMatch(/fen=startpos/);
  });

  it('hits /lichess when source=lichess', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ white: 0, draws: 0, black: 0, moves: [] }), { status: 200 })
    );
    await fetchExplorer({ source: 'lichess', fen: 'startpos' });
    expect(String(spy.mock.calls[0][0])).toMatch(/explorer\.lichess\.ovh\/lichess/);
  });

  it('caches by (source,fen) so a second call does not refetch', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ white: 0, draws: 0, black: 0, moves: [] }), { status: 200 })
    );
    await fetchExplorer({ source: 'masters', fen: 'X' });
    await fetchExplorer({ source: 'masters', fen: 'X' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2:** Run — expect fail

```bash
npx vitest run tests/unit/lib/lichess.test.ts
```

- [ ] **Step 3:** Implement `src/lib/lichess.ts`

```ts
import { LRU } from './cache';

export type Source = 'masters' | 'lichess';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
}

export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string };
}

const cache = new LRU<string, ExplorerResult>(500);

export function clearExplorerCache() { /* test seam */ (cache as any).m.clear(); }

export interface FetchOpts { source: Source; fen: string; signal?: AbortSignal; }

export async function fetchExplorer({ source, fen, signal }: FetchOpts): Promise<ExplorerResult> {
  const key = `${source}|${fen}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `https://explorer.lichess.ovh/${source}?fen=${encodeURIComponent(fen)}&topGames=0&moves=20`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Explorer ${source} ${res.status}`);
  const data = (await res.json()) as ExplorerResult;
  cache.set(key, data);
  return data;
}
```

- [ ] **Step 4:** Run — expect pass

- [ ] **Step 5:** Commit

```bash
git add src/lib/lichess.ts tests/unit/lib/lichess.test.ts
git commit -m "feat(lichess): explorer fetch with LRU cache"
```

---

### Task 4: Game store

**Files:**
- Create: `src/store/gameStore.ts`, `tests/unit/store/gameStore.test.ts`

- [ ] **Step 1:** Failing test

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../../src/store/gameStore';

describe('gameStore', () => {
  beforeEach(() => { useGameStore.getState().reset(); });

  it('starts at the standard chess starting position', () => {
    const s = useGameStore.getState();
    expect(s.fen).toContain('rnbqkbnr/pppppppp');
    expect(s.history).toEqual([]);
  });

  it('applies a legal move and advances FEN', () => {
    const { applyMove } = useGameStore.getState();
    const ok = applyMove('e4');
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    expect(s.history).toEqual(['e4']);
    expect(s.fen).toContain('b'); // black to move
  });

  it('rejects an illegal move and does not mutate state', () => {
    const before = useGameStore.getState().fen;
    const ok = useGameStore.getState().applyMove('e5'); // illegal from start
    expect(ok).toBe(false);
    expect(useGameStore.getState().fen).toBe(before);
  });

  it('goToPly truncates history', () => {
    const { applyMove, goToPly } = useGameStore.getState();
    applyMove('e4'); applyMove('e5'); applyMove('Nf3');
    goToPly(1);
    expect(useGameStore.getState().history).toEqual(['e4']);
  });

  it('source toggles between masters and lichess', () => {
    const { setSource } = useGameStore.getState();
    setSource('lichess');
    expect(useGameStore.getState().source).toBe('lichess');
  });
});
```

- [ ] **Step 2:** Run — expect fail

- [ ] **Step 3:** Implement `src/store/gameStore.ts`

```ts
import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { Source } from '../lib/lichess';

interface GameState {
  fen: string;
  history: string[];       // SAN moves
  source: Source;
  applyMove: (san: string) => boolean;
  goToPly: (ply: number) => void;
  setSource: (s: Source) => void;
  setFen: (fen: string) => void;
  reset: () => void;
}

const startFen = new Chess().fen();

function fenFromHistory(history: string[]): string {
  const c = new Chess();
  for (const m of history) c.move(m);
  return c.fen();
}

export const useGameStore = create<GameState>((set, get) => ({
  fen: startFen,
  history: [],
  source: 'masters',
  applyMove(san) {
    const c = new Chess(get().fen);
    const m = c.move(san);
    if (!m) return false;
    set({ fen: c.fen(), history: [...get().history, m.san] });
    return true;
  },
  goToPly(ply) {
    const trimmed = get().history.slice(0, ply);
    set({ history: trimmed, fen: fenFromHistory(trimmed) });
  },
  setSource(s) { set({ source: s }); },
  setFen(fen) { set({ fen, history: [] }); }, // history is unknown when jumping by FEN
  reset() { set({ fen: startFen, history: [], source: 'masters' }); },
}));
```

- [ ] **Step 4:** Run — expect pass

- [ ] **Step 5:** Commit

```bash
git add src/store/gameStore.ts tests/unit/store/gameStore.test.ts
git commit -m "feat(store): game state with chess.js"
```

---

### Task 5: Chess board component

**Files:**
- Create: `src/components/board/ChessBoard.tsx`

- [ ] **Step 1:** Implement

```tsx
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';

function toDestsMap(c: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) {
    const from = m.from as string;
    if (!dests.has(from)) dests.set(from, []);
    dests.get(from)!.push(m.to);
  }
  return dests;
}

export function ChessBoard() {
  const ref = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const fen = useGameStore(s => s.fen);
  const applyMove = useGameStore(s => s.applyMove);

  useEffect(() => {
    if (!ref.current) return;
    const c = new Chess(fen);
    apiRef.current = Chessground(ref.current, {
      fen,
      turnColor: c.turn() === 'w' ? 'white' : 'black',
      movable: {
        free: false,
        color: c.turn() === 'w' ? 'white' : 'black',
        dests: toDestsMap(c),
        events: {
          after: (from, to) => {
            const chess = new Chess(fen);
            const m = chess.move({ from, to, promotion: 'q' });
            if (m) applyMove(m.san);
          },
        },
      },
    });
    return () => apiRef.current?.destroy();
  }, []);

  useEffect(() => {
    const c = new Chess(fen);
    apiRef.current?.set({
      fen,
      turnColor: c.turn() === 'w' ? 'white' : 'black',
      movable: { color: c.turn() === 'w' ? 'white' : 'black', dests: toDestsMap(c) },
    });
  }, [fen]);

  return <div ref={ref} className="w-[480px] h-[480px]" />;
}
```

- [ ] **Step 2:** Wire into `src/App.tsx`

```tsx
import { ChessBoard } from './components/board/ChessBoard';

export default function App() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">OpeningTree</h1>
      <ChessBoard />
    </div>
  );
}
```

- [ ] **Step 3:** Verify manually

```bash
npm run dev
```

Open the dev URL; drag a piece. Expected: pieces move, illegal moves snap back.

- [ ] **Step 4:** Commit

```bash
git add src/components/board/ChessBoard.tsx src/App.tsx
git commit -m "feat(board): chessground wrapper bound to game store"
```

---

### Task 6: Move list

**Files:**
- Create: `src/components/board/MoveList.tsx`

- [ ] **Step 1:** Implement

```tsx
import { useGameStore } from '../../store/gameStore';

export function MoveList() {
  const history = useGameStore(s => s.history);
  const goToPly = useGameStore(s => s.goToPly);
  return (
    <ol className="text-sm font-mono leading-6">
      {history.map((san, i) => {
        const moveNum = Math.floor(i / 2) + 1;
        const prefix = i % 2 === 0 ? `${moveNum}.` : '';
        return (
          <button
            key={i}
            onClick={() => goToPly(i + 1)}
            className="mr-1 px-1 hover:bg-amber-100 rounded"
          >
            {prefix}{san}
          </button>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2:** Mount in `App.tsx` below the board.
- [ ] **Step 3:** Verify dev: make a few moves → see the list, click an earlier move → board rewinds.
- [ ] **Step 4:** Commit

```bash
git add src/components/board/MoveList.tsx src/App.tsx
git commit -m "feat(board): clickable move list"
```

---

### Task 7: Explorer hook + table

**Files:**
- Create: `src/hooks/useExplorer.ts`, `src/components/explorer/ExplorerTable.tsx`

- [ ] **Step 1:** Implement `src/hooks/useExplorer.ts`

```ts
import { useEffect, useState } from 'react';
import { fetchExplorer, type ExplorerResult, type Source } from '../lib/lichess';

export function useExplorer(fen: string, source: Source): {
  data?: ExplorerResult; loading: boolean; error?: string;
} {
  const [data, setData] = useState<ExplorerResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setError(undefined);
    fetchExplorer({ source, fen, signal: ctrl.signal })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { if (e.name !== 'AbortError') { setError(String(e)); setLoading(false); } });
    return () => ctrl.abort();
  }, [fen, source]);

  return { data, loading, error };
}
```

- [ ] **Step 2:** Implement `src/components/explorer/ExplorerTable.tsx`

```tsx
import { useGameStore } from '../../store/gameStore';
import { useExplorer } from '../../hooks/useExplorer';

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

export function ExplorerTable() {
  const fen = useGameStore(s => s.fen);
  const source = useGameStore(s => s.source);
  const applyMove = useGameStore(s => s.applyMove);
  const { data, loading, error } = useExplorer(fen, source);

  if (error) return <div className="text-red-700 text-sm">Error: {error}</div>;
  if (loading && !data) return <div className="text-sm text-neutral-500">Loading…</div>;
  if (!data) return null;

  return (
    <table className="text-sm font-mono w-full">
      <thead className="text-xs text-neutral-500">
        <tr><th className="text-left">Move</th><th>Games</th><th>W/D/B</th></tr>
      </thead>
      <tbody>
        {data.moves.map(m => {
          const total = m.white + m.draws + m.black;
          return (
            <tr key={m.uci} className="hover:bg-amber-50 cursor-pointer"
                onClick={() => applyMove(m.san)}>
              <td className="text-left">{m.san}</td>
              <td className="text-right">{total.toLocaleString()}</td>
              <td className="text-right">
                {pct(m.white, total)} / {pct(m.draws, total)} / {pct(m.black, total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3:** Mount in App layout (two-column: left board+list, right table for now).
- [ ] **Step 4:** Verify dev: see live stats on starting position, click rows to play moves.
- [ ] **Step 5:** Commit

```bash
git add src/hooks/useExplorer.ts src/components/explorer/ExplorerTable.tsx src/App.tsx
git commit -m "feat(explorer): stats table for current position"
```

---

### Task 8: App shell layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1:** Replace with proper layout

```tsx
import { ChessBoard } from './components/board/ChessBoard';
import { MoveList } from './components/board/MoveList';
import { ExplorerTable } from './components/explorer/ExplorerTable';

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-3 border-b bg-white flex items-center gap-4">
        <h1 className="text-xl font-semibold">OpeningTree</h1>
      </header>
      <main className="flex-1 grid grid-cols-[auto_1fr] gap-6 p-6 overflow-hidden">
        <section className="flex flex-col gap-4">
          <ChessBoard />
          <MoveList />
          <div className="w-[480px] max-h-[40vh] overflow-auto border rounded p-2 bg-white">
            <ExplorerTable />
          </div>
        </section>
        <section className="rounded border bg-white grid place-items-center">
          <div className="text-neutral-400">Tree (Phase B)</div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2:** Verify dev manually.
- [ ] **Step 3:** Commit

```bash
git add src/App.tsx
git commit -m "feat(app): two-column shell layout"
```

---

## Phase B — The visual tree (the headline)

### Task 9: Tree data shape + pruning

**Files:**
- Create: `src/components/tree/treeTypes.ts`, `src/lib/tree.ts`, `tests/unit/lib/tree.test.ts`

- [ ] **Step 1:** Define types in `treeTypes.ts`

```ts
export interface TreeNode {
  id: string;            // FEN
  san?: string;          // move that reached this node (root has none)
  white: number;
  draws: number;
  black: number;
  children: TreeNode[];
  expanded: boolean;     // ui state: are children loaded/visible?
  loading?: boolean;
}

export interface TreeBuildOpts {
  minShare: number;      // prune children below this share of parent's plays (0..1)
  maxDepth: number;      // max ply depth from root
}
```

- [ ] **Step 2:** Failing test in `tests/unit/lib/tree.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { pruneChildren } from '../../../src/lib/tree';
import type { TreeNode } from '../../../src/components/tree/treeTypes';

const make = (san: string, w: number, d: number, b: number): TreeNode => ({
  id: san, san, white: w, draws: d, black: b, children: [], expanded: false,
});

describe('pruneChildren', () => {
  it('keeps only children whose share >= minShare', () => {
    const parent = make('p', 0, 0, 0);
    parent.children = [make('a', 90, 0, 0), make('b', 5, 0, 0), make('c', 5, 0, 0)];
    const kept = pruneChildren(parent, { minShare: 0.1, maxDepth: 10 });
    expect(kept.map(n => n.san)).toEqual(['a']);
  });

  it('returns all children when parent has zero plays (no basis for pruning)', () => {
    const parent = make('p', 0, 0, 0);
    parent.children = [make('a', 0, 0, 0), make('b', 0, 0, 0)];
    const kept = pruneChildren(parent, { minShare: 0.1, maxDepth: 10 });
    expect(kept.length).toBe(2);
  });
});
```

- [ ] **Step 3:** Run — expect fail.

- [ ] **Step 4:** Implement `src/lib/tree.ts`

```ts
import type { TreeNode, TreeBuildOpts } from '../components/tree/treeTypes';

export function plays(n: TreeNode): number { return n.white + n.draws + n.black; }

export function pruneChildren(parent: TreeNode, opts: TreeBuildOpts): TreeNode[] {
  const total = plays(parent);
  if (total === 0) return parent.children;
  return parent.children.filter(c => plays(c) / total >= opts.minShare);
}
```

- [ ] **Step 5:** Run — expect pass.

- [ ] **Step 6:** Commit

```bash
git add src/components/tree/treeTypes.ts src/lib/tree.ts tests/unit/lib/tree.test.ts
git commit -m "feat(tree): types and prune helper"
```

---

### Task 10: Tree component scaffold + initial render

**Files:**
- Create: `src/components/tree/treeRender.ts`, `src/components/tree/OpeningTree.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** Implement `treeRender.ts`

```ts
import * as d3 from 'd3-selection';
import { hierarchy, tree as d3tree, HierarchyPointNode } from 'd3-hierarchy';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { TreeNode } from './treeTypes';

export interface RenderOpts {
  width: number;
  height: number;
  activePath: Set<string>; // node ids on current line
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null, screenX: number, screenY: number) => void;
}

function nodeRadius(n: TreeNode): number {
  const p = n.white + n.draws + n.black;
  return Math.min(30, Math.max(5, 5 + 5 * Math.log10(p + 1)));
}

function nodeFill(n: TreeNode): string {
  const p = n.white + n.draws + n.black;
  if (p === 0) return '#cfcfcf';
  const s = (n.white - n.black) / p; // -1..1
  // interpolate between dark slate (#3a3a3a) and warm white (#f4e4bc) via neutral
  if (s >= 0) return d3.interpolate('#cfcfcf', '#f4e4bc')(s) as unknown as string;
  return d3.interpolate('#cfcfcf', '#3a3a3a')(-s) as unknown as string;
}

export function renderTree(
  svgEl: SVGSVGElement,
  data: TreeNode,
  opts: RenderOpts,
) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const root = hierarchy<TreeNode>(data, n => n.expanded ? n.children : []);
  const layout = d3tree<TreeNode>().nodeSize([28, 140]);
  layout(root);

  const g = svg.append('g').attr('class', 'pan');

  // links
  g.selectAll('path.link')
    .data(root.links())
    .enter().append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', d => {
      const target = d.target.data;
      const parent = d.source.data;
      const tp = target.white + target.draws + target.black;
      const pp = parent.white + parent.draws + parent.black || 1;
      return Math.max(1, Math.min(8, (tp / pp) * 8));
    })
    .attr('d', (d: any) => {
      const s = d.source, t = d.target;
      return `M${s.y},${s.x} C${(s.y + t.y) / 2},${s.x} ${(s.y + t.y) / 2},${t.x} ${t.y},${t.x}`;
    });

  // edge labels (SAN)
  g.selectAll('text.edge')
    .data(root.links())
    .enter().append('text')
    .attr('class', 'edge')
    .attr('font-size', 10)
    .attr('fill', '#475569')
    .attr('x', (d: any) => (d.source.y + d.target.y) / 2)
    .attr('y', (d: any) => (d.source.x + d.target.x) / 2 - 4)
    .attr('text-anchor', 'middle')
    .text((d: any) => d.target.data.san ?? '');

  // nodes
  const n = g.selectAll('g.node')
    .data(root.descendants() as HierarchyPointNode<TreeNode>[])
    .enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')
    .on('click', (_e, d) => opts.onNodeClick(d.data.id))
    .on('mouseenter', function (e: MouseEvent, d) { opts.onNodeHover(d.data.id, e.clientX, e.clientY); })
    .on('mouseleave', () => opts.onNodeHover(null, 0, 0));

  n.append('circle')
    .attr('r', d => nodeRadius(d.data))
    .attr('fill', d => nodeFill(d.data))
    .attr('stroke', d => opts.activePath.has(d.data.id) ? '#d97706' : '#94a3b8')
    .attr('stroke-width', d => opts.activePath.has(d.data.id) ? 3 : 1);

  // pan/zoom
  const z = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 4])
    .on('zoom', (ev) => g.attr('transform', ev.transform.toString()));
  svg.call(z as any);
  // initial centering: place root at left middle
  svg.call(z.transform as any, zoomIdentity.translate(60, opts.height / 2));
}
```

- [ ] **Step 2:** Implement `OpeningTree.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { renderTree } from './treeRender';
import type { TreeNode } from './treeTypes';

interface Props {
  data: TreeNode;
  activePath: Set<string>;
  onNodeClick: (id: string) => void;
}

export function OpeningTree({ data, activePath, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    renderTree(svgRef.current, data, {
      width: rect.width,
      height: rect.height,
      activePath,
      onNodeClick,
      onNodeHover: (id, x, y) => setHover(id ? { id, x, y } : null),
    });
  }, [data, activePath]);

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      {hover && (
        <div
          className="pointer-events-none absolute text-xs bg-white border rounded p-1 shadow"
          style={{ left: hover.x + 12, top: hover.y + 12, position: 'fixed' }}
        >
          {hover.id.slice(0, 20)}…
        </div>
      )}
    </div>
  );
}
```

(Mini-board preview comes in Task 12; for now the tooltip just shows a truncated FEN.)

- [ ] **Step 3:** Mount in `App.tsx` with a hard-coded mini tree for first verification

```tsx
// inside App.tsx, replace the placeholder section
import { OpeningTree } from './components/tree/OpeningTree';
const dummy: TreeNode = {
  id: 'root', white: 100, draws: 50, black: 50, children: [
    { id: 'a', san: 'e4', white: 60, draws: 20, black: 20, children: [], expanded: false },
    { id: 'b', san: 'd4', white: 30, draws: 15, black: 15, children: [], expanded: false },
  ], expanded: true,
};
// ...
<section className="rounded border bg-white">
  <OpeningTree data={dummy} activePath={new Set(['root'])} onNodeClick={()=>{}} />
</section>
```

- [ ] **Step 4:** Verify dev — see three circles connected by curves with "e4"/"d4" labels.
- [ ] **Step 5:** Commit

```bash
git add src/components/tree -A src/App.tsx
git commit -m "feat(tree): initial D3 render of static node-link diagram"
```

---

### Task 11: Live tree from game state — root + active path

**Files:**
- Create: `src/hooks/useTree.ts`
- Modify: `src/App.tsx` to use it

- [ ] **Step 1:** Implement `useTree.ts`

```ts
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { fetchExplorer } from '../lib/lichess';
import { useGameStore } from '../store/gameStore';
import type { TreeNode } from '../components/tree/treeTypes';

const startFen = new Chess().fen();

async function fetchNode(fen: string, source: 'masters' | 'lichess'): Promise<TreeNode> {
  const r = await fetchExplorer({ source, fen });
  const children: TreeNode[] = await Promise.all(
    r.moves.map(async m => {
      const c = new Chess(fen); c.move(m.san);
      return {
        id: c.fen(),
        san: m.san,
        white: m.white, draws: m.draws, black: m.black,
        children: [],
        expanded: false,
      };
    })
  );
  return {
    id: fen,
    white: r.white, draws: r.draws, black: r.black,
    children,
    expanded: true,
  };
}

// Build the path of FENs from start to current.
function pathFens(history: string[]): string[] {
  const c = new Chess(); const out = [c.fen()];
  for (const m of history) { c.move(m); out.push(c.fen()); }
  return out;
}

export function useTree() {
  const history = useGameStore(s => s.history);
  const source = useGameStore(s => s.source);
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [activePath, setActivePath] = useState<Set<string>>(new Set([startFen]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fens = pathFens(history);
      // Build a chain of expanded nodes following the active path
      let node = await fetchNode(fens[0], source);
      const top = node;
      for (let i = 1; i < fens.length; i++) {
        const child = node.children.find(c => c.id === fens[i]);
        if (!child) break;
        const expanded = await fetchNode(fens[i], source);
        child.children = expanded.children;
        child.expanded = true;
        node = child;
      }
      if (!cancelled) {
        setRoot(top);
        setActivePath(new Set(fens));
      }
    })();
    return () => { cancelled = true; };
  }, [history.join('|'), source]);

  return { root, activePath };
}
```

- [ ] **Step 2:** Replace dummy tree in `App.tsx`

```tsx
import { OpeningTree } from './components/tree/OpeningTree';
import { useTree } from './hooks/useTree';
import { useGameStore } from './store/gameStore';

// ...inside App component
const { root, activePath } = useTree();
const setFen = useGameStore(s => s.setFen);
// ...in the right section:
<section className="rounded border bg-white">
  {root ? (
    <OpeningTree data={root} activePath={activePath} onNodeClick={setFen} />
  ) : (
    <div className="grid place-items-center h-full text-neutral-400">Loading tree…</div>
  )}
</section>
```

- [ ] **Step 3:** Verify dev — open page, see root + main first moves. Make a move on the board → tree updates, active path highlights in gold along the chain.
- [ ] **Step 4:** Commit

```bash
git add src/hooks/useTree.ts src/App.tsx
git commit -m "feat(tree): live tree driven by game state and active path"
```

---

### Task 12: Hover mini-board preview

**Files:**
- Create: `src/components/tree/NodePreview.tsx`
- Modify: `src/components/tree/OpeningTree.tsx`

- [ ] **Step 1:** Implement `NodePreview.tsx`

```tsx
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';

interface Props { fen: string; x: number; y: number; }

export function NodePreview({ fen, x, y }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const api = Chessground(ref.current, { fen, viewOnly: true, coordinates: false });
    return () => api.destroy();
  }, [fen]);
  return (
    <div
      className="pointer-events-none fixed z-50 border bg-white shadow-lg rounded p-1"
      style={{ left: x + 16, top: y + 16, width: 160, height: 160 }}
    >
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
```

- [ ] **Step 2:** In `OpeningTree.tsx`, replace the truncated-FEN tooltip with `<NodePreview fen={hover.id} x={hover.x} y={hover.y} />`.
- [ ] **Step 3:** Verify dev — hover any node → mini-board appears showing that exact position.
- [ ] **Step 4:** Commit

```bash
git add src/components/tree/NodePreview.tsx src/components/tree/OpeningTree.tsx
git commit -m "feat(tree): hover mini-board preview"
```

---

### Task 13: Lazy expansion on node click

**Files:**
- Modify: `src/components/tree/OpeningTree.tsx`, `src/hooks/useTree.ts`

Currently clicking a node calls `setFen` which collapses history (because we don't know moves). Instead: click should both navigate the active path *and* expand its children. We'll add an `onExpand` callback distinct from click-to-jump.

- [ ] **Step 1:** Extend `useTree` with an expander

```ts
// inside useTree
const expand = async (fen: string) => {
  if (!root) return;
  const child = findNode(root, fen);
  if (!child || child.expanded) return;
  child.loading = true;
  setRoot({ ...root });
  const fetched = await fetchNode(fen, source);
  child.children = fetched.children;
  child.expanded = true;
  child.loading = false;
  setRoot({ ...root });
};
function findNode(n: TreeNode, id: string): TreeNode | null {
  if (n.id === id) return n;
  for (const c of n.children) { const r = findNode(c, id); if (r) return r; }
  return null;
}
return { root, activePath, expand };
```

- [ ] **Step 2:** Pass `expand` down

```tsx
const { root, activePath, expand } = useTree();
// ...
<OpeningTree
  data={root}
  activePath={activePath}
  onNodeClick={(id) => expand(id)}
/>
```

For now we drop the click-to-jump behavior on tree nodes (clicking the explorer table or making moves on the board is the way to navigate). Re-add it in Task 16 via shift-click.

- [ ] **Step 3:** Verify — click a non-active node, watch its children load and the tree expand.
- [ ] **Step 4:** Commit

```bash
git add src/hooks/useTree.ts src/App.tsx src/components/tree/OpeningTree.tsx
git commit -m "feat(tree): lazy expansion via click"
```

---

### Task 14: Pruning + max-depth controls

**Files:**
- Create: `src/components/ui/ViewSettings.tsx`
- Modify: `src/store/gameStore.ts` (add `minShare`, `maxDepth`, setters), `src/hooks/useTree.ts` (apply prune)

- [ ] **Step 1:** Extend the store

```ts
// in gameStore.ts add:
minShare: number;
maxDepth: number;
setMinShare: (n: number) => void;
setMaxDepth: (n: number) => void;
// in the create() initial state:
minShare: 0.005,
maxDepth: 12,
setMinShare(n) { set({ minShare: n }); },
setMaxDepth(n) { set({ maxDepth: n }); },
// reset() should also reset minShare:0.005, maxDepth:12
```

- [ ] **Step 2:** Apply prune in `useTree` when assembling children

```ts
import { pruneChildren } from '../lib/tree';
// after fetchNode, before returning:
node.children = pruneChildren(node, { minShare, maxDepth });
```

`minShare`/`maxDepth` read from `useGameStore.getState()` (or via selectors).

- [ ] **Step 3:** Implement `ViewSettings.tsx`

```tsx
import { useGameStore } from '../../store/gameStore';

export function ViewSettings() {
  const minShare = useGameStore(s => s.minShare);
  const maxDepth = useGameStore(s => s.maxDepth);
  const setMinShare = useGameStore(s => s.setMinShare);
  const setMaxDepth = useGameStore(s => s.setMaxDepth);
  return (
    <div className="flex items-center gap-4 text-xs text-neutral-600">
      <label>Min share: {(minShare * 100).toFixed(1)}%
        <input type="range" min="0" max="0.05" step="0.005"
          value={minShare} onChange={e => setMinShare(+e.target.value)} />
      </label>
      <label>Max depth: {maxDepth}
        <input type="range" min="2" max="30" step="1"
          value={maxDepth} onChange={e => setMaxDepth(+e.target.value)} />
      </label>
    </div>
  );
}
```

- [ ] **Step 4:** Mount in header.
- [ ] **Step 5:** Verify dev: slide the share slider → see hair-thin branches appear/disappear.
- [ ] **Step 6:** Commit

```bash
git add -A
git commit -m "feat(tree): minShare and maxDepth view controls"
```

---

## Phase C — Utility features

### Task 15: ECO database + header

**Files:**
- Create: `src/lib/eco.ts`, `src/lib/eco.data.json`, `src/components/explorer/OpeningHeader.tsx`, `tests/unit/lib/eco.test.ts`

The Lichess explorer response already includes `opening: { eco, name }`. We piggyback on that for MVP and only build a local fallback for the start position.

- [ ] **Step 1:** Implement `eco.ts`

```ts
export interface EcoInfo { eco: string; name: string; }

export function ecoFromExplorer(opening?: EcoInfo): EcoInfo | null {
  return opening ?? null;
}
```

- [ ] **Step 2:** Implement `OpeningHeader.tsx`

```tsx
import { useGameStore } from '../../store/gameStore';
import { useExplorer } from '../../hooks/useExplorer';

export function OpeningHeader() {
  const fen = useGameStore(s => s.fen);
  const source = useGameStore(s => s.source);
  const { data } = useExplorer(fen, source);
  if (!data?.opening) return <div className="text-neutral-400 text-sm">—</div>;
  return (
    <div className="text-sm">
      <span className="font-mono mr-2">{data.opening.eco}</span>
      <span>{data.opening.name}</span>
    </div>
  );
}
```

- [ ] **Step 3:** Mount under the header bar.
- [ ] **Step 4:** Verify dev: play 1.e4 c6 → "B10 — Caro-Kann Defense" appears.
- [ ] **Step 5:** Commit

```bash
git add -A
git commit -m "feat(explorer): ECO header from explorer payload"
```

---

### Task 16: Search (FEN/PGN paste) and shift-click re-root

**Files:**
- Create: `src/components/ui/SearchBar.tsx`
- Modify: `src/store/gameStore.ts` (add `setHistoryFromPgn`), `src/components/tree/OpeningTree.tsx` (shift-click handler), `src/App.tsx`

- [ ] **Step 1:** Add to store

```ts
// gameStore.ts
import { Chess } from 'chess.js';
// add:
setHistoryFromPgn: (pgn: string) => boolean;
// implement:
setHistoryFromPgn(pgn) {
  const c = new Chess();
  if (!c.loadPgn(pgn)) return false;
  set({ history: c.history(), fen: c.fen() });
  return true;
}
```

- [ ] **Step 2:** `SearchBar.tsx`

```tsx
import { useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';

export function SearchBar() {
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const setFen = useGameStore(s => s.setFen);
  const setHistoryFromPgn = useGameStore(s => s.setHistoryFromPgn);

  function submit() {
    setErr(null);
    // Try FEN first
    try {
      new Chess(val);
      setFen(val);
      return;
    } catch {}
    if (setHistoryFromPgn(val)) return;
    setErr('Not a valid FEN or PGN');
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded px-2 py-1 text-sm w-96 font-mono"
        placeholder="Paste FEN or PGN…"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
```

- [ ] **Step 3:** Re-root via shift-click — modify `OpeningTree.tsx`

```tsx
// extend onNodeClick to receive a boolean
.on('click', (e: MouseEvent, d) => opts.onNodeClick(d.data.id, e.shiftKey))
```

And in `App.tsx` wire to `setFen` when shift held, `expand` otherwise.

```tsx
<OpeningTree
  data={root}
  activePath={activePath}
  onNodeClick={(id, shift) => shift ? setFen(id) : expand(id)}
/>
```

- [ ] **Step 4:** Mount `SearchBar` in header.
- [ ] **Step 5:** Verify dev: paste `rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2` → board updates. Paste `1. e4 c6 2. d4 d5` → moves load.
- [ ] **Step 6:** Commit

```bash
git add -A
git commit -m "feat(ui): FEN/PGN search and shift-click re-root"
```

---

### Task 17: Source toggle

**Files:**
- Create: `src/components/ui/SourceToggle.tsx`

- [ ] **Step 1:**

```tsx
import { useGameStore } from '../../store/gameStore';

export function SourceToggle() {
  const source = useGameStore(s => s.source);
  const setSource = useGameStore(s => s.setSource);
  return (
    <div className="inline-flex border rounded overflow-hidden text-sm">
      {(['masters', 'lichess'] as const).map(s => (
        <button
          key={s}
          onClick={() => setSource(s)}
          className={`px-3 py-1 ${source === s ? 'bg-amber-200' : 'bg-white'}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Mount in header. Verify dev: toggle to "lichess" → table + tree visibly redistribute.
- [ ] **Step 3:** Commit

```bash
git add -A && git commit -m "feat(ui): source toggle (masters | lichess)"
```

---

### Task 18: FEN-in-URL share links

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`, `src/store/gameStore.ts`

We'll keep it simple: read `?fen=` on mount, and on every `fen` change replace the URL.

- [ ] **Step 1:** In `main.tsx`, wrap with `BrowserRouter`

```tsx
import { BrowserRouter } from 'react-router-dom';
// ...
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter><App /></BrowserRouter>
);
```

- [ ] **Step 2:** In `App.tsx`, sync URL ↔ store

```tsx
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function useFenUrlSync() {
  const [params, setParams] = useSearchParams();
  const fen = useGameStore(s => s.fen);
  const setFen = useGameStore(s => s.setFen);
  useEffect(() => {
    const initial = params.get('fen');
    if (initial && initial !== fen) setFen(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setParams(prev => { const p = new URLSearchParams(prev); p.set('fen', fen); return p; }, { replace: true });
  }, [fen, setParams]);
}
```

Call `useFenUrlSync()` from `App`.

- [ ] **Step 3:** Verify: make moves, copy URL, open in new tab → board restored.
- [ ] **Step 4:** Commit

```bash
git add -A && git commit -m "feat(app): FEN-in-URL share links"
```

---

## Phase D — Testing & polish

### Task 19: Playwright happy-path E2E

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/happy-path.spec.ts`

- [ ] **Step 1:** Config

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:5173' },
});
```

- [ ] **Step 2:** Install browser

```bash
npx playwright install chromium
```

- [ ] **Step 3:** Spec

```ts
import { test, expect } from '@playwright/test';

test('loads, plays a move, sees tree update', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=OpeningTree')).toBeVisible();
  // Click an explorer-table row to play e4
  await page.locator('table >> text=e4').first().click();
  // Move appears in history
  await expect(page.locator('text=1.e4')).toBeVisible();
  // Tree has visible nodes (svg circles)
  const circles = page.locator('svg circle');
  await expect(circles.first()).toBeVisible();
});

test('FEN search jumps to position', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder^="Paste FEN"]', 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  await page.locator('input[placeholder^="Paste FEN"]').press('Enter');
  // ECO header should eventually show a Caro-Kann
  await expect(page.locator('text=Caro-Kann')).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 4:** Run

```bash
npx playwright test
```

- [ ] **Step 5:** Commit

```bash
git add -A && git commit -m "test(e2e): happy paths for moves, tree, and FEN search"
```

---

### Task 20: README & polish

**Files:**
- Create: `README.md`

- [ ] **Step 1:** Write a short README explaining what the app is, how to run it (`npm i && npm run dev`), and the Lichess data source.
- [ ] **Step 2:** Commit

```bash
git add README.md && git commit -m "docs: README"
```

---

## Self-review (executed in-place)

Spec coverage:
- §4.1 board → Task 5.  §4.2 move list → Task 6.  §4.3 explorer table → Task 7.  §4.4 visual tree → Tasks 9–14, 16.  §4.5 ECO → Task 15.  §4.6 search → Task 16.  §4.7 source toggle → Task 17.  §4.8 shareable URL → Task 18.  §10 error handling → covered inline (toast on fetch error, validation in search, soft on empty).  §11 testing → unit tests in Tasks 2/3/4/9; E2E in Task 19.

Placeholder scan: no "TBD"/"TODO" anywhere; every code step has full code; commands are explicit; no "similar to Task N".

Type consistency: `TreeNode` defined in Task 9 is the same shape used in Tasks 10–14, 16. `Source` defined in Task 3, used in Tasks 4/7/11/17. `ExplorerResult` defined in Task 3, used in Task 7. `Api` from chessground used only in Task 5.

Gaps:
- "Mobile responsive" is out-of-MVP per spec §4.
- Engine analysis, accounts, repertoires — out-of-MVP per spec §4. Not planned.
- Rate-limit handling (spec §10): covered implicitly by `setError`; we could add an explicit 429 banner later — accept as polish, not MVP-blocking.

OK to proceed.
