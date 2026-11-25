// @ts-check
/* ─────────────────────────────────────────────────────────────
   member-limits.spec.js — what a member who is not an administrator cannot do
   ─────────────────────────────────────────────────────────────
   P-06 (24 Nov 2026): any member was offered Seed sample data and Import
   state, and the server let any member replace the whole program's work,
   add sample people, and rewrite the team's roster.

   These need a real second person, and adding one emails them wherever
   MAIL_HOST is set. So they run on the dev copy only, which sends nothing:

     PW_BASE_URL=http://localhost/apps/enterprises/dev/innovation-pipeline/ npx playwright test member-limits
   ───────────────────────────────────────────────────────────── */
const { test, expect, acceptTermsIfShown, whoAmI } = require('./fixtures');

const MODULE = 'pipeline';

test.beforeEach(({ baseURL }) => {
  test.skip(!/localhost.*enterprises\/dev/.test(baseURL || ''), 'adds a member, which sends a real email outside the local dev copy');
});

/** The owner and a plain member, each with their own API session; the owner's program already holds work. */
async function ownerAndMember(account, playwright, baseURL) {
  const owner = await playwright.request.newContext({ baseURL }), member = await playwright.request.newContext({ baseURL });
  await owner.post('api/session', { data: { username: account.username, password: account.password } });
  const me = (await (await owner.get('api/session')).json()).data;
  const who = { username: account.username + 'm', temporary: 'Plain-view-2026!', password: 'Plain-view-2027!' };
  const added = await owner.post('api/users', {
    data: { organization_id: me.organization.id, name: 'Plain Member', username: who.username, role: 'Tester', scope: 'All', email: who.username + '@example.test', department: 'QA', modules: [MODULE], temporary: who.temporary },
  });
  expect(added.status(), await added.text()).toBe(201);
  await member.post('api/session', { data: { username: who.username, password: who.temporary } });
  await member.post('api/password', { data: { current: who.temporary, next: who.password } });
  const org = me.organization.id, ownerId = me.user.id, memberId = (await added.json()).data.id;
  const row = (id, name, admin, terms) => ({ id, serverId: id, name, admin, ...(terms ? { terms } : {}) });
  const save = await owner.post('api/workspace/patch', {
    data: { org, module: MODULE, actor_id: ownerId, schema_version: 1, sections: { purpose: { mission: 'Everybody’s work' }, roster: [row(ownerId, account.name, true, { v: '1.0', at: 'then' }), row(memberId, 'Plain Member', false, null)] } },
  });
  expect(save.ok(), await save.text()).toBe(true);
  const doc = async () => (await (await owner.get(`api/workspace?org=${org}&module=${MODULE}&actor=${ownerId}`)).json()).data;
  const patch = (data) => member.post('api/workspace/patch', { data: { org, module: MODULE, actor_id: memberId, schema_version: 1, ...data } });
  return { owner, member, org, ownerId, memberId, who, row, doc, patch };
}

test('a member cannot replace the program’s work or add sample people; an administrator can', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const blank = { org: t.org, module: MODULE, base_rev: null, replace: true, schema_version: 1, doc: { ideas: [], completedSteps: {}, purpose: {} } };

  expect((await t.member.post('api/workspace', { data: { ...blank, actor_id: t.memberId } })).status()).toBe(403);
  expect((await t.doc()).doc.purpose.mission).toBe('Everybody’s work');

  const seed = { org: t.org, module: MODULE, members: [{ local_id: 's1', name: 'Sample Person', username: t.who.username + 's' }], assignments: {} };
  expect((await t.member.post('api/seed', { data: { ...seed, actor_id: t.memberId } })).status()).toBe(403);
  const people = (await (await t.owner.get('api/organizations')).json()).data.organizations[0].users.map((u) => u.name);
  expect(people).not.toContain('Sample Person');

  expect((await t.owner.post('api/seed', { data: { ...seed, actor_id: t.ownerId } })).status()).toBe(200);
  expect((await t.owner.post('api/workspace', { data: { ...blank, actor_id: t.ownerId } })).ok()).toBe(true);
});

