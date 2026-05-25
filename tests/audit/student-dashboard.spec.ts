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

test('student-dashboard: greeting, stats, filter, side cards', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page);

  const resp = await page.goto(`${PROD_URL}/student/dashboard`, {
    waitUntil: 'domcontentloaded',
  });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });
  // greeting heading: any of "Good morning,", "Good afternoon,", "Good evening,", "Late night,"
  const greeting = page.locator('h1').first();
  await expect(greeting).toBeVisible();
  const greetingText = (await greeting.textContent())?.trim() ?? '';
  console.log('GREETING:', JSON.stringify(greetingText));

  // ----- Heading semantics -----
  const h1Info = await greeting.evaluate((el) => ({
    tag: el.tagName,
    classes: el.className,
    fontSize: getComputedStyle(el).fontSize,
    fontWeight: getComputedStyle(el).fontWeight,
  }));
  console.log('H1 a11y:', h1Info);

  // ----- Sub-headings ("All assignments" / "Today" / "Activity") -----
  const h2s = await page.locator('h2').evaluateAll((els) =>
    els.map((e) => ({
      text: e.textContent?.trim() ?? '',
      classes: (e as HTMLElement).className,
    })),
  );
  console.log('H2s:', h2s);

  // ----- MiniStat tiles (active / completed) -----
  const miniStatTiles = await page
    .locator('div')
    .filter({ hasText: /^\d+activeassignments?|^\d+(active|completed)$/ })
    .evaluateAll(() => []); // dummy, see below

  // Actually pick MiniStat by sub-text label which is uppercased "ACTIVE"/"COMPLETED"
  const miniStats = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('div'))
      .filter(
        (el) =>
          (el.textContent === 'active' || el.textContent === 'completed') &&
          (el as HTMLElement).style.textTransform === 'uppercase',
      )
      .map((el) => {
        const tile = el.parentElement as HTMLElement | null;
        const numEl = tile?.querySelector('.mono') as HTMLElement | null;
        const num = numEl?.textContent?.trim() ?? '';
        const numCs = numEl ? getComputedStyle(numEl) : null;
        const lblCs = getComputedStyle(el);
        return {
          label: el.textContent,
          value: num,
          tileRole: tile?.getAttribute('role'),
          tileAriaLabel: tile?.getAttribute('aria-label'),
          // contrast-relevant
          labelColor: lblCs.color,
          labelFontSize: lblCs.fontSize,
          valueColor: numCs?.color,
          valueFontSize: numCs?.fontSize,
        };
      });
    return labels;
  });
  console.log('MINI STATS:', miniStats);

  // ----- Active / Completed filter (Segmented) -----
  const segCount = await page.locator('.segmented').count();
  console.log('SEGMENTED count:', segCount);
  const segInfo = await page.locator('.segmented').first().evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
  }));
  console.log('SEGMENTED first:', segInfo);
  const segBtns = await page.locator('.segmented button').evaluateAll((els) =>
    els.map((b) => ({
      text: (b as HTMLButtonElement).textContent?.trim() ?? '',
      ariaPressed: b.getAttribute('aria-pressed'),
      ariaSelected: b.getAttribute('aria-selected'),
      active: b.classList.contains('active'),
    })),
  );
  console.log('SEGMENTED buttons:', segBtns);

  // ----- Toggle the filter and check that the visible content updates -----
  const completedTab = page.locator('.segmented button', { hasText: 'Completed' });
  if (await completedTab.count()) {
    await completedTab.first().click();
    await page.waitForTimeout(150);
    // The "All assignments" body should now show "No completed assignments." or rows.
  }

  // ----- "Your trainer" card (right column) -----
  const trainerCardInfo = await page
    .locator('div', { hasText: 'Your trainer' })
    .last()
    .evaluate((el) => {
      const txt = el.textContent?.trim() ?? '';
      const avatarEl = el.closest('div')?.querySelector('.avatar, [class*="avatar"], img');
      return {
        text: txt.slice(0, 200),
        avatarTag: avatarEl?.tagName ?? null,
        avatarAriaLabel: avatarEl?.getAttribute('aria-label'),
        avatarAlt: avatarEl?.getAttribute('alt'),
      };
    })
    .catch(() => null);
  console.log('YOUR TRAINER:', trainerCardInfo);

  // ----- "Today" card progress bar a11y -----
  const todayCardInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2'));
    const todayH = headings.find((h) => h.textContent?.trim() === 'Today');
    const card = todayH?.closest('div')?.parentElement?.parentElement ?? null;
    if (!card) return null;
    const bar = card.querySelector('[role="progressbar"], .progress, [class*="progress"]') as HTMLElement | null;
    const avgText =
      Array.from(card.querySelectorAll('.meta')).find((s) =>
        s.textContent?.includes('average'),
      )?.textContent?.trim() ?? null;
    return {
      hasProgress: !!bar,
      progressRole: bar?.getAttribute('role'),
      progressAriaValueNow: bar?.getAttribute('aria-valuenow'),
      progressAriaLabel: bar?.getAttribute('aria-label'),
      avgText,
    };
  });
  console.log('TODAY card:', todayCardInfo);

  // ----- Tip card icon a11y -----
  const tipCard = await page.evaluate(() => {
    const tipEl = Array.from(document.querySelectorAll('.meta-strong')).find(
      (s) => s.textContent?.includes('Tip'),
    );
    const card = tipEl?.closest('div')?.parentElement ?? null;
    const svg = card?.querySelector('svg');
    return {
      hasTip: !!tipEl,
      hasSvg: !!svg,
      svgAriaHidden: svg?.getAttribute('aria-hidden'),
      svgAriaLabel: svg?.getAttribute('aria-label'),
    };
  });
  console.log('TIP card icon:', tipCard);

  // ----- Tile contrast on "active assignments. A short focused..." sub-meta -----
  const subMetaInfo = await page
    .locator('.meta')
    .filter({ hasText: /active assignments/ })
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        text: el.textContent?.trim()?.slice(0, 80) ?? '',
        color: cs.color,
        fontSize: cs.fontSize,
      };
    })
    .catch(() => null);
  console.log('SUB META meta-text:', subMetaInfo);

  // ----- Desktop screenshot -----
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard.png',
    fullPage: true,
  });

  // ----- Focus indicator on the Segmented filter buttons -----
  await page.locator('.segmented button').first().focus();
  await page.waitForTimeout(80);
  const segFocus = await page
    .locator('.segmented button:focus')
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow,
      };
    })
    .catch(() => null);
  console.log('SEGMENTED :focus styles:', segFocus);

  // ----- Mobile 375x812 -----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: 'tests/audit/screenshots/student-dashboard-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);

  // Mobile: check the "All assignments" header — does the segmented filter wrap below?
  const mobileLayout = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2')) as HTMLElement[];
    const sections = h2s.map((h) => ({
      text: h.textContent?.trim() ?? '',
      top: Math.round(h.getBoundingClientRect().top),
    }));
    const allH = h2s.find((h) => h.textContent?.trim() === 'All assignments');
    const row = allH?.parentElement?.parentElement as HTMLElement | undefined;
    const seg = row?.querySelector('.segmented') as HTMLElement | undefined;
    return {
      sections,
      allAssignmentsRow: row
        ? {
            height: Math.round(row.getBoundingClientRect().height),
            width: Math.round(row.getBoundingClientRect().width),
            segLeft: seg ? Math.round(seg.getBoundingClientRect().left) : null,
            segWidth: seg ? Math.round(seg.getBoundingClientRect().width) : null,
          }
        : null,
    };
  });
  console.log('MOBILE layout:', mobileLayout);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
