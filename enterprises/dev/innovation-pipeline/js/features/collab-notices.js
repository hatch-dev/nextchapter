/* ============================================================
   features/collab-notices.js — what multi-user editing has to SAY
   ------------------------------------------------------------
   The lock and merge machinery lives in js/app.js (Collab, Store.mergeDocs).
   It was correct and almost silent, and three of the four things reported
   against it were about what it failed to tell anybody:

     · "Locked · X is editing" was one 11px line beside the field. On a step
       the length of the Assessment Battery the field is usually off-screen,
       so a reader at the bottom of the page had no idea a section was held.
     · Overwriting a colleague's work raised a toast that said something had
       collided and then took itself away after 2.4 seconds — never which
       field, never what the other value had been, so the thing that was lost
       was lost twice.
     · The person whose saved edit got replaced was told nothing at all.

   So this file owns two surfaces, and neither of them vanishes on a timer:

     showLockBanner(holders)   a fixed strip naming every record on this page
                               that somebody else is holding. Appears wherever
                               the reader is scrolled, disappears by itself when
                               the last lock clears.
     showSyncReport(payload)   a dismissible panel listing each contested field
                               by name, with the value that was kept, the value
                               that was overwritten, and a button that puts the
                               other person's version back.

   Both are plain DOM on <body>, built the way showToast() is, so they survive a
   render() and an open modal. Nothing here decides policy — app.js decides what
   happened; this decides how to say it.
   ============================================================ */

/* ── Naming a field a person will recognise ─────────────────────────
   A conflict arrives as a document path: `.purpose.mission`, `.audit`,
   `.projects.3.objectives`, `.decisions[d1].title`. The top-level segment is
   the record, and the record names are the app's own — the ones idToRecordKey
   maps ids onto — so they are given their screen labels here. Everything below
   that is humanised from the key, which is what the field is called in the
   document and close enough to what it is called on screen. A key nobody has
   listed still reads sensibly rather than as punctuation. */
var COLLAB_RECORD_LABELS = {
  /* AI Innovation Pipeline */
  purpose: 'Purpose (1.1)', knowledge: 'AI Knowledge (1.2)', culture: 'Risk & Culture (1.3)',
  audit: 'AI Innovation Audit (1.1)', decisions: 'Decision Rights (1.1)',
  ownership: 'Ownership', incentives: 'Incentives', rhythm: 'Rhythm', governance: 'Governance',
  stress: 'Stress test', review: 'Review', capital: 'Capital plan', capAlloc: 'Capital allocation',
  budgetPlans: 'Budget plans', ideas: 'Idea cards', projects: 'Projects', assessments: 'Assessments',
  experiments: 'Experiments', tracking: 'Tracking', opsData: 'Operations', portfolio: 'Portfolio',
  raci: 'RACI', enterprise: 'Organization details', roster: 'Team', notes: 'Notes',
  reportDefs: 'Saved reports',
  completedSections: 'Section sign-off', completedSteps: 'Step sign-off',
  /* The three stage lists: which ideas were selected, which of those became
     experiments, and which of those went operational. */
  selected: 'Selected ideas', expSelected: 'Projects in development', launched: 'Operational projects',
  /* Responsible AI Governance. Taken from that program's emptyData(), so a
     collision anywhere in its document has a name a reader recognises rather
     than a camelCase key spaced out by collabHumanKey(). */
  assessmentBattery: 'Assessment Battery (1.1)', systems: 'System inventory',
  risks: 'Risk register', regimes: 'Regulatory landscape', nistCert: 'NIST alignment',
  triage: 'Triage', decisionRights: 'Decision rights', ethicalFramework: 'Ethics framework',
  raciMatrix: 'RACI matrix', reviewCadence: 'New Risk Review cadence',
  incentivesSkills: 'Incentives & skills', govRhythm: 'Governance rhythm',
  embedOps: 'Embedding operations', firstReview: 'First review', govCulture: 'Governance culture',
  stakeholder: 'Stakeholders', reviewLog: 'Review log', completed: 'Section sign-off',
  reportDefs: 'Saved reports',

  /* Executive Readiness. Same exercise against its emptyData(): every one of
     these read as a machine name before it was listed — "Values Arch",
     "Mm Activation", "Op Rhythm", "Dep Scan". */
  leaders: 'Leaders', orgChart: 'Organization chart', competencyFramework: 'Competency framework',
  depScan: 'Dependency scan', structure: 'Leadership structure', roles: 'Roles',
  collabPrinciples: 'Collaboration principles', collabLab: 'Collaboration lab',
  competencies: 'Competencies', valuesArch: 'Values architecture',
  fluencySprint: 'Fluency sprint', fluencyLog: 'Fluency log', decisionSims: 'Decision simulations',
  scenarios: 'Scenarios', mmActivation: 'Machine-mind activation', opRhythm: 'Operating rhythm',
  evaluation: 'Evaluation', evalSuccession: 'Evaluation & succession',
  slowThinking: 'Slow Thinking Log', practiceLog: 'Practice log',
  landscapeNotes: 'Landscape notes', mindsetApp: 'AI Concern Circles', composure: 'Composure',

  /* Shared bookkeeping. Named because a collision on one of these is confusing
     precisely when it is unexplained. */
  stepDoneAt: 'Step completion dates', stepDue: 'Step deadlines',
  assigns: 'Assignments', members: 'Members', orgSetup: 'Organization set-up', settings: 'AI features',
  startDate: 'Program start date'
};

