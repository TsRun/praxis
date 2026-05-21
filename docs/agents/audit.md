# Praxis UI + Backend Audit

Phase 1 of the agent loop. The loop picks the next unchecked area each hour, audits it (code + optional Playwright runtime), and appends findings under the area's heading. When every box is ticked it writes `## Audit complete` at the bottom and the loop switches to `RUNBOOK.md`.

## Areas

- [ ] Landing + auth (email/password + Google sign-in) — `src/pages/Landing*`, `src/pages/SignIn*`, `server/routes-auth*`
- [x] Tour route (90-second standalone) — `src/tour/*`, route `/tour` <!-- claimed: done -->
- [ ] Trainer: opening studies list — `src/trainer/OpeningStudies*`, list page + create flow
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

### Findings — Tour route (2026-05-21 18:16 +0200)

Files audited: `src/marketing/TourPage.tsx` (950 LOC), `src/marketing/tour-script.ts`, `src/App.tsx` (route table), `src/auth/LandingPage.tsx` (entry links), `src/components/ui/atoms.tsx` (ProgressBar, MoveChip, Btn, Chip, Card), `src/index.css` (`.tour-stage`, `.tour-stage-3`, `.dot-chapter`, `.pulse-ring`, `@keyframes shake`, `@keyframes fadein`, `.scroll-row`).

Runtime audit: **skipped**. Same rationale as the Landing + auth audit — Playwright MCP is present but no signal that Postgres/seed are available, and Phase 1 forbids state-changing setup. Code-level only.

- **Severity: high** — Audit doc location pointer is wrong. (`docs/agents/audit.md:8`, `src/marketing/TourPage.tsx`)
  The audit checklist says `src/tour/*`. The tour actually lives in `src/marketing/TourPage.tsx` + `src/marketing/tour-script.ts`. Anyone (human or future agent) searching the prefix listed in the audit doc will find nothing and conclude the feature is unimplemented. Fix: either update the audit pointer to `src/marketing/Tour*` or move the files to `src/tour/` to match the conceptual route name. Moving is preferable — `src/marketing/` is a misleading sibling of `src/auth/`/`src/student/`/`src/trainer/`; the tour is product, not marketing copy.

- **Severity: high** — No `prefers-reduced-motion` opt-out for a 90 s autoplaying motion reel. (`src/marketing/TourPage.tsx:27-49`, `src/index.css:425-477`)
  The whole route is a chained CSS+JS animation that the user did not opt into. WCAG 2.3.3 (Animations from Interactions) and 2.2.2 (Pause/Stop/Hide) both apply: there must be a way for users with vestibular disorders to disable the motion, and the only motion control today is a Pause button that does not survive page reload. Good-looks-like: read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once on mount; when true, start with `paused = true`, hide the rAF loop entirely, and render each scene's *final* frame statically. Also gate the `pulse-ring`, `shake`, and `fadein` keyframes behind a `@media (prefers-reduced-motion: no-preference)` block so the CSS animations stop too.

- **Severity: high** — Returning to a backgrounded tab fast-forwards multiple scenes. (`src/marketing/TourPage.tsx:30-45`)
  Browsers throttle `requestAnimationFrame` while a tab is hidden, but they still fire it at least once shortly after the tab regains focus, with `now - last` potentially in the *seconds*. The current tick adds that whole delta to `elapsed`, jumping scenes (`prev.idx + 1`) without intermediate states. End result: switching tabs for 30 s and coming back lands you on scene 5 mid-Drill with no chance to see what was skipped. Fix: cap `dt` at the current scene's remaining duration (so at most one scene boundary crosses per tick), and/or listen on `document.visibilitychange` to pause when `document.hidden` is true.

- **Severity: high** — No keyboard navigation. (`src/marketing/TourPage.tsx:22-108`)
  This is a presentation reel — the classic keyboard expectation is "←/→ moves scenes, Space toggles pause, Home restarts". None of these are wired. There is no `useEffect` registering a global `keydown` listener. Today a keyboard user can Tab to the Back/Next/Pause buttons in the ControlBar; that works but is far slower than the standard reel UX. Fix: register a top-level `keydown` (escape if focus is in an input — there are none here) that handles ArrowLeft → `goto(idx-1)`, ArrowRight → `goto(idx+1)`, Space → `setPaused`, Home → `restart`.

- **Severity: med** — `SceneTabs` is a tab list dressed as plain buttons. (`src/marketing/TourPage.tsx:137-182`)
  Six pill buttons select which scene plays, but: no `role="tablist"` / `role="tab"`, no `aria-selected`, no `aria-controls`. Active vs past vs future is color-only (`var(--accent)` / `var(--text-dim)` / `var(--text-faint)`). Light-mode `text-faint` is borderline-AA against `--page-bg`. There is also no roving-tabindex: right-arrow does nothing inside the row, every tab is its own tab stop. Fix: add `role="tablist"` on the row, `role="tab"` + `aria-selected` + `tabIndex={active ? 0 : -1}` on each pill, and handle ArrowLeft/Right inside the tablist.

