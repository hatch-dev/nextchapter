// @ts-check
/* ─────────────────────────────────────────────────────────────
   fixtures.js — accounts that clean up after themselves
   ─────────────────────────────────────────────────────────────
   These tests write to the real database, so every account they make
   is uniquely named (pw_…, @example.test) and removed when the test
   ends, pass or fail. Removal needs no app-admin password: the owner
   of an organization may delete it (OrganizationController::delete →
   requireOrgAdmin), so teardown signs in as that owner over the API.

     account   an Enterprise account made through POST /api/setup
     cleanup   register an account a test made itself (through the
               sign-up form) so it is deleted the same way
     otherDevice  a page in a browser context of its own — no shared
               cookies or storage, so it is a second person's machine
               as far as the app can tell. Edit locks are per browser
               tab (Collab, js/app.js), not per user, so the owner on
               two devices exercises them the same way two people do —
               without adding a member, which would send a real invite
               email whenever MAIL_HOST is set.
   ───────────────────────────────────────────────────────────── */
const base = require('@playwright/test');
const { expect } = base;

const SETUP_CODE = process.env.PW_SETUP_CODE || 'ABCXYZ';
const PASSWORD = 'Pw-test-2026!';

let seq = 0;
/** A username no other test or run will hold. Usernames are unique installation-wide. */
function uniqueId() {
  return 'pw_' + Date.now().toString(36) + '_' + process.pid.toString(36) + '_' + (seq++).toString(36);
}

/** The fields the sign-up form asks for, filled for one throwaway person. */
function newAccount(role = 'enterprise') {
  const id = uniqueId();
  return {
    role,
    username: id,
    password: PASSWORD,
    name: 'Playwright ' + id,
    email: id + '@example.test',
    orgName: role === 'enterprise' ? 'Playwright ' + id : '',
  };
}

/** Create the account over the API, the same request the sign-up form sends. */
async function createAccount(playwright, baseURL, acct) {
  const api = await playwright.request.newContext({ baseURL });
  try {
    const res = await api.post('api/setup', {
      data: {
        account_type: acct.role,
        setup_code: SETUP_CODE,
        organization_name: acct.orgName,
        name: acct.name,
        email: acct.email,
        username: acct.username,
        password: acct.password,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
  } finally {
    await api.dispose();
  }
}

/** Sign in as the owner and delete their organization. Quietly does nothing if it never got made. */
async function deleteAccount(playwright, baseURL, acct) {
  const api = await playwright.request.newContext({ baseURL });
  try {
    const signIn = await api.post('api/session', { data: { username: acct.username, password: acct.password } });
    if (!signIn.ok()) return;
    const me = await (await api.get('api/session')).json();
    const orgId = me && me.data && me.data.organization && me.data.organization.id;
    if (orgId) await api.post('api/organizations/delete', { data: { id: orgId } });
  } finally {
    await api.dispose();
  }
}

const test = base.test.extend({
  cleanup: async ({ playwright, baseURL }, use) => {
    const made = [];
    await use({ add: (acct) => { made.push(acct); } });
    for (const acct of made) await deleteAccount(playwright, baseURL, acct);
  },

  account: async ({ playwright, baseURL }, use) => {
    const acct = newAccount('enterprise');
    await createAccount(playwright, baseURL, acct);
    await use(acct);
    await deleteAccount(playwright, baseURL, acct);
  },

  otherDevice: async ({ browser, baseURL }, use) => {
    const ctx = await browser.newContext({ baseURL });
    await use(await ctx.newPage());
    await ctx.close();
  },
});

/** Sign in at a program's own door and wait for its navigation to appear. */
async function signIn(page, programPath, acct) {
  await page.goto(programPath + '/login');
  await page.locator('#loginUser').fill(acct.username);
  await page.locator('#loginPassword').fill(acct.password);
  await page.locator('[data-submit]').click();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });   // slow when two devices sign in at once
}

/** Who this page is signed in as: { organization, user } from GET /api/session. */
async function whoAmI(page) {
  const res = await (await page.request.get('api/session')).json();
  return res.data;
}

/** The server's Q&A trail for a program (GET /api/workspace/answers), keyed by question_key. */
async function serverAnswers(page, module) {
  const me = await whoAmI(page);
  const res = await page.request.get(`api/workspace/answers?org=${me.organization.id}&module=${module}&actor=${me.user.id}`);
  const rows = (await res.json()).data.answers;
  return Object.fromEntries(rows.map((r) => [r.question_key, r]));
}

/** The program's workspace as the server holds it right now: { rev, doc }. */
async function serverWorkspace(page, module) {
  const me = await whoAmI(page);
  const res = await page.request.get(`api/workspace?org=${me.organization.id}&module=${module}&actor=${me.user.id}`);
  const data = (await res.json()).data;
  return { rev: data.rev, doc: data.doc };
}

/** One value out of the server's document, by dotted path ('purpose.mission'). Undefined until it exists —
    the document itself is null until the program's first save. */
async function serverValue(page, module, path) {
  const { doc } = await serverWorkspace(page, module);
  return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), doc);
}

const UPLOAD = /\/api\/workspace(\/patch)?$/;

/** Every upload of the workspace this page makes from now on, as [{ path, body }]. GET /workspace/rev is not an upload. */
function recordUploads(page) {
  const list = [];
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname;
    if (r.method() === 'POST' && UPLOAD.test(path)) list.push({ path, body: r.postDataJSON() });
  });
  return list;
}

/** Take the lock service away from this page, as if it were down. Locks fail open (Collab in js/app.js),
    which is also the only way two people can reach the same section to test the merge itself. */
function blockLocks(page) {
  return page.route('**/api/workspace/locks**', (route) => route.abort());
}

/** Where the caret is: { id, value, at } of the focused field. */
function caret(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return { id: el && el.id, value: el && el.value, at: el && el.selectionStart };
  });
}

/** Resolves once the server has accepted a save of the workspace carrying `text`. Set it up BEFORE the edit.
    Matching on the text matters: the app saves on its own during boot, and that save must not count. */
function nextSave(page, text) {
  return page.waitForResponse((r) =>
    UPLOAD.test(new URL(r.url()).pathname) && r.request().method() === 'POST' && r.ok()
    && (r.request().postData() || '').includes(JSON.stringify(text).slice(1, -1)));
}

/** The non-empty error slots on screen, as { field: message }. */
async function visibleErrors(page) {
  return page.$$eval('[data-err]', (els) => Object.fromEntries(
    els.filter((e) => !e.hidden && e.textContent.trim()).map((e) => [e.dataset.err, e.textContent.trim()])
  ));
}

module.exports = {
  test, expect, newAccount, signIn, whoAmI, serverAnswers, serverWorkspace, serverValue, recordUploads, blockLocks, caret, nextSave,
  visibleErrors, SETUP_CODE,
};
