// @ts-check
/* Paul's user-testing directives of 4 November 2026, checked in a real browser (16 Nov 2026).

   Culture (reference/Culture_Directive_UserTesting_2026-11-04):
     A. the More menu, the theme and Minimize do not redraw the page already showing: its <video> stays the same
        element and its fade-ins do not replay; arriving at another page still plays them. Ported to the shell
        (js/app.js render, js/features/org-admin.js), so it holds for every module;
     B. no number fields, so no up/down buttons; letters in a number field are still refused;
     C. the questionnaire grid boxes are 88px with room for "1.0 to 5.0";
     D. on 5.4 each Analytical Signal's link sits under its text, and Team Heatmap / Story Coverage names line up.
   Governance (reference/Governance_Directive_Step2-2_2026-11-04): step 2.2's step button shows on every tab once
   all four tabs are complete, completes the step from any of them, and shows on none while one is incomplete.

   Everything runs in the Demo tab, whose seeded sample never leaves the browser. */
const { test, expect, signIn } = require('./fixtures');

const CULTURE = process.env.PW_CULTURE_PATH || 'enterprises/culture';
const GOVERNANCE = process.env.PW_GOVERNANCE_PATH || 'enterprises/responsible-ai-governance';

test.describe.configure({ timeout: 5 * 60_000 });

async function openDemo(page, program, account) {
  await signIn(page, program, account);
  const [demo] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => window.openSampleTab())]);
  await expect(demo.locator('.nav-tab[data-tab="home"]')).toBeVisible({ timeout: 20_000 });
  expect(await demo.evaluate(() => !!window.SAMPLE_MODE)).toBe(true);
  demo.on('dialog', (d) => d.accept().catch(() => { }));
  return demo;
}

async function go(page, where, which) {
  await page.evaluate((a) => { try { window.closeModal && window.closeModal(); } catch (e) { } window.go(a[0], a[1]); window.scrollTo(0, 0); }, [where, which]);
  /* Home and Learn mount asynchronously through the screen loader, after their template arrives from the server
     (2.8s on a slow local server, 16 Nov 2026). Wait until the screen is really the one on show and every fade-in has
     finished, so a check never mistakes the arrival animation for a replay. */
  await page.waitForFunction((w) => {
    const app = document.getElementById('app');
    if (w === 'home' || w === 'learn') {
      const s = app.__screen;
      if (!s || s.el !== app.firstElementChild || !(s.key === w || s.key.endsWith(':' + w))) return false;
    }
    return [...app.querySelectorAll('.reveal')].every((r) => r.classList.contains('visible'));
  }, where, { timeout: 20_000 });
  await page.waitForTimeout(300);
}

/** Marks the page's first element and first video, runs `act` in the page, and reports what survived. */
async function survives(page, act) {
  return page.evaluate((act) => {
    const app = document.getElementById('app');
    const first = app.firstElementChild, vid = app.querySelector('video');
    if (first) first.__mark = 1; if (vid) vid.__mark = 1;
    const revealsBefore = app.querySelectorAll('.reveal').length;
    ({
      more: () => { window.toggleNavMore(); window.closeNavMore(); },
      theme: () => window.toggleTheme(),
      minimize: () => window.toggleSidebarSize(),
    })[act]();
    const reveals = [...app.querySelectorAll('.reveal')];
    const vNow = app.querySelector('video');
    return {
      pageKept: !!(app.firstElementChild && app.firstElementChild.__mark === 1),
      hadVideo: !!vid,
      videoKept: !vid || !!(vNow && vNow.__mark === 1 && vNow.isConnected),
      revealsBefore,
      /* checked in the same task as the repaint: a replay would leave them hidden for the stagger */
      revealsAllVisible: reveals.every((r) => r.classList.contains('visible')),
    };
  }, act);
}

