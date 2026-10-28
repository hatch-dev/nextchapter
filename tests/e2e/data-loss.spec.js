// @ts-check
/* The reported data loss, two editors at once — the cases docs/QA-Test-Cases-*.xlsx marks
   "must pass" / BLOCKER. Each title starts with the case IDs it covers.

   Both editors are the owner on two separate browser contexts (otherDevice in fixtures.js):
   locks, merges and uploads are per browser tab, so this is two people to the app. Where the
   workbook checks "updated_by is never Ben", these count the reader's uploads instead.

   One trap these avoid on purpose: a page that is reloaded keeps its section lock on the
   server for up to 15 s (see the KNOWN ISSUE in collaboration.spec.js), so no device here
   reloads and then types into the same section again.

   KNOWN BUGS. Three cases here fail because of defects in the app, not the tests — but not on
   every run, so they cannot be marked test.fail. They carry the @known-bug tag and a note saying
   what was seen; `npm run test:e2e:stable` leaves them out. */
const { test, expect, signIn, serverValue, recordUploads, blockLocks, caret, nextSave } = require('./fixtures');

const ER = 'enterprises/executive-readiness';
const PL = 'enterprises/innovation-pipeline';
const SAVED = { timeout: 15_000 };

test.describe.configure({ timeout: 150_000 });

const erSection = (page, letter) => page.locator(`[onclick*="UI.sec='${letter}'"]`).first().click();
const erScore = (page, path, n) => page.locator(`.lk-btn[onclick="ER.likSet('${path}',${n})"]`);
/** Let a page finish loading, as a person would before typing. In Executive Readiness, an answer typed in the
    first ~0.5 s of the program's very first load is dropped by its first save — a race no person hits, and not
    what these cases are about. */
const settle = (page) => page.waitForTimeout(3000);

/** Test details for a case that currently fails, some of the time, because of the app. */
const knownBug = (description) => ({ tag: '@known-bug', annotation: { type: 'known bug', description } });

/** Open a page on each device and let both settle. */
async function openBoth(a, pathA, b, pathB) {
  await Promise.all([a.goto(pathA), b.goto(pathB)]);
  await Promise.all([settle(a), settle(b)]);
}

async function bothSignedIn(a, b, program, account) {
  await Promise.all([signIn(a, program, account), signIn(b, program, account)]);
}

/** A new funding line on the Capital Planning Hub with this description, left by clicking away. */
async function addFundingLine(page, text) {
  if (!/\/cap-hub/.test(page.url())) await page.goto(PL + '/cap-hub');
  await page.locator('[onclick="UI.hubTab=2;render()"]').click();
  const before = await page.locator('#app input[id^="fl_"][id$="_d"]').count();
  await page.locator('#app button', { hasText: 'Add funding line' }).click();
  const desc = page.locator('#app input[id^="fl_"][id$="_d"]').nth(before);
  const saved = nextSave(page, text);
  await desc.fill(text);
  await desc.blur();
  await saved;
}

const fundLines = async (page) => ((await serverValue(page, 'pipeline', 'capital.fundLines')) || []).map((l) => l.d);

test('[DL-01] Executive Readiness: a colleague only browsing other pages does not wipe what was entered', async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, ER, account);
  await settle(ben);
  const benUploads = recordUploads(ben);

  await ann.goto(ER + '/step/1.1');
  await settle(ann);
  await ann.locator('#ap_mission').fill('ANN-1 mission');
  await ann.locator('#ap_priorities').fill('ANN-2 priorities');
  await erSection(ann, 'B');
  await erScore(ann, 'assessments.fluency.foundational', 4).click();
  await erScore(ann, 'assessments.fluency.strategic', 2).click();
  await erSection(ann, 'D');
  await ann.locator('#ad_ownership').selectOption('cto');

  // Ben opens three other pages and types nothing.
  await ben.evaluate(() => go('step', '2.2'));
  await ben.evaluate(() => go('step', '3.1'));
  await ben.locator('.nav-tab[data-tab="learn"]').click();
  await ann.waitForTimeout(15_000);

  const want = {
    'assessments.purpose.mission': 'ANN-1 mission',
    'assessments.purpose.priorities': 'ANN-2 priorities',
    'assessments.fluency.foundational': 4,
    'assessments.fluency.strategic': 2,
    'assessments.structure.ownership': 'cto',
  };
  for (const [path, value] of Object.entries(want)) {
    await expect.poll(() => serverValue(ann, 'exec-readiness', path), { ...SAVED, message: path }).toBe(value);
  }
  expect(benUploads, 'Ben only looked, so Ben uploaded nothing').toEqual([]);

  await Promise.all([ann.reload(), ben.goto(ER + '/step/1.1')]);
  for (const p of [ann, ben]) {
    await expect(p.locator('#ap_mission')).toHaveValue('ANN-1 mission');
    await erSection(p, 'D');
    await expect(p.locator('#ad_ownership')).toHaveValue('cto');
  }
});

