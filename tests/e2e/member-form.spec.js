// @ts-check
/* ─────────────────────────────────────────────────────────────
   member-form.spec.js — adding and editing a member (P-04, 24 Nov 2026)
   ─────────────────────────────────────────────────────────────
   Someone could be saved with no program and no word about it, the
   generated temporary password was cut off in its box, and the message
   called it the password "you chose".

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
