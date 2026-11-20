// @ts-check
/* ─────────────────────────────────────────────────────────────
   assign-live.spec.js — an assignment shows on a colleague's open page
   ─────────────────────────────────────────────────────────────
   Who is assigned is kept in the database and was read once, when the
   program opened; a colleague's assignment reached an open page only
   through the workspace document, and two people assigning in the same
   minute could put back each other's older copy of it. Now the list is
   read again every 8 seconds while the tab is in view (assignmentsRefresh,
   js/features/assignments.js), and the document's copy is saved step by
   step (FIELD_DELTA_SECTIONS, js/app.js). 19 Nov 2026.

   Two browsers with no shared storage, the owner signed in on both.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const ER = 'enterprises/executive-readiness';

test("an assignment made on one device appears on another's open step, and goes again when removed", async ({ page: a, otherDevice: b, account }) => {
  test.setTimeout(120_000);
  await signIn(a, ER, account);
  await signIn(b, ER, account);
  await a.goto(ER + '/step/1.1');
  await b.goto(ER + '/step/1.1');
  /* The row labelled Assigned to: each program draws its own (Executive Readiness without a class). */
  const bar = b.locator('xpath=//div[normalize-space(.)="Assigned to"]/..');
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await expect(bar.locator('.assign-av')).toHaveCount(0);

  await a.evaluate(() => toggleAssign('1.1', currentUserId));
  await expect(bar.locator('.assign-av')).toHaveCount(1, { timeout: 20_000 });   // no reload on b

  await a.evaluate(() => toggleAssign('1.1', currentUserId));
  await expect(bar.locator('.assign-av')).toHaveCount(0, { timeout: 20_000 });
});

test('two people assigning different steps at the same moment both keep theirs', async ({ page: a, otherDevice: b, account }) => {
  test.setTimeout(120_000);
  await signIn(a, ER, account);
  await signIn(b, ER, account);
  await Promise.all([
    a.evaluate(() => toggleAssign('1.1', currentUserId)),
    b.evaluate(() => toggleAssign('1.2', currentUserId)),
  ]);
  const both = async (p) => p.evaluate(() => [(getAssigns('1.1') || []).length, (getAssigns('1.2') || []).length]);
  await expect.poll(() => both(a), { timeout: 30_000 }).toEqual([1, 1]);
  await expect.poll(() => both(b), { timeout: 30_000 }).toEqual([1, 1]);
  await expect.poll(async () => { const m = (await serverValue(a, 'exec-readiness', 'assigns')) || {}; return [(m['1.1'] || []).length, (m['1.2'] || []).length]; }, { timeout: 30_000 }).toEqual([1, 1]);
});
