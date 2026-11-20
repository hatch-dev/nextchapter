// @ts-check
/* ─────────────────────────────────────────────────────────────
   terms-old-workspace.spec.js — an existing user with an older workspace
   ─────────────────────────────────────────────────────────────
   Reported on live, 19 Nov 2026: an organization from August, its
   administrator signing in to Executive Readiness, and no acceptance ever
   reached the server. That workspace is shaped as older documents are:
   empty lists where newer ones hold objects (assigns, stepDue), a stale
   rev and schemaVersion inside the document, bf11/bf12, no terms anywhere.
   The same shape is laid on a test organization here, and a fresh browser
   signs in to it.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const ER = 'enterprises/executive-readiness';

test('the administrator of an older workspace is asked, and the acceptance is saved', async ({ page: a, otherDevice: b, account }) => {
  test.setTimeout(150_000);
  await signIn(a, ER, account);
  /* Make the workspace look like an August one. */
  await a.evaluate(() => {
    Object.assign(data, { rev: 12, schemaVersion: 1, bf11: true, bf12: true, remind7: [], assigns: [], members: [], stepDue: [], notifications: [], reportDefs: [], startDate: '2026-08-15' });
    delete data.termsLog; delete data.termsOrg;
    (data.roster || []).forEach((u) => { delete u.terms; });
    USERS.forEach((u) => { delete u.terms; });
    saveData();
  });
  await a.evaluate(() => new Promise((res) => Store.flushNow(res)));
  await expect.poll(async () => {
    const r = (await serverValue(a, 'exec-readiness', 'roster')) || [];
    const assigns = await serverValue(a, 'exec-readiness', 'assigns');
    return [r.some((u) => u.terms), Array.isArray(assigns)];
  }, { timeout: 20_000 }).toEqual([false, true]);

  /* A fresh browser signs in. */
  const writes = [];
  b.on('request', (r) => { if (r.method() !== 'GET' && /api\/workspace(\/patch)?$/.test(r.url())) writes.push(r.url()); });
  await b.goto(ER + '/login');
  await b.locator('#loginUser').fill(account.username);
  await b.locator('#loginPassword').fill(account.password);
  await b.locator('[data-submit]').click();
  await expect(b.locator('#termsAgree')).toBeVisible({ timeout: 20_000 });
  await b.locator('#termsAgree').check();
  if (await b.locator('#termsOrg').count()) await b.locator('#termsOrg').check();
  await b.locator('#termsContinue').click();
  await expect(b.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });

  await expect.poll(async () => {
    const r = (await serverValue(b, 'exec-readiness', 'roster')) || [];
    return r.some((u) => u.terms && u.terms.v);
  }, { timeout: 20_000 }).toBe(true);
  expect(writes.length).toBeGreaterThan(0);

  await b.reload();
  await expect(b.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await expect(b.locator('#termsAgree')).toHaveCount(0);
});
