# Autonomous Loop Runbook

This file is the contract between the cron-triggered Claude session and the user. The cron prompt is short — it just says "follow this runbook." Everything the loop does is described here.

## The queue lives in `queue.html`

The queue is a single self-contained HTML file at `docs/agents/queue.html`. The user edits it through a browser UI; the agent reads and updates it by parsing the embedded JSON block:

```html
<script id="queue-data" type="application/json">
{ "version": 1, "items": [...] }
</script>
```

Each item has the shape:

```json
{
  "id": "stable-uuid",
  "section": "ui" | "back" | "chores",
  "title": "short title — one-line context",
  "state": "todo" | "in_progress" | "awaiting_confirmation" | "done",
  "pr_url": null,
  "claimed_at": null
}
```

The agent only ever touches items it owns and only flips them through these state transitions:

```
todo → in_progress (agent claims it)
in_progress → awaiting_confirmation (agent has opened a PR; user reviews/merges)
```

The user is the only one who flips `awaiting_confirmation → done` (via the Confirm done button) or deletes items.

## Each run, do exactly this

1. **Pick a task.**
   - Read `docs/agents/queue.html`. Extract the JSON block (first `<script id="queue-data" type="application/json">...</script>`).
   - Walk sections in this order: `ui`, `back`, `chores`. Within each section, walk items in array order.
   - The first item with `state === "todo"` is the task.
   - If no such item exists, append `## <local-timestamp> — idle (queue empty)` to `docs/agents/reports.md`, commit "chore(agents): idle tick", push, and stop.

2. **Claim it.**
   - Set the picked item's `state` to `"in_progress"` and `claimed_at` to the current ISO 8601 timestamp.
   - Re-serialize the JSON (2-space indent) and write it back into the same `<script>` block — leave the rest of the HTML untouched.
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
     - Quotes the item title verbatim.
     - Lists files changed.
     - Notes test results.
     - Ends with: `Auto-opened by the agent loop. Review and merge manually.`

6. **Flip to awaiting confirmation.**
   - Re-read `docs/agents/queue.html` (the user may have edited it while you worked).
   - Find your item by `id`.
   - Set `state` to `"awaiting_confirmation"` and `pr_url` to the PR URL from step 5.
   - Re-serialize and write back. Commit "chore(agents): await confirmation <short title>" on the same `agents/<slug>` branch.

7. **Report.**
   - Prepend a new entry to `docs/agents/reports.md` *under* the `---` separator (newest on top, just below the header block).
   - Format per the template at the top of `reports.md`.

## How to edit the JSON block safely

The JSON sits inside a `<script>` tag, so the only character sequence that must be escaped on write is `</script` → `<\/script` (case-insensitive). Standard `JSON.stringify(data, null, 2)` plus that one substitution is enough.

When extracting, match the **first** `<script id="queue-data" type="application/json">...</script>` block — there is exactly one. Do not rely on whitespace around the JSON.

Reference regex (JS):

```js
const RE = /(<script id="queue-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
```

## Hard rules

- **Never merge a PR yourself.** PR-only. The user clicks merge.
- **Only edit queue.html to (a) flip a `todo` you picked to `in_progress`, or (b) flip your `in_progress` item to `awaiting_confirmation` with a `pr_url`.** Never reorder, delete, edit titles, or touch items that aren't yours.
- **Never touch `main` directly.** Everything goes through `agents/<slug>` branches.
- **Never run destructive git** (`reset --hard`, `clean -fd`, `push --force`) without a fresh user message authorizing it.
- **One task per run.** Don't chain. If you finish early, stop — the next cron tick will pick up the next item.
- **If anything is ambiguous, stop and report it as a blocker** — append a `## <ts> — blocked on <task>` entry to `reports.md` with what you'd need to proceed, and don't open a PR.

## When the user adjusts the cadence

Cron schedule lives in the Claude session that scheduled it. Re-run `/agents schedule` (or ask Claude to reschedule) to change frequency. Recurring jobs auto-expire after 7 days regardless of `durable: true`, so plan to re-schedule weekly.
