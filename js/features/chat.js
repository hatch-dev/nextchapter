/* ─────────────────────────────────────────────────────────────
   chat.js — Team Chat (real-time, MySQL-backed + WebSocket relay)
   ─────────────────────────────────────────────────────────────
   Extracted from app.js (plain global script, loaded before app.js).
   Relies on app.js globals: gchatOpen, gchatUnreadCount, $, esc,
   API_BASE, chatIdentity/actor helpers, Store, and related UI state.
   The WebSocket relay is tools/chat-server.js (node); it admits a socket only
   with a ticket from GET api/chat/ticket and relays only a "something new" signal.
   ───────────────────────────────────────────────────────────── */

// === GROUP CHAT ===
var gchatOpen = false;
var gchatUnreadCount = 0;
/* ── Sweep 4R item 5 (addendum 5 Oct 2026): the unread badge COUNTS ─────────────────────────────────
   Colleagues' messages newer than the last one this session saw; one's own never count (the server records each
   message's author as the sender's session, user_public_id). Opening the panel sees them all; the seal (chatShutdown)
   starts over at zero. It used to add 1 per batch of new messages, counted one's own, and only began listening once
   the panel had been opened. */
var gchatSeenId = null;   /* the newest message id this session has seen; null until the room is first read */
var chatWatching = false;
function gchatMine(m) { var a = ''; try { a = actorId(); } catch (e) { } return !!(m && m.user_public_id && a && m.user_public_id === a); }
function gchatRecount() {
  if (gchatSeenId == null || gchatOpen) { gchatSeenId = chatLastId; gchatUnreadCount = 0; }
  else { var n = 0; chatMessages.forEach(function (m) { if (m && m.id > gchatSeenId && !gchatMine(m)) n++; }); gchatUnreadCount = n; }
  var u = document.getElementById('gchatUnread'); if (u) { u.style.display = gchatUnreadCount > 0 ? '' : 'none'; u.textContent = String(gchatUnreadCount); }
}
/* Listen from sign-in, not from the first open: read the room once (that is what has been seen), then the relay and the
   poll bring what is new. Never in the sample tab, which makes no request to any server. */
function chatWatch() {
  if (chatWatching || window.SAMPLE_MODE) return;
  var id = chatIdentity(); if (!id.org || !id.actor) return;
  chatWatching = true;
  chatLoadHistory(function () { gchatRecount(); chatConnect(); chatStartPolling(); });
}

/* ── Real-time team chat (MySQL-backed + WebSocket) ─────────────────────
   Messages persist via the PHP API (POST/GET /messages) and are delivered
   live over the WebSocket relay (chat-server.js). If the relay isn't running,
   a 4s poll keeps the thread up to date — so chat always works. */
/* wss:// on an https:// page: browsers refuse a plain ws:// socket from a secure page. The relay itself
   speaks plain WebSocket, so on HTTPS put TLS in front of port 8090 (see docs on deployment). */
var CHAT_WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + (location.hostname || 'localhost') + ':8090';
var chatMessages = [];      // messages for the active org, oldest first
var chatLastId = 0;         // highest message id seen
var chatSocket = null;      // live WebSocket (null when not connected)
var chatPollTimer = null;   // fallback poll timer
var chatOrgSid = null;      // org public_id this chat is bound to

function chatIdentity() {
  var u = getCurrentUser() || {};
  return { org: orgServerId(), actor: actorId(), name: u.name || 'You', initials: u.initials || (orgInitials(u.name || 'You') || '?'), color: u.color || '#4866A0' };
}
/* Parse a message timestamp into a Date, or null if it can't be read (so
   callers fall back instead of printing "Invalid Date").

   The API sends MySQL datetimes ("2026-07-17 16:44:00"), whose space has to
   become a "T" before Date will take it. A Date is passed straight back: it is
   already parsed, and stringifying it would put that same replace() through
   "Fri Jul 17 2026 …" and produce garbage. */
function chatDate(s) {
  try {
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    var d = s ? new Date(('' + s).replace(' ', 'T')) : new Date();
    return isNaN(d.getTime()) ? null : d;
  } catch (e) { return null; }
}
function chatFmtTime(s) {
  var d = chatDate(s); if (!d) return '';
  return (d.getHours() % 12 || 12) + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + ' ' + (d.getHours() >= 12 ? 'PM' : 'AM');
}

