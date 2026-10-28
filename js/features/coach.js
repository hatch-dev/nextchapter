/* ─────────────────────────────────────────────────────────────
   coach.js — AI Guide coach panel (bottom-right slide-out)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   Relies on app.js globals: coachOpen, $, esc, render, currentStep,
   Claude/askClaude helpers, anchorBelowNav, and related UI state.
   ───────────────────────────────────────────────────────────── */

// === COACH ===
/* -- AI FEATURES (Directive 2 Oct 2026, Part 2; live for the AI Innovation Pipeline, 6 Oct 2026, and Executive Readiness
   and Responsible AI Governance, 7 Oct 2026 — each its own directive of the same date; each workspace document carries
   data.settings too. Governance's port sends nothing to the AI service of its own: its Insights page is the curated
   catalogue, and its AI Guide is this one).
   On the Pipeline the AI Guide and Voice are off until an organization's administrator switches them on in
   Profile; data without settings counts as both off, and while the AI Guide is off nothing is sent to the AI
   service. The setting lives in the Pipeline's workspace document (data.settings), so it is per organization,
   reaches the other members through the change poll, and is kept by Reset all data (ORG_LEVEL_KEYS).
   Every other program keeps today's behaviour (both on) until its own directive is applied. -- */
/* AI-Ready Architecture (21 Oct 2026): its build carries the same switches (Spec §25.2: both start off) — without it here
   its Guide and Voice were always on, with no switch for an administrator. */
function aiSwitchesApply() { try { return !!(window.Modules && (Modules.isActive('pipeline') || Modules.isActive('exec-readiness') || Modules.isActive('ai-governance') || Modules.isActive('ai-architecture'))); } catch (e) { return false; } }
function aiGuideOn() { if (window.SAMPLE_MODE) return false; if (!aiSwitchesApply()) return true; return !!(typeof data !== 'undefined' && data && data.settings && data.settings.aiGuide); }
function voiceOn() { if (window.SAMPLE_MODE) return false; if (!aiSwitchesApply()) return true; return !!(typeof data !== 'undefined' && data && data.settings && data.settings.voice); }
function canSetAiFeatures() { return aiSwitchesApply() && typeof canManageOrg === 'function' && canManageOrg(); }
function stopVoiceIfOff() {
  if (voiceOn() || typeof voiceActive === 'undefined' || !voiceActive) return;
  voiceActive = false; try { if (recognition) recognition.stop(); } catch (e) { } try { updateVoiceUI(); } catch (e) { }
}
function setAiFeature(key, on) {
  if (!canSetAiFeatures() || (key !== 'aiGuide' && key !== 'voice')) return;
  if (!data.settings) data.settings = { aiGuide: false, voice: false };
  data.settings[key] = !!on;
  saveData();
  render();              /* render -> setCoachVisible: the button follows the switch, and an open panel closes */
  stopVoiceIfOff();
  if (currentModal === 'org') renderOrgModal();
}
function aiFeaturesFold() {
  var s = (data && data.settings) || {};
  function sw(key, label, note) { return '<label class="ai-switch"><input type="checkbox" role="switch" id="aiSet_' + key + '"' + (s[key] ? ' checked' : '') + ' onchange="setAiFeature(\'' + key + '\',this.checked)"/> <span>' + label + '</span></label><div class="ai-fold-note">' + note + '</div>'; }
  return '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open"' + (UI.aiFoldOpen ? ' open' : '') + '><summary>AI Features (off by default)</summary><div class="ai-fold-body">'
    + sw('aiGuide', 'AI Guide', 'When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.')
    + sw('voice', 'Voice', 'When this is on, Voice uses the browser\'s own speech recognition. Some browsers send the recording to the browser maker to turn it into text.')
    + '</div></details>';
}
// Show or hide the AI Guide FAB (and its pulse + slide-out panel). The app
// only calls this with false on the pre-login entry screens (login / setup /
// admin sign-in), and with true once signed in. Hiding also collapses an
// open panel so it can't linger after sign-out.
function setCoachVisible(on) {
  if (on && !aiGuideOn()) on = false;   /* Part 2: off for the organization -> no button, and an open panel closes */
  try { stopVoiceIfOff(); } catch (e) { }
  var fab = $('coachFab'), pulse = $('fabPulse'), panel = $('coachPanel');
  if (on) {
    if (fab) fab.style.display = '';
    if (pulse) pulse.style.display = coachOpen ? 'none' : '';
    if (panel) panel.style.display = '';
    return;
  }
  if (coachOpen) {
    coachOpen = false;
    if (fab) fab.className = 'coach-fab';
    if (panel) panel.className = 'coach-panel';
  }
  if (fab) fab.style.display = 'none';
  if (pulse) pulse.style.display = 'none';
  if (panel) panel.style.display = 'none';
}

