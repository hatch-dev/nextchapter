// @ts-check
/* ─────────────────────────────────────────────────────────────
   admin-new-org.spec.js — a new organization's temporary password stays on screen
   ─────────────────────────────────────────────────────────────
   P-02 (24 Nov 2026): creating an organization from the admin console
   closed the form and took the only copy of its administrator's temporary
   password with it; nothing emails it. It now stays, with Copy, until Done.

   The suites hold no app administrator password, so the console is opened
   in a member's own page and POST /api/setup is answered here: this tests
   the screen. Nothing is created, and the server would refuse this member.
   PW_MODULE_PATH runs it against another door.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const PROGRAM = process.env.PW_MODULE_PATH || 'enterprises/innovation-pipeline';
const NEW_ORG = { organization_name: 'Northwind Pipeline', name: 'Owner', email: 'owner@example.test', username: 'northwind-owner' };

/** The console, its new-organization form filled and saved; returns the password the server was sent. */
async function createFromConsole(page, account) {
  await signIn(page, PROGRAM, account);
  let sent = null;
  await page.route('**/api/setup', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { success: true, data: { ok: true, mustChange: true } } });
  });
  await page.evaluate(() => {
    if (currentModal) closeModal();   // the owner's first visit may have opened the welcome panel
    Auth.setAdminSession = () => { };
    isAppAdmin = true;
    UI.adminPage = true; UI.adminData = [];
    window['fetchAdminData'] = () => { };   // a member may not read the console's list
    window['hydrateOrgsFromServer'] = (cb) => cb && cb();
    renderAdminModal();
  });
  await page.locator('.adm-new').click();
  for (const [k, v] of Object.entries(NEW_ORG)) await page.locator('#nao_' + k).fill(v);
  const shown = await page.locator('#nao_password').inputValue();
  await page.locator('.adm-newform .org-btn-save').click();
  await expect(page.locator('.adm-created')).toBeVisible();
  expect(sent && sent.password).toBe(shown);
  return shown;
}

test('the temporary password stays on screen until Done', async ({ page, account }) => {
  test.setTimeout(60_000);
  const pw = await createFromConsole(page, account);

  const card = page.locator('.adm-created');
  await expect(page.locator('.adm-newform')).toHaveCount(0);      // the form has closed…
  await expect(page.locator('#nac_password')).toHaveValue(pw);    // …and this is the password that was sent
  await expect(page.locator('#nac_username')).toHaveValue(NEW_ORG.username);
  await expect(card).toContainText(NEW_ORG.organization_name);
  await expect(page.locator('.adm-new')).toHaveCount(0);          // another organization can't replace it unseen

  await page.waitForTimeout(3_000);                               // longer than the message lasts
  await page.evaluate(() => renderAdminModal());                  // and through a repaint
  await expect(page.locator('#nac_password')).toHaveValue(pw);

  expect(await page.evaluate((p) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(p), pw)).toBe(false);   // never saved

  await card.getByRole('button', { name: 'Done' }).click();
  await expect(card).toHaveCount(0);
  expect(await page.locator('#adminPageRoot').innerHTML()).not.toContain(pw);
  await expect(page.locator('.adm-new')).toBeVisible();
});

test('leaving the console with it still up asks first', async ({ page, account }) => {
  test.setTimeout(60_000);
  const pw = await createFromConsole(page, account);

  page.once('dialog', (d) => { expect(d.message()).toContain(NEW_ORG.organization_name); d.dismiss(); });
  await page.evaluate(() => closeAdminPage());
  await expect(page.locator('#nac_password')).toHaveValue(pw);    // stayed

  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => closeAdminPage());
  await expect(page.locator('.adm-created')).toHaveCount(0);
  expect(await page.evaluate(() => UI.adminCreated)).toBeFalsy();
});
