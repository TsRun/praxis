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

test('trainer-studies-list: renders heading, stats, sections, with a11y/responsive checks', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/trainer/studies`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  // ---- Heading ----
  await page.waitForSelector('h1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^Studies$/ })).toBeVisible();

  // ---- Stat tiles (Btn group at top) ----
  // Visible labels in lower-cased "studies authored", "students linked", "chapters total"
  await expect(page.getByText(/studies authored/i)).toBeVisible();
  await expect(page.getByText(/students linked/i)).toBeVisible();
  await expect(page.getByText(/chapters total/i)).toBeVisible();

  // ---- Three sections rendered ----
  await expect(page.getByRole('heading', { name: /^Opening studies$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Game studies$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Tactical sets$/ })).toBeVisible();

  // Wait for at least one section to finish loading (no "Loading…" text in one of them)
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading…'),
    null,
    { timeout: 15000 },
  ).catch(() => {});

  // Desktop screenshot 1280
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-studies-list.png',
    fullPage: true,
  });

  // ---- A11y / structure checks ----

  // 1. Search input: any accessible name?
  const search = page.locator('input[placeholder="Find study by name or ECO…"]');
  await expect(search).toBeVisible();
  const searchInfo = await search.evaluate((el: HTMLInputElement) => {
    const id = el.id || null;
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    const labelsFor = id ? document.querySelectorAll(`label[for="${id}"]`).length : 0;
    const wrappingLabel = el.closest('label')?.textContent?.trim() ?? null;
    return {
      id,
      ariaLabel,
      ariaLabelledby,
      labelsFor,
      wrappingLabel,
      placeholder: el.placeholder,
    };
  });
  console.log('SEARCH INPUT a11y:', searchInfo);

  // 2. Search :focus indicator
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

  // 3. View toggle (grid/list) — these are icon-only buttons in a Segmented control
  //    Inspect the second .segmented group (the view toggle).
  const segGroups = page.locator('.segmented');
  const segCount = await segGroups.count();
  console.log('SEGMENTED GROUPS COUNT:', segCount);
  // Find the segmented group whose buttons have no visible text (the view toggle)
  const viewToggleInfo = await segGroups.evaluateAll((groups) =>
    groups.map((g, idx) => {
      const btns = Array.from(g.querySelectorAll('button')) as HTMLButtonElement[];
      return {
        idx,
        role: g.getAttribute('role'),
        ariaLabel: g.getAttribute('aria-label'),
        ariaLabelledby: g.getAttribute('aria-labelledby'),
        buttons: btns.map((b) => ({
          textContent: (b.textContent ?? '').trim(),
          ariaLabel: b.getAttribute('aria-label'),
          ariaPressed: b.getAttribute('aria-pressed'),
          title: b.getAttribute('title'),
          hasOnlySvg: b.children.length === 1 && b.children[0].tagName === 'svg',
        })),
      };
    }),
  );
  console.log('SEGMENTED groups:', JSON.stringify(viewToggleInfo, null, 2));

  // 4. Filter row Filter buttons (All / Opening / Game / Tactic)
  //    aria-pressed exposure?
  const filterButtons = page.locator('.segmented').first().locator('button');
  const filterInfo = await filterButtons.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      return {
        text: el.textContent?.trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        role: el.getAttribute('role'),
        active: el.classList.contains('active'),
      };
    }),
  );
  console.log('FILTER BUTTONS:', filterInfo);

  // 5. New study trigger should expose haspopup / expanded
  const newStudy = page.locator('#new-study-trigger');
  await expect(newStudy).toBeVisible();
  const newStudyInfo = await newStudy.evaluate((el) => ({
    ariaHaspopup: el.getAttribute('aria-haspopup'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'),
  }));
  console.log('NEW STUDY trigger a11y:', newStudyInfo);

  // 6. Empty add cards: "New opening study" "New game study" "New tactical set"
  //    These are <button>s with informative inner text — should be fine.
  //    Verify they exist:
  const emptyAdds = page.locator('button:has-text("New opening study"), button:has-text("New game study"), button:has-text("New tactical set")');
  const emptyAddsCount = await emptyAdds.count();
  console.log('EMPTY ADD CARDS count:', emptyAddsCount);

  // 7. Section counts — the "{n}" mono span after the heading.
  //    Check if its color contrast (text-faint on bg) is decent.
  const countSpans = await page
    .locator('h2.t-h2')
    .evaluateAll((hs) =>
      hs.map((h) => {
        const sib = h.parentElement?.querySelector('.mono');
        const cs = sib ? getComputedStyle(sib) : null;
        return {
          heading: h.textContent?.trim() ?? '',
          countText: sib?.textContent?.trim() ?? null,
          countColor: cs?.color ?? null,
          countFontSize: cs?.fontSize ?? null,
        };
      }),
    );
  console.log('SECTION COUNT SPANS:', countSpans);

  // 8. Tab from the search — does the next focusable get a visible focus ring?
  await search.focus();
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      text: el.textContent?.trim()?.slice(0, 40) ?? null,
      role: el.getAttribute('role'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('TAB FROM SEARCH:', next);

  // ---- Mobile viewport 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/audit/screenshots/trainer-studies-list-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // On 375, the page-head row wraps; check New study + Import buttons fit
  const headBtns = await page
    .locator('button:has-text("New study"), button:has-text("Import from Lichess")')
    .evaluateAll((nodes) =>
      nodes.map((b) => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent?.trim() ?? '', w: r.width, x: r.x, right: r.right };
      }),
    );
  console.log('MOBILE HEAD BUTTONS:', headBtns);

  // The filter-row may overflow on mobile because it has search + filter segmented + view toggle
  const filterRow = await page
    .locator('input[placeholder="Find study by name or ECO…"]')
    .evaluate((el) => {
      const row = el.closest('[style*="border-radius"]') as HTMLElement | null;
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return {
        width: r.width,
        scrollWidth: row.scrollWidth,
        height: r.height,
      };
    })
    .catch(() => null);
  console.log('MOBILE FILTER ROW:', filterRow);

  // ---- Card hover/focus behavior (back to desktop for measurement) ----
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);

  // Find any rendered study card link (any of the three sections may have content).
  const cardLink = page.locator('a[href^="/trainer/studies/"]').first();
  const hasCard = (await cardLink.count()) > 0;
  if (hasCard) {
    const baseBox = await cardLink.evaluate((a) => {
      const card = a.querySelector('.card') as HTMLElement | null;
      const cs = card ? getComputedStyle(card) : null;
      const r = card ? card.getBoundingClientRect() : null;
      return {
        cardClassName: card?.className ?? null,
        transform: cs?.transform ?? null,
        boxShadow: cs?.boxShadow ?? null,
        borderColor: cs?.borderColor ?? null,
        transition: cs?.transition ?? null,
        top: r?.top ?? null,
      };
    });
    console.log('STUDY CARD baseline:', baseBox);

    await cardLink.hover();
    await page.waitForTimeout(220);
    const hoverBox = await cardLink.evaluate((a) => {
      const card = a.querySelector('.card') as HTMLElement | null;
      const cs = card ? getComputedStyle(card) : null;
      const r = card ? card.getBoundingClientRect() : null;
      return {
        transform: cs?.transform ?? null,
        boxShadow: cs?.boxShadow ?? null,
        borderColor: cs?.borderColor ?? null,
        top: r?.top ?? null,
      };
    });
    console.log('STUDY CARD hover:', hoverBox);

    const hoverChanged =
      hoverBox.transform !== baseBox.transform ||
      hoverBox.boxShadow !== baseBox.boxShadow ||
      hoverBox.borderColor !== baseBox.borderColor;
    console.log('STUDY CARD hover changed:', hoverChanged);
  } else {
    console.log('STUDY CARD: no rendered card to test (all sections empty).');
  }

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
