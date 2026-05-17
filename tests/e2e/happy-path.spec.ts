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

test('clicking a candidate plays the move and adds it to the move list', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: 'e4' }).first().click();
  await expect(page.getByText(/1\.e4/)).toBeVisible();
});

test('localStorage survives reload and arrow-nav still works', async ({ page }) => {
  await page.goto('/');
  // Play a few moves
  await page.locator('button', { hasText: 'e4' }).first().click();
  await expect(page.getByText(/1\.e4/)).toBeVisible();
  // Reload — state should restore from localStorage
  await page.reload();
  await expect(page.getByText(/1\.e4/)).toBeVisible({ timeout: 5_000 });
  // Arrow back should now go to ply 0 (visible by absence of an "active" amber ply)
  await page.keyboard.press('ArrowLeft');
  // After stepping back, the move list still has 1.e4 but no row is current —
  // and the explorer header reverts to "White to play".
  await expect(page.getByRole('heading', { name: /White to play/i })).toBeVisible();
});

test('player filter narrows the move list', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/Search player/i).fill('Carlsen');
  const suggestion = page.locator('button', { hasText: /Carlsen, Magnus/ }).first();
  await expect(suggestion).toBeVisible({ timeout: 5_000 });
  await suggestion.click();
  await expect(page.locator('text=NOR')).toBeVisible();
});
