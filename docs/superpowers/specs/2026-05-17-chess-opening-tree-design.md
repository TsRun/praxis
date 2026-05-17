# Chess Opening Tree Explorer — Design

**Date:** 2026-05-17
**Status:** Draft (autonomous-mode brainstorm — user to review and redirect)
**Working title:** OpeningTree

---

## 1. Goal

Build a web app comparable in capability to yotta chess database / Lichess opening explorer, but where **the opening tree itself is the primary, intuitive, visual interface** — not a stack of tables. A chess player should be able to *see the shape* of an opening at a glance: which lines are mainstream, where bifurcations live, which moves favor which color.

## 2. User stories

1. **As a player**, I open the site, see the starting position and a tree fanning out into all main first moves. I scan the tree and instantly grasp that 1.e4 and 1.d4 dominate, 1.c4/1.Nf3 are smaller but real, and the rest is fringe.
2. **As a player studying the Caro-Kann**, I navigate to 1.e4 c6 by clicking on the board or the tree. The tree zooms / re-roots around that position. I see White's choices weighted by frequency, colored by result.
3. **As a player**, I hover any node in the tree and a mini-board pops up showing that exact position with a few key stats. I click to jump there.
4. **As a player**, I paste a FEN or PGN into a search box and the app jumps directly to that position, with the tree centered there.
5. **As a player**, I switch the data source from "Masters" to "Lichess Rapid 2000+" and the tree visibly redistributes — narrower branches become wider, new exotic lines appear.

## 3. Differentiator vs Lichess explorer / yotta chess

Existing tools show the explorer as a **table of moves** at the current position. The tree is implicit — you click into it row by row. OpeningTree makes the tree explicit: a large, smooth, interactive node-link diagram. Stats are encoded into node *visuals* (size, color), not buried in columns. The user comprehends shape, not just numbers.

## 4. MVP scope

### In scope (MVP)

1. **Chess board** (interactive: drag pieces, click squares, legal-move highlighting).
2. **Move list** (PGN-style scroll list of current line, click to jump).
3. **Opening explorer table** (Lichess-style stats for current position — moves, games, W/D/L %).
4. **Visual opening tree** — the headline feature (see §6).
5. **Opening identification** — ECO code + name for current position (offline ECO lookup table bundled).
6. **Position search** — paste FEN or PGN to jump to a position.
7. **Data source toggle** — Masters vs Lichess all (one toggle in MVP).
8. **Shareable URL** — current FEN encoded in the URL.

### Out of scope (post-MVP)

- User accounts / saved repertoires.
- Stockfish/engine analysis.
- Per-game browsing (clicking a stat row to open a real game).
- Authoring/annotating personal trees.
- Mobile-first responsive (basic mobile usable, but desktop is the target).
- Backend persistence; everything runs client-side against the Lichess API.

## 5. Tech stack

| Concern        | Choice                                         | Why                                      |
| -------------- | ---------------------------------------------- | ---------------------------------------- |
| Build / dev    | Vite                                           | Fast HMR, simple config.                 |
| Framework      | React 18 + TypeScript                          | Conventional, good D3 interop via refs.  |
| Chess logic    | `chess.js`                                     | De facto standard, well-tested.          |
| Board UI       | `chessground` (via `react-chessground` or thin wrapper) | The Lichess board — beautiful and fast. |
| Tree viz       | D3.js (`d3-hierarchy`, `d3-zoom`, `d3-selection`) | Best-in-class for custom node-link diagrams. SVG for crisp small node counts; can move to canvas if needed. |
| Styling        | Tailwind CSS                                   | Fast iteration on a UI-heavy app.        |
| State          | Zustand                                        | Minimal boilerplate, fine for this size. |
| Routing        | React Router                                   | FEN-in-URL for share links.              |
| Data           | Lichess Opening Explorer API (no auth, free)   | Authoritative, well-known.               |
| Testing        | Vitest (unit), Playwright (E2E)                | Stack-native.                            |
| Backend        | None for MVP                                   | Direct browser → Lichess.                |

## 6. The visual tree (the headline feature)

### 6.1 Layout

- **Hierarchical** tree using `d3.tree()`, oriented horizontally (root left, branches grow right). Reads like move order: time flows rightward.
- **Re-rootable**: shift-click a node to make it the new visible root (with breadcrumb to zoom back out).

### 6.2 Node encoding

- **Node = a position** reachable by a sequence of moves.
- **Radius**: `r = clamp(5 + 5 * log10(plays + 1), 5, 30)`. Popular positions are visibly bigger.
- **Fill color**: gradient by score from White's perspective.
  - White-favorable: warm white (`#f4e4bc`)
  - Balanced: neutral gray (`#cfcfcf`)
  - Black-favorable: dark slate (`#3a3a3a`)
  - Interpolated via HSL by `(whiteWinRate − blackWinRate)`.
- **Border**: thin gray default; **gold** when node is on the active path.

### 6.3 Edge encoding

- Edge = a move from parent → child.
- Edge label: SAN notation (`e4`, `Nf6`, `Bb5+`).
- Edge thickness: proportional to share-of-parent-plays. Mainline branches are visually thick; sidelines hair-thin.

### 6.4 Interactions

- **Hover node** → floating mini-board tooltip with the position and a stats line (games, W/D/L%).
- **Click node** → board jumps to that position; active path updates; tree does not re-root.
- **Shift+click node** → re-root tree at that node.
- **+/− affordance** on nodes with hidden children → expand / collapse subtree.
- **Pan** by drag on background; **zoom** by mouse wheel (d3-zoom).
- **Keyboard** ← / → to traverse mainline.

### 6.5 Lazy + bounded

