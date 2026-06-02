# Audit run — 2026-06-02T09:17:14Z
**Mode:** TEST_ONE
**Subject:** settings-page
**Result:** IMPROVED+PENDING

Picked oldest-tested feature (`settings-page`, last 2026-05-30T06:11Z). The existing spec used a stale `.grid-3` selector that no longer matches the Roles card markup, so it timed out. Rewrote the spec around the current accessibility primitives: `role="group" aria-label="Active roles"` for the Roles tiles, `getByLabel(...)` for Profile/Password inputs (which use implicit `<label><span>…</span><input/></label>` association), and a 375×812 mobile pass that asserts no horizontal overflow and ≥60px-wide role tiles. All four section headings render, no console/page errors, focus ring is visible on inputs, tab order Nickname → Email is correct, and the Profile "Save changes" button is correctly disabled while clean.

Visual finding from the screenshots: the **API keys** Card uses `padding: 18` while Profile / Roles / Password use `padding: 22`, so it reads as visibly tighter than its siblings on the same page. Smallest-change fix: bump the API keys Card to `padding: 22` to match the other three Settings cards. Typecheck + 48 unit tests green.