test('Culture A: the More menu, the theme and Minimize leave the page in place', async ({ page, account }) => {
  const demo = await openDemo(page, CULTURE, account);
  const surfaces = [['home'], ['learn'], ['pipeline'], ['phase', '1'], ['phase', '2'], ['phase', '3'], ['phase', '4'], ['phase5'], ['step', '1.1']];
  const problems = [];
  let videos = 0;
  for (const s of surfaces) {
    for (const act of ['more', 'theme', 'minimize']) {
      if (act === 'minimize' && (s[0] === 'home' || s[0] === 'learn')) continue;   /* the directive's checklist: Minimize on the program pages */
      await go(demo, s[0], s[1]);
      const r = await survives(demo, act);
      if (r.hadVideo) videos++;
      if (act === 'more' && !r.pageKept) problems.push(s.join(' ') + ' ' + act + ': the page was redrawn');
      if (!r.videoKept) problems.push(s.join(' ') + ' ' + act + ': the video was rebuilt');
      if (!r.revealsAllVisible) problems.push(s.join(' ') + ' ' + act + ': the fade-ins replayed');
      if (act === 'theme') await demo.evaluate(() => window.toggleTheme());
      if (act === 'minimize') await demo.evaluate(() => window.toggleSidebarSize());
    }
  }
  expect(problems).toEqual([]);
  expect(videos, 'some surfaces carry a video, so the video check is not vacuous').toBeGreaterThan(5);

  /* a real click on the More button, too */
  await go(demo, 'phase', '1');
  await demo.evaluate(() => { document.querySelector('#app video').__mark = 1; });
  await demo.locator('[data-act="more"]').click();
  await expect(demo.locator('[data-slot="more-menu"]')).not.toBeEmpty();
  await demo.mouse.click(5, 400);
  await expect(demo.locator('[data-slot="more-menu"]')).toBeEmpty();
  expect(await demo.evaluate(() => document.querySelector('#app video').__mark)).toBe(1);

  /* arriving at a page still plays its fade-ins: the first program page that has any (the overview has none) */
  let arrival = null;
  for (const to of [['phase', '1'], ['phase', '2'], ['phase5'], ['step', '1.1']]) {
    await go(demo, 'step', '2.1');
    const r = await demo.evaluate((a) => { window.go(a[0], a[1]); const r = [...document.querySelectorAll('#app .reveal')]; return { to: a.join(' '), n: r.length, hidden: r.filter((e) => !e.classList.contains('visible')).length }; }, to);
    if (r.n) { arrival = r; break; }
  }
  expect(arrival, 'some program page has fade-ins').not.toBeNull();
  expect(arrival.hidden, 'on arrival at ' + arrival.to + ' the fade-ins start hidden and play').toBe(arrival.n);
  await demo.waitForTimeout(1500);
  expect(await demo.evaluate(() => [...document.querySelectorAll('#app .reveal')].every((e) => e.classList.contains('visible')))).toBe(true);
});

