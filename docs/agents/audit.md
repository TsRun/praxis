# Praxis UI + Backend Audit

Phase 1 of the agent loop. The loop picks the next unchecked area each hour, audits it (code + optional Playwright runtime), and appends findings under the area's heading. When every box is ticked it writes `## Audit complete` at the bottom and the loop switches to `RUNBOOK.md`.

## Areas

- [ ] Landing + auth (email/password + Google sign-in) — `src/pages/Landing*`, `src/pages/SignIn*`, `server/routes-auth*`
- [ ] Tour route (90-second standalone) — `src/tour/*`, route `/tour`
- [x] Trainer: opening studies list — `src/trainer/OpeningStudies*`, list page + create flow <!-- claimed: done -->
- [ ] Trainer: opening study editor (chapters + tree modes) — `src/trainer/OpeningStudyEditor.tsx`, `src/components/opening/*`
- [ ] Trainer: students + assign — `src/trainer/Students*`, `src/trainer/Assign*`
- [ ] Trainer: import games — `src/trainer/ImportGamesPage.tsx`, `server/import-sources.ts`
- [ ] Trainer: tactic sets — `src/trainer/Tactics*`, `server/routes-tactics*`
- [ ] Student: assignments + drill — `src/student/Assignments*`, `src/student/Drill*`
- [ ] Student: opening study viewer (incl. chapter walker) — `src/student/OpeningStudyViewer.tsx`, `src/components/opening/ChapterWalker.tsx`
- [ ] Backend API surface — `server/routes-*.ts`, auth/role middleware, error envelopes
- [ ] Cross-cutting: design tokens, theming, dark mode — `src/index.css`, shared chrome
- [ ] Cross-cutting: tests + types — coverage gaps, `tsconfig` strictness, dead test files

## Findings

_(Loop appends `### Findings — <area> (<ts>)` blocks under here as it goes.)_

### Findings — Trainer: opening studies list (2026-05-21 18:35)

Code-level audit of `src/trainer/StudiesPage.tsx` (813 LOC) and `src/trainer/NewOpeningStudyDialog.tsx` (153 LOC). Runtime/Playwright audit skipped — same constraints as the landing+auth pass (no dev server / DB in this read-only worktree).

**HIGH**

- **Severity: high** — List fetches swallow errors silently. (`src/trainer/StudiesPage.tsx:64-69`)
  `trainerStudies.list().then(setOpens)`, `trainerGames.list().then(setGames)`, `trainerTactics.list().then(setTactics)`, and `trainer.students().then(...)` have no `.catch`. If any API call fails, the corresponding state stays `null` forever, the `Section` renders `Loading…` indefinitely, and the user has no idea anything is wrong. Should surface a retryable error state per section.

- **Severity: high** — Filtered-empty state is invisible. (`src/trainer/StudiesPage.tsx:278-289`)
  When the search box matches nothing, each `Section` renders only the dashed `EmptyAddCard` ("New opening study…"). There is no "No matches for X" message. Trainers searching for a study they're sure exists see only a creation prompt and may conclude the study was deleted. Need a distinct empty-search affordance with a "Clear search" action.

**MEDIUM**

- **Severity: med** — Inline `style={{…}}` everywhere defeats theming and bloats the file. (`src/trainer/StudiesPage.tsx`, ~30 blocks)
  The file is 813 LOC largely because every layout decision is an inline object literal (page head, stats row, filter bar, four card components, dialog menu). This is the main reason a "trivial" list page is the size of the chapter walker. Move to CSS classes against `var(--*)` tokens. Bonus: makes the layout responsive in one place instead of scattered `flexWrap` calls.

- **Severity: med** — Hover state is JS-driven instead of CSS. (`src/trainer/StudiesPage.tsx:426-429, 785-790`)
  `onMouseOver` / `onMouseOut` imperatively mutate `e.currentTarget.style.background` and `borderColor`. Touchscreens don't fire mouseover, so the cards never visually respond on mobile. They also don't compose with `:focus-visible`, so keyboard users get no feedback. Replace with `:hover` + `:focus-visible` rules.