function collabHumanKey(k) {
  var s = String(k == null ? '' : k);
  if (!s) return '';
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* A path into the words a reader can act on. Row ids are deliberately dropped:
   `[d1]` means nothing to anybody, and the record name plus the field name is
   what identifies the thing on screen. */
function collabPathLabel(path) {
  /* Row ids and array indexes are dropped: `[r-8fj2k]` and `3` identify the row
     to the code and nothing at all to a reader, and the record plus the field
     is what names the thing on screen. */
  var segs = String(path || '').replace(/\[[^\]]*\]/g, '').split('.')
    .filter(function (s) { return s !== '' && !/^\d+$/.test(s); });
  if (!segs.length) return 'This program';
  var head = COLLAB_RECORD_LABELS[segs[0]] || collabHumanKey(segs[0]);
  var rest = segs.slice(1).map(collabHumanKey);
  return rest.length ? head + ' › ' + rest.join(' › ') : head;
}

/* A value as one readable line. Long text is cut with an ellipsis; a record or
   a list is summarised by size, because printing a whole object into a panel
   tells the reader less than "3 rows" does. Empty is stated, not blank — "they
   cleared it" is exactly the change somebody needs to see. */
function collabValueText(v) {
  try {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v.length > 220 ? v.slice(0, 220) + '…' : v;
    if (Array.isArray(v)) return v.length + (v.length === 1 ? ' row' : ' rows');
    if (typeof v === 'object') { var n = Object.keys(v).length; return n + (n === 1 ? ' field' : ' fields'); }
    return String(v);
  } catch (e) { return '(unreadable)'; }
}

/* ══ The lock banner ══════════════════════════════════════════════
   One strip, however many records are held, naming each of them. Rebuilt from
   scratch on every call because applyLockUI() is the only caller and it always
   knows the whole current answer — there is no partial state to keep in step.
   An empty list removes it, which is how a cleared lock un-says itself. */
function showLockBanner(holders) {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    var el = document.getElementById('collabLockBanner');
    var list = (holders || []).filter(Boolean);
    if (!list.length) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }

    /* One line per holder, and the record named, so "someone is editing
       something" becomes "Ravi is editing the Risk register". */
    var byName = {};
    list.forEach(function (h) {
      var nm = h.settling ? ' settling' : (h.name || 'Someone');
      (byName[nm] = byName[nm] || []).push(collabPathLabel(String(h.key || '').split('::')[0]));
    });
    var parts = Object.keys(byName).map(function (nm) {
      var where = byName[nm].filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
      if (nm === ' settling') return 'Loading the latest ' + where + ' before you can edit it…';
      return nm + ' is editing ' + where;
    });
    var settlingOnly = Object.keys(byName).length === 1 && byName[' settling'];

    if (!el) {
      el = document.createElement('div');
      el.id = 'collabLockBanner';
      el.className = 'collab-lock-banner';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.classList.toggle('collab-lock-banner--wait', !!settlingOnly);
    el.innerHTML = '<span class="collab-lock-banner-ic" aria-hidden="true">'
      + (settlingOnly ? '↻' : '●') + '</span>'
      + '<span class="collab-lock-banner-txt"></span>';
    el.querySelector('.collab-lock-banner-txt').textContent =
      (settlingOnly ? '' : 'Locked · ') + parts.join(' · ');
  } catch (e) { }
}

