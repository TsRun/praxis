import { test, expect, type Page } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

async function signIn(page: Page) {
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').filter({ hasText: 'Continue with Google' });
  await form.getByPlaceholder('you@studio.club').fill(EMAIL);
  await form.getByPlaceholder(/password/i).fill(PASSWORD);
  await form.getByRole('button', { name: /^Sign in →$/ }).click();
  await page.waitForURL(/\/(trainer|student)\//, { timeout: 15000 });
}

test('trainer-games-free-editor: palette, controls, mobile', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/trainer/games`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^Browse games$/ })).toBeVisible();

  // Enable the position filter — gates the Free editor tab.
  const posCheck = page.locator('label', {
    hasText: /Find games passing through this position/,
  }).locator('input[type="checkbox"]');
  await expect(posCheck).toBeVisible();
  await posCheck.check();
  await page.waitForTimeout(150);

  // Click "Free editor" tab.
  const freeTab = page.getByRole('button', { name: /^Free editor$/ });
  await expect(freeTab).toBeVisible();
  await freeTab.click();
  await page.waitForTimeout(200);

  // Aria-pressed on the Free editor tab — Segmented should mark it active.
  const freeTabInfo = await freeTab.evaluate((el: HTMLButtonElement) => ({
    ariaPressed: el.getAttribute('aria-pressed'),
    active: el.classList.contains('active'),
    text: (el.textContent || '').trim(),
  }));
  console.log('FREE EDITOR TAB:', freeTabInfo);

  // The position-mode Segmented container a11y.
  const segContainers = page.locator('.segmented');
  const posSeg = segContainers.last();
  const posSegInfo = await posSeg.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('POSITION MODE SEGMENTED a11y:', posSegInfo);

  // Palette buttons — six pieces × 2 colours + erase = 13 buttons.
  // Match either old single-letter labels ("White k") or new word labels
  // ("White king") so this passes against both pre- and post-deploy prod.
  const pieceMatchers = [
    /^White (k|king)$/, /^White (q|queen)$/, /^White (r|rook)$/,
    /^White (b|bishop)$/, /^White (n|knight)$/, /^White (p|pawn)$/,
    /^Black (k|king)$/, /^Black (q|queen)$/, /^Black (r|rook)$/,
    /^Black (b|bishop)$/, /^Black (n|knight)$/, /^Black (p|pawn)$/,
  ];
  for (const re of pieceMatchers) {
    await expect(page.getByRole('button', { name: re })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^Erase$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Starting position$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Empty board$/ })).toBeVisible();

  // Side-to-move radios — scoped to the "Side to move" group (avoid the
  // unrelated Color filter group higher up that also has White/Black radios).
  const sideToMoveLabel = page.locator('text=/^Side to move$/');
  await expect(sideToMoveLabel).toBeVisible();
  const sideToMoveRow = sideToMoveLabel.locator('xpath=..');
  const whiteRadio = sideToMoveRow.locator('label', { hasText: /^White$/ }).locator('input[type="radio"]');
  const blackRadio = sideToMoveRow.locator('label', { hasText: /^Black$/ }).locator('input[type="radio"]');
  await expect(whiteRadio).toBeVisible();
  await expect(blackRadio).toBeVisible();

  // Picking a piece: aria-pressed should flip.
  const whiteQueen = page.getByRole('button', { name: /^White (q|queen)$/ });
  const queenBefore = await whiteQueen.evaluate((el: HTMLButtonElement) => ({
    ariaPressed: el.getAttribute('aria-pressed'),
    bg: getComputedStyle(el).backgroundColor,
    borderColor: getComputedStyle(el).borderColor,
  }));
  await whiteQueen.click();
  await page.waitForTimeout(80);
  const queenAfter = await whiteQueen.evaluate((el: HTMLButtonElement) => ({
    ariaPressed: el.getAttribute('aria-pressed'),
    bg: getComputedStyle(el).backgroundColor,
    borderColor: getComputedStyle(el).borderColor,
  }));
  console.log('WHITE QUEEN before/after pick:', queenBefore, '→', queenAfter);

  // Focus the white queen button — see if focus indicator appears.
  await whiteQueen.focus();
  await page.waitForTimeout(80);
  const queenFocus = await whiteQueen.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('WHITE QUEEN :focus styles:', queenFocus);

  // Tab to "Empty board" and click — does the board clear (FEN should reflect)?
  const fenLine = page.locator('text=/^Filter FEN:/');
  const fenBefore = (await fenLine.textContent()) ?? '';
  await page.getByRole('button', { name: /^Empty board$/ }).click();
  await page.waitForTimeout(120);
  const fenAfter = (await fenLine.textContent()) ?? '';
  console.log('FEN before empty:', fenBefore.slice(0, 100));
  console.log('FEN after empty: ', fenAfter.slice(0, 100));

  // Starting position resets.
  await page.getByRole('button', { name: /^Starting position$/ }).click();
  await page.waitForTimeout(120);
  const fenReset = (await fenLine.textContent()) ?? '';
  console.log('FEN after starting position:', fenReset.slice(0, 100));

  // Erase button on the palette — also focus check.
  const eraseBtn = page.getByRole('button', { name: /^Erase$/ });
  await eraseBtn.focus();
  await page.waitForTimeout(80);
  const eraseFocus = await eraseBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('ERASE :focus styles:', eraseFocus);

  // Erase button a11y — aria-pressed?
  const eraseInfo = await eraseBtn.evaluate((el: HTMLButtonElement) => ({
    ariaPressed: el.getAttribute('aria-pressed'),
    ariaLabel: el.getAttribute('aria-label'),
    title: el.getAttribute('title'),
    type: el.type,
  }));
  console.log('ERASE BUTTON a11y:', eraseInfo);

  // Radio a11y — does the "White" label wrap the radio?
  const whiteRadioInfo = await whiteRadio.evaluate((el: HTMLInputElement) => {
    const lbl = el.closest('label');
    return {
      hasWrappingLabel: !!lbl,
      labelText: lbl?.textContent?.trim() ?? null,
      id: el.id || null,
      name: el.name || null,
      ariaLabel: el.getAttribute('aria-label'),
    };
  });
  console.log('WHITE RADIO a11y:', whiteRadioInfo);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-games-free-editor.png',
    fullPage: true,
  });

  // Desktop overflow snapshot.
  const desktopOverflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('DESKTOP OVERFLOW:', desktopOverflow);

  // ---- Mobile viewport check (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(250);

  const mobileOverflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', mobileOverflow);

  // Bounding boxes for the palette rows + board on mobile — check no clipping.
  const whitePawnBox = await page.getByRole('button', { name: /^White (p|pawn)$/ }).boundingBox();
  const blackPawnBox = await page.getByRole('button', { name: /^Black (p|pawn)$/ }).boundingBox();
  console.log('MOBILE WHITE PAWN BOX:', whitePawnBox);
  console.log('MOBILE BLACK PAWN BOX:', blackPawnBox);

  const startBtnBox = await page.getByRole('button', { name: /^Starting position$/ }).boundingBox();
  const emptyBtnBox = await page.getByRole('button', { name: /^Empty board$/ }).boundingBox();
  console.log('MOBILE START BTN BOX:', startBtnBox);
  console.log('MOBILE EMPTY BTN BOX:', emptyBtnBox);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-games-free-editor-mobile.png',
    fullPage: true,
  });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
