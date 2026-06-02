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

test('settings-page: four sections + a11y + mobile', async ({ page }) => {
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
  await expect(page.getByRole('heading', { level: 1, name: /^Settings$/ })).toBeVisible();

  // All four section headings
  await expect(page.getByRole('heading', { name: /^Profile$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Roles$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Password$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^API keys$/ })).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/settings-page.png',
    fullPage: true,
  });

  // ----- Profile a11y -----
  // Inputs are wrapped inside <label> (implicit association). Verify each input
  // is reachable by its label text via getByLabel.
  await expect(page.getByLabel('Nickname')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  const profileInputs = await page.locator('form').first().locator('input').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const id = el.id || null;
      const wrappingLabel = el.closest('label');
      return {
        type: el.type,
        autocomplete: el.autocomplete,
        id,
        ariaLabel: el.getAttribute('aria-label'),
        wrappingLabelText: wrappingLabel?.textContent?.trim() ?? null,
      };
    }),
  );
  console.log('PROFILE INPUTS a11y:', JSON.stringify(profileInputs, null, 2));

  // ----- Roles a11y -----
  // RolesCard wraps the three buttons in role="group" aria-label="Active roles".
  const rolesGroup = page.getByRole('group', { name: 'Active roles' });
  await expect(rolesGroup).toBeVisible();
  const rolesGroupInfo = await rolesGroup.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    displayMode: getComputedStyle(el as HTMLElement).display,
    gridTemplateColumns: getComputedStyle(el as HTMLElement).gridTemplateColumns,
  }));
  console.log('ROLES GROUP:', rolesGroupInfo);

  const roleBtns = rolesGroup.locator('button');
  const roleCount = await roleBtns.count();
  expect(roleCount).toBe(3);
  const rolesInfo = await roleBtns.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      return {
        text: el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
        type: el.type,
      };
    }),
  );
  console.log('ROLE BUTTONS:', rolesInfo);
  for (const r of rolesInfo) {
    expect(r.type).toBe('button');
    expect(r.ariaPressed === 'true' || r.ariaPressed === 'false').toBe(true);
  }

  // ----- Password inputs a11y -----
  await expect(page.getByLabel('Current password')).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm new password')).toBeVisible();
  const passwordInputs = await page.locator('input[type="password"]').evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLInputElement;
      const wrappingLabel = el.closest('label');
      return {
        autocomplete: el.autocomplete,
        id: el.id || null,
        ariaLabel: el.getAttribute('aria-label'),
        wrappingLabelText: wrappingLabel?.textContent?.trim() ?? null,
      };
    }),
  );
  console.log('PASSWORD INPUTS a11y:', JSON.stringify(passwordInputs, null, 2));
  expect(passwordInputs.length).toBe(3);

  // ----- "New key" button + revoke buttons -----
  const newKeyBtn = page.getByRole('button', { name: /^New key$/ });
  await expect(newKeyBtn).toBeVisible();
  const newKeyBox = await newKeyBtn.boundingBox();
  console.log('NEW KEY BUTTON BOX:', newKeyBox);
  expect(newKeyBox?.height ?? 0).toBeGreaterThan(20);

  // Revoke buttons (icon-only) MUST have aria-label
  const revokeBtns = page.locator('button[aria-label^="Revoke key"]');
  const revokeCount = await revokeBtns.count();
  console.log('REVOKE BUTTONS COUNT:', revokeCount);
  if (revokeCount > 0) {
    const firstRevoke = await revokeBtns.first().evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    console.log('FIRST REVOKE INFO:', firstRevoke);
    expect(firstRevoke.ariaLabel).toMatch(/^Revoke key /);
  }

  // ----- Focus styles on first input -----
  const nicknameInput = page.getByLabel('Nickname');
  await nicknameInput.focus();
  await page.waitForTimeout(80);
  const focusStyles = await nicknameInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow.slice(0, 100),
      borderColor: cs.borderColor,
    };
  });
  console.log('NICKNAME :focus styles:', focusStyles);
  const hasFocusIndicator =
    focusStyles.outlineStyle !== 'none' ||
    (focusStyles.boxShadow !== 'none' && focusStyles.boxShadow !== '');
  expect(hasFocusIndicator).toBe(true);

  // ----- Tab order -----
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    type: (document.activeElement as HTMLInputElement)?.type ?? null,
    autocomplete: (document.activeElement as HTMLInputElement)?.autocomplete ?? null,
  }));
  console.log('TAB AFTER NICKNAME:', afterTab);

  // ----- Save button disabled state when not dirty -----
  const profileForm = page.locator('form').first();
  const saveBtn = profileForm.getByRole('button', { name: /Save changes/i });
  const saveDisabled = await saveBtn.first().isDisabled();
  console.log('PROFILE SAVE BUTTON DISABLED (not dirty):', saveDisabled);
  expect(saveDisabled).toBe(true);

  // ----- Mobile viewport (375x812) -----
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
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);

  const rolesBox = await rolesGroup.boundingBox();
  const rolesWidths = await roleBtns.evaluateAll((nodes) =>
    nodes.map((b) => Math.round((b as HTMLElement).getBoundingClientRect().width)),
  );
  console.log('MOBILE ROLES BOX:', rolesBox);
  console.log('MOBILE ROLE BUTTON WIDTHS:', rolesWidths);
  for (const w of rolesWidths) {
    expect(w).toBeGreaterThan(60);
  }

  // API key rows on mobile: do they wrap acceptably? Inspect bounding boxes.
  const keyRowsCount = await page.locator('button[aria-label^="Revoke key"]').count();
  if (keyRowsCount > 0) {
    const rowOverflows = await page
      .locator('button[aria-label^="Revoke key"]')
      .evaluateAll((nodes) =>
        nodes.map((b) => {
          const row = (b as HTMLElement).parentElement!;
          return {
            scroll: row.scrollWidth,
            client: row.clientWidth,
          };
        }),
      );
    console.log('MOBILE API KEY ROW SIZES:', rowOverflows);
    for (const r of rowOverflows) {
      expect(r.scroll).toBeLessThanOrEqual(r.client + 1);
    }
  }

  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !/Failed to load resource/.test(e)),
  );

  expect(pageErrors).toEqual([]);
  const appErrs = consoleErrors.filter((e) => !/Failed to load resource/.test(e));
  expect(appErrs).toEqual([]);
});
