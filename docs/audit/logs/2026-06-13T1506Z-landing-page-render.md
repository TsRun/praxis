# Audit run — 2026-06-13T15:06:00Z
**Mode:** TEST_ONE
**Subject:** landing-page-render
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised `/` unauthenticated. The hero, three feature cards (Opening trees, Game studies, Spaced repetition), Sign-in form, mode toggle (`aria-pressed`), and role picker (`aria-pressed`, `aria-label="Trainer — I coach others"`, etc.) all rendered correctly. Email and password inputs have programmatically associated `<label for=…>` via `useId`. Focus ring on the email input is the expected 2px amber outline plus a soft glow. No uncaught page errors, no application console errors. Mobile pass at 375x812 showed no horizontal overflow (scroll 360 ≤ client 375).

Observation that drove the fix: the page exposes zero ARIA landmarks. The top nav bar, hero, features, auth, and footer are all plain `<div>`s, so a screen-reader user gets one giant region with nothing to skip to, and keyboard users have no way to bypass the nav. Added a `.skip-link` keyboard-only "Skip to main content" anchor, replaced the top bar with `<header>`, wrapped the nav links in `<nav aria-label="Primary">`, wrapped hero/features/auth in `<main id="main">`, and replaced the footer `<div>` with `<footer>`. Visual layout is unchanged; assistive tech and keyboard users gain real landmarks.
