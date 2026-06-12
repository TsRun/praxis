import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL ?? 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD ?? 'Claudebot';

test('trainer-students-filters: All / Linked / Invited tabs switch list; UI checks', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // ---- Sign in ----
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer(\/|$)/, { timeout: 15000 });

  // ---- Navigate to /trainer/students ----
  const resp = await page.goto(`${PROD_URL}/trainer/students`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);
  await page.waitForSelector('h1', { timeout: 15000 });

  await expect(page.getByRole('heading', { level: 1, name: /^Students$/ })).toBeVisible();

  // Wait until loading state resolves
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[role="status"][aria-live="polite"]');
      return el && /\d+ students/.test(el.textContent || '');
    },
    { timeout: 15000 }
  );

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-filters-desktop.png',
    fullPage: true,
  });

  // ---- Segmented filter group ----
  const seg = page.locator('[aria-label="Filter students by status"]');
  await expect(seg).toBeVisible();
  const segInfo = await seg.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    childCount: el.children.length,
  }));
  console.log('SEGMENTED INFO:', segInfo);

  const tabAll = seg.locator('button', { hasText: /^All$/ });
  const tabLinked = seg.locator('button', { hasText: /^Linked$/ });
  const tabInvited = seg.locator('button', { hasText: /^Invited$/ });

  const initialState = await Promise.all(
    [tabAll, tabLinked, tabInvited].map((b) =>
      b.evaluate((el) => ({
        text: (el.textContent || '').trim(),
        ariaPressed: el.getAttribute('aria-pressed'),
        className: el.className,
        type: el.getAttribute('type'),
      }))
    )
  );
  console.log('TABS INITIAL:', initialState);

  const countLine = page.locator('[role="status"][aria-live="polite"]').first();
  const allCount = (await countLine.textContent())?.trim();
  console.log('ALL COUNT:', allCount);

  // Switch to Linked
  await tabLinked.click();
  await page.waitForTimeout(200);
  const linkedCount = (await countLine.textContent())?.trim();
  console.log('LINKED COUNT:', linkedCount);
  console.log('LINKED aria-pressed:', await tabLinked.getAttribute('aria-pressed'));

  // Switch to Invited
  await tabInvited.click();
  await page.waitForTimeout(200);
  const invitedCount = (await countLine.textContent())?.trim();
  console.log('INVITED COUNT:', invitedCount);
  console.log('INVITED aria-pressed:', await tabInvited.getAttribute('aria-pressed'));

  const invitedEmpty = await page
    .locator('div[role="status"][aria-live="polite"]')
    .filter({ hasText: /No invited|No students/ })
    .first()
    .textContent()
    .catch(() => null);
  console.log('INVITED EMPTY HEADING:', invitedEmpty);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-filters-invited.png',
    fullPage: true,
  });

  // Switch back to All
  await tabAll.click();
  await page.waitForTimeout(200);

  // Active vs inactive visual differentiation
  const allActiveStyles = await tabAll.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow,
    };
  });
  const linkedInactiveStyles = await tabLinked.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('ALL (active) styles:', allActiveStyles);
  console.log('LINKED (inactive) styles:', linkedInactiveStyles);

  // Focus ring
  await tabAll.focus();
  await page.waitForTimeout(80);
  const allFocus = await tabAll.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('ALL :focus styles:', allFocus);

  // Hover state on inactive tab
  await tabLinked.hover();
  await page.waitForTimeout(80);
  const linkedHover = await tabLinked.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      cursor: cs.cursor,
    };
  });
  console.log('LINKED :hover styles:', linkedHover);

  // Search input a11y
  const search = page.locator('input[placeholder="Find by nickname…"]');
  await expect(search).toBeVisible();
  const searchInfo = await search.evaluate((el: HTMLInputElement) => ({
    ariaLabel: el.getAttribute('aria-label'),
    id: el.id || null,
    labelsFor: el.id
      ? document.querySelectorAll(`label[for="${el.id}"]`).length
      : 0,
  }));
  console.log('SEARCH a11y:', searchInfo);

  // "More" button on first student card
  const moreBtns = page.locator('button[title="More"]');
  const moreCount = await moreBtns.count();
  console.log('MORE BUTTONS COUNT:', moreCount);
  if (moreCount > 0) {
    const moreInfo = await moreBtns.first().evaluate((el) => ({
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      textContent: (el.textContent || '').trim(),
      width: (el as HTMLElement).getBoundingClientRect().width,
      height: (el as HTMLElement).getBoundingClientRect().height,
    }));
    console.log('FIRST MORE BUTTON:', moreInfo);
    await moreBtns.first().click();
    await page.waitForTimeout(150);
    const menuVisible = await page
      .locator('[role="menu"], [role="menuitem"], [role="dialog"]')
      .count();
    console.log('MORE BUTTON opens menu?:', menuVisible);
  }

  // Search filtering
  const allCountNum = parseInt((allCount || '').match(/\d+/)?.[0] ?? '0', 10);
  if (allCountNum > 0) {
    await search.fill('zzzzznoexistxx');
    await page.waitForTimeout(150);
    const emptyAfterSearch = await page
      .locator('div[role="status"][aria-live="polite"]')
      .filter({ hasText: /No students match/ })
      .first()
      .textContent()
      .catch(() => null);
    console.log('EMPTY STATE after no-match search:', emptyAfterSearch);
    await search.fill('');
  }

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-filters-mobile.png',
    fullPage: true,
  });

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(
      `WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`
    );
  }

  const tabAllBox = await tabAll.boundingBox();
  const tabLinkedBox = await tabLinked.boundingBox();
  const tabInvitedBox = await tabInvited.boundingBox();
  console.log('MOBILE TAB BOXES:', {
    all: tabAllBox,
    linked: tabLinkedBox,
    invited: tabInvitedBox,
  });
  for (const [name, b] of [
    ['All', tabAllBox],
    ['Linked', tabLinkedBox],
    ['Invited', tabInvitedBox],
  ] as const) {
    if (b && b.height < 32) {
      console.warn(`WARN: ${name} tab height ${b.height}px below 32px on mobile`);
    }
  }

  await tabLinked.click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-filters-mobile-linked.png',
    fullPage: true,
  });

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource'))
  );
  expect(pageErrors).toEqual([]);
});
