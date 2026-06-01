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

test('settings-api-key-create: opens dialog, mints key, copies, closes', async ({ page, context }) => {
  // Grant clipboard for the Copy button.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/settings`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: /^API keys$/ })).toBeVisible();

  // --- "New key" button observations
  const newKeyBtn = page.getByRole('button', { name: /New key/i }).first();
  const newKeyInfo = await newKeyBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim() ?? '',
      ariaLabel: el.getAttribute('aria-label'),
      type: (el as HTMLButtonElement).type,
      width: Math.round(box.width),
      height: Math.round(box.height),
      fontSize: cs.fontSize,
      color: cs.color,
      bg: cs.backgroundColor,
    };
  });
  console.log('NEW KEY BUTTON:', newKeyInfo);

  await newKeyBtn.click();

  // --- Dialog open
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  const dialogInfo = await dialog.evaluate((el) => ({
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
    ariaModal: el.getAttribute('aria-modal'),
    role: el.getAttribute('role'),
  }));
  console.log('DIALOG attrs:', dialogInfo);

  // Title should read "New API key"
  await expect(dialog.getByRole('heading', { name: /New API key/i })).toBeVisible();

  // Input — label "Label", placeholder "e.g. Claude Code MCP"
  const input = dialog.locator('input').first();
  const inputInfo = await input.evaluate((el) => {
    const i = el as HTMLInputElement;
    const wrappingLabel = i.closest('label');
    return {
      type: i.type,
      placeholder: i.placeholder,
      id: i.id || null,
      ariaLabel: i.getAttribute('aria-label'),
      ariaLabelledby: i.getAttribute('aria-labelledby'),
      ariaDescribedby: i.getAttribute('aria-describedby'),
      required: i.required,
      ariaRequired: i.getAttribute('aria-required'),
      autoFocused: document.activeElement === i,
      wrappingLabelText: wrappingLabel?.textContent?.trim()?.slice(0, 40) ?? null,
      wrappingLabelHasFor: wrappingLabel?.hasAttribute('for') ?? false,
    };
  });
  console.log('NEW-KEY INPUT a11y:', inputInfo);

  // Mint button — should be DISABLED when input is empty
  const mintBtn = dialog.getByRole('button', { name: /^Mint key$/ });
  const mintDisabledEmpty = await mintBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  console.log('MINT BTN disabled (empty input)?', mintDisabledEmpty);
  const mintBtnStyle = await mintBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { cursor: cs.cursor, opacity: cs.opacity, bg: cs.backgroundColor };
  });
  console.log('MINT BTN style:', mintBtnStyle);

  // Cancel button
  const cancelBtn = dialog.getByRole('button', { name: /^Cancel$/ });
  await expect(cancelBtn).toBeVisible();

  // Close (X) button
  const closeBtn = dialog.getByRole('button', { name: /^Close$/ });
  await expect(closeBtn).toBeVisible();

  // --- Test: whitespace-only input keeps Mint disabled
  await input.fill('   ');
  await page.waitForTimeout(60);
  const mintDisabledSpaces = await mintBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  console.log('MINT BTN disabled (whitespace only)?', mintDisabledSpaces);

  // --- Fill name + submit
  const stamp = Date.now();
  const newName = `audit-${stamp}`;
  await input.fill(newName);
  await page.waitForTimeout(60);
  const mintEnabled = await mintBtn.evaluate(
    (el) => !(el as HTMLButtonElement).disabled,
  );
  console.log('MINT BTN enabled (with name)?', mintEnabled);

  // Desktop screenshot of open dialog
  await page.screenshot({
    path: 'tests/audit/screenshots/settings-api-key-create-dialog.png',
    fullPage: true,
  });

  // Submit -> minted dialog
  await mintBtn.click();

  // Minted dialog should show: title "Key minted: <name>", monospace token, Copy/Done
  const mintedDialog = page.locator('[role="dialog"]');
  await expect(mintedDialog.getByRole('heading', { name: new RegExp(`Key minted: ${newName}`) })).toBeVisible({ timeout: 10000 });

  // Token: try to grab the mono element under the heading
  const tokenText = await mintedDialog.locator('.mono').first().textContent();
  const tokenLen = (tokenText ?? '').trim().length;
  console.log('TOKEN length:', tokenLen);
  expect(tokenLen).toBeGreaterThan(10);

  // Copy + Done buttons
  const copyBtn = mintedDialog.getByRole('button', { name: /^Copy$/ });
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  await expect(mintedDialog.getByRole('button', { name: /^Copied$/ })).toBeVisible({ timeout: 3000 });

  // Verify clipboard contains a real token
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  console.log('CLIPBOARD length:', clipboard.length);
  expect(clipboard.length).toBeGreaterThan(10);

  // Close minted dialog with Done
  await mintedDialog.getByRole('button', { name: /^Done$/ }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  // --- New key should appear in the list
  const keyRow = page.locator('text=' + newName).first();
  await expect(keyRow).toBeVisible({ timeout: 5000 });

  // Find the matching revoke button by aria-label
  const revokeBtn = page.locator(`button[aria-label="Revoke key \\"${newName}\\""]`);
  await expect(revokeBtn).toBeVisible();
  const revokeInfo = await revokeBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      title: el.getAttribute('title'),
      ariaLabel: el.getAttribute('aria-label'),
      width: Math.round(box.width),
      height: Math.round(box.height),
      color: cs.color,
    };
  });
  console.log('REVOKE BUTTON:', revokeInfo);

  // Cleanup: revoke our minted key
  await revokeBtn.click();
  const confirm = page.locator('[role="dialog"]');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /^Revoke$/ }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.locator(`button[aria-label="Revoke key \\"${newName}\\""]`)).toHaveCount(0);

  // --- Mobile pass at 375x812 — re-open the create dialog and inspect
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /New key/i }).first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  const mobileOverflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE PAGE OVERFLOW:', mobileOverflow);

  const dialogBoxMobile = await page.locator('[role="dialog"]').boundingBox();
  console.log('MOBILE DIALOG BOX:', dialogBoxMobile);

  await page.screenshot({
    path: 'tests/audit/screenshots/settings-api-key-create-dialog-mobile.png',
    fullPage: true,
  });

  // Buttons row inside dialog on mobile
  const dialogButtons = await page.locator('[role="dialog"] button').evaluateAll((nodes) =>
    nodes.map((b) => ({
      text: (b as HTMLButtonElement).textContent?.trim()?.slice(0, 20) ?? '',
      w: Math.round((b as HTMLElement).getBoundingClientRect().width),
      h: Math.round((b as HTMLElement).getBoundingClientRect().height),
    })),
  );
  console.log('MOBILE DIALOG BUTTONS:', dialogButtons);

  // Cancel out of mobile dialog
  await page.locator('[role="dialog"]').getByRole('button', { name: /^Cancel$/ }).click();

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
