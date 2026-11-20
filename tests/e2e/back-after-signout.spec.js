// @ts-check
/* ─────────────────────────────────────────────────────────────
   back-after-signout.spec.js — Back after Sign out shows sign-in
   ─────────────────────────────────────────────────────────────
   Real Chrome kept the signed-in page in its back/forward cache, so Back
   after Sign out put the program back on screen from memory. Two fixes:
   index.php serves the shell no-store, and a page restored from that
   cache anyway reloads when nobody is signed in (js/app.js, pageshow).

   Automation turns the back/forward cache off in Chromium, so a restore
   cannot be produced here. The first test covers the real Back; the other
   two send the pageshow event a restore would, signed out and signed in.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';
const restored = () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

test('the program page is not kept for Back, and Back after Sign out shows sign-in', async ({ page, account }) => {
  test.setTimeout(60_000);
  const res = await page.goto(GOVERNANCE + '/login');
  expect(res && res.headers()['cache-control']).toBe('no-store');
  await signIn(page, GOVERNANCE, account);
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => signOut());
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await page.goBack();
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.nav-tab[data-tab="home"]')).toHaveCount(0);
});

test('a page restored from the back/forward cache after Sign out goes to sign-in', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, GOVERNANCE, account);
  // What signOut leaves behind on the page it is leaving: the server session ended, nobody signed in here.
  await page.evaluate(() => new Promise((done) => { Auth.serverSignOut(() => { Auth.clearSession(); done(null); }); }));
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible();   // still painted, as a cached page would be
  await page.evaluate(restored);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.nav-tab[data-tab="home"]')).toHaveCount(0);
});

test('a page restored while still signed in stays where it was', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, GOVERNANCE, account);
  await page.evaluate(restored);
  await page.waitForTimeout(4000);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible();
  await expect(page.locator('#loginUser')).toHaveCount(0);
});
