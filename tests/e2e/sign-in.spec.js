// @ts-check
/* Sign-in at a program's door, the session, the nav, and sign-out (js/auth.js, js/nav.js, signOut in js/app.js). */
const { test, expect, signIn, visibleErrors } = require('./fixtures');

const ER = 'enterprises/executive-readiness';

test.describe('sign-in form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ER + '/login');
  });

  test('an empty submit asks for both fields', async ({ page }) => {
    await page.locator('[data-submit]').click();
    expect(await visibleErrors(page)).toEqual({
      user: 'Enter your username.',
      password: 'Enter your password.',
    });
  });

  test('a wrong password gets one message that does not say which field was wrong', async ({ page, account }) => {
    await page.locator('#loginUser').fill(account.username);
    await page.locator('#loginPassword').fill('Wrong-password-1!');
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="_general"]')).toHaveText('That username and password do not match.');
    await expect(page.locator('#loginUser')).toHaveValue(account.username);
  });

  test('an unknown username gets the same message', async ({ page }) => {
    await page.locator('#loginUser').fill('pw_nobody_' + Date.now());
    await page.locator('#loginPassword').fill('Wrong-password-1!');
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="_general"]')).toHaveText('That username and password do not match.');
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page, account }) => {
    await signIn(page, ER, account);
  });

  test('opens the program it was entered from', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(ER + '(/home)?$'));
    await expect(page.locator('.nav-tab')).toHaveText(['Home', 'Learn', 'Readiness', 'Lead', 'Insights']);
  });

  test('each tab changes the address and becomes the active one', async ({ page }) => {
    for (const tab of ['learn', 'pipeline', 'phase5', 'insights', 'home']) {
      await page.locator(`.nav-tab[data-tab="${tab}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${ER}/${tab}$`));
      await expect(page.locator('.nav-tab.active')).toHaveAttribute('data-tab', tab);
    }
  });

  test('the session survives a reload', async ({ page }) => {
    await page.locator('.nav-tab[data-tab="learn"]').click();
    await page.reload();
    await expect(page.locator('.nav-tab.active')).toHaveAttribute('data-tab', 'learn');
    await expect(page.locator('#loginUser')).toHaveCount(0);
  });

  test('the module switcher moves to another program without signing in again', async ({ page }) => {
    await page.locator('[data-act="modules"]').click();
    const pick = page.locator('[data-act="module-pick"][data-module="pipeline"]');
    await expect(pick).toContainText('AI Innovation Pipeline');
    await pick.click();
    await expect(page).toHaveURL(/\/enterprises\/innovation-pipeline/);
    await expect(page.locator('.nav-tab[data-tab="pipeline"]')).toHaveText('Pipeline');
  });

  test('signing out ends the server session and returns to this program\'s sign-in', async ({ page }) => {
    page.once('dialog', (d) => d.accept());   // "Sign out? Your work is saved."
    await page.locator('[data-act="usermenu"]').click();
    await page.locator('[data-act="signout"]').click();

    await expect(page).toHaveURL(new RegExp(ER + '/login$'));
    await expect(page.locator('#loginUser')).toBeVisible();
    const session = await (await page.request.get('api/session')).json();
    expect(session.data.ok).toBe(false);
  });

  test('cancelling the sign-out prompt keeps you signed in', async ({ page }) => {
    page.once('dialog', (d) => d.dismiss());
    await page.locator('[data-act="usermenu"]').click();
    await page.locator('[data-act="signout"]').click();

    await expect(page.locator('.nav-tab[data-tab="home"]')).toBeVisible();
    const session = await (await page.request.get('api/session')).json();
    expect(session.data.ok).toBe(true);
  });
});
