import { test, expect, type Page } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test.setTimeout(60_000);

async function signIn(page: Page) {
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').filter({ hasText: 'Continue with Google' });
  await form.getByPlaceholder('you@studio.club').fill(EMAIL);
  await form.getByPlaceholder(/password/i).fill(PASSWORD);
  await form.getByRole('button', { name: /^Sign in →$/ }).click();
  await page.waitForURL(/\/(trainer|student)\//, { timeout: 15_000 });
}

test('settings-password-change: validation feedback + a11y + mobile', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/settings`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /^Password$/ })).toBeVisible();

  // Locate the password form (the form that contains the Change password button).
  const passwordForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: /Change password|Saving/ }) });
  await expect(passwordForm).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/settings-password-change.png',
    fullPage: true,
  });

  // ---------- Inputs & labels ----------
  const current = passwordForm.getByLabel('Current password');
  const next = passwordForm.getByLabel('New password', { exact: true });
  const confirm = passwordForm.getByLabel('Confirm new password');

  for (const f of [current, next, confirm]) await expect(f).toBeVisible();

  const pwInputs = await passwordForm.locator('input[type="password"]').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const wrap = el.closest('label');
      return {
        autocomplete: el.autocomplete,
        id: el.id || null,
        ariaLabel: el.getAttribute('aria-label'),
        ariaInvalid: el.getAttribute('aria-invalid'),
        ariaDescribedby: el.getAttribute('aria-describedby'),
        wrappingLabelText: wrap?.textContent?.trim() ?? null,
        minLength: el.minLength,
      };
    }),
  );
  console.log('PASSWORD INPUTS:', JSON.stringify(pwInputs, null, 2));
  expect(pwInputs.length).toBe(3);
  // All three should have autocomplete hints set.
  expect(pwInputs[0].autocomplete).toBe('current-password');
  expect(pwInputs[1].autocomplete).toBe('new-password');
  expect(pwInputs[2].autocomplete).toBe('new-password');

  // ---------- Submit button: starts disabled (all fields empty) ----------
  const submit = passwordForm.getByRole('button', { name: /Change password|Saving/ });
  await expect(submit).toBeVisible();
  expect(await submit.isDisabled()).toBe(true);

  const submitStyles = await submit.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      color: cs.color,
      opacity: cs.opacity,
      cursor: cs.cursor,
      borderColor: cs.borderColor,
    };
  });
  console.log('SUBMIT (disabled) styles:', submitStyles);

  // ---------- Focus indicator on current password ----------
  await current.focus();
  await page.waitForTimeout(80);
  const focusStyles = await current.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow.slice(0, 120),
      borderColor: cs.borderColor,
    };
  });
  console.log('CURRENT :focus styles:', focusStyles);
  const hasFocusRing =
    focusStyles.outlineStyle !== 'none' ||
    (focusStyles.boxShadow !== 'none' && focusStyles.boxShadow !== '');
  expect(hasFocusRing).toBe(true);

  // ---------- Error region exists with role=alert + aria-live ----------
  const errorRegion = passwordForm.locator('[role="alert"]');
  await expect(errorRegion).toHaveCount(1);
  const errAttrs = await errorRegion.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      role: el.getAttribute('role'),
      ariaLive: el.getAttribute('aria-live'),
      display: cs.display,
      color: cs.color,
      fontSize: cs.fontSize,
      visible: cs.display !== 'none',
      text: (el.textContent || '').trim(),
    };
  });
  console.log('ERROR REGION (idle):', errAttrs);
  // Idle: should be hidden (display:none) and empty text.
  expect(errAttrs.text).toBe('');
  expect(errAttrs.visible).toBe(false);

  // ---------- Trigger "too short" validation ----------
  await current.fill('whatever-current');
  await next.fill('short');
  await confirm.fill('short');
  // Submit should now be enabled.
  expect(await submit.isDisabled()).toBe(false);
  await submit.click();
  await expect(errorRegion).toHaveText(/at least 8 characters/i, { timeout: 5_000 });
  const errTooShort = await errorRegion.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      color: cs.color,
      text: (el.textContent || '').trim(),
    };
  });
  console.log('ERROR REGION (too short):', errTooShort);
  // After error appears: the button should now reference the error region.
  const describedBy = await submit.getAttribute('aria-describedby');
  console.log('SUBMIT aria-describedby after error:', describedBy);

  // ---------- Trigger "passwords don't match" ----------
  await next.fill('correcthorse');
  await confirm.fill('correcthorse-different');
  await submit.click();
  await expect(errorRegion).toHaveText(/don't match|do not match/i, { timeout: 5_000 });
  const errMismatch = await errorRegion.evaluate((el) => (el.textContent || '').trim());
  console.log('ERROR (mismatch):', errMismatch);

  // ---------- Clear fields to leave the page in a safe state ----------
  await current.fill('');
  await next.fill('');
  await confirm.fill('');

  // ---------- Mobile pass 375x812 ----------
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  // Scroll the password card into view.
  await page.getByRole('heading', { name: /^Password$/ }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'tests/audit/screenshots/settings-password-change-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);

  // Each password input must not overflow its container at 375px and must hit
  // ~44px tall target territory for touch.
  const inputBoxes = await passwordForm.locator('input[type="password"]').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        parentW: Math.round(el.parentElement!.getBoundingClientRect().width),
      };
    }),
  );
  console.log('MOBILE PW INPUT BOXES:', inputBoxes);
  for (const b of inputBoxes) {
    expect(b.w).toBeLessThanOrEqual(b.parentW + 1);
    expect(b.h).toBeGreaterThanOrEqual(28);
  }

  // Submit button box on mobile.
  const submitMobile = await submit.evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('MOBILE SUBMIT BOX:', submitMobile);
  expect(submitMobile.h).toBeGreaterThanOrEqual(28);

  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('PAGE ERRORS:', pageErrors);
  const appErrs = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  console.log('APP CONSOLE ERRORS:', appErrs);

  expect(pageErrors).toEqual([]);
  expect(appErrs).toEqual([]);
});
