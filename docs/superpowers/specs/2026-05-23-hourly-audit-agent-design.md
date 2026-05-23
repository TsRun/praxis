# Hourly Audit Agent — Design

**Status:** Draft — pending user review
**Owner:** TsRun
**Target:** scheduled remote Claude Code routine (CCR), env `Perso Mathis`
**Created:** 2026-05-23

## Goal

Run a remote Claude Code agent every hour against `https://praxis.tsrun.dev/`. The agent maintains a feature inventory and, on each tick, exercises one feature end-to-end. If the feature works correctly, it bumps a timestamp and stops. If it finds concrete improvements (bugs, UX issues, missing affordances), it implements them in code and opens a PR.

## Non-goals

- Detecting performance regressions (no perf budgets, no synthetic benchmarks)
- Generating issues without code fixes (no issue-only mode — fixes go in PRs)
- Editing infra, migrations, CI, scripts under `scripts/`, or anything under `server/` auth, billing, or DB schema unless the feature under test specifically requires it
- Cross-feature refactors — each PR stays focused on the feature it tested

## Hard guardrails (encoded in the agent prompt)

- One PR per run. Branch name `bot/improve-<feature-id>-<YYYYMMDDHH>`.
- Never push to `main` directly. Never force-push. Never modify other open PRs.
- Never touch: `.github/workflows/`, `scripts/`, `server/migrations/`, `railway.toml`, `Dockerfile`, `docker-compose.yml`, `package-lock.json`.
- Never commit secrets. Never log creds. If env creds missing, skip auth-required test and exit clean.
- If improvements list is empty after evaluation, do NOT open a PR. Only bump `lastTestedAt`.
- If typecheck or unit tests fail on the proposed change, abandon the PR and exit with a comment in `docs/audit/runs/<ts>.md` describing what was attempted.

## Architecture

```
                   ┌─────────────────────────────┐
                   │  Cron: 0 * * * * UTC        │
                   │  (claude.ai routine)        │
                   └──────────────┬──────────────┘
                                  │ spawns
                                  ▼
                ┌─────────────────────────────────────┐
                │  Remote CCR sandbox (Perso Mathis)  │
                │  - git checkout TsRun/praxis@main   │
                │  - Node + npm + git + gh + Bash     │
                │  - reads PRAXIS_BOT_* from env      │
                └──────────────┬──────────────────────┘
                               │ runs prompt
                               ▼
            ┌──────────────────────────────────────────┐
            │  decide_mode():                          │
            │    if docs/audit/features.json missing   │
            │       or empty → DISCOVERY               │
            │    else → TEST_ONE                       │
            └──────────────┬───────────────────────────┘
                           │
              ┌────────────┴───────────┐
              ▼                        ▼
        DISCOVERY                  TEST_ONE
        ─────────                  ────────
        npx playwright install     pick feature with oldest
          chromium (cached)         lastTestedAt (nulls first)
        write discovery.spec.ts    write feature.spec.ts
        run against prod           run against prod
        parse routes/forms/links   evaluate behaviour
        write features.json        if OK: bump timestamp,
        commit + push to main         commit + push to main
                                   else: implement fixes,
                                      typecheck + unit tests,
                                      open PR to main
```

## Data model

### `docs/audit/features.json`

```json
{
  "schemaVersion": 1,
  "site": "https://praxis.tsrun.dev/",
  "discoveredAt": "2026-05-23T15:00:00Z",
  "features": [
    {
      "id": "home-landing",
      "name": "Landing page renders without errors",
      "route": "/",
      "requiresAuth": false,
      "description": "Heading, hero CTA, nav links visible",
      "lastTestedAt": null,
      "lastResult": null,
      "lastPr": null
    }
  ]
}
```

- `id`: stable kebab-case slug. New features may be appended on subsequent discovery passes, but ids are never renamed.
- `lastResult`: `"ok"` | `"improved"` | `"failed"` | `null`.
- `lastPr`: PR number or null.

### `docs/audit/runs/<UTC-ISO>.md`

Short per-run log: which feature was picked, what was found, what was changed, link to PR. Kept in repo for audit trail.

## Selection algorithm

```
1. Load docs/audit/features.json
2. Sort by lastTestedAt ascending, nulls first, ties broken by id
3. Pick features[0]
4. If features[0].requiresAuth and PRAXIS_BOT_EMAIL is unset:
     skip; mark lastTestedAt=now, lastResult="skipped-no-creds"
5. Else test it
```

This guarantees every feature gets visited before any is re-visited, and new features land at the front of the queue automatically (their `lastTestedAt` is null).

## Testing depth

For each feature the agent writes a Playwright spec under `tests/audit/<feature-id>.spec.ts` (temporary; not committed unless improvements are made). The spec must:

