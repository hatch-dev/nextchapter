// @ts-check
/* ─────────────────────────────────────────────────────────────
   member-form.spec.js — adding and editing a member (P-04 and P-05, 24 Nov 2026)
   ─────────────────────────────────────────────────────────────
   Someone could be saved with no program and no word about it, the
   generated temporary password was cut off in its box, and the message
   called it the password "you chose".

   P-05 (same day): a Save the server refused dropped the Administrator tick.

   Members are @example.test and go with the organization when the fixture
   deletes it. POST /api/users is answered here wherever it would send an
   access email, so nothing is mailed. PW_MODULE_PATH picks another door.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const PROGRAM = process.env.PW_MODULE_PATH || 'enterprises/innovation-pipeline';

/** Organization & Team with a new member's editor filled in, no program ticked. */
async function newMember(page, account) {
  await signIn(page, PROGRAM, account);
  const posts = [];
  await page.route('**/api/users', (route) => {
    posts.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { success: true, data: { id: 'usr_test', modules: posts[posts.length - 1].modules || [], invite: { status: 'no-transport' } } } });
  });
  await page.evaluate(() => { openOrg(); addProfile(); });
  const temp = page.locator('input[id^="ru_"][id$="_temporary"]');
  const id = (await temp.getAttribute('id') || '').replace(/^ru_|_temporary$/g, '');
  const person = { name: 'Casey Tester', username: 'pwf_' + Date.now().toString(36), role: 'Tester', scope: 'All', email: 'casey' + Date.now() + '@example.test', dept: 'QA' };
  for (const [k, v] of Object.entries(person)) await page.locator(`#ru_${id}_${k}`).fill(v);
  return { id, temp, posts, boxes: page.locator(`input[type="checkbox"][id^="rm_${id}_"]:not(:disabled)`), save: page.locator('#modalRoot .org-btn-save').first() };
}

test('saving a new member with no program asks first', async ({ page, account }) => {
  test.setTimeout(60_000);
  const m = await newMember(page, account);
  const pw = await m.temp.inputValue();

  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await m.save.click();
  await expect.poll(() => asked).toContain('Casey Tester won’t be able to open any program');
  expect(m.posts).toEqual([]);                                             // nothing sent…
  await expect(page.locator(`#ru_${m.id}_name`)).toHaveValue('Casey Tester');   // …and nothing lost
  await expect(m.temp).toHaveValue(pw);

  page.once('dialog', (d) => d.accept());
  await m.save.click();
  await expect.poll(() => m.posts.length).toBe(1);
  expect(m.posts[0].modules).toEqual([]);
  expect(m.posts[0].temporary).toBe(pw);
});

test('with a program ticked it saves without asking, and the message names the password correctly', async ({ page, account }) => {
  test.setTimeout(60_000);
  const m = await newMember(page, account);
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await m.boxes.first().check();
  await m.save.click();
  await expect.poll(() => m.posts.length).toBe(1);
  expect(m.posts[0].modules).toHaveLength(1);
  expect(dialogs).toBe(0);
  await expect(page.locator('#appToast')).toContainText('including the temporary password,');
  await expect(page.locator('#appToast')).not.toContainText('you chose');
});

test('the question is for someone losing their last program, not for someone who had none', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, PROGRAM, account);
  const asked = await page.evaluate(() => {
    let n = 0;
    window.confirm = () => { n++; return false; };
    const box = document.createElement('input'); box.type = 'checkbox'; box.id = 'zz_one'; document.body.appendChild(box);
    const out = {
      lost: [noProgramsOk('A', 'zz_', [], ['pipeline']), n],
      never: [noProgramsOk('A', 'zz_', [], []), n],
      kept: [noProgramsOk('A', 'zz_', ['pipeline'], ['pipeline']), n],
    };
    box.disabled = true;
    return { ...out, nothingToTick: [noProgramsOk('A', 'zz_', [], null), n] };
  });
  expect(asked).toEqual({ lost: [false, 1], never: [true, 1], kept: [true, 1], nothingToTick: [true, 1] });
});

