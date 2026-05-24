import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROD_URL = 'https://praxis.tsrun.dev';
const AUTH_FILE = path.join(process.cwd(), '.auth/bot.json');

async function login(page: import('@playwright/test').Page) {
  const email = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
  const password = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').filter({ hasText: 'Continue with Google' });
  await form.getByPlaceholder('you@studio.club').fill(email);
  await form.getByPlaceholder(/password/i).fill(password);
  await form.getByRole('button', { name: /^Sign in →$/ }).click();
  await page.waitForURL(/\/(trainer|student)\//, { timeout: 15000 });
}

test('trainer-new-study-menu: dropdown opens with three options, a11y micro-check', async ({ page, context }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Auth: reuse if available
  if (fs.existsSync(AUTH_FILE)) {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    await context.addCookies(state.cookies || []);
  }

  // Always login fresh — token TTL on prod is short, stale state was producing landing-page renders.
  await login(page);
  await context.storageState({ path: AUTH_FILE });
  await page.goto(`${PROD_URL}/trainer/studies`, { waitUntil: 'domcontentloaded' });

  // Wait for studies page to render
  await page.waitForSelector('h1:has-text("Studies")', { timeout: 15000 });

  // === Desktop 1280 ===
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-page.png',
    fullPage: false,
  });

  const newStudyBtn = page.getByRole('button', { name: /new study/i });
  await expect(newStudyBtn).toBeVisible();

  // Diagnostic: trigger button attributes BEFORE click
  const btnAttrsBefore = await newStudyBtn.evaluate((el) => ({
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
    tagName: el.tagName,
    type: el.getAttribute('type'),
  }));
  console.log('TRIGGER ATTRS (closed):', JSON.stringify(btnAttrsBefore));

  // Open menu via click
  await newStudyBtn.click();

  // Diagnostic: trigger button attributes AFTER click
  const btnAttrsAfter = await newStudyBtn.evaluate((el) => ({
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
  }));
  console.log('TRIGGER ATTRS (open):', JSON.stringify(btnAttrsAfter));

  // Wait for one of the menu items to appear
  await page.waitForSelector('button:has-text("Opening study")', { timeout: 5000 });
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-open.png',
    fullPage: false,
  });

  // Diagnostic: enumerate menu items
  const items = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button')).filter((b) => {
      const t = b.textContent || '';
      return /Opening study|Game study|Tactical set/.test(t) && t.length < 200;
    });
    return candidates.map((b) => ({
      text: (b.textContent || '').slice(0, 80),
      role: b.getAttribute('role'),
      ariaLabel: b.getAttribute('aria-label'),
      tabIndex: b.tabIndex,
    }));
  });
  console.log('MENU ITEMS:', JSON.stringify(items, null, 2));

  // Diagnostic: container role
  const containerInfo = await page.evaluate(() => {
    const item = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Opening study'),
    );
    if (!item) return null;
    const parent = item.parentElement;
    return {
      parentRole: parent?.getAttribute('role') || null,
      parentAriaLabel: parent?.getAttribute('aria-label') || null,
      parentAriaLabelledby: parent?.getAttribute('aria-labelledby') || null,
      parentTag: parent?.tagName,
    };
  });
  console.log('MENU CONTAINER:', JSON.stringify(containerInfo));

  // Keyboard: Escape should close the menu (WAI-ARIA menu pattern)
  await page.keyboard.press('Escape');
  // Wait a moment to let any handler run
  await page.waitForTimeout(150);
  const menuStillOpen = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Opening study'),
    );
  });
  console.log('ESCAPE CLOSES MENU:', !menuStillOpen);

  // Re-open menu for hover/contrast checks
  if (menuStillOpen) {
    // already open
  } else {
    await newStudyBtn.click();
    await page.waitForSelector('button:has-text("Opening study")', { timeout: 5000 });
  }

  // Diagnostic: subtext color contrast (the small "sub" line in each menu item)
  const subColors = await page.evaluate(() => {
    const item = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Opening study'),
    );
    if (!item) return null;
    const subDiv = item.querySelectorAll('div div')[1] as HTMLElement | undefined;
    if (!subDiv) return null;
    const cs = getComputedStyle(subDiv);
    return {
      text: subDiv.textContent,
      color: cs.color,
      fontSize: cs.fontSize,
      background: getComputedStyle(item.parentElement!).background,
    };
  });
  console.log('SUB TEXT STYLE:', JSON.stringify(subColors));

  // Focus check: tab from the trigger — does focus reach menu items with visible indicator?
  await newStudyBtn.focus();
  await page.keyboard.press('Tab');
  const focusedAfterTab = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const isFocusVisible = el.matches(':focus-visible');
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || '').slice(0, 60),
      tagName: el.tagName,
      isFocusVisible,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('TAB AFTER TRIGGER:', JSON.stringify(focusedAfterTab));

  // === Mobile 375x812 ===
  await page.setViewportSize({ width: 375, height: 812 });
  // Close any open menu by clicking elsewhere
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-mobile-page.png',
    fullPage: false,
  });

  const mobileNewStudyBtn = page.getByRole('button', { name: /new study/i });
  await mobileNewStudyBtn.click();
  await page.waitForSelector('button:has-text("Opening study")', { timeout: 5000 });

  const mobileMenuBox = await page.evaluate(() => {
    const item = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Opening study'),
    );
    const container = item?.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewportWidth: window.innerWidth };
  });
  console.log('MOBILE MENU BOX:', JSON.stringify(mobileMenuBox));
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-study-menu-mobile.png',
    fullPage: false,
  });

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors.filter((e) => !/Failed to load resource/.test(e)));

  expect(pageErrors).toEqual([]);
});
