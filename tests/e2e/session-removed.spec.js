// @ts-check
/* ─────────────────────────────────────────────────────────────
   session-removed.spec.js — a member whose sign-in is gone is signed out
   ─────────────────────────────────────────────────────────────
   The administrator's Reset data removes every member who is not an
   administrator, and their sign-in sessions go with them (sessions →
   users, ON DELETE CASCADE). A removed member's open page used to read
   the 403s that followed as a dropped connection and sat behind
   "Offline — your recent changes are not saved yet. Retrying…" for ever.

   Clearing the browser's session cookie leaves the server in the same
   place as deleting the person: their next workspace request is refused
   and GET /session no longer recognises them. The page must notice on
   its own (the 5-second poll) and go to sign-in, without a reload.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';

test('a member whose session no longer exists is sent to sign-in, not left offline', async ({ page, account }) => {
  test.setTimeout(90_000);
  await signIn(page, GOVERNANCE, account);
  await expect(page.locator('#offlineBar')).toHaveCount(0);

  await page.context().clearCookies();   // the server no longer knows this browser: what Reset does to a removed member

  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Your session has ended')).toBeVisible();
  await expect(page.locator('#offlineBar')).toHaveCount(0);
});

test('a signed-in member is not signed out while their session stands', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, GOVERNANCE, account);
  await page.waitForTimeout(15_000);   // three polls
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible();
  await expect(page.locator('#loginUser')).toHaveCount(0);
});
