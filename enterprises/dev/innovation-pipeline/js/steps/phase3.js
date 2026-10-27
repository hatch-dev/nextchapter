/* ============================================================
   steps/phase3.js - Phase 3 Prepare - steps 3.1-3.4
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   Per-step body renderers + their save helpers for this phase; routed
   to from renderStepContent() in app.js. Rely on app.js/lib globals:
   data, Store, UI, render, ta, sel, likert, card, btn, doneBtn, fldSave,
   getStages, esc, and related helpers.
   ============================================================ */

// === PHASE 3 STEPS ===
function renderStep31() {
  var ideas = data.ideas || [], as = data.assessments || {}, proj = data.projects || {}, stages = getStages(), goP = stages.explore.filter(function (i) { return (proj[i] || {}).viable === true }), port = data.portfolio || {};
  var h = vp('V-3.1.1', 'Portfolio Thinking vs. Project Lists', '3\u20135 min');
  h += '<h2 class="h-section">Step 1: Structure as Portfolio</h2><p class="t-lead">A list of projects gets judged one at a time, and every judgment amounts to a fresh argument about how one project stacks up against the others. A portfolio is judged as a whole, where the mixture matters more than the individual bets. Here, what matters is not any one project\u2019s merits but the balance between quick wins and long-term possibilities, between high- and low-risk, and between cheap and expensive options. Grade each Go project on time horizon, risk, and reward, then check the balance panel below for gaps and concentrations.</p>';
  if (!goP.length) {
    var _res31 = function (i) { var pr = proj[i] || {}; return pr.viable === true ? !!pr.objectives : pr.viable === false ? !!pr.noGoReason : false }; var _await31 = stages.explore.concat(stages.noGo).filter(function (i) { return !_res31(i) }); var msg31;
    if (!(data.selected && data.selected.length > 0)) msg31 = 'Complete Phase 2 first \u2014 filter ideas and deepen assessments.';
    else if ((data.completedSteps || {})['3.1']) msg31 = 'No projects are currently at the Exploration stage. Go projects appear here until they advance to Development; set-aside projects are under Not Advancing in the Exploration portfolio.';
    else if (_await31.length > 0) msg31 = 'In Step 2.4 (Deepen Assessment), give every project a Go or No-Go verdict \u2013 at least one must be Go to proceed here.';
    else msg31 = 'No projects are currently at the Exploration stage \u2014 Go projects appear here until they advance to Development, and set-aside projects are under Not Advancing in the Exploration portfolio.';
    return h + card('<div class="empty-state"><p class="t-faint">' + msg31 + '</p></div>')
  }
  var allGraded = goP.every(function (i) { var p = port[i] || {}; return p.horizon && p.risk && p.reward });
  goP.forEach(function (i) {
    var idea = ideas[i], p = port[i] || {}, score = getScore(i); var sg = suggestedBands(i), _h2 = []; if (!p.horizon && sg.horizon) _h2.push('horizon: ' + sg.horizon); if (!p.risk && sg.risk) _h2.push('risk: ' + sg.risk); if (!p.reward && sg.reward) _h2.push('reward: ' + sg.reward); var _hint = _h2.length ? '<p class="t-faint-sm" style="margin:2px 0 8px">Suggested from your assessment \u2013 ' + _h2.join(' \u00b7 ') + '</p>' : '';
    h += card('<div class="flx-row-mb"><h4 class="h-card">' + esc(idea ? idea.name : '') + '</h4>' + hzWarn(i, true) + badge(score + '/50', '#1B6B5A') + '</div>' + '<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pc31' + i + '\']=!UI.expanded[\'pc31' + i + '\'];render()">' + (UI.expanded['pc31' + i] ? '\u25be' : '\u25b8') + ' Project card</button>' + (UI.expanded['pc31' + i] ? projCardRO(i) : '') + '</div>' + '<div class="gr-3-sm">' + sel('Time horizon *', 'port_' + i + '_h', p.horizon, [{ v: '', l: 'Select...' }, { v: 'quick', l: 'Quick win (weeks)' }, { v: 'medium', l: 'Medium-term bet (months)' }, { v: 'long', l: 'Long-term bet (6+ months)' }]) + sel('Risk *', 'port_' + i + '_r', p.risk, [{ v: '', l: 'Select...' }, { v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }], 'How likely the project is to miss, judged from your deepened assessment.', true) + sel('Reward *', 'port_' + i + '_w', p.reward, [{ v: '', l: 'Select...' }, { v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }], 'How large the payoff is if it works, relative to the rest of the portfolio.', true) + '</div>' + _hint + '<div style="margin-top:12px"><div style="font-size:13px;color:var(--text-faint);margin-bottom:4px">Notes</div><textarea id="port_' + i + '_n" rows="1" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="e.g. Balances the long-term QC project with a quick win">' + esc(p.notes || '') + '</textarea></div>', 'margin-bottom:12px')
  });
  h += balancePanel(goP, 'explore');
  h += doneBtn('saveDone31()', !allGraded, '\u2713 Portfolio Structured', (data.completedSteps || {})['3.1'], 'Grade every project on horizon, risk, and reward first.'); return h
}

function saveDone31() { if (!confirmStepDone('3.1')) return; var goP = getStages().explore.filter(function (i) { return ((data.projects || {})[i] || {}).viable === true }); if (!data.portfolio) data.portfolio = {}; goP.forEach(function (i) { if (Collab.lockedByOther('portfolio::' + i)) return; var hh = $('port_' + i + '_h'), rr = $('port_' + i + '_r'), ww = $('port_' + i + '_w'), nn = $('port_' + i + '_n'); if (!(hh || rr || ww || nn)) return; if (!data.portfolio[i]) data.portfolio[i] = {}; if (hh) data.portfolio[i].horizon = hh.value; if (rr) data.portfolio[i].risk = rr.value; if (ww) data.portfolio[i].reward = ww.value; if (nn) data.portfolio[i].notes = nn.value }); if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['3.1'] = true; stampStepDone('3.1'); saveData(); render() }

