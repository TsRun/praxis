import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL ?? 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD ?? 'Claudebot';

test('signin-flow: valid credentials redirect to trainer workspace; UI checks', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const resp = await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);
  await page.waitForSelector('h1', { timeout: 15000 });

  // --- Inspect the form BEFORE submitting (UI quality) ---

  const emailInput = page.locator('input[type="email"]');
  const pwInput = page.locator('input[type="password"]');
  const submitBtn = page.getByRole('button', { name: /Sign in →/ });

  await expect(emailInput).toBeVisible();
  await expect(pwInput).toBeVisible();
  await expect(submitBtn).toBeVisible();

  // Are inputs and submit reachable in a sensible tab order? Walk from the form root.
  const tabOrder: string[] = [];
  await emailInput.focus();
  for (let i = 0; i < 6; i++) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const tag = el.tagName.toLowerCase();
      const id = el.id || '';
      const type = (el as HTMLInputElement).type || '';
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return `${tag}#${id}[${type}]:${txt}`;
    });
    if (focused) tabOrder.push(focused);
    await page.keyboard.press('Tab');
  }
  console.log('TAB ORDER from email:', tabOrder);

  // Submit-button focus ring + visual focus state
  await submitBtn.focus();
  await page.waitForTimeout(80);
  const submitFocus = await submitBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
    };
  });
  console.log('SUBMIT :focus styles:', submitFocus);

  // Submit-button hover state
  await submitBtn.hover();
  await page.waitForTimeout(80);
  const submitHover = await submitBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      transform: cs.transform,
    };
  });
  console.log('SUBMIT :hover styles:', submitHover);

  // Error region present & polite before any submit
  const errBox = page.locator('[role="alert"]');
  const errBoxBefore = await errBox.evaluate((el) => ({
    text: (el.textContent || '').trim(),
    ariaLive: el.getAttribute('aria-live'),
  }));
  console.log('ERR BOX initial:', errBoxBefore);

  // --- Negative path: empty submit ---
  // (Browser native validation should keep the form on /)
  await submitBtn.click();
  await page.waitForTimeout(150);
  const stillOnLanding = await page.evaluate(() => location.pathname);
  console.log('AFTER EMPTY SUBMIT path:', stillOnLanding);

  // --- Negative path: wrong password ---
  await emailInput.fill(EMAIL);
  await pwInput.fill('definitely-not-the-password');
  await submitBtn.click();
  // Wait for either the error to show or busy state to clear
  await page.waitForTimeout(2500);
  const wrongPwErr = await errBox.textContent();
  console.log('WRONG PW ERROR text:', (wrongPwErr || '').trim());

  // --- Positive path: real credentials ---
  await pwInput.fill('');
  await pwInput.fill(PASSWORD);

  // Spot the "Signing in…" busy label after click
  const submitClickP = submitBtn.click();
  // try to catch the transient busy text quickly
  const busyText = await Promise.race([
    page
      .getByRole('button', { name: /Signing in/ })
      .first()
      .waitFor({ state: 'visible', timeout: 800 })
      .then(() => 'saw-busy')
      .catch(() => 'no-busy'),
    page.waitForTimeout(900).then(() => 'timeout'),
  ]);
  await submitClickP;
  console.log('BUSY LABEL during signin:', busyText);

  // Expect navigation to /trainer (or /trainer/...) within a reasonable time.
  await page.waitForURL(/\/trainer(\/|$)/, { timeout: 15000 });
  const afterPath = await page.evaluate(() => location.pathname);
  console.log('AFTER SIGNIN path:', afterPath);

  // The trainer workspace should render its primary heading or a recognizable nav.
  // We're tolerant about exact text — assert *something* loaded and h1 exists.
  await page.waitForSelector('h1, h2', { timeout: 15000 });
  const headingText = await page
    .locator('h1, h2')
    .first()
    .textContent()
    .then((t) => (t || '').trim());
  console.log('LANDED heading:', headingText);

  // Desktop screenshot of signed-in workspace
  await page.screenshot({
    path: 'tests/audit/screenshots/signin-flow-after.png',
    fullPage: true,
  });

  // --- Mobile viewport (375x812): sign in flow form ---
  // Sign out first so we can see the form mobile
  await page.context().clearCookies();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(250);

  const mobileForm = await page.locator('form').first().boundingBox();
  console.log('MOBILE FORM BOX:', mobileForm);

  const mobileEmail = page.locator('input[type="email"]');
  const mobilePw = page.locator('input[type="password"]');
  const mobileSubmit = page.getByRole('button', { name: /Sign in →/ });
  const mobileEmailBox = await mobileEmail.boundingBox();
  const mobilePwBox = await mobilePw.boundingBox();
  const mobileSubmitBox = await mobileSubmit.boundingBox();
  console.log('MOBILE INPUT/BUTTON sizes:', {
    email: mobileEmailBox,
    pw: mobilePwBox,
    submit: mobileSubmitBox,
  });

  // Tap target check: WCAG 2.5.5 recommends ≥ 44px on touch; widely-cited mobile minimum.
  if (mobileSubmitBox && mobileSubmitBox.height < 36) {
    console.warn(`WARN: submit button height ${mobileSubmitBox.height}px is below 36px on mobile`);
  }
  if (mobileEmailBox && mobileEmailBox.height < 36) {
    console.warn(`WARN: email input height ${mobileEmailBox.height}px is below 36px on mobile`);
  }

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(`WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`);
  }

  await page.screenshot({
    path: 'tests/audit/screenshots/signin-flow-mobile.png',
    fullPage: true,
  });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
