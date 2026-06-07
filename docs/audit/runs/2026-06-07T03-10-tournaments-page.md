# Audit run — 2026-06-07T03:10:00Z
**Mode:** TEST_ONE
**Subject:** tournaments-page
**Result:** IMPROVED+PENDING+verification

Picked `tournaments-page` (oldest `lastTestedAt` = 2026-06-03T12:16:19Z). Spec passed end-to-end against prod with no page or app console errors. Mobile pass at 375×812 showed no horizontal overflow (scroll 360, client 375) and cadence/Liste toggles ≥36px.

UI finding: the `rapid` cadence pill rendered the white "Rapide" label at 11px on `#b8860b`, which computes to ~3.2:1 contrast — below WCAG-AA 4.5:1 for small text. Darkened `rapid` to `#8b6914` (now 5.09:1) in both `TournamentList.tsx` and `TournamentMap.tsx` so list and map stay in lockstep. Added a contrast-ratio guard to the audit spec that asserts all three cadence colors ≥ 4.5:1 against white — fail-loud if anyone walks the colors back. Diff: 3 files, +18/-3 (no forbidden paths). Typecheck and `npm test` green (48 tests).
