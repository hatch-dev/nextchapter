// @ts-check
/* ─────────────────────────────────────────────────────────────
   playwright.config.js — end-to-end tests against the running app
   ─────────────────────────────────────────────────────────────
   Unlike the stubbed checks in tools/, these drive the real stack:
   Apache + PHP + MySQL as XAMPP serves it. Start XAMPP first.

   Every test that needs an account creates its own (username pw_…)
   and deletes its organization afterwards — see tests/e2e/fixtures.js.

     npm run test:e2e              headless, all specs
     npm run test:e2e -- --headed  watch it
     npm run test:e2e:ui           Playwright's UI mode
     npm run test:e2e:report       open the last HTML report

   PW_BASE_URL     where the app is served   (default http://localhost/apps/)
   PW_SETUP_CODE   the sign-up setup code    (default ABCXYZ, as config.php)
   ───────────────────────────────────────────────────────────── */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost/apps/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
