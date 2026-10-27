/* ============================================================
   budget.js - Capital / budget / calendar financial engine
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   One cohesive engine: derived capital commitments, per-project
   budget plans (bp*), horizon reconciliation (hz*), and the org
   calendar / monthly cashflow model (progMonthOf, org*, cap*, fiscal*).
   No load-time execution. Relies on app.js globals: data, Store,
   Collab, render, esc, card/btn/badge, getStages, parseBudget,
   env-year / sustainment-cap helpers, PH, UI.
   ============================================================ */

/* ── Capital engine: commitments are DERIVED from current stage membership and
   per-project costs. Nothing is debited; advancing, launching, killing, or
   archiving a project changes the numbers because the state changed.
   Rules (three-field model, July 2; continuity ruled July 5): killed items release their
   commitment; paused experiments hold it. Development commits Development Costs; Operational
   commits Development plus Rollout while those one-time phases run (no plan: the first year
   after launch; no launch date = first year), then Annual Sustainment Costs from the month
   rollout ends or the later start a budget plan sets. */
function costNum(v) { return parseBudget(v || '') }
/* costEchoTxt retired July 9 (QA sweep 2, item 10): the Reads-as echo doubled the derived figures - the derivation lock and blur re-renders carry the confirmation now */
function projCosts(i) { var p = (data.projects || {})[i] || {}; return { start: costNum(p.startupCost), roll: costNum(p.rolloutCost), run: costNum(p.runningCost) } }
/* ── Budget plans (redesign chunk A, July 3): step-based, project-relative months.
   Replaces the year-bucket cost-profile layer. dev/roll are step tables {id,name,desc,from,to,
   cost} – a step's whole cost is averaged across its months. sus is a list of phases
   {id,name,from,to|'ongoing',items:[{id,name,cost}]} whose ANNUAL rate derives from its
   items. Months are project-relative, never calendar-anchored. Two year lenses: PROJECT
   years (ceil(m/12), used by the org projection) and OPERATIONAL years (12-month windows
   anchored at bpFirstOpMonth, used by the commitment engine so the first-year-inside-
   Rollout doctrine survives the month model). */
function bpGet(i) { return (data.budgetPlans || {})[i] || null }
function bpEnsure(i) { if (!data.budgetPlans) data.budgetPlans = {}; if (!data.budgetPlans[i]) data.budgetPlans[i] = { horizon: '3', contingency: '', dev: [], roll: [], sus: [], notes: {} }; return data.budgetPlans[i] }
function bpHorizon(i) { var p = bpGet(i); var n = p ? parseInt(p.horizon, 10) : 3; return (n === 4 || n === 5) ? n : 3 }
function bpRows(i, k) { var p = bpGet(i); return (p && p[k]) ? p[k] : [] }
function bpStepMoney(sBp) { return costNum((sBp || {}).cost) }
function bpStepSpan(sBp) { var a = parseInt((sBp || {}).from, 10), b = parseInt((sBp || {}).to, 10); if (!a || !b || b < a || a < 1) return null; return [a, b] }
function bpDevTotal(i) { return bpRows(i, 'dev').reduce(function (t, x) { return t + bpStepMoney(x) }, 0) }
function bpRollTotal(i) { return bpRows(i, 'roll').reduce(function (t, x) { return t + bpStepMoney(x) }, 0) }
function bpPhaseAnnual(ph) { return ((ph || {}).items || []).reduce(function (t, it) { return t + costNum((it || {}).cost) }, 0) }
function bpPhaseSpan(ph) { var a = parseInt((ph || {}).from, 10); if (!a || a < 1) return null; var ong = (ph.to === 'ongoing' || ph.to == null || ph.to === ''); var b = ong ? Infinity : parseInt(ph.to, 10); if (!ong && (!b || b < a)) return null; return [a, b] }
function bpHasDev(i) { return bpDevTotal(i) > 0 }
function bpHasRoll(i) { return bpRollTotal(i) > 0 }
function bpHasSus(i) { return bpRows(i, 'sus').some(function (ph) { return bpPhaseAnnual(ph) > 0 && !!bpPhaseSpan(ph) }) }
function bpHasAny(i) { return bpHasDev(i) || bpHasRoll(i) || bpHasSus(i) }
/* Money-path eligibility (ruled July 9): only rows that land on the calendar count toward committed
   totals. bpHasAny/bpHasDev/bpHasRoll stay the display and lock predicates - a plan with money shows
   its surfaces and locks its simple fields even before dates are set; the ledger waits for dates. */
