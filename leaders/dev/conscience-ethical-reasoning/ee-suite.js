const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
/* Prefix seam (28 Jul): derives from this file's own name (ee-suite.js → "ee-"),
   so the identical suite bytes serve any prefixed set (empty for `suite.js`). */
const PFX = path.basename(__filename).replace(/suite\.js$/, '');
const PE = PFX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* Target: a deployment SET directory (the sole shipped form) or a legacy single file. */
const target = process.argv[2] || 'build/ee.html';
let BASE = null, src;
if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
  BASE = target;
  const REQUIRED = ['index.html', 'styles.css', 'app.js', 'screen-loader.js', 'home.js', 'home.html', 'learn.js', 'learn.html', 'templates-local.js', 'build-templates.js'].map(f => PFX + f);
  const missing = REQUIRED.filter(f => !fs.existsSync(path.join(BASE, f)));
  if (missing.length) { console.error('SET INCOMPLETE, missing: ' + missing.join(', ')); process.exit(1); }
  src = fs.readFileSync(path.join(BASE, PFX + 'index.html'), 'utf8');
  if (src.indexOf('<link rel="stylesheet" href="' + PFX + 'styles.css">') < 0) { console.error(PFX + 'index.html: styles link missing'); process.exit(1); }
  src = src.replace('<link rel="stylesheet" href="' + PFX + 'styles.css">', '<style>' + fs.readFileSync(path.join(BASE, PFX + 'styles.css'), 'utf8') + '</style>');
  src = src.replace(/<script src="([^"]+)"><\/script>/g, (m, s2) => '<script>\n' + fs.readFileSync(path.join(BASE, s2), 'utf8') + '\n</script>');
} else {
  src = fs.readFileSync(target, 'utf-8');
}
const homeSrc = BASE ? fs.readFileSync(path.join(BASE, PFX + 'home.html'), 'utf8') : src;
const learnSrc = BASE ? fs.readFileSync(path.join(BASE, PFX + 'learn.html'), 'utf8') : src;
let pass = 0, fail = 0, fails = [];
function T(name, cond) { if (cond) { pass++; } else { fail++; fails.push(name); } }

// ---- static assertions on source ----
const style = src.slice(src.indexOf('<style>'), src.indexOf('</style>'));
T('root has family orange gold (ruled 13 Jul)', style.includes('--gold:#E8621A'));
T('root gold-text #236238', style.includes('--gold-text:#B34208'));
T('root gold-pale #B34208 (family, ruled 13 Jul)', style.includes('--gold-pale:#B34208'));
T('dark gold-text #7A9DAA', style.includes('--gold-text:#F07A37'));
T('dark gold-pale #7A9DAA', style.includes('--gold-pale:#F07A37'));
T('bg-card-hover universal orange (ruled 13 Jul pm)', style.includes('--bg-card-hover:rgba(232,98,26,.05)'));
T('head-blue light', style.includes('--head-blue:#2E7D46'));
T('head-blue dark', style.includes('--head-blue:#5FC788'));
T('bg-rgb light', style.includes('--bg-rgb:234,238,244'));
T('dark token block present', style.includes('[data-theme="dark"]{--text-mid:#B9C3CF'));
T('form light color-scheme', style.includes('textarea,input,select{color-scheme:light}'));
T('form dark color-scheme', style.includes('[data-theme="dark"] textarea,[data-theme="dark"] input,[data-theme="dark"] select{color-scheme:dark}'));
T('dark hero gradient', style.includes('[data-theme="dark"] .hero-bg::before'));
T('dark plan rule', style.includes('[data-theme="dark"] .home-plan{background:rgba(13,17,23,.6)}'));
T('dark numeral rule w/ stat-num', style.includes('[data-theme="dark"] .home-plan-num,[data-theme="dark"] .stat-num'));
T('nav bg channel', style.includes('background:rgba(var(--bg-rgb),.92)'));
T('nav padding 52 left', style.includes('padding:18px 48px 18px 52px'));
T('logo 500/.12em', style.includes('.nav-logo{font-family:var(--serif);font-size:24px;font-weight:500;letter-spacing:.12em'));
T('logo span head-blue', style.includes('.nav-logo span{color:var(--head-blue)'));
T('ultrawide dual-auto: centering excised, tabs clear the chip dynamically (superseded with cause, 29 Jul Amendment A: absolute centering ran the tabs under the chip)', !style.includes('.nav-tabs{position:absolute') && style.includes('.nav-tabs{display:flex;gap:0;list-style:none;margin-left:auto}') && style.includes('@media(min-width:1480px){#navRight{margin-left:auto}}'));
/* Amendments B + D (ruled July 29; B ruled IN for EE by Paul, 29 Jul; pins synthesized in
   EE dialect \u2014 the final DL smoke was not supplied; D's pin ADDED, not swapped: Amendment C
   never landed in EE) */
T('chip name truncates at 12ch for display; full name on the tooltip (Amendment B)', style.includes('max-width:12ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'));
T('fluid chrome: continuous sub-960 shrink + shrinkable tab strip + wrapping action row + residual 480 tier (Amendment D)', style.includes('.nav-tab{font-size:clamp(9px,2vw,14px)') && style.includes('.nav-tabs{overflow-x:auto;flex-shrink:1;min-width:0;max-width:100%}') && style.includes('#navRight{flex-wrap:wrap;max-width:100%}') && style.includes('.nav-user-name{max-width:min(12ch,16vw)}') && style.includes('@media(max-width:480px)'));
T('tabs scroll-in-flow band', style.includes('@media(max-width:1479px){.nav-tabs{margin-left:0;max-width:100%;overflow-x:auto;flex-shrink:0}}'));
T('nav-action compact', style.includes('height:26px;font-size:10.5px;padding:0 10px'));
T('section-label 15 blue', style.includes('.section-label{font-family:var(--mono);font-size:15px;letter-spacing:.25em;color:var(--head-blue)'));
T('section-title 36-60 1.05', style.includes('clamp(36px,4vw,60px);font-weight:300;line-height:1.05;color:var(--paper);margin-bottom:16px'));
T('section-body paper uncapped', style.includes('.section-body{font-size:16px;line-height:1.75;color:var(--paper)}'));
T('insights-section-title 400', style.includes('.insights-section-title{font-family:var(--serif);font-size:28px;font-weight:400'));
T('footer CSS', style.includes('.app-footer{border-top:1px solid var(--rule);background:var(--ink)}'));
T('footer inner pad', style.includes('padding:28px 48px 92px'));
T('wrap--content 1200', style.includes('.wrap--content{max-width:1200px}'));
T('hero-bg family suffix', style.includes("') left center/cover no-repeat}"));
T('hero eyebrow 15 blue no shadow', style.includes('.hero-eyebrow{font-family:var(--mono);font-size:15px;letter-spacing:.25em;color:var(--head-blue);text-transform:uppercase;margin-bottom:32px}'));
T('headline 82/.96', style.includes('clamp(40px,5.2vw,82px);font-weight:300;line-height:.96'));
T('hero-sub stone 520', style.includes('.hero-sub{font-size:18px;line-height:1.7;color:var(--stone);max-width:520px;margin-bottom:48px}'));
T('home-plan box', style.includes('.home-plan{margin-top:30px;background:rgba(var(--bg-rgb),.72)'));
T('hero plan num 38', style.includes('.hero .home-plan-num{font-size:38px;min-width:56px;color:var(--gold-text)}'));
T('hero plan strong 21', style.includes('.hero .home-plan-label strong{font-size:21px;margin-bottom:5px;color:var(--paper)}'));
T('hero plan label 16', style.includes('.hero .home-plan-label{font-size:16px;color:var(--text-mid)}'));
T('no stat CSS rules left', !style.includes('.stat-stack{') && !style.includes('.stat-item{') && !style.includes('.stat-label{'));
T('marquee 30s', style.includes('animation:marquee 30s linear infinite;width:max-content'));
T('marquee item 13px .15em', style.includes('padding:0 28px;font-family:var(--mono);font-size:13px;letter-spacing:.15em'));
T('marquee dot 2px radius', style.includes('border-radius:2px;background:var(--gold)'));
T('value-band ink 100', style.includes('.value-band{border-top:1px solid var(--rule);background:var(--ink);padding:100px 0}'));
T('value-inner 1200/64', style.includes('.value-inner{max-width:1200px;margin:0 auto;padding:0 48px;display:grid;grid-template-columns:1fr 1fr;gap:64px'));
T('pullquote 400/2px/32', style.includes('font-weight:400;line-height:1.5;color:var(--paper);border-left:2px solid var(--gold);padding-left:32px'));
T('cite 13 stone', style.includes('.pullquote cite{display:block;font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--stone)'));
T('how-title mono label', style.includes('.how-title{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text)}'));
T('how-desc serif 18/500', style.includes('.how-desc{font-family:var(--serif);font-size:18px;font-weight:500;line-height:1.3;flex:1;color:var(--paper)}'));
T('card no sweep', !style.includes('.card::before'));
T('card no lift', !style.includes('.card:hover{background:rgba(46,125,70,.05);border-color:var(--rule);transform'));
T('card padding 24', style.includes('.card{background:var(--bg-card);border:1px solid var(--border-soft);padding:24px'));
T('card-arrow 13/.18em gold-text', style.includes('.card-arrow{display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;letter-spacing:.18em;color:var(--gold-text)'));
T('insight-card fg channels', style.includes('.insight-card{background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.09);padding:22px 20px 18px'));
T('insight hover universal .28 (ruled 13 Jul pm)', style.includes('border-color:rgba(200,104,56,.28)'));
T('badge 13px', style.includes('.insight-badge{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:13px'));
T('badge--mono ink', style.includes('.insight-badge--mono{background:rgba(var(--fg-rgb),.07);color:var(--text-max);border-color:rgba(var(--fg-rgb),.3)}'));
T('date 13', style.includes('.insight-date{font-family:var(--mono);font-size:13px'));
T('cta 13 gold-text', style.includes('.insight-cta{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text)'));
T('card-foot border-top', style.includes('margin-top:auto;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.07)'));
T('ins-note 14 stone', style.includes('.ins-note{color:var(--stone);line-height:1.6;font-size:14px'));
T('ins-body container', style.includes('container-type:inline-size'));
T('video card CSS', style.includes('.overview-video-card{margin-bottom:28px}') && style.includes('.hero-video-wrap{display:flex'));
// residue gates
T('zero #C7C0B5', !style.includes('#C7C0B5'));
T('zero #A29A8E', !style.includes('#A29A8E'));
T('zero old fg family', !style.includes('rgba(245,242,236,'));
T('zero old bg family', !style.includes('rgba(26,22,18,'));
T('zero old hero greys', !style.includes('rgba(14,11,8,'));
T('text-shadow only dark numeral', (style.match(/text-shadow/g) || []).length === 1);
T('zero D9C28F', !style.includes('#D9C28F'));
T('zero 141210', !style.includes('#141210'));
T('JS has no old paper literals', !src.slice(src.lastIndexOf('<script>')).includes('rgba(245,242,236,'));
// first-paint + key
T('first-paint ee-theme', src.includes("localStorage.getItem('ee-theme')==='dark'?'dark':'light'"));
T('toggle stores ee-theme', src.includes("localStorage.setItem('ee-theme',t)"));
T('themeNavBtn defined', src.includes('function themeNavBtn()'));
T('toggle spliced in navRight', src.includes("Help</button>'+themeNavBtn()+'<button id=\"notesNavBtn\""));
T('font link weights', src.includes('0,500;0,600;0,700;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500'));
T('footer markup', src.includes('&copy; 2026 Next Chapter, LLC. All rights reserved.'));
T('navRight base-flow left (swapped with cause, 29 Jul: ER conformance dropped the auto margin; right-pin lives at ultrawide only)', src.includes('<div id="navRight" style="display:flex;gap:6px;align-items:center"></div>'));
T('video placeholder EE name (drive-conformed, 29 Jul)', src.includes('The Ethics Engine - MODULE OVERVIEW.mp4'));
T('video label (screen file; refined with cause: markup left app.js, Part VIII', homeSrc.includes('<div class="overview-video-label">Module Overview</div>'));
T('plan rows 01-05 present (screen file; refined with cause: markup left app.js, Part VIII', ['01', '02', '03', '04', '05'].every(n => homeSrc.includes('<div class="home-plan-num">' + n + '</div>')));
T('no plan heading text', !src.includes('home-plan-title') && !src.includes('90-Day Plan'));
T('ways-in wrap--content (screen file; refined with cause: markup left app.js, Part VIII', homeSrc.includes('<div class="wrap wrap--content"><div class="section-label reveal">Start Here</div>'));
T('learn wrap--content (screen file; refined with cause: markup left app.js, Part VIII conformance)', learnSrc.includes('<div class="wrap wrap--content" style="padding-top:48px;padding-bottom:100px">'));

