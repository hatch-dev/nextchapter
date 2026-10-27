/* ============================================================
   steps/phase2.js - Phase 2 Organize - steps 2.1-2.4
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   Per-step body renderers + their save helpers for this phase; routed
   to from renderStepContent() in app.js. Rely on app.js/lib globals:
   data, Store, UI, render, ta, sel, likert, card, btn, doneBtn, fldSave,
   getStages, esc, and related helpers.
   ============================================================ */

// === PHASE 2 STEPS ===
function renderStep21() {
  var ow = data.ownership || {}; var leads = ow.leads || []; var seniors = ow.seniors || [];
  /* The RACI matrix seats the Pipeline Owner plus RACI_MAX_PEOPLE named people, so
     both lists share one ceiling. Swap "+ Add" for the reason it is gone rather than
     leaving a button that quietly does nothing. */
  var capNote = '<p class="t-faint-sm" style="margin:2px 0 0">Maximum ' + RACI_MAX_PEOPLE + ' people across both lists (plus the Pipeline Owner). Remove someone to add another.</p>';
  var addLeadBtn = raciAtCap() ? capNote : btn('+ Add', 'addLead()', 'bs');
  var addSeniorBtn = raciAtCap() ? capNote : btn('+ Add', 'addSenior()', 'bs');
  var h = vp('V-2.1.1', 'Pipeline Ownership', '3\u20135 min');
  h += '<h2 class="h-section">Step 1: Ownership & Structure</h2><p class="t-lead">The pipeline needs one owner with real authority: someone who can approve experiments, kill projects, and move budget without asking permission. Back the owner with two supporting groups. Embedded leads are the people inside each department who make experiments and deployments work on the ground. Engaged senior leaders are the executives whose visible support keeps the pipeline funded and legitimate. Finish by filling in the RACI matrix so every recurring activity has exactly one accountable name.</p>';
  h += card('<h3 class="h-sub-lg">Pipeline Owner</h3>' + ta('Name *', 'ow_ownerName', ow.ownerName, 'e.g. Maria Torres', 1) + ta('Role *', 'ow_ownerRole', ow.ownerRole, 'e.g. CEO', 1) + ta('Authority', 'ow_authority', ow.authority, 'e.g. Approve/kill, reallocate budget', 2), 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Embedded Leads</h3><p class="t-faint-sm" style="margin:-2px 0 10px">One per department that will run experiments. These are doers, not sponsors.</p>' + leads.map(function (l, i) { return '<div class="u-d34ea2f"><input id="lead_' + i + '_name" value="' + esc(l.name) + '" placeholder="Name" onchange="saveLeads()" class="row-input"/><input id="lead_' + i + '_dept" value="' + esc(l.dept) + '" placeholder="Dept" onchange="saveLeads()" class="row-input"/><button onclick="removeLead(' + i + ')" class="no-btn">\xd7</button></div>' }).join('') + addLeadBtn, 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">Engaged Senior Leaders</h3><p class="t-faint-sm" style="margin:-2px 0 10px">Executives who will visibly back the pipeline. Named support beats general goodwill.</p>' + seniors.map(function (l, i) { return '<div class="u-d34ea2f"><input id="senior_' + i + '_name" value="' + esc(l.name) + '" placeholder="Name" onchange="saveSeniors()" class="row-input"/><input id="senior_' + i + '_role" value="' + esc(l.role) + '" placeholder="Position" onchange="saveSeniors()" class="row-input"/><button onclick="removeSenior(' + i + ')" class="no-btn">\xd7</button></div>' }).join('') + addSeniorBtn, 'margin-bottom:16px');
  h += card('<h3 class="h-sub-lg">RACI Matrix</h3><p class="t-fade-fs13">\u201cR\u201d indicates that this individual is responsible for the activity and does the work. \u201cA\u201d means the person is accountable and owns the outcome (with exactly one \u201cA\u201d per activity). \u201cC\u201d means the person is consulted before decisions. \u201cI\u201d means the person is informed after decisions. Assign a letter for each activity and person. A printable version lives under Phase 2 outputs.</p>' + '<div id="raciBox">' + raciMatrix(false) + '</div>');
  h += doneBtn('saveDone21()', !(ow.ownerName && ow.ownerRole), null, (data.completedSteps || {})['2.1']); return h
}
function saveOw() { if (!data.ownership) data.ownership = {};['ownerName', 'ownerRole', 'authority'].forEach(function (f) { var e = $('ow_' + f); if (e) data.ownership[f] = e.value }); Store.commit('ownership') }
function saveLeads() { if (!data.ownership) data.ownership = {}; var leads = data.ownership.leads || []; for (var i = 0; i < leads.length; i++) { var n = $('lead_' + i + '_name'), d = $('lead_' + i + '_dept'); if (n) leads[i].name = n.value; if (d) leads[i].dept = d.value } data.ownership.leads = leads; Store.commit('ownership'); refreshRaci() }
function addLead() { if (lockBlocked('ownership')) return; if (raciAtCap()) return; if (!data.ownership) data.ownership = {}; if (!data.ownership.leads) data.ownership.leads = []; data.ownership.leads.push({ id: uid(), name: '', dept: '' }); Store.commit('ownership'); render() }
function removeLead(i) { if (lockBlocked('ownership')) return; var _rm = ((data.ownership || {}).leads || [])[i]; data.ownership.leads = data.ownership.leads.filter(function (_, j) { return j !== i }); if (_rm && _rm.id) purgeRaciFor(_rm.id); Store.commit('ownership'); render() }
function saveSeniors() { if (!data.ownership) data.ownership = {}; var sl = data.ownership.seniors || []; for (var i = 0; i < sl.length; i++) { var n = $('senior_' + i + '_name'), r = $('senior_' + i + '_role'); if (n) sl[i].name = n.value; if (r) sl[i].role = r.value } data.ownership.seniors = sl; Store.commit('ownership'); refreshRaci() }
function addSenior() { if (lockBlocked('ownership')) return; if (raciAtCap()) return; if (!data.ownership) data.ownership = {}; if (!data.ownership.seniors) data.ownership.seniors = []; data.ownership.seniors.push({ id: uid(), name: '', role: '' }); Store.commit('ownership'); render() }
function removeSenior(i) { if (lockBlocked('ownership')) return; var _rm = ((data.ownership || {}).seniors || [])[i]; data.ownership.seniors = (data.ownership.seniors || []).filter(function (_, j) { return j !== i }); if (_rm && _rm.id) purgeRaciFor(_rm.id); Store.commit('ownership'); render() }
function saveDone21() { if (!confirmStepDone('2.1')) return; saveOw(); saveLeads(); saveSeniors(); if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['2.1'] = true; stampStepDone('2.1'); saveData(); render() }

