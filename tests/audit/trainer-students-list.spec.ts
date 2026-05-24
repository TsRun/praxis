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

test('trainer-students-list: renders heading, filter, and search', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/trainer/students`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^Students$/ })).toBeVisible();

  // Filter tabs should render
  await expect(page.getByRole('button', { name: /^All$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Linked$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Invited$/ })).toBeVisible();

  // Desktop screenshot
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-list.png',
    fullPage: true,
  });

  // ---- A11y micro-check on actually-rendered elements ----

  // Search input: any accessible name?
  const search = page.locator('input[placeholder="Find by nickname…"]');
  await expect(search).toBeVisible();
  const searchInfo = await search.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    const ariaDescribedby = el.getAttribute('aria-describedby');
    const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
    const wrappingLabel = el.closest('label')?.textContent?.trim() ?? null;
    return {
      id,
      ariaLabel,
      ariaLabelledby,
      ariaDescribedby,
      labelsFor,
      wrappingLabel,
      placeholder: el.placeholder,
      type: el.type,
    };
  });
  console.log('SEARCH INPUT a11y:', searchInfo);

  // Filter buttons: do they expose pressed state?
  const filterBtns = page.locator('.segmented button');
  const filterCount = await filterBtns.count();
  const filterInfo = await filterBtns.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      return {
        text: el.textContent?.trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaSelected: el.getAttribute('aria-selected'),
        role: el.getAttribute('role'),
        active: el.classList.contains('active'),
      };
    }),
  );
  console.log('FILTER BUTTONS:', filterInfo);

  // Filter container: role?
  const segContainer = page.locator('.segmented').first();
  const segInfo = await segContainer.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
    tag: el.tagName,
  }));
  console.log('FILTER CONTAINER:', segInfo);

  // Stats span: "{n} students" — is it announced when filter changes? It's a plain span.
  const countSpan = page.locator('.meta', { hasText: /\bstudents\b/ }).last();
  const countSpanInfo = await countSpan
    .evaluate((el) => ({
      role: el.getAttribute('role'),
      ariaLive: el.getAttribute('aria-live'),
      text: el.textContent?.trim() ?? '',
    }))
    .catch(() => null);
  console.log('COUNT SPAN:', countSpanInfo);

  // "More" icon button on student cards (if any rows)
  const moreBtns = page.locator('button[title="More"]');
  const moreCount = await moreBtns.count();
  if (moreCount > 0) {
    const moreInfo = await moreBtns.first().evaluate((el) => ({
      title: el.getAttribute('title'),
      ariaLabel: el.getAttribute('aria-label'),
      textContent: el.textContent?.trim() ?? '',
    }));
    console.log('MORE BUTTON:', moreInfo, 'count:', moreCount);
  } else {
    console.log('MORE BUTTON: no rows rendered');
  }

  // Search input focus indicator
  await search.focus();
  await page.waitForTimeout(80);
  const searchFocus = await search.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('SEARCH :focus styles:', searchFocus);

  // Tab order: confirm we can keyboard-reach the filter buttons + Invite CTA
  await page.keyboard.press('Tab');
  const after1 = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    text: document.activeElement?.textContent?.trim()?.slice(0, 40) ?? null,
  }));
  console.log('TAB FROM SEARCH:', after1);

  // ---- Mobile viewport check (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-students-list-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // On mobile, the filter row crowds. Capture the filter row position.
  const filterRowBox = await page
    .locator('.segmented')
    .first()
    .boundingBox()
    .catch(() => null);
  console.log('MOBILE FILTER ROW BOX:', filterRowBox);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter(
      (e) => !e.includes('Failed to load resource'),
    ),
  );

  expect(pageErrors).toEqual([]);
});
