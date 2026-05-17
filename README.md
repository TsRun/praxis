# OpeningTree

A chess opening explorer with a focus on a visual, intuitive opening **tree**
rather than the usual stack of stats tables. Make a move on the board, watch
the tree zoom in; click a node, see the mini-board; let the shape of the
opening tell you which lines are mainstream, which are sidelines, and which
are dubious — at a glance.

![Screenshot of OpeningTree showing root → e4 → c6 (Caro-Kann)](./page-carokann.png)

## Run

```bash
npm install
npm run dev                 # http://localhost:5173
```

## What's in it

- **Interactive chess board** (chessground).
- **Move list** (click any ply to rewind).
- **Explorer stats table** for the current position.
- **Visual opening tree** — D3 hierarchy, node size by popularity, color by
  white/black advantage, edge thickness by share of plays, active path
  highlighted in gold. Hover for a mini-board. Click to expand. Shift-click to
  jump to that position. Drag to pan, scroll to zoom.
- **ECO names** for any position the openings database knows about (lichess
  chess-openings dataset).
- **FEN/PGN search** — paste either format into the search bar.
- **Shareable URLs** — current FEN lives in the query string.
- **View settings** — prune low-popularity branches, cap render depth.

## Data sources

| Source | Used for | CORS |
| --- | --- | --- |
| [chessdb.cn](https://www.chessdb.cn/cloudbookc_api_en.html) | Move stats / next-move candidates | None — proxied in dev |
| [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | ECO codes and opening names | Yes (via raw.githubusercontent.com) |

> **Production note**: chessdb.cn does not send CORS headers. The Vite dev
> server proxies `/api/chessdb` → `https://www.chessdb.cn/cdb.php`. For a
> production deployment, host the same path behind your own reverse proxy
> (nginx / Cloudflare Worker) and the app will work unchanged.

> **Why not Lichess explorer?** As of May 2026 the public `explorer.lichess.ovh`
> endpoint returns 401. If you have a Lichess OAuth token you can swap the
> data source back in `src/lib/lichess.ts` — the architecture supports it.

## Stack

Vite · React 18 · TypeScript · Tailwind · Zustand · React Router · chess.js ·
chessground · D3 (`d3-hierarchy`, `d3-zoom`, `d3-interpolate`) · Vitest ·
Playwright.

## Layout

```
src/
├── components/
│   ├── board/        ChessBoard, MoveList
│   ├── explorer/     ExplorerTable, OpeningHeader
│   ├── tree/         OpeningTree (React mount) + treeRender (pure D3)
│   └── ui/           SearchBar, ViewSettings
├── hooks/            useExplorer, useTree, useFenUrlSync
├── lib/              cache (LRU), lichess (chessdb client), tree (prune), eco
└── store/            gameStore (zustand)
```

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc -b --noEmit
npm test             # vitest unit
npm run e2e          # playwright (will boot dev server)
```

## Tests

- 25 unit tests (Vitest) — cache, chessdb client, game store, tree pruning.
- 4 E2E tests (Playwright) — load, play a move, search by FEN, share by URL.

## Design / plan

See `docs/superpowers/specs/2026-05-17-chess-opening-tree-design.md` for the
design spec and `docs/superpowers/plans/2026-05-17-opening-tree.md` for the
implementation plan.
