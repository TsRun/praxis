# Hourly Audit Agent

A scheduled remote Claude Code routine runs every hour against `https://praxis.tsrun.dev/`
and exercises one feature per tick. See the design doc:
`docs/superpowers/specs/2026-05-23-hourly-audit-agent-design.md`.

## `features.json`

Source of truth for the feature inventory the agent rotates through.

- Created automatically on the first DISCOVERY run if missing.
- Hand-editable — add, remove, or tweak entries to steer what gets tested.
- Schema: see the design doc.

## `runs/<UTC-stamp>.md`

One file per audit run. `<UTC-stamp>` is `YYYY-MM-DDTHH-MM-SSZ` — the time
portion's colons are replaced by dashes so the filename is valid on Windows
(NTFS forbids `:` in filenames). Records: which feature was picked, what was
observed, what was changed (if anything), link to the PR.

## Operating the routine

- **Pause**: disable via https://claude.ai/code/routines
- **Force a run now**: same UI, "Run now"
- **Re-discover features**: delete or empty `docs/audit/features.json` and let the next run rebuild it

## Bot credentials (optional)

If you want auth-required features tested, set on the `Perso Mathis` env:

- `PRAXIS_BOT_EMAIL`
- `PRAXIS_BOT_PASSWORD`

Without these, the agent marks auth-required features `skipped-no-creds` and moves on.