test('Culture B and C: no number fields, letters refused, score boxes fit their text', async ({ page, account }) => {
  const demo = await openDemo(page, CULTURE, account);
  const pages = await demo.evaluate(() => {
    const t = [];
    (window.CUL.PH || []).forEach((ph) => (ph.steps || []).forEach((s) => t.push(['step', String(s.id)])));
    t.push(['pulseRound'], ['practiceCounts'], ['questionnaire']);
    return t;
  });
  let numberFields = 0, withInputmode = 0;
  for (const p of pages) {
    await demo.evaluate((a) => { try { window.closeModal && window.closeModal(); } catch (e) { } window.go(a[0], a[1]); }, p);
    /* every tab of the step, where it has tabs */
    const tabs = await demo.$$eval('#app [onclick*="Tab="], #app [onclick*="UI.sec="]', (els) => els.map((e) => e.getAttribute('onclick')));
    for (const oc of [null, ...tabs]) {
      if (oc) await demo.evaluate((oc) => { try { new Function(oc).call(document.body); } catch (e) { } }, oc);
      const c = await demo.evaluate(() => ({ n: document.querySelectorAll('#app input[type="number"]').length, im: document.querySelectorAll('#app input[inputmode]').length }));
      numberFields += c.n; withInputmode += c.im;
    }
  }
  expect(numberFields, 'no input[type=number] on any step tab or page').toBe(0);
  expect(withInputmode).toBeGreaterThan(50);

  /* the spinner rules are gone from the stylesheets */
  const spin = await demo.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /spin-button/.test(r.cssText)); } catch (e) { return false; } }));
  expect(spin).toBe(false);

  /* B: letters in a team's headcount are refused, with the message, and the field returns to its saved value */
  /* the Teams list is in one of 1.2's sections; open the first tab that has it */
  const found = await demo.evaluate(() => {
    for (const sid of ['1.2', '1.3']) {
      window.go('step', sid);
      const tabs = [...document.querySelectorAll('#app [onclick*="Tab="]')].map((e) => e.getAttribute('onclick'));
      for (const oc of [null, ...tabs]) {
        if (oc) { window.go('step', sid); try { new Function(oc).call(document.body); } catch (e) { } }
        if (document.querySelector('#app input[id^="tm_headcount_"]')) return sid + ' ' + (oc || 'first tab');
      }
    }
    return null;
  });
  expect(found, 'a step tab shows the Teams list').not.toBeNull();
  const hc = demo.locator('#app input[id^="tm_headcount_"]').first();
  await expect(hc).toBeVisible();
  const before = await hc.inputValue();
  await hc.fill('abc');
  await hc.press('Tab');
  await expect(demo.getByText('Enter the headcount as a whole number, 1 or more.').first()).toBeVisible();
  await expect(demo.locator('#app input[id^="tm_headcount_"]').first()).toHaveValue(before);

  /* C: the grid boxes, wherever the sample shows them: 1.2's grids, 3.3's round grid, the Pulse Round page */
  const where = await demo.evaluate(() => {
    const seen = [];
    for (const t of [['step', '1.2'], ['step', '3.3'], ['pulseRound']]) {
      window.go(t[0], t[1]);
      const tabs = [...document.querySelectorAll('#app [onclick*="Tab="]')].map((e) => e.getAttribute('onclick'));
      for (const oc of [null, ...tabs]) {
        if (oc) { window.go(t[0], t[1]); try { new Function(oc).call(document.body); } catch (e) { } }
        const n = [...document.querySelectorAll('#app input.score-mini')].filter((e) => e.offsetWidth).length;
        if (n) seen.push({ at: t.join(' ') + ' ' + (oc || ''), n, oc });
      }
    }
    return seen;
  });
  expect(where.length, 'the sample shows a questionnaire grid somewhere').toBeGreaterThan(0);
  const pick = where[0];
  await demo.evaluate((p) => { const t = p.at.split(' '); window.go(t[0], t[0] === 'step' ? t[1] : undefined); if (p.oc) new Function(p.oc).call(document.body); }, pick);
  const boxes = await demo.$$eval('#app input.score-mini', (els) => {
    const ctx = document.createElement('canvas').getContext('2d');
    return els.filter((e) => e.offsetWidth).map((e) => {
      const cs = getComputedStyle(e); ctx.font = cs.font;
      const room = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { w: e.offsetWidth, room, ph: e.placeholder, phW: e.placeholder ? ctx.measureText(e.placeholder).width : 0 };
    });
  });
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.w).toBe(88);
    expect(b.room).toBeGreaterThanOrEqual(74);
    expect(b.phW).toBeLessThanOrEqual(b.room);
    expect(b.ph).not.toBe('Number of people');   /* the respondents boxes have no placeholder */
  }
  expect(boxes.some((b) => b.ph === '1.0 to 5.0')).toBe(true);
});

