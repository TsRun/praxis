# Audit run — 2026-06-13T12:04:00Z
**Mode:** TEST_ONE
**Subject:** trainer-studies-list
**Result:** OK+MERGED

Exercised /trainer/studies as the bot trainer account. Page rendered the Studies heading, three stat tiles (19 studies authored, 0 students linked, 0 chapters total), and all three sections (Opening studies, Game studies, Tactical sets) with section counts (11/8/1). Search input carries `aria-label="Search studies"` and shows a 2px amber focus outline plus a soft glow. Filter segmented (All/Opening/Game/Tactic) exposes `aria-pressed`; view-toggle buttons (Grid/List) have icon-only `aria-label` and `aria-pressed`. New study trigger correctly exposes `aria-haspopup`, `aria-expanded`, `aria-controls`. Tab from search lands on the "All" filter with a visible amber focus ring. Section counts render at 13px in `rgb(160,160,168)` on the dark page background.

At 375x812 there is no horizontal overflow (scroll 360 ≤ client 375); the filter row wraps to a 178px tall block but stays in-bounds. Card hover triggers the expected `translateY(-1px)` lift and stronger box-shadow. Zero uncaught page errors and zero application console errors.
