// @ts-check
/* What saves, and when — one editor. Automates the saving cases of docs/QA-Test-Cases-*.xlsx;
   each test title starts with the case IDs it covers.

   Saves are grouped on purpose: ~0.6 s after a click, up to 1.5 s after the last keystroke,
   never more than 4 s (the workbook's "Counting uploads" note). So "it saved" is always
   polled for, never checked once. */
const { test, expect, signIn, serverWorkspace, serverValue, recordUploads } = require('./fixtures');

const ER = 'enterprises/executive-readiness';
const PL = 'enterprises/innovation-pipeline';
const SAVED = { timeout: 10_000 };

test.describe.configure({ timeout: 90_000 });

/** A section of Executive Readiness's Assessment Battery (A–E). */
const erSection = (page, letter) => page.locator(`[onclick*="UI.sec='${letter}'"]`).first().click();
/** One of Executive Readiness's 1–5 buttons. */
const erScore = (page, path, n) => page.locator(`.lk-btn[onclick="ER.likSet('${path}',${n})"]`);
/** Let boot finish its own writes before counting anything. */
const settle = (page) => page.waitForTimeout(3000);

test.describe('Executive Readiness', () => {
  test.beforeEach(async ({ page, account }) => {
    await signIn(page, ER, account);
    await page.goto(ER + '/step/1.1');
    await expect(page.locator('#ap_mission')).toBeEditable();
  });

  test('[ER-04] text is stored while the caret is still in the box', async ({ page }) => {
    await page.locator('#ap_mission').click();
    await page.keyboard.type('ANN-ER-04 mission');
    await expect.poll(async () => serverValue(page, 'exec-readiness', 'assessments.purpose.mission'), SAVED)
      .toBe('ANN-ER-04 mission');

    await page.reload();   // no click away first
    await expect(page.locator('#ap_mission')).toHaveValue('ANN-ER-04 mission');
  });

  test('[ER-01] a 1–5 score is stored the moment it is pressed', async ({ page }) => {
    await erSection(page, 'B');
    await erScore(page, 'assessments.fluency.foundational', 4).click();
    await expect.poll(async () => serverValue(page, 'exec-readiness', 'assessments.fluency.foundational'), SAVED)
      .toBe(4);

    await page.reload();
    await erSection(page, 'B');
    await expect(erScore(page, 'assessments.fluency.foundational', 4)).toHaveClass(/\bsel\b/);
  });

  test('[ER-02] a dropdown choice is stored without navigating away', async ({ page }) => {
    await erSection(page, 'D');
    await page.locator('#ad_ownership').selectOption('cto');
    await expect.poll(async () => serverValue(page, 'exec-readiness', 'assessments.structure.ownership'), SAVED)
      .toBe('cto');
  });

  test('[ER-11] a reload within half a second of a dropdown change keeps the new value', async ({ page }) => {
    await erSection(page, 'D');
    await page.locator('#ad_ownership').selectOption('ceo');
    await page.waitForTimeout(500);   // "F5 within half a second". Sooner than ~150 ms loses it: see the KNOWN ISSUE below
    await page.reload();

    await erSection(page, 'D');
    await expect(page.locator('#ad_ownership')).toHaveValue('ceo');
    await expect.poll(async () => serverValue(page, 'exec-readiness', 'assessments.structure.ownership'), SAVED)
      .toBe('ceo');
  });

  test('[ER-07] moving between pages without typing uploads nothing', async ({ page }) => {
    await settle(page);
    const before = (await serverWorkspace(page, 'exec-readiness')).rev;
    const uploads = recordUploads(page);

    await page.locator('.nav-tab[data-tab="home"]').click();
    await page.locator('.nav-tab[data-tab="learn"]').click();
    await page.locator('.nav-tab[data-tab="pipeline"]').click();
    await page.evaluate(() => go('phase-2'));
    await page.evaluate(() => go('step', '2.2'));
    await page.waitForTimeout(6000);   // past one 5-second sync check

    expect(uploads).toEqual([]);
    expect((await serverWorkspace(page, 'exec-readiness')).rev).toBe(before);
  });

  test('[ER-08][DL-E-01] an idle window uploads nothing; one edit uploads once', async ({ page }) => {
    await settle(page);
    const uploads = recordUploads(page);
    await page.waitForTimeout(30_000);   // the workbook says 2 minutes; 30 s is six sync checks
    expect(uploads).toEqual([]);

    await erSection(page, 'B');
    await erScore(page, 'assessments.fluency.handsOn', 2).click();
    await page.waitForTimeout(5000);
    expect(uploads).toHaveLength(1);
  });
});