function envReserveYear(y) { return costNum((data.capital || {})['reserveY' + y]) }
function capacityPicture() {
  var n = envYearsOf(); var vals = [], mx = 0;
  for (var y = 1; y <= n; y++) { var c = envBudgetYear(y), r = envReserveYear(y); vals.push({ y: y, c: c, r: Math.min(r, c) }); if (c > mx) mx = c }
  if (!mx) return '<p class="t-faint-sm">Set the year-one capacity to draw the picture.</p>';
  var _caps = []; for (var yc = 1; yc <= n; yc++)_caps.push(susCapOf(yc));
  var _capsOn = _caps.filter(function (v) { return v > 0 });
  var _capUniform = _capsOn.length === n && _capsOn.every(function (v) { return v === _capsOn[0] });
  var W = 720, Hh = 190, pad = 30, bw = (W - pad * 2) / n, base = Hh - 26;
  var sy = function (v) { return (Hh - 56) * (v / mx) };
  var h = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
  vals.forEach(function (v, ix) {
    var x = pad + ix * bw + bw * .12, w = bw * .76; var bh = sy(v.c); h += '<rect x="' + x.toFixed(1) + '" y="' + (base - bh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="rgba(27,107,90,.35)"/>';
    if (v.r > 0) { var rh = sy(v.r); h += '<rect x="' + x.toFixed(1) + '" y="' + (base - bh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + rh.toFixed(1) + '" rx="4" fill="#2E9C7C"><title>Intake reserve ' + fmtMoney(v.r) + '</title></rect>' }
    var scpB = _caps[v.y - 1]; if (scpB > 0) { var cy = base - bh * (scpB / 100); h += '<line x1="' + x.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + (x + w).toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="#D4A017" stroke-width="2" stroke-dasharray="4,3"><title>Sustainment cap ' + scpB + '%</title></line>' }
    h += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (Hh - 12) + '" text-anchor="middle" font-size="10" fill="#8A8278">Year ' + v.y + '</text>';
    h += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (base - bh - 6).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#F5F2EC">' + fmtMoney(v.c) + '</text>'
  });
  h += '</svg>';
  h += '<div class="t-faint-sm" style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:rgba(27,107,90,.35);border-radius:2px;margin-right:4px"></span>Annual capacity <span style="display:inline-block;width:10px;height:10px;background:#2E9C7C;border-radius:2px;margin:0 4px 0 12px"></span>Intake reserve within capacity' + (_capsOn.length ? ' <span style="display:inline-block;width:14px;border-top:2px dashed var(--warn-text);margin:0 4px 2px 12px"></span>Sustainment cap ' + (_capUniform ? _capsOn[0] + '%' : '\u2013 per year') + '' : '') + '</div>';
  h += '<p class="t-faint-sm" style="margin:6px 0 0">Each bar is one year\u2019s total budget; the brighter block at its top is that year\u2019s intake reserve.</p>';
  var warn = '';
  if (warn) h += '<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">\u26a0 ' + warn + '</p>';
  return h
}
function capAuditAnswered() { return (data.audit || []).every(function (it) { return !it || !String(it.name || '').trim() || it.assigned === 'yes' || it.assigned === 'no' }) }
function legacyAssign(i, val) { if (lockBlocked('audit')) return; var it = (data.audit || [])[i]; if (!it) return; it.assigned = val; Store.commit('audit'); render() }
function legacyIntake(i) {
  if (lockBlocked('audit')) return; var it = (data.audit || [])[i]; if (!it || !String(it.name || '').trim()) return; if (it.projIdx != null) return;
  var stg = (UI.legacyStage || {})[i] || 'exploration';
  if (!data.ideas) data.ideas = []; data.ideas.push({ name: it.name, desc: 'Legacy initiative adopted from the AI Innovation Audit', dept: '', cost: '', when: 'now' });
  var idx = data.ideas.length - 1;
  if (!data.projects) data.projects = {}; data.projects[idx] = { legacy: true };
  if (!data.selected) data.selected = []; data.selected.push(idx);
  if (stg === 'development' || stg === 'operational') { if (!data.expSelected) data.expSelected = []; data.expSelected.push(idx); data.projects[idx].advancedAt = Date.parse((data.capital || {}).periodStart) || Date.now() }
  if (stg === 'operational') { if (!data.launched) data.launched = []; data.launched.push(idx); if (!data.opsData) data.opsData = {}; data.opsData[idx] = {} }
  it.assigned = 'yes'; it.projIdx = idx;
  data.capStale = true;
  Store.commit('audit'); Store.commit('ideas'); Store.commit('projects', idx); Store.commit('selected'); if (stg !== 'exploration') Store.commit('expSelected'); if (stg === 'operational') { Store.commit('launched'); Store.commit('opsData', idx) } Store.commit('capStale');
  saveData(); render()
}
function legacyTab() {
  var au = data.audit || [];
  var named = au.filter(function (a) { return a && String(a.name || '').trim() });
  var body = '<h3 class="h-sub-lg">Legacy Projects</h3><p class="t-faint-sm" style="margin-bottom:10px">Many budgets import pre-existing commitments. For each initiative identified in the AI Innovation Audit (Step 1.1), answer one question: does it draw on your AI transformation budget? If yes, the project enters the pipeline as a real card at its relevant stage, identified as pre-existing by its Legacy badge.</p><div class="form-label" style="margin-top:2px">Assigned to this budget?</div>';
  if (!named.length) body += '<div class="empty-state"><p class="t-faint">No named initiatives in the AI Innovation Audit yet \u2013 inventory them at Step 1.1 first.</p></div>';
  var _idx = []; au.forEach(function (it, i) { if (it && String(it.name || '').trim()) _idx.push(i) });
  var _ordered = _idx.filter(function (i) { return au[i].assigned === 'yes' }).concat(_idx.filter(function (i) { return au[i].assigned !== 'yes' }));
  body += _ordered.map(function (i, _ox) {
    var it = au[i];
    var st = { alive: 'Alive', dormant: 'Dormant', dead: 'Dead' }[it.status] || '\u2014';
    var dim = it.assigned === 'no';
    var row = '<div class="row-line" style="align-items:center;border-bottom:none' + (dim ? ';opacity:.5' : '') + '"><span class="fs-14" style="flex:1">' + esc(it.name) + '</span>' + badge(st, it.status === 'alive' ? '#1B6B5A' : 'var(--text-faint)')
      + '<select onchange="legacyAssign(' + i + ',this.value)" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px"><option value=""' + (!it.assigned ? ' selected' : '') + '>Select\u2026</option><option value="yes"' + (it.assigned === 'yes' ? ' selected' : '') + '>Yes</option><option value="no"' + (it.assigned === 'no' ? ' selected' : '') + '>No</option></select>';
    if (it.assigned === 'yes' && it.projIdx == null) {
      row += '<select onchange="UI.legacyStage[' + i + ']=this.value" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px"><option value="exploration"' + ((UI.legacyStage[i] || 'exploration') === 'exploration' ? ' selected' : '') + '>Exploration</option><option value="development"' + (UI.legacyStage[i] === 'development' ? ' selected' : '') + '>Development</option><option value="operational"' + (UI.legacyStage[i] === 'operational' ? ' selected' : '') + '>Operational</option></select>'
        + btn('Adopt \u2192', 'legacyIntake(' + i + ')', 'bs', 'font-size:11px;padding:4px 10px')
    }
    if (it.projIdx != null) {
      var pi = it.projIdx; var stgn = (data.launched || []).indexOf(pi) >= 0 ? 'Operational' : ((data.expSelected || []).indexOf(pi) >= 0 ? 'Development' : 'Exploration');
      row += badge(stgn, '#2D5A8E') + badge('Legacy', '#D4A017')
    }
    row += '</div>';
    if (dim) row += '<p class="t-faint-sm" style="margin:2px 0 8px">Not this budget \u2013 stays off the organizational charts.</p>';
    if (it.projIdx != null) {
      var pi2 = it.projIdx; var open = UI.expanded['lgb' + pi2];
      row += '<div style="margin:2px 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'lgb' + pi2 + '\']=!UI.expanded[\'lgb' + pi2 + '\'];render()">' + (open ? '\u25be' : '\u25b8') + ' Budget plan</button>' + (open ? '<p class="t-faint-sm" style="margin:8px 0 4px">This plan only looks forward. Month 1 is the start of the budgetary period, so enter the remaining work from that point on \u2013 money spent before the period began is not part of this budget and never appears on the charts.</p>' + bpBudgetTab(pi2) : '') + '</div>'
    }
    return '<div style="' + (_ox < _ordered.length - 1 ? 'border-bottom:1px solid rgba(var(--fg-rgb),.08);' : '') + 'margin-bottom:8px;padding-bottom:4px">' + row + '</div>'
  }).join('');
  return card(body, 'margin-bottom:16px')
}
function renderStepCap() {
  var cap = data.capital || {};
  var h = vp('V-3.2.1', 'Sizing the Capacity Plan', '3\u20135 min');
  h += '<h2 class="h-section">Step 2: Plan Capacity</h2><p class="t-lead">Set the financial frame that every commitment will be measured against. Choose how many years the plan covers, date its starting month, and give each year a budget. Then open the second tab and answer the budget question for every legacy initiative, so the plan starts from your real position. This step records capacity only. Committing money to projects happens at the next step.</p>';
  if (UI.capPlanTab == null) UI.capPlanTab = 1; if (!UI.legacyStage) UI.legacyStage = {};
  h += '<div class="flx-g2-wrap mb-5">' + [{ t: 1, l: '1 \u00b7 Capacity Plan' }, { t: 2, l: '2 \u00b7 Legacy Projects' }].map(function (tb) { return '<button onclick="UI.capPlanTab=' + tb.t + ';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (UI.capPlanTab === tb.t ? '2px solid #8B5E3C' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (UI.capPlanTab === tb.t ? 'rgba(139,94,60,.12)' : 'rgba(var(--fg-rgb),.02)') + ';color:' + (UI.capPlanTab === tb.t ? 'var(--paper)' : 'var(--text-faint)') + '">' + tb.l + '</button>' }).join('') + '</div>';
  var _gateOff = !(String(cap.aiBudget || '').trim() && String(cap.periodStart || '').trim() && capAuditAnswered());
  if (UI.capPlanTab === 2) { h += legacyTab(); h += doneBtn('saveDoneCap()', _gateOff, null, (data.completedSteps || {})['3.2'], 'Set the year-one budget and the period start date, and answer the budget question for every legacy initiative (second tab).'); return h }
  h += card('<h3 class="h-sub-lg">Planning</h3><div style="display:flex;gap:14px 80px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div class="form-label">Planning period begins *</div><input type="date" id="cap_periodStart" value="' + esc(cap.periodStart || '') + '" onchange="fldSave(this.id,this.value,true)" onblur="fldSave(this.id,this.value,true);deferRender()" class="u-6293484"/><p class="t-faint-sm" style="margin:6px 0 0">The calendar origin point \u2013 month one of every organization-wide financial chart.</p><p class="fs-14" style="margin:8px 0 0">' + fyToday() + '</p></div><div style="flex:1;min-width:200px"><div class="form-label">Planning period length</div><select class="sel-helper" style="width:auto;padding:8px 12px;font-size:15px" onchange="fldSave(\'cap_envYears\',this.value)">' + [1, 2, 3, 4, 5].map(function (k) { return '<option value="' + k + '"' + (envYearsOf() === k ? ' selected' : '') + '>' + k + (k === 1 ? ' year' : ' years') + '</option>' }).join('') + '</select>' + hzReconcilePanel() + '</div></div>', 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Capacity Plan</h3>' + budgetEnvelopeRow() + fundNote(), 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Sustainment Cap</h3><div class="flx-center gap-2" style="flex-wrap:wrap"><span class="fs-14">A maximum of</span><input id="cap_susCap" value="' + esc(cap.susCap || '') + '" placeholder="e.g. 40" onchange="fldSave(this.id,this.value)" class="row-input" style="flex:0 0 84px;width:84px;text-align:center"/><span class="fs-14">% of any year\u2019s budget can be spent on the running costs of existing projects.</span></div><p class="t-faint-sm" style="margin:8px 0 0">Drawn on the charts as a dashed line \u2013 crossing it generates a warning.</p><div class="t-faint-sm" style="margin:14px 0 4px">PER-YEAR OVERRIDES (optional) \u2013 leave a year blank to use the figure above</div><div style="display:flex;gap:10px;flex-wrap:wrap">' + (function () { var _h2 = ''; for (var _y = 1; _y <= envYearsOf(); _y++) { _h2 += '<div style="flex:1;min-width:96px"><div class="form-label" style="font-size:12px">Year ' + _y + '</div><div class="flx-center gap-2"><input id="cap_susCapY' + _y + '" value="' + esc(cap['susCapY' + _y] || '') + '" placeholder="\u2013" onchange="fldSave(this.id,this.value)" class="row-input" style="flex:0 0 64px;width:64px;text-align:center"/><span class="t-faint-sm">%</span></div></div>' } return _h2 })() + '</div>', 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Capacity Picture</h3>' + capacityPicture(), 'margin-bottom:16px');
  h += doneBtn('saveDoneCap()', _gateOff, null, (data.completedSteps || {})['3.2'], 'Set the year-one budget and the period start date, and answer the budget question for every legacy initiative (second tab).');
  return h
}
function saveDoneCap() { if (!confirmStepDone('3.2')) return; if (!Collab.lockedByOther('capital')) { if (!data.capital) data.capital = {};['aiBudget', 'periodStart'].forEach(function (fld) { var e = $('cap_' + fld); if (e && e.value !== undefined) data.capital[fld] = e.value }) } if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['3.2'] = true; stampStepDone('3.2'); saveData(); render() }
function capStartSave(i, val) { if (Collab.lockedByOther('projects::' + i)) return; if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; data.projects[i].startDate = val; Store.commit('projects', i); data.capStale = true; Store.commit('capStale') }
function deferRender() { setTimeout(render, 0) }
function capLandingLine(i) {
  var pj = (data.projects || {})[i] || {}; var ps = (data.capital || {}).periodStart;
  if (!ps) return 'Set the period start at Step 3.2 to see where this lands.';
  if (!pj.startDate) { var pm = progMonthOf(new Date()); return 'No date yet \u2013 the commit will assume the first of next month (program Month ' + ((pm == null ? 0 : pm) + 1) + ').' }
  var a = progMonthOf(pj.startDate); if (a == null) return '';
  var t = 'Plan Month 1 lands program Month ' + a;
  if (bpHasAny(i)) { var fo = bpFirstOpMonth(i); if (fo) t += ' \u00b7 first operational month lands program Month ' + (a + fo - 1) }
  return t + '.'
}
function capOverrideRecord(rIn) { if (Collab.lockedByOther('capital')) return; var e = $('cap_overrideReason'); var r = rIn != null ? String(rIn).trim() : (e ? String(e.value || '').trim() : ''); if (!r) return; var br = capBreaches(); if (!data.capital) data.capital = {}; if (!data.capital.overrides) data.capital.overrides = []; var u = typeof getCurrentUser === 'function' ? (getCurrentUser() || {}) : {}; data.capital.overrides.push({ id: uid(), at: Date.now(), by: u.name || '', month: br.overCapMonth || 0, reason: r }); Store.commit('capital'); render() }
function allocCore(){
var cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},port=data.portfolio||{},ca=data.capAlloc||{};
var goP=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
var av=capAvailable();
if(UI.capTab==null||UI.capTab>2)UI.capTab=1;if(!UI.capSim)UI.capSim={};
var h='';
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'1 \u00b7 Sandbox'},{t:2,l:'2 \u00b7 Commit & Advance'}].map(function(tb){return'<button onclick="UI.capTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.capTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.capTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.capTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.capTab===1){
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">No candidates to model \u2013 Go projects from Exploration appear here with their costs.</p></div>');
else{var selIdx=goP.filter(function(i){return UI.capSim[i]});
var toExp=0,fyOp=0;selIdx.forEach(function(i){toExp+=devCost(i);fyOp+=devCost(i)+opsRolloutCost(i)});
h+=card('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 class="h-sub-lg" style="margin:0">Sandbox</h3>'+pdfBtn('printCapSandbox()')+'</div><p class="t-faint-sm" style="margin:6px 0 10px">Tick any combination to stack the batch onto the standing baseline \u2013 the charts redraw as the portfolio would look. This view is a sandbox: nothing here commits anything, nothing is saved.</p>'+goP.map(function(i){var pb=port[i]||{};return'<div class="row-line"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()"/><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+hzWarn(i,true)+'<input type="date" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484" style="width:132px;font-size:11px" title="Assumed start date \u2013 blank means next month"/>'+'<span class="t-faint-sm" style="min-width:150px;text-align:right">dev '+fmtMoney(devCost(i))+' \u00b7 rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span>'+badge(getScore(i)+'/50','#1B6B5A')+'</div>'}).join(''),'margin-bottom:16px');
if(!orgMonthly())h+=card('<p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>','margin-bottom:16px');
else{var pmNow=progMonthOf(new Date());var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
var extras=selIdx.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});
var brS=capBreaches(extras);
var _dated=selIdx.filter(function(i){return(proj[i]||{}).startDate}).length;
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">'+(selIdx.length?'Staged batch ('+selIdx.length+')':'The standing baseline')+'</h3>'+zoomBtn('ac_wf')+'</div>'
+(selIdx.length?'<p class="t-faint-sm" style="margin-bottom:8px">Unless otherwise specified, the assumed start for every ticked candidate is next month (program Month '+aAss+'). Committed on advancing: <strong>'+fmtMoney(toExp)+'</strong> \u2013 the full plans, reflected across the years they touch in the cells on the Commit & Advance tab.</p>':'<p class="t-faint-sm" style="margin-bottom:8px">Committed and legacy promises as they already sit on the program calendar \u2013 tick candidates above to stage the batch on top.</p>')
+orgWaterfallChart(extras)+(selIdx.length?(brS.overCapMonth?'<p class="fs-13" style="margin:14px 0 6px;color:var(--warn-text)">\u26a0 With this batch, cumulative commitments cross capacity in Month '+brS.overCapMonth+'. A funding plan will be required at Commit & Advance.</p>':'<p class="t-faint-sm" style="margin:14px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'')+'<div style="margin-top:6px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_cum')+'</div>'+orgCumChart(extras)+'</div><div style="margin-top:12px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_swim')+'</div>'+orgSwimlanes(extras)+'</div>','margin-bottom:16px')}}}
if(UI.capTab===2){
var br=capBreaches();var breached=br.overCapMonth>0;var ctOnly=!breached&&br.ctOverCapMonth>0;var ovs=(cap.overrides||[]);
var pmNow2=progMonthOf(new Date());var aAss2=Math.max(1,(pmNow2==null?0:pmNow2)+1);
var selIdx2=goP.filter(function(i){return UI.capSim[i]});
// 1. slim capital strip — staged batch included when ticked
var _sx2=selIdx2.map(function(i){return capAssumedExtra(i)});var _sxTot=0;_sx2.forEach(function(e){_sxTot+=capProjectWindow(e.i,e.anchor).inW});
h+=card(capCells(false,_sx2.length?_sx2:null)+(selIdx2.length?'<p class="t-faint-sm" style="margin:8px 0 0">Including the staged batch \u2013 '+selIdx2.length+' candidate'+(selIdx2.length>1?'s':'')+', +'+fmtMoney(_sxTot)+' of full plans committed on advancing, spread across the years they touch.</p>':''),'margin-bottom:16px');
// 2. advance queue — staged first, ticks live
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">Nothing to advance \u2013 Go projects appear here from Exploration. On a first pass, advance 3\u20135, led by the quick wins.</p></div>','margin-bottom:16px');
else{h+='<h3 class="h-sub-md">Advance queue</h3><p class="t-faint-sm" style="margin-bottom:10px">Ticked candidates are the staged batch \u2013 change the mix freely here or in the sandbox, and the calendar below redraws. Unless otherwise specified, the assumed start for a ticked candidate is program Month '+aAss2+' (next month).</p>';
goP.slice().sort(function(a,b){return(UI.capSim[b]?1:0)-(UI.capSim[a]?1:0)}).forEach(function(i){var c=projCosts(i),pb=port[i]||{},graded=!!(pb.horizon&&pb.risk&&pb.reward);
var live=graded;var _brF=capBreaches([capAssumedExtra(i)]);var fits=!_brF.overCapMonth;var planOk=!!(String(cap.reallocation||'').trim()||String(cap.gapPlan||'').trim());
var costRow=function(l,v){return'<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:5px"><span class="t-faint-sm">'+l+'</span><span class="fs-14" style="font-weight:700;color:var(--paper)">'+v+'</span></div>'};
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:1;min-width:260px"><div class="flx-row-mb"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()" style="margin-right:2px"/><h4 class="h-card">'+esc((ideas[i]||{}).name)+'</h4>'+hzWarn(i,true)+(UI.capSim[i]?badge('Staged','#8B5E3C'):'')+badge(getScore(i)+'/50','#1B6B5A')+'</div><div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end"><div><div class="t-faint-sm">ASSUMED START DATE</div><input type="date" id="prj_'+i+'_startDate" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484"/></div><div class="t-faint-sm" style="flex:1;min-width:150px;max-width:280px;padding-bottom:6px;line-height:1.45">'+capLandingLine(i)+'</div></div><div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(live&&(fits||planOk)?btn('Advance to Development Portfolio \u2192','advanceWithGates('+i+')','bp','font-size:13px'):(!graded?'<span><button class="btn-ghost" disabled style="font-size:13px;opacity:.35;cursor:not-allowed">Advance to Development Portfolio \u2192</button><div class="t-faint-sm" style="margin-top:6px">Grade Horizon, Risk, and Reward at Step 3.1 first.</div></span>':'<span class="t-faint-sm">Exceeds available budget \u2013 complete the funding plan below.</span>'))+'</div></div><div style="flex:0 0 230px;padding:10px 12px;border-left:1px solid rgba(var(--fg-rgb),.08)">'+costRow('Development costs',fmtMoney(devCost(i)))+costRow('Rollout costs',fmtMoney(opsRolloutCost(i)))+costRow('Sustainment costs',fmtMoney(opsSustainCost(i))+'/yr')+'</div></div>','margin-bottom:12px')})}
// 3. one batch-aware chart card — waterfall and cumulative, both open (Paul, July 7)
if(!orgMonthly())h+=card('<h3 class="h-sub-md">On the calendar</h3><p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the source-of-truth charts.</p>','margin-bottom:16px');
else{var extras2=selIdx2.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss2}});
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">On the calendar'+(selIdx2.length?' \u2013 staged batch included':'')+'</h3>'+zoomBtn('ac_wf')+'</div><p class="t-faint-sm" style="margin-bottom:10px">'+(selIdx2.length?'The standing baseline with the staged batch stacked on top \u2013 the same picture as the sandbox.':'Every committed promise at its month on the program calendar, against the capacity line.')+'</p>'+orgWaterfallChart(extras2)
+'<div style="margin-top:16px"><div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">Cumulative commitments vs capacity</h3>'+zoomBtn('ac_cum')+'</div>'+(function(){var _bx=capBreaches(extras2);return _bx.overCapMonth?'<p class="fs-13" style="margin:6px 0 6px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+_bx.overCapMonth+'.</p>':'<p class="t-faint-sm" style="margin:6px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'})()+orgCumChart(extras2)+'</div>','margin-bottom:16px')}
// 4. funding plan — open and bordered when breached, folded otherwise
var fpBody=(breached?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+br.overCapMonth+'. Reallocate, revise costs, drop candidates \u2013 or proceed with a recorded override (shown at the quarterly review).</p>':(function(){var L=capLens();var anyDef=false;
var strip=L.years.map(function(r){if(r.available<0)anyDef=true;return'Year '+r.y+' <strong style="color:'+(r.available<0?'#C25B73':'var(--ph1-t)')+'">'+(r.available<0?'\u2212'+fmtMoney(Math.abs(r.available)):fmtMoney(r.available))+'</strong>'}).join(' \u00b7 ');
return'<p class="t-faint-sm" style="margin-bottom:8px">Available by year: '+strip+' \u00b7 whole window <strong>'+fmtMoney(L.tot.available)+'</strong>. '+(anyDef?'Complete the funding plan below to close the gap before advancing further projects into the years in the red.':'If advancing a project pushes a year into the red, complete the funding plan below before it moves.')+'</p>'})())
+(ctOnly?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-pale)">\u26a0 Within capacity as committed, but stated contingencies would cross it in Month '+br.ctOverCapMonth+'.</p>':'')+fundPlanLines();
if(breached)fpBody+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.08)"><div class="t-faint-sm" style="margin-bottom:4px">PROCEED ANYWAY \u2013 RECORDED OVERRIDE</div><div class="flx-g3" style="align-items:center"><input id="cap_overrideReason" placeholder="Why this is acceptable \u2013 shown at the quarterly review" class="row-input" style="flex:3"/>'+btn('Record override','capOverrideRecord()','bg2','font-size:12px;padding:6px 12px')+'</div></div>';
if(ovs.length)fpBody+='<div class="t-faint-sm" style="margin:10px 0 4px">OVERRIDES ON RECORD</div>'+ovs.map(function(o){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(o.reason||'')+'</span><span class="t-faint-sm">month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join('');
if(breached||ctOnly)h+=card('<h3 class="h-sub-md">Capacity Breach Funding Plan</h3>'+fpBody,'margin-bottom:16px'+(breached?';border:1px solid rgba(212,160,23,.5)':';border:1px solid rgba(232,212,139,.35)'));
else{var _fpo=!!UI.expanded['fpA'];
h+=card('<div class="xh" style="cursor:pointer" onclick="UI.expanded[\'fpA\']=!UI.expanded[\'fpA\'];render()"><h3 class="h-sub-md" style="margin:0">'+(_fpo?'\u25be':'\u25b8')+' Capacity Breach Funding Plan</h3></div>'+(_fpo?'<div style="margin-top:10px">'+fpBody+'</div>':''),'margin-bottom:16px')}
// 4b. the committed calendar — own expandable card (Paul, July 7)
if(orgMonthly()){var _swm=!!UI.expanded['acSwim'];
h+=card('<div class="xh" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="UI.expanded[\'acSwim\']=!UI.expanded[\'acSwim\'];render()"><h3 class="h-sub-md" style="flex:1;margin:0">'+(_swm?'\u25be':'\u25b8')+' The committed calendar (swimlanes)</h3>'+(_swm?'<span onclick="event.stopPropagation()">'+zoomBtn('ac_swim')+'</span>':'')+'</div>'+(_swm?'<div style="margin-top:10px">'+orgSwimlanes(extras2)+'</div>':''),'margin-bottom:16px')}
// 5. folded ledger detail: itemized committed sums and the kill & phase-out pot
var _ref=!!UI.expanded['acRef'];
h+='<div style="margin-bottom:16px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'acRef\']=!UI.expanded[\'acRef\'];render()">'+(_ref?'\u25be':'\u25b8')+' Committed Sums & Kill Pot</button></div>';
if(_ref){h+=capReadout()}
// 6. advanced — the undo list stays last
var adv=stages.experiment;
if(adv.length){h+='<h3 class="h-sub-md" style="margin-top:10px">Advanced to Development ('+adv.length+')</h3>';
adv.forEach(function(i){h+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">Development Costs '+fmtMoney(devCost(i))+'</span><button onclick="toggleExpSel('+i+')" class="btn-ghost pad-chip-sm">\u21a9 Return to Exploration</button></div>'})}}
return h}
function renderStepAlloc() {
  var cap = data.capital || {}, ideas = data.ideas || [], stages = getStages(), proj = data.projects || {}, port = data.portfolio || {}, ca = data.capAlloc || {};
  var goP = stages.explore.filter(function (i) { return (proj[i] || {}).viable === true });
  var av = capAvailable();
  if (UI.capTab == null || UI.capTab > 2) UI.capTab = 1; if (!UI.capSim) UI.capSim = {};
  var h = vp('V-3.3.1', 'Allocate Capital', '3\u20135 min');
  h += '<h2 class="h-section">Step 3: Allocate Capital</h2><p class="t-lead">Model batches of projects in the sandbox first. Select candidate groups and the charts will redraw to show what the portfolio\u2019s financial position would look like if these projects moved forward. When the mix looks right, move to the Commit & Advance tab, where you can assign each project an assumed start date and then advance it to the development portfolio.</p>';
  h += allocCore();
  var advOk = stages.experiment.length > 0;
  h += doneBtn('saveDoneAlloc()', !advOk, null, (data.completedSteps || {})['3.3'], 'Advance at least one project.');
  return h
}
function advanceWithGates(i) {
  var pb = (data.portfolio || {})[i] || {};
  if (!(pb.horizon && pb.risk && pb.reward)) { try { alert('Grade horizon, risk, and reward at Step 3.1 before advancing.') } catch (e) { } return }
  var cap2 = data.capital || {}; var _brA = capBreaches([capAssumedExtra(i)]);
  if (_brA.overCapMonth && !String(cap2.reallocation || '').trim() && !String(cap2.gapPlan || '').trim()) { try { alert('This advance would cross cumulative capacity in Month ' + _brA.overCapMonth + ' \u2013 complete the funding plan (reallocation sources or gap plan) first.') } catch (e) { } return }
  if (!data.projects) data.projects = {}; if (!data.projects[i]) data.projects[i] = {}; if (!data.projects[i].startDate) { var _d = new Date(); _d.setDate(1); _d.setMonth(_d.getMonth() + 1); data.projects[i].startDate = _d.toISOString().split('T')[0] }
  advanceToDevFromExplore(i)
}
function saveDoneAlloc() { if (!confirmStepDone('3.3')) return; if (!Collab.lockedByOther('capital')) { if (!data.capital) data.capital = {};['reallocation', 'gapPlan'].forEach(function (fld) { var e = $('cap_' + fld); if (e && e.value !== undefined) data.capital[fld] = e.value }) } if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['3.3'] = true; stampStepDone('3.3'); saveData(); render() }
/* Define Development Program (Step 3.4 rebuild, July 5). Doctrine: the budget
   plan's development steps ARE the program's phases - one list, two lenses. This
   page adds the contract to each phase (owner, success metric, exit criteria);
   money fields reuse the plan-editor save path (bpRowSave). Gates are decision
   records taken as phases end (Step 4.1 / Development portfolio), never funding
   valves; the estimate commits whole at advancement. */
var PROG_TPL = [
  { n: 'Observation & design', d: 'Shadow the current process, capture failure modes, specify the solution' },
  { n: 'Paper prototype', d: 'Manual mock of the future workflow \u2013 no build, real users' },
  { n: 'Experiment', d: 'Build and run the test that answers the core hypothesis' },
  { n: 'Pilot', d: 'Limited live deployment against agreed thresholds' },
  { n: 'Rollout preparation', d: 'Hardening, training, and handover design' },
  { n: '', d: '' }];
function pgDelPhase(i, id) { try { if (!confirm('Delete this phase? Its budget line, dates, description, and gate criteria will all be removed.')) return } catch (e) { } bpDelStep(i, 'dev', id) }
function addProgPhase(i, t) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var tp = PROG_TPL[t] || PROG_TPL[5]; var p = bpEnsure(i); if (!p.dev) p.dev = []; p.dev.push({ id: uid(), name: tp.n, desc: '', from: '', to: '', cost: '' }); Store.commit('budgetPlans', i); render() }
function addProgPhaseSel(i) { var e = $('pgTpl_' + i); addProgPhase(i, e ? parseInt(e.value, 10) : 5) }
function addProgDefault(i) { if (Collab.lockedByOther('budgetPlans::' + i)) return; var p = bpEnsure(i); if (!p.dev) p.dev = []; p.dev.push({ id: uid(), name: 'Design & build experiment', desc: '', from: '', to: '', cost: '' }); p.dev.push({ id: uid(), name: 'Run & evaluate', desc: '', from: '', to: '', cost: '' }); Store.commit('budgetPlans', i); render() }
function progContracted(i) { if (!bpHasDev(i)) return false; var okAll = true; bpRows(i, 'dev').forEach(function (r) { if (!r) return; if (!bpStepMoney(r) || !String(r.powner || '').trim() || !String(r.pmetric || '').trim() || !String(r.pexit || '').trim()) okAll = false }); return okAll }
function pgTa(i, r, f, label, ph, rows) { return '<div class="mb-4" style="flex:1;min-width:180px"><label class="form-label">' + esc(label) + '</label><textarea id="pgf_' + i + '__' + r.id + '__' + f + '" rows="' + (rows || 1) + '" class="ta-helper gate-field" onchange="bpRowSave(' + i + ',\'dev\',\'' + r.id + '\',\'' + f + '\',this.value)" placeholder="' + esc(ph || '') + '">' + esc(r[f] || '') + '</textarea></div>' }
function progEditor(i) {
  var rows = bpRows(i, 'dev').filter(function (r) { return !!r });
  var h = '<h4 style="font-size:17px;font-weight:700;color:var(--paper);margin:14px 0 10px">Project Development Program</h4>';
  if (!rows.length) { h += '<p class="t-faint-sm" style="margin:0 0 8px">No development phases yet. Start from the two-phase default \u2013 the module\u2019s experiment path \u2013 or add phases from the template list. Every phase carries a budget, an owner, a success metric, and exit criteria; a gate decision is taken as each phase ends.</p>' + btn('Create two-phase program', 'addProgDefault(' + i + ')', 'bg2', 'font-size:11px;padding:3px 10px') }
  else {
    var H34 = parseInt((bpGet(i) || {}).horizon, 10) || 3; rows.forEach(function (r, ix) {
      h += '<div style="border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;padding:12px;margin-bottom:18px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px"><div style="font-size:14px;font-weight:700;color:var(--paper)">Phase ' + (ix + 1) + '</div><button class="btn-ghost pad-chip-sm" style="font-size:10.5px" onclick="pgDelPhase(' + i + ',\'' + r.id + '\')">Delete phase</button></div>'
        + '<div style="max-width:260px">' + pgTa(i, r, 'powner', 'Owner *', 'e.g. Robin Vance') + '</div>'
        + '<div class="flx-g3" style="align-items:center;margin-bottom:2px"><span class="form-label" style="flex:2;margin:0">Phase name</span><span class="form-label" style="flex:0 0 136px;margin:0">Months</span><span class="form-label" style="flex:0 0 140px;margin:0">Phase budget</span></div>'
        + bpStepRow(i, 'dev', r, H34, true, true)
        + '<div style="margin-top:10px"><label class="form-label">Phase description</label>' + bpDescTa('bps_' + i + '_dev_' + r.id + '_desc', r.desc, "bpRowSave(" + i + ",'dev','" + r.id + "','desc',this.value)", 3, 'Describe the development phase') + '</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' + pgTa(i, r, 'pmetric', 'Success metrics *', 'e.g. Quote turnaround < 4 hours', 2) + pgTa(i, r, 'pexit', 'Exit gate criteria *', 'e.g. \u2265 90% routing accuracy over four weeks', 2) + '</div>'
        + (r.gateDec ? '<p class="t-faint-sm" style="margin:2px 0 6px">Gate taken: ' + esc(r.gateDec) + (r.gateAt ? ' \u00b7 ' + fmtDate(r.gateAt) : '') + '</p>' : '') + '</div>'
    })
  }
  h += '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><select id="pgTpl_' + i + '" style="font-size:11px;padding:3px 6px;background:rgba(var(--fg-rgb),.04);color:var(--text-max);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px">' + PROG_TPL.map(function (t, x) { return '<option value="' + x + '" style="background:var(--menu-bg);color:var(--menu-fg)">' + (t.n || 'Custom phase') + '</option>' }).join('') + '</select>' + btn('+ Add phase', 'addProgPhaseSel(' + i + ')', 'bg2', 'font-size:11px;padding:3px 10px') + '</div>';
  if (bpHasDev(i)) h += '<p class="t-faint-sm" style="margin-top:8px">The committed sum for this project is calculated from these phases. Adding phases or changing budgets changes the project\u2019s committed cost across the program. After making changes here, review headroom at Allocate Capital (Step 3.3) to confirm the plan still fits the budget.</p>';
  return h
}
function renderStepExp() {
  var ideas = data.ideas || [], stages = getStages(), exp = data.experiments || {}, exSel = (data.expSelected || []).filter(function (i) { return !isArchived(i) });
  var devSel = exSel.filter(function (i) { return (stages.operational || []).indexOf(i) < 0 });
  var allContracted = devSel.length > 0 && devSel.every(function (i) { return progContracted(i) });
  var h = vp('V-3.4.1', 'Phases, Gates, and the Development Program', '3\u20135 min');
  h += '<h2 class="h-section">Step 4: Map Development Track</h2><p class="t-lead">The first batch of projects has now advanced from the Exploration portfolio to the Development portfolio. Each one needs a defined development program to carry it from planned-out idea to a project ready for live implementation. Development programs run across a number of phases, each with its own budget, owner, success metrics, and exit criteria. No project moves forward without passing through a rigorous gate at the end of each phase \u2013 a gate that either unlocks the funding for the next phase or passes the project through to the Operational portfolio. The number of phases is customizable: more complex or higher-risk projects warrant more of them.</p>';
  if (devSel.length > 5) h += '<p class="t-faint-sm" style="margin-top:6px">You have ' + devSel.length + ' projects in Development \u2013 the 90-day program recommends running no more than five at once.</p>';
  if (devSel.length === 0) { h += card('<div class="empty-state"><p class="t-faint">Nothing in Development yet \u2013 advance projects at Step 3.3 (Allocate Capital).</p></div>') }
  else {
    h += '<div class="u-062d4a8"><h3 class="u-0c241bf">Development Programs</h3>';
    devSel.forEach(function (i) {
      var e = exp[i] || {}, idea = ideas[i]; var open = UI.expanded['xb' + i] !== false; var isR = progContracted(i), _ph = bpHasDev(i);
      var head = '<div class="xh" onclick="event.stopPropagation();UI.expanded[\'xb' + i + '\']=UI.expanded[\'xb' + i + '\']===false?true:false;render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">' + (open ? '\u25be' : '\u25b8') + '</span><h4 class="u-32b14d6" style="flex:1;margin:0;font-size:17px">' + esc(idea ? idea.name : 'Item ' + i) + '</h4>' + badge(isR ? 'gates defined' : _ph ? 'phases defined' : 'no program yet', isR ? '#1B6B5A' : _ph ? '#8B5E3C' : '#57534B') + '</div>';
      var body = '';
      if (open) {
        body = '<div style="margin-top:12px">' + ideaCardFold(i, 'ic34')
          + '<div style="margin:10px 0"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pc34' + i + '\']=!UI.expanded[\'pc34' + i + '\'];render()">' + (UI.expanded['pc34' + i] ? '\u25be' : '\u25b8') + ' Project card</button>' + (UI.expanded['pc34' + i] ? projCardRO(i) : '') + '</div>'
          + '<div style="display:grid;grid-template-columns:5fr 5fr minmax(150px,2fr);gap:12px;margin-top:4px">' + '<div class="lbl-lg">' + ta('Objectives', 'expl_' + i + '_obj', ((data.projects || {})[i] || {}).objectives || '', 'What this project is meant to achieve', 2) + '</div><div class="lbl-lg">' + ta('Deliverables', 'expl_' + i + '_del', ((data.projects || {})[i] || {}).deliverables || '', 'What it will hand over', 2) + '</div>' + bpHeadlineBudget(i, e) + '</div>'
          + progEditor(i) + '</div>'
      }
      h += card(head + body, 'border-left:4px solid #8B5E3C;margin-bottom:16px' + (open ? '' : ';cursor:pointer'), xpandAttr('xb' + i, open))
    });
    h += '</div>'
  }
  h += doneBtn('saveDoneProg()', !allContracted, '\u2713 Development Track Set \u2014 Ready for Phase 4', (data.completedSteps || {})['3.4'], 'Give every phase a budget, an owner, a success metric, and exit criteria.');
  return h
}
function saveDoneProg() { if (!confirmStepDone('3.4')) return; if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['3.4'] = true; stampStepDone('3.4'); saveData(); render() }
function toggleExpSel(i) { if (!data.expSelected) data.expSelected = []; var idx = data.expSelected.indexOf(i); if (idx >= 0) data.expSelected.splice(idx, 1); else data.expSelected.push(i); data.capStale = true; Store.commit('expSelected'); Store.commit('capStale'); render() }