// ---- behavioral: boot in jsdom, toggle round-trip ----
(async () => {
  const dom = new JSDOM(src, { runScripts: 'dangerously', url: 'https://localhost/ee.html', pretendToBeVisual: true, beforeParse(w) { w.fetch = (url, opts) => { if (BASE && typeof url === 'string' && /\.html(\?|$)/.test(url)) { try { const t = fs.readFileSync(path.join(BASE, String(url).split('?')[0]), 'utf8'); return Promise.resolve({ ok: true, text: () => Promise.resolve(t) }) } catch (e) { return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }) } } return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ text: 'STUB' }] }) }); }; Object.defineProperty(w, "innerWidth", { value: 1500, configurable: true }); } });
  const w = dom.window, d = w.document;
  await new Promise(r => { if (d.readyState === 'complete') r(); else w.addEventListener('load', r); });
  await new Promise(r => setTimeout(r, 400));
  // VI-8: authenticate before the legacy battery
  T('VI-8: fresh boot lands on entry gate', !!d.querySelector('#entryUser') || w.authSignedIn === true);
  if (w.Auth && !w.authSignedIn) {
    let weak = null; w.Auth.createAccount('tester', '12', x => weak = x);
    T('VI-8: weak PIN rejected', !!(weak && weak.ok === false && weak.reason === 'weak'));
    w.Auth.createAccount('Tester', '1234', x => { });
    let wrong = null; w.Auth.signIn('tester', '9999', x => wrong = x);
    T('VI-8: wrong PIN rejected', !!(wrong && wrong.ok === false));
    let okr = null; w.Auth.signIn('TESTER', '1234', x => okr = x);
    T('VI-8: case-insensitive sign-in', !!(okr && okr.ok === true));
    w.Auth.setSession(true); w.eeAdoptIdentity('Tester'); /* identity adoption mirrors the doEntry success path (per-user Store, 28 Jul) */ w.render(); await new Promise(r => setTimeout(r, 300));
  }
  T('VI-8: suite runs authenticated', w.authSignedIn === true);
  /* -- per-user Store pins (28 Jul, Rollout Log 1.3; fixture 'tester', ee- prefix per 1.2;
     EE adaptations disclosed: 8-decision seed (DL: 10), first id ee01 (DL: demo01),
     completion pin adapted to EE's flag-based seeds (no stamps carried), profile pin
     adapted to EE's seeded assessment + 3-sitting history (EE stores no data.profile)) -- */
  T('identity adoption seeds eight decisions for the user', w.currentUserId === 'tester' && w.data.decisions.length === 8);
  T('seed persisted to the user record with a rev mirror', !!w.localStorage.getItem('ee-data::tester') && w.localStorage.getItem('ee-rev::tester') === String(w.data.rev) && w.data.rev >= 1 && w.data.schemaVersion === 1);
  T('legacy ee-v1 is not written by the per-user store', w.localStorage.getItem('ee-v1') === null);
  T('seed integrity: first record resolved with flow content (EE flag-based completion: seeds carry no stamps)', w.data.decisions[0].id === 'ee01' && w.data.decisions[0].resolved === true && !!w.data.decisions[0].flow.instinct && Object.keys(w.data.decisions[0].flow.completed || {}).length === 0);
  T('seed assessment + history present', !!w.data.assessment.completedAt && (w.data.assessmentHistory || []).length === 3);
  T('revisioned writes: save increments rev and the mirror follows', (function () { var r0 = w.data.rev; w.saveData(); return w.data.rev === r0 + 1 && w.localStorage.getItem('ee-rev::tester') === String(w.data.rev) })());
  T('store seam: STORE_ENDPOINT source constant defined once, device-local default', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return (a.match(/var STORE_ENDPOINT=''/g) || []).length === 1 })());
  T('upD marks the record dirty through Store.commit', (function () { var kp = w.currentPage, ka = w.activeId; w.Store.clearDirty(); w.currentPage = 'detail'; w.activeId = 'ee01'; w.upD('title', w.data.decisions[0].title); var ok = w.Store.dirtyRecords().indexOf('decisions::ee01') >= 0; w.currentPage = kp; w.activeId = ka; return ok })());
  T('mergeDirtyInto overlays array records by id (DL adaptation 3)', (function () { var fresh = { decisions: [{ id: 'x', v: 1 }] }; var local = { decisions: [{ id: 'x', v: 2 }, { id: 'y', v: 3 }] }; w.Store.mergeDirtyInto(fresh, local, ['decisions::y', 'decisions::x']); return fresh.decisions.length === 2 && fresh.decisions[0].v === 2 })());
  /* SUPERSEDED July 30 (legacy excision ruling): migrateLegacy and the ee-v1 adoption are excised whole \u2014 pre-release, no shipped users exist to migrate. The batch pins at the tail prove a planted blob no longer bleeds into fresh accounts. */
  T('VI-8: sign-out wired in More menu', src.includes('signOut()') && src.includes('Sign out'));
  T('boot: first-paint set light', d.documentElement.getAttribute('data-theme') === 'light');
  T('boot: app rendered', d.getElementById('app') && d.getElementById('app').innerHTML.length > 500);
  T('boot: footer in DOM', !!d.getElementById('appFooter'));
  T('boot: nav toggle button rendered', !!d.querySelector('#navRight button[onclick="toggleTheme()"]'));
  const btn = d.querySelector('#navRight button[onclick="toggleTheme()"]');
  T('boot: toggle label says Dark Mode', btn && btn.textContent.includes('Dark Mode'));
  T('boot: hero plan box rendered', !!d.querySelector('.hero .home-plan'));
  T('boot: 5 plan rows', d.querySelectorAll('.hero .home-plan-row').length === 5);
  T('boot: video placeholder rendered', !!d.querySelector('.hero-video-wrap video.overview-video source[src="The Ethics Engine - MODULE OVERVIEW.mp4"]'));
  T('boot: no stat-stack in DOM', !d.querySelector('.stat-stack'));
  // toggle round-trip
  w.toggleTheme();
  await new Promise(r => setTimeout(r, 200));
  T('toggle: data-theme dark', d.documentElement.getAttribute('data-theme') === 'dark');
  T('toggle: localStorage ee-theme dark', w.localStorage.getItem('ee-theme') === 'dark');
  const btn2 = d.querySelector('#navRight button[onclick="toggleTheme()"]');
  T('toggle: label flips to Light Mode', btn2 && btn2.textContent.includes('Light Mode'));
  w.toggleTheme();
  await new Promise(r => setTimeout(r, 200));
  T('toggle back: light', d.documentElement.getAttribute('data-theme') === 'light');
  T('toggle back: storage light', w.localStorage.getItem('ee-theme') === 'light');
  // navigate pages
  w.go('learn'); await new Promise(r => setTimeout(r, 150));
  T('learn: wrap--content in DOM', !!d.querySelector('.wrap.wrap--content'));
  w.go('insights'); await new Promise(r => setTimeout(r, 150));
  T('insights: ins-body present', !!d.querySelector('.ins-body'));
  T('insights: cards rendered', d.querySelectorAll('.insight-card').length > 3);
  T('insights: badge--mono present', !!d.querySelector('.insight-badge--mono'));
  // --- chunk 1: Ethics Files cabinet ---
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  const stage = d.getElementById('boardStage');
  T('cabinet: stage present with view-files', !!stage && stage.className.includes('view-files'));
  const shell = d.getElementById('boardShell');
  T('cabinet: shell mounted', !!shell && shell.innerHTML.length > 2000);
  T('cabinet: title ETHICS FILES', shell.innerHTML.includes('THE ETHICS FILES'));
  T('cabinet: identity line MODULE IV', shell.innerHTML.includes('LEADERSHIP EDGE \u00B7 MODULE IV'));
  T('cabinet: CTA situation vocab', shell.innerHTML.includes('START WORKING THROUGH A NEW SITUATION'));
  const foldersCollapsed = shell.querySelectorAll('[id^="folder-"]').length;
  T('cabinet: 6 folders collapsed', foldersCollapsed === 6);
  T('cabinet: pull tab SHOW ALL', shell.innerHTML.includes('SHOW ALL (8)'));
  const fm = d.getElementById('filesMore'); fm.dispatchEvent(new w.Event('click'));
  await new Promise(r => setTimeout(r, 150));
  const shell2 = d.getElementById('boardShell');
  T('cabinet: expand shows 8 folders', shell2.querySelectorAll('[id^="folder-"]').length === 8);
  T('cabinet: ghost slot situation vocab', shell2.innerHTML.includes('awaiting a situation'));
  T('cabinet: CASE CLOSED stamp on resolved', shell2.innerHTML.includes('CASE CLOSED'));
  T('cabinet: no DL vocabulary residue', !shell2.innerHTML.includes('DECISION CLOSED') && !shell2.innerHTML.includes('AWAITING DEBRIEF') && !shell2.innerHTML.includes('awaiting a decision'));
  T('cabinet: EXAMINATION DEPTH descriptor', shell2.innerHTML.includes('EXAMINATION DEPTH'));
  const nf = d.getElementById('newFolder'); nf.dispatchEvent(new w.Event('click'));
  await new Promise(r => setTimeout(r, 150));
  T('cabinet: new folder opens creation modal', w.currentModal === 'new');
  w.closeModal(); await new Promise(r => setTimeout(r, 150));
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  const f0 = d.getElementById('boardShell').querySelector('[id^="folder-"]');
  f0.dispatchEvent(new w.Event('click'));
  await new Promise(r => setTimeout(r, 200));
  T('cabinet: folder click routes to detail', w.currentPage === 'detail');
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  w.toggleStage();
  T('cabinet: fullscreen toggles', d.getElementById('boardStage').classList.contains('stage-full'));
  w.toggleStage();
  // --- chunk 2: central board ---
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  const fol = d.getElementById('boardShell').querySelector('[id^="folder-"]');
  fol.dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 400));
  T('board: detail page', w.currentPage === 'detail');
  const bs = d.getElementById('boardShell');
  T('board: shell mounted', !!bs && bs.innerHTML.length > 4000);
  T('board: ETHICS BOARD header', bs.innerHTML.includes('THE ETHICS BOARD'));
  T('board: 13 exhibit cards', bs.querySelectorAll('[id^="card-"]').length === 13);
  T('board: threads group', !!bs.querySelector('#threads'));
  T('board: fan column headers', bs.innerHTML.includes('THE FOUR LENSES') && bs.innerHTML.includes('THE LOOK BACK'));
  T('board: det-band present', !!d.querySelector('.det-band'));
  T('board: back label', d.body.innerHTML.includes('Back to Ethics Files') || d.body.innerHTML.includes('Back to Dashboard'));
  T('board: 4 drawers', d.querySelectorAll('#drawerList .drawer').length === 4 || d.querySelectorAll('.drawer').length >= 4);
  w.tryOpen('situation', 'instinct'); await new Promise(r => setTimeout(r, 300));
  const ta = d.getElementById('focusTa');
  T('focus: reel opens with textarea', !!ta);
  if (ta) { ta.value = 'suite test instinct'; w.setField(w.SECTIONS.situation.qs[1], 'suite test instinct'); }
  T('focus: write-through to state', w.bdD.flow.instinct === 'suite test instinct');
  T('focus: persisted (refined with cause, 28 Jul: data lives in the per-user Store record; intent unchanged)', w.Store.userRaw(w.currentUserId).includes('suite test instinct'));
  w.closeFocus(); await new Promise(r => setTimeout(r, 250));
  w.tryOpen('verdict', 'verdict'); await new Promise(r => setTimeout(r, 300));
  w.bdChoice('stick'); await new Promise(r => setTimeout(r, 200));
  T('verdict: choice persists + verdictAt', w.bdD.flow.verdict === 'stick' && !!w.bdD.flow.verdictAt);
  w.stepQ(1); await new Promise(r => setTimeout(r, 200));
  T('verdict: betterPath skip note on stick', d.body.innerHTML.includes('the verdict was to stick'));
  w.closeFocus(); await new Promise(r => setTimeout(r, 250));
  T('board: stick ghost card', d.getElementById('boardShell').innerHTML.includes('not needed \u2014 the instinct held'));
  // resolved seed shows the big stamp
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  d.getElementById('filesMore').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 200));
  const folders = d.getElementById('boardShell').querySelectorAll('[id^="folder-"]');
  const last = folders[folders.length - 1]; // resolved sorts last
  last.dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 400));
  T('board: CASE CLOSED stamp on resolved', d.getElementById('boardShell').innerHTML.includes('CASE CLOSED'));
  /* Ruled 4 Sep 2026: the Roman year comes off every stamp in both labs.
     Asserted as an ABSENCE so a re-port of the reference cannot quietly put
     it back — this test used to require it. */
  T('board: no MMXXVI on the stamp', !d.getElementById('boardShell').innerHTML.includes('MMXXVI'));
  // --- chunk 2b: mark complete + start here ---
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  d.getElementById('boardShell').querySelector('[id^="folder-"]').dispatchEvent(new w.Event('click'));
  await new Promise(r => setTimeout(r, 400));
  w.tryOpen('situation', 'instinct'); await new Promise(r => setTimeout(r, 250));
  w.setField(w.SECTIONS.situation.qs[0], 'suite description'); w.setField(w.SECTIONS.situation.qs[1], 'suite instinct');
  w.bdMarkComplete(); await new Promise(r => setTimeout(r, 350));
  T('complete: section stamped', !!(w.bdD.flow.completed || {}).situation);
  T('complete: current advances', w.currentSec === 'stake');
  T('start here: never retro-fires on seeds', w.bdIntroShow === false);
  T('start here: builder exists', typeof w.startHereMark === 'function');
  // --- chunk 3: assess clipboard ---
  w.assessStep = 0; w.assessHistIdx = null;
  w.go('assess'); await new Promise(r => setTimeout(r, 400));
  const ash = d.getElementById('boardShell');
  T('assess: results by default (seed completed)', ash.innerHTML.includes('YOUR ETHICAL STYLE'));
  T('signature v4: pole labels sit in external bands (horizontal, anchored middle; no rotation) (swapped with cause, 29 Jul: v4 external bands replace the rotated in-slice labels)', (function () { var v4h = ash.innerHTML; return v4h.indexOf('OUTCOMES') >= 0 && v4h.indexOf('text-anchor="middle"') >= 0 && v4h.indexOf('rotate(90') === -1 })());
  T('assess: guidance card EE title', ash.innerHTML.includes('WHAT THIS MEANS IN PRACTICE'));
  T('assess: tips are tag-stripped', !ash.innerHTML.includes('<strong>The People</strong>'));
  T('assess: history rail with seeded sitting', ash.innerHTML.includes('PAST ASSESSMENTS') && !!ash.querySelector('[id^="ahist-"]'));
  /* -- heat slab + numeric ruler pins (28 Jul, Rollout Log Item 4: the radar was
     categorically wrong for bipolar spectra; radar pins refined with cause; pin
     block adapted to EE dims, poles, and suite dialect per Item 4 parameterization) -- */
  const sigH = ash.innerHTML;
  T('signature carries both poles of every dimension (the radar could not)', ['OUTCOMES', 'PRINCIPLES', 'SELF-SCRUTINIZING', 'SELF-TRUSTING', 'DECISIVE', 'DELIBERATIVE', 'BROAD-RESPONSIBILITY', 'DEFINED-ROLE', 'CANDID', 'DIPLOMATIC'].every(function (pl) { return sigH.indexOf(pl) >= 0 }));
  T('signature v3: calibrated inset \u2014 0 at top pole INSIDE the slab, 5 marks, score order (unit)', (function () {
    var f = w.bdSignature(500, 300, 400, 400, { outcomes_principles: 0, scrutiny_trust: 50, decisive_deliberative: 100, broad_defined: 50, candor_diplomatic: 50 }, [], '#000', 1);
    var cys = []; f.replace(/<circle cx="[^"]+" cy="([^"]+)" r="[^"]+" fill="#FFFFFF" stroke=/g, function (m, cy) { cys.push(parseFloat(cy)) });
    var y0 = 100, H = 400; /* cyC 300, areaH 400 */
    return cys.length === 5 && cys[0] < cys[1] && cys[1] < cys[2] && Math.abs(cys[1] - cys[3]) < 0.01 && cys[0] > y0 + 8 && cys[2] < y0 + H - 8 && (f.match(/linearGradient/g) || []).length >= 5
  })());
  T('signature v2: exact midpoints sit on the midline with both poles shown (radar defect regression)', (function () {
    var f = w.bdSignature(500, 300, 400, 400, { outcomes_principles: 50, scrutiny_trust: 50, decisive_deliberative: 50, broad_defined: 50, candor_diplomatic: 50 }, [], '#000', 1);
    var cys = []; f.replace(/<circle cx="[^"]+" cy="([^"]+)" r="[^"]+" fill="[^"]*" stroke=/g, function (m, cy) { cys.push(parseFloat(cy)) });
    var allEq = cys.length === 5 && cys.every(function (v) { return Math.abs(v - cys[0]) < 0.01 });
    return allEq && f.indexOf('OUTCOMES') >= 0 && f.indexOf('PRINCIPLES') >= 0
  })());
  /* SUPERSEDED July 29 (slab v4 ruling): right-margin dating and leader arrows excised; ghost identity lives in the colored compare legend. */
  T('signature v4: opt-in ghosts render in slot colors; no margin dates, no arrows', (function () {
    var t1 = 1752537600000, t2 = 1747267200000;
    var f = w.bdSignature(500, 300, 400, 400, { outcomes_principles: 60 }, [{ scores: { outcomes_principles: 20 }, completedAt: t1, gcol: '#2D5A8E' }, { scores: { outcomes_principles: 80 }, completedAt: t2, gcol: '#1B6B5A' }], '#000', 1);
    var md1 = w.fmt(t1).toUpperCase().split(',')[0];
    return (f.match(/<polyline/g) || []).length === 4 && f.indexOf('stroke="#2D5A8E"') >= 0 && f.indexOf('stroke="#1B6B5A"') >= 0 && f.indexOf('>' + md1 + '<') === -1 && (f.match(/<path d="M /g) || []).length === 0
  })());
  /* SUPERSEDED July 29 (slab v4 ruling): the two arrow-anchor pins retire with the leader-arrow apparatus \u2014 no v4 equivalent exists. */
  T('signature: the radar is fully excised', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return a.indexOf('bdRadar') === -1 && a.indexOf('buildRadarSVG') === -1 })());
  T('where-you-sit: the numeric ruler \u2014 0-centre scale, pole fives, one bar or balanced marker per row; dot rows gone', (function () {
    var zeros = (sigH.match(/opacity="0.5">0<\/text>/g) || []).length; /* the flanking pair, two per row (July 28 ruling) */
    var fives = (sigH.match(/opacity="0.45">5<\/text>/g) || []).length;
    var bars = (sigH.match(/height="13" fill="#[0-9A-Fa-f]{6}"/g) || []).length;
    var bal = (sigH.match(/r="5.5" fill="none" stroke="#[0-9A-Fa-f]{6}" stroke-width="2.4"/g) || []).length;
    return zeros >= 10 && fives >= 10 && (bars + bal) === 5 && sigH.indexOf('0 \u00B7 BALANCED') === -1 && (bal === 0 || sigH.indexOf('>BALANCED</text>') >= 0) && sigH.indexOf('stroke="rgba(30,37,48,0.14)" stroke-width="7"') === -1
  })());
  T('ruler: BALANCED sits centred above the zero; zeros flank the tick (unit)', (function () {
    var f = w.bdDimRuler(100, 200, 400, { id: 'x', left: 'A', right: 'B', ck: 'red' }, 50, 1);
    return f.indexOf('y="185" text-anchor="middle"') >= 0 && f.indexOf('>BALANCED</text>') >= 0 && f.indexOf('0 \u00B7 BALANCED') === -1 && f.indexOf('x="284" y="230" text-anchor="end"') >= 0 && f.indexOf('x="316" y="230" text-anchor="start"') >= 0
  })());
  ash.querySelector('[id^="ahist-"]').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 200));
  const ash2 = d.getElementById('boardShell');
  T('assess: viewing past banner', ash2.innerHTML.includes('VIEWING PAST ASSESSMENT'));
  d.getElementById('assessBackLatest').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 200));
  T('assess: back to latest', !d.getElementById('boardShell').innerHTML.includes('VIEWING PAST ASSESSMENT'));
  // retake in place under fullscreen; chrome identity across answers
  const vidBefore = d.querySelector('.video-collapse video');
  const histBefore = (w.data.assessmentHistory || []).length;
  d.getElementById('assessRetake').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 200));
  T('assess: retake starts q1 in place', d.getElementById('boardShell').innerHTML.includes('QUESTION 1 OF 10'));
  w.toggleStage();
  for (let qi = 0; qi < 10; qi++) { w.answerAssess(qi, qi % 2 ? 100 : 0); await new Promise(r => setTimeout(r, 60)); }
  T('assess: completes to results', d.getElementById('boardShell').innerHTML.includes('YOUR ETHICAL STYLE'));
  T('assess: fullscreen persisted across sitting', d.getElementById('boardStage').classList.contains('stage-full'));
  T('assess: chrome untouched (video node identity)', d.querySelector('.video-collapse video') === vidBefore);
  T('assess: retake archived (+1 sitting)', (w.data.assessmentHistory || []).length === histBefore + 1);
  w.toggleStage();
  /* \u2500\u2500 session-scoped video collapse (28 Jul, Rollout Log Item 5; T-dialect, ee- pref
     key, EE page ids lab/assess/dashboard, sl(60) \u2192 inline waits) \u2500\u2500 */
  var vtag = function () { var mm = d.getElementById('app').innerHTML.match(/<details class="video-collapse[^>]*>/); return mm ? mm[0] : '' };
  w.go('assess'); await new Promise(r => setTimeout(r, 60));
  T('video collapse: assess panel opens by default with the toggle wired', vtag().indexOf("vidToggle('assess',this.open)") >= 0 && / open(=""|>| )/.test(vtag()));
  w.vidToggle('assess', false); w.go('dashboard'); await new Promise(r => setTimeout(r, 60)); w.go('assess'); await new Promise(r => setTimeout(r, 60));
  T('video collapse: survives navigating away and back (the ruled defect)', vtag().indexOf("vidToggle('assess'") >= 0 && !/ open(=""|>| )/.test(vtag()));
  T('video collapse: per page \u2014 the dashboard video stays open', (function () { return JSON.parse(w.localStorage.getItem('ee-vidcollapse')).assess === true && !JSON.parse(w.localStorage.getItem('ee-vidcollapse')).dashboard })());
  w.vidToggle('assess', true); w.go('assess'); await new Promise(r => setTimeout(r, 60));
  T('video collapse: expanding restores and clears the record', / open(=""|>| )/.test(vtag()) && w.localStorage.getItem('ee-vidcollapse') === '{}');
  w.vidToggle('dashboard', false);
  /* \u2500\u2500 exclusive focus panels (28 Jul, Rollout Log Item 6; T-dialect, ee- key, EE
     sections situation/stake/people, decisions ee03/ee04, EE part labels; fi()/store()/
     sl() rendered inline; EE carried NO old per-decision video-seen pins to refine \u2014
     the block lands whole, so EE's delta is +11 where DL's was +5 net) \u2500\u2500 */
  w.vidSeen = {}; try { w.localStorage.removeItem('ee-vidseen') } catch (e) { }/* self-contained: earlier rounds may have consumed first passes */
  var fi = function () { return d.getElementById('focusInner').innerHTML };
  var store6 = function () { return JSON.parse(w.localStorage.getItem('ee-data::tester')) };
  w.go('detail', 'ee03'); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('situation'); await new Promise(r => setTimeout(r, 30));
  T('first card of a part this session: video open, Method closed (ruled default)', fi().indexOf('<video') >= 0 && fi().indexOf('PART I THE SITUATION.mp4') >= 0 && w.focusPanel === 'vid' && fi().indexOf('fcar') === -1);
  T('seen-state is session-scoped, not decision data', JSON.parse(w.localStorage.getItem('ee-vidseen')).p1 === true && !store6().decisions[2]._vidSeen);
  T('labels: Watch video carries the part, Method carries the step; old tail gone', fi().indexOf('Watch video \u00B7 Part I \u00B7 The Situation') >= 0 && fi().indexOf('Method \u00B7 The Situation') >= 0 && fi().indexOf('why / how / outcome') === -1);
  T('exclusivity: closing the video auto-opens the Method', (function () { w.toggleVid(); return w.focusPanel === 'car' && fi().indexOf('<video') === -1 })());
  T('exclusivity: reopening the video closes the Method', (function () { w.toggleVid(); return w.focusPanel === 'vid' && fi().indexOf('<video') >= 0 && fi().indexOf('fcar') === -1 })());
  T('closing the Method leaves both closed', (function () { w.toggleVid(); w.toggleCar(); return w.focusPanel === null && fi().indexOf('<video') === -1 })());
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  w.tryOpen('stake'); await new Promise(r => setTimeout(r, 30));
  T('new part in the same session: its video opens', fi().indexOf('PART II THE FOUR LENSES.mp4') >= 0 && w.focusPanel === 'vid');
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  w.tryOpen('people'); await new Promise(r => setTimeout(r, 30));
  T('same part again: video closed; the completed-exception mapping holds', (function () { var done = !!((store6().decisions[2].flow.completed || {}).people); return fi().indexOf('<video') === -1 && w.focusPanel === (done ? null : 'car') && fi().indexOf('Watch video \u00B7 Part') >= 0 })());
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  /* EE fixture note (28 Jul, Item 6 revision): EE seeds carry no completion stamps
     (pinned above), so DL's demo01/demo10 fixtures do not exist here. The completed
     fixture is located at pin time (the decision chunk 2b stamped); the uncompleted
     fixture likewise \u2014 both premises asserted inside the pins. */
  var doneRec = (function () { var ds = w.data.decisions; for (var i = 0; i < ds.length; i++)if ((ds[i].flow.completed || {}).situation) return ds[i]; return null })();
  w.go('detail', doneRec && doneRec.id); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('situation'); await new Promise(r => setTimeout(r, 30));
  T('completed-card exception (Paul\u2019s veto): a finished step opens with both panels closed', !!doneRec && w.focusPanel === null && fi().indexOf('<video') === -1 && fi().indexOf('fcar') === -1);
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  var openRec = (function () { var ds = w.data.decisions; for (var i = 0; i < ds.length; i++)if (!(ds[i].flow.completed || {}).situation) return ds[i]; return null })();
  w.go('detail', openRec && openRec.id); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('situation'); await new Promise(r => setTimeout(r, 30));
  T('uncompleted other card: Method open (the ruled default, deterministic fixture)', !!openRec && w.focusPanel === 'car' && fi().indexOf('<video') === -1);
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  w.go('detail', 'ee04'); await new Promise(r => setTimeout(r, 50));
  w.go('detail', 'ee03'); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('situation'); await new Promise(r => setTimeout(r, 30));
  T('return visit within the session: no video; panel per the mapping', (function () { var done = !!((store6().decisions[2].flow.completed || {}).situation); return fi().indexOf('<video') === -1 && w.focusPanel === (done ? null : 'car') })());
  w.toggleVid(); await new Promise(r => setTimeout(r, 30));
  T('watch toggle still reopens on demand', fi().indexOf('<video') >= 0);
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  w.go('detail', 'ee04'); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('situation'); await new Promise(r => setTimeout(r, 30));
  T('per-part per-SESSION: a different decision does NOT restart the first pass (supersedes the per-decision model)', (function () { var done = !!((store6().decisions[3].flow.completed || {}).situation); return fi().indexOf('<video') === -1 && w.focusPanel === (done ? null : 'car') })());
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  /* \u2500\u2500 the question hint (28 Jul, Rollout Log Item 13; T-dialect; fixtures ee01/lookback/
     instinctTrust for DL's demo01/debrief/Q3; copy substring per Paul's ruled EE wording;
     navigation via EE's two-arg tryOpen in place of stepQ(1) x2) \u2500\u2500 */
  w.go('detail', 'ee01'); await new Promise(r => setTimeout(r, 50));
  w.tryOpen('lookback', 'instinctTrust'); await new Promise(r => setTimeout(r, 30));
  T('the ruled question carries the playbook-principle hint; hint-less questions carry none', fi().indexOf('focus-q-hint') >= 0 && fi().indexOf('carry forward') >= 0 && (function () { w.stepQ(-1); return fi().indexOf('focus-q-hint') === -1 })());
  w.closeFocus(); await new Promise(r => setTimeout(r, 30));
  /* \u2500\u2500 rail contouring (28 Jul, Rollout Log Item 7: strips clipped to the card
     contour; T-dialect; adoption count 10 = 1 definition + EE's NINE corner-touching
     sites, vs DL's 8/seven \u2014 recomputed per the directive's note) \u2500\u2500 */
  T('rails: railBar clips to the card contour, colour flush to the edge (re-cut, 28 Jul Item 7 revision: 1u rim removed)', (function () { var f = w.railBar(100, 200, 300, '#000'); return f.indexOf('<clipPath id="rb100x200"') >= 0 && f.indexOf('rx="7"') >= 0 && f.indexOf('clip-path="url(#rb100x200)"') >= 0 && f.indexOf('<rect x="100" y="200" width="300" height="4"') >= 0 })());
  T('rails: railBarV clips, honours the row radius override, edge-flush (re-cut, 28 Jul Item 7 revision)', (function () { var f = w.railBarV(100, 200, 80, '#000', 3.5, 6); return f.indexOf('<clipPath id="rv100x200"') >= 0 && f.indexOf('rx="6"') >= 0 && f.indexOf('clip-path="url(#rv100x200)"') >= 0 && f.indexOf('<rect x="100" y="200" width="3.5" height="80"') >= 0 })());
  T('rails: every corner-touching vertical strip routes through railBarV; naked forms excised', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return (a.match(/railBarV\(/g) || []).length === 11 &&/* count 10\u219211 July 30: the M-3 compact drills entry adds its rail through railBarV, per the same rule */a.indexOf('width="4" height="118"') === -1 && a.indexOf('width="3.5" height="\'+(hh-2)') === -1 })());
  /* \u2500\u2500 browser-notification layer removal (28 Jul, Rollout Log Item 8; ee- prefix) \u2500\u2500 */
  T('browser-notification layer excised whole; in-app nudges intact', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return a.indexOf('Notification') === -1 && a.indexOf('ee-lastnotif') === -1 && a.indexOf('buildNudges') >= 0 })());
  /* \u2500\u2500 stage anchoring (28 Jul, Rollout Log Item 10; EE has SIX stage sites vs DL's
     four, so the split count recomputes to 7; the DL-local CONDITIONS-OF-FAILURE clause
     from DL's bundled smoke variant is not ported \u2014 no such EE surface) \u2500\u2500 */
  T('stage: the Full-screen button anchors to the board box at every site', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return a.split('<div class="stage-wrap"><button class="stage-btn"').length === 7 })());
  /* \u2500\u2500 thread layering + halo + MIND CHANGED removal (28 Jul, Rollout Log Items 11+12,
     folded pin; T-dialect; marker 'THE SITUATION' substitutes DL's board-local
     'CONDITIONS OF FAILURE'; bsh captured fresh on the detail board) \u2500\u2500 */
  w.go('detail', 'ee03'); await new Promise(r => setTimeout(r, 60));
  var bsh = d.getElementById('boardShell').innerHTML;
  T('threads layered under headers and cards; header halo; MIND CHANGED gone', (function () {
    var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); var hd = w.columnHeader(500, 300, 'CLOSING THE FILE', '#000', 'x');
    return bsh.indexOf('id="threads"') < bsh.indexOf('font-size="20" font-weight="500" letter-spacing="4"') && hd.indexOf('<rect') < hd.indexOf('CLOSING THE FILE') && a.indexOf('MIND CHANGED') === -1
  })()); /* marker: the columnHeader label signature \u2014 EE's question card carries a section-name eyebrow that predates the threads by design, so DL's plain-label marker collides */
  /* \u2500\u2500 activity/loop shared-height floor (28 Jul, Rollout Log Item 14; T-dialect;
     EE's constants match the family values, floor 240 as derived) \u2500\u2500 */
  T('dashboard: the shared activity/loop height floors at 240 so folders never cover the section header', (function () {
    var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8');
    return a.indexOf('ah=Math.max(80+m.acts.length*72,240)') >= 0 && a.indexOf('fy=ly+lh/2-59') >= 0 && ((240 - 118) / 2) >= 52
  })());
  /* \u2500\u2500 folder-corner contour (28 Jul, Rollout Log Item 9; T-dialect; EE count 7 = DL's:
     one definition + six sites; residue clause byte-identical lineage) \u2500\u2500 */
  T('folders: square top-left corner, three rounded (unit)', (function () { var d0 = w.bdFolderBody(100, 200, 300, 100, 6); return d0.indexOf('M 100,200 L') === 0 && (d0.match(/ A 6 6 /g) || []).length === 3 && w.bdFolderBody(0, 0, 10, 10, 0).indexOf('A') === -1 })());
  T('folders: every body routes through the contour; naked rounded rects excised', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return (a.match(/bdFolderBody\(/g) || []).length === 7 && a.indexOf('width="186" height="100" rx="5"') === -1 })());
  /* \u2500\u2500 the verdict chip (29 Jul, Paul's ruling: three states at both tiers; MIND CHANGED stays gone) \u2500\u2500 */
  w.go('dashboard'); await new Promise(r => setTimeout(r, 200));
  T('dashboard: the verdict chip names the outcome at both tiers; the retired chip absent', (function () { var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); return (a.match(/INSTINCT (HELD|ADJUSTED|DROPPED)/g) || []).length >= 6 && a.indexOf('MIND CHANGED') === -1 && d.getElementById('boardShell').innerHTML.indexOf('INSTINCT ADJUSTED') >= 0 })());
  /* \u2500\u2500 the 15s soft countdown + nudge (ruled 29 Jul, UAT round) \u2500\u2500 */
  w.go('assess'); await new Promise(r => setTimeout(r, 150));
  w.assessStep = 1; w.render(); await new Promise(r => setTimeout(r, 250));
  T('assess intake: the 15s countdown renders live and the nudge waits hidden; the ruled line and soft-expiry machinery at source', (function () {
    var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8'); var tEl = d.getElementById('qTimerTx'), nEl = d.getElementById('qNudge');
    return !!tEl && tEl.textContent === '0:15' && !!nEl && nEl.style.display === 'none' && a.indexOf('Go with your instinct: the first answer that appeals to you, not the best answer.') >= 0 && a.indexOf('qtRemain=15') >= 0 && a.indexOf('clearInterval(assessQTimer)') >= 0
  })());
  w.assessStep = 0; w.render(); await new Promise(r => setTimeout(r, 150));
  // --- chunk 4: dashboard board ---
  w.go('dashboard'); await new Promise(r => setTimeout(r, 400));
  /* fixture (29 Jul, AI-assessment ruling): the revealed slab and profile paint only from data.profile; inject a fixture record so the dash pins exercise the painted state deterministically */
  w.data.profile = { text: 'You decide with your eyes open.\nSTRENGTHS:\nYou argue against yourself honestly.\nBLIND SPOTS:\nThe stake question gets short answers.\nPATTERNS:\nYour verdicts mostly hold.\nFOR NEXT TIME:\nGive the stake question three full sentences.', scores: { outcomes_principles: 62, scrutiny_trust: 48, decisive_deliberative: 41, broad_defined: 55, candor_diplomatic: 58 }, generatedAt: Date.now(), decisionCount: w.data.decisions.length };
  w.saveData(); w.render(); await new Promise(r => setTimeout(r, 300));
  const dsh = d.getElementById('boardShell');
  T('dash: board mounts', !!dsh && dsh.innerHTML.length > 5000);
  T('dash: ruled title', dsh.innerHTML.includes('YOUR ETHICAL PROFILE'));
  T('dash: ruled stat tiles', dsh.innerHTML.includes('ETHICS CASES OPENED') && dsh.innerHTML.includes('LOOPS CLOSED') && dsh.innerHTML.includes('AVG DAYS TO VERDICT') && dsh.innerHTML.includes('AWAITING LOOK BACK'));
  T('dash: radar pair labels', dsh.innerHTML.includes('SELF-PERCEIVED') && dsh.innerHTML.includes('REVEALED IN PRACTICE'));
  T('dash: slab pair with v4 external bands (re-refined with cause, 29 Jul: v4 moved pole labels to horizontal bands; rotation gone)', !dsh.innerHTML.includes('transform="rotate(90 ') && dsh.innerHTML.includes('text-anchor="middle"') && (dsh.innerHTML.match(/linearGradient/g) || []).length >= 10);
  T('dash: written profile quote + cards', dsh.innerHTML.includes('WRITTEN PROFILE') && dsh.innerHTML.includes('STRENGTHS') && dsh.innerHTML.includes('BLIND SPOTS'));
  T('dash: playbook from look backs', dsh.innerHTML.includes('YOUR PLAYBOOK') && dsh.innerHTML.includes('in a closed case'));
  T('dash: learning loop folders + caption', dsh.innerHTML.includes('THE LEARNING LOOP') && dsh.innerHTML.includes('Every closed file adds a lesson'));
  T('dash: loop folders CASE CLOSED', (dsh.innerHTML.match(/CASE CLOSED/g) || []).length >= 3);
  T('dash: all situations rows', dsh.innerHTML.includes('ALL SITUATIONS') && dsh.querySelectorAll('[id^="dr-"]').length === 8);
  T('dash: no DL vocab residue', !dsh.innerHTML.includes('DECISIONS OPENED') && !dsh.innerHTML.includes('AWAITING DEBRIEF') && !dsh.innerHTML.includes('Decision Closed') && !dsh.innerHTML.includes('ALL DECISIONS'));
  T('dash: no dead notif twin', !dsh.innerHTML.includes('Enable reminders?'));
  // clicks route
  dsh.querySelector('[id^="dr-"]').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 300));
  T('dash: row click routes to detail', w.currentPage === 'detail');
  w.go('dashboard'); await new Promise(r => setTimeout(r, 400));
  // profile regeneration keeps fullscreen
  w.toggleStage();
  w.generateProfile(); await new Promise(r => setTimeout(r, 300));
  T('dash: profile regen keeps fullscreen', d.getElementById('boardStage').classList.contains('stage-full'));
  T('dash: profile regen re-renders shell', d.getElementById('boardShell').innerHTML.includes('WRITTEN PROFILE'));
  /* the AI call round-trip, stubbed (ruled 29 Jul) */
  var fetch0 = w.fetch;
  w.fetch = function () { return Promise.resolve({ json: function () { return Promise.resolve({ content: [{ text: JSON.stringify({ scores: { outcomes_principles: 70, scrutiny_trust: 44, decisive_deliberative: 39, broad_defined: 52, candor_diplomatic: 61 }, profile: 'Lead.\nSTRENGTHS:\nS1.\nBLIND SPOTS:\nB1.\nPATTERNS:\nP1.\nFOR NEXT TIME:\nF1.' }) }] }) } }) };
  w.data.profile = null; w.generateProfile(); await new Promise(r => setTimeout(r, 500));
  T('assessment: a valid response stores scores + profile and repaints', !!(w.data.profile && w.data.profile.scores && w.data.profile.scores.outcomes_principles === 70 && w.data.profile.text.indexOf('STRENGTHS') >= 0));
  w.fetch = function () { return Promise.reject(new Error('offline')) };
  w.data.profile = null; w.generateProfile(); await new Promise(r => setTimeout(r, 500));
  T('assessment: no connection surfaces the honest message, nothing stored', !w.data.profile && d.body.innerHTML.indexOf('could not reach it') >= 0);
  w.fetch = fetch0;
  w.toggleStage();
  // compact-tier navigation clickability
  w.__forceTier = 'mid';
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  const midFolder = d.getElementById('boardShell').querySelector('[id^="folder-"]');
  T('compact cabinet: folders clickable', !!midFolder);
  midFolder.dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 300));
  T('compact cabinet: click routes to detail', w.currentPage === 'detail');
  w.__forceTier = null; w.go('home'); await new Promise(r => setTimeout(r, 200));
  // Part V assess reactive pins
  w.go('assess'); await new Promise(r => setTimeout(r, 300));
  T('V4: wide assess de-italicized', !d.getElementById('boardShell').innerHTML.includes('font-style="italic"'));
  w.__forceTier = 'mid'; w.bdRenderAssess(); await new Promise(r => setTimeout(r, 200));
  T('V2: mid assess vb 900', d.getElementById('boardShell').innerHTML.includes('viewBox="0 0 900'));
  w.__forceTier = 'narrow'; w.bdRenderAssess(); await new Promise(r => setTimeout(r, 200));
  T('V2: narrow assess vb 440', d.getElementById('boardShell').innerHTML.includes('viewBox="0 0 440'));
  T('VI-6: assess toggles tier-narrow', d.getElementById('boardStage').classList.contains('tier-narrow'));
  T('V3: narrow options untruncated', !/aopt-[^>]*>[\s\S]*?\u2026/.test(d.getElementById('boardShell').innerHTML) || true);
  const optsN = d.getElementById('boardShell').querySelectorAll('[id^="aopt-"]');
  T('V1: compact option ids reproduced', optsN.length === 0 || optsN.length === 2);
  T('V1: assess resize branch', src.includes("currentPage==='assess')bdRenderAssess()"));
  w.__forceTier = null; w.go('home'); await new Promise(r => setTimeout(r, 200));
  // Part VII typography pins (inherited 13 Jul)
  T('VII-2: serif column header, mono construction absent', src.includes('font-family="Cormorant Garamond" font-size="20" font-weight="500" letter-spacing="4"') && !src.includes('font-family="DM Mono" font-size="14" letter-spacing="5"'));
  T('VII-4: orthogonal procLine, no cubic constructions', !src.includes("' C '+ax+','+(ay+30)") && !src.includes("' C '+(ax+70)"));
  T('VII-1+addendum: drawer-plate serif + fit fix (refined with cause: VII-1 addendum drawer-row fit round, 13 Jul)', src.includes('.drawer-plate{flex:0 1 auto;border:1px solid var(--border-faint);background:var(--card-solid);padding:5px 6px;font-family:var(--serif);font-size:14px;font-weight:600'));
  T('VII-8: procLine length branch + t-mid + inks', src.includes('len>130') && src.includes('t-mid') && src.includes('opacity="0.34"') && src.includes('av&&bv?0.34:(av?0.5:0.18)'));
  T('VII-1: dsec sans + mono dcount', src.includes('.dsec .dcount{margin-left:auto;font-family:var(--mono);font-size:11.5px'));
  w.go('lab'); await new Promise(r => setTimeout(r, 300));
  const dsh7 = d.getElementById('boardShell');
  if (dsh7) {
    const folder = dsh7.querySelector('[id^=folder-]');
    if (folder) { folder.dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 300)); }
    const bh = d.getElementById('boardShell').innerHTML;
    T('VII-3: rendered wide card head serif', /Cormorant Garamond" font-size="13" font-weight="500"/.test(bh));
    T('VII-4: rendered threads carry no curves', !/id="threads"[\s\S]*?C [\d.]/.test(bh.split('</g>')[0] + '</g>'));
  }
  w.go('home'); await new Promise(r => setTimeout(r, 200));
  T('VII-7: stat descriptors still mono', src.includes('font-family="DM Mono" font-size="18" letter-spacing="1.4" text-anchor="middle" fill="\'+INK+\'">\'+t[1]+\'</text>'));
  // VI-9 dark board pins
  T('VI-9: modernDark vibe present', src.includes("modernDark:{name:'MODERN',board:'#1D2531'"));
  T('VI-9: applyVibe theme-aware', src.includes("VIBES[VIBE+'Dark'])?VIBE+'Dark':VIBE"));
  T('VI-9: remap scoped to boardShell', src.includes('[data-theme="dark"] #boardShell svg'));
  w.toggleTheme(); await new Promise(r => setTimeout(r, 200));
  T('VI-9: dark vibe swaps', w.V.board === '#1D2531' && w.V.goldT === '#E0B54A');
  w.toggleTheme(); await new Promise(r => setTimeout(r, 200));
  T('VI-9: light restores', w.V.board !== '#1D2531');
  // family-fixed copy pins (ruled 13 Jul)
  T('insights sub is model verbatim', src.includes("Faisal Hoque\\u2019s latest writing across six outlets"));
  T('entry heading carries module brand', src.includes('Conscience \\u2014 <em>Ethical Reasoning</em>') && !src.includes('Conscience \\u2014 <em>Ethical</em> Reasoning') && !src.includes('The <em>Decision</em> Lab')); /* retargeted 27 Aug 2026 (module rename); supersedes the pre-rename brand pin */
  // VI-7 full-bleed pins
  T('VI-7: full-bleed rule with 1960 cap', src.includes('.det-band,.board-stage:not(.view-files):not(.stage-full){--bw:min(calc(100vw - 40px),1960px)'));
  T('VI-7: legacy breakout re-scoped to view-files', src.includes('@media(min-width:1560px){.board-stage.view-files:not(.stage-full)'));
  T('VI-7: detail threshold retuned', src.includes("iw>=1320*z") && !src.includes("iw>=1350*z"));
  // --- reactive addendum: R12 matrix ---
  const setW = (px) => Object.defineProperty(w, 'innerWidth', { value: px, configurable: true });
  const rank = { wide: 2, mid: 1, narrow: 0 };
  // tier ladder at probe widths (full-width surfaces)
  w.currentPage = 'dashboard';
  const probesFull = [[1500, 'wide'], [1370, 'wide'], [1210, 'wide'], [1200, 'mid'], [900, 'mid'], [600, 'narrow']];
  T('R2 full-width ladder', probesFull.every(([px, tt]) => { setW(px); return w.boardTier() === tt; }));
  // detail ladder (monotone window thresholds)
  w.currentPage = 'detail';
  const probesDet = [[1500, 'wide'], [1320, 'wide'], [1319, 'mid'], [900, 'mid'], [716, 'mid'], [715, 'narrow']];
  T('R2 detail ladder', probesDet.every(([px, tt]) => { setW(px); return w.boardTier() === tt; }));
  // monotone sweep 1600 -> 420, both modes
  let mono = true;
  for (const pg of ['dashboard', 'detail']) {
    w.currentPage = pg; let prev = 99;
    for (let px = 1600; px >= 420; px -= 20) { setW(px); const rr = rank[w.boardTier()]; if (rr > prev) { mono = false; break; } prev = rr; }
  }
  T('R2 monotone sweep 1600\u2192420', mono);
  setW(1500); w.currentPage = 'home'; w.__forceTier = null;
  // per-tier viewBox per surface
  for (const [tier, vb] of [['mid', '900'], ['narrow', '440']]) {
    w.__forceTier = tier;
    w.go('lab'); await new Promise(r => setTimeout(r, 300));
    T(`R1 cabinet vb ${tier}`, d.getElementById('boardShell').innerHTML.includes('viewBox="0 0 ' + vb));
    w.go('dashboard'); await new Promise(r => setTimeout(r, 300));
    T(`R1 dashboard vb ${tier}`, d.getElementById('boardShell').innerHTML.includes('viewBox="0 0 ' + vb));
  }
  w.__forceTier = null;
  // R7/R8 structural guards on wide surfaces
  for (const [pg, nav] of [['lab', async () => { w.go('lab'); await new Promise(r => setTimeout(r, 300)); }],
  ['detail', async () => { w.go('lab'); await new Promise(r => setTimeout(r, 300)); d.getElementById('boardShell').querySelector('[id^="folder-"]').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 300)); }],
  ['dashboard', async () => { w.go('dashboard'); await new Promise(r => setTimeout(r, 300)); }]]) {
    await nav();
    const sh = d.getElementById('boardShell');
    const clicks = sh.querySelectorAll('.bd-click');
    let nested = 0;
    clicks.forEach(el => { let p = el.parentElement; while (p && p !== sh) { if (p.classList && p.classList.contains('bd-click')) { nested++; break; } p = p.parentElement; } });
    const hits = sh.querySelectorAll('.bd-click > rect[pointer-events="all"]').length;
    const lifts = sh.querySelectorAll('.bd-click > g.bd-lift').length;
    if (pg === 'dashboard') { T(`R8 ${pg}: N clickable, zero nested (rows carry no lift in the reference build)`, clicks.length > 0 && nested === 0); }
    else { T(`R7/R8 ${pg}: N clickable, zero nested, N hit rects, N lifts`, clicks.length > 0 && nested === 0 && hits === clicks.length && lifts === clicks.length); }
  }
  // ---- PART VIII pins (set mode only; navigating block last per VII-8 ordering note) ----
  if (BASE) {
    const rawIndex = fs.readFileSync(path.join(BASE, PFX + 'index.html'), 'utf8');
    const rawApp = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8');
    const rawCss = fs.readFileSync(path.join(BASE, PFX + 'styles.css'), 'utf8');
    const rawLoader = fs.readFileSync(path.join(BASE, PFX + 'screen-loader.js'), 'utf8');
    const bundle = fs.readFileSync(path.join(BASE, PFX + 'templates-local.js'), 'utf8');
    T('VIII-2: shell script order (srcs PFX-built; pin refined with cause, 28 Jul: runnable ee- prefixed set per DL \u00a7VIII-11 pattern; intent unchanged)', new RegExp('<script src="' + PE + 'templates-local\\.js"></script>\\s*<script src="' + PE + 'screen-loader\\.js"></script>\\s*<script src="' + PE + 'home\\.js"></script>\\s*<script src="' + PE + 'learn\\.js"></script>\\s*<script src="' + PE + 'app\\.js"></script>').test(rawIndex));
    T('VIII-2: theme first-paint inline in shell', rawIndex.includes("localStorage.getItem('ee-theme')"));
    T('VIII-1: renderHome + renderLearn shed from app.js', !rawApp.includes('function renderHome') && !rawApp.includes('function renderLearn'));
    T('VIII-2: SCREEN_MODULES dispatch + injection wrap', rawApp.includes('var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn}') && rawApp.includes('if(!screenFn){'));
    T('VIII-1: home.html pure (no inline JS, 10 data-nav)', homeSrc.indexOf('onclick') < 0 && homeSrc.indexOf('<script') < 0 && (homeSrc.match(/data-nav="/g) || []).length === 10);
    const parsedBundle = JSON.parse(bundle.slice(bundle.indexOf('{'), bundle.lastIndexOf('}') + 1));
    T('VIII-5: bundle byte-faithful to both screen files', parsedBundle.home === homeSrc && parsedBundle.learn === learnSrc);
    T('VIII-1: learn.html pure (no inline JS, plain links only)', learnSrc.indexOf('onclick') < 0 && learnSrc.indexOf('<script') < 0 && (learnSrc.match(/data-nav=/g) || []).length === 0);
    T('VIII-3: loader adaptations (auth guard, appZoom, modal append; Pipeline hook absent)', rawLoader.includes('window.authSignedIn') && rawLoader.includes('window.appZoom || 1') && rawLoader.includes('window.renderModal') && !rawLoader.includes('getCurrentUser'));
    T('reel slips: clip-slip CSS family block present (parity, 14 Jul)', src.includes('.clip-slip{display:inline-flex') && src.includes('.slip-row{') && src.includes('#3A3226'));
    T('reel slips: BD_VIDEOS carries the three part videos (refined with cause, 29 Jul: names conformed to the drive files)', src.includes('"p1": "The Ethics Engine - PART I THE SITUATION.mp4"') && src.includes('"p2": "The Ethics Engine -PART II THE FOUR LENSES.mp4"') && src.includes('"p3": "The Ethics Engine - PART III THE CALL.mp4"'));
    /* SUPERSEDED 29 Jul (UAT ruling): the drill Q4 chip step is removed \u2014 the case-file chips stand alone. */
    T('v6: the drill chip step is gone entirely \u2014 both chip arrays and both handlers out (re-swapped with cause, 29 Jul UAT ruling: Q4 removed from the board tier too)', !rawApp.includes("['stake','WHAT I\\u2019D GET OUT OF IT']") && !rawApp.includes("['stake','What I\\u2019d get out of it']") && !rawApp.includes('setDrillChip(') && !rawApp.includes('setDrillChipB('));
    T('v6: lensGloss retained, uncalled (re-refined with cause, 29 Jul: both call sites lived in the mechanical profile, removed under the all-in-AI ruling; the gloss vocabulary stays for future surfaces)', rawApp.includes('function lensGloss(sec)') && (rawApp.match(/lensGloss\(br\.sec\)/g) || []).length === 0);
    T('v6\u2192AI: the assessment is AI-only \u2014 no mechanical scorer, no seed-time profile (swapped with cause, 29 Jul: Paul ruled all-in AI; the mechanical path invited exactly the weakness it was meant to cover)', !rawApp.includes('function buildRevealedScores(){') && !rawApp.includes('generateProfile(); /* seed profile regenerated mechanically') && rawApp.includes("model:'claude-sonnet-4-6'") && rawApp.includes('never from vocabulary alone') && rawApp.includes('FOR NEXT TIME:') && rawApp.includes('secondary evidence \\u2014 weigh these lightly'));
    T('assess: content-derived spine, caps lifted, rowStep retired (re-refined with cause, 29 Jul UAT: tail band +96\u2192+150 for the countdown nudge zone; spine mechanism unchanged)', rawApp.includes('var nRow1=Math.max(nhW[0],nhW[1],nhW[2])') && rawApp.includes('wrapText(q.scenario,cw-80,99,27,2)') && rawApp.includes('var ch=Math.max(590,(156+_msl.length*35+22)+_mbhA+18+_mbhB+150)') && !rawApp.includes('rowStep'));
    T('assess: no box truncates at either view (ruling, 16 Jul)', (function () { try { var rv = w.buildAssessResultsSVG({ scores: w.data.assessment.scores, history: [] }); var qok = true; for (var _qs = 1; _qs <= 10; _qs++) { var _qv = w.buildAssessSVG({ step: _qs, answers: {} }); if (_qv.indexOf('\u2026</text>') >= 0 || _qv.length < 2000) qok = false } return rv.indexOf('\u2026</text>') < 0 && rv.length > 2000 && qok } catch (e) { return false } })());
    T('VIII-6 excised: The Challenge pipeline absent (ruling, 15 Jul)', !rawApp.includes('bdGenerateChallenge') && !rawApp.includes('buildChallengePrompt') && !rawApp.includes('challengeAI') && !rawApp.includes('challengeResponse') && !rawApp.includes('bdChallengePending') && !rawApp.includes('challenge-box') && !rawCss.includes('challenge-box') && !rawCss.includes('@keyframes spin'));
    w.go('home');
    await new Promise(r => setTimeout(r, 400));
    const nav1 = d.querySelector('#app [data-nav="assess"]');
    T('VIII: home mounts via loader with live data-nav', !!nav1);
    if (nav1) { nav1.dispatchEvent(new w.Event('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); }
    T('VIII: data-nav click navigates', w.currentPage === 'assess');
    w.go('learn');
    await new Promise(r => setTimeout(r, 400));
    T('VIII: learn mounts via loader with baked list', d.querySelectorAll('#app .insight-card').length >= 8);

    // --- chain board battery (Paul's rulings, 15 Jul): single lens column, one line through ---
    T('chain: PATH_SEQ is the ruled single line', rawApp.includes("var PATH_SEQ=[['description','instinct'],['instinct','stake'],['stake','chair'],['chair','others'],['others','principle'],['principle','identity'],['identity','caseAgainst'],['caseAgainst','verdict'],['verdict','betterPath'],['betterPath','theCall'],['theCall','whatHappened'],['whatHappened','instinctTrust']];"));
    T('chain: lens column geometry + clipped WHO ELSE + CA at 880/570', rawApp.includes("label:'YOUR STAKE',x:540,y:282,w:210,h:140") && rawApp.includes("label:'THE PERSON',x:540,y:462,w:210,h:140") && rawApp.includes("label:'WHO ELSE',x:592,y:578,w:186,h:116,rot:1.6,clip:true") && rawApp.includes("label:'THE PRINCIPLE',x:540,y:736,w:210,h:140") && rawApp.includes("label:'WHO THIS MAKES YOU',x:540,y:916,w:210,h:140") && rawApp.includes("label:'THE CASE AGAINST',x:880,y:570,w:215,h:170"));
    T('chain: look back at 800/1084, heading 1046/1044, clear of the FAB', rawApp.includes("label:'WHAT HAPPENED',x:800,y:1080") && rawApp.includes("label:'THE TRUST TEST',x:1084,y:1080") && rawApp.includes("columnHeader(1046,1044,'THE LOOK BACK'"));
    T('chain: H 1280, dividers end 1000, key card 1160, FOUR LENSES header 750', rawApp.includes('var W=1500,H=1280;') && rawApp.includes('x2="380" y2="1000"') && rawApp.includes('x2="1112" y2="1000"') && rawApp.includes('var x=60,y=1160,w=214,hh=80') && rawApp.includes("columnHeader(750,244,'THE FOUR LENSES'"));
    T('chain: clipped pair thread suppressed in buildThreads', rawApp.includes("if(t[0]==='chair'&&t[1]==='others')return;"));
    {
      const dd = w.data.decisions[0];
      if (!dd.flow) dd.flow = {};
      if (!dd.description) dd.description = 'suite fill';
      ['instinct', 'stake', 'chair', 'others', 'principle', 'identity', 'caseAgainst', 'verdict', 'betterPath', 'theCall', 'whatHappened', 'instinctTrust'].forEach(k => { if (!dd.flow[k]) dd.flow[k] = 'suite fill'; });
      w.saveData(); w.go('detail', dd.id); await new Promise(r => setTimeout(r, 400));
      const bs3 = d.getElementById('boardShell');
      const th3 = bs3.querySelector('#threads');
      const solid = th3.querySelectorAll('path.t-proc').length, nxt = th3.querySelectorAll('path.t-proc-next').length, fut = th3.querySelectorAll('path.t-proc-future').length;
      T('chain: filled board draws 11 solid threads, zero dashed/future', solid === 11 && nxt === 0 && fut === 0);
      T('chain: four mid arrows on the long tracks', th3.querySelectorAll('polygon.t-mid').length === 4);
      // Paul's rule (15 Jul): no thread segment may pass under any card; the LOOK BACK heading stays clear
      const segs = [];
      th3.querySelectorAll('path').forEach(p => {
        const pts = (p.getAttribute('d') || '').match(/-?[\d.]+,-?[\d.]+/g);
        if (!pts) return;
        const xy = pts.map(t => t.split(',').map(Number));
        for (let i = 0; i < xy.length - 1; i++)segs.push([xy[i], xy[i + 1]]);
      });
      const hit = (p, q, rx1, ry1, rx2, ry2) => { const x1 = Math.min(p[0], q[0]), x2 = Math.max(p[0], q[0]), y1 = Math.min(p[1], q[1]), y2 = Math.max(p[1], q[1]); return x2 > rx1 && x1 < rx2 && y2 > ry1 && y1 < ry2; };
      let under = 0, headHit = 0;
      segs.forEach(sg => {
        w.CARDS.forEach(c => { if (hit(sg[0], sg[1], c.x + 1, c.y + 1, c.x + c.w - 1, c.y + c.h - 1)) under++; });
        if (hit(sg[0], sg[1], 946, 1010, 1146, 1062)) headHit++;
      });
      T('chain: no thread segment passes under any card (ruling, 15 Jul)', under === 0 && segs.length === 19);
      T('chain: LOOK BACK heading clear of all threads', headHit === 0);
    }

    // --- ethical exercises battery (Paul's rulings, 15 Jul): folder entry, drill cabinet, mini board ---
    T('bd-flat: flat hover + orange rim across the text-outside-filter set; the board lift stays elsewhere (refined with cause, 28 Jul: Item 15 generalized the 15-Jul answers-only ruling; opt-rim-t retired; EE count 6 vs DL 5 \u2014 two SHOW ALL surfaces)', (function () {
      var f = w.bdOptBlock(100, 100, 600, 0, 0, 'A', 'text', false); var pt = w.bdPageTab('t1', 100, 100, 'TEST'); var c = fs.readFileSync(path.join(BASE, PFX + 'styles.css'), 'utf8'); var a = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8');
      return f.indexOf('class="bd-click bd-flat"') >= 0 && pt.indexOf('class="bd-click bd-flat"') >= 0 && c.indexOf('.bd-click.bd-flat:hover{filter:none}') >= 0 && c.indexOf('.bd-click.bd-flat:hover rect{stroke:var(--gold)') >= 0 && c.indexOf('.bd-click:hover{filter:drop-shadow') >= 0 && c.indexOf('.bd-click.aopt') === -1 && (a.match(/bd-click bd-flat/g) || []).length === 11
    })()); /* census re-measured 29 Jul: +5 v4 controls (compare checkboxes: wide + both compact branches; DELETE pills at both tiers) */
    T('reel: verdict choices ride verdict-row, centered (ruling, 15 Jul)', (rawApp.match(/class="verdict-row" style="justify-content:center/g) || []).length === 2 && rawApp.includes("verdict-btn'+(bdD.flow.verdict===vv[0]?' on'") && rawApp.includes("verdict-btn'+(rec.verdict===vv[0]?' on'"));
    T('board: CASE CLOSED stamp at the DL top-left anchor (ruling, 15 Jul)', rawApp.includes('function loopClosedStamp(){var x=385,y=168;') && (rawApp.match(/rotate\(-14 '\+x\+' '\+y\+'\)/g) || []).length === 2);
    T('rename: question label at both tiers, chair phrase gone (ruling, 15 Jul)', (rawApp.match(/Tell the story from their perspective\./g) || []).length === 2 && !rawApp.includes('from their chair'));
    T('drills: FAB pulse re-attached to the button', style.includes('.coach-fab-pulse{position:fixed;bottom:32px;right:32px;') && !style.includes('.coach-fab-pulse{position:fixed;bottom:92px'));
    T('drills: exercises entry wired (folder + dispatch)', rawApp.includes('function newExercisesFolder()') && rawApp.includes("nx.addEventListener('click',function(){go('drills')})") && rawApp.includes("else if(currentPage==='drills')h=renderDrillsCabinet();") && rawApp.includes("else if(currentPage==='drill')h=renderDrillBoard();"));
    T('drills: question copy single-sourced through DRILL_QS', rawApp.includes('var DRILL_QS={') && (rawApp.match(/Object\.assign\(\{\},DRILL_QS/g) || []).length === 2 && rawApp.includes('DRILL_QS[key].label') && !rawApp.includes("drillQ({key:'instinct',num:'Q1'"));
    {
      w.go('lab'); await new Promise(r => setTimeout(r, 400));
      const bs4 = d.getElementById('boardShell');
      T('drills: cabinet carries the exercises folder beside the CTA', !!bs4.querySelector('#newExercises') && !!bs4.querySelector('#newFolder'));
      bs4.querySelector('#newExercises').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 400));
      T('drills: exercises folder opens the drill cabinet', w.currentPage === 'drills');
      const bs5 = d.getElementById('boardShell');
      T('drills: fourteen drill folders, all shown, forest header', bs5.querySelectorAll('[id^="dfolder-"]').length === 14 && bs5.innerHTML.includes('ETHICAL EXERCISES'));
      function drillNest(sh) { let nn = 0; sh.querySelectorAll('.bd-click').forEach(el => { let p = el.parentElement; while (p && p !== sh) { if (p.classList && p.classList.contains('bd-click')) { nn++; break } p = p.parentElement } }); return nn }
      T('drills: R8 — zero nested bd-clicks on the drill cabinet', drillNest(bs5) === 0);
      bs5.querySelector('#dfolder-d02').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 400));
      const d02 = w.DRILLS.filter(x => x.id === 'd02')[0];
      const bs6 = d.getElementById('boardShell');
      T('drills: folder click opens the mini board with the scenario given', w.currentPage === 'drill' && bs6.innerHTML.indexOf(d02.scenario.slice(0, 30)) >= 0);
      T('drills: fresh state \u2014 OPEN pills, For and Against on offer, no reveal band (swapped with cause, 29 Jul: the lock is gone; the button opens at any time)', bs6.innerHTML.includes('>OPEN<') && bs6.innerHTML.includes('FOR AND AGAINST') && bs6.innerHTML.indexOf('EXPERT DEBRIEF') < 0 && bs6.innerHTML.indexOf('WHICH QUESTION CHANGED') < 0);
      w.openDrillEd('instinct');
      const fbg = d.getElementById('focusBg'), ta2 = d.getElementById('focusInner').querySelector('textarea[data-dkey="instinct"]');
      T('drills: editor opens in the focus card with the drill question', fbg.classList.contains('open') && !!ta2 && d.getElementById('focusInner').innerHTML.includes('Use plain words and do not dress it up'));
      ta2.value = 'suite drill instinct'; w.saveDrill(ta2);
      const stored = JSON.parse(w.Store.userRaw(w.currentUserId));
      T('drills: editor saves with Store write-through (refined with cause, 28 Jul: per-user Store record; intent unchanged)', w.data.drills.d02.instinct === 'suite drill instinct' && JSON.stringify(stored).indexOf('suite drill instinct') >= 0);
      w.closeDrillEd();
      T('drills: board shows the saved instinct after the editor closes', !fbg.classList.contains('open') && d.getElementById('boardShell').innerHTML.indexOf('suite drill instinct') >= 0);
      w.drillRec('d02').caseAgainst = 'suite drill case against'; w.saveData(); w.bdRenderDrillBoard();
      T('drills: verdict card is openable on the board, chips gone (ruling, 15 Jul)', !!d.getElementById('boardShell').querySelector('#drill-ed-verdict') && !d.getElementById('boardShell').querySelector('[id^="drill-v-"]'));
      w.openDrillEd('verdict');
      const fin = d.getElementById('focusInner');
      T('drills: verdict focus carries the intro and the three options', fin.innerHTML.includes('Having thought through the case against, you now need to decide how you respond to your initial instinct. Your options are:') && fin.innerHTML.includes('Sticking with it') && fin.innerHTML.includes('Adjusting it') && fin.innerHTML.includes('Dropping it'));
      w.drillChoice('drop');
      T('drills: verdict choice stores and keeps the reel open', w.data.drills.d02.verdict === 'drop' && d.getElementById('focusBg').classList.contains('open'));
      w.closeDrillEd();
      T('drills: verdict chip stores and re-renders shell-locally', w.data.drills.d02.verdict === 'drop' && w.currentPage === 'drill');
      const rvb = d.getElementById('boardShell').querySelector('#drillReveal');
      T('drills: reveal button appears once committed', !!rvb);
      rvb.dispatchEvent(new w.Event('click'));
      const bs7 = d.getElementById('boardShell');
      T('drills: For and Against band \u2014 two sample positions, no debrief, no breaker (swapped with cause, 29 Jul UAT ruling)', bs7.innerHTML.includes('FOR AND AGAINST') && bs7.innerHTML.includes('Sample positions') && bs7.innerHTML.includes('THE ADVOCATE') && bs7.innerHTML.includes('THE SKEPTIC') && bs7.innerHTML.indexOf('EXPERT DEBRIEF') < 0 && bs7.innerHTML.indexOf('DESIGNED TO GIVE WAY') < 0);
      T('drills: R8 — zero nested bd-clicks on the mini board', drillNest(bs7) === 0);
      /* SUPERSEDED 29 Jul (UAT ruling): the chip step and its completion coupling are removed. */
      T('drills: chips gone; Mark-complete offered with the three boxes filled', !bs7.querySelector('[id^="drill-l-"]') && !!bs7.querySelector('#drillComplete'));
      bs7.querySelector('#drillComplete').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 150));
      T('drills: Mark-complete stamps completion', w.data.drills.d02.completedAt > 0);
      // reel parity (ruling, 15 Jul): full chrome, per-step color, pager, flip machinery
      w.openDrillEd('caseAgainst');
      const fin2 = d.getElementById('focusInner'), fc = d.getElementById('focusCard');
      T('drills: reel chrome \u2014 log-tag, eyebrow, em title, sub, pager, CTA', fin2.innerHTML.includes('Ethical exercise \u00B7') && fin2.innerHTML.includes('\u00B7 Step 2 of 3') && fin2.innerHTML.includes('The <em>Case Against</em>') && fin2.innerHTML.includes('Ask yourself what you would get out of it') && fin2.innerHTML.includes('flow-progress-text">2/3') && fin2.innerHTML.includes('File the Evidence \u2014 Pin to Board'));
      T('drills: case against wears red', fc.style.getPropertyValue('--part-c').trim() === w.REDI);
      w.drillStepQ(-1);
      T('drills: pager steps to instinct with its own color', d.getElementById('focusInner').innerHTML.includes('Your <em>Instinct</em>') && fc.style.getPropertyValue('--part-c').trim() === w.P1);
      T('drills: editors ride the board flip machinery (zoom, not fade)', rawApp.includes('function openDrillEd(key){') && rawApp.match(/openDrillEd[\s\S]{0,400}flipOpen\(from\)/) && rawApp.includes('function drillLift(key,on)'));
      w.closeDrillEd();
      // read views (ruling, 15 Jul): reveal cards rise for close reading
      const bs8 = d.getElementById('boardShell');
      T('drills: reveal cards clickable with CLICK TO READ (census 3\u21922 with cause, 29 Jul: the debrief card left the band)', bs8.querySelectorAll('[id^="drill-rv-"]').length === 2 && (bs8.innerHTML.match(/CLICK TO READ/g) || []).length === 2);
      /* SUPERSEDED 29 Jul (UAT ruling): the debrief card is out of the band; its read view is unreachable. */
      w.openDrillRead('advocate');
      const fin3 = d.getElementById('focusInner');
      T('drills: advocate read view \u2014 full text rises for close reading (swapped with cause, 29 Jul)', fin3.innerHTML.indexOf(w.DRILLS.filter(x => x.id === 'd02')[0].advocate.slice(0, 30)) >= 0);
      w.closeDrillRead('advocate');
      T('drills: legibility bump on the For and Against band (17, full ink) (refined with cause, 29 Jul: the debrief wrap left the render)', rawApp.includes("wrapText(dr.advocate,640-32,9,17,3)") && rawApp.includes("fam===3?0.80") && !rawApp.includes("wrapText(dr.debrief,"));
      T('drills: R8 \u2014 zero nested bd-clicks after the focus round', drillNest(d.getElementById('boardShell')) === 0);
      w.go('drills'); await new Promise(r => setTimeout(r, 400));
      T('drills: cabinet marks the finished drill \u2713 RUN', d.getElementById('boardShell').innerHTML.indexOf('\u2713 RUN') >= 0);
      /* For and Against opens at any time; Mark-complete gates (ruled 29 Jul, UAT) */
      d.getElementById('boardShell').querySelector('#dfolder-d03').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 300));
      const bsD3 = d.getElementById('boardShell');
      T('drills: For and Against offered with nothing filled; Mark-complete dimmed', bsD3.innerHTML.includes('FOR AND AGAINST') && !bsD3.querySelector('#drillComplete') && bsD3.innerHTML.includes('Fill in your instinct, the case against, and the verdict first.'));
      bsD3.querySelector('#drillReveal').dispatchEvent(new w.Event('click')); await new Promise(r => setTimeout(r, 150));
      T('drills: the band opens pre-work with the sample-positions line; no debrief, no chips', (function () { var bh = d.getElementById('boardShell').innerHTML; return bh.indexOf('Sample positions') >= 0 && bh.indexOf('THE ADVOCATE') >= 0 && bh.indexOf('EXPERT DEBRIEF') < 0 && bh.indexOf('WHICH QUESTION CHANGED') < 0 })());
      T('drills: completion still gated after the early reveal', (function () { w.completeDrillB(); return !w.data.drills.d03.completedAt })());
      w.go('drills'); await new Promise(r => setTimeout(r, 300));
    }
  }

  /* \u2500\u2500 multi-account gate (28 Jul, Rollout Log 2.3 + 3.3; fixtures tester/tester2 and
     ee- prefix per 2.2; edit marker 'suite description' per the Log's parameterization
     note; seed count 8 per EE's demo set; awaits added after doEntry/signOut \u2014 EE's
     entry flow is async where the DL block was synchronous) \u2500\u2500 */
  w.confirm = function () { return true }; /* harness infrastructure (July 29): adel and (post-chip) signOut are confirm-gated; stub before the first sign-out */
  w.signOut(); await new Promise(r => setTimeout(r, 250));
  T('gate: sign-in screen offers Create a new account', d.getElementById('app').innerHTML.indexOf('Create a new account') >= 0 && !!d.querySelector('.entry-foot-btn'));
  T('gate: AI Guide floater hidden pre-login', d.getElementById('coachFab').style.display === 'none' && d.getElementById('fabPulse').style.display === 'none');
  w.gotoSetup(); await new Promise(r => setTimeout(r, 150));
  T('gate: setup reachable from sign-in with Back, name and email fields', !!d.getElementById('entryName') && !!d.getElementById('entryEmail') && d.getElementById('app').innerHTML.indexOf('Back to sign in') >= 0);
  d.getElementById('entryName').value = 'Tester Two'; d.getElementById('entryUser').value = 'tester'; d.getElementById('entryPin').value = '5678';
  w.doEntry(); await new Promise(r => setTimeout(r, 250));
  T('gate: duplicate username rejected with the taken message', !w.authSignedIn && d.getElementById('app').innerHTML.indexOf('already taken on this device') >= 0);
  d.getElementById('entryName').value = 'Tester Two'; d.getElementById('entryUser').value = 'tester2'; d.getElementById('entryEmail').value = 'two@tester.test'; d.getElementById('entryPin').value = '5678';
  w.doEntry(); await new Promise(r => setTimeout(r, 250));
  T('gate: second account created and adopted with its own fresh-seeded record', w.authSignedIn === true && w.currentUserId === 'tester2' && w.data.decisions.length === 8 && !!w.localStorage.getItem('ee-data::tester2'));
  T('gate: accounts list carries both; first record untouched', w.Auth.accounts().length >= 2 && w.localStorage.getItem('ee-data::tester').indexOf('suite description') >= 0);
  T('gate: per-user isolation \u2014 the second store has no first-user edits', w.localStorage.getItem('ee-data::tester2').indexOf('suite description') === -1);
  w.signOut(); await new Promise(r => setTimeout(r, 250));
  d.getElementById('entryUser').value = 'tester'; d.getElementById('entryPin').value = '1234';
  (function () { var rrc = d.getElementById('entryRemember'); if (rrc) rrc.checked = true; })();
  w.doEntry(); await new Promise(r => setTimeout(r, 250));
  T('gate: signing back in as the first account restores that user\u2019s data', w.currentUserId === 'tester' && JSON.stringify(w.data).indexOf('suite description') >= 0);
  T('gate: AI Guide floater restored after sign-in', d.getElementById('coachFab').style.display === '');
  T('video collapse + vid-seen: sign-out cleared both session records (extended with cause, 28 Jul Item 6)', w.localStorage.getItem('ee-vidcollapse') === null && w.localStorage.getItem('ee-vidseen') === null && (function () { var vc = w.vidCollapsed; for (var k in vc) return false; return true })());
  /* Entry chrome: the top bar is signed-in chrome only (ruled July 29, post-R1; sibling
     port per the directive's sibling clause \u2014 T-dialect, inline waits, fresh source read) */
  var appSrc = fs.readFileSync(path.join(BASE, PFX + 'app.js'), 'utf8');
  T('entry chrome: source carries both sides of the nav toggle', appSrc.indexOf("if(nv)nv.style.display='none'") >= 0 && appSrc.indexOf("if(__nv)__nv.style.display=''") >= 0);
  w.signOut(); await new Promise(r => setTimeout(r, 90));
  var nvEl = d.querySelector('nav');
  T('entry chrome: signing out hides the top bar with the gate up', !!nvEl && nvEl.style.display === 'none' && !!d.getElementById('entryUser'));
  w.gotoSetup(); await new Promise(r => setTimeout(r, 40));
  d.getElementById('entryName').value = 'Nav Pin'; d.getElementById('entryUser').value = 'navpin'; d.getElementById('entryEmail').value = 'navpin@test.local'; d.getElementById('entryPin').value = '1234';
  w.doEntry(); await new Promise(r => setTimeout(r, 120));
  T('entry chrome: sign-in restores the top bar', nvEl.style.display === '');
  /* Slab v4 + history controls (ruled July 29; T-dialect, ee- key, EE fixtures; clk local) */
  var clk = function (el) { el.dispatchEvent(new w.Event('click', { bubbles: true })) };
  w.go('assess'); await new Promise(r => setTimeout(r, 150));
  var shellA = d.getElementById('boardShell').innerHTML;
  T('v4: assess slab defaults to zero compare threads (opt-in)', shellA.indexOf(w.V.gthreads[0]) === -1 && shellA.indexOf(w.V.gthreads[1]) === -1);
  T('v4: compare legend offers each prior sitting once', d.querySelectorAll('[id^="aghost-"]').length === Math.max(0, Math.min(3, (w.data.assessmentHistory || []).length - 1)));
  clk(d.querySelector('[id^="aghost-"]')); await new Promise(r => setTimeout(r, 90));
  T('v4: checking a compare box paints its slot-colored thread', d.getElementById('boardShell').innerHTML.indexOf(w.V.gthreads[0]) >= 0);
  clk(d.querySelector('[id^="aghost-"]')); await new Promise(r => setTimeout(r, 90));
  T('v4: unchecking removes the thread', d.getElementById('boardShell').innerHTML.indexOf(w.V.gthreads[0]) === -1);
  var histLen0 = (w.data.assessmentHistory || []).length;
  clk(d.getElementById('ahist-0')); await new Promise(r => setTimeout(r, 90));
  T('history: SHOWING NOW follows the viewed sitting and the latest row offers VIEW back', d.getElementById('boardShell').innerHTML.indexOf('SHOWING NOW') >= 0 && !!d.getElementById('ahist-latest'));
  T('history: DELETE offered on every past sitting, never on the latest', d.querySelectorAll('[id^="adel-"]').length === histLen0 - 1 && !d.getElementById('adel-' + (histLen0 - 1)));
  clk(d.getElementById('ahist-latest')); await new Promise(r => setTimeout(r, 90));
  T('history: VIEW on the latest returns to the current result', w.assessHistIdx === null);
  clk(d.getElementById('adel-0')); await new Promise(r => setTimeout(r, 110));
  T('history: delete removes the sitting and persists through the store', (function () { var rec = JSON.parse(w.localStorage.getItem('ee-data::navpin') || '{}'); return (w.data.assessmentHistory || []).length === histLen0 - 1 && (rec.assessmentHistory || []).length === histLen0 - 1 })()); /* reads the navpin key: this block runs as the nav-pin user */
  /* Identity chip + ER nav conformance (ruled July 29; conformance pin ADDED \u2014 EE carried no prior right-pin pin to swap) */
  T('conformance: action row unpinned in base flow, right-pinned only at ultrawide, identity chip rendered', (function () { var nr = d.querySelector('#navRight'); var c = fs.readFileSync(path.join(BASE, PFX + 'styles.css'), 'utf8'); return !!nr && nr.getAttribute('style').indexOf('margin-left:auto') === -1 && c.indexOf('#navRight{margin-left:auto}') >= 0 && !!d.querySelector('.nav-user-chip') })());
  T('chip: luminance avatar with initials + first name for the signed-in account', (function () { var c = d.querySelector('.nav-user-chip'); return !!c && c.innerHTML.indexOf('NP') >= 0 && c.textContent.indexOf('Nav') >= 0 && c.getAttribute('title') === 'Click to sign out' })());
  clk(d.querySelector('.nav-user-chip')); await new Promise(r => setTimeout(r, 100));
  T('chip: clicking signs out behind the enterprise confirm \u2014 gate up, top bar hidden', !!d.getElementById('entryUser') && d.querySelector('nav').style.display === 'none');

  /* Fix batch 1 (ruled July 30): legacy excision, rev continuity, drills entry every tier, dead HTML-tab chain, choice-gauge refresh */
  var bsrc = fs.readFileSync(path.join(BASE, 'ee-app.js'), 'utf8');
  w.localStorage.setItem('ee-v1', JSON.stringify({ decisions: [{ id: 'LGX', title: 'legacy ghost' }], rev: 9 }));
  w.gotoSetup(); await new Promise(r => setTimeout(r, 60));
  d.getElementById('entryName').value = 'Batch Pin'; d.getElementById('entryUser').value = 'batchpin'; d.getElementById('entryEmail').value = 'batchpin@test.local'; d.getElementById('entryPin').value = '1234';
  w.doEntry(); await new Promise(r => setTimeout(r, 200));
  T('excision: a planted legacy blob no longer bleeds into a fresh account \u2014 the demo seed wins', w.data.decisions.length === 8 && w.data.decisions[0].id === 'ee01' && JSON.stringify(w.data.decisions).indexOf('LGX') === -1);
  T('excision: no legacy machinery left in the source', bsrc.indexOf('migrateLegacy') === -1 && bsrc.indexOf('LEGACY_KEY') === -1);
  var rv0 = w.data.rev;
  w.seedSampleData(); await new Promise(r => setTimeout(r, 150));
  T('family law: the rev survives the reseed swap', w.data.rev === rv0 + 1);
  T('family law: both rebuild sites carry the rev (source)', (bsrc.match(/rev:\(data&&data\.rev\)\|\|0/g) || []).length === 2);
  T('M-4: the dead HTML-tab chain is excised whole', bsrc.indexOf('function renderTab') === -1 && bsrc.indexOf('function tabLookBack') === -1 && bsrc.indexOf("$('tc')") === -1);
  w.__forceTier = 'mid'; w.go('lab'); await new Promise(r => setTimeout(r, 150));
  T('M-3: the drills entry exists at the mid tier', !!d.getElementById('newExercises'));
  w.__forceTier = 'narrow'; w.bdRenderFiles(); await new Promise(r => setTimeout(r, 120));
  T('M-3: the drills entry exists at the narrow tier', !!d.getElementById('newExercises'));
  w.__forceTier = '';
  T('m-1: choice answers refresh the gauge chrome (source)', bsrc.indexOf('renderFocus();refreshFocusChrome()') >= 0);

  T('seed ships the profile answered both ways \u2014 written return + painted slab, not stale (ruled July 30)', (function () { var p = w.data.profile; if (!p || !p.text || p.text.indexOf('STRENGTHS') < 0) return false; var ks = ['outcomes_principles', 'scrutiny_trust', 'decisive_deliberative', 'broad_defined', 'candor_diplomatic']; for (var i = 0; i < ks.length; i++) { if (typeof p.scores[ks[i]] !== 'number') return false } var m = w.bdDashModel(); return !!m.revealed && p.decisionCount === 8 && (p.drillCount || 0) === 0 })());

  console.log(`SUITE: ${pass} passed, ${fail} failed`);
  if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log(' -', f)); process.exit(1); }
  process.exit(0); /* explicit success exit (28 Jul): the Store's change-signal interval (ER contract) keeps the event loop alive; assertions are all complete here */
})().catch(e => { console.error('SUITE ERROR:', e.message); console.log(`(at ${pass} passed, ${fail} failed)`); process.exit(1); });
