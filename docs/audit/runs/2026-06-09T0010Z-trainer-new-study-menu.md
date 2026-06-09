# Audit run — 2026-06-09T00:10:00Z
**Mode:** TEST_ONE
**Subject:** trainer-new-study-menu
**Result:** OK+MERGED

Re-ran the Playwright spec against prod. Trigger has correct aria-haspopup/aria-expanded/aria-controls and a strong 2px amber focus outline. Menu opens with role=menu and aria-labelledby pointing to the trigger; three menuitems render (Opening study, Game study, Tactical set) with 60px touch height. Initial focus lands on the first item, ArrowDown moves focus to the second. Escape and outside-click both close the menu. At 375x812 the menu width is 320px with 16px gutters, no horizontal page overflow. Clicking "Opening study" closes the menu and opens a dialog. Zero page errors, zero application console errors. Mark OK.
