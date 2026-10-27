/* ─────────────────────────────────────────────────────────────
   notes.js — Private per-user notes (MySQL-backed)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js. This is a plain global script (loaded
   before app.js): its functions and the `notesData` state stay on
   the global scope exactly as before, because the notes panel wires
   its buttons with inline onclick (addNote / deleteNote / toggleNotes).

   Each signed-in user sees only their own notes. If the user isn't
   linked to a server account, it falls back to device-local notes so
   nothing breaks.

   Relies on app.js globals: data, Store, API_BASE, actorId, uid, esc,
   $, currentStep, notesOpen, anchorBelowNav, postJSON, showToast.
   ───────────────────────────────────────────────────────────── */
var notesData = [];   // current user's notes, newest first
function notesActor() { return actorId(); }
/* What a note is filed against. `notes.step` is a plain VARCHAR, so it holds
   whatever the program calls the thing the reader is looking at: a step id in
   the phase/step programs, the id of the decision being worked through in the
   Leaders ones. A program that routes to pages of its own says which; every
   other program gets the step id, exactly as before. */
function notesScope() {
  var own = window.Modules && Modules.hook('noteScope');
  var s = own ? own() : null;
  if (s && s.key) return { key: String(s.key), label: s.label || String(s.key) };
  return { key: currentStep || '', label: currentStep ? 'Step ' + currentStep : '' };
}
/* The one on a note that was already saved — its own key, not the open page's.
   A program supplies the wording; unknown keys read as a step, which is what
   every note written before this existed is. */
function notesScopeLabel(key) {
  if (!key) return '';
  var own = window.Modules && Modules.hook('noteScopeLabel');
  var t = own ? own(key) : null;
  return t || ('Step ' + key);
}
function notesDate(v) { try { var d = (typeof v === 'number') ? new Date(v) : new Date(('' + v).replace(' ', 'T')); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }

/* Which program these notes belong to.

   Notes are private per user AND per program: a note taken against decision 3
   of The Decision Lab has no meaning in the AI Innovation Pipeline, and used to
   appear there anyway, filed against a step of the same number. Same answer the
   workspace uses, from the same place, so the two can never drift. */
function notesModule() {
  try { return Store.moduleId(currentOrgId); } catch (e) { return (window.Modules && Modules.activeId()) || 'pipeline'; }
}

function notesLoad(cb) {
  var actor = notesActor();
  if (!actor) { // no server account → device-local notes
    notesData = (data.notes || []).slice().reverse().map(function (n) { return { id: n.id, body: n.text, step: n.step, created_at: n.createdAt }; });
    updateNotesCount(); if (cb) cb(); return;
  }
  fetch(API_BASE + '/notes?actor_id=' + encodeURIComponent(actor) + '&module=' + encodeURIComponent(notesModule()))
    .then(function (r) { return r.json(); })
    .then(function (res) { if (res && res.success && res.data) notesData = res.data.notes || []; updateNotesCount(); if (cb) cb(); })
    .catch(function () { if (cb) cb(); });
}

function toggleNotes() {
  notesOpen = !notesOpen;
  var fab = $('notesFab'); if (fab) fab.className = 'notes-fab' + (notesOpen ? ' open' : '');
  var navBtn = document.getElementById('notesNavBtn'); if (navBtn) navBtn.classList.toggle('nav-action-on', notesOpen);
  var np = $('notesPanel'); np.className = 'notes-panel' + (notesOpen ? ' open' : '');
  if (notesOpen) np.style.top = anchorBelowNav();
  if (notesOpen) { renderNotesPanel(); notesLoad(function () { renderNotesPanel(); }); }
}

function updateNotesCount() { var el = $('notesCount'); if (el) { var n = notesData.length; el.textContent = n; el.style.display = n ? '' : 'none' } }

function renderNotesPanel() {
  var panel = $('notesPanel'); if (!panel) return;
  var h = '<div class="notes-header"><div class="notes-header-title">&#9998; Notes</div><button class="notes-close" onclick="toggleNotes()">×</button></div>';
  h += '<div class="notes-list">';
  if (!notesData.length) h += '<div class="notes-empty">Capture insights as you work through the pipeline.</div>';
  else for (var i = 0; i < notesData.length; i++) { var n = notesData[i]; h += '<div class="note-card"><div class="note-text">' + esc(n.body) + '</div><div class="note-meta"><span class="note-date">' + (n.step ? esc(notesScopeLabel(n.step)) + ' · ' : '') + esc(notesDate(n.created_at)) + '</span><button class="note-del" onclick="deleteNote(\'' + n.id + '\')">×</button></div></div>'; }
  h += '</div>';
  h += '<div class="notes-input-row"><textarea id="notesInput" placeholder="Write a note..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();addNote()}"></textarea><button class="notes-send" onclick="addNote()">&#9998;</button></div>';
  panel.innerHTML = h;
}

function addNote() {
  var inp = document.getElementById('notesInput'); if (!inp || !inp.value.trim()) return;
  var text = inp.value.trim(); var actor = notesActor();
  if (!actor) { // device-local fallback
    if (!data.notes) data.notes = [];
    var _sc = notesScope();
    var ln = { id: uid(), text: text, step: _sc.key, createdAt: Date.now() };
    data.notes.push(ln); Store.commit('notes');
    notesData.unshift({ id: ln.id, body: text, step: _sc.key, created_at: ln.createdAt });
    inp.value = ''; renderNotesPanel(); updateNotesCount(); return;
  }
  inp.value = '';
  postJSON(API_BASE + '/notes', { actor_id: actor, body: text, step: notesScope().key, module: notesModule() },
    function (res) { var saved = res && res.data && res.data.note; if (saved) { notesData.unshift(saved); renderNotesPanel(); updateNotesCount(); } },
    function (err) { inp.value = text; showToast((err && err.message) || 'Could not save the note.', 'error'); });
}

function deleteNote(id) {
  var actor = notesActor();
  if (!actor) {
    data.notes = (data.notes || []).filter(function (n) { return String(n.id) !== String(id); }); Store.commit('notes');
    notesData = notesData.filter(function (n) { return String(n.id) !== String(id); });
    renderNotesPanel(); updateNotesCount(); return;
  }
  postJSON(API_BASE + '/notes/delete', { actor_id: actor, id: id },
    function () { notesData = notesData.filter(function (n) { return String(n.id) !== String(id); }); renderNotesPanel(); updateNotesCount(); },
    function (err) { showToast((err && err.message) || 'Could not delete the note.', 'error'); });
}