function toggleCoach() {
  if (!coachOpen && !aiGuideOn()) return;   /* Part 2: blocks opening only, so the seal can always close it */
  coachOpen = !coachOpen;
  $('coachFab').className = 'coach-fab' + (coachOpen ? ' open' : '');
  $('fabPulse').style.display = coachOpen ? 'none' : 'block';
  $('coachPanel').className = 'coach-panel' + (coachOpen ? ' open' : '');
  if (coachOpen) renderCoachPanel();
}

/* What the reader is looking at, in a few words, for the panel's header line
   and for the question sent to the model. The shell's answer is the step
   id, because that is what a phase/step program is always inside; a program
   that routes to pages of its own says so itself (Modules.hook). */
function coachContext() {
  var own = window.Modules && Modules.hook('coachContext');
  if (own) { var t = own(); if (t) return t; }
  return currentStep ? ('Step ' + currentStep) : 'Overview';
}

/* ── AI GUIDE STAGE 1 (brief of 12 Oct 2026; built in dev 13 Oct 2026, live 28 Oct 2026) ───────────────────────────────
   On the AI Innovation Pipeline the Guide asks the Pinecone Assistant (TRANSCEND + the module guide) through
   this API's POST /guide, which holds the key, checks the session and returns only { answer }. The panel
   resends the recent conversation (Pinecone remembers nothing between requests) and one sentence saying
   which step the user is on; the five preset questions are gone. Every other program keeps its own
   presets, system prompt and POST /claude exactly as before — the brief is the Pipeline's alone.
   16 Oct 2026: Executive Readiness got the same Guide (GUIDE_MODULES), then Responsible AI Governance. Each request
   names its module and the server answers from that program's own Pinecone assistant
   (nextchapter-executive-readiness, nextchapter-responsible-ai-governance).
   The panel itself is dressed like Team Chat for every program, and a redraw (render() redraws it on
   every app redraw) keeps the reader's scroll position, draft and cursor; the view moves only when the
   conversation does — to the bottom on a question, to the first line of an answer when it arrives. */
var GUIDE_ENDPOINT = 'api/guide';   /* relative: resolves against <base href>, so it reaches this install's own api/guide */
var GUIDE_HISTORY_LIMIT = 10;       /* earlier messages resent with each new question */
var coachBusy = false;
var coachRefocus = false;           /* put the cursor back in the box once an answer arrives */
var coachScrollTo = '';             /* '' keep | 'bottom' | 'answer' (first line of the newest answer) | 'top' */

var GUIDE_MODULES = ['pipeline', 'exec-readiness', 'ai-governance', 'ai-architecture'];   /* the programs whose Guide asks POST /guide (Pinecone); AI-Ready Architecture added 21 Oct 2026 (assistant `architecture`) */
function guideModule() { try { if (!window.Modules) return ''; for (var i = 0; i < GUIDE_MODULES.length; i++) if (Modules.isActive(GUIDE_MODULES[i])) return GUIDE_MODULES[i]; } catch (e) { } return ''; }
function guideUsesPinecone() { return guideModule() !== ''; }

// One sentence telling the Guide where the user is in the program.
function guideStepContext() {
  if (currentStep) {
    for (var i = 0; i < PH.length; i++) {
      for (var j = 0; j < PH[i].steps.length; j++) {
        var s = PH[i].steps[j];
        if (s.id === currentStep) return 'The user is on Step ' + s.id + ' (' + s.name + ') in Phase ' + PH[i].id + ': ' + PH[i].name + '.';
      }
    }
  }
  if (currentPhase) return 'The user is on the overview page for Phase ' + currentPhase.id + ': ' + currentPhase.name + '.';
  return 'The user is on the program overview.';
}

