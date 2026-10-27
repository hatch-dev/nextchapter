/* ============================================================
   steps/phase1.js - Phase 1 Diagnose - steps 1.1-1.3
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   Per-step body renderers + their save helpers for this phase; routed
   to from renderStepContent() in app.js. Rely on app.js/lib globals:
   data, Store, UI, render, ta, sel, likert, card, btn, doneBtn, fldSave,
   getStages, esc, and related helpers.
   ============================================================ */

// === PHASE 1 STEPS ===
// Likert setter helper
function likSet(path, n) { var parts = path.split('.'); if (lockBlocked(parts[0])) return; if (parts.length === 3) { if (!data[parts[0]]) data[parts[0]] = {}; if (!data[parts[0]][parts[1]]) data[parts[0]][parts[1]] = {}; data[parts[0]][parts[1]][parts[2]] = n } else if (parts.length === 2) updObj(parts[0], parts[1], n); else if (parts.length === 1) data[parts[0]] = n; Store.commit(parts[0], parts.length >= 2 ? parts[1] : null); render() }
// Generic field change from DOM
function renderStep11() {
  var p = data.purpose || {}, k = data.knowledge || {}, cu = data.culture || {}, au = data.audit || [], de = data.decisions || {}, co = data.completedSections || {};
  var sec = UI.sec;
  var secs = [{ id: '1.1', l: 'Purpose', c: !!co['1.1'] }, { id: '1.2', l: 'AI Knowledge', c: !!co['1.2'] }, { id: '1.3', l: 'Risk & Culture', c: !!co['1.3'] }, { id: '1.4', l: 'AI Innovation Audit', c: !!co['1.4'], inv: true }, { id: '1.5', l: 'Decision Rights', c: !!co['1.5'], inv: true }];
  var allC = secs.every(function (s) { return s.c });
  var h = vp('V-1.1.1', 'Assessment Battery', '3\u20135 min');
  h += '<h2 class="h-section">Step 1: Assessment Battery</h2><p class="t-lead">This step builds an honest picture of where your organization starts. It has five sections of two kinds. The three Questionnaire sections ask for judgments: you rate your organization and select the descriptions that fit best, drawing on what you already know. The two Investigative sections ask for facts, and you may need to go and find out what is actually happening before you can complete them. Finish all five and the Assessment Report becomes available under Outcomes.</p>';

  // Section tabs
  h += '<div class="mb-6"><div class="label-tiny-faint">Questionnaire</div><div class="u-4ce13a4">';
  secs.filter(function (s) { return !s.inv }).forEach(function (s) { h += '<button onclick="UI.sec=\'' + s.id + '\';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (sec === s.id ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (s.c ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (sec === s.id || s.c ? '#1B6B5A' : 'var(--text-faint)') + '">' + (s.c ? '\u2713' : '\u25cb') + ' ' + s.l + '</button>' });
  h += '</div><div class="label-tiny-faint">Investigative</div><div class="flx-g2-wrap">';
  secs.filter(function (s) { return s.inv }).forEach(function (s) { h += '<button onclick="UI.sec=\'' + s.id + '\';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (sec === s.id ? '2px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (s.c ? 'rgba(27,107,90,.08)' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (sec === s.id || s.c ? '#1B6B5A' : 'var(--text-faint)') + '">' + (s.c ? '\u2713' : '\u25cb') + ' ' + s.l + '</button>' });
  h += '</div></div>';

  if (sec === '1.1') { h += card('<h3 class="h-sub">1.1 Reaffirm Your Purpose</h3><p class="t-lead">Purpose is what your organization exists to do: the change it creates for its customers and the reason the work matters to the people who do it. Everything in this program will be judged against it, because AI initiatives succeed when they serve that purpose and fail when they chase the technology for its own sake. Write your purpose down as it actually is, not as your marketing materials present it or as you wish it was. Be just as honest about the frictions that stop the organization from delivering on it.</p>' + ta('Mission *', 'p_mission', p.mission, 'e.g. We design and manufacture products to bring people joy and we do it in a way that delivers maximal value to our stakeholders.', 3) + ta('Values', 'p_values', p.values, 'e.g. Quality, Partnership...', 2) + ta('Short-term targets', 'p_shortTerm', p.shortTerm, 'Next 6 months', 2) + ta('Medium-term targets', 'p_mediumTerm', p.mediumTerm, '6\u201318 months', 2) + ta('Long-term targets', 'p_longTerm', p.longTerm, '18+ months', 2) + ta('Key goals *', 'p_goals', p.goals, 'e.g. 1. Revenue growth...', 3) + ta('Friction points *', 'p_frictions', p.frictions, 'e.g. 1. Slow quoting...', 4) + doneBtn('saveSection11()', !(p.mission && p.goals && p.frictions), null, co['1.1'])) }
  if (sec === '1.2') { h += card('<h3 class="h-sub">1.2 AI Knowledge Base</h3><p class="t-lead">This section captures what your organization currently knows about AI and what it can do with this technology. Answer for the organization as a whole, not for its most advanced team, and answer as things stand today rather than as planned.</p>' + sel('Current usage *', 'k_usage', k.usage, [{ v: '', l: 'Select...' }, { v: 'none', l: 'None' }, { v: 'basic', l: 'Basic' }, { v: 'moderate', l: 'Moderate' }, { v: 'advanced', l: 'Advanced' }], 'None means no AI in use anywhere. Basic means individuals use general tools such as chatbots for their own work. Moderate means at least one team runs an AI-assisted process or purpose-built tool. Advanced means AI is embedded in core operations with people responsible for running it.') + likert('Leadership awareness *', 'knowledge.awareness', k.awareness, 'Unaware', 'Very aware', 'How well the leadership team understands what AI can and cannot do for this organization. Rate the awareness of leaders who make the investment decisions, not the best-informed individual senior executives.') + sel('Technical resources', 'k_resources', k.resources, [{ v: '', l: 'Select...' }, { v: 'none', l: 'None' }, { v: 'limited', l: 'Limited' }, { v: 'moderate', l: 'Moderate' }, { v: 'strong', l: 'Strong' }], 'The people and infrastructure available for technical work: data that is accessible and usable, systems that can be integrated, and staff or partners who can build and maintain technology.') + sel('Learning processes', 'k_learning', k.learning, [{ v: '', l: 'Select...' }, { v: 'none', l: 'None' }, { v: 'informal', l: 'Informal' }, { v: 'some', l: 'Some' }, { v: 'systematic', l: 'Systematic' }], 'How the organization turns experience into shared capability. Systematic means lessons are captured and taught and that the results change how work is done. Informal means learning stays in individual heads.') + doneBtn('saveSection12()', !(k.usage && k.awareness), null, co['1.2'])) }
  if (sec === '1.3') { h += card('<h3 class="h-sub">1.3 Risk & Culture</h3><p class="t-lead">Culture decides what happens to new ideas in your organization, and comfort with risk decides whether your team members will try something that might fail. Together these two factors predict AI success more reliably than any technical factor, which is why this section measures them before a single use case is chosen. Rate what actually happens in your organization, not what the values statement says should happen.</p>' + likert('Uncertainty *', 'culture.uncertainty', cu.uncertainty, 'Uncomfortable', 'Comfortable', 'How people respond when the outcome of a piece of work is genuinely unknown. Uncomfortable means ambiguity gets escalated or avoided. Comfortable means teams work productively without knowing how things will turn out.') + likert('AI legitimacy *', 'culture.aiLegitimacy', cu.aiLegitimacy, 'Stigma', 'Accepted', 'Whether using AI at work is seen as legitimate. Stigma means people hide their use of AI tools. Accepted means using them openly is normal and unremarkable.') + likert('New proposals', 'culture.newProposals', cu.newProposals, 'Shut down', 'Support', 'What happens when someone suggests a new way of working. Shut down means ideas die in the meeting where they are raised. Support means they get a fair hearing and a path to being tried.') + likert('Incentives', 'culture.incentives', cu.incentives, 'Punish', 'Reward', 'What the organization actually rewards and punishes. Punish means a failed initiative damages a career. Reward means a well-run attempt counts in your favor even when it fails.') + likert('Frontline', 'culture.frontline', cu.frontline, 'None', 'Strong', 'How much improvement comes from the people who do the daily work. None means change only arrives from above. Strong means frontline staff routinely propose and shape improvements.') + likert('Overall *', 'culture.overall', cu.overall, 'Stagnant', 'Innovative', 'Your summary judgment of the whole culture, taking the five ratings above together. Stagnant means the organization repeats what it knows. Innovative means it regularly tries, adopts, and spreads new ways of working.') + doneBtn('saveSection13()', !(cu.uncertainty && cu.aiLegitimacy && cu.overall), null, co['1.3'])) }
  if (sec === '1.4') {
    h += card('<h3 class="h-sub">1.4 AI Innovation Audit</h3><p class="t-lead">Inventory every AI initiative that existed anywhere in your enterprise on day one of this 90-day program, including unofficial ones. This is investigative work: ask around, because the initiatives leadership knows about are rarely the full list.</p><p class="t-faint-sm" style="margin-top:-2px;margin-bottom:10px">Alive means actively worked on today. Dormant means paused but not cancelled. Dead means stopped permanently, whether or not anyone formally closed it.</p>' + au.map(function (item, i) { return '<div class="u-820b58c"><input id="au_' + i + '_name" value="' + esc(item.name) + '" placeholder="Name" onchange="saveAudit()" class="u-ad9e56b"/><select id="au_' + i + '_status" onchange="saveAudit()" class="u-10e0573"><option value="">Status</option><option value="alive"' + (item.status === 'alive' ? ' selected' : '') + '>Alive</option><option value="dead"' + (item.status === 'dead' ? ' selected' : '') + '>Dead</option><option value="dormant"' + (item.status === 'dormant' ? ' selected' : '') + '>Dormant</option></select><button onclick="removeAudit(' + i + ')" class="no-btn">\xd7</button></div>' }).join('') + btn('+ Add', 'addAudit()', 'bs') + doneBtn('saveSection14()', false, null, co['1.4']))
  }
  if (sec === '1.5') {
    var qs = [{ key: 'q1', l: 'Approve experiments *', ph: 'e.g. CEO', t: 'Who can authorize a new experiment to start, including its budget.' }, { key: 'q2', l: 'Advance projects', ph: 'e.g. VP Ops', t: 'Who decides that a successful experiment moves into serious development.' }, { key: 'q3', l: 'Reallocate budget', ph: 'e.g. CFO', t: 'Who can move money between projects mid-year without a new budget round.' }, { key: 'q4', l: 'Kill projects *', ph: 'e.g. Nobody', t: 'Who can stop a project that is not working. \u201cNobody\u201d is a common and important answer.' }, { key: 'q5', l: 'Cross-functional resources', ph: 'e.g. Informal', t: 'Who can commit people from more than one function to the same initiative.' }];
    h += card('<h3 class="h-sub">1.5 Decision Rights</h3><p class="t-lead">Innovation moves at the speed of its decisions, so this section records who can actually say yes. For each decision, name the specific person or role responsible for it today. Use the gaps field where the answer is unclear, contested, or missing. If nobody can approve an experiment or nobody can kill a project, that is a finding that needs to be preserved and reported, not glossed over. Later steps in the program will fix it.</p>' + qs.map(function (q) { return '<div class="mb-4"><label class="u-f9f7426" title="' + esc(q.t || '') + '">' + q.l + '</label><input id="de_' + q.key + '_who" value="' + esc((de[q.key] || {}).who) + '" placeholder="' + q.ph + '" onchange="saveDecision(\'' + q.key + '\')" class="u-c9c7cfe' + (/\*/.test(q.l) ? ' gate-field' : '') + '"/><input id="de_' + q.key + '_gap" value="' + esc((de[q.key] || {}).gap) + '" placeholder="Gaps..." onchange="saveDecision(\'' + q.key + '\')" class="u-b00da80"/></div>' }).join('') + doneBtn('saveSection15()', !((de.q1 || {}).who && (de.q4 || {}).who), (allC ? '\u2713 Battery Complete' : '\u2713 Complete \u2192'), co['1.5']) + (allC ? card('<p class="u-c613036">\u2713 Assessment Report available under Outcomes.</p>', 'margin-top:20px;border:2px solid #1B6B5A;background:rgba(27,107,90,.06)') : ''))
  }
  if (allC) h += vizRadar();
  h += '</div>';
  return h
}

// Save helpers for step 1.1
function savePurposeFields() { ['mission', 'values', 'shortTerm', 'mediumTerm', 'longTerm', 'goals', 'frictions'].forEach(function (f) { var v = val('p_' + f); if (v !== undefined) { if (!data.purpose) data.purpose = {}; data.purpose[f] = v } }); saveData() }
/* Completion confirms (QA sweep 2 item 11, ruled July 9): steps and sub-sections confirm before
   committing - completion notifies the team (steps) and has no undo path. Phase actions confirm
   plainly. Re-clicking an already-complete button stays silent - idempotent, never re-notifies. */
/* completeBlocked() is the shell's (js/features/assignments.js) and is asked
   FIRST \u2014 before the confirm, so a member is told why rather than being asked
   to confirm something that is then refused. Every completion handler in this
   program funnels through these two functions, which is why the guard lives
   here rather than in twenty of them: the old code consulted the rule only in
   doneBtn(), so a greyed-out button was the whole of the enforcement and any
   stale render wrote the completion anyway. */
function confirmStepDone(sid) { if ((data.completedSteps || {})[sid]) return true; if (typeof completeBlocked === 'function' && completeBlocked(sid)) return false; return confirm('Mark this step complete? This will notify the team and can\u2019t be undone.') }
/* A SECTION belongs to the step it sits on \u2014 1.1's five sections are all signed
   off under step 1.1 \u2014 so the section id is reduced to its step for the check,
   which is the id assignments are made against. */
function confirmSectionDone(s) { if ((data.completedSections || {})[s]) return true; if (typeof completeBlocked === 'function' && completeBlocked(sectionStepId(s))) return false; return confirm(lastBatterySection(s) ? 'Mark this section complete? This completes Step 1.1 and notifies the team. It can\u2019t be undone.' : 'Mark this section complete? This can\u2019t be undone.') }
function lastBatterySection(s) { if (sectionStepId(s) !== '1.1' || (data.completedSteps || {})['1.1']) return false; var co = data.completedSections || {}; return ['1.1', '1.2', '1.3', '1.4', '1.5'].every(function (k) { return k === s || co[k] }) }
/* '1.4' is a section of step 1.1 in this program, not step 1.4 \u2014 the sections
   of the Assessment Battery are numbered inside it. Anything else is its own
   step id already. */
function sectionStepId(s) { var t = String(s == null ? '' : s); return /^1\.[1-5]$/.test(t) ? '1.1' : t; }
function saveSection11() { if (!confirmSectionDone('1.1')) return; savePurposeFields(); if (!data.completedSections) data.completedSections = {}; data.completedSections['1.1'] = true; batteryStepDone(); UI.sec = '1.2'; saveData(); render() }
function saveSection12() { if (!confirmSectionDone('1.2')) return; if (!data.knowledge) data.knowledge = {}; data.knowledge.usage = val('k_usage'); data.knowledge.resources = val('k_resources'); data.knowledge.learning = val('k_learning'); if (!data.completedSections) data.completedSections = {}; data.completedSections['1.2'] = true; batteryStepDone(); UI.sec = '1.3'; saveData(); render() }
function saveSection13() { if (!confirmSectionDone('1.3')) return; if (!data.completedSections) data.completedSections = {}; data.completedSections['1.3'] = true; batteryStepDone(); UI.sec = '1.4'; saveData(); render() }
function saveAudit() { var au = data.audit || []; for (var i = 0; i < au.length; i++) { au[i].name = val('au_' + i + '_name'); au[i].status = val('au_' + i + '_status') } data.audit = au; Store.commit('audit'); refreshSecDone() }
function addAudit() { if (lockBlocked('audit')) return; if (!data.audit) data.audit = []; data.audit.push({ name: '', status: '' }); Store.commit('audit'); render() }
function removeAudit(i) { if (lockBlocked('audit')) return; data.audit = (data.audit || []).filter(function (_, j) { return j !== i }); Store.commit('audit'); render() }
function saveSection14() { if (!confirmSectionDone('1.4')) return; saveAudit(); if (!data.completedSections) data.completedSections = {}; data.completedSections['1.4'] = true; batteryStepDone(); UI.sec = '1.5'; saveData(); render() }
function saveDecision(key) { if (Collab.lockedByOther('decisions::' + key)) return; if (!data.decisions) data.decisions = {}; if (!data.decisions[key]) data.decisions[key] = {}; data.decisions[key].who = val('de_' + key + '_who'); data.decisions[key].gap = val('de_' + key + '_gap'); Store.commit('decisions', key); refreshSecDone() }
function saveSection15() { if (!confirmSectionDone('1.5')) return; saveDecision('q1'); saveDecision('q2'); saveDecision('q3'); saveDecision('q4'); saveDecision('q5'); if (!data.completedSections) data.completedSections = {}; data.completedSections['1.5'] = true; batteryStepDone(); saveData(); render() }
/* Step 1.1 has no button of its own (15 Oct 2026 ruling): finishing the last of
   its five sections, in whichever order, completes it. Each section save calls
   batteryStepDone(); it needs no gate of its own because every section is
   signed off under step 1.1's assignment (sectionStepId), the same rule the
   step would have asked. stampStepDone records the date and sends the single
   team email. batteryBackfill() runs on load for organizations that finished
   the five sections under the button and never pressed it: recorded complete,
   no date and no email, because the real completion date is unknown. */
function allSections11() { var co = data.completedSections || {}; return !!(co['1.1'] && co['1.2'] && co['1.3'] && co['1.4'] && co['1.5']) }
function batteryStepDone() { if (!allSections11()) return; if (!data.completedSteps) data.completedSteps = {}; if (data.completedSteps['1.1']) return; data.completedSteps['1.1'] = true; stampStepDone('1.1'); Store.commit('completedSteps') }
function batteryBackfill() { if (!allSections11()) return; if (!data.completedSteps) data.completedSteps = {}; if (!data.completedSteps['1.1']) data.completedSteps['1.1'] = true }

// Step 1.2 Brainstorm
function renderStep12() {
  var ideas = data.ideas || [];
  var h = vp('V-1.2.1', 'Brainstorming AI Use Cases', '3\u20135 min');
  h += '<h2 class="h-section">Step 2: Brainstorm</h2><p class="t-lead">How can AI address your friction points or advance your organizational purpose? This is the widest point of the pipeline, so aim for ten to twenty ideas and do not filter for feasibility yet. Cheap, obvious, ambitious, and expensive ideas all belong on the board, and the next step does the sorting. Mark an idea Now if the technology to attempt it exists today, and Future if it depends on capabilities that are still maturing.</p>';
  h += '<div class="u-2d6fe45"><button onclick="UI.showEx.aurora=!UI.showEx.aurora;render()" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;border:1px dashed rgba(27,107,90,.5);background:' + (UI.showEx.aurora ? 'rgba(27,107,90,.06)' : 'transparent') + ';cursor:pointer;font-size:13px;font-weight:600;color:#1B6B5A;font-family:var(--sans,Helvetica Neue,sans-serif)">' + (UI.showEx.aurora ? '\u25be' : '\u25b8') + ' Example</button>' + (UI.showEx.aurora ? '<div class="u-b560a5f"><p style="font-size:13px;line-height:1.65;margin:0 0 10px"><strong>Aurora Windows</strong> is a 35-year-old, second-generation manufacturer of doors, windows, and architectural glass for commercial and residential building projects. With around 220 employees across one main plant and two regional distribution hubs, it is large enough to feel pressure from global competitors but too small to carry a dedicated transformation department. Its leadership aims to make Aurora the go-to innovation partner for sustainable, smart building projects by becoming a fully AI-driven business. Aurora appears as a worked example throughout this module \u2013 <a href="https://faisalhoque.com/how-to-build-an-ai-innovation-pipeline-that-creates-real-long-term-value/" target="_blank" rel="noopener" style="color:var(--ref-accent)">read its full background here</a>.</p>' + [{ n: 'AI-Powered Quoting Engine', d: 'Automate quoting using specs, costs, and historical data.', s: 'Friction #1 \u2014 slow quoting', c: 'Medium ($15-60K)', w: 'now' }, { n: 'Computer Vision QC', d: 'CV models for defect detection on production line.', s: 'Friction #2 \u2014 inconsistent QC', c: 'High ($60K+)', w: 'future' }, { n: 'Innovation Idea Portal', d: 'Platform for employees to submit improvement ideas.', s: 'Friction #3 \u2014 no idea capture', c: 'Low ($0-15K)', w: 'now' }].map(function (idea) { return '<details class="u-c2ef374"><summary class="u-33e06ff">' + idea.n + ' ' + badge(idea.w, idea.w === 'now' ? '#1B6B5A' : '#2D5A8E') + '</summary><div class="u-2ad7718">' + idea.d + '<br/><em>Strategic:</em> ' + idea.s + ' \xb7 <em>Cost:</em> ' + idea.c + '</div></details>' }).join('') + '</div>' : '') + '</div>';

  if (UI.sf) { h += renderIdeaForm(); return h }
  // Idea grid (blue-sky: unselected ideas only - selected ideas have advanced). Now ideas first, Future below.
  var bs = getStages().bluesky.slice().sort(function (a, b) { return ((ideas[a] || {}).when === 'future' ? 1 : 0) - ((ideas[b] || {}).when === 'future' ? 1 : 0) });
  h += '<div class="gr-auto-260">';
  bs.forEach(function (i) { var idea = ideas[i]; h += card('<div onclick="openIdeaForm(' + i + ')" class="u-b202c6d"><div class="u-e1d7e82"><h4 class="h-card">' + esc(idea.name || 'Untitled') + '</h4>' + badge(idea.when === 'now' ? 'Now' : 'Future', idea.when === 'now' ? '#1B6B5A' : '#2D5A8E') + '</div><p class="u-2da8137">' + esc((idea.desc || '').slice(0, 100)) + '</p></div>', 'padding:16px') });
  h += '</div>';
  if (!bs.length && ideas.length > 0) h += '<p class="t-faint" style="margin:0 0 12px">All ideas here have advanced. Selected ideas move forward from Filter &amp; Rank; add a new idea to keep brainstorming.</p>';
  h += btn('+ New Idea', 'openIdeaForm(null)', 'bp');
  if (bs.length > 0) h += '<span class="u-27b5cee">' + bs.length + ' ideas' + ((data.selected || []).length > 0 ? ' \u00b7 ' + (data.selected || []).length + ' advanced' : '') + '</span>';
  h += vizIdeas();
  h += doneBtn('saveDone12()', ideas.length < 3, null, (data.completedSteps || {})['1.2'], 'Add at least 3 ideas to continue.');
  return h
}

function renderIdeaForm() {
  var ideas = data.ideas || []; var isEdit = UI.ec !== null; var c = isEdit ? ideas[UI.ec] : { name: '', desc: '', strategic: '', outcome: '', capabilities: '', cost: '', risk: '', timeframe: '', dept: '', when: 'now' }; var d = UI.icDraft || {}; var _b = c; c = {};['name', 'desc', 'strategic', 'outcome', 'capabilities', 'cost', 'risk', 'timeframe', 'dept', 'when'].forEach(function (k) { c[k] = d[k] !== undefined ? d[k] : (_b ? _b[k] : '') }); var locked = isEdit && (data.selected || []).indexOf(UI.ec) >= 0;
  return card('<h3 class="h-sub">Use Case Idea Card</h3><div class="gr-2-mt">'
    + ta('Name *', 'ic_name', c.name, 'e.g. AI Quoting Engine', 1)
    + '<div class="flx-g3"><div style="flex:1">' + ta('Department', 'ic_dept', c.dept, '', 1) + '</div><div style="flex:1">' + sel('Cost', 'ic_cost', c.cost, [{ v: '', l: '...' }, { v: 'Low ($0-15K)', l: 'Low' }, { v: 'Medium ($15-60K)', l: 'Medium' }, { v: 'High ($60K+)', l: 'High' }]) + '</div></div>'
    + ta('Description', 'ic_desc', c.desc, 'What would this do?', 3)
    + '<div class="flx-g3"><div style="flex:1">' + sel('Timeframe', 'ic_timeframe', c.timeframe, [{ v: '', l: '...' }, { v: '1-3 months', l: '1-3mo' }, { v: '3-6 months', l: '3-6mo' }, { v: '6-12 months', l: '6-12mo' }, { v: '12+ months', l: '12+mo' }]) + '</div><div style="flex:1">' + (locked ? '<div class="mb-4"><label class="form-label">When</label><select id="ic_when" class="sel-helper" disabled style="opacity:.55;cursor:not-allowed"><option value="now" selected>Now</option><option value="future">Future</option></select><div style="font-size:11px;color:var(--text-faint);line-height:1.5;margin-top:4px">Locked to Now while this idea is selected. A selected idea moves forward through the pipeline; to set it aside, record a No-Go verdict at Step 2.4.</div></div>' : sel('When', 'ic_when', c.when, [{ v: 'now', l: 'Now' }, { v: 'future', l: 'Future' }])) + '</div></div>'
    + ta('Strategic need', 'ic_strategic', c.strategic, 'Which friction point?', 2)
    + ta('Capabilities required', 'ic_capabilities', c.capabilities, 'Skills/tech needed', 2)
    + ta('Outcome', 'ic_outcome', c.outcome, 'Best case if it works and worst case if it fails', 3)
    + ta('Risks', 'ic_risk', c.risk, 'What could go wrong?', 3)
    + '</div><div class="u-a03bf85">' + btn('Save', 'saveIdeaCard()', 'bp', '', false) + btn('Cancel', 'closeIdeaForm()', 'bg2') + '</div>')
}

function saveIdeaCard() {
  var c = { name: val('ic_name'), desc: val('ic_desc'), strategic: val('ic_strategic'), outcome: val('ic_outcome'), capabilities: val('ic_capabilities'), cost: val('ic_cost'), risk: val('ic_risk'), timeframe: val('ic_timeframe'), dept: val('ic_dept'), when: val('ic_when') || 'now' };
  if (UI.ec !== null && (data.selected || []).indexOf(UI.ec) >= 0) c.when = 'now';
  if (!c.name) return;
  if (!data.ideas) data.ideas = [];
  if (UI.ec !== null) { data.ideas[UI.ec] = c } else { data.ideas.push(c); var _nbi = data.ideas.length - 1; if (c.when === 'future') { UI.expanded.bsFold = true; UI.expanded['bsf' + _nbi] = true } else { UI.expanded['bs' + _nbi] = true } }
  UI.sf = false; UI.ec = null; UI.icDraft = null; UI.addForm = false; saveData(); render()
}
function openIdeaForm(ec) { UI.ec = ec; UI.sf = true; UI.icDraft = null; render() }
function closeIdeaForm() { UI.sf = false; UI.ec = null; UI.icDraft = null; UI.addForm = false; render() }
function ideaCardRO(i) {
  var c = (data.ideas || [])[i] || {}; var f = function (l, v) { return '<div><div class="u-b25d981">' + l + '</div><div class="u-2ad7718">' + (v ? esc(v) : '\u2014') + '</div></div>' };
  var any = [c.desc, c.strategic, c.outcome, c.capabilities, c.cost, c.risk, c.timeframe, c.dept].some(function (v) { return v });
  if (!any) return '<p class="t-faint-sm">No further detail recorded on this idea card.</p>';
  var inner = f('Description', c.desc) + f('Strategic need', c.strategic) + f('Outcome', c.outcome) + f('Capabilities required', c.capabilities) + f('Cost', c.cost) + f('Risks', c.risk) + f('Timeframe', c.timeframe) + f('Department', c.dept);
  return '<div class="gr-2">' + inner + '</div>'
}
function ideaCardFold(i, pk, defOpen) {
  var k = pk + i, open = PRINT_EXPAND || (UI.expanded[k] === undefined ? !!defOpen : !!UI.expanded[k]);
  return '<div style="margin:0 0 10px">' + btn((open ? '\u25be' : '\u25b8') + ' Idea card', 'UI.expanded[\'' + k + '\']=' + (!open) + ';render()', 'bg2', 'font-size:11px;padding:3px 10px') + (open ? '<div style="margin-top:8px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)">' + ideaCardRO(i) + '</div>' : '') + '</div>'
}

function ideaCardEdit(i) {
  var c = (data.ideas || [])[i] || {}; var p = 'bsic_' + i + '_';
  return '<div style="margin:0 0 10px;padding:12px 14px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)"><div class="gr-2-mt"><div>' + ta('Name', p + 'name', c.name, 'e.g. AI Quoting Engine', 1) + ta('Description', p + 'desc', c.desc, 'What would this do?', 3) + ta('Strategic need', p + 'strategic', c.strategic, 'Which friction point?', 2) + ta('Outcome', p + 'outcome', c.outcome, 'Best: ... Worst: ...', 3) + '</div><div>' + ta('Capabilities', p + 'capabilities', c.capabilities, 'Skills/tech needed', 2) + sel('Cost', p + 'cost', c.cost, [{ v: '', l: '...' }, { v: 'Low ($0-15K)', l: 'Low' }, { v: 'Medium ($15-60K)', l: 'Medium' }, { v: 'High ($60K+)', l: 'High' }]) + ta('Risks', p + 'risk', c.risk, 'What could go wrong?', 2) + sel('Timeframe', p + 'timeframe', c.timeframe, [{ v: '', l: '...' }, { v: '1-3 months', l: '1-3mo' }, { v: '3-6 months', l: '3-6mo' }, { v: '6-12 months', l: '6-12mo' }, { v: '12+ months', l: '12+mo' }]) + '<div class="flx-g3">' + ta('Dept', p + 'dept', c.dept, '', 1) + sel('When', p + 'when', c.when, [{ v: 'now', l: 'Now' }, { v: 'future', l: 'Future' }]) + '</div></div></div><p class="t-faint-sm" style="margin:0">Edits save as you type. Setting When to Future parks this idea under Ideas for the Future; setting it back to Now returns it to the ranked list.</p></div>'
}

// Step 1.3 Filter & Rank
function renderStep13() {
  var ideas = data.ideas || [], as = data.assessments || {};
  var h = vp('V-1.3.1', 'Filter & Rank Use Cases', '3\u20135 min');
  h += '<h2 class="h-section">Step 3: Filter & Rank</h2><p class="t-lead">This step turns the result of your brainstorming into a short list. First qualify each idea against five yes-or-no checks, because an idea that fails any one of them is disqualified however attractive it looks. Then score the survivors to rank them, and advance the strongest into the Exploration Portfolio. On your first pass, select up to five. Click an idea\u2019s card to select it for advancement; click again to deselect.</p>';
  if (!ideas.length) return h + card('<div class="empty-state"><p class="t-faint">Create ideas first.</p></div>');
  var bs13 = getStages().bluesky.filter(function (i) { return (ideas[i] || {}).when !== 'future' });
  if (!bs13.length) { var fut13 = getStages().bluesky.filter(function (i) { return (ideas[i] || {}).when === 'future' }); h += card('<div class="empty-state"><p class="t-faint">' + (fut13.length ? 'All remaining ideas are parked as Future \u2013 move one to Now to work on it here.' : 'Selected ideas have advanced to Step 2.4 \u2013 add new ideas to Brainstorm to keep the intake full.') + '</p></div>'); h += vizScores(); h += archivePanel(['bluesky'], '13'); h += doneBtn('saveDone13()', (data.selected || []).length < 1, null, (data.completedSteps || {})['1.3'], 'Select at least one idea to continue.'); return h }
  bs13.forEach(function (i) {
    var idea = ideas[i];
    var a = as[i] || {}; var allG = a.techCapable !== undefined && a.resourcesAvailable !== undefined && a.culturalFit !== undefined && a.purposeAligned !== undefined && a.affordable !== undefined;
    var feasible = a.techCapable && a.resourcesAvailable && a.culturalFit && a.purposeAligned && a.affordable;
    var anyNo = allG && !feasible; var score = feasible ? triageScore(i) : 0; var isSel = (data.selected || []).indexOf(i) >= 0;

    var fk = 'fr13_' + i; var fOpen = !!UI.expanded[fk];
    var bar = '<div class="flx-row-mb" style="cursor:pointer' + (fOpen ? '' : ';margin-bottom:0') + '" onclick="UI.expanded[\'' + fk + '\']=!' + fOpen + ';render()"><span style="color:var(--stone);font-size:13px">' + (fOpen ? '\u25be' : '\u25b8') + '</span><div><h4 class="h-card" style="font-size:16px">' + esc(idea.name) + '</h4></div>' + (idea.when === 'future' ? badge('Future Project', '#2D5A8E') : '') + (anyNo ? badge('Disqualified', '#9B2D3F') : '') + '<span id="scoreOut_' + i + '" data-sflav="13">' + (feasible ? badge(score + '/50', '#1B6B5A') : '') + '</span>' + archBtn(i) + '</div>';
    var body13 = '';
    if (fOpen) {
      body13 = '<div style="margin-bottom:8px">' + ideaCardFold(i, 'ic13', true) + '</div>' +
        '<p class="fs-13" style="color:var(--paper);margin:0 0 6px">Is this idea compatible with your organization\u2019s current state across the following five dimensions? Click a dimension once for yes and twice for no. A single no disqualifies the idea until the relevant circumstances change.</p>' +
        '<div class="pill-row">' + [{ k: 'techCapable', l: 'Tech?', t: 'Could this be built with technology that exists, that works, and that is available to you today?' }, { k: 'resourcesAvailable', l: 'Resources?', t: 'Do you have, or could you realistically get, the people and data it needs?' }, { k: 'culturalFit', l: 'Culture?', t: 'Would the people affected actually use it?' }, { k: 'purposeAligned', l: 'Purpose?', t: 'Does it serve the purpose and goals you wrote down in the Assessment?' }, { k: 'affordable', l: 'Affordable?', t: 'Could you fund it at the cost level on its card without heroics?' }].map(function (g) { var v = a[g.k]; return '<button title="' + esc(g.t) + '" onclick="toggleGate(' + i + ',\'' + g.k + '\')" class="gate-btn' + (v === true ? ' pass' : v === false ? ' fail' : '') + '">' + (v === true ? '\u2713' : v === false ? '\u2717' : '\u25cb') + ' ' + g.l + '</button>' }).join('') + '</div>' +
        (feasible ? '<p class="fs-13" style="color:var(--paper);margin:14px 0 6px">Score each dimension from 0 to 10. 10 is always the most favorable end of the scale. The five dimensions sum to a score out of 50.</p><div class="u-46b97fa">' + [{ k: 'priority', l: 'Priority', t: 'How urgent this is for the organization right now. 10 means top priority.' }, { k: 'risk', l: 'Risk(10=low)', t: 'How likely it is to go wrong, in technology, adoption, or delivery. 10 means low risk.' }, { k: 'value', l: 'Value', t: 'How much benefit it delivers if it works. 10 means high value.' }, { k: 'costScore', l: 'Cost(10=low)', t: 'What it would cost against the level on its card. 10 means cheap.' }, { k: 'difficulty', l: 'Ease(10=easy)', t: 'How hard it would be to deliver with the organization you have. 10 means easy.' }].map(function (d) { return '<div><label class="t-faint-sm" title="' + esc(d.t) + '">' + d.l + '</label><input type="number" min="0" max="10" id="score_' + i + '_' + d.k + '" value="' + (a[d.k] != null ? a[d.k] : '') + '" onchange="saveScore(' + i + ',\'' + d.k + '\')" class="score-mini"/></div>' }).join('') + '</div>' : '') +
        (feasible ? (idea.when === 'future' ? '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button disabled style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:not-allowed;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02);color:rgba(var(--faint-rgb),.5)">Advance to Exploration Portfolio</button><span style="font-size:11px;color:var(--text-faint);line-height:1.5;flex:1;min-width:220px">This project cannot be selected because it has been assigned \u201CFuture Project\u201D status. If you wish to select it, go back to 1.2 and change the project\u2019s When setting to \u201CNow\u201D.</span></div>' : '<button onclick="askAdvanceIdea(' + i + ')" style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:' + (isSel ? '1px solid #1B6B5A' : '1px solid rgba(var(--fg-rgb),.12)') + ';background:' + (isSel ? '#1B6B5A' : 'rgba(var(--fg-rgb),.03)') + ';color:' + (isSel ? '#fff' : 'var(--text-faint)') + '">' + (isSel ? '\u2713 Selected' : 'Advance to Exploration Portfolio') + '</button>') : '');
    }
    h += card(bar + body13,
      (isSel ? 'border:2px solid #1B6B5A;background:rgba(27,107,90,.04)' : anyNo ? 'border:1px solid #e8c4c4;background:rgba(155,45,63,.06)' : ''))
  });

  h += vizScores();
  h += archivePanel(['bluesky'], '13');
  h += doneBtn('saveDone13()', (data.selected || []).length < 1, null, (data.completedSteps || {})['1.3'], 'Select at least one idea to continue.');
  return h
}

function toggleGate(i, key) { if (lockBlocked('assessments::' + i)) return; if (!data.assessments) data.assessments = {}; if (!data.assessments[i]) data.assessments[i] = {}; var cur = data.assessments[i][key]; data.assessments[i][key] = cur === true ? false : cur === false ? undefined : true; Store.commit('assessments', i); render() }
function saveScore(i, key) { if (Collab.lockedByOther('assessments::' + i)) return; if (!data.assessments) data.assessments = {}; if (!data.assessments[i]) data.assessments[i] = {}; data.assessments[i][key] = Math.max(0, Math.min(10, parseInt(val('score_' + i + '_' + key)) || 0)); Store.commit('assessments', i); render() }
function refreshScoreOut(i) {
  var el = document.getElementById('scoreOut_' + i); if (!el) return; var a = (data.assessments || {})[i] || {}; var allG = a.techCapable !== undefined && a.resourcesAvailable !== undefined && a.culturalFit !== undefined && a.purposeAligned !== undefined && a.affordable !== undefined; var feasible = a.techCapable && a.resourcesAvailable && a.culturalFit && a.purposeAligned && a.affordable; var disq = allG && !feasible; var sc = feasible ? triageScore(i) : null;
  if (el.getAttribute('data-sflav') === 'bs') el.innerHTML = sc !== null ? '<span style="font-weight:700;font-size:14px;color:#1B6B5A">' + sc + '<span style="font-size:11px;color:var(--text-faint)">/50</span></span>' : disq ? '' : '<span class="t-faint-sm">unscored</span>';
  else el.innerHTML = feasible ? badge(sc + '/50', '#1B6B5A') : ''
}
function freshProjectSlate(i) {
  // Selecting from blue sky starts this index fresh: clear orphaned downstream records
  // (stranded by the old deselect path or a previous life of the index).
  var capTouched = false;
  ['projects', 'portfolio', 'capAlloc', 'experiments', 'tracking', 'opsData'].forEach(function (c) { if (data[c] && data[c][i] !== undefined) { delete data[c][i]; Store.commit(c, i); if (c === 'capAlloc') capTouched = true } });
  if (data.review && data.review.items && data.review.items[i] !== undefined) { delete data.review.items[i]; Store.commit('review') }
  ['expSelected', 'launched'].forEach(function (k) { var a = data[k] || []; var x = a.indexOf(i); if (x >= 0) { a.splice(x, 1); Store.commit(k); capTouched = true } });
  if (data.archivedItems && data.archivedItems[i]) { delete data.archivedItems[i]; Store.commit('archivedItems', i) }
  if (capTouched) { data.capStale = true; Store.commit('capStale') }
}
function askAdvanceIdea(i) { if (((data.ideas || [])[i] || {}).when === 'future') return; UI.advIdea = i; currentModal = 'advance'; renderAdvanceModal() }
function confirmAdvanceIdea(yes) { var i = UI.advIdea; UI.advIdea = null; closeModal(); if (yes && i != null) toggleSelect(i) }
function renderAdvanceModal() {
  var mr = $('modalRoot'); if (!mr) return; if (currentModal !== 'advance') { mr.innerHTML = ''; return }
  mr.innerHTML = '<div class="modal-bg" onclick="if(event.target===this)confirmAdvanceIdea(false)"><div class="modal" style="max-width:480px"><h3 style="font-size:22px">Advance to Exploration Portfolio</h3><p class="t-stone-md" style="margin:10px 0 24px">Advancing this idea to the Exploration Portfolio means it will no longer be visible on this page. Do you want to continue?</p><div style="display:flex;gap:10px;justify-content:flex-end">' + btn('No', 'confirmAdvanceIdea(false)', 'bg2') + btn('Yes', 'confirmAdvanceIdea(true)', 'bp') + '</div></div></div>'
}
function toggleSelect(i) { if (((data.ideas || [])[i] || {}).when === 'future') return; if (!data.selected) data.selected = []; if (data.selected.indexOf(i) < 0) { freshProjectSlate(i); data.selected.push(i); Store.commit('selected') } render() }
function saveDone12() { if (!confirmStepDone('1.2')) return; if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['1.2'] = true; stampStepDone('1.2'); Store.commit('completedSteps'); render() }
function saveDone13() { if (!confirmStepDone('1.3')) return; if (!data.completedSteps) data.completedSteps = {}; data.completedSteps['1.3'] = true; stampStepDone('1.3'); Store.commit('completedSteps'); render() }
