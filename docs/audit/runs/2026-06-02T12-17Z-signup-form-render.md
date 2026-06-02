# Audit run — 2026-06-02T12:17:31Z
**Mode:** TEST_ONE
**Subject:** signup-form-render
**Result:** IMPROVED+PENDING+PR

Exercised the Create-account form on https://praxis.tsrun.dev/ at viewports 1280 and 375x812. No console/page errors, all three required inputs (email, nickname, password) are correctly labelled via `<label for="…">`, native HTML5 validity blocks empty submission, and keyboard `Tab` does reveal the global `:focus-visible` amber outline (2px solid amber-400, 2px offset) on the role picker buttons — the earlier `outlineStyle: 'none'` reading from `.focus()` was a programmatic-vs-keyboard false alarm.

One genuine UI quality issue surfaced: the fineprint disclaimer at the bottom of the signup form contained two placeholder anchors — `<a class="link" href="#">terms</a>` and `<a class="link" href="#">privacy</a>` — that render as clickable amber links but jump to the top of the page on click because no `/terms` or `/privacy` route exists in `src/App.tsx`. Smallest-change fix: strip the link styling and render "terms" and "privacy" as plain words in the existing disclaimer sentence, removing the broken affordance while keeping the legal wording. The audit spec was updated to log a warning if any `a[href="#"]` placeholder links reappear inside the disclaimer in the future.
