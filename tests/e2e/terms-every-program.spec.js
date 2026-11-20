// @ts-check
/* ─────────────────────────────────────────────────────────────
   terms-every-program.spec.js — each program asks, the first time in it
   ─────────────────────────────────────────────────────────────
   Acceptance is recorded per program (the user's choice, 19 Nov 2026), so
   someone who has accepted in one program is asked again in the next one
   they open, whether by signing in there or by switching programs while
   signed in. Checked after a report that it was not asked of an existing
   user (19 Nov 2026).
   ───────────────────────────────────────────────────────────── */
const { test, expect } = require('./fixtures');

const PROGRAMS = ['enterprises/innovation-pipeline', 'ai-governance', 'ai-architecture', 'ai-culture', 'exec-readiness'];   /* the first by address; the rest as the program switcher names them */

test('a signed-in user is asked in every program they open, once each', async ({ page, account }) => {
  test.setTimeout(240_000);
  await page.goto(PROGRAMS[0] + '/login');
  await page.locator('#loginUser').fill(account.username);
  await page.locator('#loginPassword').fill(account.password);
  await page.locator('[data-submit]').click();
  for (const p of PROGRAMS) {
    if (p !== PROGRAMS[0]) await page.goto(await page.evaluate((id) => Router.moduleUrl(id), p));   // already signed in: the program opens straight away
    await expect(page.locator('#termsAgree'), p).toBeVisible({ timeout: 20_000 });
    await page.locator('#termsAgree').check();
    if (await page.locator('#termsOrg').count()) await page.locator('#termsOrg').check();
    await page.locator('#termsContinue').click();
    await expect(page.locator('.nav-tab[data-tab="home"]'), p).toBeVisible({ timeout: 20_000 });
    await page.reload();                                       // and accepted once is enough
    await expect(page.locator('.nav-tab[data-tab="home"]'), p).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#termsAgree'), p).toHaveCount(0);
  }
});
