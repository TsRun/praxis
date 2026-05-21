# Walkable chapters (Chessable-style chapter view)

**Date:** 2026-05-21
**Branch:** `worktree-chapter-redesign`

## Problem

A chapter in Praxis is a title attached to one opening-tree node. The
data model already encodes "chapter owns the subtree until a deeper
chapter takes over" (via `ChaptersOutline.buildChaptersTree`'s
nearest-ancestor walk). But the Chapters tab — in both the trainer
editor (`OpeningStudyEditor.tsx`) and the student viewer
(`OpeningStudyViewer.tsx`) — renders each chapter as a single static
board pinned to its anchor node. There is no way to walk the moves the
chapter actually covers.

User complaint, verbatim: *"the chapter should be not only one move but
all the subvariations under it, check how chessable chapter are done."*

In Chessable / Lichess Studies, selecting a chapter drops you into a
walkable move tree scoped to that chapter. We want the same feel
without changing the schema.

## Non-goals (deliberate)

- **No schema migration.** The current data model already supports the
  desired UX; only the view was broken. Promoting chapters to top-level
  rows with per-chapter `root_fen`, ordinal, etc. is a separate spec we
  can do later if trainers need a chapter to start from a position other
  than the study root, or to be reorderable independent of the tree.
- **No change to drill / spaced-repetition.** Quiz cards stay
  per-`opening_node` and are picked across the whole study.

## Design

### The chapter-scoped view

When a chapter is selected, the right pane becomes a walkable
mini-study rooted at the chapter's anchor node, with three regions:

1. **Read-only board** showing the current node's FEN inside the
   chapter. Defaults to the chapter's anchor position.
2. **Moves panel** listing the chapter's subtree as a SAN tree — main
   line plus side variations, with the current move highlighted. A
   chapter's subtree is the set of nodes whose nearest-ancestor titled
   chapter is *this* chapter (computed from the same
   `makeChapterLookup` helper that already exists in
   `OpeningStudyEditor`).
3. **Chapter card** with title + (eventually) markdown body editor.
   Trainer can rename. Student sees it as a header.

### Navigation inside a chapter

- Click any move in the moves panel → board jumps to that node.
- Click the chapter card title → board returns to the chapter root.
- `←` parent / `→` first child / `↑↓` sibling variations — reuse
  `useOpeningTreeNav`. The hook currently filters by the full study;
  we scope its inputs to the chapter's subtree so navigation never
  escapes the chapter.

### Chapter list (left rail)

- One row per chapter, ordered by `(node.ply, node.id)`.
- Row shows: ordinal · title · SAN path-from-root · "N positions" count
  for the chapter's subtree.
- Click to select; arrow keys to scroll between chapters can wait.
- Trainer-only: "+ New chapter" hint (creating a chapter is still done
  by typing a title under any node in Tree mode; we just surface that
  here).

### Shared component

Both trainer and student pages render the same `ChapterWalker`
component, parameterized with `readOnly` / `onSaveTitle`. The trainer
version exposes the title input; the student version shows the title
as a static heading.

## Out of scope for this PR (follow-ups)

- Markdown body editor for chapters (the `body_md` field already exists;
  surface it in a future pass).
- Chapter reorder / drag-and-drop / per-chapter root FEN.
- Lichess import flow changes.
- Quiz-mode chapter filter ("drill only this chapter").

## Files touched

- `src/trainer/OpeningStudyEditor.tsx` — rewrite `ChaptersMode`.
- `src/student/OpeningStudyViewer.tsx` — rewrite `ChaptersView`.
- (New) `src/components/opening/ChapterWalker.tsx` — shared scoped
  walker used by both.
- `src/marketing/TourPage.tsx` / `src/auth/LandingPage.tsx` — copy
  audit; the existing chapter line ("Title a position once — everything
  beneath inherits the chapter until a deeper one takes over") stays
  accurate.

## Testing

- Manual smoke in the editor: create a study, add a tree with branches,
  set chapter titles at two depths, switch to Chapters tab, walk into
  each chapter, verify keyboard nav stops at chapter boundaries.
- Same in the student viewer for an assigned study.
- `npm run typecheck` and `npm run lint` clean.
- Existing unit tests in `tests/unit/server/pgn-tree.test.ts` continue
  to pass (no backend changes).
