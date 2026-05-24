import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-new-opening-study-dialog: UI/a11y audit', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Waive browser-level "Failed to load resource: <status>" noise — these
      // are the browser logging a non-2xx fetch and cannot be suppressed.
      if (text.startsWith('Failed to load resource:')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // ---- Sign in ----
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="you@studio.club"]').fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer\/studies/, { timeout: 15000 });

  // Resolve the studies page
  await page.waitForSelector('h1, h2', { timeout: 15000 });

  // ---- Open New study menu ----
  await page.getByRole('button', { name: /New study/i }).first().click();
  // Dropdown items: "Opening study", "Game study", "Tactical set"
  const openingStudyItem = page.getByRole('button', { name: /^Opening study/i }).or(
    page.getByText('Opening study', { exact: false }),
  );
  await openingStudyItem.first().click();

  // ---- Dialog should be open ----
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.screenshot({ path: 'tests/audit/screenshots/trainer-new-opening-study-dialog.png', fullPage: true });

  // ---- Inspect inputs and a11y ----
  // Name input
  const nameInput = dialog.locator('input.input').first();
  const nameInfo = await nameInput.evaluate((el) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    let labelFor = 0;
    if (id) labelFor = document.querySelectorAll(`label[for="${id}"]`).length;
    const wrappingLabel = el.closest('label');
    const wrappingLabelText = wrappingLabel ? (wrappingLabel.textContent || '').trim() : null;
    return { id, ariaLabel, ariaLabelledBy, labelFor, wrappingLabelText };
  });
  console.log('NAME INPUT a11y:', nameInfo);

  // Name input focus styles
  await nameInput.focus();
  const nameFocusStyles = await nameInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('NAME INPUT :focus styles:', nameFocusStyles);

  // Side picker — pair of buttons (White / Black)
  const sideButtons = dialog.locator('button').filter({ hasText: /^(White|Black)$/ });
  const sideCount = await sideButtons.count();
  console.log('SIDE BUTTONS count (exact match White/Black):', sideCount);

  // Broader: buttons whose first text node is White or Black
  const sideOptions = dialog.locator('button').filter({ hasText: /(White|Black)/ });
  const sideOptionsAll = await sideOptions.all();
  const sideInfos: Array<{ title: string; ariaPressed: string | null; role: string | null; tabIndex: number }> = [];
  for (const btn of sideOptionsAll) {
    const info = await btn.evaluate((el) => {
      const txt = (el.textContent || '').trim();
      // Only collect the actual SideOption buttons (have White/Black title + hint)
      if (!/^(White|Black)/.test(txt)) return null;
      return {
        title: txt.slice(0, 80),
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        tabIndex: (el as HTMLButtonElement).tabIndex,
      };
    });
    if (info) sideInfos.push(info as any);
  }
  console.log('SIDE OPTIONS:', sideInfos);

  // Focus via keyboard so :focus-visible kicks in. Tab from the name input.
  await nameInput.focus();
  await page.keyboard.press('Tab');
  // The next tab stop should be the first side option.
  const tabbedTo = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    return {
      tag: a.tagName,
      text: (a.textContent || '').trim().slice(0, 40),
      matchesFocusVisible: a.matches(':focus-visible'),
    };
  });
  console.log('TABBED-TO element:', tabbedTo);

  const firstSide = sideOptions.first();
  const firstSideFocusStyles = await firstSide.evaluate((el) => {
    const cs = getComputedStyle(el);
    const fv = el.matches(':focus-visible');
    return {
      matchesFocusVisible: fv,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('SIDE OPTION (first) keyboard-focus styles:', firstSideFocusStyles);

  // Also tab once more — second side option
  await page.keyboard.press('Tab');
  const secondSide = sideOptions.nth(1);
  const secondSideFocusStyles = await secondSide.evaluate((el) => {
    const cs = getComputedStyle(el);
    const fv = el.matches(':focus-visible');
    return {
      matchesFocusVisible: fv,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('SIDE OPTION (second) keyboard-focus styles:', secondSideFocusStyles);

  await page.screenshot({ path: 'tests/audit/screenshots/trainer-new-opening-study-dialog-side-focus.png', fullPage: true });

  // ---- Close button on Dialog ----
  const closeBtn = dialog.locator('button').filter({ hasText: '' }).first();
  // Better: the close button is the small ghost button next to the title containing the X icon
  const headerCloseBtn = dialog.locator('h2 + button, button.btn-sm').first();
  const closeInfo = await headerCloseBtn.evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    textContent: (el.textContent || '').trim(),
  })).catch(() => null);
  console.log('CLOSE BUTTON:', closeInfo);

  // ---- Form validation: Create button disabled with empty name ----
  await nameInput.fill('');
  const createBtn = dialog.getByRole('button', { name: /Create study|Create \+ import/ }).first();
  const createDisabledEmpty = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CREATE BTN DISABLED (empty name):', createDisabledEmpty);

  await nameInput.fill('Audit test — Caro-Kann');
  const createDisabledFilled = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CREATE BTN DISABLED (filled name):', createDisabledFilled);

  // ---- Mobile viewport ----
  // Close dialog first via Escape, then reopen at small viewport
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'tests/audit/screenshots/trainer-new-opening-study-dialog-mobile.png', fullPage: true });

  await page.getByRole('button', { name: /New study/i }).first().click();
  await page.getByText('Opening study', { exact: false }).first().click();
  const mobileDialog = page.getByRole('dialog');
  await expect(mobileDialog).toBeVisible();
  await page.waitForTimeout(200);

  await page.screenshot({ path: 'tests/audit/screenshots/trainer-new-opening-study-dialog-mobile-dialog.png', fullPage: true });

  const mobileDialogBox = await mobileDialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
  });
  console.log('MOBILE DIALOG BOX:', mobileDialogBox, 'viewport 375');

  const mobileSideButtons = mobileDialog.locator('button').filter({ hasText: /(White|Black)/ });
  const mobileSideRects: Array<any> = [];
  for (const b of await mobileSideButtons.all()) {
    const info = await b.evaluate((el) => {
      const t = (el.textContent || '').trim();
      if (!/^(White|Black)/.test(t)) return null;
      const r = el.getBoundingClientRect();
      return { txt: t.slice(0, 40), width: Math.round(r.width), height: Math.round(r.height) };
    });
    if (info) mobileSideRects.push(info);
  }
  console.log('MOBILE SIDE OPTION RECTS:', mobileSideRects);

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);

  // Don't fail the spec on observed UI issues — we report them.
  expect(pageErrors).toEqual([]);
});
