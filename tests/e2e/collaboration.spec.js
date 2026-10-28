// @ts-check
/* Two people in one workspace at once (Collab + Store in js/app.js; docs/data-persistence.md §4).
   Both "people" are the owner on two separate browser contexts — see otherDevice in fixtures.js.

   Nothing here is pushed: the other device learns of a lock on a 4-second tick and of a
   saved change on a 5-second poll, so the waits are long on purpose. */
const { test, expect, signIn, whoAmI, nextSave } = require('./fixtures');

const PIPELINE = 'enterprises/innovation-pipeline';
const REMOTE = { timeout: 15_000 };   // a tick or two of the lock heartbeat / rev poll, with room to spare

test.describe.configure({ timeout: 120_000 });

/** Both devices signed in and on the given steps. */
async function bothOn(a, b, account, stepA, stepB = stepA) {
  await Promise.all([signIn(a, PIPELINE, account), signIn(b, PIPELINE, account)]);
  await Promise.all([a.goto(PIPELINE + '/step/' + stepA), b.goto(PIPELINE + '/step/' + stepB)]);
  await a.waitForTimeout(3000);   // let both finish loading, as a person would before typing
}

/** Device `a` takes the Mission's section lock by typing in it, and `b` (on the same step) sees it locked. */
async function aHoldsPurpose(a, b) {
  await a.locator('#p_mission').click();
  await a.keyboard.type('Held by A');
  await expect(b.locator('#p_mission')).toBeDisabled(REMOTE);
}

test('a section someone is typing in is locked for everyone else, and freed when they leave it', async ({ page: a, otherDevice: b, account }) => {
  await bothOn(a, b, account, '1.1');
  await expect(b.locator('#p_mission')).toBeEditable();

  await a.locator('#p_mission').click();
  await a.keyboard.type('Typing on A');

  // The lock is the whole section, not just the field being typed in.
  await expect(b.locator('#p_mission')).toBeDisabled(REMOTE);
  await expect(b.locator('#p_values')).toBeDisabled();
  await expect(b.locator('.collab-lock-mark')).toHaveText(`Locked · ${account.name} is editing`);

  await a.locator('#p_mission').blur();
  await expect(b.locator('#p_mission')).toBeEditable(REMOTE);
  await expect(b.locator('.collab-lock-mark')).toHaveCount(0);
  await expect(b.locator('#p_mission')).toHaveValue('Typing on A');
});

test('the locked-out device cannot write into the section', async ({ page: a, otherDevice: b, account }) => {
  await bothOn(a, b, account, '1.1');

  await a.locator('#p_mission').click();
  await a.keyboard.type('Only A writes here');
  await expect(b.locator('#p_values')).toBeDisabled(REMOTE);

  // Past the disabled attribute: the save path has its own guard (fldSave → Collab.lockedByOther).
  await b.evaluate(() => fldSave('p_values', 'Sneaked in from B', true));
  await a.locator('#p_mission').blur();
  await expect(b.locator('#p_values')).toBeEditable(REMOTE);

  await a.reload();
  await expect(a.locator('#p_mission')).toHaveValue('Only A writes here');
  await expect(a.locator('#p_values')).toHaveValue('');
});

test('a saved change reaches the other device\'s open page without a reload', async ({ page: a, otherDevice: b, account }) => {
  await bothOn(a, b, account, '2.1');

  const saved = nextSave(a, 'Maria Torres');
  await a.locator('#ow_ownerName').fill('Maria Torres');
  await a.locator('#ow_ownerName').blur();
  await saved;

  await expect(b.locator('#ow_ownerName')).toHaveValue('Maria Torres', REMOTE);
});

test('two devices saving different sections at the same moment both keep their work', async ({ page: a, otherDevice: b, account }) => {
  await bothOn(a, b, account, '1.1', '2.1');

  const saves = [nextSave(a, 'Goals written on A'), nextSave(b, 'Owner written on B')];
  await Promise.all([
    a.locator('#p_goals').fill('Goals written on A'),
    b.locator('#ow_ownerName').fill('Owner written on B'),
  ]);
  await Promise.all([a.locator('#p_goals').blur(), b.locator('#ow_ownerName').blur()]);
  await Promise.all(saves);

  // The server's document holds both...
  const me = await whoAmI(a);
  await expect.poll(async () => {
    const res = await a.request.get(`api/workspace?org=${me.organization.id}&module=pipeline&actor=${me.user.id}`);
    const doc = (await res.json()).data.doc;
    return [doc.purpose && doc.purpose.goals, doc.ownership && doc.ownership.ownerName];
  }, REMOTE).toEqual(['Goals written on A', 'Owner written on B']);

  // ...and so does each device, once it looks.
  await a.goto(PIPELINE + '/step/2.1');
  await expect(a.locator('#ow_ownerName')).toHaveValue('Owner written on B');
  await b.goto(PIPELINE + '/step/1.1');
  await expect(b.locator('#p_goals')).toHaveValue('Goals written on A');
});

test.describe('[LK-03] a lock whose holder has gone', () => {
  const RELEASE_BUG = 'On leaving a page, Collab.leave() (js/app.js) sends the release beacon without the page\'s `tab`, '
    + 'and the server only deletes locks whose tab_id matches (Models\WorkspaceLock::releaseAll), so it releases '
    + 'nothing and the lock stands until its 15 s TTL. Remove this line once the beacon carries the tab.';

  test('a tab that vanished without a word frees its section within about 15 seconds', async ({ page: a, otherDevice: b, account }) => {
    await bothOn(a, b, account, '1.1');
    await aHoldsPurpose(a, b);
    await a.route('**/api/workspace/locks/**', (route) => route.abort());   // as if the browser died: no release, no heartbeat
    await a.close({ runBeforeUnload: false });
    await expect(b.locator('#p_mission')).toBeEditable({ timeout: 25_000 });
  });

  test('KNOWN ISSUE: closing a tab frees its section almost at once', async ({ page: a, otherDevice: b, account }) => {
    test.fail(true, RELEASE_BUG);
    await bothOn(a, b, account, '1.1');
    await aHoldsPurpose(a, b);
    await a.close({ runBeforeUnload: true });
    await expect(b.locator('#p_mission')).toBeEditable({ timeout: 6_000 });   // one 4-second lock tick, and a little
  });

  test('KNOWN ISSUE: after a reload, your own earlier page does not lock you out of the section', async ({ page, account }) => {
    test.fail(true, RELEASE_BUG + ' Until then a reload leaves "Locked · <your own name> is editing" on the section for '
      + 'up to 15 s, and anything typed into it is pushed out of the box.');
    await signIn(page, PIPELINE, account);
    await page.goto(PIPELINE + '/step/1.1');
    await page.waitForTimeout(3000);
    await page.locator('#p_mission').click();
    await page.keyboard.type('Before the reload');
    await page.reload();

    await page.waitForTimeout(3000);
    await page.locator('#p_mission').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' and after');
    await page.waitForTimeout(2000);
    await expect(page.locator('.collab-lock-mark')).toHaveCount(0);
    await expect(page.locator('#p_mission')).toHaveValue('Before the reload and after');
  });
});