test('a member’s save cannot change the team, but keeps their own Terms acceptance', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const roster = async () => Object.fromEntries((await t.doc()).doc.roster.map((r) => [r.serverId || r.id, r]));

  /* the owner dropped, oneself an administrator, a stranger added */
  expect((await t.patch({ sections: { roster: [{ ...t.row(t.memberId, 'The Boss', true), terms: { v: '1.0', at: 'now' } }, t.row('usr_stranger', 'Stranger', true), { id: 'loose', name: 'Loose', admin: true }] } })).ok()).toBe(true);
  let r = await roster();
  expect(Object.keys(r).sort()).toEqual([t.ownerId, t.memberId].sort());
  expect(r[t.ownerId]).toMatchObject({ admin: true, terms: { v: '1.0', at: 'then' } });
  expect(r[t.memberId]).toMatchObject({ name: 'Plain Member', admin: false, terms: { v: '1.0', at: 'now' } });

  /* nobody accepts, or un-accepts, for somebody else */
  await t.patch({ sections: { roster: [t.row(t.ownerId, account.name, false), t.row(t.memberId, 'Plain Member', false)] } });
  r = await roster();
  expect(r[t.ownerId]).toMatchObject({ admin: true, terms: { v: '1.0', at: 'then' } });

  /* nor is the section removed, or replaced through an ordinary whole-document save */
  await t.patch({ sections: {}, removed: ['roster'] });
  expect(Object.keys(await roster()).length).toBe(2);
  const now = await t.doc();
  const whole = await t.member.post('api/workspace', { data: { org: t.org, module: MODULE, actor_id: t.memberId, base_rev: now.rev, schema_version: 1, doc: { ...now.doc, roster: [], projects: { 0: { name: 'A member’s edit' } } } } });
  expect(whole.ok(), await whole.text()).toBe(true);
  expect(Object.keys(await roster()).length).toBe(2);
  expect((await t.doc()).doc.projects[0].name).toBe('A member’s edit');   // ordinary work still saves
});

test('Seed and Import are offered to administrators only', async ({ page, account, playwright, baseURL }) => {
  test.setTimeout(90_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  const menu = async (pg, u, p) => {
    await pg.goto('login');
    await pg.locator('#loginUser').fill(u); await pg.locator('#loginPassword').fill(p); await pg.locator('[data-submit]').click();
    await acceptTermsIfShown(pg);
    await expect(pg.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
    await pg.evaluate(() => { if (currentModal) closeModal(); });
    await pg.getByRole('button', { name: /more/i }).first().click();
    return pg.$$eval('.nav-more-item', (e) => e.filter((x) => /** @type {HTMLElement} */(x).offsetParent).map((x) => /** @type {HTMLElement} */(x).dataset.act));
  };
  const member = await menu(page, t.who.username, t.who.password);
  expect(member).toContain('export');
  expect(member).not.toContain('seed');
  expect(member).not.toContain('import');

  /* and by hand: neither asks, neither does anything */
  let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.accept(); });
  await page.evaluate(() => { runSeed('base'); runSeed((Modules.seeds()[0] || {}).id); applyImportedState(JSON.stringify({ purpose: {} })); });
  expect(dialogs).toBe(0);
  expect((await t.doc()).doc.purpose.mission).toBe('Everybody’s work');

  const other = await page.context().browser().newContext({ baseURL });
  const admin = await menu(await other.newPage(), account.username, account.password);
  expect(admin).toEqual(expect.arrayContaining(['seed', 'import', 'export']));
  await other.close();
});

