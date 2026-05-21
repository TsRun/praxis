# Agent Loop — launchd setup (macOS)

True persistence for the autonomous agent loop. The in-session cron (`CronCreate`) dies when the Claude session ends; this launchd job survives reboots and runs while you're logged in.

## What it does

Every hour at minute `:13` (00:13, 01:13, 02:13, ...), launchd invokes:

```
claude -p "<runbook entry prompt>"
```

from `/Users/apple/Projects/Chess/yotta`. The headless Claude session checks `docs/agents/audit.md` for an `## Audit complete` marker:
- **Phase 1 (audit missing the marker):** follows `AUDIT_RUNBOOK.md` — read-only audit of one UI area, appends findings via PR.
- **Phase 2 (marker present):** follows `RUNBOOK.md` — picks one item from `queue.md`, ships a PR.

Either way: one task per fire, PR-only, never merges. **Each fire is one billed Claude conversation.**

## Install

```bash
bash docs/agents/launchd/install.sh
```

Idempotent — re-run any time you change the plist.

## Disable

```bash
bash docs/agents/launchd/uninstall.sh
```

## Watch it work

```bash
tail -f ~/Library/Logs/praxis-agent-loop.log
tail -f ~/Library/Logs/praxis-agent-loop.err.log
```

Force a single run now (don't wait for the next :07):

```bash
launchctl kickstart -k gui/$(id -u)/com.tsrun.praxis.agent-loop
```

## Confirm it's loaded

```bash
launchctl list | grep com.tsrun.praxis.agent-loop
```

The first column is the PID (or `-` when idle between fires); third column is the label.

## Cost & safety notes

- Each fire is a real Claude API conversation. 24 fires/day = ~24 conversations/day of cost. Disable when you don't need it (`uninstall.sh`).
- The job runs as your user — same shell credentials, same `gh` auth, same git config. It cannot do anything you couldn't do.
- It is **PR-only** by runbook contract. It cannot merge. The classifier on the headless side also blocks `gh pr merge` without explicit per-action authorization.
- If you change `claude`'s install path (`which claude`), update `ProgramArguments[0]` in the plist and re-install.
