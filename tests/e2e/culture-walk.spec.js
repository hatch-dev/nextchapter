// @ts-check
/* AI-Ready Culture, every page in a real browser (11 Nov 2026).
   tools/ai-culture-smoke.js renders every page and evaluates every handler in a stub DOM; this does the same
   walk in Chromium against the running stack, where layout, images, the server and the shell are real:

     1. a new organization's empty workspace — every page opens with no script error, no failed request, no
        "undefined"/"NaN"/"[object Object]" in the text, and no broken image;
     2. the same account types into every text field on every step, and every value reaches the server and is
        back in its field on a second device;
     3. the Demo tab (the seeded Harbor Ridge sample, which never leaves the browser) — every page again, then
        every visible button on every page is clicked, with no script error;
     4. every page at phone width (390px) — no sideways scroll. */
const { test, expect, signIn, serverWorkspace } = require('./fixtures');

/* PW_CULTURE_PATH runs these against the dev install's door: PW_BASE_URL=http://localhost/apps/enterprises/dev/innovation-pipeline/ PW_CULTURE_PATH=../culture */
const CULTURE = process.env.PW_CULTURE_PATH || 'enterprises/culture';
const NOISE = [/ws:\/\/localhost:8090/, /\/api\/chat\/ticket/, /status of 503/];   /* the team-chat server is not part of this test */

/** Every address inside the program, read from the program itself. */
async function targets(page) {
  return page.evaluate(() => {
    const C = window.CUL, t = [['home'], ['learn'], ['pipeline']];
    (C.PH || []).forEach((ph) => {
      if (String(ph.id) !== '5') t.push(['phase', String(ph.id)]);
      (ph.steps || []).forEach((s) => t.push(['step', String(s.id)]));
      (ph.outcomes || []).forEach((o) => t.push(['outcome', String(o.id)]));
    });
    ['phase5', 'insights', 'mgmt-hub', 'reports', 'targetCulture', 'register', 'teamView', 'peopleSignals', 'runSystem',
      'nextCycle', 'driftReview', 'readingData', 'reviewMap', 'reviewPractices', 'practiceCounts', 'cultureReview',
      'pulseRound', 'questionnaire'].forEach((p) => t.push([p]));
    Object.keys(C.P5_PAGES || {}).forEach((p) => { if (!t.some((x) => x[0] === p)) t.push([p]); });
    return t;
  });
}

/** Collects what goes wrong on a page; `take()` empties it. */
function watch(page) {
  let bad = [];
  const noise = (s) => NOISE.some((r) => r.test(s));
  page.on('pageerror', (e) => bad.push('script error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text() + ' ' + (m.location().url || ''))) bad.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !noise(r.url())) bad.push('HTTP ' + r.status() + ' ' + r.request().method() + ' ' + new URL(r.url()).pathname); });
  page.on('dialog', (d) => d.accept().catch(() => { }));
  return { take: () => { const b = bad; bad = []; return b; } };
}

async function open(page, t) {
  await page.evaluate((a) => { try { window.closeModal && window.closeModal(); } catch (e) { } window.go(a[0], a[1]); window.scrollTo(0, 0); }, t);
  await page.waitForTimeout(150);
}

/** What a rendered page shows that it should not. */
async function inspect(page) {
  return page.evaluate(() => {
    const out = [], app = document.getElementById('app');
    if (!app || !app.innerText.trim()) out.push('the page is empty');
    const text = (app && app.innerText) || '';
    const m = text.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]).{0,40}/);
    if (m) out.push('shows "' + m[1] + '": …' + m[0].replace(/\s+/g, ' ') + '…');
    document.querySelectorAll('#app img').forEach((i) => { if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) out.push('broken image ' + i.getAttribute('src')); });
    return out;
  });
}

async function walk(page, w, label) {
  const problems = [];
  for (const t of await targets(page)) {
    await open(page, t);
    const p = (await inspect(page)).concat(w.take());
    if (p.length) problems.push(label + ' ' + t.join(' ') + ': ' + p.join(' | '));
  }
  return problems;
}

