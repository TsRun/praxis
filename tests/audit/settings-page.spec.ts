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

test('settings-page: renders four sections with a11y micro-check', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/settings`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^Settings$/ })).toBeVisible();

  // All four section headings
  await expect(page.getByRole('heading', { name: /^Profile$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Roles$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Password$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^API keys$/ })).toBeVisible();

  // Desktop screenshot
  await page.screenshot({
    path: 'tests/audit/screenshots/settings-page.png',
    fullPage: true,
  });

  // ---- A11y micro-check on actually-rendered elements ----

  // Profile inputs: nickname + email — are they programmatically labelled?
  const profileInputs = await page.locator('form').first().locator('input').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const id = el.id || null;
      const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
      const wrappingLabel = el.closest('label');
      const wrappingLabelText = wrappingLabel?.textContent?.trim() ?? null;
      const wrappingLabelHasFor = wrappingLabel?.hasAttribute('for') ?? false;
      return {
        type: el.type,
        autocomplete: el.autocomplete,
        id,
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        ariaRequired: el.getAttribute('aria-required'),
        required: el.required,
        labelsFor,
        wrappingLabelText: wrappingLabelText?.slice(0, 40) ?? null,
        wrappingLabelHasFor,
      };
    }),
  );
  console.log('PROFILE INPUTS a11y:', JSON.stringify(profileInputs, null, 2));

  // Roles buttons: Trainer / Student / Solo — toggle state?
  // They live in a .grid-3 container.
  const rolesGrid = page.locator('.grid-3').first();
  const rolesGridInfo = await rolesGrid.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('ROLES GRID container:', rolesGridInfo);

  const rolesButtons = rolesGrid.locator('button');
  const rolesCount = await rolesButtons.count();
  const rolesInfo = await rolesButtons.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      return {
        text: el.textContent?.trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
      };
    }),
  );
  console.log('ROLES BUTTONS (' + rolesCount + '):', JSON.stringify(rolesInfo, null, 2));

  // Password inputs (3): also wrapped in <label>?
  const passwordInputs = await page.locator('input[type="password"]').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const id = el.id || null;
      const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
      const wrappingLabel = el.closest('label');
      const wrappingLabelText = wrappingLabel?.textContent?.trim() ?? null;
      const wrappingLabelHasFor = wrappingLabel?.hasAttribute('for') ?? false;
      return {
        autocomplete: el.autocomplete,
        id,
        ariaLabel: el.getAttribute('aria-label'),
        labelsFor,
        wrappingLabelText: wrappingLabelText?.slice(0, 40) ?? null,
        wrappingLabelHasFor,
      };
    }),
  );
  console.log('PASSWORD INPUTS a11y:', JSON.stringify(passwordInputs, null, 2));

  // Trash / "Revoke key" icon button on each API key row — icon-only?
  const trashBtns = page.locator('button[title="Revoke key"]');
  const trashCount = await trashBtns.count();
  if (trashCount > 0) {
    const trashInfo = await trashBtns.first().evaluate((el) => ({
      title: el.getAttribute('title'),
      ariaLabel: el.getAttribute('aria-label'),
      textContent: el.textContent?.trim() ?? '',
      hasOnlySvg: el.children.length === 1 && el.firstElementChild?.tagName.toLowerCase() === 'svg',
    }));
    console.log('REVOKE BUTTON (count=' + trashCount + '):', trashInfo);
  } else {
    console.log('REVOKE BUTTON: no keys rendered');
  }

  // "New key" button — has icon + text, just sanity check
  const newKeyBtn = page.getByRole('button', { name: /New key/i });
  const newKeyInfo = await newKeyBtn.first().evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    textContent: el.textContent?.trim() ?? '',
  }));
  console.log('NEW KEY BUTTON:', newKeyInfo);

  // Focus styles on the first input
  const firstInput = page.locator('input').first();
  await firstInput.focus();
  await page.waitForTimeout(80);
  const focusStyles = await firstInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow.slice(0, 80),
      borderColor: cs.borderColor,
    };
  });
  console.log('FIRST INPUT :focus styles:', focusStyles);

  // Tab from the first input — where do we go?
  await page.keyboard.press('Tab');
  const after1 = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    type: (document.activeElement as HTMLInputElement)?.type ?? null,
    text: document.activeElement?.textContent?.trim()?.slice(0, 40) ?? null,
  }));
  console.log('TAB FROM 1ST INPUT:', after1);

  // ---- Mobile viewport check (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/settings-page-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // Capture roles row box on mobile — are 3 buttons readable?
  const rolesBox = await rolesGrid.boundingBox().catch(() => null);
  console.log('MOBILE ROLES ROW BOX:', rolesBox);

  // Per-role-button width on mobile
  const rolesWidths = await rolesButtons.evaluateAll((nodes) =>
    nodes.map((b) => Math.round((b as HTMLElement).getBoundingClientRect().width)),
  );
  console.log('MOBILE ROLES BUTTON WIDTHS:', rolesWidths);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