test('a member opening the program keeps the team and their acceptance across a reload', async ({ page, account, playwright, baseURL }) => {
  test.setTimeout(90_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  await page.goto('login');
  await page.locator('#loginUser').fill(t.who.username); await page.locator('#loginPassword').fill(t.who.password); await page.locator('[data-submit]').click();
  await expect(page.locator('#termsAgree')).toBeVisible({ timeout: 20_000 });
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await page.reload();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#termsAgree')).toBeHidden();
  expect((await whoAmI(page)).user.id).toBe(t.memberId);
  const names = (await t.doc()).doc.roster.map((r) => [r.name, r.admin === true, !!r.terms]);
  expect(names).toEqual(expect.arrayContaining([[account.name, true, true], ['Plain Member', false, true]]));
});

/* P-10 (24 Nov 2026): each request counted the administrators, found two, and went ahead. Half the runs left none. */
for (const how of ['demote each other', 'remove each other', 'each demote themselves']) {
  test('two administrators who ' + how + ' at once leave one', async ({ account, playwright, baseURL }) => {
    test.setTimeout(120_000);
    const t = await ownerAndMember(account, playwright, baseURL);
    const second = { id: t.memberId, name: 'Plain Member', username: t.who.username, email: t.who.username + '@example.test' };
    const first = { id: t.ownerId, name: account.name, username: account.username, email: account.email };
    const set = (by, p, is_admin) => by.post('api/users/update', { data: { ...p, role: 'Tester', scope: 'All', department: 'QA', is_admin } });
    const people = async () => {
      for (const who of [t.owner, t.member]) {
        const orgs = (await (await who.get('api/organizations')).json()).data.organizations;
        if (orgs.length) return orgs[0].users;
      }
      return [];
    };
    for (let i = 0; i < (how === 'remove each other' ? 1 : 6); i++) {
      const admins = (await people()).filter((u) => u.is_admin).map((u) => u.public_id);
      if (!admins.includes(t.ownerId)) await set(t.member, first, true);
      if (!admins.includes(t.memberId)) await set(t.owner, second, true);
      expect((await people()).filter((u) => u.is_admin).length).toBe(2);
      const go = how === 'demote each other' ? [set(t.owner, second, false), set(t.member, first, false)]
        : how === 'remove each other' ? [t.owner.post('api/users/delete', { data: { id: t.memberId } }), t.member.post('api/users/delete', { data: { id: t.ownerId } })]
          : [set(t.owner, first, false), set(t.member, second, false)];
      const answers = (await Promise.all(go)).map((r) => r.status());
      const left = (await people()).filter((u) => u.is_admin).length;
      expect(left, 'answers ' + answers.join(' / ')).toBe(1);
    }
  });
}

/* P-17 (24 Nov 2026): the screen lets only a step's assignee, or an administrator, complete it. The server took it from any member. */
test('a member completes only the steps that are theirs, and puts none back', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const done = async () => { const d = (await t.doc()).doc; return { steps: d.completedSteps || {}, at: d.stepDoneAt || {} }; };
  const own = (sections) => t.owner.post('api/workspace/patch', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, schema_version: 1, sections } });
  await own({ completedSteps: { '1.1': true }, stepDoneAt: { '1.1': '2026-11-01' } });

  /* not theirs: not completed, whatever shape it is sent in, and what is complete stays so */
  await t.patch({ sections: { completedSteps: { '1.1': true, '1.2': true, '1.3': true }, stepDoneAt: { '1.1': '2020-01-01', '1.2': '2026-11-24' } } });
  expect(await done()).toEqual({ steps: { '1.1': true }, at: { '1.1': '2026-11-01' } });
  await t.patch({ sections: {}, records: { completedSteps: { fields: { set: { 1.2: true }, unset: ['1.1'] } } } });
  expect((await done()).steps).toEqual({ '1.1': true });
  await t.patch({ sections: { completedSteps: {} } });
  await t.patch({ sections: {}, removed: ['completedSteps', 'stepDoneAt'] });
  expect(await done()).toEqual({ steps: { '1.1': true }, at: { '1.1': '2026-11-01' } });
  const now = await t.doc();
  await t.member.post('api/workspace', { data: { org: t.org, module: MODULE, actor_id: t.memberId, base_rev: now.rev, schema_version: 1, doc: { ...now.doc, completedSteps: { '2.1': true } } } });
  expect((await done()).steps).toEqual({ '1.1': true });

  /* theirs: completed, beside somebody else's step that is not, and a program's own entries are left alone */
  expect((await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step: '1.2', user: t.memberId, assigned: true } })).ok()).toBe(true);
  await t.patch({ sections: { completedSteps: { '1.1': true, '1.2': true, '1.3': true, 'out-bluesky': true }, stepDoneAt: { '1.1': '2026-11-01', '1.2': '2026-11-24' } } });
  expect(await done()).toEqual({ steps: { '1.1': true, '1.2': true, 'out-bluesky': true }, at: { '1.1': '2026-11-01', '1.2': '2026-11-24' } });

  /* taken away again, it is no longer theirs to put back; an administrator may do either */
  await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step: '1.2', user: t.memberId, assigned: false } });
  await t.patch({ sections: { completedSteps: { '1.1': true } } });
  expect((await done()).steps['1.2']).toBe(true);
  await own({ completedSteps: { '1.1': true, '1.3': true } });
  expect((await done()).steps).toEqual({ '1.1': true, '1.3': true });

  /* ordinary work in the same save is untouched */
  await t.patch({ sections: { completedSteps: { '4.4': true }, projects: { 0: { name: 'A member’s edit' } } } });
  expect((await t.doc()).doc.projects[0].name).toBe('A member’s edit');
  expect((await done()).steps['4.4']).toBeUndefined();
});

