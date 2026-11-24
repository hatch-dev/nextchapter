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
  const whole = await t.member.post('api/workspace', { data: { org: t.org, module: MODULE, actor_id: t.memberId, base_rev: now.rev, schema_version: 1, doc: { ...now.doc, roster: [], purpose: { mission: 'A member’s edit' } } } });
  expect(whole.ok(), await whole.text()).toBe(true);
  expect(Object.keys(await roster()).length).toBe(2);
  expect((await t.doc()).doc.purpose.mission).toBe('A member’s edit');   // ordinary work still saves
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
  await t.patch({ sections: { completedSteps: { '4.4': true }, purpose: { mission: 'A member’s edit' } } });
  expect((await t.doc()).doc.purpose.mission).toBe('A member’s edit');
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
  expect(await page.evaluate(() => !!(data.completedSteps || {})['1.2'])).toBe(true);
});