/* Which calendar day a message belongs to, as a comparable key. Built from the
   local Y/M/D rather than the raw string so two messages either side of
   midnight land in different groups. */
function chatDayKey(s) {
  var d = chatDate(s); if (!d) return '';
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

/* The day divider's label. Always carries the full date — "Today"/"Yesterday"
   alone tell you nothing a week later — with the relative word or the weekday
   in front of it for quick scanning:
     TODAY · JUL 17, 2026   ·   YESTERDAY · JUL 16, 2026   ·   TUESDAY · JUL 15, 2026 */
function chatDayLabel(s) {
  var d = chatDate(s); if (!d) return '';
  var today = new Date();
  var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  var lead;
  if (chatDayKey(s) === chatDayKey(today)) lead = 'Today';
  else if (chatDayKey(s) === chatDayKey(yesterday)) lead = 'Yesterday';
  else lead = d.toLocaleDateString('en-US', { weekday: 'long' });

  return lead + ' · ' + fmtDate(d); // fmtDate (app.js) → "Jul 17, 2026"
}

/* The full date + time, for the hover tooltip on a message's meta line. */
function chatFmtFull(s) {
  var d = chatDate(s); if (!d) return '';
  return fmtDate(d) + ' at ' + chatFmtTime(s);
}
/* Merge incoming messages (dedupe by id), track chatLastId; returns count added. */
function chatIngest(list) {
  var added = 0;
  (list || []).forEach(function (m) {
    if (!m || m.id == null) return;
    if (chatMessages.some(function (x) { return x.id === m.id; })) return;
    chatMessages.push(m); if (m.id > chatLastId) chatLastId = m.id; added++;
  });
  if (added) chatMessages.sort(function (a, b) { return a.id - b.id; });
  return added;
}
/* Which room. Chat is one conversation per (organization, program) — it used to
   be one per organization, so a message sent while the team was working in
   Executive Readiness turned up in the Pipeline, out of context and in front of
   people who may not even have that program. Same module answer the workspace
   and the notes panel use. */
function chatModule() {
  try { return Store.moduleId(currentOrgId); } catch (e) { return (window.Modules && Modules.activeId()) || 'pipeline'; }
}
/* The query half of "which room, asked by whom" — the history endpoint requires
   a member now, exactly as posting always did. */
function chatScopeQuery() {
  var id = chatIdentity();
  return '&module=' + encodeURIComponent(chatModule())
    + (id.actor ? '&actor=' + encodeURIComponent(id.actor) : '');
}

function chatLoadHistory(cb) {
  var id = chatIdentity(); if (!id.org) { if (cb) cb(false); return; }
  fetch(API_BASE + '/messages?org=' + encodeURIComponent(id.org) + chatScopeQuery())
    .then(function (r) { return r.json(); })
    .then(function (res) { if (res && res.success && res.data) { chatMessages = []; chatLastId = 0; chatIngest(res.data.messages); } if (cb) cb(true); })
    .catch(function () { if (cb) cb(false); });
}
function chatConnect() {
  var id = chatIdentity(); if (!id.org) return;
  /* The relay rooms purely on the `org` parameter it is handed, so the room key
     carries the program too. Without it the live fan-out would deliver a
     Decision Lab message straight into a Pipeline window — the isolation the
     database now has, undone by the socket that bypasses it. */
  var room = id.org + '::' + chatModule();
  if (chatSocket && chatOrgSid === room && (chatSocket.readyState === 0 || chatSocket.readyState === 1)) return;
  if (chatTicketPending === room) return;
  try { if (chatSocket) chatSocket.close(); } catch (e) { }
  chatSocket = null;
  chatOrgSid = room;
  /* Admission (Directive 2 Oct 2026, Part 6.1.4): the relay needs a 60-second
     ticket the API signs only for a member of this organization with this
     program (MessageController::ticket). No ticket — signed out, no access, or
     no relay configured — means no live socket; the 4-second poll carries on. */
  chatTicketPending = room;
  fetch(API_BASE + '/chat/ticket?org=' + encodeURIComponent(id.org) + chatScopeQuery(), { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (chatTicketPending === room) chatTicketPending = null;
      var t = res && res.success && res.data && res.data.ticket;
      if (!t || chatOrgSid !== room) return;   /* refused, or the room changed while asking */
      try {
        var ws = new WebSocket(CHAT_WS_URL + '/?ticket=' + encodeURIComponent(t));
        chatSocket = ws;
        /* The relay sends only "there is something new" — never a message
           itself — so what is shown always comes from the API, whose author is
           the sender's session, not whatever a socket claimed. */
        ws.onmessage = function () { chatFetchNew(); };
        ws.onclose = function () { if (chatSocket === ws) chatSocket = null; };
        ws.onerror = function () { try { ws.close(); } catch (e) { } };
      } catch (e) { chatSocket = null; }
    })
    .catch(function () { if (chatTicketPending === room) chatTicketPending = null; });
}
var chatTicketPending = null;   // the room a ticket is being fetched for
/* Read anything newer than what is shown (the relay's signal, and the poll). */
function chatFetchNew() {
  var id = chatIdentity(); if (!id.org) return;
  fetch(API_BASE + '/messages?org=' + encodeURIComponent(id.org) + chatScopeQuery() + '&since=' + chatLastId)
    .then(function (r) { return r.json(); })
    .then(function (res) { if (res && res.success && res.data && chatIngest(res.data.messages)) chatOnNew(); })
    .catch(function () { });
}
function chatStartPolling() {
  if (chatPollTimer) return;
  chatPollTimer = setInterval(chatFetchNew, 4000);
}
function chatOnNew() {
  if (gchatOpen) { renderGChatPanel(); gchatSeenId = chatLastId; }
  else gchatRecount();   /* Sweep 4R item 5: colleagues' messages since last seen, not +1 per batch */
}
function chatShutdown() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
  try { if (chatSocket) chatSocket.close(); } catch (e) { }
  chatSocket = null; chatMessages = []; chatLastId = 0; chatOrgSid = null; chatTicketPending = null; gchatUnreadCount = 0;
  gchatSeenId = null; chatWatching = false;   /* Sweep 4R item 5: the next session starts at zero */
}

