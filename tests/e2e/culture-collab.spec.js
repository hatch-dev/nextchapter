// @ts-check
/* Two people on Culture's step 2.1 target boxes at once (live multi-user test, 13 Nov 2026, Part 1 point 2).
   Both "people" are the owner on two browser contexts (otherDevice in fixtures.js): locks are per tab, and the
   owner is an administrator, so neither device meets the assignment rule.

     F-01  two people saving DIFFERENT targets a moment apart both keep their target (row deltas,
           js/app.js recordDelta + WorkspaceController::withRecords)
     F-02  a colleague's change arriving while you type does not save or rewrite your half-typed target
           (js/app.js: the sync repaint holds back the change event)
     F-03  a target box someone is typing in is locked for everyone else, and says who
           (program.js idToRecordKey falls back to data-lock) */
const { test, expect, signIn, serverWorkspace } = require('./fixtures');

const CULTURE = process.env.PW_CULTURE_PATH || 'enterprises/culture';
const REMOTE = { timeout: 15_000 };   // a lock tick (4 s) or a change poll (5 s), with room to spare

test.describe.configure({ timeout: 120_000 });

async function bothOn21(a, b, account) {
  await Promise.all([signIn(a, CULTURE, account), signIn(b, CULTURE, account)]);
  await Promise.all([a.goto(CULTURE + '/step/2.1'), b.goto(CULTURE + '/step/2.1')]);
  await expect(a.locator('#rs21s_1')).toBeEditable();
  await expect(b.locator('#rs21s_5')).toBeEditable();
  await a.waitForTimeout(3000);   // both settled, as a person would be before typing
}

/** The stored target for one dimension (row), or undefined. */
async function storedTarget(page, row) {
  const { doc } = await serverWorkspace(page, 'ai-culture');
  const rec = ((doc && doc.rowSettings) || []).find((r) => r && r.row === row);
  return rec ? rec.targetScore : undefined;
}

test('[F-03] a target box someone is typing in is locked for everyone else, and says who', async ({ page: a, otherDevice: b, account }) => {
  await bothOn21(a, b, account);
  await a.locator('#rs21s_1').click();
  await a.keyboard.type('4');

  await expect(b.locator('#rs21s_1')).toBeDisabled(REMOTE);
  await expect(b.locator('.collab-lock-mark')).toHaveText(`Locked · ${account.name} is editing`);
  await expect(b.locator('#rs21s_5')).toBeEditable();   // the lock is the row, not the step

  await a.locator('#rs21s_1').blur();
  await expect(b.locator('#rs21s_1')).toBeEditable(REMOTE);
});

test('[F-01] two people saving different targets a moment apart both keep their target', async ({ page: a, otherDevice: b, account }) => {
  await bothOn21(a, b, account);
  await a.locator('#rs21s_1').fill('3.3');
  await a.locator('#rs21s_1').blur();
  await a.waitForTimeout(700);   // B saves before its page has heard of A's target
  await b.locator('#rs21s_5').fill('1.3');
  await b.locator('#rs21s_5').blur();

  await expect.poll(async () => [await storedTarget(a, 1), await storedTarget(a, 5)], REMOTE).toEqual([3.3, 1.3]);
  await expect(b.locator('#rs21s_1')).toHaveValue('3.3', REMOTE);
  await expect(a.locator('#rs21s_5')).toHaveValue('1.3', REMOTE);
});

test('[F-02] a colleague\'s change arriving mid-typing neither saves nor rewrites the half-typed target', async ({ page: a, otherDevice: b, account }) => {
  await bothOn21(a, b, account);
  await a.locator('#rs21s_1').click();
  await a.keyboard.type('4');

  await b.locator('#rs21s_5').fill('3.8');
  await b.locator('#rs21s_5').blur();
  await expect(a.locator('#rs21s_5')).toHaveValue('3.8', REMOTE);   // the repaint has happened on A

  await expect(a.locator('#rs21s_1')).toHaveValue('4');
  await expect(a.locator('#rs21s_1')).toBeFocused();
  expect(await storedTarget(a, 1)).toBeUndefined();   // nothing of A's was saved yet

  await a.keyboard.type('.5');
  await a.locator('#rs21s_1').blur();
  await expect.poll(() => storedTarget(a, 1), REMOTE).toBe(4.5);
});

test('[F-02] a target held back by the repaint is still saved when its box is left without more typing', async ({ page: a, otherDevice: b, account }) => {
  await bothOn21(a, b, account);
  await a.locator('#rs21s_1').click();
  await a.keyboard.type('4');

  await b.locator('#rs21s_5').fill('2.2');
  await b.locator('#rs21s_5').blur();
  await expect(a.locator('#rs21s_5')).toHaveValue('2.2', REMOTE);

  await a.locator('#rs21s_1').blur();
  await expect.poll(() => storedTarget(a, 1), REMOTE).toBe(4);
});

/* ── Fixes from the "what counts as a finding" checks (13 Nov 2026) ─────────────────────────────────────
     F-06  reload or Back while still typing a target keeps it (js/app.js commits the box on pagehide)
     F-10  Remove on a Culture list removes the record (Store.removeRec handles lists)
     F-12  two people editing different fields of one record a moment apart both keep their field
           (row deltas carry the changed fields; WorkspaceController::withRecords merges them)
     F-13  after a same-box clash with the lock service down, every screen settles on what is stored
           (a committed change is banked, so a sync repaint does not pin the old text) */

/** The value records as the server holds them. */
async function storedValues(page) {
  const { doc } = await serverWorkspace(page, 'ai-culture');
  return (doc && doc.values) || [];
}

