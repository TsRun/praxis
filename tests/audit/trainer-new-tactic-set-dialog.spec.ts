import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-new-tactic-set-dialog: UI/a11y audit', async ({ page }) => {
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

  // ---- Open New study menu, pick Tactical set ----
  await page.getByRole('button', { name: /New study/i }).first().click();
  await page.getByText('Tactical set', { exact: false }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-tactic-set-dialog.png',
    fullPage: true,
  });

  // ---- Dialog title accessible name ----
  const dialogInfo = await dialog.evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
    role: el.getAttribute('role'),
  }));
  console.log('DIALOG ATTRS:', dialogInfo);

  // ---- Name input a11y ----
  const nameInput = dialog.locator('input.input').first();
  const nameInfo = await nameInput.evaluate((el) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    let labelFor = 0;
    if (id) labelFor = document.querySelectorAll(`label[for="${id}"]`).length;
    const wrappingLabel = el.closest('label');
    const wrappingLabelText = wrappingLabel ? (wrappingLabel.textContent || '').trim() : null;
    const placeholder = el.getAttribute('placeholder');
    const required = (el as HTMLInputElement).required;
    const ariaRequired = el.getAttribute('aria-required');
    const ariaInvalid = el.getAttribute('aria-invalid');
    const ariaDescribedby = el.getAttribute('aria-describedby');
    return {
      id,
      ariaLabel,
      ariaLabelledBy,
      labelFor,
      wrappingLabelText,
      placeholder,
      required,
      ariaRequired,
      ariaInvalid,
      ariaDescribedby,
    };
  });
  console.log('NAME INPUT a11y:', nameInfo);

  // Live region probe — does the dialog have anything that would announce
  // errors? (role=alert, aria-live, role=status)
  const liveRegions = await dialog.evaluate((el) => {
    const nodes = Array.from(
      el.querySelectorAll('[role="alert"], [role="status"], [aria-live]'),
    );
    return nodes.map((n) => ({
      tag: n.tagName,
      role: n.getAttribute('role'),
      ariaLive: n.getAttribute('aria-live'),
      text: (n.textContent || '').trim().slice(0, 60),
    }));
  });
  console.log('DIALOG LIVE REGIONS:', liveRegions);

  // ---- Name input focus indicator ----
  await nameInput.focus();
  const nameFocusStyles = await nameInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('NAME INPUT :focus styles:', nameFocusStyles);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-tactic-set-dialog-name-focus.png',
    fullPage: true,
  });

  // ---- Close (X) button on Dialog header ----
  const headerCloseBtn = dialog.locator('h2 + button').first();
  const closeInfo = await headerCloseBtn.evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    textContent: (el.textContent || '').trim(),
    tag: el.tagName,
  })).catch(() => null);
  console.log('CLOSE BUTTON:', closeInfo);

  // ---- Helper text legibility ----
  const helperInfo = await dialog.locator('p.meta').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || '').trim().slice(0, 80),
      color: cs.color,
      fontSize: cs.fontSize,
    };
  }).catch(() => null);
  console.log('HELPER META:', helperInfo);

  // ---- Form validation ----
  await nameInput.fill('');
  const createBtn = dialog.getByRole('button', { name: /Create set/i }).first();
  const createDisabledEmpty = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CREATE BTN DISABLED (empty name):', createDisabledEmpty);

  await nameInput.fill('Audit probe — tactics');
  const createDisabledFilled = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CREATE BTN DISABLED (filled name):', createDisabledFilled);

  // ---- Keyboard tab order ----
  await nameInput.focus();
  await page.keyboard.press('Tab');
  const tabAfterName = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    return {
      tag: a.tagName,
      text: (a.textContent || '').trim().slice(0, 40),
      matchesFocusVisible: a.matches(':focus-visible'),
    };
  });
  console.log('TAB after name input:', tabAfterName);
  await page.keyboard.press('Tab');
  const tab2 = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    return {
      tag: a.tagName,
      text: (a.textContent || '').trim().slice(0, 40),
      matchesFocusVisible: a.matches(':focus-visible'),
    };
  });
  console.log('TAB 2:', tab2);
  await page.keyboard.press('Tab');
  const tab3 = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    return {
      tag: a.tagName,
      text: (a.textContent || '').trim().slice(0, 40),
      matchesFocusVisible: a.matches(':focus-visible'),
    };
  });
  console.log('TAB 3:', tab3);

  // ---- Mobile viewport ----
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-tactic-set-dialog-mobile-page.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: /New study/i }).first().click();
  await page.getByText('Tactical set', { exact: false }).first().click();
  const mobileDialog = page.getByRole('dialog');
  await expect(mobileDialog).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-tactic-set-dialog-mobile.png',
    fullPage: true,
  });

  const mobileDialogBox = await mobileDialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
    };
  });
  console.log('MOBILE DIALOG BOX:', mobileDialogBox, 'viewport 375');

  const mobileScroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log('MOBILE PAGE SCROLL:', mobileScroll);

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);

  expect(pageErrors).toEqual([]);
});
