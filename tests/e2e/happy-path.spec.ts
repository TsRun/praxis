import { test, expect } from '@playwright/test';

// Anonymous-only smoke. Vite serves the React app; the backend is mocked
// per request below so AuthContext.me() resolves to "no user" immediately.
// No DB, no real auth state — pure UI plumbing check.

test.beforeEach(async ({ page }) => {
  // /api/auth/me is the first request the AuthProvider makes on mount.
  // Without this, the Vite proxy hangs and the app stays on "Loading…".
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'unauthenticated' }) }),
  );
});

test.describe('landing page', () => {
  test('hero, nav, and sign-in card render', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.wordmark').first()).toContainText(/Praxis/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Coach, learn, drill\./ })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Take the 90s tour/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('you@studio.club')).toBeVisible();
  });

  test('Features anchor reveals the features section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Features', exact: true }).click();
    await expect(page).toHaveURL(/#features$/);
    await expect(
      page.getByRole('heading', { name: /Two modes\. The same calm workspace\./ }),
    ).toBeVisible();
  });

  test('Get started CTA jumps to the auth section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started' }).first().click();
    await expect(page).toHaveURL(/#auth$/);
    await expect(
      page.getByRole('heading', { name: /Sign up and start a study\./ }),
    ).toBeVisible();
  });
});

test.describe('sign-in / sign-up form', () => {
  test('toggling to Create account reveals nickname + role pills', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('form').filter({ hasText: 'Continue with Google' });

    // Default tab is Sign in: no Nickname, no role pills.
    await expect(form.getByPlaceholder('e.g. tactical_torre')).toHaveCount(0);
    await expect(form.getByRole('button', { name: /^Sign in →$/ })).toBeVisible();

    await form.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(form.getByPlaceholder('e.g. tactical_torre')).toBeVisible();
    await expect(form.getByRole('button', { name: /^Create account →$/ })).toBeVisible();
    await expect(form.getByRole('button', { name: /Trainer/ })).toBeVisible();
    await expect(form.getByRole('button', { name: /Student/ })).toBeVisible();
    await expect(form.getByRole('button', { name: /Solo/ })).toBeVisible();
  });

  test('Create account with no roles selected shows validation error', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('form').filter({ hasText: 'Continue with Google' });

    await form.getByRole('button', { name: 'Create account', exact: true }).click();
    // Trainer is selected by default — deselect it so the role set is empty.
    await form.getByRole('button', { name: /Trainer/ }).click();
    await form.getByRole('button', { name: /^Create account →$/ }).click();

    await expect(form.getByText('Pick at least one role.')).toBeVisible();
  });
});

test.describe('tour page', () => {
  test('Take the 90s tour navigates to /tour and shows control bar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Take the 90s tour/i }).click();
    await expect(page).toHaveURL(/\/tour$/);
    await expect(page.locator('.wordmark').first()).toContainText(/Praxis/);
    // Tour starts on scene 0 — Back is disabled, Next enabled.
    await expect(page.getByRole('button', { name: /Back/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Next/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^(⏸ Pause|▶ Play)$/ })).toBeVisible();
  });

  test('Next advances scene and enables Back', async ({ page }) => {
    // Visit / first then click into /tour — a direct page.goto('/tour') races
    // with BuildScene's tour-script module init and the test can land on a
    // crashed page.
    await page.goto('/');
    await page.getByRole('link', { name: /Take the 90s tour/i }).click();
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(page.getByRole('button', { name: /Back/ })).toBeEnabled();
  });

  test('Skip link returns to landing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Take the 90s tour/i }).click();
    await page.getByRole('link', { name: 'Skip' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });
});

test.describe('route guards (unauthenticated)', () => {
  // AuthContext rejects without a backend → user stays null → these routes
  // bounce back to the landing page.

  test('/role-picker without a user redirects to /', async ({ page }) => {
    await page.goto('/role-picker');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });

  test('/trainer/studies without auth redirects to /', async ({ page }) => {
    await page.goto('/trainer/studies');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });

  test('/student/dashboard without auth redirects to /', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });

  test('/settings without auth redirects to /', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });

  test('unknown route redirects to /', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Build chess studies\./ })).toBeVisible();
  });
});
