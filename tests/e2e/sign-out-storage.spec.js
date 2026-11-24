// @ts-check
/* ─────────────────────────────────────────────────────────────
   sign-out-storage.spec.js — what stays in the browser after signing out
   ─────────────────────────────────────────────────────────────
   P-15 (24 Nov 2026): the whole workspace, team names and addresses
   included, stayed in localStorage, where the next person on a shared
   computer could read it. It now goes, but only what the server has: the
   same copies are what bring back an edit that never reached it, and no
   test here is allowed to lose one.
   PW_MODULE_PATH picks another door that has step 1.1's mission box.
   ───────────────────────────────────────────────────────────── */
const { test, expect, acceptTermsIfShown, serverValue } = require('./fixtures');

const PROGRAM = process.env.PW_MODULE_PATH || 'enterprises/innovation-pipeline';
const SAVES = /\/api\/workspace(\/patch)?$/;

async function signInAt(page, acct) {
  await page.goto(PROGRAM + '/login');
  await page.locator('#loginUser').fill(acct.username);
  await page.locator('#loginPassword').fill(acct.password);
  await page.locator('[data-submit]').click();
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
}
const step = async (page) => { await page.goto(PROGRAM + '/step/1.1'); await expect(page.locator('#p_mission')).toBeVisible({ timeout: 20_000 }); await page.waitForTimeout(2_000); };
/** The workspaces in storage, under this copy's own prefix or none. */
const stored = (page) => page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^pipeline-org-(data|base)::/.test(k || '')) o.push(k); } return o; });
const raw = (page) => page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
const press = (page) => page.evaluate(() => { if (currentModal) closeModal(); signOut(); });
const asked = (page, answer = () => true) => { const d = []; page.on('dialog', (x) => { d.push(x.message()); answer(x.message()) ? x.accept() : x.dismiss(); }); return d; };
const atSignIn = (page) => expect(page.locator('#loginUser')).toBeVisible({ timeout: 25_000 });

test('an ordinary sign-out leaves no workspace behind, asks once, and the work is there next time', async ({ page, account }) => {
  test.setTimeout(90_000);
  const said = asked(page);
  await signInAt(page, account);
  await step(page);
  await page.locator('#p_mission').fill('Kept on the server');
  await page.locator('#p_mission').blur();
  await expect.poll(() => serverValue(page, 'pipeline', 'purpose.mission')).toBe('Kept on the server');
  await page.waitForTimeout(1_500);
  expect((await stored(page)).length).toBeGreaterThan(0);

  await press(page);
  await atSignIn(page);
  expect(said).toEqual(['Sign out? Your work is saved.']);
  await page.waitForTimeout(2_000);                          // a late answer must not write it back
  expect(await stored(page)).toEqual([]);
  const left = await raw(page);
  for (const secret of ['Kept on the server', account.email, account.name]) expect(left).not.toContain(secret);

  await signInAt(page, account);
  await step(page);
  await expect(page.locator('#p_mission')).toHaveValue('Kept on the server');
});

test('signing out straight after typing sends it first', async ({ page, account }) => {
  test.setTimeout(90_000);
  asked(page);
  await signInAt(page, account);
  await step(page);
  await page.locator('#p_mission').click();
  await page.locator('#p_mission').pressSequentially('typed and gone', { delay: 10 });
  await press(page);
  await atSignIn(page);
  expect(await stored(page)).toEqual([]);
  await signInAt(page, account);
  await step(page);
  await expect(page.locator('#p_mission')).toHaveValue('typed and gone');
  expect(await serverValue(page, 'pipeline', 'purpose.mission')).toBe('typed and gone');
});

