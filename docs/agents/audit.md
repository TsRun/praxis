# Praxis UI + Backend Audit

Phase 1 of the agent loop. The loop picks the next unchecked area each hour, audits it (code + optional Playwright runtime), and appends findings under the area's heading. When every box is ticked it writes `## Audit complete` at the bottom and the loop switches to `RUNBOOK.md`.

## Areas

- [ ] Landing + auth (email/password + Google sign-in) — `src/pages/Landing*`, `src/pages/SignIn*`, `server/routes-auth*` <!-- claimed: in-progress -->
- [ ] Tour route (90-second standalone) — `src/tour/*`, route `/tour`
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
