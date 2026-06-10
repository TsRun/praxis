import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';

test('tour-page: renders + UI/a11y audit', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const response = await page.goto(`${PROD_URL}/tour`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);

  // Tour SPA must hydrate and render an h2 heading for the first scene
  await page.waitForSelector('h2', { timeout: 15000 });

  // ─── Desktop screenshot ───
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/audit/screenshots/tour-page.png', fullPage: true });

  const headings = await page.locator('h2').allInnerTexts();
  console.log('HEADINGS:', headings);

  // ─── Document structure ───
  const docStructure = await page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll('h1')).map((h) => ({
      text: h.textContent?.slice(0, 60),
    }));
    const h2s = Array.from(document.querySelectorAll('h2')).map((h) => ({
      text: h.textContent?.slice(0, 60),
    }));
    return { h1Count: h1s.length, h1s, h2Count: h2s.length, h2s };
  });
  console.log('DOC STRUCTURE:', docStructure);

  // ─── Scene tabs ───
  const sceneTabs = await page.evaluate(() => {
    const row = document.querySelector('.scroll-row');
    if (!row) return null;
    const containerRole = row.getAttribute('role');
    const containerAriaLabel = row.getAttribute('aria-label');
    const buttons = Array.from(row.querySelectorAll('button')).map((b) => ({
      text: b.textContent?.trim().slice(0, 40),
      ariaPressed: b.getAttribute('aria-pressed'),
      ariaCurrent: b.getAttribute('aria-current'),
      ariaLabel: b.getAttribute('aria-label'),
    }));
    return { containerRole, containerAriaLabel, buttons };
  });
  console.log('SCENE TABS:', JSON.stringify(sceneTabs, null, 2));

  // ─── ProgressBar ───
  const progressBar = await page.evaluate(() => {
    const bar = document.querySelector('.bar');
    if (!bar) return null;
    return {
      role: bar.getAttribute('role'),
      ariaValueNow: bar.getAttribute('aria-valuenow'),
      ariaValueMin: bar.getAttribute('aria-valuemin'),
      ariaValueMax: bar.getAttribute('aria-valuemax'),
      ariaLabel: bar.getAttribute('aria-label'),
    };
  });
  console.log('PROGRESS BAR:', progressBar);

  // ─── Control bar / Pause-Play toggle ───
  const controlBar = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const found = allButtons.find((b) => /Play|Pause/i.test(b.textContent || ''));
    if (!found) return null;
    return {
      text: found.textContent?.trim().slice(0, 30),
      ariaPressed: found.getAttribute('aria-pressed'),
      ariaLabel: found.getAttribute('aria-label'),
    };
  });
  console.log('PAUSE/PLAY BUTTON:', controlBar);

  // Back / Next disabled state
  const backNext = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const back = btns.find((b) => /Back/i.test(b.textContent || ''));
    const next = btns.find((b) => /Next/i.test(b.textContent || ''));
    return {
      back: back
        ? { text: back.textContent?.trim().slice(0, 30), disabled: back.hasAttribute('disabled'), ariaDisabled: back.getAttribute('aria-disabled') }
        : null,
      next: next
        ? { text: next.textContent?.trim().slice(0, 30), disabled: next.hasAttribute('disabled'), ariaDisabled: next.getAttribute('aria-disabled') }
        : null,
    };
  });
  console.log('BACK/NEXT BUTTONS:', backNext);

  // ─── TopBar contrast / skip link ───
  const topbarSkip = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const skip = links.find((l) => /^Skip$/i.test((l.textContent || '').trim()));
    if (!skip) return null;
    const cs = getComputedStyle(skip);
    return {
      text: skip.textContent?.trim(),
      color: cs.color,
      fontSize: cs.fontSize,
      href: skip.getAttribute('href'),
    };
  });
  console.log('SKIP LINK:', topbarSkip);

  // ─── Focus-visible smoke check: tab to a scene-tab button ───
  const firstTab = page.locator('.scroll-row button').first();
  await firstTab.focus();
  const focusStyle = await firstTab.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
  console.log('FIRST SCENE TAB FOCUS:', focusStyle);

  // ─── Mobile viewport check ───
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/audit/screenshots/tour-page-mobile.png', fullPage: true });

  const mobileOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', mobileOverflow);

  const mobileSceneTabsRow = await page.evaluate(() => {
    const row = document.querySelector('.scroll-row') as HTMLElement | null;
    if (!row) return null;
    return {
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      overflowX: getComputedStyle(row).overflowX,
    };
  });
  console.log('MOBILE SCENE TABS ROW:', mobileSceneTabsRow);

  // Mobile control bar (does it wrap cleanly? CTA still visible?)
  const mobileControlBar = await page.evaluate(() => {
    const ctaA = Array.from(document.querySelectorAll('a')).find((a) => /Sign up/i.test(a.textContent || ''));
    if (!ctaA) return null;
    const r = ctaA.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, visible: r.width > 0 && r.height > 0 };
  });
  console.log('MOBILE CTA:', mobileControlBar);

  // ─── Contrast check: future scene tabs vs page background ───
  // Future (unvisited, non-active) scene tabs are interactive nav. Their
  // label text must meet WCAG AA (4.5:1) at the 12.5px font-size used.
  const futureTabContrast = await page.evaluate(() => {
    function srgbToLinear(v: number) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    function luminance(rgb: string) {
      const m = rgb.match(/\d+(?:\.\d+)?/g);
      if (!m) return 0;
      const [r, g, b] = m.map(Number);
      return (
        0.2126 * srgbToLinear(r) +
        0.7152 * srgbToLinear(g) +
        0.0722 * srgbToLinear(b)
      );
    }
    function contrast(a: string, b: string) {
      const la = luminance(a);
      const lb = luminance(b);
      const lighter = Math.max(la, lb);
      const darker = Math.min(la, lb);
      return (lighter + 0.05) / (darker + 0.05);
    }
    const bg = getComputedStyle(document.body).backgroundColor;
    const row = document.querySelector('.scroll-row');
    if (!row) return null;
    const btns = Array.from(row.querySelectorAll('button'));
    return btns
      .filter((b) => b.getAttribute('aria-pressed') === 'false')
      .map((b) => {
        const cs = getComputedStyle(b);
        return {
          text: b.textContent?.trim().slice(0, 24),
          color: cs.color,
          bg,
          fontSize: cs.fontSize,
          contrast: Number(contrast(cs.color, bg).toFixed(2)),
        };
      });
  });
  console.log('FUTURE TAB CONTRAST:', JSON.stringify(futureTabContrast, null, 2));

  // ─── Nested interactive elements (a>button or button>a) ───
  // Wrapping a <button> inside an <a> is invalid HTML and confuses
  // screen readers / disables anchor activation. Logged for the PR rationale.
  const nestedInteractive = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('a button, button a'));
    return nodes.map((el) => ({
      self: el.tagName,
      parent: el.parentElement?.tagName,
      text: (el.textContent || '').trim().slice(0, 40),
    }));
  });
  console.log('NESTED INTERACTIVES (a>button or button>a):', nestedInteractive);

  // ─── Filter app-level console errors (browser network errors are waived) ───
  const appConsoleErrors = consoleErrors.filter(
    (e) => !e.includes('Failed to load resource')
  );
  console.log('PAGE ERRORS:', pageErrors);
  console.log('APP CONSOLE ERRORS:', appConsoleErrors);

  // Page must not crash
  expect(pageErrors.filter((e) => !e.includes('fen')), 'No unexpected page errors').toEqual([]);

  // First scene heading must be present
  expect(headings.some((h) => h.includes('Build move by move')), 'First scene heading visible').toBe(true);

  // Sign up button must be present
  await expect(page.getByText('Sign up →')).toBeVisible();

  // Future scene tabs are nav targets at 12.5px — they need to be readable.
  // We assert non-null & non-empty here; contrast values are logged above
  // and used to justify any improvement PR.
  expect(futureTabContrast, 'have future scene tabs').not.toBeNull();
  expect((futureTabContrast ?? []).length, 'at least one future scene tab').toBeGreaterThan(0);
});
