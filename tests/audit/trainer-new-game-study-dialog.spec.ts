import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-new-game-study-dialog: opens, exercises a11y + UI checks', async ({
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

  // 1) Log in via the landing page
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await page.waitForURL(/\/trainer\/studies|\/student\/dashboard/, {
    timeout: 15000,
  });

  // 2) Navigate to Studies (trainer)
  if (!page.url().includes('/trainer/studies')) {
    await page.goto(`${PROD_URL}/trainer/studies`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector('h1, h2', { timeout: 10000 });

  // 3) Open the New study menu, then click Game study
  await page.getByRole('button', { name: /new study/i }).click();
  await page.getByRole('button', { name: /game study/i }).click();

  // 4) Dialog open — sanity assertions
  const dialog = page.getByRole('dialog', { name: /new game study/i });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog.png',
    fullPage: false,
  });

  // 5) A11y micro-check — inputs
  const nameInput = dialog.locator('input').first();
  const pgnTextarea = dialog.locator('textarea').first();

  const nameInfo = await nameInput.evaluate((el) => {
    const i = el as HTMLInputElement;
    return {
      id: i.id || null,
      ariaLabel: i.getAttribute('aria-label'),
      ariaLabelledBy: i.getAttribute('aria-labelledby'),
      wrappedInLabel: !!i.closest('label'),
      placeholder: i.placeholder,
    };
  });
  const pgnInfo = await pgnTextarea.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    return {
      id: t.id || null,
      ariaLabel: t.getAttribute('aria-label'),
      ariaLabelledBy: t.getAttribute('aria-labelledby'),
      wrappedInLabel: !!t.closest('label'),
      outlineStyle: getComputedStyle(t).outlineStyle,
      // Focus-trigger then re-check outline
    };
  });

  console.log('NAME INPUT:', nameInfo);
  console.log('PGN TEXTAREA:', pgnInfo);

  // Tab focus through dialog, capture focus indicator on textarea
  await nameInput.focus();
  const nameFocusStyle = await nameInput.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
    };
  });
  console.log('NAME INPUT :focus styles:', nameFocusStyle);

  await pgnTextarea.focus();
  const pgnFocusStyle = await pgnTextarea.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
    };
  });
  console.log('PGN TEXTAREA :focus styles:', pgnFocusStyle);

  // Screenshot with PGN textarea focused — visible indicator?
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog-pgn-focus.png',
    fullPage: false,
  });

  // 6) Close button a11y
  const closeBtn = dialog
    .locator('button')
    .filter({ hasNot: page.locator(':scope:has-text("Cancel"),:scope:has-text("Import")') })
    .first();
  const closeInfo = await closeBtn.evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    textContent: (el.textContent || '').trim(),
  }));
  console.log('CLOSE BUTTON:', closeInfo);

  // 7) Form validation — try submitting empty (close dialog first to make sure clean state)
  await nameInput.fill('');
  await pgnTextarea.fill('');
  const importBtn = dialog.getByRole('button', { name: /import game/i });
  const importBtnDisabled = await importBtn.isDisabled();
  console.log('IMPORT BTN DISABLED (empty form):', importBtnDisabled);

  // 8) Mobile viewport snapshot
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog-mobile.png',
    fullPage: false,
  });

  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  console.log('MOBILE DIALOG BOX:', dialogBox, 'VIEWPORT:', viewport);

  // Cancel out
  await dialog.getByRole('button', { name: /cancel/i }).click();
  await expect(dialog).toBeHidden({ timeout: 3000 });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !/Failed to load resource/.test(e)),
  );

  // Don't fail on observations — we LOG them. We only fail if the page crashes.
  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
