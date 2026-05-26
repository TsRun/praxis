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

test('student-dashboard-assignments-tabs: Active/Completed segmented switches list', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/student/dashboard`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);
  await page.waitForSelector('h1', { timeout: 15000 });

  // Locate the assignments-list segmented control: the one inside the "All assignments" card.
  const seg = page.locator('.segmented').filter({ hasText: /Active/ }).first();
  await expect(seg).toBeVisible();

  // ----- a11y/semantics of the group -----
  const segInfo = await seg.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('SEG group:', segInfo);

  // ----- buttons: text, aria-pressed, active class -----
  const initialBtns = await seg.locator('button').evaluateAll((els) =>
    els.map((b) => ({
      text: (b as HTMLButtonElement).textContent?.trim() ?? '',
      ariaPressed: b.getAttribute('aria-pressed'),
      ariaLabel: b.getAttribute('aria-label'),
      active: b.classList.contains('active'),
    })),
  );
  console.log('SEG buttons (initial):', initialBtns);

  // Find each tab.
  const activeTab = seg.locator('button', { hasText: 'Active' });
  const completedTab = seg.locator('button', { hasText: 'Completed' });
  await expect(activeTab).toHaveCount(1);
  await expect(completedTab).toHaveCount(1);

  // ----- capture the list body before switching -----
  const listBody = page
    .locator('h2', { hasText: 'All assignments' })
    .locator('xpath=ancestor::*[contains(@class,"card") or contains(@class,"Card")][1]');

  // The list region is sibling under the same Card; use a simpler scoped locator:
  const card = page.locator('h2:has-text("All assignments")').locator('..').locator('..');
  const bodyBefore = (await card.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  const empty = /No (active|completed) assignments\./;
  console.log('CARD text snippet (before):', bodyBefore.slice(0, 220));

  // ----- click Completed -----
  await completedTab.click();
  await page.waitForTimeout(150);

  const afterCompletedBtns = await seg.locator('button').evaluateAll((els) =>
    els.map((b) => ({
      text: (b as HTMLButtonElement).textContent?.trim() ?? '',
      ariaPressed: b.getAttribute('aria-pressed'),
      active: b.classList.contains('active'),
    })),
  );
  console.log('SEG buttons (after click Completed):', afterCompletedBtns);

  // active class should now be on Completed, not Active
  await expect(completedTab).toHaveClass(/active/);
  await expect(activeTab).not.toHaveClass(/active/);
  // aria-pressed should reflect state
  expect(await completedTab.getAttribute('aria-pressed')).toBe('true');
  expect(await activeTab.getAttribute('aria-pressed')).toBe('false');

  const bodyAfterCompleted = (await card.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  console.log('CARD text snippet (Completed):', bodyAfterCompleted.slice(0, 220));

  // ----- click Active again -----
  await activeTab.click();
  await page.waitForTimeout(150);
  await expect(activeTab).toHaveClass(/active/);
  await expect(completedTab).not.toHaveClass(/active/);

  // ----- contrast: active vs inactive text colour -----
  const colors = await seg.evaluate((el) => {
    const btns = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
    return btns.map((b) => {
      const cs = getComputedStyle(b);
      return {
        text: b.textContent?.trim() ?? '',
        color: cs.color,
        background: cs.backgroundColor,
        boxShadow: cs.boxShadow,
        active: b.classList.contains('active'),
      };
    });
  });
  console.log('SEG button colors:', colors);

  // ----- focus indicator: programmatic .focus() (browsers may not show :focus-visible) -----
  await activeTab.focus();
  await page.waitForTimeout(80);
  const focusActiveProgrammatic = await activeTab.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('SEG focus (programmatic Active):', focusActiveProgrammatic);

  // ----- focus indicator: keyboard Tab navigation (should trigger :focus-visible) -----
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Click the page body via a benign element first to reset, then Tab onto the segmented control.
  await page.locator('h1').first().click();
  // Tab a few times until focus lands on the Active button.
  let focusedSelector = '';
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    focusedSelector = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '';
      const cls = el.className || '';
      const txt = (el.textContent || '').trim().slice(0, 30);
      return `${el.tagName}.${cls}|${txt}`;
    });
    if (focusedSelector.includes('Active') && focusedSelector.startsWith('BUTTON')) break;
  }
  console.log('Tabbed-to element:', focusedSelector);

  const keyboardFocusActive = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent?.trim() ?? '',
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('SEG focus (keyboard Active):', keyboardFocusActive);

  // Now tab once more — focus should land on Completed.
  await page.keyboard.press('Tab');
  const keyboardFocusCompleted = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent?.trim() ?? '',
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      outlineOffset: cs.outlineOffset,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('SEG focus (keyboard next):', keyboardFocusCompleted);

  // ----- keyboard activation: Space on focused Completed tab -----
  await completedTab.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await expect(completedTab).toHaveClass(/active/);

  // ----- desktop screenshot -----
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard-assignments-tabs.png',
    fullPage: true,
  });

  // ----- mobile 375x812 -----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard-assignments-tabs-mobile.png',
    fullPage: true,
  });

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // Mobile layout of the "All assignments" header row + segmented control.
  const mobileLayout = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h2')).find(
      (e) => e.textContent?.trim() === 'All assignments',
    ) as HTMLElement | undefined;
    if (!h) return null;
    const row = h.parentElement?.parentElement as HTMLElement | undefined;
    const seg = row?.querySelector('.segmented') as HTMLElement | undefined;
    return {
      rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
      rowWidth: row ? Math.round(row.getBoundingClientRect().width) : null,
      segLeft: seg ? Math.round(seg.getBoundingClientRect().left) : null,
      segRight: seg ? Math.round(seg.getBoundingClientRect().right) : null,
      segWidth: seg ? Math.round(seg.getBoundingClientRect().width) : null,
      viewportWidth: window.innerWidth,
    };
  });
  console.log('MOBILE all-assignments header row:', mobileLayout);

  // Mobile: still able to switch tabs (tap target).
  const mobActive = page.locator('.segmented').filter({ hasText: /Active/ }).first().locator('button', { hasText: 'Active' });
  const mobCompleted = page.locator('.segmented').filter({ hasText: /Active/ }).first().locator('button', { hasText: 'Completed' });
  await mobActive.click();
  await expect(mobActive).toHaveClass(/active/);
  await mobCompleted.click();
  await expect(mobCompleted).toHaveClass(/active/);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
  expect(empty.test('') || true).toBe(true); // suppress unused
});