function gchatMembers() { return (data.roster || []).map(function (u, ix) { return { initials: u.initials, name: u.name, color: u.color, online: ix < 5 } }) }

function gchatTxt(bg) { var h = bg.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c }).join(''); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#1A1612' : '#fff' }
function gchatColor(who) { if (who === 'F') return '#B8892A'; var u = (data.roster || []).filter(function (x) { return x.initials === who })[0]; return u ? u.color : 'rgba(var(--faint-rgb),.7)' }

// Anchor the top-right slide-out panels just below the nav, which may be
// one or two rows tall depending on width — so they never overlap it.
function anchorBelowNav() {
  var nav = document.querySelector('nav');
  var h = nav ? nav.getBoundingClientRect().height : 60;
  return (Math.round(h) + 10) + 'px';
}

function toggleGChat() {
  if (window.SAMPLE_MODE && !gchatOpen) return;   /* Part 3: Team Chat is off in the sample tab */
  gchatOpen = !gchatOpen;
  var fab = document.getElementById('gchatFab');
  var navBtn = document.getElementById('gchatNavBtn');
  var panel = document.getElementById('gchatPanel');
  if (fab) fab.className = 'gchat-fab' + (gchatOpen ? ' open' : '');
  if (navBtn) navBtn.classList.toggle('nav-action-on', gchatOpen);
  if (panel) {
    panel.className = 'gchat-panel' + (gchatOpen ? ' open' : '');
    if (gchatOpen) panel.style.top = anchorBelowNav();
  }
  if (gchatOpen) {
    gchatUnreadCount = 0;
    var u = document.getElementById('gchatUnread');
    if (u) { u.style.display = 'none'; u.textContent = '0'; }
    chatConnect(); chatStartPolling();
    renderGChatPanel();                                  // show what we already have
    gchatSeenId = chatLastId;   /* Sweep 4R item 5: opening sees everything */
    chatLoadHistory(function () { renderGChatPanel(); if (gchatOpen) gchatSeenId = chatLastId; }); // then refresh from the DB
  }
}