/** Add a value with a name, the way a person does, and return its id. */
async function addValue(page, name) {
  await page.locator('button:has-text("+ Add value")').first().click();
  const box = page.locator('input[id^="vl_name_"]').last();
  await expect(box).toBeVisible();
  const id = (await box.getAttribute('id')).replace('vl_name_', '');
  await box.fill(name);
  await box.blur();
  await expect.poll(async () => (await storedValues(page)).some((v) => v.id === id && v.name === name), REMOTE).toBe(true);
  return id;
}

/** Open a value's editor: its name, then Edit (Edit alone when it is already open). */
async function editValue(page, id) {
  const box = page.locator('#vl_description_' + id);
  if (await box.isVisible().catch(() => false)) return box;
  const edit = page.locator('[onclick*="culRecEdit(true)"]').first();
  if (!(await edit.isVisible().catch(() => false))) await page.locator(`[onclick*="culRecOpen('values','${id}')"]`).first().click();
  await page.locator('[onclick*="culRecEdit(true)"]').first().click();
  await expect(box).toBeVisible();
  return box;
}

async function bothOn11(a, b, account) {
  await Promise.all([signIn(a, CULTURE, account), signIn(b, CULTURE, account)]);
  await Promise.all([a.goto(CULTURE + '/step/1.1'), b.goto(CULTURE + '/step/1.1')]);
  await expect(a.locator('#sm_mission')).toBeEditable();
  await a.waitForTimeout(3000);
}

test('[F-06] reloading while still typing a target keeps it', async ({ page, account }) => {
  await signIn(page, CULTURE, account);
  await page.goto(CULTURE + '/step/2.1');
  await expect(page.locator('#rs21s_6')).toBeEditable();
  await page.waitForTimeout(2000);
  await page.locator('#rs21s_6').click();
  await page.keyboard.type('3.6');
  await page.reload();
  await expect(page.locator('#rs21s_6')).toHaveValue('3.6', REMOTE);
  await expect.poll(() => storedTarget(page, 6), REMOTE).toBe(3.6);
});

test('[F-06] the browser\'s Back button while still typing a target keeps it', async ({ page, account }) => {
  await signIn(page, CULTURE, account);
  await page.goto(CULTURE + '/step/1.2');
  await page.goto(CULTURE + '/step/2.1');
  await expect(page.locator('#rs21s_7')).toBeEditable();
  await page.waitForTimeout(2000);
  await page.locator('#rs21s_7').click();
  await page.keyboard.type('4.2');
  await page.goBack();
  await page.waitForTimeout(3000);   // the next page load is what sends it
  await expect.poll(() => storedTarget(page, 7), REMOTE).toBe(4.2);
});

test('[F-10] Remove on a value removes it, here and on the other device', async ({ page: a, otherDevice: b, account }) => {
  await bothOn11(a, b, account);
  const id = await addValue(a, 'Value to remove');
  await expect(b.getByText('Value to remove', { exact: true })).toBeVisible(REMOTE);

  a.once('dialog', (d) => d.accept());
  await editValue(a, id);
  await a.locator(`[onclick*="culValueDel('${id}')"]`).first().click();

  await expect.poll(async () => (await storedValues(a)).some((v) => v.id === id), REMOTE).toBe(false);
  await expect(a.getByText('Value to remove', { exact: true })).toHaveCount(0);
  await expect(b.getByText('Value to remove', { exact: true })).toHaveCount(0, REMOTE);
});

test('[F-12] two devices editing different fields of one value a moment apart both keep their field', async ({ page: a, otherDevice: b, account }) => {
  await bothOn11(a, b, account);
  const id = await addValue(a, 'Shared value');
  await b.reload();
  await b.waitForTimeout(3000);
  await editValue(a, id);
  await editValue(b, id);

  await a.locator('#vl_name_' + id).fill('Renamed on A');
  await a.locator('#vl_name_' + id).blur();
  const desc = b.locator('#vl_description_' + id);
  await expect(desc).toBeEditable(REMOTE);
  await desc.fill('Described on B');
  await desc.blur();

  await expect.poll(async () => {
    const v = (await storedValues(a)).find((x) => x.id === id);
    return v && [v.name, v.description];
  }, REMOTE).toEqual(['Renamed on A', 'Described on B']);
});

test('[F-13] after two devices write one box with the lock service down, both settle on what is stored', async ({ page: a, otherDevice: b, account }) => {
  await bothOn11(a, b, account);
  for (const p of [a, b]) await p.route('**/api/workspace/locks**', (r) => r.abort());
  await a.waitForTimeout(16_000);   // any lock either holds has expired

  await Promise.all([a.locator('#sm_baselineStatement').fill('Written on A'), b.locator('#sm_baselineStatement').fill('Written on B')]);
  await a.locator('#sm_baselineStatement').blur();
  await b.waitForTimeout(400);
  await b.locator('#sm_baselineStatement').blur();

  /* Both saves land, the second over the first; read what is stored once it has stopped changing. */
  const storedNow = async () => { const { doc } = await serverWorkspace(a, 'ai-culture'); return (doc && doc.statements && doc.statements.baselineStatement) || ''; };
  await a.waitForTimeout(10_000);
  let stored = await storedNow();
  for (let i = 0; i < 10; i++) { await a.waitForTimeout(1000); const now = await storedNow(); if (now === stored) break; stored = now; }
  expect(stored).toMatch(/^Written on [AB]$/);
  await expect(a.locator('#sm_baselineStatement')).toHaveValue(stored, { timeout: 25_000 });
  await expect(b.locator('#sm_baselineStatement')).toHaveValue(stored, { timeout: 25_000 });
});
