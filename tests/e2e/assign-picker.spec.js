// @ts-check
/* ─────────────────────────────────────────────────────────────
   assign-picker.spec.js — one assignment picker at a time
   ─────────────────────────────────────────────────────────────
   Module Management can list a step twice (its week's panel, and its
   phase's table). The open picker was remembered by step alone, so the
   ⊕ on one copy opened both, stacked (user report, 19 Nov 2026). Each
   copy is now numbered as the page is drawn, and only the clicked one
   opens (assignOccurrence / assignPickerToggle, js/features/assignments.js).
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

for (const [name, path] of [['Culture', 'enterprises/culture'], ['Governance', 'enterprises/responsible-ai-governance']]) {
  test(`${name}: a step listed twice on Module Management opens one picker, the one clicked`, async ({ page, account }) => {
    test.setTimeout(90_000);
    await signIn(page, path, account);
    const step = await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() + 2); const iso = d.toISOString().slice(0, 10);
      const first = (PH[0] && PH[0].steps && PH[0].steps[0] && PH[0].steps[0].id) || '1.1';
      data.stepDue = data.stepDue || {}; data.stepDue[first] = iso; Store.commit('stepDue'); go('mgmt-hub');
      return first;
    });
    await page.waitForTimeout(800);
    const adds = page.locator(`button.assign-add[onclick*="assignPickerToggle('${step}',"]`);
    const copies = await adds.count();
    test.skip(copies < 2, `step ${step} is listed once on this page (${copies}); nothing to check`);

    await adds.nth(0).click();
    await expect(page.locator('.assign-pop')).toHaveCount(1);         // before the fix: one per copy, stacked
    await page.locator('.assign-pop .assign-close').click();
    await expect(page.locator('.assign-pop')).toHaveCount(0);
    await adds.nth(1).click();                                         // the other copy
    await expect(page.locator('.assign-pop')).toHaveCount(1);
  });
}