- Children are fetched from the Lichess API only when their parent is expanded (or on the active path).
- A **popularity threshold** (default 0.5% of parent's plays) prunes microscopic branches by default. Slider to lower the threshold.
- A **max depth** control (default 12 plies = 6 full moves) caps render depth. Slider to extend.

### 6.6 Performance

- SVG is sufficient up to ~500 visible nodes (verified empirically by similar projects). Beyond that, fall back to canvas — defer that work until MVP measures it as needed.
- Cull off-viewport nodes from the DOM.
- Memoize per-FEN explorer results in a client-side LRU cache (`Map`, ~500 entries).

## 7. Layout (desktop reference)

```
┌─────────────────────────────────────────────────────────────────┐
│ OpeningTree    [search FEN/PGN]      [Masters ▾]   [⚙ settings]│
├─────────────────────────────────────────────────────────────────┤
│ ECO: B12 — Caro-Kann Defense                                    │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│      ┌────────┐      │                                          │
│      │        │      │                                          │
│      │ BOARD  │      │        VISUAL OPENING TREE              │
│      │        │      │        (the headline feature)           │
│      │        │      │                                          │
│      └────────┘      │                                          │
│                      │                                          │
│  Moves: 1.e4 c6 2.d4 │                                          │
│                      │                                          │
│  Explorer table:     │                                          │
│  ┌─────┬─────┬─────┐ │                                          │
│  │Move │Games│W/D/L│ │                                          │
│  ├─────┼─────┼─────┤ │                                          │
│  │Nf3  │ 50K │ 45/30│                                          │
│  │…    │ …   │ …   │ │                                          │
│  └─────┴─────┴─────┘ │                                          │
├──────────────────────┴──────────────────────────────────────────┤
```

## 8. Module breakdown

```
src/
├── components/
│   ├── App.tsx
│   ├── board/ChessBoard.tsx          # chessground wrapper
│   ├── board/MoveList.tsx            # PGN-style move list
│   ├── explorer/ExplorerTable.tsx    # Lichess-style table
│   ├── explorer/OpeningHeader.tsx    # ECO + name
│   ├── tree/OpeningTree.tsx          # D3 mount + lifecycle
│   ├── tree/treeRender.ts            # pure render fn (d3 layout → SVG)
│   ├── tree/NodePreview.tsx          # hover mini-board tooltip
│   └── ui/                           # buttons, sliders, etc.
├── hooks/
│   ├── useGameState.ts               # current position, history, navigation
│   └── useExplorer.ts                # cached Lichess fetches
├── lib/
│   ├── lichess.ts                    # explorer API client
│   ├── cache.ts                      # LRU FEN → ExplorerResult
│   ├── eco.ts                        # ECO code lookup
│   └── tree.ts                       # tree-build / prune logic
├── store/
│   └── gameStore.ts                  # zustand: fen, history, source, depth, threshold
└── main.tsx
```

Each module has one clear responsibility; D3 render is a pure function so the React surface stays small and testable.

## 9. Data flow

```
User move on board
      ↓
gameStore.applyMove(san)            (chess.js validates)
      ↓
new FEN derived
      ↓
useExplorer(fen) ─→ lib/lichess.ts ─→ cache.ts ─→ fetch if miss
      ↓
explorer result (moves + stats)
      ↓
ExplorerTable re-renders + tree.ts feeds OpeningTree node update
      ↓
treeRender re-runs d3.tree() layout, diffs SVG nodes/edges
```

Tree expansion is **demand-driven**: a node has no children rendered until the user expands it or it sits on the active path. Each expansion triggers one Lichess request.

## 10. Error handling

- **Network errors**: surface a small toast; keep last good state. Retry on focus.
- **Rate limiting (Lichess 429)**: honor `Retry-After`; show a soft banner; pause auto-fetches.
- **Invalid PGN/FEN paste**: inline validation message in the search input; never crash.
- **Empty positions** (no games in DB): tree node renders as a leaf with a "no games" hint instead of trying to fetch children.

## 11. Testing

- **Unit (Vitest)**: ECO lookup, tree pruning, cache LRU, chess.js wrappers, treeRender geometry given a fixed input.
- **Integration**: `useExplorer` against a mocked `fetch`. Snapshot a tree state for a known opening.
- **E2E (Playwright)**:
  1. Load app → board in start position, tree has root + main first moves.
  2. Make 1.e4 on the board → tree active path updates, explorer table updates.
  3. Hover a tree node → mini-board appears with correct position.
  4. Click a deep tree node → board jumps.
  5. Paste a Caro-Kann FEN → app jumps; ECO header shows "B12".

## 12. Success criteria

- Cold load (no cache): app interactive within 2s on broadband.
- Move on board → tree + table update: < 200ms (cached), < 800ms p95 (uncached, Lichess).
- Pan/zoom of a 200-node tree stays at 60fps on a 2020-class laptop.
- Click any tree node → board updates < 100ms.

## 13. Risks & open questions

1. **Lichess rate limits** — explorer endpoint is lenient but unbounded interactive use could hit it. Mitigation: LRU cache + debouncing + politely throttling auto-prefetch.
2. **Tree readability at scale** — 200 nodes is fine, 2000 isn't. Pruning defaults and re-rooting must do the heavy lifting; verify with a few real openings (Sicilian, Caro-Kann, KID) early.
3. **Mobile** — out of MVP, but layout must degrade gracefully (tree probably stacks below board on narrow screens).
4. **SVG vs canvas** — start SVG; have a clean fallback path. Don't over-engineer for canvas before measurement says so.

## 14. Next step

Hand off to the `writing-plans` skill to produce a concrete, step-by-step implementation plan with task-sized chunks (project scaffold → board → explorer → tree → polish), each chunk independently verifiable.
