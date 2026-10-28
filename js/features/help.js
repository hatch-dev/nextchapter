/* ─────────────────────────────────────────────────────────────
   help.js — the "? Help" overlay
   ─────────────────────────────────────────────────────────────
   The overlay is shell chrome: one button, one modal, one set of
   styles, in every program module. What it SAYS is the module's —
   each program has its own phases, its own mechanics, its own
   vocabulary — so this file renders a help document rather than
   holding one.

   A module supplies its document in js/modules/<id>/help.js via
   Modules.defineHelp(). Sections are declarative, so a module
   author writes content, never markup:

     { title, body }                 a paragraph (HTML allowed)
     { title, rows: [{k, v}] }       a key/value grid
     { title, phases: [...] }        the numbered phase list
     { title, funnel: [{n, c, d}] }  a coloured stage strip
     { title, tools: [{ic, d}] }     the tool list
     { shared: '<id>' [, extra] }    a block owned by the shell

   SHARED blocks are the parts that describe features every module
   has — signing in, organizations and the team, Track Program, the
   toolbar, data and privacy. They are written once, here, so a
   change to a shared feature is a change in one place and no
   module's help can quietly go stale. A module places them in its
   own order, and may append module-specific entries to the tool
   list with `extra`.

   Relies on app.js globals: currentModal, closeModal, $, esc.
   ───────────────────────────────────────────────────────────── */

function openHelp() { currentModal = 'help'; renderModal(); }

/* ── Blocks the shell owns (shared by every module) ─────────── */
var HELP_SHARED = {
  signin: {
    title: 'Signing In &amp; Organizations',
    rows: [
      { k: 'Sign in', v: 'Enter your username and password to go straight into your organization’s workspace. Tick “Remember me” to stay signed in on this device for up to 30 days. After five wrong attempts, sign-in pauses for 15 minutes.' },
      { k: 'New organization', v: 'Use “Set up a new organization” on the login screen to create a workspace and your own account, then add the rest of your team.' },
      { k: 'Multiple organizations', v: 'Each organization is a fully isolated workspace with its own profile, team, and program data. Nothing is shared between them.' },
      { k: 'Profiles &amp; passwords', v: 'Every member has a username and a password. Administrators add people under Profile with a temporary password, which the person replaces with their own the first time they sign in. Change your own password from the account menu. These identities sign work, drive step assignments, and appear in Team Chat.' },
      { k: 'Admin', v: 'Choose “Admin” on the login screen and enter the administrator username and password. Admins land in the app with an admin bar across the top. The Admin panel, opened from that bar or from the More menu, lists every organization and user and lets you add, edit, or remove them. “Change password” and “Change username” live on the administrator console on the sign-in side.' }
    ]
  },
  modules: {
    title: 'Switching Modules',
    body: 'The <strong class="t-paper">Module</strong> control at the top right lists every program available to you and marks the one you are in. Choosing another opens it with the same sign-in, the same organization, and the same team — only the program content changes. Each program keeps its own workspace, so progress in one never overwrites the other, and you can move between them as often as you like.'
  },
  track: {
    title: 'Track Program',
    body: 'The ▦ Track Program item under the … More menu opens Module Management. It puts every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.',
    rows: [
      { k: 'Assignments', v: 'Every step, grouped by phase, with a status badge, an optional deadline, and an assignment button. “This Week” lists the steps that are overdue or due within seven days. You can also assign a step from the “Assigned to” bar on the step page itself.' },
      { k: 'Analytics', v: 'A 90-Day Burn-up against the ideal pace, Module Velocity per program week, Workload by Member, and Signals. The ▾ Save as PDF button prints the analytics as a formatted report.' },
      { k: 'Email notifications', v: 'When a step is completed for the first time, the app emails a completion report to every team member with an email address, with the analytics attached as a PDF. When an assigned step comes within seven days of its deadline, the app emails one reminder to the assignees and to the organization’s administrator account – the owner account created when the organization was set up.' }
    ]
  },
  tools: {
    title: 'Tools',
    tools: [
      { ic: '? Help', d: 'Top-right nav. Opens this guide at any time. Each module has its own guide.' },
      { ic: '▦ Track Program', d: 'Under the … More menu. Opens the Track Program hub for step assignments, deadlines, analytics, and email notifications.' },
      { ic: '✦ AI Guide', d: 'Orange button, bottom-right corner. Context-aware for whichever step you are on. Ask it anything about the current step or your data.' },
      { ic: '≡ Team Chat', d: 'Top-right nav. Log decisions and messages with your team. Separate from the AI Guide conversation.' },
      { ic: '✎ Notes', d: 'Top-right nav. Capture thoughts as you work through each step. Notes are tagged to the step you are on when you write them.' },
      { ic: '◇ Profile', d: 'In the More menu. Set your organization details and manage the team roster. You can add, edit, or remove members inline.' },
      { ic: '◉ Voice', d: 'In the More menu. Navigate hands-free — say a tab name, “help”, “open guide”, “open notes”, or “close”.' },
      { ic: '⊕ View', d: 'In the More menu. Zoom the whole app in or out, fit the page to your screen, or reset to 100%. Useful for presentations and smaller displays.' },
      { ic: '▾ Save as PDF', d: 'Every output page carries the same ▾ Save as PDF button, at the top right of the page header, to print or save a formatted copy. On a portfolio page the PDF opens every card, so the copy is the full record and not just the headings on screen.' },
      { ic: '↻ Sample data', d: 'In the More menu. Seeds the workspace with a realistic example so you can explore every screen before entering your own data. Reset clears it.' }
    ]
  },
  team: {
    title: 'Organization &amp; Team',
    body: 'Open <strong class="t-paper">Profile</strong> from the More menu to manage the team and record your organization details. The page leads with Team Members and keeps Organization Details below it. Every member can be edited or removed inline, and each carries a username and a password for sign-in. These profiles flow through sign-in, step assignments, and Team Chat. The details cover the organization name, website, industry, company size, region, AI maturity level, executive sponsor, and the primary objective. Creating a new organization walks you through this setup once.'
  },
  privacy: {
    title: 'Data &amp; Privacy',
    body: 'Your organization’s workspace is stored centrally on the program’s servers and is isolated from every other organization. Everyone on your team signs into the same workspace, so the work you save is the work your colleagues see, whichever device they sign in from. Each program module keeps its own workspace under that same organization. The AI Guide sends only your question and the current step context to the Anthropic API, routed through the program’s server rather than directly from your browser. Email notifications go out through the program’s email service to the addresses on the team roster. <strong class="t-paper">Reset</strong> (More menu) clears the current organization’s data for the whole team, so use it with care. You can sign out at any time from your profile chip.'
  }
};