/* ══ The sync report ══════════════════════════════════════════════
   Two things arrive here and they are the two halves of one event, seen from
   the two people it happened to:

     kind 'kept'      the merge could not reconcile a value and this browser's
                      version stood. Their version is in the panel, and one
                      button puts it back — which is the whole point: until
                      something showed it, "your version was kept" meant the
                      other one was gone with no way to look at it.
     kind 'replaced'  a value THIS browser had saved was changed by somebody
                      else. Our text is the thing that was lost, so the panel
                      keeps it — and only keeps it. It used to offer to put it
                      back, which was this same overwrite pointed the other way:
                      one click reverted the newer text and the other member got
                      the notice next, which is how a pair of people took turns
                      undoing each other. Half the time it could not even be
                      honoured, because the person who had just written it was
                      usually still holding the record. Reporting what was lost
                      is the job; deciding what to do about it is a
                      conversation, not a button.

   Rows accumulate rather than replace: two collisions a minute apart are two
   pieces of news, and the second must not take the first off the screen before
   it has been read. The panel closes when the reader closes it. */
var _collabReportRows = [];

function collabReportRestore(idx) {
  var row = _collabReportRows[idx];
  if (!row || row.done || !row.keys) return;
  /* A replaced row offers no button, and this refuses one anyway: a control
     that is merely not drawn is not a gate — the handler is a global and the
     row index is all it takes. Same rule as lockBlocked() and completeBlocked()
     upstairs, for the same reason. */
  if (row.kind === 'replaced') return;
  try {
    if (typeof lockBlocked === 'function' && lockBlocked(String(row.keys[0]))) return;
    if (!collabWriteAt(row.keys, row.restore)) return;
    row.done = true;
    if (typeof saveData === 'function') saveData();
    if (typeof render === 'function') render();
    renderCollabReport();
  } catch (e) { }
}

/* What the document says at this row's field, right now. The descriptor path is
   the one the diff produced — plain strings are object keys, {id:…} addresses a
   row of a record array — so this is the read half of collabWriteAt() below.
   Falls back to the value captured with the event for a path that no longer
   leads anywhere, which is the honest answer: we cannot see it any more, so the
   last thing we knew is all there is to say. */
function collabStoredNow(row) {
  try {
    if (!row || !row.keys || !row.keys.length) return row ? row.theirs : undefined;
    if (typeof data === 'undefined' || !data) return row.theirs;
    var cur = data;
    for (var i = 0; i < row.keys.length; i++) {
      if (cur == null || typeof cur !== 'object') return row.theirs;
      var k = row.keys[i];
      if (k && typeof k === 'object' && k.id != null) {
        if (!Array.isArray(cur)) return row.theirs;
        var hit = null;
        for (var j = 0; j < cur.length; j++) { if (cur[j] && String(cur[j].id) === String(k.id)) { hit = cur[j]; break; } }
        if (!hit) return row.theirs;
        cur = hit;
      } else {
        if (!Object.prototype.hasOwnProperty.call(cur, k)) return row.theirs;
        cur = cur[k];
      }
    }
    return cur;
  } catch (e) { return row ? row.theirs : undefined; }
}

/* Re-read "now stored" because the DOCUMENT moved, not because the news did.

   Every write to the workspace comes through here, local ones included — which
   is the point. Hooking only the sync left the commonest case out: the reader
   goes on typing in the very field the notice is about, the document moves
   under it, and the panel sits there quoting a value that is two keystrokes
   old. It said "now stored: 12" with 123 in the box.

   Only the value spans are rewritten, never the panel. This runs on every
   keystroke that commits, and rebuilding innerHTML at that rate would throw
   away the reader's selection in the panel and cost far more than it needs to.
   Silent when nothing is open, which is nearly always. */
function collabReportRefresh() {
  try {
    if (!_collabReportRows.length) return;
    var el = document.getElementById('collabSyncReport');
    if (!el) return;
    _collabReportRows.forEach(function (r, i) {
      if (r.kind !== 'replaced') return;
      var t = el.querySelector('.collab-report-vv[data-t="' + i + '"]');
      if (t) t.textContent = collabValueText(collabStoredNow(r));
    });
    /* The cheap half: this runs on every keystroke that commits, so the notes
       are re-read, never rebuilt. */
    refreshFieldNotes();
  } catch (e) { }
}