test('the assignee completes their step on screen, once, and it stays complete', async ({ page, account, playwright, baseURL }) => {
  test.setTimeout(90_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  await t.owner.post('api/workspace/patch', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, schema_version: 1, sections: { ideas: [1, 2, 3].map((i) => ({ id: 'i' + i, name: 'Idea ' + i, desc: 'x', dept: 'Operations' })) } } });
  await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step: '1.2', user: t.memberId, assigned: true } });
  page.on('dialog', (d) => d.accept());
  await page.goto('login');
  await page.locator('#loginUser').fill(t.who.username); await page.locator('#loginPassword').fill(t.who.password); await page.locator('[data-submit]').click();
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.goto('step/1.2');
  const button = page.locator('#app .done-btn').first();
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
  await expect.poll(async () => ((await t.doc()).doc.completedSteps || {})['1.2'], { timeout: 15_000 }).toBe(true);
  expect(((await t.doc()).doc.stepDoneAt || {})['1.2']).toMatch(/^\d{4}-\d\d-\d\d$/);
  await page.waitForTimeout(8_000);                       // through a sync or two
  expect(((await t.doc()).doc.completedSteps || {})['1.2']).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!(data.completedSteps || {})['1.2']), { timeout: 15_000 }).toBe(true);   // once the workspace has loaded
});

/* P-19 (24 Nov 2026): a step-complete report went to every member with an email, whether or not they had the program. The dev copy
   sends nothing: the answer counts what it queued. */
test('a program’s notifications go only to people who have it', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const elsewhere = t.who.username + 'x@example.test';
  const added = await t.owner.post('api/users', { data: { organization_id: t.org, name: 'Elsewhere', username: t.who.username + 'x', role: 'Tester', scope: 'All', email: elsewhere, department: 'QA', modules: ['ai-culture'], temporary: t.who.temporary } });
  expect(added.status()).toBe(201);
  const member = t.who.username + '@example.test';
  let n = 0;
  const notify = async (by, to, kind = 'step-complete', program = MODULE) => {
    const r = await by.post('api/notify/' + program, { data: { kind, subject: 'Step 1.2 complete ' + (n++), to, stepId: '1.2', orgName: '', html: '<h2>x</h2><p>x</p>', pdf: false } });
    return { status: r.status(), ...((await r.json()).data || {}) };
  };
  expect(await notify(t.owner, [account.email, member, elsewhere])).toMatchObject({ status: 200, queued: 2 });
  expect(await notify(t.owner, [elsewhere])).toMatchObject({ status: 200, queued: 0 });
  expect(await notify(t.owner, [account.email, member, elsewhere], 'step-complete', 'ai-culture')).toMatchObject({ status: 200, queued: 2 });   // the owner and Elsewhere
  expect((await notify(t.owner, ['stranger@example.test'])).status).toBe(422);                                                                   // still refused

  await t.owner.post('api/users/update', { data: { id: (await added.json()).data.id, name: 'Elsewhere', username: t.who.username + 'x', role: 'Tester', scope: 'All', email: elsewhere, department: 'QA', modules: ['ai-culture', MODULE] } });
  expect(await notify(t.owner, [account.email, member, elsewhere])).toMatchObject({ status: 200, queued: 3 });
});

