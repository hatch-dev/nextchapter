// @ts-check
/* ─────────────────────────────────────────────────────────────
   kept-work.spec.js — work that waited while somebody else saved
   ─────────────────────────────────────────────────────────────
   P-29 (25 Nov 2026): an edit made offline went, hours later, over the top of
   a newer one to the same field. What is stored now stays, and the person who
   was away is shown theirs and may put it back. P-31: adding a line to the
   Terms record was reported as replacing somebody's work.

   Two devices of one account stand in for two people.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue, acceptTermsIfShown } = require('./fixtures');

const PROGRAM = 'enterprises/innovation-pipeline', MODULE = 'pipeline';
const FIELD = '#p_mission';

async function typeIn(page, text) {
  await page.locator(FIELD).click();
  await page.locator(FIELD).fill(text);
  await page.locator(FIELD).blur();
}
const mission = async (page) => ((await serverValue(page, MODULE, 'purpose')) || {}).mission;

async function device(browser, baseURL, account) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(PROGRAM + '/login');
  await page.locator('#loginUser').fill(account.username); await page.locator('#loginPassword').fill(account.password); await page.locator('[data-submit]').click();
  await acceptTermsIfShown(page);
  await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 25_000 });
  await page.goto(PROGRAM + '/step/1.1');
  await expect(page.locator(FIELD)).toBeEditable({ timeout: 20_000 });
  return { context, page };
}

for (const closed of [false, true]) {
  test(`${closed ? 'page closed' : 'page left open'}: the newer stored text stays, and the older is offered back`, async ({ browser, baseURL, account }) => {
    test.setTimeout(120_000);
    const a = await device(browser, baseURL, account);
    await typeIn(a.page, 'Together.');
    await expect.poll(() => mission(a.page), { timeout: 15_000 }).toBe('Together.');
    await a.context.setOffline(true);
    await typeIn(a.page, 'Together. Offline.');
    await a.page.waitForTimeout(2_500);
    if (closed) await a.page.close({ runBeforeUnload: false });

    const b = await device(browser, baseURL, account);
    await typeIn(b.page, 'Together. Newer.');
    await expect.poll(() => mission(b.page), { timeout: 15_000 }).toBe('Together. Newer.');

    await a.context.setOffline(false);
    const page = closed ? await a.context.newPage() : a.page;
    if (closed) {
      await page.goto(PROGRAM + '/step/1.1');
      if (await page.locator('#loginUser').waitFor({ timeout: 6_000 }).then(() => true, () => false)) { await page.locator('#loginUser').fill(account.username); await page.locator('#loginPassword').fill(account.password); await page.locator('[data-submit]').click(); }
    }
    const report = page.locator('#collabSyncReport');
    await expect(report).toBeVisible({ timeout: 25_000 });
    await expect(report).toContainText('Together. Offline.');
    await expect(report).toContainText('Together. Newer.');
    expect(await mission(b.page)).toBe('Together. Newer.');

    await page.reload();                                                  // kept until it is dealt with
    await expect(report).toBeVisible({ timeout: 25_000 });
    await report.getByRole('button', { name: 'Use mine instead' }).click();
    await expect.poll(() => mission(b.page), { timeout: 15_000 }).toBe('Together. Offline.');
    await page.reload();
    await page.waitForTimeout(4_000);
    await expect(report).toHaveCount(0);
    await a.context.close(); await b.context.close();
  });
}

test('the merge: fields, lists and deletions that waited; bookkeeping is not reported', async ({ page, account }) => {
  await signIn(page, PROGRAM, account);
  const out = await page.evaluate(() => {
    const late = (b, m, t) => { const r = Store.mergeDocs(b, m, t, true); return [r.doc, r.conflicts.map((c) => c.path + ':' + (c.won || ''))]; };
    const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.rev; delete c.schemaVersion; return c; };
    const run = (b, m, t) => { const [d, c] = late(b, m, t); return { doc: strip(d), told: c }; };
    Store.forgetAuthored();
    Store.noteAuthored({ termsLog: [1], purpose: { mission: 'x' } }, { termsLog: [1, 2], purpose: { mission: 'mine' } });
    return {
      same: run({ s: { a: '1', b: '1' } }, { s: { a: 'm', b: 'm' } }, { s: { a: 't', b: '1' } }),
      cards: run({ ideas: [{ n: 'one', c: '' }] }, { ideas: [{ n: 'one', c: 'm' }, { n: 'mine' }] }, { ideas: [{ n: 'one', c: '', r: 't' }, { n: 'theirs' }] }),
      first: run({}, { ideas: [{ n: 'mine' }] }, { ideas: [{ n: 'theirs' }] }),
      gone: run({ p: { x: { v: 1 } } }, { p: {} }, { p: { x: { v: 2 } } }),
      terms: run({ termsLog: [{ u: 1 }] }, { termsLog: [{ u: 1 }, { u: 2 }] }, { termsLog: [{ u: 1 }, { u: 3 }] }),
      quick: strip(Store.mergeDocs({ s: 'b' }, { s: 'm' }, { s: 't' }).doc),
      replaced: Store.authoredOverwrites({ termsLog: [1, 2], purpose: { mission: 'mine' } }, { termsLog: [1, 2, 3], purpose: { mission: 'theirs' } }).map((r) => r.path),
    };
  });
  expect(out.same).toEqual({ doc: { s: { a: 't', b: 'm' } }, told: ['.s.a:theirs'] });
  expect(out.cards).toEqual({ doc: { ideas: [{ n: 'one', c: 'm', r: 't' }, { n: 'theirs' }, { n: 'mine' }] }, told: [] });
  expect(out.first.doc.ideas).toEqual([{ n: 'theirs' }, { n: 'mine' }]);
  expect(out.gone).toEqual({ doc: { p: { x: { v: 2 } } }, told: ['.p.x:theirs'] });
  expect(out.terms).toEqual({ doc: { termsLog: [{ u: 1 }, { u: 3 }, { u: 2 }] }, told: [] });
  expect(out.quick).toEqual({ s: 'm' });                                  // within the same moment: as before
  expect(out.replaced).toEqual(['.purpose.mission']);
});

/* P-32 (25 Nov 2026): an object section went up whole, so of two people saving different fields of it at the same moment the second put
   the first one's back. It goes as the values that changed, each laid over what is stored. */
