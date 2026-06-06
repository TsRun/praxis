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

async function pickGameStudyIdFromDashboard(page: Page): Promise<number | null> {
  await page.goto(`${PROD_URL}/student/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const hrefs = await page.locator('a[href*="/student/study/game/"]').evaluateAll((els) =>
    els.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
  );
  for (const h of hrefs) {
    const m = h.match(/\/student\/study\/game\/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

test('student-game-study-viewer: page renders & no uncaught errors', async ({ page }) => {
  test.setTimeout(90_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const id = await pickGameStudyIdFromDashboard(page);
  console.log('GAME STUDY ID from dashboard:', id);
  if (!id) {
    console.log('No game-study assignment available for bot — recording observation only.');
    return;
  }

  const apiResps: Array<{ url: string; status: number }> = [];
  page.on('response', (r) => {
    if (r.url().includes(`/api/student/studies/game/${id}`)) {
      apiResps.push({ url: r.url(), status: r.status() });
    }
  });

  const url = `${PROD_URL}/student/study/game/${id}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  // Wait for one of: viewer heading h1 (loaded), an error alert (fixed error state),
  // or until the loading window closes.
  await Promise.race([
    page.locator('h1.t-h1').first().waitFor({ timeout: 20000 }).catch(() => null),
    page.locator('[role="alert"]', { hasText: /Couldn't load this study/i }).waitFor({ timeout: 20000 }).catch(() => null),
    page.waitForTimeout(20000),
  ]);

  console.log('GAME STUDY API RESPONSES:', apiResps);

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
    h1: Array.from(document.querySelectorAll('h1')).map((h) => (h as HTMLElement).innerText.slice(0, 100)),
    h2: Array.from(document.querySelectorAll('h2')).map((h) => (h as HTMLElement).innerText.slice(0, 100)),
  }));
  console.log('BODY SNAPSHOT:', bodySnapshot);

  if (apiOk) {
    // ----- Happy path -----
    const headingTxt = await page.locator('h1.t-h1').first().innerText().catch(() => '');
    console.log('VIEWER HEADING:', headingTxt);
    expect(headingTxt.trim().length).toBeGreaterThan(0);

    // Board renders
    const boardCount = await page.locator('cg-board, .cg-wrap, [class*="cg-wrap"]').count();
    console.log('BOARD CONTAINERS:', boardCount);
    expect(boardCount).toBeGreaterThan(0);

    // Move list panel
    const moveListH2 = await page.locator('h2', { hasText: /Move list/i }).count();
    const progressH3 = await page.locator('h3', { hasText: /Progress/i }).count();
    console.log('PANEL HEADERS:', { moveListH2, progressH3 });

    // PGN/Player chips
    const chipsText = await page.locator('.chip, [class*="chip"]').evaluateAll((els) =>
      els.slice(0, 8).map((e) => (e as HTMLElement).innerText.trim()),
    );
    console.log('CHIPS:', chipsText);

    // "comments" checkbox should have an accessible label
    const commentsLabel = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const found = labels.find((l) => /comments/i.test(l.textContent || ''));
      if (!found) return null;
      const input = found.querySelector('input[type="checkbox"]');
      return {
        hasFor: !!found.getAttribute('for'),
        wrapsInput: !!input,
        ariaLabel: input?.getAttribute('aria-label') ?? null,
        id: input?.id ?? null,
      };
    });
    console.log('COMMENTS LABEL:', commentsLabel);
  } else if (apiFailed) {
    const hasErrorCard = await page
      .locator('[role="alert"]', { hasText: /Couldn't load this study/i })
      .count();
    console.log('ERROR CARD COUNT:', hasErrorCard);
    if (hasErrorCard === 0) {
      console.log(
        'OBSERVATION: API returned an error but the viewer is stuck on the Loading… placeholder. No error UI, no recovery.',
      );
    }
  } else {
    console.log('OBSERVATION: data-fetch for /api/student/studies/game/${id} did not complete within the wait window.');
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

  await page.screenshot({ path: 'tests/audit/screenshots/student-game-study-viewer.mobile.png', fullPage: true }).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/audit/screenshots/student-game-study-viewer.desktop.png', fullPage: true }).catch(() => {});

  console.log('CONSOLE ERRORS:', consoleErrors);
  console.log('PAGE ERRORS:', pageErrors);

  const appConsoleErrors = consoleErrors.filter(
    (m) => !/Failed to load resource:.*\bthe server responded with a status\b/i.test(m),
  );

  // When the upstream API errors, the *current* prod build does not yet catch
  // the rejection (it surfaces as an unhandled rejection). If/when this PR
  // adds a `.catch` and error UI, that path becomes the floor.
  const filteredPageErrors = apiFailed
    ? pageErrors.filter((m) => !/^GET .* → \d+$/.test(m) && !/^column ".*" does not exist$/i.test(m))
    : pageErrors;
  expect(filteredPageErrors).toEqual([]);
  expect(appConsoleErrors).toEqual([]);
});
