// @ts-check
/* Answering a step and keeping the answer (Store in js/app.js; docs/data-persistence.md).
   One editor here — two at once is collaboration.spec.js. Uses the Pipeline's step 1.1,
   Assessment Battery, whose free-text answers are the `purpose` section of the workspace. */
const { test, expect, signIn, serverAnswers, nextSave } = require('./fixtures');

const PIPELINE = 'enterprises/innovation-pipeline';

test.beforeEach(async ({ page, account }) => {
  await signIn(page, PIPELINE, account);
  await page.goto(PIPELINE + '/step/1.1');
  await expect(page.locator('#p_mission')).toBeEditable();
});

test('an answer survives a reload', async ({ page }) => {
  const saved = nextSave(page, 'We make reliable widgets.');
  await page.locator('#p_mission').fill('We make reliable widgets.');
  await saved;

  await page.reload();
  await expect(page.locator('#p_mission')).toHaveValue('We make reliable widgets.');
});

test('an answer reaches the server\'s Q&A trail against its step', async ({ page }) => {
  const saved = nextSave(page, '1. Grow revenue 10%');
  await page.locator('#p_goals').fill('1. Grow revenue 10%');
  await saved;

  const answers = await serverAnswers(page, 'pipeline');
  expect(answers['purpose.goals']).toMatchObject({ step_id: '1.1', phase: 1, answer: '1. Grow revenue 10%' });
});

test('every answer on the step is kept, not just the last one typed', async ({ page }) => {
  const fields = { p_mission: 'Mission text', p_values: 'Quality, Partnership', p_frictions: '1. Slow quoting' };
  for (const [id, value] of Object.entries(fields)) await page.locator('#' + id).fill(value);
  await page.locator('#p_frictions').blur();
  await expect.poll(async () => Object.keys(await serverAnswers(page, 'pipeline')).sort(), { timeout: 10_000 })
    .toEqual(['purpose.frictions', 'purpose.mission', 'purpose.values']);

  await page.reload();
  for (const [id, value] of Object.entries(fields)) await expect(page.locator('#' + id)).toHaveValue(value);
});

test('clearing an answer removes it', async ({ page }) => {
  const saved = nextSave(page, 'Temporary');
  await page.locator('#p_mission').fill('Temporary');
  await saved;

  await page.locator('#p_mission').fill('');
  await page.locator('#p_mission').blur();
  await expect.poll(async () => Object.keys(await serverAnswers(page, 'pipeline')), { timeout: 10_000 })
    .not.toContain('purpose.mission');

  await page.reload();
  await expect(page.locator('#p_mission')).toHaveValue('');
});

test('a device that signs in afterwards opens on the same answers', async ({ page, otherDevice, account }) => {
  const saved = nextSave(page, 'Written on the first device.');
  await page.locator('#p_mission').fill('Written on the first device.');
  await saved;

  await signIn(otherDevice, PIPELINE, account);
  await otherDevice.goto(PIPELINE + '/step/1.1');
  await expect(otherDevice.locator('#p_mission')).toHaveValue('Written on the first device.');
});