function renderStep22() {
  var inc = data.incentives || {};
  var h = vp('V-2.2.1', 'Incentive Realignment', '3\u20135 min');
  h += '<h2 class="h-section">Step 2: Realign Incentives</h2><p class="t-lead">Humans almost always direct their greatest energy and attention toward behaviors that are incentivized. A culture that rewards constancy and penalizes experimentation will bring an innovation pipeline to a halt regardless of the ideals an organization claims to uphold. Write down how people are actually paid, promoted, and measured today, then propose changes that make experimentation count rather than cost. The metrics list below feeds that conversation: pick the pipeline health measures your organization will start tracking.</p>';
  h += ta('Current structure *', 'inc_current', inc.current, 'e.g. Sales \u2013 quarterly commission on closed revenue, with no credit for time spent piloting new tools. Engineering \u2013 annual bonus tied to on-time roadmap delivery, so experiments compete with rewarded work. Plant supervisors \u2013 measured on throughput and defect rates alone.', 5);
  h += ta('Proposed changes *', 'inc_changes', inc.changes, 'e.g. Sales commission credits pilot participation. Engineering bonus includes one gated experiment per half.', 3);
  h += '<div class="mb-4"><label class="u-4c6db0e">Metrics to track</label>';
  var FIXM = ['Active experiments', 'Kill speed', 'Development gate throughput', 'Support for experimentation', 'Ideas surfaced at the frontline'];
  var MTIP = { 'Active experiments': 'How many experiments are running at once. Zero means the pipeline has stalled.', 'Kill speed': 'How quickly failing projects get stopped. Slow kills drain money and teach people that killing is punished.', 'Development gate throughput': 'How many projects pass through gates each quarter, in either direction. Measures whether decisions are actually being taken.', 'Support for experimentation': 'A pulse or survey measure of whether people feel safe proposing and running experiments.', 'Ideas surfaced at the frontline': 'How many improvement ideas come from the people doing the daily work.' };
  FIXM.forEach(function (m) {
    var checked = (inc.metrics || []).indexOf(m) >= 0;
    h += '<label class="u-baf6089" title="' + esc(MTIP[m] || '') + '"><input type="checkbox"' + (checked ? ' checked' : '') + ' onchange="toggleIncMetric(\'' + esc(m) + '\')" />' + m + '</label>'
  });
  (inc.metrics || []).forEach(function (m, mi) { if (FIXM.indexOf(m) >= 0) return; h += '<label class="u-baf6089"><input type="checkbox" checked onchange="removeIncMetric(' + mi + ')" /> ' + esc(m) + ' <button onclick="removeIncMetric(' + mi + ')" class="no-btn" title="Remove">\xd7</button></label>' });
  h += '<div class="flx-g3" style="margin-top:8px"><input id="inc_newMetric" placeholder="Add a custom metric\u2026" class="row-input" onkeydown="if(event.key===\'Enter\')addIncMetric()"/>' + btn('+ Add', 'addIncMetric()', 'bs', 'font-size:12px') + '</div>';
  h += '</div>' + doneBtn('saveDone22()', !(inc.current && inc.changes), null, (data.completedSteps || {})['2.2']); return h
}
function addIncMetric() { var e = $('inc_newMetric'); if (!e) return; var v = (e.value || '').trim(); if (!v) return; if (!data.incentives) data.incentives = {}; var arr = data.incentives.metrics || []; if (arr.indexOf(v) >= 0) { e.value = ''; return } arr.push(v); data.incentives.metrics = arr; saveData(); render() }
function removeIncMetric(mi) { if (lockBlocked('incentives')) return; var arr = (data.incentives || {}).metrics || []; arr.splice(mi, 1); Store.commit('incentives'); render() }
function toggleIncMetric(m) { if (lockBlocked('incentives')) return; if (!data.incentives) data.incentives = {}; var arr = data.incentives.metrics || []; var idx = arr.indexOf(m); if (idx >= 0) arr.splice(idx, 1); else arr.push(m); data.incentives.metrics = arr; Store.commit('incentives'); render() }
function saveDone22() { if (!confirmStepDone('2.2')) return; updObj('incentives', 'current', val('inc_current')); updObj('incentives', 'changes', val('inc_changes')); if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['2.2'] = true; stampStepDone('2.2'); saveData(); render() }

