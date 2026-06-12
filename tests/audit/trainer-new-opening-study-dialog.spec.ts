import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';
const EMAIL = process.env.PRAXIS_BOT_EMAIL || 'claude.bot@gmail.com';
const PASSWORD = process.env.PRAXIS_BOT_PASSWORD || 'Claudebot';

test('trainer-new-opening-study-dialog: UI/a11y audit', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.startsWith('Failed to load resource:')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // ---- Sign in ----
  await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in →/ }).click();
  await page.waitForURL(/\/trainer\/studies/, { timeout: 15000 });
  await page.waitForSelector('h1, h2', { timeout: 15000 });

  // ---- Open New study menu → Opening study ----
  await page.getByRole('button', { name: /New study/i }).first().click();
  await page.getByRole('menuitem', { name: /Opening study/i }).first().click();

  const dialog = page.getByRole('dialog', { name: /new opening study/i });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Desktop screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-opening-study-dialog.png',
    fullPage: false,
  });

  // ---- Name input a11y ----
  const nameInput = dialog.locator('input.input').first();
  const nameInfo = await nameInput.evaluate((el) => {
    const i = el as HTMLInputElement;
    const wrappingLabel = i.closest('label');
    return {
      id: i.id || null,
      ariaLabel: i.getAttribute('aria-label'),
      placeholder: i.placeholder,
      wrappingLabelText: wrappingLabel ? (wrappingLabel.textContent || '').trim() : null,
    };
  });
  console.log('NAME INPUT:', nameInfo);

  await nameInput.focus();
  const nameFocus = await nameInput.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
    };
  });
  console.log('NAME INPUT :focus styles:', nameFocus);

  // ---- Side radiogroup a11y ----
  const radioGroup = dialog.locator('[role="radiogroup"]');
  const rgInfo = await radioGroup.evaluate((el) => {
    const labelId = el.getAttribute('aria-labelledby');
    const labelEl = labelId ? document.getElementById(labelId) : null;
    return {
      ariaLabelledBy: labelId,
      labelText: labelEl ? (labelEl.textContent || '').trim() : null,
      radioCount: el.querySelectorAll('input[type="radio"]').length,
    };
  });
  console.log('RADIO GROUP:', rgInfo);

  // Side option labels (visible)
  const sideLabels = dialog.locator('label.role-pick');
  const sideCount = await sideLabels.count();
  console.log('SIDE LABEL count:', sideCount);
  const sideInfos = [];
  for (let i = 0; i < sideCount; i++) {
    const info = await sideLabels.nth(i).evaluate((el) => {
      const title = el.querySelector('div')?.textContent?.trim() || '';
      const hint = el.querySelectorAll('div')[1]?.textContent?.trim() || '';
      const radio = el.querySelector('input[type="radio"]') as HTMLInputElement | null;
      const cs = getComputedStyle(el);
      return {
        title,
        hint,
        radioValue: radio?.value || null,
        radioChecked: !!radio?.checked,
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
      };
    });
    sideInfos.push(info);
  }
  console.log('SIDE OPTIONS:', sideInfos);

  // Keyboard nav from name input → next focusable should be the W radio
  await nameInput.focus();
  await page.keyboard.press('Tab');
  const tabbedTo = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return null;
    const cs = getComputedStyle(a);
    return {
      tag: a.tagName,
      type: (a as HTMLInputElement).type || null,
      value: (a as HTMLInputElement).value || null,
      matchesFocusVisible: a.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('TAB stop 1 (after Name input):', tabbedTo);

  // The radio is visually hidden — verify the side-option label visually
  // updates on focus/selection (i.e. there's any visible cue).
  const blackInputSelector = 'input[type="radio"][value="b"]';
  await dialog.locator(blackInputSelector).focus();
  const blackLabelStyleOnFocus = await dialog
    .locator('label.role-pick')
    .nth(1)
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
      };
    });
  console.log('Black label style (with black radio focused):', blackLabelStyleOnFocus);

  // Pick black via keyboard space
  await page.keyboard.press('Space');
  const blackCheckedAfterSpace = await dialog
    .locator(blackInputSelector)
    .evaluate((el) => (el as HTMLInputElement).checked);
  console.log('BLACK CHECKED AFTER Space:', blackCheckedAfterSpace);

  // Back to white
  await dialog.locator('input[type="radio"][value="w"]').focus();
  await page.keyboard.press('Space');

  // ---- Move list empty hint ----
  const hint = dialog.locator('text=/Standard start — drag a piece to set a prefix/i');
  await expect(hint).toBeVisible();
  const hintStyle = await hint.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, fontSize: s.fontSize };
  });
  console.log('MOVE LIST HINT:', hintStyle);

  // ---- Create button enablement ----
  const createBtn = dialog.getByRole('button', { name: /^create study$/i });
  await nameInput.fill('');
  const disabledEmpty = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  await nameInput.fill('Audit probe — Caro-Kann');
  const disabledFilled = await createBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log('CREATE BTN disabled empty/filled:', disabledEmpty, disabledFilled);

  // ---- Dialog close button (Dialog component renders one in the header) ----
  const closeBtn = dialog
    .locator('button')
    .filter({ has: page.locator('svg, span:has-text("×")') })
    .first();
  const closeInfo = await closeBtn
    .evaluate((el) => ({
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim(),
    }))
    .catch(() => null);
  console.log('CLOSE BUTTON:', closeInfo);

  // ---- Mobile viewport ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-new-opening-study-dialog-mobile.png',
    fullPage: false,
  });

  const dialogBoxMobile = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    };
  });
  console.log('MOBILE DIALOG BOX:', dialogBoxMobile, 'viewport 375x812');

  // Side option rect on mobile
  const mobileSideRects = [];
  for (let i = 0; i < sideCount; i++) {
    const info = await sideLabels.nth(i).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    });
    mobileSideRects.push(info);
  }
  console.log('MOBILE side-option rects:', mobileSideRects);

  // Footer reachable?
  const createBoxMobile = await createBtn.boundingBox();
  console.log('MOBILE create btn box:', createBoxMobile);

  // Stacking: the sticky footer must paint ABOVE the chessground pieces.
  // chessground sets piece z-index: 11 !important; if the board wrapper
  // doesn't create its own stacking context, those pieces escape and end up
  // on top of the footer, swallowing button clicks at overlap points.
  if (createBoxMobile) {
    const cx = Math.round(createBoxMobile.x + createBoxMobile.width / 2);
    const cy = Math.round(createBoxMobile.y + createBoxMobile.height / 2);
    const topmost = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        if (!el) return null;
        const btn = el.closest('button');
        return {
          tag: el.tagName,
          className: el.className?.toString?.() || '',
          insideFooterButton: !!btn && /create study|cancel/i.test(btn.textContent || ''),
        };
      },
      { x: cx, y: cy },
    );
    console.log('TOPMOST AT CREATE-BTN CENTER (mobile):', topmost);
  }

  // ---- Close ----
  await dialog.getByRole('button', { name: /^cancel$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 3000 });

  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', consoleErrors);

  expect(pageErrors, 'no uncaught page errors').toEqual([]);
});