test('[ER-09][DL-N-04] a page that was only read does not push its old values back over a colleague\'s change', async ({ page: ann, otherDevice: ben, account }) => {
  await signIn(ann, ER, account);
  await ann.goto(ER + '/step/1.1');
  await settle(ann);
  const first = nextSave(ann, 'ORIGINAL answer');
  await ann.locator('#ap_mission').fill('ORIGINAL answer');
  await ann.locator('#ap_mission').blur();
  await first;
  await ann.reload();   // Ann now only reads
  await expect(ann.locator('#ap_mission')).toHaveValue('ORIGINAL answer');
  await settle(ann);
  const annUploads = recordUploads(ann);

  await signIn(ben, ER, account);
  await ben.goto(ER + '/step/1.1');
  await expect(ben.locator('#ap_mission')).toBeEditable({ timeout: 20_000 });   // Ann's reload held the lock: see header
  await settle(ben);
  const rewrite = nextSave(ben, 'BEN-REWRITE');
  await ben.locator('#ap_mission').fill('BEN-REWRITE');
  await ben.locator('#ap_mission').blur();
  await rewrite;

  await ann.waitForTimeout(10_000);
  await ann.evaluate(() => go('step', '1.2'));
  await ann.evaluate(() => go('step', '1.1'));
  await ann.waitForTimeout(5000);

  expect(annUploads, 'Ann only read, so Ann uploaded nothing').toEqual([]);
  await expect.poll(() => serverValue(ann, 'exec-readiness', 'assessments.purpose.mission'), SAVED).toBe('BEN-REWRITE');
  await Promise.all([ann.reload(), ben.reload()]);
  await expect(ann.locator('#ap_mission')).toHaveValue('BEN-REWRITE');
  await expect(ben.locator('#ap_mission')).toHaveValue('BEN-REWRITE');
});

test('[ER-06][DL-N-01] half-typed text, caret still in the box, survives a colleague\'s save', async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, ER, account);
  await openBoth(ann, ER + '/step/1.1', ben, ER + '/step/2.1');

  const sentence = 'ANN-ER-06 a long sentence that is still being written';
  await ann.locator('#ap_mission').click();
  await ann.keyboard.type(sentence);

  const benOwner = ben.locator('#st_ownerModel');
  await benOwner.selectOption({ index: 1 });
  const benValue = await benOwner.inputValue();
  await benOwner.blur();

  // Ann touches nothing for 20 s — four sync checks.
  for (let i = 0; i < 4; i++) {
    await ann.waitForTimeout(5000);
    expect(await caret(ann)).toEqual({ id: 'ap_mission', value: sentence, at: sentence.length });
  }

  await expect.poll(() => serverValue(ann, 'exec-readiness', 'assessments.purpose.mission'), SAVED).toBe(sentence);
  await expect.poll(() => serverValue(ann, 'exec-readiness', 'structure.ownerModel'), SAVED).toBe(benValue);
  await ann.reload();
  await expect(ann.locator('#ap_mission')).toHaveValue(sentence);
});

