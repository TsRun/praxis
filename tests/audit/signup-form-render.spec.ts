import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';

test('signup-form-render: Create account mode shows name, email, password, role picker — UI/a11y', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const resp = await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });

  const signupTab = page.getByRole('button', { name: /^Create account$/ });
  await expect(signupTab).toBeVisible();
  await signupTab.click();
  await page.waitForTimeout(200);

  // After mode switch, signup tab should be aria-pressed="true"
  const tabPressed = await signupTab.getAttribute('aria-pressed');
  console.log('SIGNUP TAB aria-pressed:', tabPressed);

  // Email input
  const emailInput = page.locator('input[placeholder="you@studio.club"]');
  await expect(emailInput).toBeVisible();

  // Nickname input (only shown in signup mode)
  const nameInput = page.locator('input[placeholder="e.g. tactical_torre"]');
  await expect(nameInput).toBeVisible();

  // Password input — placeholder changes to "at least 8 characters"
  const pwInput = page.locator('input[placeholder="at least 8 characters"]');
  await expect(pwInput).toBeVisible();

  // Role picker buttons — Trainer / Student / Solo
  const roleButtons = page.locator('div.grid-3 > button[type="button"]');
  const roleCount = await roleButtons.count();
  console.log('ROLE BUTTON COUNT:', roleCount);
  expect(roleCount).toBe(3);

  const roleInfo = await roleButtons.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        cursor: cs.cursor,
        bg: cs.backgroundColor,
        color: cs.color,
        borderColor: cs.borderColor,
      };
    }),
  );
  console.log('ROLE PICKER BUTTONS:', roleInfo);

  // Trainer should be aria-pressed=true by default; Student and Solo false
  const trainerBtn = roleButtons.nth(0);
  const studentBtn = roleButtons.nth(1);
  const soloBtn = roleButtons.nth(2);
  expect(await trainerBtn.getAttribute('aria-pressed')).toBe('true');
  expect(await studentBtn.getAttribute('aria-pressed')).toBe('false');
  expect(await soloBtn.getAttribute('aria-pressed')).toBe('false');

  // Toggle Solo on, then off — make sure the multi-select works
  await soloBtn.click();
  await page.waitForTimeout(80);
  expect(await soloBtn.getAttribute('aria-pressed')).toBe('true');
  await soloBtn.click();
  await page.waitForTimeout(80);
  expect(await soloBtn.getAttribute('aria-pressed')).toBe('false');

  // Submit button label changes to "Create account →"
  const submitBtn = page.getByRole('button', { name: /^Create account →$/ });
  await expect(submitBtn).toBeVisible();
  const submitInfo = await submitBtn.evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement);
    const rect = (el as HTMLElement).getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      bg: cs.backgroundColor,
      color: cs.color,
      cursor: cs.cursor,
      disabled: (el as HTMLButtonElement).disabled,
    };
  });
  console.log('SUBMIT BUTTON:', submitInfo);

  // ---- Label / a11y micro-check ----
  for (const [label, locator] of [
    ['email', emailInput],
    ['name', nameInput],
    ['password', pwInput],
  ] as const) {
    const info = await locator.evaluate((el: HTMLInputElement) => {
      const id = el.id || null;
      const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
      return {
        id,
        labelsFor,
        type: el.type,
        autoComplete: el.autocomplete,
        readOnly: el.readOnly,
      };
    });
    console.log(`${label.toUpperCase()} INPUT a11y:`, info);
    // Each input must have a <label for="..."> associated
    expect(info.labelsFor).toBeGreaterThan(0);
  }

  // ---- Empty-form validation: clicking Submit with everything blank ----
  await submitBtn.click();
  await page.waitForTimeout(400);

  // After clicking submit with empty fields, do we get any user-visible feedback?
  const errLive = page.locator('div[role="alert"][aria-live="polite"]');
  const errText = (await errLive.textContent())?.trim() ?? '';
  const emailValidity = await emailInput.evaluate(
    (el: HTMLInputElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
      validationMessage: el.validationMessage,
    }),
  );
  const nameValidity = await nameInput.evaluate(
    (el: HTMLInputElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
      required: el.required,
    }),
  );
  const pwValidity = await pwInput.evaluate(
    (el: HTMLInputElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
      required: el.required,
    }),
  );
  console.log('AFTER EMPTY SUBMIT — errText:', JSON.stringify(errText));
  console.log('AFTER EMPTY SUBMIT — email validity:', emailValidity);
  console.log('AFTER EMPTY SUBMIT — name validity:', nameValidity);
  console.log('AFTER EMPTY SUBMIT — password validity:', pwValidity);

  // ---- Submit "terms / privacy" fineprint links ----
  const fineprintLinks = page.locator('.meta a.link');
  const fineprintCount = await fineprintLinks.count();
  const fineprintInfo = await fineprintLinks.evaluateAll((nodes) =>
    nodes.map((a) => {
      const el = a as HTMLAnchorElement;
      return { text: el.textContent?.trim() ?? '', href: el.getAttribute('href') };
    }),
  );
  console.log('FINEPRINT LINKS:', fineprintCount, fineprintInfo);

  // ---- Focus styles ----
  await emailInput.focus();
  await page.waitForTimeout(100);
  const emailFocus = await emailInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('EMAIL :focus styles:', emailFocus);

  await trainerBtn.focus();
  await page.waitForTimeout(100);
  const roleFocus = await trainerBtn.evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('TRAINER role :focus styles:', roleFocus);

  // Desktop screenshot
  await page.screenshot({
    path: 'tests/audit/screenshots/signup-form-render.png',
    fullPage: true,
  });

  // ---- Mobile viewport (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);

  // Form still in Create account mode after viewport change?
  const stillSignup = await signupTab.getAttribute('aria-pressed');
  console.log('MOBILE: signup tab still pressed?', stillSignup);

  // Role buttons at mobile width — measure size and tap target
  const mobileRoleInfo = await roleButtons.evaluateAll((nodes) =>
    nodes.map((b) => {
      const rect = (b as HTMLElement).getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    }),
  );
  console.log('MOBILE ROLE BUTTON SIZES:', mobileRoleInfo);

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(`WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`);
  }

  await page.screenshot({
    path: 'tests/audit/screenshots/signup-form-render-mobile.png',
    fullPage: true,
  });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );
  expect(pageErrors).toEqual([]);
});
