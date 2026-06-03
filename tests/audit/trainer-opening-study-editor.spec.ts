import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-opening-study-editor: editor renders + UI/a11y checks', async ({
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
    // Create one via the New study → Opening study dialog
    await page.getByRole('button', { name: /new study/i }).click();
    await page.getByRole('button', { name: /opening study/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog
      .locator('input.input')
      .first()
      .fill('Audit run — opening editor probe');
    await dialog.getByRole('button', { name: /create study/i }).first().click();
  }

  await page.waitForURL(/\/trainer\/studies\/opening\/\d+/, { timeout: 15000 });
  console.log('EDITOR URL:', page.url());

  // 3) Editor renders — wait until Loading… disappears
  await page.waitForSelector('h1, h2', { timeout: 10000 });
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 10000 });

  // h1: editable title
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  const h1Text = (await h1.textContent())?.trim();
  console.log('EDITOR H1:', h1Text);

  // Header controls
  const treeTab = page.getByRole('button', { name: /^Tree$/ });
  const chaptersTab = page.getByRole('button', { name: /^Chapters$/ });
  const importLichessBtn = page.getByRole('button', {
    name: /import from lichess/i,
  });
  const importGamesBtn = page.getByRole('button', { name: /^Import games$/i });
  const assignBtn = page.getByRole('button', { name: /assign to student/i });

  await expect(treeTab).toBeVisible();
  await expect(chaptersTab).toBeVisible();
  await expect(importLichessBtn).toBeVisible();
  await expect(importGamesBtn).toBeVisible();
  await expect(assignBtn).toBeVisible();

  // Sub-head crumbs (start › ...)
  const startCrumb = page.locator('.crumbs button').first();
  await expect(startCrumb).toBeVisible();
  console.log('START CRUMB:', (await startCrumb.textContent())?.trim());

  // 4) Chess board element exists — chessground renders into .cg-wrap
  const cgWrap = page.locator('.cg-wrap, cg-container').first();
  const cgCount = await cgWrap.count();
  console.log('CG-WRAP COUNT:', cgCount);
  expect(cgCount).toBeGreaterThan(0);
  const cgBox = await cgWrap.boundingBox();
  console.log('CG-WRAP BOX (desktop):', cgBox);

  // 5) Candidate replies card heading
  const candidatesH = page.getByRole('heading', { name: /candidate replies/i });
  await expect(candidatesH).toBeVisible();

  // 6) Line · siblings card heading
  const lineH = page.getByRole('heading', { name: /line.*siblings/i });
  await expect(lineH).toBeVisible();

  // 7) Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-opening-study-editor.png',
    fullPage: true,
  });

  // 8) Switch to Chapters mode and back — should not error
  await chaptersTab.click();
  await page.waitForTimeout(300);
  // Should now show Chapters sidebar h2
  const chaptersSidebarH = page
    .getByRole('heading', { name: /^Chapters$/ })
    .first();
  await expect(chaptersSidebarH).toBeVisible();
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-opening-study-editor-chapters.png',
    fullPage: true,
  });
  await treeTab.click();
  await page.waitForTimeout(200);

  // 9) Edit-prefix link / Set-opening-prefix button — a11y info
  const prefixLink = page
    .getByRole('button', { name: /(set opening prefix|edit prefix)/i })
    .first();
  if ((await prefixLink.count()) > 0) {
    const prefixInfo = await prefixLink.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || '').trim(),
        color: cs.color,
        background: cs.backgroundColor,
        fontSize: cs.fontSize,
      };
    });
    console.log('PREFIX LINK:', prefixInfo);
  }

  // 10) Focus the chapter title input under the board (if currently selected node)
  // First click the first non-empty crumb to land on a position (if any moves exist).
  const crumbButtons = page.locator('.crumbs button');
  const crumbCount = await crumbButtons.count();
  console.log('CRUMB COUNT (incl. start):', crumbCount);

  // 11) A11y check on header buttons: focus indicator
  await importGamesBtn.focus();
  const importFocus = await importGamesBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('IMPORT GAMES :focus styles:', importFocus);

  await assignBtn.focus();
  const assignFocus = await assignBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('ASSIGN TO STUDENT :focus styles:', assignFocus);

  // 12) Mobile viewport check
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-opening-study-editor-mobile.png',
    fullPage: true,
  });

  // Mobile board size
  const cgWrapMobile = page.locator('.cg-wrap, cg-container').first();
  const cgBoxMobile = await cgWrapMobile.boundingBox();
  console.log('CG-WRAP BOX (mobile 375):', cgBoxMobile);

  // Mobile: are primary buttons still visible / hittable?
  const headerBtnsVisible = {
    tree: await treeTab.isVisible(),
    chapters: await chaptersTab.isVisible(),
    importLichess: await importLichessBtn.isVisible(),
    importGames: await importGamesBtn.isVisible(),
    assign: await assignBtn.isVisible(),
  };
  console.log('HEADER BUTTONS VISIBLE ON MOBILE:', headerBtnsVisible);

  const assignBoxMobile = await assignBtn.boundingBox();
  console.log('ASSIGN BOX MOBILE:', assignBoxMobile);

  // 13) Logs
  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !/Failed to load resource/.test(e)),
  );

  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
