// @ts-check
/* ─────────────────────────────────────────────────────────────
   date-boxes.spec.js — the user-testing sheet's "Date boxes" row
   ─────────────────────────────────────────────────────────────
   "Type a date and click outside the box; use Tab to move between day,
   month and year; leave a half-typed date. The date saves on leaving the
   box, Tab moves between its parts, and a half-typed date is refused with
   a reason." AI-Ready Culture did this already; js/app.js now does it for
   every other program (18 Nov 2026). Governance's step 2.3 "First meeting
   date" is the box used here: it has no onchange of its own and is saved
   by the program's harvest, the hardest case for holding a half-typed date
   back. Day-month-year order, as the testers' browsers show it.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';
test.use({ locale: 'en-GB' });

test('a date saves on leaving the box, Tab moves between its parts, and a half-typed date is refused with a reason', async ({ page, account }) => {
  test.setTimeout(90_000);
  await signIn(page, GOVERNANCE, account);
  await page.goto(GOVERNANCE + '/step/2.3');
  const box = page.locator('#rc_firstReviewDate');
  const saved = () => serverValue(page, 'ai-governance', 'reviewCadence.firstReviewDate');

  /* Keys are pressed one by one: Playwright's type() inserts text, which a date box's parts ignore. */
  const keys = async (s) => { for (const k of s) await page.keyboard.press(k); };
  const into = async () => { await box.evaluate((el) => el.focus()); };   // focus lands on the first part, as a Tab into it does

  await page.waitForTimeout(1500);   // the page's first repaint, once its data is in, replaces the box: wait for it

  // 2: Tab moves between day, month and year inside the one box (Chrome's next Tab is its calendar button).
  await into();
  await page.keyboard.press('Tab'); await expect(box).toBeFocused();
  await page.keyboard.press('Tab'); await expect(box).toBeFocused();

  // 1: a date typed in (two digits a part; the box moves on by itself), then the reader clicks outside.
  await page.locator('#rc_fullReviewTrigger').click();     // out of the box first, so focusing it again starts at the day
  await into();
  await keys('20112026');
  await expect(box).toHaveValue('2026-11-20');
  await page.waitForTimeout(1500);
  expect(await saved()).toBeUndefined();                   // held while the box is still being edited
  await page.locator('#rc_fullReviewTrigger').click();     // leave the box
  await expect.poll(saved, { timeout: 20_000 }).toBe('2026-11-20');

  // 3: half-typed — the year taken out — then leave. Refused, with the reason, and the stored date stands.
  await box.click();
  await page.keyboard.press('End');                        // the year
  await page.keyboard.press('Backspace');
  await expect(box).toHaveValue('');                       // the browser now holds a half-typed date
  await page.locator('#rc_fullReviewTrigger').click();
  await expect(page.locator('#appToast')).toContainText('not complete');
  await expect(box).toHaveValue('2026-11-20');             // put back as it was
  await page.waitForTimeout(2500);
  expect(await saved()).toBe('2026-11-20');                // and nothing saved over it
});
