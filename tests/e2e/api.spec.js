// @ts-check
/* The API's own rules, checked without the browser — what the server enforces whatever a client sends. */
const { test, expect, newAccount, SETUP_CODE } = require('./fixtures');

test('nobody signed in: GET /session answers ok:false', async ({ request }) => {
  const res = await request.get('api/session');
  expect(res.status()).toBe(200);
  expect((await res.json()).data.ok).toBe(false);
});

test('POST /setup checks the setup code before anything else', async ({ request }) => {
  const res = await request.post('api/setup', { data: { setup_code: 'NOT-THE-CODE' } });
  expect(res.status()).toBe(422);
  expect((await res.json()).reason).toBe('bad-code');
});

test('POST /setup refuses a common password', async ({ request }) => {
  const acct = newAccount('leader');
  const res = await request.post('api/setup', {
    data: { account_type: 'leader', setup_code: SETUP_CODE, name: acct.name, email: acct.email, username: acct.username, password: 'Password1!' },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).errors).toHaveProperty('password');
});

test('POST /setup refuses an email already in use', async ({ request, account }) => {
  const acct = newAccount('leader');
  const res = await request.post('api/setup', {
    data: { account_type: 'leader', setup_code: SETUP_CODE, name: acct.name, email: account.email, username: acct.username, password: acct.password },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).errors).toHaveProperty('email');
});

test('a wrong password is 401 and starts no session', async ({ request, account }) => {
  const res = await request.post('api/session', { data: { username: account.username, password: 'Wrong-password-1!' } });
  expect(res.status()).toBe(401);
  expect((await (await request.get('api/session')).json()).data.ok).toBe(false);
});

test('a signed-in member reads their own workspace, and only their own', async ({ request, account }) => {
  await request.post('api/session', { data: { username: account.username, password: account.password } });
  const me = (await (await request.get('api/session')).json()).data;
  expect(me.ok).toBe(true);
  expect(me.organization.name).toBe(account.orgName);

  const own = await request.get(`api/workspace?org=${me.organization.id}&module=pipeline&actor=${me.user.id}`);
  expect(own.status()).toBe(200);

  const other = await request.get(`api/workspace?org=org_does_not_exist&module=pipeline&actor=${me.user.id}`);
  expect(other.ok()).toBe(false);
});

test('a member cannot delete another organization', async ({ playwright, baseURL, account }) => {
  // A second, separate account, signed in on its own context.
  const intruder = newAccount('leader');
  const api = await playwright.request.newContext({ baseURL });
  try {
    await api.post('api/setup', {
      data: { account_type: 'leader', setup_code: SETUP_CODE, name: intruder.name, email: intruder.email, username: intruder.username, password: intruder.password },
    });

    const owner = await playwright.request.newContext({ baseURL });
    await owner.post('api/session', { data: { username: account.username, password: account.password } });
    const victimOrg = (await (await owner.get('api/session')).json()).data.organization.id;
    await owner.dispose();

    const res = await api.post('api/organizations/delete', { data: { id: victimOrg } });
    expect(res.status()).toBe(403);
  } finally {
    // The intruder's own organization: they own it, so they can remove it.
    const mine = (await (await api.get('api/session')).json()).data;
    if (mine.ok) await api.post('api/organizations/delete', { data: { id: mine.organization.id } });
    await api.dispose();
  }
});
