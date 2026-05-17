import { test, expect } from '@playwright/test';

test('loads with board, table, and tree', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /OpeningTree/i })).toBeVisible();
  // Tree root + some children should appear
  await expect(page.locator('svg g.tree-node').first()).toBeVisible({ timeout: 10_000 });
  // Explorer table should have rows for first moves
  await expect(page.locator('tbody tr', { hasText: 'e4' }).first()).toBeVisible({
    timeout: 10_000,
  });
});

test('clicking a move in the table plays it and updates the URL', async ({ page }) => {
  await page.goto('/');
  await page.locator('tbody tr', { hasText: 'e4' }).first().click();
  await expect(page).toHaveURL(/fen=.*4P3/);
  await expect(page.getByText(/1\.e4/)).toBeVisible();
});

test('FEN search jumps to the Caro-Kann and ECO header shows B10', async ({ page }) => {
  await page.goto('/');
  await page
    .getByPlaceholder(/Paste FEN/)
    .fill('rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  await page.getByPlaceholder(/Paste FEN/).press('Enter');
  await expect(page.getByText(/Caro-Kann/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/B1\d/)).toBeVisible();
});

test('shareable URL restores state on reload', async ({ page }) => {
  const fen = 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  await page.goto(`/?fen=${encodeURIComponent(fen)}`);
  // ECO should resolve to Caro-Kann shortly after load
  await expect(page.getByText(/Caro-Kann/i)).toBeVisible({ timeout: 10_000 });
});
