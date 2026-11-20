// @ts-check
/* ─────────────────────────────────────────────────────────────
   org-live.spec.js — Organization & Team shows a colleague's edit live
   ─────────────────────────────────────────────────────────────
   The window is drawn on its own layer, and a sync used to repaint only
   the page behind it, so a colleague's change to the organization's
   details stayed out of sight until the window was closed and opened
   again. Its fields also saved only when focus left them. Now they save
   a beat after typing stops (data-live) and the open window is redrawn
   by the sync (orgModalAfterSync).

   The details are one section of the workspace, and each save used to
   send the whole of it. The edit lock on it lapses while the writer is
   still in their field, so a colleague could then fill in another field
   and the writer's next save put that one back as it was. A save now
   sends only the fields it changed (js/app.js fieldDelta).

   Two browsers with no shared storage, the owner signed in on both, as
   collaboration.spec.js does: edit locks are per tab, not per person.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn, serverValue } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';
const MODULE = 'ai-governance';

test("a colleague's organization details appear in an open Organization & Team window while they type", async ({ page, otherDevice, account }) => {
  test.setTimeout(120_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  await page.evaluate(() => openOrg());
  await otherDevice.evaluate(() => openOrg());

  const site = 'live-' + Date.now().toString(36) + '.example';
  await page.locator('#ent_website').click();
  await page.locator('#ent_website').pressSequentially(site, { delay: 30 });   // and stays in the field: no blur

  await expect(otherDevice.locator('#ent_website')).toHaveValue(site, { timeout: 30_000 });
  await expect(page.locator('#ent_website')).toHaveValue(site);              // the writer's own box untouched
  await expect(page.locator('#ent_website')).toBeFocused();
});

test('the AI Guide and Voice switches are locked for a colleague while one is being changed, and the change reaches them', async ({ page, otherDevice, account }) => {
  test.setTimeout(120_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  await page.evaluate(() => openOrg());
  await otherDevice.evaluate(() => openOrg());

  await page.locator('.ai-fold summary').click();
  const was = await page.locator('#aiSet_aiGuide').isChecked();
  await page.locator('#aiSet_aiGuide').click();
  await expect(page.locator('#aiSet_aiGuide')).toBeFocused();   // kept after the redraw, so the lock is kept

  // The colleague's fold is closed: the note stands above it, and the switches are off limits.
  await expect(otherDevice.locator('#modalRoot .collab-lock-mark')).toContainText('is editing', { timeout: 30_000 });
  await expect(otherDevice.locator('#aiSet_aiGuide')).toBeDisabled();
  await expect(otherDevice.locator('#aiSet_voice')).toBeDisabled();
  if (was) await expect(otherDevice.locator('#aiSet_aiGuide')).not.toBeChecked({ timeout: 30_000 });
  else await expect(otherDevice.locator('#aiSet_aiGuide')).toBeChecked({ timeout: 30_000 });

  // Let go, and the colleague may use them again.
  await page.locator('#ent_name').click();
  await expect(otherDevice.locator('#aiSet_aiGuide')).toBeEnabled({ timeout: 30_000 });
});

test("a colleague's change does not scroll an open Organization & Team window back to the top", async ({ page, otherDevice, account }) => {
  test.setTimeout(120_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  await page.evaluate(() => openOrg());
  await otherDevice.evaluate(() => openOrg());
  await otherDevice.setViewportSize({ width: 1100, height: 600 });   // short enough that the window scrolls

  const scrolled = await otherDevice.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); m.scrollTop = m.scrollHeight; return m.scrollTop; });
  expect(scrolled).toBeGreaterThan(50);

  const site = 'scroll-' + Date.now().toString(36) + '.example';
  await page.locator('#ent_website').click();
  await page.locator('#ent_website').pressSequentially(site, { delay: 30 });
  await expect(otherDevice.locator('#ent_website')).toHaveValue(site, { timeout: 30_000 });

  const after = await otherDevice.evaluate(() => document.querySelector('#modalRoot .modal').scrollTop);
  expect(Math.abs(after - scrolled)).toBeLessThan(5);
});

test('two people filling in different organization details both keep what they wrote', async ({ page, otherDevice, account }) => {
  test.setTimeout(150_000);
  await signIn(page, GOVERNANCE, account);
  await signIn(otherDevice, GOVERNANCE, account);
  await page.evaluate(() => openOrg());
  await otherDevice.evaluate(() => openOrg());

  await page.locator('#ent_website').click();
  await page.locator('#ent_website').pressSequentially('first.example', { delay: 30 });
  await expect(otherDevice.locator('#ent_website')).toHaveValue('first.example', { timeout: 30_000 });

  /* The writer is to hold an old copy of everything else when they save next, as they do whenever the
     colleague's save lands between two of theirs. Their 5-second check for news is held back so that it
     certainly does; their writes, and the read a save makes when it finds the document moved on, still go.
     (The edit lock on the details lapses and returns while the writer sits in their field, so the
     colleague's save is made the way the field makes it, not by clicking in.) */
  const POLL = /\/api\/workspace\/rev\?/;
  await page.route(POLL, (route) => route.abort());
  await otherDevice.evaluate(() => { document.getElementById('ent_industry').value = 'Pharma'; saveEnterprise(); });
  await expect.poll(() => serverValue(otherDevice, MODULE, 'enterprise.industry'), { timeout: 30_000 }).toBe('Pharma');

  // The writer types on in the website field, with an old copy of everything else.
  await page.locator('#ent_website').press('End');
  await page.locator('#ent_website').pressSequentially('.uk', { delay: 30 });
  await expect.poll(() => serverValue(otherDevice, MODULE, 'enterprise.website'), { timeout: 30_000 }).toBe('first.example.uk');

  expect(await serverValue(otherDevice, MODULE, 'enterprise.industry')).toBe('Pharma');   // not put back to empty
  await page.unroute(POLL);
  await expect(page.locator('#ent_industry')).toHaveValue('Pharma', { timeout: 30_000 });
  await expect(otherDevice.locator('#ent_website')).toHaveValue('first.example.uk', { timeout: 30_000 });
  await expect(otherDevice.locator('#ent_industry')).toHaveValue('Pharma');
});
