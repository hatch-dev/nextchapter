/* ═══════════════════════════════════════════════════════════════
   DEV-ONLY STAND-IN FOR THE SIGN-IN SERVER — NEVER DEPLOY THIS FILE
   ═══════════════════════════════════════════════════════════════
   Directive 2 Oct 2026, Parts 5 and 6. The app (app.js) checks no password and keeps none: every sign-in,
   password change and temporary password is a request to AUTH_ENDPOINT (Part 6.2). The real server is
   Param's (Part 6: Argon2id, HttpOnly cookies, HTTPS). Until it exists, this file answers those requests
   inside the browser so the dev build can be used and tested. It plays the server's part only:

   - Password hashes: PBKDF2-SHA256, 600,000 iterations, a random salt each (the browser has no Argon2id).
   - Kept apart from the organization data (key devauth::credentials); the org data never holds a password.
   - The rule (5.1), applied again here whatever the browser has checked; 5 wrong passwords in 15 minutes
     lock the username for 15 minutes; temporary passwords are mustChange; a stored password that breaks
     the rule is accepted only with mustChange; unique usernames across the login database.
   - Sessions: without Remember me, for this browser session and 8 hours unused; with it, 30 days.
     Sign-out ends it; a password change ends the person's other sessions.
   - The app administrator's account exists from "installation": admin / NextChapter2026!, mustChange.
   - Sign-ins of deleted organizations and of removed members are dropped (Parts 4 and 6.1.11).
   - Sign-in events are logged with time and username, never a request body (devauth::log).

   Like the real server, it reads the organization data it holds (here: this browser's org store) to
   find a username. Requests it answers that 6.2 does not list (for Param to add or rule out):
     POST /setup           {code, orgId, userId, username, password, remember} -> {ok, orgId, userId, mustChange}
                           refusals 'bad-code' | 'taken' | 'weak' | 'common'           (5.9, 5.11, 6.1.12)
     POST /admin/username  {username} -> {ok} | 'taken'                                  (5.12.3)
     GET  /session         answers {ok:true, admin:true, mustChange} for an administrator session
   Load order: index.html loads this file before app.js. Deployment: remove the <script> tag and set
   AUTH_ENDPOINT in app.js to the server's address.
   ═══════════════════════════════════════════════════════════════ */