function renderStep23() {
  var rh = data.rhythm || {};
  var h = vp('V-2.3.1', 'Innovation Rhythm', '2\u20133 min');
  h += '<h2 class="h-section">Step 3: Innovation Rhythm</h2><p class="t-lead">Innovation is smothered when everyday operations are allowed to push it off the calendar. This step books protected weekly time for the pipeline. Pick a day and time that will survive contact with normal business operations, name the people who must be in the room, and set a standing agenda. Short and unmissable beats long and optional.</p>';
  h += '<div class="u-0a8321c">' + sel('Day *', 'rh_day', rh.day, [{ v: '', l: '...' }, { v: 'Mon', l: 'Mon' }, { v: 'Tue', l: 'Tue' }, { v: 'Wed', l: 'Wed' }, { v: 'Thu', l: 'Thu' }, { v: 'Fri', l: 'Fri' }]) + ta('Time', 'rh_time', rh.time, '9 AM', 1) + '</div>';
  var attList = rhAttList();
  h += '<div class="mb-4"><label class="form-label">Attendees *</label>' + attList.map(function (a, i) { return '<div class="u-d34ea2f"><input id="rhAtt_' + i + '" value="' + esc(a) + '" placeholder="Name" onchange="saveAttendees()" class="row-input"/><button onclick="removeAttendee(' + i + ')" class="no-btn">\xd7</button></div>' }).join('') + btn('+ Add attendee', 'addAttendee()', 'bs', 'font-size:12px') + '</div>';
  var agList = rhAgList();
  h += '<div class="mb-4"><label class="form-label">Agenda</label>' + agList.map(function (a, i) { return '<div class="u-d34ea2f"><input id="rhAg_' + i + '" value="' + esc(a) + '" placeholder="e.g. Development gate reviews (10 min)" onchange="saveAgendaItems()" class="row-input"/><button onclick="removeAgendaItem(' + i + ')" class="no-btn">\xd7</button></div>' }).join('') + btn('+ Add item', 'addAgendaItem()', 'bs', 'font-size:12px') + '</div>';
  h += doneBtn('saveDone23()', !(rh.day && rhAttNames().length), null, (data.completedSteps || {})['2.3']); return h
}
function rhAgList() { var rh = data.rhythm || {}; if (Array.isArray(rh.agendaList)) return rh.agendaList; var a = rh.agenda; if (typeof a === 'string' && a.trim()) return a.split(/\n|,/).map(function (x) { return x.replace(/^\s*\d+[\.\)]\s*/, '').replace(/\.\s*$/, '').trim() }).filter(Boolean); return [] }
function saveAgendaItems() { if (Collab.lockedByOther('rhythm')) return; if (!data.rhythm) data.rhythm = {}; var a = rhAgList().slice(); for (var i = 0; i < a.length; i++) { var e = $('rhAg_' + i); if (e) a[i] = e.value } data.rhythm.agendaList = a; Store.commit('rhythm'); refreshSecDone() }
function addAgendaItem() { if (lockBlocked('rhythm')) return; if (!data.rhythm) data.rhythm = {}; data.rhythm.agendaList = rhAgList().slice(); data.rhythm.agendaList.push(''); Store.commit('rhythm'); render() }
function removeAgendaItem(i) { if (lockBlocked('rhythm')) return; if (!data.rhythm) data.rhythm = {}; data.rhythm.agendaList = rhAgList().filter(function (_, j) { return j !== i }); Store.commit('rhythm'); render() }
function rhAttList() { var rh = data.rhythm || {}; var a = rh.attendees; if (Array.isArray(a)) return a; if (typeof a === 'string' && a.trim()) return a.split(/[,+;]/).map(function (x) { return x.trim() }).filter(Boolean); return [] }
function rhAttNames() { return rhAttList().filter(function (x) { return x && String(x).trim() }) }
function saveAttendees() { if (Collab.lockedByOther('rhythm')) return; if (!data.rhythm) data.rhythm = {}; var a = rhAttList(); for (var i = 0; i < a.length; i++) { var e = $('rhAtt_' + i); if (e) a[i] = e.value } data.rhythm.attendees = a; Store.commit('rhythm'); refreshSecDone() }
function addAttendee() { if (lockBlocked('rhythm')) return; if (!data.rhythm) data.rhythm = {}; data.rhythm.attendees = rhAttList(); data.rhythm.attendees.push(''); Store.commit('rhythm'); render() }
function removeAttendee(i) { if (lockBlocked('rhythm')) return; if (!data.rhythm) data.rhythm = {}; data.rhythm.attendees = rhAttList().filter(function (_, j) { return j !== i }); Store.commit('rhythm'); render() }
function saveDone23() { if (!confirmStepDone('2.3')) return;['day', 'time', 'agenda'].forEach(function (f) { updObj('rhythm', f, val('rh_' + f)) }); saveAttendees(); if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['2.3'] = true; stampStepDone('2.3'); saveData(); render() }