test('[DL-03] the sync check merges a colleague\'s save in the SAME section without touching unsent typing', knownBug(
  'Failed 3 of 3 clean runs (28 Oct 2026), a different loss each time: Ben\'s answer gone from the server; Ann\'s unsent '
  + 'text wiped from her box; Ann\'s answer never reaching the server. A section save carries the whole section from '
  + 'that browser\'s copy, fields it did not change included, so without a lock one person\'s save can blank another\'s.'
), async ({ page: ann, otherDevice: ben, account }) => {
  // Locks keep two people out of one section, so the merge underneath is only reachable without them.
  await Promise.all([blockLocks(ann), blockLocks(ben)]);
  await bothSignedIn(ann, ben, PL, account);
  await openBoth(ann, PL + '/step/1.1', ben, PL + '/step/1.1');

  await ann.locator('#p_mission').click();
  await ann.keyboard.type('ANN-DL-03 mission');
  const benSaved = nextSave(ben, 'BEN-DL-03 goals');
  await ben.locator('#p_goals').fill('BEN-DL-03 goals');
  await ben.locator('#p_goals').blur();
  await benSaved;

  for (let i = 0; i < 4; i++) {
    await ann.waitForTimeout(5000);
    expect(await caret(ann)).toEqual({ id: 'p_mission', value: 'ANN-DL-03 mission', at: 17 });
  }

  // The database first: an upload of the whole `purpose` section from Ann's copy must not have blanked Ben's field.
  await expect.poll(() => serverValue(ann, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-DL-03 mission');
  expect(await serverValue(ann, 'pipeline', 'purpose.goals'), 'Ben\'s answer, on the server').toBe('BEN-DL-03 goals');
  await expect(ann.locator('#p_goals'), 'Ben\'s answer, on Ann\'s screen without a reload').toHaveValue('BEN-DL-03 goals');
  await Promise.all([ann.reload(), ben.reload()]);
  for (const p of [ann, ben]) {
    await expect(p.locator('#p_mission')).toHaveValue('ANN-DL-03 mission');
    await expect(p.locator('#p_goals')).toHaveValue('BEN-DL-03 goals');
  }
});

/** Ann and Ben both change the Mission, with no locks; Ann's upload is held until Ben's has landed, so Ann's
    arrives second, from an older copy. Section saves carry no base revision, so the server takes the last one:
    Ann's. Returns the value that lost (Ben's) and the device it was lost on, once both screens agree. */
async function sameFieldClash(ann, ben, account) {
  await Promise.all([blockLocks(ann), blockLocks(ben)]);
  await bothSignedIn(ann, ben, PL, account);
  await openBoth(ann, PL + '/step/1.1', ben, PL + '/step/1.1');

  let benLanded;
  const benDone = new Promise((resolve) => { benLanded = resolve; });
  await ann.route('**/api/workspace/patch', async (route) => { await benDone; await route.continue(); });

  await ann.locator('#p_mission').click();
  await ann.keyboard.type('ANN-VERSION');
  const benSaved = nextSave(ben, 'BEN-VERSION');
  await ben.locator('#p_mission').fill('BEN-VERSION');
  await ben.locator('#p_mission').blur();
  await benSaved;
  benLanded();

  await expect.poll(() => serverValue(ann, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-VERSION');
  await expect(ben.locator('#p_mission')).toHaveValue('ANN-VERSION', SAVED);
  await expect(ann.locator('#p_mission')).toHaveValue('ANN-VERSION');
  return { loser: ben, lost: 'BEN-VERSION' };
}

test('[LK-04][DL-N-02] when two people change the same field, the one whose value was replaced is told', async ({ page: ann, otherDevice: ben, account }) => {
  const { loser } = await sameFieldClash(ann, ben, account);
  await expect(loser.locator('.collab-report-row')).toContainText('Mission', SAVED);
});

test('[LK-04][DL-N-02] the sync report shows the person the text they lost', knownBug(
  'Failed 3 of 3 clean runs, passed once before: the report on the replaced side reads "Yours, gone: ANN-VERSION / '
  + 'Now stored: ANN-VERSION" — the winning value twice. Ben\'s own text appears nowhere, so he can neither see nor '
  + 'restore what he lost (js/features/collab-notices.js, and whatever hands it `mine`).'
), async ({ page: ann, otherDevice: ben, account }) => {
  const { loser, lost } = await sameFieldClash(ann, ben, account);
  await expect(loser.locator('.collab-report-row')).toContainText(lost, SAVED);
});

test('[PL-05] continuous typing is not reverted by a colleague saving three other sections', knownBug(
  'Failed 2 of 3 runs: letters vanish mid-sentence while the colleague\'s saves arrive ("the quick brown" came out '
  + 'as "the uick brown", and as "the quiwn"). The workbook\'s own wording: no letters lost.'
), async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, PL, account);
  await openBoth(ann, PL + '/step/1.1', ben, PL + '/step/2.1');

  const text = 'ANN-PL-05 '.padEnd(240, 'the quick brown fox ');
  let benDay = '';
  const typing = (async () => {
    await ann.locator('#p_mission').click();
    await ann.keyboard.type(text, { delay: 60 });   // ~15 s without stopping
  })();
  const benWork = (async () => {
    await ben.locator('#ow_ownerName').fill('BEN-1 owner');
    await ben.locator('#ow_ownerName').blur();
    await ben.waitForTimeout(2000);
    await ben.evaluate(() => go('step', '2.3'));
    await ben.locator('#rh_day').selectOption({ index: 2 });
    benDay = await ben.locator('#rh_day').inputValue();
    await ben.waitForTimeout(2000);
    await addFundingLine(ben, 'BEN-3 funding');
  })();
  await Promise.all([typing, benWork]);

  expect(await caret(ann)).toEqual({ id: 'p_mission', value: text, at: text.length });
  await expect.poll(() => serverValue(ann, 'pipeline', 'purpose.mission'), SAVED).toBe(text);
  expect(await serverValue(ann, 'pipeline', 'ownership.ownerName')).toBe('BEN-1 owner');
  expect(await serverValue(ann, 'pipeline', 'rhythm.day')).toBe(benDay);
  expect(await fundLines(ann)).toEqual(['BEN-3 funding']);
});

test('[DL-02] AI Pipeline: someone typing in one section does not cost a colleague their work in others', async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, PL, account);
  await openBoth(ann, PL + '/step/1.1', ben, PL + '/step/2.1');

  let annDay = '';
  const benTyping = (async () => {
    await ben.locator('#ow_authority').click();
    await ben.keyboard.type('BEN-DL-02 '.padEnd(300, 'approve and kill projects '), { delay: 70 });   // ~20 s
    await ben.locator('#ow_authority').blur();
  })();
  const annWork = (async () => {
    await ann.locator('#p_mission').fill('ANN-1 mission');
    await ann.locator('#p_goals').fill('ANN-2 goals');
    await ann.locator('#p_goals').blur();
    await ann.evaluate(() => go('step', '2.3'));
    await ann.locator('#rh_day').selectOption({ index: 3 });
    annDay = await ann.locator('#rh_day').inputValue();
    await addFundingLine(ann, 'ANN-3 line');
    await addFundingLine(ann, 'ANN-4 line');
  })();
  await Promise.all([benTyping, annWork]);
  await ann.waitForTimeout(15_000);

  await expect.poll(() => serverValue(ann, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-1 mission');
  expect(await serverValue(ann, 'pipeline', 'purpose.goals')).toBe('ANN-2 goals');
  expect(await serverValue(ann, 'pipeline', 'rhythm.day')).toBe(annDay);
  expect(await fundLines(ann)).toEqual(['ANN-3 line', 'ANN-4 line']);
  expect(await serverValue(ann, 'pipeline', 'ownership.authority')).toMatch(/^BEN-DL-02 approve and kill/);

  await openBoth(ann, PL + '/step/1.1', ben, PL + '/step/1.1');
  for (const p of [ann, ben]) await expect(p.locator('#p_goals')).toHaveValue('ANN-2 goals');
});

test('[SC-03] saving one section never sends back an older copy of a section this browser did not change', async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, PL, account);
  await openBoth(ann, PL + '/step/1.1', ben, PL + '/cap-hub');   // same starting copy
  const annUploads = recordUploads(ann);

  await addFundingLine(ben, 'BEN-SC-03 line');

  for (let i = 1; i <= 3; i++) {
    const saved = nextSave(ann, `ANN-SC-03 edit ${i}`);
    await ann.locator('#p_mission').fill(`ANN-SC-03 edit ${i}`);
    await ann.locator('#p_mission').blur();
    await saved;
    await ann.waitForTimeout(3000);
  }

  for (const u of annUploads) expect(Object.keys(u.body.sections || u.body.doc || {})).not.toContain('capital');
  expect(await fundLines(ann)).toEqual(['BEN-SC-03 line']);
  expect(await serverValue(ann, 'pipeline', 'purpose.mission')).toBe('ANN-SC-03 edit 3');
});

