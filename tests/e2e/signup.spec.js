// @ts-check
/* The one sign-up, at /apps/signup (templates/setup.html, js/auth.js → submitSetup). */
const { test, expect, newAccount, visibleErrors, SETUP_CODE } = require('./fixtures');

/** Fill every field. Passwords are filled each time: a re-render after an error clears them by design. */
async function fillForm(page, acct, overrides = {}) {
  const v = { code: SETUP_CODE, confirm: acct.password, ...overrides };
  await page.locator(`input[name="setupAccountType"][value="${acct.role}"]`).check();
  await page.locator('#setupCode').fill(v.code);
  if (acct.role === 'enterprise') await page.locator('#setupOrg').fill(acct.orgName);
  await page.locator('#setupName').fill(acct.name);
  await page.locator('#setupEmail').fill(acct.email);
  await page.locator('#setupUser').fill(acct.username);
  await page.locator('#setupPassword').fill(v.password || acct.password);
  await page.locator('#setupConfirm').fill(v.confirm);
}

test.beforeEach(async ({ page }) => {
  await page.goto('signup');
  await expect(page.locator('#setupCode')).toBeVisible();
});

test.describe('sign-up form', () => {
  test('an empty submit names every missing field', async ({ page }) => {
    await page.locator('[data-submit]').click();
    const errors = await visibleErrors(page);
    expect(Object.keys(errors).sort()).toEqual(
      ['account_type', 'email', 'name', 'password', 'setup_code', 'username'].sort()
    );
  });

  test('the organization field appears for Enterprise only', async ({ page }) => {
    await expect(page.locator('#setupOrg')).toBeHidden();

    await page.locator('input[value="enterprise"]').check();
    await expect(page.locator('#setupOrg')).toBeVisible();
    await expect(page.locator('[data-slot="program-note"]')).toContainText('Enterprise');

    await page.locator('input[value="leader"]').check();
    await expect(page.locator('#setupOrg')).toBeHidden();
    await expect(page.locator('[data-slot="program-note"]')).toContainText('Leaders');
  });

  test('mismatched passwords are refused before anything is sent', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/setup')) posted = true; });
    await fillForm(page, newAccount(), { confirm: 'Something-else-1!' });
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="confirm"]')).toHaveText('The two passwords do not match.');
    expect(posted).toBe(false);
  });

  test('a password without a number is refused', async ({ page }) => {
    await fillForm(page, newAccount(), { password: 'no-numbers-here!', confirm: 'no-numbers-here!' });
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="password"]')).toHaveText('Include at least one number.');
  });

  test('the server refuses a wrong setup code', async ({ page }) => {
    await fillForm(page, newAccount(), { code: 'NOT-THE-CODE' });
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="setup_code"]')).toHaveText('That setup code is not recognized.');
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('a username already taken is refused', async ({ page, account }) => {
    const acct = { ...newAccount(), username: account.username };
    await fillForm(page, acct);
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-err="username"]')).toHaveText('That username is already taken. Choose another.');
  });
});

test.describe('creating an account', () => {
  test('Enterprise: lands signed in on the AI Innovation Pipeline', async ({ page, cleanup }) => {
    const acct = newAccount('enterprise');
    cleanup.add(acct);
    await fillForm(page, acct);
    await page.locator('[data-submit]').click();

    await expect(page).toHaveURL(/\/enterprises\/innovation-pipeline/);
    await expect(page.locator('.nav-tab[data-tab="pipeline"]')).toHaveText('Pipeline');
    await expect(page.locator('.nav-user-chip')).toBeVisible();
  });

  test('Leaders: lands signed in on Judgment, with its own tabs', async ({ page, cleanup }) => {
    const acct = newAccount('leader');
    cleanup.add(acct);
    await fillForm(page, acct);
    await page.locator('[data-submit]').click();

    await expect(page).toHaveURL(/\/leaders\/judgment-critical-thinking/);
    await expect(page.locator('.nav-tab')).toHaveText(['Home', 'Learn', 'Assess', 'Practice', 'Dashboard', 'Insights']);
  });
});
