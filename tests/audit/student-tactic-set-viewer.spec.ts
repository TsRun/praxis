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

async function pickTacticSetIdFromDashboard(page: Page): Promise<number | null> {
  await page.goto(`${PROD_URL}/student/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.locator('a[href*="/student/study/tactic/"]').first().waitFor({ timeout: 10000 }).catch(() => {});
  const hrefs = await page.locator('a[href*="/student/study/tactic/"]').evaluateAll((els) =>
    els.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
  );
  for (const h of hrefs) {
    const m = h.match(/\/student\/study\/tactic\/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

test('student-tactic-set-viewer: page renders & no uncaught errors', async ({ page }) => {
  test.setTimeout(90_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const id = await pickTacticSetIdFromDashboard(page);
  console.log('TACTIC SET ID from dashboard:', id);
  if (!id) {
    console.log('No tactic-set assignment available for bot — recording observation only.');
    return;
  }

  const apiResps: Array<{ url: string; status: number }> = [];
  page.on('response', (r) => {
    if (r.url().includes(`/api/student/studies/tactic/${id}`)) {
      apiResps.push({ url: r.url(), status: r.status() });
    }
  });

  const url = `${PROD_URL}/student/study/tactic/${id}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  // Wait for one of: viewer heading h1, an error alert, or up to 15s.
  await Promise.race([
    page.locator('h1.t-h1').first().waitFor({ timeout: 15000 }).catch(() => null),
    page.locator('[role="alert"]').first().waitFor({ timeout: 15000 }).catch(() => null),
    page.waitForTimeout(15000),
  ]);

  console.log('TACTIC API RESPONSES:', apiResps);
  const apiOk = apiResps.some((r) => r.status >= 200 && r.status < 300);
  const apiFailed = apiResps.some((r) => r.status >= 400);

  const bodySnapshot = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    bodyTextStart: (document.body.innerText || '').slice(0, 400),
    boardCount: document.querySelectorAll('cg-board, .cg-wrap, [class*="cg-wrap"]').length,
    errorAlerts: Array.from(document.querySelectorAll('[role="alert"]')).map(
      (el) => (el as HTMLElement).innerText.slice(0, 200),
    ),
    loadingStatus: Array.from(document.querySelectorAll('[role="status"]')).map((el) => ({
      text: (el as HTMLElement).innerText.slice(0, 60),
      ariaLive: el.getAttribute('aria-live'),
    })),
    metaTexts: Array.from(document.querySelectorAll('.meta')).slice(0, 6).map(
      (el) => (el as HTMLElement).innerText.slice(0, 120),
    ),
    h1: Array.from(document.querySelectorAll('h1')).map((h) => (h as HTMLElement).innerText.slice(0, 120)),
    h2: Array.from(document.querySelectorAll('h2')).map((h) => (h as HTMLElement).innerText.slice(0, 120)),
  }));
  console.log('BODY SNAPSHOT:', bodySnapshot);

  if (apiOk) {
    // Happy path — heading renders, board renders or end-of-set card shows.
    const headingTxt = await page.locator('h1.t-h1').first().innerText().catch(() => '');
    console.log('VIEWER HEADING:', headingTxt);
    expect(headingTxt.trim().length).toBeGreaterThan(0);

    const boardCount = await page.locator('cg-board, .cg-wrap, [class*="cg-wrap"]').count();
    const endOfSet = await page.getByText(/End of set/i).count();
    const emptySet = await page.getByText(/No puzzles yet/i).count();
    console.log('BOARD COUNT:', boardCount, 'END-OF-SET:', endOfSet, 'EMPTY-SET:', emptySet);
    expect(boardCount > 0 || endOfSet > 0 || emptySet > 0).toBe(true);

    // Chip annotations (counter + solved)
    const chips = await page.locator('.chip, [class*="chip"]').evaluateAll((els) =>
      els.slice(0, 8).map((e) => (e as HTMLElement).innerText.trim()),
    );
    console.log('CHIPS:', chips);

    // Puzzle heading and "side to move"
    const puzzleH2 = await page.locator('h2').filter({ hasText: /^Puzzle\s+\d+$/i }).count();
    const sideToMove = await page.locator('.meta', { hasText: /to move/i }).count();
    console.log('PUZZLE H2:', puzzleH2, 'SIDE TO MOVE meta:', sideToMove);

    // Btn states
    const btnStates = await page.locator('button').evaluateAll((els) =>
      els.slice(0, 20).map((b) => ({
        text: (b.textContent || '').trim().slice(0, 32),
        disabled: (b as HTMLButtonElement).disabled,
        ariaLabel: b.getAttribute('aria-label'),
      })),
    );
    console.log('BUTTONS:', btnStates);
  } else if (apiFailed) {
    console.log('OBSERVATION: tactic API returned an error.');
  } else {
    console.log(
      'OBSERVATION: data-fetch for /api/student/studies/tactic/${id} did not complete within the wait window.',
    );
  }

  // ----- Focus a11y -----
  const focusInfo = await page.evaluate(() => {
    const focusable = Array.from(
      document.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"]), input'),
    ).slice(0, 12) as HTMLElement[];
    focusable[0]?.focus();
    const active = document.activeElement as HTMLElement | null;
    const cs = active ? getComputedStyle(active) : null;
    return {
      tag: active?.tagName,
      text: active?.textContent?.slice(0, 60) ?? null,
      outline: cs?.outlineStyle,
      outlineColor: cs?.outlineColor,
      outlineWidth: cs?.outlineWidth,
      boxShadow: cs?.boxShadow,
    };
  });
  console.log('FOCUS info on first focusable:', focusInfo);

  // ----- Mobile pass -----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    bodyOverflow: getComputedStyle(document.body).overflowX,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // BoardToolbar is rendered horizontally next to the board via a flex row on
  // mobile. If a board exists, detect whether its wrapper overflows the
  // viewport. Skip cleanly when no board is rendered (e.g. empty set).
  const boardCountAtMobile = await page.locator('cg-board, .cg-wrap, [class*="cg-wrap"]').count();
  let boardWrap: { width: number; right: number; clipsRight: boolean } | null = null;
  if (boardCountAtMobile > 0) {
    boardWrap = await page.locator('cg-board, .cg-wrap, [class*="cg-wrap"]').first().evaluate((el) => {
      const wrap = el.closest('div');
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        right: Math.round(rect.right),
        clipsRight: rect.right > window.innerWidth + 1,
      };
    }).catch(() => null);
  }
  console.log('MOBILE BOARD WRAP:', boardWrap);

  await page.screenshot({ path: 'tests/audit/screenshots/student-tactic-set-viewer.mobile.png', timeout: 8000 }).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/audit/screenshots/student-tactic-set-viewer.desktop.png', timeout: 8000 }).catch(() => {});

  console.log('CONSOLE ERRORS:', consoleErrors);
  console.log('PAGE ERRORS:', pageErrors);

  const appConsoleErrors = consoleErrors.filter(
    (m) => !/Failed to load resource:.*\bthe server responded with a status\b/i.test(m),
  );
  expect(pageErrors).toEqual([]);
  expect(appConsoleErrors).toEqual([]);
});
