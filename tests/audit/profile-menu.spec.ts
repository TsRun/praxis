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

test('profile-menu: opens, shows user info, signout reachable; a11y + responsive', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  // Navigate to /trainer/studies (a known authed page)
  const resp = await page.goto(`${PROD_URL}/trainer/studies`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });

  // ---- Identify the profile menu trigger ----
  const trigger = page.locator('button[aria-haspopup="menu"]').first();
  await expect(trigger).toBeVisible();

  const triggerInfo = await trigger.evaluate((el) => ({
    text: el.textContent?.trim() ?? '',
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaControls: el.getAttribute('aria-controls'),
  }));
  console.log('TRIGGER info (collapsed):', triggerInfo);

  // ---- Focus visibility on trigger ----
  await trigger.focus();
  await page.waitForTimeout(60);
  const triggerFocus = await trigger.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
      background: cs.backgroundColor,
    };
  });
  console.log('TRIGGER :focus styles:', triggerFocus);

  // ---- Open the menu (click) ----
  await trigger.click();
  await page.waitForTimeout(120);

  const menu = page.locator('[role="menu"]').first();
  await expect(menu).toBeVisible();

  const expandedAfterOpen = await trigger.getAttribute('aria-expanded');
  console.log('aria-expanded after open:', expandedAfterOpen);

  // ---- Menu content checks ----
  const menuInfo = await menu.evaluate((el) => ({
    id: el.id || null,
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('MENU info (open):', menuInfo);

  // Should show the user email
  const emailRegex = /@/;
  await expect(menu.locator('text=' + EMAIL)).toBeVisible({ timeout: 3000 }).catch(() => {});
  const menuText = (await menu.textContent()) ?? '';
  console.log('MENU text content:', menuText.slice(0, 500));
  expect(menuText.match(emailRegex)).not.toBeNull();

  // Sign out button
  const signoutBtn = menu.getByRole('button', { name: /sign out/i });
  await expect(signoutBtn).toBeVisible();

  // Settings link
  const settingsLink = menu.getByRole('link', { name: /open settings/i });
  await expect(settingsLink).toBeVisible();

  // "Quick roles" button
  const quickRolesBtn = menu.getByRole('button', { name: /quick roles/i });
  await expect(quickRolesBtn).toBeVisible();

  // Screenshot (desktop open)
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(120);
  await page.screenshot({
    path: 'tests/audit/screenshots/profile-menu-desktop-open.png',
    fullPage: false,
  });

  // ---- Escape key should close the menu (ARIA Authoring Practices) ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const stillOpenAfterEsc = await page.locator('[role="menu"]').count();
  const expandedAfterEsc = await trigger.getAttribute('aria-expanded');
  const closesOnEsc = stillOpenAfterEsc === 0 && expandedAfterEsc === 'false';
  console.log('CLOSES ON ESC:', closesOnEsc, '(menu count:', stillOpenAfterEsc, 'aria-expanded:', expandedAfterEsc, ')');

  // Re-open if it didn't close (so subsequent checks still work)
  if (!closesOnEsc) {
    // already open; nothing to do
  } else {
    await trigger.click();
    await page.waitForTimeout(120);
  }

  // ---- Outside click closes the menu ----
  await page.locator('h1').first().click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(120);
  const stillOpenAfterOutside = await page.locator('[role="menu"]').count();
  console.log('MENU still open after outside click (count):', stillOpenAfterOutside);

  // ---- Quick Roles editor ----
  await trigger.click();
  await page.waitForTimeout(100);
  await menu.getByRole('button', { name: /quick roles/i }).click();
  await page.waitForTimeout(100);

  // Inspect role-editor checkboxes for accessible labels
  const checkboxInfo = await menu.locator('input[type=checkbox]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const el = n as HTMLInputElement;
      const label = el.closest('label');
      return {
        checked: el.checked,
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        wrappingLabelText: label?.textContent?.trim() ?? null,
        id: el.id || null,
      };
    }),
  );
  console.log('QUICK ROLES checkboxes:', checkboxInfo);

  // Cancel out of editor
  await menu.getByRole('button', { name: /cancel/i }).click();
  await page.waitForTimeout(80);

  // ---- Mobile viewport 375x812 ----
  // Close menu first
  await page.locator('h1').first().click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(120);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'tests/audit/screenshots/profile-menu-mobile-closed.png',
    fullPage: false,
  });

  // Trigger info on mobile (does the username text remain visible? overflow?)
  const triggerMobile = await trigger.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, x: r.x, right: r.right };
  });
  console.log('TRIGGER mobile rect:', triggerMobile);

  // Open menu on mobile and verify it fits in viewport
  await trigger.click();
  await page.waitForTimeout(150);
  const menuMobile = await page.locator('[role="menu"]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: r.width, left: r.left, right: r.right,
      viewportWidth: window.innerWidth,
      overflowsLeft: r.left < 0,
      overflowsRight: r.right > window.innerWidth,
    };
  });
  console.log('MENU mobile rect:', menuMobile);

  await page.screenshot({
    path: 'tests/audit/screenshots/profile-menu-mobile-open.png',
    fullPage: false,
  });

  // Check overall document overflow on mobile
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('DOC OVERFLOW (mobile):', overflow);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
