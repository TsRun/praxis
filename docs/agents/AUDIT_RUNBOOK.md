# Autonomous Loop — Audit Mode

This is **Phase 1**. The loop is read-only: it explores the Praxis UI and codebase, finds issues, and writes them to `docs/agents/audit.md`. **No code changes, no PRs.** Once `audit.md` has a `## Audit complete` marker, the loop switches to `RUNBOOK.md` (Phase 2) which works through queue items.

## Each run, do exactly this

1. **Pick an area.**
   - Read `docs/agents/audit.md`.
   - The first checkbox `- [ ] <area>` without a `<!-- claimed -->` marker is yours.
   - If every area is ticked, append `## Audit complete — <local-timestamp>` to the bottom of `audit.md`, commit, push, stop. (The next run will see this and switch to `RUNBOOK.md`.)

2. **Claim it.** Add `<!-- claimed: in-progress -->` to the line. Commit "chore(audit): claim <area>" on branch `agents/audit-<slug>`.

3. **Audit, two angles.**
   - **Code-level (always):** read every file under the area's prefix. Look for:
     - dead code, unused exports, commented-out blocks
     - missing states: empty, loading, error, disabled
     - accessibility holes: missing labels, no keyboard support, color-only signal
     - inconsistencies with patterns used elsewhere in the codebase
     - tight coupling, oversized components (> ~400 LOC is a smell)
     - obvious perf footguns: unkeyed lists, expensive work in render, unbounded fetches
   - **Runtime (if available):** if the Playwright MCP server (`mcp__plugin_playwright_playwright__*`) is reachable AND a dev server can be started (`npm run dev` from `/Users/apple/Projects/Chess/yotta`), exercise the area in a real browser. Click every interactive element, fill every form, try the back button, try refresh mid-flow. Screenshot weirdness.
   - If runtime audit is impossible (no creds, server won't start, MCP missing), say so in the finding and stick to code-level.

4. **Write findings.**
   - Append a block to `audit.md` under the area's heading, structured as:
     ```
     ### Findings — <area> (<local-timestamp>)
     - **Severity: high / med / low** — One-line title. (file:line if applicable.)
       <one paragraph: what's wrong, why it matters, what good looks like>
     - **Severity: ...** — ...
     ```
   - Mark the area's checkbox `- [x]` and replace the claim marker with `<!-- claimed: done -->`.

5. **Commit and push.**
   - One commit on the `agents/audit-<slug>` branch with the findings.
   - Push and open a PR titled `[audit] <area>`. Body: short summary of what you found + reminder this is read-only. **Never merge.**

## Hard rules (Phase 1)

- **No code changes outside `docs/agents/audit.md`.** Reading is fine; editing app code is not.
- **One area per run.** Don't try to do two. The hourly cadence means we cover everything within a day.
- **PR-only.** Append findings via PR so the user can review them before they enter the queue.
- **If anything is ambiguous, stop and report it as a blocker** — append a `## <ts> — blocked on <area>` entry to `audit.md` with what you'd need to proceed.

## Promotion to Phase 2

The audit becomes the queue manually. When the user is happy with the findings, they pull the audit PRs, open `docs/agents/queue.html` in a browser, add actionable items from `audit.md` under `ui` / `back` / `chores`, and write `## Audit complete — <date>` themselves OR let the loop write it when every area is ticked. Either way, the next run after that marker switches to `RUNBOOK.md`.
