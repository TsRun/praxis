import { test, expect } from '@playwright/test';

// Smoke for the Tournaments tab. Backend is mocked per request (no DB): the
// AuthProvider sees a signed-in trainer, and the tournaments endpoints return
// a fixed payload so we can assert the list, the cadence filter, and the
// list/map toggle render.

const sample = [
  {
    id: 1, name: 'Open International de Test', url: 'https://ratings.fide.com/tournament_information.phtml?event=1',
    country: 'FRA', location: 'PARIS', region: 'Île-de-France', department: 'Paris (75)',
    lat: 48.85, lon: 2.35, start_date: '2026-06-12', end_date: '2026-06-20',
    players: 120, cadence: 'classic', time_control: 'Standard: 90 min',
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: 'coach@test.dev', name: 'Coach', roles: ['trainer'] }),
    }),
  );
  await page.route('**/api/tournaments/regions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['Île-de-France']) }),
  );
  await page.route('**/api/tournaments?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sample) }),
  );
});

test('signed-in user browses tournaments and toggles list/map', async ({ page }) => {
  await page.goto('/tournaments');

  await expect(page.getByRole('heading', { name: 'Tournois' })).toBeVisible();
  await expect(page.getByText('Open International de Test')).toBeVisible();

  // Toggle to the map (lazy-loaded chunk) and back.
  await page.getByRole('button', { name: 'Carte' }).click();
  await expect(page.locator('svg[aria-label="Carte des tournois en France"]')).toBeVisible();
  await page.getByRole('button', { name: 'Liste' }).click();
  await expect(page.getByText('Open International de Test')).toBeVisible();
});

test('cadence filter and region select are present', async ({ page }) => {
  await page.goto('/tournaments');
  await expect(page.getByRole('button', { name: 'Rapide' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blitz' })).toBeVisible();
  await expect(page.getByLabel('Région')).toBeVisible();
});