/* ══ The change note, under the field it happened to ══════════════
   The panel names the field — "Purpose (1.1) › Mission" — and a reader still
   has to go and find it. On a step the length of the Assessment Battery that is
   a scroll and a guess, and the panel sits in the corner where it can be read
   as being about the page rather than about one box.

   So the news is also said where it happened: one quiet line under the field,
   naming who changed it and what this reader's own version had been. It is the
   same row the panel is drawing, addressed by document path — which is the
   whole reason collisions carry `keys` — so the two can never disagree.

   Fields whose path cannot be known (idToDocPath) get nothing. A note under the
   wrong box would be worse than no note. */
function collabFieldRowFor(rows, path) {
  if (!path) return null;
  for (var i = 0; i < rows.length; i++) {
    var k = rows[i].keys || [];
    if (k.length !== path.length) continue;
    var same = true;
    for (var j = 0; j < k.length; j++) {
      if (k[j] && typeof k[j] === 'object') { same = false; break; }   // a row id: not this shape
      if (String(k[j]) !== String(path[j])) { same = false; break; }
    }
    if (same) return rows[i];
  }
  return null;
}

/* One labelled line of a field note: "Yours  1" / "Now stored  12". `lost`
   strikes it through, which is the whole message — on a replacement the value
   that went is OURS, and marking the wrong one would tell the reader the
   surviving value was the lost one. `at` tags the value so it can be re-read
   in place; only the stored line needs it, because only the stored line moves. */
function collabNoteLine(label, text, lost, at) {
  var row = document.createElement('div');
  row.className = 'collab-field-note-row' + (lost ? ' collab-field-note-row--lost' : '');
  var k = document.createElement('span');
  k.className = 'collab-field-note-k';
  k.textContent = label;
  var v = document.createElement('span');
  v.className = 'collab-field-note-v';
  if (at != null) v.setAttribute('data-nv', String(at));
  /* Members' own text: in as text, never as markup. */
  v.textContent = text;
  row.appendChild(k);
  row.appendChild(v);
  return row;
}

/* Re-read "now stored" in the notes already on the page.

   The cheap half of applyFieldNotes(), and it has to be cheap: this runs on
   every keystroke that commits. Rebuilding the note there would tear a node out
   from under the box somebody is typing in and put a new one back, on every
   character — visible, and enough to lose a selection in it. Nothing is created
   or removed here; two text nodes change. */
function refreshFieldNotes() {
  try {
    if (typeof document === 'undefined' || !_collabReportRows.length) return;
    var app = document.getElementById('app');
    if (!app) return;
    _collabReportRows.forEach(function (r, i) {
      if (r.kind !== 'replaced') return;
      var v = app.querySelector('.collab-field-note-v[data-nv="' + i + '"]');
      if (v) v.textContent = collabValueText(collabStoredNow(r));
    });
  } catch (e) { }
}

function applyFieldNotes() {
  try {
    if (typeof document === 'undefined') return;
    var app = document.getElementById('app');
    if (!app) return;

    /* Cleared first, always, so a note goes when its news does — the panel
       being dismissed, the value being put back, the reader moving on. */
    var old = app.querySelectorAll('.collab-field-note');
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }

    var rows = _collabReportRows.filter(function (r) {
      return r.kind === 'replaced' && r.keys && r.keys.length;
    });
    if (!rows.length) return;
    if (typeof idToDocPath !== 'function') return;

    var fields = app.querySelectorAll('input,select,textarea');
    for (var f = 0; f < fields.length; f++) {
      var el = fields[f];
      if (!el.id || !el.parentNode) continue;
      var row = collabFieldRowFor(rows, idToDocPath(el.id));
      if (!row) continue;

      /* The row's index, so the values can be re-read in place later without
         rebuilding the note — see refreshFieldNotes(). Stable, because a field
         colliding again REPLACES its row where it stands rather than adding
         one (showSyncReport). */
      var at = _collabReportRows.indexOf(row);

      var note = document.createElement('div');
      note.className = 'collab-field-note';
      note.setAttribute('role', 'status');
      note.setAttribute('data-note', String(at));

      var who = document.createElement('div');
      who.className = 'collab-field-note-who';
      who.textContent = (row.who ? row.who : 'Another member') + ' changed this'
        + (row.times > 1 ? ' · ' + row.times + ' times' : '');
      note.appendChild(who);

      /* Both values, said the way the panel says them, because they are the
         same two facts and a reader should not have to learn two vocabularies
         six inches apart: what YOU had, struck through because it is gone, and
         what is there NOW. Asking for one without the other only moves the
         question — "changed from what?" — down to the field. */
      note.appendChild(collabNoteLine('Yours', collabValueText(row.mine), true, null));
      note.appendChild(collabNoteLine('Now stored', collabValueText(collabStoredNow(row)), false, at));

      /* After the field, the way the character counter seats itself (nc-cc):
         next sibling, and a flex order past the counter's so it lands under
         both rather than between them. */
      el.parentNode.insertBefore(note, el.nextSibling);
    }
  } catch (e) { }
}