/* P-22 (24 Nov 2026): a reminder went to whoever the browser's own, possibly old, copy had assigned. */
test('a reminder goes to whoever the server has assigned, whatever the browser asks', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const memberEmail = t.who.username + '@example.test';
  const me = (await (await t.owner.get('api/session')).json()).data, member = (await (await t.member.get('api/session')).json()).data.user.id;
  const due = '2099-03-04', name = 'Step 1.1 – Assessment Battery due ';
  const save = (sections) => t.owner.post('api/workspace/patch', { data: { org: t.org, module: MODULE, actor_id: me.user.id, schema_version: 1, sections } });
  const assign = (assigned) => t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: me.user.id, step: '1.1', user: member, assigned } });
  const ask = async (date, to, over = {}) => { const r = await t.member.post('api/notify/' + MODULE, { data: { kind: 'deadline-reminder', subject: name + date, to, stepId: '1.1', orgName: '', html: '<h2>x</h2><p>x</p>', pdf: false, ...over } }); const j = await r.json(); return { status: r.status(), reason: j.reason, queued: (j.data || {}).queued }; };

  expect((await save({ stepDue: { 1.1: due } })).ok()).toBe(true);
  expect(await ask(due, [memberEmail])).toMatchObject({ status: 409, reason: 'not-current' });                 // nobody is assigned
  expect((await assign(true)).ok()).toBe(true);
  expect(await ask('2099-03-05', [memberEmail])).toMatchObject({ status: 409 });                                // not its date
  expect(await ask(due, [memberEmail], { stepId: '1.2' })).toMatchObject({ status: 422 });                      // two steps in one request
  expect(await ask(due, [account.email])).toMatchObject({ status: 200, queued: 2 });                            // the owner and the assignee, though one was asked for
  expect(((await t.doc()).doc.remind7 || {})['1.1']).toBe(due);                                                 // and counted by the server
  expect(await ask(due, [account.email, memberEmail])).toMatchObject({ status: 200, queued: 0 });               // once
  await save({ stepDue: { 1.1: '2099-03-06' }, completedSteps: { 1.1: true } });
  expect(await ask('2099-03-06', [memberEmail])).toMatchObject({ status: 409 });                                // complete
});

/* P-30 (25 Nov 2026): what was typed as a session ended was dropped at the next sign-in, for everybody but an administrator. */
test('what a member types as their session ends is there when they sign in again', async ({ account, playwright, baseURL, browser }) => {
  test.setTimeout(90_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  expect((await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step: '1.1', user: t.memberId, assigned: true } })).ok()).toBe(true);
  const context = await browser.newContext({ baseURL }), page = await context.newPage();
  const signIn = async () => { await page.locator('#loginUser').fill(t.who.username); await page.locator('#loginPassword').fill(t.who.password); await page.locator('[data-submit]').click(); };
  await page.goto('login'); await signIn(); await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => go('step', '1.1'));
  await expect(page.locator('#p_values')).toBeEditable({ timeout: 15_000 });
  await page.locator('#p_values').click();
  await page.waitForTimeout(1_500);                                       // its lock and the first look have been answered
  await context.clearCookies();                                           // the session is over; the page has not heard
  await page.keyboard.type('Typed as it ended', { delay: 15 });
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 25_000 });
  await signIn();
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 25_000 });
  await expect.poll(async () => ((await t.doc()).doc.purpose || {}).values, { timeout: 20_000 }).toBe('Typed as it ended');
  expect((await t.doc()).doc.purpose.mission).toBe('Everybody’s work');
  await context.close();
});

/* P-32 gave a save a second shape; the rules above hold for it too. */
test('a member’s save of single values keeps to the same limits', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const before = (await t.doc()).doc;
  expect((await t.patch({ sections: {}, records: { completedSteps: { paths: [{ at: ['1.1'], v: true }] }, enterprise: { paths: [{ at: ['name'], v: 'Taken' }] }, settings: { paths: [{ at: ['voice'], v: false }] }, tracking: { paths: [{ at: ['0', 'note'], v: 'by the member' }] } } })).ok()).toBe(true);
  const now = (await t.doc()).doc;
  expect((now.completedSteps || {})['1.1']).toBeUndefined();
  expect(now.enterprise).toEqual(before.enterprise); expect(now.settings).toEqual(before.settings);
  expect(now.tracking).toEqual({ ...before.tracking, 0: { note: 'by the member' } });
});