/* ── Section renderers ──────────────────────────────────────── */
function helpRowsHtml(rows) {
  var h = '<div class="u-b1b744e">';
  for (var i = 0; i < rows.length; i++) {
    h += '<div class="u-64f1789"><div class="u-57ca10d">' + rows[i].k + '</div><div class="u-13544a9">' + rows[i].v + '</div></div>';
  }
  return h + '</div>';
}

function helpPhasesHtml(phases) {
  var h = '<div class="u-dbaf33c">';
  for (var i = 0; i < phases.length; i++) {
    var hp = phases[i];
    h += '<div class="u-edbd16f">';
    h += '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:' + hp.col + ';padding-top:2px">' + hp.n + '</div>';
    h += '<div>';
    h += '<div class="u-c4172bc">' + hp.t + '</div>';
    h += '<p class="u-061830a">' + hp.d + '</p>';
    h += '<div class="u-4c03721">';
    h += '<div class="t-fade-sm"><span class="hp-tag" style="--c:' + hp.col + '">Steps</span>' + hp.steps + '</div>';
    if (hp.out) h += '<div class="t-fade-sm"><span class="hp-tag" style="--c:' + hp.col + '">Outputs</span>' + hp.out + '</div>';
    h += '</div></div></div>';
  }
  return h + '</div>';
}

function helpFunnelHtml(stages) {
  var h = '<div class="u-5421535">';
  for (var i = 0; i < stages.length; i++) {
    var fs = stages[i];
    h += '<div style="flex:1;padding:12px 14px;border-right:1px solid rgba(var(--fg-rgb),.08);background:' + fs.c + '10">'
      + '<div style="font-family:var(--mono);font-size:9px;font-weight:700;color:' + fs.c + ';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">' + fs.n + '</div>'
      + '<div class="u-79e87b9">' + fs.d + '</div></div>';
  }
  return h + '</div>';
}

function helpToolsHtml(tools) {
  var h = '<div class="u-b1b744e">';
  for (var i = 0; i < tools.length; i++) {
    h += '<div class="u-6dc0f40"><div class="u-57ca10d">' + tools[i].ic + '</div><div class="u-13544a9">' + tools[i].d + '</div></div>';
  }
  return h + '</div>';
}

/* One section, whichever kind it is. A shared section is resolved first, so
   `{ shared:'tools', extra:[…] }` renders the shell's list plus the module's
   own entries. */
/* AI Guide stage 1 (brief of 12 Oct 2026, section 6 items 2 and 3; built in dev 13 Oct 2026, live 28 Oct 2026). On the AI
   Innovation Pipeline the Guide now asks Pinecone, so two shared sentences would be untrue there: the
   tool-list line and the privacy sentence. They change for the Pipeline only — every other program's
   Guide still asks Anthropic directly through the server, and its help keeps saying so. */
