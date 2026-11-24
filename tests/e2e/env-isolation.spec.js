// @ts-check
/* ─────────────────────────────────────────────────────────────
   env-isolation.spec.js — live and dev never share settings
   ─────────────────────────────────────────────────────────────
   P-03 (24 Nov 2026): .env was loaded with putenv(). On Windows every
   request shares one Apache process, so a live request running beside a
   dev one read the dev copy's DB_NAME: a sign-in was answered from, and
   work was saved in, the wrong database.

   The account here exists in the live database only. While the other copy
   is kept busy it must sign in on live every time and on dev never.
   Local XAMPP only: both copies have to be on the same server.
   ───────────────────────────────────────────────────────────── */
const { test, expect } = require('./fixtures');

const DEV = 'enterprises/dev/innovation-pipeline/';

/** Keep one copy busy with `lanes` back-to-back requests until stop() is called. */
function traffic(api, path, lanes) {
  let on = true;
  const running = Array.from({ length: lanes }, async () => { while (on) await api.get(path).catch(() => { }); });
  return async () => { on = false; await Promise.all(running); };
}

test('a live account signs in on live only, with both copies in use at once', async ({ account, playwright, baseURL }) => {
  test.setTimeout(120_000);
  test.skip(!/localhost/.test(baseURL || '') || /enterprises\/dev/.test(baseURL || ''), 'needs the live and dev copies on this machine');

  const api = await playwright.request.newContext({ baseURL });
  const busy = await playwright.request.newContext({ baseURL });
  const who = { username: account.username, password: account.password };
  const stops = [traffic(busy, 'api/session', 3), traffic(busy, DEV + 'api/session', 3)];
  try {
    const live = [], dev = [];
    for (let i = 0; i < 12; i++) live.push((await api.post('api/session', { data: who })).status());
    for (let i = 0; i < 3; i++) dev.push((await api.post(DEV + 'api/session', { data: who })).status());   // 3: five wrong ones lock it
    expect(live).toEqual(Array(12).fill(200));
    expect(dev).toEqual(Array(3).fill(401));
  } finally {
    await Promise.all(stops.map((stop) => stop()));
    await api.dispose(); await busy.dispose();
  }
});
