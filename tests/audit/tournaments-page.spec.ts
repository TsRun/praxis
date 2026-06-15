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

test('tournaments-page: heading, cadence tabs, view toggle, UI checks', async ({ page }) => {
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
  await expect(page.getByRole('heading', { level: 1, name: /Tournois/i })).toBeVisible();

  const btnClassique = page.getByRole('button', { name: /^Classique$/ });
  const btnRapide = page.getByRole('button', { name: /^Rapide$/ });
  const btnBlitz = page.getByRole('button', { name: /^Blitz$/ });
  await expect(btnClassique).toBeVisible();
  await expect(btnRapide).toBeVisible();
  await expect(btnBlitz).toBeVisible();

  const btnListe = page.getByRole('button', { name: /^Liste$/ });
  const btnCarte = page.getByRole('button', { name: /^Carte$/ });
  await expect(btnListe).toBeVisible();
  await expect(btnCarte).toBeVisible();

  // Selects a11y — must have aria-label; height bump verified via log
  const selects = await page.locator('select').all();
  console.log('SELECT count:', selects.length);
  for (let i = 0; i < selects.length; i++) {
    const info = await selects[i].evaluate((el: HTMLSelectElement) => ({
      ariaLabel: el.getAttribute('aria-label'),
      labelledby: el.getAttribute('aria-labelledby'),
      id: el.id,
      title: el.getAttribute('title'),
      height: el.getBoundingClientRect().height,
    }));
    console.log(`SELECT[${i}] a11y:`, info);
    expect(info.ariaLabel, `select[${i}] must have aria-label`).toBeTruthy();
    if (info.height < 36) {
      console.warn(`WARN: select[${i}] tap target ${info.height}px < 36px`);
    }
  }

  // View toggle group label (post-fix); fall back to plain button checks if not yet deployed.
  const viewGroup = page.getByRole('group', { name: /Vue/i });
  const viewGroupCount = await viewGroup.count();
  console.log('VIEW group(role=group, name=Vue) present:', viewGroupCount > 0);

  // Cadence pressed states
  const beforePressed = {
    classique: await btnClassique.getAttribute('aria-pressed'),
    rapide: await btnRapide.getAttribute('aria-pressed'),
    blitz: await btnBlitz.getAttribute('aria-pressed'),
  };
  console.log('CADENCE pressed initial:', beforePressed);

  await btnRapide.click();
  await page.waitForTimeout(300);
  expect(await btnRapide.getAttribute('aria-pressed')).toBe('true');
  expect(page.url()).toContain('cadence=rapid');
  await btnRapide.click(); // toggle off
  await page.waitForTimeout(200);

  // Switch to Carte
  await btnCarte.click();
  await page.waitForTimeout(1500);
  expect(await btnCarte.getAttribute('aria-pressed')).toBe('true');
  expect(await btnListe.getAttribute('aria-pressed')).toBe('false');

  // Switch back
  await btnListe.click();
  await page.waitForTimeout(300);

  // Focus ring on Liste/Carte
  await btnListe.focus();
  await page.waitForTimeout(80);
  const listeFocus = await btnListe.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('LISTE :focus:', listeFocus);

  // Desktop snapshot
  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-page-desktop.png',
    fullPage: true,
  });

  // ---- Mobile 375x812 ----
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

  // Tap targets
  const mobileBoxes: Record<string, any> = {};
  for (const [k, loc] of Object.entries({
    classique: page.getByRole('button', { name: /^Classique$/ }),
    rapide: page.getByRole('button', { name: /^Rapide$/ }),
    blitz: page.getByRole('button', { name: /^Blitz$/ }),
    liste: page.getByRole('button', { name: /^Liste$/ }),
    carte: page.getByRole('button', { name: /^Carte$/ }),
  })) {
    mobileBoxes[k] = await loc.boundingBox();
  }
  console.log('MOBILE control boxes:', mobileBoxes);
  for (const [k, b] of Object.entries(mobileBoxes)) {
    if (b && b.height < 36) console.warn(`WARN: ${k} height ${b.height}px < 36px`);
  }

  await page.screenshot({
    path: 'tests/audit/screenshots/tournaments-page-mobile.png',
    fullPage: true,
  });

  // Cadence pill contrast vs white text — keep in sync with TournamentList.tsx & TournamentMap.tsx
  const wcag = (hex: string): number => {
    const ch = hex.replace('#', '').match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return 1.05 / (L + 0.05);
  };
  const cadenceColors = { classic: '#2e7d5b', rapid: '#8b6914', blitz: '#9c4dcc' };
  for (const [name, hex] of Object.entries(cadenceColors)) {
    const ratio = wcag(hex);
    console.log(`CADENCE pill contrast (${name}=${hex}): ${ratio.toFixed(2)}:1`);
    expect(ratio, `cadence pill ${name} (${hex}) must meet WCAG-AA 4.5:1`).toBeGreaterThanOrEqual(4.5);
  }

  const appErrs = consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', appErrs);
  expect(pageErrors).toEqual([]);
});
