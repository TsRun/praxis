# Audit run — 2026-06-09T18:10:00Z
**Mode:** TEST_ONE
**Subject:** signup-form-render
**Result:** IMPROVED+PENDING

Ran the Playwright audit spec for the signup form ("Create account" mode) against prod at https://praxis.tsrun.dev/. Spec passed (no page errors, no application console errors, labels associated, focus-visible outlines present on inputs and role-picker via keyboard tab, no horizontal overflow at 375x812, role buttons 280x96 on mobile / 136x96 on desktop with 3-up grid). However, an evaluation captured the computed style of the unselected role buttons (Student, Solo): `borderColor: rgba(255, 255, 255, 0.04)` paired with `background: rgba(255, 255, 255, 0.025)`. At those alphas, on the dark page background, the two unselected role tiles render as nearly border-less floating text, which undercuts their affordance as buttons — they don't look clickable next to the bordered, accent-tinted "Trainer" tile.

Smallest fix: bump the unselected border in `src/auth/SignInUpForm.tsx` from `var(--inset-border)` (4% white) to `rgba(255, 255, 255, 0.14)` so the Student and Solo tiles get a visible outline matching common subtle-button affordances. The CSS variable is reused across many components, so I changed only the inline border on this role-picker. Selected state, hover ring (`.role-pick:hover`), and keyboard focus ring (`.role-pick:focus-visible`) are untouched. Typecheck and unit tests pass. Opening PR.
