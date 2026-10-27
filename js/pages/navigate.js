/* ============================================================
   pages/navigate.js - Navigate dashboard + Management/Capital hubs
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   The Phase 5 "Navigate" operating dashboard (renderNavDash /
   renderPhase5), the Module Management hub (renderMgmtHub /
   mgmtHubContent / printMgmtAnalytics), and the Capital Planning hub
   (renderCapHub). Routed to from render() in app.js. Rely on app.js/
   lib globals: data, PH, getStages, charts (js/features/charts.js),
   budget engine (js/features/budget.js), card, btn, esc, printPage, UI.
   ============================================================ */

// === PHASE 5: NAVIGATE DASHBOARD ===
function parseBudget(v) { if (typeof v !== 'string') return 0; var m = v.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([kKmM])?/); if (!m) return 0; var n = parseFloat(m[1]); if (m[2] === 'k' || m[2] === 'K') n *= 1000; if (m[2] === 'm' || m[2] === 'M') n *= 1000000; return n }
function fmtMoney(n){if(!n)return'$0';if(n<0)return'\u2212'+fmtMoney(-n); /* 17 Sep 2026 (found on the sandbox printout): a negative amount reads as a minus and the formatted figure, not the raw number */
return n>=1000000?'$'+(n/1000000).toFixed(n%1000000?1:0)+'M':n>=1000?'$'+Math.round(n/1000)+'K':'$'+Math.round(n)}
function saveCapFields() { if (!data.capital) data.capital = {};['budgeted', 'reallocation', 'gapPlan'].forEach(function (f) { var e = $('cap_' + f); if (e) data.capital[f] = e.value }); Store.commit('capital'); render() }
/* Capital Analytics (chunk 4): the projection's face. Three derived views – stacked
   category bars per year against the envelope, the sustainment crowding-out share, and
   Faisal's phase-timeline strips (per-project month ranges; display only). */
