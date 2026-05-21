# Autonomous Loop Runbook (Phase 2 — implementation)

This file is the contract between the cron-triggered Claude session and the user. The cron prompt is short — it just says "follow this runbook." Everything the loop does is described here.

> **Mode gate.** Before following this runbook, check `docs/agents/audit.md` for a `## Audit complete` marker. If it is missing, the loop is in **Phase 1** — follow `AUDIT_RUNBOOK.md` instead. This file only applies once the audit has been promoted to queue items.

## Each run, do exactly this

1. **Pick a task.**
   - Read `docs/agents/queue.md`.
   - Walk sections in this order: `ui`, `back`, `chores`.
   - The first unchecked line *without* a `<!-- claimed: ... -->` marker is the task.
   - If there is no such line, append `## <local-timestamp> — idle (queue empty)` to `docs/agents/reports.md`, commit "chore(agents): idle tick", push, and stop.

2. **Claim it.**
   - Add `<!-- claimed: in-progress -->` to the end of the picked queue line.
   - Commit "chore(agents): claim <short title>" on a fresh branch named `agents/<slug-of-title>`.

3. **Plan in parallel.**
   - Spawn two background `Agent` subagents at once:
     - `subagent_type: Explore` — "Find every file relevant to <task>. Report paths + line ranges, under 300 words."
     - `subagent_type: Plan` — "Given <task>, outline the smallest change that satisfies it. Identify risks, list files to touch. Under 400 words."
   - Wait for both, synthesize a single plan in your own words.

4. **Implement.**
   - Edit files directly. Keep the diff minimal — fix the named problem, nothing else.
   - If the task touches both UI and backend, do them in the same branch but keep commits separate.
   - Run `npm run typecheck` and `npm test`. If either fails because of *your* change, fix it. If it fails because of pre-existing breakage on main, stop and report it as a blocker (step 6).

5. **Open a PR — never merge.**
   - `git push -u origin agents/<slug>`.
   - `gh pr create` with title `[agent] <queue line>` and a body that:
     - Quotes the queue line verbatim.
     - Lists files changed.
     - Notes test results.
     - Ends with: `Auto-opened by the agent loop. Review and merge manually.`

6. **Report.**
   - Prepend a new entry to `docs/agents/reports.md` *under* the `---` separator (newest on top, just below the header block).
   - Format per the template at the top of `reports.md`.
   - Replace the claim marker on the queue line with `<!-- claimed: PR#NN -->` so future runs see it as taken.
   - Commit "chore(agents): report <short title>" on `main` via a tiny follow-up PR? **No** — append the report on the same `agents/<slug>` branch in a separate commit, and let the user pick up both with one merge.

## Hard rules

- **Never merge a PR yourself.** PR-only. The user clicks merge.
- **Never edit the queue except to add a claim marker.** No reordering, no deletion, no adding new items.
- **Never touch `main` directly.** Everything goes through `agents/<slug>` branches.
- **Never run destructive git** (`reset --hard`, `clean -fd`, `push --force`) without a fresh user message authorizing it.
- **One task per run.** Don't chain. If you finish early, stop — the next cron tick will pick up the next item.
- **If anything is ambiguous, stop and report it as a blocker** — append a `## <ts> — blocked on <task>` entry to `reports.md` with what you'd need to proceed, and don't open a PR.

## When the user adjusts the cadence

Cron schedule lives in the Claude session that scheduled it. Re-run `/agents schedule` (or ask Claude to reschedule) to change frequency. Recurring jobs auto-expire after 7 days regardless of `durable: true`, so plan to re-schedule weekly.