var HELP_PIPELINE_GUIDE_LINE = 'Orange button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque’s book TRANSCEND and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can’t see the data you have entered.';
/* 16 Oct 2026: Executive Readiness got the same Guide, so the same two sentences change there too. Its line names
   its own button colour (the program's accent) and its own reference material (its Pinecone assistant holds
   Faisal Hoque's articles on AI-era leadership and a guide to this program, not TRANSCEND). */
var HELP_GUIDE_LINES = {
  'pipeline': HELP_PIPELINE_GUIDE_LINE,
  'exec-readiness': 'Purple button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque’s writing on AI-era leadership and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can’t see the data you have entered.',
  /* Responsible AI Governance (16 Oct 2026): its button is the program's teal accent; its assistant holds Faisal
     Hoque's articles on AI risk and accountability and a guide to this program. */
  'ai-governance': 'Teal button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque’s writing on AI risk and accountability and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can’t see the data you have entered.',
  /* AI-Ready Architecture (21 Oct 2026): slate button; its assistant holds Faisal Hoque's articles on enterprise
     architecture for AI and a guide to this program. */
  'ai-architecture': 'Slate button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque’s writing on enterprise architecture for AI and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can’t see the data you have entered.'
};
var HELP_PRIVACY_OLD = 'The AI Guide sends only your question and the current step context to the Anthropic API, routed through the program’s server rather than directly from your browser.';
var HELP_PRIVACY_NEW = 'The AI Guide sends your question, your recent messages in the Guide panel, and the name of the step you are on to Pinecone, an AI service, routed through the program’s server rather than directly from your browser. Pinecone adds relevant passages from the program’s reference material and has a Claude model, made by Anthropic, write the answer.';
function helpPipelineGuideCopy(sec) {
  var line = '';
  try { for (var id in HELP_GUIDE_LINES) if (window.Modules && Modules.isActive(id)) line = HELP_GUIDE_LINES[id]; } catch (e) { }
  if (!line) return sec;
  var out = {}; for (var k in sec) out[k] = sec[k];
  /* one AI Guide row: Executive Readiness adds its own beside the shared one, and both would now say the same */
  var seen = false;
  if (out.tools) out.tools = out.tools.filter(function (t) { if (!t || t.ic !== '✦ AI Guide') return true; if (seen) return false; seen = true; return true; })
    .map(function (t) { return t && t.ic === '✦ AI Guide' ? { ic: t.ic, d: line } : t; });
  if (typeof out.body === 'string' && out.body.indexOf(HELP_PRIVACY_OLD) >= 0) out.body = out.body.replace(HELP_PRIVACY_OLD, HELP_PRIVACY_NEW);
  return out;
}

function helpSectionHtml(sec) {
  if (sec.shared) {
    var base = HELP_SHARED[sec.shared];
    if (!base) return '';
    sec = {
      title: sec.title || base.title,
      body: base.body,
      rows: base.rows,
      phases: base.phases,
      funnel: base.funnel,
      tools: base.tools && sec.extra ? base.tools.concat(sec.extra) : base.tools
    };
    sec = helpPipelineGuideCopy(sec);
  }
  var h = '<div class="mb-6">';
  if (sec.title) h += '<div class="section-label mb-3">' + sec.title + '</div>';
  if (sec.body) h += '<p class="t-stone-md"' + ((sec.rows || sec.funnel) ? ' style="margin-bottom:10px"' : '') + '>' + sec.body + '</p>';
  if (sec.rows) h += helpRowsHtml(sec.rows);
  if (sec.phases) h += helpPhasesHtml(sec.phases);
  if (sec.funnel) h += helpFunnelHtml(sec.funnel);
  if (sec.tools) h += helpToolsHtml(sec.tools);
  return h + '</div>';
}

/* ── The modal ──────────────────────────────────────────────── */
function renderModal() {
  var mr = $('modalRoot'); if (!mr) return;
  if (!currentModal) { mr.innerHTML = ''; return; }

  var doc = (window.Modules && Modules.help()) || null;
  var h = '<div class="modal-bg" onclick="if(event.target===this)closeModal()">';
  h += '<div class="modal">';

  if (!doc) {
    // A module without a help document still gets a usable overlay rather than
    // an empty box: the shared blocks alone describe the whole shell.
    h += '<h3>' + esc((window.Modules && Modules.active().name) || 'Help') + '</h3>';
    ['signin', 'modules', 'track', 'tools', 'team', 'privacy'].forEach(function (id) {
      h += helpSectionHtml({ shared: id });
    });
  } else {
    h += '<h3>' + doc.title + '</h3>';
    if (doc.intro) h += '<div class="u-e6b5a04">' + doc.intro + '</div>';
    for (var i = 0; i < (doc.sections || []).length; i++) h += helpSectionHtml(doc.sections[i]);
  }

  h += '<div class="u-ea28b89"><button class="btn-gold" onclick="closeModal()">Got It</button></div>';
  h += '</div></div>';
  mr.innerHTML = h;
}
