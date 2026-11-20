// @ts-check
/* ─────────────────────────────────────────────────────────────
   terms.spec.js — the Terms of Use acceptance screen
   ─────────────────────────────────────────────────────────────
   Directive_DEV_TermsOfUse_FiveModules_18Nov2026: every person accepts the
   terms after signing in and before a program's workspace opens; an
   administrator also accepts for the organization; Decline signs out and
   records nothing; acceptance is kept on the person's roster record, on
   data.termsOrg and in data.termsLog; the account menu shows the terms
   again. Recorded per program, as the directive has it (the user's ruling,
   19 Nov 2026), so each program asks once.

   The member is real: added by the owner over the API with a temporary
   password (the invite goes to @example.test, which delivers nowhere),
   who then chooses their own. Both go with the organization when the
   fixture deletes it.
   ───────────────────────────────────────────────────────────── */
const { test, expect, serverValue } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';
const PIPELINE = 'enterprises/innovation-pipeline';
const MODULE = 'ai-governance';

async function signInOnly(page, path, username, password) {
  await page.goto(path + '/login');
  await page.locator('#loginUser').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('[data-submit]').click();
}
const roster = async (page) => (await serverValue(page, MODULE, 'roster')) || [];

test('an administrator accepts the terms, for themselves and the organization, before the program opens', async ({ page, account }) => {
  test.setTimeout(120_000);
  await signInOnly(page, GOVERNANCE, account.username, account.password);

  await expect(page.getByText('Before you start')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('NextChapter · 90-Day Jump-Start Program')).toBeVisible();
  await expect(page.locator('#termsBox')).toContainText('Terms of Use for the NextChapter 90-Day Programs');
  await expect(page.locator('#termsBox')).toContainText('State of Connecticut');
  await expect(page.locator('nav')).toBeHidden();                       // no top bar while pending
  await expect(page.locator('#pipSidebar')).toBeHidden();
  await expect(page.locator('#termsOrg')).toBeVisible();
  await expect(page.locator('label.terms-tick', { hasText: 'on behalf of ' + account.orgName })).toBeVisible();

  const go = page.locator('#termsContinue');
  await expect(go).toBeDisabled();
  await page.locator('#termsAgree').check();
  await expect(go).toBeDisabled();                                      // one of two
  await page.locator('#termsOrg').check();
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });

  // Recorded on the server: the person, the organization, the log.
  await expect.poll(async () => { const me = (await roster(page)).find((u) => u.admin); return me && me.terms && me.terms.v; }, { timeout: 20_000 }).toBe('1.0');
  const org = await serverValue(page, MODULE, 'termsOrg');
  expect(org && org.v).toBe('1.0');
  const log = await serverValue(page, MODULE, 'termsLog');
  expect(log.length).toBe(1);
  expect(log[0].forOrg).toBe(true);

  // Accepted: a reload goes straight in.
  await page.reload();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#termsAgree')).toHaveCount(0);

  // The account menu shows the terms again, with both acceptances.
  await page.locator('[data-act="usermenu"]').first().click();
  await page.locator('[data-act="user-terms"]').first().click();
  await expect(page.locator('#modalRoot .terms-modal')).toContainText('You accepted version 1.0 on');
  await expect(page.locator('#modalRoot .terms-modal')).toContainText('Accepted for ' + account.orgName + ' by ');
  await page.locator('#modalRoot').getByRole('button', { name: 'Done' }).click();

  // Each program keeps its own acceptance: another program asks once more.
  await page.goto(PIPELINE);
  await expect(page.getByText('Before you start')).toBeVisible({ timeout: 20_000 });
});

test('an invited member sees one box; declining signs out and records nothing; accepting is saved', async ({ page, account, playwright, baseURL }) => {
  test.setTimeout(150_000);
  const uname = 'pwt_' + Date.now().toString(36), temp = 'Tmp-pass-2026!', pw = 'Mem-pass-2026!';

  // The owner adds the member, with Governance on their access; the member then chooses a password.
  const owner = await playwright.request.newContext({ baseURL });
  const member = await playwright.request.newContext({ baseURL });
  try {
    expect((await owner.post('api/session', { data: { username: account.username, password: account.password } })).ok()).toBe(true);
    const me = (await (await owner.get('api/session')).json()).data;
    const add = await owner.post('api/users', { data: { organization_id: me.organization.id, actor_id: me.user.id, name: 'Mia Member', username: uname, role: 'Analyst', scope: 'All', email: uname + '@example.test', department: 'QA', temporary: temp, modules: [MODULE] } });
    expect(add.ok(), await add.text()).toBe(true);
    expect((await member.post('api/session', { data: { username: uname, password: temp } })).ok()).toBe(true);
    const ch = await member.post('api/password', { data: { current: temp, next: pw } });
    expect(ch.ok(), await ch.text()).toBe(true);
  } finally { await owner.dispose(); await member.dispose(); }

  await signInOnly(page, GOVERNANCE, uname, pw);
  await expect(page.getByText('Before you start')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#termsAgree')).toBeVisible();
  await expect(page.locator('#termsOrg')).toHaveCount(0);               // a member is not asked for the organization

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Decline and sign out' }).click();
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 20_000 });
  const who = (await (await page.request.get('api/session')).json()).data;
  expect(who && who.ok).toBeFalsy();                                    // signed out on the server too

  await signInOnly(page, GOVERNANCE, uname, pw);
  await expect(page.getByText('Before you start')).toBeVisible({ timeout: 20_000 });
  expect(((await roster(page)).find((u) => u.username === uname) || {}).terms).toBeUndefined();   // declining recorded nothing
  await page.locator('#termsAgree').check();
  await page.locator('#termsContinue').click();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });

  await expect.poll(async () => { const m = (await roster(page)).find((u) => u.username === uname); return m && m.terms && m.terms.v; }, { timeout: 20_000 }).toBe('1.0');
  const log = await serverValue(page, MODULE, 'termsLog');
  const mine = (log || []).filter((x) => x.forOrg === false);
  expect(mine.length).toBe(1);
});
