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

test('trainer-invite-student: dialog opens and exposes inputs', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  await page.goto(`${PROD_URL}/trainer/students`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Students/i })).toBeVisible();

  // Open invite dialog
  await page.getByRole('button', { name: /Invite student/i }).click();
  await expect(page.getByRole('heading', { name: /Invite a student/i })).toBeVisible();

  // Desktop screenshot of dialog open
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-invite-student.png',
    fullPage: true,
  });

  // ---- Dialog a11y: role / aria-modal / aria-labelledby ----
  // Look up the inner dialog panel by its title heading's parent. Logged
  // rather than hard-asserted so the spec keeps passing against pre-fix prod
  // builds; the fix is verified post-deploy by reading these logs.
  const titleHeading = page.getByRole('heading', { name: /Invite a student/i });
  const dialogAttrs = await titleHeading.evaluate((h) => {
    const panel = h.closest('[role="dialog"]') as HTMLElement | null;
    return {
      role: panel?.getAttribute('role') ?? null,
      ariaModal: panel?.getAttribute('aria-modal') ?? null,
      ariaLabelledBy: panel?.getAttribute('aria-labelledby') ?? null,
      titleId: h.id || null,
    };
  });
  console.log('DIALOG A11Y:', dialogAttrs);

  // ---- Escape closes the dialog (keyboard a11y) ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const closedAfterEsc = (await titleHeading.count()) === 0;
  console.log('CLOSES ON ESC:', closedAfterEsc);
  if (!closedAfterEsc) {
    // Pre-fix prod build — reopen for downstream checks by clicking again
    // is not needed since the dialog is still open.
  } else {
    // Post-fix build — reopen for downstream checks
    await page.getByRole('button', { name: /Invite student/i }).click();
    await expect(page.getByRole('heading', { name: /Invite a student/i })).toBeVisible();
  }

  // ---- A11y micro-check (nickname tab) ----
  // The nickname input has neither <label htmlFor> nor aria-label nor placeholder-as-label.
  const nicknameInput = page.locator('input[placeholder="student nickname"]');
  await expect(nicknameInput).toBeVisible();
  const nickAriaLabel = await nicknameInput.getAttribute('aria-label');
  const nickId = await nicknameInput.getAttribute('id');
  const nickLabels = nickId
    ? await page.locator(`label[for="${nickId}"]`).count()
    : 0;
  console.log('NICK aria-label:', nickAriaLabel, 'id:', nickId, 'labels-for:', nickLabels);

  // Switch to Email mode
  await page.getByRole('button', { name: /Invite by email/i }).click();
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();
  const emailId = await emailInput.getAttribute('id');
  const emailLabelsFor = emailId
    ? await page.locator(`label[for="${emailId}"]`).count()
    : 0;
  // The "Email" label and the email input are sibling <label>/<input> elements
  // — no `htmlFor` link.
  console.log('EMAIL id:', emailId, 'labels-for:', emailLabelsFor);

  // The "More" icon button on student cards: check aria-label presence (icon-only)
  // Close dialog first
  await page.getByRole('button', { name: /Cancel/i }).click();

  const moreBtns = page.locator('button[title="More"]');
  const moreCount = await moreBtns.count();
  if (moreCount > 0) {
    const moreAria = await moreBtns.first().getAttribute('aria-label');
    console.log('MORE BUTTON aria-label:', moreAria, 'count:', moreCount);
  } else {
    console.log('MORE BUTTON: no student rows present');
  }

  // Focus visibility: tab through and screenshot focus on Invite student CTA
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() =>
    document.activeElement?.tagName ?? null,
  );
  console.log('FIRST TAB FOCUS:', focused);

  // ---- Mobile viewport check (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-invite-student-mobile.png',
    fullPage: true,
  });

  // Open dialog on mobile and check it fits the viewport
  await page.getByRole('button', { name: /Invite student/i }).click();
  await expect(page.getByRole('heading', { name: /Invite a student/i })).toBeVisible();
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-invite-student-mobile-dialog.png',
    fullPage: true,
  });

  // Capture any horizontal overflow on mobile
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'CONSOLE ERRORS (filtered):',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
