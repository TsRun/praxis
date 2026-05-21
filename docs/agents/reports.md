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