function orgYearTotals(extras) {
  var srs = orgMonthly(extras); if (!srs) return null; var cap = data.capital || {}; var n = envYearsOf(), out = [];
  for (var y = 1; y <= n; y++) {
    var scpY = susCapOf(y); var dev = 0, roll = 0, sus = 0; for (var m = (y - 1) * 12; m < y * 12; m++) { dev += srs[m].dev; roll += srs[m].roll; sus += srs[m].sus }
    dev = Math.round(dev); roll = Math.round(roll); sus = Math.round(sus); var tot = dev + roll + sus; var bud = envBudgetYear(y); var res = envReserveYear(y);
    out.push({ y: y, budget: bud, budgetSet: (y === 1 ? !!String(cap.aiBudget || '').trim() : !!String(cap['budgetY' + y] || '').trim()), dev: dev, roll: roll, sus: sus, total: tot, headroom: bud - tot, reserve: res, susShare: tot ? sus / tot : 0, scpY: scpY, capPct: (scpY > 0 && bud) ? sus / (bud * scpY / 100) : 0 })
  }
  return out
}
function orgWaterfallChart(extras) {
  var srs = orgMonthly(extras); if (!srs) return ''; var M = srs.length; var CD = '#45A188', CR = '#5B8DD9', CS = '#C25B73';
  var hasX = !!(extras && extras.length); var baseS = hasX ? orgMonthly() : srs;
  var XPAL = ['#D4A017', '#8A63B8', '#2E9C7C', '#C87A3B', '#7FA8D9', '#B84A6E'];
  var _goAll = hasX ? getStages().explore.filter(function (q) { return ((data.projects || {})[q] || {}).viable === true }) : [];
  var xs = hasX ? extras.map(function (e) { var _r = _goAll.indexOf(e.i); return { i: e.i, c: XPAL[(_r >= 0 ? _r : e.i) % XPAL.length], ser: orgProjectMonthly(e.i, false, M, e.anchor) } }) : [];
  var mx = 0; srs.forEach(function (r) { mx = Math.max(mx, r.dev + r.roll + r.sus, capSusCapLine(r.m)) }); if (!mx) return '<p class="t-faint-sm">Nothing committed yet \u2013 the first batch draws the first bars.</p>';
  var W = 720, Hh = 190, pad = 28, bw = (W - pad * 2) / M, base = Hh - 24; var sy = function (v) { return (Hh - 52) * (v / mx) };
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  srs.forEach(function (r, ix) {
    var b = hasX ? baseS[ix] : r; var x = pad + ix * bw + bw * .15, w = Math.max(1, bw * .7); var yD = sy(b.dev), yR = sy(b.roll), yS = sy(b.sus); var yy = base;
    if (b.sus > 0) { yy -= yS; h += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + yS.toFixed(1) + '" fill="' + CS + '"><title>Month ' + r.m + ' sustainment ' + fmtMoney(Math.round(b.sus)) + '</title></rect>' }
    if (b.roll > 0) { yy -= yR; h += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + yR.toFixed(1) + '" fill="' + CR + '"><title>Month ' + r.m + ' rollout ' + fmtMoney(Math.round(b.roll)) + '</title></rect>' }
    if (b.dev > 0) { yy -= yD; h += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + yD.toFixed(1) + '" fill="' + CD + '"><title>Month ' + r.m + ' development ' + fmtMoney(Math.round(b.dev)) + '</title></rect>' }
    if (hasX) { xs.forEach(function (cx) { var sr = cx.ser[ix]; var t9 = sr.dev + sr.roll + sr.sus; if (t9 > 0) { var yT = sy(t9); yy -= yT; h += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, yT).toFixed(1) + '" fill="' + cx.c + '" opacity=".85"><title>' + esc(((data.ideas || [])[cx.i] || {}).name || ('Item ' + cx.i)) + ' \u2013 ' + fmtMoney(Math.round(t9)) + ' this month (batch)</title></rect>' } }) }
  });
  var capCapPts = '';
  for (var m = 1; m <= M; m++) {
    var x1 = pad + (m - 1) * bw, x2 = pad + m * bw;
    var sc = capSusCapLine(m); if (sc > 0) { var cy2 = base - sy(sc); capCapPts += (capCapPts === '' ? 'M' : 'L') + x1.toFixed(1) + ' ' + cy2.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + cy2.toFixed(1) }
  }
  if (capCapPts) h += '<path d="' + capCapPts + '" fill="none" stroke="#D4A017" stroke-width="1.5" stroke-dasharray="4,3" opacity=".8"><title>Sustainment cap</title></path>';
  for (var t = 6; t <= M; t += 6)h += '<text x="' + (pad + (t - .5) * bw).toFixed(1) + '" y="' + (Hh - 10) + '" text-anchor="middle" font-size="9" fill="#8A8278">' + t + '</text>';
  h += '</svg>';
  h += '<div class="t-faint-sm" style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:' + CD + ';border-radius:2px;margin-right:4px"></span>Development <span style="display:inline-block;width:10px;height:10px;background:' + CR + ';border-radius:2px;margin:0 4px 0 12px"></span>Rollout <span style="display:inline-block;width:10px;height:10px;background:' + CS + ';border-radius:2px;margin:0 4px 0 12px"></span>Sustainment' + (capSusCapLine(1) > 0 ? '<br/><span style="display:inline-block;width:18px;border-top:2px dashed var(--warn-text);margin:0 4px 0 2px;vertical-align:middle"></span> The dashed line is the sustainment cap \u2013 the run-cost ceiling for the year, at its monthly rate' : '') + (hasX ? '<br/>Batch: ' + xs.map(function (cx) { return '<span style="display:inline-block;width:10px;height:10px;background:' + cx.c + ';border-radius:2px;margin:0 4px 0 10px"></span>' + esc(((data.ideas || [])[cx.i] || {}).name || ('Item ' + cx.i)) }).join('') : '') + '</div>';
  return h
}
function orgCumChart(extras) {
  var srs = orgMonthly(extras); if (!srs) return ''; var M = srs.length;
  var srsCt = orgMonthly(extras, true);
  var cum = 0, cumCap = 0, cumCt = 0, pts = [], cpts = [], ctpts = [], mx = 0;
  for (var m = 1; m <= M; m++) { cum += srs[m - 1].dev + srs[m - 1].roll + srs[m - 1].sus; cumCt += srsCt[m - 1].dev + srsCt[m - 1].roll + srsCt[m - 1].sus; cumCap += capMonthlyLine(m); pts.push(cum); ctpts.push(cumCt); cpts.push(cumCap); mx = Math.max(mx, cum, cumCt, cumCap) }
  if (!mx) return '';
  var _brAll = capBreaches(extras); var br = _brAll.overCapMonth, ctBr = _brAll.ctOverCapMonth; var ctAny = cumCt > cum + 0.5;
  var W = 720, Hh = 180, pad = 28, bw = (W - pad * 2) / M, base = Hh - 24; var sy = function (v) { return base - (Hh - 50) * (v / mx) };
  var area = 'M' + pad + ' ' + base, line = '';
  for (var m2 = 1; m2 <= M; m2++) { var x = pad + (m2 - .5) * bw; area += 'L' + x.toFixed(1) + ' ' + sy(pts[m2 - 1]).toFixed(1); line += (m2 === 1 ? 'M' : 'L') + x.toFixed(1) + ' ' + sy(cpts[m2 - 1]).toFixed(1) }
  area += 'L' + (pad + (M - .5) * bw).toFixed(1) + ' ' + base + 'Z';
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  h += '<path d="' + area + '" fill="rgba(69,161,136,.28)" stroke="#45A188" stroke-width="1.5"><title>Cumulative committed</title></path>';
  h += '<path d="' + line + '" fill="none" stroke="#F5F2EC" stroke-width="1.5" opacity=".8" stroke-dasharray="2,3"><title>Cumulative capacity</title></path>';
  if (ctAny) {
    var ctline = ''; for (var m4 = 1; m4 <= M; m4++) { var x4 = pad + (m4 - .5) * bw; ctline += (m4 === 1 ? 'M' : 'L') + x4.toFixed(1) + ' ' + sy(ctpts[m4 - 1]).toFixed(1) }
    h += '<path d="' + ctline + '" fill="none" stroke="#E8D48B" stroke-width="1.5" stroke-dasharray="4,3" opacity=".85"><title>Cumulative committed with each project\u2019s stated contingency</title></path>';
    if (ctBr && ctBr !== br) { var cbx = pad + (ctBr - .5) * bw, cby = sy(ctpts[ctBr - 1]); var cblx = Math.max(pad + 78, Math.min(W - 78, cbx)), cbly = Math.min(base - 4, cby + 16); h += '<circle cx="' + cbx.toFixed(1) + '" cy="' + cby.toFixed(1) + '" r="4" fill="#E8D48B"/><text x="' + cblx.toFixed(1) + '" y="' + cbly.toFixed(1) + '" text-anchor="middle" font-size="10" fill="#E8D48B">with contingencies \u2013 month ' + ctBr + '</text>' }
  }
  if (br) { var bx = pad + (br - .5) * bw, by = sy(pts[br - 1]); var blx = Math.max(pad + 70, Math.min(W - 70, bx)), bly = Math.max(12, by - 8); h += '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="4" fill="' + '#D4A017' + '"/><text x="' + blx.toFixed(1) + '" y="' + bly.toFixed(1) + '" text-anchor="middle" font-size="10" fill="#D4A017">crosses capacity \u2013 month ' + br + '</text>' }
  for (var t = 6; t <= M; t += 6)h += '<text x="' + (pad + (t - .5) * bw).toFixed(1) + '" y="' + (Hh - 8) + '" text-anchor="middle" font-size="9" fill="#8A8278">' + t + '</text>';
  h += '</svg>';
  h += '<div class="t-faint-sm" style="margin-top:6px">Cumulative committed against cumulative capacity.' + (ctAny ? ' The pale dashed curve adds each project\u2019s stated contingency.' : '') + '</div>';
  return h
}
function orgSwimlanes(extras) {
  if (!orgMonthly()) return ''; var M = envYearsOf() * 12; var ideas = data.ideas || [];
  var set = orgCommittedSet().filter(function (e) { return !e.sunk }).map(function (e) { return { i: e.i, op: e.op, hyp: false } }); (extras || []).forEach(function (e) { set.push({ i: e.i, op: false, hyp: true, anchor: e.anchor }) });
  if (!set.length) return '';
  var lanes = []; set.forEach(function (e) {
    var s2 = orgProjectMonthly(e.i, e.op, M, e.hyp ? e.anchor : null); var segs = [];['dev', 'roll', 'sus'].forEach(function (k) { var st = 0; for (var m = 1; m <= M + 1; m++) { var on = m <= M && s2[m - 1][k] > 0.5; if (on && !st) st = m; if (!on && st) { segs.push({ k: k, a: st, b: m - 1 }); st = 0 } } }); if (segs.length) {
      var _rE = 0, _sA = 0; segs.forEach(function (g) { if (g.k === 'roll') _rE = Math.max(_rE, g.b); if (g.k === 'sus') _sA = _sA ? Math.min(_sA, g.a) : g.a });
      var _br = (_rE && _sA && _sA > _rE + 1) ? { a: _rE + 1, b: _sA - 1 } : null;
      lanes.push({ i: e.i, name: (ideas[e.i] || {}).name || ('Item ' + e.i), hyp: e.hyp, legacy: !!((((data.projects || {})[e.i]) || {}).legacy), segs: segs, br: _br })
    }
  });
  if (!lanes.length) return '<p class="t-faint-sm">Nothing committed yet.</p>';
  var shown = lanes.slice(0, 10);
  var W = 720, LH = 26, pad = 150, Hh = shown.length * LH + 30, cw = (W - pad - 16) / M;
  var C = { dev: '#45A188', roll: '#5B8DD9', sus: '#C25B73' };
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  shown.forEach(function (L, ix) {
    var y = 4 + ix * LH;
    h += '<text x="' + (pad - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="10" fill="#B8B0A4">' + esc(L.name.length > 22 ? L.name.slice(0, 21) + '\u2026' : L.name) + (L.legacy ? ' \u25c6' : '') + '</text>';
    h += '<line x1="' + pad + '" y1="' + (y + 9) + '" x2="' + (W - 16) + '" y2="' + (y + 9) + '" stroke="rgba(245,242,236,.06)"/>';
    L.segs.forEach(function (sg) {
      var x = pad + (sg.a - 1) * cw, w = Math.max(2, (sg.b - sg.a + 1) * cw);
      h += '<rect x="' + x.toFixed(1) + '" y="' + (y + 2) + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' + C[sg.k] + '"' + (L.hyp ? ' opacity=".45" stroke="' + C[sg.k] + '" stroke-dasharray="3,2"' : '') + '><title>' + esc(L.name) + ' \u00b7 ' + (sg.k === 'dev' ? 'development' : sg.k === 'roll' ? 'rollout' : 'sustainment') + ' \u00b7 Months ' + sg.a + '\u2013' + sg.b + (L.hyp ? ' (assumed)' : '') + '</title></rect>'
    });
    if (L.br) {
      var bx = pad + (L.br.a - 1) * cw, bw2 = Math.max(2, (L.br.b - L.br.a + 1) * cw);
      h += '<rect x="' + bx.toFixed(1) + '" y="' + (y + 7) + '" width="' + bw2.toFixed(1) + '" height="4" rx="2" fill="rgba(245,242,236,.18)"' + (L.hyp ? ' opacity=".5"' : '') + '><title>' + esc(L.name) + ' \u00b7 Months ' + L.br.a + '\u2013' + L.br.b + ' \u00b7 nothing charted between the end of rollout and the start of sustainment</title></rect>'
    }
  });
  for (var t = 6; t <= M; t += 6)h += '<text x="' + (pad + (t - .5) * cw).toFixed(1) + '" y="' + (Hh - 6) + '" text-anchor="middle" font-size="9" fill="#8A8278">' + t + '</text>';
  h += '</svg>';
  if (lanes.length > shown.length) h += '<div class="t-faint-sm" style="margin-top:4px">+' + (lanes.length - shown.length) + ' more committed items not shown</div>';
  h += '<div class="t-faint-sm" style="margin-top:6px">One lane per committed item, placed at its anchor \u00b7 <span style="color:#45A188">\u25a0</span> development <span style="color:#5B8DD9">\u25a0</span> rollout <span style="color:#C25B73">\u25a0</span> sustainment \u00b7 \u25c6 legacy' + (shown.some(function (L2) { return L2.br }) ? ' \u00b7 thin bar = a gap the plan leaves between rollout and sustainment' : '') + ((extras || []).length ? ' \u00b7 dashed = the ticked batch at its assumed start' : '') + '</div>';
  return h
}
function orgCategoryDonut() {
  var srs = orgMonthly(); if (!srs) return ''; var dev = 0, roll = 0, sus = 0; var _rg = capYearRange(srs.length);
  srs.forEach(function (m, ix) { if (ix < _rg[0] || ix >= _rg[1]) return; dev += m.dev; roll += m.roll; sus += m.sus });
  var tot = dev + roll + sus; if (!(tot > 0.5)) return '<p class="t-faint-sm">Nothing committed yet.</p>';
  var parts = [{ name: 'Development', t: dev, c: '#45A188' }, { name: 'Rollout', t: roll, c: '#5B8DD9' }, { name: 'Sustainment', t: sus, c: '#C25B73' }].filter(function (x) { return x.t > 0.5 });
  var cx = 90, cy = 90, r = 70, ri = 44; var h = '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 180 180" style="width:170px;height:170px;flex-shrink:0">';
  if (parts.length === 1) { h += '<circle cx="90" cy="90" r="57" fill="none" stroke="' + parts[0].c + '" stroke-width="26"><title>' + parts[0].name + ' ' + fmtMoney(Math.round(tot)) + '</title></circle>' }
  else {
    var a0 = -Math.PI / 2; parts.forEach(function (x) {
      var frac = x.t / tot; var a1 = a0 + frac * 2 * Math.PI; var large = frac > .5 ? 1 : 0;
      var p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], q1 = [cx + ri * Math.cos(a1), cy + ri * Math.sin(a1)], q0 = [cx + ri * Math.cos(a0), cy + ri * Math.sin(a0)];
      h += '<path d="M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'L' + q1[0].toFixed(1) + ' ' + q1[1].toFixed(1) + 'A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + q0[0].toFixed(1) + ' ' + q0[1].toFixed(1) + 'Z" fill="' + x.c + '"><title>' + x.name + ' ' + fmtMoney(Math.round(x.t)) + '</title></path>'; a0 = a1
    })
  }
  h += '<text x="90" y="86" text-anchor="middle" font-size="14" font-weight="700" fill="#F5F2EC">' + fmtMoney(Math.round(tot)) + '</text><text x="90" y="102" text-anchor="middle" font-size="9" fill="#8A8278">' + (UI.capYear && UI.capYear !== 'T' ? 'Year ' + UI.capYear : 'all years combined') + '</text></svg><div style="flex:1;min-width:170px">';
  parts.forEach(function (x) { h += '<div class="row-line" style="padding:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + x.c + ';margin-right:6px"></span><span class="fs-13" style="flex:1">' + x.name + '</span><span class="t-faint-sm">' + fmtMoney(Math.round(x.t)) + ' \u00b7 ' + Math.round(x.t / tot * 100) + '%</span></div>' });
  return h + '</div></div>'
}
function capYearRange(M) { var sel = UI.capYear; if (sel == null || sel === 'T' || !(sel >= 1 && sel <= envYearsOf())) return [0, M]; return [Math.min(M, (sel - 1) * 12), Math.min(M, sel * 12)] }
function orgCompositionDonut() {
  var srs = orgMonthly(); if (!srs) return ''; var M = srs.length; var ideas = data.ideas || []; var _rg = capYearRange(M);
  var per = []; orgCommittedSet().forEach(function (e) { var s2 = orgProjectMonthly(e.i, e.op, M, null, e.sunk); var t = 0; for (var m = _rg[0]; m < _rg[1]; m++)t += s2[m].dev + s2[m].roll + s2[m].sus; if (t > 0.5) per.push({ i: e.i, name: (ideas[e.i] || {}).name || ('Item ' + e.i), t: t }) });
  if (!per.length) return '<p class="t-faint-sm">Nothing committed yet.</p>';
  per.sort(function (a, b) { return b.t - a.t });
  var top = per.slice(0, 6); var rest = per.slice(6).reduce(function (a, x) { return a + x.t }, 0); if (rest) top.push({ name: 'Other (' + (per.length - 6) + ')', t: rest });
  var tot = per.reduce(function (a, x) { return a + x.t }, 0);
  var PAL = ['#45A188', '#5B8DD9', '#C25B73', '#D4A017', '#7FB069', '#9C6BB3', '#8A8278'];
  var cx = 90, cy = 90, r = 70, ri = 44; var h = '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 180 180" style="width:170px;height:170px;flex-shrink:0">';
  if (top.length === 1) { h += '<circle cx="90" cy="90" r="57" fill="none" stroke="' + PAL[0] + '" stroke-width="26"><title>' + esc(top[0].name) + ' ' + fmtMoney(Math.round(tot)) + '</title></circle>' }
  else {
    var a0 = -Math.PI / 2; top.forEach(function (x, ix) {
      var frac = x.t / tot; var a1 = a0 + frac * 2 * Math.PI; var large = frac > .5 ? 1 : 0;
      var p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], q1 = [cx + ri * Math.cos(a1), cy + ri * Math.sin(a1)], q0 = [cx + ri * Math.cos(a0), cy + ri * Math.sin(a0)];
      h += '<path d="M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'L' + q1[0].toFixed(1) + ' ' + q1[1].toFixed(1) + 'A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + q0[0].toFixed(1) + ' ' + q0[1].toFixed(1) + 'Z" fill="' + PAL[ix % PAL.length] + '"><title>' + esc(x.name) + ' ' + fmtMoney(Math.round(x.t)) + '</title></path>'; a0 = a1
    })
  }
  h += '<text x="90" y="86" text-anchor="middle" font-size="14" font-weight="700" fill="#F5F2EC">' + fmtMoney(Math.round(tot)) + '</text><text x="90" y="102" text-anchor="middle" font-size="9" fill="#8A8278">' + (UI.capYear && UI.capYear !== 'T' ? 'Year ' + UI.capYear : 'all years combined') + '</text></svg><div style="flex:1;min-width:170px">';
  top.forEach(function (x, ix) { h += '<div class="row-line" style="padding:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + PAL[ix % PAL.length] + ';margin-right:6px"></span><span class="fs-13" style="flex:1">' + esc(x.name) + '</span><span class="t-faint-sm">' + fmtMoney(Math.round(x.t)) + ' \u00b7 ' + Math.round(x.t / tot * 100) + '%</span></div>' });
  h += '</div></div>'; return h
}
function orgPlateauBars() {
  var yt = orgYearTotals(); if (!yt) return '';
  var h = ''; yt.forEach(function (r) {
    if (!(r.budget > 0)) return; var pct = Math.round(r.sus / r.budget * 100); var over = r.capPct > 1;
    var lbl = (r.sus > 0 && pct < 1) ? '&lt;1' : String(pct); var wp = r.sus > 0 ? Math.max(pct, 1) : 0;
    h += '<div style="margin-bottom:8px"><div class="flx-center" style="justify-content:space-between"><span class="fs-13">Year ' + r.y + '</span><span class="t-faint-sm">' + lbl + '% of budget' + (over ? ' <span style="color:var(--warn-text)">\u26a0 over cap</span>' : '') + '</span></div>';
    h += '<div style="position:relative;height:10px;background:rgba(var(--fg-rgb),.06);border-radius:5px"><div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.min(100, wp) + '%;background:#C25B73;border-radius:5px"></div>' + (r.scpY > 0 ? '<div title="Sustainment cap ' + r.scpY + '%" style="position:absolute;left:' + Math.min(100, r.scpY) + '%;top:-3px;bottom:-3px;width:2px;background:#D4A017"></div>' : '') + '</div></div>'
  });
  return h
}
function orgQuarterStrip() {
  var srs = orgMonthly(); if (!srs) return ''; var pm = progMonthOf(new Date()); if (pm == null) return '';
  var M = srs.length; var qStart = Math.floor((Math.max(1, pm) - 1) / 3) * 3 + 1; var out = []; var mx = 0;
  for (var q = 0; q < 4; q++) {
    var a = qStart + q * 3; if (a > M) break; var b = Math.min(a + 2, M); var t = 0; for (var m = a; m <= b; m++)t += srs[m - 1].dev + srs[m - 1].roll + srs[m - 1].sus;
    var y = Math.ceil(a / 12); var slice = envBudgetYear(y) / 4; out.push({ a: a, b: b, t: t, slice: slice }); mx = Math.max(mx, t, slice)
  }
  if (!out.length || !mx) return '';
  var h = '<div style="display:flex;gap:10px;align-items:flex-end;height:150px">';
  out.forEach(function (o) {
    var hb = Math.max(3, 118 * o.t / mx), hs = Math.max(2, 118 * o.slice / mx); var over = o.t > o.slice;
    h += '<div style="flex:1;position:relative;height:100%"><div style="position:absolute;bottom:' + (18 + hs) + 'px;left:8%;right:8%;height:2px;background:rgba(var(--fg-rgb),.55)"><title>One quarter of the year\u2019s budget</title></div><div style="position:absolute;bottom:18px;left:15%;right:15%;height:' + hb + 'px;background:' + (over ? '#D4A017' : '#45A188') + ';border-radius:4px 4px 0 0" title="' + fmtMoney(Math.round(o.t)) + ' committed \u00b7 slice ' + fmtMoney(Math.round(o.slice)) + '"></div><div class="t-faint-sm" style="position:absolute;bottom:0;left:0;right:0;text-align:center">m' + o.a + '\u2013' + o.b + '</div></div>'
  });
  h += '</div><p class="t-faint-sm" style="margin:6px 0 0">Committed costs in each of the next four program quarters. The grey line marks one quarter of the year\u2019s budget \u2013 an even-spread reference, not a limit. A bar turns amber when its quarter runs above that line.</p>';
  return h
}
function capKpiStrip(){var K=capKpiData(UI.capYear);if(!K)return''; /* 13 Sep 2026: the figures come from capKpiData, shared with the Capital Snapshot report */
var arc=function(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(245,242,236,.08)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#F5F2EC">'+Math.round(f*100)+'%</text></svg>'};
var tile=function(inner,label,sub){return'<div style="flex:1;min-width:150px;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:10px;background:rgba(var(--fg-rgb),.02)">'+inner+'<div style="min-width:0"><div class="fs-13" style="font-weight:600">'+label+'</div><div class="t-faint-sm">'+sub+'</div></div></div>'};
var h='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">';
h+=tile(arc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub);
h+=tile('<div class="score-num-md" style="color:'+(K.t2.neg?'#C25B73':'var(--ph1-t)')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub);
h+=tile(arc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub);
return h+'</div>'}
function renderCapAnalytics() {
  var srs = orgMonthly(); var h = '';
  if (!srs) return card('<h3 class="h-sub-md">Organizational Charts</h3><p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to place commitments on the program calendar.</p>', 'margin-bottom:16px');
  h += capKpiStrip();
  h += card('<h3 class="h-sub-md">The Committed Calendar</h3>' + orgSwimlanes(), 'margin-bottom:16px');
  h += '<div class="gr-2" style="align-items:start">' + zoomCard('wf', 'Capacity Waterfall', 'Each month\u2019s committed costs, stacked by category: Development, Rollout, Sustainment.', orgWaterfallChart()) + zoomCard('cum', 'Cumulative vs Capacity', 'Committed costs added up month by month, against the budget added up the same way. Where the committed line crosses the budget line, more has been promised than the envelope holds by that month.', orgCumChart()) + '</div>';
  h += '<div class="gr-2" style="align-items:start">' + zoomCard('donut', 'Committed Costs by Project', 'Each project\u2019s share of committed costs ' + (UI.capYear && UI.capYear !== 'T' ? 'in Year ' + UI.capYear + ' \u2013 switch years on the tabs above.' : 'across the full financial horizon \u2013 every modeled year combined.'), orgCompositionDonut(), '58px') + zoomCard('cat', 'Committed Costs by Category', 'Committed costs ' + (UI.capYear && UI.capYear !== 'T' ? 'in Year ' + UI.capYear : 'across the full financial horizon') + ' \u2013 split into Development, Rollout, and Sustainment.', orgCategoryDonut(), '58px') + '</div>';
  h += zoomCard('plateau', 'Sustainment Load by Year', 'Ongoing Sustainment costs build up as projects launch and keep running. Each bar is one year\u2019s Sustainment as a share of that year\u2019s budget; the tick marks the cap set at Plan Capacity (Step 3.2).', orgPlateauBars());
  var yt = orgYearTotals(); var scp = parseFloat((data.capital || {}).susCap);
  var c3 = '<h3 class="h-sub-md">Overviews by Year</h3>';
  c3 += '<div style="display:grid;grid-template-columns:64px repeat(5,1fr);gap:3px 14px;align-items:baseline">';
  c3 += ['YEAR', 'BUDGET', 'COMMITTED', 'HEADROOM*', 'INTAKE RESERVE', 'NET OF RESERVE'].map(function (hd) { return '<div class="t-faint-sm" style="font-size:10px;letter-spacing:.06em">' + hd + '</div>' }).join('');
  yt.forEach(function (r) {
    var spare = r.headroom - (r.reserve || 0);
    c3 += '<div class="fs-14"><strong>Year ' + r.y + '</strong></div>';
    c3 += '<div class="fs-14">' + (r.budgetSet ? (fmtMoney(r.budget) + (fundAddsYear(r.y) ? '<span class="t-faint-sm"> (incl. ' + fmtMoney(fundAddsYear(r.y)) + ' auth.)</span>' : '')) : '<span class="t-faint-sm">not set</span>') + '</div>';
    c3 += '<div class="fs-14">' + fmtMoney(r.total) + '</div>';
    c3 += '<div class="fs-14" style="color:' + (r.headroom < 0 ? '#C25B73' : 'var(--ph1-t)') + '">' + (r.budgetSet ? fmtMoney(r.headroom) : '\u2014') + '</div>';
    c3 += '<div class="fs-14">' + (r.reserve ? fmtMoney(r.reserve) : '\u2014') + '</div>';
    c3 += '<div class="fs-14">' + (r.reserve && r.budgetSet ? fmtMoney(spare) : '\u2014') + '</div>';
    c3 += '<div class="t-faint-sm" style="grid-column:1/-1;margin:-2px 0 8px">Committed = Development ' + fmtMoney(r.dev) + ' + Rollout ' + fmtMoney(r.roll) + ' + Sustainment ' + fmtMoney(r.sus) + (r.scpY > 0 && r.budgetSet && r.budget > 0 ? '. Sustainment takes ' + ((r.sus > 0 && Math.round(r.sus / r.budget * 100) < 1) ? '&lt;1' : Math.round(r.sus / r.budget * 100)) + '% of the year\u2019s budget \u2013 cap ' + r.scpY + '%' + (r.capPct > 1 ? ' <span style="color:var(--warn-text)">\u26a0 over the cap</span>' : '') + '.' : '') + '</div>'
  });
  c3 += '</div>';
  c3 += '<p class="t-faint-sm" style="margin-top:4px">*Headroom is the available budget that can still be assigned to new projects.</p>';
  h += card(c3, 'margin-bottom:16px');
  var br = capBreaches(); var flags = '';
  if (br.overCapMonth) flags += '<p class="fs-13" style="margin:0 0 6px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month ' + br.overCapMonth + '.</p>';
  if (br.ctOverCapMonth && br.ctOverCapMonth !== br.overCapMonth) flags += '<p class="fs-13" style="margin:0 0 6px;color:var(--warn-pale)">\u26a0 With stated contingencies, cumulative commitments would cross capacity in Month ' + br.ctOverCapMonth + '.</p>';
  br.capYears.forEach(function (y) { flags += '<p class="fs-13" style="margin:0 0 6px;color:var(--warn-text)">\u26a0 Year ' + y + ' sustainment exceeds the ' + (data.capital || {}).susCap + '% cap.</p>' });
  if (flags) h += card('<h3 class="h-sub-md">Flags</h3>' + flags, 'margin-bottom:16px');
  return h
}
function zoomCard(key, title, capt, body, capMinH) { return card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">' + title + '</h3><button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=\'' + key + '\';render()" title="Enlarge">\u2922</button></div>' + (capt ? '<p class="t-faint-sm" style="margin:4px 0 10px' + (capMinH ? ';min-height:' + capMinH : '') + '">' + capt + '</p>' : '') + body, 'margin-bottom:16px') }
function zoomBtn(key) { return '<button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=\'' + key + '\';render()" title="Enlarge" style="font-size:12px">\u2922</button>' }
function acStagedExtras() {
  var proj = data.projects || {}; var goP = getStages().explore.filter(function (i) { return (proj[i] || {}).viable === true });
  var sel = goP.filter(function (i) { return (UI.capSim || {})[i] });
  var pmNow = progMonthOf(new Date()); var aAss = Math.max(1, (pmNow == null ? 0 : pmNow) + 1);
  return sel.map(function (i) { var sd = (proj[i] || {}).startDate; var a2 = sd ? progMonthOf(sd) : null; return { i: i, anchor: (a2 != null && a2 >= 1) ? a2 : aAss } })
}
function chartZoomOverlay() {
  var z = UI.chartZoom; if (!z) return '';
  var reg = { wf: ['Capacity Waterfall', orgWaterfallChart], cum: ['Cumulative vs Capacity', orgCumChart], donut: ['Committed Costs by Project', orgCompositionDonut], cat: ['Committed Costs by Category', orgCategoryDonut], plateau: ['Sustainment Load by Year', orgPlateauBars] };
  var e = reg[z];
  if (!e) {
    var _sfx = acStagedExtras().length ? ' \u2013 staged batch included' : '';
    if (z === 'ac_wf') e = ['Capacity Waterfall' + _sfx, function () { return orgWaterfallChart(acStagedExtras()) }];
    else if (z === 'ac_cum') e = ['Cumulative vs Capacity' + _sfx, function () { var ex = acStagedExtras(); var b = capBreaches(ex); return (b.overCapMonth ? '<p class="fs-13" style="margin:0 0 8px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month ' + b.overCapMonth + '.</p>' : '<p class="t-faint-sm" style="margin:0 0 8px">Cumulative commitments stay under cumulative capacity across the horizon.</p>') + orgCumChart(ex) }];
    else if (z === 'ac_swim') e = ['The Committed Calendar' + _sfx, function () { return orgSwimlanes(acStagedExtras()) }];
    else if (z.indexOf('bpshape_') === 0 || z.indexOf('bpcum_') === 0) {
      var _bi = parseInt(z.split('_')[1], 10); var _nm = esc((((data.ideas || [])[_bi]) || {}).name || ('Item ' + _bi));
      e = (z.indexOf('bpshape_') === 0) ? ['Monthly Spend Shape \u2013 ' + _nm, function () { return bpChartShape(_bi) + bpChartLegend() }] : ['Cumulative Cost \u2013 ' + _nm, function () { return bpChartCum(_bi) }]
    }
  }
  if (!e) return '';
  return '<div style="position:fixed;inset:0;background:rgba(10,9,7,.78);z-index:400;display:flex;align-items:center;justify-content:center;padding:32px" onclick="UI.chartZoom=null;render()"><div class="cd" style="background:var(--bg-elev);max-width:960px;width:100%;max-height:90vh;overflow:auto;margin:0;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.55)" onclick="event.stopPropagation()"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><h3 class="h-sub-lg" style="flex:1;margin:0">' + e[0] + '</h3><button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=null;render()">\u2715 Close</button></div>' + e[1]() + '</div></div>'
}
/* ================= Module Management Hub (Paul, July 5) =================
   Assignments (data.assigns) and the roster already existed; this adds
   completion stamps (data.stepDoneAt, written by every saveDone handler),
   optional per-step deadlines (data.stepDue), and analytics: the 90-day
   burn-up and velocity charts (adapted from the companion Governance
   module), team load, and derived signals. Phase 5 (Navigate) is ongoing
   work, not a step to burn down, so it stays out of the counts. */
function stampStepDone(id) { try { if (!data.stepDoneAt) data.stepDoneAt = {}; if (!data.stepDoneAt[id]) { data.stepDoneAt[id] = new Date().toISOString().split('T')[0]; Store.commit('stepDoneAt'); notifyStepComplete(id) } } catch (e) { } }
function mgSteps() { var out = []; PH.forEach(function (p) { if (p.id === 5) return; p.steps.forEach(function (st) { out.push({ id: st.id, name: st.name, icon: st.icon, ph: p }) }) }); return out }
function mgDueSave(id, v) { data.stepDue = data.stepDue || {}; if (v) data.stepDue[id] = v; else delete data.stepDue[id]; Store.commit('stepDue'); render() }
function mgAssignToggle(id, uid2) { toggleAssign(id, uid2) } /* delegates to the existing assignment system */
function mgStats() {
  var steps = mgSteps(), co = data.completedSteps || {}, due = data.stepDue || {};
  var done = steps.filter(function (s) { return co[s.id] }).length;
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var elapsed = Math.max(0, Math.round((Date.now() - sd.getTime()) / 86400000));
  var ideal = Math.min(1, elapsed / 90) * steps.length;
  var today = new Date().toISOString().split('T')[0];
  var overdue = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] < today }).length;
  return { total: steps.length, done: done, elapsed: elapsed, ideal: ideal, delta: done - ideal, overdue: overdue }
}
function mgBurnup() {
  var steps = mgSteps(), total = steps.length; var co = data.completedSteps || {}, dts = data.stepDoneAt || {};
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var events = []; steps.forEach(function (s) { if (co[s.id] && dts[s.id]) events.push({ d: new Date(dts[s.id]), id: s.id }) });
  events.sort(function (a, b) { return a.d - b.d });
  var elapsed = Math.max(0, Math.min(120, Math.round((Date.now() - sd.getTime()) / 86400000)));
  var span = Math.max(90, elapsed);
  var W = 560, H = 190, PX = 40, PY = 12, PW = W - PX - 16, PHt = H - PY - 34;
  var X = function (day) { return PX + day / span * PW }, Y = function (nn) { return PY + PHt - (nn / total) * PHt };
  var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">';
  [0, .5, 1].forEach(function (f) { var y = PY + PHt - f * PHt; h += '<line x1="' + PX + '" y1="' + y.toFixed(1) + '" x2="' + (PX + PW) + '" y2="' + y.toFixed(1) + '" stroke="rgba(245,242,236,.08)"/><text x="' + (PX - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="9" fill="#8A8278">' + Math.round(f * total) + '</text>' });
  [30, 60, 90].forEach(function (d) { if (d <= span) h += '<line x1="' + X(d).toFixed(1) + '" y1="' + PY + '" x2="' + X(d).toFixed(1) + '" y2="' + (PY + PHt) + '" stroke="rgba(245,242,236,.08)" stroke-dasharray="2 4"/><text x="' + X(d).toFixed(1) + '" y="' + (PY + PHt + 16) + '" text-anchor="middle" font-size="9" fill="#8A8278">day ' + d + '</text>' });
  h += '<line x1="' + X(0).toFixed(1) + '" y1="' + Y(0).toFixed(1) + '" x2="' + X(Math.min(90, span)).toFixed(1) + '" y2="' + Y(total).toFixed(1) + '" stroke="#8A8278" stroke-dasharray="4 4" stroke-opacity=".6"><title>Ideal pace: all ' + total + ' steps by day 90</title></line>';
  var pth = ['M' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1)], n = 0;
  events.forEach(function (e) { var day = Math.max(0, Math.min(span, Math.round((e.d - sd) / 86400000))); pth.push('L' + X(day).toFixed(1) + ' ' + Y(n).toFixed(1)); n++; pth.push('L' + X(day).toFixed(1) + ' ' + Y(n).toFixed(1)) });
  pth.push('L' + X(Math.min(elapsed, span)).toFixed(1) + ' ' + Y(n).toFixed(1));
  h += '<path d="' + pth.join(' ') + '" fill="none" stroke="#D4A017" stroke-width="2"/>';
  h += '<circle cx="' + X(Math.min(elapsed, span)).toFixed(1) + '" cy="' + Y(n).toFixed(1) + '" r="4" fill="#D4A017"/>';
  h += '<text x="' + X(Math.min(elapsed, span)).toFixed(1) + '" y="' + (Y(n) - 8).toFixed(1) + '" text-anchor="middle" font-size="9" fill="#D4A017">TODAY \u00b7 ' + n + '/' + total + '</text></svg>';
  var st = mgStats();
  h += '<div class="t-faint-sm" style="text-align:center;margin-top:4px;color:' + (st.delta >= 0 ? 'var(--ph1-t)' : '#C25B73') + '">' + (st.delta >= 0 ? '\u25b2 ' : '\u25bc ') + Math.abs(st.delta).toFixed(1) + ' steps ' + (st.delta >= 0 ? 'ahead of' : 'behind') + ' the ideal pace</div>';
  return h
}
function mgVelocity() {
  var dts = data.stepDoneAt || {}, co = data.completedSteps || {};
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var weeks = [], i; for (i = 0; i < 13; i++)weeks.push(0); var any = false;
  mgSteps().forEach(function (s) { if (co[s.id] && dts[s.id]) { any = true; var w = Math.floor((new Date(dts[s.id]) - sd) / (7 * 86400000)); if (w < 0) w = 0; if (w > 12) w = 12; weeks[w]++ } });
  if (!any) return '<p class="t-faint-sm">No completion dates recorded yet \u2013 velocity appears as steps are marked complete.</p>';
  var curW = Math.min(12, Math.max(0, Math.floor((Date.now() - sd.getTime()) / (7 * 86400000))));
  var W = 560, H = 170, PX = 26, PY = 20, PW = W - PX - 10, PHt = H - PY - 28;
  var bw = PW / 13, mx = Math.max.apply(null, weeks.concat([1]));
  var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">';
  weeks.forEach(function (v, j) {
    var bh = v / mx * PHt, x = PX + j * bw + 3, y = PY + PHt - bh; var col = j === curW ? '#D4A017' : '#4FB39A';
    h += '<rect x="' + x.toFixed(1) + '" y="' + PY + '" width="' + (bw - 6).toFixed(1) + '" height="' + PHt + '" rx="4" fill="rgba(245,242,236,.03)"/>';
    if (v) h += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + col + '" fill-opacity=".85"><title>Week ' + (j + 1) + ': ' + v + ' step' + (v > 1 ? 's' : '') + '</title></rect>';
    if (v) h += '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">' + v + '</text>';
    h += '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (PY + PHt + 16) + '" text-anchor="middle" font-size="8.5" fill="' + (j === curW ? '#D4A017' : '#8A8278') + '">W' + (j + 1) + '</text>'
  });
  h += '</svg><div class="t-faint-sm" style="text-align:center;margin-top:4px">Gold bar = current program week</div>';
  return h
}
function mgSignals() {
  /* The program's own step list: Executive Readiness's leaves out its individual-track
     steps (15 Oct 2026 ruling); a program with no assignSteps hook gets mgSteps(). */
  var steps = (typeof asgnSteps === 'function' ? asgnSteps() : mgSteps()), counted = {}, co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {}, assigns = data.assigns || {};
  var withOwner = steps.filter(function (s) { return (assigns[s.id] || []).length }).length;
  var withDue = steps.filter(function (s) { return due[s.id] }).length;
  var met = 0, miss = 0; steps.forEach(function (s) { if (co[s.id] && due[s.id] && dts[s.id]) { if (dts[s.id] <= due[s.id]) met++; else miss++ } });
  steps.forEach(function (s) { counted[s.id] = true });
  var sd = data.startDate ? new Date(data.startDate) : new Date();
  var h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center">';
  var cellS = function (v, l) { return '<div><div class="fs-14"><strong>' + v + '</strong></div><div class="t-faint-sm" style="margin-top:2px">' + l + '</div></div>' };
  h += cellS(withOwner + ' of ' + steps.length, 'steps with an owner');
  h += cellS(withDue + ' of ' + steps.length, 'steps with a deadline');
  h += cellS((met + miss) ? met + ' met \u00b7 ' + miss + ' missed' : '\u2014', 'deadlines on completed steps');
  h += '</div>';
  var meds = PH.filter(function (p) { return p.id !== 5 }).map(function (p) { var shared = p.steps.filter(function (st) { return counted[st.id] }); var ds = shared.filter(function (st) { return co[st.id] && dts[st.id] }).map(function (st) { return Math.round((new Date(dts[st.id]) - sd) / 86400000) }).sort(function (a, b) { return a - b }); var med = ds.length ? ds[Math.floor((ds.length - 1) / 2)] : null; var doneN = shared.filter(function (st) { return co[st.id] }).length; return { p: p, med: med, doneN: doneN, n: shared.length } });
  h += '<div style="margin-top:10px">' + meds.map(function (x) { return '<div class="row-line"><span class="fs-13" style="flex:1;color:' + x.p.color + '">Phase ' + x.p.id + ' \u2013 ' + esc(x.p.name) + '</span><span class="t-faint-sm">' + x.doneN + ' / ' + x.n + ' complete' + (x.med != null ? ' \u00b7 median completion day ' + x.med : '') + '</span></div>' }).join('') + '</div>';
  return h
}
function mgWeek() {
  var steps = mgSteps(), co = data.completedSteps || {}, due = data.stepDue || {};
  var today = new Date().toISOString().split('T')[0];
  var week = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  var overdue = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] < today });
  var upcoming = steps.filter(function (s) { return !co[s.id] && due[s.id] && due[s.id] >= today && due[s.id] <= week });
  if (!overdue.length && !upcoming.length) return '<p class="t-faint-sm">Nothing due in the next seven days and nothing overdue.</p>';
  return overdue.concat(upcoming).map(function (s2) { return mgRowHtml(s2.id, s2.name) }).join('')
}
function mgRowHtml(id2, name) {
  var co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {};
  var today = new Date().toISOString().split('T')[0];
  var doneS = !!co[id2]; var d2 = due[id2] || ''; var over = !doneS && d2 && d2 < today;
  return '<div style="display:grid;grid-template-columns:minmax(160px,1fr) 300px 240px;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">'
    + '<div style="display:flex;align-items:baseline;gap:10px"><span class="t-faint-sm" style="min-width:26px">' + id2 + '</span><span class="fs-14">' + esc(name) + '</span></div>'
    + '<div style="display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap">'
    + (doneS ? badge('\u2713 done' + (dts[id2] ? ' \u00b7 ' + fmtDate(dts[id2]) : ''), '#1B6B5A') + (d2 ? '<span class="t-faint-sm">was due ' + fmtDate(d2) + '</span>' : '') : over ? badge('overdue \u00b7 was due ' + fmtDate(d2), '#C25B73') : d2 ? badge('due ' + fmtDate(d2), '#D4A017') : badge('open', '#2D5A8E'))
    + (doneS ? '' : '<input type="date" value="' + esc(d2) + '" onchange="mgDueSave(\'' + id2 + '\',this.value)" title="Optional deadline" style="font-size:11px;padding:3px 6px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"/>')
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:2px">' + assignBtn(id2) + '</div>'
    + '</div>'
}
function mgWorkload() {
  var steps = mgSteps(), co = data.completedSteps || {}, assigns = data.assigns || {};
  var rows = USERS.map(function (u) { var open = 0, done = 0; steps.forEach(function (s) { if ((assigns[s.id] || []).indexOf(u.id) >= 0) { if (co[s.id]) done++; else open++ } }); return { u: u, open: open, done: done } }).filter(function (r) { return r.open + r.done > 0 });
  if (!rows.length) return '<p class="t-faint-sm">No assignments yet \u2013 assign members on the Assignments tab.</p>';
  var mx = Math.max.apply(null, rows.map(function (r) { return r.open + r.done }));
  rows.sort(function (a, b) { return (b.open - a.open) || (b.done - a.done) });
  var h = ''; rows.forEach(function (r) {
    var wO = (r.open / mx) * 100, wD = (r.done / mx) * 100;
    h += '<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><div style="width:26px">' + userAv(r.u, 24) + '</div><div class="fs-13" style="width:140px">' + esc(r.u.name) + '</div>'
      + '<div style="flex:1;height:12px;background:rgba(var(--fg-rgb),.05);border-radius:6px;overflow:hidden;display:flex">'
      + (r.open ? '<div style="width:' + wO.toFixed(1) + '%;background:#D4A017"><title></title></div>' : '')
      + (r.done ? '<div style="width:' + wD.toFixed(1) + '%;background:#4FB39A;opacity:.45"></div>' : '')
      + '</div><div class="t-faint-sm" style="width:130px;text-align:right">' + r.open + ' open \u00b7 ' + r.done + ' complete</div></div>'
  });
  h += '<div class="t-faint-sm" style="margin-top:6px">Sorted by open load \u2013 gold is open work, faded teal is complete.</div>';
  return h
}
function mgmtHubContent(pdf, forceTab) { /* the hub body, callable for the page, the PDF, and the notification emails (July 7). `pdf` is the export button when rendering for the screen – it docks in the header row like every output page, and is absent from the PDF and the emails.
  `forceTab` pins which tab is rendered instead of reading UI.mgTab, which is
  whatever the user happens to have open in this browser. The step-complete
  email promises the analytics report, so it passes 1 and gets the analytics
  report every time (capHubContent's `all` flag exists for the same reason).
  A pinned render also drops the tab switcher – it is dead UI in an email. */
  var st = mgStats(), co = data.completedSteps || {}, due = data.stepDue || {}, dts = data.stepDoneAt || {}, assigns = data.assigns || {};
  var today = new Date().toISOString().split('T')[0];
  var h = '<div class="flx-between-top-mb"><div class="pdf-hd">' + badge('Ongoing', '#6B4C8A') + '<h1 class="section-title u-967e19d">Module <em>Management</em></h1><p class="u-98b80d8">Every step of the module in one place \u2013 who owns it, when it is due, and how completion is pacing against the 90 days.</p></div>' + (pdf || '') + '</div>';
  var tile = function (v, l, c) { return '<div style="text-align:center"><div class="score-num-md" style="font-size:26px;line-height:1.2' + (c ? ';color:' + c : '') + '">' + v + '</div><div class="t-faint-sm" style="margin-top:3px">' + l + '</div></div>' };
  h += card('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
    + tile(st.done + ' / ' + st.total, 'steps complete')
    + tile('Day ' + Math.min(st.elapsed, 90) + (st.elapsed > 90 ? ' (+' + (st.elapsed - 90) + ' over)' : ''), 'of the 90')
    + tile((st.delta >= 0 ? '+' : '\u2212') + Math.abs(st.delta).toFixed(1), 'steps vs ideal pace', st.delta >= 0 ? 'var(--ph1-t)' : '#C25B73')
    + tile(String(st.overdue), 'overdue', st.overdue ? '#C25B73' : null)
    + '</div>', 'margin-bottom:16px');
  var _mt = (forceTab == null) ? (UI.mgTab || 0) : forceTab;
  var _mtb = function (n, l) { return '<button class="btn-ghost pad-chip-md' + (_mt === n ? ' nav-action-on' : '') + '" style="font-size:13px' + (_mt === n ? ';border-color:var(--warn-text);color:var(--warn-text)' : '') + '" onclick="UI.mgTab=' + n + ';render()">' + l + '</button>' };
  if (forceTab == null) h += '<div style="display:flex;gap:8px;margin-bottom:16px">' + _mtb(0, 'Assignments') + _mtb(1, 'Analytics') + '</div>';
  if (_mt === 1) {
    h += card('<h3 class="h-sub-md">90-Day Burn-up</h3><p class="t-faint-sm" style="margin:4px 0 10px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all ' + st.total + ' steps by day 90.</p>' + mgBurnup(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Module Velocity</h3><p class="t-faint-sm" style="margin:4px 0 10px">Steps completed per program week, from completion dates.</p>' + mgVelocity(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Workload by Member</h3><p class="t-faint-sm" style="margin:4px 0 10px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>' + mgWorkload(), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Signals</h3>' + mgSignals(), 'margin-bottom:16px');
  } else {
    h += card('<h3 class="h-sub-md">This Week</h3><p class="t-faint-sm" style="margin:4px 0 8px">Steps overdue or due within seven days.</p>' + mgWeek(), 'margin-bottom:16px');
    PH.forEach(function (p) {
      if (p.id === 5) return;
      var rows = ''; p.steps.forEach(function (stp) {
        var id2 = stp.id;
        rows += mgRowHtml(id2, stp.name)
      });
      h += card('<h3 class="h-sub-md" style="color:' + p.color + '">Phase ' + p.id + ' \u2013 ' + esc(p.name) + ' <span class="t-faint-sm" style="font-weight:400">(' + p.days + ')</span></h3>' + rows, 'margin-bottom:16px');
    });
  }
  return h
}
// === Email notifications → js/features/email.js ===

function renderMgmtHub() {
  var _w = '<div class="content-area pt-110"><div class="content-inner">';
  return _w + backBtn() + mgmtHubContent(pdfBtn('printMgmtAnalytics()')) + '</div></div>'
}
function printMgmtAnalytics(){printDocument('Module Management',mgmtHubDoc(),'')} /* 14 Sep 2026 (Governance, Paul's ruling), ported 16 Sep 2026: the Track Program page prints as its own document */

function renderCapHub() {
  var _w = '<div class="content-area pt-110"><div class="content-inner">';
  return _w + backBtn() + capHubContent(false, pdfBtn('printCapHub()')) + '</div></div>'
}
function capHubContent(all, pdf) { /* the hub body, callable for the page and for the PDF; `all` renders every tab, since the PDF is the whole hub, not the tab on screen. `pdf` is the export button, docked in the header row for the screen and absent from the PDF itself. */
  var ideas = data.ideas || [], stages = getStages(), cap = data.capital || {}, trk = data.tracking || {}, arch = data.archivedItems || {}, port = data.portfolio || {};
  var av = capAvailable();
  var h = '<div class="flx-between-top-mb"><div class="pdf-hd">' + badge('Ongoing', '#6B4C8A') + '<h1 class="section-title u-967e19d">Capital Planning <em>Hub</em></h1><p class="u-98b80d8">The portfolio\u2019s committed costs and remaining budget in one place. Every figure here is calculated from the projects themselves \u2013 their stages, their plans, and their dates \u2013 so the page always shows the portfolio as it currently stands.</p></div>' + (pdf || '') + '</div>';
  if (data.capStale) h += card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">The portfolio changed since allocations were last reviewed \u2013 projects moved stage, were archived, or were killed.</span>' + btn('\u2713 Mark Reviewed', 'data.capStale=false;saveData();render()', 'bs', 'font-size:12px') + '</div>', 'border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
  h += card(capCells(true) + '<div style="margin-top:10px">' + btn('\u2913 Export CSV', 'dlAuditCSV()', 'bg2', 'font-size:11px;padding:4px 12px') + ' </div>', 'margin-bottom:16px');
  var _ht = UI.hubTab || 0;
  var _htb = function (n, lbl) { return '<button class="btn-ghost pad-chip-sm" style="font-size:12px;padding:5px 14px;' + (_ht === n ? 'background:rgba(var(--fg-rgb),.10);color:var(--paper)' : '') + '" onclick="UI.hubTab=' + n + ';render()">' + lbl + '</button>' };
  h += '<div style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap">' + _htb(0, 'Dashboard') + _htb(1, 'Commitments') + _htb(2, 'Plan & Funding') + '</div>';
  if (all || _ht === 0) {
    h += renderCapAnalytics();
    h += '<h3 class="h-sub-lg" style="margin:20px 0 4px">The Quarterly Review</h3><p class="t-faint-sm" style="margin:0 0 10px">All costs in this module are counted month by month. The two cards below add those same monthly figures into three-month blocks, because the portfolio is reviewed once a quarter (Step 4.4). Nothing here caps what a quarter may spend \u2013 the blocks are a way of reading the plan, not budgets.</p>';
    var tq = thisQuarterConsumption();
    var _tqc = card('<h3 class="h-sub-md">This Quarter \u2013 ' + fmtQuarter(tq.qi) + '</h3>' + (tq.p.rows.length ? tq.p.rows.map(function (r) { return '<div class="row-line"><span class="fs-14" style="flex:1">' + esc(r.name) + '</span><span class="t-faint-sm">' + r.label + '</span><strong style="min-width:70px;text-align:right">' + fmtMoney(r.amt) + '</strong></div>' }).join('') + '<div class="row-line" style="border-top:1px solid rgba(var(--fg-rgb),.12)"><span class="fs-14" style="flex:1"><strong>Total this quarter</strong></span><strong style="min-width:70px;text-align:right">' + fmtMoney(tq.p.total) + '</strong></div>' : '<p class="t-faint-sm">No consumption lands in this quarter yet.</p>') + '<p class="t-faint-sm" style="margin-top:8px">For comparison: one quarter of the annual budget is ' + fmtMoney(capAvailable().budget / 4) + '. Running above or below that figure is not a problem in itself \u2013 it only shows whether this quarter is heavier or lighter than an even spread.</p>', 'margin-bottom:16px');
    var _qs = orgQuarterStrip();
    h += '<div class="gr-2" style="align-items:start">' + _tqc + (_qs ? card('<h3 class="h-sub-md">Quarter Runway</h3>' + _qs, 'margin-bottom:16px') : '') + '</div>';
  }
  if (all || _ht === 1) {
    h += capReadout();
    var expl = stages.explore.filter(function (i) { return ((data.projects || {})[i] || {}).viable === true });
    h += card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential projects, no financial commitments yet) (' + expl.length + ')</h3>' + (expl.length ? expl.map(function (i) { var c = projCosts(i); return '<div class="row-line"><span class="fs-14" style="flex:1">' + esc((ideas[i] || {}).name) + '</span>' + (progContracted(i) ? badge('Program contracted', '#1B6B5A') : '') + '<span class="t-faint-sm">Potential: Development ' + fmtMoney(devCost(i)) + ' \u00b7 Rollout ' + fmtMoney(opsRolloutCost(i)) + ' \u00b7 Sustainment ' + fmtMoney(opsSustainCost(i)) + '/yr</span></div>' }).join('') : '<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'), 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md" style="color:#8B5E3C">Development (Development Costs committed) (' + stages.experiment.length + ')</h3>' + (stages.experiment.length ? stages.experiment.map(function (i) { var cS = devCost(i); var s = (trk[i] || {}).status || ''; var killed = s === 'killed'; return '<div class="row-line"><span class="fs-14" style="flex:1' + (killed ? ';text-decoration:line-through;color:#9B2D3F' : '') + '">' + esc((ideas[i] || {}).name) + '</span>' + (s ? badge(killed ? 'killed (released)' : s === 'paused' ? 'paused (held)' : s, killed ? '#9B2D3F' : s === 'complete' ? '#1B6B5A' : s === 'paused' ? '#D4A017' : '#2D5A8E') : '') + '<strong style="min-width:70px;text-align:right">' + fmtMoney(killed ? 0 : cS) + '</strong></div>' }).join('') : '<p class="t-faint-sm">Nothing in Development.</p>'), 'margin-bottom:16px');
    var ops = stages.operational || [];
    h += card('<h3 class="h-sub-md" style="color:#9B2D3F">Operational (all costs committed) (' + ops.length + ')</h3>' + (ops.length ? ops.map(function (i) { var fy = opFirstYear(i); var killed = (trk[i] || {}).status === 'killed'; var amt = fy ? (devCost(i) + opsRolloutCost(i)) : opsSustainCost(i); return '<div class="row-line"><span class="fs-14" style="flex:1' + (killed ? ';text-decoration:line-through;color:#9B2D3F' : '') + '">' + esc((ideas[i] || {}).name) + '</span><span class="t-faint-sm">' + (killed ? 'killed (released)' : fy ? ('Development + Rollout committed' + (opsSustainCost(i) ? ' \u00b7 Sustainment ' + fmtMoney(Math.round(opsSustainCost(i))) + '/yr from rollout\u2019s end' : '')) : 'annual Sustainment') + '</span><strong style="min-width:70px;text-align:right">' + fmtMoney(killed ? 0 : amt) + '</strong></div>' }).join('') : '<p class="t-faint-sm">Nothing operational yet.</p>'), 'margin-bottom:16px');
    var freed = Object.keys(arch).filter(function (k) { return devCost(k) > 0 });
    if (freed.length) h += card('<h3 class="h-sub-md">Archived \u2013 costs no longer committed</h3>' + freed.map(function (k) { return '<div class="row-line"><span class="fs-14" style="flex:1">' + esc((ideas[k] || {}).name || ('Item ' + k)) + '</span><span class="t-faint-sm">archived from ' + arch[k].stage + '</span><strong style="min-width:70px;text-align:right">' + fmtMoney(devCost(k)) + '</strong></div>' }).join(''), 'margin-bottom:16px');
  }
  if (all || _ht === 2) {
    h += card('<h3 class="h-sub-lg">Budget Envelope</h3>' + budgetEnvelopeRow() + fundNote() + '<p class="t-faint-sm" style="margin:10px 0 0">Single source with Step 3.2 (Plan Capacity) \u2013 these are the same fields.</p>', 'margin-bottom:16px');
    h += card('<h3 class="h-sub-md">Funding Plan</h3>' + fundPlanLines(), 'margin-bottom:16px');
  }
  return h
}
function renderNavDash(embedded){
var h = embedded ? '' : '<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
var ideas=data.ideas||[],stages=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{};
var nm={bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};
// Standalone page shows the hero; when embedded in the step view the step header already supplies the title.
if(!embedded) h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Pipeline <em>Dashboard</em></h1><p class="u-98b80d8">Your operational pipeline. Click any stage to manage it.</p></div>'+'<div style="margin-top:8px">'+pdfBtn('printCurrentPage()')+'</div>'+'</div>'; /* 17 Sep 2026 (Paul's ruling): the dashboard prints from its own header, as Governance\u2019s does; printCurrentPage dispatches the dashboard document */
var maturity=getPipelineMaturity();h+='<div class="viz-dash-row">'+vizHealthGauge(maturity)+vizDimBars()+'</div>';
h+='<div class="gr-2-mb">';
h+=card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(rhAttNames().length?rhAttNames().map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)');
h+=card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+esc(nextReviewDateText())+'</div><div class="u-d431697">'+btn('\u25b6 Run Quarterly Review','go(\'review\')','bp','font-size:12px;padding:6px 14px;background:#9B2D3F')+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)');
h+='</div>';
if(data.capStale)h+=card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">\u26a0 Capital allocations need to be reviewed \u2013 the portfolio has changed since the last update.</span>'+btn('Open Capital Hub \u2192','go(\'cap-hub\')','bs','font-size:12px')+'</div>','border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
h+=pipeViz('',nm,true);
// Stage cards
h+='<div class="u-03ed01f">';
[{k:'bluesky',t:'Blue Sky',c:'#1B6B5A',nav:'out-bluesky',items:bsNowList(stages)},{k:'explore',t:'Exploration',c:'#2D5A8E',nav:'out-explore',items:stages.explore},{k:'experiment',t:'Development',c:'#8B5E3C',nav:'out-expbriefs',items:stages.experiment},{k:'operate',t:'Operational',c:'#9B2D3F',nav:'out-oper',items:stages.operational||[]}].forEach(function(s){
h+=card('<div class="flx-row-mb-12"><h3 style="font-size:15px;font-weight:700;color:'+s.c+';margin:0">'+s.t+'</h3>'+badge(s.items.length+(s.k==='operate'?' live':' items'),s.c)+'</div>'+
s.items.slice(0,3).map(function(i){var idea=ideas[i];return'<div class="u-cfcd2a9"><span>'+esc(idea?idea.name:'Item '+(i+1))+'</span></div>'}).join('')+
(s.items.length>3?'<div class="u-b9a11b1">+'+(s.items.length-3)+' more</div>':'')+
(s.items.length===0?'<p class="u-c54d0ef">No items yet.</p>':'')+
'<div class="mt-3">'+btn('View Portfolio \u2192','go(\'portfolio\',\''+s.nav+'\')','bs','font-size:11px;padding:6px 12px;width:100%')+'</div>','border-top:4px solid '+s.c)});
h+='</div>';
// Data bank
h+=renderPortfolioAnalytics().replace(/onclick="go\('(out-[a-z]+)'\)"/g,"onclick=\"go('portfolio','$1')\"") /* 17 Sep 2026 (Paul's ruling): the charts\u2019 own links open the live portfolio pages, never an earlier phase\u2019s output */;
h+=vizBalanceMap();
var _nr=nextReviewLine();if(_nr)h+=card('<div class="flx-row-mb"><h3 class="h-sub-lg" style="margin:0">Portfolio Review</h3><button class="btn-ghost pad-chip-sm" onclick="UI.expanded.navRev=!UI.expanded.navRev;render()">'+(UI.expanded.navRev?'\u25be Close':'\u25b8 Run the review')+'</button></div>'+(UI.expanded.navRev?'<div style="margin-top:10px">'+renderReviewSurface()+'</div>':'<p class="fs-14" style="margin:6px 0 0">'+_nr+'</p>'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Data Bank</h3><div class="gr-3-sm">'+[{id:'out-report',l:'Assessment Report',ic:'□',c:'var(--ph1-t)'},{id:'out-orgready',l:'Org Readiness',ic:'■',c:'var(--ph2-t)'},{id:'out-raci',l:'RACI Matrix',ic:'⊕',c:'var(--ph2-t)'},{id:'out-capplan',l:'Capital Snapshot',ic:'◆',c:'var(--ph3-t)'},{id:'out-govfw',l:'Governance',ic:'—',c:'var(--ph4-t)'},{id:'out-orgrev',l:'Org Review',ic:'✕',c:'var(--ph4-t)'}].map(function(r){return'<button onclick="go(\''+r.id+'\')" class="u-355061e"><div style="font-size:22px;line-height:1;margin-bottom:8px;color:'+r.c+'">'+r.ic+'</div><div style="font-size:13px;font-weight:600;color:'+r.c+'">'+r.l+'</div></button>'}).join('')+'</div>','background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.12)');
return h + (embedded ? '' : '</div></div></div>')}

/* Phase-5 page entry points (render() and renderStepContent route here). */
function renderPhase5() { return renderNavDash(); }
function renderPhase5Content() { return renderNavDash(true); }
