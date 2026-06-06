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

test('trainer-games-browser: renders sources, filters, and inputs', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/trainer/games`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^Browse games$/ })).toBeVisible();

  // Source tabs should render
  await expect(page.getByRole('button', { name: /^Chess\.com$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lichess$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Database$/ })).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-games-browser.png',
    fullPage: true,
  });

  // ---- A11y micro-check on actually-rendered elements ----

  // SourceTabs Segmented — role + name on the container?
  const segContainers = page.locator('.segmented');
  const segCount = await segContainers.count();
  console.log('SEGMENTED COUNT:', segCount);
  const sourceSeg = segContainers.first();
  const sourceSegInfo = await sourceSeg.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('SOURCE SEGMENTED container:', sourceSegInfo);

  // Source buttons — aria-pressed?
  const sourceBtns = sourceSeg.locator('button');
  const sourceBtnInfo = await sourceBtns.evaluateAll((nodes) =>
    nodes.map((b) => ({
      text: (b.textContent || '').trim(),
      ariaPressed: b.getAttribute('aria-pressed'),
      ariaLabel: b.getAttribute('aria-label'),
      active: b.classList.contains('active'),
    })),
  );
  console.log('SOURCE BUTTONS:', sourceBtnInfo);

  // Chess.com username input a11y (default source = chesscom)
  const ccInput = page.locator('input[placeholder="e.g. Hikaru"]');
  await expect(ccInput).toBeVisible();
  const ccInfo = await ccInput.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
    const wrappingLabel = el.closest('label')?.textContent?.trim() ?? null;
    const cs = getComputedStyle(el);
    return {
      id,
      ariaLabel,
      ariaLabelledby,
      labelsFor,
      wrappingLabel,
      placeholder: el.placeholder,
      type: el.type,
      hasOutlineNone: cs.outline === 'none' || cs.outlineStyle === 'none',
    };
  });
  console.log('CC USERNAME INPUT a11y:', ccInfo);

  // Focus the cc input — does any focus indicator appear?
  await ccInput.focus();
  await page.waitForTimeout(80);
  const ccFocus = await ccInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('CC INPUT :focus styles:', ccFocus);

  // Switch to Database source — exposes Player + Year + ECO + Min Elo inputs
  await page.getByRole('button', { name: /^Database$/ }).click();
  await page.waitForTimeout(150);

  const playerInput = page.locator('input[placeholder="e.g. Carlsen"]');
  await expect(playerInput).toBeVisible();
  const playerInfo = await playerInput.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    return {
      id,
      ariaLabel: el.getAttribute('aria-label'),
      ariaLabelledby: el.getAttribute('aria-labelledby'),
      labelsFor: id ? document.querySelectorAll(`label[for="${id}"]`).length : 0,
      wrappingLabel: el.closest('label')?.textContent?.trim() ?? null,
      placeholder: el.placeholder,
      type: el.type,
    };
  });
  console.log('PLAYER INPUT a11y:', playerInfo);

  // ECO input
  const ecoInput = page.locator('input[placeholder="Sicilian, B22, …"]');
  const ecoInfo = await ecoInput.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    return {
      id,
      ariaLabel: el.getAttribute('aria-label'),
      labelsFor: id ? document.querySelectorAll(`label[for="${id}"]`).length : 0,
      wrappingLabel: el.closest('label')?.textContent?.trim() ?? null,
    };
  });
  console.log('ECO INPUT a11y:', ecoInfo);

  // Min Elo input
  const minEloInput = page.locator('input[placeholder="e.g. 2000"]');
  const minEloInfo = await minEloInput.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    return {
      id,
      ariaLabel: el.getAttribute('aria-label'),
      labelsFor: id ? document.querySelectorAll(`label[for="${id}"]`).length : 0,
      wrappingLabel: el.closest('label')?.textContent?.trim() ?? null,
      type: el.type,
    };
  });
  console.log('MIN ELO INPUT a11y:', minEloInfo);

  // Year from / Year to inputs
  const yearFrom = page.locator('input[placeholder="1900"]');
  const yearFromInfo = await yearFrom.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    return {
      id,
      ariaLabel: el.getAttribute('aria-label'),
      labelsFor: id ? document.querySelectorAll(`label[for="${id}"]`).length : 0,
      wrappingLabel: el.closest('label')?.textContent?.trim() ?? null,
      type: el.type,
    };
  });
  console.log('YEAR FROM INPUT a11y:', yearFromInfo);

  // ECO input focus — does it show focus ring?
  await ecoInput.focus();
  await page.waitForTimeout(80);
  const ecoFocus = await ecoInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('ECO INPUT :focus styles:', ecoFocus);

  // The position-mode Segmented (Free editor / Play moves)
  const posSeg = segContainers.nth(1);
  const posSegInfo = await posSeg.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
  })).catch(() => null);
  console.log('POSITION MODE SEGMENTED:', posSegInfo);

  // Filters details summary — disclosure state
  const filterSummary = page.locator('summary', { hasText: /^Filters$/ });
  const filterDetailsInfo = await filterSummary.evaluate((el) => {
    const det = el.closest('details') as HTMLDetailsElement | null;
    return {
      summaryText: el.textContent?.trim() ?? '',
      open: det?.open ?? null,
    };
  });
  console.log('FILTERS DETAILS:', filterDetailsInfo);

  // The "Find games passing through this position" checkbox — wrapping label?
  const posCheckLabel = page.locator('label', {
    hasText: /Find games passing through this position/,
  });
  const posCheckInfo = await posCheckLabel.evaluate((el) => ({
    tag: el.tagName,
    text: el.textContent?.trim() ?? '',
    hasCheckbox: !!el.querySelector('input[type="checkbox"]'),
  }));
  console.log('POSITION CHECKBOX label:', posCheckInfo);

  // Search button enabled state on Chess.com with empty username
  await page.getByRole('button', { name: /^Chess\.com$/ }).click();
  await page.waitForTimeout(100);
  const searchBtn = page.getByRole('button', { name: /^Search$/ });
  const searchBtnInfo = await searchBtn.evaluate((el: HTMLButtonElement) => ({
    disabled: el.disabled,
    ariaDisabled: el.getAttribute('aria-disabled'),
    text: el.textContent?.trim() ?? '',
    title: el.getAttribute('title'),
  }));
  console.log('SEARCH BUTTON (cc empty):', searchBtnInfo);

  // ---- Mobile viewport check (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-games-browser-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // On mobile, does the source-tabs Segmented fit?
  const mobileSourceBox = await sourceSeg.boundingBox().catch(() => null);
  console.log('MOBILE SOURCE SEGMENTED BOX:', mobileSourceBox);

  // On mobile, the import-grid: does it stack?
  const importGridBox = await page.locator('.grid-import-page').boundingBox().catch(() => null);
  console.log('MOBILE IMPORT GRID BOX:', importGridBox);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
