# Audit run — 2026-06-07T09:08:38Z
**Mode:** TEST_ONE
**Subject:** trainer-opening-study-editor
**Result:** IMPROVED+PENDING+verification-on-PR

Editor at `/trainer/studies/opening/:id` renders cleanly on desktop and at
375x812. No uncaught page errors, no app console errors, no horizontal
overflow (scrollWidth 360 ≤ clientWidth 375). Board, candidate replies, and
line/siblings cards are all visible; the Tree/Chapters tab toggle works.

Observation that drove the fix: the header action buttons — Import from
Lichess, Import games, Assign to student — had `outlineStyle: 'none'` and
no focus-specific `box-shadow`, so Tab-focusing them showed no indicator
beyond their default 1px-inset border (WCAG 2.4.7 fail). Root cause was in
`src/index.css`: the base `.btn` class had `:active` and `:disabled` rules
but no `:focus-visible` rule, while sibling button classes (`.pill-btn`,
`.seg-toggle-btn`, `.role-pick`) already use
`outline: 2px solid var(--accent); outline-offset: 2px`. Smallest-change
fix: one CSS line adding `.btn:focus-visible` with the same accent-amber
outline. Affects every `<Btn>` consumer across the app, but the change
itself is one declaration. Typecheck + unit tests + audit spec all green.
