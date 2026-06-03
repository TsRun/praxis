# Audit run — 2026-06-03T06:14:11Z
**Mode:** TEST_ONE
**Subject:** trainer-games-browser
**Result:** IMPROVED+PENDING+verification

`tests/audit/trainer-games-browser.spec.ts` ran against prod and passed (0 page errors, 0 app console errors). Mobile (375×812) layout is now clean — `scrollWidth=360` vs `clientWidth=375`, no overflow, the import-grid stacks at `width=336`, year inputs respect their flex parent (the prior `width:100%; minWidth:0; boxSizing:border-box` fix on `inputStyle` is doing its job).

UX issue observed: on the Chess.com source tab with the username field empty, the **Search** button is `disabled=false`. Clicking it triggers a doomed network round-trip that ends in `setErr('Enter a username first.')` (see `search()` in `src/trainer/ImportGamesPage.tsx:213-217`). The button should signal this proactively — disabled state is a much cheaper UX signal than a thrown error after a click.

Smallest fix: extend the existing `disabled={busy}` on the Search button to also be true when `source === 'chesscom' && !ccUsername.trim()` or `source === 'lichess' && !liUsername.trim()`. The Database source is unaffected (all fields are optional there). `npm run typecheck` ✅. `npm test` ✅ (48/48). Audit spec still passes on prod (the disabled-state behaviour is logged but not asserted, so the spec is not coupled to the rollout).
