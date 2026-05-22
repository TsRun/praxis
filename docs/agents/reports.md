# Agent Reports

Newest entry on top. The autonomous loop appends one block per run. Read like a feed.

Each entry is:

```
## YYYY-MM-DD HH:MM — <queue line>
- PR: <gh url> (status: open / merged / closed)
- Files touched: <count>
- Notes: <one short paragraph — what they actually changed, any caveats>
```

If a run finds nothing to do, it appends a single line `## YYYY-MM-DD HH:MM — idle (queue empty)` and stops.

---

## 2026-05-22 15:45 — language+theme (slice 1: dark/light toggle)
- PR: https://github.com/TsRun/praxis/pull/58 (status: open)
- Files touched: 5 (index.html, src/index.css, src/components/ui/{Icons.tsx, ThemeToggle.tsx, TopBar.tsx})
- Notes: Dark/light theme toggle with localStorage persistence + pre-render flash-prevention script. i18n half deferred to a follow-up PR. typecheck clean (after npm i), 37 tests pass.

