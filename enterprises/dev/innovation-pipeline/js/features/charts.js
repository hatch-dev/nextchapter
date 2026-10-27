/* ─────────────────────────────────────────────────────────────
   charts.js — Analytics visualizations (SVG charts, no libraries)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   Stage-distribution donut, capital-allocation bars, status breakdown,
   owner load, and the composed analytics block used by the Navigate
   dashboard, Module Management hub, and outcome reports.
   Relies on app.js globals: data, PH, esc, fmt* helpers, palette/UI state.
   ───────────────────────────────────────────────────────────── */

// === VISUALIZATION FUNCTIONS ===

function vizTimeline(currentPhase) {
  var ranges = [{ id: 1, start: 0, end: 30, name: 'Diagnose', color: '#1B6B5A' }, { id: 2, start: 31, end: 50, name: 'Organize', color: '#2D5A8E' }, { id: 3, start: 51, end: 70, name: 'Prepare', color: '#8B5E3C' }, { id: 4, start: 71, end: 90, name: 'Ignite', color: '#9B2D3F' }];
  var sd = new Date(data.startDate || new Date().toISOString().split('T')[0]); var today = new Date();
  var daysSince = Math.max(0, Math.floor((today - sd) / (1000 * 60 * 60 * 24))); var progress = Math.min(100, Math.max(0, (daysSince / 90) * 100));
  var phProg = function (pid) { var p = PH.find(function (x) { return x.id === pid }); if (!p) return 0; var d = p.steps.filter(function (s) { return isStepDone(s.id) }).length; return p.steps.length ? Math.round(d / p.steps.length * 100) : 0 };
  var h = '<div class="mb-6"><div class="u-fc4d7a9">';
  h += '<div class="flx-row-mb-14"><div class="t-fade-sm" style="flex:1">Start Date: ' + fmtDate(sd) + '</div><div class="u-64f53f5" style="flex:1;text-align:center;color:var(--paper)">90-Day Timeline</div><div class="t-fade-sm" style="flex:1;text-align:right">Day ' + Math.min(90, daysSince) + ' of 90</div></div>';
  h += '<div class="flx mb-3">'; ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var w = ((p.end - s0) / 90) * 100; h += '<div onclick="go(\'phase-' + p.id + '\')" class="pipe-tick" style="--w:' + w + '%"><div style="font-size:11px;font-weight:700;color:' + (currentPhase === p.id ? p.color : 'var(--text-faint)') + '">' + p.name + '</div><div class="u-56f72fc">Days ' + (p.start === 0 ? 1 : p.start) + '\u2013' + p.end + '</div></div>' });
  h += '</div><div class="u-c2a178b">';
  ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var left = (s0 / 90) * 100; var w = ((p.end - s0) / 90) * 100; var pp = phProg(p.id); h += '<div class="ph-bar-pos" data-pos="' + p.id + '" style="--left:' + left + '%;--w:' + w + '%"><div class="ph-fill" data-pos="' + p.id + '" data-full="' + (pp === 100 ? 1 : 0) + '" style="--w:' + pp + '%;--c:' + p.color + '"></div></div>' });
  h += '<div title="Today \u2013 day ' + Math.min(90, daysSince) + ' of 90 on the program clock" style="position:absolute;top:-3px;left:' + progress + '%;width:3px;height:16px;background:#333;border-radius:2px;z-index:3;transition:left .3s;cursor:help"></div></div>';
  h += '<div class="flx">'; ranges.forEach(function (p) { var s0 = (p.start === 0 ? 0 : p.start - 1); var w = ((p.end - s0) / 90) * 100; var pp = phProg(p.id); h += '<div onclick="go(\'phase-' + p.id + '\')" class="pipe-tick" style="--w:' + w + '%"><div style="font-size:10px;color:' + (pp === 100 ? '#1B6B5A' : 'rgba(var(--faint-rgb),.7)') + ';font-weight:' + (pp === 100 ? 700 : 400) + '">' + pp + '%</div></div>' });
  h += '</div></div></div>'; return h
}