(function(g){
  var BASE = '/__dev-auth';
  g.DEV_AUTH_ENDPOINT = BASE;

  var ITERATIONS = 600000, LOCK_LIMIT = 5, LOCK_MINUTES = 15, IDLE_HOURS = 8, REMEMBER_DAYS = 30;
  var SETUP_CODE = 'ABCXYZ';
  var DEFAULT_ADMIN = {username: 'admin', password: 'NextChapter2026!'};
  var K = {cred: 'devauth::credentials', admin: 'devauth::admin', attempts: 'devauth::attempts', sessions: 'devauth::sessions', sid: 'devauth::sid', log: 'devauth::log'};

  /* -- the rule (5.1), the same code as the app's: the server applies it again -- */
  var COMMON = ['password1!','password123!','p@ssw0rd','p@ssword1','pa$$w0rd','pa$$word1','passw0rd!','welcome1!','welcome123!','admin123!','admin@123','qwerty123!','qwerty1!','abc123!@#','changeme1!','letmein1!','iloveyou1!','monkey123!','dragon123!','football1!','baseball1!','sunshine1!','princess1!','test123!','user123!','hello123!','secret123!','company1!','1q2w3e4r!','1qaz2wsx!','zaq1@wsx','!qaz2wsx','summer2025!','winter2025!','summer2026!','winter2026!','spring2026!','autumn2026!','fall2026!','nextchapter1!','nextchapter2026!'];
  function ruleBreak(pw){
    pw = String(pw == null ? '' : pw);
    var n = Array.from(pw).length;
    if (n < 8 || n > 128 || !/[0-9]/.test(pw) || !/[^\p{L}\p{N}\s]/u.test(pw)) return 'weak';
    if (COMMON.indexOf(pw.toLowerCase()) >= 0) return 'common';
    return '';
  }

  /* -- storage: the server's own tables (localStorage), the browser's cookie (session/local storage) -- */
  function ls(){ try{ return g.localStorage; }catch(e){ return null; } }
  function ss(){ try{ return g.sessionStorage; }catch(e){ return null; } }
  function read(k, f){ try{ var v = ls().getItem(k); return v == null ? f : JSON.parse(v); }catch(e){ return f; } }
  function write(k, v){ try{ ls().setItem(k, JSON.stringify(v)); }catch(e){} }
  function now(){ return Date.now(); }
  function norm(u){ return String(u == null ? '' : u).replace(/\s+/g, '').toLowerCase(); }   /* Sweep 4R item 1 (5 Oct 2026): usernames compare ignoring capitals and every space */
  function log(event, username){ var l = read(K.log, []); l.push({at: new Date(now()).toISOString(), event: event, username: norm(username)}); if (l.length > 200) l = l.slice(-200); write(K.log, l); }

  /* -- the organization data the server holds: here, this browser's org store -- */
  function orgs(){ return read('pipeline-orgs', []); }
  function roster(orgId){ var d = read('pipeline-org-data::' + orgId, null); return (d && Array.isArray(d.roster)) ? d.roster : []; }
  function member(orgId, userId){ return roster(orgId).filter(function(u){ return u && u.id === userId; })[0] || null; }
  function findMembers(username){
    var u = norm(username), out = [];
    if (!u) return out;
    orgs().forEach(function(o){ roster(o.id).forEach(function(m){ if (m && norm(m.username) === u) out.push({orgId: o.id, userId: m.id, member: m}); }); });
    return out;
  }
  function usernameInUse(username, exceptOrgId, exceptUserId){
    var u = norm(username);
    if (!u) return false;
    if (norm(adminRec().username) === u) return true;
    return findMembers(u).some(function(x){ return !(x.orgId === exceptOrgId && x.userId === exceptUserId); });
  }

  /* -- credentials: drop those whose organization or member is gone (Parts 4 and 6.1.11) -- */
  function creds(){
    var c = read(K.cred, {}), live = {}, changed = false, ids = {};
    orgs().forEach(function(o){ ids[o.id] = true; });
    Object.keys(c).forEach(function(k){ var r = c[k]; if (ids[r.orgId] && member(r.orgId, r.userId)) live[k] = r; else changed = true; });
    if (changed) write(K.cred, live);
    return live;
  }
  function credKey(orgId, userId){ return orgId + '/' + userId; }
  function adminRec(){ return read(K.admin, null) || {username: DEFAULT_ADMIN.username, hash: null, mustChange: true}; }

  /* -- hashing -- */
  function b64(buf){ var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return g.btoa ? g.btoa(s) : Buffer.from(a).toString('base64'); }
  function unb64(str){ if (g.atob){ var s = g.atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; } return new Uint8Array(Buffer.from(str, 'base64')); }
  function derive(pw, salt, iter){
    var subtle = g.crypto.subtle;
    return subtle.importKey('raw', new g.TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits'])
      .then(function(key){ return subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter}, key, 256); })
      .then(b64);
  }
  function hash(pw){ var salt = g.crypto.getRandomValues(new Uint8Array(16)); return derive(pw, salt, ITERATIONS).then(function(h){ return {alg: 'pbkdf2-sha256', iter: ITERATIONS, salt: b64(salt), hash: h}; }); }
  function verify(pw, rec){ if (!rec || !rec.hash) return Promise.resolve(false); return derive(pw, unb64(rec.salt), rec.iter).then(function(h){ return h === rec.hash; }); }
  function ensureAdmin(){ /* installation: the default account, marked mustChange (5.12, 6.1.10) */
    var a = read(K.admin, null);
    if (a && a.hash) return Promise.resolve(a);
    return hash(DEFAULT_ADMIN.password).then(function(h){ var r = {username: DEFAULT_ADMIN.username, alg: h.alg, iter: h.iter, salt: h.salt, hash: h.hash, mustChange: true}; write(K.admin, r); return r; });
  }

  /* -- failed attempts (6.1.7) -- */
  function attemptsFor(username){ var a = read(K.attempts, {}), cut = now() - LOCK_MINUTES * 60000; return (a[norm(username)] || []).filter(function(t){ return t > cut; }); }
  function locked(username){ var t = attemptsFor(username); return t.length >= LOCK_LIMIT ? Math.max(1, Math.ceil((t[LOCK_LIMIT - 1] + LOCK_MINUTES * 60000 - now()) / 60000)) : 0; }
  function failed(username){ var a = read(K.attempts, {}); var t = attemptsFor(username); t.push(now()); a[norm(username)] = t; write(K.attempts, a); return t.length >= LOCK_LIMIT; }
  function cleared(username){ var a = read(K.attempts, {}); delete a[norm(username)]; write(K.attempts, a); }

  /* -- sessions (6.1.3): the server's table + this browser's cookie -- */
  function cookieStore(remember){ return remember ? ls() : ss(); }
  function newSession(rec){
    var sid = b64(g.crypto.getRandomValues(new Uint8Array(18))).replace(/[^A-Za-z0-9]/g, '');
    rec.at = now(); rec.last = now(); rec.exp = rec.remember ? now() + REMEMBER_DAYS * 86400000 : 0;
    var t = read(K.sessions, {}); t[sid] = rec; write(K.sessions, t);
    try{ (ss() || {}).removeItem && ss().removeItem(K.sid); ls().removeItem(K.sid); }catch(e){}
    try{ cookieStore(rec.remember).setItem(K.sid, sid); }catch(e){}
    return sid;
  }
  function currentSid(){ var s = null; try{ s = (ss() && ss().getItem(K.sid)) || ls().getItem(K.sid); }catch(e){} return s; }
  function session(){
    var sid = currentSid(); if (!sid) return null;
    var t = read(K.sessions, {}), r = t[sid];
    if (!r) return null;
    var dead = r.remember ? now() > r.exp : now() - r.last > IDLE_HOURS * 3600000;
    if (!dead && r.kind === 'member' && !creds()[credKey(r.orgId, r.userId)]) dead = true;
    if (dead){ delete t[sid]; write(K.sessions, t); return null; }
    r.last = now(); t[sid] = r; write(K.sessions, t);
    r.sid = sid; return r;
  }
  function endSession(){ var sid = currentSid(); var t = read(K.sessions, {}); if (sid) delete t[sid]; write(K.sessions, t); try{ ss() && ss().removeItem(K.sid); ls().removeItem(K.sid); }catch(e){} }
  function endOtherSessions(match, keepSid){ var t = read(K.sessions, {}); Object.keys(t).forEach(function(s){ if (s !== keepSid && match(t[s])) delete t[s]; }); write(K.sessions, t); }
  function sessionIsOrgAdmin(s, orgId){ if (!s) return false; if (s.kind === 'admin') return true; if (s.orgId !== orgId) return false; var m = member(s.orgId, s.userId); return !!(m && m.admin === true); }

  /* -- the requests (6.2) -- */
  var routes = {
    'POST /session': function(b){
      var u = b.username, pw = b.password;
      var lm = locked(u); if (lm) return {ok: false, reason: 'locked', retryAfterMinutes: lm};
      var found = findMembers(u);
      if (found.length !== 1){ log('sign-in refused', u); return failed(u) ? {ok: false, reason: 'locked', retryAfterMinutes: LOCK_MINUTES} : {ok: false, reason: 'no-user'}; }
      var f = found[0], rec = creds()[credKey(f.orgId, f.userId)];
      if (!rec){ log('sign-in refused: no credential', u); return {ok: false, reason: 'no-credential'}; }
      return verify(pw, rec).then(function(good){
        if (!good){ log('sign-in refused', u); return failed(u) ? {ok: false, reason: 'locked', retryAfterMinutes: LOCK_MINUTES} : {ok: false, reason: 'bad-password'}; }
        cleared(u);
        var must = !!rec.mustChange || ruleBreak(pw) !== '';   /* 6.1.15 */
        newSession({kind: 'member', orgId: f.orgId, userId: f.userId, remember: !!b.remember});
        log('sign-in', u);
        return {ok: true, orgId: f.orgId, userId: f.userId, mustChange: must};
      });
    },
    'GET /session': function(){
      var s = session(); if (!s) return {ok: false};
      if (s.kind === 'admin'){ var a = adminRec(); return {ok: true, admin: true, mustChange: !!a.mustChange}; }
      var rec = creds()[credKey(s.orgId, s.userId)];
      return {ok: true, orgId: s.orgId, userId: s.userId, mustChange: !!(rec && rec.mustChange)};
    },
    'POST /admin-session': function(b){
      var u = b.username;
      return ensureAdmin().then(function(a){
        var lm = locked(u); if (lm) return {ok: false, reason: 'locked', retryAfterMinutes: lm};
        if (norm(u) !== norm(a.username)){ log('admin sign-in refused', u); return failed(u) ? {ok: false, reason: 'locked', retryAfterMinutes: LOCK_MINUTES} : {ok: false, reason: 'bad-password'}; }
        return verify(b.password, a).then(function(good){
          if (!good){ log('admin sign-in refused', u); return failed(u) ? {ok: false, reason: 'locked', retryAfterMinutes: LOCK_MINUTES} : {ok: false, reason: 'bad-password'}; }
          cleared(u);
          var must = !!a.mustChange || ruleBreak(b.password) !== '';
          newSession({kind: 'admin', remember: false});
          log('admin sign-in', u);
          return {ok: true, mustChange: must};
        });
      });
    },
    'POST /password': function(b){
      var s = session(); if (!s || s.kind !== 'member') return {ok: false, reason: 'no-session'};
      var k = credKey(s.orgId, s.userId), all = creds(), rec = all[k];
      return verify(b.current, rec).then(function(good){
        if (!good) return {ok: false, reason: 'bad-current'};
        if (b.next === b.current) return {ok: false, reason: 'same'};
        var rb = ruleBreak(b.next); if (rb) return {ok: false, reason: rb};
        return hash(b.next).then(function(h){
          all = creds(); all[k] = Object.assign({}, all[k], h, {mustChange: false, changedAt: now()}); write(K.cred, all);
          endOtherSessions(function(r){ return r.kind === 'member' && r.orgId === s.orgId && r.userId === s.userId; }, s.sid);
          log('password changed', (member(s.orgId, s.userId) || {}).username);
          return {ok: true};
        });
      });
    },
    'POST /admin/password': function(b){
      var s = session(); if (!s || s.kind !== 'admin') return {ok: false, reason: 'not-admin'};
      return ensureAdmin().then(function(a){
        return verify(b.current, a).then(function(good){
          if (!good) return {ok: false, reason: 'bad-current'};
          if (b.next === b.current) return {ok: false, reason: 'same'};
          var rb = ruleBreak(b.next); if (rb) return {ok: false, reason: rb};
          return hash(b.next).then(function(h){
            write(K.admin, Object.assign({}, adminRec(), h, {mustChange: false}));
            endOtherSessions(function(r){ return r.kind === 'admin'; }, s.sid);
            log('admin password changed', a.username);
            return {ok: true};
          });
        });
      });
    },
    'POST /admin/temporary-password': function(b){
      var s = session();
      if (!sessionIsOrgAdmin(s, b.orgId)) return {ok: false, reason: 'not-admin'};   /* 6.1.13 */
      var m = member(b.orgId, b.userId); if (!m) return {ok: false, reason: 'no-user'};
      if (usernameInUse(m.username, b.orgId, b.userId) || !norm(m.username)) return {ok: false, reason: 'taken'};   /* 6.1.14 */
      var rb = ruleBreak(b.temporary); if (rb) return {ok: false, reason: rb};
      return hash(b.temporary).then(function(h){
        var all = creds(); all[credKey(b.orgId, b.userId)] = Object.assign({orgId: b.orgId, userId: b.userId}, h, {mustChange: true, setAt: now()}); write(K.cred, all);
        endOtherSessions(function(r){ return r.kind === 'member' && r.orgId === b.orgId && r.userId === b.userId; }, null);
        log('temporary password set', m.username);
        return {ok: true};
      });
    },
    'POST /sign-out': function(){ var s = session(); endSession(); if (s) log('sign-out', s.kind === 'admin' ? adminRec().username : (member(s.orgId, s.userId) || {}).username); return {ok: true}; },
    /* not in 6.2 — see the header */
    'POST /setup': function(b){
      if (String(b.code == null ? '' : b.code).trim() !== SETUP_CODE) return {ok: false, reason: 'bad-code'};   /* 6.1.12 */
      if (!norm(b.username) || usernameInUse(b.username, null, null)) return {ok: false, reason: 'taken'};
      var rb = ruleBreak(b.password); if (rb) return {ok: false, reason: rb};
      return hash(b.password).then(function(h){
        var all = read(K.cred, {}); all[credKey(b.orgId, b.userId)] = Object.assign({orgId: b.orgId, userId: b.userId}, h, {mustChange: false, setAt: now()}); write(K.cred, all);
        newSession({kind: 'member', orgId: b.orgId, userId: b.userId, remember: !!b.remember});
        log('organization set up', b.username);
        return {ok: true, orgId: b.orgId, userId: b.userId, mustChange: false};
      });
    },
    'POST /username-check': function(b){   /* Sweep 4R item 6: is this username free for this person? Members and the app administrator */
      if (!session()) return {ok: false, reason: 'no-session'};
      return usernameInUse(b.username, b.orgId, b.userId) ? {ok: false, reason: 'taken'} : {ok: true};
    },
    'POST /admin/username': function(b){
      var s = session(); if (!s || s.kind !== 'admin') return {ok: false, reason: 'not-admin'};
      return ensureAdmin().then(function(a){
        if (!norm(b.username) || (norm(b.username) !== norm(a.username) && findMembers(b.username).length)) return {ok: false, reason: 'taken'};
        write(K.admin, Object.assign({}, adminRec(), {username: String(b.username).trim()}));
        log('admin username changed', b.username);
        return {ok: true};
      });
    }
  };

  /* -- the endpoint: fetch to BASE/... is answered here; everything else goes to the network as before -- */
  var realFetch = g.fetch;
  g.fetch = function(url, opts){
    var u = String(url), i = u.indexOf(BASE + '/');
    if (i < 0) return realFetch.apply(this, arguments);
    var path = u.slice(i + BASE.length).split('?')[0];
    var method = ((opts && opts.method) || 'GET').toUpperCase(), body = {};
    try{ if (opts && opts.body) body = JSON.parse(opts.body); }catch(e){}
    var route = routes[method + ' ' + path];
    var answer = Promise.resolve().then(function(){ creds(); /* deletions take effect at once (Parts 4, 6.1.11) */ return route ? route(body || {}) : {ok: false, reason: 'not-found'}; })
      .catch(function(){ return {ok: false, reason: 'server-error'}; });
    return answer.then(function(a){ var text = JSON.stringify(a); return {ok: true, status: 200, json: function(){ return Promise.resolve(JSON.parse(text)); }, text: function(){ return Promise.resolve(text); }}; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
