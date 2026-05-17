import { test, expect } from '@playwright/test';

test('loads with board and move-selection list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /OpeningTree/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /to play/i })).toBeVisible({
    timeout: 10_000,
  });
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

test('shareable URL restores state on reload', async ({ page }) => {
  const fen = 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  await page.goto(`/?fen=${encodeURIComponent(fen)}`);
  await expect(page.getByText(/Caro-Kann/i)).toBeVisible({ timeout: 10_000 });
});

test('player filter narrows the move list', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/Search player/i).fill('Carlsen');
  // Wait for the suggestions dropdown
  const suggestion = page.locator('button', { hasText: /Carlsen, Magnus/ }).first();
  await expect(suggestion).toBeVisible({ timeout: 5_000 });
  await suggestion.click();
  // Pill appears
  await expect(page.locator('text=NOR')).toBeVisible();
  // The candidate count should now reflect Carlsen's games (way fewer than the total DB)
  await expect(page.getByText(/121\s*games/i)).toBeVisible({ timeout: 5_000 });
});
