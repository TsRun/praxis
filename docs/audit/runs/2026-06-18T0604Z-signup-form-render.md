# Audit run — 2026-06-18T06:04:05Z
**Mode:** TEST_ONE
**Subject:** signup-form-render
**Result:** OK+MERGED

Exercised the Sign-up form on `https://praxis.tsrun.dev/` after clicking the "Create account" tab. All three signup-only inputs (name, email, password) render with associated `<label for="...">` and proper `autocomplete` attributes (`email`, `nickname`, `new-password`). The three role-picker buttons (Trainer/Student/Solo) carry descriptive `aria-label` ("Trainer — I coach others", etc.), are mutually toggleable via `aria-pressed`, expose 136×96 tap targets at desktop and 280×96 at 375-wide mobile (well above 44px minimum), and gain a `:focus-visible` 2px amber outline on keyboard tab. Email/name/password inputs gain a solid 2px amber outline plus a soft 3px box-shadow halo on focus, and the role buttons get a subtle inset accent box-shadow on hover. Submit button is amber on near-black (high contrast) and switches its label to "Create account →" in signup mode.

Empty-form submit relies on native HTML5 `required` validation (`validity.valueMissing === true`, browser tooltip "Please fill out this field."); the `div[role="alert"]` region remains empty but the native popup is sufficient for a11y. No placeholder `href="#"` links remain in the terms/privacy disclaimer (previous PR cleaned them up). At 375×812 the page has zero horizontal overflow (scrollWidth 360 vs clientWidth 375) and signup mode persists across viewport change. Zero application console errors and zero uncaught page errors. Marking OK and bumping `lastTestedAt`.
