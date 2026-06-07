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

test('tournaments-page: heading, cadence tabs, view toggle work with UI checks', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  // --- Navigate to /tournaments ---
  const resp = await page.goto(`${PROD_URL}/tournaments`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: /Tournois/i })).toBeVisible();

  // Cadence buttons
  const btnClassique = page.getByRole('button', { name: /^Classique$/ });
  const btnRapide = page.getByRole('button', { name: /^Rapide$/ });
  const btnBlitz = page.getByRole('button', { name: /^Blitz$/ });
  await expect(btnClassique).toBeVisible();
  await expect(btnRapide).toBeVisible();
  await expect(btnBlitz).toBeVisible();

  // View toggles
  const btnListe = page.getByRole('button', { name: /^Liste$/ });
  const btnCarte = page.getByRole('button', { name: /^Carte$/ });
  await expect(btnListe).toBeVisible();
  await expect(btnCarte).toBeVisible();

  // ---- A11y: region / sort selects must have accessible names ----
  const regionSelect = page.locator('select').first();
  const sortSelect = page.locator('select').nth(1);
  const regionInfo = await regionSelect.evaluate((el: HTMLSelectElement) => ({
    ariaLabel: el.getAttribute('aria-label'),
    labelledby: el.getAttribute('aria-labelledby'),
    id: el.id,
  }));
  const sortInfo = await sortSelect.evaluate((el: HTMLSelectElement) => ({
    ariaLabel: el.getAttribute('aria-label'),
    labelledby: el.getAttribute('aria-labelledby'),
    id: el.id,
  }));
  console.log('REGION select a11y:', regionInfo);
  console.log('SORT select a11y:', sortInfo);

  // ---- Cadence button visual contrast (active vs inactive) ----
  // Inactive style before clicking
  const inactiveStyle = await btnRapide.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      pressed: el.getAttribute('aria-pressed'),
    };
  });
  console.log('CADENCE inactive style:', inactiveStyle);

  await btnRapide.click();
  await page.waitForTimeout(300);
  const activeStyle = await btnRapide.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      pressed: el.getAttribute('aria-pressed'),
    };
  });
  console.log('CADENCE active style (Rapide):', activeStyle);
  expect(activeStyle.pressed).toBe('true');

  // URL should reflect cadence
  const urlAfterCadence = page.url();
  console.log('URL after Rapide click:', urlAfterCadence);
  expect(urlAfterCadence).toContain('cadence=rapid');

  // Toggle off
  await btnRapide.click();
  await page.waitForTimeout(200);

  // ---- View toggle: focus + hover styles ----
  await btnListe.focus();
  await page.waitForTimeout(80);
  const listeFocus = await btnListe.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      background: cs.backgroundColor,
      color: cs.color,
    };
  });
  console.log('LISTE :focus styles:', listeFocus);

  await btnCarte.hover();
  await page.waitForTimeout(80);
  const carteHover = await btnCarte.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      cursor: cs.cursor,
    };
  });
  console.log('CARTE :hover styles:', carteHover);

  // ---- Switch to map view ----
  await btnCarte.click();
  await page.waitForTimeout(1500);

  // After clicking Carte the button should be aria-pressed=true
  const cartePressed = await btnCarte.getAttribute('aria-pressed');
  expect(cartePressed).toBe('true');
  const listePressed = await btnListe.getAttribute('aria-pressed');
  expect(listePressed).toBe('false');

  // Map: either loader text or an svg/canvas should appear in main content
  const mapPresent = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const txt = main.textContent || '';
    const svg = main.querySelector('svg');
    return {
      hasLoaderText: /Chargement de la carte/i.test(txt),
      hasSvg: !!svg,
      svgRect: svg ? (svg as SVGSVGElement).getBoundingClientRect() : null,
    };
  });
  console.log('MAP state:', mapPresent);

  // Switch back to list
  await btnListe.click();
  await page.waitForTimeout(300);

  // Desktop screenshot
  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-page-desktop.png',
    fullPage: true,
  });

  // ---- Mobile pass: 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${PROD_URL}/tournaments`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(400);

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(`WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`);
  }

  // Measure key controls on mobile
  const mobileRegion = await page.locator('select').first().boundingBox();
  const mobileCadenceClassique = await page.getByRole('button', { name: /^Classique$/ }).boundingBox();
  const mobileListe = await page.getByRole('button', { name: /^Liste$/ }).boundingBox();
  const mobileCarte = await page.getByRole('button', { name: /^Carte$/ }).boundingBox();
  console.log('MOBILE control boxes:', {
    region: mobileRegion,
    classique: mobileCadenceClassique,
    liste: mobileListe,
    carte: mobileCarte,
  });

  // WCAG 2.5.5 (Level AAA): tap targets ≥ 44px; commonly cited mobile minimum 36px.
  if (mobileCadenceClassique && mobileCadenceClassique.height < 36) {
    console.warn(`WARN: cadence button height ${mobileCadenceClassique.height}px below 36px on mobile`);
  }
  if (mobileListe && mobileListe.height < 36) {
    console.warn(`WARN: Liste toggle height ${mobileListe.height}px below 36px on mobile`);
  }
  if (mobileCarte && mobileCarte.height < 36) {
    console.warn(`WARN: Carte toggle height ${mobileCarte.height}px below 36px on mobile`);
  }

  // Are toggle group buttons on the same row as cadence on mobile (likely wrap)?
  if (mobileCadenceClassique && mobileListe) {
    const sameRow = Math.abs(mobileCadenceClassique.y - mobileListe.y) < 4;
    console.log('MOBILE cadence/Liste sameRow:', sameRow);
  }

  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-page-mobile.png',
    fullPage: true,
  });

  // ---- WCAG-AA contrast: cadence pill colors (white text on these fills,
  //      ~11px font, so AA threshold is 4.5:1).
  //      Keep this list in sync with CAD_COLOR in src/tournaments/TournamentList.tsx
  //      and src/tournaments/TournamentMap.tsx. ----
  const wcagContrastVsWhite = (hex: string): number => {
    const ch = hex.replace('#', '').match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return 1.05 / (L + 0.05);
  };
  const cadenceColors = { classic: '#2e7d5b', rapid: '#8b6914', blitz: '#9c4dcc' };
  for (const [name, hex] of Object.entries(cadenceColors)) {
    const ratio = wcagContrastVsWhite(hex);
    console.log(`CADENCE pill contrast (${name}=${hex}): ${ratio.toFixed(2)}:1`);
    expect(ratio, `cadence pill ${name} (${hex}) must meet WCAG-AA 4.5:1`).toBeGreaterThanOrEqual(4.5);
  }

  // ---- Final error tallies ----
  const appErrs = consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', appErrs);
  expect(pageErrors).toEqual([]);
});