function aurora24Example() {
  var F = function (l, v) { return '<div><div class="u-b25d981" style="margin-bottom:3px">' + l + '</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">' + v + '</div></div>' };
  var DIV = '<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:14px 0"></div>';
  var GA = function (g) {
    var li = function (arr, col) { return arr.length ? arr.map(function (x) { return '<div class="fs-13" style="margin-bottom:3px' + (col ? ';color:' + col : ';color:var(--text-muted)') + '">' + x + '</div>' }).join('') : '<div class="t-faint-sm">\u2014</div>' };
    return '<div style="margin-bottom:4px"><div style="font-size:13px;font-weight:700;color:var(--paper);margin-bottom:5px">' + g.l + '</div><div class="gr-3-sm"><div><div class="t-faint-sm" style="margin-bottom:3px">NEED</div>' + li(g.have.concat(g.gap)) + '</div><div><div class="t-faint-sm" style="margin-bottom:3px">HAVE</div>' + li(g.have) + '</div><div><div class="t-faint-sm" style="margin-bottom:3px">GAP</div>' + li(g.gap, '#D4A017') + '</div></div></div>'
  };
  var Q4 = [{ k: 's', l: '+ STRENGTHS', c: 'var(--ph1-t)', bg: 'rgba(27,107,90,.10)' }, { k: 'w', l: '\u2212 WEAKNESSES', c: '#C25B73', bg: 'rgba(155,45,63,.08)' }, { k: 'o', l: '\u25c9 OPPORTUNITIES', c: 'var(--ph2-t)', bg: 'rgba(45,90,142,.10)' }, { k: 't', l: '\u25b3 THREATS', c: '#D4A017', bg: 'rgba(139,94,60,.10)' }];
  var D = [
    {
      n: 'AI-Powered Quoting Engine', v: '\u2713 Go', intro: 'Friction #1 \u2014 slow quoting. Custom commercial jobs wait three to four days for a price while estimators rebuild every spec by hand.',
      obj: 'Cut quote turnaround on custom commercial jobs from 3\u20134 days to under 24 hours; lift quote-to-order conversion by 10% within two quarters. Direct line to the 40% growth goal without added headcount.',
      del: 'Quoting model trained on five years of historical quotes and win/loss data; spec-intake form feeding the ERP; estimator review screen with hard margin-floor guardrails.',
      tl: '10 weeks \u2013 data preparation and spec taxonomy weeks 1\u20133, model build and ERP integration weeks 4\u20137, supervised pilot with two senior estimators weeks 8\u201310.',
      res: '$48K \u2013 external machine-learning contractor (12 days), internal systems lead two days a week, estimator time for validation sessions.',
      risk: 'Five years of quotes encode old pricing mistakes; estimator trust collapses if early drafts misprice complex glazing; loose guardrails leak margin.',
      met: 'Median turnaround under 24 hours; estimators accept at least 80% of drafted quotes; zero quotes released below the margin floor.',
      gap: [{ l: 'Skills', have: ['Estimating team that knows every failure mode in the product line'], gap: ['Review-and-correct discipline \u2013 treating drafts as drafts, not answers'] },
      { l: 'Resources', have: ['Five years of quote and win/loss history in the ERP'], gap: ['A cleaned, consistent spec taxonomy \u2013 three weeks of unglamorous data work'] },
      { l: 'Technology', have: ['ERP with working export APIs'], gap: ['Hosted model gateway with audit logging on every generated quote'] }],
      swot: { s: 'Deep, labeled pricing history; estimators want this fixed \u2013 quoting is their pain, not a leadership hobby.', w: 'Spec data inconsistent across product lines; nobody owns pricing data quality today.', o: 'The spec taxonomy built here later powers the customer portal and design tooling.', t: 'Competitors already quote with AI assistance; volatile input costs can outdate training data fast.' },
      pI: 'Sales operations for the spec taxonomy; finance for margin floors and approval thresholds.', pE: 'Regional systems integrator for the ERP connector; model vendor\u2019s solutions engineer for the gateway.',
      call: 'Go. Pays back inside a year on estimator hours alone, and the spec cleanup compounds into two later projects. First revenue-side win for the pipeline.'
    },
    {
      n: 'Computer Vision QC', v: '\u2713 Go \u00b7 staged', intro: 'Friction #2 \u2014 inconsistent QC. Defect catch rates vary by inspector and by shift; rework and warranty claims eat margin.',
      obj: 'Catch at least 90% of seal and glazing defects at the line before assembly; cut rework and warranty cost on pilot lines by 25% within twelve months. This is the margin-protection project.',
      del: 'Camera rigs on the two highest-defect lines; trained defect-detection models; live inspection dashboard with operator override; a structured defect dataset that later feeds maintenance prediction and supplier quality work.',
      tl: 'Six months, staged \u2013 months 1\u20132 camera install and labeled defect library on Line 2; months 3\u20134 model training in shadow mode; Months 5\u20136 live alerts. Hard gate at Month 2: at least 5,000 labeled images before the model budget releases.',
      res: '$140K phased \u2013 $55K cameras and edge compute, $60K computer-vision development partner, $25K integration and operator training. Plant quality lead at half-time.',
      risk: 'Lighting and reflection on glass is the genuinely hard problem; operators reading the cameras as surveillance; model drift as the product mix shifts.',
      met: 'At least 90% detection on labeled defect classes; false-alert rate under 5%; rework cost on pilot lines down 25%.',
      gap: [{ l: 'Skills', have: ['Inspectors who know every defect cold and can label examples'], gap: ['Computer-vision expertise \u2013 bought, not built, for the first version'] },
      { l: 'Resources', have: ['Stable production schedule with workable pilot windows'], gap: ['The labeled image library \u2013 building it is the first gate'] },
      { l: 'Technology', have: ['Networked plant with camera mounting points on both lines'], gap: ['Edge inference hardware', 'A data pipeline off the line'] }],
      swot: { s: 'Defects are visually distinctive and the inspectors know them cold.', w: 'No in-house computer-vision capability; glass reflectivity defeats naive approaches.', o: 'The defect dataset is the foundation asset \u2013 maintenance prediction, supplier feedback, and design optimization all build on it.', t: 'A failed pilot in full view of the shop floor would set AI credibility back company-wide.' },
      pI: 'Plant operations for line access windows; shift leads on camera-use policy before a single camera goes up.', pE: 'Computer-vision vendor with glass or glazing references; camera and edge hardware supplier.',
      call: 'Go, staged. The most strategic project in the portfolio because of what its data unlocks \u2013 but it advances on gates, not enthusiasm. If the month-2 labeling gate fails, it returns to the backlog rather than limping forward.'
    },
    {
      n: 'Innovation Idea Portal', v: '\u2713 Go', intro: 'Friction #3 \u2014 no idea capture. The ideation workshop produced 23 ideas in a day; there is no channel for the next one.',
      obj: 'Institutionalize frontline idea capture \u2013 100 submissions in the first quarter across the plant and both hubs, every one triaged inside two weeks. This is the mechanism that keeps the pipeline fed.',
      del: 'Submission portal on the existing low-code platform; monthly triage board owned by the innovation council; a visible status page so every submitter sees what happened to their idea.',
      tl: 'Four weeks \u2013 configure weeks 1\u20132, pilot with two shift teams week 3, company-wide launch week 4.',
      res: '$9K \u2013 low-code licenses and configuration, launch communications. Triage time already sits inside the weekly innovation rhythm.',
      risk: 'A portal nobody answers is worse than no portal \u2013 the triage rhythm is the product. Submission quality drifts without light guidance.',
      met: '100 submissions in the first quarter; 100% triaged within 14 days; at least three submissions advanced into the idea list each quarter.',
      gap: [{ l: 'Skills', have: ['Engaged shift leads from the ideation workshops'], gap: ['A simple triage rubric the council applies the same way every month'] },
      { l: 'Resources', have: ['The weekly innovation rhythm to host triage'], gap: ['A named portal owner \u2013 the council secretary, in writing'] },
      { l: 'Technology', have: ['Existing Microsoft 365 estate'], gap: [] }],
      swot: { s: 'Cheapest project in the portfolio with the broadest cultural reach.', w: 'Easy to launch, easy to abandon.', o: 'Feeds Blue Sky directly \u2013 the pipeline\u2019s replenishment mechanism.', t: 'Unanswered submissions teach the floor that leadership is not listening. The reputational downside dwarfs the dollar cost.' },
      pI: 'Human resources and communications for launch and recognition; shift leads as champions.', pE: 'None required \u2013 by design.',
      call: 'Go. Trivial cost, and the whole pipeline depends on what it feeds in \u2013 the technology is deliberately boring, so the gap column is nearly empty.'
    }];
  var inner = '<div class="u-2ad7718" style="margin-bottom:8px"><strong>Aurora:</strong> The three shortlisted ideas, taken through the full deepened assessment \u2013 the working entries behind each call, laid out the way the project card holds them.</div>' + D.map(function (d) {
    return '<details class="u-c2ef374"><summary class="u-33e06ff">' + d.n + ' ' + badge(d.v, '#1B6B5A') + '</summary>' +
      '<div class="u-2ad7718" style="margin:8px 0 12px">' + d.intro + '</div>' +
      '<h4 class="h-mini">Project Details</h4><div class="gr-2" style="row-gap:12px">' + F('Objectives', d.obj) + F('Deliverables', d.del) + F('Timeline', d.tl) + F('Resources', d.res) + F('Key risks', d.risk) + F('Success metrics', d.met) + F('Internal partners', d.pI) + F('External partners', d.pE) + '</div>' +
      DIV + '<h4 class="h-mini">Gap Analysis</h4>' + d.gap.map(GA).join('<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:10px 0 12px"></div>') +
      DIV + '<h4 class="h-mini">SWOT Analysis</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;overflow:hidden">' + Q4.map(function (q) { return '<div style="background:' + q.bg + ';padding:12px;min-height:66px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:' + q.c + ';margin-bottom:5px">' + q.l + '</div><div class="u-2ad7718">' + d.swot[q.k] + '</div></div>' }).join('') + '</div>' +
      '<div class="u-2ad7718" style="margin-top:12px;padding:10px;border-left:3px solid #1B6B5A;background:rgba(27,107,90,.06)"><strong>The call:</strong> ' + d.call + '</div></details>'
  }).join('');
  return '<div class="u-2d6fe45"><button onclick="UI.showEx.aurora24=!UI.showEx.aurora24;render()" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;border:1px dashed rgba(27,107,90,.5);background:' + (UI.showEx.aurora24 ? 'rgba(27,107,90,.06)' : 'transparent') + ';cursor:pointer;font-size:13px;font-weight:600;color:#1B6B5A;font-family:var(--sans,Helvetica Neue,sans-serif)">' + (UI.showEx.aurora24 ? '\u25be' : '\u25b8') + ' Example</button>' + (UI.showEx.aurora24 ? '<div class="u-b560a5f">' + inner + '</div>' : '') + '</div>'
}
function renderStep24() {
  var ideas = data.ideas || [], proj = data.projects || {}, as = data.assessments || {};
  var _st24 = getStages(), _adv24 = {}; _st24.experiment.concat(_st24.operational || []).forEach(function (x) { _adv24[x] = 1 });
  var _res24 = function (i) { var pr = proj[i] || {}; return pr.viable === true ? !!pr.objectives : pr.viable === false ? !!pr.noGoReason : false };
  var selAll = (data.selected || []).filter(function (i) { return !isArchived(i) && !_adv24[i] });
  var sel = selAll.filter(function (i) { return !_res24(i) });
  var h = vp('V-2.4.1', 'From Ideas to Project Cards', '3\u20135 min');
  h += '<h2 class="h-section">Step 4: Deepen Assessment</h2><p class="t-lead">Each idea you advanced now becomes a project card with a full workup. Complete the project details: gap analysis, SWOT, and project budgeting. Then re-score the project with fresh numbers and end with a verdict. \u201cGo\u201d sends it forward to Phase 3. \u201cNo Go\u201d sets it aside with a recorded reason. Flagging a project as \u201cNo Go\u201d shouldn\u2019t be seen as the idea failing \u2013 refusal to move a project forward if it doesn\u2019t fit the required criteria is what the process looks like when it\u2019s working.</p>';
  h += aurora24Example();
  if (!(data.selected || []).length) return h + card('<div class="empty-state"><p class="t-faint">Complete Phase 1 first.</p></div>');
  var allDone = selAll.every(_res24);
  if (!sel.length) { h += card('<div class="empty-state"><p class="t-faint">No projects are awaiting a verdict here. Go projects continue in Step 3.1; set-aside projects are under Not Advancing in the Exploration portfolio.</p></div>'); h += vizProjectReady(); h += notAdvPanel('24'); h += archivePanel(['explore', 'noGo'], '24'); h += doneBtn('saveDone24()', !allDone, '\u2713 All Assessed', (data.completedSteps || {})['2.4'], 'Every project needs a verdict: Go with objectives, or No Go with a reason.'); return h }
  var ap = UI.ap !== null && sel.indexOf(UI.ap) >= 0 ? UI.ap : sel[0]; UI.ap = ap;
  var p = proj[ap] || {}; var idea = ideas[ap] || {};

  // Project tabs
  h += '<div class="t-faint-sm" style="margin-bottom:6px">AVAILABLE PROJECTS</div><div class="u-917cf39">';
  sel.forEach(function (i) { var pr = proj[i] || {}; h += '<button onclick="UI.ap=' + i + ';render()" style="padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (ap === i ? (pr.viable !== undefined ? '2px solid var(--paper)' : '2px solid #2D5A8E') : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (pr.viable === true ? '#1B6B5A' : pr.viable === false ? '#9B2D3F' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (pr.viable !== undefined ? '#fff' : (ap === i ? '#2D5A8E' : 'var(--text-faint)')) + '">' + esc(ideas[i] ? ideas[i].name : '') + (pr.viable === true ? ' \u2713' : pr.viable === false ? ' \u2717' : '') + '</button>' });
  h += '</div>';

  // Project card
  h += card('<h3 class="h-sub-lg"><span style="color:var(--text-muted)">Project Name: </span>' + esc(idea.name) + '</h3>' + ideaCardFold(ap, 'ic24') + assessBlock(ap), 'margin-bottom:12px');





  // Re-score (deepened)
  var a1 = as[ap] || {}, rs = p.rescore || {};
  h += card('<h3 class="h-sub-lg">Re-score (deepened)</h3><p class="t-stone-snug">Blue-sky portfolio scores shown for reference. Enter fresh numbers now that the analysis is deeper. This becomes the working score. 10 is always the most favorable end of the scale.</p><div class="flx-g2-wrap">' + [{ k: 'priority', l: 'Priority' }, { k: 'risk', l: 'Risk(10=low)' }, { k: 'value', l: 'Value' }, { k: 'costScore', l: 'Cost(10=low)' }, { k: 'difficulty', l: 'Ease(10=easy)' }].map(function (d) { var tv = (a1[d.k] != null ? a1[d.k] : '\u2014'); var cur = (rs[d.k] != null ? rs[d.k] : ''); return '<div><label class="t-faint-sm">' + d.l + '</label><div class="t-faint-sm" style="opacity:.65">First Pass: ' + tv + '</div><input type="number" min="0" max="10" id="rs_' + d.k + '" value="' + cur + '" onchange="fldSave(this.id,this.value)" class="score-mini"/></div>' }).join('') + '</div><div style="margin-top:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><button id="rsBtn" onclick="confirmRescore()"' + ((p.rescoreDone || !rsComplete(rs)) ? ' disabled' : '') + ' style="padding:8px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;background:' + (p.rescoreDone ? 'rgba(27,107,90,.25)' : rsComplete(rs) ? '#1B6B5A' : 'rgba(var(--fg-rgb),.08)') + ';color:' + (p.rescoreDone ? 'var(--ref-accent)' : rsComplete(rs) ? '#fff' : 'var(--text-faint)') + ';cursor:' + (rsComplete(rs) && !p.rescoreDone ? 'pointer' : 'default') + '">' + (p.rescoreDone ? '\u2713 Complete' : 'Mark Complete & Continue') + '</button><span class="t-stone-snug"><span id="rsTotal">' + rsTotalHtml(ap) + '</span></span></div>', 'margin-bottom:12px');

  // Go/No Go
  h += card('<h3 class="h-sub-lg">Go / No Go <span class="t-faint-sm" style="font-weight:400">(required)</span></h3><div class="flx-g3"><div style="flex:1"><button onclick="setViable(true)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (p.viable === true ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (p.viable === true ? '#1B6B5A' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (p.viable === true ? '#fff' : 'var(--stone)') + '">\u2713 Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(moves on to Step 3.1 when the verdict is complete)</p></div><div style="flex:1"><button onclick="setViable(false)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (p.viable === false ? '2px solid #9B2D3F' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (p.viable === false ? '#9B2D3F' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (p.viable === false ? '#fff' : 'var(--stone)') + '">\u2717 No Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(moves to Not Advancing in the Exploration portfolio once a reason is recorded)</p></div></div>' + (p.viable === false ? ta('Reason *', 'pj_noGoReason', p.noGoReason, '', 2) : ''), 'border-left:' + (p.viable === true ? '4px solid #1B6B5A' : p.viable === false ? '4px solid #9B2D3F' : '4px solid rgba(var(--fg-rgb),.12)'));

  h += vizProjectReady(); h += notAdvPanel('24'); h += archivePanel(['explore', 'noGo'], '24');
  h += doneBtn('saveDone24()', !allDone, '\u2713 All Assessed', (data.completedSteps || {})['2.4'], 'Every project needs a verdict: Go with objectives, or No Go with a reason.');
  return h
}


function setViable(v) { if (UI.ap === null) return; if (lockBlocked('projects::' + UI.ap)) return; saveAssessFields(UI.ap); if (!data.projects) data.projects = {}; if (!data.projects[UI.ap]) data.projects[UI.ap] = {}; var e = $('pj_noGoReason'); if (e) data.projects[UI.ap].noGoReason = e.value; data.projects[UI.ap].viable = v; saveData(); render() }
function saveDone24() { if (!confirmStepDone('2.4')) return; if (UI.ap !== null && !Collab.lockedByOther('projects::' + UI.ap)) { saveAssessFields(UI.ap); if (!data.projects) data.projects = {}; if (!data.projects[UI.ap]) data.projects[UI.ap] = {}; var e = $('pj_noGoReason'); if (e) data.projects[UI.ap].noGoReason = e.value } if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['2.4'] = true; stampStepDone('2.4'); saveData(); render() }