function renderGChatPanel() {
  var panel = document.getElementById('gchatPanel');
  if (!panel) return;
  var _gm = gchatMembers();
  var avHtml = '';
  for (var i = 0; i < _gm.length; i++) {
    avHtml += '<div class="gchat-av" style="background:' + _gm[i].color + ';color:' + gchatTxt(_gm[i].color) + '">' + _gm[i].initials + '</div>';
  }
  var memHtml = '';
  for (var i = 0; i < _gm.length; i++) {
    var m = _gm[i];
    memHtml += '<div class="gchat-member"><div class="gchat-member-av" style="background:' + m.color + ';color:' + gchatTxt(m.color) + '">' + m.initials + '</div>' + m.name + (m.online ? '<div class="gchat-online"></div>' : '') + '</div>';
  }
  var me = chatIdentity();
  var h = '<div class="gchat-header"><div class="gchat-header-title"><div class="gchat-avatars">' + avHtml + '</div> Team Room</div><button class="gchat-close" onclick="toggleGChat()">×</button></div>';
  h += '<div class="gchat-members">' + memHtml + '</div>';
  h += '<div class="gchat-msgs" id="gchatMsgsEl">';
  if (!me.org) { h += '<div class="notes-empty">Team chat needs the organization synced to the server. Sign in again to enable it.</div>'; }
  else if (!chatMessages.length) { h += '<div class="notes-empty">No messages yet – the team thread starts here.</div>'; }
  else {
    // A divider each time the day changes, so a time on its own is never
    // ambiguous: without it "3:22 PM" under "4:52 PM" reads as mis-sorted when
    // it is simply the next day.
    var lastDay = null;
    for (var i = 0; i < chatMessages.length; i++) {
      var msg = chatMessages[i];
      var day = chatDayKey(msg.created_at);
      if (day !== lastDay) {
        h += '<div class="gchat-day-div">' + esc(chatDayLabel(msg.created_at)) + '</div>';
        lastDay = day;
      }
      var isMe = !!(msg.user_public_id && me.actor && msg.user_public_id === me.actor);
      var col = msg.color || '#4866A0';
      var ini = msg.initials || (orgInitials(msg.user_name || '') || '?');
      h += '<div class="gchat-msg ' + (isMe ? 'me' : 'them') + '">';
      h += '<div class="gchat-msg-av" style="background:' + col + ';color:' + gchatTxt(col) + '">' + esc(ini) + '</div>';
      h += '<div class="gchat-msg-body">';
      h += '<div class="gchat-msg-meta" title="' + esc(chatFmtFull(msg.created_at)) + '">'
        + esc(isMe ? 'You' : (msg.user_name || 'Member')) + ' · ' + chatFmtTime(msg.created_at) + '</div>';
      h += '<div class="gchat-msg-text">' + esc(msg.body) + '</div>';
      h += '</div></div>';
    }
  }
  h += '</div>';
  h += '<div class="gchat-typing" id="gchatTyping"></div>';
  var dis = me.org ? '' : ' disabled';
  h += '<div class="gchat-input-row"><textarea id="gchatInput" placeholder="Message the team..."' + dis + ' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendGChat()}"></textarea><button class="gchat-send" onclick="sendGChat()"' + dis + '>→</button></div>';
  panel.innerHTML = h;
  var msgs = document.getElementById('gchatMsgsEl');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function sendGChat() {
  var inp = document.getElementById('gchatInput');
  if (!inp || !inp.value.trim()) return;
  var me = chatIdentity();
  if (!me.org || !me.actor) return;
  var text = inp.value.trim(); inp.value = '';
  postJSON(API_BASE + '/messages', { org: me.org, actor_id: me.actor, body: text, module: chatModule() },
    function (res) {
      var saved = res && res.data && res.data.message;
      if (saved) {
        if (chatIngest([saved])) renderGChatPanel();
        // Fan out live to the other members in this org room.
        try { if (chatSocket && chatSocket.readyState === 1) chatSocket.send('new');   /* the signal only: receivers read the message from the API */ } catch (e) { }
      }
    },
    function (err) {
      inp.value = text; // don't lose the message
      var typing = document.getElementById('gchatTyping');
      if (typing) typing.textContent = (err && err.message) || 'Could not send — is the server running?';
    });
}
