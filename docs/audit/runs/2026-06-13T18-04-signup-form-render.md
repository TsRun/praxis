# Audit run — 2026-06-13T18:04:00Z
**Mode:** TEST_ONE
**Subject:** signup-form-render
**Result:** OK+MERGED

Exercised the Create-account form on https://praxis.tsrun.dev/ at 1280 and 375. Switching the mode toggle to "Create account" surfaces Email, Nickname, Password inputs plus the Trainer / Student / Solo role-picker (3 buttons in a `.grid-3`, Trainer default `aria-pressed=true`, multi-select toggle works). All three inputs have associated `<label for>` and proper autocomplete (email, nickname, new-password). Empty submit relies on the browser's native required-field validation (`Please fill out this field.`). Focus styles are visible: 2px solid amber outline on email input, 2px solid `rgb(249,198,66)` outline on role buttons under keyboard focus-visible, hover adds an inset accent ring. No horizontal overflow at 375 (scroll 360, client 375). No application console errors, no page errors. Marking OK and bumping `lastTestedAt`.
