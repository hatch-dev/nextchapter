// @ts-check
/* ─────────────────────────────────────────────────────────────
   scale-lock.spec.js — the 1-5 scales take and respect the edit lock
   ─────────────────────────────────────────────────────────────
   A 1-5 scale is buttons, and only fields took the edit lock, so a score
   could be set while a colleague was in the section and they were never
   told (user report, Executive Readiness 1.1, 19 Nov 2026). The scales now
   name their record (data-lock), a click takes its lock for 12 seconds
   after the last click, a colleague's buttons are disabled meanwhile, and
   Governance's likSet refuses like the others'.

   Two browsers with no shared storage, the owner signed in on both.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

for (const [name, path, rk, st, setup] of [
  ['Executive Readiness', 'enterprises/executive-readiness', 'assessments', '1.1'],
  ['Executive Readiness', 'enterprises/executive-readiness', 'risks', '1.3'],            /* the risk map's scales (user report, 19 Nov 2026) */
  ['Governance', 'enterprises/responsible-ai-governance', 'assessmentBattery', '1.1'],
  /* 2.3's leader-by-competency scores (user report, 19 Nov 2026): they show for a leader on the roster, under an open competency */
  ['Executive Readiness', 'enterprises/executive-readiness', 'competencyFramework', '2.3', true],
]) {
  test(`${name} ${st}: a score taken on one device locks the scale on the other, then frees it`, async ({ page: a, otherDevice: b, account }) => {
    test.setTimeout(150_000);
    await signIn(a, path, account);
    await signIn(b, path, account);
    await a.goto(path + '/step/' + st);
    await b.goto(path + '/step/' + st);
    if (setup) {
      await expect(a.locator('h2', { hasText: 'Competency Framework' })).toBeVisible({ timeout: 20_000 });
      await expect(b.locator('h2', { hasText: 'Competency Framework' })).toBeVisible({ timeout: 20_000 });
      await a.evaluate(() => { if (!(data.leaders || []).length) { data.leaders = [{ id: 'Ltest_1', name: 'Test Leader' }]; saveData(); } });
      await expect.poll(async () => ((await serverValue(a, 'exec-readiness', 'leaders')) || []).length, { timeout: 30_000 }).toBeGreaterThan(0);
      await expect.poll(() => b.evaluate(() => (data.leaders || []).length), { timeout: 30_000 }).toBeGreaterThan(0);
      for (const p of [a, b]) await p.evaluate(() => { UI.ctxOpen.comp_orchestration = true; render(); });
    }
    const scaleA = a.locator(`button.lk-btn[data-lock="${rk}"]`), scaleB = b.locator(`button.lk-btn[data-lock="${rk}"]`);
    await expect(scaleA.first()).toBeVisible({ timeout: 20_000 });
    await expect(scaleB.first()).toBeEnabled();

    await scaleA.nth(3).click();                                        // a "4" on the first scale
    await expect(scaleB.first()).toBeDisabled({ timeout: 20_000 });       // b is kept out, without a reload
    await expect(b.locator('.collab-lock-mark').first()).toContainText('is editing');

    // b cannot set a score on that section while a holds it, even by calling the handler.
    const snap = () => b.evaluate(() => JSON.stringify([data.assessments, data.assessmentBattery, data.competencyFramework, Object.keys(data).filter((k) => /^risk_/.test(k)).sort().map((k) => [k, data[k]])]));
    const before = await snap();
    await b.evaluate((sel) => { const x = document.querySelector(sel); if (x) { x.disabled = false; x.click(); } }, `button.lk-btn[data-lock="${rk}"]`);
    await b.waitForTimeout(500);
    expect(await snap()).toBe(before);

    // About 12 seconds after a's last click the lock goes, and b may score again.
    await expect(scaleB.first()).toBeEnabled({ timeout: 40_000 });
  });
}
