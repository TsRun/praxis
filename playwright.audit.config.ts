import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/audit',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'https://praxis.tsrun.dev',
    trace: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
