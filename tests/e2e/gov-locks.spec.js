// @ts-check
/* ─────────────────────────────────────────────────────────────
   gov-locks.spec.js — Governance forms that took no edit lock
   ─────────────────────────────────────────────────────────────
   A field takes an edit lock on focus when its id maps to a record
   (RG.idToRecordKey). Eight of Governance's prefixes mapped to nothing,
   so a colleague was neither told nor kept out: the Compliance Survey's
   "Add a regime" form (ng_), the system and risk forms (sf_, rf_), a
   principle's details (pr_), the first review (fr_), the emergency plan
   (er_) and the deployment-gate log (gp_). Fixed 18 Nov 2026.

   Two browsers with no shared storage, the owner signed in on both, as
   collaboration.spec.js does: edit locks are per tab, not per person.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';

test('every Governance form field maps to the record it writes', async ({ page, account }) => {
  await signIn(page, GOVERNANCE, account);
  const keys = await page.evaluate(() => {
    const k = (id, ui) => { const was = {}; Object.keys(ui || {}).forEach((x) => { was[x] = UI[x]; UI[x] = ui[x]; }); const r = RG.idToRecordKey(id); Object.keys(was).forEach((x) => { UI[x] = was[x]; }); return r; };
    return {
      ng: k('ng_name'),
      sfNew: k('sf_name', { editSys: null }), sfEdit: k('sf_name', { editSys: 'sys-1' }),
      rfNew: k('rf_name', { editRisk: null }), rfEdit: k('rf_name', { editRisk: 'r-1' }),
      pr: k('pr_new_sentence'), fr: k('fr_working'),
      er: k('er_trig', { erOpen: 'r-2' }), gp: k('gp_date', { eoSysOpen: 'sys-3' }),
    };
  });
  expect(keys).toEqual({
    ng: 'regimes::new', sfNew: 'systems::new', sfEdit: 'systems::sys-1', rfNew: 'risks::new', rfEdit: 'risks::r-1',
    pr: 'ethicalFramework', fr: 'firstReview', er: 'risks::r-2', gp: 'systems::sys-3',
  });
});

test('a colleague opening "Add a regime" while someone is filling it in is told and kept out', async ({ page, otherDevice, account }) => {
  test.setTimeout(120_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  for (const p of [page, otherDevice]) {
    await p.goto(GOVERNANCE + '/step/1.4');
    await p.getByRole('button', { name: 'Add a regime' }).click();
  }
  const name = 'Colorado AI Act ' + Date.now().toString(36);
  await page.locator('#ng_name').click();
  await page.locator('#ng_name').pressSequentially(name, { delay: 20 });

  await expect(otherDevice.locator('.collab-lock-mark').first()).toContainText('is editing', { timeout: 30_000 });
  await expect(otherDevice.locator('#ng_name')).toBeDisabled();
  await expect(otherDevice.locator('#ng_summary')).toBeDisabled();
  // ...and sees what is being written there (the shared draft, 18 Nov 2026), while the writer is still typing.
  await expect(otherDevice.locator('#ng_name')).toHaveValue(name, { timeout: 30_000 });
  await page.locator('#ng_summary').click();
  await page.locator('#ng_summary').pressSequentially('Applies to high-risk decisions', { delay: 20 });
  await expect(otherDevice.locator('#ng_summary')).toHaveValue('Applies to high-risk decisions', { timeout: 30_000 });
  await expect(page.locator('#ng_summary')).toBeFocused();

  await page.getByRole('button', { name: 'Add to the register' }).click();   // adds it and closes the form: the lock and the draft go
  await expect(otherDevice.locator('#ng_name')).toBeEnabled({ timeout: 30_000 });
  await expect(otherDevice.locator('#ng_name')).toHaveValue('');
  await expect(otherDevice.getByText(name)).toBeVisible({ timeout: 30_000 });
});

test('step 2.3 keeps what was typed when the reader moves on', async ({ page, account }) => {
  test.setTimeout(90_000);
  await signIn(page, GOVERNANCE, account);
  await page.goto(GOVERNANCE + '/step/2.3');
  await page.locator('#rc_fullReviewTrigger').click();
  await page.locator('#rc_fullReviewTrigger').pressSequentially('A model change in production', { delay: 15 });
  await page.evaluate(() => go('step', '2.4'));
  await page.evaluate(() => go('step', '2.3'));
  await expect(page.locator('#rc_fullReviewTrigger')).toHaveValue('A model change in production');
  await expect.poll(() => serverValue(page, 'ai-governance', 'reviewCadence.fullReviewTrigger'), { timeout: 20_000 }).toBe('A model change in production');
});

test("a colleague on step 2.3 sees what is being typed there, while it is typed", async ({ page, otherDevice, account }) => {
  test.setTimeout(120_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  await page.goto(GOVERNANCE + '/step/2.3');
  await otherDevice.goto(GOVERNANCE + '/step/2.3');
  const text = 'Any incident touching customers ' + Date.now().toString(36);
  await page.locator('#rc_fullReviewTrigger').click();
  await page.locator('#rc_fullReviewTrigger').pressSequentially(text, { delay: 20 });   // and stays in the field

  await expect(otherDevice.locator('#rc_fullReviewTrigger')).toHaveValue(text, { timeout: 30_000 });
  await expect(otherDevice.locator('#rc_fullReviewTrigger')).toBeDisabled();             // and it is theirs while they are in it
  await expect(page.locator('#rc_fullReviewTrigger')).toBeFocused();
  await expect(page.locator('#rc_fullReviewTrigger')).toHaveValue(text);
});