test('different fields of one section saved at the same moment all stay', async ({ page, account }) => {
  await signIn(page, PROGRAM, account);
  const me = (await (await page.request.get('api/session')).json()).data;
  const send = (records) => page.request.post('api/workspace/patch', { data: { org: me.organization.id, module: MODULE, actor_id: me.user.id, schema_version: 1, sections: {}, records } });
  const put = (at, v) => send({ incentives: { paths: [{ at, v }] } });
  const answers = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((k) => put([k], 'value ' + k)).concat(['x', 'y', 'z'].map((k) => put(['deep', '0', k], k))));
  expect(answers.map((r) => r.status())).toEqual(Array(9).fill(200));
  expect(await serverValue(page, MODULE, 'incentives')).toEqual({ a: 'value a', b: 'value b', c: 'value c', d: 'value d', e: 'value e', f: 'value f', deep: { 0: { x: 'x', y: 'y', z: 'z' } } });

  expect((await send({ incentives: { paths: [{ at: ['deep', '0', 'y'], gone: 1 }, { at: ['never', 'was'], gone: 1 }, { at: ['list'], v: ['1', '2'] }, { at: ['empty'], v: {} }, { at: ['cleared'], v: null }] } })).ok()).toBe(true);
  const now = await serverValue(page, MODULE, 'incentives');
  expect(now.deep).toEqual({ 0: { x: 'x', z: 'z' } });
  expect(now.list).toEqual(['1', '2']); expect(now.empty).toEqual({}); expect(now.cleared).toBeNull(); expect('never' in now).toBe(false);

  for (const bad of [{ at: [], v: 1 }, { at: [''], v: 1 }, { at: [{}], v: 1 }, { at: ['ok'] }, { at: 'text', v: 1 }, { at: Array(13).fill('k'), v: 1 }]) {
    expect((await send({ incentives: { paths: [{ at: ['good'], v: 1 }, bad] } })).status(), JSON.stringify(bad)).toBe(422);   // all or nothing
  }
  expect('good' in (await serverValue(page, MODULE, 'incentives'))).toBe(false);
});

test('a field typed on screen is sent as that field alone', async ({ page, account }) => {
  await signIn(page, PROGRAM, account);
  await page.goto(PROGRAM + '/step/1.1');
  await typeIn(page, 'First');
  await expect.poll(() => mission(page), { timeout: 15_000 }).toBe('First');
  const sent = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/workspace/patch')) sent.push(r.postDataJSON()); });
  await page.locator('#p_values').fill('Second'); await page.locator('#p_values').blur();
  await expect.poll(async () => ((await serverValue(page, MODULE, 'purpose')) || {}).values, { timeout: 15_000 }).toBe('Second');
  expect(sent.length).toBeGreaterThan(0);
  for (const b of sent) { expect(b.sections.purpose).toBeUndefined(); expect(((b.records.purpose || {}).paths || []).map((p) => p.at.join('.')).filter((x) => x !== 'values')).toEqual([]); }
  expect(await mission(page)).toBe('First');
});

/* P-37 (25 Nov 2026): a list whose rows have no id (idea cards) went up whole; of two people saving cards at the same moment one was lost. */
test('cards added and edited at the same moment all stay', async ({ page, account }) => {
  await signIn(page, PROGRAM, account);
  const me = (await (await page.request.get('api/session')).json()).data;
  const send = (rows) => page.request.post('api/workspace/patch', { data: { org: me.organization.id, module: MODULE, actor_id: me.user.id, schema_version: 1, sections: {}, records: { ideas: { rows } } } });
  expect((await send({ set: [], add: [{ name: 'one', desc: '' }, { name: 'two', desc: '' }] })).ok()).toBe(true);
  await Promise.all([send({ set: [{ i: 0, paths: [{ at: ['desc'], v: 'A' }] }], add: [] }), send({ set: [{ i: 0, paths: [{ at: ['cost'], v: 'B' }] }], add: [] }), send({ set: [{ i: 1, paths: [{ at: ['desc'], v: 'C' }] }], add: [{ name: 'three' }] }), send({ set: [], add: [{ name: 'four' }] })]);
  const ideas = await serverValue(page, MODULE, 'ideas');
  expect(ideas.slice(0, 2)).toEqual([{ name: 'one', desc: 'A', cost: 'B' }, { name: 'two', desc: 'C' }]);
  expect(ideas.slice(2).map((r) => r.name).sort()).toEqual(['four', 'three']);
  expect((await send({ set: [{ i: 'x', paths: [] }], add: [] })).status()).toBe(422);
  expect((await send({ set: [], add: ['text'] })).status()).toBe(422);
  const merged = await page.evaluate(() => Store.mergeDocs({ ideas: [{ n: 1 }] }, { ideas: [{ n: 1 }, { n: 'mine' }] }, { ideas: [{ n: 1, t: 't' }, { n: 'theirs' }] }).doc.ideas);
  expect(merged).toEqual([{ n: 1, t: 't' }, { n: 'theirs' }, { n: 'mine' }]);
});
