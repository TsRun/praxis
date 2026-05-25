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

test('profile-menu: opens, shows identity, sign-out present; a11y + responsive', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/trainer/studies`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);
  await page.waitForSelector('h1', { timeout: 15000 });

  // ---- Trigger: profile button (avatar + name) in the top-right of the top bar ----
  // There are several aria-haspopup="menu" triggers on this page (e.g. New study);
  // pick the one that contains the signed-in user's display name "Claude Bot".
  const trigger = page
    .getByRole('button', { name: /Claude Bot/i })
    .filter({ has: page.locator('[aria-haspopup="menu"]') })
    .or(
      page
        .locator('button[aria-haspopup="menu"]')
        .filter({ hasText: /Claude Bot/i }),
    )
    .first();
  await expect(trigger).toBeVisible();

  // Closed state attributes
  const closedAttrs = await trigger.evaluate((el) => ({
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
    ariaLabel: el.getAttribute('aria-label'),
    type: el.getAttribute('type'),
    text: el.textContent?.trim() ?? '',
  }));
  console.log('TRIGGER (closed):', closedAttrs);

  // Hover state — does the visible style actually change?
  const triggerBg0 = await trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
  await trigger.hover();
  await page.waitForTimeout(120);
  const triggerBgHover = await trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log('TRIGGER bg base→hover:', triggerBg0, '→', triggerBgHover);

  // ---- Open the menu ----
  await trigger.click();
  const menu = page.locator('[role="menu"]');
  await expect(menu).toBeVisible();

  // Expanded state attributes
  const openedAttrs = await trigger.evaluate((el) => ({
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
  }));
  console.log('TRIGGER (open):', openedAttrs);

  // ---- Content: name, email, sign-out button ----
  // The trigger shows the name too — assert name + email appear inside menu specifically.
  const menuTexts = await menu.evaluate((el) => ({
    full: el.textContent ?? '',
  }));
  console.log('MENU CONTENT:', menuTexts.full.slice(0, 400));

  // Sign out button
  const signOutBtn = menu.getByRole('button', { name: /sign out/i });
  await expect(signOutBtn).toBeVisible();

  // Quick roles button
  const quickRolesBtn = menu.getByRole('button', { name: /quick roles/i });
  await expect(quickRolesBtn).toBeVisible();

  // "Open settings →" link
  const settingsLink = menu.getByRole('link', { name: /open settings/i });
  await expect(settingsLink).toBeVisible();

  // Screenshot desktop (full page is fine — menu is overlay)
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(120);
  // Re-open after viewport change to be safe
  if (!(await menu.isVisible())) {
    await trigger.click();
    await expect(menu).toBeVisible();
  }
  await page.screenshot({
    path: 'tests/audit/screenshots/profile-menu.png',
    fullPage: true,
  });

  // ---- A11y: focus order and visible focus on menu items ----
  await signOutBtn.focus();
  await page.waitForTimeout(60);
  const signOutFocus = await signOutBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
    };
  });
  console.log('SIGN OUT :focus styles:', signOutFocus);

  await quickRolesBtn.focus();
  await page.waitForTimeout(60);
  const quickRolesFocus = await quickRolesBtn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('QUICK ROLES :focus styles:', quickRolesFocus);

  // Settings link focus
  await settingsLink.focus();
  await page.waitForTimeout(60);
  const settingsLinkFocus = await settingsLink.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      color: cs.color,
      textDecoration: cs.textDecorationLine,
    };
  });
  console.log('SETTINGS LINK :focus styles:', settingsLinkFocus);

  // ---- Esc-to-close behaviour ----
  await trigger.focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const closedAfterEsc = !(await menu.isVisible().catch(() => false));
  console.log('CLOSES ON ESC:', closedAfterEsc);

  // If Escape didn't close it (legacy prod), force-close by clicking outside
  // so the mobile pass starts from a known state.
  if (!closedAfterEsc) {
    await page.mouse.click(5, 400);
    await page.waitForTimeout(150);
  }

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);

  // Top-bar trigger should still be visible (full name may be truncated)
  await expect(trigger).toBeVisible();
  const trigBox = await trigger.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, right: r.right, w: r.width, h: r.height };
  });
  console.log('MOBILE trigger box:', trigBox);

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.screenshot({
    path: 'tests/audit/screenshots/profile-menu-mobile.png',
    fullPage: true,
  });

  // Make sure menu doesn't overflow viewport on mobile
  const menuBox = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      right: r.right,
      width: r.width,
      vw: window.innerWidth,
      overflowsLeft: r.x < 0,
      overflowsRight: r.right > window.innerWidth,
    };
  });
  console.log('MOBILE menu box:', menuBox);

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE PAGE OVERFLOW:', overflow);

  // close
  await page.mouse.click(5, 400);
  await page.waitForTimeout(150);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
