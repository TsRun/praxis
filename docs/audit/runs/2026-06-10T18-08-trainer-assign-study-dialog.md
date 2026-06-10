# Audit run — 2026-06-10T18:08:00Z
**Mode:** TEST_ONE
**Subject:** trainer-assign-study-dialog
**Result:** IMPROVED+PENDING+VERIFICATION

Exercised the "Assign to student" dialog on `/trainer/studies/opening/:id` against prod. Dialog opens correctly with title "Assign <studyName>", aria-modal=true, search input autofocused. Roster fetched as empty for the bot account (0 students), exercising the empty-state branch. Mobile pass at 375x812 found no horizontal overflow (scrollWidth 360 ≤ 375); dialog box stays within the viewport (x=7.5, width=345). Cancel/Esc both correctly dismiss the dialog. No page errors, no application console errors.

UI observation: the empty-state copy "No students yet — invite one from the Students page." references the Students page in plain text — the user has to manually close the dialog and navigate. Smallest-change fix: wrap the trailing phrase in a `Link to="/trainer/students"` with `className="link"` and an `onClick={onClose}` to dismiss the dialog before navigating. Typecheck + 48 unit tests pass on the branch.
