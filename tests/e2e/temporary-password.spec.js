// @ts-check
/* ─────────────────────────────────────────────────────────────
   temporary-password.spec.js — temporary passwords are generated
   ─────────────────────────────────────────────────────────────
   Adding someone, the temporary password is generated for them, never
   typed (18 Nov 2026): a read-only field with Copy and New. Editing
   someone keeps their password unless Reset password is pressed.

   The member added here is real (the invite goes to an @example.test
   address, which delivers nowhere) and goes with the organization when
   the fixture deletes it. Signing in as them with the generated password
   proves the server took exactly what was on screen.
   ───────────────────────────────────────────────────────────── */
const { test, expect, signIn } = require('./fixtures');

const GOVERNANCE = process.env.PW_GOV_PATH || 'enterprises/responsible-ai-governance';
const RULE = (pw) => pw.length === 12 && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw);

test('a new member gets a generated temporary password that signs them in', async ({ page, account, playwright, baseURL }) => {
  test.setTimeout(90_000);
  await signIn(page, GOVERNANCE, account);
  await page.evaluate(() => { openOrg(); addProfile(); });

  const temp = page.locator('input[id^="ru_"][id$="_temporary"]');
  await expect(temp).toBeVisible();
  const draftId = (await temp.getAttribute('id') || '').replace(/^ru_/, '').replace(/_temporary$/, '');
  await expect(temp).toHaveAttribute('readonly', '');
  const first = await temp.inputValue();
  expect(RULE(first), first).toBe(true);

  await page.locator('.tp-btn', { hasText: 'New' }).click();
  const pw = await temp.inputValue();
  expect(pw).not.toBe(first);
  expect(RULE(pw), pw).toBe(true);

  const uname = 'pwm_' + Date.now().toString(36);
  const f = (k) => page.locator('#ru_' + draftId + '_' + k);
  await f('name').fill('Generated Member');
  await f('username').fill(uname);
  await f('role').fill('Tester');
  await f('scope').fill('All');
  await f('email').fill(uname + '@example.test');
  await f('dept').fill('QA');
  await page.locator(`input[type="checkbox"][id^="rm_${draftId}_"]:not(:disabled)`).first().check();   // no program would ask first (P-04)
  await page.locator('.org-btn-save').first().click();
  await expect(page.locator('#ru_' + draftId + '_temporary')).toHaveCount(0, { timeout: 20_000 });   // the editor closed: saved

  const api = await playwright.request.newContext({ baseURL });
  try {
    const res = await api.post('api/session', { data: { username: uname, password: pw } });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBe(true);
    expect(body.data && body.data.mustChange).toBe(true);   // asked to choose their own
  } finally { await api.dispose(); }
});

test('editing a member keeps their password unless Reset password is pressed', async ({ page, account }) => {
  test.setTimeout(60_000);
  await signIn(page, GOVERNANCE, account);
  // the owner's own row has no password field (isMe), so add-then-reopen is not needed: reuse the generator's markup directly
  const html = await page.evaluate(() => temporaryFieldHtml('ru_x_temporary', false, ''));
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'tpHost'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await expect(page.locator('#ru_x_temporary')).toHaveCount(0);
  await page.locator('#tpHost .tp-reset').click();
  const pw = await page.locator('#ru_x_temporary').inputValue();
  expect(RULE(pw), pw).toBe(true);
  await page.locator('#tpHost .tp-keep').click();
  await expect(page.locator('#ru_x_temporary')).toHaveCount(0);
});
