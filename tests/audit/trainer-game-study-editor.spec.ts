import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-game-study-editor: editor renders + UI/a11y checks', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // 1) Log in
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await page.waitForURL(/\/trainer\/studies|\/student\/dashboard/, {
    timeout: 15000,
  });

  // 2) Navigate to /trainer/studies and find a game study card
  if (!page.url().includes('/trainer/studies')) {
    await page.goto(`${PROD_URL}/trainer/studies`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector('h1, h2', { timeout: 10000 });

  // Find first game-study link "/trainer/studies/game/<n>"
  const gameLinks = page.locator('a[href*="/trainer/studies/game/"]');
  const gameCount = await gameLinks.count();
  console.log('GAME STUDY LINKS:', gameCount);

  if (gameCount > 0) {
    const firstHref = await gameLinks.first().getAttribute('href');
    console.log('OPEN HREF:', firstHref);
    await gameLinks.first().click();
  } else {
    // Create one via the New game study dialog — page navigates to editor on success
    const samplePgn =
      '[Event "Audit"]\n[White "Audit Bot"]\n[Black "Audit Bot"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *';
    await page.getByRole('button', { name: /new study/i }).click();
    await page.getByRole('button', { name: /game study/i }).click();
    const dialog = page.getByRole('dialog', { name: /new game study/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.locator('input').first().fill('Audit run — game editor probe');
    await dialog.locator('textarea').first().fill(samplePgn);
    await dialog.getByRole('button', { name: /import game/i }).click();
  }

  await page.waitForURL(/\/trainer\/studies\/game\/\d+/, { timeout: 15000 });
  console.log('EDITOR URL:', page.url());

  // 4) Editor should render — chess board + move list + Save button
  await page.waitForSelector('h1, h2', { timeout: 10000 });
  // Loading… screen replaced
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10000 });

  // Heading (editable title) is an h1
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  const h1Text = (await h1.textContent())?.trim();
  console.log('EDITOR H1:', h1Text);

  // Save annotations button
  const saveBtn = page.getByRole('button', { name: /save annotations/i });
  await expect(saveBtn).toBeVisible();

  // Assign to student button
  const assignBtn = page.getByRole('button', { name: /assign to student/i });
  await expect(assignBtn).toBeVisible();

  // Move list heading
  await expect(page.getByRole('heading', { name: /move list/i })).toBeVisible();

  // Chess board element exists — chessground renders into .cg-wrap
  const cgWrap = page.locator('.cg-wrap, cg-container').first();
  const cgCount = await cgWrap.count();
  console.log('CG-WRAP COUNT:', cgCount);
  if (cgCount > 0) {
    const cgBox = await cgWrap.boundingBox();
    console.log('CG-WRAP BOX (desktop):', cgBox);
  }
  const boardContainer = page.locator('.three-pane > div').first();
  const bcBox = await boardContainer.boundingBox();
  console.log('BOARD CONTAINER BOX (desktop):', bcBox);

  // 5) Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-game-study-editor.png',
    fullPage: true,
  });

  // 6) Click the first move button (white ply 1) so the annotation pane unlocks
  const moveButtons = page
    .locator('button')
    .filter({ hasText: /^[A-Za-z][a-zA-Z0-9+#=\-]*\s*●?Q?\s*●?$/ });
  // Less brittle: find the first "1." row's white-move button
  const firstRowButtons = page
    .locator('.font-mono')
    .first()
    .locator('button');
  const firstRowBtnCount = await firstRowButtons.count();
  console.log('FIRST PLY ROW BUTTONS:', firstRowBtnCount);
  if (firstRowBtnCount > 0) {
    await firstRowButtons.first().click();
    await page.waitForTimeout(200);
  }

  // 7) Inspect annotation textarea (a11y)
  const textarea = page.locator('textarea').first();
  const hasTextarea = (await textarea.count()) > 0;
  console.log('ANNOTATION TEXTAREA PRESENT:', hasTextarea);
  if (hasTextarea) {
    const ta = await textarea.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return {
        id: t.id || null,
        ariaLabel: t.getAttribute('aria-label'),
        ariaLabelledBy: t.getAttribute('aria-labelledby'),
        wrappedInLabel: !!t.closest('label'),
        placeholder: t.placeholder,
        outlineStyle: getComputedStyle(t).outlineStyle,
      };
    });
    console.log('TEXTAREA INFO:', ta);

    // Focus indicator
    await textarea.focus();
    const focus = await textarea.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        boxShadow: s.boxShadow,
        borderColor: s.borderColor,
      };
    });
    console.log('TEXTAREA :focus styles:', focus);

    // Capture focused screenshot
    await page.screenshot({
      path: 'tests/audit/screenshots/trainer-game-study-editor-textarea-focus.png',
      fullPage: false,
    });
  }

  // 8) Quiz checkbox a11y
  const quizCheckbox = page.locator('input[type="checkbox"]').first();
  if ((await quizCheckbox.count()) > 0) {
    const cb = await quizCheckbox.evaluate((el) => {
      const c = el as HTMLInputElement;
      return {
        id: c.id || null,
        ariaLabel: c.getAttribute('aria-label'),
        wrappedInLabel: !!c.closest('label'),
        labelText: c.closest('label')?.textContent?.trim() || null,
      };
    });
    console.log('QUIZ CHECKBOX:', cb);
  }

  // 9) Save button click + busy/disabled wiring
  const saveDisabledBefore = await saveBtn.isDisabled();
  console.log('SAVE DISABLED (before):', saveDisabledBefore);

  // 10) Mobile viewport check
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  // Confirm no horizontal scroll
  const overflow = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  console.log('MOBILE OVERFLOW:', overflow);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-game-study-editor-mobile.png',
    fullPage: true,
  });

  // Mobile: header buttons reachable? Check Save annotations is still visible
  const saveVisibleMobile = await saveBtn.isVisible();
  console.log('SAVE VISIBLE ON MOBILE:', saveVisibleMobile);
  const saveBox = await saveBtn.boundingBox();
  console.log('SAVE BOX MOBILE:', saveBox);

  // Logs
  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !/Failed to load resource/.test(e)),
  );

  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
