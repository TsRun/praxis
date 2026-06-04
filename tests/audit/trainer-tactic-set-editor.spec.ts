import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-tactic-set-editor: UI/a11y audit', async ({ page }) => {
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

  // ---- Sign in ----
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="you@studio.club"]').fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer\/studies/, { timeout: 15000 });
  await page.waitForSelector('h1, h2', { timeout: 15000 });

  // ---- Find or create a tactical set to navigate into ----
  await page.waitForLoadState('networkidle').catch(() => {});

  // Look for the Tactical sets section / a link to /trainer/studies/tactic/N
  let tacticLink = page.locator('a[href*="/trainer/studies/tactic/"]').first();
  if ((await tacticLink.count()) === 0) {
    // Create one via the New study menu
    await page.getByRole('button', { name: /New study/i }).first().click();
    await page.getByRole('menuitem', { name: /Tactical set/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const ts = Date.now();
    await dialog.locator('input.input').first().fill(`bot audit set ${ts}`);
    await dialog.getByRole('button', { name: /Create/i }).click();
    await page.waitForURL(/\/trainer\/studies\/tactic\/\d+/, { timeout: 15000 });
  } else {
    await tacticLink.click();
    await page.waitForURL(/\/trainer\/studies\/tactic\/\d+/, { timeout: 15000 });
  }

  // ---- Page sanity: title, breadcrumb chip, Add puzzle button ----
  await page.waitForSelector('h1, h2', { timeout: 15000 });
  const url = page.url();
  console.log('TACTIC SET URL:', url);

  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  const h1Text = (await h1.textContent())?.trim() || '';
  console.log('H1:', h1Text);

  const tacticalChip = page.getByText(/Tactical set/i).first();
  await expect(tacticalChip).toBeVisible();

  const puzzlesHeading = page.getByRole('heading', { level: 2 }).first();
  await expect(puzzlesHeading).toBeVisible();
  const puzzlesText = (await puzzlesHeading.textContent())?.trim() || '';
  console.log('H2:', puzzlesText);

  const addPuzzleBtn = page.getByRole('button', { name: /Add puzzle/i });
  await expect(addPuzzleBtn).toBeVisible();

  const assignBtn = page.getByRole('button', { name: /Assign to student/i });
  await expect(assignBtn).toBeVisible();

  const deleteSetBtn = page.getByRole('button', { name: /Delete set/i });
  await expect(deleteSetBtn).toBeVisible();

  const backStudiesBtn = page.getByRole('button', { name: /^Studies$/ }).first();
  await expect(backStudiesBtn).toBeVisible();

  // ---- Desktop screenshot ----
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-tactic-set-editor.png',
    fullPage: true,
  });

  // ---- a11y: editable title --- does the H1 expose a usable interaction? ----
  // Look for a button INSIDE the h1 (the fix) or a fallback signal of
  // keyboard-accessibility (tabindex / role) on the h1 itself.
  const titleInfo = await h1.evaluate((el) => {
    const innerButton = el.querySelector('button');
    return {
      h1Role: el.getAttribute('role'),
      h1Tabindex: el.getAttribute('tabindex'),
      h1Title: el.getAttribute('title'),
      innerButtonExists: !!innerButton,
      innerButtonTitle: innerButton?.getAttribute('title') ?? null,
      innerButtonType: innerButton?.getAttribute('type') ?? null,
      innerButtonText: innerButton ? (innerButton.textContent || '').trim() : null,
    };
  });
  console.log('H1 EDITABLE TITLE a11y:', titleInfo);

  // ---- a11y: button focus indicators via REAL keyboard tabbing ----
  // Reset focus and Tab repeatedly so :focus-visible heuristic engages.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  const probeBtn = async (name: RegExp): Promise<unknown> => {
    const target = page.getByRole('button', { name }).first();
    // Tab into the page until activeElement equals our target (or give up after N).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    let matched = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      matched = await target.evaluate((el) => el === document.activeElement);
      if (matched) break;
    }
    return target.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        focused: el === document.activeElement,
        matchesFocusVisible: el.matches(':focus-visible'),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow,
      };
    });
  };
  console.log('ADD PUZZLE focus:', await probeBtn(/Add puzzle/i));
  console.log('DELETE SET focus:', await probeBtn(/Delete set/i));
  console.log('ASSIGN focus:', await probeBtn(/Assign to student/i));
  console.log('STUDIES back focus:', await probeBtn(/^Studies$/));

  // ---- a11y: puzzle row delete buttons (icon-only) — accessible name? ----
  const iconDeleteBtns = page.locator('button[title="Delete puzzle"]');
  const iconDelCount = await iconDeleteBtns.count();
  console.log('icon delete puzzle buttons:', iconDelCount);
  if (iconDelCount > 0) {
    const info = await iconDeleteBtns.first().evaluate((el) => ({
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim(),
    }));
    console.log('icon delete btn a11y:', info);
  }

  // ---- Try clicking Add puzzle: should navigate ----
  await Promise.all([
    page.waitForURL(/\/trainer\/studies\/tactic\/\d+\/puzzles\/new/, { timeout: 15000 }),
    addPuzzleBtn.click(),
  ]);
  console.log('ADD PUZZLE URL:', page.url());

  // ---- Back to set page ----
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });

  // ---- Mobile pass at 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-tactic-set-editor-mobile.png',
    fullPage: true,
  });
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('mobile scrollWidth:', docW);

  // header buttons should still be reachable on mobile
  await expect(page.getByRole('button', { name: /Add puzzle/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Assign to student/i })).toBeVisible();

  // ---- Final tallies ----
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2));
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2));
  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