- **Severity: med** — Pause button toggles state but never tells assistive tech. (`src/marketing/TourPage.tsx:216-218`)
  `<Btn ... onClick={onTogglePause}>{paused ? '▶ Play' : '⏸ Pause'}</Btn>`. The text content changes, which screen readers will eventually re-announce, but there's no `aria-pressed` on the toggle, so the button's role conveys "press, change everything" instead of "this is on/off". Also the play/pause glyph (▶ / ⏸) is decorative and announced as "right-pointing triangle" by VoiceOver — should be `aria-hidden` siblings with an explicit `aria-label="Pause playback"`.

- **Severity: med** — `ProgressBar` exposes no ARIA progress semantics. (`src/marketing/TourPage.tsx:80-83`, `src/components/ui/atoms.tsx:222-238`)
  `ProgressBar` renders a `<div class="bar"><span style={width:%}/></div>` with no `role="progressbar"`, no `aria-valuenow`, no `aria-valuetext`. On the tour, this bar is *the* indicator of how far into the 90 s reel the user is. A non-sighted user has no way to know that "78 % through the tour" is true except by counting tab labels. The same component is reused in drill cards elsewhere, so the fix scales. Good-looks-like: extend `ProgressBar` with optional `label` + emit `role="progressbar"` aria-valuemin=0 aria-valuemax=100 aria-valuenow={clamped} aria-label={label}.

- **Severity: med** — `<a href="/#auth">` wrapping `<Btn>` produces invalid nested interactives and forces a full page reload. (`src/marketing/TourPage.tsx:230-234`, `:907-911`; same anti-pattern in `src/auth/LandingPage.tsx:71-73`, `:122-124`)
  A `<button>` inside an `<a>` is not allowed by HTML5; browsers usually flatten it, but screen readers announce "link, then button" and some platforms (Safari/VoiceOver) skip one of the two. Also `href="/#auth"` triggers a hard navigation from `/tour` → `/` instead of using react-router; the in-app SPA state (cached fetches, AuthContext) is thrown away. Fix: render a single accessible element — either `<Link to="/#auth" className="btn btn-primary">…</Link>` (no `<button>`) or a real `<button>` that calls `navigate('/', { hash: '#auth' })`.

- **Severity: med** — CTA scene + ControlBar both show "Sign up →" simultaneously. (`src/marketing/TourPage.tsx:230-234`, `:906-911`)
  On the last scene, the ControlBar's persistent primary `Sign up →` button is rendered just below the CTA scene's own `Create a free account →` button. Two near-identical CTAs stacked vertically with different copy is visually confusing and dilutes the conversion goal. Fix: hide the ControlBar CTA when `idx === SCENES.length - 1`, or swap it to "Play again" only.

- **Severity: med** — Decorative `MoveChip` instances are focusable buttons. (`src/marketing/TourPage.tsx:346-353`, `:407-450`, `:530-534`, `src/components/ui/atoms.tsx:79-108`)
  `MoveChip` is implemented as `<button type="button">`. In the tour, none of these chips do anything when clicked — they're purely decorative reveals. Result: tab order is bloated (~20 phantom focus stops inside the BuildScene mainline alone), and screen readers announce a stream of unactionable buttons. Either make `MoveChip` polymorphic (`as` prop defaulting to `span`, becoming `button` when an `onClick` is provided) or wrap the chips in a presentational `<span>` and pass `tabIndex={-1}` + `aria-hidden` in tour contexts.

- **Severity: med** — `TourPage.tsx` is 950 LOC in one file. (`src/marketing/TourPage.tsx`)
  Six scene components, four chrome components, three shared bits, two layout helpers, all inline. The 400 LOC smell from the audit runbook is more than doubled. Splitting into `src/marketing/tour/{TourPage, scenes/{Build,Branch,Chapter,Transpose,Drill,Cta}, parts/{TourBoard,Stage,SceneHeading,SceneTabs,ControlBar,TopBar}}.tsx` would let each scene be edited independently. None of the scenes share state, only the `elapsed` prop, so the split is mechanical.

- **Severity: med** — Inline `style={{ ... }}` everywhere; design tokens leak into JSX. (`src/marketing/TourPage.tsx` throughout)
  The "eyebrow" pattern (`fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: var(--text-faint)`) is duplicated five times verbatim across scenes. Card/Btn/Chip atoms exist; nothing else does. Side effect: dark-mode and hover/focus tweaks have to be made per-occurrence. Good-looks-like: an `.eyebrow` utility class in `src/index.css` (or a `<Eyebrow>` atom), `.tour-cta-icon` for the gradient CTA tile (`:867-883`), and `.scene-heading-h2` for the 34/40 px headings.

