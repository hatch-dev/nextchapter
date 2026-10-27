/* ─────────────────────────────────────────────────────────────
   sidebar.js — Left pipeline sidebar (phases · steps · outputs)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   renderSidebar() is called from render(); shown on Pipeline/Navigate
   pages. Relies on app.js globals: currentPage, currentStep, sidebarOpen,
   sidebarMinimized, PH, data, go, esc, and related UI state.
   ───────────────────────────────────────────────────────────── */

/* ── Which pages keep the left rail ────────────────────────────
   The Leaders programs (The Decision Lab, The Ethics Engine) route to pages of
   their own — Assess, Practice, Dashboard — and none of them is here, so this
   menu is hidden for the whole of those programs and renderSidebar() returns
   before building anything. They navigate by the drawers on their own board
   instead; their reference builds retired the left rail outright.

   The last five belong to Responsible AI Governance and are the standing pages
   of its own spine (Paul's ruling, step 56 of the 14 Sep 2026 reporting
   directive): a reader on a portfolio, a single system, the Responsible AI
   overview, the governance review or the Report Manager is still inside the
   90 days and still needs the way back. `mgmt-hub` is deliberately NOT here —
   Track Program is a whole-program board, not a page within the spine — and
   `cap-hub` is the Pipeline's equivalent.

   One list, read from both places below: it was written out twice, and an id
   added to one copy and not the other shows the rail and then drops it on the
   next render. */
var SIDEBAR_PAGES = ['step', 'phase', 'phase5', 'outcome', 'pipeline', 'cap-hub',
  'portfolio', 'system', 'ethicsov', 'govreview', 'reports', 'review'];
/* 'review' is the Pipeline's Quarterly Review page (17 Sep 2026); 'portfolio' is
   already here for Governance and now carries the Pipeline's live portfolio pages
   too - the id is the same and both want the rail. */

function sidebarShowsHere() {
  /* A program may answer for its own pages (21 Oct 2026, AI-Ready Architecture: its standards pages, the map
     porthole, the reviews and Track Program keep the rail in its build, Insights and the jurisdiction map do
     not). A hook rather than more ids in the list above, which is every program's: 'mgmt-hub' there would put
     the rail on the other programs' Track Program too. Anything but a boolean falls through to the list. */
  try {
    var own = window.Modules && Modules.hook && Modules.hook('sidebarShowsOn');
    if (own) { var r = own(currentPage); if (typeof r === 'boolean') return r; }
  } catch (e) { }
  return SIDEBAR_PAGES.indexOf(currentPage) >= 0;
}

