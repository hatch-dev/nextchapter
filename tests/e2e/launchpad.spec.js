// @ts-check
/* The launchpad and the front controller's routing (index.php). No account needed. */
const { test, expect } = require('./fixtures');
const catalogue = require('../../config/catalogue.json');

const programs = catalogue.roles.flatMap((role) =>
  role.modules.map((m) => ({ ...m, path: role.slug + '/' + m.slug }))
);

test.describe('launchpad', () => {
  test('lists every catalogued program, each linking to its own sign-in', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(catalogue.suite.title);
    await expect(page.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', /\/signup$/);

    for (const p of programs) {
      await expect(page.locator(`a[href$="/${p.path}/login"]`), p.name).toBeVisible();
    }
  });

  test('marks planned programs as in development', async ({ page }) => {
    await page.goto('./');
    for (const p of programs) {
      const card = page.locator(`a[href$="/${p.path}/login"]`);
      if (p.status === 'live') await expect(card, p.name).not.toContainText(/in development/i);
      else await expect(card, p.name).toContainText(/in development/i);
    }
  });
});

test.describe('routing', () => {
  test('there is no shared /login', async ({ request }) => {
    expect((await request.get('login')).status()).toBe(404);
  });

  test('an unknown program is 404, not an app', async ({ request }) => {
    expect((await request.get('enterprises/no-such-program')).status()).toBe(404);
  });

  test('a program\'s old /signup address 301s to the one sign-up', async ({ request }) => {
    const res = await request.get('enterprises/innovation-pipeline/signup', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toMatch(/\/signup$/);
  });

  for (const p of programs.filter((p) => p.status === 'live')) {
    test(`${p.name} has its own sign-in`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(p.path + '/login');
      await expect(page.locator('.login-eyebrow')).toHaveText(new RegExp(p.name, 'i'));
      await expect(page.locator('#loginUser')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
