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

test('student-dashboard: greeting, stats, filter, side cards, row hover', async ({ page }) => {
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

  await page.waitForSelector('h1', { timeout: 15_000 });
  const greeting = page.locator('h1').first();
  await expect(greeting).toBeVisible();
  console.log('GREETING:', JSON.stringify((await greeting.textContent())?.trim() ?? ''));

  // ----- Heading semantics -----
  const h2s = await page.locator('h2').evaluateAll((els) =>
    els.map((e) => (e.textContent?.trim() ?? '')),
  );
  console.log('H2s:', h2s);
  expect(h2s).toContain('All assignments');
  expect(h2s).toContain('Today');
  expect(h2s).toContain('Activity');

  // ----- MiniStat tiles (active / completed) -----
  const miniStats = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[role="group"][aria-label]'))
      .filter((t) => /^\d+ (active|completed)$/.test(t.getAttribute('aria-label') ?? ''));
    return tiles.map((t) => ({
      ariaLabel: t.getAttribute('aria-label'),
      text: (t.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));
  });
  console.log('MINI STATS:', miniStats);
  expect(miniStats.length).toBe(2);

  // ----- Assignments filter (Segmented near the "All assignments" H2) -----
  const filterInfo = await page.evaluate(() => {
    const allH = Array.from(document.querySelectorAll('h2')).find(
      (h) => h.textContent?.trim() === 'All assignments',
    );
    const row = allH?.parentElement?.parentElement;
    const seg = row?.querySelector('.segmented') as HTMLElement | null;
    const btns = Array.from(seg?.querySelectorAll('button') ?? []).map((b) => ({
      text: b.textContent?.trim() ?? '',
      ariaPressed: b.getAttribute('aria-pressed'),
    }));
    return {
      ariaLabel: seg?.getAttribute('aria-label'),
      role: seg?.getAttribute('role'),
      btns,
    };
  });
  console.log('ASSIGNMENT FILTER:', filterInfo);
  expect(filterInfo.btns.map((b) => b.text)).toEqual(['Active', 'Completed']);
  expect(filterInfo.btns.some((b) => b.ariaPressed === 'true')).toBe(true);

  // ----- Toggle filter -----
  const completedBtn = page.locator('h2:has-text("All assignments")')
    .locator('xpath=ancestor::*[1]/..')
    .locator('.segmented button', { hasText: 'Completed' })
    .first();
  if (await completedBtn.count()) {
    await completedBtn.click();
    await page.waitForTimeout(120);
  }

  // ----- Assignment row hover affordance -----
  // Switch back to Active so a row may be present.
  const activeBtn = page.locator('h2:has-text("All assignments")')
    .locator('xpath=ancestor::*[1]/..')
    .locator('.segmented button', { hasText: 'Active' })
    .first();
  if (await activeBtn.count()) {
    await activeBtn.click();
    await page.waitForTimeout(120);
  }
  const row = page.locator('.assignment-row').first();
  const rowHover = await row.count()
    ? await (async () => {
        const before = await row.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, border: cs.borderTopColor };
        });
        await row.hover();
        await page.waitForTimeout(180);
        const after = await row.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, border: cs.borderTopColor };
        });
        return { before, after, changed: before.bg !== after.bg || before.border !== after.border };
      })()
    : { skipped: true };
  console.log('ROW HOVER:', rowHover);
  if (!('skipped' in rowHover)) {
    expect(rowHover.changed).toBe(true);
  }

  // ----- Link wrapper: focus-visible behaviour -----
  const linkWrap = page.locator('.assignment-row-link').first();
  if (await linkWrap.count()) {
    await linkWrap.evaluate((el) => (el as HTMLElement).focus());
    const focusInfo = await linkWrap.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
      };
    });
    console.log('ROW LINK focus styles:', focusInfo);
    expect(focusInfo.display).toBe('block');
  }

  // ----- "Today" card progress bar a11y -----
  const todayCardInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2'));
    const todayH = headings.find((h) => h.textContent?.trim() === 'Today');
    const card = todayH?.closest('div')?.parentElement?.parentElement ?? null;
    if (!card) return null;
    const bar = card.querySelector('[role="progressbar"]') as HTMLElement | null;
    return {
      hasProgress: !!bar,
      progressRole: bar?.getAttribute('role'),
      progressAriaValueNow: bar?.getAttribute('aria-valuenow'),
      progressAriaLabel: bar?.getAttribute('aria-label'),
    };
  });
  console.log('TODAY card:', todayCardInfo);
  expect(todayCardInfo?.progressRole).toBe('progressbar');

  // ----- Desktop screenshot -----
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard.png',
    fullPage: true,
  });

  // ----- Mobile 375x812 -----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
