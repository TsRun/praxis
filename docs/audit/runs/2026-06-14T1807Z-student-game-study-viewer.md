# Audit run — 2026-06-14T18:07:03Z
**Mode:** TEST_ONE
**Subject:** student-game-study-viewer
**Result:** IMPROVED+PENDING (PR open)

Exercised `/student/study/game/8` as the student bot against prod. Happy path renders: heading "Audit run — game editor probe", PGN/White/Black chips, the chessboard (`cg-wrap` present), the Move list panel with 5 numbered move pairs, and the Progress card "0 / 0 quizzes correct". `/api/student/studies/game/8` returns 200; no page errors, no app-level console errors (the lone 401 was a browser-level `Failed to load resource` — waived). Mobile 375×812 fits (`document.scrollWidth=360`, `body.overflow-x=clip`); first focusable is a 2px solid amber outline.

**UI gap observed:** the four icon-only playback buttons in `src/components/board/MoveList.tsx` (Reset / Back / Forward / Jump to end) rely only on `title` for their accessible name. Screen readers do not consistently expose `title`, so VoiceOver/NVDA/Orca users get unlabeled buttons — and the "Jump to end" button additionally renders the literal text `▸▸`, which is read aloud verbatim. The spec captured this:

```
PLAYBACK BUTTONS: [
  { text: '',   ariaLabel: null, title: 'Reset (Home)' },
  { text: '',   ariaLabel: null, title: 'Back (←)' },
  { text: '',   ariaLabel: null, title: 'Forward (→)' },
  { text: '▸▸', ariaLabel: null, title: 'Jump to end (End)' },
]
```

**Fix:** add an `aria-label` to each of the four buttons ("Reset to start", "Previous move", "Next move", "Jump to end") and mark the `▸▸` glyph `aria-hidden`. One file, +5 lines, no behaviour change. Title tooltips and keyboard shortcut hints stay intact.

Verification on the PR branch: `npm run typecheck` ✅, `npm test` 48/48 ✅, audit spec passes against prod (smoke check only — diagnostic now logs the four buttons so the next rotation can confirm aria-labels land in the deployed build).
