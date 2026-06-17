# Audit run — 2026-06-17T15:05:00Z
**Mode:** TEST_ONE
**Subject:** trainer-students-list
**Result:** OK+MERGED

Exercised /trainer/students at desktop (1280x800) and at viewport
375x812. Heading "Students" renders, the All / Linked / Invited filter
chips are present with `aria-pressed` correctly toggling between
buttons, the search input has `aria-label="Find student by nickname"`,
and the live "0 students" count span carries
`role="status" aria-live="polite" aria-atomic="true"` so AT users hear
the count change when the filter switches. The search input draws a
clear 2px amber focus outline plus a soft box-shadow halo on `:focus`.

The empty state ("No students yet" with an Invite student CTA) renders
cleanly on both viewports; the heading, intro copy, search row, and
filter chips stack into a single column at 375 with no horizontal
overflow (scrollWidth=360, clientWidth=375). Filter clicks navigate
between All/Linked/Invited without console errors, and switching back
to All preserves layout. No page errors, no application-level console
errors (only the standard `Failed to load resource` waivers). Marking
OK with no source change.
