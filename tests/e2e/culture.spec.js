// @ts-check
/* AI-Ready Culture on the live app (10 Nov 2026): the program opens at its own address, saves what is
   typed to its own workspace (module ai-culture), starts a new organization with the AI Guide on, and
   its Ask Danni panel asks POST /guide naming this program. The Guide's reply is stubbed here, so the
   test never reaches Pinecone. */
const { test, expect, signIn, serverWorkspace } = require('./fixtures');

const CULTURE = 'enterprises/culture';

test.beforeEach(async ({ page, account }) => {
  await signIn(page, CULTURE, account);
});

test('the program opens as AI-Ready Culture, with no script errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const where of ['', '/learn', '/pipeline', '/step/1.1', '/phase5']) {
    await page.goto(CULTURE + where);
    await expect(page.locator('#app')).not.toBeEmpty();
  }
  await expect(page).toHaveTitle(/AI-Ready Culture/);
  expect(errors).toEqual([]);
});

test('a typed answer is saved to the Culture workspace and survives a reload', async ({ page }) => {
  await page.goto(CULTURE + '/step/1.1');
  const field = page.locator('#app textarea:visible, #app input[type="text"]:visible').first();
  await expect(field).toBeEditable();
  const id = await field.getAttribute('id');
  expect(id).toBeTruthy();

  const text = 'Typed by the Culture e2e test.';
  const saved = page.waitForResponse((r) => /\/api\/workspace(\/patch)?$/.test(new URL(r.url()).pathname)
    && r.request().method() === 'POST' && r.ok() && (r.request().postData() || '').includes(text));
  await field.fill(text);
  await field.blur();
  await saved;

  const { doc } = await serverWorkspace(page, 'ai-culture');
  expect(JSON.stringify(doc)).toContain(text);
  expect(doc.settings).toMatchObject({ aiGuide: true, voice: true });

  await page.reload();
  await expect(page.locator('#' + id)).toHaveValue(text);
});

/* Every Culture video shows a frame while it loads (10 Nov 2026): the shell gives a video with no poster of its own
   the .jpg saved beside its .mp4 (shell.html), and the podcast keeps its own thumbnail. */
test('every video has a poster that loads', async ({ page }) => {
  const seen = {};
  async function check(label) {
    await expect(page.locator('#app video').first()).toBeAttached();
    const posters = await page.$$eval('#app video', (vs) => vs.map((v) => v.getAttribute('poster') || ''));
    expect(posters.length, label).toBeGreaterThan(0);
    for (const p of posters) {
      expect(p, label + ': a video without a poster').not.toBe('');
      const res = await page.request.get(p);
      expect(res.ok() && (res.headers()['content-type'] || '').startsWith('image/'), label + ': ' + p).toBe(true);
      seen[p] = true;
    }
  }
  await page.goto(CULTURE);
  await check('Home');
  await page.goto(CULTURE + '/pipeline');
  await check('Framework');
  for (const n of [1, 2, 3, 4]) {   /* Phase 5's heading opens the Culture Dashboard, which has no video */
    await page.evaluate((id) => window.go('phase', id), n);
    await check('Phase ' + n);
  }
  expect(Object.keys(seen).length).toBeGreaterThanOrEqual(7);
});

test('Ask Danni asks the Guide for this program', async ({ page }) => {
  let body = null;
  await page.route('**/api/guide', (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'Start with the Assessment Battery.' }) });
  });
  await page.goto(CULTURE + '/step/1.1');
  const fab = page.locator('#coachFab');
  await expect(fab).toBeVisible();
  await expect(fab).toContainText('Ask Danni');
  await fab.click();
  await page.locator('#coachInput').fill('Where do I start?');
  await page.locator('#coachInput').press('Enter');
  await expect(page.locator('#coachPanel')).toContainText('Start with the Assessment Battery.');
  expect(body).toMatchObject({ module: 'ai-culture', question: 'Where do I start?' });
  expect(body.context).toContain('Step 1.1');
});
