// @ts-check
/* ─────────────────────────────────────────────────────────────
   org-role-form.spec.js — the role form keeps what is in it
   ─────────────────────────────────────────────────────────────
   Executive Readiness 5.1, Add Role. Ticking a Values Architecture
   principle redraws the page, and the form was drawn from the saved role
   each time: the tick never showed on a new role and what had been typed
   went (user report, 19 Nov 2026). Now the open form keeps its boxes and
   its ticks, the ticks are saved with the role, Cancel throws them away,
   and an edit that touches no tick keeps the role's own.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const ER = 'enterprises/executive-readiness';

test('5.1 Add Role: ticking a principle keeps the tick and what was typed, and both are saved', async ({ page, account }) => {
  test.setTimeout(120_000);
  await signIn(page, ER, account);
  await page.evaluate(() => {
    data.orgValues = [{ id: 'ov_a', principle: 'Humans decide', domain: 'ethical' }, { id: 'ov_b', principle: 'Show your sources', domain: 'epistemological' }];
    saveData();
  });
  await page.goto(ER + '/step/5.1');
  const addRole = page.getByRole('button', { name: '+ Add Role' });
  await expect(addRole).toBeVisible({ timeout: 20_000 });
  await addRole.click();

  const form = page.locator('[data-org-form="new"]');
  const tick = (name) => form.locator('div[data-lock="orgChart"]', { hasText: name });
  await form.locator('#org_name').fill('Head of AI');
  await form.locator('#org_concepts').fill('Owns the AI roadmap');

  await tick('Humans decide').click();
  await expect(tick('Humans decide')).toContainText('✓');        // before the fix: never shown on a new role
  await expect(form.locator('#org_name')).toHaveValue('Head of AI'); // before the fix: emptied
  await expect(form.locator('#org_concepts')).toHaveValue('Owns the AI roadmap');
  await tick('Show your sources').click();
  await tick('Humans decide').click();                                // and off again
  await expect(tick('Humans decide')).not.toContainText('✓');
  await expect(tick('Show your sources')).toContainText('✓');

  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => {
    const chart = (await serverValue(page, 'exec-readiness', 'orgChart')) || [];
    const r = chart.find((x) => x.name === 'Head of AI');
    return r ? [r.guidingConcepts, r.taggedValues] : null;
  }, { timeout: 30_000 }).toEqual(['Owns the AI roadmap', ['ov_b']]);

  // Cancel throws the ticks away: the next new role starts with none.
  await addRole.click();
  await tick('Humans decide').click();
  await expect(tick('Humans decide')).toContainText('✓');
  await form.getByRole('button', { name: 'Cancel' }).click();
  await addRole.click();
  await expect(tick('Humans decide')).not.toContainText('✓');

  // Editing the saved role without touching a tick keeps its principle.
  await page.evaluate(() => { const r = (data.orgChart || []).find((x) => x.name === 'Head of AI'); UI.orgAddForm = false; UI.orgEditId = r.id; render(); });
  const edit = page.locator('[data-org-form]:not([data-org-form="new"])');
  await expect(edit.locator('#org_name')).toHaveValue('Head of AI');
  await edit.locator('#org_concepts').fill('Owns the AI roadmap and budget');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => {
    const r = ((await serverValue(page, 'exec-readiness', 'orgChart')) || []).find((x) => x.name === 'Head of AI');
    return r ? [r.guidingConcepts, r.taggedValues] : null;
  }, { timeout: 30_000 }).toEqual(['Owns the AI roadmap and budget', ['ov_b']]);
});