function bpDatedTotal(i, k) { return bpRows(i, k).reduce(function (t, x) { var c = bpStepMoney(x); return t + ((c && bpStepSpan(x)) ? c : 0) }, 0) }
function bpDevLive(i) { return bpDatedTotal(i, 'dev') > 0 }
function bpRollLive(i) { return bpDatedTotal(i, 'roll') > 0 }
function bpPlanLive(i) { return bpDevLive(i) || bpRollLive(i) || bpHasSus(i) }
function bpUndatedRows(i) { var out = [];['dev', 'roll'].forEach(function (k) { bpRows(i, k).forEach(function (x) { if (bpStepMoney(x) && !bpStepSpan(x)) out.push((x || {}).name || 'Unnamed step') }) }); return out }
function bpUndatedWarn(i) { var u = bpUndatedRows(i); if (!u.length) return ''; return u.map(function (n) { return '<div class="t-faint-sm" style="color:var(--warn-text);margin:2px 0">\u26a0 Phase date ranges not set \u2013 ' + esc(n) + ' is not contributing to committed totals</div>' }).join('') }
function bpOverlap(a, b, lo, hi) { return Math.max(0, Math.min(b, hi) - Math.max(a, lo) + 1) }
function bpCatYear(i, k, y) { var lo = (y - 1) * 12 + 1, hi = y * 12, t = 0; bpRows(i, k).forEach(function (x) { var c = bpStepMoney(x), sp = bpStepSpan(x); if (!c || !sp) return; var ov = bpOverlap(sp[0], sp[1], lo, hi); if (ov) t += c * ov / (sp[1] - sp[0] + 1) }); return Math.round(t) }
function bpSusWindow(i, lo, hi) { var t = 0; bpRows(i, 'sus').forEach(function (ph) { var r = bpPhaseAnnual(ph), sp = bpPhaseSpan(ph); if (!r || !sp) return; var ov = bpOverlap(sp[0], sp[1], lo, hi); if (ov) t += r * ov / 12 }); return Math.round(t) }
function bpSusYear(i, y) { return bpSusWindow(i, (y - 1) * 12 + 1, y * 12) }
function bpSusSteady(i) { var t = 0; bpRows(i, 'sus').forEach(function (ph) { if (bpPhaseSpan(ph) && (ph.to === 'ongoing' || ph.to == null || ph.to === '')) t += bpPhaseAnnual(ph) }); return t }
function bpSusStartMonth(i) { var m = Infinity; bpRows(i, 'sus').forEach(function (ph) { var sp = bpPhaseSpan(ph); if (sp && bpPhaseAnnual(ph) && sp[0] < m) m = sp[0] }); return m === Infinity ? 0 : m }
function bpFirstOpMonth(i) { var last = 0;['dev', 'roll'].forEach(function (k) { bpRows(i, k).forEach(function (x) { var sp = bpStepSpan(x); if (sp && bpStepMoney(x) && sp[1] > last) last = sp[1] }) }); if (last) return last + 1; return bpSusStartMonth(i) || 1 }
function bpSusOpYear(i, opY) { var a = bpFirstOpMonth(i) + 12 * (opY - 1); return bpSusWindow(i, a, a + 11) }
function bpSusStartOpYear(i) { var sm = bpSusStartMonth(i); if (!sm) return 0; return Math.max(1, Math.floor((sm - bpFirstOpMonth(i)) / 12) + 1) }
function bpMonthly(i) {
  var M = bpHorizon(i) * 12, out = [], m; for (m = 1; m <= M; m++)out.push({ m: m, dev: 0, roll: 0, sus: 0 });
  ['dev', 'roll'].forEach(function (k) { bpRows(i, k).forEach(function (x) { var c = bpStepMoney(x), sp = bpStepSpan(x); if (!c || !sp) return; var per = c / (sp[1] - sp[0] + 1); for (m = Math.max(1, sp[0]); m <= Math.min(M, sp[1]); m++)out[m - 1][k] += per }) });
  bpRows(i, 'sus').forEach(function (ph) { var r = bpPhaseAnnual(ph), sp = bpPhaseSpan(ph); if (!r || !sp) return; for (m = Math.max(1, sp[0]); m <= Math.min(M, sp[1] === Infinity ? M : sp[1]); m++)out[m - 1].sus += r / 12 });
  return out
}
function hzPlanStarted() { var cap = data.capital || {}; return !!(String(cap.aiBudget || '').trim() || String(cap.envYears || '').trim()) }
function hzMismatch(i) { if (!hzPlanStarted()) return 0; if (!bpHasAny(i)) return 0; var H = bpHorizon(i), E = envYearsOf(); return H > E ? E : 0 }
function hzWarnText(E) { return 'This project\u2019s lifetime extends beyond the organization\u2019s financial planning horizon of ' + E + ' years. Bring it into line on the project card or extend the planning horizon at Step 3.2.' }
function hzList() { if (!hzPlanStarted()) return []; var out = [], ideas = data.ideas || []; Object.keys(data.budgetPlans || {}).forEach(function (k) { var i = parseInt(k, 10); if (isNaN(i) || isArchived(i)) return; if (hzMismatch(i)) out.push({ i: i, name: (ideas[i] || {}).name || ('Item ' + i), H: bpHorizon(i) }) }); return out }
function hzReconcilePanel() {
  var L = hzList(); if (!L.length) return '';
  return '<div style="border:1px solid rgba(201,64,59,.45);background:rgba(201,64,59,.07);border-radius:8px;padding:10px 12px;margin:10px 0 4px"><p style="color:#C9403B;font-size:12.5px;font-weight:600;margin:0 0 6px">\u26a0 The following projects were assigned lifetimes longer than this planning horizon \u2013 reconcile each on its project card, or extend the horizon:</p>' + L.map(function (x) { return '<div class="fs-13" style="color:var(--text-bright);margin:2px 0">' + esc(x.name) + ' <span class="t-faint-sm">(' + x.H + ' years)</span></div>' }).join('') + '</div>'
}
function hzWarn(i, compact) {
  var E = hzMismatch(i); if (!E) return '';
  if (compact) return '<span title="' + esc(hzWarnText(E)) + '" style="color:#C9403B;font-weight:700;font-size:13px;flex:0 0 auto;cursor:help">\u26a0</span>';
  return '<p style="color:#C9403B;font-size:12.5px;font-weight:600;margin:6px 0 8px">\u26a0 ' + hzWarnText(E) + '</p>'
}
function bpLifetime(i) { var t = 0; bpMonthly(i).forEach(function (r) { t += r.dev + r.roll + r.sus }); return Math.round(t) }
function bpPeakMonth(i) { var best = 0, bm = 0; bpMonthly(i).forEach(function (r) { var v = r.dev + r.roll + r.sus; if (v > best + 1e-6) { best = v; bm = r.m } }); return bm }
function bpTabBar(key, i, withAnalyses) {
  UI.cardTab = UI.cardTab || {}; var t = UI.cardTab[key] || 1;
  var tabs = withAnalyses ? [[1, 'Project Details'], [3, 'Analyses'], [2, 'Project Budgeting']] : [[1, 'Project Details'], [2, 'Project Budgeting']];
  return '<div style="margin:18px 0 8px;font-size:14px;color:var(--paper)">Choose what you want to work on:</div><div class="flx-g2-wrap" style="margin:0 0 26px">' + tabs.map(function (tb) {
    var on = t === tb[0];
    return '<button onclick="UI.cardTab=UI.cardTab||{};UI.cardTab[\'' + key + '\']=' + tb[0] + ';render()" style="padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (on ? '2px solid #8B5E3C' : '1px solid rgba(var(--fg-rgb),.28)') + ';background:' + (on ? 'rgba(139,94,60,.12)' : 'rgba(var(--fg-rgb),.05)') + ';color:' + (on ? 'var(--paper)' : 'var(--text-muted)') + '">' + tb[1] + '</button>'
  }).join('') + '</div>'
}
function bpTabOn(key) { UI.cardTab = UI.cardTab || {}; return (UI.cardTab[key] || 1) === 2 }
function bpStatBand(i) {
  var big = function (v, l, sub) { return '<div class="t-center" style="flex:1;min-width:140px"><div class="score-num-md" style="font-size:26px">' + v + '</div><div class="fs-13" style="margin-top:3px">' + l + '</div>' + (sub ? '<div class="t-faint-sm">' + sub + '</div>' : '') + '</div>' };
  if (!bpHasAny(i)) return '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:18px 0 18px">' + big('\u2014', 'Lifetime cost', '') + big('\u2014', 'Development costs', '') + big('\u2014', 'Rollout costs', '') + big('\u2014', 'Annual sustainment costs', '') + '</div>';
  var H = bpHorizon(i), life = bpLifetime(i), pk = bpPeakMonth(i), fo = bpFirstOpMonth(i), ssv = bpSusSteady(i); var _hzw = hzWarn(i);
  var mm = bpMonthly(i); var pkV = pk ? Math.round(mm[pk - 1].dev + mm[pk - 1].roll + mm[pk - 1].sus) : 0;
  var h = _hzw + '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:' + (_hzw ? '6px' : '18px') + ' 0 16px">'
    + big(fmtMoney(life), 'Lifetime cost', 'across ' + H + ' years')
    + big(fmtMoney(bpDevTotal(i)), 'Development costs', '')
    + big(fmtMoney(bpRollTotal(i)), 'Rollout costs', '')
    + big(ssv ? fmtMoney(ssv) : '\u2014', 'Annual sustainment costs', '')
    + '</div>';
  var ct = parseFloat((bpGet(i) || {}).contingency);
  if (ct > 0) h += '<p class="fs-14" style="margin:0 0 6px">With ' + ct + '% contingency: ' + fmtMoney(Math.round(life * (1 + ct / 100))) + ' lifetime.</p>';
  if (pk) h += '<p class="fs-14" style="margin:0 0 6px">Monthly costs peak at Month ' + pk + ': ' + fmtMoney(pkV) + ' per month.</p>';
  if (fo) h += '<p class="fs-14" style="margin:0 0 6px">First operational month occurs at Month ' + fo + '.</p>';
  return h
}
function bpStepListRO(i) {
  if (!bpHasAny(i)) return '<p class="t-faint-sm" style="margin:12px 0 0">No budget plan yet \u2013 development and rollout steps, sustainment phases, and the spending pictures they draw will be built here.</p>';
  var h = '';[['dev', 'DEVELOPMENT PHASES'], ['roll', 'ROLLOUT STEPS']].forEach(function (sec) {
    var rows = bpRows(i, sec[0]).filter(function (x) { return bpStepSpan(x) || bpStepMoney(x) }); if (!rows.length) return;
    h += '<div class="t-faint-sm" style="margin:14px 0 4px">' + sec[1] + '</div>';
    rows.forEach(function (x) {
      var sp = bpStepSpan(x); h += '<div class="fs-14" style="margin-bottom:2px">' + esc(x.name || '\u2014') + (sp ? ' \u00b7 Months ' + sp[0] + '\u2013' + sp[1] : '') + ' \u00b7 ' + fmtMoney(bpStepMoney(x)) + '</div>';
      if (x.desc) h += '<div class="t-faint-sm" style="margin:0 0 6px">' + esc(x.desc) + '</div>'
    })
  });
  var ph = bpRows(i, 'sus').filter(function (x) { return bpPhaseSpan(x) && bpPhaseAnnual(x) });
  if (ph.length) {
    h += '<div class="t-faint-sm" style="margin:14px 0 4px">SUSTAINMENT PHASES</div>';
    ph.forEach(function (x) {
      var sp = bpPhaseSpan(x); h += '<div class="fs-14" style="margin-bottom:2px">' + esc(x.name || '\u2014') + ' \u00b7 from Month ' + sp[0] + (sp[1] === Infinity ? ' \u00b7 ongoing' : ' to Month ' + sp[1]) + ' \u00b7 ' + fmtMoney(bpPhaseAnnual(x)) + '/yr</div>';
      (x.items || []).forEach(function (it) { h += '<div class="t-faint-sm" style="margin:0 0 2px;padding-left:12px">' + esc(it.name || '') + ' \u00b7 ' + fmtMoney(costNum(it.cost)) + '/yr</div>' })
    })
  }
  return h
}
function bpMonthSel(id, val, minM, H, onch, ong) {
  var M = H * 12; var h = '<select id="' + id + '" onchange="' + onch + '" class="sel-helper" style="width:auto;padding:4px 6px;font-size:12px">';
  h += '<option value=""' + (!val ? ' selected' : '') + '>\u2014</option>';
  if (ong) h += '<option value="ongoing"' + (val === 'ongoing' ? ' selected' : '') + '>Ongoing</option>';
  var cur = parseInt(val, 10); var top = M; if (cur && cur > top) top = cur;
  for (var m = Math.max(1, minM || 1); m <= top; m++)h += '<option value="' + m + '"' + (cur === m ? ' selected' : '') + '>' + m + '</option>';
  return h + '</select>'
}
function bpAmber(i) {
  var msgs = []; var de = 0, rs = Infinity, re = 0;
  bpRows(i, 'dev').forEach(function (x) { var sp = bpStepSpan(x); if (sp && sp[1] > de) de = sp[1] });
  bpRows(i, 'roll').forEach(function (x) { var sp = bpStepSpan(x); if (!sp) return; if (sp[0] < rs) rs = sp[0]; if (sp[1] > re) re = sp[1] });
  var ss = bpSusStartMonth(i);
  if (de && rs !== Infinity && rs <= de) msgs.push('Rollout begins in Month ' + rs + ', before development ends in Month ' + de + ' \u2013 is this correct?');
  if (re && ss && ss <= re) msgs.push('Sustainment begins in Month ' + ss + ', before rollout ends in Month ' + re + ' \u2013 is this correct?');
  return msgs.map(function (m) { return '<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">\u26a0 ' + m + '</p>' }).join('')
}
function bpDescTa(id, val, onch, rows, ph) { return '<textarea id="' + id + '" rows="' + (rows || 1) + '" placeholder="' + esc(ph || 'Describe the step (optional)') + '" onfocus="this.rows=2" onblur="this.rows=1" onchange="' + onch + '" style="width:100%;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);border-radius:6px;color:inherit;padding:4px 8px;font-size:12px;margin:0 0 8px;font-family:inherit;resize:none">' + esc(val || '') + '</textarea>' }
function bpStepRow(i, sec, r, H, noDesc, noDel) {
  var idb = 'bps_' + i + '_' + sec + '_' + r.id; var oc = function (f) { return "bpRowSave(" + i + ",'" + sec + "','" + r.id + "','" + f + "',this.value)" };
  var h = '<div class="flx-g3" style="margin-bottom:2px;align-items:center">';
  h += '<input id="' + idb + '_name" value="' + esc(r.name || '') + '" placeholder="Step name" onchange="' + oc('name') + '" class="row-input" style="flex:2"/>';
  h += '<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">' + bpMonthSel(idb + '_from', r.from, 1, H, oc('from')) + '<span class="t-faint-sm">\u2013</span>' + bpMonthSel(idb + '_to', r.to, Math.max(1, parseInt(r.from, 10) || 1), H, oc('to')) + '</div>';
  h += '<input id="' + idb + '_cost" value="' + esc(r.cost || '') + '" placeholder="$ \u2014" onchange="' + oc('cost') + '" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
  h += (noDel ? '' : '<button onclick="bpDelStep(' + i + ',\'' + sec + '\',\'' + r.id + '\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button>') + '</div>';
  if (!noDesc) h += bpDescTa(idb + '_desc', r.desc, oc('desc'));
  return h
}
function bpGhostRow(i, sec, g, gn, gc, H) {
  var idb = 'bpg_' + i + '_' + sec + '_' + g; var oc = function (f) { return "bpGhostSave(" + i + ",'" + sec + "','" + f + "',this.value)" };
  var h = '<div class="flx-g3" style="margin-bottom:8px;align-items:center;opacity:.6">';
  h += '<input id="' + idb + '_name" value="" placeholder="' + esc(gn) + '" onchange="' + oc('name') + '" class="row-input" style="flex:2"/>';
  h += '<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">' + bpMonthSel(idb + '_from', '', 1, H, oc('from')) + '<span class="t-faint-sm">\u2013</span>' + bpMonthSel(idb + '_to', '', 1, H, oc('to')) + '</div>';
  h += '<input id="' + idb + '_cost" value="" placeholder="' + esc(gc) + '" onchange="' + oc('cost') + '" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
  h += '<span style="width:26px"></span></div>';
  return h
}
function bpStepTable(i, sec, title, cap, gp, H, colLabel) {
  colLabel = colLabel || 'Step'; var p = bpGet(i) || {}; var rows = (p[sec] || []);
  var h = '<div style="margin:26px 0 2px;font-size:14px;font-weight:700;color:var(--paper);letter-spacing:.02em">' + title + '</div><div class="t-faint-sm" style="margin:0 0 8px">' + cap + '</div>';
  h += '<div class="flx-g3" style="margin:0 0 2px"><span class="t-faint-sm" style="flex:2;font-size:14px">' + colLabel + '</span><span class="t-faint-sm" style="flex:0 0 136px;font-size:14px">Months</span><span class="t-faint-sm" style="flex:0 0 140px;font-size:14px">Cost (whole ' + colLabel.toLowerCase() + ')</span><span style="width:26px"></span></div>';
  rows.forEach(function (r) { if (r) h += bpStepRow(i, sec, r, H) });
  for (var g = rows.length; g < 2; g++)h += bpGhostRow(i, sec, g, gp[g % gp.length][0], gp[g % gp.length][1], H);
  h += '<div style="margin:6px 0 18px">' + btn('+ Add ' + colLabel.toLowerCase(), 'bpAddStep(' + i + ',\'' + sec + '\')', 'bg2', 'font-size:11px;padding:3px 10px') + '</div>';
  h += '<div class="mb-4"><div style="font-size:14px;color:var(--text-faint);margin-bottom:6px">Notes</div><textarea id="bpn_' + i + '_' + sec + '" rows="2" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="Assumptions, vendors, dependencies \u2013 anything that explains these numbers">' + esc((p.notes || {})[sec] || '') + '</textarea></div>';
  return h
}
function bpPhaseBlock(i, ph, H) {
  var idb = 'bps_' + i + '_sus_' + ph.id; var oc = function (f) { return "bpPhSave(" + i + ",'" + ph.id + "','" + f + "',this.value)" };
  var h = '<div class="flx-g3" style="margin-bottom:2px;align-items:center">';
  h += '<input id="' + idb + '_name" value="' + esc(ph.name || '') + '" placeholder="Phase name" onchange="' + oc('name') + '" class="row-input" style="flex:2"/>';
  h += '<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">' + bpMonthSel(idb + '_from', ph.from, 1, H, oc('from')) + '<span class="t-faint-sm">\u2013</span>' + bpMonthSel(idb + '_to', ph.to, Math.max(1, parseInt(ph.from, 10) || 1), H, oc('to'), true) + '</div>';
  h += '<span class="row-input" style="flex:0 0 140px;width:140px;text-align:left;background:rgba(var(--fg-rgb),.03);color:var(--paper)">' + (bpPhaseAnnual(ph) ? fmtMoney(bpPhaseAnnual(ph)) + '/yr' : '\u2014') + '</span>';
  h += '<button onclick="bpDelPhase(' + i + ',\'' + ph.id + '\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button></div>';
  (ph.items || []).forEach(function (it) {
    if (!it) return; var ib = 'bps_' + i + '_susit_' + ph.id + '_' + it.id; var oi = function (f) { return "bpItemSave(" + i + ",'" + ph.id + "','" + it.id + "','" + f + "',this.value)" };
    h += '<div class="flx-g3" style="margin-bottom:2px;padding-left:14px;align-items:center">';
    h += '<input id="' + ib + '_name" value="' + esc(it.name || '') + '" placeholder="e.g. Hosting & licenses" onchange="' + oi('name') + '" class="row-input" style="flex:2"/>';
    h += '<input id="' + ib + '_cost" value="' + esc(it.cost || '') + '" placeholder="$ \u2014 per year" onchange="' + oi('cost') + '" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
    h += '<button onclick="bpDelItem(' + i + ',\'' + ph.id + '\',\'' + it.id + '\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button></div>'
  });
  var gb = 'bpg_' + i + '_susit_' + ph.id; var og = function (f) { return "bpGhostItem(" + i + ",'" + ph.id + "','" + f + "',this.value)" };
  h += '<div class="flx-g3" style="margin-bottom:2px;padding-left:14px;align-items:center;opacity:.6">';
  h += '<input id="' + gb + '_name" value="" placeholder="e.g. Hosting & licenses" onchange="' + og('name') + '" class="row-input" style="flex:2"/>';
  h += '<input id="' + gb + '_cost" value="" placeholder="e.g. $60K per year" onchange="' + og('cost') + '" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
  h += '<span style="width:26px"></span></div>';
  return h
}
function bpSusTable(i, H) {
  var p = bpGet(i) || {}; var phs = (p.sus || []);
  var h = '<div style="margin:26px 0 2px;font-size:14px;font-weight:700;color:var(--paper);letter-spacing:.02em">SUSTAINMENT PHASES</div><div class="t-faint-sm" style="margin:0 0 8px">The ongoing operational costs of the project. Each line item is assigned an annual cost.</div>';
  h += '<div class="flx-g3" style="margin:0 0 2px"><span class="t-faint-sm" style="flex:2;font-size:14px">Phase</span><span class="t-faint-sm" style="flex:0 0 136px;font-size:14px">Months</span><span class="t-faint-sm" style="flex:0 0 140px;font-size:14px">Annual rate (derived)</span><span style="width:26px"></span></div>';
  phs.forEach(function (ph) { if (ph) h += bpPhaseBlock(i, ph, H) });
  if (!phs.length) {
    var gb = 'bpg_' + i + '_sus_0'; var og = function (f) { return "bpGhostPhase(" + i + ",'" + f + "',this.value)" };
    h += '<div class="flx-g3" style="margin-bottom:8px;align-items:center;opacity:.6">';
    h += '<input id="' + gb + '_name" value="" placeholder="e.g. Ongoing operation" onchange="' + og('name') + '" class="row-input" style="flex:2"/>';
    h += bpMonthSel(gb + '_from', '', 1, H, og('from')) + '<span class="t-faint-sm">\u2013</span>' + bpMonthSel(gb + '_to', 'ongoing', 1, H, og('to'), true);
    h += '<span class="t-faint-sm" style="flex:1;text-align:right">\u2014</span><span style="width:26px"></span></div>'
  }
  h += '<div style="margin:6px 0 18px">' + btn('+ Add phase', 'bpAddPhase(' + i + ')', 'bg2', 'font-size:11px;padding:3px 10px') + '</div>';
  h += '<div class="mb-4"><div style="font-size:14px;color:var(--text-faint);margin-bottom:6px">Notes</div><textarea id="bpn_' + i + '_sus" rows="2" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="What keeps this running \u2013 platforms, licenses, people, retraining">' + esc((p.notes || {}).sus || '') + '</textarea></div>';
  return h
}
function bpAnchorLine(i) {
  var pj = (data.projects || {})[i] || {}; var committed = ((data.expSelected || []).indexOf(i) >= 0) || ((data.launched || []).indexOf(i) >= 0);
  if (!committed) return ''; var ps = (data.capital || {}).periodStart; if (!ps) return '';
  if (pj.legacy) return '<div class="t-faint-sm" style="margin:0 0 8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px">MONTHS COUNT FROM the period start \u2013 Legacy: month 1 is the opening position; costs before it are not shown.</div>';
  var a = anchorMonth(i); var pm = planMonthNow(i);
  var h = '<div style="margin:0 0 8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">';
  h += '<span class="t-faint-sm">MONTHS COUNT FROM</span><input type="date" id="prj_' + i + '_startDate" value="' + esc(pj.startDate || '') + '" onchange="capStartSave(' + i + ',this.value)" onblur="deferRender()" class="u-6293484"/>';
  h += '<span class="t-faint-sm">' + (pj.startDate ? ('committed start date' + (a != null ? ' \u00b7 program Month ' + a : '')) : 'no committed start date set') + '</span>';
  if (pj.startDate && pm != null && pm > 1) h += '<span class="fs-13" style="color:var(--warn-text)">\u26a0 ' + (pm - 1) + ' month' + (pm > 2 ? 's' : '') + ' have already passed since this date \u2013 moving it repositions the whole plan on the program calendar.</span>';
  h += '</div>'; return h
}
function bpBudgetTab(i, ro) {
  var _ro = ro || Collab.lockedByOther('budgetPlans::' + i);
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:0 0 4px"><div style="font-size:15px;font-weight:700;color:var(--paper)">Project Budgeting</div>' + (bpHasAny(i) ? pdfBtn('printBudgetSheet(' + i + ')', true) : '') + '</div><div class="t-faint-sm" style="margin-bottom:16px">Estimates of commitments over the length of the project period.</div>' + bpAnchorLine(i) + bpStatBand(i) + bpUndatedWarn(i);
  if (_ro) return h + '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:2px 0 18px"></div>' + bpCharts(i) + bpStepListRO(i);
  var p = bpGet(i) || {}, H = bpHorizon(i);
  h += '<div class="flx-center gap-2" style="margin:14px 0 4px;flex-wrap:wrap"><span class="t-faint-sm">ESTIMATED PROJECT LIFETIME</span><select id="bpm_' + i + '_horizon" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px" onchange="bpMetaSave(' + i + ',\'horizon\',this.value)">' + [3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (H === n ? ' selected' : '') + '>' + n + ' years</option>' }).join('') + '</select>' + (hzMismatch(i) ? '<span style="color:#C9403B;font-size:12px;font-weight:600">\u26a0 Longer than the organization\u2019s ' + envYearsOf() + '-year planning horizon \u2013 shorten it here or extend the horizon at Step 3.2.</span>' : '');
  h += '<span class="t-faint-sm" style="margin-left:40px">CONTINGENCY %</span><input id="bpm_' + i + '_contingency" value="' + esc(p.contingency || '') + '" placeholder="e.g. 10" onchange="bpMetaSave(' + i + ',\'contingency\',this.value)" class="row-input" style="width:64px;max-width:64px;flex:0 0 64px;text-align:center"/></div><div style="height:10px"></div>';
  h += bpAmber(i);
  h += bpStepTable(i, 'dev', 'DEVELOPMENT PHASES', 'Name each phase, give it a month range, and estimate its total cost. If this project advances to the development portfolio, you will expand on these phases in more detail.', [['e.g. Build and validate model', 'e.g. $120K'], ['e.g. Extended pilot', 'e.g. $60K']], H, 'Phase');
  h += bpStepTable(i, 'roll', 'ROLLOUT STEPS', 'Deployment waves, training, and any running costs rollout carries before sustainment begins', [['e.g. Deploy, train, and launch', 'e.g. $90K'], ['e.g. Remaining sites rollout', 'e.g. $40K']], H);
  h += bpSusTable(i, H);
  h += bpCharts(i);
  return h
}
function bpChartTitle(t) { return '<div style="margin:22px 0 6px;font-size:12px;font-weight:700;color:var(--paper);letter-spacing:.03em">' + t + '</div>' }
function bpChartShapeMM(mm, ct) {
  if (!mm.length) return '';
  var W = 720, Hh = 150, pad = 26, bw = (W - pad - 10) / mm.length, base = Hh - 16;
  var mx = 0; mm.forEach(function (r) { var v = r.dev + r.roll + r.sus; if (v > mx) mx = v }); if (!mx) return '';
  var sy = function (v) { return (Hh - 30) * (v / mx) };
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  h += '<line x1="' + pad + '" y1="' + base + '" x2="' + (W - 10) + '" y2="' + base + '" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
  mm.forEach(function (r, ix) {
    var x = pad + ix * bw; var tot = r.dev + r.roll + r.sus;
    var y = base;[[r.dev, '#45A188'], [r.roll, '#5B8DD9'], [r.sus, '#C25B73']].forEach(function (sg) { if (!sg[0]) return; var bh = sy(sg[0]); h += '<rect x="' + (x + .5).toFixed(1) + '" y="' + (y - bh).toFixed(1) + '" width="' + Math.max(.5, bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + sg[1] + '"/>'; y -= bh });
    if ((r.m || ix + 1) % 6 === 0 || ix === 0) h += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (Hh - 4) + '" text-anchor="middle" font-size="9" fill="#8A8278">' + (r.m || ix + 1) + '</text>'
  });
  var _pkIx = -1; mm.forEach(function (r, ix) { if (r.dev + r.roll + r.sus === mx && _pkIx < 0) _pkIx = ix });
  if (_pkIx >= 0) h += '<text x="' + (pad + _pkIx * bw + bw / 2).toFixed(1) + '" y="' + (base - sy(mx) - 4).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">P</text>';
  h += '<text x="' + pad + '" y="10" font-size="9" fill="#8A8278">P = peak month \u00b7 ' + fmtMoney(Math.round(mx)) + '</text>';
  return h + '</svg>'
}
function bpChartShape(i) { if (!bpHasAny(i)) return ''; return bpChartShapeMM(bpMonthly(i), parseFloat((bpGet(i) || {}).contingency) || 0) }
function bpChartLanes(i) {
  var H = bpHorizon(i) * 12; var lanes = [];
  [['dev', '#45A188'], ['roll', '#5B8DD9']].forEach(function (sg) { bpRows(i, sg[0]).forEach(function (x) { var sp = bpStepSpan(x); if (!sp || !bpStepMoney(x)) return; lanes.push({ n: x.name || '\u2014', a: sp[0], b: Math.min(sp[1], H), c: sg[1] }) }) });
  bpRows(i, 'sus').forEach(function (ph) { var sp = bpPhaseSpan(ph); if (!sp || !bpPhaseAnnual(ph)) return; lanes.push({ n: ph.name || 'Sustainment', a: sp[0], b: (sp[1] === Infinity ? H : Math.min(sp[1], H)), c: '#C25B73', ong: sp[1] === Infinity }) });
  if (!lanes.length) return '';
  var W = 720, rh = 17, pad = 160, Hh = lanes.length * rh + 20;
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  for (var yr = 1; yr <= H / 12; yr++) { var gx = pad + (yr - 1) * 12 / H * (W - pad - 14); h += '<line x1="' + gx.toFixed(1) + '" y1="0" x2="' + gx.toFixed(1) + '" y2="' + (Hh - 14) + '" stroke="rgba(245,242,236,.08)" stroke-width="1"/><text x="' + (gx + 2).toFixed(1) + '" y="' + (Hh - 4) + '" font-size="9" fill="#8A8278">Yr ' + yr + '</text>' }
  lanes.forEach(function (L, ix) {
    var y = ix * rh + 3;
    h += '<text x="' + (pad - 8) + '" y="' + (y + 10) + '" text-anchor="end" font-size="9" fill="#8A8278">' + esc(String(L.n).slice(0, 28)) + '</text>';
    var x1 = pad + (L.a - 1) / H * (W - pad - 14), x2 = pad + L.b / H * (W - pad - 14);
    h += '<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + Math.max(2, x2 - x1).toFixed(1) + '" height="' + (rh - 6) + '" rx="3" fill="' + L.c + '"' + (L.ong ? ' opacity=".75"' : '') + '><title>' + esc(L.n) + ' \u00b7 Months ' + L.a + '\u2013' + (L.ong ? 'ongoing' : L.b) + '</title></rect>'
  });
  return h + '</svg>'
}
function bpChartWaterfall(i) {
  var bars = [];
  [['dev', '#45A188'], ['roll', '#5B8DD9']].forEach(function (sg) { bpRows(i, sg[0]).forEach(function (x) { var v = bpStepMoney(x); if (v) bars.push({ n: x.name || '\u2014', v: v, c: sg[1] }) }) });
  for (var y = 1; y <= bpHorizon(i); y++) { var sv = bpSusYear(i, y); if (sv) bars.push({ n: 'Sustainment yr ' + y, v: sv, c: '#C25B73' }) }
  if (!bars.length) return '';
  var tot = 0; bars.forEach(function (b) { tot += b.v });
  var ct = parseFloat((bpGet(i) || {}).contingency) || 0; var grand = Math.round(tot * (1 + ct / 100));
  var W = 720, Hh = 170, pad = 26, bw = (W - pad - 84) / bars.length, base = Hh - 16;
  var sy = function (v) { return (Hh - 56) * (v / (grand || tot)) };
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  h += '<line x1="' + pad + '" y1="' + base + '" x2="' + (W - 10) + '" y2="' + base + '" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
  var run = 0; bars.forEach(function (b, ix) {
    var x = pad + ix * bw; var y1 = base - sy(run), y2 = base - sy(run + b.v);
    h += '<rect x="' + (x + 2).toFixed(1) + '" y="' + y2.toFixed(1) + '" width="' + Math.max(2, bw - 4).toFixed(1) + '" height="' + Math.max(1, (y1 - y2)).toFixed(1) + '" fill="' + b.c + '"><title>' + esc(b.n) + ' \u00b7 ' + fmtMoney(b.v) + (ct ? ' \u00b7 ' + fmtMoney(Math.round(b.v * (1 + ct / 100))) + ' with contingency' : '') + '</title></rect>';
    if (ct) { var ch2 = sy(b.v * ct / 100); h += '<rect x="' + (x + 2).toFixed(1) + '" y="' + (y2 - ch2).toFixed(1) + '" width="' + Math.max(2, bw - 4).toFixed(1) + '" height="' + Math.max(.5, ch2).toFixed(1) + '" fill="rgba(245,242,236,.16)"><title>+' + ct + '% contingency on ' + esc(b.n) + '</title></rect>' }
    if (ix < bars.length - 1) h += '<line x1="' + (x + 2).toFixed(1) + '" y1="' + y2.toFixed(1) + '" x2="' + (x + bw + 2).toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="rgba(245,242,236,.3)" stroke-dasharray="2,2" stroke-width="1"/>';
    run += b.v
  });
  h += '<rect x="' + (W - 78) + '" y="' + (base - sy(tot)).toFixed(1) + '" width="26" height="' + sy(tot).toFixed(1) + '" fill="rgba(245,242,236,.25)"/>';
  if (ct) {
    h += '<rect x="' + (W - 78) + '" y="' + (base - sy(grand)).toFixed(1) + '" width="26" height="' + Math.max(.5, sy(grand) - sy(tot)).toFixed(1) + '" fill="rgba(245,242,236,.12)"><title>Contingency (' + ct + '%) \u00b7 ' + fmtMoney(grand - tot) + '</title></rect>';
    h += '<text x="' + (W - 10) + '" y="12" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">' + fmtMoney(tot) + ' base</text>';
    h += '<text x="' + (W - 10) + '" y="25" text-anchor="end" font-size="9" fill="#8A8278">' + fmtMoney(grand) + ' with ' + ct + '% contingency</text>'
  }
  else { h += '<text x="' + (W - 10) + '" y="12" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">' + fmtMoney(tot) + ' lifetime</text>' }
  return h + '</svg>'
}
function bpChartCumMM(mm, steady, ct) {
  if (!mm.length) return ''; ct = ct || 0;
  var W = 720, Hh = 150, pad = 26, base = Hh - 16; var tot = 0, pts = [];
  mm.forEach(function (r) { tot += r.dev + r.roll + r.sus; pts.push(tot) }); if (!tot) return '';
  var grand = tot * (1 + ct / 100);
  var sx = function (ix) { return pad + (ix + 1) / mm.length * (W - pad - 36) };
  var sy = function (v) { return base - (Hh - 58) * (v / (grand || tot)) };
  var d = 'M ' + pad + ' ' + base; pts.forEach(function (v, ix) { d += ' L ' + sx(ix).toFixed(1) + ' ' + sy(v).toFixed(1) });
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  h += '<line x1="' + pad + '" y1="' + base + '" x2="' + (W - 10) + '" y2="' + base + '" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
  h += '<path d="' + d + ' L ' + sx(pts.length - 1).toFixed(1) + ' ' + base + ' Z" fill="rgba(139,94,60,.18)"/>';
  h += '<path d="' + d + '" fill="none" stroke="#45A188" stroke-width="2"/>';
  if (ct) {
    var d2 = 'M ' + pad + ' ' + base; pts.forEach(function (v, ix) { d2 += ' L ' + sx(ix).toFixed(1) + ' ' + sy(v * (1 + ct / 100)).toFixed(1) });
    h += '<path d="' + d2 + '" fill="none" stroke="rgba(245,242,236,.5)" stroke-width="1.5" stroke-dasharray="4,3"><title>With ' + ct + '% contingency</title></path>';
  }
  var _ex = sx(pts.length - 1).toFixed(1);
  h += '<text x="' + _ex + '" y="14" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">' + fmtMoney(tot) + (ct ? ' base' : '') + '</text>';
  if (ct) h += '<text x="' + _ex + '" y="27" text-anchor="end" font-size="9" fill="#8A8278">' + fmtMoney(Math.round(grand)) + ' with ' + ct + '% contingency</text>';
  if (steady) h += '<text x="' + _ex + '" y="' + (ct ? 40 : 27) + '" text-anchor="end" font-size="9" fill="#8A8278">Continuing costs beyond Year ' + Math.round(mm.length / 12) + ' = ' + fmtMoney(steady) + '/yr</text>';
  return h + '</svg>'
}
function bpChartCum(i) { if (!bpHasAny(i)) return ''; return bpChartCumMM(bpMonthly(i), bpSusSteady(i), parseFloat((bpGet(i) || {}).contingency) || 0) }
function bpChartsGhost() {
  var mm = []; for (var m = 1; m <= 36; m++) { mm.push({ m: m, dev: (m <= 9 ? 60000 + m * 4000 : 0), roll: (m >= 8 && m <= 14 ? 70000 : 0), sus: (m >= 13 ? 11000 : 0) }) }
  return '<div style="opacity:.35;pointer-events:none">' + bpChartTitle('MONTHLY SPEND SHAPE') + bpChartShapeMM(mm, 0) + bpChartTitle('CUMULATIVE COST') + bpChartCumMM(mm, 132000) + '</div>'
    + '<p class="t-faint-sm" style="margin:6px 0 0">The pictures your plan will draw \u2013 the spend shape, step timeline, and cumulative cost appear as steps gain months and money.</p>'
}
function bpChartLegend() { return '<div class="t-faint-sm" style="margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#45A188;border-radius:2px;margin-right:4px"></span>Development <span style="display:inline-block;width:10px;height:10px;background:#5B8DD9;border-radius:2px;margin:0 4px 0 12px"></span>Rollout <span style="display:inline-block;width:10px;height:10px;background:#C25B73;border-radius:2px;margin:0 4px 0 12px"></span>Sustainment</div>' }
function bpCharts(i) {
  if (!bpHasAny(i)) return bpChartsGhost();
  var ct = parseFloat((bpGet(i) || {}).contingency) || 0; var h = '';
  h += '<div style="display:flex;align-items:flex-end;gap:8px"><div style="flex:1">' + bpChartTitle('MONTHLY SPEND SHAPE') + '</div>' + zoomBtn('bpshape_' + i) + '</div>' + bpChartShape(i) + bpChartLegend();
  var ln = bpChartLanes(i); if (ln) h += bpChartTitle('STEP TIMELINE') + ln;
  var wf = bpChartWaterfall(i); if (wf) h += bpChartTitle('HOW THE LIFETIME TOTAL BUILDS') + wf;
  h += '<div style="display:flex;align-items:flex-end;gap:8px"><div style="flex:1">' + bpChartTitle('CUMULATIVE COST \u2013 lifetime, including ongoing sustainment') + '</div>' + zoomBtn('bpcum_' + i) + '</div>' + bpChartCum(i);
  return h
}
function bpSheetInk(svg) { return String(svg || '').split('#8A8278').join('#6b6257').split('rgba(245,242,236,.25)').join('rgba(26,22,18,.35)').split('rgba(245,242,236,.3)').join('rgba(26,22,18,.35)').split('rgba(245,242,236,.12)').join('rgba(26,22,18,.08)').split('rgba(245,242,236,.08)').join('rgba(26,22,18,.08)').split('#F5F2EC').join('#1a1612') }
function renderBudgetSheetFor(i) {
  var idea = (data.ideas || [])[i] || {}; var st = getStages();
  var stg = ((st.operational || []).indexOf(i) >= 0) ? 'Operational' : (st.experiment.indexOf(i) >= 0 ? 'Development' : 'Exploration');
  var p = bpGet(i) || {}, H = bpHorizon(i);
  var CD = '#45A188', CR = '#5B8DD9', CS = '#C25B73', CG = '#1B6B5A';
  var stgC = stg === 'Operational' ? CS : (stg === 'Development' ? CD : CG);
  var sec10 = function (t, c, m) { return '<div style="font-size:10px;font-weight:700;color:' + (c || '#6b6257') + ';text-transform:uppercase;letter-spacing:.5px;margin:' + (m || '10px 0 3px') + '">' + t + '</div>' };
  var h = '<div style="border-bottom:3px solid ' + CG + ';padding-bottom:10px;margin-bottom:12px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:baseline"><h1 style="font-size:22px;letter-spacing:-.3px">' + esc(idea.name || ('Item ' + i)) + '</h1><span style="font-size:12px;color:#6b6257">Estimate \u00b7 ' + fmtDate(new Date()) + '</span></div>';
  h += '<div style="font-size:12px;color:#6b6257;margin-top:2px"><span style="color:' + stgC + ';font-weight:700">' + stg + ' Portfolio</span> \u00b7 Project Budget Sheet</div></div>';
  var life = bpLifetime(i), ssv = bpSusSteady(i), pk = bpPeakMonth(i), fo = bpFirstOpMonth(i);
  var cellS = function (v, l) { return '<div style="flex:1;min-width:90px;text-align:center"><div style="font-size:17px;font-weight:800">' + v + '</div><div style="font-size:10px;color:#6b6257;text-transform:uppercase;letter-spacing:.4px">' + l + '</div></div>' };
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">' + cellS(fmtMoney(life), 'Lifetime \u00b7 ' + H + ' yrs') + cellS(fmtMoney(bpDevTotal(i)), 'Development') + cellS(fmtMoney(bpRollTotal(i)), 'Rollout') + cellS(ssv ? fmtMoney(ssv) + '/yr' : '\u2014', 'Steady state') + (pk ? cellS('Month ' + pk, 'Peak spend') : '') + cellS('Month ' + fo, 'First operational') + '</div>';
  var ct = parseFloat(p.contingency); if (ct > 0) h += '<p style="font-size:11px;color:#6b6257;margin:0 0 6px">With ' + ct + '% contingency: ' + fmtMoney(Math.round(life * (1 + ct / 100))) + ' lifetime.</p>';
  var bdr = 'border-bottom:1px solid rgba(26,22,18,.08)';
  var tbl = function (sec, title, color) {
    var rows = bpRows(i, sec).filter(function (x) { return bpStepSpan(x) || bpStepMoney(x) }); if (!rows.length) return '';
    var t = sec10(title, color) + '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    rows.forEach(function (x) { var sp = bpStepSpan(x); t += '<tr><td style="padding:2px 4px 2px 0;' + bdr + '">' + esc(x.name || '\u2014') + '</td><td style="padding:2px 4px;' + bdr + ';white-space:nowrap;color:#6b6257">' + (sp ? sp[0] + '\u2013' + sp[1] : '\u2014') + '</td><td style="padding:2px 0 2px 4px;' + bdr + ';text-align:right;white-space:nowrap;font-weight:600">' + fmtMoney(bpStepMoney(x)) + '</td></tr>' });
    return t + '</table>'
  };
  var sus = ''; var phs = bpRows(i, 'sus').filter(function (x) { return bpPhaseSpan(x) && bpPhaseAnnual(x) });
  if (phs.length) {
    sus = sec10('Sustainment phases', CS) + '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    phs.forEach(function (x) {
      var sp = bpPhaseSpan(x);
      sus += '<tr><td style="padding:2px 4px 2px 0;' + bdr + '">' + esc(x.name || '\u2014') + '</td><td style="padding:2px 4px;' + bdr + ';white-space:nowrap;color:#6b6257">from ' + sp[0] + (sp[1] === Infinity ? ' \u00b7 ongoing' : ' to ' + sp[1]) + '</td><td style="padding:2px 0 2px 4px;' + bdr + ';text-align:right;white-space:nowrap;font-weight:600">' + fmtMoney(bpPhaseAnnual(x)) + '/yr</td></tr>';
      (x.items || []).forEach(function (it) {
        if (!it || !String((it.name || '') + (it.cost || '')).trim()) return;
        sus += '<tr><td style="padding:1px 4px 1px 12px;color:#6b6257">' + esc(it.name || '') + '</td><td></td><td style="padding:1px 0 1px 4px;text-align:right;color:#6b6257">' + fmtMoney(costNum(it.cost)) + '/yr</td></tr>'
      })
    });
    sus += '</table>'
  }
  h += '<div style="display:flex;gap:22px;align-items:flex-start"><div style="flex:3;min-width:0">';
  h += sec10('Monthly spend shape', null, '4px 0 3px') + bpSheetInk(bpChartShape(i));
  h += sec10('How the lifetime total builds') + bpSheetInk(bpChartWaterfall(i));
  h += sec10('Cumulative cost') + bpSheetInk(bpChartCum(i));
  h += '</div><div style="flex:2;min-width:0">' + tbl('dev', 'Development phases', CD) + tbl('roll', 'Rollout steps', CR) + sus + '</div></div>';
  var ln = bpChartLanes(i); if (ln) h += sec10('Step timeline', null, '12px 0 3px') + bpSheetInk(ln);
  var nx = [];[['dev', 'Development'], ['roll', 'Rollout'], ['sus', 'Sustainment']].forEach(function (sc) { var v = String(((p.notes || {})[sc[0]]) || '').trim(); if (v) nx.push('<strong>' + sc[1] + ':</strong> ' + esc(v.length > 220 ? v.slice(0, 220) + '\u2026' : v)) });
  if (nx.length) h += '<div style="font-size:11px;color:#3a352e;margin-top:10px;line-height:1.5">' + nx.join('<br/>') + '</div>';
  h += '<div style="border-top:1px solid rgba(26,22,18,.15);margin-top:14px;padding-top:6px;display:flex;justify-content:space-between;font-size:10px;color:#6b6257"><span>All figures are estimates of commitments, not tracked spend.</span><span>90 Days to an AI Innovation Pipeline</span></div>';
  return h
}
function printBudgetSheet(i) { var idea = (data.ideas || [])[i] || {}; printPage((idea.name || ('Item ' + i)) + ' \u2013 Budget Sheet', function () { return renderBudgetSheetFor(i) }) }
function bpMetaSave(i, k, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); p[k] = val; Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpRowSave(i, sec, id, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); var r = (p[sec] || []).filter(function (x) { return x && x.id === id })[0]; if (!r) return; if (f === 'pstatus' && val === 'complete' && r.pstatus !== 'complete' && !confirm('Mark this phase complete?')) { render(); return } r[f] = val; if (f === 'from') { var a = parseInt(val, 10), b = parseInt(r.to, 10); if (a && b && b < a) r.to = val } Store.commit('budgetPlans', i); if (f !== 'powner' && f !== 'pmetric' && f !== 'pexit') { data.capStale = true; Store.commit('capStale') } render() }
function bpGhostSave(i, sec, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; if (!String(val == null ? '' : val).trim()) return; var p = bpEnsure(i); var r = { id: uid(), name: '', desc: '', from: '', to: '', cost: '' }; r[f] = val; if (!p[sec]) p[sec] = []; p[sec].push(r); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpAddStep(i, sec) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); if (!p[sec]) p[sec] = []; p[sec].push({ id: uid(), name: '', desc: '', from: '', to: '', cost: '' }); Store.commit('budgetPlans', i); render() }
function bpDelStep(i, sec, id) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); p[sec] = (p[sec] || []).filter(function (x) { return !x || x.id !== id }); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpPhSave(i, id, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); var r = (p.sus || []).filter(function (x) { return x && x.id === id })[0]; if (!r) return; r[f] = val; if (f === 'from' && val && r.to && r.to !== 'ongoing') { var a = parseInt(val, 10), b = parseInt(r.to, 10); if (a && b && b < a) r.to = val } Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpGhostPhase(i, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; if (!String(val == null ? '' : val).trim()) return; var p = bpEnsure(i); var r = { id: uid(), name: '', from: '', to: 'ongoing', items: [] }; r[f] = val; if (!p.sus) p.sus = []; p.sus.push(r); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpAddPhase(i) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); if (!p.sus) p.sus = []; p.sus.push({ id: uid(), name: '', from: '', to: 'ongoing', items: [] }); Store.commit('budgetPlans', i); render() }
function bpDelPhase(i, id) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); p.sus = (p.sus || []).filter(function (x) { return !x || x.id !== id }); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpItemSave(i, ph, id, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); var r = (p.sus || []).filter(function (x) { return x && x.id === ph })[0]; if (!r) return; var it = (r.items || []).filter(function (x) { return x && x.id === id })[0]; if (!it) return; it[f] = val; Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpGhostItem(i, ph, f, val) { if (Collab.lockedByOther('budgetPlans::' + i)) return; if (!String(val == null ? '' : val).trim()) return; var p = bpEnsure(i); var r = (p.sus || []).filter(function (x) { return x && x.id === ph })[0]; if (!r) return; if (!r.items) r.items = []; var it = { id: uid(), name: '', cost: '' }; it[f] = val; r.items.push(it); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function bpDelItem(i, ph, id) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); var r = (p.sus || []).filter(function (x) { return x && x.id === ph })[0]; if (!r) return; r.items = (r.items || []).filter(function (x) { return !x || x.id !== id }); Store.commit('budgetPlans', i); data.capStale = true; Store.commit('capStale'); render() }
function planMonthNow(i) { var a = anchorMonth(i); if (a == null) return null; var pm = progMonthOf(new Date()); if (pm == null) return null; return pm - a + 1 }
function opYear(i) {
  if (bpPlanLive(i)) { var pmn = planMonthNow(i), fo = bpFirstOpMonth(i); if (pmn != null && fo) { if (pmn < fo) return 1; return Math.floor((pmn - fo) / 12) + 1 } }
  var od = (data.opsData || {})[i] || {}; var lt = od.launchDate ? Date.parse(od.launchDate) : NaN; if (isNaN(lt)) return 1; var m = monthsAbs(new Date()) - monthsAbs(new Date(lt)); return Math.max(1, Math.floor(m / 12) + 1)
}
function prjDevYear(i, k) {
  if (k < 1) return 0; if (bpDevLive(i)) return bpCatYear(i, 'dev', k);
  if (k !== 1) return 0; var b = costNum((((data.experiments || {})[i]) || {}).budget); return b || projCosts(i).start
}
function prjRollYear(i, k) {
  if (k < 1) return 0; if (bpRollLive(i)) return bpCatYear(i, 'roll', k);
  if (k !== 1) return 0; var r = costNum((((data.opsData || {})[i]) || {}).rolloutCost); return r || projCosts(i).roll
}
function prjSusYear(i, k) { if (k < 1) return 0; if (bpHasSus(i)) return bpSusYear(i, k); if (k < 2) return 0; var r = costNum((((data.opsData || {})[i]) || {}).runCost); return r || projCosts(i).run }
function devCost(i) { if (bpDevLive(i)) return bpDatedTotal(i, 'dev'); var b = costNum((((data.experiments || {})[i]) || {}).budget); return b || projCosts(i).start }
function opsRolloutCost(i) { if (bpRollLive(i)) return bpDatedTotal(i, 'roll'); var r = costNum((((data.opsData || {})[i]) || {}).rolloutCost); return r || projCosts(i).roll }
function opsSustainCost(i) { if (bpHasSus(i)) return bpSusOpYear(i, opYear(i)); var r = costNum((((data.opsData || {})[i]) || {}).runCost); return r || projCosts(i).run }
function ensureCapCostModel() {
  try {
    var st = getStages();
    function blank(v) { return !String(v == null ? '' : v).trim() }
    st.experiment.concat(st.operational || []).forEach(function (i) {
      var pr = (data.projects || {})[i] || {};
      if (blank(pr.startupCost)) return; if (!data.experiments) data.experiments = {}; if (!data.experiments[i]) data.experiments[i] = {};
      if (blank(data.experiments[i].budget)) { data.experiments[i].budget = pr.startupCost; Store.commit('experiments', i) }
    });
    (st.operational || []).forEach(function (i) {
      var pr = (data.projects || {})[i] || {};
      if (!data.opsData) data.opsData = {}; if (!data.opsData[i]) data.opsData[i] = {};
      if (!blank(pr.runningCost) && blank(data.opsData[i].runCost)) { data.opsData[i].runCost = pr.runningCost; Store.commit('opsData', i) }
      if (!blank(pr.rolloutCost) && blank(data.opsData[i].rolloutCost)) { data.opsData[i].rolloutCost = pr.rolloutCost; Store.commit('opsData', i) }
    });
  } catch (e) { }
}
function opFirstYear(i) {
  if ((((data.projects || {})[i]) || {}).legacy) return false;
  if (bpPlanLive(i) && anchorMonth(i) != null && progMonthOf(new Date()) != null && bpFirstOpMonth(i)) { var _pm = planMonthNow(i); if (_pm != null) return _pm < bpFirstOpMonth(i) }
  var d = (data.opsData || {})[i] || {}; if (!d.launchDate) return true; var t = Date.parse(d.launchDate); if (isNaN(t)) return true; return (Date.now() - t) < 31536000000
}
function csNotesFold() { return '<div style="margin:2px 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'csNotes\']=!UI.expanded[\'csNotes\'];render()">' + (UI.expanded['csNotes'] ? '\u25be' : '\u25b8') + ' Notes</button>' + (UI.expanded['csNotes'] ? '<p class="t-faint-sm" style="margin:6px 0 0">A project commits its entire planned spend from the moment it is advanced. Every development, rollout, and sustainment month that lands inside the planning window counts toward the Committed cost, regardless of the stage the project is in today. Killing a project releases funds for phases that have not yet begun back to the budget. The phases that have already started stay committed. Pausing a project holds its commitments unchanged. If a long pause adds real costs, such as license months or restart work, open the project\u2019s development track at Step 3.4 and add the amount to the phase it is paused in, or add a new phase covering the pause months, then push the later phases\u2019 dates out to match the new timeline. The committed sum recalculates from the phases automatically.</p>' : '') + '</div>' }
function susProgTotal(i, ops) {
  var M = envYearsOf() * 12, t = 0, m;
  if (ops) { var s = orgProjectMonthly(i, true, M); for (m = 0; m < M; m++)t += s[m].sus; return Math.round(t) }
  if (!bpPlanLive(i)) return 0; var fo = bpFirstOpMonth(i); if (!fo || fo > M) return 0; return Math.round(opsSustainCost(i) / 12 * (M - fo + 1))
}
function csvq(v) { v = String(v == null ? '' : v); return (v.indexOf(',') >= 0 || v.indexOf('"') >= 0) ? '"' + v.replace(/"/g, '""') + '"' : v }
function buildAuditCSV() {
  var ps = (data.capital || {}).periodStart; if (!ps || isNaN(Date.parse(ps))) return null;
  var M = envYearsOf() * 12; var d0 = new Date(ps); var ideas = data.ideas || [];
  var out = ['AUDIT EXPORT \u2013 every figure on the money surfaces is a filter-and-sum of the PROJECT MONTHS table below'];
  out.push(''); out.push('PROJECT MONTHS');
  out.push('project_id,project_name,stage,program_month,calendar_month,development,rollout,sustainment,month_total');
  orgCommittedSet().forEach(function (e) {
    var s2 = orgProjectMonthly(e.i, e.op, M, null, e.sunk); var nm = (ideas[e.i] || {}).name || ('Item ' + e.i); var st = e.sunk ? 'Development (killed \u2013 entered phases held)' : (e.op ? 'Operational' : 'Development');
    for (var m = 0; m < M; m++) {
      var r = s2[m]; var t = r.dev + r.roll + r.sus; if (t < 0.5) continue;
      var cd = new Date(d0.getFullYear(), d0.getMonth() + m, 1); var cs = cd.getFullYear() + '-' + String(cd.getMonth() + 1).padStart(2, '0');
      out.push([e.i, csvq(nm), st, m + 1, cs, Math.round(r.dev), Math.round(r.roll), Math.round(r.sus), Math.round(t)].join(','))
    }
  });
  var L = capLens();
  out.push(''); out.push('ENVELOPE BY YEAR'); out.push('year,budget,committed,kill_pot,available');
  L.years.forEach(function (r) { out.push([r.y, Math.round(r.budget), Math.round(r.committed), Math.round(r.killPot), Math.round(r.available)].join(',')) });
  out.push(['TOTAL', Math.round(L.tot.budget), Math.round(L.tot.committed), Math.round(L.tot.killPot), Math.round(L.tot.available)].join(','));
  if (L.beyond) { out.push(''); out.push('BEYOND THE PLANNING WINDOW (not counted above),' + Math.round(L.beyond) + ',' + L.beyondN + ' project(s)') }
  var kr = killPotRows(); if (kr.length || costNum((data.capital || {}).killCosts)) {
    out.push(''); out.push('KILL & PHASE-OUT POT'); out.push('description,amount,year');
    if (costNum((data.capital || {}).killCosts)) out.push(csvq('(legacy pot field)') + ',' + costNum((data.capital || {}).killCosts) + ',1');
    kr.forEach(function (r) { out.push(csvq(r.d || '') + ',' + costNum(r.a) + ',' + killPotYearOf(r)) })
  }
  return out.join('\n')
}
function dlAuditCSV() {
  var c = buildAuditCSV(); if (!c) { try { alert('Set the period start date at Step 3.2 first \u2013 the audit table needs the program calendar.') } catch (e) { } return }
  var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(c); a.download = 'capital_audit.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
function capAssumedExtra(i) { var sd = ((data.projects || {})[i] || {}).startDate; var a = sd ? progMonthOf(sd) : null; if (a == null || a < 1) { var pm = progMonthOf(new Date()); a = Math.max(1, (pm == null ? 0 : pm) + 1) } return { i: i, anchor: a } }
function capDevWindow(i, aOv) {
  var full = devCost(i); var ps = (data.capital || {}).periodStart;
  if (!ps || isNaN(Date.parse(ps))) return { inW: full, beyond: 0 };
  var M = envYearsOf() * 12; var s = orgProjectMonthly(i, false, M, aOv); var w = 0; for (var m = 0; m < M; m++)w += s[m].dev;
  w = Math.round(w); if (w > full) w = full; return { inW: w, beyond: Math.max(0, full - w) }
}
function capProjectWindow(i, aOv) {
  var ps = (data.capital || {}).periodStart;
  var full = 0; if (bpPlanLive(i)) { bpMonthly(i).forEach(function (r) { full += r.dev + r.roll + r.sus }) } else { full = devCost(i) + opsRolloutCost(i) }
  full = Math.round(full);
  if (!ps || isNaN(Date.parse(ps))) return { inW: full, beyond: 0 };
  var M = envYearsOf() * 12; var op = (getStages().operational || []).indexOf(i) >= 0; var s2 = orgProjectMonthly(i, op, M, aOv); var w = 0; for (var m = 0; m < M; m++)w += s2[m].dev + s2[m].roll + s2[m].sus;
  w = Math.round(w); return { inW: w, beyond: Math.max(0, full - w) }
}
function killPotYearOf(r) { var y = parseInt(r && r.y, 10); var Y = envYearsOf(); return (y >= 1 && y <= Y) ? y : 1 }
function killPotYear(y) { var t = (y === 1) ? costNum((data.capital || {}).killCosts) : 0; killPotRows().forEach(function (r) { if (killPotYearOf(r) === y) t += costNum(r.a) }); return t }
function capLens(extras) {
  var Y = envYearsOf(); var yt = orgYearTotals(extras); var years = [], tb = 0, tc = 0, tk = 0;
  for (var y = 1; y <= Y; y++) {
    var r = yt && yt[y - 1] ? yt[y - 1] : null; var bud = envBudgetYear(y); var com = r ? r.total : 0; var kp = killPotYear(y);
    years.push({ y: y, budget: bud, budgetSet: r ? r.budgetSet : false, committed: com, killPot: kp, available: bud - com - kp }); tb += bud; tc += com; tk += kp
  }
  var beyond = 0, beyondN = 0; orgCommittedSet().forEach(function (e) { var w = capProjectWindow(e.i, null); if (e.sunk) return; if (w.beyond) { beyond += w.beyond; beyondN++ } });
  (extras || []).forEach(function (e) { var w = capProjectWindow(e.i, e.anchor); if (w.beyond) { beyond += w.beyond; beyondN++ } });
  return { years: years, tot: { budget: tb, committed: tc, killPot: tk, available: tb - tc - tk }, beyond: beyond, beyondN: beyondN }
}
function capCommitments() {
  var st = getStages(), trk = data.tracking || {}, ideas = data.ideas || [], rows = [], dev = 0, op = 0, beyond = 0, beyondN = 0;
  (st.operational || []).forEach(function (i) { if (((trk[i] || {}).status) === 'killed') return; var _w = capProjectWindow(i); rows.push({ i: i, name: (ideas[i] || {}).name || ('Item ' + i), stage: 'Operational', status: 'Live', label: 'Full plan' + (_w.beyond ? ' (within the planning window)' : ''), amt: _w.inW, beyond: _w.beyond }); op += _w.inW; beyond += _w.beyond; if (_w.beyond) beyondN++ });
  st.experiment.forEach(function (i) { var s = (trk[i] || {}).status || ''; if (s === 'killed') { var _ks = killSunkDev(i); if (_ks > 0) { rows.push({ i: i, name: (ideas[i] || {}).name || ('Item ' + i), stage: 'Development', status: 'killed', label: 'Development Costs \u2013 entered phases held', amt: _ks }); dev += _ks } return } var _w = capProjectWindow(i); rows.push({ i: i, name: (ideas[i] || {}).name || ('Item ' + i), stage: 'Development', status: s === 'paused' ? 'Paused (held)' : s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Active', label: 'Full plan' + (_w.beyond ? ' (within the planning window)' : ''), amt: _w.inW, beyond: _w.beyond }); dev += _w.inW; beyond += _w.beyond; if (_w.beyond) beyondN++ });
  return { rows: rows, dev: dev, op: op, total: dev + op, beyond: beyond, beyondN: beyondN }
}
function capAvailable() { var com = capCommitments(); var cap = data.capital || {}; var b = envBudgetYear(1); var kp = killPotTotal(); return { budget: b, committed: com.total, killPot: kp, available: b - com.total - kp, beyond: com.beyond || 0, beyondN: com.beyondN || 0, com: com } }
function capCells(big, extras) {
  var L = capLens(extras); var Y = envYearsOf();
  if (UI.capYear == null) UI.capYear = 1; if (UI.capYear !== 'T' && !(UI.capYear >= 1 && UI.capYear <= Y)) UI.capYear = 1;
  var sel = UI.capYear; var d = sel === 'T' ? L.tot : L.years[sel - 1];
  var tb = function (k, lbl) { return '<button class="btn-ghost pad-chip-sm" style="font-size:11.5px;padding:4px 12px;' + (sel === k ? 'background:rgba(var(--fg-rgb),.10);color:var(--paper)' : '') + '" onclick="UI.capYear=' + (k === 'T' ? "'T'" : k) + ';render()">' + lbl + '</button>' };
  var tabs = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px">' + L.years.map(function (r) { return tb(r.y, 'Year ' + r.y) }).join('') + tb('T', 'Total') + '</div>';
  var cs = 'score-num-' + (big ? 'go' : 'md'); var okc = big ? 'var(--ph1-t)' : '#1B6B5A';
  var cells = [{ v: fmtMoney(d.budget), l: sel === 'T' ? 'Budget \u2013 ' + Y + ' years' : 'Budget, Year ' + sel }, { v: '\u2212 ' + fmtMoney(d.committed), l: 'Committed' }];
  if (d.killPot) cells.push({ v: '\u2212 ' + fmtMoney(d.killPot), l: 'Kill & phase-out' });
  cells.push({ v: fmtMoney(d.available), l: 'Available', c: d.available < 0 ? '#9B2D3F' : okc });
  return tabs + '<div style="display:flex;gap:14px;flex-wrap:wrap">' + cells.map(function (x) { return '<div class="t-center" style="flex:1;min-width:110px"><div class="' + cs + '"' + (x.c ? ' style="color:' + x.c + '"' : '') + '>' + x.v + '</div><div class="t-fade-md">' + x.l + '</div></div>' }).join('') + '</div>'
    + (L.beyond ? '<p class="fs-13" style="margin:8px 0 0;color:var(--text-soft)">Committed funds falling beyond the planning window: ' + fmtMoney(L.beyond) + ' across ' + L.beyondN + ' project' + (L.beyondN > 1 ? 's' : '') + ' \u2013 these months lie outside the ' + Y + '-year period and are not counted above.</p>' : '')
    + '<p class="t-faint-sm" style="margin:' + (L.beyond ? 4 : 8) + 'px 0 0">Committed is the full cost of every live plan \u2013 all development, rollout, and sustainment months landing in ' + (sel === 'T' ? 'the ' + Y + '-year window' : 'Year ' + sel) + '. This figure provides planning estimates. It does not track live spend.</p>'
}
var FY_MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function periodStartMonth() {
  var fm = parseInt((data.capital || {}).fyStartMonth, 10); if (fm >= 1 && fm <= 12) return fm; /* explicit fiscal-year start (optional, Step 3.2) wins – display convention only, money math never reads this */
  var ps = (data.capital || {}).periodStart; var t = ps ? Date.parse(ps) : NaN; if (!isNaN(t)) return new Date(t).getMonth() + 1; return 1
}
function fyQuarterOf(d) { var s = periodStartMonth() - 1; var mIdx = (d.getMonth() - s + 12) % 12; var q = Math.floor(mIdx / 3) + 1; var qAbs = d.getFullYear() * 12 + d.getMonth() - (mIdx % 3); var fyAbs = qAbs - (q - 1) * 3; return { q: q, fyYear: Math.floor(fyAbs / 12), start: new Date(Math.floor(qAbs / 12), qAbs % 12, 1), endEx: new Date(Math.floor((qAbs + 3) / 12), (qAbs + 3) % 12, 1) } }
function fmtQuarter(qi) { return 'Program Q' + qi.q + ' (' + FY_MN[qi.start.getMonth()] + '\u2013' + FY_MN[(qi.endEx.getMonth() + 11) % 12] + ')' }
function fyToday() { var t = new Date(); return 'Today\'s date: ' + fmtDate(t) + ' \u00b7 ' + fmtQuarter(fyQuarterOf(t)) }
/* Review-horizon conventions (settled July 2): first review at day 90 on the program
   clock; decisions take effect on the 1st of the month after a review closes; each
   horizon runs to the end of the fiscal quarter it lands in (a stub if short), clean
   quarters thereafter. All money math is whole months; the program clock never touches money. */
function nextReviewInfo() {
  var cyc = data.reviewCycles || [];
  if (!cyc.length) { if (!data.startDate) return null; var t = Date.parse(data.startDate); if (isNaN(t)) return null; return { date: new Date(t + 90 * 86400000), first: true } }
  var last = new Date(cyc[cyc.length - 1].at); var eff = new Date(last.getFullYear(), last.getMonth() + 1, 1); var qi = fyQuarterOf(eff);
  var months = (qi.endEx.getFullYear() * 12 + qi.endEx.getMonth()) - (eff.getFullYear() * 12 + eff.getMonth());
  return { date: new Date(qi.endEx.getFullYear(), qi.endEx.getMonth(), qi.endEx.getDate() - 1), first: false, qi: qi, months: months, stub: months !== 3, effective: eff }
}
function monthsAbs(d) { return d.getFullYear() * 12 + d.getMonth() }
/* === ORGANIZATIONAL CALENDAR ENGINE (org chunk J1). Month 1 = the period
   start. Committed projects (Development + Operational, not killed) place
   their monthly figures at their anchor date; projects without a plan follow
   the whole-month lump rules;
   capacity and the sustainment cap spread flat per year. Estimates of
   commitments, never spend; the past never redraws. === */
function progMonthOf(t) { var ps = (data.capital || {}).periodStart; if (!ps) return null; var a = Date.parse(ps); if (isNaN(a)) return null; var d = (t instanceof Date) ? t : new Date(t); if (isNaN(d.getTime())) return null; return monthsAbs(d) - monthsAbs(new Date(a)) + 1 }
function anchorMonth(i) { var pj = (data.projects || {})[i] || {}; if (pj.legacy) return 1; if (pj.startDate) { var p = progMonthOf(pj.startDate); if (p != null) return p } if (pj.advancedAt) { var p2 = progMonthOf(pj.advancedAt); if (p2 != null) return p2 } return null }
function orgCommittedSet() {
  var st = getStages(), trk = data.tracking || {}; var out = [];
  (st.operational || []).forEach(function (i) { if (((trk[i] || {}).status) !== 'killed') out.push({ i: i, op: true }) });
  (st.experiment || []).forEach(function (i) { if (((trk[i] || {}).status) !== 'killed') out.push({ i: i, op: false }); else if (killSunkDev(i) > 0) out.push({ i: i, op: false, sunk: true }) });
  return out
}
/* Development-program kill calculus (Paul ruling, July 5): money enters a phase at its
   start month (or when marked running/complete, or its gate taken) and does not come back.
   A kill releases every phase not yet entered; entered phases stay committed and charted.
   Plan-less items have no phases, so a kill releases the whole estimate (unchanged). The
   entered set is frozen at kill time (killSunkIds); revival clears it. */
function phEnteredStep(i, x) { return !!(x && (x.pstatus === 'running' || x.pstatus === 'complete' || x.gateDec)) } /* Entered means work has begun in fact – running, complete, or gate-decided. The calendar fallback (start month passed) was removed July 7 (Paul): an Unstarted phase has spent nothing, so a kill releases it. */
function killReleasePreview(i) {
  var pw = capProjectWindow(i, null);
  if (!bpHasDev(i)) return { sunk: 0, released: pw.inW, phases: [] };
  var sunk = 0, ph = []; bpRows(i, 'dev').forEach(function (x) { var c = bpStepMoney(x); if (!c) return; var en = phEnteredStep(i, x); if (en) sunk += c; ph.push({ id: x.id, name: x.name || '', entered: en, c: Math.round(c) }) });
  sunk = Math.round(sunk); return { sunk: sunk, released: Math.max(0, pw.inW - sunk), phases: ph }
}
function stampKill(i) {
  if (!data.tracking) data.tracking = {}; if (!data.tracking[i]) data.tracking[i] = {};
  if (!bpHasDev(i)) { if (data.tracking[i].killSunkIds) delete data.tracking[i].killSunkIds; Store.commit('tracking', i); return }
  var ids = []; bpRows(i, 'dev').forEach(function (x) { if (x.id && bpStepMoney(x) && phEnteredStep(i, x)) ids.push(x.id) });
  data.tracking[i].killSunkIds = ids; Store.commit('tracking', i)
}
function killSunkDev(i) {
  var ids = (((data.tracking || {})[i]) || {}).killSunkIds; if (!ids || !ids.length) return 0;
  var t = 0; bpRows(i, 'dev').forEach(function (x) { if (ids.indexOf(x.id) >= 0) t += bpStepMoney(x) }); return Math.round(t)
}
function killPotRows() { return ((data.capital || {}).killRows || []).filter(function (r) { return r && (String((r || {}).d || '').trim() || costNum((r || {}).a)) }) }
function killPotTotal() { var t = costNum((data.capital || {}).killCosts); killPotRows().forEach(function (r) { t += costNum(r.a) }); return t }
function kpRowSave(x, f, v) { if (Collab.lockedByOther('capital')) return; var rws = (data.capital || {}).killRows || []; if (!rws[x]) return; rws[x][f] = v; Store.commit('capital'); render() }
function kpRowAdd() { if (Collab.lockedByOther('capital')) return; if (!data.capital) data.capital = {}; if (!data.capital.killRows) data.capital.killRows = []; data.capital.killRows.push({ d: '', a: '' }); Store.commit('capital'); render() }
function kpRowDel(x) { if (Collab.lockedByOther('capital')) return; var rws = (data.capital || {}).killRows || []; rws.splice(x, 1); Store.commit('capital'); render() }
function orgProjectMonthly(i, op, M, aOv, sunkOnly) {
  var out = [], m; for (m = 0; m < M; m++)out.push({ dev: 0, roll: 0, sus: 0 });
  if (sunkOnly) {
    if (!bpHasAny(i)) return out; var aK = aOv != null ? aOv : anchorMonth(i); if (aK == null) return out; var idsK = (((data.tracking || {})[i]) || {}).killSunkIds || [];
    bpRows(i, 'dev').forEach(function (x) { if (idsK.indexOf(x.id) < 0) return; var cK = bpStepMoney(x), spK = bpStepSpan(x); if (!cK || !spK) return; var perK = cK / (spK[1] - spK[0] + 1); for (var mK = spK[0]; mK <= spK[1]; mK++) { var ppK = aK + mK - 1; if (ppK >= 1 && ppK <= M) out[ppK - 1].dev += perK } }); return out
  }
  if (bpPlanLive(i)) { var a = aOv != null ? aOv : anchorMonth(i); if (a == null) return out; bpMonthly(i).forEach(function (r) { var pp = a + r.m - 1; if (pp >= 1 && pp <= M) { out[pp - 1].dev += r.dev; out[pp - 1].roll += r.roll; out[pp - 1].sus += r.sus } }); return out }
  var pj = (data.projects || {})[i] || {};
  var cDev = devCost(i), cRoll = opsRolloutCost(i), cRun = opsSustainCost(i);
  var a2 = aOv != null ? aOv : anchorMonth(i);
  if (cDev && a2 != null && a2 >= 1 && a2 <= M) out[a2 - 1].dev += cDev;
  if (op) {
    var od = (data.opsData || {})[i] || {}; var mL = od.launchDate ? progMonthOf(od.launchDate) : null;
    if (cRoll && mL != null && mL >= 1 && mL <= M) out[mL - 1].roll += cRoll;
    if (cRun) {
      var ss = (bpHasSus(i) ? bpSusStartOpYear(i) : 0) || 2; var mS = pj.legacy ? 1 : (mL != null ? mL + 12 * (ss - 1) : 13);
      for (var m2 = Math.max(1, mS); m2 <= M; m2++)out[m2 - 1].sus += cRun / 12
    }
  }
  return out
}
function bpCtFactor(i) { return 1 + (parseFloat((bpGet(i) || {}).contingency) || 0) / 100 }
function orgMonthly(extras, withCt) {
  var ps = (data.capital || {}).periodStart; if (!ps || isNaN(Date.parse(ps))) return null;
  var M = envYearsOf() * 12;
  var sums = [], m; for (m = 1; m <= M; m++)sums.push({ m: m, dev: 0, roll: 0, sus: 0 });
  orgCommittedSet().forEach(function (e) { var s2 = orgProjectMonthly(e.i, e.op, M, null, e.sunk); var f = withCt ? bpCtFactor(e.i) : 1; for (m = 0; m < M; m++) { sums[m].dev += s2[m].dev * f; sums[m].roll += s2[m].roll * f; sums[m].sus += s2[m].sus * f } });
  (extras || []).forEach(function (e) { var s3 = orgProjectMonthly(e.i, false, M, e.anchor); var f3 = withCt ? bpCtFactor(e.i) : 1; for (m = 0; m < M; m++) { sums[m].dev += s3[m].dev * f3; sums[m].roll += s3[m].roll * f3; sums[m].sus += s3[m].sus * f3 } });
  return sums
}
function capMonthlyLine(m) { return (m % 12 === 1) ? envBudgetYear(Math.ceil(m / 12)) : 0 } /* ANNUAL STEP (Paul's ruling, July 7): each year's full budget is available from that year's first month. Cumulative capacity is a staircase, so a breach exists iff some year runs over its own budget – every breach is a funding problem, never a pacing artifact. Callers sum this as a monthly increment. */
function capSusCapLine(m) { var scp = susCapOf(Math.ceil(m / 12)); /* month 12 belongs to year 1 – same convention as the budget lookup (December off-by-one fixed July 7, Paul's ruling) */if (!(scp > 0)) return 0; return envBudgetYear(Math.ceil(m / 12)) / 12 * scp / 100 }
function capBreaches(extras) {
  var s2 = orgMonthly(extras); if (!s2) return { overCapMonth: 0, ctOverCapMonth: 0, capYears: [] };
  var sCt = orgMonthly(extras, true); var cumC = 0, cumKC = 0, ctBr = 0; for (var mc = 1; mc <= sCt.length; mc++) { cumC += sCt[mc - 1].dev + sCt[mc - 1].roll + sCt[mc - 1].sus; cumKC += capMonthlyLine(mc); if (!ctBr && cumC > cumKC + 0.5) ctBr = mc }
  var cum = 0, cumCap = 0, overM = 0;
  s2.forEach(function (r) { cum += r.dev + r.roll + r.sus; cumCap += capMonthlyLine(r.m); if (!overM && cum > cumCap + 0.5) overM = r.m });
  var capYears = [];
  var Y = envYearsOf(); for (var y = 1; y <= Y; y++) { var scpY = susCapOf(y); if (!(scpY > 0)) continue; var t = 0; for (var m = (y - 1) * 12; m < y * 12; m++)t += s2[m].sus; if (t > envBudgetYear(y) * scpY / 100 + 0.5) capYears.push(y) }
  return { overCapMonth: overM, ctOverCapMonth: ctBr, capYears: capYears }
}
function bpSnapshot(i) {
  var yrs = [], H = bpHorizon(i);
  if (bpHasAny(i)) for (var y = 1; y <= H; y++)yrs.push(Math.round(prjDevYear(i, y) + prjRollYear(i, y) + prjSusYear(i, y)));
  var u = typeof getCurrentUser === 'function' ? (getCurrentUser() || {}) : {};
  return { at: Date.now(), by: u.name || '', startDate: (((data.projects || {})[i] || {}).startDate) || new Date(((data.projects || {})[i] || {}).advancedAt || Date.now()).toISOString().split('T')[0], horizon: H, lifetime: bpHasAny(i) ? bpLifetime(i) : 0, dev: devCost(i), roll: opsRolloutCost(i), sus: opsSustainCost(i), years: yrs, contingency: (bpGet(i) || {}).contingency || '' }
}
function capPeriod(from, toEx) {
  var mFrom = monthsAbs(from), mTo = monthsAbs(toEx), span = mTo - mFrom;
  var ideas = data.ideas || []; var rows = [], total = 0;
  var pmF = progMonthOf(from), pmT = progMonthOf(toEx);
  if (pmF == null || pmT == null) return { rows: rows, total: 0, span: span, from: from, toEx: toEx, ps: false };
  var M = envYearsOf() * 12;
  var lo = Math.max(1, pmF), hi = Math.min(pmT, M + 1);
  orgCommittedSet().forEach(function (e) {
    var s2 = orgProjectMonthly(e.i, e.op, M, null, e.sunk); var t = 0;
    for (var m = lo; m < hi; m++) { t += s2[m - 1].dev + s2[m - 1].roll + s2[m - 1].sus }
    if (t > 0.5) { t = Math.round(t); rows.push({ i: e.i, name: (ideas[e.i] || {}).name || ('Item ' + e.i), amt: t, label: 'program Months ' + lo + '\u2013' + (hi - 1) }); total += t }
  });
  return { rows: rows, total: total, span: span, from: from, toEx: toEx, ps: true }
}
function thisQuarterConsumption() { var qi = fyQuarterOf(new Date()); return { qi: qi, p: capPeriod(qi.start, qi.endEx) } }
function fiscalFold(pid, kind) {
  var open = !!UI.expanded['fyhelp' + pid];
  var h = '<button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'fyhelp' + pid + '\']=!UI.expanded[\'fyhelp' + pid + '\'];render()">' + (open ? '\u25be' : '\u25b8') + ' Dates and Fiscal Calculations</button>';
  if (open) {
    var ps = kind === 'review' ? [
      'The 90-day program and the overall budgetary period run on different clocks. The 90 days count from whenever you started. Your quarters count from the planning period start date (Step 3.2), or from the fiscal year start if you set one above. The two never need to line up.',
      'Your first review happens at day 90, wherever that falls. After that, reviews follow planning-period quarters or fiscal year quarters, depending on your choice.',
      'Decisions made at a review take effect on the 1st of the month after the review closes. Hold each review in the last month of a quarter, and the next quarter starts with your decisions already in force.',
      'If a review closes mid-quarter, the period that follows is a short catch-up (a \u201cstub\u201d) running to the end of the current quarter. After one stub, quarters will be aligned cleanly.',
      'Money counts in whole months, never days. A project\'s sustainment costs count at one-twelfth of the annual figure per month from the month its rollout ends, or the later start its budget plan sets. Development and rollout costs land in full and are never pro-rated.',
      'A Sell releases the project\'s commitment immediately. If shutting something down has real costs \u2013 phase-outs, contract exits \u2013 hold them in the kill & phase-out pot at Step 3.3; that pot is deducted from Available.',
      'A Buy on an Exploration project commits its development costs when the review closes.'
    ] : [
      'The live budget is annual \u2013 Year 1 of the multi-year envelope. The level-pace figure shown is simply that annual figure divided by four \u2013 a comparison line, not an allocation; the outer years are planning context for the multi-year picture.',
      'Commitments are derived from where projects stand rather than being entered manually. A project in Development commits its Development Costs. An operational project commits its Development Costs plus its Rollout Costs while rollout runs, then its annual sustainment costs from the month rollout ends.',
      'Killing a project releases every development phase not yet entered; phases already entered stay committed and charted. Pausing holds the commitment unchanged \u2013 if a long pause adds real cost (license months, restart work), add it to the paused phase\u2019s cost at Step 3.4, or add a phase covering the pause months, and the committed sum recalculates from there. Real shutdown costs go in the kill & phase-out pot, which is deducted from Available.',
      'Money counts in whole months, never days: sustainment costs at one-twelfth of the annual figure per month from the month a project\u2019s rollout ends (or the later start its budget plan sets); development and rollout costs land in full and are never pro-rated.',
      'Each project can carry a budget plan \u2013 development and rollout steps with month ranges and whole-step costs, plus sustainment phases with itemized annual rates. While a section of the plan holds money, the matching simple field locks to it and reads \u201cDerived from budget plan\u201d; clear the section\u2019s money and the field is freed again.',
      'The Capital Hub\'s charts are the program calendar: committed money placed at its anchored months. Committed Sums is the standing promise ledger \u2013 stage-based, not time-sliced \u2013 so a year reading and the ledger can legitimately differ.',
      'The period start date (set at Step 3.2) sets the quarter labels here and the rhythm of the quarterly reviews in Phase 4. The 90-day program clock never touches the money.'
    ];
    h += '<div style="margin-top:10px">' + ps.map(function (p) { return '<p class="fs-14" style="margin:0 0 8px;color:var(--stone)">' + p + '</p>' }).join('') + '</div>'
  }
  return h
}
function fiscalHelpBox(pid, kind) { return card(fiscalFold(pid, kind), 'margin-bottom:16px') }
function nextReviewDateText() { var n = nextReviewInfo(); if (!n) return (data.governance || {}).firstReview || 'TBD'; return (n.first ? '' : 'by ') + fmtDate(n.date) }
function nextReviewLine() {
  var n = nextReviewInfo(); if (!n) return '';
  if (n.first) return 'Next portfolio review: <strong>' + fmtDate(n.date) + '</strong> \u2013 Day 90 of the program. Reviews follow your planning-period quarters after this one (set at Step 3.2).';
  return 'Next portfolio review: <strong>by ' + fmtDate(n.date) + '</strong> \u2013 hold it in the closing month of ' + fmtQuarter(n.qi) + '. Decisions take effect on the 1st of the following month.' + (n.stub ? ' This is a ' + n.months + '-month period, aligning you to your fiscal quarters.' : '')
}
function capReadout() {
  ensureCapCostModel(); var com = capCommitments(); var cap = data.capital || {};
  var _kin = 'font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px';
  var potRows = ''; ((data.capital || {}).killRows || []).forEach(function (r, x) { if (!r) return; potRows += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input value="' + esc(r.d || '') + '" placeholder="e.g. Contractor exit \u2013 Visual QC" onchange="kpRowSave(' + x + ',\'d\',this.value)" style="flex:2;min-width:180px;' + _kin + '"><input value="' + esc(r.a || '') + '" placeholder="e.g. $25K" onchange="kpRowSave(' + x + ',\'a\',this.value)" style="flex:1;min-width:80px;' + _kin + '"><select onchange="kpRowSave(' + x + ',\'y\',this.value)" style="' + _kin + ';padding:6px 4px">' + (function () { var o = ''; for (var _y = 1; _y <= envYearsOf(); _y++)o += '<option value="' + _y + '"' + (killPotYearOf(r) === _y ? ' selected' : '') + '>Year ' + _y + '</option>'; return o })() + '</select><button class="btn-ghost pad-chip-sm" onclick="kpRowDel(' + x + ')" style="width:26px;padding:2px">\u2715</button></div>' });
  var pot = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.12)"><h3 class="h-sub-md" style="margin:0 0 4px">Project Kill/Phase-Out Pot \u2013 ' + fmtMoney(killPotTotal()) + '</h3>'
    + '<p class="t-faint-sm" style="margin:0 0 8px">Money set aside to cover the costs of winding down killed projects. The total is subtracted from the Available figure at the top of the page. Each line is a wind-down cost you expect to carry \u2013 contract exits, license runoff, phase-out work. If you kill a project from the Development portfolio, you will be offered the opportunity to add a line here automatically.</p>'
    + potRows + btn('+ Add pot line', 'kpRowAdd()', 'bg2', 'font-size:11px;padding:3px 10px')
    + ((String(cap.killNotes || '').trim() || String(cap.killCosts || '').trim()) ? '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-top:10px"><div style="flex:2;min-width:260px">' + ta('Kill & phase-out cost details (legacy notes)', 'cap_killNotes', cap.killNotes, '', 2) + '</div><div style="flex:1;min-width:170px">' + ta('Manual pot figure (legacy \u2013 still counted)', 'cap_killCosts', cap.killCosts, '', 1) + '</div></div>' : '')
    + '</div>';
  var h = '<h3 class="h-sub-md">Committed Sums</h3>';
  h += csNotesFold();
  if (!com.rows.length) { h += '<p class="t-faint-sm">Nothing is committed yet \u2013 no running experiments or operational projects carry costs.</p>' }
  else {
    com.rows.forEach(function (r) {
      var i = r.i; var ops = r.stage === 'Operational'; var killed = r.status === 'killed';
      var stCol = ops ? '#C25B73' : '#C9925B';
      var stat = killed ? ['killed', '#C25B73'] : (r.status === 'Paused (held)' ? ['paused', '#D4A017'] : (r.status === 'Complete' ? ['complete', '#1B6B5A'] : (r.status === 'Running' ? ['running', '#4FB39A'] : (ops ? ['live', '#4FB39A'] : [String(r.status || 'active').toLowerCase(), '#2D5A8E']))));
      var cell = function (l, v, dim, tt) { return '<div style="min-width:84px;text-align:center' + (dim ? ';opacity:.5' : '') + '"><div class="t-faint-sm" style="font-size:9px;letter-spacing:.06em"' + (tt ? ' title="' + tt + '"' : '') + '>' + l + '</div><div class="t-faint-sm" style="font-size:8px;margin-top:3px">&nbsp;</div><div class="fs-13" style="margin-top:2px">' + v + '</div></div>' };
      var cells = '', note = '';
      if (killed) { var rel = Math.max(0, capProjectWindow(i).inW - r.amt); cells = cell('HELD \u2013 ENTERED PHASES', fmtMoney(r.amt)) + cell('RELEASED', fmtMoney(rel), true); note = 'Phases already entered stay committed; the remainder went back to Available.' }
      else {
        var d = devCost(i), ro = Math.round(opsRolloutCost(i)), su = Math.round(opsSustainCost(i)), sp = susProgTotal(i, ops);
        var estT = 'Committed at advance as part of the full plan';
        cells = cell('DEVELOPMENT', fmtMoney(d)) + (ro ? cell('ROLLOUT', fmtMoney(ro), false, ops ? null : estT) : '');
        if (su) { cells += '<div style="min-width:130px"><div class="t-faint-sm" style="font-size:9px;letter-spacing:.06em;text-align:center" title="' + (ops ? 'Sustainment is charted from the month rollout ends' : estT) + '">SUSTAINMENT</div><div style="display:flex;gap:12px;justify-content:center;margin-top:3px"><div style="text-align:center"><div class="t-faint-sm" style="font-size:8px;letter-spacing:.06em">ANNUAL</div><div class="fs-13" style="margin-top:2px">' + fmtMoney(su) + '/yr</div></div>' + (sp ? '<div style="text-align:center"><div class="t-faint-sm" style="font-size:8px;letter-spacing:.06em">OVER THE PROGRAM</div><div class="fs-13" style="margin-top:2px">' + fmtMoney(sp) + '</div></div>' : '') + '</div></div>' }
      }
      h += '<div style="padding:8px 0 9px;border-bottom:1px solid rgba(var(--fg-rgb),.06)">'
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="fs-14" style="flex:1;min-width:140px">' + esc(r.name) + '</span>'
        + '<span style="font-size:10px;letter-spacing:.05em;padding:2px 9px;border-radius:9px;border:1px solid ' + stCol + ';color:' + stCol + '">' + r.stage + '</span>'
        + '<span class="t-faint-sm" style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:' + stat[1] + '"></span>' + stat[0] + '</span>'
        + '<div style="min-width:76px;text-align:right"><strong>' + fmtMoney(r.amt) + '</strong>' + '</div></div>'
        + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:5px">' + cells + '</div>'
        + (note ? '<div class="t-faint-sm" style="margin-top:3px">' + note + '</div>' : '') + '</div>'
    });
    h += '<div class="row-line" style="border-top:1px solid rgba(var(--fg-rgb),.12)"><span class="fs-14" style="flex:1"><strong>Total committed</strong></span><strong style="min-width:70px;text-align:right">' + fmtMoney(com.total) + '</strong></div>';
  }
  h += pot;
  return card(h, 'margin-bottom:16px')
}
