import { test, expect } from '@playwright/test';

const PROD_URL = 'https://praxis.tsrun.dev';

test('landing-page-render: hero, features, auth form render with UI a11y check', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const resp = await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBe(200);

  await page.waitForSelector('h1', { timeout: 15000 });

  // Hero
  await expect(page.getByRole('heading', { level: 1, name: /Build chess studies/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Two modes/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Sign up and start a study/i })).toBeVisible();

  // Feature cards
  await expect(page.getByRole('heading', { level: 3, name: /Opening trees/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /Game studies/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /Spaced repetition/i })).toBeVisible();

  // Desktop screenshot
  await page.screenshot({
    path: 'tests/audit/screenshots/landing-page-render.png',
    fullPage: true,
  });

  // ---- A11y micro-check on rendered form ----

  // Email input — does the <label> programmatically associate?
  const emailInput = page.locator('input[placeholder="you@studio.club"]');
  await expect(emailInput).toBeVisible();
  const emailInfo = await emailInput.evaluate((el: HTMLInputElement) => {
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
      autoComplete: el.autocomplete,
      type: el.type,
    };
  });
  console.log('EMAIL INPUT a11y:', emailInfo);

  // Password input — same check
  const pwInput = page.locator('input[placeholder="password"]');
  await expect(pwInput).toBeVisible();
  const pwInfo = await pwInput.evaluate((el: HTMLInputElement) => {
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
      type: el.type,
    };
  });
  console.log('PASSWORD INPUT a11y:', pwInfo);

  // Mode toggle buttons (Sign in / Create account)
  const signinTab = page.getByRole('button', { name: /^Sign in$/ });
  const signupTab = page.getByRole('button', { name: /^Create account$/ });
  const modeInfo = await Promise.all([signinTab, signupTab].map((b) =>
    b.evaluate((el) => ({
      text: el.textContent?.trim() ?? '',
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaSelected: el.getAttribute('aria-selected'),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
    })),
  ));
  console.log('MODE TOGGLE:', modeInfo);

  // Switch to Create account to inspect role picker
  await signupTab.click();
  await page.waitForTimeout(120);

  const roleButtons = page.locator('div.grid-3 > button[type="button"]');
  const roleInfo = await roleButtons.evaluateAll((nodes) =>
    nodes.map((b) => {
      const el = b as HTMLButtonElement;
      return {
        text: el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
      };
    }),
  );
  console.log('ROLE PICKER BUTTONS:', roleInfo);

  // Switch back to sign in
  await signinTab.click();
  await page.waitForTimeout(80);

  // Tab order — start at top-of-document and walk through interactive elements
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });

  // Focus visible on email input
  await emailInput.focus();
  await page.waitForTimeout(80);
  const emailFocus = await emailInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  console.log('EMAIL :focus styles:', emailFocus);

  // Nav links: do they have visible text and reach reasonable targets?
  const navLinks = page.locator('nav.hide-mobile a');
  const navInfo = await navLinks.evaluateAll((nodes) =>
    nodes.map((a) => {
      const el = a as HTMLAnchorElement;
      return {
        text: el.textContent?.trim() ?? '',
        href: el.getAttribute('href'),
      };
    }),
  );
  console.log('NAV LINKS:', navInfo);

  // Terms / privacy footer links — href="#" is dead nav
  const fineprintLinks = page.locator('.meta a.link');
  const fineprintInfo = await fineprintLinks.evaluateAll((nodes) =>
    nodes.map((a) => {
      const el = a as HTMLAnchorElement;
      return {
        text: el.textContent?.trim() ?? '',
        href: el.getAttribute('href'),
      };
    }),
  );
  console.log('FINEPRINT LINKS:', fineprintInfo);

  // Color contrast: dim-text paragraph + faint footer
  const heroPara = page.locator('h1.hero-h1 + p');
  const heroParaInfo = await heroPara.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      color: cs.color,
      fontSize: cs.fontSize,
      backgroundColor: cs.backgroundColor,
    };
  });
  console.log('HERO PARAGRAPH color:', heroParaInfo);

  const footerInfo = await page
    .locator('text=/Praxis · made for chess coaches/')
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.color, fontSize: cs.fontSize };
    });
  console.log('FOOTER color:', footerInfo);

  // ---- Mobile viewport (375x812) ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: 'tests/audit/screenshots/landing-page-render-mobile.png',
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  console.log('MOBILE OVERFLOW:', overflow);
  if (overflow.scroll > overflow.client + 1) {
    console.warn(
      `WARN: horizontal overflow at 375 — scroll=${overflow.scroll} client=${overflow.client}`,
    );
  }

  // Hero board box on mobile
  const boardBox = await page
    .locator('.board-cap-400')
    .boundingBox()
    .catch(() => null);
  console.log('MOBILE BOARD BOX:', boardBox);

  // Mobile nav: the hide-mobile class hides desktop nav. What's left?
  const mobileNavVisible = await page.locator('nav.hide-mobile').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, visibility: cs.visibility };
  });
  console.log('MOBILE DESKTOP-NAV display:', mobileNavVisible);

  console.log('PAGE ERRORS:', pageErrors);
  console.log(
    'APP CONSOLE ERRORS:',
    consoleErrors.filter((e) => !e.includes('Failed to load resource')),
  );

  expect(pageErrors).toEqual([]);
});
