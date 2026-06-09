# Audit run — 2026-06-09T15:10:00Z
**Mode:** TEST_ONE
**Subject:** settings-page
**Result:** OK+MERGED

Ran the settings-page audit spec against https://praxis.tsrun.dev/settings. All four sections rendered (Profile, Roles, Password, API keys), all inputs are wrapped in real `<label>` elements with proper autocomplete tokens (nickname/email/current-password/new-password), the Roles group exposes `role="group" aria-label="Active roles"` with three `aria-pressed` toggle buttons, focus indicator on inputs is a 2px amber outline plus accent-soft box-shadow, mobile viewport (375x812) had no horizontal overflow (360px scroll vs 375px client) and role buttons stayed >60px wide (89px each). No page errors, no app console errors. Profile Save button is correctly disabled when the form is not dirty. Bookkeeping-only PR to refresh `lastTestedAt`.
