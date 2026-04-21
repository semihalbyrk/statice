// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Config for Statice MRF Dashboard E2E Tests
 * Runs critical user journey tests against a live backend
 */
module.exports = defineConfig({
  testDir: './client/src/__tests__/e2e',
  testMatch: '**/*.playwright.js',

  /* Test execution settings */
  fullyParallel: false, // Sequential to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,

  /* Test timeout: E2E tests are slower */
  timeout: 60 * 1000, // 60 seconds per test

  /* Expect timeout */
  expect: { timeout: 10 * 1000 },

  /* Reporter */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  /* Shared test settings */
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Web server config */
  webServer: [
    {
      command: 'cd client && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd server && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],

  /* Global setup (seed database before tests) */
  globalSetup: './client/src/__tests__/e2e/global-setup.js',
});