test('[DL-N-06][ER-12] edits made offline are sent on reconnecting, and a colleague\'s edit meanwhile survives', async ({ page: ann, otherDevice: ben, account }) => {
  await bothSignedIn(ann, ben, PL, account);
  await ann.goto(PL + '/step/1.1');
  await settle(ann);

  await ann.context().setOffline(true);
  await ann.locator('#p_mission').fill('ANN-OFF-1');
  await ann.locator('#p_mission').blur();
  await ann.evaluate(() => go('step', '2.1'));
  await ann.locator('#ow_ownerName').fill('ANN-OFF-2');
  await ann.locator('#ow_ownerName').blur();
  await ann.evaluate(() => go('step', '2.3'));
  await ann.locator('#rh_day').selectOption({ index: 1 });
  const annDay = await ann.locator('#rh_day').inputValue();
  await expect(ann.getByText('Offline — your recent changes are not saved yet')).toBeVisible({ timeout: 15_000 });

  await addFundingLine(ben, 'BEN-ONLINE line');   // Ben is online the whole time

  await ann.context().setOffline(false);
  await expect(ann.getByText('Offline — your recent changes are not saved yet')).toBeHidden({ timeout: 20_000 });

  // Read through Ben: Ann's own context was the one taken offline.
  await expect.poll(() => serverValue(ben, 'pipeline', 'purpose.mission'), SAVED).toBe('ANN-OFF-1');
  expect(await serverValue(ben, 'pipeline', 'ownership.ownerName')).toBe('ANN-OFF-2');
  expect(await serverValue(ben, 'pipeline', 'rhythm.day')).toBe(annDay);
  expect(await fundLines(ben)).toEqual(['BEN-ONLINE line']);
});
