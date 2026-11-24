// @ts-check
/* ─────────────────────────────────────────────────────────────
   sign-out.spec.js — a sign-out the server never heard is finished later
   ─────────────────────────────────────────────────────────────
   P-13 (24 Nov 2026): signed out and the browser closed at once, the
   request was lost. The app showed sign-in, but the session went on, for
   up to 30 days with Remember me. A sign-out is now noted until it has
   been answered, and one left over is finished the next time the app is
   opened. Signing in waits for it, so the answer cannot take away the new
   session's cookie.

   Closing the browser is stood in for by dropping the request.
   PW_MODULE_PATH picks another door.
   ───────────────────────────────────────────────────────────── */
const { test, expect, acceptTermsIfShown } = require('./fixtures');

const PROGRAM = process.env.PW_MODULE_PATH || 'enterprises/innovation-pipeline';
const SIGN_OUT = '**/api/sign-out';

async function signInRemembered(page, acct, remember = true) {
  await page.goto(PROGRAM + '/login');
  await fill(page, acct, remember);
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
}
async function fill(page, acct, remember = true) {
  await page.locator('#loginUser').fill(acct.username);
  await page.locator('#loginPassword').fill(acct.password);
  if (remember) await page.locator('input[type="checkbox"]:visible').first().check();
  await page.locator('[data-submit]').click();
}
const signedIn = async (page) => (await (await page.request.get('api/session')).json()).data.ok;
const noted = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('nc-signout-pending')).length);
const pressSignOut = (page) => page.evaluate(() => { if (currentModal) closeModal(); window.confirm = () => true; signOut(); });

test('one that was lost is finished when the app is next opened', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signInRemembered(page, account);
  await page.route(SIGN_OUT, (route) => route.abort());
  await pressSignOut(page);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  expect(await signedIn(page)).toBe(true);           // the server never heard
  expect(await noted(page)).toBe(1);

  await page.unroute(SIGN_OUT);
  await page.goto('about:blank');
  await page.goto(PROGRAM);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => signedIn(page)).toBe(false);
  await expect.poll(() => noted(page)).toBe(0);
});

test('signing in at once waits for it, and stays signed in', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signInRemembered(page, account);
  await page.route(SIGN_OUT, (route) => route.abort());
  await pressSignOut(page);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await page.unroute(SIGN_OUT);

  const order = [];
  page.on('response', (r) => { if (/api\/(sign-out|session)$/.test(r.url()) && r.request().method() === 'POST') order.push(r.url().replace(/.*api\//, '')); });
  await page.route(SIGN_OUT, async (route) => { await new Promise((r) => setTimeout(r, 2_500)); await route.continue(); });
  await page.goto('about:blank');
  await page.goto(PROGRAM + '/login');
  await fill(page, account);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 30_000 });
  expect(order).toEqual(['sign-out', 'session']);
  expect(await signedIn(page)).toBe(true);
  await page.reload();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
});

test('a server that cannot be reached for signing out does not keep anybody out', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signInRemembered(page, account);
  await page.route(SIGN_OUT, (route) => route.abort());
  await pressSignOut(page);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await fill(page, account);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 30_000 });
  expect(await noted(page)).toBe(0);                 // signed in again: nothing is left to finish
  await page.reload();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  expect(await signedIn(page)).toBe(true);
});

test('an ordinary sign-out ends the session and leaves no note; a reload never signs anybody out', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signInRemembered(page, account, false);
  await page.reload();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  expect(await signedIn(page)).toBe(true);
  await pressSignOut(page);
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => signedIn(page)).toBe(false);
  await expect.poll(() => noted(page)).toBe(0);
});
