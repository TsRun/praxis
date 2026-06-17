# Audit run — 2026-06-17T21:10:16Z
**Mode:** TEST_ONE
**Subject:** trainer-studies-list
**Result:** IMPROVED+PENDING+verification

Observed inconsistent loading indicators on the stat tiles at /trainer/studies. Throttling network latency to 1.5s revealed that two of the three tiles ("studies authored" and "chapters total") flashed `0` while the third ("students linked") correctly displayed an em dash `—`. The two reduce-based values fell back to `0` because they coalesced `null` arrays to `[]` before computing.

Fix in `src/trainer/StudiesPage.tsx`: derive `studiesAuthored` and `totalChapters` as `null` while the source lists are still loading, then render `—` consistently across all three tiles. Typecheck and unit tests pass; the audit spec passes against prod on the PR branch.
