# Audit run — 2026-05-29T15:14:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** IMPROVED+PENDING+verification

Re-ran the existing audit spec at `tests/audit/trainer-new-study-menu.spec.ts` against prod. All structural checks passed (trigger aria, menu role, three items, ESC/outside-click close, keyboard arrow navigation, mobile rect within 375 viewport, no page/console errors).

UI quality issue observed on prod: dropdown menu items have an almost-invisible hover background (`rgba(255, 255, 255, 0.025)` via `--inset-bg`) and no visible keyboard-focus indicator on individual items — only the trigger has a focus ring. Keyboard users tabbing/arrowing through the three options get no per-item feedback.

Fix: added a `.dropdown-menuitem` CSS class in `src/index.css` with `:hover` and `:focus-visible` rules using `var(--chip-bg)` (theme-aware, visible in both dark/light) plus an inset accent ring on focus. Replaced the inline `onMouseOver`/`onMouseOut` handlers on `NewStudyMenuItem` in `src/trainer/StudiesPage.tsx` with the class. Diff is ~16 LOC across 2 files. typecheck and unit tests pass.
