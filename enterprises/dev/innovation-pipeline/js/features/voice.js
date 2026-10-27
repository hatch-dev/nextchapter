/* ============================================================
   voice.js - Voice activation (mic FAB + simple command parser)
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   Toggles the browser SpeechRecognition mic, shows a toast, and maps
   a few spoken phrases to navigation / panel actions. Relies on app.js
   globals: UI, coachOpen, notesOpen, go, toggleCoach, toggleNotes,
   closeModal, render, and related DOM ids.
   ============================================================ */

// === VOICE ACTIVATION ===
var voiceActive = false, recognition = null, voiceTimeout = null;

function toggleVoice() {
  if (!voiceOn()) return;   /* Part 2 (Pipeline): speech recognition never starts while Voice is off */
  if (voiceActive) { voiceActive = false; if (recognition) { try { recognition.stop() } catch (e) { } } updateVoiceUI(); return; }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showVoiceToast('Voice not supported', 'Use Chrome, Edge, or Safari'); return }
  recognition = new SR();
  recognition.continuous = false; recognition.interimResults = true; recognition.lang = 'en-US'; recognition.maxAlternatives = 1;
  recognition.onstart = function () { voiceActive = true; updateVoiceUI(); showVoiceToast('Listening\u2026', 'Try: "learn" \u00b7 "pipeline" \u00b7 "navigate" \u00b7 "open coach"') };
  recognition.onresult = function (e) {
    var final = '', interim = '';
    for (var i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript }
    var display = final || interim;
    if (display) { var t = $('voiceToast'); if (t) { t.innerHTML = '<div class="voice-transcript">\u201c' + display.trim() + '\u201d</div>'; t.classList.add('show') } }
    if (final) { processVoice(final.trim().toLowerCase()) }
  };
  recognition.onerror = function (e) { if (e.error === 'not-allowed') showVoiceToast('Microphone blocked', 'Allow mic access in browser settings'); else if (e.error !== 'no-speech' && e.error !== 'aborted') showVoiceToast('Error: ' + e.error, '') };
  recognition.onend = function () { voiceActive = false; recognition = null; updateVoiceUI(); clearTimeout(voiceTimeout); voiceTimeout = setTimeout(function () { var t = $('voiceToast'); if (t) t.classList.remove('show') }, 4000) };
  try { recognition.start() } catch (e) { showVoiceToast('Could not start mic', '' + e.message); voiceActive = false; updateVoiceUI() }
}

function updateVoiceUI() {
  var fab = $('voiceFab'), lbl = $('voiceLabel');
  if (fab) { if (voiceActive) { fab.classList.add('listening'); if (lbl) lbl.textContent = 'Listening…' } else { fab.classList.remove('listening'); if (lbl) lbl.textContent = 'Voice' } }
  var nb = $('navVoiceBtn');
  if (nb) { if (voiceActive) { nb.style.borderColor = 'var(--gold)'; nb.style.color = 'var(--gold)'; nb.textContent = '◉ Listening…' } else { nb.style.borderColor = ''; nb.style.color = ''; nb.innerHTML = '◉ Voice' } }
}

function showVoiceToast(msg, sub) {
  var t = $('voiceToast'); if (!t) return;
  t.innerHTML = '<div>' + msg + '</div>' + (sub ? '<div class="voice-cmd">' + sub + '</div>' : '');
  t.classList.add('show');
  clearTimeout(voiceTimeout);
  voiceTimeout = setTimeout(function () { t.classList.remove('show') }, 6000);
}

function processVoice(text) {
  var matched = true;
  if (text.match(/\b(overview|home|go home|main|start)\b/)) go('home');
  else if (text.match(/\b(learn|read|research|library|articles?|books?|videos?|podcast)\b/)) go('learn');
  else if (text.match(/\b(pipeline|phases?|journey|steps?)\b/)) go('pipeline');
  else if (text.match(/\b(navigate|dashboard|operational|live)\b/)) go('phase5');
  else if (text.match(/\b(help)\b|how does this work/)) { openHelp(); showVoiceToast('\u2713 Opening help', '') }
  else if (aiGuideOn() && text.match(/\b(coach|guide)\b|ask.*(coach|guide)|open.*(coach|guide)/)) { if (!coachOpen) toggleCoach(); showVoiceToast('\u2713 Opening AI Guide', '') }
  else if (text.match(/\b(notes?)\b|open.*note/)) { if (!notesOpen) toggleNotes(); showVoiceToast('\u2713 Opening notes', '') }
  else if (text.match(/\b(close|stop|cancel|never mind|dismiss)\b/)) { closeModal(); if (coachOpen) toggleCoach(); if (notesOpen) toggleNotes(); showVoiceToast('Closed', '') }
  else { matched = false; showVoiceToast('Didn\u2019t catch that', 'Try: "learn" \u00b7 "pipeline" \u00b7 "guide" \u00b7 "navigate"') }
  if (matched && !text.match(/close|stop|cancel/)) showVoiceToast('\u2713 ' + text, '');
}
