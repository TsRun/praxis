# Agent Queue

You own this file. Add items, reorder, edit, delete. The autonomous loop reads the **top unchecked item in each section** every time it fires, picks one to work on, opens a PR, and never touches the queue itself except to leave a `<!-- claimed: PR#NN -->` comment on the line it's actively working.

## How items work

- `- [ ] short title — one-line context the agent needs` → unchecked, fair game.
- `- [x] same line` → done, ignored. Tick it yourself when the PR merges.
- Lines without checkboxes are treated as section headers / notes and skipped.
- Be specific about *what good looks like*. "Fix the trainer editor" is too vague; "In the trainer editor chapter list, the chapter title input loses focus on every keystroke — fix" is workable.

## ui

- [ ] _add items here_

## back

- [ ] _add items here_

## chores

- [ ] _add items here (tests, docs, dep bumps, etc.)_
