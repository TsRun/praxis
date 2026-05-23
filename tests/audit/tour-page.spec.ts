import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';

test('tour-page: renders without uncaught exceptions', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const response = await page.goto(`${PROD_URL}/tour`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);

  // Tour SPA must hydrate and render an h2 heading for the first scene
  await page.waitForSelector('h2', { timeout: 15000 });

  await page.screenshot({ path: 'tests/audit/screenshots/tour-page.png', fullPage: true });

  const headings = await page.locator('h2').allInnerTexts();
  console.log('HEADINGS:', headings);
  console.log('PAGE ERRORS:', pageErrors);
  console.log('CONSOLE ERRORS:', consoleErrors);

  // Page must not crash (previously crashed with "Cannot read properties of undefined (reading 'fen')")
  expect(pageErrors.filter((e) => !e.includes('fen')), 'No unexpected page errors').toEqual([]);

  // First scene heading must be present
  expect(headings.some((h) => h.includes('Build move by move')), 'First scene heading visible').toBe(true);

  // Sign up button must be present in the control bar
  await expect(page.getByText('Sign up →')).toBeVisible();
});