test.describe.configure({ timeout: 15 * 60_000 });

test('every page opens cleanly on a new organization, and every field on every step saves', async ({ page, account, otherDevice }) => {
  const w = watch(page);
  await signIn(page, CULTURE, account);
  w.take();
  const problems = await walk(page, w, '[empty]');

  /* Type into every text field on every step. */
  const typed = {};
  const steps = (await targets(page)).filter((t) => t[0] === 'step');
  for (const t of steps) {
    await open(page, t);
    const fields = await page.$$eval('#app textarea, #app input[type="text"]', (els) => els
      .filter((e) => e.id && (e.offsetWidth || e.offsetHeight) && !e.disabled && !e.readOnly)
      .map((e) => ({ id: e.id, num: /^(numeric|decimal)$/.test(e.getAttribute('inputmode') || '') })));
    for (const { id, num } of fields) {
      /* A number field (a culture-map target, 1 to 5; the owner's share, 1 to 100%) refuses text by design,
         so it gets a number every one of them accepts. */
      const v = num ? '4' : 'walk ' + t[1] + ' ' + id;
      const f = page.locator('[id="' + id + '"]');
      if (!(await f.count())) continue;      /* a re-render after the last save may have replaced it */
      try { await f.fill(v, { timeout: 3000 }); await f.blur(); typed[id] = { step: t[1], v, num }; }
      catch (e) { problems.push('[typing] ' + t[1] + ' #' + id + ': ' + String(e.message).split('\n')[0]); }
    }
    const p = w.take();
    if (p.length) problems.push('[typing] step ' + t[1] + ': ' + p.join(' | '));
  }
  await page.waitForTimeout(6000);   /* the last patch */
  const doc = JSON.stringify((await serverWorkspace(page, 'ai-culture')).doc || {});
  const notSaved = Object.keys(typed).filter((id) => !typed[id].num && !doc.includes(typed[id].v));
  for (const id of notSaved) problems.push('[saving] step ' + typed[id].step + ' #' + id + ' never reached the server');

  /* Every value is back on another device, whose storage is empty: it can only have come from the server. */
  await signIn(otherDevice, CULTURE, account);
  for (const t of steps) {
    const mine = Object.keys(typed).filter((id) => typed[id].step === t[1] && !notSaved.includes(id));
    if (!mine.length) continue;
    await open(otherDevice, t);
    for (const id of mine) {
      const got = await otherDevice.locator('[id="' + id + '"]').inputValue().catch(() => '(field gone)');
      if (typed[id].num ? Number(got) !== Number(typed[id].v) : got !== typed[id].v) problems.push('[other device] step ' + t[1] + ' #' + id + ' came back as ' + JSON.stringify(got));
    }
  }
  console.log('fields typed: ' + Object.keys(typed).length + ' across ' + steps.length + ' steps');
  expect(problems, problems.join('\n')).toEqual([]);
});