function vizRadar() {
  var cu = data.culture || {}, k = data.knowledge || {}, de = data.decisions || {};
  var cuVals = [cu.uncertainty, cu.aiLegitimacy, cu.newProposals, cu.incentives, cu.frontline, cu.overall].filter(function (v) { return typeof v === 'number' });
  var kVals = ['usage', 'awareness', 'resources', 'learning'].map(function (f) { var v = k[f]; if (typeof v === 'number') return v; var r = KNOWLEDGE_SCALE[f] && KNOWLEDGE_SCALE[f][v]; return r || 0 }).filter(function (v) { return v > 0 });
  var qs = ['q1', 'q2', 'q3', 'q4', 'q5']; var agility = 0; qs.forEach(function (q) { var d = de[q] || {}; if (d.who && String(d.who).trim()) agility += (String(d.gap || '').trim() ? 0.5 : 1) });
  var axes = [{ label: 'Innovation Culture', value: cuVals.length ? (cuVals.reduce(function (a, b) { return a + b }, 0) / cuVals.length) : 0 }, { label: 'AI Readiness', value: kVals.length ? (kVals.reduce(function (a, b) { return a + b }, 0) / kVals.length) : 0 }, { label: 'Decision Agility', value: agility }];
  if (axes.every(function (a) { return a.value === 0 })) return '';
  var cx = 150, cy = 130, R = 90, n = 3, maxV = [5, 5, 5], PI = Math.PI;
  var axTip = { 'Innovation Culture': 'The average of your Risk & Culture ratings.', 'AI Readiness': 'The average of your AI Knowledge Base ratings.', 'Decision Agility': 'One point for each decision with a named holder and no recorded gaps, and half a point where the holder is named but gaps are recorded.' };
  var pts = axes.map(function (a, i) { var angle = (PI * 2 * i / n) - PI / 2; var r = R * (a.value / maxV[i]); return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), lx: cx + (R + 22) * Math.cos(angle), ly: cy + (R + 22) * Math.sin(angle), v: a.value, m: maxV[i], l: a.label } });
  var svg = '<svg viewBox="0 0 300 260" class="u-a12ed3b">';
  [1, 2, 3, 4, 5].forEach(function (lv) { var gp = axes.map(function (_, i) { var angle = (PI * 2 * i / n) - PI / 2; var r = R * (lv / 5); return (cx + r * Math.cos(angle)) + ',' + (cy + r * Math.sin(angle)) }).join(' '); svg += '<polygon points="' + gp + '" fill="none" stroke="rgba(245,242,236,.08)" stroke-width="1"/>' });
  axes.forEach(function (_, i) { var angle = (PI * 2 * i / n) - PI / 2; svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(angle)) + '" y2="' + (cy + R * Math.sin(angle)) + '" stroke="rgba(245,242,236,.08)" stroke-width="1"/>' });
  svg += '<polygon points="' + pts.map(function (p) { return p.x + ',' + p.y }).join(' ') + '" fill="#1B6B5A30" stroke="#1B6B5A" stroke-width="2"/>';
  pts.forEach(function (p) { svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#1B6B5A"/>' });
  pts.forEach(function (p) { svg += '<text x="' + p.lx + '" y="' + p.ly + '" text-anchor="middle" font-size="10" font-weight="600" fill="#8A8278" font-family="Helvetica Neue,Arial,sans-serif">' + p.l + '<title>' + esc(axTip[p.l] || '') + '</title></text><text x="' + p.lx + '" y="' + (p.ly + 12) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#1B6B5A" font-family="Helvetica Neue,Arial,sans-serif">' + (typeof p.v === 'number' ? p.v.toFixed(1) : p.v) + '/' + p.m + '</text>' });
  svg += '</svg>'; return card('<h3 class="h-sub">Assessment Profile</h3><p class="t-faint-sm" style="margin:-2px 0 8px">Three summary readings from your answers \u2013 hover an axis label for how each is calculated.</p>' + svg, 'margin-top:20px;padding:20px')
}

// ═══════════════════════════════════════════════════════════════
// VISUAL UPGRADES — adapted from AI-Ready Architecture app
// ═══════════════════════════════════════════════════════════════

/* Big hero stat strip — five live counts in NextChapter style.
   Big serif numeral over small mono uppercase label. */
function vizStatStrip() {
  var ideas = (data.ideas || []).length;
  var stages = getStages();
  var totalPortfolio = (stages.bluesky || []).length + (stages.explore || []).length + (stages.experiment || []).length + (stages.operational || []).length;
  var stepsDone = 0, stepsTotal = 0;
  for (var i = 0; i < PH.length; i++) { var p = PH[i]; if (p.id === 5) continue; for (var j = 0; j < p.steps.length; j++) { stepsTotal++; if (isStepDone(p.steps[j].id)) stepsDone++ } }
  var sd = new Date(data.startDate || new Date().toISOString().split('T')[0]);
  var today = new Date();
  var daysElapsed = Math.max(0, Math.min(90, Math.floor((today - sd) / (1000 * 60 * 60 * 24))));

  var stats = [
    { n: daysElapsed, sub: 'of 90', l: 'Days Elapsed' },
    { n: ideas, l: 'Ideas Captured' },
    { n: totalPortfolio, l: 'Portfolio Items' },
    { n: stepsDone + '/' + stepsTotal, l: 'Steps Complete' }
  ];
  var h = '<div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);text-align:center;margin-bottom:10px">Module start date \u2014 ' + fmt(data.startDate || today) + '</div><div class="viz-stat-strip">';
  stats.forEach(function (s) {
    h += '<div class="viz-stat-cell">'
      + '<div class="viz-stat-num">' + s.n + (s.sub ? '<span class="viz-stat-sub">' + s.sub + '</span>' : '') + '</div>'
      + '<div class="viz-stat-lbl">' + s.l + '</div>'
      + '</div>';
  });
  return h + '</div>';
}

/* Large 5-axis radar chart for the Assessment Report.
   Scores: array of {name, score (0-5)}.
   Adapted from Architecture's renderRadar(). */
function vizRadarLarge(scores) {
  if (!scores || !scores.length) return '';
  var cx = 250, cy = 185, r = 130, n = scores.length;
  var h = '<div class="viz-radar"><svg viewBox="0 0 500 380" class="viz-radar-svg">';
  // Concentric ring grid (5 rings)
  for (var ring = 1; ring <= 5; ring++) {
    var pts = '';
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n - Math.PI / 2;
      var rr = r * ring / 5;
      pts += (cx + rr * Math.cos(a)) + ',' + (cy + rr * Math.sin(a)) + ' ';
    }
    h += '<polygon points="' + pts.trim() + '" fill="none" stroke="rgba(184,137,42,' + (ring === 5 ? '.32' : '.12') + ')" stroke-width="1"/>';
  }
  // Axis lines + labels
  for (var i = 0; i < n; i++) {
    var a = Math.PI * 2 * i / n - Math.PI / 2;
    var ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
    h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ex + '" y2="' + ey + '" stroke="rgba(184,137,42,.15)" stroke-width="1"/>';
    var lx = cx + (r + 24) * Math.cos(a), ly = cy + (r + 24) * Math.sin(a);
    var anchor = lx < cx - 8 ? 'end' : lx > cx + 8 ? 'start' : 'middle';
    var lbl = scores[i].name.length > 16 ? scores[i].name.substring(0, 15) + '…' : scores[i].name;
    h += '<text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#B8B0A5" font-size="11" font-weight="600" font-family="var(--mono)" letter-spacing="0.04em">' + lbl + '</text>';
    h += '<text x="' + lx + '" y="' + (ly + 14) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#4FB39A" font-size="12" font-weight="700" font-family="var(--mono)">' + (typeof scores[i].score === 'number' ? scores[i].score.toFixed(1) : scores[i].score) + '/5</text>';
  }
  // Data polygon
  var pts = '';
  for (var i = 0; i < n; i++) {
    var a = Math.PI * 2 * i / n - Math.PI / 2;
    var v = Math.max(0, Math.min(5, scores[i].score || 0));
    pts += (cx + (r * v / 5) * Math.cos(a)) + ',' + (cy + (r * v / 5) * Math.sin(a)) + ' ';
  }
  h += '<polygon points="' + pts.trim() + '" fill="rgba(27,107,90,.20)" stroke="#1B6B5A" stroke-width="2.5"/>';
  // Score dots
  for (var i = 0; i < n; i++) {
    var a = Math.PI * 2 * i / n - Math.PI / 2;
    var v = Math.max(0, Math.min(5, scores[i].score || 0));
    var px = cx + (r * v / 5) * Math.cos(a), py = cy + (r * v / 5) * Math.sin(a);
    h += '<circle cx="' + px + '" cy="' + py + '" r="5" fill="#1B6B5A" stroke="var(--ink)" stroke-width="2"/>';
  }
  h += '</svg></div>';
  return h;
}

/* SVG semi-circle gauge for overall pipeline health.
   Score is 0-5; segments fill in color bands. */
function vizHealthGauge(m) {
  var score = m.score;
  var cols = ['#9B2D3F', '#8B5E3C', '#D4A017', '#2D5A8E', '#1B6B5A'];
  var col = score >= 4 ? '#1B6B5A' : score >= 2.5 ? '#8B5E3C' : '#9B2D3F';
  var h = '<div class="viz-gauge-wrap"><svg viewBox="0 0 200 130" class="viz-gauge-svg">';
  for (var seg = 0; seg < 5; seg++) {
    var a1 = Math.PI + seg * Math.PI / 5;
    var a2 = Math.PI + (seg + 1) * Math.PI / 5;
    var x1 = 100 + 80 * Math.cos(a1), y1 = 110 + 80 * Math.sin(a1);
    var x2 = 100 + 80 * Math.cos(a2), y2 = 110 + 80 * Math.sin(a2);
    var active = score > seg;
    h += '<path d="M' + x1 + ',' + y1 + ' A80,80 0 0,1 ' + x2 + ',' + y2 + '" fill="none" stroke="' + (active ? cols[seg] : 'rgba(184,137,42,.15)') + '" stroke-width="14" stroke-linecap="butt"/>';
  }
  // Needle
  var na = Math.PI + score * Math.PI / 5;
  var nx = 100 + 62 * Math.cos(na), ny = 110 + 62 * Math.sin(na);
  h += '<line x1="100" y1="110" x2="' + nx + '" y2="' + ny + '" stroke="var(--paper)" stroke-width="2.5" stroke-linecap="round"/>';
  h += '<circle cx="100" cy="110" r="5" fill="var(--paper)"/>';
  h += '</svg>';
  h += '<div class="viz-gauge-score" style="color:' + col + '">' + score.toFixed(1) + '<span class="viz-gauge-denom">/5</span></div>';
  h += '<div class="viz-gauge-label">Pipeline Maturity</div>';
  h += '<button class="btn-ghost pad-chip-sm" style="margin-top:6px" onclick="UI.expanded.matInfo=!UI.expanded.matInfo;render()">' + (UI.expanded.matInfo ? '\u25be' : '\u25b8') + ' How is this scored?</button>';
  if (UI.expanded.matInfo) { h += '<div class="t-faint-sm" style="margin-top:8px;max-width:230px;text-align:left"><p style="margin:0 0 6px">Half the score is build-step completion (' + Math.round(m.completion * 100) + '%). Half is pipeline population against these targets:</p>' + m.pop.map(function (p) { var hit = p.c >= p.t; return '<div style="display:flex;justify-content:space-between;gap:8px"><span>' + p.n + '</span><strong style="color:' + (hit ? '#1B6B5A' : 'var(--text-faint)') + '">' + p.c + ' / ' + p.t + '</strong></div>' }).join('') + '<p style="margin:6px 0 0">Blue Sky counts Now ideas plus at most five Ideas for the Future.</p></div>' }
  h += '</div>';
  return h;
}

/* Horizontal dimension bars — one per phase, showing completion %. */
function vizDimBars() {
  var h = '<div class="viz-dim-bars">';
  PH.forEach(function (p) {
    if (p.id === 5) return;
    var done = p.steps.filter(function (s) { return isStepDone(s.id) }).length;
    var total = p.steps.length;
    var pct = total ? Math.round(done / total * 100) : 0;
    h += '<div class="viz-dim-row">'
      + '<div class="viz-dim-name">' + p.name + '</div>'
      + '<div class="viz-dim-track"><div class="viz-dim-fill" style="width:' + pct + '%;background:' + p.color + '"></div></div>'
      + '<div class="viz-dim-val" style="color:' + p.color + '">' + pct + '%</div>'
      + '</div>';
  });
  return h + '</div>';
}

/* Compute the 5-axis Assessment scores from the Phase 1 data. */

/* Compute the 5-axis Assessment scores from the Phase 1 data. */
function getAssessmentScores(){
  var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},au=data.audit||[],de=data.decisions||{};
  // Purpose Clarity: % of the collected purpose fields filled
  var pFilled=['mission','values','goals','frictions','shortTerm','mediumTerm','longTerm'].filter(function(f){return p[f]&&String(p[f]).trim()}).length;
  var purposeScore=pFilled/7*5;
  // AI Knowledge: the average of the four answers. Awareness is a 1\u20135 rating; usage, resources, and learning are words, each on a four-rung scale (17 Sep 2026, Paul's ruling): None 1, the second rung 2.3, the third 3.7, the fourth 5
  var kVals=['usage','awareness','resources','learning'].map(function(f){var v=k[f];if(typeof v==='number')return v;var r=KNOWLEDGE_SCALE[f]&&KNOWLEDGE_SCALE[f][v];return r||0}).filter(function(v){return v>0});
  var knowledgeScore=kVals.length?(kVals.reduce(function(a,b){return a+b},0)/kVals.length):0;
  // Culture: average of 6 Likerts
  var cuKeys=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'];
  var cuVals=cuKeys.map(function(f){return typeof cu[f]==='number'?cu[f]:0}).filter(function(v){return v>0});
  var cultureScore=cuVals.length?(cuVals.reduce(function(a,b){return a+b},0)/cuVals.length):0;
  // Innovation Audit: scale by # entries (0-3 OK, 4+ = 5/5)
  var auditScore=Math.min(5,(au.length||0)*1.25);
  // Decisions: # of 5 decision rights answered
  var qs=['q1','q2','q3','q4','q5'];
  var answered=qs.filter(function(q){return de[q]&&de[q].who}).length;
  var decisionScore=answered;
  return [
    {name:'Purpose',score:purposeScore},
    {name:'Knowledge',score:knowledgeScore},
    {name:'Culture',score:cultureScore},
    {name:'Audit',score:auditScore},
    {name:'Decisions',score:decisionScore}
  ];
}
var KNOWLEDGE_SCALE={usage:{none:1,basic:2.3,moderate:3.7,advanced:5},resources:{none:1,limited:2.3,moderate:3.7,strong:5},learning:{none:1,informal:2.3,some:3.7,systematic:5}}; /* 17 Sep 2026 (Paul's ruling): the knowledge step's word answers on the 1\u20135 scale, four rungs each, so the Knowledge dimension averages all four questions */

/* Compute overall pipeline maturity (0-5) from assessments + completion. */
function getPipelineMaturity() {
  var totalSteps = 0, doneSteps = 0;
  for (var i = 0; i < PH.length; i++) { if (PH[i].id === 5) continue; for (var j = 0; j < PH[i].steps.length; j++) { totalSteps++; if (isStepDone(PH[i].steps[j].id)) doneSteps++ } }
  var completion = totalSteps ? (doneSteps / totalSteps) : 0;
  var st = getStages(); var trk = data.tracking || {};
  var opActive = (st.operational || []).filter(function (i) { return (trk[i] || {}).status !== 'killed' });
  var bsN = bsNowList(st).length, bsF = st.bluesky.length - bsN;
  var pop = [
    { n: 'Blue Sky ideas', c: bsN + Math.min(bsF, 5), t: 10 },
    { n: 'Exploration projects', c: st.explore.length, t: 5 },
    { n: 'Active experiments', c: st.experiment.length, t: 3 },
    { n: 'Operational projects', c: opActive.length, t: 3 }
  ];
  var popScore = pop.reduce(function (a, p) { return a + Math.min(p.c / p.t, 1) }, 0) / pop.length;
  // Half build-step completion, half pipeline population against stage targets. Linear pro-rata below target.
  // Blue Sky population = Now ideas + Future ideas capped at 5 (Paul's ruling, July 2).
  return { score: (completion * 0.5 + popScore * 0.5) * 5, completion: completion, pop: pop };
}

// ═══════════════════════════════════════════════════════════════
// PORTFOLIO ANALYTICS CHARTS
// All inline SVG. No external libs. Each handles its own empty state.
// ═══════════════════════════════════════════════════════════════

/* Helper: compute portfolio data once for all the charts */
function getPortfolioData() {
  var stages = getStages();
  var ideas = data.ideas || [];
  var assessments = data.assessments || {};
  var projects = data.projects || {};
  var portfolio = data.portfolio || {};
  var tracking = data.tracking || {};

  // Build a normalized project list — one entry per idea that's in any stage
  var items = [];
  var stageList = [
    { key: 'bluesky', label: 'Blue Sky', color: 'var(--ph1-t)', ph: '#1B6B5A' },
    { key: 'explore', label: 'Exploration', color: 'var(--ph2-t)', ph: '#2D5A8E' },
    { key: 'experiment', label: 'Development', color: 'var(--ph3-t)', ph: '#8B5E3C' },
    { key: 'operational', label: 'Operational', color: 'var(--ph4-t)', ph: '#9B2D3F' }
  ];

  stageList.forEach(function (s) {
    var arr = stages[s.key] || [];
    arr.forEach(function (i) {
      var idea = ideas[i] || {};

      var pf = portfolio[i] || {};

      var trk = tracking[i] || {};
      var rb = resolveBands(i, s.key === 'bluesky' ? 'bluesky' : 'pd');
      items.push({
        idx: i,
        name: idea.name || ('Item ' + (i + 1)),
        stage: s.key,
        stageLabel: s.label,
        stageColor: s.color,    // text-safe color
        phaseColor: s.ph,       // base phase color
        score: getScore(i),
        horizon: rb.h || '',
        confirmed: rb.conf,
        priority: (rb.h === 'quick' ? 'high' : 'medium'),
        status: trk.status || '—'
      });
    });
  });

  return { items: items, stages: stageList };
}

/* ─── Chart 1: Stage Distribution donut ──────────────────── */
function vizStageDonut() {
  var pd = getPortfolioData();
  var counts = pd.stages.map(function (s) {
    return { label: s.label, n: (s.key === 'bluesky' ? bsNowList(getStages()) : (getStages()[s.key] || [])).length, c: s.color, ph: s.ph };
  });
  var total = counts.reduce(function (a, b) { return a + b.n }, 0);

  var h = '<div class="chart-card"><div class="chart-title">Stage Distribution</div>';
  if (total === 0) {
    h += '<div class="chart-empty">No portfolio items yet.</div></div>';
    return h;
  }

  h += '<div class="chart-donut-wrap">';
  var cx = 110, cy = 110, rOuter = 85, rInner = 58;
  h += '<svg viewBox="0 0 220 220" class="chart-donut-svg">';
  var startAngle = -Math.PI / 2;
  counts.forEach(function (seg) {
    if (seg.n === 0) return;
    var pct = seg.n / total;
    var endAngle = startAngle + pct * Math.PI * 2;
    if (pct >= 0.9999) {
      h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((rOuter + rInner) / 2) + '" fill="none" stroke="' + seg.ph + '" stroke-width="' + (rOuter - rInner) + '"/>';
      h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rOuter + '" fill="none" stroke="var(--ink)" stroke-width="2"/>';
      h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rInner + '" fill="none" stroke="var(--ink)" stroke-width="2"/>';
      startAngle = endAngle;
      return;
    }
    var x1 = cx + rOuter * Math.cos(startAngle), y1 = cy + rOuter * Math.sin(startAngle);
    var x2 = cx + rOuter * Math.cos(endAngle), y2 = cy + rOuter * Math.sin(endAngle);
    var x3 = cx + rInner * Math.cos(endAngle), y3 = cy + rInner * Math.sin(endAngle);
    var x4 = cx + rInner * Math.cos(startAngle), y4 = cy + rInner * Math.sin(startAngle);
    var large = pct > 0.5 ? 1 : 0;
    var d = 'M' + x1 + ',' + y1 + ' A' + rOuter + ',' + rOuter + ' 0 ' + large + ' 1 ' + x2 + ',' + y2
      + ' L' + x3 + ',' + y3 + ' A' + rInner + ',' + rInner + ' 0 ' + large + ' 0 ' + x4 + ',' + y4 + ' Z';
    h += '<path d="' + d + '" fill="' + seg.ph + '" stroke="var(--ink)" stroke-width="2"/>';
    startAngle = endAngle;
  });
  // Center label
  h += '<text x="110" y="98" text-anchor="middle" dominant-baseline="middle" font-family="var(--serif)" font-size="44" fill="var(--paper)" font-weight="300">' + total + '</text>';
  h += '<text x="110" y="134" text-anchor="middle" dominant-baseline="middle" font-family="var(--mono)" font-size="10" fill="var(--stone)" letter-spacing="0.2em">PROJECTS</text>';
  h += '</svg>';

  // Legend
  h += '<div class="chart-legend">';
  counts.forEach(function (seg) {
    var pct = total ? Math.round(seg.n / total * 100) : 0;
    h += '<div class="chart-legend-row">'
      + '<span class="chart-legend-dot" style="background:' + seg.ph + '"></span>'
      + '<span class="chart-legend-name">' + seg.label + '</span>'
      + '<span class="chart-legend-val" style="color:' + seg.c + '">' + seg.n + '</span>'
      + '<span class="chart-legend-pct">' + pct + '%</span>'
      + '</div>';
  });
  h += '</div></div></div>';
  return h;
}

/* ─── Chart 2: Capital Allocation stacked bar ─────────────── */
function vizCapitalSplit() {
  var cap = data.capital || {}; var port = data.portfolio || {}; var com = capCommitments();
  var qAmt = 0, hAmt = 0, qN = 0, hN = 0;
  com.rows.forEach(function (r) { var hz = (port[r.i] || {}).horizon; if (!hz) return; if (hz === 'quick') { qAmt += r.amt; qN++ } else { hAmt += r.amt; hN++ } });
  var quick = 0, horizon = 0;
  if (qAmt + hAmt > 0) { quick = Math.round(qAmt / (qAmt + hAmt) * 100); horizon = 100 - quick }
  else if (qN + hN > 0) { quick = Math.round(qN / (qN + hN) * 100); horizon = 100 - quick }
  else { var pd = getPortfolioData(); var q2 = 0, h2 = 0; pd.items.forEach(function (it) { if (it.horizon === 'quick') q2++; else if (it.horizon) h2++ }); var t = q2 + h2; if (t) { quick = Math.round(q2 / t * 100); horizon = 100 - quick } }
  var h = '<div class="chart-card"><div class="chart-title">Committed Capital</div>';
  if (quick === 0 && horizon === 0) {
    h += '<div class="chart-empty">Nothing committed yet.</div></div>';
    return h;
  }
  h += '<div class="cap-split-labels">';
  h += '<div class="cap-split-side"><div class="cap-split-pct" style="color:var(--ph1-t)">' + quick + '%</div><div class="cap-split-name">Quick Wins</div></div>';
  h += '<div class="cap-split-side cap-split-right"><div class="cap-split-pct" style="color:var(--ph3-t)">' + horizon + '%</div><div class="cap-split-name">Horizon Bets</div></div>';
  h += '</div>';
  h += '<div class="cap-split-bar">';
  h += '<div class="cap-split-fill" style="width:' + quick + '%;background:#1B6B5A"></div>';
  h += '<div class="cap-split-fill" style="width:' + horizon + '%;background:#8B5E3C"></div>';
  h += '</div>';
  if (com.total) { h += '<div class="cap-split-foot">Committed: <strong>' + fmtMoney(com.total) + '</strong>' + (cap.aiBudget ? ' of <strong>' + esc(cap.aiBudget) + '</strong> budget' : '') + '</div>'; }
  h += '</div>';
  return h;
}
function vizPortfolioMap() {
  var pd = getPortfolioData();
  var _all = pd.items.filter(function (it) { return it.stage !== 'bluesky' && it.score > 0 });
  var items = _all.filter(function (it) { return it.horizon });
  var _skipped = _all.length - items.length;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Portfolio Map <span class="chart-subtitle">Impact × Horizon, sized by priority</span></div>';
  if (items.length === 0) {
    h += '<div class="chart-empty">Score and assign horizons to populate the map.</div></div>';
    return h;
  }

  // Layout
  var W = 720, H = 320;
  var padL = 70, padR = 24, padT = 24, padB = 50;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  // X buckets: quick (1) / horizon (2) — could expand later
  var xBuckets = [
    { key: 'quick', label: 'Quick Win', x: padL + plotW * 0.25 },
    { key: 'horizon', label: 'Horizon Bet', x: padL + plotW * 0.75 }
  ];

  // Y axis: 0 to max score (typically 50)
  var maxScore = 50;
  function yFor(score) {
    return padT + plotH - (score / maxScore) * plotH;
  }

  // Bubble radius by priority
  function rFor(p) {
    return p === 'high' ? 22 : p === 'medium' ? 16 : 12;
  }

  h += '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-bubble-svg">';

  // Grid lines (horizontal at score 10/25/40)
  [10, 25, 40].forEach(function (s) {
    var y = yFor(s);
    h += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="rgba(245,242,236,.06)" stroke-width="1" stroke-dasharray="2,3"/>';
    h += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-family="var(--mono)" font-size="10" fill="var(--stone)">' + s + '</text>';
  });

  // Axes
  h += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '" stroke="rgba(245,242,236,.15)" stroke-width="1"/>';
  h += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="rgba(245,242,236,.15)" stroke-width="1"/>';

  // X-axis labels
  xBuckets.forEach(function (b) {
    h += '<text x="' + b.x + '" y="' + (H - padB + 22) + '" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--paper)" letter-spacing="0.1em">' + b.label.toUpperCase() + '</text>';
  });

  // Y-axis label
  h += '<text x="20" y="' + (padT + plotH / 2) + '" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--stone)" letter-spacing="0.15em" transform="rotate(-90 20 ' + (padT + plotH / 2) + ')">IMPACT SCORE</text>';

  // Group items by bucket so we can dodge overlaps
  var bucketed = {};
  items.forEach(function (it) {
    var b = it.horizon === 'quick' ? 'quick' : 'horizon';
    if (!bucketed[b]) bucketed[b] = [];
    bucketed[b].push(it);
  });

  // Sort each bucket by score so overlapping bubbles tile naturally
  Object.keys(bucketed).forEach(function (k) {
    bucketed[k].sort(function (a, b) { return b.score - a.score });
  });

  // Plot bubbles, dodging horizontally within each bucket
  xBuckets.forEach(function (b) {
    var arr = bucketed[b.key] || [];
    arr.forEach(function (it, idx) {
      var y = yFor(it.score);
      var r = rFor(it.priority);
      // dodge horizontally based on index parity
      var dodge = (idx % 2 === 0 ? 1 : -1) * Math.floor(idx / 2) * (r * 1.6);
      var x = b.x + dodge;
      var initials = it.name.split(/\s+/).map(function (w) { return w[0] || '' }).slice(0, 2).join('').toUpperCase();
      h += '<g class="bubble-g" style="cursor:pointer" onclick="go(\'out-' + (it.stage === 'bluesky' ? 'bluesky' : it.stage === 'explore' ? 'explore' : it.stage === 'experiment' ? 'expbriefs' : 'oper') + '\')">';
      h += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + it.phaseColor + '" fill-opacity="0.75" stroke="' + it.stageColor + '" stroke-width="2"/>';
      h += '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-family="var(--mono)" font-size="' + (r >= 18 ? 11 : 9) + '" font-weight="700" fill="#fff">' + esc(initials) + '</text>';
      h += '<title>' + esc(it.name) + ' · ' + it.stageLabel + ' · score ' + it.score + ' · ' + it.priority + ' priority</title>';
      h += '</g>';
    });
  });

  h += '</svg>';
  if (_skipped) h += '<div class="t-faint-sm" style="margin-top:4px">' + _skipped + ' project' + (_skipped > 1 ? 's' : '') + ' not yet placeable \u2013 add a timeframe, triage scores, or grades.</div>';

  // Legend underneath
  h += '<div class="bubble-legend">';
  h += '<div class="bubble-legend-group"><span class="bubble-legend-lbl">Priority</span>'
    + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:22px;height:22px"></span>High</span>'
    + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:16px;height:16px"></span>Medium</span>'
    + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:12px;height:12px"></span>Low</span>'
    + '</div>';
  h += '<div class="bubble-legend-group"><span class="bubble-legend-lbl">Stage</span>';
  var _plotted = {}; items.forEach(function (it) { _plotted[it.stage] = 1 });
  pd.stages.forEach(function (s) {
    if (!_plotted[s.key]) return;
    h += '<span class="bubble-legend-item"><span class="bubble-legend-dot" style="background:' + s.ph + '"></span>' + s.label + '</span>';
  });
  h += '</div>';
  h += '</div></div>';
  return h;
}

/* ─── Chart 4: Status Breakdown (stacked horizontal bars) ── */
function vizStatusBars() {
  var pd = getPortfolioData();

  var statusList = [
    { key: 'running', label: 'Running', c: '#2D5A8E' },
    { key: 'paused', label: 'Paused', c: '#D4A017' },
    { key: 'complete', label: 'Complete', c: '#1B6B5A' },
    { key: 'killed', label: 'Killed', c: '#9B2D3F' },
    { key: '—', label: 'No Status', c: 'rgba(var(--fg-rgb),.10)' }
  ];

  // Build counts per stage per status
  var stageData = pd.stages.map(function (s) {
    var arr = pd.items.filter(function (it) { return it.stage === s.key });
    var statuses = {};
    statusList.forEach(function (st) { statuses[st.key] = 0 });
    arr.forEach(function (it) {
      var k = it.status;
      if (!statuses.hasOwnProperty(k)) k = '—';
      statuses[k]++;
    });
    return { label: s.label, color: s.ph, total: arr.length, statuses: statuses };
  });

  var maxTotal = Math.max.apply(null, stageData.map(function (s) { return s.total })) || 1;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Status Breakdown <span class="chart-subtitle">By stage and execution status</span></div>';
  if (maxTotal === 0) {
    h += '<div class="chart-empty">No portfolio items yet.</div></div>';
    return h;
  }

  h += '<div class="status-rows">';
  stageData.forEach(function (s) {
    h += '<div class="status-row">';
    h += '<div class="status-row-label" style="color:' + s.color + '">' + s.label + '</div>';
    h += '<div class="status-row-bar">';
    statusList.forEach(function (st) {
      var n = s.statuses[st.key];
      if (n === 0) return;
      var pct = (n / maxTotal) * 100;
      h += '<div class="status-seg" style="width:' + pct + '%;background:' + st.c + '" title="' + st.label + ': ' + n + '">'
        + (pct > 10 ? '<span class="status-seg-n">' + n + '</span>' : '')
        + '</div>';
    });
    h += '</div>';
    h += '<div class="status-row-total">' + s.total + '</div>';
    h += '</div>';
  });
  h += '</div>';

  // Status legend
  h += '<div class="status-legend">';
  statusList.forEach(function (st) {
    if (st.key === '—') return;
    h += '<span class="status-legend-item"><span class="status-legend-dot" style="background:' + st.c + '"></span>' + st.label + '</span>';
  });
  h += '</div></div>';
  return h;
}

/* ─── Chart 5: Owner Load (bar chart per user) ────────────── */
function vizOwnerLoad() {
  var assigns = data.assigns || {};
  var counts = {};
  USERS.forEach(function (u) { counts[u.id] = 0 });
  Object.keys(assigns).forEach(function (stepId) {
    (assigns[stepId] || []).forEach(function (uid) {
      if (counts.hasOwnProperty(uid)) counts[uid]++;
    });
  });

  var rows = USERS.map(function (u) { return { u: u, n: counts[u.id] } });
  var max = Math.max.apply(null, rows.map(function (r) { return r.n })) || 1;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Team Load <span class="chart-subtitle">Step assignments per member</span></div>';
  if (rows.every(function (r) { return r.n === 0 })) {
    h += '<div class="chart-empty">No assignments yet. Open any step to assign team members.</div></div>';
    return h;
  }

  h += '<div class="owner-rows">';
  rows.forEach(function (r) {
    var pct = (r.n / max) * 100;
    h += '<div class="owner-row">';
    h += '<div class="owner-row-av">' + userAv(r.u, 26) + '</div>';
    h += '<div class="owner-row-name">' + esc(r.u.name) + '</div>';
    h += '<div class="owner-row-bar"><div class="owner-row-fill" style="width:' + pct + '%;background:' + r.u.color + '"></div></div>';
    h += '<div class="owner-row-n">' + r.n + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  return h;
}

/* ─── Compose the whole analytics block ────────────────────── */
function renderPortfolioAnalytics() {
  var h = '<div class="analytics-block">';
  h += '<div class="analytics-header">';
  h += '<div class="analytics-eyebrow">Phase 5 · Analytics</div>';
  h += '<h2 class="analytics-title">Portfolio <em>at a Glance</em></h2>';
  h += '</div>';
  h += '<div class="analytics-grid-2">';
  h += vizStageDonut();
  h += '<div onclick="go(\'cap-hub\')" style="cursor:pointer" title="Open Capital Planning Hub">' + vizCapitalSplit() + '</div>';
  h += '</div>';
  h += vizPortfolioMap();
  h += vizStatusBars();
  h += '<div onclick="go(\'mgmt-hub\')" style="cursor:pointer" title="Open Module Management">' + vizOwnerLoad() + '</div>';
  h += '</div>';
  return h;
}

function vizIdeas() {
  var ideas = data.ideas || []; if (!ideas.length) return '';
  var _bs = getStages().bluesky; if (!_bs.length) return '';
  var _pool = _bs.map(function (i) { var idea = ideas[i] || {}; return { name: idea.name, when: idea.when, dept: idea.dept, idx: i } });
  var now = _pool.filter(function (x) { return x.when === 'now' });
  var future = _pool.filter(function (x) { return x.when !== 'now' });
  var depts = {}; _pool.forEach(function (x) { var d = x.dept || 'Unassigned'; depts[d] = (depts[d] || 0) + 1 });
  var h = '<h3 class="h-sub">Ideas Landscape</h3><p class="t-faint-sm" style="margin:-2px 0 10px">Click an idea to open its card. \u201cNow\u201d ideas can be filtered and ranked at the next step. \u201cFuture\u201d ideas wait here until their status is changed to \u201cNow\u201d.</p><div class="u-37fa46c"><div class="t-center"><div class="u-a5b7f18">Now (' + now.length + ')</div><div class="u-c4c0acf">';
  now.forEach(function (idea) { var nm = (idea.name || '').length > 16 ? (idea.name || '').substring(0, 14) + '\u2026' : idea.name; h += '<div onclick="openIdeaForm(' + idea.idx + ')" class="u-fb07e78"><div class="u-5f887bd">◇</div><div class="u-536b48f">' + esc(nm) + '</div></div>' });
  h += '</div></div>';
  if (future.length > 0) { h += '<div class="t-center"><div class="u-2bb3590">Future (' + future.length + ')</div><div class="u-c4c0acf">'; future.forEach(function (idea) { var nm = (idea.name || '').length > 16 ? (idea.name || '').substring(0, 14) + '\u2026' : idea.name; h += '<div onclick="openIdeaForm(' + idea.idx + ')" class="u-32112ed"><div class="u-5f887bd">◆</div><div class="u-536b48f">' + esc(nm) + '</div></div>' }); h += '</div></div>' }
  h += '</div><div class="u-0b70227">';
  Object.keys(depts).forEach(function (d) { h += '<span><strong>' + esc(d) + ':</strong> ' + depts[d] + '</span>' });
  h += '</div>'; return card(h, 'margin-top:20px')
}

function bsLegend(note) {
  var chip = function (l, c) { return '<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:' + c + ';display:inline-block"></span>' + l + '</span>' };
  return '<div style="display:flex;flex-wrap:wrap;align-items:center;margin:4px 0 10px"><span style="font-size:11px;color:var(--text-faint);letter-spacing:.06em;margin-right:10px">KEY</span>' + chip('Now', '#1B6B5A') + chip('Future', '#2D5A8E') + chip('Disqualified', '#9B2D3F') + (note ? '<span style="font-size:11px;color:var(--text-faint);margin-left:auto">' + note + '</span>' : '') + '</div>'
}
function vizScores() {
  var ideas = data.ideas || [], as = data.assessments || {}; if (!ideas.length) return '';
  var scored = getStages().bluesky.filter(function (i) { return (ideas[i] || {}).when !== 'future' }).map(function (i) { var idea = ideas[i] || {}; var a = as[i] || {}; var feasible = a.techCapable && a.resourcesAvailable && a.culturalFit && a.purposeAligned && a.affordable; var score = feasible ? triageScore(i) : null; var disq = [a.techCapable, a.resourcesAvailable, a.culturalFit, a.purposeAligned, a.affordable].some(function (v) { return v === false }); return { name: idea.name || 'Idea ' + (i + 1), score: score, disq: disq, when: idea.when } }).filter(function (s) { return s.score !== null || s.disq }).sort(function (a, b) { return (b.score || 0) - (a.score || 0) });
  if (!scored.length) return '';
  var maxS = 50, W = 460, barH = 20, pad = 120, H = Math.max(160, scored.length * 28 + 60);
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="u-ce6fc96">';
  scored.forEach(function (s, i) {
    var y = 30 + i * (barH + 8); var w = s.score !== null ? (s.score / maxS) * (W - pad - 20) : 0; var c = s.disq ? '#9B2D3F' : (s.when === 'future' ? '#2D5A8E' : '#1B6B5A'); var nm = s.name.length > 14 ? s.name.substring(0, 12) + '\u2026' : s.name;
    svg += '<text x="' + (pad - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="10" fill="#8A8278" font-family="Helvetica Neue,Arial,sans-serif">' + esc(nm) + '</text>';
    if (s.disq) { svg += '<rect x="' + pad + '" y="' + y + '" width="' + (W - pad - 20) + '" height="' + barH + '" fill="rgba(155,45,63,.06)" rx="3"/><text x="' + (pad + 8) + '" y="' + (y + barH / 2 + 4) + '" font-size="10" fill="#9B2D3F" font-family="Helvetica Neue,Arial,sans-serif" font-weight="600">Disqualified</text>' }
    else { svg += '<rect x="' + pad + '" y="' + y + '" width="' + (W - pad - 20) + '" height="' + barH + '" fill="rgba(245,242,236,.06)" rx="3"/><rect x="' + pad + '" y="' + y + '" width="' + w + '" height="' + barH + '" fill="' + c + '40" stroke="' + c + '" stroke-width="1" rx="3"/><text x="' + (pad + w + 6) + '" y="' + (y + barH / 2 + 4) + '" font-size="11" fill="' + c + '" font-family="Helvetica Neue,Arial,sans-serif" font-weight="700">' + s.score + '/50</text>' }
  });
  svg += '</svg>'; return card('<h3 class="h-sub">Score Distribution</h3>' + '<div style="display:flex;flex-wrap:wrap;align-items:center;margin:4px 0 10px"><span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:#1B6B5A;display:inline-block"></span>Qualified</span><span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:#9B2D3F;display:inline-block"></span>Disqualified</span><span style="font-size:11px;color:var(--text-faint);margin-left:auto">Bar length = score out of 50</span></div>' + svg, 'margin-top:20px')
}

function vizProjectReady() {
  var sel = data.selected || [], proj = data.projects || {}; if (!sel.length) return '';
  var goC = sel.filter(function (i) { return (proj[i] || {}).viable === true }).length;
  var noC = sel.filter(function (i) { return (proj[i] || {}).viable === false }).length;
  var penC = sel.filter(function (i) { return (proj[i] || {}).viable === undefined }).length;
  var t = sel.length;
  return card('<h3 class="h-sub-lg">Project Assessment Summary</h3><div class="u-5f04749"><div class="u-c91903e"><div class="score-num-go">' + goC + '</div><div class="u-5b23054">Go</div></div><div class="u-74df1b3"><div class="u-f02b9ef">' + noC + '</div><div class="u-3249b02">No Go</div></div><div class="u-664254f"><div class="u-1a106b8">' + penC + '</div><div class="u-4735f5f">Pending</div></div></div><div class="u-08c36f4">' + (goC ? '<div style="width:' + ((goC / t) * 100) + '%;background:#1B6B5A;height:100%"></div>' : '') + (noC ? '<div style="width:' + ((noC / t) * 100) + '%;background:#9B2D3F;height:100%"></div>' : '') + (penC ? '<div style="width:' + ((penC / t) * 100) + '%;background:rgba(var(--fg-rgb),.12);height:100%"></div>' : '') + '</div>', 'margin-top:20px')
}