// The header's second line: "Step 1.2 · Brainstorm Use Cases".
function guideWhere() {
  if (!guideUsesPinecone()) return coachContext();
  if (currentStep) {
    for (var i = 0; i < PH.length; i++) {
      for (var j = 0; j < PH[i].steps.length; j++) {
        var s = PH[i].steps[j];
        if (s.id === currentStep) return 'Step ' + s.id + ' · ' + s.name;
      }
    }
  }
  if (currentPhase) return 'Phase ' + currentPhase.id + ' · ' + currentPhase.name;
  return 'Program overview';
}

// Earlier exchanges to resend: skips the welcome message and any failed exchange,
// keeps the most recent GUIDE_HISTORY_LIMIT messages, and starts with a user turn.
function guideHistory() {
  var out = [];
  for (var i = 0; i < coachMsgs.length; i++) {
    var m = coachMsgs[i];
    if (m.welcome || m.failed) continue;
    out.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text });
  }
  out = out.slice(-GUIDE_HISTORY_LIMIT);
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
}

// Safe light formatting for answers: escapes all HTML first, then renders
// **bold**, bulleted and numbered lists, and headings. Everything else is a paragraph.
function guideFormat(text) {
  var lines = esc(text).split(/\r?\n/), out = '', list = '';
  function close() { if (list) { out += '</' + list + '>'; list = ''; } }
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    var ul = l.match(/^\s*[-*•]\s+(.*)$/), ol = l.match(/^\s*\d+[.)]\s+(.*)$/), hd = l.match(/^\s*#{1,6}\s+(.*)$/);
    if (ul || ol) {
      var t = ul ? 'ul' : 'ol';
      if (list !== t) { close(); out += '<' + t + ' class="coach-list">'; list = t; }
      out += '<li>' + (ul ? ul[1] : ol[1]) + '</li>';
    } else {
      close();
      if (hd) out += '<p class="coach-head"><strong>' + hd[1] + '</strong></p>';
      else if (l.trim()) out += '<p>' + l + '</p>';
    }
  }
  close();
  return out;
}

// Grows the question box with its text, up to the CSS max-height.
function coachAutoGrow(t) { if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }

// Starts a fresh conversation. A reply still in flight stays in the old thread (see sendCoach).
function newCoachConversation() {
  coachMsgs = JSON.parse(COACH_MSGS_PRISTINE); coachBusy = false; coachRefocus = true; coachScrollTo = 'top'; renderCoachPanel();
}

// Copies one answer as the plain text the reader sees.
function coachCopy(btn) {
  var msg = btn && btn.closest ? btn.closest('.coach-msg') : null, body = msg ? msg.querySelector('.coach-body') : null; if (!body) return;
  var text = body.innerText || body.textContent || '';
  function done(ok) { btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); }
  function legacy() { try { var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); done(ok); } catch (e) { done(false); } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, legacy); return; }   /* refused: the older way */
  legacy();
}

// Shows "Latest" while the reader is scrolled well up from the end of the conversation.
function coachScrollWatch(el) {
  var btn = document.getElementById('coachLatest'); if (!el || !btn) return;
  btn.classList.toggle('show', el.scrollHeight - el.scrollTop - el.clientHeight > 160);
}
function coachToLatest() { var el = document.getElementById('coachMsgsEl'); if (el) { el.scrollTop = el.scrollHeight; coachScrollWatch(el); } }

var COACH_AVATAR = '<span class="coach-avatar" aria-hidden="true">✦</span>';
function coachAiRow(body, extra, canCopy) {
  return '<div class="coach-row ai' + (extra ? ' ' + extra : '') + '">' + COACH_AVATAR + '<div class="coach-col"><div class="coach-sender">AI Guide</div>'
    + '<div class="coach-msg ai' + (extra ? ' ' + extra : '') + '"><div class="coach-body">' + body + '</div>'
    + (canCopy ? '<div class="coach-tools"><button class="coach-tool" onclick="coachCopy(this)">Copy</button></div>' : '')
    + '</div></div></div>';
}

