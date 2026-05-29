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

test('trainer-import-lichess: dialog opens and exposes inputs', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.startsWith('Failed to load resource:')) return;
      consoleErrors.push(t);
    }
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  await page.goto(`${PROD_URL}/trainer/studies`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Studies/i }).first()).toBeVisible();

  // ---- Click "Import from Lichess" ----
  await page.getByRole('button', { name: /Import from Lichess/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The first stage is the NewOpeningStudyDialog with lichessHint=true.
  // Title should read "Import from Lichess" (not "New opening study").
  const dialogTitle = await dialog.locator('h2').first().innerText();
  console.log('DIALOG TITLE:', dialogTitle);

  // Dialog a11y: aria-label, aria-modal, aria-labelledby
  const dialogAttrs = await dialog.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaModal: el.getAttribute('aria-modal'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledBy: el.getAttribute('aria-labelledby'),
  }));
  console.log('DIALOG A11Y:', dialogAttrs);

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-import-lichess.png',
    fullPage: true,
  });

  // ---- Name input ----
  const nameInput = dialog.locator('input.input').first();
  await expect(nameInput).toBeVisible();
  const nameInfo = await nameInput.evaluate((el) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    const labelFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
    const wrap = el.closest('label');
    const wrapTxt = wrap ? (wrap.textContent || '').trim().slice(0, 60) : null;
    return { id, ariaLabel, ariaLabelledBy, labelFor, wrapTxt };
  });
  console.log('NAME INPUT a11y:', nameInfo);

  // ---- CTA ----
  // With lichessHint=true the CTA reads "Create + import PGN →"
  const cta = dialog.getByRole('button', { name: /Create \+ import PGN/i });
  await expect(cta).toBeVisible();
  const ctaDisabledEmpty = await cta.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CTA DISABLED (empty name):', ctaDisabledEmpty);

  await nameInput.fill('Audit import test');
  const ctaDisabledFilled = await cta.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CTA DISABLED (filled name):', ctaDisabledFilled);

  // ---- Close button on header ----
  const closeBtn = dialog.locator('button[aria-label="Close"]');
  await expect(closeBtn).toHaveCount(1);
  const closeBox = await closeBtn.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height) };
  });
  console.log('CLOSE BUTTON BOX:', closeBox);

  // ---- Hint paragraph mentions PGN ----
  const hintTxt = await dialog.locator('p.meta').first().innerText().catch(() => '');
  console.log('HINT TEXT:', hintTxt.slice(0, 200));

  // ---- Side picker buttons ----
  const sideButtons = dialog.locator('button[aria-pressed]');
  const sideCount = await sideButtons.count();
  console.log('SIDE BUTTONS count:', sideCount);

  // Keyboard focus: tab from name input. The autoFocus puts cursor on the
  // name input. Press Tab once — should land on first side option.
  await nameInput.focus();
  await page.keyboard.press('Tab');
  const tabbedTo = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    return {
      tag: a.tagName,
      ariaPressed: a.getAttribute('aria-pressed'),
      text: (a.textContent || '').trim().slice(0, 40),
      matchesFocusVisible: a.matches(':focus-visible'),
    };
  });
  console.log('TABBED-TO from name input:', tabbedTo);

  const firstSide = sideButtons.first();
  const firstSideFocusStyles = await firstSide.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('SIDE OPTION (first) focus styles:', firstSideFocusStyles);

  // ---- Escape closes ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const closedAfterEsc = (await page.getByRole('dialog').count()) === 0;
  console.log('CLOSES ON ESC:', closedAfterEsc);
  if (!closedAfterEsc) {
    // Pre-fix or unrelated — leave dialog as-is for the mobile pass below.
  }

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);

  // Reopen if needed
  if ((await page.getByRole('dialog').count()) === 0) {
    await page.getByRole('button', { name: /Import from Lichess/i }).click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-import-lichess-mobile.png',
    fullPage: true,
  });

  const dlg = page.getByRole('dialog');
  const dlgBox = await dlg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
    };
  });
  console.log('MOBILE DIALOG BOX:', dlgBox, 'viewport 375');

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // Side option button heights at mobile
  const mobileSideBtns = dlg.locator('button[aria-pressed]');
  const mobileSideInfos: Array<any> = [];
  for (const b of await mobileSideBtns.all()) {
    const info = await b.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    mobileSideInfos.push(info);
  }
  console.log('MOBILE SIDE BUTTON RECTS:', mobileSideInfos);

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);

  expect(pageErrors).toEqual([]);
});