test('the Demo tab: every page opens and every button on it works', async ({ page, account }) => {
  await signIn(page, CULTURE, account);
  const [demo] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => window.openSampleTab())]);
  const w = watch(demo);
  await expect(demo.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  expect(await demo.evaluate(() => !!window.SAMPLE_MODE)).toBe(true);
  w.take();
  demo.on('popup', (p) => p.close().catch(() => { }));
  const problems = await walk(demo, w, '[demo]');

  let clicked = 0;
  for (const t of await targets(demo)) {
    await open(demo, t);
    const n = await demo.$$eval('#app button, #app [onclick]', (els) => els.filter((e) => e.offsetWidth || e.offsetHeight).length);
    for (let i = 0; i < n; i++) {
      await open(demo, t);
      const what = await demo.evaluate((i) => {
        const el = [...document.querySelectorAll('#app button, #app [onclick]')].filter((e) => e.offsetWidth || e.offsetHeight)[i];
        if (!el) return null;
        const d = (el.getAttribute('onclick') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70);
        el.click();
        return d;
      }, i);
      if (what == null) continue;
      clicked++;
      await demo.waitForTimeout(60);
      if (!/\/enterprises\/(dev\/)?culture/.test(demo.url())) {   /* the button left the program: come back */
        await demo.goBack().catch(() => { });
        await expect(demo.locator('#app')).not.toBeEmpty();
      }
      const p = w.take();
      if (p.length) problems.push('[click] ' + t.join(' ') + ' → ' + what + ': ' + p.join(' | '));
    }
  }
  console.log('demo buttons clicked: ' + clicked);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('no page scrolls sideways at phone width', async ({ page, account }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, CULTURE, account);
  const [demo] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => window.openSampleTab())]);
  await demo.setViewportSize({ width: 390, height: 844 });
  await expect(demo.locator('#app')).not.toBeEmpty({ timeout: 20_000 });
  const wide = [];
  for (const t of await targets(demo)) {
    await open(demo, t);
    const r = await demo.evaluate(() => {
      const W = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= W + 1) return null;
      const el = [...document.querySelectorAll('#app *')].filter((e) => e.getBoundingClientRect().right > W + 1 && getComputedStyle(e).position !== 'fixed')
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      return document.documentElement.scrollWidth + 'px; widest: ' + (el ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] : '?');
    });
    if (r) wide.push(t.join(' ') + ' is ' + r);
  }
  expect(wide, wide.join('\n')).toEqual([]);
});

/* Every button that adds a record, and every band on the culture map, DOES something (11 Nov 2026). The click-through
   above only fails on a script error, and these failed silently: culRecAdd, culDbAddType and culMapBandClick called
   their function off `window`, where none of the program's functions lives, so "+ Add value", "+ Add commitment" and
   every other "+ Add" on a step, the Dashboard's Add menu and the map's bands did nothing at all (fixed in
   tools/port-ai-culture.js). An add must create a record; a band must change the page. */
test('every Add button creates a record and every map band opens', async ({ page, account }) => {
  await signIn(page, CULTURE, account);
  const [demo] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => window.openSampleTab())]);
  const w = watch(demo);
  await expect(demo.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  w.take();
  const SEL = '#app [onclick*="culRecAdd"], #app [onclick*="culDbAddType"], #app [onclick*="culMapBandClick"]';
  const dead = [], seen = {};
  for (const t of await targets(demo)) {
    /* The map's "What would you like to add?" menu (culDbAddCtl: step 2.1, the review map) is held open throughout. */
    const prep = async () => { await open(demo, t); await demo.evaluate(() => { window.UI.dbAdd = true; window.render(); }); };
    await prep();
    const n = await demo.$$eval(SEL, (els) => els.filter((e) => e.offsetWidth || e.offsetHeight).length);
    for (let i = 0; i < n; i++) {
      await prep();
      const r = await demo.evaluate(([sel, i]) => {
        const el = [...document.querySelectorAll(sel)].filter((e) => e.offsetWidth || e.offsetHeight)[i];
        if (!el) return null;
        const on = el.getAttribute('onclick'), band = on.includes('culMapBandClick');
        const snap = () => band ? document.body.innerHTML : JSON.stringify(window.data);
        const before = snap();
        el.click();
        return { on: on.replace(/\s+/g, ' ').slice(0, 90), label: (el.textContent || '').trim().slice(0, 40), changed: snap() !== before };
      }, [SEL, i]);
      if (!r) continue;
      seen[r.on] = true;
      if (!r.changed) dead.push(t.join(' ') + ': "' + r.label + '" (' + r.on + ') did nothing');
      const p = w.take();
      if (p.length) dead.push(t.join(' ') + ': "' + r.label + '": ' + p.join(' | '));
    }
  }
  const tried = Object.keys(seen).join('\n');
  console.log('add buttons and bands tried:\n' + tried);
  for (const must of ['culValueAdd', 'culCommitAdd', 'culDbAddType', 'culMapBandClick']) expect(tried, must + ' was never reached').toContain(must);
  expect(dead, dead.join('\n')).toEqual([]);
});
