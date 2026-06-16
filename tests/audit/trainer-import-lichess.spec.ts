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

test('trainer-import-lichess: dialog opens and exposes inputs', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.startsWith('Failed to load resource:')) return;
      consoleErrors.push(t);
    }
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  await page.goto(`${PROD_URL}/trainer/studies`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Studies/i }).first()).toBeVisible();

  // ---- Open "Import from Lichess" dialog ----
  await page.getByRole('button', { name: /Import from Lichess/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const dialogTitle = await dialog.locator('h2').first().innerText();
  console.log('DIALOG TITLE:', dialogTitle);
  expect(dialogTitle).toMatch(/Import from Lichess/i);

  const dialogAttrs = await dialog.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaModal: el.getAttribute('aria-modal'),
    ariaLabelledBy: el.getAttribute('aria-labelledby'),
  }));
  console.log('DIALOG A11Y:', dialogAttrs);
  expect(dialogAttrs.ariaModal).toBe('true');
  expect(dialogAttrs.ariaLabelledBy).toBeTruthy();

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-import-lichess.png',
    fullPage: true,
  });

  // ---- Name input — empty CTA disabled, filled CTA enabled ----
  const nameInput = dialog.locator('input.input').first();
  await expect(nameInput).toBeVisible();
  const cta = dialog.getByRole('button', { name: /Create \+ import PGN/i });
  await expect(cta).toBeVisible();
  expect(await cta.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(true);
  await nameInput.fill('Audit import test');
  expect(await cta.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false);

  // ---- Side picker — proper native radio group ----
  const radioGroup = dialog.locator('[role="radiogroup"]');
  await expect(radioGroup).toHaveCount(1);
  const radios = radioGroup.locator('input[type="radio"]');
  expect(await radios.count()).toBe(2);

  // Clicking the Black label flips React state; visible label paint follows.
  await dialog.locator('label').filter({ hasText: /^Black/i }).first().click();
  await page.waitForTimeout(150);
  const stateAfter = await page.evaluate(() => {
    const ins = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    return ins.map((i) => ({ value: i.value, checked: i.checked }));
  });
  console.log('RADIO state after Black click:', stateAfter);
  expect(stateAfter).toEqual([
    { value: 'w', checked: false },
    { value: 'b', checked: true },
  ]);
  const blackBg = await dialog.locator('label').filter({ hasText: /^Black/i }).first().evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const whiteBg = await dialog.locator('label').filter({ hasText: /^White/i }).first().evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  console.log('LABEL BG — Black:', blackBg, 'White:', whiteBg);
  // Picked label paints accent; unpicked paints inset. They must differ.
  expect(blackBg).not.toBe(whiteBg);

  // ---- Keyboard: Tab from name lands on the checked radio (b) ----
  await nameInput.focus();
  await page.keyboard.press('Tab');
  const tabbedTo = await page.evaluate(() => {
    const a = document.activeElement as HTMLInputElement | null;
    return a ? { tag: a.tagName, type: a.type, value: a.value, focusVisible: a.matches(':focus-visible') } : null;
  });
  console.log('TABBED-TO from name:', tabbedTo);
  expect(tabbedTo?.tag).toBe('INPUT');
  expect(tabbedTo?.focusVisible).toBe(true);
  const focusedLabelStyles = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const lab = a?.closest('label');
    if (!lab) return null;
    const cs = getComputedStyle(lab);
    return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  console.log('FOCUSED LABEL outline:', focusedLabelStyles);
  expect(focusedLabelStyles?.outlineStyle).toBe('solid');

  // ---- Close button on header (tap target ≥ 24px) ----
  const closeBtn = dialog.locator('button[aria-label="Close"]');
  await expect(closeBtn).toHaveCount(1);
  const closeBox = await closeBtn.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height) };
  });
  console.log('CLOSE BUTTON BOX:', closeBox);
  expect(closeBox.width).toBeGreaterThanOrEqual(24);
  expect(closeBox.height).toBeGreaterThanOrEqual(24);

  // ---- Escape closes ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await page.getByRole('dialog').count()).toBe(0);

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Import from Lichess/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-import-lichess-mobile.png',
    fullPage: true,
  });

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

  const mobileSideBoxes: Array<{ w: number; h: number }> = [];
  for (const l of await page.locator('[role="radiogroup"] label').all()) {
    mobileSideBoxes.push(await l.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }));
  }
  console.log('MOBILE SIDE LABEL RECTS:', mobileSideBoxes);
  // Sides should be tappable (>= 44 px on shortest dimension)
  for (const b of mobileSideBoxes) {
    expect(Math.min(b.w, b.h)).toBeGreaterThanOrEqual(44);
  }

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
