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

  let tacticLink = page.locator('a[href*="/trainer/studies/tactic/"]').first();
  if ((await tacticLink.count()) === 0) {
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

  // Header buttons (may also appear inside an empty-state callout)
  const headerAddPuzzleBtn = page
    .getByRole('button', { name: /Add puzzle/i })
    .first();
  await expect(headerAddPuzzleBtn).toBeVisible();

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

  // ---- a11y: editable title — accessible name on the inner button ----
  const titleInfo = await h1.evaluate((el) => {
    const innerButton = el.querySelector('button');
    return {
      h1Role: el.getAttribute('role'),
      innerButtonExists: !!innerButton,
      innerButtonTitle: innerButton?.getAttribute('title') ?? null,
      innerButtonType: innerButton?.getAttribute('type') ?? null,
      innerButtonText: innerButton ? (innerButton.textContent || '').trim() : null,
    };
  });
  console.log('H1 EDITABLE TITLE a11y:', titleInfo);

  // ---- a11y: button focus indicators via REAL keyboard tabbing ----
  const probeBtn = async (name: RegExp): Promise<unknown> => {
    const target = page.getByRole('button', { name }).first();
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

  // ---- a11y: empty-state region — should NOT wrap the call-to-action button
  // in a role=status live region (otherwise SR re-announces the button label
  // on every render). Either drop role=status or scope it to the message only.
  const emptyStateAddPuzzleInStatus = await page
    .locator('[role="status"] button:has-text("Add puzzle")')
    .count();
  console.log('Add puzzle button inside role=status:', emptyStateAddPuzzleInStatus);

  // ---- a11y: puzzle list — list semantics + icon-only delete name ----
  const puzzleList = page.locator('[role="list"][aria-label*="Puzzle" i]');
  const puzzleListCount = await puzzleList.count();
  console.log('puzzle list role=list count:', puzzleListCount);

  const iconDeleteBtns = page.locator('button[aria-label="Delete puzzle"]');
  const iconDelCount = await iconDeleteBtns.count();
  console.log('icon delete puzzle buttons (aria-label):', iconDelCount);

  // If there are puzzles in this set, the list semantics MUST be present and
  // every icon-only delete button MUST expose an accessible name via aria-label.
  const puzzleCountMatch = puzzlesText.match(/\((\d+)\)/);
  const puzzleCount = puzzleCountMatch ? Number(puzzleCountMatch[1]) : 0;
  console.log('puzzleCount parsed from H2:', puzzleCount);

  if (puzzleCount > 0) {
    expect(puzzleListCount, 'puzzle list has role=list with aria-label').toBeGreaterThan(0);
    const listitems = await page.locator('[role="list"][aria-label*="Puzzle" i] [role="listitem"]').count();
    expect(listitems, 'each puzzle row is role=listitem').toBe(puzzleCount);
    expect(iconDelCount, 'icon-only delete buttons have aria-label').toBe(puzzleCount);
  }

  // The empty-state CTA button must NOT live inside a role=status region.
  expect(
    emptyStateAddPuzzleInStatus,
    'empty-state "Add puzzle" button must not be inside a role=status live region'
  ).toBe(0);

  // ---- Try clicking Add puzzle: should navigate to /puzzles/new ----
  await Promise.all([
    page.waitForURL(/\/trainer\/studies\/tactic\/\d+\/puzzles\/new/, { timeout: 15000 }),
    headerAddPuzzleBtn.click(),
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

  await expect(page.getByRole('button', { name: /Add puzzle/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Assign to student/i })).toBeVisible();

  // ---- Final tallies ----
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2));
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2));
  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