- **Severity: med** — "Side" picker in `NewOpeningStudyDialog` signals selection by color only. (`src/trainer/NewOpeningStudyDialog.tsx:117-153`)
  Picked vs unpicked side cards differ by a single `--accent-soft` background tone and an `--accent-ring` border. No checkmark, no `aria-pressed`, no `role="radio"` on the buttons, no `aria-checked`. Color-blind and screen-reader users get effectively no signal. Either model as a real radiogroup or add a non-color cue (checkmark icon, bold border).

- **Severity: med** — Menu doesn't close on Escape or focus loss. (`src/trainer/StudiesPage.tsx:71-80`)
  The "New study" dropdown only closes on outside `mousedown`. Keyboard users can't dismiss it; focus moving into other UI doesn't close it. Add `Escape` key handling and `onBlur` (with a small delay) to the menu container.

- **Severity: med** — `relativeDate` is half-localized. (`src/trainer/StudiesPage.tsx:36-44`)
  Suffixes `"just now"`, `"Xm ago"`, `"Xh ago"`, `"Xd ago"` are hardcoded English while the >1-week fallback uses `toLocaleDateString()`. French/other-locale trainers see English fragments next to a localized date. Use `Intl.RelativeTimeFormat` or pass the relative format through i18n.

**LOW**

- **Severity: low** — `START_FEN` redefined locally. (`src/trainer/StudiesPage.tsx:31`)
  `chess.js` already exports a `DEFAULT_POSITION` constant; the same string is also embedded in `OpeningStudyEditor.tsx` and elsewhere. Pull it into `src/lib/constants.ts` (or import from chess.js).

- **Severity: low** — Filter computes `q.toLowerCase()` 6× per render. (`src/trainer/StudiesPage.tsx:82-91`)
  Three filter callbacks each call `q.toLowerCase()` once on each item, plus `(s.eco ?? '').toLowerCase()` on every opening row. Tiny but easy to fix by computing `const qLow = q.toLowerCase()` once. Likely negligible until lists grow.

- **Severity: low** — No loading skeleton, just "Loading…" text. (`src/trainer/StudiesPage.tsx:540`)
  Sections render bare text "Loading…" while the request is in flight. Skeleton cards matching the grid layout would prevent layout shift when data arrives and feels more like a finished SaaS product.

- **Severity: low** — Card heights jitter when ECO chip is missing. (`src/trainer/StudiesPage.tsx:587`)
  `OpeningStudyCard` only renders the ECO `Chip` when `study.eco` is set. The card has no min-height for the chip row so studies-with-ECO are visibly taller than studies-without. Either reserve the row or always render a placeholder chip.

- **Severity: low** — Three `EmptyAddCard` instances duplicate the same "first study" affordance. (`src/trainer/StudiesPage.tsx:281-287, 311-317, 341-347`)
  On a brand-new account with zero studies, the user sees three identical dashed "create" cards stacked vertically. A single welcome-state card explaining the three study types would be friendlier than the same prompt repeated.

- **Severity: low** — Form label has no `htmlFor` / input has no `id`. (`src/trainer/NewOpeningStudyDialog.tsx:56-65`)
  `<label>` wraps `<input>` so the implicit association works, but Tab-order navigation and label-clicking are slightly less reliable than explicit `htmlFor`/`id`. Wire them up for consistency with the rest of the codebase if it does so elsewhere.

- **Severity: low** — `Btn variant="primary"` disabled when busy but no spinner inside the button. (`src/trainer/NewOpeningStudyDialog.tsx:100-110`)
  The button text changes to "Creating…" / "Create + import PGN →" but there's no spinner glyph. For slower networks, a visible spinner reduces double-click risk and feels more responsive.

**Notes / out of scope**

- Backend route for `GET /api/trainer/studies/opening` lives in `server/routes-trainer.ts` (or similar) — not in scope for this "list + create flow" area, will be re-audited under "Backend API surface".
- The "Import from Lichess" CTA at the top of the page (lines 113-122) duplicates an action that's also inside the dropdown menu (lines 144-154 visible on a different control). Mild redundancy but probably intentional for discoverability — flagging as observation, not a finding.

