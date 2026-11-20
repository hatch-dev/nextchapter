// @ts-check
/* ─────────────────────────────────────────────────────────────
   org-add-lock.spec.js — Add Role / Add New Leader take the edit lock
   ─────────────────────────────────────────────────────────────
   Executive Readiness 5.1 (Leadership Structure) has two add forms over
   the shared org chart and leader roster. A colleague opening either form
   while someone is adding must be told and kept out, as in every other
   section (user report, 19 Nov 2026).

   Two browsers with no shared storage, the owner signed in on both.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const ER = 'enterprises/executive-readiness';

for (const [label, open, field, rk] of [
  ['Add Role', () => { UI.orgAddForm = true; UI.orgEditId = null; UI.orgSelected = null; render(); }, '#org_name', 'orgChart'],
  ['Add New Leader', () => { UI.addLeaderOpen = true; UI.editIdx = null; render(); }, '#ldr_name', 'leaders'],
]) {
  test(`5.1 ${label}: one person adding keeps a colleague out, then lets them in`, async ({ page: a, otherDevice: b, account }) => {
    test.setTimeout(150_000);
    await signIn(a, ER, account);
    await signIn(b, ER, account);
    /* By its address: /step/5.1 is the dashboard page, as the sidebar has it (it showed 'Coming soon' until 19 Nov 2026). */
    await a.goto(ER + '/step/5.1');
    await b.goto(ER + '/step/5.1');
    const addA = a.getByRole('button', { name: '+ ' + label }), addB = b.getByRole('button', { name: '+ ' + label });
    await expect(addA).toBeVisible({ timeout: 20_000 });
    await expect(addB).toBeEnabled();

    await addA.click();
    await a.locator(field).click();
    await a.keyboard.type('Head of AI');

    // b's button is held while a is adding, and says who has it.
    await expect(addB).toBeDisabled({ timeout: 20_000 });
    await expect(b.locator('.collab-lock-mark').first()).toContainText('is editing');

    // Even forced open, b's form is locked and its save does nothing.
    await b.evaluate(open);
    await expect(b.locator(field)).toBeDisabled({ timeout: 10_000 });

    // a steps out of the boxes and pauses: the open form keeps the lock, past the 12 seconds a click holds it.
    await a.locator('.step-title, h1').first().click();
    await b.waitForTimeout(15_000);
    await expect(addB).toBeDisabled();

    // a saves (or leaves the form): b may add again.
    await a.locator('#orgAddCard, #addLeaderPanelCard').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(addB).toBeEnabled({ timeout: 40_000 });
  });
}