/* Write one value back into the live document by the same descriptor path the
   diff produced. Refuses rather than invents: a row that is no longer there, or
   a path whose parents have gone, is not a place to put anything. */
function collabWriteAt(keys, value) {
  try {
    if (typeof data === 'undefined' || !data || !keys || !keys.length) return false;
    var cur = data;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      if (k && typeof k === 'object' && k.id != null) {
        if (!Array.isArray(cur)) return false;
        var hit = null;
        for (var j = 0; j < cur.length; j++) { if (cur[j] && String(cur[j].id) === String(k.id)) { hit = cur[j]; break; } }
        if (!hit) return false;
        cur = hit;
      } else {
        if (cur[k] == null || typeof cur[k] !== 'object') return false;
        cur = cur[k];
      }
    }
    var last = keys[keys.length - 1];
    if (last && typeof last === 'object' && last.id != null) return false;   // a whole row: not a leaf restore
    cur[last] = value;
    return true;
  } catch (e) { return false; }
}

function closeCollabReport() {
  _collabReportRows = [];
  try { applyFieldNotes(); } catch (e) { }   // the notes are this panel's news too
  try {
    var el = document.getElementById('collabSyncReport');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch (e) { }
}

function renderCollabReport() {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    var el = document.getElementById('collabSyncReport');
    if (!_collabReportRows.length) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'collabSyncReport';
      el.className = 'collab-report';
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-label', 'Editing collision');
      document.body.appendChild(el);
    }
    var reps = _collabReportRows.filter(function (r) { return r.kind === 'replaced'; });
    var nRep = reps.length;
    /* Name the other person in the heading when the notice is about THEM saving
       over us and we know who they were. The row labels stay short so the value
       columns keep their width. */
    var by = '';
    var whos = reps.map(function (r) { return r.who || ''; }).filter(Boolean);
    if (whos.length && whos.every(function (n) { return n === whos[0]; })) by = ' by ' + whos[0];
    var head = nRep === _collabReportRows.length
      ? 'Your saved ' + (nRep === 1 ? 'change was' : 'changes were') + ' replaced' + by
      : (nRep ? 'Edits crossed over' : 'You overwrote someone’s work');

    var h = '<div class="collab-report-head">'
      + '<span class="collab-report-title"></span>'
      + '<button type="button" class="collab-report-x" aria-label="Dismiss" onclick="closeCollabReport()">×</button>'
      + '</div>'
      + '<div class="collab-report-rows">';
    _collabReportRows.forEach(function (r, i) {
      /* Which of the two is struck through is the whole message, and it is not
         the same line in the two cases: on a conflict the value that went is
         THEIRS, on a replacement it is OURS. Marking the second line either way
         would have told the reader the surviving value was the lost one. */
      var replaced = r.kind === 'replaced';
      var mineLbl = replaced ? 'Yours, gone' : 'Yours, kept';
      var theirsLbl = replaced ? 'Now stored' : 'Theirs, gone';
      var lost = ' collab-report-val--lost';
      h += '<div class="collab-report-row' + (r.done ? ' is-done' : '') + '">'
        + '<div class="collab-report-field"><span data-f="' + i + '"></span>'
        + '<span class="collab-report-again" data-n="' + i + '"></span></div>'
        + '<div class="collab-report-vals">'
        + '<div class="collab-report-val' + (replaced ? lost : '') + '"><span class="collab-report-vk">' + mineLbl + '</span><span class="collab-report-vv" data-m="' + i + '"></span></div>'
        + '<div class="collab-report-val' + (replaced ? '' : lost) + '"><span class="collab-report-vk">' + theirsLbl + '</span><span class="collab-report-vv" data-t="' + i + '"></span></div>'
        + '</div>'
        /* No button on a REPLACED row. It offered to put our older text back
           over the newer text that replaced it — which is the overwrite this
           whole notice exists to report, pointed the other way, and it started
           the round of it again for the other member. It could not be honoured
           half the time either: the record is usually still held by the person
           who just wrote it, so the restore was refused by lockBlocked() and
           the button did nothing but raise an alert.
           The row still says what was lost, which is what a reader needs to put
           it back themselves if they still want it.

           A KEPT row keeps its button. That is the opposite act — our version
           won a collision and this adopts the colleague's instead — and it
           takes nothing away from anybody. */
        + (r.kind !== 'replaced' && r.keys && r.keys.length && !(r.keys[r.keys.length - 1] && typeof r.keys[r.keys.length - 1] === 'object')
          ? (r.done
            ? '<div class="collab-report-done">✓ Restored</div>'
            : '<button type="button" class="collab-report-btn" onclick="collabReportRestore(' + i + ')">'
            + 'Use theirs instead</button>')
          : '')
        + '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
    /* Values are the users' own text, so they go in as text, never as markup. */
    el.querySelector('.collab-report-title').textContent = head;
    /* The same news, said where it happened. */
    applyFieldNotes();
    _collabReportRows.forEach(function (r, i) {
      var f = el.querySelector('[data-f="' + i + '"]'); if (f) f.textContent = r.label;
      /* Only from the second time. "1 time" is noise on a notice that is
         already telling you something happened once. */
      var n = el.querySelector('[data-n="' + i + '"]');
      if (n) n.textContent = (r.times > 1) ? (' · ' + r.times + ' times') : '';
      var m = el.querySelector('.collab-report-vv[data-m="' + i + '"]'); if (m) m.textContent = collabValueText(r.mine);
      /* "Now stored" is read from the document at PAINT time, not from what was
         captured when the collision fired. The panel does not close itself, and
         the document goes on moving while it sits there — somebody types
         another word, somebody else saves again — so a value frozen at the
         moment of the event started to disagree with the box six inches away
         from it. It said "now stored: 12" while the field showed three
         characters, which is the app being wrong about the one thing this
         notice exists to state. Only for a REPLACED row: on a kept row that
         line is the other person's value, which is precisely what is NOT
         stored. */
      var t = el.querySelector('.collab-report-vv[data-t="' + i + '"]');
      if (t) t.textContent = collabValueText(r.kind === 'replaced' ? collabStoredNow(r) : r.theirs);
    });
  } catch (e) { }
}

/* The one entry point app.js calls. `rows` are already normalised there —
   {kind, label, keys, mine, theirs, restore, who} — because which of the two
   sides won is a question about the merge, not about presentation. */
function showSyncReport(rows) {
  try {
    if (!rows || !rows.length) return;
    var at = {};
    _collabReportRows.forEach(function (r, i) { at[r.kind + '|' + r.label] = i; });
    rows.forEach(function (r) {
      var k = r.kind + '|' + r.label;
      if (Object.prototype.hasOwnProperty.call(at, k)) {
        /* The same field again. One line per field is still right — nobody wants
           a running log of one box — but the line has to carry the LATEST news,
           and it carried the first: every later collision on that field was
           dropped, so the panel went on reporting a value that had been
           replaced by another value that had itself been replaced several times
           since. It read as the app being wrong about what was stored, because
           it was.

           Replaced in place rather than moved to the end, so a notice does not
           jump around under somebody who is reading it, and counted, so "this
           keeps happening" is visible without keeping a log of it. */
        var prev = _collabReportRows[at[k]];
        r.times = (prev.times || 1) + 1;
        _collabReportRows[at[k]] = r;
        return;
      }
      r.times = 1;
      at[k] = _collabReportRows.length;
      _collabReportRows.push(r);
    });
    if (_collabReportRows.length > 12) _collabReportRows = _collabReportRows.slice(-12);
    renderCollabReport();
  } catch (e) { }
}
