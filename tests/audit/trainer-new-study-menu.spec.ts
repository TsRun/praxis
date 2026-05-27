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

test('trainer-new-study-menu: dropdown opens, three options visible, a11y + responsive', async ({
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

  // ---- Identify the New Study trigger by its id ----
  const trigger = page.locator('#new-study-trigger');
  await expect(trigger).toBeVisible();

  const triggerInfo = await trigger.evaluate((el) => ({
    text: el.textContent?.trim() ?? '',
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
  }));
  console.log('TRIGGER info (collapsed):', triggerInfo);
  expect(triggerInfo.ariaHaspopup).toBe('menu');
  expect(triggerInfo.ariaExpanded).toBe('false');

  // ---- Focus visibility on trigger ----
  await trigger.focus();
  await page.waitForTimeout(60);
  const triggerFocus = await trigger.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('TRIGGER :focus styles:', triggerFocus);

  // ---- Open the menu (click) ----
  await trigger.click();
  await page.waitForTimeout(120);

  const menu = page.locator('#new-study-menu');
  await expect(menu).toBeVisible();

  const expandedAfterOpen = await trigger.getAttribute('aria-expanded');
  console.log('aria-expanded after open:', expandedAfterOpen);
  expect(expandedAfterOpen).toBe('true');

  // ---- Menu meta ----
  const menuInfo = await menu.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('MENU info:', menuInfo);
  expect(menuInfo.role).toBe('menu');

  // ---- Menu items ----
  const items = menu.locator('[role="menuitem"]');
  await expect(items).toHaveCount(3);

  const itemMeta = await items.evaluateAll((nodes) =>
    nodes.map((n) => {
      const el = n as HTMLButtonElement;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        title: el.querySelector('div > div:first-child')?.textContent?.trim() ?? '',
        type: el.getAttribute('type'),
        tabIndex: el.tabIndex,
        bg: cs.backgroundColor,
        height: Math.round(r.height),
      };
    }),
  );
  console.log('MENU ITEMS:', itemMeta);
  const titles = itemMeta.map((i) => i.title);
  expect(titles).toContain('Opening study');
  expect(titles).toContain('Game study');
  expect(titles).toContain('Tactical set');

  // ---- Screenshot desktop open ----
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(120);
  const stillOpen = await menu.isVisible().catch(() => false);
  if (!stillOpen) {
    await trigger.click();
    await page.waitForTimeout(120);
  }
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-desktop-open.png',
    fullPage: false,
  });

  // ---- Hover state on first item ----
  const firstItem = menu.locator('[role="menuitem"]').first();
  await firstItem.hover();
  await page.waitForTimeout(80);
  const hoverBg = await firstItem.evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log('FIRST ITEM hover background:', hoverBg);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(80);
  const afterMouseOutBg = await firstItem.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  console.log('FIRST ITEM bg after mouseout:', afterMouseOutBg);

  // ---- Escape key should close (ARIA Authoring Practices) ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const menuCountAfterEsc = await page.locator('#new-study-menu').count();
  const expandedAfterEsc = await trigger.getAttribute('aria-expanded');
  const closesOnEsc = menuCountAfterEsc === 0 && expandedAfterEsc === 'false';
  console.log('CLOSES ON ESC:', closesOnEsc, '(menu count:', menuCountAfterEsc, 'aria-expanded:', expandedAfterEsc, ')');

  // ---- Re-open and probe keyboard navigation focus ----
  if (!closesOnEsc) {
    await page.locator('h1').first().click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(120);
  }
  await trigger.click();
  await page.waitForTimeout(120);

  const focusedAfterOpen = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return {
      tag: a.tagName,
      role: a.getAttribute('role'),
      text: (a.textContent || '').trim().slice(0, 40),
    };
  });
  console.log('FOCUSED after open:', focusedAfterOpen);

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(60);
  const focusedAfterArrow = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return {
      tag: a.tagName,
      role: a.getAttribute('role'),
      text: (a.textContent || '').trim().slice(0, 40),
    };
  });
  console.log('FOCUSED after ArrowDown:', focusedAfterArrow);

  // ---- Outside click closes ----
  await page.locator('h1').first().click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(150);
  const menuCountAfterOutside = await page.locator('#new-study-menu').count();
  console.log('MENU count after outside click:', menuCountAfterOutside);
  expect(menuCountAfterOutside).toBe(0);

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await trigger.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-mobile-closed.png',
    fullPage: false,
  });

  await trigger.click();
  await page.waitForTimeout(180);
  const menuMobile = await page.locator('#new-study-menu').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
      viewportWidth: window.innerWidth,
      overflowsLeft: r.left < 0,
      overflowsRight: r.right > window.innerWidth,
    };
  });
  console.log('MENU mobile rect:', menuMobile);
  expect(menuMobile.overflowsLeft).toBe(false);
  expect(menuMobile.overflowsRight).toBe(false);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-mobile-open.png',
    fullPage: false,
  });

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('DOC OVERFLOW (mobile):', overflow);

  // ---- Click an item dismisses the menu (Opening study triggers dialog) ----
  const openingItem = page.locator('[role="menuitem"]').filter({ hasText: 'Opening study' }).first();
  await openingItem.click();
  await page.waitForTimeout(300);
  const menuCountAfterItem = await page.locator('#new-study-menu').count();
  console.log('MENU count after item click:', menuCountAfterItem);
  expect(menuCountAfterItem).toBe(0);

  const dialogOpen = await page.locator('[role="dialog"], [aria-modal="true"]').count();
  console.log('DIALOG count after item click:', dialogOpen);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