/* P-35 and P-36 (25 Nov 2026): a message arriving wiped the one being typed, and a reload called everything read. */
test('team chat: a half-typed message survives one arriving, and what is unread survives a reload', async ({ account, playwright, baseURL, browser }) => {
  test.setTimeout(90_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  const say = (body) => t.owner.post('api/messages', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, body } });
  const context = await browser.newContext({ baseURL }), page = await context.newPage();
  await page.goto('login');
  await page.locator('#loginUser').fill(t.who.username); await page.locator('#loginPassword').fill(t.who.password); await page.locator('[data-submit]').click();
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000);                                       // the room has been read once
  const badge = page.locator('#gchatUnread');
  await say('one'); await say('two');
  await expect(badge).toHaveText('2', { timeout: 15_000 });
  await page.reload();
  await expect(badge).toHaveText('2', { timeout: 15_000 });
  await page.locator('#gchatNavBtn').click();
  await expect(badge).toBeHidden();
  await page.locator('#gchatInput').click(); await page.keyboard.type('half a mess');
  await say('three');
  await expect(page.locator('.gchat-msg-text', { hasText: 'three' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#gchatInput')).toHaveValue('half a mess'); await expect(page.locator('#gchatInput')).toBeFocused();
  await page.keyboard.type('age'); await page.keyboard.press('Enter');
  await expect(page.locator('.gchat-msg-text', { hasText: 'half a message' })).toBeVisible(); await expect(page.locator('#gchatInput')).toHaveValue('');
  await page.locator('.gchat-close').click(); await page.reload(); await page.waitForTimeout(6_000);
  await expect(badge).toBeHidden();
  await context.close();
});

/* P-33 (25 Nov 2026): a page left open learned of somebody added, renamed or removed only from a reload. */
test('an open page learns of team changes, and leaves what is being typed alone', async ({ account, playwright, baseURL, browser }) => {
  test.setTimeout(120_000);
  const t = await ownerAndMember(account, playwright, baseURL);
  expect((await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step: '1.1', user: t.memberId, assigned: true } })).ok()).toBe(true);
  const context = await browser.newContext({ baseURL }), page = await context.newPage();
  await page.goto('login');
  await page.locator('#loginUser').fill(t.who.username); await page.locator('#loginPassword').fill(t.who.password); await page.locator('[data-submit]').click();
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => go('step', '1.1'));
  await expect(page.locator('#p_values')).toBeEditable({ timeout: 15_000 });
  await page.waitForTimeout(7_000);                                       // the first look
  const names = () => page.evaluate(() => USERS.map((u) => u.name));
  await page.locator('#p_values').click(); await page.keyboard.type('half a sen');
  const u = t.who.username + 'n', person = (name) => ({ organization_id: t.org, name, username: u, role: 'Tester', scope: 'All', email: u + '@example.test', department: 'QA', modules: [MODULE] });
  const added = await t.owner.post('api/users', { data: { ...person('Newly Added'), temporary: t.who.temporary } });
  expect(added.status()).toBe(201);
  const id = (await added.json()).data.id;
  await expect.poll(names, { timeout: 15_000 }).toContain('Newly Added');
  await page.keyboard.type('tence');
  await expect(page.locator('#p_values')).toHaveValue('half a sentence'); await expect(page.locator('#p_values')).toBeFocused();
  await t.owner.post('api/users/update', { data: { ...person('Renamed Since'), id } });
  await expect.poll(names, { timeout: 15_000 }).toContain('Renamed Since');
  await t.owner.post('api/users/delete', { data: { id } });
  await expect.poll(names, { timeout: 15_000 }).not.toContain('Renamed Since');
  await expect.poll(async () => ((await t.doc()).doc.purpose || {}).values, { timeout: 15_000 }).toBe('half a sentence');
  let asked = 0; page.on('request', (r) => { if (r.url().includes('organizations/members')) asked++; });
  await page.waitForTimeout(12_000);
  expect(asked).toBe(0);                                                  // nothing has changed: the members are not read
  await context.close();
});

