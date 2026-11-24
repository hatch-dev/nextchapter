// @ts-check
/* ─────────────────────────────────────────────────────────────
   completion-date.spec.js — a step's completion date is the completer's own
   ─────────────────────────────────────────────────────────────
   P-18 (24 Nov 2026): completed at 8 pm in New York, a step was recorded as
   done the next day, because the date was the UTC one. What is overdue stays
   on one changeover for the whole team, so nobody disagrees about it.

   The notification a completion sends is held back: nothing is mailed.
   ───────────────────────────────────────────────────────────── */
const { test, expect, acceptTermsIfShown } = require('./fixtures');

const PROGRAMS = process.env.PW_MODULE_PATH ? [process.env.PW_MODULE_PATH]
  : ['enterprises/innovation-pipeline', 'enterprises/executive-readiness', 'enterprises/responsible-ai-governance'];

for (const program of PROGRAMS) {
  for (const [zone, at, day] of [
    ['America/New_York', '2026-11-25T01:00:00Z', '2026-11-24'],     // 8 pm, the evening before in UTC's terms
    ['Asia/Kolkata', '2026-11-24T20:00:00Z', '2026-11-25'],         // 1:30 am, already the next day
  ]) {
    test(`${program}: completed in ${zone}, recorded as ${day}`, async ({ browser, baseURL, account }) => {
      test.setTimeout(90_000);
      const ctx = await browser.newContext({ baseURL, timezoneId: zone });
      const page = await ctx.newPage();
      await ctx.route('**/api/notify/**', (route) => route.abort());
      await page.clock.setFixedTime(new Date(at));
      await page.goto(program + '/login');
      await page.locator('#loginUser').fill(account.username); await page.locator('#loginPassword').fill(account.password); await page.locator('[data-submit]').click();
      await acceptTermsIfShown(page);
      await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 25_000 });
      expect(await page.evaluate(() => localDay())).toBe(day);
      const stamped = await page.evaluate(() => { if (typeof stampStepDone !== 'function') return 'n/a'; stampStepDone('1.1'); return (data.stepDoneAt || {})['1.1']; });
      expect(['n/a', day]).toContain(stamped);
      await ctx.close();
    });
  }
}
