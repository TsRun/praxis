import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-assign-study-dialog: opens dialog with student picker + UI/a11y checks', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.startsWith('Failed to load resource:')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // 1) Sign in
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await page.waitForURL(/\/trainer\/studies|\/student\/dashboard/, {
    timeout: 15000,
  });

  // 2) Navigate to /trainer/studies and find an opening-study link
  if (!page.url().includes('/trainer/studies')) {
    await page.goto(`${PROD_URL}/trainer/studies`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector('h1, h2', { timeout: 10000 });

  const openingLinks = page.locator('a[href*="/trainer/studies/opening/"]');
  const openingCount = await openingLinks.count();
  console.log('OPENING STUDY LINKS:', openingCount);

  if (openingCount > 0) {
    const firstHref = await openingLinks.first().getAttribute('href');
    console.log('OPEN HREF:', firstHref);
    await openingLinks.first().click();
  } else {
    await page.getByRole('button', { name: /new study/i }).click();
    await page.getByRole('button', { name: /opening study/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog
      .locator('input.input')
      .first()
      .fill('Audit run — assign dialog probe');
    await dialog
      .getByRole('button', { name: /create study/i })
      .first()
      .click();
  }

  await page.waitForURL(/\/trainer\/studies\/opening\/\d+/, { timeout: 15000 });
  console.log('EDITOR URL:', page.url());
  await page.waitForSelector('h1, h2', { timeout: 10000 });
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10000 });

  // 3) Click "Assign to student"
  const assignBtn = page.getByRole('button', { name: /assign to student/i });
  await expect(assignBtn).toBeVisible();
  await assignBtn.click();

  // 4) Dialog opens
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Title format: "Assign <studyName>"
  const dialogTitle = dialog.locator('h2').first();
  const titleText = (await dialogTitle.textContent())?.trim();
  console.log('DIALOG TITLE:', titleText);
  expect(titleText).toMatch(/^Assign /);

  // aria-modal + aria-label
  const ariaModal = await dialog.getAttribute('aria-modal');
  const ariaLabel = await dialog.getAttribute('aria-label');
  console.log('DIALOG aria-modal:', ariaModal, 'aria-label:', ariaLabel);
  expect(ariaModal).toBe('true');

  // 5) Search input present (placeholder 'search students…') and autofocused
  const search = dialog.locator('input.input').first();
  await expect(search).toBeVisible();
  const placeholder = await search.getAttribute('placeholder');
  console.log('SEARCH PLACEHOLDER:', placeholder);

  // Focus check on search input
  const focusedTag = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.tagName,
  );
  console.log('FOCUSED ON OPEN:', focusedTag);

  // 6) Meta hint copy
  const metaHint = dialog.locator('.meta').first();
  const metaText = (await metaHint.textContent())?.trim();
  console.log('META HINT:', metaText);

  // 7) Wait for roster to load (either student rows render OR no-match message)
  await page.waitForFunction(
    () => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return false;
      const loadingShown = Array.from(dlg.querySelectorAll('.meta')).some((el) =>
        /Loading roster/i.test(el.textContent || ''),
      );
      return !loadingShown;
    },
    null,
    { timeout: 10000 },
  );

  // Count picker buttons (the student rows, not Cancel/Assign/Close)
  const studentButtons = dialog.locator(
    'div.scroll-thin > button[type="button"]',
  );
  const studentCount = await studentButtons.count();
  console.log('STUDENT ROW COUNT:', studentCount);

  // Cancel + Assign footer buttons
  const cancelBtn = dialog.getByRole('button', { name: /^Cancel$/ });
  const assignSubmitBtn = dialog.getByRole('button', { name: /^Assign$/ });
  await expect(cancelBtn).toBeVisible();
  await expect(assignSubmitBtn).toBeVisible();

  // Assign should be disabled until a student is picked
  const initiallyDisabled = await assignSubmitBtn.isDisabled();
  console.log('ASSIGN DISABLED (no pick):', initiallyDisabled);
  expect(initiallyDisabled).toBe(true);

  // 8) Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-assign-study-dialog.png',
    fullPage: true,
  });

  // 9) Search filter: type a no-match string and verify the empty-state
  if (studentCount > 0) {
    await search.fill('zzzzzzzz-no-such-student');
    await page.waitForTimeout(200);
    const filteredCount = await studentButtons.count();
    console.log('FILTERED COUNT (no match):', filteredCount);
    expect(filteredCount).toBe(0);
    const noMatch = dialog.getByText(/no students match/i);
    await expect(noMatch).toBeVisible();
    // Clear search
    await search.fill('');
    await page.waitForTimeout(200);
    const restoredCount = await studentButtons.count();
    console.log('RESTORED COUNT:', restoredCount);
    expect(restoredCount).toBe(studentCount);

    // Pick first student → Assign becomes enabled
    await studentButtons.first().click();
    await page.waitForTimeout(100);
    const enabledAfterPick = !(await assignSubmitBtn.isDisabled());
    console.log('ASSIGN ENABLED AFTER PICK:', enabledAfterPick);
    expect(enabledAfterPick).toBe(true);

    // Picked row visual: contains "✓ picked"
    const pickedMark = dialog.getByText(/✓ picked/);
    await expect(pickedMark).toBeVisible();
  } else {
    console.log('Skipping pick branch — no students in roster');
  }

  // 10) A11y: focus indicator on Cancel + Assign
  await cancelBtn.focus();
  const cancelFocus = await cancelBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('CANCEL :focus:', cancelFocus);

  await assignSubmitBtn.focus();
  const assignFocus = await assignSubmitBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('ASSIGN :focus:', assignFocus);

  // 11) Search input :focus
  await search.focus();
  const searchFocus = await search.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('SEARCH :focus:', searchFocus);

  // 12) Close button (X) aria-label
  const closeX = dialog.getByRole('button', { name: /^Close$/ });
  const closeXCount = await closeX.count();
  console.log('CLOSE X COUNT:', closeXCount);
  expect(closeXCount).toBeGreaterThan(0);

  // 13) Mobile viewport pass — 375x812
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // Dialog bounding box at 375
  const dialogBoxMobile = await dialog.boundingBox();
  console.log('DIALOG BOX (mobile 375):', dialogBoxMobile);
  // Dialog must not overflow viewport horizontally
  if (dialogBoxMobile) {
    expect(dialogBoxMobile.x).toBeGreaterThanOrEqual(0);
    expect(dialogBoxMobile.x + dialogBoxMobile.width).toBeLessThanOrEqual(376);
  }

  const dialogVisibleMobile = {
    title: await dialogTitle.isVisible(),
    search: await search.isVisible(),
    cancel: await cancelBtn.isVisible(),
    assign: await assignSubmitBtn.isVisible(),
  };
  console.log('DIALOG ELEMENTS VISIBLE ON MOBILE:', dialogVisibleMobile);

  // Cancel + Assign tap-target sizes (WCAG AAA target ≥ 44px; we accept ≥ 32px)
  const cancelBox = await cancelBtn.boundingBox();
  const assignBox = await assignSubmitBtn.boundingBox();
  console.log('CANCEL BOX (mobile):', cancelBox);
  console.log('ASSIGN BOX (mobile):', assignBox);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-assign-study-dialog-mobile.png',
    fullPage: true,
  });

  // 14) Close dialog via Cancel
  await cancelBtn.click();
  await page.waitForTimeout(300);
  const dialogStillOpen = await page.getByRole('dialog').count();
  console.log('DIALOG COUNT AFTER CANCEL:', dialogStillOpen);
  expect(dialogStillOpen).toBe(0);

  // 15) Reopen, then close via Esc
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await assignBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const dialogAfterEsc = await page.getByRole('dialog').count();
  console.log('DIALOG COUNT AFTER ESC:', dialogAfterEsc);
  expect(dialogAfterEsc).toBe(0);

  // 16) Logs
  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !/Failed to load resource/.test(e)),
  );

  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