test('work the server could not take: told, may stay, and it is sent at the next sign-in', async ({ page, account }) => {
  test.setTimeout(120_000);
  let stay = true;
  const said = asked(page, (m) => !(stay && /has not reached the server/.test(m)));
  await signInAt(page, account);
  await step(page);
  await page.route(SAVES, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
  await page.locator('#p_mission').fill('never reached the server');
  await page.locator('#p_mission').blur();
  await page.waitForTimeout(1_500);

  await press(page);
  await expect.poll(() => said.filter((m) => /has not reached the server/.test(m)).length, { timeout: 15_000 }).toBe(1);
  await page.waitForTimeout(1_000);
  await expect(page.locator('#p_mission')).toHaveValue('never reached the server');   // stayed
  expect((await (await page.request.get('api/session')).json()).data.ok).toBe(true);

  stay = false;
  await press(page);
  await atSignIn(page);
  expect((await stored(page)).length).toBeGreaterThan(0);    // kept: it is the only copy
  expect(await raw(page)).toContain('never reached the server');

  await page.unroute(SAVES);
  await signInAt(page, account);
  await step(page);
  await expect.poll(() => serverValue(page, 'pipeline', 'purpose.mission'), { timeout: 20_000 }).toBe('never reached the server');
  await page.waitForTimeout(1_500);
  await press(page);
  await atSignIn(page);
  expect(await stored(page)).toEqual([]);                    // and now it goes
});

test('somebody else signing in here does not see or send what another person could not', async ({ page, account }) => {
  test.setTimeout(120_000);
  asked(page);
  await signInAt(page, account);
  await step(page);
  await page.route(SAVES, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
  await page.locator('#p_mission').fill('mine alone');
  await page.locator('#p_mission').blur();
  await page.waitForTimeout(1_500);
  await press(page);
  await atSignIn(page);
  await page.unroute(SAVES);
  /* a colleague: the same organization, the stored copy marked as another person's */
  await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.indexOf('pipeline-org-who::') === 0) localStorage.setItem(k, 'usr_somebody_else'); } });
  await signInAt(page, account);
  await step(page);
  await expect(page.locator('#p_mission')).toHaveValue('');
  await page.waitForTimeout(4_000);
  expect(await serverValue(page, 'pipeline', 'purpose.mission')).toBeFalsy();
});

test('what others left in the browser goes too, unless it was never sent', async ({ page, account }) => {
  test.setTimeout(90_000);
  asked(page);
  await signInAt(page, account);
  await page.evaluate(() => {
    const doc = (m) => JSON.stringify({ rev: 1, purpose: { mission: m }, roster: [{ name: 'Somebody Else', email: 'else@example.test' }] });
    localStorage.setItem('pipeline-org-data::org_sent', doc('same')); localStorage.setItem('pipeline-org-base::org_sent', doc('same'));
    localStorage.setItem('pipeline-org-data::org_sent::ai-culture', doc('same')); localStorage.setItem('pipeline-org-base::org_sent::ai-culture', doc('same'));
    localStorage.setItem('pipeline-org-data::org_unsent', doc('newer')); localStorage.setItem('pipeline-org-base::org_unsent', doc('older'));
    localStorage.setItem('pipeline-org-data::org_nobase', doc('only copy'));
    localStorage.setItem('pipeline-org-base::org_orphan', doc('baseline alone'));
  });
  await press(page);
  await atSignIn(page);
  expect((await stored(page)).sort()).toEqual(['pipeline-org-base::org_unsent', 'pipeline-org-data::org_nobase', 'pipeline-org-data::org_unsent']);
});

test('an edit in another tab survives its stored copies being cleared', async ({ page, account }) => {
  test.setTimeout(120_000);
  asked(page);
  await signInAt(page, account);
  await step(page);
  const other = await page.context().newPage();
  await other.goto('signup');                                 // same storage, not signed in, so it holds no workspace
  await page.bringToFront();
  await page.route(SAVES, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
  await other.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^pipeline-org-(data|base)::/.test(k || '')) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); });
  await page.waitForTimeout(1_000);
  await page.locator('#p_mission').fill('written after the clear');
  await page.locator('#p_mission').blur();
  await page.waitForTimeout(1_500);
  await page.unroute(SAVES);
  await page.reload();                                        // the save never went: the load has to send it
  await expect(page.locator('#p_mission')).toHaveValue('written after the clear', { timeout: 20_000 });
  await expect.poll(() => serverValue(page, 'pipeline', 'purpose.mission'), { timeout: 20_000 }).toBe('written after the clear');
  await other.close();
});