- **Severity: med** — Each frame of the autoplay reel triggers a full `TourPage` re-render. (`src/marketing/TourPage.tsx:33-44`)
  `setState((prev) => ...)` runs every rAF tick (~60 Hz). React re-renders the whole 950-LOC tree even though, for most ticks, neither `idx` nor any scene-visible state actually changed (e.g., scene 2 only flips its reveal state once per 1.8 s). The `BranchScene` etc. could be `memo`-ed and the `elapsed` prop pushed through a `useRef`+`useSyncExternalStore` so only the affected scene re-renders. Today the cost is invisible on a desktop dev machine but will burn battery on mobile. Lower priority than a11y, but still a clear perf footgun for an animation-heavy page.

- **Severity: med** — Drill scene mixes two timing sources: `beat` (recomputed from elapsed) and a magic `elapsed > 13000` literal. (`src/marketing/TourPage.tsx:705-770`)
  The "Next review …" inset reveal is hard-coded to `elapsed > 13000`, while the rest of `DrillScene` uses the symbolic `beat` derived from the same `elapsed` (`<4000/<7000/<10000/correct`). If anyone bumps `SCENES[4].duration` from 18000 to, say, 20000, `beat === 'correct'` will start at 10s and the 13000 ms inset will appear 3 s into the correct beat — but the correctness of "3 s after correct lands" is now coupled to the duration. Lift the constant out: `const CORRECT_HOLD_BEFORE_INSET_MS = 3000`, then `beat === 'correct' && elapsed - 10000 > CORRECT_HOLD_BEFORE_INSET_MS`.

- **Severity: low** — `BRANCH_OPTIONS` lives module-level inside `TourPage.tsx` but `TOUR_ITALIAN` etc. live in `tour-script.ts`. (`src/marketing/TourPage.tsx:365-370`)
  Both are static content driving the reel; one is in the component file, the other in the script module. Move `BRANCH_OPTIONS` (and the "Positions in this chapter" string array at `:530`) into `tour-script.ts` so all of the tour's content lives in one place and the component file is pure rendering.

- **Severity: low** — No `<title>` / no `useEffect` setting document title for `/tour`. (`src/marketing/TourPage.tsx`)
  Deep-linked `/tour` keeps whatever title the index `<title>` declares. A marketing page that people may share should set its own title ("Praxis — 90-second tour" or similar) for tab labels and link previews. The route is a candidate for `react-helmet-async` or just a `useEffect(() => { document.title = '...'; return () => { document.title = original; }; }, [])`.

- **Severity: low** — `restart()` resets paused but autoplay then proceeds with no announcement. (`src/marketing/TourPage.tsx:59-63`, `:225-228`)
  After "Play again", focus stays on the now-disabled "Play again" button (since `ended` flips to false on the next paint, the button conditionally unmounts). Keyboard focus lands on `<body>` — common React anti-pattern. After-restart focus could move to the first SceneTab or to the Pause control for predictability.

- **Severity: low** — Scene-tab pills lack a `:focus-visible` ring. (`src/marketing/TourPage.tsx:150-178`)
  Inline-style buttons inherit no focus indicator beyond the browser default, which is suppressed on most modern button styles. Confirmed by hand-tracing: no `outline`, no `box-shadow:focus`, no `:focus-visible` rule in `src/index.css` targeting these pills (the `.scroll-row` class only handles overflow). Add a `:focus-visible` ring (e.g., `outline: 2px solid var(--accent); outline-offset: 2px`) either inline or via a class.

- **Severity: low** — Skip link is a faint "Skip" with no announce-on-hover and no Esc shortcut. (`src/marketing/TourPage.tsx:130-132`)
  At `color: var(--text-dim)` and `fontSize: 13`, the Skip affordance is easy to miss. The conventional Esc-to-quit shortcut isn't wired either. Either uprank it visually (e.g., add an "✕" glyph + `aria-label="Exit tour"`) or wire Esc to `navigate('/')`.

- **Severity: low** — No tests for tour scenes or `tour-script.ts`. (`tests/unit/` has nothing under marketing)
  `tour-script.ts` runs `chess.js` at module load and throws `tour-script: bad SAN ${san}` if anyone edits the move list incorrectly. That's the kind of failure-mode unit tests catch in 5 lines: assert each of `TOUR_ITALIAN`, `TOUR_TRANSPOSE_A`, `TOUR_TRANSPOSE_B` returns frames of the expected length, and assert `TOTAL_MS` adds up to 90000 (it does today: 14+14+14+16+18+14 = 90). Without this, the next person tweaking the script gets a runtime error in the browser instead of a CI failure.