test('the whole temporary password is readable in its box', async ({ page, account }) => {
  test.setTimeout(60_000);
  const m = await newMember(page, account);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await m.temp.evaluate((el) => { el.value = 'WWWWWWWWWWWW'; });         // twelve of the widest letter
    const over = await m.temp.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over, `hidden pixels at ${width}px wide`).toBeLessThanOrEqual(0);
  }
});

test.describe('the Administrator tick after the server refuses a save (P-05)', () => {
  const TAKEN = { status: 422, json: { success: false, message: 'The submitted data was invalid.', errors: { username: ['That username is already taken. Choose another.'] } } };

  test('a new member stays an administrator', async ({ page, account }) => {
    test.setTimeout(60_000);
    const m = await newMember(page, account);
    const sent = [];
    await page.route('**/api/users', (route) => {                          // refused twice, then taken
      sent.push(route.request().postDataJSON());
      return route.fulfill(sent.length < 3 ? TAKEN : { status: 201, json: { success: true, data: { id: 'usr_test', modules: [], invite: { status: 'no-transport' } } } });
    });
    const tick = page.locator(`#ru_${m.id}_admin`);
    await m.boxes.first().check();
    await tick.check();
    for (const n of [1, 2]) {
      await m.save.click();
      await expect.poll(() => sent.length).toBe(n);
      await expect(page.locator('#modalRoot .org-field-err')).toContainText('already taken');
      await expect(tick).toBeChecked();
    }
    await m.save.click();
    await expect.poll(() => sent.length).toBe(3);
    expect(sent.map((s) => s.is_admin)).toEqual([true, true, true]);
  });

  test('taking someone\'s rights away is not undone, and Cancel forgets it', async ({ page, account }) => {
    test.setTimeout(60_000);
    await signIn(page, PROGRAM, account);
    await page.route('**/api/organizations/members**', (route) => route.abort());   // keeps the colleague below in the list
    const sent = [];
    await page.route('**/api/users/update', (route) => { sent.push(route.request().postDataJSON()); return route.fulfill(TAKEN); });
    await page.evaluate(() => {
      openOrg();
      USERS.push({ id: 'zz_col', serverId: 'zz_col', name: 'Second Admin', username: 'second.admin', role: 'Lead', scope: 'All', email: 'second@example.test', dept: 'QA', admin: true, modules: ['pipeline'] });
      editProfile('zz_col');
    });
    const tick = page.locator('#ru_zz_col_admin');
    await expect(tick).toBeChecked();
    await tick.uncheck();
    for (const n of [1, 2]) {
      await page.locator('#modalRoot .org-btn-save').first().click();
      await expect.poll(() => sent.length).toBe(n);
      await expect(page.locator('#modalRoot .org-field-err')).toContainText('already taken');
      await expect(tick).not.toBeChecked();
    }
    expect(sent.map((s) => s.is_admin)).toEqual([false, false]);

    await page.evaluate(() => { cancelEditProfile(); editProfile('zz_col'); });
    await expect(tick).toBeChecked();
  });

  test('a box nobody touched follows a colleague\'s change', async ({ page, account }) => {
    test.setTimeout(60_000);
    await signIn(page, PROGRAM, account);
    await page.route('**/api/organizations/members**', (route) => route.abort());
    await page.evaluate(() => {
      openOrg();
      USERS.push({ id: 'zz_col', serverId: 'zz_col', name: 'Second Admin', username: 'second.admin', role: 'Lead', scope: 'All', email: 'second@example.test', dept: 'QA', admin: true, modules: ['pipeline'] });
      editProfile('zz_col');
      USERS.find((u) => u.id === 'zz_col').admin = false;
      renderOrgModal();
    });
    await expect(page.locator('#ru_zz_col_admin')).not.toBeChecked();
  });
});
