// @ts-check
/* ─────────────────────────────────────────────────────────────
   notes.spec.js — one person's notes on two devices
   ─────────────────────────────────────────────────────────────
   P-14 (24 Nov 2026): an open Notes panel only showed what it had read
   when it was opened, so a note written on the same person's phone never
   appeared on the laptop. And every redraw emptied the box being typed in.
   PW_MODULE_PATH picks another door.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const PROGRAM = process.env.PW_MODULE_PATH || 'enterprises/innovation-pipeline';
const open = (page) => page.evaluate(() => { if (currentModal) closeModal(); if (!notesOpen) toggleNotes(); });
const write = async (page, text) => { await page.locator('#notesInput').fill(text); await page.evaluate(() => addNote()); };

test('a note written on one device appears in the open panel on the other, without touching what is being typed', async ({ page, otherDevice, account }) => {
  test.setTimeout(90_000);
  await signIn(page, PROGRAM, account);
  await signIn(otherDevice, PROGRAM, account);
  await open(page); await open(otherDevice);

  await page.locator('#notesInput').click();
  await page.locator('#notesInput').pressSequentially('half a tho');
  await write(otherDevice, 'from the phone');
  await expect(page.locator('#notesPanel .note-text')).toHaveText(['from the phone'], { timeout: 15_000 });
  await expect(page.locator('#notesInput')).toHaveValue('half a tho');
  await expect(page.locator('#notesInput')).toBeFocused();
  await page.locator('#notesInput').pressSequentially('ught');
  await expect(page.locator('#notesInput')).toHaveValue('half a thought');

  await page.evaluate(() => addNote());
  await expect(otherDevice.locator('#notesPanel .note-text')).toHaveText(['half a thought', 'from the phone'], { timeout: 15_000 });
  await otherDevice.locator('#notesPanel .note-del').last().click();   // and a deletion
  await expect(page.locator('#notesPanel .note-text')).toHaveText(['half a thought'], { timeout: 15_000 });
});

test('what is typed while the list or a save is on its way is kept', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, PROGRAM, account);
  const slow = async (route) => { await new Promise((r) => setTimeout(r, 1_500)); await route.continue().catch(() => { }); };
  await page.route('**/api/notes**', slow);
  await open(page);
  await page.locator('#notesInput').fill('typed at once');
  await page.waitForTimeout(2_200);                                     // the first list has arrived
  await expect(page.locator('#notesInput')).toHaveValue('typed at once');
  await page.evaluate(() => addNote());
  await page.locator('#notesInput').fill('the next one');
  await expect(page.locator('#notesPanel .note-text')).toHaveText(['typed at once'], { timeout: 10_000 });
  await expect(page.locator('#notesInput')).toHaveValue('the next one');
  await page.waitForTimeout(7_000);                                     // a list asked for before the save came back does not take it away
  await expect(page.locator('#notesPanel .note-text')).toHaveText(['typed at once']);
});

test('it stops asking once the panel is closed', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, PROGRAM, account);
  let asked = 0;
  page.on('request', (r) => { if (/api\/notes\?/.test(r.url())) asked++; });
  await open(page);
  await expect.poll(() => asked, { timeout: 15_000 }).toBeGreaterThan(1);
  await page.evaluate(() => toggleNotes());
  const at = asked;
  await page.waitForTimeout(8_000);
  expect(asked - at).toBeLessThanOrEqual(1);
});
