import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL ?? 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD ?? 'Claudebot';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer(\/|$)/, { timeout: 15000 });
}

test('tournaments-view-toggle: list/map segmented control swaps views', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/tournaments`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);
  await page.waitForSelector('h1', { timeout: 15000 });

  const btnListe = page.getByRole('button', { name: /^Liste$/ });
  const btnCarte = page.getByRole('button', { name: /^Carte$/ });
  await expect(btnListe).toBeVisible();
  await expect(btnCarte).toBeVisible();

  // Group must be labelled.
  const viewGroup = page.getByRole('group', { name: /Vue/i });
  await expect(viewGroup).toHaveCount(1);

  // Initial state: list selected.
  expect(await btnListe.getAttribute('aria-pressed')).toBe('true');
  expect(await btnCarte.getAttribute('aria-pressed')).toBe('false');

  // Wait for initial list to settle (or empty-state) before swap.
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Chargement…'),
    null,
    { timeout: 15000 },
  );

  // Swap to Carte; expect Suspense fallback or map to appear.
  await btnCarte.click();
  expect(await btnCarte.getAttribute('aria-pressed')).toBe('true');
  expect(await btnListe.getAttribute('aria-pressed')).toBe('false');

  // Map renders an SVG of the regions. Allow time for the lazy chunk.
  await page.waitForSelector('svg', { timeout: 20000 });
  const svgCount = await page.locator('svg').count();
  console.log('SVG count after Carte:', svgCount);
  expect(svgCount).toBeGreaterThan(0);

  // Wait for the toggle's 120ms color transition to settle before reading styles.
  await page.waitForTimeout(400);

  // Contrast: pressed button (Carte is currently pressed) bg vs text.
  const rgb = await btnCarte.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, fg: cs.color };
  });
  console.log('CARTE pressed colors:', rgb);

  const parseRgb = (s: string): [number, number, number] => {
    const m = s.match(/\d+(\.\d+)?/g)!.map(Number);
    return [m[0], m[1], m[2]];
  };
  const lum = ([r, g, b]: [number, number, number]) => {
    const lin = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const contrast = (a: [number, number, number], b: [number, number, number]) => {
    const la = lum(a), lb = lum(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  };
  const ratio = contrast(parseRgb(rgb.bg), parseRgb(rgb.fg));
  console.log(`TOGGLE pressed contrast: ${ratio.toFixed(2)}:1`);
  if (ratio < 4.5) {
    console.warn(`WARN: pressed toggle contrast ${ratio.toFixed(2)}:1 below WCAG-AA 4.5:1`);
  }

  // Swap back to Liste.
  await btnListe.click();
  await page.waitForTimeout(200);
  expect(await btnListe.getAttribute('aria-pressed')).toBe('true');
  expect(await btnCarte.getAttribute('aria-pressed')).toBe('false');

  // Focus-visible style rule must exist in stylesheets (keyboard-focused outline).
  const hasFocusVisibleRule = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (
          rule instanceof CSSStyleRule &&
          rule.selectorText &&
          rule.selectorText.includes('.seg-toggle-btn') &&
          rule.selectorText.includes(':focus-visible') &&
          rule.style.outline &&
          rule.style.outline !== 'none'
        ) {
          return rule.style.outline;
        }
      }
    }
    return null;
  });
  console.log('seg-toggle-btn :focus-visible outline rule:', hasFocusVisibleRule);
  expect(hasFocusVisibleRule, '.seg-toggle-btn:focus-visible must define a visible outline').toBeTruthy();

  // Tap target size on desktop.
  const carteBox = await btnCarte.boundingBox();
  const listeBox = await btnListe.boundingBox();
  console.log('DESKTOP toggle boxes:', { listeBox, carteBox });
  expect(carteBox?.height ?? 0).toBeGreaterThanOrEqual(36);
  expect(listeBox?.height ?? 0).toBeGreaterThanOrEqual(36);

  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-view-toggle-desktop.png',
    fullPage: true,
  });

  // ---- Mobile 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${PROD_URL}/tournaments`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(500);

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(`WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`);
  }

  const mobileListe = page.getByRole('button', { name: /^Liste$/ });
  const mobileCarte = page.getByRole('button', { name: /^Carte$/ });
  const mListeBox = await mobileListe.boundingBox();
  const mCarteBox = await mobileCarte.boundingBox();
  console.log('MOBILE toggle boxes:', { mListeBox, mCarteBox });
  expect(mListeBox?.height ?? 0).toBeGreaterThanOrEqual(36);
  expect(mCarteBox?.height ?? 0).toBeGreaterThanOrEqual(36);

  // Toggle still works on mobile.
  await mobileCarte.click();
  expect(await mobileCarte.getAttribute('aria-pressed')).toBe('true');
  await page.waitForSelector('svg', { timeout: 20000 });

  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-view-toggle-mobile.png',
    fullPage: true,
  });

  const appErrs = consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', appErrs);
  expect(pageErrors).toEqual([]);
});
