import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-new-game-study-dialog: UI/a11y audit', async ({ page }) => {
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
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer\/studies/, { timeout: 15000 });
  await page.waitForSelector('h1, h2', { timeout: 15000 });

  // ---- Open New study menu → Game study ----
  await page.getByRole('button', { name: /^new study$/i }).first().click();
  await page.getByRole('menuitem', { name: /game study/i }).first().click();

  const dialog = page.getByRole('dialog', { name: /new game study/i });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog.png',
    fullPage: false,
  });

  // ---- Name input a11y ----
  const nameInput = dialog.locator('#game-study-name');
  const nameInfo = await nameInput.evaluate((el) => {
    const i = el as HTMLInputElement;
    const associatedLabel = i.id
      ? document.querySelector(`label[for="${i.id}"]`)
      : null;
    return {
      id: i.id || null,
      ariaLabel: i.getAttribute('aria-label'),
      ariaRequired: i.getAttribute('aria-required'),
      required: i.required,
      placeholder: i.placeholder,
      autocomplete: i.getAttribute('autocomplete'),
      associatedLabelText: associatedLabel
        ? (associatedLabel.textContent || '').trim()
        : null,
    };
  });
  console.log('NAME INPUT:', nameInfo);

  await nameInput.focus();
  const nameFocus = await nameInput.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
    };
  });
  console.log('NAME INPUT :focus styles:', nameFocus);

  // ---- PGN textarea a11y ----
  const pgnArea = dialog.locator('#game-study-pgn');
  const pgnInfo = await pgnArea.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    const associatedLabel = t.id
      ? document.querySelector(`label[for="${t.id}"]`)
      : null;
    const describedBy = t.getAttribute('aria-describedby');
    const describedByEls = describedBy
      ? describedBy.split(/\s+/).map((id) => {
          const node = document.getElementById(id);
          return { id, found: !!node, text: node ? (node.textContent || '').trim() : null };
        })
      : [];
    return {
      id: t.id,
      ariaRequired: t.getAttribute('aria-required'),
      required: t.required,
      rows: t.rows,
      placeholderFirstLine: (t.placeholder || '').split('\n')[0],
      associatedLabelText: associatedLabel
        ? (associatedLabel.textContent || '').trim()
        : null,
      ariaDescribedBy: describedBy,
      describedByEls,
    };
  });
  console.log('PGN TEXTAREA:', pgnInfo);

  await pgnArea.focus();
  const pgnFocus = await pgnArea.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
      matchesFocus: el.matches(':focus'),
      matchesFocusVisible: el.matches(':focus-visible'),
      activeIsThis: document.activeElement === el,
    };
  });
  console.log('PGN TEXTAREA :focus styles:', pgnFocus);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog-pgn-focus.png',
    fullPage: false,
  });

  // ---- Submit button enablement matrix ----
  const submitBtn = dialog.getByRole('button', { name: /^import game$/i });
  await nameInput.fill('');
  await pgnArea.fill('');
  const disabledBoth = await submitBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  await nameInput.fill('Audit probe');
  const disabledOnlyName = await submitBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  await nameInput.fill('');
  await pgnArea.fill('1. e4 e5');
  const disabledOnlyPgn = await submitBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  await nameInput.fill('Audit probe');
  await pgnArea.fill('1. e4 e5');
  const disabledFilled = await submitBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  console.log(
    'SUBMIT disabled — both empty / only name / only pgn / both filled:',
    disabledBoth,
    disabledOnlyName,
    disabledOnlyPgn,
    disabledFilled,
  );

  // ---- Close (X) button in header ----
  const closeBtn = dialog.getByRole('button', { name: /^close$/i });
  const closeInfo = await closeBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      ariaLabel: el.getAttribute('aria-label'),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
  console.log('CLOSE BUTTON:', closeInfo);

  // ---- Title ----
  const titleInfo = await dialog
    .locator('h2.t-h2')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        text: (el.textContent || '').trim(),
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
      };
    })
    .catch(() => null);
  console.log('TITLE:', titleInfo);

  // ---- PGN help text ----
  const helpInfo = await dialog
    .locator('#game-study-pgn-help')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        color: s.color,
        fontSize: s.fontSize,
        text: (el.textContent || '').trim().slice(0, 80),
      };
    });
  console.log('PGN HELP:', helpInfo);

  // ---- Esc closes ----
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 3000 });

  // ---- Backdrop click closes ----
  await page.getByRole('button', { name: /^new study$/i }).first().click();
  await page.getByRole('menuitem', { name: /game study/i }).first().click();
  await expect(dialog).toBeVisible({ timeout: 5000 });
  const backdrop = page.locator('.modal-backdrop');
  await backdrop.evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: r.left + 4,
        clientY: r.top + 4,
      }),
    );
  });
  await expect(dialog).toBeHidden({ timeout: 3000 });

  // ---- Mobile pass ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /^new study$/i }).first().click();
  await page.getByRole('menuitem', { name: /game study/i }).first().click();
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-game-study-dialog-mobile.png',
    fullPage: false,
  });

  const dialogBoxMobile = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    };
  });
  console.log('MOBILE DIALOG BOX:', dialogBoxMobile, 'viewport 375x812');

  const importBoxMobile = await dialog
    .getByRole('button', { name: /^import game$/i })
    .boundingBox();
  const cancelBoxMobile = await dialog
    .getByRole('button', { name: /^cancel$/i })
    .boundingBox();
  console.log('MOBILE buttons — import:', importBoxMobile, 'cancel:', cancelBoxMobile);

  const pgnBoxMobile = await pgnArea.boundingBox();
  console.log('MOBILE PGN textarea box:', pgnBoxMobile);

  await dialog.getByRole('button', { name: /^cancel$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 3000 });

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);

  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