function renderCoachPanel() {
  var panel = $('coachPanel'); if (!panel) return;
  /* what the reader is in the middle of, carried across the redraw */
  var oldMsgs = document.getElementById('coachMsgsEl'), oldTop = oldMsgs ? oldMsgs.scrollTop : null;
  var oldInp = document.getElementById('coachInput'), draft = oldInp ? oldInp.value : '', typing = !!oldInp && document.activeElement === oldInp;
  var selA = typing ? oldInp.selectionStart : null, selB = typing ? oldInp.selectionEnd : null;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'AI Guide');
  panel.onkeydown = function (e) { if (e.key === 'Escape' && coachOpen) { e.preventDefault(); toggleCoach(); var f = $('coachFab'); if (f && f.focus) f.focus(); } };
  var pine = guideUsesPinecone();
  var me = (typeof getCurrentUser === 'function' && getCurrentUser()) || null;
  var started = coachMsgs.some(function (m) { return !m.welcome; });

  var h = '<div class="coach-header"><div class="coach-id">' + COACH_AVATAR + '<div class="coach-id-text"><div class="coach-header-title">AI Guide</div><div class="coach-where">' + esc(guideWhere()) + '</div></div></div>';
  h += '<div class="coach-actions">';
  if (started) h += '<button class="coach-icon-btn" onclick="newCoachConversation()" title="New conversation" aria-label="Start a new conversation"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>';
  h += '<button class="coach-icon-btn coach-close" onclick="toggleCoach()" title="Close (Esc)" aria-label="Close the AI Guide">×</button>';
  h += '</div></div>';
  if (aiSwitchesApply()) h += '<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>';
  h += '<div class="coach-msgs" id="coachMsgsEl" role="log" aria-live="polite" onscroll="coachScrollWatch(this)">';
  for (var i = 0; i < coachMsgs.length; i++) {
    var m = coachMsgs[i];
    if (m.role === 'ai') h += coachAiRow(guideFormat(m.text), m.failed ? 'failed' : '', !m.welcome && !m.failed);
    else h += '<div class="coach-row user">' + (me ? userAv(me, 30) : '') + '<div class="coach-col"><div class="coach-sender">You</div><div class="coach-msg user"><div class="coach-body">' + esc(m.text) + '</div></div></div></div>';
  }
  if (coachBusy) h += coachAiRow('<span class="coach-dots" aria-hidden="true"><i></i><i></i><i></i></span>Thinking…', 'coach-thinking', false);
  h += '</div>';
  h += '<button class="coach-latest" id="coachLatest" onclick="coachToLatest()" aria-label="Jump to the latest message">↓ Latest</button>';
  if (!pine) {
    /* Every program but the Pipeline keeps its preset questions. A chip is either the question itself or
       {label, text} — the Leaders programs use the second form, where "Help me build my case" sends a paragraph. */
    var presets = (window.Modules && Modules.coachPresets()) ||
      ['Where do I start?', 'Help with this step', 'What\'s a stage gate?', 'FIRST framework?', 'Portfolio vs. projects'];
    h += '<div class="coach-presets">';
    for (var k = 0; k < presets.length; k++) {
      var p = presets[k];
      var label = (typeof p === 'string') ? p : (p.label || p.text || '');
      var text = (typeof p === 'string') ? p : (p.text || p.label || '');
      h += '<button class="coach-preset" onclick="sendCoachPreset(\'' + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\')"' + (coachBusy ? ' disabled' : '') + '>' + esc(label) + '</button>';
    }
    h += '</div>';
  }
  h += '<div class="coach-composer"><div class="coach-input-row"><textarea id="coachInput" data-char-cap="2000" rows="1" aria-label="Ask the AI Guide" placeholder="Ask about any step, concept, or challenge..."' + (coachBusy ? ' disabled' : '') + ' oninput="coachAutoGrow(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendCoach()}"></textarea>';
  h += '<button class="coach-send" onclick="sendCoach()" title="Send" aria-label="Send"' + (coachBusy ? ' disabled' : '') + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>';
  h += '<div class="coach-hint">Enter to send · Shift+Enter for a new line · Esc to close</div></div>';
  panel.innerHTML = h;

  var msgs = document.getElementById('coachMsgsEl'), inp = document.getElementById('coachInput');
  if (inp && draft && !coachBusy) { inp.value = draft; coachAutoGrow(inp); }
  if (msgs) {
    if (coachScrollTo === 'bottom' || oldTop === null) msgs.scrollTop = msgs.scrollHeight;
    else if (coachScrollTo === 'top') msgs.scrollTop = 0;
    else if (coachScrollTo === 'answer') {
      var rows = msgs.querySelectorAll('.coach-row.ai'), last = rows[rows.length - 1];
      if (last && last.getBoundingClientRect) msgs.scrollTop += last.getBoundingClientRect().top - msgs.getBoundingClientRect().top - 12;
      else msgs.scrollTop = msgs.scrollHeight;
    }
    else msgs.scrollTop = oldTop;
    coachScrollTo = ''; coachScrollWatch(msgs);
  }
  if (coachOpen && !coachBusy && inp && inp.focus && (typing || coachRefocus)) {
    coachRefocus = false; inp.focus();
    if (typing && selA != null && inp.setSelectionRange) { try { inp.setSelectionRange(selA, selB); } catch (e) { } }
  }
}

