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

/* What the reader is looking at, in a few words, for the panel's "Context:"
   line and for the question sent to the model. The shell's answer is the step
   id, because that is what a phase/step program is always inside; a program
   that routes to pages of its own says so itself (Modules.hook). */
function coachContext() {
  var own = window.Modules && Modules.hook('coachContext');
  if (own) { var t = own(); if (t) return t; }
  return currentStep ? ('Step ' + currentStep) : 'Overview';
}

function renderCoachPanel() {
  var panel = $('coachPanel'); if (!panel) return;
  var ctx = coachContext();
  var h = '<div class="coach-header"><div class="coach-header-title"><span>★</span> AI Guide</div><button class="coach-close" onclick="toggleCoach()">×</button></div>';
  if (aiSwitchesApply()) h += '<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>';
  h += '<div class="u-095218e"><div class="u-3d326bb">Context: ' + esc(ctx) + '</div></div>';
  h += '<div class="coach-msgs" id="coachMsgsEl">';
  for (var i = 0; i < coachMsgs.length; i++) {
    var m = coachMsgs[i];
    h += '<div class="coach-msg ' + m.role + '"><div class="coach-sender">' + (m.role === 'ai' ? 'AI Guide' : 'You') + '</div>' + esc(m.text) + '</div>'
  }
  h += '</div>';
  h += '<div class="coach-presets">';
  /* The chips are the program's own questions when it names any; the five
     below are the Pipeline's and stand in for every program that doesn't. A
     chip is either the question itself or {label, text} — the Leaders programs
     use the second form, where "Help me build my case" sends a paragraph. */
  var presets = (window.Modules && Modules.coachPresets()) ||
    ['Where do I start?', 'Help with this step', 'What\'s a stage gate?', 'FIRST framework?', 'Portfolio vs. projects'];
  for (var i = 0; i < presets.length; i++) {
    var p = presets[i];
    var label = (typeof p === 'string') ? p : (p.label || p.text || '');
    var text = (typeof p === 'string') ? p : (p.text || p.label || '');
    h += '<button class="coach-preset" onclick="sendCoachPreset(\'' + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\')">' + esc(label) + '</button>';
  }
  h += '</div>';
  h += '<div class="coach-input-row"><textarea id="coachInput" data-char-cap="2000" placeholder="Ask about any step, concept, or challenge..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendCoach()}"></textarea><button class="coach-send" onclick="sendCoach()">→</button></div>';
  panel.innerHTML = h;
  var msgs = document.getElementById('coachMsgsEl'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function sendCoachPreset(t) { var inp = document.getElementById('coachInput'); if (inp) inp.value = t; sendCoach(); }

function sendCoach() {
  if (!aiGuideOn()) return;   /* Part 2: no request to the AI service */
  var inp = document.getElementById('coachInput'); if (!inp || !inp.value.trim()) return;
  var userText = inp.value.trim(); inp.value = '';
  /* Part S follow-up (7 Oct 2026): the reply belongs to the conversation it was asked in. sealSession replaces
     coachMsgs on a sign-out or a change of organization, so a reply still in flight then lands in the old,
     discarded thread and never in the next organization's. */
  var thread = coachMsgs;
  coachMsgs.push({ role: 'user', text: userText });
  renderCoachPanel();
  var ctx = 'User is working on: ' + (window.Modules && Modules.hook('coachContext')
    ? coachContext()
    : (currentStep ? 'Step ' + currentStep + ' (' + currentPhase?.name + ')' : 'the pipeline overview'));
  var sysPrompt = (window.Modules && Modules.coachSystem()) ||
    'You are the AI Guide for Faisal Hoque\'s 90-Day AI Innovation Pipeline — a framework grounded in the OPEN and CARE frameworks and published in Fast Company, HBR, and MIT Sloan Management Review. You help leaders build structured AI innovation pipelines through five phases: Diagnose, Organize, Prepare, Ignite, Navigate. Be direct, insightful, and strategic. Maximum 150 words per response. No bullets unless absolutely essential.';

  fetch(CLAUDE_API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 300,
      messages: [{ role: 'user', content: sysPrompt + '\n\n' + ctx + '\n\nUser question: ' + userText }]
    })
  }).then(function (r) { return r.json() }).then(function (j) {
    var text = ''; if (j.content) for (var i = 0; i < j.content.length; i++)if (j.content[i].text) text += j.content[i].text;
    if (!text) text = 'Could not generate response. Try again.';
    thread.push({ role: 'ai', text: text }); if (thread === coachMsgs) renderCoachPanel();
  }).catch(function () { thread.push({ role: 'ai', text: 'Connection error. Please try again.' }); if (thread === coachMsgs) renderCoachPanel() });
}