test.describe('AI Innovation Pipeline', () => {
  test.beforeEach(async ({ page, account }) => {
    await signIn(page, PL, account);
    await page.goto(PL + '/step/1.1');
    await expect(page.locator('#p_mission')).toBeEditable();
  });

  test('[PL-01][PL-02] typing a paragraph is stored, in a handful of uploads naming only its section', async ({ page }) => {
    await settle(page);
    const uploads = recordUploads(page);
    const paragraph = 'ANN-PL-02 '.padEnd(200, 'abcdefghij ');

    await page.locator('#p_mission').click();
    await page.keyboard.type(paragraph, { delay: 30 });
    await expect.poll(async () => serverValue(page, 'pipeline', 'purpose.mission'), SAVED).toBe(paragraph);

    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.length).toBeLessThan(10);
    for (const u of uploads) expect(Object.keys(u.body.sections || u.body.doc)).toEqual(['purpose']);
  });

  test('[PL-03] a funding line\'s description is stored while it is being typed', async ({ page }) => {
    await page.goto(PL + '/cap-hub');
    await page.locator('[onclick="UI.hubTab=2;render()"]').click();
    await page.locator('#app button', { hasText: 'Add funding line' }).click();

    const desc = page.locator('#app input[id^="fl_"][id$="_d"]').first();
    await desc.click();
    await page.keyboard.type('ANN-PL-03 cloud credits');
    await expect.poll(async () => ((await serverValue(page, 'pipeline', 'capital.fundLines')) || []).map((l) => l.d), SAVED)
      .toEqual(['ANN-PL-03 cloud credits']);

    await page.reload();   // caret still in the box
    await page.locator('[onclick="UI.hubTab=2;render()"]').click();
    await expect(page.locator('#app input[id^="fl_"][id$="_d"]').first()).toHaveValue('ANN-PL-03 cloud credits');
  });

  test('[DL-N-07] a reload within half a second of typing keeps what was typed', async ({ page }) => {
    await page.locator('#p_mission').click();
    await page.keyboard.type('ANN-RELOAD-1');
    await page.reload();

    await expect(page.locator('#p_mission')).toHaveValue('ANN-RELOAD-1');
    await expect.poll(async () => serverValue(page, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-RELOAD-1');
  });

  test('[DL-N-03] moving to another page within a second of typing keeps it', async ({ page }) => {
    await page.locator('#p_mission').click();
    await page.keyboard.type('ANN-LEAVE-1');
    await page.locator('.nav-tab[data-tab="learn"]').click();

    await expect.poll(async () => serverValue(page, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-LEAVE-1');
    await page.evaluate(() => go('step', '1.1'));
    await expect(page.locator('#p_mission')).toHaveValue('ANN-LEAVE-1');
  });

  /** Type, then switch program half a second later — "within a second": the menu is two clicks for a person. */
  async function typeThenSwitch(page, text) {
    await page.locator('#p_mission').click();
    await page.keyboard.type(text);
    await page.waitForTimeout(500);
    await page.locator('[data-act="modules"]').click();
    await page.locator('[data-act="module-pick"][data-module="exec-readiness"]').click();
    await expect(page).toHaveURL(/executive-readiness/);
  }

  test('[DL-N-03] text typed just before switching program is not lost: it is sent on coming back', async ({ page }) => {
    await typeThenSwitch(page, 'ANN-SWITCH-1');
    await page.goto(PL + '/step/1.1');
    await expect(page.locator('#p_mission')).toHaveValue('ANN-SWITCH-1');
    await expect.poll(async () => serverValue(page, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-SWITCH-1');
  });

  test('[DL-N-03] KNOWN ISSUE: text typed just before switching program reaches the server before the switch', async ({ page }) => {
    test.fail(true, 'Nothing is uploaded on leaving a page (js/app.js has no beforeunload/pagehide flush). An edit made in '
      + 'the last ~1.5 s waits in this browser’s local copy until the program is opened here again, so colleagues do not '
      + 'see it, and it is lost if this browser never comes back. Remove this line once that is fixed.');
    await typeThenSwitch(page, 'ANN-SWITCH-2');
    await expect.poll(async () => serverValue(page, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-SWITCH-2');
  });

  test('[PL-07] closing the tab a second after typing keeps it', async ({ page, context, account }) => {
    await page.locator('#p_mission').click();
    await page.keyboard.type('ANN-CLOSE-1');
    await page.waitForTimeout(500);
    await page.close({ runBeforeUnload: true });

    const again = await context.newPage();   // same browser, new tab: signs in again like a person would
    await signIn(again, PL, account);
    await again.goto(PL + '/step/1.1');
    await expect(again.locator('#p_mission')).toHaveValue('ANN-CLOSE-1');
    await expect.poll(async () => serverValue(again, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-CLOSE-1');
  });

  test('[PL-06] moving between pages without typing uploads nothing', async ({ page }) => {
    await settle(page);
    const before = (await serverWorkspace(page, 'pipeline')).rev;
    const uploads = recordUploads(page);

    await page.locator('.nav-tab[data-tab="home"]').click();
    await page.locator('.nav-tab[data-tab="learn"]').click();
    await page.locator('.nav-tab[data-tab="pipeline"]').click();
    await page.evaluate(() => go('phase-2'));
    await page.evaluate(() => go('step', '2.3'));
    await page.evaluate(() => go('phase-3'));
    await page.evaluate(() => go('step', '3.1'));
    await page.waitForTimeout(6000);

    expect(uploads).toEqual([]);
    expect((await serverWorkspace(page, 'pipeline')).rev).toBe(before);
  });
});