function sendCoachPreset(t) { var inp = document.getElementById('coachInput'); if (inp) inp.value = t; sendCoach(); }

function sendCoach() {
  if (!aiGuideOn()) return;   /* Part 2: no request to the AI service */
  if (coachBusy) return;      /* one question at a time */
  var inp = document.getElementById('coachInput'); if (!inp || !inp.value.trim()) return;
  var userText = inp.value.trim(); inp.value = '';
  var pine = guideUsesPinecone();
  var history = pine ? guideHistory() : null;   /* built before the new question is added */
  /* Part S follow-up (7 Oct 2026): the reply belongs to the conversation it was asked in. sealSession replaces
     coachMsgs on a sign-out or a change of organization, so a reply still in flight then lands in the old,
     discarded thread and never in the next organization's. */
  var thread = coachMsgs;
  var userMsg = { role: 'user', text: userText };
  coachMsgs.push(userMsg);
  coachBusy = true; coachRefocus = true; coachScrollTo = 'bottom'; renderCoachPanel();
  function finish() { if (thread !== coachMsgs) return; coachBusy = false; coachScrollTo = 'answer'; renderCoachPanel(); }
  /* A failed exchange is shown, and both halves are marked so neither is resent with later questions. */
  function guideFailed() { userMsg.failed = true; thread.push({ role: 'ai', failed: true, text: 'Sorry, the AI Guide is unavailable right now. Please try again in a moment.' }); }

  if (pine) {
    fetch(GUIDE_ENDPOINT, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: guideModule(), question: userText, history: history, context: guideStepContext() })
    }).then(function (r) { return (r && r.ok) ? r.json() : null; }).then(function (j) {
      if (j && j.answer) thread.push({ role: 'ai', text: j.answer });
      else guideFailed();   /* refused (401/403/502…) or an empty answer */
      finish();
    }).catch(function () { guideFailed(); finish(); });
    /* No throw inside a handler and nothing chained after catch: the test suite's stand-in fetch is synchronous. */
    return;
  }

  /* Every other program: unchanged — its own system prompt, one turn, POST /claude. */
  var ctx = 'User is working on: ' + (window.Modules && Modules.hook('coachContext')
    ? coachContext()
    : (currentStep ? 'Step ' + currentStep + ' (' + (currentPhase && currentPhase.name) + ')' : 'the pipeline overview'));
  var sysPrompt = (window.Modules && Modules.coachSystem()) ||
    'You are the AI Guide for Faisal Hoque\'s 90-Day AI Innovation Pipeline — a framework grounded in the OPEN and CARE frameworks and published in Fast Company, HBR, and MIT Sloan Management Review. You help leaders build structured AI innovation pipelines through five phases: Diagnose, Organize, Prepare, Ignite, Navigate. Be direct, insightful, and strategic. Maximum 150 words per response. No bullets unless absolutely essential.';
  fetch(CLAUDE_API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 300,
      messages: [{ role: 'user', content: sysPrompt + '\n\n' + ctx + '\n\nUser question: ' + userText }]
    })
  }).then(function (r) { return r.json(); }).then(function (j) {
    var text = ''; if (j.content) for (var i = 0; i < j.content.length; i++) if (j.content[i].text) text += j.content[i].text;
    if (!text) { userMsg.failed = true; thread.push({ role: 'ai', failed: true, text: 'Could not generate response. Try again.' }); }
    else thread.push({ role: 'ai', text: text });
    finish();
  }).catch(function () {
    userMsg.failed = true; thread.push({ role: 'ai', failed: true, text: 'Connection error. Please try again.' });
    finish();
  });
}
