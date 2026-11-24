// @ts-check
/* ─────────────────────────────────────────────────────────────
   reminders.spec.js — a due-date reminder counts as sent when the server has it
   ─────────────────────────────────────────────────────────────
   P-21 (24 Nov 2026): it counted the moment it was tried, so one raised
   while the browser was offline was lost for good. The server's own job
   (tools/reminders.php) then sends what nobody's browser could.

   The notification request is answered here: nothing is mailed. The owner
   assigns the step to themselves, which sends no assignment email either.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue, whoAmI } = require('./fixtures');

const PROGRAM = 'enterprises/innovation-pipeline', MODULE = 'pipeline';
const inDays = (n) => { const d = new Date(Date.now() + n * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/** Step 1.1 assigned to the owner and due in five days; `answer` is what the notification service says. */
async function dueStep(page, account, answer) {
  const asked = [];
  await page.route('**/api/notify/**', (route) => { asked.push(route.request().postDataJSON()); return answer(route); });
  await signIn(page, PROGRAM, account);
  const me = await whoAmI(page);
  expect((await page.request.post('api/assignments', { data: { org: me.organization.id, module: MODULE, actor_id: me.user.id, step: '1.1', user: me.user.id, assigned: true } })).ok()).toBe(true);
  const due = inDays(5);
  await page.evaluate((d) => { data.assigns = Object.assign(data.assigns || {}, { 1.1: [currentUserId] }); mgDueSave('1.1', d); }, due);
  await expect.poll(() => asked.length, { timeout: 10_000 }).toBeGreaterThan(0);
  return { asked, due };
}
const marked = (page) => serverValue(page, MODULE, 'remind7');

test('accepted: marked for its date, asked once, worded plainly', async ({ page, account }) => {
  test.setTimeout(60_000);
  const s = await dueStep(page, account, (r) => r.fulfill({ json: { success: true, data: { accepted: true } } }));
  await expect.poll(() => marked(page), { timeout: 15_000 }).toEqual({ 1.1: s.due });
  for (let i = 0; i < 4; i++) { await page.evaluate(() => render()); await page.waitForTimeout(300); }
  expect(s.asked.length).toBe(1);
  expect(s.asked[0]).toMatchObject({ kind: 'deadline-reminder', stepId: '1.1' });
  expect(s.asked[0].subject).toContain(' due ' + s.due);
  expect(s.asked[0].html).toContain('Step 1.1 – Assessment Battery is assigned and due on ');
  expect(s.asked[0].html).not.toMatch(/step Step/i);
});

test('not reached: not marked, and not asked again with every redraw', async ({ page, account }) => {
  test.setTimeout(60_000);
  const s = await dueStep(page, account, (r) => r.abort());
  for (let i = 0; i < 6; i++) { await page.evaluate(() => render()); await page.waitForTimeout(400); }
  await page.waitForTimeout(3_000);
  expect((await marked(page) || {})['1.1']).toBeUndefined();
  expect(s.asked.length).toBe(1);
  await page.reload();                                  // another visit tries again
  await expect.poll(() => s.asked.length, { timeout: 20_000 }).toBe(2);
});

test('refused: marked, because it would be refused again', async ({ page, account }) => {
  test.setTimeout(60_000);
  const s = await dueStep(page, account, (r) => r.fulfill({ status: 422, json: { success: false, message: 'No requested recipient belongs to this organization.', reason: 'no-roster-match' } }));
  await expect.poll(() => marked(page), { timeout: 15_000 }).toEqual({ 1.1: s.due });
});
