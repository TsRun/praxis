import { test, expect } from '@playwright/test';

test('loads with board and move-selection list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /OpeningTree/i })).toBeVisible();
  // Side-to-move header should appear after the explorer responds
  await expect(page.getByRole('heading', { name: /to play/i })).toBeVisible({
    timeout: 10_000,
  });
  // Top move row for the start position
  await expect(page.locator('button', { hasText: 'e4' }).first()).toBeVisible({
    timeout: 10_000,
  });
});

test('clicking a candidate plays the move and updates the URL', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'e4' }).first().click();
  await expect(page).toHaveURL(/fen=.*4P3/);
  await expect(page.getByText(/1\.e4/)).toBeVisible();
});

test('FEN search jumps to the Caro-Kann and ECO header shows B1x', async ({ page }) => {
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
  await expect(page.getByText(/Caro-Kann/i)).toBeVisible({ timeout: 10_000 });
});