test('Culture D: 5.4 signals put the link under the text, and dimension names line up', async ({ page, account }) => {
  const demo = await openDemo(page, CULTURE, account);
  await demo.evaluate(() => window.go('5.4'));
  await expect(demo.locator('#app .cul-ansig-i').first()).toBeVisible();
  const sig = await demo.$$eval('#app .cul-ansig-i', (cards) => cards.map((c) => {
    const text = c.children[1], a = c.querySelector('a');
    return { textLeft: Math.round(text.getBoundingClientRect().left - c.getBoundingClientRect().left), linkBelow: !a || (a.getBoundingClientRect().top >= text.firstChild.parentNode.getBoundingClientRect().top && getComputedStyle(a).display === 'block') };
  }));
  expect(sig.length).toBeGreaterThan(0);
  expect(sig.every((s) => s.linkBelow)).toBe(true);
  expect(new Set(sig.map((s) => s.textLeft)).size, 'every card text starts at one position').toBe(1);

  /* Team Heatmap and Story Coverage: the name's text starts at one x in every row of each table */
  const tables = await demo.evaluate(() => {
    const out = [];
    document.querySelectorAll('#app table').forEach((t) => {
      const xs = [];
      t.querySelectorAll('tbody th').forEach((th) => {
        const tn = [...th.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (!tn) return; const r = document.createRange(); r.selectNodeContents(tn); xs.push(Math.round(r.getBoundingClientRect().left));
      });
      const dots = t.querySelectorAll('tbody th > span').length;
      if (xs.length > 1 && dots) out.push({ rows: xs.length, starts: [...new Set(xs)] });
    });
    return out;
  });
  expect(tables.length, 'both heatmap-style tables are on the page').toBeGreaterThanOrEqual(1);
  for (const t of tables) expect(t.starts.length, 'all names start at one position').toBe(1);
});

test('Governance 2.2: the step button shows on every tab and completes the step from any of them', async ({ page, account }) => {
  const demo = await openDemo(page, GOVERNANCE, account);
  const TABS = ['own', 'is', 'cul', 'sk'];
  const LABEL = 'Mark Step 2.2 Complete & Continue';
  const shown = async () => {
    const r = {};
    for (const t of TABS) r[t] = await demo.evaluate((a) => { window.UI.s22Tab = a.t; window.go('step', '2.2'); return document.getElementById('app').innerText.indexOf(a.L) >= 0; }, { t, L: LABEL });
    return r;
  };
  /* the sample has 2.2 recorded complete already, which draws the button in its done state; start from not yet complete */
  await demo.evaluate(() => {
    const c = window.data.completed = window.data.completed || {}; ['2.2a', '2.2b', '2.2c', '2.2d'].forEach((k) => { c[k] = c[k] || true; });
    delete (window.data.completedSteps || {})['2.2']; delete (window.data.stepDoneAt || {})['2.2'];
  });
  expect(await shown()).toEqual({ own: true, is: true, cul: true, sk: true });

  /* one tab incomplete: no button on any tab */
  const held = await demo.evaluate(() => { const v = window.data.completed['2.2c']; delete window.data.completed['2.2c']; return v; });
  expect(await shown()).toEqual({ own: false, is: false, cul: false, sk: false });
  await demo.evaluate((v) => { window.data.completed['2.2c'] = v; }, held);

  /* pressing it from each tab records 2.2 complete and moves on to 2.3 */
  for (const t of TABS) {
    await demo.evaluate((t) => { delete (window.data.completedSteps || {})['2.2']; delete (window.data.stepDoneAt || {})['2.2']; window.UI.s22Tab = t; window.go('step', '2.2'); }, t);
    await demo.locator('#app button', { hasText: LABEL }).click();
    await expect.poll(() => demo.evaluate(() => window.currentStep)).toBe('2.3');
    expect(await demo.evaluate(() => !!(window.data.completedSteps || {})['2.2'])).toBe(true);
  }
});

/* Paul (Nov 2026, deployment list): no "124 / 10,000" counter under the text fields, in any app. The 10,000 cap stays,
   and so does the one line that says text was cut when a field hits it. */
for (const [name, program] of [['Culture', CULTURE], ['Governance', GOVERNANCE]]) {
  test(name + ': no character counter under the fields, and the 10,000 cap still holds', async ({ page, account }) => {
    await signIn(page, program, account);
    await page.evaluate(() => window.go('step', '1.1'));
    const box = page.locator('#app textarea:not([readonly]):not([disabled])').first();
    await expect(box).toBeVisible();
    await box.click();
    await box.pressSequentially('Short answer');
    await page.waitForTimeout(300);
    expect(await page.locator('#app .nc-cc').count(), 'no counter under any field').toBe(0);
    /* a paste past the cap: cut to 10,000, and the line explains it */
    await box.evaluate((el) => { el.value = 'x'.repeat(10050); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect.poll(() => box.evaluate((el) => el.value.length)).toBe(10000);
    await expect(page.locator('#app .nc-cc').first()).toContainText('Limit reached');
    /* back under the cap: the line goes */
    await box.evaluate((el) => { el.value = 'back under'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('#app .nc-cc')).toHaveCount(0);
  });
}