/* P-17 part 2 (25 Nov 2026): who may edit a step was only the screens' rule. api/config/edit-steps.php names what the server judges. */
test('a member changes only the steps that are theirs, by whatever request', async ({ account, playwright, baseURL }) => {
  const t = await ownerAndMember(account, playwright, baseURL);
  const SECTIONS = { purpose: '1.1', knowledge: '1.1', culture: '1.1', decisions: '1.1', audit: '1.1', completedSections: '1.1', assessments: '1.3', ownership: '2.1', raci: '2.1', incentives: '2.2', rhythm: '2.3', governance: '4.2', stress: '4.3' };
  const assign = async (step, assigned) => expect((await t.owner.post('api/assignments', { data: { org: t.org, module: MODULE, actor_id: t.ownerId, step, user: t.memberId, assigned } })).ok()).toBe(true);
  const put = async (by, id, b) => (await (await by.post('api/workspace/patch', { data: { org: t.org, module: MODULE, actor_id: id, schema_version: 1, sections: {}, ...b } })).json()).data;
  const start = {}; for (const k of Object.keys(SECTIONS)) start[k] = k === 'audit' ? [{ a: 'stored' }] : { a: 'stored' };
  await put(t.owner, t.ownerId, { sections: start });
  for (const [k, step] of Object.entries(SECTIONS)) {
    const changed = k === 'audit' ? [{ a: 'changed' }] : { a: 'changed' };
    expect((await put(t.member, t.memberId, { sections: { [k]: changed } })).refused, k).toEqual([k]);
    if (k !== 'audit') expect((await put(t.member, t.memberId, { records: { [k]: { paths: [{ at: ['a'], v: 'changed' }] } } })).refused, k).toEqual([k]);
    await put(t.member, t.memberId, { removed: [k] });
    expect((await t.doc()).doc[k], k).toEqual(start[k]);
    await assign(step, true);
    expect((await put(t.member, t.memberId, { sections: { [k]: changed } })).refused, k).toBeUndefined();
    expect((await t.doc()).doc[k], k).toEqual(changed);
    await assign(step, false);
  }
  const mixed = await put(t.member, t.memberId, { sections: { ownership: { a: 'again' }, projects: { 0: { name: 'shared' } } } });
  expect(mixed.refused).toEqual(['ownership']);
  expect((await t.doc()).doc.projects).toEqual({ 0: { name: 'shared' } });
  expect((await put(t.member, t.memberId, { sections: { ownership: { a: 'changed' } } })).refused).toBeUndefined();   // the same content is no change
});

/* The other programs' steps share their saving code: there, somebody with no step changes nothing, and a hub's sections stay open. */
for (const [program, section, hub] of [['exec-readiness', 'risks', 'review'], ['ai-governance', 'risks', 'raciPeople'], ['ai-architecture', 'vendors', 'rbOrg'], ['ai-culture', 'statements', 'pulseRounds']]) {
  test(`a member with no step of a program changes none of its work: ${program}`, async ({ account, playwright, baseURL }) => {
    const t = await ownerAndMember(account, playwright, baseURL);
    expect((await t.owner.post('api/users/update', { data: { id: t.memberId, name: 'Plain Member', username: t.who.username, role: 'Tester', scope: 'All', email: t.who.username + '@example.test', department: 'QA', modules: [MODULE, program] } })).ok()).toBe(true);
    const put = async (by, id, b) => (await (await by.post('api/workspace/patch', { data: { org: t.org, module: program, actor_id: id, schema_version: 1, sections: {}, ...b } })).json()).data;
    const doc = async () => (await (await t.owner.get(`api/workspace?org=${t.org}&module=${program}&actor=${t.ownerId}`)).json()).data.doc;
    await put(t.owner, t.ownerId, { sections: { [section]: { a: 'stored' }, [hub]: { a: 'stored' } } });
    expect((await put(t.member, t.memberId, { sections: { [section]: { a: 'changed' } } })).refused).toEqual([section]);
    expect((await put(t.member, t.memberId, { records: { [section]: { paths: [{ at: ['a'], v: 'changed' }] } } })).refused).toEqual([section]);
    expect((await put(t.member, t.memberId, { sections: { brandNew: { a: 'x' } } })).refused).toEqual(['brandNew']);
    await put(t.member, t.memberId, { removed: [section] });
    expect((await doc())[section]).toEqual({ a: 'stored' });
    expect((await put(t.member, t.memberId, { sections: { [hub]: { a: 'changed' }, reportDefs: [{ id: 'r' }] } })).refused).toBeUndefined();
    expect((await doc())[hub]).toEqual({ a: 'changed' });
    expect((await t.owner.post('api/assignments', { data: { org: t.org, module: program, actor_id: t.ownerId, step: '1.2', user: t.memberId, assigned: true } })).ok()).toBe(true);
    expect((await put(t.member, t.memberId, { sections: { [section]: { a: 'changed' } } })).refused).toBeUndefined();
    expect((await doc())[section]).toEqual({ a: 'changed' });
  });
}