// === SIDEBAR ===
function renderSidebar() {
  var sb = document.getElementById('pipSidebar');
  if (!sb) return;
  var showSidebar = sidebarShowsHere();
  sb.style.display = showSidebar ? 'flex' : 'none';
  // Apply min/max class
  sb.className = 'sidebar' + (sidebarOpen ? '' : ' collapsed') + (sidebarMinimized ? ' mini' : '');
  var app = document.getElementById('app');
  if (app) {
    app.classList.remove('sidebar-collapsed', 'sidebar-mini');
    if (!showSidebar || !sidebarOpen) { app.classList.add('sidebar-collapsed'); }
    else if (sidebarMinimized) { app.classList.add('sidebar-mini'); }
  }
  var ftr = document.getElementById('appFooter');
  if (ftr) {
    ftr.classList.remove('sidebar-collapsed', 'sidebar-mini');
    if (!showSidebar || !sidebarOpen) { ftr.classList.add('sidebar-collapsed'); }
    else if (sidebarMinimized) { ftr.classList.add('sidebar-mini'); }
  }
  var btn = document.getElementById('sidebarToggle');
  if (btn) {
    btn.style.display = showSidebar ? 'block' : 'none';
    // Keep the toggle pinned in the nav's top-left corner in every state.
    // It sits in the fixed nav band (top:16px) alongside the logo; pushing it
    // rightward (e.g. 270px) dropped the icon onto the "PIPELINE" logo text.
    btn.style.left = '16px';
  }
  if (!showSidebar) return;

  // Build header with min/max toggle button
  var togContent = sidebarMinimized ? '»' : '«&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  // The wordmark names whichever program is running (js/modules/registry.js).
  var _lg = (window.Modules ? Modules.active().logo : null) || { side: 'AI', sideAccent: 'Pipeline', mini: 'AI' };
  var _lgTitle = (window.Modules ? Modules.active().name : 'AI Pipeline');
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="' + esc(_lgTitle) + '">' + esc(_lg.mini || 'AI') + '</div>'
      : '<div class="sidebar-logo">' + esc(_lg.side || '') + ' <span>' + esc(_lg.sideAccent || '') + '</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Build minimized body: phase circles only
  if (sidebarMinimized) {
    var h = '<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage === 'pipeline' ? ' active' : '') + '" onclick="go(\'pipeline\')" title="Overview">'
      + '<span class="sidebar-mini-icon">▦</span></div>';
    for (var i = 0; i < PH.length; i++) {
      var ph = PH[i];
      var isPhaseActive = (currentPage === 'phase' && currentStep === String(ph.id));
      var hasActiveStep = (currentPage === 'step' && currentStep && String(currentStep).charAt(0) === String(ph.id));
      var hasActiveOutcome = currentPage === 'outcome';
      h += '<div class="sidebar-mini-row' + (isPhaseActive || hasActiveStep ? ' active' : '') + '" '
        + 'onclick="go(\'phase\',\'' + ph.id + '\')" '
        + 'title="Phase ' + ph.id + ': ' + ph.name + ' (' + ph.days + ')">'
        + '<span class="sidebar-mini-dot" style="background:' + ph.color + '">' + ph.id + '</span>'
        + '</div>';
    }
    h += '</div>';
    // Sticky footer: explicit Maximize button — impossible to miss
    h += '<button class="sidebar-mini-max" onclick="maximizeSidebar()" title="Maximize sidebar" aria-label="Maximize sidebar">»</button>';
    h += '</div>';
    sb.innerHTML = h;
    updateSidebarState();
    return;
  }

  // Maximized (full) view
  // Multi-open sections: any number of phases can show their steps + outputs
  // at once. Selecting a phase (or any step within it) opens that phase and
  // does not collapse the others.
  // - On navigation (page/step change) the open phase follows the selection.
  // - The chevron opens/collapses a phase in place without navigating; that
  //   choice holds until the next navigation.
  var actId = activeNavPhaseId();
  var pageKey = currentPage + ':' + currentStep;
  if (!UI.navOpenSet) { UI.navOpenSet = {}; if (actId != null) UI.navOpenSet[String(actId)] = true; }
  if (UI._navPageKey !== pageKey) { UI._navPageKey = pageKey; if (actId != null) UI.navOpenSet[String(actId)] = true; }
  var h = '<div class="sidebar-inner">';
  h += headerHtml;
  h += '<div class="sidebar-scroll">';
  h += '<div class="sidebar-home' + (currentPage === 'pipeline' ? ' active' : '') + '" onclick="go(\'pipeline\')">Overview</div>';
  for (var i = 0; i < PH.length; i++) {
    var ph = PH[i];
    var isPhaseActive = (currentPage === 'phase' && currentStep === String(ph.id));
    var navOpenThis = !!(UI.navOpenSet && UI.navOpenSet[String(ph.id)]);
    h += '<div class="sidebar-phase-group">';
    h += '<div class="sidebar-phase-head" onclick="goPhase(' + ph.id + ')">';
    h += '<div class="sidebar-phase-dot" style="background:' + ph.color + '"></div>';
    h += '<span class="sidebar-phase-name" style="color:' + (isPhaseActive ? 'var(--paper)' : 'color-mix(in srgb, ' + ph.color + ' 58%, var(--paper))') + '">' + ph.id + '. ' + ph.name + '</span>';
    h += '<span class="sidebar-phase-days">' + ph.days + '</span>';
    h += '<span class="sidebar-phase-tog" onclick="event.stopPropagation();toggleNavPhase(' + ph.id + ')" title="' + (navOpenThis ? 'Collapse' : 'Expand') + '" style="cursor:pointer;color:color-mix(in srgb, ' + ph.color + ' 58%, var(--paper));font-family:var(--mono);font-size:13px;opacity:.9;padding:2px 6px;margin-left:2px;user-select:none">' + (navOpenThis ? '\u25BE' : '\u25B8') + '</span>';
    h += '</div>';
    if (navOpenThis) {
      // The phase's own steps, then any strands the module pulls out of that
      // list (see Modules.stepStrands) — each under its own label, rendered
      // exactly like a step so the two read as one menu.
      var strands = Modules.stepStrands(ph);
      // A strand may set one `icon` for all its rows — it reads as one kind of
      // work, so it gets one mark rather than each step's own.
      var stepRow = function (s, icon) {
        var isActive = (currentPage === 'step' && currentStep === s.id) || (s.id === '5.1' && currentPage === 'phase5');
        var isDone = isStepDone(s.id);
        var cls = 'sidebar-step' + (isActive ? ' active' : isDone ? ' done' : '');
        return '<div class="' + cls + '" onclick="go(\'step\',\'' + s.id + '\')">' + (isDone && !isActive ? '' : (icon || s.icon) + ' ') + s.id + ' ' + s.name + '</div>';
      };
      for (var j = 0; j < strands.main.length; j++) h += stepRow(strands.main[j]);
      for (var g = 0; g < strands.strands.length; g++) {
        var grp = strands.strands[g];
        if (!grp || !grp.steps || !grp.steps.length) continue;
        h += '<div class="sidebar-outcomes-label">' + esc(grp.label || '') + '</div>';
        for (var gi = 0; gi < grp.steps.length; gi++) h += stepRow(grp.steps[gi], grp.icon);
      }
      /* The outputs sit behind one fold rather than as a flat list (Paul's
         ruling, 12 Sep 2026; family): a phase can carry four of them, and
         under a phase's steps that is enough to push the next phase off the
         screen. The fold opens on click and opens itself while one of its
         own outputs is the page being viewed — see navOutputsOpen. */
      if (ph.outcomes && ph.outcomes.length > 0) {
        var outOpen = navOutputsOpen(ph);
        h += '<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs(' + ph.id + ')" style="cursor:pointer;user-select:none" title="' + (outOpen ? 'Hide the outputs' : 'Show the outputs') + '">' + (outOpen ? '▾' : '▸') + ' Outputs <span style="opacity:.7">(' + ph.outcomes.length + ')</span></div>';
        if (outOpen) {
          for (var k = 0; k < ph.outcomes.length; k++) {
            var o = ph.outcomes[k];
            var isOActive = (currentPage === 'outcome' && currentStep === o.id) || currentPage === o.id;
            h += '<div class="sidebar-outcome' + (isOActive ? ' active' : '') + '" onclick="' + (o.id.indexOf('out-') === 0 ? 'go(\'outcome\',\'' + o.id + '\')' : 'go(\'' + o.id + '\')') + '">→ ' + o.name + '</div>';
          }
        }
      }
    }
    h += '</div>';
  }
  // duplicate Pipeline Dashboard removed

  h += '</div>';
  h += '</div>';
  sb.innerHTML = h;
  updateSidebarState();
}

// Which phase contains the current page/selection (or null on Overview etc.)

// Which phase contains the current page/selection (or null on Overview etc.)
function activeNavPhaseId(){
  /* A program's own pages may belong to a phase (21 Oct 2026: Architecture's Manage page is phase 5). */
  try { var _h = window.Modules && Modules.hook && Modules.hook('navPhaseOf'); var _r = _h ? _h(currentPage) : null; if (_r) return _r; } catch (e) { }
  if(currentPage==='phase5'||currentPage==='portfolio'||currentPage==='review')return 5; /* 17 Sep 2026 (Paul's ruling): the live portfolio and review pages are Navigate's, not the earlier phases' outputs */
  if(currentPhase)return currentPhase.id;
  if(currentPage==='phase'&&currentStep)return parseInt(currentStep,10);
  // outcome-style pages routed via go('<id>') (e.g. cap-hub) set currentPage to the id
  for(var i=0;i<PH.length;i++){
    var os=PH[i].outcomes||[];
    for(var k=0;k<os.length;k++){ if(os[k].id===currentPage||os[k].id===currentStep) return PH[i].id; }
  }
  return null;
}

/* ── The Outputs fold ──────────────────────────────────────────
   One line per phase standing in for its outputs, opened by click. Kept
   beside toggleNavPhase because it is the same kind of thing one level down:
   state in UI, a re-render, and the scroll position preserved so the row the
   user clicked does not jump out from under the pointer. */
function toggleNavOutputs(phId) {
  if (!UI.navOutOpen) UI.navOutOpen = {};
  UI.navOutOpen[phId] = !UI.navOutOpen[phId];
  var ss = document.querySelector('.sidebar-scroll'); var top = ss ? ss.scrollTop : 0;
  renderSidebar();
  var ss2 = document.querySelector('.sidebar-scroll'); if (ss2) ss2.scrollTop = top;
}

/* Open when the user opened it, and open anyway while one of this phase's
   own outputs is the page on screen — otherwise navigating to an output
   would hide the row that says where you are. */
function navOutputsOpen(ph) {
  if (!UI.navOutOpen) UI.navOutOpen = {};
  if (UI.navOutOpen[ph.id]) return true;
  return (ph.outcomes || []).some(function (o) {
    return (currentPage === 'outcome' && currentStep === o.id) || currentPage === o.id;
  });
}

// Chevron handler: open this phase (collapsing the others) or, if it's the
// open one, collapse everything. Holds until the next navigation.
function toggleNavPhase(id) {
  var k = String(id); if (!UI.navOpenSet) UI.navOpenSet = {};
  UI.navOpenSet[k] = !UI.navOpenSet[k];
  var ss = document.querySelector('.sidebar-scroll'); var top = ss ? ss.scrollTop : 0;
  renderSidebar();
  var ss2 = document.querySelector('.sidebar-scroll'); if (ss2) ss2.scrollTop = top;
}

// Phase-row handler (the whole "DIAGNOSE / ORGANIZE / …" bar). Acts as a toggle:
//   collapsed → open it and navigate to the phase
//   open      → collapse it in place (stay where you are, don't navigate away)
// The chevron still opens/collapses without navigating in either direction.
function goPhase(id) {
  var k = String(id); if (!UI.navOpenSet) UI.navOpenSet = {};
  if (UI.navOpenSet[k]) {
    delete UI.navOpenSet[k];   // already open → clasp shut in place
    var ss = document.querySelector('.sidebar-scroll'); var top = ss ? ss.scrollTop : 0;
    renderSidebar();
    var ss2 = document.querySelector('.sidebar-scroll'); if (ss2) ss2.scrollTop = top;
  } else {
    UI.navOpenSet[k] = true;  // collapsed → open this phase (others stay open) and navigate to it
    /* A program may send a phase heading somewhere other than its landing (21 Oct 2026: AI-Ready Architecture's
       "5. Manage" opens its Manage page, as in its build). The hook returns go()'s arguments, or nothing. */
    var to = null;
    try { var h = window.Modules && Modules.hook && Modules.hook('phaseHeadTarget'); if (h) to = h(id); } catch (e) { to = null; }
    if (to && to.length) go.apply(null, to); else go('phase', String(id));
  }
}

function updateSidebarState() {
  var sb = document.getElementById('pipSidebar');
  var app = document.getElementById('app');
  var showSidebar = sidebarShowsHere();
  if (sb) {
    sb.className = 'sidebar' + (sidebarOpen ? '' : ' collapsed') + (sidebarMinimized ? ' mini' : '');
    sb.style.display = showSidebar ? 'flex' : 'none';
  }
  if (app) {
    app.classList.remove('sidebar-collapsed', 'sidebar-mini');
    if (!showSidebar || !sidebarOpen) { app.classList.add('sidebar-collapsed'); }
    else if (sidebarMinimized) { app.classList.add('sidebar-mini'); }
  }
  var ftr = document.getElementById('appFooter');
  if (ftr) {
    ftr.classList.remove('sidebar-collapsed', 'sidebar-mini');
    if (!showSidebar || !sidebarOpen) { ftr.classList.add('sidebar-collapsed'); }
    else if (sidebarMinimized) { ftr.classList.add('sidebar-mini'); }
  }
  var btn = document.getElementById('sidebarToggle');
  if (btn) {
    btn.style.display = showSidebar ? 'block' : 'none';
    // Pinned to the nav's top-left corner; see note in renderSidebar().
    btn.style.left = '16px';
  }
}

/* The hamburger switches between the two visible states. It never sets
   sidebarOpen = false: a sidebar the person cannot see is a sidebar they
   cannot bring back, since this button is the only control that hides it and
   .sidebar-toggle is display:none !important. Only the screens that own no
   sidebar at all (launchpad, the entry gate) still collapse it outright. */
function toggleSidebar() { toggleSidebarSize(); }
