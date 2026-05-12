import { defineConfig } from '@playwright/test';

// We can't run real iOS Safari in CI; chromium with an iPhone-sized mobile
// context + an iPhone UA approximates it well enough for behavior tests.
// Real-device verification (HEIC auto-convert, the native share sheet) stays
// a manual pass — see PLAN.md Phase 5.
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