1. Navigate to the route. Assert HTTP 200 + no `Error`/`Uncaught` text in DOM.
2. For interactive features: perform the primary action (click CTA, submit form, drag piece, open analysis, etc.) and assert the observable result.
3. Capture console errors and uncaught promise rejections — both count as improvements.
4. Capture a screenshot to `tests/audit/screenshots/<feature-id>.png` for the run log.

Auth: if `requiresAuth`, the spec logs in once via the standard login form using `PRAXIS_BOT_EMAIL` / `PRAXIS_BOT_PASSWORD`, persists storage state to `.auth/bot.json` for the duration of the run, and reuses it.

## "Improvements" — what counts

An improvement is a concrete, file-level change that addresses something the agent OBSERVED. Allowed categories:

- Console errors or uncaught rejections triggered by the feature
- Visible UI bugs (broken layout, overflow, missing alt text, unreadable contrast)
- Missing aria attributes on the elements actually exercised
- Broken links (404) reached from the feature page
- Form validation that accepts obviously bad input or rejects valid input
- Loading states that never resolve / loaders that flash

NOT allowed (avoid scope creep — see `superpowers:writing-skills` guidance on YAGNI):

- "Refactor this component"
- "Add tests for unrelated paths"
- "Rename for clarity"
- "Could be more idiomatic"
- Anything not directly observed in this run

If nothing in the allowed list was observed, the agent commits ONLY the timestamp bump and exits. The whole point of the rule "si tout est bon, rien est fait" is preserved.

## PR shape

- Branch: `bot/improve-<feature-id>-<YYYYMMDDHH>`
- Title: `[bot] Improve <feature name>`
- Body:
  - "Audit run: <run-log link>"
  - "Feature: `<feature-id>` (route `<route>`)"
  - "Observed:" — bullet list of evidence (with line refs / screenshot)
  - "Changes:" — bullet list of edits
  - "Verification:" — `npm run typecheck`, `npm test` output excerpts
- Labels: `bot-audit`, `automated`
- Reviewer: none (user reviews manually)
- Always `--draft`? **No** — open as ready-for-review so user gets notified, but never auto-merge.

## Secrets / environment

Set on the `Perso Mathis` Anthropic Cloud environment (claude.ai/code env settings):

| Var | Purpose | Required |
|---|---|---|
| `PRAXIS_BOT_EMAIL` | login for auth-required features | optional |
| `PRAXIS_BOT_PASSWORD` | login for auth-required features | optional |
| `GITHUB_TOKEN` | open PRs via `gh` | provided by CCR |
| `ANTHROPIC_API_KEY` | model calls | provided by CCR |

If `PRAXIS_BOT_*` are unset, auth-required features mark themselves `skipped-no-creds` and the queue moves on.

## Schedule

- Cron: `0 * * * *` (every hour, top of hour, UTC)
- Equivalent in Europe/Paris: hourly, on the hour (no DST shift since cron is UTC)
- One-time bootstrap: routine fires naturally on next top-of-hour after creation. First run is DISCOVERY.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Agent commits bad code that breaks main | All changes go through PRs; never push to main except `features.json` / `runs/` bookkeeping. Typecheck + unit tests must pass before PR is opened. |
| Bot PRs accumulate unreviewed | Cap: agent checks for >5 open `bot-audit` PRs at start; if so, skips this run with a log entry. Forces user to drain queue. |
| Scope creep ("improve the whole app") | Hard rule in prompt: changes must be ≤300 LOC across ≤8 files. Otherwise abandon. |
| Discovery misses features | features.json can be hand-edited; agent treats it as source of truth. Adding entries manually is supported. |
| Cost runaway | Sonnet 4.6 + hourly cadence is bounded; user can pause routine via claude.ai/code/routines anytime. |
| Test bot account leaks | Creds live only in env vars; never logged; storageState file is gitignored via `.auth/`. |

## Open questions deliberately left for now

- Do we want a Slack/email notification when a PR is opened? Not in scope; GitHub already notifies on PRs targeting `main`.
- Do we want to cap concurrent improvements per feature? Implicit: each feature is only tested once per N hours; no race.

## Implementation deliverables

1. This spec (`docs/superpowers/specs/2026-05-23-hourly-audit-agent-design.md`) committed to main.
2. The agent prompt (encoded in the routine `events[0].data.message.content`) — see implementation plan.
3. A scheduled routine created via `RemoteTrigger action: "create"` against repo `TsRun/praxis`.
4. README pointer (`docs/audit/README.md`) explaining what `features.json` is and how to hand-edit.
5. `.gitignore` additions: `tests/audit/screenshots/`, `.auth/`.
