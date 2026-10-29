var SK='pipeline-v3'; // legacy single-store key (migrated into an org on first run)
function emptyData(){return {ideas:[],selected:[],assessments:{},projects:{},completedSteps:{},completedSections:{},ownership:{},incentives:{},rhythm:{},portfolio:{},capAlloc:{},capital:{},experiments:{},expSelected:[],tracking:{},review:{},governance:{},stress:{},launched:[],opsData:{},budgetPlans:{},notes:[],raci:{},purpose:{},knowledge:{},culture:{},decisions:{},audit:[],assigns:{},roster:null,enterprise:{},members:[],orgSetup:false,settings:{aiGuide:false,voice:false}};}
var data=emptyData();

/* ============================================================
   Store - the single persistence seam (Phase 1: server-prep).
   Every durable read/write goes through this module. Backed by
   localStorage today; to move to a server, the dev team repoints
   the ADAPTER block below (raw get/set/del, the org-blob methods,
   and the discrete-op methods) at their API - call sites do not
   change.

   Local backing preserves today's behavior: readOrg/writeOrg move
   the whole org record (localStorage has no partial write). The
   discrete ops (patch / setPath / removeRec) are the server-shaped
   write vocabulary; Phase 2 reroutes the field/record write helpers
   onto them so a server can apply each as a PATCH on one record
   instead of rewriting the blob.
   ============================================================ */
var Store = (function(){
  /* -- ADAPTER: the one place to repoint to a server -- */
  function rawGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function rawSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
  function rawDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function readJSON(k,f){ var s=rawGet(k); if(s==null) return f; try{ return JSON.parse(s); }catch(e){ return f; } }
  function writeJSON(k,v){ return rawSet(k, JSON.stringify(v)); }

  /* -- keys (one source of truth) -- */
  var LEGACY_KEY='pipeline-v3', ORGS_KEY='pipeline-orgs', CURRENT_ORG_KEY='pipeline-current-org',
      REMEMBER_KEY='pipeline-remember';
  function orgKey(id){ return 'pipeline-org-data::'+id; }
  function prefKey(name){ return 'pipeline-'+name; }

  /* -- org data blob (wholesale today; the future server record) -- */
  function readOrg(id){ return readJSON(orgKey(id), null); }
  function orgRaw(id){ return rawGet(orgKey(id)); }
  /* -- revisioned writes (multi-user prep, July 8) --------------------
     Every persisted blob carries schemaVersion and a monotonic rev. The
     local store never rejects a write; the server enforces optimistic
     concurrency: PUT {baseRev, blob} → 200 {rev: baseRev+1} when its
     stored rev === baseRev, else 409 {stale:true, rev} – and on a 409
     the server adapter calls handleStaleWrite() below. revKey mirrors
     the blob's rev in a tiny record so change-polling never parses the
     whole blob (server equivalent: GET /org/{id}/rev). */
  var SCHEMA_VERSION=1;
  function revKey(id){ return 'pipeline-org-rev::'+id; }
  function orgRev(id){ var v=parseInt(rawGet(revKey(id)),10); return isNaN(v)?0:v; }
  function writeOrg(id,obj){
    if(obj && typeof obj==='object'){ obj.schemaVersion=SCHEMA_VERSION; obj.rev=(obj.rev||0)+1; }
    var okW=writeJSON(orgKey(id), obj);
    if(okW && obj) rawSet(revKey(id), String(obj.rev||0));
    return okW;
  }
  function removeOrg(id){ rawDel(orgKey(id)); rawDel(revKey(id)); }

  /* -- discrete write vocabulary (server-shaped; Phase 2 targets) --
     Local impl mutates the active replica `data`, then persists it
     whole; a server maps each call to a PATCH on one record. */
  /* dirty-record set: commit() marks which record changed, then persists.
     Locally the whole blob is rewritten (localStorage has no partial write);
     a server adapter flushes the dirty records and calls clearDirty(), so each
     write - and each lock - is scoped to a single record. Scaffolding the devs
     can build on or replace. */
  var _dirty={};
  function recKey(collection, id){ return collection + (id==null ? '' : ('::'+id)); }
  function persistActive(){ if(typeof currentOrgId!=='undefined' && currentOrgId) writeOrg(currentOrgId, data); }
  function commit(collection, id){ _dirty[recKey(collection,id)]=true; persistActive(); }
  function patch(collection, id, fields){
    if(!data[collection]) data[collection]={};
    var rec = (id==null) ? data[collection] : (data[collection][id] || (data[collection][id]={}));
    for(var k in fields){ if(Object.prototype.hasOwnProperty.call(fields,k)) rec[k]=fields[k]; }
    commit(collection, id);
  }
  function setPath(path, value){
    var parts=(''+path).split('.'), o=data, i;
    for(i=0;i<parts.length-1;i++){ if(o[parts[i]]==null || typeof o[parts[i]]!=='object') o[parts[i]]={}; o=o[parts[i]]; }
    o[parts[parts.length-1]]=value; commit(parts[0], parts.length>1 ? parts[1] : null);
  }
  function removeRec(collection, id){ if(data[collection]) delete data[collection][id]; commit(collection, id); }

  /* -- multi-user client machinery (July 8) ---------------------------
     refreshOrg(): adopt a newer stored blob for the active org without
     losing the edit in progress. The focused field's value and caret are
     captured before the re-render and restored after, so a user typing
     mid-refresh keeps typing and their value commits on blur exactly as
     it would have. Reuses loadData() so the schema-normalization
     migrations run on every adopted blob. Returns true when a newer
     blob was adopted. */
  function captureFocus(){
    try{ var a=document.activeElement;
      if(!a || !a.id || !('value' in a)) return null;
      return { id:a.id, value:a.value,
               s:(typeof a.selectionStart==='number')?a.selectionStart:null,
               e:(typeof a.selectionEnd==='number')?a.selectionEnd:null };
    }catch(e){ return null; }
  }
  function restoreFocus(f){
    try{ if(!f) return; var el=document.getElementById(f.id); if(!el) return;
      el.value=f.value; el.focus();
      if(f.s!=null && el.setSelectionRange) el.setSelectionRange(f.s, f.e==null?f.s:f.e);
    }catch(e){}
  }
  function refreshOrg(){
    if(typeof currentOrgId==='undefined' || !currentOrgId) return false;
    if(orgRev(currentOrgId) <= ((data&&data.rev)||0)) return false;
    var f=captureFocus();
    loadData(); applyTeamRoster();
    try{ render(); }catch(e){}
    restoreFocus(f);
    return true;
  }

  /* stale-write recovery: re-pull, overlay the local dirty records onto
     the fresh blob, persist, clear the dirty set. Unreachable in local
     mode (the local store never rejects a write); the server adapter
     calls it on a 409. Record-level last-writer-wins, per the blob-PUT
     ruling – optimize only if contention demands. The dirty set means
     'changed since the last successful sync': the server adapter clears
     it on every 200 (locally it is scaffolding and accumulates). */
  function mergeDirtyInto(fresh, local, dirtyKeys){
    (dirtyKeys||[]).forEach(function(k){
      var i=k.indexOf('::');
      if(i<0){ fresh[k]=local[k]; }
      else { var col=k.slice(0,i), id=k.slice(i+2);
        if(!fresh[col] || typeof fresh[col]!=='object') fresh[col]={};
        fresh[col][id]=(local[col]||{})[id]; }
    });
    return fresh;
  }
  function handleStaleWrite(id){
    var fresh=readOrg(id); if(!fresh) return false;
    mergeDirtyInto(fresh, data, Object.keys(_dirty));
    data=fresh;
    try{ ensureRaciModel(); ensureCapCostModel(); }catch(e){}
    var okW=writeOrg(id, data);
    if(okW) _dirty={};
    try{ applyTeamRoster(); render(); }catch(e){}
    return okW;
  }

  /* change signal: storage events are the local channel (another tab's
     write fires them); polling is the fallback. A server build pushes
     the same nudge over the Collab channel (its read/write adapter
     lines) and keeps this polling as the fallback. Cheap: compares the
     mirrored rev record, never the blob. Both hooks no-op in the test
     probe, where addEventListener and setInterval are stubs. */
  var CHANGE_POLL_MS=5000;
  function checkRemote(){
    try{
      if(typeof currentOrgId==='undefined' || !currentOrgId) return false;
      if(orgRev(currentOrgId) > ((data&&data.rev)||0)) return refreshOrg();
    }catch(e){}
    return false;
  }
  function startChangeSignal(){
    try{ window.addEventListener('storage', function(ev){
      try{ if(ev && currentOrgId && (ev.key===orgKey(currentOrgId) || ev.key===revKey(currentOrgId))) checkRemote(); }catch(e){}
    }); }catch(e){}
    try{ setInterval(function(){
      try{ if(typeof document!=='undefined' && document.hidden) return; }catch(e){}
      checkRemote();
    }, CHANGE_POLL_MS); }catch(e){}
  }

  /* -- boot readiness (async loader, July 8) --------------------------
     ready(cb) is the seam the boot sequence waits on. Local mode:
     localStorage needs no fetch, so cb fires synchronously in the same
     tick and boot is the shipped behavior unchanged (the harness
     depends on this). Server mode: warm an in-memory cache here – the
     org list, the current org blob and its rev, the remember record,
     the admin record – then fire cb. Every synchronous Store getter
     serves from that warm cache afterward, so no other call site
     changes. Device-local prefs (getPref/setPref: zoom, sidebar state)
     stay on localStorage in every mode and may be read at eval time. */
  function ready(cb){ cb(); }

  return {
    raw:{ get:rawGet, set:rawSet, del:rawDel },
    orgKey:orgKey,
    readOrg:readOrg, orgRaw:orgRaw, writeOrg:writeOrg, removeOrg:removeOrg,
    patch:patch, setPath:setPath, removeRec:removeRec, commit:commit, persistActive:persistActive,
    dirtyRecords:function(){ return Object.keys(_dirty); }, clearDirty:function(){ _dirty={}; },
    refreshOrg:refreshOrg, orgRev:orgRev, checkRemote:checkRemote, startChangeSignal:startChangeSignal, ready:ready,
    mergeDirtyInto:mergeDirtyInto, handleStaleWrite:handleStaleWrite,
    schemaVersion:function(){ return SCHEMA_VERSION; },
    getOrgs:function(){ return readJSON(ORGS_KEY, []); },
    setOrgs:function(list){ return writeJSON(ORGS_KEY, list); },
    getCurrentOrg:function(){ return rawGet(CURRENT_ORG_KEY); },
    setCurrentOrg:function(id){ id ? rawSet(CURRENT_ORG_KEY, id) : rawDel(CURRENT_ORG_KEY); },
    getRemember:function(){ return readJSON(REMEMBER_KEY, null); },
    setRemember:function(o){ o ? writeJSON(REMEMBER_KEY, o) : rawDel(REMEMBER_KEY); },
    getPref:function(name,f){ var v=rawGet(prefKey(name)); return v==null?f:v; },
    setPref:function(name,v){ rawSet(prefKey(name), v); },
    legacyRaw:function(){ return rawGet(LEGACY_KEY); }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   MULTI-ORG TENANCY — each organization has its own isolated data
   environment (key: pipeline-org-data::<orgId>). A registry lists
   all orgs (pipeline-orgs). currentOrgId selects the active one.
   ═══════════════════════════════════════════════════════════════ */
var ORGS_KEY='pipeline-orgs';
function getOrgs(){return Store.getOrgs();}
function saveOrgs(list){Store.setOrgs(list);}
function getOrg(id){return getOrgs().filter(function(o){return o.id===id;})[0]||null;}
var SAMPLE_LOCAL_ID = 'org_sample_local'; var SAMPLE_MODE = false; /* Part 3: the private sample organization */
var currentOrgId=null; // assigned in bootApp() – reading the store is a boot-time act (async loader, July 8)
function setCurrentOrg(id){currentOrgId=id;Store.setCurrentOrg(id);}
/* ═══════════════════════════════════════════════════════════════
   USERS & AUTH — multi-user identity system (no password, just pick
   who you are). Same model as the AI-Ready Architecture app.
   ═══════════════════════════════════════════════════════════════ */
var DEFAULT_ROSTER=[
  {id:'u1',name:'Faisal Hoque',username:'faisal',role:'Program Lead',initials:'FH',color:'#B8892A',scope:'All',admin:true},
  {id:'u2',name:'Lauren Hawker Zafer',username:'lauren',role:'Co-Host',initials:'LZ',color:'#4866A0',scope:'CONVERGENCE'},
  {id:'u3',name:'Paul Scade',username:'paul',role:'Facilitator',initials:'PS',color:'#458363',scope:'Philosophy'},
  {id:'u4',name:'Pranay Sanklecha',username:'pranay',role:'Facilitator',initials:'PrS',color:'#8158A0',scope:'Ethics'},
  {id:'u5',name:'Erik Nelson',username:'erik',role:'Facilitator',initials:'EN',color:'#8B5E3C',scope:'Operations'},
  {id:'u6',name:'Tom Davenport',username:'tom',role:'Advisor',initials:'TD',color:'#6B4C8A',scope:'Research'}
];
// USERS holds the ACTIVE org's roster; populated by applyTeamRoster() on load/switch.
var USERS=[];

/* ═══════════════════════════════════════════════════════════════
   CLAUDE API ENDPOINT
   ─────────────────────────────────────────────────────────────
   Default: direct to Anthropic. Works inside Anthropic's hosted
   environment (Claude Artifacts), which injects the API key and
   handles CORS automatically.

   For self-hosted deployment (your own server, faisalhoque.com,
   any static host), point this at your proxy that holds the API
   key server-side. See /proxy/server.js for a minimal Express
   example, or /proxy/cloudflare-worker.js for serverless.

   Example for a proxied deployment:
     var CLAUDE_API_URL = '/api/claude';
     // or
     var CLAUDE_API_URL = 'https://your-proxy.example.com/claude';
   ═══════════════════════════════════════════════════════════════ */
var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/* ── AI GUIDE: configuration (AI Guide stage 1 brief, 12 Oct 2026) ──
   The brief's '/api/guide' would reach the domain root, not this build. The Guide route is this build's
   own api/guide.php (relative, so it follows the build wherever it is served); its settings and key are
   in api/.env beside it. */
var GUIDE_ENDPOINT = 'api/guide.php';

/* Videos: served from the app's shared assets/media/ (the same files the live program plays), not copied
   beside this build. This build sits three folders down: enterprises/dev/innovation-pipeline/. */
var MEDIA_BASE = '../../../assets/media/';
var GUIDE_HISTORY_LIMIT = 10;       // earlier messages resent with each new question
var coachBusy = false;

var currentUserId = null; // session-only: entry flow runs on each cold start
var isAppAdmin = false;    // true only for the app administrator's session

/* ═══════════════════════════════════════════════════════════════
   AUTH — sign-in requests (Part 5, 2 Oct 2026)
   ═══════════════════════════════════════════════════════════════
   The browser shows the screens, checks a proposed password against the rule so people get an immediate
   answer, sends passwords to the server over HTTPS, and never keeps them. The server (Part 6) stores and
   checks them. The browser does not hash: a hash made in the browser simply becomes the thing that is sent.
   AUTH_ENDPOINT is the server's base address. The dev build sets it from dev-auth-server.js, a stand-in
   that answers the same requests inside the browser and is never deployed. */
var AUTH_ENDPOINT=(typeof window!=='undefined' && window.DEV_AUTH_ENDPOINT) || ''; // deployment: the sign-in server's address (Part 6.2)
/* -- PASSWORD RULES (1 Oct 2026): the same code in every module. The server applies the same rules again. -- */
var PASSWORD_MIN_LENGTH = 8;
var PASSWORD_MAX_LENGTH = 128;
var COMMON_PASSWORDS = ['password1!','password123!','p@ssw0rd','p@ssword1','pa$$w0rd','pa$$word1','passw0rd!','welcome1!','welcome123!','admin123!','admin@123','qwerty123!','qwerty1!','abc123!@#','changeme1!','letmein1!','iloveyou1!','monkey123!','dragon123!','football1!','baseball1!','sunshine1!','princess1!','test123!','user123!','hello123!','secret123!','company1!','1q2w3e4r!','1qaz2wsx!','zaq1@wsx','!qaz2wsx','summer2025!','winter2025!','summer2026!','winter2026!','spring2026!','autumn2026!','fall2026!','nextchapter1!','nextchapter2026!'];
function passwordLength(pw){ return Array.from(String(pw == null ? '' : pw)).length; }
function passwordProblem(pw){
  pw = String(pw == null ? '' : pw);
  var n = passwordLength(pw);
  if (n < PASSWORD_MIN_LENGTH) return 'Use at least ' + PASSWORD_MIN_LENGTH + ' characters.';
  if (n > PASSWORD_MAX_LENGTH) return 'Use no more than ' + PASSWORD_MAX_LENGTH + ' characters.';
  if (!/[0-9]/.test(pw)) return 'Include at least one number.';
  if (!/[^\p{L}\p{N}\s]/u.test(pw)) return 'Include at least one special character, such as ! or #.';
  if (COMMON_PASSWORDS.indexOf(pw.toLowerCase()) >= 0) return 'That password is too common. Choose another.';
  return '';
}
var SETUP_CODE='ABCXYZ'; /* 5.9: a placeholder until the voucher and registration system; the server checks it, never the browser alone */
/* The server's refusals in Appendix A's words (5.3). A password the server finds too common but this list does not still gets an answer. */
function authRefusal(res, pw){
  var r=res&&res.reason;
  if(r==='no-user'||r==='bad-password') return 'That username and password do not match.';
  if(r==='no-credential') return 'This person has no sign-in yet. Ask your administrator to set a password.';
  if(r==='locked') return 'Too many attempts. Try again in 15 minutes.';
  if(r==='bad-current') return 'Your current password is not correct.';
  if(r==='same') return 'Choose a password different from your current one.';
  if(r==='weak'||r==='common') return passwordProblem(pw) || 'That password is too common. Choose another.';
  if(r==='taken') return 'That username is already taken. Choose another.';
  if(r==='bad-code') return 'That setup code is not recognized.';
  return 'Could not reach the sign-in service. Try again.';
}
var Auth=(function(){
  /* One request each (Part 6.2), calling back with the server's answer; network failure answers {ok:false, reason:'network'}. */
  function req(method, path, body, cb){
    var done=false;
    function fin(r){ if(done) return; done=true; if(cb){ try{ cb(r && typeof r==='object' ? r : {ok:false, reason:'network'}); }catch(e){ try{console.error(e);}catch(_e){} } } }
    try{
      var o={method:method, headers:{'Content-Type':'application/json'}, credentials:'include'};
      if(body!==undefined) o.body=JSON.stringify(body);
      fetch(AUTH_ENDPOINT+path, o).then(function(r){ return r.json(); }).then(fin, function(){ fin(null); });
    }catch(e){ fin(null); }
  }
  function signIn(username, password, remember, cb){ req('POST','/session',{username:username, password:password, remember:!!remember}, cb); }
  function signInAdmin(username, password, cb){ req('POST','/admin-session',{username:username, password:password}, cb); }
  function currentSession(cb){ req('GET','/session',undefined, cb); }
  function changePassword(current, next, cb){ req('POST','/password',{current:current, next:next}, cb); }
  function changeAdminPassword(current, next, cb){ req('POST','/admin/password',{current:current, next:next}, cb); }
  function setTemporaryPassword(orgId, userId, temporary, cb){ req('POST','/admin/temporary-password',{orgId:orgId, userId:userId, temporary:temporary}, cb); }
  function signOut(cb){ req('POST','/sign-out',{}, cb); }
  /* Not in 6.2 (for Param): setting up an organization with the setup code (5.9) and the administrator's username (5.12.3). */
  function setupOrganization(code, orgId, userId, username, password, remember, cb){ req('POST','/setup',{code:code, orgId:orgId, userId:userId, username:username, password:password, remember:!!remember}, cb); }
  function changeAdminUsername(username, cb){ req('POST','/admin/username',{username:username}, cb); }
  function usernameFree(username, orgId, userId, cb){ req('POST','/username-check',{username:username, orgId:orgId, userId:userId}, cb); } /* Sweep 4R item 6 */

  /* -- this page's view of the session -- */
  function setSession(userId){ currentUserId=userId; }
  function setAdminSession(on){ isAppAdmin=!!on; }
  function clearSession(){ currentUserId=null; isAppAdmin=false; try{Store.setRemember(null);}catch(e){} }

  return { signIn:signIn, signInAdmin:signInAdmin, currentSession:currentSession, changePassword:changePassword,
           changeAdminPassword:changeAdminPassword, setTemporaryPassword:setTemporaryPassword, signOut:signOut,
           setupOrganization:setupOrganization, changeAdminUsername:changeAdminUsername, usernameFree:usernameFree,
           setSession:setSession, setAdminSession:setAdminSession, clearSession:clearSession };
})();

function getCurrentUser(){
  return USERS.find(function(u){return u.id===currentUserId}) || null;
}

/* ================= Collab: live-collaboration seam ==================
   Record locks (and, later, presence + a shared timer) for multi-user use.
   The local implementation simulates a server using per-org localStorage,
   so the feature works and is testable now (two tabs, two users, one org).
   The dev team repoints read()/write() to the server's realtime channel;
   it is deliberately separate from Store, whose adapter points at the
   durable database - realtime state and durable state want different backends. */
var TAB_ID = 'tab_' + Math.random().toString(36).slice(2, 10);   /* Sweep 4R item 4 (addendum 5 Oct 2026): this tab's own id; two tabs of one person, or the app administrator's Open, lock each other out like anyone else */
var Collab=(function(){
  var LOCK_TTL=15000;                       // a lock whose holder stops beating auto-releases
  function lKey(){ return 'pipeline-locks::'+currentOrgId; }
  function read(){ try{ return JSON.parse(localStorage.getItem(lKey())||'{}'); }catch(e){ return {}; } }   // Collab adapter -> server
  function write(o){ try{ localStorage.setItem(lKey(), JSON.stringify(o)); }catch(e){} }                    // Collab adapter -> server
  function me(){ return currentUserId; }
  function sid() { return (typeof TAB_ID !== 'undefined' && TAB_ID) || 'tab'; }   /* Sweep 4R item 4: a lock belongs to this tab (session), not to the person */
  function fresh(t){ return t && (Date.now()-t)<LOCK_TTL; }
  function holder(rk){ if(!rk) return null; var h=read()[rk]; return (h&&fresh(h.at))?h:null; }
  function lockedByOther(rk){ var h=holder(rk); return (h&&h.sid !== sid())?h:null; }
  function acquire(rk){
    if(SAMPLE_MODE||!currentOrgId||!me()||!rk) return true;
    var h=holder(rk); if(h&&h.sid !== sid()) return false;
    var u=getCurrentUser()||{}, L=read(); L[rk]={id:me(),sid:sid(),name:u.name||'Someone',at:Date.now()}; write(L); return true;
  }
  function release(rk){ if(SAMPLE_MODE) return; var L=read(); if(rk&&L[rk]&&L[rk].sid === sid()){ delete L[rk]; write(L); } }
  function refreshMine(){ if(SAMPLE_MODE||!currentOrgId||!me()) return; var L=read(),ch=false; for(var k in L){ if(L.hasOwnProperty(k)&&L[k].sid === sid()){ L[k].at=Date.now(); ch=true; } } if(ch) write(L); }
  function leave(){ if(SAMPLE_MODE||!currentOrgId||!me()) return; var L=read(),ch=false; for(var k in L){ if(L.hasOwnProperty(k)&&L[k].sid === sid()){ delete L[k]; ch=true; } } if(ch) write(L); }
  function othersLocks(){ var L=read(),out=[]; for(var k in L){ if(L.hasOwnProperty(k)&&fresh(L[k].at)&&L[k].sid !== sid()) out.push({key:k,name:L[k].name}); } return out; }
  return { acquire:acquire, release:release, holder:holder, lockedByOther:lockedByOther,
           refreshMine:refreshMine, leave:leave, othersLocks:othersLocks, LOCK_TTL:LOCK_TTL };
})();

/* Map an input id to the record it edits - mirrors the commit() records in fldSave/savers. */
function idToRecordKey(id){
  if(!id) return null;
  var i=id.indexOf('_'); if(i<0) return null;
  var pre=id.slice(0,i), rest=id.slice(i+1);
  if(pre==='ic') return null;                 // idea-card drafts: UI state, not a shared record
  var singles={p:'purpose',k:'knowledge',ow:'ownership',inc:'incentives',rh:'rhythm',cap:'capital',gov:'governance',str:'stress',rev:'review'};
  if(singles[pre]) return singles[pre];
  if(pre==='tune') return 'stress';
  if(pre==='lead') return 'ownership';
  if(pre==='senior') return 'ownership';
  if(pre==='au')   return 'audit';
  if(pre==='rhAtt')return 'rhythm';
  if(pre==='raci') return 'raci::'+rest;
  if(pre==='pjr') return 'projects::'+rest;
  if(pre==='pj'||pre==='rs') return (UI.ap!=null)?('projects::'+UI.ap):null;
  var coll={score:'assessments',exp:'experiments',trk:'tracking',ops:'opsData',expl:'projects',de:'decisions',port:'portfolio',prs:'projects',pr3:'projects',cg:'capAlloc',bpn:'budgetPlans',bps:'budgetPlans',bpg:'budgetPlans',bpm:'budgetPlans'}[pre];
  if(coll){ var j=rest.indexOf('_'); return coll+'::'+(j<0?rest:rest.slice(0,j)); }
  return null;
}

/* Guard for button-driven writes: block and tell the user who holds the record. */
function lockBlocked(rk){var h=Collab.lockedByOther(rk);if(!h)return false;try{alert('Locked \u2014 '+((h&&h.name)||'another user')+' is editing this record. Try again when the lock clears.')}catch(e){}return true}

/* Post-render pass: disable fields of records another user holds, mark who holds them.
   force=true always paints (fresh DOM after render); the tick uses force=false and skips
   when nothing changed, so it never flickers or fights typing. */
var _lockSig='';
function applyLockUI(force){
  try{
    var others=Collab.othersLocks(), sig=JSON.stringify(others);
    if(!force && sig===_lockSig) return; _lockSig=sig;
    var lockMap={}; for(var m=0;m<others.length;m++) lockMap[others[m].key]=others[m];
    var root=document.getElementById('app'); if(!root) return;
    var oldMarks=root.querySelectorAll('.collab-lock-mark'); for(var i=0;i<oldMarks.length;i++){ if(oldMarks[i].parentNode) oldMarks[i].parentNode.removeChild(oldMarks[i]); }
    var wasLocked=root.querySelectorAll('[data-collab-locked]'); for(var j=0;j<wasLocked.length;j++){ wasLocked[j].disabled=false; wasLocked[j].removeAttribute('data-collab-locked'); }
    var seen={}, fields=root.querySelectorAll('input,select,textarea');
    for(var k=0;k<fields.length;k++){
      var el=fields[k], rk=idToRecordKey(el.id); if(!rk) continue; var h=lockMap[rk]; if(!h) continue;
      el.disabled=true; el.setAttribute('data-collab-locked','1');
      if(!seen[rk]){ seen[rk]=true;
        var mk=document.createElement('div'); mk.className='collab-lock-mark';
        mk.style.cssText='font-size:11px;font-weight:600;color:#B8862E;margin:0 0 6px';
        mk.textContent='Locked \u00b7 '+(h.name||'Someone')+' is editing';
        if(el.parentNode) el.parentNode.insertBefore(mk, el);
      }
    }
  }catch(e){}
}

/* Acquire on focus, release when focus leaves all record fields (focusin handles field-to-field). */
var _heldLock=null;
if(typeof document!=='undefined'){
  document.addEventListener('focusin', function(e){
    var t=e.target; if(!t||!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName||'')) return;
    if(t.readOnly||t.disabled) return;
    var rk=idToRecordKey(t.id); if(!rk) return;
    if(Collab.lockedByOther(rk)){ if(t.blur)t.blur(); return; }
    if(_heldLock&&_heldLock!==rk){ Collab.release(_heldLock); _heldLock=null; }
    if(Collab.acquire(rk)) _heldLock=rk;
  });
  document.addEventListener('focusout', function(e){
    setTimeout(function(){
      var a=document.activeElement;
      var stillField=a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName||'')&&idToRecordKey(a.id);
      if(_heldLock&&!stillField){ Collab.release(_heldLock); _heldLock=null; }
    },60);
  });
  window.addEventListener('beforeunload', function(){ try{Collab.leave();}catch(e){} });
  setInterval(function(){ try{ Collab.refreshMine(); applyLockUI(false); }catch(e){} }, 4000);
}
/* ================= end Collab ================= */
// A user is an admin if explicitly flagged, or holds an owner/admin role.
function signOut(){
  if(SAMPLE_MODE){ closeSample(); return; } /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): in the sample tab Sign Out closes the tab; it never signs anyone out, never opens sign-in and writes nothing */
  if(!confirm('Sign out? Your work is saved.')) return;
  try{Collab.leave();}catch(e){}
  sealSession();
  Auth.signOut();
  Auth.clearSession();
  UI.entry = {step:'login', err:''};
  render();
}

function userAv(u, size){
  size = size || 28;
  var txt = (function(){
    var h = (u.color||'#888888').replace('#',''); // QA sweep 2: colorless records (imports, legacy) crashed the admin console
    var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
    return (0.299*r+0.587*g+0.114*b) > 140 ? '#1A1612' : '#fff';
  })();
  return '<div class="user-av" style="width:'+size+'px;height:'+size+'px;background:'+(u.color||'#888888')+';color:'+txt+';font-size:'+Math.floor(size*0.36)+'px">'+u.initials+'</div>';
}

/* Assignment system — data.assigns = { stepId: [userId, ...] } */
function getAssigns(taskId){
  return (data.assigns || {})[taskId] || [];
}

function toggleAssign(taskId, uid){
  if(!data.assigns) data.assigns = {};
  var cur = data.assigns[taskId] || [];
  if(cur.indexOf(uid) >= 0){
    data.assigns[taskId] = cur.filter(function(x){return x !== uid});
  } else {
    data.assigns[taskId] = cur.concat([uid]);
  }
  saveData();
  render();
}

function stepAssignBar(stepId){
  if(!stepId) return '';
  return '<div class="assign-bar">'
    + '<div class="assign-bar-lbl">Assigned to</div>'
    + assignBtn(stepId)
    + '</div>';
}

function assignBtn(taskId){
  var assigns = getAssigns(taskId);
  var isOpen = UI.assignOpen === taskId;
  var h = '<div class="assign-wrap">';
  // Assigned avatars
  assigns.forEach(function(uid){
    var u = USERS.find(function(x){return x.id===uid});
    if(u) h += '<span class="assign-av" style="cursor:pointer" title="'+esc(u.name)+' \u2013 click to manage assignments" onclick="event.stopPropagation();UI.assignOpen=UI.assignOpen===\''+taskId+'\'?null:\''+taskId+'\';render()">'+userAv(u,24)+'</span>';
  });
  // + Assign button
  h += '<button class="assign-add" style="width:24px;height:24px;padding:0;border-radius:50%;border:1px dashed rgba(var(--fg-rgb),.45);background:none;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1" title="Assign members" onclick="event.stopPropagation();UI.assignOpen=UI.assignOpen===\''+taskId+'\'?null:\''+taskId+'\';render()">+</button>';
  // Picker popover
  if(isOpen){
    h += '<div class="assign-pop">';
    h += '<div class="t-faint-sm" style="padding:6px 8px 4px">Click a name to assign or unassign \u2013 changes save instantly. Done closes the picker.</div>';
    var _sorted = USERS.slice().sort(function(a,b){var sa=assigns.indexOf(a.id)>=0?0:1,sb=assigns.indexOf(b.id)>=0?0:1;return sa-sb});
    _sorted.forEach(function(u){
      var isSel = assigns.indexOf(u.id) >= 0;
      h += '<button class="assign-row"'+(isSel?'':' style="opacity:.55"')+' title="'+(isSel?'Click to remove':'Click to assign')+'" onclick="event.stopPropagation();toggleAssign(\''+taskId+'\',\''+u.id+'\')">'
        + userAv(u,22)
        + '<div class="assign-row-text"><div class="assign-row-name">'+esc(u.name)+'</div>'
        + '<div class="assign-row-role">'+esc(u.role)+'</div></div>'
        + '<span class="assign-row-check">'+(isSel?'✓':'+')+'</span>'
        + '</button>';
    });
    h += '<button class="assign-close" onclick="event.stopPropagation();UI.assignOpen=null;render()">Done</button>';
    h += '</div>';
  }
  return h + '</div>';
}

/* ═══════════════════════════════════════════════════════════════
   ORG LIFECYCLE
   ═══════════════════════════════════════════════════════════════ */
function createOrg(name, firstUser, keepSession, orgId){
  var _owner='owner', _on=1; while(usernameTaken(_owner)) _owner='owner'+(++_on); /* Sweep 4R item 6: a console-made organization's first person is owner, owner2 and so on, whichever is free */
  var id=orgId||'org_'+Math.random().toString(36).slice(2,9);
  var list=getOrgs(); list.push({id:id,name:name||'Untitled Organization',created:Date.now()}); saveOrgs(list);
  if(!keepSession) sealSession(); /* keepSession: the admin console adding an organization is not a change of organization (S.4) */
  setCurrentOrg(id);
  data=emptyData();
  data.startDate=new Date().toISOString().split('T')[0];
  data.bf12=true;
  data.enterprise={name:name||''};
  var owner = firstUser ? {
    id:firstUser.id||uid(), name:firstUser.name||'Owner', username:(firstUser.username||'').trim(),
    role:firstUser.role||'Administrator', initials:orgInitials(firstUser.name||'Owner')||'OW',
    color:'#B8892A', scope:'All', admin:true
  } : {id:uid(),name:'Owner',username:_owner,role:'Administrator',initials:'OW',color:'#B8892A',scope:'All',admin:true};
  data.roster=[owner];
  saveData();
  applyTeamRoster();
  return {orgId:id, userId:owner.id};
}
/* -- SESSION SEAL (2 Oct 2026): every organization is sealed. Nothing at all survives a change of organization or user: no carve-outs, preferences included. -- */
function sealSession(){
  try{ if(coachOpen) toggleCoach(); }catch(e){}
  try{ if(notesOpen) toggleNotes(); }catch(e){}
  try{ if(gchatOpen) toggleGChat(); }catch(e){}
  try{ closeModal(); }catch(e){}
  try{ ['notesPanel','coachPanel','gchatPanel'].forEach(function(id){ var p=document.getElementById(id); if(p) p.innerHTML=''; }); }catch(e){} /* Sweep 4R item 8 (addendum 5 Oct 2026): a closed panel keeps its markup (the last session's notes, AI Guide conversation and Team Chat); each redraws when it next opens */
  try{ if(carouselState && carouselState.timer) clearInterval(carouselState.timer); }catch(e){}
  Object.keys(UI).forEach(function(k){ delete UI[k]; });
  var fresh = JSON.parse(UI_PRISTINE);
  Object.keys(fresh).forEach(function(k){ UI[k] = fresh[k]; });
  UI.theme = 'light'; UI.zoom = 1;
  try{ Store.setPref('theme', 'light'); Store.setPref('zoom', 1); Store.setPref('sidebar-min', '0'); }catch(e){}
  try{ document.documentElement.setAttribute('data-theme', 'light'); }catch(e){}
  sidebarMinimized = false; sidebarOpen = true;
  currentPage = 'home'; currentStep = null; currentPhase = null;
  insightsTab = 'latest';
  carouselState = {idx:0, timer:null, stepId:null, hover:false};
  gateArmed = false; _lastGateStep = null;
  coachMsgs = JSON.parse(COACH_MSGS_PRISTINE);
  coachBusy = false; /* AI Guide stage 1: a question still in flight belongs to the discarded thread (see sendCoach) */
  gchatUnreadCount = 0;
  gchatSeenCount = null; /* Sweep 4R item 5 */
  orgSetupMode = false;
}
function switchToOrg(id){ sealSession(); setCurrentOrg(id); loadData(); applyTeamRoster(); Auth.setSession(null); }
function deleteOrgById(id){
  var list=getOrgs().filter(function(o){return o.id!==id;}); saveOrgs(list);
  try{Store.removeOrg(id);}catch(e){}
  if(currentOrgId===id){ sealSession(); setCurrentOrg(null); Auth.setSession(null); data=emptyData(); USERS.length=0; }
}
function migrateLegacyData(){
  if(getOrgs().length) return;
  var legacy=null; try{legacy=Store.legacyRaw();}catch(e){}
  if(!legacy) return;
  try{
    var d=JSON.parse(legacy);
    var id='org_'+Math.random().toString(36).slice(2,9);
    var nm=(d.enterprise&&d.enterprise.name)?d.enterprise.name:'My Organization';
    saveOrgs([{id:id,name:nm,created:Date.now()}]);
    Store.writeOrg(id, d);
  }catch(e){}
}
function fmtDate(ts){try{var d=(typeof ts==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(ts))?new Date(ts+'T12:00:00'):new Date(ts);return d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});}catch(e){return '';}}

/* ═══════════════════════════════════════════════════════════════
   ENTRY FLOW — username + password sign-in · setup · admin console
   ═══════════════════════════════════════════════════════════════ */
/* -- PEOPLE AND PASSWORDS (Part 5, 2 Oct 2026) -- */
function unameKey(x){ return String(x==null?'':x).replace(/\s+/g,'').toLowerCase(); } /* Sweep 4R item 6 (addendum 5 Oct 2026): usernames compare ignoring capitals and every space */
function sameUsername(a,b){ return unameKey(a)===unameKey(b); }
/* 5.11 (Sweep 4R item 6): no two accounts share a username, ignoring capitals and every space, the app administrator's included; the server refuses again whatever the browser checked. */
function usernameTaken(username, exceptOrgId, exceptUserId){
  if(!unameKey(username)) return false;
  if(exceptOrgId!=='__admin' && unameKey(username)==='admin') return true; /* Sweep 4R item 6: the app administrator's username takes part, both ways; the browser knows only the default (Part 5.2), the server checks the stored one */
  var hit=false;
  getOrgs().forEach(function(o){
    var r=(o.id===currentOrgId)?USERS:((Store.readOrg(o.id)||{}).roster||[]);
    (r||[]).forEach(function(m){ if(m && sameUsername(m.username, username) && !(o.id===exceptOrgId && m.id===exceptUserId)) hit=true; });
  });
  return hit;
}
/* Sweep 4R item 6: a person renamed in an editor is asked of the sign-in server first, which knows the administrator's stored
   username (adding a person and /setup are refused there already). No answer from the server lets the save go on. */
var _unameCleared=null;
function usernameServerCheck(username, orgId, userId, again, refuse){
  var k=orgId+'|'+userId+'|'+unameKey(username);
  if(_unameCleared===k){ _unameCleared=null; return false; }
  Auth.usernameFree(username, orgId, userId, function(r){ if(r && r.ok===false && r.reason==='taken') return refuse('That username is already taken. Choose another.'); _unameCleared=k; again(); });
  return true;
}
/* 5.10: only an organization's administrators, and the app administrator, manage its people. */
function canManagePeople(){ var u=getCurrentUser(); return !SAMPLE_MODE && (!!isAppAdmin || !!(u && u.admin===true)); }
/* -- Sweep 4R item 2 (addendum 5 Oct 2026, Paul's decision; wording approved): administrators make administrators, and an organization always has one (A.5.29, A.5.30). -- */
var LAST_ADMIN_MSG='An organization needs at least one administrator. Make someone else an administrator first.';
function adminCountIn(list){return (list||[]).filter(function(x){return x&&x.admin===true}).length}
function adminTickHtml(id, on){ return '<label class="admin-tick"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'/> <span>Administrator</span></label>'; }
var _pendingCurrent=null; /* the password typed at sign-in, held in memory only until it is replaced (5.5) */
function pwRuleHtml(){ return '<div class="pw-rule">At least 8 characters, including a number and a special character such as ! or #.</div>'; }
function tempPasswordFieldHtml(id){ return '<div><label class="org-flabel" for="'+id+'">Temporary password</label><input id="'+id+'" class="field-input" type="password" autocomplete="new-password"/>'+pwRuleHtml()+'<div class="pw-note">The person will be asked to choose their own password the next time they sign in.</div></div>'; }

/* ── Sign in ─────────────────────────────────────────── */
function loginKey(e){ if(e&&e.key==='Enter') doLogin(); }
function openMemberWorkspace(orgId, userId){ switchToOrg(orgId); Auth.setSession(userId); UI.entry=null; render(); }
function doLogin(){
  var un=$('loginUser'), pw=$('loginPassword');
  var username=un?un.value.trim():'', password=pw?pw.value:'';   /* never cut a password short */
  if(pw) pw.value='';
  UI.entry.user=username;
  var rc=$('loginRemember'); var remember=rc?rc.checked:!!UI.entry.remember; UI.entry.remember=remember;
  if(!username){ UI.entry.err='Enter your username.'; render(); var u0=$('loginUser'); if(u0)u0.focus(); return; }
  Auth.signIn(username, password, remember, function(res){
    if(res && res.ok){
      if(res.mustChange){ startChoosePassword('member', res.orgId, res.userId, password); return; }
      openMemberWorkspace(res.orgId, res.userId); return;
    }
    UI.entry.err=authRefusal(res, password); render();
    var p1=$('loginPassword'); if(p1) p1.focus();
  });
}
function gotoSetup(){ UI.entry={step:'setup', err:''}; render(); }
function gotoLogin(){ UI.entry={step:'login', err:''}; render(); }
function gotoAdminLogin(){ UI.entry={step:'admin-login', err:''}; render(); }

/* ── Choose a new password (5.5): a temporary password, the administrator's first sign-in, or a stored password that breaks the rule ── */
function startChoosePassword(kind, orgId, userId, current){
  _pendingCurrent=current;
  var sub = kind==='admin' ? 'This password works only once. Choose your own to continue.'
          : (passwordProblem(current) ? 'Your password does not meet the current password rules. Choose a new one to continue.'
          : 'Your administrator set a temporary password. Choose your own to continue.');
  UI.entry={step:'choose-password', kind:kind, orgId:orgId||null, userId:userId||null, sub:sub, err:''};
  render(); var f=$('newPassword'); if(f) f.focus();
}
function choosePasswordKey(e){ if(e&&e.key==='Enter') doChoosePassword(); }
function doChoosePassword(){
  var e=UI.entry; if(!e || e.step!=='choose-password') return;
  var a=$('newPassword'), b=$('confirmPassword'), p1=a?a.value:'', p2=b?b.value:'';
  var prob=passwordProblem(p1);
  if(prob){ e.err=prob; render(); return; }
  if(p1!==p2){ e.err='The two passwords do not match.'; render(); return; }
  if(a) a.value=''; if(b) b.value='';
  (e.kind==='admin'?Auth.changeAdminPassword:Auth.changePassword)(_pendingCurrent, p1, function(res){
    if(res && res.ok){ _pendingCurrent=null; if(e.kind==='admin') enterAppAsAdmin(); else openMemberWorkspace(e.orgId, e.userId); return; }
    e.err=authRefusal(res, p1); render();
  });
}
function leaveChoosePassword(){ _pendingCurrent=null; Auth.signOut(); gotoLogin(); }

/* ── Set up a new organization (5.9): the setup code, then the first person's own password ── */
function doSetup(){
  function v(id){ var el=$(id); return el?el.value:''; }
  var code=v('setupCode').trim(), orgName=v('setupOrg').trim(), name=v('setupName').trim(), username=v('setupUser').trim(), password=v('setupPassword'), confirmPw=v('setupConfirm');
  var rc=$('setupRemember'), remember=rc?rc.checked:false;
  UI.entry.keep={code:code, org:orgName, name:name, user:username, remember:remember};
  function fail(m){ UI.entry.err=m; render(); }
  if(!code||!orgName||!name||!username||!password) return fail('Please complete all fields to continue.');
  if(code!==SETUP_CODE) return fail('That setup code is not recognized.');
  var prob=passwordProblem(password); if(prob) return fail(prob);
  if(password!==confirmPw) return fail('The two passwords do not match.');
  if(usernameTaken(username)) return fail('That username is already taken. Choose another.');
  var orgId='org_'+Math.random().toString(36).slice(2,9), userId=uid();
  Auth.setupOrganization(code, orgId, userId, username, password, remember, function(res){
    if(!res || !res.ok) return fail(authRefusal(res, password));
    createOrg(orgName, {id:userId, name:name, username:username, role:'Administrator'}, false, orgId);
    Auth.setSession(userId);
    // Continue into the enterprise/team setup wizard
    UI.entry=null; orgSetupMode=true; currentModal='org'; render(); renderOrgModal();
  });
}

/* ── The app administrator (5.12): an account from installation, a username and a password ── */
function adminKey(e){ if(e&&e.key==='Enter') doAdminLogin(); }
function doAdminLogin(){
  var un=$('adminUser'), pw=$('adminPassword'), username=un?un.value.trim():'', password=pw?pw.value:'';
  if(pw) pw.value='';
  UI.entry.user=username;
  Auth.signInAdmin(username, password, function(res){
    if(res && res.ok){ if(res.mustChange){ startChoosePassword('admin', null, null, password); return; } enterAppAsAdmin(); return; }
    UI.entry.err=authRefusal(res, password); render();
    var a=$('adminPassword'); if(a) a.focus();
  });
}
// Admin login lands straight in the app (with the Admin panel available in the menu)
function enterAppAsAdmin(){
  Auth.setAdminSession(true);
  var orgs=getOrgs();
  if(!orgs.length){ UI.entry={step:'admin'}; render(); return; } // no orgs yet → console to create one
  var target=(currentOrgId && getOrg(currentOrgId))?currentOrgId:orgs[0].id;
  switchToOrg(target);
  Auth.setSession((USERS[0]&&USERS[0].id)||null);
  if(!currentUserId){ UI.entry={step:'admin'}; render(); return; }
  UI.entry=null; render();
}
// In-app: open the Admin panel (kept available via the More menu and the admin bar)
function adminConsoleOpen(orgId){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  // Admin override: enter the org's workspace signed in as its first member
  switchToOrg(orgId);
  Auth.setSession((USERS[0]&&USERS[0].id)||null);
  if(!currentUserId){ UI.entry={step:'admin'}; alert('This organization has no members yet.'); render(); return; }
  try{Store.setRemember(null);}catch(e){}
  UI.entry=null; render();
}
function adminConsoleDelete(orgId){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o=getOrg(orgId); if(!o)return;
  if(!confirm('Delete "'+o.name+'" and all of its data? This cannot be undone.'))return;
  deleteOrgById(orgId); UI.entry={step:'admin'}; render();
}
function adminConsoleNewOrg(){ if(!isAppAdmin) return; UI.adminNewOrg={err:''}; currentModal='admin'; renderAdminModal(); } /* the Admin panel's form, over the console */
function exitAdmin(){ Auth.signOut(); Auth.setAdminSession(false); UI.entry={step:'login', err:''}; render(); }

/* ── Change password (5.6), and the administrator's username (5.12.3) ── */
function openChangePassword(){ if(SAMPLE_MODE) return; UI.pwDialog={kind:isAppAdmin?'admin':'member', err:'', done:''}; currentModal='password'; renderPasswordModal(); var f=$('pwCurrent'); if(f) f.focus(); }
function openChangeUsername(){ if(!isAppAdmin) return; UI.pwDialog={kind:'admin', err:'', done:''}; currentModal='username'; renderPasswordModal(); var f=$('adminNewUsername'); if(f) f.focus(); }
function renderPasswordModal(){
  var mr=$('modalRoot'); if(!mr || (currentModal!=='password' && currentModal!=='username')) return;
  var s=UI.pwDialog||{};
  function fld(label,id,ac){ return '<label class="org-flabel" for="'+id+'">'+label+'</label><input id="'+id+'" class="field-input" type="password" autocomplete="'+ac+'"/>'; }
  var h='<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal modal-narrow" role="dialog" aria-labelledby="pwTitle">';
  h+='<button class="modal-x" onclick="closeModal()" aria-label="Close">×</button>';
  if(currentModal==='username'){
    h+='<h3 id="pwTitle">Change username</h3>';
    h+='<div class="pw-form"><label class="org-flabel" for="adminNewUsername">Username</label><input id="adminNewUsername" class="field-input" type="text" autocomplete="username"/></div>';
    if(s.err) h+='<div class="entry-err">'+esc(s.err)+'</div>';
    if(s.done) h+='<div class="pw-done" role="status">'+esc(s.done)+'</div>';
    h+='<div class="org-edit-actions"><button class="org-btn-save" onclick="doChangeUsername()">Save</button></div>';
  }else{
    h+='<h3 id="pwTitle">Change password</h3>';
    h+='<div class="pw-form">'+fld('Current password','pwCurrent','current-password')+fld('New password','pwNew','new-password')+pwRuleHtml()+fld('Confirm new password','pwConfirm','new-password')+'</div>';
    if(s.err) h+='<div class="entry-err">'+esc(s.err)+'</div>';
    if(s.done) h+='<div class="pw-done" role="status">'+esc(s.done)+'</div>';
    h+='<div class="org-edit-actions"><button class="org-btn-save" onclick="doChangePassword()">Save password</button></div>';
  }
  h+='</div></div>';
  mr.innerHTML=h;
}
function doChangePassword(){
  var s=UI.pwDialog||{}, c=$('pwCurrent'), a=$('pwNew'), b=$('pwConfirm');
  var cur=c?c.value:'', p1=a?a.value:'', p2=b?b.value:'';
  function fail(m){ s.err=m; s.done=''; renderPasswordModal(); }
  var prob=(p1===cur)?'':passwordProblem(p1); if(prob) return fail(prob); /* Sweep 4R item 7: a new password equal to the current one goes to the server, which answers in its order: wrong current (A.5.15), then unchanged (A.5.10); the rule would otherwise answer first (the published default is on the common list) */
  if(p1!==p2) return fail('The two passwords do not match.');
  [c,a,b].forEach(function(x){ if(x) x.value=''; });
  (s.kind==='admin'?Auth.changeAdminPassword:Auth.changePassword)(cur, p1, function(res){
    if(res && res.ok){ s.err=''; s.done='Your password has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, p1));
  });
}
function doChangeUsername(){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var s=UI.pwDialog||{}, el=$('adminNewUsername'), u=el?el.value.trim():'';
  function fail(m){ s.err=m; s.done=''; renderPasswordModal(); }
  if(!u) return fail('Enter your username.');
  if(usernameTaken(u,'__admin')) return fail('That username is already taken. Choose another.'); /* Sweep 4R item 6: not against itself */
  Auth.changeAdminUsername(u, function(res){
    if(res && res.ok){ s.err=''; s.done='Your username has been changed.'; renderPasswordModal(); return; }
    fail(authRefusal(res, ''));
  });
}
// Floating bar shown when an app admin is viewing inside an organization
function updateAdminBar(){
  var bar=document.getElementById('adminViewBar');
  var show = isAppAdmin && currentUserId && getCurrentUser() && !UI.entry;
  if(show){
    if(!bar){ bar=document.createElement('div'); bar.id='adminViewBar'; bar.className='admin-view-bar'; document.body.appendChild(bar); }
    var org=getOrg(currentOrgId); var u=getCurrentUser();
    bar.innerHTML='<span class="admin-view-txt"><span class="admin-view-dot">●</span> Admin view · '+esc(org?org.name:'')+' · acting as '+esc(u.name||'')+'</span><button class="admin-view-btn" onclick="openAdmin()">Admin panel</button>';
  } else if(bar && bar.parentNode){ bar.parentNode.removeChild(bar); }
}

function orgRosterPreview(orgId){var d=Store.readOrg(orgId);return (d&&Array.isArray(d.roster))?d.roster:[];}

function renderEntry(){
  if(!UI.entry) UI.entry={step:'login'};
  var s=UI.entry.step;
  if(s==='checking') return '<div class="login-screen" aria-busy="true"></div>'; /* start-up: asking the server whether this browser is signed in */
  if(s==='setup') return renderSetupScreen();
  if(s==='admin-login') return renderAdminLogin();
  if(s==='choose-password') return renderChoosePassword();
  if(s==='admin') return isAppAdmin ? renderAdminConsole() : renderAdminLogin();
  return renderLoginScreen();
}

function renderLoginScreen(){
  var h='<div class="login-screen"><div class="login-card">'
    + '<div class="login-eyebrow">AI Innovation Pipeline</div>'
    + '<h1 class="login-title">Sign <em>in</em></h1>'
    + '<p class="login-sub">Enter your username and password to open your organization\'s workspace.</p>'
    + '<input id="loginUser" class="entry-text-input" type="text" autocomplete="username" placeholder="Username" value="'+esc(UI.entry.user||'')+'" onkeydown="loginKey(event)"/>'
    + '<input id="loginPassword" class="entry-text-input" type="password" autocomplete="current-password" placeholder="Password" onkeydown="loginKey(event)"/>'
    + (UI.entry.err?'<div class="entry-err">'+esc(UI.entry.err)+'</div>':'')
    + '<label class="entry-remember"><input type="checkbox" id="loginRemember"'+(UI.entry.remember?' checked':'')+' onchange="UI.entry.remember=this.checked"/> <span>Remember me on this device</span></label>'
    + '<button class="btn-gold login-btn" onclick="doLogin()">Sign In →</button>'
    + '<div class="entry-foot"><button class="entry-foot-btn" onclick="gotoSetup()">Set up a new organization</button><button class="entry-foot-btn" onclick="gotoAdminLogin()">Admin</button></div>'
    + '</div></div>';
  return h;
}

function renderSetupScreen(){
  var first = getOrgs().length===0, k=UI.entry.keep||{};
  var h='<div class="login-screen"><div class="login-card">'
    + (first?'':'<button class="entry-back" onclick="gotoLogin()">← Back to sign in</button>')
    + '<div class="login-eyebrow">AI Innovation Pipeline</div>'
    + '<h1 class="login-title">Set up your <em>organization</em></h1>'
    + '<p class="login-sub">Create your workspace and your account. You can add the rest of your team next.</p>'
    + (UI.entry.err?'<div class="entry-err" style="margin-bottom:14px">'+esc(UI.entry.err)+'</div>':'')
    + '<label class="entry-flabel" for="setupCode">Setup code</label>'
    + '<input id="setupCode" class="entry-text-input" type="text" autocomplete="off" placeholder="The code you were given" value="'+esc(k.code||'')+'"/>'
    + '<label class="entry-flabel" for="setupOrg">Organization name</label>'
    + '<input id="setupOrg" class="entry-text-input" type="text" autocomplete="off" placeholder="e.g. Acme Manufacturing" value="'+esc(k.org||'')+'"/>'
    + '<label class="entry-flabel" for="setupName">Your name</label>'
    + '<input id="setupName" class="entry-text-input" type="text" autocomplete="name" placeholder="e.g. Maria Torres" value="'+esc(k.name||'')+'"/>'
    + '<label class="entry-flabel" for="setupUser">Username</label>'
    + '<input id="setupUser" class="entry-text-input" type="text" autocomplete="username" placeholder="e.g. maria" value="'+esc(k.user||'')+'"/>'
    + '<label class="entry-flabel" for="setupPassword">Password</label>'
    + '<input id="setupPassword" class="entry-text-input" type="password" autocomplete="new-password"/>'
    + pwRuleHtml()
    + '<label class="entry-flabel" for="setupConfirm">Confirm new password</label>'
    + '<input id="setupConfirm" class="entry-text-input" type="password" autocomplete="new-password"/>'
    + '<label class="entry-remember"><input type="checkbox" id="setupRemember"'+(k.remember?' checked':'')+'/> <span>Remember me on this device</span></label>'
    + '<button class="btn-gold login-btn" onclick="doSetup()">Create &amp; Continue →</button>'
    + '</div></div>';
  return h;
}

function renderAdminLogin(){
  var h='<div class="login-screen"><div class="login-card entry-pass-card">'
    + '<button class="entry-back" onclick="gotoLogin()">← Back to sign in</button>'
    + '<div class="login-eyebrow">Administrator</div>'
    + '<h1 class="login-title">Admin <em>sign in</em></h1>'
    + '<p class="login-sub">Enter the administrator username and password to view all organizations and users.</p>'
    + '<input id="adminUser" class="entry-text-input" type="text" autocomplete="username" placeholder="Username" value="'+esc(UI.entry.user||'')+'" onkeydown="adminKey(event)"/>'
    + '<input id="adminPassword" class="entry-text-input" type="password" autocomplete="current-password" placeholder="Password" onkeydown="adminKey(event)"/>'
    + (UI.entry.err?'<div class="entry-err">'+esc(UI.entry.err)+'</div>':'')
    + '<button class="btn-gold login-btn" onclick="doAdminLogin()">Enter →</button>'
    + '</div></div>';
  return h;
}

function renderChoosePassword(){
  var e=UI.entry;
  var h='<div class="login-screen"><div class="login-card">'
    + '<button class="entry-back" onclick="leaveChoosePassword()">← Back to sign in</button>'
    + '<div class="login-eyebrow">'+(e.kind==='admin'?'Administrator':'AI Innovation Pipeline')+'</div>'
    + '<h1 class="login-title">Choose a new password</h1>'
    + '<p class="login-sub">'+esc(e.sub||'')+'</p>'
    + '<label class="entry-flabel" for="newPassword">New password</label>'
    + '<input id="newPassword" class="entry-text-input" type="password" autocomplete="new-password" onkeydown="choosePasswordKey(event)"/>'
    + pwRuleHtml()
    + '<label class="entry-flabel" for="confirmPassword">Confirm new password</label>'
    + '<input id="confirmPassword" class="entry-text-input" type="password" autocomplete="new-password" onkeydown="choosePasswordKey(event)"/>'
    + (e.err?'<div class="entry-err">'+esc(e.err)+'</div>':'')
    + '<button class="btn-gold login-btn" onclick="doChoosePassword()">Save password</button>'
    + '</div></div>';
  return h;
}
function renderAdminConsole(){
  var orgs=getOrgs();
  var totalUsers=0; orgs.forEach(function(o){totalUsers+=orgRosterPreview(o.id).length;});
  var h='<div class="login-screen admin-screen"><div class="admin-console">'
    + '<div class="admin-console-head"><div><div class="login-eyebrow">Administrator</div><h1 class="login-title" style="margin:6px 0 0">All <em>organizations</em></h1></div>'
    + '<div class="admin-console-actions"><button class="org-btn-cancel" onclick="adminConsoleNewOrg()">+ New Organization</button><button class="entry-link" onclick="openChangePassword()">Change password</button><button class="entry-link" onclick="openChangeUsername()">Change username</button><button class="entry-link" onclick="exitAdmin()">Exit admin</button></div></div>'
    + '<p class="login-sub" style="margin-bottom:18px">'+orgs.length+' organization'+(orgs.length===1?'':'s')+' · '+totalUsers+' user'+(totalUsers===1?'':'s')+' total. Each workspace is fully isolated.</p>'
    + '<div class="admin-console-list">';
  if(!orgs.length){ h+='<div class="entry-empty">No organizations yet.</div>'; }
  orgs.forEach(function(o){
    var roster=orgRosterPreview(o.id);
    h+='<div class="admin-cardx">';
    h+='<div class="admin-cardx-head"><div class="entry-org-badge">'+esc((o.name||'?').slice(0,1).toUpperCase())+'</div>'
      +'<div class="admin-cardx-meta"><div class="admin-org-name">'+esc(o.name)+'</div>'
      +'<div class="admin-org-sub">'+roster.length+' user'+(roster.length===1?'':'s')+' · created '+fmtDate(o.created)+'</div></div>'
      +'<div class="admin-org-actions"><button class="org-btn-cancel" onclick="adminConsoleOpen(\''+o.id+'\')">Open</button>'
      +'<button class="org-btn-cancel" onclick="adminConsoleReset(\''+o.id+'\')">Reset data</button>'
      +'<button class="org-btn-del" onclick="adminConsoleDelete(\''+o.id+'\')">Delete</button></div></div>';
    if(roster.length){
      h+='<div class="admin-users">';
      roster.forEach(function(u){
        h+='<div class="admin-user-row">'+userAv(u,26)
          +'<span class="admin-user-name">'+esc(u.name||'Unnamed')+'</span>'
          +'<span class="admin-user-uname">@'+esc(u.username||'—')+'</span>'
          +'<span class="admin-user-role">'+esc(u.role||'')+'</span></div>';
      });
      h+='</div>';
    }
    h+='</div>';
  });
  h+='</div></div></div>';
  return h;
}

var currentPage='home',currentStep=null,currentPhase=null;var gateArmed=false,_lastGateStep=null;
var sidebarOpen=true;
/* ═══════════════════════════════════════════════════════════════
   SIDEBAR MINIMIZE / MAXIMIZE — 2-state collapse to icon strip
   ═══════════════════════════════════════════════════════════════ */
var sidebarMinimized = (function(){
  try { return Store.getPref('sidebar-min') === '1'; }
  catch(e){ return false; }
})();

function minimizeSidebar(){
  sidebarMinimized = true;
  try { Store.setPref('sidebar-min', '1'); } catch(e){}
  // Make sure the sidebar itself is visible — minimize doesn't hide it
  sidebarOpen = true;
  render();
}

function maximizeSidebar(){
  sidebarMinimized = false;
  try { Store.setPref('sidebar-min', '0'); } catch(e){}
  sidebarOpen = true;
  render();
}

function toggleSidebarSize(){
  if(sidebarMinimized) maximizeSidebar();
  else minimizeSidebar();
}

var coachOpen=false,notesOpen=false;
// Pipeline module UI state
var UI={v:'home',prev:null,navStack:[],_back:false,sb:true,sec:'1.1',ap:null,icDraft:null,showEx:{},sf:false,ec:null,addForm:false,expanded:{},ni:{name:'',desc:'',strategic:'',cost:'',timeframe:'',dept:'',when:'now'}};
var UI_PRISTINE = JSON.stringify(UI); /* the session's starting state, for sealSession */
var coachMsgs=[{role:'ai',welcome:true,text:'Welcome to the AI Innovation Pipeline. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.'}];
var COACH_MSGS_PRISTINE = JSON.stringify(coachMsgs); /* the AI Guide's opening, for sealSession */
var coachCtx='Overview';

function $(id){return document.getElementById(id)}
function uid(){return Math.random().toString(36).slice(2,10)}
function fmt(d){return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}

function loadData(){
  if(!currentOrgId){data=emptyData();return;}
  try{var s=Store.orgRaw(currentOrgId);data=s?JSON.parse(s):emptyData();ensureRaciModel();ensureCapCostModel();Object.keys(data.projects||{}).forEach(function(k){var q=data.projects[k];if(q&&q.rescore&&!q.rescoreDone&&rsComplete(q.rescore))q.rescoreDone=true});Object.keys(data.opsData||{}).forEach(function(k){if(data.opsData[k]&&data.opsData[k].sunset&&!(data.archivedItems||{})[k]){if(!data.archivedItems)data.archivedItems={};data.archivedItems[k]={stage:'operational',at:Date.now()}}});if(!data.bf12){if(s){if(!data.completedSteps)data.completedSteps={};if((data.ideas||[]).length>=3&&!data.completedSteps['1.2'])data.completedSteps['1.2']=true;stampStepDone('1.2');if((data.selected||[]).length>0&&!data.completedSteps['1.3'])data.completedSteps['1.3']=true;stampStepDone('1.3');}data.bf12=true;if(s)saveData();}}catch(e){data=emptyData();data.bf12=true;}
}
function saveData(){
  if(!currentOrgId)return;
  try{Store.writeOrg(currentOrgId,data)}catch(e){}
}

var PH=[
{id:1,name:'Diagnose',days:'Days 1\u201330',color:'#1B6B5A',steps:[{id:'1.1',name:'Assessment Battery',icon:'■'},{id:'1.2',name:'Brainstorm Use Cases',icon:'◇'},{id:'1.3',name:'Filter & Rank',icon:'◉'}],outcomes:[{id:'out-report',name:'Assessment Report',icon:'□'},{id:'out-bluesky',name:'Blue Sky Portfolio',icon:'▒'}]},
{id:2,name:'Organize',days:'Days 31\u201350',color:'#2D5A8E',steps:[{id:'2.1',name:'Ownership & Structure',icon:'+'},{id:'2.2',name:'Realign Incentives',icon:'◉'},{id:'2.3',name:'Innovation Rhythm',icon:'↻'},{id:'2.4',name:'Deepen Assessment',icon:'◉'}],outcomes:[{id:'out-orgready',name:'Org Readiness',icon:'■'},{id:'out-raci',name:'RACI Matrix',icon:'⊕'},{id:'out-explore',name:'Exploration Portfolio',icon:'▪'}]},
{id:3,name:'Prepare',days:'Days 51\u201370',color:'#8B5E3C',steps:[{id:'3.1',name:'Structure Portfolio',icon:'▒'},{id:'3.2',name:'Plan Capacity',icon:'▦'},{id:'3.3',name:'Allocate Capital',icon:'◻'},{id:'3.4',name:'Map Development Track',icon:'△'}],outcomes:[{id:'out-capplan',name:'Capital Snapshot',icon:'◻'},{id:'out-expbriefs',name:'Development Portfolio',icon:'△'}]},
{id:4,name:'Ignite',days:'Days 71\u201390',color:'#9B2D3F',steps:[{id:'4.1',name:'Run Development Track',icon:'▷'},{id:'4.2',name:'Establish Governance',icon:'—'},{id:'4.3',name:'Stress-Test Org Design',icon:'✕'},{id:'4.4',name:'Portfolio Review',icon:'↗'}],outcomes:[{id:'out-govfw',name:'Governance Framework',icon:'—'},{id:'out-orgrev',name:'Org Design Review',icon:'✕'},{id:'out-finalport',name:'Portfolio Review',icon:'↗'} /* 17 Sep 2026 (Paul's ruling): Ignite's third output is the review distilled from Step 4.4, not a second Development Portfolio */]},
{id:5,name:'Navigate',days:'Ongoing',color:'#6B4C8A',steps:[{id:'5.1',name:'Pipeline Dashboard',icon:'▒'}],outcomes:[{id:'out-oper',name:'Operational Portfolio',icon:'✕'},{id:'cap-hub',name:'Capital Planning Hub',icon:'◻'}]}
];

var MILESTONES={
'1.1':'Baseline established \u2014 you now have a quantified picture of your organization\'s AI readiness.',
'1.2':'Your blue sky portfolio now contains at least three ideas.',
'1.3':'Portfolio filtered \u2014 your ideas are ranked by priority, value, cost, risk, and ease, with your selections carried forward.',
'2.1':'Ownership assigned \u2014 the pipeline has a named owner with explicit authority, backed by embedded leads and engaged seniors.',
'2.2':'Incentives realigned \u2014 innovation metrics are tied to the behaviors that matter.',
'2.3':'Innovation rhythm set \u2014 standing meetings and portfolio reviews are calendared.',
'2.4':'Projects deepened \u2014 SWOT analysis, gap analysis, and partnerships mapped.',
'3.1':'Portfolio structured \u2014 projects organized by time horizon with strategic balance assessed.',
'3.2':'Capacity planned \u2014 the budget envelope is sized across the horizon.',
'3.3':'Capital committed \u2014 the first cohort advanced with stage gates and a budget that holds.',
'3.4':'Development tracks mapped \u2014 every advanced project has phases with budgets, owners, success metrics, and exit gate criteria.',
'4.1':'Development running \u2014 every live program\u2019s next gate is set, and gate decisions are being taken as phases end.',
'4.2':'Governance established \u2014 the framework that will sustain your portfolio beyond 90 days.',
'4.3':'Organization stress-tested \u2014 structural readiness confirmed for sustained innovation.',
'4.4':'First review complete \u2014 Buy/Sell/Hold decisions made. Your innovation portfolio is operational.'
};

// Phase-complete wrap-ups — shown on a phase's final step once every step in the phase is done (July 10)
var PHASE_WRAPUPS={
1:'Phase 1 complete. You\u2019ve mapped the ground: your purpose, an honest read of your culture, an audit of what you already run, and a clear picture of who decides what. You\u2019ve turned a wide field of ideas into a ranked shortlist worth pursuing. You diagnosed before you built \u2014 and that\u2019s what keeps everything that follows from resting on untested assumptions. Next, you build the machinery to move these ideas forward.',
2:'Phase 2 complete. The machinery now exists. One person owns the pipeline with real authority; incentives reward pipeline health, not just quarterly delivery; a standing weekly rhythm protects the time to look forward. And you\u2019ve taken your shortlist through a deeper assessment, turning promising ideas into defined projects with a clear verdict on each. The structure is built. Next, you give it something to run.',
3:'Phase 3 complete. You have a real portfolio now \u2014 a balanced mix of quick wins, medium-term projects, and longer bets, rather than a scattered list. You\u2019ve set your capital and selected a first cohort of projects that fits within it. And your first development phases are designed \u2014 each with an owner, a budget, a timeline, and a measure of success, and each ending at a rigorously defined gate that progress must pass through. Everything is loaded. Next, you light the fuse.',
4:'You\u2019ve launched your first experiments, established governance that outlasts these ninety days, stress-tested your organization, and made your first buy-sell-hold decisions. You have a working pipeline, a real portfolio, live experiments, and the discipline to sustain all of it. When day ninety arrives, the pipeline doesn\u2019t switch off \u2014 it becomes your engine, taking in new ideas, advancing the strong ones, and retiring the rest. The ninety days were only ever the key to the ignition. After that, the road is yours.'
};

function goBack(){var st=UI.navStack||[];var t=st.pop();if(!t)return;UI._back=true;if(t.p==='phase')go('phase',t.ph||'1');else if(t.s!=null)go(t.p,t.s);else go(t.p)}
function backBtn(){return(UI.navStack&&UI.navStack.length)?'<button class="btn-ghost pad-chip-sm" onclick="goBack()">\u2190 Back</button>':''}
function go(page,step){
// Bridge: handle single-arg calls from pipeline module (go('1.2'), go('out-report'), etc.)
if(step===undefined&&page!=='home'&&page!=='learn'&&page!=='pipeline'&&page!=='insights'&&page!=='phase5'){
  var v=page;
  if(v.match(/^\d+\.\d/)){page='step';step=v;}
  else if(v.indexOf('out-')===0){page='outcome';step=v;}
  else if(v.indexOf('phase-')===0){page='phase';step=v.split('-')[1];}
}
if(page==='step'&&step==='5.1'){page='phase5';step=undefined}
var _wb=UI._back;UI._back=false;
var _same=(page===currentPage)&&((step==null&&currentStep==null)||step===currentStep);
if(!_wb&&currentPage&&!_same){(UI.navStack=UI.navStack||[]).push({p:currentPage,s:currentStep,ph:currentPhase&&currentPhase.id});if(UI.navStack.length>25)UI.navStack.shift()}
currentPage=page;
currentPhase=null;
if(page==='phase'&&step){
  // Phase landing: find phase by ID (1-5), not step ID
  for(var i=0;i<PH.length;i++){if(String(PH[i].id)===String(step)){currentPhase=PH[i];currentStep=String(step);break}}
} else {
  if(step)currentStep=step;else currentStep=null;
  if(currentStep){
    for(var i=0;i<PH.length;i++){
      for(var j=0;j<PH[i].steps.length;j++){if(PH[i].steps[j].id===currentStep){currentPhase=PH[i];break}}
      if(currentPhase)break;
      if(PH[i].outcomes){for(var k=0;k<PH[i].outcomes.length;k++){if(PH[i].outcomes[k].id===currentStep){currentPhase=PH[i];break}}}
      if(currentPhase)break;
    }
  }
}
render();
var _nm=document.querySelector('.main-content');if(_nm)_nm.scrollTop=0;
window.scrollTo(0,0);
}

/* ═══════════════════════════════════════════════════════════════
   ZOOM CONTROLS — Pipeline & Navigate sections
   ═══════════════════════════════════════════════════════════════ */

// Initialize zoom from Store on load (after UI is declared)
(function(){
  try {
    var z = parseFloat(Store.getPref('zoom'));
    if(z >= 0.5 && z <= 2.0) UI.zoom = z;
  } catch(e){}
})();

// Initialize theme from Store on load (after UI is declared). Device-local
// preference, key pipeline-theme (same family as zoom / sidebar-min), so it
// survives seeding and org resets by construction. Default: LIGHT.
(function(){
  try {
    var t = Store.getPref('theme');
    UI.theme = (t === 'dark') ? 'dark' : 'light';
  } catch(e){ UI.theme = 'light'; }
  try { document.documentElement.setAttribute('data-theme', UI.theme); } catch(e){}
})();

function setTheme(t){
  t = (t === 'dark') ? 'dark' : 'light';
  UI.theme = t;
  try { Store.setPref('theme', t); } catch(e){}
  try { document.documentElement.setAttribute('data-theme', t); } catch(e){}
  render();
}
function toggleTheme(){ setTheme(UI.theme === 'dark' ? 'light' : 'dark'); }

function setZoom(val){
  var z = Math.max(0.5, Math.min(2.0, Math.round(val * 100) / 100));
  UI.zoom = z;
  try { Store.setPref('zoom', z); } catch(e){}
  render();
}

function zoomIn(){  setZoom((UI.zoom || 1) + 0.1); }
function zoomOut(){ setZoom((UI.zoom || 1) - 0.1); }
function zoomReset(){ setZoom(1); }

function zoomFit(){
  // Measure natural (unzoomed) height of the section, then pick the largest
  // scale that fits the available viewport height.
  var w = document.getElementById('zoomWrap');
  if(!w) return setZoom(1);
  var prevZoom = w.style.zoom || '';
  w.style.zoom = 1;
  // Force a reflow read
  var naturalH = w.scrollHeight;
  var viewportH = (window.innerHeight || 800) - 120;  // leave room for top nav + padding
  if(prevZoom) w.style.zoom = prevZoom;
  var fitScale = naturalH > 0 ? Math.max(0.5, Math.min(1, viewportH / naturalH)) : 1;
  setZoom(fitScale);
}

function syncNavHeight(){
  var n=document.querySelector('nav');
  if(!n) return;
  var h=n.offsetHeight;
  if(h>0){
    var s=document.documentElement.style;
    s.setProperty('--nav-h',(h+16)+'px');    // main-content top padding: header height + 16px gap (unchanged)
    s.setProperty('--nav-h-exact',h+'px');   // sidebar top: exact header bottom, so the sidebar sits flush and can never be underlapped
  }
}
if(typeof window!=='undefined'){
  window.addEventListener('resize', function(){ syncNavHeight(); });
  // The header's height changes for reasons a window 'resize' never sees: web fonts swapping in after first
  // paint, the tabs/actions wrapping to a second line, browser zoom, and content changes. A ResizeObserver on
  // <nav> fires on all of them, so --nav-h / --nav-h-exact always track the real height with no timing gap.
  if(typeof ResizeObserver!=='undefined'){
    var _navRO=new ResizeObserver(function(){ syncNavHeight(); });
    var _watchNav=function(){ var el=document.querySelector('nav'); if(el){ _navRO.observe(el); return true; } return false; };
    if(!_watchNav()){
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_watchNav);
      else setTimeout(_watchNav,0);
    }
  }
  // Font swap is the classic first-paint reflow; nudge once fonts are ready, as a fallback for any browser
  // where the observer would miss the very first layout.
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(function(){ syncNavHeight(); }); }
}

/* Entry screens (sign-in, set-up, choose a password): what the person has typed, kept across a redraw. */
var _entrySig=null;
function entryFieldsSnapshot(root){
  var snap={fields:{},focus:null,selA:null,selB:null};
  try{
    var els=root.querySelectorAll('input[id],select[id],textarea[id]');
    for(var i=0;i<els.length;i++){ var el=els[i]; snap.fields[el.id]=(el.type==='checkbox'||el.type==='radio')?{checked:!!el.checked}:{value:el.value}; }
    var a=document.activeElement;
    if(a && a.id && snap.fields[a.id]){ snap.focus=a.id; if(typeof a.selectionStart==='number'){ snap.selA=a.selectionStart; snap.selB=a.selectionEnd; } }
  }catch(e){}
  return snap;
}
/* Puts the snapshot back; true when it restored the cursor (the caller then leaves focus alone). */
function entryFieldsRestore(root,snap){
  try{
    for(var id in snap.fields){ var el=document.getElementById(id); if(!el||!root.contains(el)) continue; var v=snap.fields[id];
      if('checked' in v) el.checked=v.checked; else if(el.value==='' && v.value!=='') el.value=v.value; }
    if(snap.focus){ var f=document.getElementById(snap.focus); if(f&&f.focus){ f.focus(); if(snap.selA!=null&&f.setSelectionRange){ try{f.setSelectionRange(snap.selA,snap.selB);}catch(e){} } return true; } }
  }catch(e){}
  return false;
}

function render(){
  try{ if(currentOrgId&&currentUserId) gchatRecount(); }catch(e){} /* Sweep 4R item 5: the unread badge, recounted on every render */
    try{notifySweepDeadlines()}catch(e){}
    try{applyAiFeatures()}catch(e){}
    var _fEl=document.activeElement,_fid=_fEl&&_fEl.id,_fsel=(_fEl&&typeof _fEl.selectionStart==='number')?_fEl.selectionStart:null;
  try{
    var _ssEl=document.querySelector('.sidebar-scroll'),_mcEl=document.querySelector('.main-content');
    var _ssTop=_ssEl?_ssEl.scrollTop:0,_mcTop=_mcEl?_mcEl.scrollTop:0;
    var app=$('app'),nt=$('navTabs'),nr=$('navRight');
    var navEl=document.querySelector('nav'), ftEl=$('appFooter');
    // Sample tab (Part 3): never a sign-in form; a tab opened without a signed-in tab shows only A.3.6
    if(SAMPLE_MODE && (SAMPLE_REFUSED || !currentUserId || !getCurrentUser())){
      if(nt) nt.innerHTML='';
      if(nr) nr.innerHTML='';
      if(navEl) navEl.style.display='none';
      if(ftEl) ftEl.style.display='none';
      var _sbS=$('pipSidebar'); if(_sbS) _sbS.style.display='none';
      var _tgS=$('sidebarToggle'); if(_tgS) _tgS.style.display='none';
      app.classList.remove('sidebar-mini'); app.classList.add('sidebar-collapsed');
      app.innerHTML='<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>';
      return;
    }
    // Entry gate: organization → user → password
    if(!currentOrgId || !currentUserId || !getCurrentUser()){
      if(nt) nt.innerHTML='';
      if(nr) nr.innerHTML='';
      if(navEl) navEl.style.display='none';
      if(ftEl) ftEl.style.display='none';
      var _sb=$('pipSidebar'); if(_sb) _sb.style.display='none';
      app.classList.remove('sidebar-mini'); app.classList.add('sidebar-collapsed');
      /* A redraw the person did not cause (another tab saving this organization, the change poll, a panel)
         must not empty the form they are filling in. Same screen, same state: carry what was typed, the
         checkboxes and the cursor across. A change of screen or a refusal (UI.entry changes) draws fresh. */
      var _entryNow=JSON.stringify(UI.entry||null), _entryKept=(_entryNow===_entrySig)?entryFieldsSnapshot(app):null;
      app.innerHTML = renderEntry();
      _entrySig=_entryNow;
      if(_entryKept && entryFieldsRestore(app,_entryKept)){}
      else{ var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !UI.entry.err) ef.focus(); }
      if(typeof updateAdminBar==='function') updateAdminBar();
      return;
    }
    _entrySig=null; /* the app is showing: the next entry screen starts fresh */
    if(navEl) navEl.style.display='';
    if(ftEl) ftEl.style.display='';
    var pages=[{id:'home',l:'Home'},{id:'learn',l:'Learn'},{id:'pipeline',l:'Pipeline'},{id:'phase5',l:'Navigate'},{id:'insights',l:'Insights'}];
    var th='';for(var i=0;i<pages.length;i++){var p=pages[i];var act=currentPage===p.id||(currentPage==='step'&&p.id==='pipeline')||(currentPage==='outcome'&&p.id==='pipeline')||(['cap-hub'].indexOf(currentPage)>=0&&p.id==='phase5');th+='<button class="nav-tab'+(act?' active':'')+'" onclick="go(\''+p.id+'\')">'+p.l+'</button>'}
    nt.innerHTML=th;
    var _cu=getCurrentUser();
    var _zz = UI.zoom || 1; var _zp = Math.round(_zz * 100);
    var navMoreHtml = UI.navMore ? (
      '<div class="nav-more-backdrop" onclick="closeNavMore()"></div>'+
      '<div class="nav-more-menu" role="menu">'+
        '<div class="nav-more-zoom">'+
          '<div class="nmz-head"><span class="nmz-lbl">View</span><span class="nmz-val">'+_zp+'%</span></div>'+
          '<div class="nmz-row">'+
            '<button class="nmz-btn" onclick="zoomOut()" title="Zoom out" aria-label="Zoom out"'+(_zz<=0.5?' disabled':'')+'>\u2212</button>'+
            '<button class="nmz-btn" onclick="zoomIn()" title="Zoom in" aria-label="Zoom in"'+(_zz>=2?' disabled':'')+'>+</button>'+
            '<button class="nmz-chip" onclick="zoomFit()" title="Fit page to screen">Fit</button>'+
            '<button class="nmz-chip" onclick="zoomReset()" title="Reset to 100%">Reset</button>'+
          '</div>'+
        '</div>'+
        '<div class="nav-more-sep"></div>'+
        '<button class="nav-more-item'+(currentPage==='mgmt-hub'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'mgmt-hub\')"><span class="nav-more-ic">\u25a6</span> Track Program</button>'+'<button class="nav-more-item'+(currentPage==='reports'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'reports\')"><span class="nav-more-ic">\u2637</span> Report Manager</button>' /* 16 Sep 2026: the Report Manager in the More menu */+
        (voiceOn()?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleVoice()"><span class="nav-more-ic">&#9673;</span> Voice</button>':'')+
        (SAMPLE_MODE?'':'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleNotes()"><span class="nav-more-ic">&#9998;</span> Notes <span id="notesCount" class="notes-count">'+((data.notes||[]).length)+'</span></button>')+
        (SAMPLE_MODE?'':'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openOrg()"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>')+
        (isAppAdmin&&!SAMPLE_MODE?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openAdmin()"><span class="nav-more-ic">&#9638;</span> Admin</button>':'')+
        '<div class="nav-more-sep"></div>'+
        (SAMPLE_MODE?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();restartSample()"><span class="nav-more-ic">&#8635;</span> Start the sample again</button>'+
          '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();closeSample()"><span class="nav-more-ic">&#10005;</span> Close the sample</button>':
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openChangePassword()"><span class="nav-more-ic">&#9679;</span> Change password</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedData()"><span class="nav-more-ic">&#8635;</span> Seed sample data</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedDataY2()"><span class="nav-more-ic">&#8635;</span> Seed Year 2 sample</button>')+
        (SAMPLE_MODE?'':'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();exportState()"><span class="nav-more-ic">&#8595;</span> Export state</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();importState()"><span class="nav-more-ic">&#8593;</span> Import state</button>')+ /* Sweep 4R item 9 (addendum 5 Oct 2026; amends Part 3): not in the sample tab */
      '</div>'
    ) : '';
    nr.innerHTML=(_cu?'<div class="nav-user-chip" onclick="signOut()" title="Click to sign out">'/* Sweep 4R item 9: in the sample tab too, where Sign Out closes the sample */+userAv(_cu,26)+'<div class="nav-user-name">'+esc(_cu.name.split(" ")[0])+'</div></div>':'')+'<button class="btn-ghost pad-chip-md nav-action" onclick="openHelp()" title="Help">? Help</button><button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 '+(UI.theme==='dark'?'Light Mode':'Dark Mode')+'</button>'+(SAMPLE_MODE?'':'<button id="gchatNavBtn" class="btn-ghost pad-chip-md nav-action'+(gchatOpen?' nav-action-on':'')+'" onclick="toggleGChat()">≡ Team Chat<span id="gchatUnread" class="gchat-unread" style="display:'+(gchatUnreadCount>0?'':'none')+'">'+gchatUnreadCount+'</span></button>')+''+(SAMPLE_MODE?'':'<button id="sampleNavBtn" class="btn-ghost pad-chip-md nav-action" onclick="openSampleTab()">&#9673; Demo</button>')+'<span class="nav-more-wrap"><button class="btn-ghost pad-chip-md nav-action'+(UI.navMore?' nav-action-on':'')+'" onclick="toggleNavMore(event)" aria-haspopup="true" aria-expanded="'+(UI.navMore?'true':'false')+'" title="More">&#8943; More</button>'+navMoreHtml+'</span>';
    var h='';
    // Screens migrated to <name>.html + <name>.js (see screen-loader.js).
    // Each entry maps a page id to its container-based render function.
    var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn};
    var screenFn=SCREEN_MODULES[currentPage];
    if(screenFn){screenFn(app);}
    else if(currentPage==='insights')h=renderInsights();
    else if(currentPage==='pipeline')h=renderPipelineOverview();
    else if(currentPage==='step')h=renderStep();
    else if(currentPage==='phase')h=renderPhaseLandingPipe(currentPhase?currentPhase.id:1);
    else if(currentPage==='outcome')h=renderOutcome();
    else if(currentPage==='phase5')h=renderPhase5();
    else if(currentPage==='cap-hub')h=renderCapHub();
else if(currentPage==='reports')h=renderReports();
else if(currentPage==='review')h=renderReviewPage(); /* 17 Sep 2026: the Quarterly Review page */
else if(currentPage==='portfolio')h=renderPortfolioPage(); /* 17 Sep 2026: a live portfolio page */ /* 16 Sep 2026: the Report Manager page */
    else if(currentPage==='mgmt-hub')h=renderMgmtHub();
    if(!screenFn){
      if(h.indexOf('id="zoomWrap"')<0){ var _zs=(UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):''; h='<div class="zoom-wrap" id="zoomWrap"'+_zs+'>'+h+'</div>'; }
      app.innerHTML=h+chartZoomOverlay();
    }
    if(_fid){setTimeout(function(){try{var _fe2=document.getElementById(_fid);if(_fe2&&typeof _fe2.focus==='function'){_fe2.focus();if(_fsel!=null&&typeof _fe2.setSelectionRange==='function')_fe2.setSelectionRange(_fsel,_fsel)}}catch(_e){}},0)}
    renderSidebar();
    syncNavHeight();
    setTimeout(function(){var els=document.querySelectorAll('.reveal');for(var i=0;i<els.length;i++){(function(el,d){setTimeout(function(){el.classList.add('visible')},d)})(els[i],i*60)}},50);
    carouselInit();
    if(coachOpen)renderCoachPanel();
    if(notesOpen)renderNotesPanel();
    initBalancePops();
    updateNotesCount();
    updateAdminBar();
    var _ss2=document.querySelector('.sidebar-scroll');if(_ss2&&_ssTop)_ss2.scrollTop=_ssTop;
    var _mc2=document.querySelector('.main-content');if(_mc2&&_mcTop)_mc2.scrollTop=_mcTop;
    var _gk=currentStep+'/'+(UI.sec||'');if(_gk!==_lastGateStep){gateArmed=false;_lastGateStep=_gk;}if(gateArmed)paintGates();applyLockUI(true);
    ensureSampleNote();
  }catch(e){$('app').innerHTML='<div class="u-d829b04"><h2>Error</h2><pre>'+e.message+'</pre></div>';console.error(e)}
}

function exportState(){
  try{
    var org=(getOrg(currentOrgId)||{}).name||'workspace';
    var payload={app:'nextchapter-pipeline',type:'pipeline-state',schema:'pipeline-v3',org:org,exportedAt:new Date().toISOString(),data:data};
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;
    a.download='pipeline-state-'+(org.replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'workspace')+'-'+new Date().toISOString().split('T')[0]+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }catch(e){alert('Export failed: '+((e&&e.message)||e));}
}
function importState(){
  var inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(){applyImportedState(String(r.result));};
    r.onerror=function(){alert('Could not read that file.');};
    r.readAsText(f);
  };
  inp.click();
}
function applyImportedState(text){
  var parsed;
  try{parsed=JSON.parse(text);}catch(e){alert('That file is not valid JSON.');return;}
  var d=(parsed&&typeof parsed==='object'&&parsed.data)?parsed.data:parsed;
  if(!d||typeof d!=='object'||(d.completedSteps===undefined&&d.ideas===undefined&&d.purpose===undefined)){alert('That does not look like a Pipeline state file.');return;}
  if(parsed&&parsed.schema&&parsed.schema!=='pipeline-v3'){if(!confirm('This file was exported from a different schema ('+parsed.schema+'). Import anyway?'))return;}
  if(!currentOrgId){alert('Open a workspace before importing a state.');return;}
  if(!confirm('Import this state? It replaces the current workspace\u2019s data. Export first if you want to keep it.'))return;
  try{
    Store.writeOrg(currentOrgId,d);
    loadData();applyTeamRoster();
    Auth.setSession((USERS[0]&&USERS[0].id)||currentUserId);
    render();
  }catch(e){alert('Import failed: '+((e&&e.message)||e));}
}

// ═══════════════════════════════════════
// === HOME === (moved to home.html + home.js)

// === LEARN === (moved to learn.html + learn.js)

// ═══════════════════════════════════════
// === PIPELINE ===
function renderPipeline(){
var stages=getStages();
var h='<div class="pt-100"><div class="wrap u-5d173d9">';
h+='<div class="section-label reveal">The 90-Day Journey</div>';
h+='<div class="section-title reveal">Your <em>Innovation Pipeline</em></div>';
h+='<p class="section-body reveal mb-12">Five phases. Structured progression. Each phase builds the infrastructure for the next. Work through every step in order — the sequence matters.</p>';

// Pipeline viz
h+='<div class="pipe-viz reveal">';
var stageCounts=[bsNowList(stages).length,stages.explore.length,stages.experiment.length,stages.operational.length];
var stageLabels=['Blue Sky','Exploration','Development','Operational'];
for(var i=0;i<stageLabels.length;i++){
h+='<div class="pipe-stage" onclick="go(\'phase5\')">';
h+='<div class="pipe-stage-name four-color" style="--c:'+(['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F'][i])+'">'+stageLabels[i]+'</div>';
h+='<div class="pipe-stage-count four-color" style="--c:'+(['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F'][i])+'">'+stageCounts[i]+'</div>';
h+='<div class="u-1e23254">items</div>';
h+='</div>'}
h+='</div>';

h+='</div>';

// Phase grid
h+='<div class="timeline-wrap reveal"><div class="wrap"><div class="timeline-phases">';
for(var i=0;i<PH.length;i++){var ph=PH[i];
var stepsTotal=ph.steps.length;var stepsDone=ph.steps.filter(function(s){return isStepDone(s.id)}).length;
h+='<div class="timeline-phase" onclick="go(\'step\',\''+ph.steps[0].id+'\')" class="ph-border-top" style="--c:'+ph.color+'">';
h+='<div class="phase-num ph-color" style="--c:'+ph.color+'">Phase '+ph.id+' · '+ph.days+'</div>';
h+='<div class="phase-name t-paper">'+ph.name+'</div>';
h+='<div class="phase-days">'+stepsDone+'/'+stepsTotal+' complete</div>';
h+='<div class="phase-steps">';
for(var j=0;j<ph.steps.length;j++){var s=ph.steps[j];h+='<div class="ph-done-c" style="--c:'+(isStepDone(s.id)?ph.color:'var(--stone)')+'">'+s.icon+' '+s.name+'</div>'}
h+='</div>';
h+='<div class="mt-4"><button class="btn-ghost ph-tag" style="--c:'+ph.color+'">Enter Phase →</button></div>';
h+='</div>'}
h+='</div></div></div>';
h+='</div>';
return h;
}

// === STEP ===
function renderStep(){
if(!currentStep)return renderPipeline();
var ph=currentPhase;if(!ph)return renderPipeline();
var stepObj=null;for(var j=0;j<ph.steps.length;j++){if(ph.steps[j].id===currentStep){stepObj=ph.steps[j];break}}
if(!stepObj)return renderPipeline();

var h='<div class="content-area"><div class="content-inner">';
// Breadcrumb
h+='<div class="u-79840ab">';
h+=(UI.navStack&&UI.navStack.length?backBtn():'<button class="btn-ghost u-a2dbf3b" onclick="go(\'pipeline\')">← Pipeline</button>');
h+='<div class="u-463b2e1">Phase '+ph.id+' · '+ph.name+' <span class="t-gold">/ '+stepObj.name+'</span></div>';
h+='</div>';

// Step nav
h+='<div class="step-nav">';
for(var j=0;j<ph.steps.length;j++){var s=ph.steps[j];var done=isStepDone(s.id);
h+='<button class="step-nav-btn'+(currentStep===s.id?' active':'')+(done?' done':'')+'" onclick="go(\'step\',\''+s.id+'\')">';
h+=(done?'✓ ':s.icon+' ')+s.name+'</button>'}
h+='</div>';

// Progress pips
h+='<div class="step-progress">';
for(var j=0;j<ph.steps.length;j++){var s=ph.steps[j];h+='<div class="step-pip'+(currentStep===s.id?' active':isStepDone(s.id)?' done':'')+'" title="'+s.name+'"></div>'}
h+='</div>';

// Header
h+='<div class="step-header">';
h+='<div class="step-eyebrow">Step '+stepObj.id+' · '+ph.days+' · '+ph.name+'</div>';
h+='<h1 class="step-title">'+stepObj.icon+' '+stepObj.name+'</h1>';
h+='</div>';
h+=stepAssignBar(currentStep);

// Step content
h+=renderStepContent(currentStep);

// Milestone
var ms=MILESTONES[currentStep];
if(ms&&isStepDone(currentStep)){
h+='<div class="milestone-card">';
h+='<div class="milestone-label">✓ Milestone Reached</div>';
h+='<div class="milestone-text">'+ms+'</div>';
h+='</div>';
// Phase-complete box: this step is the phase's final step and every step in the phase is done
var _php=PH.find(function(px){return px.steps.some(function(sx){return sx.id===currentStep})});
if(_php&&PHASE_WRAPUPS[_php.id]&&_php.steps[_php.steps.length-1].id===currentStep&&_php.steps.every(function(sx){return isStepDone(sx.id)})){
h+='<div class="milestone-card">';
h+='<div class="milestone-label">\u2713 Phase '+_php.id+' Complete</div>';
h+='<div class="milestone-text">'+PHASE_WRAPUPS[_php.id]+'</div>';
h+='</div>';
}
}

// Navigation
var allSteps=[];for(var i=0;i<PH.length;i++)for(var j=0;j<PH[i].steps.length;j++)allSteps.push(PH[i].steps[j]);
var curIdx=allSteps.findIndex(function(s){return s.id===currentStep});
h+='<div class="u-2135eb3">';
if(curIdx>0){var prev=allSteps[curIdx-1];h+='<button class="btn-ghost" onclick="go(\'step\',\''+prev.id+'\')">← '+prev.name+'</button>'}else{h+='<div></div>'}
if(curIdx<allSteps.length-1){var next=allSteps[curIdx+1];h+='<button class="btn-gold" onclick="go(\'step\',\''+next.id+'\')">'+next.name+' →</button>'}
h+='</div>';

h+='</div></div>';
return h;
}

// === PIPELINE STEP FUNCTIONS ===
// Step content is rendered by re-skinned pipeline module functions.
// The master's renderStep() provides the shell (breadcrumb, step nav, progress pips, header, context, nav buttons).
// renderStepContent() routes to the pipeline's step renderers.

function renderStepContentBody(id){
  if(id==='1.1')return renderStep11();
  if(id==='1.2')return renderStep12();
  if(id==='1.3')return renderStep13();
  if(id==='2.1')return renderStep21();
  if(id==='2.2')return renderStep22();
  if(id==='2.3')return renderStep23();
  if(id==='2.4')return renderStep24();
  if(id==='3.1')return renderStep31();
  if(id==='3.2')return renderStepCap();
  if(id==='3.3')return renderStepAlloc();
  if(id==='3.4')return renderStepExp();
  if(id==='4.1')return renderStep41();
  if(id==='4.2')return renderStep42();
  if(id==='4.3')return renderStep43();
  if(id==='4.4')return renderStep44();
  if(id==='5.1')return renderPhase5Content();
  return '<p class="inline-stone">Coming soon.</p>';
}

// ═══════════════════════════════════════
// PIPELINE MODULE FUNCTIONS (re-skinned)
// === PIPELINE OVERVIEW ===
function renderPipelineOverview(){
var h='<div class="pt-100"><div class="wrap u-54bc797">';
h+='<div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
h+=backBtn()?'<div class="mb-3">'+backBtn()+'</div>':'';
h+='<div class="overview-video-card mb-6"><div class="overview-video-label">Module Overview</div>'
 +'<video class="overview-video" controls preload="auto" playsinline><source src="'+MEDIA_BASE+'innov-module-overview.mp4" type="video/mp4">Your browser does not support embedded video.</video></div>';
h+=vizTimeline(0);
h+='<div class="u-4d06b89">'+badge('90-Day Module','#1B6B5A')+'<h1 class="u-da9c7f5">Build Your AI <em class="t-blue">Innovation Pipeline</em></h1><p class="u-c9b7d79">From standing start to functioning pipeline in 90 days.</p></div>';h+=vizStatStrip();
// Phase cards
PH.forEach(function(ph){
h+=card('<div class="u-1390122" onclick="go(\'phase-'+ph.id+'\')"><div><div class="flx-center gap-2 mb-1"><span class="ph-circle-28" style="--c:'+ph.color+'">'+ph.id+'</span><h3 class="u-a5b9245">'+ph.name+'</h3>'+badge(ph.days,ph.color)+'</div><div class="u-d9edac8">'+ph.steps.map(function(s){return s.name}).join(' \u2192 ')+'</div></div><span class="u-ef4626c">\u2192</span></div>','margin-bottom:12px')});
h+='</div></div></div>';return h}

// ═══════════════════════════════════════
// === STATE MANAGEMENT ===
// go() handled by master
function esc(s){return s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function val(id){var e=$(id);return e?e.value:''}
function updObj(base,field,val){if(!data[base])data[base]={};data[base][field]=val;Store.commit(base,field);render()}
function updNested(base,idx,field,val,silent){if(!data[base])data[base]={};if(!data[base][idx])data[base][idx]={};data[base][idx][field]=val;Store.commit(base,idx);if(!silent)render()}

// === PHASE data ===
// PH in master data

// STEP_CTX in master data

// STEP_MILES in master data

var PHASE_DESCS={
1:{n:'Before you build anything, you need to see clearly where you stand. These first thirty days are for diagnosis, not action \u2014 you won\u2019t buy a tool or launch a project yet. You\u2019ll map your purpose, your culture, your current spending, and who actually holds the authority to decide. The ground you build on determines whether anything you build will stand.',arts:[{t:'90 Days to an AI Innovation Pipeline',s:'Fast Company'},{t:'The right (and wrong) way for leaders to think about AI',s:'Fast Company'},{t:'The dual challenge of AI',s:'I by IMD'}]},
2:{n:'You\u2019ve mapped the ground. Now you build the machinery that gives your ideas somewhere to succeed. Nothing launches in this phase \u2014 the point is to put the structure in place first: clear ownership, incentives that reward the right behavior, and a protected rhythm for looking forward. Your culture won\u2019t change because you drew a new org chart. It changes when you shift what the organization values.',arts:[{t:'Three myths that undermine AI success',s:'Fast Company'},{t:'The age of AI requires a new kind of leadership',s:'Fast Company'}]},
3:{n:'The infrastructure is in place. Now you load the portfolio and get your first projects ready to launch. Hold on to the idea that matters most in the whole program: treat your initiatives as an interconnected investment portfolio, not a to-do list. Most organizations don\u2019t have an idea problem \u2014 they have a portfolio problem. You\u2019ll build a deliberate mix across time horizons, fund it with discipline, and design your first experiments to launch.',arts:[{t:'Transform your AI adoption strategy',s:'I by IMD'},{t:'7 things every leader must do to prepare for 2026',s:'Fast Company'}]},
4:{n:'The machinery is built and the portfolio is loaded. This is the final stretch, where the plan becomes reality. You\u2019ll launch your first experiments, establish the governance that outlasts these ninety days, stress-test how your organization is holding up, and run your first portfolio review. Early, visible results are the strongest antidote there is to organizational paralysis \u2014 so pay close attention to what breaks, because the failure points show you where your real constraints are.',arts:[{t:'When it comes to AI, innovation isn\'t enough',s:'Fast Company'},{t:'If you want to get AI right, look past the technology',s:'Fast Company'}]}
};

var STEP_FLOW={1:[{id:'1.1',icon:'▒',sh:'Assess'},{id:'1.2',icon:'◇',sh:'Brainstorm'},{id:'1.3',icon:'◉',sh:'Filter'}],2:[{id:'2.1',icon:'○',sh:'Ownership'},{id:'2.2',icon:'◯',sh:'Incentives'},{id:'2.3',icon:'↻',sh:'Rhythm'},{id:'2.4',icon:'◉',sh:'Deepen'}],3:[{id:'3.1',icon:'▶',sh:'Structure'},{id:'3.2',icon:'▦',sh:'Capacity'},{id:'3.3',icon:'◻',sh:'Capital'},{id:'3.4',icon:'△',sh:'Map Track'}],4:[{id:'4.1',icon:'\u25b6',sh:'Run Track'},{id:'4.2',icon:'—',sh:'Governance'},{id:'4.3',icon:'✕',sh:'Stress Test'},{id:'4.4',icon:'■',sh:'Review'}]};

// === HELPERS ===
function triageScore(i){var a=(data.assessments||{})[i];if(!a)return 0;return(a.priority||0)+(a.risk||0)+(a.value||0)+(a.costScore||0)+(a.difficulty||0)}
function getScore(i){var p=(data.projects||{})[i],a=(data.assessments||{})[i]||{};if(p&&p.rescore3&&p.rescore3Done){var q=p.rescore3;return(q.priority!=null?q.priority:(a.priority||0))+(q.risk!=null?q.risk:(a.risk||0))+(q.value!=null?q.value:(a.value||0))+(q.costScore!=null?q.costScore:(a.costScore||0))+(q.difficulty!=null?q.difficulty:(a.difficulty||0))}if(p&&p.rescore&&p.rescoreDone){var r=p.rescore;return(r.priority!=null?r.priority:(a.priority||0))+(r.risk!=null?r.risk:(a.risk||0))+(r.value!=null?r.value:(a.value||0))+(r.costScore!=null?r.costScore:(a.costScore||0))+(r.difficulty!=null?r.difficulty:(a.difficulty||0))}return triageScore(i)}
function resolveBands(i,stage){var pb=(data.portfolio||{})[i]||{};
if(stage==='bluesky'){var s1=suggestedBands(i);return{h:s1.horizon,r:s1.risk,w:s1.reward,conf:true}}
var graded=!!(pb.horizon&&pb.risk&&pb.reward);
if(graded)return{h:pb.horizon,r:pb.risk,w:pb.reward,conf:true};
var s2=suggestedBands(i);return{h:pb.horizon||s2.horizon,r:pb.risk||s2.risk,w:pb.reward||s2.reward,conf:false}}
function balanceFlags(res){if(res.length<3)return[];var f=[];
var cnt=function(k,v){return res.filter(function(x){return x[k]===v}).length};
var nd=function(k){return res.filter(function(x){return !!x[k]}).length};
if(nd('h')>=3&&cnt('h','quick')===0)f.push('No quick wins in the mix \u2013 nothing delivers near-term value.');
if(nd('w')>=3&&cnt('w','high')===0)f.push('No high-reward bets in the mix.');
[['h','quick','quick-win'],['h','medium','medium-term'],['h','long','long-horizon'],['r','high','high-risk'],['r','low','low-risk'],['w','low','low-reward']].forEach(function(d){var c=cnt(d[0],d[1]),m=nd(d[0]);if(c>=2&&m>=3&&c*3>=m*2)f.push('Concentrated: '+c+' of '+m+' are '+d[2]+'.')});
return f}
function balanceFlagPop(site,fl){if(!fl||!fl.length)return'';if(!UI.balDismissed)UI.balDismissed={};var key=site+'|'+fl.join('|');if(UI.balDismissed[key])return'';
return'<div class="bal-pop-wrap" data-balkey="'+esc(key)+'" style="position:absolute;left:0;top:0;right:0;bottom:0;display:flex;visibility:hidden;align-items:center;justify-content:center;z-index:6;background:rgba(26,22,18,.55);border-radius:12px">'
+'<div style="max-width:400px;margin:0 16px;background:var(--bg-elev);border:1px solid var(--warn-text);border-radius:10px;padding:18px 20px;box-shadow:0 10px 32px rgba(0,0,0,.5)">'
+'<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:var(--warn-text);margin-bottom:8px">\u26a0 PORTFOLIO BALANCE</div>'
+fl.map(function(t){return'<p style="font-size:13px;line-height:1.5;color:var(--paper);margin:4px 0">'+esc(t)+'</p>'}).join('')
+'<button class="btn-gold" style="margin-top:12px;padding:8px 18px;font-size:13px" onclick="dismissBalPop(this)">Got it</button>'
+'</div></div>'}
function balanceHead(fl,stage){var _bt=({explore:'Exploration Portfolio Balance',experiment:'Development Portfolio Balance',operational:'Operational Portfolio Balance',bluesky:'Blue Sky Portfolio Balance'})[stage]||'Portfolio Balance';var w=(fl&&fl.length)?'<div class="h-sub-md" style="color:#9B2D3F;margin:0;flex:1;text-align:right">\u26a0 '+fl.map(function(t){return esc(t)}).join(' \u00b7 ')+'</div>':'';
return'<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px"><h3 class="h-sub-md" style="margin:0">'+_bt+'</h3>'+w+'</div>'}
function initBalancePops(){if(typeof document==='undefined')return;if(!UI.balDismissed)UI.balDismissed={};
var els=document.querySelectorAll('.bal-pop-wrap');if(!els.length)return;
var show=function(el){el.style.visibility='visible'};
if(!window.IntersectionObserver){for(var i=0;i<els.length;i++)show(els[i]);return}
var ob=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting){show(en.target);ob.unobserve(en.target)}})},{threshold:0.35});
for(var j=0;j<els.length;j++)ob.observe(els[j])}
function dismissBalPop(btn){if(!UI.balDismissed)UI.balDismissed={};var w=btn;while(w&&(' '+w.className+' ').indexOf(' bal-pop-wrap ')<0)w=w.parentNode;if(!w)return;UI.balDismissed[w.getAttribute('data-balkey')]=1;w.style.visibility='hidden';w.style.display='none'}
function balancePanel(items,stage){if(!items||!items.length)return'';
var _q='';
if(stage==='explore'){var _pj2=data.projects||{},_pt2=data.portfolio||{};var _all2=items;
items=items.filter(function(i){var pb3=_pt2[i]||{};return(_pj2[i]||{}).viable===true&&pb3.horizon&&pb3.risk&&pb3.reward});
var _inc2=_all2.filter(function(i){return(_pj2[i]||{}).viable!==true}).length;
var _aw2=_all2.length-items.length-_inc2;
if(_aw2||_inc2)_q='<p class="t-faint-sm" style="margin-top:6px">'+(_aw2?_aw2+' awaiting portfolio grading':'')+(_aw2&&_inc2?' \u00b7 ':'')+(_inc2?_inc2+' incomplete':'')+'</p>';
if(!items.length)return'';}
var res=items.map(function(i){return resolveBands(i,stage)});
var rows=[['Time horizon','h',[['quick','Quick'],['medium','Medium'],['long','Long']],'#8B5E3C'],['Risk','r',[['low','Low'],['medium','Medium'],['high','High']],'#9B2D3F'],['Reward','w',[['low','Low'],['medium','Medium'],['high','High']],'#1B6B5A']];
var tot=res.length;
var bars=rows.map(function(row){return'<div style="margin-bottom:10px"><div class="h-card-lg" style="margin-bottom:4px">'+row[0].toUpperCase()+'</div><div style="display:flex;gap:10px">'+row[2].map(function(b){
var c=res.filter(function(x){return x.conf&&x[row[1]]===b[0]}).length;
var p=res.filter(function(x){return !x.conf&&x[row[1]]===b[0]}).length;
var cw=Math.round(c/tot*100),pw=Math.round(p/tot*100);
return'<div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="t-faint-sm" style="font-size:10px">'+b[1]+'</span><span class="t-faint-sm" style="font-size:10px">'+c+(p?' (+'+p+')':'')+'</span></div><div style="height:8px;border-radius:4px;background:rgba(var(--fg-rgb),.06);overflow:hidden;display:flex"><div style="width:'+cw+'%;background:'+row[3]+'"></div><div style="width:'+pw+'%;background:'+row[3]+';opacity:.35"></div></div></div>'}).join('')+'</div></div>'}).join('');
var sub=stage==='bluesky'?'From intake estimates \u2013 timeframe, triage risk and value.':stage==='explore'?'Graded projects only \u2013 the structured portfolio.':'Solid = positioned \u00b7 faded = provisional (suggested from assessments).';
var queue=_q;
var fl=balanceFlags(res);
var flh=balanceFlagPop('bp_'+stage,fl);
return card(balanceHead(fl,stage)+'<p class="t-faint-sm" style="margin-bottom:10px">'+sub+'</p>'+bars+queue+flh,'margin-bottom:16px;position:relative')}
function vizBalanceMap(){var st=getStages();
var items=[].concat(st.explore||[],st.experiment||[],st.operational||[]);
if(!items.length)return'';
var res=[],skip=0;
items.forEach(function(i){var r=resolveBands(i,'map');if(r.h&&r.r&&r.w)res.push(r);else skip++});
if(!res.length)return'';
var X={low:0,medium:1,high:2},Y={high:0,medium:1,low:2},HC={quick:'#1B6B5A',medium:'#8B5E3C',long:'#2D5A8E'};
var L=70,T=16,CW=110,CH=78,W=L+3*CW+82,H=T+3*CH+76;
var s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:'+W+'px;display:block">';
var cx,cy;
for(cx=0;cx<3;cx++)for(cy=0;cy<3;cy++)s+='<rect x="'+(L+cx*CW)+'" y="'+(T+cy*CH)+'" width="'+CW+'" height="'+CH+'" fill="rgba(245,242,236,.03)" stroke="rgba(245,242,236,.08)"/>';
var cols=['Low','Medium','High'],rows=['High','Medium','Low'];
for(cx=0;cx<3;cx++)s+='<text x="'+(L+cx*CW+CW/2)+'" y="'+(T+3*CH+18)+'" text-anchor="middle" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">'+cols[cx]+'</text>';
s+='<text x="'+(L+1.5*CW)+'" y="'+(T+3*CH+36)+'" text-anchor="middle" fill="#8A8278" font-size="10" letter-spacing="1" font-family="var(--sans,Helvetica Neue,sans-serif)">RISK</text>';
for(cy=0;cy<3;cy++)s+='<text x="'+(L-8)+'" y="'+(T+cy*CH+CH/2+4)+'" text-anchor="end" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">'+rows[cy]+'</text>';
s+='<text x="14" y="'+(T+1.5*CH)+'" text-anchor="middle" fill="#8A8278" font-size="10" letter-spacing="1" font-family="var(--sans,Helvetica Neue,sans-serif)" transform="rotate(-90 14 '+(T+1.5*CH)+')">REWARD</text>';
var cells={};res.forEach(function(r){var k=X[r.r]+'_'+Y[r.w];(cells[k]=cells[k]||[]).push(r)});
Object.keys(cells).forEach(function(k){var p=k.split('_'),gx=+p[0],gy=+p[1],arr=cells[k];
var show=arr.length>6?5:arr.length;
for(var j=0;j<show;j++){var d=arr[j],dx=L+gx*CW+24+(j%3)*28,dy=T+gy*CH+22+Math.floor(j/3)*30;
s+=d.conf?'<circle cx="'+dx+'" cy="'+dy+'" r="8" fill="'+HC[d.h]+'"/>':'<circle cx="'+dx+'" cy="'+dy+'" r="7" fill="none" stroke="'+HC[d.h]+'" stroke-width="2"/>'}
if(arr.length>6)s+='<text x="'+(L+gx*CW+24+56)+'" y="'+(T+gy*CH+56)+'" fill="#F5F2EC" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">+'+(arr.length-5)+'</text>'});
var ly=H-12;
s+='<circle cx="'+L+'" cy="'+ly+'" r="6" fill="#1B6B5A"/><text x="'+(L+12)+'" y="'+(ly+4)+'" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Quick win</text>';
s+='<circle cx="'+(L+100)+'" cy="'+ly+'" r="6" fill="#8B5E3C"/><text x="'+(L+112)+'" y="'+(ly+4)+'" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Medium-term bet</text>';
s+='<circle cx="'+(L+222)+'" cy="'+ly+'" r="6" fill="#2D5A8E"/><text x="'+(L+234)+'" y="'+(ly+4)+'" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Long-term</text>';
s+='<circle cx="'+(L+330)+'" cy="'+ly+'" r="6" fill="none" stroke="#8A8278" stroke-width="2"/><text x="'+(L+342)+'" y="'+(ly+4)+'" fill="#8A8278" font-size="11" font-family="var(--sans,Helvetica Neue,sans-serif)">Provisional</text>';
s+='</svg>';
var note=skip?'<p class="t-faint-sm" style="margin-top:6px">'+skip+' project'+(skip>1?'s':'')+' not yet placeable \u2013 add triage scores or grades.</p>':'';
var fl=balanceFlags(res);
var flh=balanceFlagPop('map',fl);
return card(balanceHead(fl)+'<p class="t-faint-sm" style="margin-bottom:10px">Exploration, Development, and Operational projects \u00b7 solid = positioned \u00b7 hollow = provisional.</p>'+s+note+flh,'margin-bottom:16px;position:relative')}
function suggestedBands(i){var p=(data.projects||{})[i]||{},a=(data.assessments||{})[i]||{},idea=(data.ideas||[])[i]||{};
var rs=p.rescore||{};
var riskV=typeof rs.risk==='number'?rs.risk:(typeof a.risk==='number'?a.risk:0);
var valV=typeof rs.value==='number'?rs.value:(typeof a.value==='number'?a.value:0);
var tf=String(idea.timeframe||'');
var hz=tf.indexOf('1-3')===0?'quick':tf.indexOf('3-6')===0?'medium':tf.indexOf('6-12')===0?'long':tf.indexOf('12')===0?'long':'';
var inv=riskV>0?(10-riskV):0;
return{horizon:hz,risk:riskV>0?(inv>=7?'high':inv>=4?'medium':'low'):'',reward:valV>0?(valV>=7?'high':valV>=4?'medium':'low'):''}}
function setNoGoFromExplore(i){if(lockBlocked('projects::'+i))return;if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};data.projects[i].viable=false;data.projects[i].assessed=true;data.capStale=true;Store.commit('projects',i);Store.commit('capStale');render()}
function isArchived(i){return !!((data.archivedItems||{})[i])}
function archiveItem(i){var st=getStages();var stage=st.bluesky.indexOf(i)>=0?'bluesky':st.explore.indexOf(i)>=0?'explore':st.experiment.indexOf(i)>=0?'experiment':(st.operational||[]).indexOf(i)>=0?'operational':st.noGo.indexOf(i)>=0?'noGo':'bluesky';if(!data.archivedItems)data.archivedItems={};data.archivedItems[i]={stage:stage,at:Date.now()};data.capStale=true;Store.commit('archivedItems',i);Store.commit('capStale');render()}
function reviveItem(i){var rec=(data.archivedItems||{})[i];if(rec&&rec.stage==='noGo'){var si=(data.selected||[]).indexOf(i);if(si>=0){data.selected.splice(si,1);Store.commit('selected')}if((data.projects||{})[i]){delete data.projects[i];Store.commit('projects',i)}}/* a noGo revive returns the item to bluesky - it used to land back in noGo, invisible and un-reselectable (QA sweep 2, July 9) */if(data.archivedItems)delete data.archivedItems[i];data.capStale=true;Store.commit('archivedItems',i);Store.commit('capStale');render()}
function archBtn(i,label){var msg=label==='Sunset'?'Sunset this project? It moves to the Operational archive.':'Archive this item? Revive it anytime from the Archive tab.';return'<button onclick="event.stopPropagation();if(confirm(\''+msg+'\'))archiveItem('+i+')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.15);background:rgba(var(--fg-rgb),.04);color:var(--text-faint)">\u2715 '+(label||'Archive')+'</button>'}
function notAdvPanel(pid){var stages=getStages(),ideas=data.ideas||[],proj=data.projects||{};if(!stages.noGo.length)return'';var open=!!UI.expanded['notadv'+pid];
var h='<div class="u-3ae1f62"><button class="btn-ghost pad-chip-sm" style="color:#9B2D3F;border-color:rgba(155,45,63,.4)" onclick="UI.expanded[\'notadv'+pid+'\']=!UI.expanded[\'notadv'+pid+'\'];render()">'+(open?'\u25be':'\u25b8')+' Not Advancing ('+stages.noGo.length+')</button>';
if(open)stages.noGo.forEach(function(i){h+='<div class="u-27c7109" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1;min-width:140px">'+esc((ideas[i]||{}).name)+'</span><input id="pjr_'+i+'" value="'+esc((proj[i]||{}).noGoReason||'')+'" placeholder="Reason (required to resolve Step 2.4)" onchange="fldSave(this.id,this.value)" class="row-input" style="flex:2;min-width:200px"/><button onclick="event.stopPropagation();reconsiderNoGo('+i+')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(45,90,142,.4);background:rgba(45,90,142,.06);color:#2D5A8E">\u21a9 Reconsider</button>'+archBtn(i)+'</div>'});return h+'</div>'}
function archivePanel(stageKeys,pid){var arch=data.archivedItems||{},ideas=data.ideas||[];var ks=Object.keys(arch).filter(function(k){return stageKeys.indexOf(arch[k].stage)>=0});var open=!!UI.expanded['arch'+pid];
var h='<div style="margin-top:18px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'arch'+pid+'\']=!UI.expanded[\'arch'+pid+'\'];render()">'+(open?'\u25be':'\u25b8')+' Archive ('+ks.length+')</button>';
if(open){if(!ks.length)h+='<p class="t-faint-sm" style="margin-top:8px">Nothing archived from this portfolio.</p>';
else h+=ks.map(function(k){var idea=ideas[k]||{};var a=arch[k];return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(idea.name||('Item '+k))+'</span><span class="t-faint-sm">'+fmtDate(a.at)+'</span><button onclick="reviveItem('+k+')" style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(27,107,90,.5);background:rgba(27,107,90,.08);color:#1B6B5A">\u21ba Revive</button></div>'}).join('')}
return h+'</div>'}
function bsNowList(st){var id=data.ideas||[];return(st.bluesky||[]).filter(function(i){return(id[i]||{}).when!=='future'})}
/* ── Capital engine: commitments are DERIVED from current stage membership and
   per-project costs. Nothing is debited; advancing, launching, killing, or
   archiving a project changes the numbers because the state changed.
   Rules (three-field model, July 2; continuity ruled July 5): killed items release their
   commitment; paused experiments hold it. Development commits Development Costs; Operational
   commits Development plus Rollout while those one-time phases run (no plan: the first year
   after launch; no launch date = first year), then Annual Sustainment Costs from the month
   rollout ends or the later start a budget plan sets. */
function costNum(v){return parseBudget(v||'')}
/* costEchoTxt retired July 9 (QA sweep 2, item 10): the Reads-as echo doubled the derived figures - the derivation lock and blur re-renders carry the confirmation now */
function projCosts(i){var p=(data.projects||{})[i]||{};return{start:costNum(p.startupCost),roll:costNum(p.rolloutCost),run:costNum(p.runningCost)}}
/* ── Budget plans (redesign chunk A, July 3): step-based, project-relative months.
   Replaces the year-bucket cost-profile layer. dev/roll are step tables {id,name,desc,from,to,
   cost} – a step's whole cost is averaged across its months. sus is a list of phases
   {id,name,from,to|'ongoing',items:[{id,name,cost}]} whose ANNUAL rate derives from its
   items. Months are project-relative, never calendar-anchored. Two year lenses: PROJECT
   years (ceil(m/12), used by the org projection) and OPERATIONAL years (12-month windows
   anchored at bpFirstOpMonth, used by the commitment engine so the first-year-inside-
   Rollout doctrine survives the month model). */
function bpGet(i){return (data.budgetPlans||{})[i]||null}
function bpEnsure(i){if(!data.budgetPlans)data.budgetPlans={};if(!data.budgetPlans[i])data.budgetPlans[i]={horizon:'3',contingency:'',dev:[],roll:[],sus:[],notes:{}};return data.budgetPlans[i]}
function bpHorizon(i){var p=bpGet(i);var n=p?parseInt(p.horizon,10):3;return(n===4||n===5)?n:3}
function bpRows(i,k){var p=bpGet(i);return(p&&p[k])?p[k]:[]}
function bpStepMoney(sBp){return costNum((sBp||{}).cost)}
function bpStepSpan(sBp){var a=parseInt((sBp||{}).from,10),b=parseInt((sBp||{}).to,10);if(!a||!b||b<a||a<1)return null;return[a,b]}
function bpDevTotal(i){return bpRows(i,'dev').reduce(function(t,x){return t+bpStepMoney(x)},0)}
function bpRollTotal(i){return bpRows(i,'roll').reduce(function(t,x){return t+bpStepMoney(x)},0)}
function bpPhaseAnnual(ph){return((ph||{}).items||[]).reduce(function(t,it){return t+costNum((it||{}).cost)},0)}
function bpPhaseSpan(ph){var a=parseInt((ph||{}).from,10);if(!a||a<1)return null;var ong=(ph.to==='ongoing'||ph.to==null||ph.to==='');var b=ong?Infinity:parseInt(ph.to,10);if(!ong&&(!b||b<a))return null;return[a,b]}
function bpHasDev(i){return bpDevTotal(i)>0}
function bpHasRoll(i){return bpRollTotal(i)>0}
function bpHasSus(i){return bpRows(i,'sus').some(function(ph){return bpPhaseAnnual(ph)>0&&!!bpPhaseSpan(ph)})}
function bpHasAny(i){return bpHasDev(i)||bpHasRoll(i)||bpHasSus(i)}
/* Money-path eligibility (ruled July 9): only rows that land on the calendar count toward committed
   totals. bpHasAny/bpHasDev/bpHasRoll stay the display and lock predicates - a plan with money shows
   its surfaces and locks its simple fields even before dates are set; the ledger waits for dates. */
function bpDatedTotal(i,k){return bpRows(i,k).reduce(function(t,x){var c=bpStepMoney(x);return t+((c&&bpStepSpan(x))?c:0)},0)}
function bpDevLive(i){return bpDatedTotal(i,'dev')>0}
function bpRollLive(i){return bpDatedTotal(i,'roll')>0}
function bpPlanLive(i){return bpDevLive(i)||bpRollLive(i)||bpHasSus(i)}
function bpUndatedRows(i){var out=[];['dev','roll'].forEach(function(k){bpRows(i,k).forEach(function(x){if(bpStepMoney(x)&&!bpStepSpan(x))out.push((x||{}).name||'Unnamed step')})});return out}
function bpUndatedWarn(i){var u=bpUndatedRows(i);if(!u.length)return'';return u.map(function(n){return'<div class="t-faint-sm" style="color:var(--warn-text);margin:2px 0">\u26a0 Phase date ranges not set \u2013 '+esc(n)+' is not contributing to committed totals</div>'}).join('')}
function bpOverlap(a,b,lo,hi){return Math.max(0,Math.min(b,hi)-Math.max(a,lo)+1)}
function bpCatYear(i,k,y){var lo=(y-1)*12+1,hi=y*12,t=0;bpRows(i,k).forEach(function(x){var c=bpStepMoney(x),sp=bpStepSpan(x);if(!c||!sp)return;var ov=bpOverlap(sp[0],sp[1],lo,hi);if(ov)t+=c*ov/(sp[1]-sp[0]+1)});return Math.round(t)}
function bpSusWindow(i,lo,hi){var t=0;bpRows(i,'sus').forEach(function(ph){var r=bpPhaseAnnual(ph),sp=bpPhaseSpan(ph);if(!r||!sp)return;var ov=bpOverlap(sp[0],sp[1],lo,hi);if(ov)t+=r*ov/12});return Math.round(t)}
function bpSusYear(i,y){return bpSusWindow(i,(y-1)*12+1,y*12)}
function bpSusSteady(i){var t=0;bpRows(i,'sus').forEach(function(ph){if(bpPhaseSpan(ph)&&(ph.to==='ongoing'||ph.to==null||ph.to===''))t+=bpPhaseAnnual(ph)});return t}
function bpSusStartMonth(i){var m=Infinity;bpRows(i,'sus').forEach(function(ph){var sp=bpPhaseSpan(ph);if(sp&&bpPhaseAnnual(ph)&&sp[0]<m)m=sp[0]});return m===Infinity?0:m}
function bpFirstOpMonth(i){var last=0;['dev','roll'].forEach(function(k){bpRows(i,k).forEach(function(x){var sp=bpStepSpan(x);if(sp&&bpStepMoney(x)&&sp[1]>last)last=sp[1]})});if(last)return last+1;return bpSusStartMonth(i)||1}
function bpSusOpYear(i,opY){var a=bpFirstOpMonth(i)+12*(opY-1);return bpSusWindow(i,a,a+11)}
function bpSusStartOpYear(i){var sm=bpSusStartMonth(i);if(!sm)return 0;return Math.max(1,Math.floor((sm-bpFirstOpMonth(i))/12)+1)}
function bpMonthly(i){var M=bpHorizon(i)*12,out=[],m;for(m=1;m<=M;m++)out.push({m:m,dev:0,roll:0,sus:0});
['dev','roll'].forEach(function(k){bpRows(i,k).forEach(function(x){var c=bpStepMoney(x),sp=bpStepSpan(x);if(!c||!sp)return;var per=c/(sp[1]-sp[0]+1);for(m=Math.max(1,sp[0]);m<=Math.min(M,sp[1]);m++)out[m-1][k]+=per})});
bpRows(i,'sus').forEach(function(ph){var r=bpPhaseAnnual(ph),sp=bpPhaseSpan(ph);if(!r||!sp)return;for(m=Math.max(1,sp[0]);m<=Math.min(M,sp[1]===Infinity?M:sp[1]);m++)out[m-1].sus+=r/12});
return out}
function hzPlanStarted(){var cap=data.capital||{};return !!(String(cap.aiBudget||'').trim()||String(cap.envYears||'').trim())}
function hzMismatch(i){if(!hzPlanStarted())return 0;if(!bpHasAny(i))return 0;var H=bpHorizon(i),E=envYearsOf();return H>E?E:0}
function hzWarnText(E){return'This project\u2019s lifetime extends beyond the organization\u2019s financial planning horizon of '+E+' years. Bring it into line on the project card or extend the planning horizon at Step 3.2.'}
function hzList(){if(!hzPlanStarted())return[];var out=[],ideas=data.ideas||[];Object.keys(data.budgetPlans||{}).forEach(function(k){var i=parseInt(k,10);if(isNaN(i)||isArchived(i))return;if(hzMismatch(i))out.push({i:i,name:(ideas[i]||{}).name||('Item '+i),H:bpHorizon(i)})});return out}
function hzReconcilePanel(){var L=hzList();if(!L.length)return'';
return'<div style="border:1px solid rgba(201,64,59,.45);background:rgba(201,64,59,.07);border-radius:8px;padding:10px 12px;margin:10px 0 4px"><p style="color:#C9403B;font-size:12.5px;font-weight:600;margin:0 0 6px">\u26a0 The following projects were assigned lifetimes longer than this planning horizon \u2013 reconcile each on its project card, or extend the horizon:</p>'+L.map(function(x){return'<div class="fs-13" style="color:var(--text-bright);margin:2px 0">'+esc(x.name)+' <span class="t-faint-sm">('+x.H+' years)</span></div>'}).join('')+'</div>'}
function hzWarn(i,compact){var E=hzMismatch(i);if(!E)return'';
if(compact)return'<span title="'+esc(hzWarnText(E))+'" style="color:#C9403B;font-weight:700;font-size:13px;flex:0 0 auto;cursor:help">\u26a0</span>';
return'<p style="color:#C9403B;font-size:12.5px;font-weight:600;margin:6px 0 8px">\u26a0 '+hzWarnText(E)+'</p>'}
function bpLifetime(i){var t=0;bpMonthly(i).forEach(function(r){t+=r.dev+r.roll+r.sus});return Math.round(t)}
function bpPeakMonth(i){var best=0,bm=0;bpMonthly(i).forEach(function(r){var v=r.dev+r.roll+r.sus;if(v>best+1e-6){best=v;bm=r.m}});return bm}
function bpTabBar(key,i,withAnalyses){UI.cardTab=UI.cardTab||{};var t=UI.cardTab[key]||1;
var tabs=withAnalyses?[[1,'Project Details'],[3,'Analyses'],[2,'Project Budgeting']]:[[1,'Project Details'],[2,'Project Budgeting']];
return'<div style="margin:18px 0 8px;font-size:14px;color:var(--paper)">Choose what you want to work on:</div><div class="flx-g2-wrap" style="margin:0 0 26px">'+tabs.map(function(tb){var on=t===tb[0];
return'<button onclick="UI.cardTab=UI.cardTab||{};UI.cardTab[\''+key+'\']='+tb[0]+';render()" style="padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(on?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.28)')+';background:'+(on?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.05)')+';color:'+(on?'var(--paper)':'var(--text-muted)')+'">'+tb[1]+'</button>'}).join('')+'</div>'}
function bpTabOn(key){UI.cardTab=UI.cardTab||{};return(UI.cardTab[key]||1)===2}
function bpStatBand(i){var big=function(v,l,sub){return'<div class="t-center" style="flex:1;min-width:140px"><div class="score-num-md" style="font-size:26px">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div>'+(sub?'<div class="t-faint-sm">'+sub+'</div>':'')+'</div>'};
if(!bpHasAny(i))return'<div style="display:flex;gap:18px;flex-wrap:wrap;margin:18px 0 18px">'+big('\u2014','Lifetime cost','')+big('\u2014','Development costs','')+big('\u2014','Rollout costs','')+big('\u2014','Annual sustainment costs','')+'</div>';
var H=bpHorizon(i),life=bpLifetime(i),pk=bpPeakMonth(i),fo=bpFirstOpMonth(i),ssv=bpSusSteady(i);var _hzw=hzWarn(i);
var mm=bpMonthly(i);var pkV=pk?Math.round(mm[pk-1].dev+mm[pk-1].roll+mm[pk-1].sus):0;
var h=_hzw+'<div style="display:flex;gap:18px;flex-wrap:wrap;margin:'+(_hzw?'6px':'18px')+' 0 16px">'
+big(fmtMoney(life),'Lifetime cost','across '+H+' years')
+big(fmtMoney(bpDevTotal(i)),'Development costs','')
+big(fmtMoney(bpRollTotal(i)),'Rollout costs','')
+big(ssv?fmtMoney(ssv):'\u2014','Annual sustainment costs','')
+'</div>';
var ct=parseFloat((bpGet(i)||{}).contingency);
if(ct>0)h+='<p class="fs-14" style="margin:0 0 6px">With '+ct+'% contingency: '+fmtMoney(Math.round(life*(1+ct/100)))+' lifetime.</p>';
if(pk)h+='<p class="fs-14" style="margin:0 0 6px">Monthly costs peak at Month '+pk+': '+fmtMoney(pkV)+' per month.</p>';
if(fo)h+='<p class="fs-14" style="margin:0 0 6px">First operational month occurs at Month '+fo+'.</p>';
return h}
function bpStepListRO(i){if(!bpHasAny(i))return'<p class="t-faint-sm" style="margin:12px 0 0">No budget plan yet \u2013 development and rollout steps, sustainment phases, and the spending pictures they draw will be built here.</p>';
var h='';[['dev','DEVELOPMENT PHASES'],['roll','ROLLOUT STEPS']].forEach(function(sec){
var rows=bpRows(i,sec[0]).filter(function(x){return bpStepSpan(x)||bpStepMoney(x)});if(!rows.length)return;
h+='<div class="t-faint-sm" style="margin:14px 0 4px">'+sec[1]+'</div>';
rows.forEach(function(x){var sp=bpStepSpan(x);h+='<div class="fs-14" style="margin-bottom:2px">'+esc(x.name||'\u2014')+(sp?' \u00b7 Months '+sp[0]+'\u2013'+sp[1]:'')+' \u00b7 '+fmtMoney(bpStepMoney(x))+'</div>';
if(x.desc)h+='<div class="t-faint-sm" style="margin:0 0 6px">'+esc(x.desc)+'</div>'})});
var ph=bpRows(i,'sus').filter(function(x){return bpPhaseSpan(x)&&bpPhaseAnnual(x)});
if(ph.length){h+='<div class="t-faint-sm" style="margin:14px 0 4px">SUSTAINMENT PHASES</div>';
ph.forEach(function(x){var sp=bpPhaseSpan(x);h+='<div class="fs-14" style="margin-bottom:2px">'+esc(x.name||'\u2014')+' \u00b7 from Month '+sp[0]+(sp[1]===Infinity?' \u00b7 ongoing':' to Month '+sp[1])+' \u00b7 '+fmtMoney(bpPhaseAnnual(x))+'/yr</div>';
(x.items||[]).forEach(function(it){h+='<div class="t-faint-sm" style="margin:0 0 2px;padding-left:12px">'+esc(it.name||'')+' \u00b7 '+fmtMoney(costNum(it.cost))+'/yr</div>'})})}
return h}
function bpMonthSel(id,val,minM,H,onch,ong){var M=H*12;var h='<select id="'+id+'" onchange="'+onch+'" class="sel-helper" style="width:auto;padding:4px 6px;font-size:12px">';
h+='<option value=""'+(!val?' selected':'')+'>\u2014</option>';
if(ong)h+='<option value="ongoing"'+(val==='ongoing'?' selected':'')+'>Ongoing</option>';
var cur=parseInt(val,10);var top=M;if(cur&&cur>top)top=cur;
for(var m=Math.max(1,minM||1);m<=top;m++)h+='<option value="'+m+'"'+(cur===m?' selected':'')+'>'+m+'</option>';
return h+'</select>'}
function bpAmber(i){var msgs=[];var de=0,rs=Infinity,re=0;
bpRows(i,'dev').forEach(function(x){var sp=bpStepSpan(x);if(sp&&sp[1]>de)de=sp[1]});
bpRows(i,'roll').forEach(function(x){var sp=bpStepSpan(x);if(!sp)return;if(sp[0]<rs)rs=sp[0];if(sp[1]>re)re=sp[1]});
var ss=bpSusStartMonth(i);
if(de&&rs!==Infinity&&rs<=de)msgs.push('Rollout begins in Month '+rs+', before development ends in Month '+de+' \u2013 is this correct?');
if(re&&ss&&ss<=re)msgs.push('Sustainment begins in Month '+ss+', before rollout ends in Month '+re+' \u2013 is this correct?');
return msgs.map(function(m){return'<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">\u26a0 '+m+'</p>'}).join('')}
function bpDescTa(id,val,onch,rows,ph){return'<textarea id="'+id+'" rows="'+(rows||1)+'" placeholder="'+esc(ph||'Describe the step (optional)')+'" onfocus="this.rows=2" onblur="this.rows=1" onchange="'+onch+'" style="width:100%;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08);border-radius:6px;color:inherit;padding:4px 8px;font-size:12px;margin:0 0 8px;font-family:inherit;resize:none">'+esc(val||'')+'</textarea>'}
function bpStepRow(i,sec,r,H,noDesc,noDel){var idb='bps_'+i+'_'+sec+'_'+r.id;var oc=function(f){return"bpRowSave("+i+",'"+sec+"','"+r.id+"','"+f+"',this.value)"};
var h='<div class="flx-g3" style="margin-bottom:2px;align-items:center">';
h+='<input id="'+idb+'_name" value="'+esc(r.name||'')+'" placeholder="Step name" onchange="'+oc('name')+'" class="row-input" style="flex:2"/>';
h+='<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">'+bpMonthSel(idb+'_from',r.from,1,H,oc('from'))+'<span class="t-faint-sm">\u2013</span>'+bpMonthSel(idb+'_to',r.to,Math.max(1,parseInt(r.from,10)||1),H,oc('to'))+'</div>';
h+='<input id="'+idb+'_cost" value="'+esc(r.cost||'')+'" placeholder="$ \u2014" onchange="'+oc('cost')+'" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
h+=(noDel?'':'<button onclick="bpDelStep('+i+',\''+sec+'\',\''+r.id+'\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button>')+'</div>';
if(!noDesc)h+=bpDescTa(idb+'_desc',r.desc,oc('desc'));
return h}
function bpGhostRow(i,sec,g,gn,gc,H){var idb='bpg_'+i+'_'+sec+'_'+g;var oc=function(f){return"bpGhostSave("+i+",'"+sec+"','"+f+"',this.value)"};
var h='<div class="flx-g3" style="margin-bottom:8px;align-items:center;opacity:.6">';
h+='<input id="'+idb+'_name" value="" placeholder="'+esc(gn)+'" onchange="'+oc('name')+'" class="row-input" style="flex:2"/>';
h+='<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">'+bpMonthSel(idb+'_from','',1,H,oc('from'))+'<span class="t-faint-sm">\u2013</span>'+bpMonthSel(idb+'_to','',1,H,oc('to'))+'</div>';
h+='<input id="'+idb+'_cost" value="" placeholder="'+esc(gc)+'" onchange="'+oc('cost')+'" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
h+='<span style="width:26px"></span></div>';
return h}
function bpStepTable(i,sec,title,cap,gp,H,colLabel){colLabel=colLabel||'Step';var p=bpGet(i)||{};var rows=(p[sec]||[]);
var h='<div style="margin:26px 0 2px;font-size:14px;font-weight:700;color:var(--paper);letter-spacing:.02em">'+title+'</div><div class="t-faint-sm" style="margin:0 0 8px">'+cap+'</div>';
h+='<div class="flx-g3" style="margin:0 0 2px"><span class="t-faint-sm" style="flex:2;font-size:14px">'+colLabel+'</span><span class="t-faint-sm" style="flex:0 0 136px;font-size:14px">Months</span><span class="t-faint-sm" style="flex:0 0 140px;font-size:14px">Cost (whole '+colLabel.toLowerCase()+')</span><span style="width:26px"></span></div>';
rows.forEach(function(r){if(r)h+=bpStepRow(i,sec,r,H)});
for(var g=rows.length;g<2;g++)h+=bpGhostRow(i,sec,g,gp[g%gp.length][0],gp[g%gp.length][1],H);
h+='<div style="margin:6px 0 18px">'+btn('+ Add '+colLabel.toLowerCase(),'bpAddStep('+i+',\''+sec+'\')','bg2','font-size:11px;padding:3px 10px')+'</div>';
h+='<div class="mb-4"><div style="font-size:14px;color:var(--text-faint);margin-bottom:6px">Notes</div><textarea id="bpn_'+i+'_'+sec+'" rows="2" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="Assumptions, vendors, dependencies \u2013 anything that explains these numbers">'+esc((p.notes||{})[sec]||'')+'</textarea></div>';
return h}
function bpPhaseBlock(i,ph,H){var idb='bps_'+i+'_sus_'+ph.id;var oc=function(f){return"bpPhSave("+i+",'"+ph.id+"','"+f+"',this.value)"};
var h='<div class="flx-g3" style="margin-bottom:2px;align-items:center">';
h+='<input id="'+idb+'_name" value="'+esc(ph.name||'')+'" placeholder="Phase name" onchange="'+oc('name')+'" class="row-input" style="flex:2"/>';
h+='<div style="display:flex;gap:4px;align-items:center;flex:0 0 136px">'+bpMonthSel(idb+'_from',ph.from,1,H,oc('from'))+'<span class="t-faint-sm">\u2013</span>'+bpMonthSel(idb+'_to',ph.to,Math.max(1,parseInt(ph.from,10)||1),H,oc('to'),true)+'</div>';
h+='<span class="row-input" style="flex:0 0 140px;width:140px;text-align:left;background:rgba(var(--fg-rgb),.03);color:var(--paper)">'+(bpPhaseAnnual(ph)?fmtMoney(bpPhaseAnnual(ph))+'/yr':'\u2014')+'</span>';
h+='<button onclick="bpDelPhase('+i+',\''+ph.id+'\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button></div>';
(ph.items||[]).forEach(function(it){if(!it)return;var ib='bps_'+i+'_susit_'+ph.id+'_'+it.id;var oi=function(f){return"bpItemSave("+i+",'"+ph.id+"','"+it.id+"','"+f+"',this.value)"};
h+='<div class="flx-g3" style="margin-bottom:2px;padding-left:14px;align-items:center">';
h+='<input id="'+ib+'_name" value="'+esc(it.name||'')+'" placeholder="e.g. Hosting & licenses" onchange="'+oi('name')+'" class="row-input" style="flex:2"/>';
h+='<input id="'+ib+'_cost" value="'+esc(it.cost||'')+'" placeholder="$ \u2014 per year" onchange="'+oi('cost')+'" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
h+='<button onclick="bpDelItem('+i+',\''+ph.id+'\',\''+it.id+'\')" class="btn-ghost pad-chip-sm" style="width:26px;padding:2px">\u2715</button></div>'});
var gb='bpg_'+i+'_susit_'+ph.id;var og=function(f){return"bpGhostItem("+i+",'"+ph.id+"','"+f+"',this.value)"};
h+='<div class="flx-g3" style="margin-bottom:2px;padding-left:14px;align-items:center;opacity:.6">';
h+='<input id="'+gb+'_name" value="" placeholder="e.g. Hosting & licenses" onchange="'+og('name')+'" class="row-input" style="flex:2"/>';
h+='<input id="'+gb+'_cost" value="" placeholder="e.g. $60K per year" onchange="'+og('cost')+'" class="row-input" style="flex:0 0 140px;width:140px;text-align:left"/>';
h+='<span style="width:26px"></span></div>';
return h}
function bpSusTable(i,H){var p=bpGet(i)||{};var phs=(p.sus||[]);
var h='<div style="margin:26px 0 2px;font-size:14px;font-weight:700;color:var(--paper);letter-spacing:.02em">SUSTAINMENT PHASES</div><div class="t-faint-sm" style="margin:0 0 8px">The ongoing operational costs of the project. Each line item is assigned an annual cost.</div>';
h+='<div class="flx-g3" style="margin:0 0 2px"><span class="t-faint-sm" style="flex:2;font-size:14px">Phase</span><span class="t-faint-sm" style="flex:0 0 136px;font-size:14px">Months</span><span class="t-faint-sm" style="flex:0 0 140px;font-size:14px">Annual rate (derived)</span><span style="width:26px"></span></div>';
phs.forEach(function(ph){if(ph)h+=bpPhaseBlock(i,ph,H)});
if(!phs.length){var gb='bpg_'+i+'_sus_0';var og=function(f){return"bpGhostPhase("+i+",'"+f+"',this.value)"};
h+='<div class="flx-g3" style="margin-bottom:8px;align-items:center;opacity:.6">';
h+='<input id="'+gb+'_name" value="" placeholder="e.g. Ongoing operation" onchange="'+og('name')+'" class="row-input" style="flex:2"/>';
h+=bpMonthSel(gb+'_from','',1,H,og('from'))+'<span class="t-faint-sm">\u2013</span>'+bpMonthSel(gb+'_to','ongoing',1,H,og('to'),true);
h+='<span class="t-faint-sm" style="flex:1;text-align:right">\u2014</span><span style="width:26px"></span></div>'}
h+='<div style="margin:6px 0 18px">'+btn('+ Add phase','bpAddPhase('+i+')','bg2','font-size:11px;padding:3px 10px')+'</div>';
h+='<div class="mb-4"><div style="font-size:14px;color:var(--text-faint);margin-bottom:6px">Notes</div><textarea id="bpn_'+i+'_sus" rows="2" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="What keeps this running \u2013 platforms, licenses, people, retraining">'+esc((p.notes||{}).sus||'')+'</textarea></div>';
return h}
function bpAnchorLine(i){var pj=(data.projects||{})[i]||{};var committed=((data.expSelected||[]).indexOf(i)>=0)||((data.launched||[]).indexOf(i)>=0);
if(!committed)return'';var ps=(data.capital||{}).periodStart;if(!ps)return'';
if(pj.legacy)return'<div class="t-faint-sm" style="margin:0 0 8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px">MONTHS COUNT FROM the period start \u2013 Legacy: month 1 is the opening position; costs before it are not shown.</div>';
var a=anchorMonth(i);var pm=planMonthNow(i);
var h='<div style="margin:0 0 8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">';
h+='<span class="t-faint-sm">MONTHS COUNT FROM</span><input type="date" id="prj_'+i+'_startDate" value="'+esc(pj.startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484"/>';
h+='<span class="t-faint-sm">'+(pj.startDate?('committed start date'+(a!=null?' \u00b7 program Month '+a:'')):'no committed start date set')+'</span>';
if(pj.startDate&&pm!=null&&pm>1)h+='<span class="fs-13" style="color:var(--warn-text)">\u26a0 '+(pm-1)+' month'+(pm>2?'s':'')+' have already passed since this date \u2013 moving it repositions the whole plan on the program calendar.</span>';
h+='</div>';return h}
function bpBudgetTab(i,ro){var _ro=ro||Collab.lockedByOther('budgetPlans::'+i);
var h='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:0 0 4px"><div style="font-size:15px;font-weight:700;color:var(--paper)">Project Budgeting</div>'+(bpHasAny(i)?btn('Print budget sheet','printBudgetSheet('+i+')','bg2','font-size:11px;padding:3px 10px'):'')+'</div><div class="t-faint-sm" style="margin-bottom:16px">Estimates of commitments over the length of the project period.</div>'+bpAnchorLine(i)+bpStatBand(i)+bpUndatedWarn(i);
if(_ro)return h+'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:2px 0 18px"></div>'+bpCharts(i)+bpStepListRO(i);
var p=bpGet(i)||{},H=bpHorizon(i);
h+='<div class="flx-center gap-2" style="margin:14px 0 4px;flex-wrap:wrap"><span class="t-faint-sm">ESTIMATED PROJECT LIFETIME</span><select id="bpm_'+i+'_horizon" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px" onchange="bpMetaSave('+i+',\'horizon\',this.value)">'+[3,4,5].map(function(n){return'<option value="'+n+'"'+(H===n?' selected':'')+'>'+n+' years</option>'}).join('')+'</select>'+(hzMismatch(i)?'<span style="color:#C9403B;font-size:12px;font-weight:600">\u26a0 Longer than the organization\u2019s '+envYearsOf()+'-year planning horizon \u2013 shorten it here or extend the horizon at Step 3.2.</span>':'');
h+='<span class="t-faint-sm" style="margin-left:40px">CONTINGENCY %</span><input id="bpm_'+i+'_contingency" value="'+esc(p.contingency||'')+'" placeholder="e.g. 10" onchange="bpMetaSave('+i+',\'contingency\',this.value)" class="row-input" style="width:64px;max-width:64px;flex:0 0 64px;text-align:center"/></div><div style="height:10px"></div>';
h+=bpAmber(i);
h+=bpStepTable(i,'dev','DEVELOPMENT PHASES','Name each phase, give it a month range, and estimate its total cost. If this project advances to the development portfolio, you will expand on these phases in more detail.',[['e.g. Build and validate model','e.g. $120K'],['e.g. Extended pilot','e.g. $60K']],H,'Phase');
h+=bpStepTable(i,'roll','ROLLOUT STEPS','Deployment waves, training, and any running costs rollout carries before sustainment begins',[['e.g. Deploy, train, and launch','e.g. $90K'],['e.g. Remaining sites rollout','e.g. $40K']],H);
h+=bpSusTable(i,H);
h+=bpCharts(i);
return h}
function bpChartTitle(t){return'<div style="margin:22px 0 6px;font-size:12px;font-weight:700;color:var(--paper);letter-spacing:.03em">'+t+'</div>'}
function bpChartShapeMM(mm,ct){if(!mm.length)return'';
var W=720,Hh=150,pad=26,bw=(W-pad-10)/mm.length,base=Hh-16;
var mx=0;mm.forEach(function(r){var v=r.dev+r.roll+r.sus;if(v>mx)mx=v});if(!mx)return'';
var sy=function(v){return (Hh-30)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-10)+'" y2="'+base+'" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
mm.forEach(function(r,ix){var x=pad+ix*bw;var tot=r.dev+r.roll+r.sus;
var y=base;[[r.dev,'#45A188'],[r.roll,'#5B8DD9'],[r.sus,'#C25B73']].forEach(function(sg){if(!sg[0])return;var bh=sy(sg[0]);h+='<rect x="'+(x+.5).toFixed(1)+'" y="'+(y-bh).toFixed(1)+'" width="'+Math.max(.5,bw-1).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+sg[1]+'"/>';y-=bh});
if((r.m||ix+1)%6===0||ix===0)h+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(Hh-4)+'" text-anchor="middle" font-size="9" fill="#8A8278">'+(r.m||ix+1)+'</text>'});
var _pkIx=-1;mm.forEach(function(r,ix){if(r.dev+r.roll+r.sus===mx&&_pkIx<0)_pkIx=ix});
if(_pkIx>=0)h+='<text x="'+(pad+_pkIx*bw+bw/2).toFixed(1)+'" y="'+(base-sy(mx)-4).toFixed(1)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">P</text>';
h+='<text x="'+pad+'" y="10" font-size="9" fill="#8A8278">P = peak month \u00b7 '+fmtMoney(Math.round(mx))+'</text>';
return h+'</svg>'}
function bpChartShape(i){if(!bpHasAny(i))return'';return bpChartShapeMM(bpMonthly(i),parseFloat((bpGet(i)||{}).contingency)||0)}
function bpChartLanes(i){var H=bpHorizon(i)*12;var lanes=[];
[['dev','#45A188'],['roll','#5B8DD9']].forEach(function(sg){bpRows(i,sg[0]).forEach(function(x){var sp=bpStepSpan(x);if(!sp||!bpStepMoney(x))return;lanes.push({n:x.name||'\u2014',a:sp[0],b:Math.min(sp[1],H),c:sg[1]})})});
bpRows(i,'sus').forEach(function(ph){var sp=bpPhaseSpan(ph);if(!sp||!bpPhaseAnnual(ph))return;lanes.push({n:ph.name||'Sustainment',a:sp[0],b:(sp[1]===Infinity?H:Math.min(sp[1],H)),c:'#C25B73',ong:sp[1]===Infinity})});
if(!lanes.length)return'';
var W=720,rh=17,pad=160,Hh=lanes.length*rh+20;
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
for(var yr=1;yr<=H/12;yr++){var gx=pad+(yr-1)*12/H*(W-pad-14);h+='<line x1="'+gx.toFixed(1)+'" y1="0" x2="'+gx.toFixed(1)+'" y2="'+(Hh-14)+'" stroke="rgba(245,242,236,.08)" stroke-width="1"/><text x="'+(gx+2).toFixed(1)+'" y="'+(Hh-4)+'" font-size="9" fill="#8A8278">Yr '+yr+'</text>'}
lanes.forEach(function(L,ix){var y=ix*rh+3;
h+='<text x="'+(pad-8)+'" y="'+(y+10)+'" text-anchor="end" font-size="9" fill="#8A8278">'+esc(String(L.n).slice(0,28))+'</text>';
var x1=pad+(L.a-1)/H*(W-pad-14),x2=pad+L.b/H*(W-pad-14);
h+='<rect x="'+x1.toFixed(1)+'" y="'+y+'" width="'+Math.max(2,x2-x1).toFixed(1)+'" height="'+(rh-6)+'" rx="3" fill="'+L.c+'"'+(L.ong?' opacity=".75"':'')+'><title>'+esc(L.n)+' \u00b7 Months '+L.a+'\u2013'+(L.ong?'ongoing':L.b)+'</title></rect>'});
return h+'</svg>'}
function bpChartWaterfall(i){var bars=[];
[['dev','#45A188'],['roll','#5B8DD9']].forEach(function(sg){bpRows(i,sg[0]).forEach(function(x){var v=bpStepMoney(x);if(v)bars.push({n:x.name||'\u2014',v:v,c:sg[1]})})});
for(var y=1;y<=bpHorizon(i);y++){var sv=bpSusYear(i,y);if(sv)bars.push({n:'Sustainment yr '+y,v:sv,c:'#C25B73'})}
if(!bars.length)return'';
var tot=0;bars.forEach(function(b){tot+=b.v});
var ct=parseFloat((bpGet(i)||{}).contingency)||0;var grand=Math.round(tot*(1+ct/100));
var W=720,Hh=170,pad=26,bw=(W-pad-84)/bars.length,base=Hh-16;
var sy=function(v){return (Hh-56)*(v/(grand||tot))};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-10)+'" y2="'+base+'" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
var run=0;bars.forEach(function(b,ix){var x=pad+ix*bw;var y1=base-sy(run),y2=base-sy(run+b.v);
h+='<rect x="'+(x+2).toFixed(1)+'" y="'+y2.toFixed(1)+'" width="'+Math.max(2,bw-4).toFixed(1)+'" height="'+Math.max(1,(y1-y2)).toFixed(1)+'" fill="'+b.c+'"><title>'+esc(b.n)+' \u00b7 '+fmtMoney(b.v)+(ct?' \u00b7 '+fmtMoney(Math.round(b.v*(1+ct/100)))+' with contingency':'')+'</title></rect>';
if(ct){var ch2=sy(b.v*ct/100);h+='<rect x="'+(x+2).toFixed(1)+'" y="'+(y2-ch2).toFixed(1)+'" width="'+Math.max(2,bw-4).toFixed(1)+'" height="'+Math.max(.5,ch2).toFixed(1)+'" fill="rgba(245,242,236,.16)"><title>+'+ct+'% contingency on '+esc(b.n)+'</title></rect>'}
if(ix<bars.length-1)h+='<line x1="'+(x+2).toFixed(1)+'" y1="'+y2.toFixed(1)+'" x2="'+(x+bw+2).toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="rgba(245,242,236,.3)" stroke-dasharray="2,2" stroke-width="1"/>';
run+=b.v});
h+='<rect x="'+(W-78)+'" y="'+(base-sy(tot)).toFixed(1)+'" width="26" height="'+sy(tot).toFixed(1)+'" fill="rgba(245,242,236,.25)"/>';
if(ct){h+='<rect x="'+(W-78)+'" y="'+(base-sy(grand)).toFixed(1)+'" width="26" height="'+Math.max(.5,sy(grand)-sy(tot)).toFixed(1)+'" fill="rgba(245,242,236,.12)"><title>Contingency ('+ct+'%) \u00b7 '+fmtMoney(grand-tot)+'</title></rect>';
h+='<text x="'+(W-10)+'" y="12" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">'+fmtMoney(tot)+' base</text>';
h+='<text x="'+(W-10)+'" y="25" text-anchor="end" font-size="9" fill="#8A8278">'+fmtMoney(grand)+' with '+ct+'% contingency</text>'}
else{h+='<text x="'+(W-10)+'" y="12" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">'+fmtMoney(tot)+' lifetime</text>'}
return h+'</svg>'}
function bpChartCumMM(mm,steady,ct){if(!mm.length)return'';ct=ct||0;
var W=720,Hh=150,pad=26,base=Hh-16;var tot=0,pts=[];
mm.forEach(function(r){tot+=r.dev+r.roll+r.sus;pts.push(tot)});if(!tot)return'';
var grand=tot*(1+ct/100);
var sx=function(ix){return pad+(ix+1)/mm.length*(W-pad-36)};
var sy=function(v){return base-(Hh-58)*(v/(grand||tot))};
var d='M '+pad+' '+base;pts.forEach(function(v,ix){d+=' L '+sx(ix).toFixed(1)+' '+sy(v).toFixed(1)});
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-10)+'" y2="'+base+'" stroke="rgba(245,242,236,.25)" stroke-width="1"/>';
h+='<path d="'+d+' L '+sx(pts.length-1).toFixed(1)+' '+base+' Z" fill="rgba(139,94,60,.18)"/>';
h+='<path d="'+d+'" fill="none" stroke="#45A188" stroke-width="2"/>';
if(ct){var d2='M '+pad+' '+base;pts.forEach(function(v,ix){d2+=' L '+sx(ix).toFixed(1)+' '+sy(v*(1+ct/100)).toFixed(1)});
h+='<path d="'+d2+'" fill="none" stroke="rgba(245,242,236,.5)" stroke-width="1.5" stroke-dasharray="4,3"><title>With '+ct+'% contingency</title></path>';
}
var _ex=sx(pts.length-1).toFixed(1);
h+='<text x="'+_ex+'" y="14" text-anchor="end" font-size="10" font-weight="700" fill="#F5F2EC">'+fmtMoney(tot)+(ct?' base':'')+'</text>';
if(ct)h+='<text x="'+_ex+'" y="27" text-anchor="end" font-size="9" fill="#8A8278">'+fmtMoney(Math.round(grand))+' with '+ct+'% contingency</text>';
if(steady)h+='<text x="'+_ex+'" y="'+(ct?40:27)+'" text-anchor="end" font-size="9" fill="#8A8278">Continuing costs beyond Year '+Math.round(mm.length/12)+' = '+fmtMoney(steady)+'/yr</text>';
return h+'</svg>'}
function bpChartCum(i){if(!bpHasAny(i))return'';return bpChartCumMM(bpMonthly(i),bpSusSteady(i),parseFloat((bpGet(i)||{}).contingency)||0)}
function bpChartsGhost(){var mm=[];for(var m=1;m<=36;m++){mm.push({m:m,dev:(m<=9?60000+m*4000:0),roll:(m>=8&&m<=14?70000:0),sus:(m>=13?11000:0)})}
return'<div style="opacity:.35;pointer-events:none">'+bpChartTitle('MONTHLY SPEND SHAPE')+bpChartShapeMM(mm,0)+bpChartTitle('CUMULATIVE COST')+bpChartCumMM(mm,132000)+'</div>'
+'<p class="t-faint-sm" style="margin:6px 0 0">The pictures your plan will draw \u2013 the spend shape, step timeline, and cumulative cost appear as steps gain months and money.</p>'}
function bpChartLegend(){return'<div class="t-faint-sm" style="margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#45A188;border-radius:2px;margin-right:4px"></span>Development <span style="display:inline-block;width:10px;height:10px;background:#5B8DD9;border-radius:2px;margin:0 4px 0 12px"></span>Rollout <span style="display:inline-block;width:10px;height:10px;background:#C25B73;border-radius:2px;margin:0 4px 0 12px"></span>Sustainment</div>'}
function bpCharts(i){if(!bpHasAny(i))return bpChartsGhost();
var ct=parseFloat((bpGet(i)||{}).contingency)||0;var h='';
h+='<div style="display:flex;align-items:flex-end;gap:8px"><div style="flex:1">'+bpChartTitle('MONTHLY SPEND SHAPE')+'</div>'+zoomBtn('bpshape_'+i)+'</div>'+bpChartShape(i)+bpChartLegend();
var ln=bpChartLanes(i);if(ln)h+=bpChartTitle('STEP TIMELINE')+ln;
var wf=bpChartWaterfall(i);if(wf)h+=bpChartTitle('HOW THE LIFETIME TOTAL BUILDS')+wf;
h+='<div style="display:flex;align-items:flex-end;gap:8px"><div style="flex:1">'+bpChartTitle('CUMULATIVE COST \u2013 lifetime, including ongoing sustainment')+'</div>'+zoomBtn('bpcum_'+i)+'</div>'+bpChartCum(i);
return h}
function bpSheetInk(svg){return String(svg||'').split('#8A8278').join('#6b6257').split('rgba(245,242,236,.25)').join('rgba(26,22,18,.35)').split('rgba(245,242,236,.3)').join('rgba(26,22,18,.35)').split('rgba(245,242,236,.12)').join('rgba(26,22,18,.08)').split('rgba(245,242,236,.08)').join('rgba(26,22,18,.08)').split('#F5F2EC').join('#1a1612')}
function renderBudgetSheetFor(i){var idea=(data.ideas||[])[i]||{};var st=getStages();
var stg=((st.operational||[]).indexOf(i)>=0)?'Operational':(st.experiment.indexOf(i)>=0?'Development':'Exploration');
var p=bpGet(i)||{},H=bpHorizon(i);
var CD='#45A188',CR='#5B8DD9',CS='#C25B73',CG='#1B6B5A';
var stgC=stg==='Operational'?CS:(stg==='Development'?CD:CG);
var sec10=function(t,c,m){return'<div style="font-size:10px;font-weight:700;color:'+(c||'#6b6257')+';text-transform:uppercase;letter-spacing:.5px;margin:'+(m||'10px 0 3px')+'">'+t+'</div>'};
var h='<div style="border-bottom:3px solid '+CG+';padding-bottom:10px;margin-bottom:12px">';
h+='<div style="display:flex;justify-content:space-between;align-items:baseline"><h1 style="font-size:22px;letter-spacing:-.3px">'+esc(idea.name||('Item '+i))+'</h1><span style="font-size:12px;color:#6b6257">Estimate \u00b7 '+fmtDate(new Date())+'</span></div>';
h+='<div style="font-size:12px;color:#6b6257;margin-top:2px"><span style="color:'+stgC+';font-weight:700">'+stg+' Portfolio</span> \u00b7 Project Budget Sheet</div></div>';
var life=bpLifetime(i),ssv=bpSusSteady(i),pk=bpPeakMonth(i),fo=bpFirstOpMonth(i);
var cellS=function(v,l){return'<div style="flex:1;min-width:90px;text-align:center"><div style="font-size:17px;font-weight:800">'+v+'</div><div style="font-size:10px;color:#6b6257;text-transform:uppercase;letter-spacing:.4px">'+l+'</div></div>'};
h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">'+cellS(fmtMoney(life),'Lifetime \u00b7 '+H+' yrs')+cellS(fmtMoney(bpDevTotal(i)),'Development')+cellS(fmtMoney(bpRollTotal(i)),'Rollout')+cellS(ssv?fmtMoney(ssv)+'/yr':'\u2014','Steady state')+(pk?cellS('Month '+pk,'Peak spend'):'')+cellS('Month '+fo,'First operational')+'</div>';
var ct=parseFloat(p.contingency);if(ct>0)h+='<p style="font-size:11px;color:#6b6257;margin:0 0 6px">With '+ct+'% contingency: '+fmtMoney(Math.round(life*(1+ct/100)))+' lifetime.</p>';
var bdr='border-bottom:1px solid rgba(26,22,18,.08)';
var tbl=function(sec,title,color){var rows=bpRows(i,sec).filter(function(x){return bpStepSpan(x)||bpStepMoney(x)});if(!rows.length)return'';
var t=sec10(title,color)+'<table style="width:100%;border-collapse:collapse;font-size:11px">';
rows.forEach(function(x){var sp=bpStepSpan(x);t+='<tr><td style="padding:2px 4px 2px 0;'+bdr+'">'+esc(x.name||'\u2014')+'</td><td style="padding:2px 4px;'+bdr+';white-space:nowrap;color:#6b6257">'+(sp?sp[0]+'\u2013'+sp[1]:'\u2014')+'</td><td style="padding:2px 0 2px 4px;'+bdr+';text-align:right;white-space:nowrap;font-weight:600">'+fmtMoney(bpStepMoney(x))+'</td></tr>'});
return t+'</table>'};
var sus='';var phs=bpRows(i,'sus').filter(function(x){return bpPhaseSpan(x)&&bpPhaseAnnual(x)});
if(phs.length){sus=sec10('Sustainment phases',CS)+'<table style="width:100%;border-collapse:collapse;font-size:11px">';
phs.forEach(function(x){var sp=bpPhaseSpan(x);
sus+='<tr><td style="padding:2px 4px 2px 0;'+bdr+'">'+esc(x.name||'\u2014')+'</td><td style="padding:2px 4px;'+bdr+';white-space:nowrap;color:#6b6257">from '+sp[0]+(sp[1]===Infinity?' \u00b7 ongoing':' to '+sp[1])+'</td><td style="padding:2px 0 2px 4px;'+bdr+';text-align:right;white-space:nowrap;font-weight:600">'+fmtMoney(bpPhaseAnnual(x))+'/yr</td></tr>';
(x.items||[]).forEach(function(it){if(!it||!String((it.name||'')+(it.cost||'')).trim())return;
sus+='<tr><td style="padding:1px 4px 1px 12px;color:#6b6257">'+esc(it.name||'')+'</td><td></td><td style="padding:1px 0 1px 4px;text-align:right;color:#6b6257">'+fmtMoney(costNum(it.cost))+'/yr</td></tr>'})});
sus+='</table>'}
h+='<div style="display:flex;gap:22px;align-items:flex-start"><div style="flex:3;min-width:0">';
h+=sec10('Monthly spend shape',null,'4px 0 3px')+bpSheetInk(bpChartShape(i));
h+=sec10('How the lifetime total builds')+bpSheetInk(bpChartWaterfall(i));
h+=sec10('Cumulative cost')+bpSheetInk(bpChartCum(i));
h+='</div><div style="flex:2;min-width:0">'+tbl('dev','Development phases',CD)+tbl('roll','Rollout steps',CR)+sus+'</div></div>';
var ln=bpChartLanes(i);if(ln)h+=sec10('Step timeline',null,'12px 0 3px')+bpSheetInk(ln);
var nx=[];[['dev','Development'],['roll','Rollout'],['sus','Sustainment']].forEach(function(sc){var v=String(((p.notes||{})[sc[0]])||'').trim();if(v)nx.push('<strong>'+sc[1]+':</strong> '+esc(v.length>220?v.slice(0,220)+'\u2026':v))});
if(nx.length)h+='<div style="font-size:11px;color:#3a352e;margin-top:10px;line-height:1.5">'+nx.join('<br/>')+'</div>';
h+='<div style="border-top:1px solid rgba(26,22,18,.15);margin-top:14px;padding-top:6px;display:flex;justify-content:space-between;font-size:10px;color:#6b6257"><span>All figures are estimates of commitments, not tracked spend.</span><span>90 Days to an AI Innovation Pipeline</span></div>';
return h}
function printBudgetSheet(i){var idea=(data.ideas||[])[i]||{};printPage((idea.name||('Item '+i))+' \u2013 Budget Sheet',function(){return renderBudgetSheetFor(i)})}
function bpMetaSave(i,k,val){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);p[k]=val;Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpRowSave(i,sec,id,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);var r=(p[sec]||[]).filter(function(x){return x&&x.id===id})[0];if(!r)return;if(f==='pstatus'&&val==='complete'&&r.pstatus!=='complete'&&!confirm('Mark this phase complete?')){render();return}r[f]=val;if(f==='from'){var a=parseInt(val,10),b=parseInt(r.to,10);if(a&&b&&b<a)r.to=val}Store.commit('budgetPlans',i);if(f!=='powner'&&f!=='pmetric'&&f!=='pexit'){data.capStale=true;Store.commit('capStale')}render()}
function bpGhostSave(i,sec,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;if(!String(val==null?'':val).trim())return;var p=bpEnsure(i);var r={id:uid(),name:'',desc:'',from:'',to:'',cost:''};r[f]=val;if(!p[sec])p[sec]=[];p[sec].push(r);Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpAddStep(i,sec){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);if(!p[sec])p[sec]=[];p[sec].push({id:uid(),name:'',desc:'',from:'',to:'',cost:''});Store.commit('budgetPlans',i);render()}
function bpDelStep(i,sec,id){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);p[sec]=(p[sec]||[]).filter(function(x){return !x||x.id!==id});Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpPhSave(i,id,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);var r=(p.sus||[]).filter(function(x){return x&&x.id===id})[0];if(!r)return;r[f]=val;if(f==='from'&&val&&r.to&&r.to!=='ongoing'){var a=parseInt(val,10),b=parseInt(r.to,10);if(a&&b&&b<a)r.to=val}Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpGhostPhase(i,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;if(!String(val==null?'':val).trim())return;var p=bpEnsure(i);var r={id:uid(),name:'',from:'',to:'ongoing',items:[]};r[f]=val;if(!p.sus)p.sus=[];p.sus.push(r);Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpAddPhase(i){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);if(!p.sus)p.sus=[];p.sus.push({id:uid(),name:'',from:'',to:'ongoing',items:[]});Store.commit('budgetPlans',i);render()}
function bpDelPhase(i,id){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);p.sus=(p.sus||[]).filter(function(x){return !x||x.id!==id});Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpItemSave(i,ph,id,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);var r=(p.sus||[]).filter(function(x){return x&&x.id===ph})[0];if(!r)return;var it=(r.items||[]).filter(function(x){return x&&x.id===id})[0];if(!it)return;it[f]=val;Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpGhostItem(i,ph,f,val){if(Collab.lockedByOther('budgetPlans::'+i))return;if(!String(val==null?'':val).trim())return;var p=bpEnsure(i);var r=(p.sus||[]).filter(function(x){return x&&x.id===ph})[0];if(!r)return;if(!r.items)r.items=[];var it={id:uid(),name:'',cost:''};it[f]=val;r.items.push(it);Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function bpDelItem(i,ph,id){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);var r=(p.sus||[]).filter(function(x){return x&&x.id===ph})[0];if(!r)return;r.items=(r.items||[]).filter(function(x){return !x||x.id!==id});Store.commit('budgetPlans',i);data.capStale=true;Store.commit('capStale');render()}
function planMonthNow(i){var a=anchorMonth(i);if(a==null)return null;var pm=progMonthOf(new Date());if(pm==null)return null;return pm-a+1}
function opYear(i){if(bpPlanLive(i)){var pmn=planMonthNow(i),fo=bpFirstOpMonth(i);if(pmn!=null&&fo){if(pmn<fo)return 1;return Math.floor((pmn-fo)/12)+1}}
var od=(data.opsData||{})[i]||{};var lt=od.launchDate?Date.parse(od.launchDate):NaN;if(isNaN(lt))return 1;var m=monthsAbs(new Date())-monthsAbs(new Date(lt));return Math.max(1,Math.floor(m/12)+1)}
function prjDevYear(i,k){if(k<1)return 0;if(bpDevLive(i))return bpCatYear(i,'dev',k);
if(k!==1)return 0;var b=costNum((((data.experiments||{})[i])||{}).budget);return b||projCosts(i).start}
function prjRollYear(i,k){if(k<1)return 0;if(bpRollLive(i))return bpCatYear(i,'roll',k);
if(k!==1)return 0;var r=costNum((((data.opsData||{})[i])||{}).rolloutCost);return r||projCosts(i).roll}
function prjSusYear(i,k){if(k<1)return 0;if(bpHasSus(i))return bpSusYear(i,k);if(k<2)return 0;var r=costNum((((data.opsData||{})[i])||{}).runCost);return r||projCosts(i).run}
function devCost(i){if(bpDevLive(i))return bpDatedTotal(i,'dev');var b=costNum((((data.experiments||{})[i])||{}).budget);return b||projCosts(i).start}
function opsRolloutCost(i){if(bpRollLive(i))return bpDatedTotal(i,'roll');var r=costNum((((data.opsData||{})[i])||{}).rolloutCost);return r||projCosts(i).roll}
function opsSustainCost(i){if(bpHasSus(i))return bpSusOpYear(i,opYear(i));var r=costNum((((data.opsData||{})[i])||{}).runCost);return r||projCosts(i).run}
function ensureCapCostModel(){try{var st=getStages();
function blank(v){return !String(v==null?'':v).trim()}
st.experiment.concat(st.operational||[]).forEach(function(i){var pr=(data.projects||{})[i]||{};
if(blank(pr.startupCost))return;if(!data.experiments)data.experiments={};if(!data.experiments[i])data.experiments[i]={};
if(blank(data.experiments[i].budget)){data.experiments[i].budget=pr.startupCost;Store.commit('experiments',i)}});
(st.operational||[]).forEach(function(i){var pr=(data.projects||{})[i]||{};
if(!data.opsData)data.opsData={};if(!data.opsData[i])data.opsData[i]={};
if(!blank(pr.runningCost)&&blank(data.opsData[i].runCost)){data.opsData[i].runCost=pr.runningCost;Store.commit('opsData',i)}
if(!blank(pr.rolloutCost)&&blank(data.opsData[i].rolloutCost)){data.opsData[i].rolloutCost=pr.rolloutCost;Store.commit('opsData',i)}});
}catch(e){}}
function opFirstYear(i){if((((data.projects||{})[i])||{}).legacy)return false;
if(bpPlanLive(i)&&anchorMonth(i)!=null&&progMonthOf(new Date())!=null&&bpFirstOpMonth(i)){var _pm=planMonthNow(i);if(_pm!=null)return _pm<bpFirstOpMonth(i)}
var d=(data.opsData||{})[i]||{};if(!d.launchDate)return true;var t=Date.parse(d.launchDate);if(isNaN(t))return true;return(Date.now()-t)<31536000000}
function csNotesFold(){return'<div style="margin:2px 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'csNotes\']=!UI.expanded[\'csNotes\'];render()">'+(UI.expanded['csNotes']?'\u25be':'\u25b8')+' Notes</button>'+(UI.expanded['csNotes']?'<p class="t-faint-sm" style="margin:6px 0 0">A project commits its entire planned spend from the moment it is advanced. Every development, rollout, and sustainment month that lands inside the planning window counts toward the Committed cost, regardless of the stage the project is in today. Killing a project releases funds for phases that have not yet begun back to the budget. The phases that have already started stay committed. Pausing a project holds its commitments unchanged. If a long pause adds real costs, such as license months or restart work, open the project\u2019s development track at Step 3.4 and add the amount to the phase it is paused in, or add a new phase covering the pause months, then push the later phases\u2019 dates out to match the new timeline. The committed sum recalculates from the phases automatically.</p>':'')+'</div>'}
function susProgTotal(i,ops){var M=envYearsOf()*12,t=0,m;
if(ops){var s=orgProjectMonthly(i,true,M);for(m=0;m<M;m++)t+=s[m].sus;return Math.round(t)}
if(!bpPlanLive(i))return 0;var fo=bpFirstOpMonth(i);if(!fo||fo>M)return 0;return Math.round(opsSustainCost(i)/12*(M-fo+1))}
function csvq(v){v=String(v==null?'':v);return(v.indexOf(',')>=0||v.indexOf('"')>=0)?'"'+v.replace(/"/g,'""')+'"':v}
function buildAuditCSV(){var ps=(data.capital||{}).periodStart;if(!ps||isNaN(Date.parse(ps)))return null;
var M=envYearsOf()*12;var d0=new Date(ps);var ideas=data.ideas||[];
var out=['AUDIT EXPORT \u2013 every figure on the money surfaces is a filter-and-sum of the PROJECT MONTHS table below'];
out.push('');out.push('PROJECT MONTHS');
out.push('project_id,project_name,stage,program_month,calendar_month,development,rollout,sustainment,month_total');
orgCommittedSet().forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var nm=(ideas[e.i]||{}).name||('Item '+e.i);var st=e.sunk?'Development (killed \u2013 entered phases held)':(e.op?'Operational':'Development');
for(var m=0;m<M;m++){var r=s2[m];var t=r.dev+r.roll+r.sus;if(t<0.5)continue;
var cd=new Date(d0.getFullYear(),d0.getMonth()+m,1);var cs=cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0');
out.push([e.i,csvq(nm),st,m+1,cs,Math.round(r.dev),Math.round(r.roll),Math.round(r.sus),Math.round(t)].join(','))}});
var L=capLens();
out.push('');out.push('ENVELOPE BY YEAR');out.push('year,budget,committed,kill_pot,available');
L.years.forEach(function(r){out.push([r.y,Math.round(r.budget),Math.round(r.committed),Math.round(r.killPot),Math.round(r.available)].join(','))});
out.push(['TOTAL',Math.round(L.tot.budget),Math.round(L.tot.committed),Math.round(L.tot.killPot),Math.round(L.tot.available)].join(','));
if(L.beyond){out.push('');out.push('BEYOND THE PLANNING WINDOW (not counted above),'+Math.round(L.beyond)+','+L.beyondN+' project(s)')}
var kr=killPotRows();if(kr.length||costNum((data.capital||{}).killCosts)){out.push('');out.push('KILL & PHASE-OUT POT');out.push('description,amount,year');
if(costNum((data.capital||{}).killCosts))out.push(csvq('(legacy pot field)')+','+costNum((data.capital||{}).killCosts)+',1');
kr.forEach(function(r){out.push(csvq(r.d||'')+','+costNum(r.a)+','+killPotYearOf(r))})}
return out.join('\n')}
function dlAuditCSV(){var c=buildAuditCSV();if(!c){try{alert('Set the period start date at Step 3.2 first \u2013 the audit table needs the program calendar.')}catch(e){}return}
var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(c);a.download='capital_audit.csv';document.body.appendChild(a);a.click();document.body.removeChild(a)}
function capAssumedExtra(i){var sd=((data.projects||{})[i]||{}).startDate;var a=sd?progMonthOf(sd):null;if(a==null||a<1){var pm=progMonthOf(new Date());a=Math.max(1,(pm==null?0:pm)+1)}return{i:i,anchor:a}}
function capDevWindow(i,aOv){var full=devCost(i);var ps=(data.capital||{}).periodStart;
if(!ps||isNaN(Date.parse(ps)))return{inW:full,beyond:0};
var M=envYearsOf()*12;var s=orgProjectMonthly(i,false,M,aOv);var w=0;for(var m=0;m<M;m++)w+=s[m].dev;
w=Math.round(w);if(w>full)w=full;return{inW:w,beyond:Math.max(0,full-w)}}
function capProjectWindow(i,aOv){var ps=(data.capital||{}).periodStart;
var full=0;if(bpPlanLive(i)){bpMonthly(i).forEach(function(r){full+=r.dev+r.roll+r.sus})}else{full=devCost(i)+opsRolloutCost(i)}
full=Math.round(full);
if(!ps||isNaN(Date.parse(ps)))return{inW:full,beyond:0};
var M=envYearsOf()*12;var op=(getStages().operational||[]).indexOf(i)>=0;var s2=orgProjectMonthly(i,op,M,aOv);var w=0;for(var m=0;m<M;m++)w+=s2[m].dev+s2[m].roll+s2[m].sus;
w=Math.round(w);return{inW:w,beyond:Math.max(0,full-w)}}
function killPotYearOf(r){var y=parseInt(r&&r.y,10);var Y=envYearsOf();return(y>=1&&y<=Y)?y:1}
function killPotYear(y){var t=(y===1)?costNum((data.capital||{}).killCosts):0;killPotRows().forEach(function(r){if(killPotYearOf(r)===y)t+=costNum(r.a)});return t}
function capLens(extras){var Y=envYearsOf();var yt=orgYearTotals(extras);var years=[],tb=0,tc=0,tk=0;
for(var y=1;y<=Y;y++){var r=yt&&yt[y-1]?yt[y-1]:null;var bud=envBudgetYear(y);var com=r?r.total:0;var kp=killPotYear(y);
years.push({y:y,budget:bud,budgetSet:r?r.budgetSet:false,committed:com,killPot:kp,available:bud-com-kp});tb+=bud;tc+=com;tk+=kp}
var beyond=0,beyondN=0;orgCommittedSet().forEach(function(e){var w=capProjectWindow(e.i,null);if(e.sunk)return;if(w.beyond){beyond+=w.beyond;beyondN++}});
(extras||[]).forEach(function(e){var w=capProjectWindow(e.i,e.anchor);if(w.beyond){beyond+=w.beyond;beyondN++}});
return{years:years,tot:{budget:tb,committed:tc,killPot:tk,available:tb-tc-tk},beyond:beyond,beyondN:beyondN}}
function capCommitments(){var st=getStages(),trk=data.tracking||{},ideas=data.ideas||[],rows=[],dev=0,op=0,beyond=0,beyondN=0;
(st.operational||[]).forEach(function(i){if(((trk[i]||{}).status)==='killed')return;var _w=capProjectWindow(i);rows.push({i:i,name:(ideas[i]||{}).name||('Item '+i),stage:'Operational',status:'Live',label:'Full plan'+(_w.beyond?' (within the planning window)':''),amt:_w.inW,beyond:_w.beyond});op+=_w.inW;beyond+=_w.beyond;if(_w.beyond)beyondN++});
st.experiment.forEach(function(i){var s=(trk[i]||{}).status||'';if(s==='killed'){var _ks=killSunkDev(i);if(_ks>0){rows.push({i:i,name:(ideas[i]||{}).name||('Item '+i),stage:'Development',status:'killed',label:'Development Costs \u2013 entered phases held',amt:_ks});dev+=_ks}return}var _w=capProjectWindow(i);rows.push({i:i,name:(ideas[i]||{}).name||('Item '+i),stage:'Development',status:s==='paused'?'Paused (held)':s?s.charAt(0).toUpperCase()+s.slice(1):'Active',label:'Full plan'+(_w.beyond?' (within the planning window)':''),amt:_w.inW,beyond:_w.beyond});dev+=_w.inW;beyond+=_w.beyond;if(_w.beyond)beyondN++});
return{rows:rows,dev:dev,op:op,total:dev+op,beyond:beyond,beyondN:beyondN}}
function capAvailable(){var com=capCommitments();var cap=data.capital||{};var b=envBudgetYear(1);var kp=killPotTotal();return{budget:b,committed:com.total,killPot:kp,available:b-com.total-kp,beyond:com.beyond||0,beyondN:com.beyondN||0,com:com}}
function capCells(big,extras){var L=capLens(extras);var Y=envYearsOf();
if(UI.capYear==null)UI.capYear=1;if(UI.capYear!=='T'&&!(UI.capYear>=1&&UI.capYear<=Y))UI.capYear=1;
var sel=UI.capYear;var d=sel==='T'?L.tot:L.years[sel-1];
var tb=function(k,lbl){return'<button class="btn-ghost pad-chip-sm" style="font-size:11.5px;padding:4px 12px;'+(sel===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.capYear='+(k==='T'?"'T'":k)+';render()">'+lbl+'</button>'};
var tabs='<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px">'+L.years.map(function(r){return tb(r.y,'Year '+r.y)}).join('')+tb('T','Total')+'</div>';
var cs='score-num-'+(big?'go':'md');var okc=big?'var(--ph1-t)':'#1B6B5A';
var cells=[{v:fmtMoney(d.budget),l:sel==='T'?'Budget \u2013 '+Y+' years':'Budget, Year '+sel},{v:'\u2212 '+fmtMoney(d.committed),l:'Committed'}];
if(d.killPot)cells.push({v:'\u2212 '+fmtMoney(d.killPot),l:'Kill & phase-out'});
cells.push({v:fmtMoney(d.available),l:'Available',c:d.available<0?'#9B2D3F':okc});
return tabs+'<div style="display:flex;gap:14px;flex-wrap:wrap">'+cells.map(function(x){return'<div class="t-center" style="flex:1;min-width:110px"><div class="'+cs+'"'+(x.c?' style="color:'+x.c+'"':'')+'>'+x.v+'</div><div class="t-fade-md">'+x.l+'</div></div>'}).join('')+'</div>'
+(L.beyond?'<p class="fs-13" style="margin:8px 0 0;color:var(--text-soft)">Committed funds falling beyond the planning window: '+fmtMoney(L.beyond)+' across '+L.beyondN+' project'+(L.beyondN>1?'s':'')+' \u2013 these months lie outside the '+Y+'-year period and are not counted above.</p>':'')
+'<p class="t-faint-sm" style="margin:'+(L.beyond?4:8)+'px 0 0">Committed is the full cost of every live plan \u2013 all development, rollout, and sustainment months landing in '+(sel==='T'?'the '+Y+'-year window':'Year '+sel)+'. This figure provides planning estimates. It does not track live spend.</p>'}
var FY_MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function periodStartMonth(){var fm=parseInt((data.capital||{}).fyStartMonth,10);if(fm>=1&&fm<=12)return fm; /* explicit fiscal-year start (optional, Step 3.2) wins – display convention only, money math never reads this */
var ps=(data.capital||{}).periodStart;var t=ps?Date.parse(ps):NaN;if(!isNaN(t))return new Date(t).getMonth()+1;return 1}
function fyQuarterOf(d){var s=periodStartMonth()-1;var mIdx=(d.getMonth()-s+12)%12;var q=Math.floor(mIdx/3)+1;var qAbs=d.getFullYear()*12+d.getMonth()-(mIdx%3);var fyAbs=qAbs-(q-1)*3;return{q:q,fyYear:Math.floor(fyAbs/12),start:new Date(Math.floor(qAbs/12),qAbs%12,1),endEx:new Date(Math.floor((qAbs+3)/12),(qAbs+3)%12,1)}}
function fmtQuarter(qi){return'Program Q'+qi.q+' ('+FY_MN[qi.start.getMonth()]+'\u2013'+FY_MN[(qi.endEx.getMonth()+11)%12]+')'}
function fyToday(){var t=new Date();return'Today\'s date: '+fmtDate(t)+' \u00b7 '+fmtQuarter(fyQuarterOf(t))}
/* Review-horizon conventions (settled July 2): first review at day 90 on the program
   clock; decisions take effect on the 1st of the month after a review closes; each
   horizon runs to the end of the fiscal quarter it lands in (a stub if short), clean
   quarters thereafter. All money math is whole months; the program clock never touches money. */
function nextReviewInfo(){var cyc=data.reviewCycles||[];
if(!cyc.length){if(!data.startDate)return null;var t=Date.parse(data.startDate);if(isNaN(t))return null;return{date:new Date(t+90*86400000),first:true}}
var last=new Date(cyc[cyc.length-1].at);var eff=new Date(last.getFullYear(),last.getMonth()+1,1);var qi=fyQuarterOf(eff);
var months=(qi.endEx.getFullYear()*12+qi.endEx.getMonth())-(eff.getFullYear()*12+eff.getMonth());
return{date:new Date(qi.endEx.getFullYear(),qi.endEx.getMonth(),qi.endEx.getDate()-1),first:false,qi:qi,months:months,stub:months!==3,effective:eff}}
function monthsAbs(d){return d.getFullYear()*12+d.getMonth()}
/* === ORGANIZATIONAL CALENDAR ENGINE (org chunk J1). Month 1 = the period
   start. Committed projects (Development + Operational, not killed) place
   their monthly figures at their anchor date; projects without a plan follow
   the whole-month lump rules;
   capacity and the sustainment cap spread flat per year. Estimates of
   commitments, never spend; the past never redraws. === */
function progMonthOf(t){var ps=(data.capital||{}).periodStart;if(!ps)return null;var a=Date.parse(ps);if(isNaN(a))return null;var d=(t instanceof Date)?t:new Date(t);if(isNaN(d.getTime()))return null;return monthsAbs(d)-monthsAbs(new Date(a))+1}
function anchorMonth(i){var pj=(data.projects||{})[i]||{};if(pj.legacy)return 1;if(pj.startDate){var p=progMonthOf(pj.startDate);if(p!=null)return p}if(pj.advancedAt){var p2=progMonthOf(pj.advancedAt);if(p2!=null)return p2}return null}
function orgCommittedSet(){var st=getStages(),trk=data.tracking||{};var out=[];
(st.operational||[]).forEach(function(i){if(((trk[i]||{}).status)!=='killed')out.push({i:i,op:true})});
(st.experiment||[]).forEach(function(i){if(((trk[i]||{}).status)!=='killed')out.push({i:i,op:false});else if(killSunkDev(i)>0)out.push({i:i,op:false,sunk:true})});
return out}
/* Development-program kill calculus (Paul ruling, July 5): money enters a phase at its
   start month (or when marked running/complete, or its gate taken) and does not come back.
   A kill releases every phase not yet entered; entered phases stay committed and charted.
   Plan-less items have no phases, so a kill releases the whole estimate (unchanged). The
   entered set is frozen at kill time (killSunkIds); revival clears it. */
function phEnteredStep(i,x){return !!(x&&(x.pstatus==='running'||x.pstatus==='complete'||x.gateDec))} /* Entered means work has begun in fact – running, complete, or gate-decided. The calendar fallback (start month passed) was removed July 7 (Paul): an Unstarted phase has spent nothing, so a kill releases it. */
function killReleasePreview(i){var pw=capProjectWindow(i,null);
if(!bpHasDev(i))return{sunk:0,released:pw.inW,phases:[]};
var sunk=0,ph=[];bpRows(i,'dev').forEach(function(x){var c=bpStepMoney(x);if(!c)return;var en=phEnteredStep(i,x);if(en)sunk+=c;ph.push({id:x.id,name:x.name||'',entered:en,c:Math.round(c)})});
sunk=Math.round(sunk);return{sunk:sunk,released:Math.max(0,pw.inW-sunk),phases:ph}}
function stampKill(i){if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};
if(!bpHasDev(i)){if(data.tracking[i].killSunkIds)delete data.tracking[i].killSunkIds;Store.commit('tracking',i);return}
var ids=[];bpRows(i,'dev').forEach(function(x){if(x.id&&bpStepMoney(x)&&phEnteredStep(i,x))ids.push(x.id)});
data.tracking[i].killSunkIds=ids;Store.commit('tracking',i)}
function killSunkDev(i){var ids=(((data.tracking||{})[i])||{}).killSunkIds;if(!ids||!ids.length)return 0;
var t=0;bpRows(i,'dev').forEach(function(x){if(ids.indexOf(x.id)>=0)t+=bpStepMoney(x)});return Math.round(t)}
function killPotRows(){return((data.capital||{}).killRows||[]).filter(function(r){return r&&(String((r||{}).d||'').trim()||costNum((r||{}).a))})}
function killPotTotal(){var t=costNum((data.capital||{}).killCosts);killPotRows().forEach(function(r){t+=costNum(r.a)});return t}
function kpRowSave(x,f,v){if(Collab.lockedByOther('capital'))return;var rws=(data.capital||{}).killRows||[];if(!rws[x])return;rws[x][f]=v;Store.commit('capital');render()}
function kpRowAdd(){if(Collab.lockedByOther('capital'))return;if(!data.capital)data.capital={};if(!data.capital.killRows)data.capital.killRows=[];data.capital.killRows.push({d:'',a:''});Store.commit('capital');render()}
function kpRowDel(x){if(Collab.lockedByOther('capital'))return;var rws=(data.capital||{}).killRows||[];rws.splice(x,1);Store.commit('capital');render()}
function orgProjectMonthly(i,op,M,aOv,sunkOnly){var out=[],m;for(m=0;m<M;m++)out.push({dev:0,roll:0,sus:0});
if(sunkOnly){if(!bpHasAny(i))return out;var aK=aOv!=null?aOv:anchorMonth(i);if(aK==null)return out;var idsK=(((data.tracking||{})[i])||{}).killSunkIds||[];
bpRows(i,'dev').forEach(function(x){if(idsK.indexOf(x.id)<0)return;var cK=bpStepMoney(x),spK=bpStepSpan(x);if(!cK||!spK)return;var perK=cK/(spK[1]-spK[0]+1);for(var mK=spK[0];mK<=spK[1];mK++){var ppK=aK+mK-1;if(ppK>=1&&ppK<=M)out[ppK-1].dev+=perK}});return out}
if(bpPlanLive(i)){var a=aOv!=null?aOv:anchorMonth(i);if(a==null)return out;bpMonthly(i).forEach(function(r){var pp=a+r.m-1;if(pp>=1&&pp<=M){out[pp-1].dev+=r.dev;out[pp-1].roll+=r.roll;out[pp-1].sus+=r.sus}});return out}
var pj=(data.projects||{})[i]||{};
var cDev=devCost(i),cRoll=opsRolloutCost(i),cRun=opsSustainCost(i);
var a2=aOv!=null?aOv:anchorMonth(i);
if(cDev&&a2!=null&&a2>=1&&a2<=M)out[a2-1].dev+=cDev;
if(op){var od=(data.opsData||{})[i]||{};var mL=od.launchDate?progMonthOf(od.launchDate):null;
if(cRoll&&mL!=null&&mL>=1&&mL<=M)out[mL-1].roll+=cRoll;
if(cRun){var ss=(bpHasSus(i)?bpSusStartOpYear(i):0)||2;var mS=pj.legacy?1:(mL!=null?mL+12*(ss-1):13);
for(var m2=Math.max(1,mS);m2<=M;m2++)out[m2-1].sus+=cRun/12}}
return out}
function bpCtFactor(i){return 1+(parseFloat((bpGet(i)||{}).contingency)||0)/100}
function orgMonthly(extras,withCt){var ps=(data.capital||{}).periodStart;if(!ps||isNaN(Date.parse(ps)))return null;
var M=envYearsOf()*12;
var sums=[],m;for(m=1;m<=M;m++)sums.push({m:m,dev:0,roll:0,sus:0});
orgCommittedSet().forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var f=withCt?bpCtFactor(e.i):1;for(m=0;m<M;m++){sums[m].dev+=s2[m].dev*f;sums[m].roll+=s2[m].roll*f;sums[m].sus+=s2[m].sus*f}});
(extras||[]).forEach(function(e){var s3=orgProjectMonthly(e.i,false,M,e.anchor);var f3=withCt?bpCtFactor(e.i):1;for(m=0;m<M;m++){sums[m].dev+=s3[m].dev*f3;sums[m].roll+=s3[m].roll*f3;sums[m].sus+=s3[m].sus*f3}});
return sums}
function capMonthlyLine(m){return(m%12===1)?envBudgetYear(Math.ceil(m/12)):0} /* ANNUAL STEP (Paul's ruling, July 7): each year's full budget is available from that year's first month. Cumulative capacity is a staircase, so a breach exists iff some year runs over its own budget – every breach is a funding problem, never a pacing artifact. Callers sum this as a monthly increment. */
function capSusCapLine(m){var scp=susCapOf(Math.ceil(m/12)); /* month 12 belongs to year 1 – same convention as the budget lookup (December off-by-one fixed July 7, Paul's ruling) */if(!(scp>0))return 0;return envBudgetYear(Math.ceil(m/12))/12*scp/100}
function capBreaches(extras){var s2=orgMonthly(extras);if(!s2)return{overCapMonth:0,ctOverCapMonth:0,capYears:[]};
var sCt=orgMonthly(extras,true);var cumC=0,cumKC=0,ctBr=0;for(var mc=1;mc<=sCt.length;mc++){cumC+=sCt[mc-1].dev+sCt[mc-1].roll+sCt[mc-1].sus;cumKC+=capMonthlyLine(mc);if(!ctBr&&cumC>cumKC+0.5)ctBr=mc}
var cum=0,cumCap=0,overM=0;
s2.forEach(function(r){cum+=r.dev+r.roll+r.sus;cumCap+=capMonthlyLine(r.m);if(!overM&&cum>cumCap+0.5)overM=r.m});
var capYears=[];
var Y=envYearsOf();for(var y=1;y<=Y;y++){var scpY=susCapOf(y);if(!(scpY>0))continue;var t=0;for(var m=(y-1)*12;m<y*12;m++)t+=s2[m].sus;if(t>envBudgetYear(y)*scpY/100+0.5)capYears.push(y)}
return{overCapMonth:overM,ctOverCapMonth:ctBr,capYears:capYears}}
function bpSnapshot(i){var yrs=[],H=bpHorizon(i);
if(bpHasAny(i))for(var y=1;y<=H;y++)yrs.push(Math.round(prjDevYear(i,y)+prjRollYear(i,y)+prjSusYear(i,y)));
var u=typeof getCurrentUser==='function'?(getCurrentUser()||{}):{};
return{at:Date.now(),by:u.name||'',startDate:(((data.projects||{})[i]||{}).startDate)||new Date(((data.projects||{})[i]||{}).advancedAt||Date.now()).toISOString().split('T')[0],horizon:H,lifetime:bpHasAny(i)?bpLifetime(i):0,dev:devCost(i),roll:opsRolloutCost(i),sus:opsSustainCost(i),years:yrs,contingency:(bpGet(i)||{}).contingency||''}}
function capPeriod(from,toEx){var mFrom=monthsAbs(from),mTo=monthsAbs(toEx),span=mTo-mFrom;
var ideas=data.ideas||[];var rows=[],total=0;
var pmF=progMonthOf(from),pmT=progMonthOf(toEx);
if(pmF==null||pmT==null)return{rows:rows,total:0,span:span,from:from,toEx:toEx,ps:false};
var M=envYearsOf()*12;
var lo=Math.max(1,pmF),hi=Math.min(pmT,M+1);
orgCommittedSet().forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var t=0;
for(var m=lo;m<hi;m++){t+=s2[m-1].dev+s2[m-1].roll+s2[m-1].sus}
if(t>0.5){t=Math.round(t);rows.push({i:e.i,name:(ideas[e.i]||{}).name||('Item '+e.i),amt:t,label:'program Months '+lo+'\u2013'+(hi-1)});total+=t}});
return{rows:rows,total:total,span:span,from:from,toEx:toEx,ps:true}}
function thisQuarterConsumption(){var qi=fyQuarterOf(new Date());return{qi:qi,p:capPeriod(qi.start,qi.endEx)}}
function fiscalFold(pid,kind){var open=!!UI.expanded['fyhelp'+pid];
var h='<button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'fyhelp'+pid+'\']=!UI.expanded[\'fyhelp'+pid+'\'];render()">'+(open?'\u25be':'\u25b8')+' Dates and Fiscal Calculations</button>';
if(open){var ps=kind==='review'?[
'The 90-day program and the overall budgetary period run on different clocks. The 90 days count from whenever you started. Your quarters count from the planning period start date (Step 3.2), or from the fiscal year start if you set one above. The two never need to line up.',
'Your first review happens at day 90, wherever that falls. After that, reviews follow planning-period quarters or fiscal year quarters, depending on your choice.',
'Decisions made at a review take effect on the 1st of the month after the review closes. Hold each review in the last month of a quarter, and the next quarter starts with your decisions already in force.',
'If a review closes mid-quarter, the period that follows is a short catch-up (a \u201cstub\u201d) running to the end of the current quarter. After one stub, quarters will be aligned cleanly.',
'Money counts in whole months, never days. A project\'s sustainment costs count at one-twelfth of the annual figure per month from the month its rollout ends, or the later start its budget plan sets. Development and rollout costs land in full and are never pro-rated.',
'A Sell releases the project\'s commitment immediately. If shutting something down has real costs \u2013 phase-outs, contract exits \u2013 hold them in the kill & phase-out pot at Step 3.3; that pot is deducted from Available.',
'A Buy on an Exploration project commits its development costs when the review closes.'
]:[
'The live budget is annual \u2013 Year 1 of the multi-year envelope. The level-pace figure shown is simply that annual figure divided by four \u2013 a comparison line, not an allocation; the outer years are planning context for the multi-year picture.',
'Commitments are derived from where projects stand rather than being entered manually. A project in Development commits its Development Costs. An operational project commits its Development Costs plus its Rollout Costs while rollout runs, then its annual sustainment costs from the month rollout ends.',
'Killing a project releases every development phase not yet entered; phases already entered stay committed and charted. Pausing holds the commitment unchanged \u2013 if a long pause adds real cost (license months, restart work), add it to the paused phase\u2019s cost at Step 3.4, or add a phase covering the pause months, and the committed sum recalculates from there. Real shutdown costs go in the kill & phase-out pot, which is deducted from Available.',
'Money counts in whole months, never days: sustainment costs at one-twelfth of the annual figure per month from the month a project\u2019s rollout ends (or the later start its budget plan sets); development and rollout costs land in full and are never pro-rated.',
'Each project can carry a budget plan \u2013 development and rollout steps with month ranges and whole-step costs, plus sustainment phases with itemized annual rates. While a section of the plan holds money, the matching simple field locks to it and reads \u201cDerived from budget plan\u201d; clear the section\u2019s money and the field is freed again.',
'The Capital Hub\'s charts are the program calendar: committed money placed at its anchored months. Committed Sums is the standing promise ledger \u2013 stage-based, not time-sliced \u2013 so a year reading and the ledger can legitimately differ.',
'The period start date (set at Step 3.2) sets the quarter labels here and the rhythm of the quarterly reviews in Phase 4. The 90-day program clock never touches the money.'
];
h+='<div style="margin-top:10px">'+ps.map(function(p){return'<p class="fs-14" style="margin:0 0 8px;color:var(--stone)">'+p+'</p>'}).join('')+'</div>'}
return h}
function fiscalHelpBox(pid,kind){return card(fiscalFold(pid,kind),'margin-bottom:16px')}
function nextReviewLine(){var n=nextReviewInfo();if(!n)return'';
if(n.first)return'Next portfolio review: <strong>'+fmtDate(n.date)+'</strong> \u2013 Day 90 of the program. Reviews follow your planning-period quarters after this one (set at Step 3.2).';
return'Next portfolio review: <strong>by '+fmtDate(n.date)+'</strong> \u2013 hold it in the closing month of '+fmtQuarter(n.qi)+'. Decisions take effect on the 1st of the following month.'+(n.stub?' This is a '+n.months+'-month period, aligning you to your fiscal quarters.':'')}
function capReadout(){ensureCapCostModel();var com=capCommitments();var cap=data.capital||{};
var _kin='font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px';
var potRows='';((data.capital||{}).killRows||[]).forEach(function(r,x){if(!r)return;potRows+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input value="'+esc(r.d||'')+'" placeholder="e.g. Contractor exit \u2013 Visual QC" onchange="kpRowSave('+x+',\'d\',this.value)" style="flex:2;min-width:180px;'+_kin+'"><input value="'+esc(r.a||'')+'" placeholder="e.g. $25K" onchange="kpRowSave('+x+',\'a\',this.value)" style="flex:1;min-width:80px;'+_kin+'"><select onchange="kpRowSave('+x+',\'y\',this.value)" style="'+_kin+';padding:6px 4px">'+(function(){var o='';for(var _y=1;_y<=envYearsOf();_y++)o+='<option value="'+_y+'"'+(killPotYearOf(r)===_y?' selected':'')+'>Year '+_y+'</option>';return o})()+'</select><button class="btn-ghost pad-chip-sm" onclick="kpRowDel('+x+')" style="width:26px;padding:2px">\u2715</button></div>'});
var pot='<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.12)"><h3 class="h-sub-md" style="margin:0 0 4px">Project Kill/Phase-Out Pot \u2013 '+fmtMoney(killPotTotal())+'</h3>'
+'<p class="t-faint-sm" style="margin:0 0 8px">Money set aside to cover the costs of winding down killed projects. The total is subtracted from the Available figure at the top of the page. Each line is a wind-down cost you expect to carry \u2013 contract exits, license runoff, phase-out work. If you kill a project from the Development portfolio, you will be offered the opportunity to add a line here automatically.</p>'
+potRows+btn('+ Add pot line','kpRowAdd()','bg2','font-size:11px;padding:3px 10px')
+((String(cap.killNotes||'').trim()||String(cap.killCosts||'').trim())?'<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-top:10px"><div style="flex:2;min-width:260px">'+ta('Kill & phase-out cost details (legacy notes)','cap_killNotes',cap.killNotes,'',2)+'</div><div style="flex:1;min-width:170px">'+ta('Manual pot figure (legacy \u2013 still counted)','cap_killCosts',cap.killCosts,'',1)+'</div></div>':'')
+'</div>';
var h='<h3 class="h-sub-md">Committed Sums</h3>';
h+=csNotesFold();
if(!com.rows.length){h+='<p class="t-faint-sm">Nothing is committed yet \u2013 no running experiments or operational projects carry costs.</p>'}
else{com.rows.forEach(function(r){var i=r.i;var ops=r.stage==='Operational';var killed=r.status==='killed';
var stCol=ops?'#C25B73':'#C9925B';
var stat=killed?['killed','#C25B73']:(r.status==='Paused (held)'?['paused','#D4A017']:(r.status==='Complete'?['complete','#1B6B5A']:(r.status==='Running'?['running','#4FB39A']:(ops?['live','#4FB39A']:[String(r.status||'active').toLowerCase(),'#2D5A8E']))));
var cell=function(l,v,dim,tt){return'<div style="min-width:84px;text-align:center'+(dim?';opacity:.5':'')+'"><div class="t-faint-sm" style="font-size:9px;letter-spacing:.06em"'+(tt?' title="'+tt+'"':'')+'>'+l+'</div><div class="t-faint-sm" style="font-size:8px;margin-top:3px">&nbsp;</div><div class="fs-13" style="margin-top:2px">'+v+'</div></div>'};
var cells='',note='';
if(killed){var rel=Math.max(0,capProjectWindow(i).inW-r.amt);cells=cell('HELD \u2013 ENTERED PHASES',fmtMoney(r.amt))+cell('RELEASED',fmtMoney(rel),true);note='Phases already entered stay committed; the remainder went back to Available.'}
else{var d=devCost(i),ro=Math.round(opsRolloutCost(i)),su=Math.round(opsSustainCost(i)),sp=susProgTotal(i,ops);
var estT='Committed at advance as part of the full plan';
cells=cell('DEVELOPMENT',fmtMoney(d))+(ro?cell('ROLLOUT',fmtMoney(ro),false,ops?null:estT):'');
if(su){cells+='<div style="min-width:130px"><div class="t-faint-sm" style="font-size:9px;letter-spacing:.06em;text-align:center" title="'+(ops?'Sustainment is charted from the month rollout ends':estT)+'">SUSTAINMENT</div><div style="display:flex;gap:12px;justify-content:center;margin-top:3px"><div style="text-align:center"><div class="t-faint-sm" style="font-size:8px;letter-spacing:.06em">ANNUAL</div><div class="fs-13" style="margin-top:2px">'+fmtMoney(su)+'/yr</div></div>'+(sp?'<div style="text-align:center"><div class="t-faint-sm" style="font-size:8px;letter-spacing:.06em">OVER THE PROGRAM</div><div class="fs-13" style="margin-top:2px">'+fmtMoney(sp)+'</div></div>':'')+'</div></div>'}
}
h+='<div style="padding:8px 0 9px;border-bottom:1px solid rgba(var(--fg-rgb),.06)">'
+'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="fs-14" style="flex:1;min-width:140px">'+esc(r.name)+'</span>'
+'<span style="font-size:10px;letter-spacing:.05em;padding:2px 9px;border-radius:9px;border:1px solid '+stCol+';color:'+stCol+'">'+r.stage+'</span>'
+'<span class="t-faint-sm" style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:'+stat[1]+'"></span>'+stat[0]+'</span>'
+'<div style="min-width:76px;text-align:right"><strong>'+fmtMoney(r.amt)+'</strong>'+'</div></div>'
+'<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:5px">'+cells+'</div>'
+(note?'<div class="t-faint-sm" style="margin-top:3px">'+note+'</div>':'')+'</div>'});
h+='<div class="row-line" style="border-top:1px solid rgba(var(--fg-rgb),.12)"><span class="fs-14" style="flex:1"><strong>Total committed</strong></span><strong style="min-width:70px;text-align:right">'+fmtMoney(com.total)+'</strong></div>';
}
h+=pot;
return card(h,'margin-bottom:16px')}
function getStages(){
var d=data;
var ideas=d.ideas||[],sel=d.selected||[],proj=d.projects||{},rev=d.review||{},lau=d.launched||[],exSel=d.expSelected||[];
var _arch=d.archivedItems||{};var nA=function(i){return !_arch[i]};
var op=lau.filter(nA);exSel.forEach(function(i){if(nA(i)&&((rev.items||{})[i]||{}).decision==='buy'&&op.indexOf(i)<0)op.push(i)});
var noP=sel.filter(function(i){return nA(i)&&(proj[i]||{}).viable===false});
var exp=exSel.filter(function(i){return nA(i)&&op.indexOf(i)<0});
var expl=sel.filter(function(i){return nA(i)&&(proj[i]||{}).viable!==false&&exSel.indexOf(i)<0&&op.indexOf(i)<0});
var unsel=ideas.map(function(_,i){return i}).filter(function(i){return nA(i)&&sel.indexOf(i)<0});
return{bluesky:unsel,explore:expl,experiment:exp,operational:op,noGo:noP};
}
function isStepDone(sid){
var co=data.completedSections||{},cs=data.completedSteps||{};
if(sid==='1.1')return!!(co['1.1']&&co['1.2']&&co['1.3']&&co['1.4']&&co['1.5']);
if(sid==='1.2')return!!cs['1.2'];
if(sid==='1.3')return!!cs['1.3'];
return!!cs[sid];
}
// === SHARED UI BUILDERS ===
function badge(text,color){return'<span class="bg bg-tinted" style="--c:'+color+'">'+esc(text)+'</span>'}
function card(inner,style,attrs){return'<div class="cd"'+(attrs?' '+attrs:'')+(style?' style="'+style+'"':'')+'>'+inner+'</div>'}
function xpandClick(ev,key,val){var t=ev&&ev.target,c=ev&&ev.currentTarget;
while(t&&t!==c){if(/^(INPUT|SELECT|TEXTAREA|BUTTON|A|LABEL)$/.test(t.tagName||'')||(t.getAttribute&&t.getAttribute('onclick')))return;t=t.parentNode}
try{if(typeof getSelection==='function'&&String(getSelection()))return}catch(e){}
if(val===false&&c&&c.querySelector){var hd=c.querySelector('.xh');if(hd&&hd.getBoundingClientRect&&ev.clientY!=null){var r=hd.getBoundingClientRect();if(ev.clientY>r.bottom+8)return}}
UI.expanded[key]=val;render()}
function xpandAttr(key,open){return 'onclick="xpandClick(event,\''+key+'\','+(!open)+')"'}
function btn(label,onclick,cls,style,disabled){return'<button class="btn '+(cls||'bp')+'"'+(onclick?' onclick="'+onclick+'"':'')+(style?' style="'+style+'"':'')+(disabled?' disabled':'')+'>'+label+'</button>'}
function ta(label,id,val,ph,rows,ro){var _g=(!ro&&/\*/.test(label))?' gate-field':'';var _lbl=ro?String(label).replace(/\s*\*\s*$/,''):label;var _hnd=ro?'':' onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)"';return'<div class="mb-4"><label class="form-label">'+esc(_lbl)+'</label><textarea id="'+id+'" rows="'+(rows||3)+'" class="ta-helper'+_g+'"'+_hnd+(ro?' readonly':'')+' placeholder="'+esc(ph||'')+'">'+esc(val||'')+'</textarea></div>'}
function sel(label,id,val,opts,help,helpBelow){var h='<div class="mb-4"><label class="form-label">'+esc(label)+'</label>'+(help&&!helpBelow?'<p class="t-faint-sm" style="margin:-2px 0 8px">'+esc(help)+'</p>':'')+'<select id="'+id+'" class="sel-helper'+(/\*/.test(label)?' gate-field':'')+'" onchange="fldSave(this.id,this.value)">';opts.forEach(function(o){h+='<option value="'+esc(o.v)+'"'+(val===o.v?' selected':'')+'>'+esc(o.l)+'</option>'});return h+'</select>'+(help&&helpBelow?'<p class="t-faint-sm" style="margin:6px 0 0">'+esc(help)+'</p>':'')+'</div>'}
function fldSave(id,value,live){var i=id.indexOf('_');if(i<0)return;var pre=id.slice(0,i),f=id.slice(i+1);if(Collab.lockedByOther(idToRecordKey(id)))return;
// Drafts (B10): UI-state only so they survive re-renders; committed by their Save/Add buttons.
if(pre==='ic'){if(!UI.icDraft)UI.icDraft={};UI.icDraft[f]=value;return}
if(pre==='bsic'){var bj=f.indexOf('_');if(bj<0)return;var bi=parseInt(f.slice(0,bj),10),bf=f.slice(bj+1);if(isNaN(bi)||!data.ideas||!data.ideas[bi])return;if(['name','desc','strategic','outcome','capabilities','cost','risk','timeframe','dept','when'].indexOf(bf)<0)return;if(bf==='name'&&!String(value).trim())return;if(bf==='when'&&value!=='now'&&value!=='future')return;data.ideas[bi][bf]=value;Store.commit('ideas');if(bf==='when'&&!live){if(value==='future'){UI.expanded.bsFold=true;UI.expanded['bsf'+bi]=true}else{UI.expanded['bs'+bi]=true}render()}return}
if(pre==='tune'){if(!data.stress)data.stress={};if(!data.stress.tuningList)data.stress.tuningList=[];data.stress.tuningList[parseInt(f,10)||0]=value;Store.commit('stress');refreshSecDone();return}
if(pre==='pr3'){var pj3=f.indexOf('_');if(pj3<0)return;var pi3=parseInt(f.slice(0,pj3),10),pf3=f.slice(pj3+1);if(isNaN(pi3))return;if(!data.projects)data.projects={};if(!data.projects[pi3])data.projects[pi3]={};if(!data.projects[pi3].rescore3)data.projects[pi3].rescore3={};if(value===''){delete data.projects[pi3].rescore3[pf3]}else{data.projects[pi3].rescore3[pf3]=Math.max(0,Math.min(10,parseInt(value)||0))}delete data.projects[pi3].rescore3Done;Store.commit('projects',pi3);refreshPr3Total(pi3);return}
if(pre==='prs'){var pj2=f.indexOf('_');if(pj2<0)return;var pi2=parseInt(f.slice(0,pj2),10),pf2=f.slice(pj2+1);if(isNaN(pi2))return;if(!data.projects)data.projects={};if(!data.projects[pi2])data.projects[pi2]={};if(!data.projects[pi2].rescore)data.projects[pi2].rescore={};if(value===''){delete data.projects[pi2].rescore[pf2]}else{data.projects[pi2].rescore[pf2]=Math.max(0,Math.min(10,parseInt(value)||0))}delete data.projects[pi2].rescoreDone;Store.commit('projects',pi2);refreshPrsTotal(pi2);return}
if(pre==='pjr'){var ri2=parseInt(f,10);if(isNaN(ri2))return;if(!data.projects)data.projects={};if(!data.projects[ri2])data.projects[ri2]={};data.projects[ri2].noGoReason=value;Store.commit('projects',ri2);refreshSecDone();return}
if(pre==='pj'){if(UI.ap==null)return;if(!data.projects)data.projects={};if(!data.projects[UI.ap])data.projects[UI.ap]={};data.projects[UI.ap][f]=value;Store.commit('projects',UI.ap);refreshSecDone();return}
if(pre==='port'){var pp=f.split('_'),pfld={h:'horizon',r:'risk',w:'reward',n:'notes'}[pp[1]];if(!pfld)return;if(!data.portfolio)data.portfolio={};if(!data.portfolio[pp[0]])data.portfolio[pp[0]]={};data.portfolio[pp[0]][pfld]=value;Store.commit('portfolio',pp[0]);if(pp[1]!=='n')render();else refreshSecDone();return}
if(pre==='rs'){if(UI.ap==null)return;if(!data.projects)data.projects={};if(!data.projects[UI.ap])data.projects[UI.ap]={};if(!data.projects[UI.ap].rescore)data.projects[UI.ap].rescore={};if(value===''){delete data.projects[UI.ap].rescore[f]}else{data.projects[UI.ap].rescore[f]=Math.max(0,Math.min(10,parseInt(value)||0))}delete data.projects[UI.ap].rescoreDone;Store.commit('projects',UI.ap);refreshRsTotal();refreshSecDone();return}
// Indexed prefixes (A1-A3, B5-B9): id = pre_<idx>_<field>
var j=f.indexOf('_'),idx=j<0?f:f.slice(0,j),sub=j<0?'':f.slice(j+1);
if(pre==='bpn'){var pn=bpEnsure(idx);if(!pn.notes)pn.notes={};pn.notes[sub]=value;Store.commit('budgetPlans',idx);return}
if(pre==='trk'){if(!data.tracking)data.tracking={};if(!data.tracking[idx])data.tracking[idx]={};data.tracking[idx][sub]=value;Store.commit('tracking',idx);if(sub==='status'){if(value==='killed')stampKill(idx);else if(data.tracking[idx].killSunkIds){delete data.tracking[idx].killSunkIds;Store.commit('tracking',idx)}data.capStale=true;Store.commit('capStale')}if(sub==='status'&&!live)render();else refreshSecDone();return}
if(pre==='exp'){if(sub==='budget'&&bpHasDev(idx))return;if(!data.experiments)data.experiments={};if(!data.experiments[idx])data.experiments[idx]={};data.experiments[idx][sub]=value;Store.commit('experiments',idx);refreshSecDone();return}
if(pre==='rev'){if(!data.review)data.review={};if(f.slice(-10)==='_rationale'){var ri=f.slice(0,-10);if(!data.review.items)data.review.items={};if(!data.review.items[ri])data.review.items[ri]={};data.review.items[ri].rationale=value}else{data.review[f]=value}Store.commit('review');refreshSecDone();return}
if(pre==='expl'){if((sub==='cS'&&bpHasDev(idx))||(sub==='cO'&&bpHasRoll(idx))||(sub==='cR'&&bpHasSus(idx)))return;if(!data.projects)data.projects={};if(!data.projects[idx])data.projects[idx]={};var P=data.projects[idx];var ek={obj:'objectives',del:'deliverables',tl:'timeline',res:'resources',risk:'risks',met:'metrics',cS:'startupCost',cO:'rolloutCost',cR:'runningCost'}[sub];if(ek){P[ek]=value}else if(sub.slice(0,3)==='sw_'){if(!P.swot)P.swot={};P.swot[sub.slice(3)]=value}else if(sub==='pI'){P.partInt=value}else if(sub==='pE'){P.partExt=value}else if(/^(skills|resources|technology)(H|N)$/.test(sub)){if(!P.gap)P.gap={};P.gap[sub]=value}else{return}Store.commit('projects',idx);refreshSecDone();return}
if(pre==='ops'){if((sub==='runCost'&&bpHasSus(idx))||(sub==='rolloutCost'&&bpHasRoll(idx)))return;var ok={perf:'performance',notes:'notes',runCost:'runCost',rolloutCost:'rolloutCost'}[sub];if(!ok)return;if(!data.opsData)data.opsData={};if(!data.opsData[idx])data.opsData[idx]={};data.opsData[idx][ok]=value;Store.commit('opsData',idx);refreshSecDone();return}
var m={p:'purpose',k:'knowledge',ow:'ownership',inc:'incentives',rh:'rhythm',cap:'capital',gov:'governance',str:'stress'},key=m[pre];if(!key)return;if(!data[key])data[key]={};data[key][f]=value;Store.commit(key);if(pre==='cap'){if(!live)if(f==='aiBudget'||f==='killCosts'||f==='envYears'||f==='budgetY2'||f==='budgetY3'||f==='budgetY4'||f==='budgetY5'||f==='periodStart'||f==='programShape'||f==='programEnd'||f==='susCap'||f.indexOf('susCapY')===0||f.indexOf('reserveY')===0){render();return}}refreshSecDone()}
function rsComplete(rs){return['priority','risk','value','costScore','difficulty'].every(function(k){return rs&&rs[k]!=null})}
function rsTotalHtml(ap){var p=(data.projects||{})[ap]||{},rs=p.rescore||{},trTot=triageScore(ap);if(!p.rescoreDone||!rsComplete(rs))return'Deepened <strong>\u2014</strong> \u00b7 First Pass '+trTot+'/50';var rsTot=getScore(ap),d=rsTot-trTot;return'Deepened <strong>'+rsTot+'/50</strong> \u00b7 First Pass '+trTot+'/50 ('+(d>=0?'+':'')+d+')'}
function refreshRsTotal(){var el=document.getElementById('rsTotal');if(el&&UI.ap!=null)el.innerHTML=rsTotalHtml(UI.ap);var b=document.getElementById('rsBtn');if(b&&UI.ap!=null){var p=(data.projects||{})[UI.ap]||{};var done=!!p.rescoreDone,comp=rsComplete(p.rescore||{});b.disabled=done||!comp;b.textContent=done?'\u2713 Complete':'Mark Complete & Continue';b.style.background=done?'rgba(27,107,90,.25)':comp?'#1B6B5A':'rgba(var(--fg-rgb),.08)';b.style.color=done?'var(--ref-accent)':comp?'#fff':'var(--text-faint)';b.style.cursor=(comp&&!done)?'pointer':'default'}}
function confirmRescore(){if(UI.ap==null)return;if(lockBlocked('projects::'+UI.ap))return;if(!data.projects)data.projects={};var p=data.projects[UI.ap];if(!p||!rsComplete(p.rescore||{}))return;p.rescoreDone=true;Store.commit('projects',UI.ap);render()}
function refreshSecDone(){var b=document.querySelector('.done-btn');if(!b)return;if(currentPage!=='step')return;if(gateArmed)paintGates();var ok=true;if(currentStep==='1.1'){var s=UI.sec,co=data.completedSections||{};if(co[s])return;var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},au=data.audit||[],de=data.decisions||{};if(s==='1.1')ok=!!(p.mission&&p.goals&&p.frictions);else if(s==='1.2')ok=!!(k.usage&&k.awareness);else if(s==='1.3')ok=!!(cu.uncertainty&&cu.aiLegitimacy&&cu.overall);else if(s==='1.4')ok=true;/* twin: renderStep11 sec 1.4 doneBtn disabled=false - an empty audit is a valid completion (ruled July 9) */else if(s==='1.5')ok=!!((de.q1||{}).who&&(de.q4||{}).who);else return}else{var cs=data.completedSteps||{},sid=currentStep;if(cs[sid])return;if(sid==='2.1'){var o=data.ownership||{};ok=!!(o.ownerName&&o.ownerRole)}else if(sid==='2.2'){var inc=data.incentives||{};ok=!!(inc.current&&inc.changes)}else if(sid==='2.3'){var rh=data.rhythm||{};ok=!!(rh.day&&rhAttNames().length)}else if(sid==='3.2'){var _c2=data.capital||{};ok=!!(String(_c2.aiBudget||'').trim()&&String(_c2.periodStart||'').trim()&&capAuditAnswered())}else if(sid==='3.3'){ok=getStages().experiment.length>0}else if(sid==='4.2'){var gov=data.governance||{};ok=!!(gov.meeting&&gov.threshold&&gov.reviewAttendees)}else if(sid==='4.3'){var st=data.stress||{};ok=!!((st.tuningList||[]).some(function(t){return t}))}else if(sid==='1.2'){ok=(data.ideas||[]).length>=3}else if(sid==='1.3'){ok=(data.selected||[]).length>0}else if(sid==='2.4'){var sl=data.selected||[],pjj=data.projects||{},stg=getStages(),_ad={};stg.experiment.concat(stg.operational||[]).forEach(function(x){_ad[x]=1});ok=sl.length>0&&sl.filter(function(i){return!isArchived(i)&&!_ad[i]}).every(function(i){var pp=pjj[i]||{};return pp.viable===true?!!pp.objectives:pp.viable===false?!!pp.noGoReason:false})}else if(sid==='3.1'){var gp=getStages().explore.filter(function(i){return((data.projects||{})[i]||{}).viable===true}),pt=data.portfolio||{};ok=gp.length>0&&gp.every(function(i){var pb=pt[i]||{};return!!(pb.horizon&&pb.risk&&pb.reward)})}else if(sid==='4.1'){var x2=(data.expSelected||[]).filter(function(i){return!isArchived(i)}),tk=data.tracking||{};ok=x2.every(function(i){return (tk[i]||{}).status==='killed'||(progArmed(i)&&!progOverdue(i))})/* twin: renderStep41 allArmed (aligned July 9) */}else if(sid==='4.4'){var x3=data.expSelected||[],rv=(data.review||{}).items||{};var ai=x3.filter(function(i){return!isArchived(i)}).concat((data.selected||[]).filter(function(i){return!isArchived(i)&&x3.indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true}));ok=ai.every(function(i){return!!(rv[i]||{}).decision})/* twin: renderStep44 allItems/allDecided (aligned July 9) */}else return}b.disabled=!ok;var hp=document.querySelector('.done-helper');if(hp)hp.style.display=ok?'none':''}
function paintGates(){var els=document.querySelectorAll('.gate-field');for(var i=0;i<els.length;i++){var el=els[i],empty;if(el.classList.contains('gate-likert')){empty=!el.querySelector('.lk-btn.sel')}else{empty=!String(el.value||'').trim()}el.classList.toggle('gate-empty',empty)}}
function gatePeek(ev){var w=ev&&ev.currentTarget;var b=w&&w.querySelector('.done-btn');if(b&&b.disabled){gateArmed=true;paintGates();}}
function likert(label,id,val,lo,hi,help){var h='<div class="mb-5"><label class="form-label-md">'+esc(label)+'</label>'+(help?'<p class="t-faint-sm" style="margin:-4px 0 8px">'+esc(help)+'</p>':'')+'<div class="flx-center gap-2'+(/\*/.test(label)?' gate-field gate-likert':'')+'"><span class="lk-cap">'+esc(lo)+'</span>';for(var n=1;n<=5;n++){var s=val===n;h+='<button onclick="likSet(\''+id+'\','+n+')" class="lk-btn'+(s?' sel':'')+'">'+n+'</button>'}return h+'<span class="lk-cap lk-cap-r">'+esc(hi)+'</span></div></div>'}
function milestone(sid){var m=MILESTONES[sid];if(!m||!isStepDone(sid))return'';return'<div class="milestone-mini"><div class="icon-check">\u2713</div><div><div class="milestone-mini-label">Milestone Reached</div><div class="milestone-mini-text">'+esc(m)+'</div></div></div>'}

/* ═══════════════════════════════════════════════════════════════
   STEP CAROUSEL — replaces video placeholders.
   4 slides per step: Why / What / How / Outcome.
   Auto-rotates via CSS animation. Pauses on hover.
   Eyebrow color picks up the phase color (teal/blue/brown/red).
   ═══════════════════════════════════════════════════════════════ */

var CAROUSEL_CONTENT = {
  "1.1": [
    {
      "kind": "Why",
      "headline": "The most common AI failures begin before the build.",
      "body": "AI initiatives can fail for many reasons, but the most common causes aren't technical. If you commit to a project before you've taken honest stock of your purpose, capabilities, culture, and decision rights, every later choice will rest on untested premises.",
      "example": "[RAND's 2024 study](https://www.rand.org/pubs/research_reports/RRA2680-1.html) of failed AI projects found that the leading cause was a misread of the problem itself. Four of the five root causes of failure were organizational, not technological."
    },
    {
      "kind": "What",
      "headline": "Five dimensions of readiness.",
      "body": "The battery covers five areas in two groups.",
      "bullets": [
        {
          "label": "Answer directly",
          "text": "Your organizational purpose and priorities, your current AI knowledge and capability, and whether your culture will support or resist change."
        },
        {
          "label": "Investigate",
          "text": "Conduct an audit of every AI initiative already running, and create a map of who holds the authority to approve, fund, advance, or kill a project."
        }
      ],
      "body2": "Together these answers form the baseline that anchors every later decision."
    },
    {
      "kind": "How",
      "headline": "Answer for the company you are, not the one you wish you were.",
      "body": "The instinct is to score generously and move on. Resist it. The uncomfortable answers \u2014 the stalled pilot nobody owns, the decision nobody can make \u2014 are the ones that teach you the most.",
      "example": "When they are asked who can kill a failing project, for many teams the answer is \"We don't know.\" Writing that down honestly is precisely the point of the exercise: once you have identified and logged structural gaps you will then be in a position to fix them."
    },
    {
      "kind": "Outcome",
      "headline": "Outputs that anchor what comes next.",
      "body": "When all five sections are complete, you will see your readiness radar \u2014 a single picture of your strengths and weak spots \u2014 and your Assessment Report under Outcomes will be unlocked.",
      "body2": "The profile recorded in this section becomes the reference point for everything that follows: which opportunities to pursue, whom to assign, where to build capabilities first. This starting point means you can move based on evidence rather than on a vague sense that your organization \"should do AI.\""
    }
  ],
  "1.2": [
    {
      "kind": "Why",
      "headline": "Start from the problem, not the technology.",
      "body": "The tempting question is \"what can AI do?\" But capability isn't strategy. Until you know which problems are holding the business back, a catalog of impressive AI features is just a solution looking for a problem to solve.",
      "example": "[McKinsey's 2025 State of AI](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) found that the organizations capturing real value redesign their work around the problem they are solving, rather than bolting AI onto what already exists \u2014 business need first, technology second."
    },
    {
      "kind": "What",
      "headline": "Aim wide before you aim well.",
      "body": "Generate ten to twenty candidate use cases without pausing to judge them; at this stage, range matters more than polish.",
      "body2": "The obvious ideas arrive first, but the ones worth pursuing usually surface only after you have pushed past them. Capture each as an idea card, ready to be filtered in the next step."
    },
    {
      "kind": "How",
      "headline": "Tie every idea to a friction you already have.",
      "body": "For each idea, name the specific friction it removes: the slow process, the bottleneck, the error you keep paying for. If you cannot name the friction, the idea is not ready yet \u2014 park it and move on.",
      "example": "An idea like \"use AI for quoting\" only earns its place once it is tied to a real cost \u2014 quotes that take three days when customers expect three hours. The friction is what makes it a candidate, not the technology."
    },
    {
      "kind": "Outcome",
      "headline": "A Blue Sky Portfolio to draw from.",
      "body": "What you leave with is a Blue Sky Portfolio: a captured pool of candidate use cases, each tied to a real business need and ready to be ranked.",
      "body2": "Nothing here is committed yet. Most of these ideas will not advance. And that is the point \u2014 a wide, honest pool is what lets you choose well in the next step, rather than settling for whatever was top of mind."
    }
  ],
  "1.3": [
    {
      "kind": "Why",
      "headline": "A long list is not a plan.",
      "body": "Brainstorming produces volume; this step turns volume into focus. Resources spread across too many initiatives at once rarely produce clear learning from any of them, so the field has to be narrowed before anything advances.",
      "example": "A [Harvard Business Review](https://hbr.org/2025/11/stop-running-so-many-ai-pilots) analysis argues that broad, shallow pilots build no lasting edge while a narrow set of carefully selected, focused bets delivers compounding value. [A BCG report](https://www.bcg.com/publications/2024/wheres-value-in-ai) suggests that a narrow approach is correlated with a doubling of return on investment."
    },
    {
      "kind": "What",
      "headline": "Conduct a viability check first, then rank the survivors.",
      "body": "Every idea passes through two filters before it can advance.",
      "bullets": [
        {
          "label": "Qualify",
          "text": "Five pass/fail gates \u2014 can you build it, resource it, fund it, and is it a cultural and strategic fit? Fail any one gate and the idea is disqualified."
        },
        {
          "label": "Score",
          "text": "Survivors are rated zero to ten on priority, value, cost, risk, and ease, producing a single score out of fifty."
        }
      ],
      "body2": "You then select use cases to carry into deeper assessment. On your first pass, select up to five to advance."
    },
    {
      "kind": "How",
      "headline": "A \"no\" on any gate is a \"no.\"",
      "body": "The gates are disqualifiers, not an average \u2014 one honest \"no\" should stop an idea even if you like it. Score only what clears all five, and resist nudging a favorite through a gate it plainly fails.",
      "example": "An idea can score high on value and still be the wrong bet: if the culture won't accept it, or you can't fund it this year, it fails a gate and stops there. Far better to learn that now than after launch."
    },
    {
      "kind": "Outcome",
      "headline": "A ranked shortlist, ready for a deeper dive.",
      "body": "You leave with a set of use cases that have cleared every gate and earned a score out of fifty \u2014 a ranked shortlist rather than a wish list.",
      "body2": "The ideas you set aside aren't deleted; they stay in the Blue Sky Portfolio and can return when conditions change. What advances is a focused, defensible set you can take into deeper assessment."
    }
  ],
  "2.1": [
    {
      "kind": "Why",
      "headline": "If everyone owns it, no one does.",
      "body": "An innovation pipeline needs one person who is accountable for it. If you spread the responsibility thinly across committees, decisions will stall because no one holds both the mandate and the obligation to act.",
      "example": "\"AI will touch all parts of an enterprise, including human employees and clients. Harnessing its potential and managing its risks requires the authority to take a view across the whole organization, steering macro-level innovation and managing change that touches on all parts of the business's identity and culture.\" \u2014 [Faisal Hoque et al.](https://sloanreview.mit.edu/article/why-ai-demands-a-new-breed-of-leaders/)"
    },
    {
      "kind": "What",
      "headline": "One owner, plus leads where the work happens.",
      "body": "Ownership has two parts.",
      "bullets": [
        {
          "label": "The Pipeline Owner",
          "text": "one named person with explicit authority to fund, advance, and kill projects across the portfolio."
        },
        {
          "label": "Embedded leads",
          "text": "a point person in each affected function or business unit, so the work gains traction where it actually happens."
        }
      ],
      "body2": "One person holds the portfolio; the others carry it into the business."
    },
    {
      "kind": "How",
      "headline": "Give the role teeth, not just a title.",
      "body": "Naming an owner is the easy part. What determines whether they will be effective is the authority they're given: can this person move budget, advance a project, or shut an initiative down without convening a committee? Without that authority, the role will just be a figurehead.",
      "example": "An owner who can kill a project that\u2019s not delivering can act in days. One who merely \"oversees AI\" has nothing to stand on when a sponsor pushes back."
    },
    {
      "kind": "Outcome",
      "headline": "A clear line of accountability.",
      "body": "You leave with a defined ownership structure: one accountable owner with real decision rights, and a named lead in each function the work touches.",
      "body2": "When a project stalls, it is now clear whose call it is to unblock it \u2014 and that person has the standing to make the call. Accountability stops being a question and becomes part of the structure."
    }
  ],
  "2.2": [
    {
      "kind": "Why",
      "headline": "People do what you reward them for.",
      "body": "Tell people that innovation matters, then measure them only on quarterly delivery, and they will protect delivery every time. That isn't disloyalty \u2014 it's a rational response to the system they're in. To change the behavior, change what the system rewards.",
      "example": "[Steven Kerr's classic study of reward systems](https://doi.org/10.2307/255378) named this \"the folly of rewarding A while hoping for B.\" An organization says it wants teamwork, then promotes people based on their individual outputs. The result is team members who compete instead of collaborating, following the path laid down by the rewards instead of the signposts in the mission statement."
    },
    {
      "kind": "What",
      "headline": "Tie evaluations to pipeline health.",
      "body": "Begin by naming what your incentives reward today \u2014 usually quarterly delivery and cost efficiency.",
      "body2": "Then tie part of what is measured in leadership evaluations to the health of the pipeline: active experiments running, how quickly failing projects are killed, development gate throughput, visible support for experimentation, and ideas surfaced from the frontline."
    },
    {
      "kind": "How",
      "headline": "Reward the learning, not just the wins.",
      "body": "If only wins earn rewards, people stop taking real risks and bury the experiments that fail. Reward the learning a killed project produces, and teams will surface failure fast instead of hiding it.",
      "example": "In practice, the manager who ends a weak project early and documents what it taught should fare better at review than one who let it run on to avoid admitting failure. Once evaluations reward this behavior, an honest failure becomes safe to report."
    },
    {
      "kind": "Outcome",
      "headline": "What you measure starts to happen.",
      "body": "You leave this phase with a revised incentive structure that rewards pipeline health alongside delivery, and a clear record of how it differs from the previous structure.",
      "body2": "This is where the culture you diagnosed in Phase 1 begins to move. Repeating the vision doesn't change behavior; changing what earns reward and recognition does."
    }
  ],
  "2.3": [
    {
      "kind": "Why",
      "headline": "The urgent crowds out the important.",
      "body": "When everything feels urgent, forward-looking work is the first thing to slip \u2014 there's always a fire that feels more pressing than next quarter's pipeline. A standing weekly session is the counterweight: it guarantees time for the future that daily pressure can't reclaim.",
      "example": "[A decade-long Harvard Business Review study](https://hbr.org/2002/02/beware-the-busy-manager) found that only about one in ten managers spend their time in a focused, purposeful way. The rest are consumed by reactive busyness \u2014 exactly the default a protected slot is built to resist."
    },
    {
      "kind": "What",
      "headline": "Put a standing weekly session on the calendar.",
      "body": "Set a recurring weekly session and fix the details that make it real: the day and time, who attends, and what the meeting is for.",
      "body2": "Keep it short and senior, gathering the people who can unblock and fund the work in a room every week. Give the session a working agenda: review where projects stand against their stage gates, surface new opportunities, clear blockers, and look at what recent experiments are teaching you."
    },
    {
      "kind": "How",
      "headline": "Consistency is key.",
      "body": "The discipline is in never moving the session. The weeks when you most want to cancel, because something is on fire, are exactly the weeks it earns its place. Hold the session consistently and, within a few months, the rhythm runs itself.",
      "example": "Pick a fixed slot \u2014 say, Tuesdays at 9 \u2014 and treat it as immovable. After a dozen weeks it stops being something people check on and becomes something they plan around, bringing decisions to it as a matter of course."
    },
    {
      "kind": "Outcome",
      "headline": "The pipeline gains a heartbeat.",
      "body": "You leave this phase with a standing weekly session on the calendar \u2014 a fixed time, the right people, and a clear agenda for the work the rest of the week tends to crowd out.",
      "body2": "Decisions that used to wait for a crisis or a quarterly offsite now have a regular place to happen. Innovation no longer depends on someone remembering to put it on the agenda."
    }
  ],
  "2.4": [
    {
      "kind": "Why",
      "headline": "Understand the project fully before you build it.",
      "body": "Before you commit real time and money to building an initiative, you need a full picture of it \u2014 what it will take, where it's weak, who must be involved. A flaw found now costs a conversation; found mid-build, it costs the project.",
      "example": "Decades of [new-product research](https://onlinelibrary.wiley.com/doi/full/10.1002/9781444316568.wiem05014) has found that a project's fate is largely set before development begins, by the depth of the up-front work defining what is being built and against what risks. Thin definition is the most common cause of expensive late failure."
    },
    {
      "kind": "What",
      "headline": "The whole project, examined from every side.",
      "body": "For each shortlisted idea, you build a full working definition and study it from several angles.",
      "bullets": [
        {
          "label": "Project definition",
          "text": "objectives, deliverables, timeline, resources, risks, and the metrics that will mark success."
        },
        {
          "label": "Gap and SWOT analyses",
          "text": "the skills, resources, and technology you already have, set against what the project will need, plus the project's internal strengths and weaknesses, and the external opportunities and threats around it."
        },
        {
          "label": "Budgeting",
          "text": "a careful, preliminary analysis of the lifetime costs of the project, broken down into phased development costs, rollout costs, and annual sustainment costs."
        }
      ],
      "body2": "By the end of this step, you will understand each project well enough to decide its future with confidence."
    },
    {
      "kind": "How",
      "headline": "Take each project one dimension at a time.",
      "body": "Go through the dimensions in turn for each project \u2014 the definition, the gaps, the SWOT, and the budget \u2014 and fill each one in concretely. Some answers you already know and just need to set down; others will take real digging. Be specific throughout: a named skill you're missing is useful; \"some training needed\" is not.",
      "example": "Specificity is what separates a real assessment from a box-ticked one. \"A skilled engineer we'd need to hire\" beats \"skills gap\"; \"a supplier for the vision models, since we can't build them in-house\" beats \"external partner needed.\" The precise version is what later decisions can actually build on."
    },
    {
      "kind": "Outcome",
      "headline": "A clear verdict on every idea, and the reasons behind it.",
      "body": "You leave this phase understanding each shortlisted project in real depth, and with a Go or No Go for each. Every Go is ready to move into the Exploration portfolio as a project worth developing further.",
      "body2": "A No Go isn't lost. The idea is set aside with its reason recorded \u2014 the gap, the missing partner, the weakness that settled it \u2014 so you can return to it if conditions change."
    }
  ],
  "3.1": [
    {
      "kind": "Why",
      "headline": "A set of strong projects can still be a weak portfolio.",
      "body": "Every Go project earned its place on its own merits. But a portfolio that's all big, transformative bets \u2014 or all small, safe wins \u2014 is fragile. The reliable wins fund and steady the ambitious bets, so balancing the two is a decision in itself.",
      "example": "As this [Fast Company](https://www.fastcompany.com/91358541/why-your-organization-needs-both-ai-moonshots-and-mundane-wins) article argues, with companies pouring hundreds of billions into AI and scrapping most of those projects, the winners run transformative gambles alongside modest, reliable wins rather than going all-in on either."
    },
    {
      "kind": "What",
      "headline": "Balance the portfolio.",
      "body": "The Go projects already populate your portfolio. Up to now, each has been judged on its own merits; this is the first point where you weigh them against one another.",
      "body2": "The aim is a balanced set of innovation projects. Weighing the mix across a few key criteria shows you where it's overloaded \u2014 too slow, too speculative, too thin on near-term return \u2014 so you can adjust while adjusting is still cheap, before capital and effort are committed in the steps that follow."
    },
    {
      "kind": "How",
      "headline": "The hard calls live in the middle.",
      "body": "Grade each project on three dimensions:",
      "bullets": [
        {
          "label": "Time horizon",
          "text": "short, medium, long."
        },
        {
          "label": "Risk level",
          "text": "low, medium, high."
        },
        {
          "label": "Reward potential",
          "text": "low, medium, high."
        }
      ],
      "body2": "Projects with scores at the extremes are easy to decide \u2014 short, low-risk work with a strong return is the easiest yes; a long project with a low reward rarely earns the resources it ties up. Most projects sit somewhere in the middle, and that is where the real weighing happens. Take the obvious wins, ration the long and high-risk bets, and keep enough quick returns in the mix to carry the slower, more ambitious work."
    },
    {
      "kind": "Outcome",
      "headline": "A portfolio you can defend as a mix.",
      "body": "You leave with every Go project rated on all three dimensions \u2014 time horizon, risk, and reward \u2014 and a clear view of how the projects are distributed within the portfolio: how the quick, low-risk wins balance the slower, more ambitious bets you've chosen to carry.",
      "body2": "That balanced picture is what the rest of Phase 3 works from. Capital allocation and experiment design both build on it, so the mix you set here decides where the money and the first experiments go."
    }
  ],
  "3.2": [
    {
      "kind": "Why",
      "headline": "Decide what the organization will spend before choosing what projects it funds.",
      "body": "Sustainment plateaus make single-year budgeting structurally blind: this year's launches are next year's fixed costs. A capacity plan states what the organization will make available for this portfolio, per year, across a multi-year horizon."
    },
    {
      "kind": "What",
      "headline": "A multi-year envelope that holds still.",
      "body": "Capacity per year across a one-to-five-year horizon. The dynamic portfolio flows through the static capacity. The unknown future portfolio is not missing from the plan; it is present as the capacity not yet consumed. The shape of the budget will vary depending on whether this planning period covers a fixed-term initiative or will roll seamlessly into another planning period."
    },
    {
      "kind": "How",
      "headline": "Set the figures, then leave them alone.",
      "body": "Enter the annual budget, extend it across the horizon, and date the period so the calendar and its quarters are anchored. Then set annual reserves that guarantee space for new project intake and sustainment caps that limit what can be spent on running costs for operational projects. For fixed-term innovation initiatives, the sustainment cap should rise significantly in the final year as new project intake eases."
    },
    {
      "kind": "Outcome",
      "headline": "A budget that every spending commitment is measured against.",
      "body": "Every decision to advance a project to the development or operational portfolios is weighed against this plan. Every quarterly review returns attention to how the live innovation portfolio fits with the funding available."
    }
  ],
  "3.3": [
    {
      "kind": "Why",
      "headline": "Decide against what's left, not what was set.",
      "body": "In most organizations, innovation projects are approved one at a time, and what gets weighed at approval is the near-term cost \u2014 the next experiment, the pilot \u2014 not the full development path behind it. Few stop to total what the whole portfolio will need if its projects run their course, so commitments accumulate until they exceed what the budget can carry. This step reverses that: a project advances only with its complete development cost counted, and only if the portfolio's remaining headroom can fund it.",
      "example": "When [Cooper, Edgett, and Kleinschmidt](https://www.tandfonline.com/doi/abs/10.1080/08956308.2000.11671338) studied why development portfolios overload, they found that standard selection methods judge each project on its own merits, with resource availability rarely forming part of the calculation."
    },
    {
      "kind": "What",
      "headline": "Two views: the sandbox and the real commitment.",
      "body": "Capital allocation runs across two tabs.",
      "bullets": [
        {
          "label": "Sandbox",
          "text": "every Go project with its development, rollout, and sustainment costs in view \u2014 select any batch and watch the capacity waterfall and cumulative curve redraw to show you what the portfolio will look like if you advance that set."
        },
        {
          "label": "Commit & Advance",
          "text": "the real position rather than a rehearsal \u2014 what's already promised against what's available. Set each advancing project's assumed start date and move it into the development portfolio; a batch that crosses capacity needs a funding plan before anything advances."
        }
      ],
      "body2": "On a first pass, three to five projects \u2014 led by the quick wins \u2014 is the right size."
    },
    {
      "kind": "How",
      "headline": "Rehearse in the sandbox. Then make the call.",
      "body": "Start the sandbox with your quick wins and then try different mixes of candidates to find a preferred group that fits the charts. The waterfall and cumulative curve redraw with every batch you select, so a budget breach shows up while it still costs nothing. When the mix holds, switch tabs and advance your chosen projects one at a time: each advance sets an assumed start date and commits the project's full program cost.",
      "example": "A breach found in the sandbox is a rehearsal problem \u2014 drop a candidate, swap the mix, try again. The same breach found after advancing is a promise you now have to fund."
    },
    {
      "kind": "Outcome",
      "headline": "A funded cohort in Development \u2014 and a budget that stays honest.",
      "body": "You leave with your first cohort advanced into the Development portfolio and with funding commitments your budget can support.",
      "body2": "Nothing here is set in stone: the capital picture keeps updating as projects advance, launch, or stop, and the sandbox is waiting to test out new commitments whenever the next candidates are ready."
    }
  ],
  "3.4": [
    {
      "kind": "Why",
      "headline": "Prove it in stages before you commit at scale.",
      "body": "You have designed the initiatives. Now you build toward them in stages. Instead of committing to a full rollout, break the work into bounded phases that are cheap to reverse.",
      "example": "Amazon's 2015 [shareholder letter](https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF) split decisions into one-way doors, which are irreversible and costly, and two-way doors that you can walk back through. A good early phase is a two-way door. It is small enough to reverse, cheap enough to fail, and built so that you learn something whichever way it goes."
    },
    {
      "kind": "What",
      "headline": "Turn each project into a mapped development track.",
      "body": "You chose and funded this cohort at Allocate Capital. This step maps how each project will move through the Development stage, turning the steps sketched on the project card into a rigorous program. Every phase carries a budget, an owner, success metrics, and exit gate criteria.",
      "example": "[Robert Cooper](https://doi.org/10.1111/j.1540-5885.2008.00296.x), the developer of the stage-gate approach, found that one-size-fits-all development processes fail. The number of phases and gates should fit the size and risk of the project rather than follow a fixed template."
    },
    {
      "kind": "How",
      "headline": "Decide what each phase is meant to prove.",
      "body": "The fundamental question is whether the project can deliver its promised outcome. A development phase that answers part of that question has earned its budget. Different phases prove different things. An observation phase shows how the work happens today. An experiment tests whether the approach works at all. A pilot tests whether people will adopt it and how it fits your processes. Set each phase's success metrics and exit gate criteria against the thing it is meant to prove, so that its gate can deliver a clean pass or fail assessment on the outcome.",
      "example": "Take a vision system for catching production defects. The first phase of its development track might test whether the system can find, on a single production line, the flaws that a trained inspector finds. Later phases can then ask whether inspectors trust its judgment and what it would take to run it across the whole floor."
    },
    {
      "kind": "Outcome",
      "headline": "A mapped development track for every project.",
      "body": "You leave this step with a development track mapped for every project in the cohort. Each track sets out its phases, and every phase has a budget, an owner, success metrics, and exit gate criteria.",
      "body2": "This is the last step of preparation. The development tracks mapped here launch in Phase 4."
    }
  ],
  "4.1": [
    {
      "kind": "Why",
      "headline": "AI proves itself in the world, not just in the lab.",
      "body": "A development program is a sequence of encounters with reality: each phase, from the first observation work through to your last pilot, tests the technology and your organization against real conditions while the stakes are still small. Running the track is how you find out what actually works.",
      "example": "Google's retinal-screening model performed well in the lab, but it was only when [the company tested it in real clinics](https://www.technologyreview.com/2020/04/27/1000658/google-medical-ai-accurate-lab-real-life-clinic-covid-diabetes-retina-disease/) that they got to see how it actually behaved: the poor lighting conditions in many clinics meant that many scans were unreadable, showing that the current version wasn't ready to roll out yet."
    },
    {
      "kind": "What",
      "headline": "Watch the technology and the organization around it.",
      "body": "As each development phase runs, record two things. The first is how well the technology performs: whether it does the job under real conditions. The second is what it reveals about your organization: how the work is actually practiced around it \u2014 the processes it has to fit, the habits it has to change, the systems it has to connect to.",
      "example": "Make a special effort to record the awkward findings. A disappointing result or an organizational snag is not an embarrassment to be worked around \u2014 it is exactly the information the next gate needs."
    },
    {
      "kind": "How",
      "headline": "Take the gate as each phase ends.",
      "body": "When a phase ends, judge its evidence against the exit criteria written at Define Development Program and take the decision right here. Go marks the phase complete and opens the way to the next; Recycle records a fail-and-repeat, returning the phase to running with revised dates and budget; Kill stops the project and releases every phase not yet entered. If the evidence isn't in yet, take no decision \u2014 the gate stays open. The final gate's Go is the launch decision.",
      "body2": "One of the most common failure modes for an innovation portfolio is never killing anything. A kill taken at a gate is cheap by design \u2014 that is what the phases were for \u2014 and the released capital is now available to fund new potential winners."
    },
    {
      "kind": "Outcome",
      "headline": "Development programs running, evidence deciding what happens next.",
      "body": "You come out of this step with your programs running phase by phase and a live record of how the technology and the organization are each performing.",
      "body2": "From here, the work turns to putting the organization on a sound footing before you take on more projects."
    }
  ],
  "4.2": [
    {
      "kind": "Why",
      "headline": "An enduring innovation pipeline needs robust long-term management.",
      "body": "The ninety-day push builds real discipline, but without permanent management structures in place, it's easy to lose momentum. This step establishes leadership tools that will help manage pipeline health well beyond the initial jump-start period."
    },
    {
      "kind": "What",
      "headline": "Build a light management layer.",
      "body": "Set up a light-touch management layer that focuses just on the systems required to stay in control of the pipeline. Further governance processes to manage AI risk are dealt with under the Governance Jump-Start module."
    },
    {
      "kind": "How",
      "headline": "Put three standing mechanisms in place.",
      "body": "Set up:",
      "bullets": [
        {
          "label": "A standing leadership agenda item",
          "text": "pipeline health reviewed regularly in a senior meeting, against a few clear metrics."
        },
        {
          "label": "A pipeline intake rule",
          "text": "AI won't enter your organization only through this pipeline \u2014 departments buy tools, teams wire models into their workflows, vendors switch on AI features. Set a spending threshold that routes anything significant into the pipeline."
        },
        {
          "label": "A quarterly portfolio review",
          "text": "finance, operations, and technology leaders meet on a set date to weigh the whole portfolio and decide what continues, scales, or stops."
        }
      ],
      "body2": "These mechanisms only work if they are genuinely used. A gate that always approves, or a review that keeps slipping, does not provide real control."
    },
    {
      "kind": "Outcome",
      "headline": "Pipeline governance that stays in place.",
      "body": "You finish with the three mechanisms set up and scheduled: the meeting, the gate, and the review each assigned to real people and dates. Managing the pipeline is now part of how the business runs, rather than something that depends on the initial effort."
    }
  ],
  "4.3": [
    {
      "kind": "Why",
      "headline": "Take stock of how your organizational structure performed.",
      "body": "Running live experiments should put your organizational structures under real pressure. This step is where you look at how they held up and decide what needs changing."
    },
    {
      "kind": "What",
      "headline": "A light review, not a full redesign.",
      "body": "This is a quick health check, not a deep reorganization. You're looking for the few things most worth adjusting, rather than trying to rebuild from the ground up. Building the right culture for your AI-ready business and designing your organization to fit are each the subject of a 90-day Jump-Start module of their own."
    },
    {
      "kind": "How",
      "headline": "Review four areas, then list what to fix.",
      "body": "Look back over the first seventy days and rate how well each part of the structure is working:",
      "bullets": [
        {
          "label": "Decision rights",
          "text": "Are the right decisions getting made or are they still getting stuck?"
        },
        {
          "label": "The ownership model",
          "text": "Is it giving both a clear overall view and empowering people close to the work?"
        },
        {
          "label": "Incentives",
          "text": "Are the changes actually shifting behavior?"
        },
        {
          "label": "Culture",
          "text": "Is it starting to shift, or are old habits reasserting themselves?"
        }
      ],
      "body2": "Based on your answers, draw up a short list of the things most in need of adjustment. This is only useful if you're honest. Scoring every line highly tells you nothing about what to improve."
    },
    {
      "kind": "Outcome",
      "headline": "A clear list of what to adjust.",
      "body": "You finish with a clear picture of how the structure is performing and a short list of priorities to adjust. These kinds of changes are not one-time fixes: the structure will keep needing adjustment as the pipeline grows."
    }
  ],
  "4.4": [
    {
      "kind": "Why",
      "headline": "The first comprehensive pipeline review is where the cycle really begins.",
      "body": "Your organization won't undergo a complete transformation in ninety days, but the pipeline you build will keep the engine running. This review is the first turn of that cycle: you act on what you learned from the development phases, bring in new ideas, and carry the lessons forward. Repeated regularly, it's what keeps the pipeline running.",
      "example": "Lasting value comes from managing your AI transformation as [a portfolio that is reviewed and rebalanced over time](https://hbr.org/2026/01/manage-your-ai-investments-like-a-portfolio) \u2014 scaling what works and dropping what doesn't."
    },
    {
      "kind": "What",
      "headline": "The first judgments made on real results.",
      "body": "Every choice up to now rested on estimates: which ideas to pursue, which to fund, how to balance the portfolio. This review is the first time you judge those initiatives on their real-world outputs, working with live results rather than projections. It is also the point where those judgments begin to carry real weight, shaping what continues and what comes next."
    },
    {
      "kind": "How",
      "headline": "Decide how each initiative moves, then capture the learnings.",
      "body": "The review has three parts:",
      "bullets": [
        {
          "label": "Buy, sell, or hold",
          "text": "for each initiative, decide whether to scale it, stop it, or keep it running as is based on what you have learned so far."
        },
        {
          "label": "Replenish and rebalance",
          "text": "add new opportunities to the pipeline, and check whether the mix across time horizons and risk is still right."
        },
        {
          "label": "Capture the learnings",
          "text": "what worked, what didn't, and what you need to change for the next cycle."
        }
      ],
      "body2": "Your decisions should be based on the evidence you have gathered, not your initial enthusiasm for the ideas."
    },
    {
      "kind": "Outcome",
      "headline": "The ninety days are done. The engine is running.",
      "body": "You finish with a decision on every initiative, a replenished pipeline, and a clear set of lessons for the next round. You now have a working innovation pipeline and the review process needed to sustain it.",
      "body2": "The ninety days were the jump-start. Repeating this cycle is what turns that initial push into a lasting capability."
    }
  ]
};

function hexToRgba(hex, alpha){
  var h = String(hex||'').replace('#','');
  if(h.length===3) h = h.split('').map(function(c){return c+c}).join('');
  var r = parseInt(h.substr(0,2),16) || 0;
  var g = parseInt(h.substr(2,2),16) || 0;
  var b = parseInt(h.substr(4,2),16) || 0;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function phaseColorFor(stepId){
  // Theme-aware program data: these hexes feed hexToRgba(), so they cannot be
  // CSS var() references. Light mode uses the phase base hues for contrast.
  var m = (typeof UI!=='undefined' && UI.theme==='dark')
    ? {'1':'#4FB39A','2':'#6B9FE0','3':'#C8956A','4':'#E07788'}
    : {'1':'#1B6B5A','2':'#2D5A8E','3':'#8B5E3C','4':'#9B2D3F'};
  return m[String(stepId).charAt(0)] || '#B8892A';
}

/* Icon for each slide kind */
function vpSlideIcon(kind){
  return {Why:'?', What:'■', How:'▲', Outcome:'★'}[kind] || '●';
}

/* Carousel state — one carousel per page, idx persists per step */
var carouselState = {idx:0, timer:null, stepId:null, hover:false};

function carouselGo(idx, manual){
  var slides = document.querySelectorAll('.vp-slide');
  var dots = document.querySelectorAll('.vp-dot');
  if(!slides.length) return;
  var n = slides.length;
  var prevIdx = carouselState.idx;
  carouselState.idx = ((idx % n) + n) % n;
  var anim = manual || carouselState.idx !== prevIdx;
  slides.forEach(function(s,i){var on=i===carouselState.idx;s.classList.toggle('active', on);if(on){if(anim){s.style.animation='none';void s.offsetWidth;s.style.animation='vpSlideIn .4s ease';}else{s.style.animation='none';}}});
  dots.forEach(function(d,i){d.classList.toggle('active', i===carouselState.idx)});
  if(manual) carouselReset();
}

function carouselTick(){
  carouselState.timer = setInterval(function(){
    if(currentModal){ return; }
    var n = document.querySelectorAll('.vp-slide').length;
    if(!n){ clearInterval(carouselState.timer); carouselState.timer=null; return; }
    carouselGo(carouselState.idx + 1);
  }, 15000);
}

function carouselReset(){
  if(carouselState.timer){ clearInterval(carouselState.timer); carouselState.timer=null; }
  if(!carouselState.hover) carouselTick();
}

function carouselInit(){
  var car = document.querySelector('.vp-carousel');
  if(!car){
    if(carouselState.timer){ clearInterval(carouselState.timer); carouselState.timer=null; }
    carouselState.stepId = null;
    return;
  }
  var stepId = car.getAttribute('data-step');
  // Reset idx when switching steps
  if(carouselState.stepId !== stepId){
    carouselState.idx = 0;
    carouselState.stepId = stepId;
  }
  carouselState.hover = false;
  var slides = document.querySelectorAll('.vp-slide');
  if(carouselState.idx >= slides.length) carouselState.idx = 0;
  carouselGo(carouselState.idx);
  if(carouselState.timer) clearInterval(carouselState.timer);
  carouselTick();
  // Pause on hover
  car.addEventListener('mouseenter', function(){
    carouselState.hover = true;
    if(carouselState.timer){ clearInterval(carouselState.timer); carouselState.timer=null; }
  });
  car.addEventListener('mouseleave', function(){
    carouselState.hover = false;
    if(!carouselState.timer) carouselTick();
  });
}

function richInline(s){
  if(!s) return '';
  var out = esc(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="vp-link">$1</a>');
  return out;
}

function vpCarousel(code, title, dur, content){
  if(!content || !content.length){
    return '<div class="vp"><div class="vp-play"><span class="vp-play-icon">\u25b6</span></div><div><div class="vp-title">'+esc(title)+'</div><div class="vp-meta">'+esc(dur)+' \xb7 '+esc(code)+'</div></div></div>';
  }
  var stepId = code.replace(/^V-/,'').split('.').slice(0,2).join('.');
  var phColor = phaseColorFor(stepId);
  var total = content.length;
  var slides = content.map(function(s, i){
    var icon = vpSlideIcon(s.kind);
    var num = String(i+1).padStart(2,'0') + ' / ' + String(total).padStart(2,'0');
    return '<div class="vp-slide'+(i===0?' active':'')+'">'
      + '<div class="vp-slide-meta">'
      +   '<div class="vp-slide-icon">'+icon+'</div>'
      +   '<div class="vp-slide-eyebrow">'+esc(s.kind)+'</div>'
      +   '<div class="vp-slide-num">'+num+'</div>'
      + '</div>'
      + '<h3 class="vp-slide-headline">'+esc(s.headline)+'</h3>'
      + '<p class="vp-slide-body">'+richInline(s.body)+'</p>'
      + (s.bullets && s.bullets.length ? '<ul class="vp-slide-bullets">'+s.bullets.map(function(b){return '<li>'+(b.label?'<span class="vp-bullet-label">'+esc(b.label)+':</span> ':'')+richInline(b.text)+'</li>';}).join('')+'</ul>' : '')
      + (s.body2 ? '<p class="vp-slide-body vp-slide-body2">'+richInline(s.body2)+'</p>' : '')
      + (s.example ? '<div class="vp-slide-example"><div class="vp-example-text">'+richInline(s.example)+'</div></div>' : '')
      + '</div>';
  }).join('');
  var dots = content.map(function(_, i){
    return '<button class="vp-dot'+(i===0?' active':'')+'" onclick="carouselGo('+i+', true)" aria-label="Slide '+(i+1)+'"></button>';
  }).join('');
  return '<div class="vp-carousel" data-step="'+stepId+'" style="--ph:'+phColor+';--ph-bg:'+hexToRgba(phColor,0.10)+';--ph-glow:'+hexToRgba(phColor,0.18)+'">'
       + '<button class="vp-nav vp-prev" onclick="carouselGo(carouselState.idx-1, true)" aria-label="Previous slide">\u2039</button>'
       + '<button class="vp-nav vp-next" onclick="carouselGo(carouselState.idx+1, true)" aria-label="Next slide">\u203a</button>'
       + '<div class="vp-slides">'+slides+'</div>'
       + '<div class="vp-dots">'+dots+'</div>'
       + '</div>';
}

function vp(code,title,dur){var stepId=code.replace(/^V-/,'').split('.').slice(0,2).join('.');return vpCarousel(code,title,dur,(CAROUSEL_CONTENT||{})[stepId])}
function doneBtn(onclick,disabled,label,complete,helper){if(complete)return'<div class="done-wrap">'+btn(label||'✓ Complete',onclick,'bd done-btn done-btn-complete','',false)+'</div>';return'<div class="done-wrap" onclick="gatePeek(event)">'+btn(label||'\u2713 Mark Complete & Continue \u2192',onclick,'bd done-btn','',disabled)+(disabled?'<p class="done-helper">'+(helper||'Complete required fields (*) first.')+'</p>':'')+'</div>'}
function pipeViz(activeStage,navMap,live){var st=getStages(); /* live (17 Sep 2026): on the dashboard the chevrons open the live portfolio pages */var nm=navMap||{bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};var stages=[{k:'bluesky',n:'Blue Sky',c:'#1B6B5A',cnt:bsNowList(st).length,nav:nm.bluesky},{k:'explore',n:'Exploration',c:'#2D5A8E',cnt:st.explore.length,nav:nm.explore},{k:'experiment',n:'Development',c:'#8B5E3C',cnt:st.experiment.length,nav:nm.experiment},{k:'operate',n:'Operational',c:'#9B2D3F',cnt:(st.operational||[]).length,nav:nm.operate}];var h='<div class="u-778010b">';var _dk=(typeof UI!=='undefined'&&UI.theme==='dark');stages.forEach(function(s,i){var lit=s.cnt>0||s.k===activeStage;
/* Fill opacity is theme-aware: translucent fills read rich on the dark ground but
   wash to pastel over the light one, killing the white labels (Faisal, July 10).
   Light mode therefore renders near-solid fills so white text keeps contrast. */
var _op=s.k===activeStage?1:(activeStage?(_dk?.32:.35):(_dk?.55:.95));
var _dim=activeStage&&s.k!==activeStage;
var _nameFill=_dim?(_dk?'rgba(244,246,249,.6)':'rgba(36,46,60,.8)'):'#fff';
var _cntFill=_dim?(_dk?'rgba(244,246,249,.5)':'rgba(36,46,60,.65)'):'rgba(255,255,255,.92)';
h+='<div class="phase-flex" style="--op:'+(lit?1:.4)+'" onclick="'+(live?'go(\'portfolio\',\''+s.nav+'\')':'go(\''+s.nav+'\')')+'"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+s.c+'" opacity="'+_op+'"'+(s.k===activeStage?' stroke="#000" stroke-width="1.5"':'')+'/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="'+_nameFill+'" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+s.n+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="'+_cntFill+'" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+s.cnt+' item'+(s.cnt!==1?'s':'')+'</text></svg></div>'});return h+'</div>'}
// Sidebar/topbar handled by master

// Home handled by master
// Per-phase intro videos. Add an entry (and put the matching .mp4 in assets/media/, see MEDIA_BASE)
// as each phase's video is produced; the player appears automatically.
var PHASE_VIDEOS={
  1:{src:'innov-phase1.mp4',label:'Phase One \u00b7 Diagnose'},
  2:{src:'innov-phase2.mp4',label:'Phase Two \u00b7 Organize'},
  3:{src:'innov-phase3.mp4',label:'Phase Three \u00b7 Prepare'},
  4:{src:'innov-phase4.mp4',label:'Phase Four \u00b7 Ignite'},
  5:{src:'innov-phase5.mp4',label:'Phase Five \u00b7 Navigate'}
};
function renderPhaseLandingPipe(phaseId){
var p=PH.find(function(x){return x.id===phaseId});if(!p)return'';var _w='<div class="content-area pt-110"><div class="content-inner">'+(backBtn()?'<div class="mb-3">'+backBtn()+'</div>':'');var _we='</div></div>';
var desc=PHASE_DESCS[phaseId]||{};var flow=STEP_FLOW[phaseId]||[];
var done=p.steps.filter(function(s){return isStepDone(s.id)}).length;var total=p.steps.length;var pct=total?Math.round(done/total*100):0;

var ideas=data.ideas||[],as=data.assessments||{},sel=data.selected||[],ow=data.ownership||{},rh=data.rhythm||{},proj=data.projects||{},cap=data.capital||{},port=data.portfolio||{},exp=data.experiments||{},exSel=data.expSelected||[],trk=data.tracking||{},gov=data.governance||{},cu=data.culture||{};
var cs=Object.values(cu).filter(function(v){return typeof v==='number'});var cScore=cs.length?(cs.reduce(function(a,b){return a+b},0)/cs.length).toFixed(1):'\u2014';

var metrics=phaseId===1?[{l:'Ideas Generated',v:ideas.length,ic:'◇'},{l:'Ideas Filtered',v:sel.length,ic:'◉'},{l:'Culture Score',v:cScore+'/5',ic:'▒'},{l:'Steps Complete',v:done+'/'+total,ic:'✓'}]
:phaseId===2?[{l:'Owner Set',v:ow.ownerName?'Yes':'No',ic:'○'},{l:'RACI Items',v:Object.keys(data.raci||{}).length,ic:'⊕'},{l:'Rhythm Set',v:rh.day?'Yes':'No',ic:'↻'},{l:'Projects Deepened',v:sel.filter(function(i){return(proj[i]||{}).viable!==undefined}).length,ic:'◉'}]
:phaseId===3?[{l:'Portfolio Items',v:Object.keys(port).length,ic:'▶'},{l:'Budget Set',v:cap.aiBudget?'Yes':'No',ic:'◻'},{l:'Tracks Mapped',v:Object.keys(data.budgetPlans||{}).filter(function(k){return bpHasDev(parseInt(k,10))}).length,ic:'△'},{l:'Quick Wins',v:Object.keys(port).filter(function(k){return port[k]&&port[k].horizon==='quick'}).length,ic:'→'}]
:[{l:'Programs Tracked',v:Object.keys(trk).filter(function(k){return trk[k]&&trk[k].status}).length,ic:'\u25b6'},{l:'Governance Set',v:gov.meeting?'Yes':'No',ic:'—'},{l:'Review Done',v:(data.completedSteps||{})['4.4']?'Yes':'No',ic:'■'},{l:'Stress Tested',v:(data.completedSteps||{})['4.3']?'Yes':'No',ic:'✕'}];

var mNav={1:{'0':'1.2','1':'1.3','2':'1.1','3':'1.1'},2:{'0':'2.1','1':'2.1','2':'2.3','3':'2.4'},3:{'0':'3.1','1':'3.3','2':'3.4','3':'out-expbriefs'},4:{'0':'4.1','1':'4.2','2':'4.4','3':'4.3'}};

var h=_w;
var _pv=PHASE_VIDEOS[phaseId];
if(_pv){ h+='<div class="overview-video-card mb-6"><div class="overview-video-label" style="color:'+p.color+'">'+esc(_pv.label)+'</div>'
 +'<video class="overview-video" controls preload="auto" playsinline><source src="'+MEDIA_BASE+encodeURI(_pv.src)+'" type="video/mp4">Your browser does not support embedded video.</video></div>'; }
h+=vizTimeline(phaseId);
h+='<div class="u-96f7104"><div style="width:64px;height:64px;border-radius:32px;background:'+p.color+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0">'+phaseId+'</div><div><div class="flx-center gap-2"><h1 class="u-09ee37b">'+p.name+'</h1>'+badge(p.days,p.color)+'</div><p class="u-ccba76a">'+esc(desc.n||'')+'</p></div></div>';

// Metrics
h+='<div class="u-f78be26">';
metrics.forEach(function(m,i){var dest=(mNav[phaseId]||{})[i];h+=card('<div class="t-center" data-clickable="'+(dest?1:0)+'" onclick="'+(dest?'go(\''+dest+'\')':'')+'" ><div class="u-e5e6f83">'+m.ic+'</div><div class="ph-score" style="--c:'+p.color+'">'+m.v+'</div><div class="u-5964388">'+m.l+'</div></div>','padding:16px;border-top:3px solid '+p.color)});
h+='</div>';

// Progress (hidden on the Navigate landing - no steps to complete there)
if(phaseId!==5)h+=card('<div class="flx-row-mb-12"><h3 class="u-3526083">Progress</h3>'+badge(done+'/'+total+' steps \xb7 '+pct+'%',pct===100?'#1B6B5A':p.color)+'</div><div class="u-bc01850"><div class="pct-fill" data-full="'+(pct===100?1:0)+'" style="--w:'+pct+'%;--c:'+p.color+'"></div></div><div class="u-6f946a0">'+flow.map(function(s,i){var d=isStepDone(s.id);var r='<div onclick="go(\''+s.id+'\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:8px 12px;border-radius:8px;background:'+(d?'rgba(27,107,90,.06)':'transparent')+';min-width:70px"><div style="width:36px;height:36px;border-radius:18px;background:'+(d?'#1B6B5A':p.color+'20')+';color:'+(d?'#fff':p.color)+';display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid '+(d?'#1B6B5A':p.color)+'">'+(d?'\u2713':s.icon)+'</div><div class="flow-label" data-done="'+(d?1:0)+'">'+s.sh+'</div></div>';if(i<flow.length-1)r+='<div class="flow-conn" data-done="'+(d&&isStepDone(flow[i+1].id)?1:0)+'"></div>';return r}).join('')+'</div>','margin-bottom:24px');

// Phase-complete wrap-up: persistent home on the landing once every step in the phase is done (July 10)
if(phaseId!==5&&pct===100&&PHASE_WRAPUPS[phaseId]){
h+='<div class="milestone-card">';
h+='<div class="milestone-label">\u2713 Phase '+phaseId+' Complete</div>';
h+='<div class="milestone-text">'+PHASE_WRAPUPS[phaseId]+'</div>';
h+='</div>';
}

// Steps + Outcomes grid
h+='<div class="gr-2-mb"><div><div class="label-tiny">Steps</div>';
p.steps.forEach(function(s){var d=isStepDone(s.id);h+='<div onclick="go(\''+s.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid '+(d?'#1B6B5A':p.color)+'"><div style="width:20px;height:20px;border-radius:10px;background:'+(d?'#1B6B5A':p.color+'20')+';color:'+(d?'#fff':p.color)+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">'+(d?'\u2713':s.id.split('.')[1])+'</div><span style="font-size:13px;font-weight:600;color:'+(d?'#1B6B5A':'var(--paper)')+';flex:1">'+s.id+' '+s.name+'</span>'+(d?'<span class="u-5ca1883">\u2713</span>':'')+'</div>'});
h+='</div><div><div class="label-tiny">Outcomes</div>';
(p.outcomes||[]).forEach(function(o){h+='<div onclick="go(\''+o.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid '+p.color+'"><span class="u-3dd9b4c">'+o.icon+'</span><span class="u-884cbc8">'+o.name+'</span><span class="u-38575ff">\u2192</span></div>'});
h+='</div></div>';


// Completion
if(pct===100){var msg=phaseId===1?'You\'ve diagnosed your organization\'s AI readiness and built a ranked portfolio.':phaseId===2?'Your organizational machinery is in place.':phaseId===3?'Portfolio structured, capital allocated, experiments designed.':'Experiments launched, governance established, first review complete.';var next=phaseId<4?'phase-'+(phaseId+1):'5.1';var nextLabel=phaseId<4?'Continue to Phase '+(phaseId+1)+': '+PH[phaseId].name+' \u2192':'Go to Pipeline Dashboard \u2192';h+=card('<div class="t-center"><div class="u-e0bd553">★</div><h3 class="h-sub">Phase '+phaseId+' Complete</h3><p class="u-bbfc088">'+esc(msg)+'</p>'+btn(nextLabel,'go(\''+next+'\')','bp','margin-top:12px')+'</div>','background:rgba(27,107,90,.06);border:2px solid #1B6B5A')}
return h+_we}
// === PHASE 1 STEPS ===
// Likert setter helper
function likSet(path,n){var parts=path.split('.');if(lockBlocked(parts[0]))return;if(parts.length===3){if(!data[parts[0]])data[parts[0]]={};if(!data[parts[0]][parts[1]])data[parts[0]][parts[1]]={};data[parts[0]][parts[1]][parts[2]]=n}else if(parts.length===2)updObj(parts[0],parts[1],n);else if(parts.length===1)data[parts[0]]=n;Store.commit(parts[0],parts.length>=2?parts[1]:null);render()}
// Generic field change from DOM
function renderStep11(){
var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},au=data.audit||[],de=data.decisions||{},co=data.completedSections||{};
var sec=UI.sec;
var secs=[{id:'1.1',l:'Purpose',c:!!co['1.1']},{id:'1.2',l:'AI Knowledge',c:!!co['1.2']},{id:'1.3',l:'Risk & Culture',c:!!co['1.3']},{id:'1.4',l:'AI Innovation Audit',c:!!co['1.4'],inv:true},{id:'1.5',l:'Decision Rights',c:!!co['1.5'],inv:true}];
var allC=secs.every(function(s){return s.c});
var h=vp('V-1.1.1','Assessment Battery','3\u20135 min');
h+='<h2 class="h-section">Step 1: Assessment Battery</h2><p class="t-lead">This step builds an honest picture of where your organization starts. It has five sections of two kinds. The three Questionnaire sections ask for judgments: you rate your organization and select the descriptions that fit best, drawing on what you already know. The two Investigative sections ask for facts, and you may need to go and find out what is actually happening before you can complete them. Finish all five and the Assessment Report becomes available under Outcomes.</p>';

// Section tabs
h+='<div class="mb-6"><div class="label-tiny-faint">Questionnaire</div><div class="u-4ce13a4">';
secs.filter(function(s){return!s.inv}).forEach(function(s){h+='<button onclick="UI.sec=\''+s.id+'\';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(sec===s.id?'2px solid #1B6B5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(s.c?'rgba(27,107,90,.08)':'rgba(var(--fg-rgb),.03)')+';color:'+(sec===s.id||s.c?'#1B6B5A':'var(--text-faint)')+'">'+(s.c?'\u2713':'\u25cb')+' '+s.l+'</button>'});
h+='</div><div class="label-tiny-faint">Investigative</div><div class="flx-g2-wrap">';
secs.filter(function(s){return s.inv}).forEach(function(s){h+='<button onclick="UI.sec=\''+s.id+'\';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(sec===s.id?'2px solid #1B6B5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(s.c?'rgba(27,107,90,.08)':'rgba(var(--fg-rgb),.03)')+';color:'+(sec===s.id||s.c?'#1B6B5A':'var(--text-faint)')+'">'+(s.c?'\u2713':'\u25cb')+' '+s.l+'</button>'});
h+='</div></div>';

if(sec==='1.1'){h+=card('<h3 class="h-sub">1.1 Reaffirm Your Purpose</h3><p class="t-lead">Purpose is what your organization exists to do: the change it creates for its customers and the reason the work matters to the people who do it. Everything in this program will be judged against it, because AI initiatives succeed when they serve that purpose and fail when they chase the technology for its own sake. Write your purpose down as it actually is, not as your marketing materials present it or as you wish it was. Be just as honest about the frictions that stop the organization from delivering on it.</p>'+ta('Mission *','p_mission',p.mission,'e.g. We design and manufacture products to bring people joy and we do it in a way that delivers maximal value to our stakeholders.',3)+ta('Values','p_values',p.values,'e.g. Quality, Partnership...',2)+ta('Short-term targets','p_shortTerm',p.shortTerm,'Next 6 months',2)+ta('Medium-term targets','p_mediumTerm',p.mediumTerm,'6\u201318 months',2)+ta('Long-term targets','p_longTerm',p.longTerm,'18+ months',2)+ta('Key goals *','p_goals',p.goals,'e.g. 1. Revenue growth...',3)+ta('Friction points *','p_frictions',p.frictions,'e.g. 1. Slow quoting...',4)+doneBtn('saveSection11()',!(p.mission&&p.goals&&p.frictions),null,co['1.1']))}
if(sec==='1.2'){h+=card('<h3 class="h-sub">1.2 AI Knowledge Base</h3><p class="t-lead">This section captures what your organization currently knows about AI and what it can do with this technology. Answer for the organization as a whole, not for its most advanced team, and answer as things stand today rather than as planned.</p>'+sel('Current usage *','k_usage',k.usage,[{v:'',l:'Select...'},{v:'none',l:'None'},{v:'basic',l:'Basic'},{v:'moderate',l:'Moderate'},{v:'advanced',l:'Advanced'}],'None means no AI in use anywhere. Basic means individuals use general tools such as chatbots for their own work. Moderate means at least one team runs an AI-assisted process or purpose-built tool. Advanced means AI is embedded in core operations with people responsible for running it.')+likert('Leadership awareness *','knowledge.awareness',k.awareness,'Unaware','Very aware','How well the leadership team understands what AI can and cannot do for this organization. Rate the awareness of leaders who make the investment decisions, not the best-informed individual senior executives.')+sel('Technical resources','k_resources',k.resources,[{v:'',l:'Select...'},{v:'none',l:'None'},{v:'limited',l:'Limited'},{v:'moderate',l:'Moderate'},{v:'strong',l:'Strong'}],'The people and infrastructure available for technical work: data that is accessible and usable, systems that can be integrated, and staff or partners who can build and maintain technology.')+sel('Learning processes','k_learning',k.learning,[{v:'',l:'Select...'},{v:'none',l:'None'},{v:'informal',l:'Informal'},{v:'some',l:'Some'},{v:'systematic',l:'Systematic'}],'How the organization turns experience into shared capability. Systematic means lessons are captured and taught and that the results change how work is done. Informal means learning stays in individual heads.')+doneBtn('saveSection12()',!(k.usage&&k.awareness),null,co['1.2']))}
if(sec==='1.3'){h+=card('<h3 class="h-sub">1.3 Risk & Culture</h3><p class="t-lead">Culture decides what happens to new ideas in your organization, and comfort with risk decides whether your team members will try something that might fail. Together these two factors predict AI success more reliably than any technical factor, which is why this section measures them before a single use case is chosen. Rate what actually happens in your organization, not what the values statement says should happen.</p>'+likert('Uncertainty *','culture.uncertainty',cu.uncertainty,'Uncomfortable','Comfortable','How people respond when the outcome of a piece of work is genuinely unknown. Uncomfortable means ambiguity gets escalated or avoided. Comfortable means teams work productively without knowing how things will turn out.')+likert('AI legitimacy *','culture.aiLegitimacy',cu.aiLegitimacy,'Stigma','Accepted','Whether using AI at work is seen as legitimate. Stigma means people hide their use of AI tools. Accepted means using them openly is normal and unremarkable.')+likert('New proposals','culture.newProposals',cu.newProposals,'Shut down','Support','What happens when someone suggests a new way of working. Shut down means ideas die in the meeting where they are raised. Support means they get a fair hearing and a path to being tried.')+likert('Incentives','culture.incentives',cu.incentives,'Punish','Reward','What the organization actually rewards and punishes. Punish means a failed initiative damages a career. Reward means a well-run attempt counts in your favor even when it fails.')+likert('Frontline','culture.frontline',cu.frontline,'None','Strong','How much improvement comes from the people who do the daily work. None means change only arrives from above. Strong means frontline staff routinely propose and shape improvements.')+likert('Overall *','culture.overall',cu.overall,'Stagnant','Innovative','Your summary judgment of the whole culture, taking the five ratings above together. Stagnant means the organization repeats what it knows. Innovative means it regularly tries, adopts, and spreads new ways of working.')+doneBtn('saveSection13()',!(cu.uncertainty&&cu.aiLegitimacy&&cu.overall),null,co['1.3']))}
if(sec==='1.4'){
h+=card('<h3 class="h-sub">1.4 AI Innovation Audit</h3><p class="t-lead">Inventory every AI initiative that existed anywhere in your enterprise on day one of this 90-day program, including unofficial ones. This is investigative work: ask around, because the initiatives leadership knows about are rarely the full list.</p><p class="t-faint-sm" style="margin-top:-2px;margin-bottom:10px">Alive means actively worked on today. Dormant means paused but not cancelled. Dead means stopped permanently, whether or not anyone formally closed it.</p>'+au.map(function(item,i){return'<div class="u-820b58c"><input id="au_'+i+'_name" value="'+esc(item.name)+'" placeholder="Name" onchange="saveAudit()" class="u-ad9e56b"/><select id="au_'+i+'_status" onchange="saveAudit()" class="u-10e0573"><option value="">Status</option><option value="alive"'+(item.status==='alive'?' selected':'')+'>Alive</option><option value="dead"'+(item.status==='dead'?' selected':'')+'>Dead</option><option value="dormant"'+(item.status==='dormant'?' selected':'')+'>Dormant</option></select><button onclick="removeAudit('+i+')" class="no-btn">\xd7</button></div>'}).join('')+btn('+ Add','addAudit()','bs')+doneBtn('saveSection14()',false,null,co['1.4']))}
if(sec==='1.5'){
var qs=[{key:'q1',l:'Approve experiments *',ph:'e.g. CEO',t:'Who can authorize a new experiment to start, including its budget.'},{key:'q2',l:'Advance projects',ph:'e.g. VP Ops',t:'Who decides that a successful experiment moves into serious development.'},{key:'q3',l:'Reallocate budget',ph:'e.g. CFO',t:'Who can move money between projects mid-year without a new budget round.'},{key:'q4',l:'Kill projects *',ph:'e.g. Nobody',t:'Who can stop a project that is not working. \u201cNobody\u201d is a common and important answer.'},{key:'q5',l:'Cross-functional resources',ph:'e.g. Informal',t:'Who can commit people from more than one function to the same initiative.'}];
h+=card('<h3 class="h-sub">1.5 Decision Rights</h3><p class="t-lead">Innovation moves at the speed of its decisions, so this section records who can actually say yes. For each decision, name the specific person or role responsible for it today. Use the gaps field where the answer is unclear, contested, or missing. If nobody can approve an experiment or nobody can kill a project, that is a finding that needs to be preserved and reported, not glossed over. Later steps in the program will fix it.</p>'+qs.map(function(q){return'<div class="mb-4"><label class="u-f9f7426" title="'+esc(q.t||'')+'">'+q.l+'</label><input id="de_'+q.key+'_who" value="'+esc((de[q.key]||{}).who)+'" placeholder="'+q.ph+'" onchange="saveDecision(\''+q.key+'\')" class="u-c9c7cfe'+(/\*/.test(q.l)?' gate-field':'')+'"/><input id="de_'+q.key+'_gap" value="'+esc((de[q.key]||{}).gap)+'" placeholder="Gaps..." onchange="saveDecision(\''+q.key+'\')" class="u-b00da80"/></div>'}).join('')+doneBtn('saveSection15()',!((de.q1||{}).who&&(de.q4||{}).who),(allC?'\u2713 Battery Complete':'\u2713 Complete \u2192'),co['1.5'])+(allC?card('<p class="u-c613036">\u2713 Assessment Report available under Outcomes.</p>','margin-top:20px;border:2px solid #1B6B5A;background:rgba(27,107,90,.06)'):''))}
if(allC)h+=vizRadar();
h+='</div>';
return h}

// Save helpers for step 1.1
function savePurposeFields(){['mission','values','shortTerm','mediumTerm','longTerm','goals','frictions'].forEach(function(f){var v=val('p_'+f);if(v!==undefined){if(!data.purpose)data.purpose={};data.purpose[f]=v}});saveData()}
/* Completion confirms (QA sweep 2 item 11, ruled July 9): steps and sub-sections confirm before
   committing - completion notifies the team (steps) and has no undo path. Phase actions confirm
   plainly. Re-clicking an already-complete button stays silent - idempotent, never re-notifies. */
function confirmStepDone(sid){if((data.completedSteps||{})[sid])return true;return confirm('Mark this step complete? This will notify the team and can\u2019t be undone.')}
function confirmSectionDone(s){if((data.completedSections||{})[s])return true;return confirm('Mark this section complete? This can\u2019t be undone.')}
function saveSection11(){if(!confirmSectionDone('1.1'))return;savePurposeFields();if(!data.completedSections)data.completedSections={};data.completedSections['1.1']=true;UI.sec='1.2';saveData();render()}
function saveSection12(){if(!confirmSectionDone('1.2'))return;if(!data.knowledge)data.knowledge={};data.knowledge.usage=val('k_usage');data.knowledge.resources=val('k_resources');data.knowledge.learning=val('k_learning');if(!data.completedSections)data.completedSections={};data.completedSections['1.2']=true;UI.sec='1.3';saveData();render()}
function saveSection13(){if(!confirmSectionDone('1.3'))return;if(!data.completedSections)data.completedSections={};data.completedSections['1.3']=true;UI.sec='1.4';saveData();render()}
function saveAudit(){var au=data.audit||[];for(var i=0;i<au.length;i++){au[i].name=val('au_'+i+'_name');au[i].status=val('au_'+i+'_status')}data.audit=au;Store.commit('audit');refreshSecDone()}
function addAudit(){if(lockBlocked('audit'))return;if(!data.audit)data.audit=[];data.audit.push({name:'',status:''});Store.commit('audit');render()}
function removeAudit(i){if(lockBlocked('audit'))return;data.audit=(data.audit||[]).filter(function(_,j){return j!==i});Store.commit('audit');render()}
function saveSection14(){if(!confirmSectionDone('1.4'))return;saveAudit();if(!data.completedSections)data.completedSections={};data.completedSections['1.4']=true;UI.sec='1.5';saveData();render()}
function saveDecision(key){if(Collab.lockedByOther('decisions::'+key))return;if(!data.decisions)data.decisions={};if(!data.decisions[key])data.decisions[key]={};data.decisions[key].who=val('de_'+key+'_who');data.decisions[key].gap=val('de_'+key+'_gap');Store.commit('decisions',key);refreshSecDone()}
function saveSection15(){if(!confirmSectionDone('1.5'))return;saveDecision('q1');saveDecision('q2');saveDecision('q3');saveDecision('q4');saveDecision('q5');if(!data.completedSections)data.completedSections={};data.completedSections['1.5']=true;saveData();render()}

// Step 1.2 Brainstorm
function renderStep12(){
var ideas=data.ideas||[];
var h=vp('V-1.2.1','Brainstorming AI Use Cases','3\u20135 min');
h+='<h2 class="h-section">Step 2: Brainstorm</h2><p class="t-lead">How can AI address your friction points or advance your organizational purpose? This is the widest point of the pipeline, so aim for ten to twenty ideas and do not filter for feasibility yet. Cheap, obvious, ambitious, and expensive ideas all belong on the board, and the next step does the sorting. Mark an idea Now if the technology to attempt it exists today, and Future if it depends on capabilities that are still maturing.</p>';
h+='<div class="u-2d6fe45"><button onclick="UI.showEx.aurora=!UI.showEx.aurora;render()" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;border:1px dashed rgba(27,107,90,.5);background:'+(UI.showEx.aurora?'rgba(27,107,90,.06)':'transparent')+';cursor:pointer;font-size:13px;font-weight:600;color:#1B6B5A;font-family:var(--sans,Helvetica Neue,sans-serif)">'+(UI.showEx.aurora?'\u25be':'\u25b8')+' Example</button>'+(UI.showEx.aurora?'<div class="u-b560a5f"><p style="font-size:13px;line-height:1.65;margin:0 0 10px"><strong>Aurora Windows</strong> is a 35-year-old, second-generation manufacturer of doors, windows, and architectural glass for commercial and residential building projects. With around 220 employees across one main plant and two regional distribution hubs, it is large enough to feel pressure from global competitors but too small to carry a dedicated transformation department. Its leadership aims to make Aurora the go-to innovation partner for sustainable, smart building projects by becoming a fully AI-driven business. Aurora appears as a worked example throughout this module \u2013 <a href="https://faisalhoque.com/how-to-build-an-ai-innovation-pipeline-that-creates-real-long-term-value/" target="_blank" rel="noopener" style="color:var(--ref-accent)">read its full background here</a>.</p>'+[{n:'AI-Powered Quoting Engine',d:'Automate quoting using specs, costs, and historical data.',s:'Friction #1 \u2014 slow quoting',c:'Medium ($15-60K)',w:'now'},{n:'Computer Vision QC',d:'CV models for defect detection on production line.',s:'Friction #2 \u2014 inconsistent QC',c:'High ($60K+)',w:'future'},{n:'Innovation Idea Portal',d:'Platform for employees to submit improvement ideas.',s:'Friction #3 \u2014 no idea capture',c:'Low ($0-15K)',w:'now'}].map(function(idea){return'<details class="u-c2ef374"><summary class="u-33e06ff">'+idea.n+' '+badge(idea.w,idea.w==='now'?'#1B6B5A':'#2D5A8E')+'</summary><div class="u-2ad7718">'+idea.d+'<br/><em>Strategic:</em> '+idea.s+' \xb7 <em>Cost:</em> '+idea.c+'</div></details>'}).join('')+'</div>':'')+'</div>';

if(UI.sf){h+=renderIdeaForm();return h}
// Idea grid (blue-sky: unselected ideas only - selected ideas have advanced). Now ideas first, Future below.
var bs=getStages().bluesky.slice().sort(function(a,b){return((ideas[a]||{}).when==='future'?1:0)-((ideas[b]||{}).when==='future'?1:0)});
h+='<div class="gr-auto-260">';
bs.forEach(function(i){var idea=ideas[i];h+=card('<div onclick="openIdeaForm('+i+')" class="u-b202c6d"><div class="u-e1d7e82"><h4 class="h-card">'+esc(idea.name||'Untitled')+'</h4>'+badge(idea.when==='now'?'Now':'Future',idea.when==='now'?'#1B6B5A':'#2D5A8E')+'</div><p class="u-2da8137">'+esc((idea.desc||'').slice(0,100))+'</p></div>','padding:16px')});
h+='</div>';
if(!bs.length&&ideas.length>0)h+='<p class="t-faint" style="margin:0 0 12px">All ideas here have advanced. Selected ideas move forward from Filter &amp; Rank; add a new idea to keep brainstorming.</p>';
h+=btn('+ New Idea','openIdeaForm(null)','bp');
if(bs.length>0)h+='<span class="u-27b5cee">'+bs.length+' ideas'+((data.selected||[]).length>0?' \u00b7 '+(data.selected||[]).length+' advanced':'')+'</span>';
h+=vizIdeas();
h+=doneBtn('saveDone12()',ideas.length<3,null,(data.completedSteps||{})['1.2'],'Add at least 3 ideas to continue.');
return h}

function renderIdeaForm(){
var ideas=data.ideas||[];var isEdit=UI.ec!==null;var c=isEdit?ideas[UI.ec]:{name:'',desc:'',strategic:'',outcome:'',capabilities:'',cost:'',risk:'',timeframe:'',dept:'',when:'now'};var d=UI.icDraft||{};var _b=c;c={};['name','desc','strategic','outcome','capabilities','cost','risk','timeframe','dept','when'].forEach(function(k){c[k]=d[k]!==undefined?d[k]:(_b?_b[k]:'')});var locked=isEdit&&(data.selected||[]).indexOf(UI.ec)>=0;
return card('<h3 class="h-sub">Use Case Idea Card</h3><div class="gr-2-mt">'
+ta('Name *','ic_name',c.name,'e.g. AI Quoting Engine',1)
+'<div class="flx-g3"><div style="flex:1">'+ta('Department','ic_dept',c.dept,'',1)+'</div><div style="flex:1">'+sel('Cost','ic_cost',c.cost,[{v:'',l:'...'},{v:'Low ($0-15K)',l:'Low'},{v:'Medium ($15-60K)',l:'Medium'},{v:'High ($60K+)',l:'High'}])+'</div></div>'
+ta('Description','ic_desc',c.desc,'What would this do?',3)
+'<div class="flx-g3"><div style="flex:1">'+sel('Timeframe','ic_timeframe',c.timeframe,[{v:'',l:'...'},{v:'1-3 months',l:'1-3mo'},{v:'3-6 months',l:'3-6mo'},{v:'6-12 months',l:'6-12mo'},{v:'12+ months',l:'12+mo'}])+'</div><div style="flex:1">'+(locked?'<div class="mb-4"><label class="form-label">When</label><select id="ic_when" class="sel-helper" disabled style="opacity:.55;cursor:not-allowed"><option value="now" selected>Now</option><option value="future">Future</option></select><div style="font-size:11px;color:var(--text-faint);line-height:1.5;margin-top:4px">Locked to Now while this idea is selected. A selected idea moves forward through the pipeline; to set it aside, record a No-Go verdict at Step 2.4.</div></div>':sel('When','ic_when',c.when,[{v:'now',l:'Now'},{v:'future',l:'Future'}]))+'</div></div>'
+ta('Strategic need','ic_strategic',c.strategic,'Which friction point?',2)
+ta('Capabilities required','ic_capabilities',c.capabilities,'Skills/tech needed',2)
+ta('Outcome','ic_outcome',c.outcome,'Best case if it works and worst case if it fails',3)
+ta('Risks','ic_risk',c.risk,'What could go wrong?',3)
+'</div><div class="u-a03bf85">'+btn('Save','saveIdeaCard()','bp','',false)+btn('Cancel','closeIdeaForm()','bg2')+'</div>')}

function saveIdeaCard(){
var c={name:val('ic_name'),desc:val('ic_desc'),strategic:val('ic_strategic'),outcome:val('ic_outcome'),capabilities:val('ic_capabilities'),cost:val('ic_cost'),risk:val('ic_risk'),timeframe:val('ic_timeframe'),dept:val('ic_dept'),when:val('ic_when')||'now'};
if(UI.ec!==null&&(data.selected||[]).indexOf(UI.ec)>=0)c.when='now';
if(!c.name)return;
if(!data.ideas)data.ideas=[];
if(UI.ec!==null){data.ideas[UI.ec]=c}else{data.ideas.push(c);var _nbi=data.ideas.length-1;if(c.when==='future'){UI.expanded.bsFold=true;UI.expanded['bsf'+_nbi]=true}else{UI.expanded['bs'+_nbi]=true}}
UI.sf=false;UI.ec=null;UI.icDraft=null;UI.addForm=false;saveData();render()}
function openIdeaForm(ec){UI.ec=ec;UI.sf=true;UI.icDraft=null;render()}
function closeIdeaForm(){UI.sf=false;UI.ec=null;UI.icDraft=null;UI.addForm=false;render()}
function ideaCardRO(i){var c=(data.ideas||[])[i]||{};var f=function(l,v){return'<div><div class="u-b25d981">'+l+'</div><div class="u-2ad7718">'+(v?esc(v):'\u2014')+'</div></div>'};
var any=[c.desc,c.strategic,c.outcome,c.capabilities,c.cost,c.risk,c.timeframe,c.dept].some(function(v){return v});
if(!any)return'<p class="t-faint-sm">No further detail recorded on this idea card.</p>';
var inner=f('Description',c.desc)+f('Strategic need',c.strategic)+f('Outcome',c.outcome)+f('Capabilities required',c.capabilities)+f('Cost',c.cost)+f('Risks',c.risk)+f('Timeframe',c.timeframe)+f('Department',c.dept);
return'<div class="gr-2">'+inner+'</div>'}
function ideaCardFold(i,pk,defOpen){var k=pk+i,open=UI.expanded[k]===undefined?!!defOpen:!!UI.expanded[k];
return'<div style="margin:0 0 10px">'+btn((open?'\u25be':'\u25b8')+' Idea card','UI.expanded[\''+k+'\']='+(!open)+';render()','bg2','font-size:11px;padding:3px 10px')+(open?'<div style="margin-top:8px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+ideaCardRO(i)+'</div>':'')+'</div>'}

function ideaCardEdit(i){var c=(data.ideas||[])[i]||{};var p='bsic_'+i+'_';
return'<div style="margin:0 0 10px;padding:12px 14px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)"><div class="gr-2-mt"><div>'+ta('Name',p+'name',c.name,'e.g. AI Quoting Engine',1)+ta('Description',p+'desc',c.desc,'What would this do?',3)+ta('Strategic need',p+'strategic',c.strategic,'Which friction point?',2)+ta('Outcome',p+'outcome',c.outcome,'Best: ... Worst: ...',3)+'</div><div>'+ta('Capabilities',p+'capabilities',c.capabilities,'Skills/tech needed',2)+sel('Cost',p+'cost',c.cost,[{v:'',l:'...'},{v:'Low ($0-15K)',l:'Low'},{v:'Medium ($15-60K)',l:'Medium'},{v:'High ($60K+)',l:'High'}])+ta('Risks',p+'risk',c.risk,'What could go wrong?',2)+sel('Timeframe',p+'timeframe',c.timeframe,[{v:'',l:'...'},{v:'1-3 months',l:'1-3mo'},{v:'3-6 months',l:'3-6mo'},{v:'6-12 months',l:'6-12mo'},{v:'12+ months',l:'12+mo'}])+'<div class="flx-g3">'+ta('Dept',p+'dept',c.dept,'',1)+sel('When',p+'when',c.when,[{v:'now',l:'Now'},{v:'future',l:'Future'}])+'</div></div></div><p class="t-faint-sm" style="margin:0">Edits save as you type. Setting When to Future parks this idea under Ideas for the Future; setting it back to Now returns it to the ranked list.</p></div>'}

// Step 1.3 Filter & Rank
function renderStep13(){
var ideas=data.ideas||[],as=data.assessments||{};
var h=vp('V-1.3.1','Filter & Rank Use Cases','3\u20135 min');
h+='<h2 class="h-section">Step 3: Filter & Rank</h2><p class="t-lead">This step turns the result of your brainstorming into a short list. First qualify each idea against five yes-or-no checks, because an idea that fails any one of them is disqualified however attractive it looks. Then score the survivors to rank them, and advance the strongest into the Exploration Portfolio. On your first pass, select up to five. Click an idea\u2019s card to select it for advancement; click again to deselect.</p>';
if(!ideas.length)return h+card('<div class="empty-state"><p class="t-faint">Create ideas first.</p></div>');
var bs13=getStages().bluesky.filter(function(i){return(ideas[i]||{}).when!=='future'});
if(!bs13.length){var fut13=getStages().bluesky.filter(function(i){return(ideas[i]||{}).when==='future'});h+=card('<div class="empty-state"><p class="t-faint">'+(fut13.length?'All remaining ideas are parked as Future \u2013 move one to Now to work on it here.':'Selected ideas have advanced to Step 2.4 \u2013 add new ideas to Brainstorm to keep the intake full.')+'</p></div>');h+=vizScores();h+=archivePanel(['bluesky'],'13');h+=doneBtn('saveDone13()',(data.selected||[]).length<1,null,(data.completedSteps||{})['1.3'],'Select at least one idea to continue.');return h}
bs13.forEach(function(i){var idea=ideas[i];
var a=as[i]||{};var allG=a.techCapable!==undefined&&a.resourcesAvailable!==undefined&&a.culturalFit!==undefined&&a.purposeAligned!==undefined&&a.affordable!==undefined;
var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;
var anyNo=allG&&!feasible;var score=feasible?triageScore(i):0;var isSel=(data.selected||[]).indexOf(i)>=0;

var fk='fr13_'+i;var fOpen=!!UI.expanded[fk];
var bar='<div class="flx-row-mb" style="cursor:pointer'+(fOpen?'':';margin-bottom:0')+'" onclick="UI.expanded[\''+fk+'\']=!'+fOpen+';render()"><span style="color:var(--stone);font-size:13px">'+(fOpen?'\u25be':'\u25b8')+'</span><div><h4 class="h-card" style="font-size:16px">'+esc(idea.name)+'</h4></div>'+(idea.when==='future'?badge('Future Project','#2D5A8E'):'')+(anyNo?badge('Disqualified','#9B2D3F'):'')+'<span id="scoreOut_'+i+'" data-sflav="13">'+(feasible?badge(score+'/50','#1B6B5A'):'')+'</span>'+archBtn(i)+'</div>';
var body13='';
if(fOpen){body13='<div style="margin-bottom:8px">'+ideaCardFold(i,'ic13',true)+'</div>'+
'<p class="fs-13" style="color:var(--paper);margin:0 0 6px">Is this idea compatible with your organization\u2019s current state across the following five dimensions? Click a dimension once for yes and twice for no. A single no disqualifies the idea until the relevant circumstances change.</p>'+
'<div class="pill-row">'+[{k:'techCapable',l:'Tech?',t:'Could this be built with technology that exists, that works, and that is available to you today?'},{k:'resourcesAvailable',l:'Resources?',t:'Do you have, or could you realistically get, the people and data it needs?'},{k:'culturalFit',l:'Culture?',t:'Would the people affected actually use it?'},{k:'purposeAligned',l:'Purpose?',t:'Does it serve the purpose and goals you wrote down in the Assessment?'},{k:'affordable',l:'Affordable?',t:'Could you fund it at the cost level on its card without heroics?'}].map(function(g){var v=a[g.k];return'<button title="'+esc(g.t)+'" onclick="toggleGate('+i+',\''+g.k+'\')" class="gate-btn'+(v===true?' pass':v===false?' fail':'')+'">'+(v===true?'\u2713':v===false?'\u2717':'\u25cb')+' '+g.l+'</button>'}).join('')+'</div>'+
(feasible?'<p class="fs-13" style="color:var(--paper);margin:14px 0 6px">Score each dimension from 0 to 10. 10 is always the most favorable end of the scale. The five dimensions sum to a score out of 50.</p><div class="u-46b97fa">'+[{k:'priority',l:'Priority',t:'How urgent this is for the organization right now. 10 means top priority.'},{k:'risk',l:'Risk(10=low)',t:'How likely it is to go wrong, in technology, adoption, or delivery. 10 means low risk.'},{k:'value',l:'Value',t:'How much benefit it delivers if it works. 10 means high value.'},{k:'costScore',l:'Cost(10=low)',t:'What it would cost against the level on its card. 10 means cheap.'},{k:'difficulty',l:'Ease(10=easy)',t:'How hard it would be to deliver with the organization you have. 10 means easy.'}].map(function(d){return'<div><label class="t-faint-sm" title="'+esc(d.t)+'">'+d.l+'</label><input type="number" min="0" max="10" id="score_'+i+'_'+d.k+'" value="'+(a[d.k]!=null?a[d.k]:'')+'" onchange="saveScore('+i+',\''+d.k+'\')" class="score-mini"/></div>'}).join('')+'</div>':'')+
(feasible?(idea.when==='future'?'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button disabled style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:not-allowed;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02);color:rgba(var(--faint-rgb),.5)">Advance to Exploration Portfolio</button><span style="font-size:11px;color:var(--text-faint);line-height:1.5;flex:1;min-width:220px">This project cannot be selected because it has been assigned \u201CFuture Project\u201D status. If you wish to select it, go back to 1.2 and change the project\u2019s When setting to \u201CNow\u201D.</span></div>':'<button onclick="askAdvanceIdea('+i+')" style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(isSel?'1px solid #1B6B5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(isSel?'#1B6B5A':'rgba(var(--fg-rgb),.03)')+';color:'+(isSel?'#fff':'var(--text-faint)')+'">'+(isSel?'\u2713 Selected':'Advance to Exploration Portfolio')+'</button>'):'');}
h+=card(bar+body13,
(isSel?'border:2px solid #1B6B5A;background:rgba(27,107,90,.04)':anyNo?'border:1px solid #e8c4c4;background:rgba(155,45,63,.06)':''))});

h+=vizScores();
h+=archivePanel(['bluesky'],'13');
h+=doneBtn('saveDone13()',(data.selected||[]).length<1,null,(data.completedSteps||{})['1.3'],'Select at least one idea to continue.');
return h}

function toggleGate(i,key){if(lockBlocked('assessments::'+i))return;if(!data.assessments)data.assessments={};if(!data.assessments[i])data.assessments[i]={};var cur=data.assessments[i][key];data.assessments[i][key]=cur===true?false:cur===false?undefined:true;Store.commit('assessments',i);render()}
function saveScore(i,key){if(Collab.lockedByOther('assessments::'+i))return;if(!data.assessments)data.assessments={};if(!data.assessments[i])data.assessments[i]={};data.assessments[i][key]=Math.max(0,Math.min(10,parseInt(val('score_'+i+'_'+key))||0));Store.commit('assessments',i);render()}
function refreshScoreOut(i){var el=document.getElementById('scoreOut_'+i);if(!el)return;var a=(data.assessments||{})[i]||{};var allG=a.techCapable!==undefined&&a.resourcesAvailable!==undefined&&a.culturalFit!==undefined&&a.purposeAligned!==undefined&&a.affordable!==undefined;var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;var disq=allG&&!feasible;var sc=feasible?triageScore(i):null;
if(el.getAttribute('data-sflav')==='bs')el.innerHTML=sc!==null?'<span style="font-weight:700;font-size:14px;color:#1B6B5A">'+sc+'<span style="font-size:11px;color:var(--text-faint)">/50</span></span>':disq?'':'<span class="t-faint-sm">unscored</span>';
else el.innerHTML=feasible?badge(sc+'/50','#1B6B5A'):''}
function freshProjectSlate(i){
// Selecting from blue sky starts this index fresh: clear orphaned downstream records
// (stranded by the old deselect path or a previous life of the index).
var capTouched=false;
['projects','portfolio','capAlloc','experiments','tracking','opsData'].forEach(function(c){if(data[c]&&data[c][i]!==undefined){delete data[c][i];Store.commit(c,i);if(c==='capAlloc')capTouched=true}});
if(data.review&&data.review.items&&data.review.items[i]!==undefined){delete data.review.items[i];Store.commit('review')}
['expSelected','launched'].forEach(function(k){var a=data[k]||[];var x=a.indexOf(i);if(x>=0){a.splice(x,1);Store.commit(k);capTouched=true}});
if(data.archivedItems&&data.archivedItems[i]){delete data.archivedItems[i];Store.commit('archivedItems',i)}
if(capTouched){data.capStale=true;Store.commit('capStale')}}
function askAdvanceIdea(i){if(((data.ideas||[])[i]||{}).when==='future')return;UI.advIdea=i;currentModal='advance';renderAdvanceModal()}
function confirmAdvanceIdea(yes){var i=UI.advIdea;UI.advIdea=null;closeModal();if(yes&&i!=null)toggleSelect(i)}
function renderAdvanceModal(){var mr=$('modalRoot');if(!mr)return;if(currentModal!=='advance'){mr.innerHTML='';return}
mr.innerHTML='<div class="modal-bg" onclick="if(event.target===this)confirmAdvanceIdea(false)"><div class="modal" style="max-width:480px"><h3 style="font-size:22px">Advance to Exploration Portfolio</h3><p class="t-stone-md" style="margin:10px 0 24px">Advancing this idea to the Exploration Portfolio means it will no longer be visible on this page. Do you want to continue?</p><div style="display:flex;gap:10px;justify-content:flex-end">'+btn('No','confirmAdvanceIdea(false)','bg2')+btn('Yes','confirmAdvanceIdea(true)','bp')+'</div></div></div>'}
function toggleSelect(i){if(((data.ideas||[])[i]||{}).when==='future')return;if(!data.selected)data.selected=[];if(data.selected.indexOf(i)<0){freshProjectSlate(i);data.selected.push(i);Store.commit('selected')}render()}
function saveDone12(){if(!confirmStepDone('1.2'))return;if(!data.completedSteps)data.completedSteps={};data.completedSteps['1.2']=true;stampStepDone('1.2');Store.commit('completedSteps');render()}
function saveDone13(){if(!confirmStepDone('1.3'))return;if(!data.completedSteps)data.completedSteps={};data.completedSteps['1.3']=true;stampStepDone('1.3');Store.commit('completedSteps');render()}
// === PHASE 2 STEPS ===
function renderStep21(){
var ow=data.ownership||{};var leads=ow.leads||[];var seniors=ow.seniors||[];
var h=vp('V-2.1.1','Pipeline Ownership','3\u20135 min');
h+='<h2 class="h-section">Step 1: Ownership & Structure</h2><p class="t-lead">The pipeline needs one owner with real authority: someone who can approve experiments, kill projects, and move budget without asking permission. Back the owner with two supporting groups. Embedded leads are the people inside each department who make experiments and deployments work on the ground. Engaged senior leaders are the executives whose visible support keeps the pipeline funded and legitimate. Finish by filling in the RACI matrix so every recurring activity has exactly one accountable name.</p>';
h+=card('<h3 class="h-sub-lg">Pipeline Owner</h3>'+ta('Name *','ow_ownerName',ow.ownerName,'e.g. Maria Torres',1)+ta('Role *','ow_ownerRole',ow.ownerRole,'e.g. CEO',1)+ta('Authority','ow_authority',ow.authority,'e.g. Approve/kill, reallocate budget',2),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Embedded Leads</h3><p class="t-faint-sm" style="margin:-2px 0 10px">One per department that will run experiments. These are doers, not sponsors.</p>'+leads.map(function(l,i){return'<div class="u-d34ea2f"><input id="lead_'+i+'_name" value="'+esc(l.name)+'" placeholder="Name" onchange="saveLeads()" class="row-input"/><input id="lead_'+i+'_dept" value="'+esc(l.dept)+'" placeholder="Dept" onchange="saveLeads()" class="row-input"/><button onclick="removeLead('+i+')" class="no-btn">\xd7</button></div>'}).join('')+btn('+ Add','addLead()','bs'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Engaged Senior Leaders</h3><p class="t-faint-sm" style="margin:-2px 0 10px">Executives who will visibly back the pipeline. Named support beats general goodwill.</p>'+seniors.map(function(l,i){return'<div class="u-d34ea2f"><input id="senior_'+i+'_name" value="'+esc(l.name)+'" placeholder="Name" onchange="saveSeniors()" class="row-input"/><input id="senior_'+i+'_role" value="'+esc(l.role)+'" placeholder="Position" onchange="saveSeniors()" class="row-input"/><button onclick="removeSenior('+i+')" class="no-btn">\xd7</button></div>'}).join('')+btn('+ Add','addSenior()','bs'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">RACI Matrix</h3><p class="t-fade-fs13">\u201cR\u201d indicates that this individual is responsible for the activity and does the work. \u201cA\u201d means the person is accountable and owns the outcome (with exactly one \u201cA\u201d per activity). \u201cC\u201d means the person is consulted before decisions. \u201cI\u201d means the person is informed after decisions. Assign a letter for each activity and person. A printable version lives under Phase 2 outputs.</p>'+raciMatrix(false));
h+=doneBtn('saveDone21()',!(ow.ownerName&&ow.ownerRole),null,(data.completedSteps||{})['2.1']);return h}
function saveOw(){if(!data.ownership)data.ownership={};['ownerName','ownerRole','authority'].forEach(function(f){var e=$('ow_'+f);if(e)data.ownership[f]=e.value});Store.commit('ownership')}
function saveLeads(){if(!data.ownership)data.ownership={};var leads=data.ownership.leads||[];for(var i=0;i<leads.length;i++){var n=$('lead_'+i+'_name'),d=$('lead_'+i+'_dept');if(n)leads[i].name=n.value;if(d)leads[i].dept=d.value}data.ownership.leads=leads;Store.commit('ownership')}
function addLead(){if(lockBlocked('ownership'))return;if(!data.ownership)data.ownership={};if(!data.ownership.leads)data.ownership.leads=[];data.ownership.leads.push({id:uid(),name:'',dept:''});Store.commit('ownership');render()}
function removeLead(i){if(lockBlocked('ownership'))return;var _rm=((data.ownership||{}).leads||[])[i];data.ownership.leads=data.ownership.leads.filter(function(_,j){return j!==i});if(_rm&&_rm.id)purgeRaciFor(_rm.id);Store.commit('ownership');render()}
function saveSeniors(){if(!data.ownership)data.ownership={};var sl=data.ownership.seniors||[];for(var i=0;i<sl.length;i++){var n=$('senior_'+i+'_name'),r=$('senior_'+i+'_role');if(n)sl[i].name=n.value;if(r)sl[i].role=r.value}data.ownership.seniors=sl;Store.commit('ownership')}
function addSenior(){if(lockBlocked('ownership'))return;if(!data.ownership)data.ownership={};if(!data.ownership.seniors)data.ownership.seniors=[];data.ownership.seniors.push({id:uid(),name:'',role:''});Store.commit('ownership');render()}
function removeSenior(i){if(lockBlocked('ownership'))return;var _rm=((data.ownership||{}).seniors||[])[i];data.ownership.seniors=(data.ownership.seniors||[]).filter(function(_,j){return j!==i});if(_rm&&_rm.id)purgeRaciFor(_rm.id);Store.commit('ownership');render()}
function saveDone21(){if(!confirmStepDone('2.1'))return;saveOw();saveLeads();saveSeniors();if(!data.completedSteps)data.completedSteps={};data.completedSteps['2.1']=true;stampStepDone('2.1');saveData();render()}

function renderStep22(){
var inc=data.incentives||{};
var h=vp('V-2.2.1','Incentive Realignment','3\u20135 min');
h+='<h2 class="h-section">Step 2: Realign Incentives</h2><p class="t-lead">Humans almost always direct their greatest energy and attention toward behaviors that are incentivized. A culture that rewards constancy and penalizes experimentation will bring an innovation pipeline to a halt regardless of the ideals an organization claims to uphold. Write down how people are actually paid, promoted, and measured today, then propose changes that make experimentation count rather than cost. The metrics list below feeds that conversation: pick the pipeline health measures your organization will start tracking.</p>';
h+=ta('Current structure *','inc_current',inc.current,'e.g. Sales \u2013 quarterly commission on closed revenue, with no credit for time spent piloting new tools. Engineering \u2013 annual bonus tied to on-time roadmap delivery, so experiments compete with rewarded work. Plant supervisors \u2013 measured on throughput and defect rates alone.',5);
h+=ta('Proposed changes *','inc_changes',inc.changes,'e.g. Sales commission credits pilot participation. Engineering bonus includes one gated experiment per half.',3);
h+='<div class="mb-4"><label class="u-4c6db0e">Metrics to track</label>';
var FIXM=['Active experiments','Kill speed','Development gate throughput','Support for experimentation','Ideas surfaced at the frontline'];
var MTIP={'Active experiments':'How many experiments are running at once. Zero means the pipeline has stalled.','Kill speed':'How quickly failing projects get stopped. Slow kills drain money and teach people that killing is punished.','Development gate throughput':'How many projects pass through gates each quarter, in either direction. Measures whether decisions are actually being taken.','Support for experimentation':'A pulse or survey measure of whether people feel safe proposing and running experiments.','Ideas surfaced at the frontline':'How many improvement ideas come from the people doing the daily work.'};
FIXM.forEach(function(m){
var checked=(inc.metrics||[]).indexOf(m)>=0;
h+='<label class="u-baf6089" title="'+esc(MTIP[m]||'')+'"><input type="checkbox"'+(checked?' checked':'')+' onchange="toggleIncMetric(\''+esc(m)+'\')" />'+m+'</label>'});
(inc.metrics||[]).forEach(function(m,mi){if(FIXM.indexOf(m)>=0)return;h+='<label class="u-baf6089"><input type="checkbox" checked onchange="removeIncMetric('+mi+')" /> '+esc(m)+' <button onclick="removeIncMetric('+mi+')" class="no-btn" title="Remove">\xd7</button></label>'});
h+='<div class="flx-g3" style="margin-top:8px"><input id="inc_newMetric" placeholder="Add a custom metric\u2026" class="row-input" onkeydown="if(event.key===\'Enter\')addIncMetric()"/>'+btn('+ Add','addIncMetric()','bs','font-size:12px')+'</div>';
h+='</div>'+doneBtn('saveDone22()',!(inc.current&&inc.changes),null,(data.completedSteps||{})['2.2']);return h}
function addIncMetric(){var e=$('inc_newMetric');if(!e)return;var v=(e.value||'').trim();if(!v)return;if(!data.incentives)data.incentives={};var arr=data.incentives.metrics||[];if(arr.indexOf(v)>=0){e.value='';return}arr.push(v);data.incentives.metrics=arr;saveData();render()}
function removeIncMetric(mi){if(lockBlocked('incentives'))return;var arr=(data.incentives||{}).metrics||[];arr.splice(mi,1);Store.commit('incentives');render()}
function toggleIncMetric(m){if(lockBlocked('incentives'))return;if(!data.incentives)data.incentives={};var arr=data.incentives.metrics||[];var idx=arr.indexOf(m);if(idx>=0)arr.splice(idx,1);else arr.push(m);data.incentives.metrics=arr;Store.commit('incentives');render()}
function saveDone22(){if(!confirmStepDone('2.2'))return;updObj('incentives','current',val('inc_current'));updObj('incentives','changes',val('inc_changes'));if(!data.completedSteps)data.completedSteps={};data.completedSteps['2.2']=true;stampStepDone('2.2');saveData();render()}

function renderStep23(){
var rh=data.rhythm||{};
var h=vp('V-2.3.1','Innovation Rhythm','2\u20133 min');
h+='<h2 class="h-section">Step 3: Innovation Rhythm</h2><p class="t-lead">Innovation is smothered when everyday operations are allowed to push it off the calendar. This step books protected weekly time for the pipeline. Pick a day and time that will survive contact with normal business operations, name the people who must be in the room, and set a standing agenda. Short and unmissable beats long and optional.</p>';
h+='<div class="u-0a8321c">'+sel('Day *','rh_day',rh.day,[{v:'',l:'...'},{v:'Mon',l:'Mon'},{v:'Tue',l:'Tue'},{v:'Wed',l:'Wed'},{v:'Thu',l:'Thu'},{v:'Fri',l:'Fri'}])+ta('Time','rh_time',rh.time,'9 AM',1)+'</div>';
var attList=rhAttList();
h+='<div class="mb-4"><label class="form-label">Attendees *</label>'+attList.map(function(a,i){return'<div class="u-d34ea2f"><input id="rhAtt_'+i+'" value="'+esc(a)+'" placeholder="Name" onchange="saveAttendees()" class="row-input"/><button onclick="removeAttendee('+i+')" class="no-btn">\xd7</button></div>'}).join('')+btn('+ Add attendee','addAttendee()','bs','font-size:12px')+'</div>';
var agList=rhAgList();
h+='<div class="mb-4"><label class="form-label">Agenda</label>'+agList.map(function(a,i){return'<div class="u-d34ea2f"><input id="rhAg_'+i+'" value="'+esc(a)+'" placeholder="e.g. Development gate reviews (10 min)" onchange="saveAgendaItems()" class="row-input"/><button onclick="removeAgendaItem('+i+')" class="no-btn">\xd7</button></div>'}).join('')+btn('+ Add item','addAgendaItem()','bs','font-size:12px')+'</div>';
h+=doneBtn('saveDone23()',!(rh.day&&rhAttNames().length),null,(data.completedSteps||{})['2.3']);return h}
function rhAgList(){var rh=data.rhythm||{};if(Array.isArray(rh.agendaList))return rh.agendaList;var a=rh.agenda;if(typeof a==='string'&&a.trim())return a.split(/\n|,/).map(function(x){return x.replace(/^\s*\d+[\.\)]\s*/,'').replace(/\.\s*$/,'').trim()}).filter(Boolean);return[]}
function saveAgendaItems(){if(Collab.lockedByOther('rhythm'))return;if(!data.rhythm)data.rhythm={};var a=rhAgList().slice();for(var i=0;i<a.length;i++){var e=$('rhAg_'+i);if(e)a[i]=e.value}data.rhythm.agendaList=a;Store.commit('rhythm');refreshSecDone()}
function addAgendaItem(){if(lockBlocked('rhythm'))return;if(!data.rhythm)data.rhythm={};data.rhythm.agendaList=rhAgList().slice();data.rhythm.agendaList.push('');Store.commit('rhythm');render()}
function removeAgendaItem(i){if(lockBlocked('rhythm'))return;if(!data.rhythm)data.rhythm={};data.rhythm.agendaList=rhAgList().filter(function(_,j){return j!==i});Store.commit('rhythm');render()}
function rhAttList(){var rh=data.rhythm||{};var a=rh.attendees;if(Array.isArray(a))return a;if(typeof a==='string'&&a.trim())return a.split(/[,+;]/).map(function(x){return x.trim()}).filter(Boolean);return[]}
function rhAttNames(){return rhAttList().filter(function(x){return x&&String(x).trim()})}
function saveAttendees(){if(Collab.lockedByOther('rhythm'))return;if(!data.rhythm)data.rhythm={};var a=rhAttList();for(var i=0;i<a.length;i++){var e=$('rhAtt_'+i);if(e)a[i]=e.value}data.rhythm.attendees=a;Store.commit('rhythm');refreshSecDone()}
function addAttendee(){if(lockBlocked('rhythm'))return;if(!data.rhythm)data.rhythm={};data.rhythm.attendees=rhAttList();data.rhythm.attendees.push('');Store.commit('rhythm');render()}
function removeAttendee(i){if(lockBlocked('rhythm'))return;if(!data.rhythm)data.rhythm={};data.rhythm.attendees=rhAttList().filter(function(_,j){return j!==i});Store.commit('rhythm');render()}
function saveDone23(){if(!confirmStepDone('2.3'))return;['day','time','agenda'].forEach(function(f){updObj('rhythm',f,val('rh_'+f))});saveAttendees();if(!data.completedSteps)data.completedSteps={};data.completedSteps['2.3']=true;stampStepDone('2.3');saveData();render()}

function aurora24Example(){
var F=function(l,v){return'<div><div class="u-b25d981" style="margin-bottom:3px">'+l+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">'+v+'</div></div>'};
var DIV='<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:14px 0"></div>';
var GA=function(g){var li=function(arr,col){return arr.length?arr.map(function(x){return'<div class="fs-13" style="margin-bottom:3px'+(col?';color:'+col:';color:var(--text-muted)')+'">'+x+'</div>'}).join(''):'<div class="t-faint-sm">\u2014</div>'};
return'<div style="margin-bottom:4px"><div style="font-size:13px;font-weight:700;color:var(--paper);margin-bottom:5px">'+g.l+'</div><div class="gr-3-sm"><div><div class="t-faint-sm" style="margin-bottom:3px">NEED</div>'+li(g.have.concat(g.gap))+'</div><div><div class="t-faint-sm" style="margin-bottom:3px">HAVE</div>'+li(g.have)+'</div><div><div class="t-faint-sm" style="margin-bottom:3px">GAP</div>'+li(g.gap,'#D4A017')+'</div></div></div>'};
var Q4=[{k:'s',l:'+ STRENGTHS',c:'var(--ph1-t)',bg:'rgba(27,107,90,.10)'},{k:'w',l:'\u2212 WEAKNESSES',c:'#C25B73',bg:'rgba(155,45,63,.08)'},{k:'o',l:'\u25c9 OPPORTUNITIES',c:'var(--ph2-t)',bg:'rgba(45,90,142,.10)'},{k:'t',l:'\u25b3 THREATS',c:'#D4A017',bg:'rgba(139,94,60,.10)'}];
var D=[
{n:'AI-Powered Quoting Engine',v:'\u2713 Go',intro:'Friction #1 \u2014 slow quoting. Custom commercial jobs wait three to four days for a price while estimators rebuild every spec by hand.',
obj:'Cut quote turnaround on custom commercial jobs from 3\u20134 days to under 24 hours; lift quote-to-order conversion by 10% within two quarters. Direct line to the 40% growth goal without added headcount.',
del:'Quoting model trained on five years of historical quotes and win/loss data; spec-intake form feeding the ERP; estimator review screen with hard margin-floor guardrails.',
tl:'10 weeks \u2013 data preparation and spec taxonomy weeks 1\u20133, model build and ERP integration weeks 4\u20137, supervised pilot with two senior estimators weeks 8\u201310.',
res:'$48K \u2013 external machine-learning contractor (12 days), internal systems lead two days a week, estimator time for validation sessions.',
risk:'Five years of quotes encode old pricing mistakes; estimator trust collapses if early drafts misprice complex glazing; loose guardrails leak margin.',
met:'Median turnaround under 24 hours; estimators accept at least 80% of drafted quotes; zero quotes released below the margin floor.',
gap:[{l:'Skills',have:['Estimating team that knows every failure mode in the product line'],gap:['Review-and-correct discipline \u2013 treating drafts as drafts, not answers']},
     {l:'Resources',have:['Five years of quote and win/loss history in the ERP'],gap:['A cleaned, consistent spec taxonomy \u2013 three weeks of unglamorous data work']},
     {l:'Technology',have:['ERP with working export APIs'],gap:['Hosted model gateway with audit logging on every generated quote']}],
swot:{s:'Deep, labeled pricing history; estimators want this fixed \u2013 quoting is their pain, not a leadership hobby.',w:'Spec data inconsistent across product lines; nobody owns pricing data quality today.',o:'The spec taxonomy built here later powers the customer portal and design tooling.',t:'Competitors already quote with AI assistance; volatile input costs can outdate training data fast.'},
pI:'Sales operations for the spec taxonomy; finance for margin floors and approval thresholds.',pE:'Regional systems integrator for the ERP connector; model vendor\u2019s solutions engineer for the gateway.',
call:'Go. Pays back inside a year on estimator hours alone, and the spec cleanup compounds into two later projects. First revenue-side win for the pipeline.'},
{n:'Computer Vision QC',v:'\u2713 Go \u00b7 staged',intro:'Friction #2 \u2014 inconsistent QC. Defect catch rates vary by inspector and by shift; rework and warranty claims eat margin.',
obj:'Catch at least 90% of seal and glazing defects at the line before assembly; cut rework and warranty cost on pilot lines by 25% within twelve months. This is the margin-protection project.',
del:'Camera rigs on the two highest-defect lines; trained defect-detection models; live inspection dashboard with operator override; a structured defect dataset that later feeds maintenance prediction and supplier quality work.',
tl:'Six months, staged \u2013 months 1\u20132 camera install and labeled defect library on Line 2; months 3\u20134 model training in shadow mode; Months 5\u20136 live alerts. Hard gate at Month 2: at least 5,000 labeled images before the model budget releases.',
res:'$140K phased \u2013 $55K cameras and edge compute, $60K computer-vision development partner, $25K integration and operator training. Plant quality lead at half-time.',
risk:'Lighting and reflection on glass is the genuinely hard problem; operators reading the cameras as surveillance; model drift as the product mix shifts.',
met:'At least 90% detection on labeled defect classes; false-alert rate under 5%; rework cost on pilot lines down 25%.',
gap:[{l:'Skills',have:['Inspectors who know every defect cold and can label examples'],gap:['Computer-vision expertise \u2013 bought, not built, for the first version']},
     {l:'Resources',have:['Stable production schedule with workable pilot windows'],gap:['The labeled image library \u2013 building it is the first gate']},
     {l:'Technology',have:['Networked plant with camera mounting points on both lines'],gap:['Edge inference hardware','A data pipeline off the line']}],
swot:{s:'Defects are visually distinctive and the inspectors know them cold.',w:'No in-house computer-vision capability; glass reflectivity defeats naive approaches.',o:'The defect dataset is the foundation asset \u2013 maintenance prediction, supplier feedback, and design optimization all build on it.',t:'A failed pilot in full view of the shop floor would set AI credibility back company-wide.'},
pI:'Plant operations for line access windows; shift leads on camera-use policy before a single camera goes up.',pE:'Computer-vision vendor with glass or glazing references; camera and edge hardware supplier.',
call:'Go, staged. The most strategic project in the portfolio because of what its data unlocks \u2013 but it advances on gates, not enthusiasm. If the month-2 labeling gate fails, it returns to the backlog rather than limping forward.'},
{n:'Innovation Idea Portal',v:'\u2713 Go',intro:'Friction #3 \u2014 no idea capture. The ideation workshop produced 23 ideas in a day; there is no channel for the next one.',
obj:'Institutionalize frontline idea capture \u2013 100 submissions in the first quarter across the plant and both hubs, every one triaged inside two weeks. This is the mechanism that keeps the pipeline fed.',
del:'Submission portal on the existing low-code platform; monthly triage board owned by the innovation council; a visible status page so every submitter sees what happened to their idea.',
tl:'Four weeks \u2013 configure weeks 1\u20132, pilot with two shift teams week 3, company-wide launch week 4.',
res:'$9K \u2013 low-code licenses and configuration, launch communications. Triage time already sits inside the weekly innovation rhythm.',
risk:'A portal nobody answers is worse than no portal \u2013 the triage rhythm is the product. Submission quality drifts without light guidance.',
met:'100 submissions in the first quarter; 100% triaged within 14 days; at least three submissions advanced into the idea list each quarter.',
gap:[{l:'Skills',have:['Engaged shift leads from the ideation workshops'],gap:['A simple triage rubric the council applies the same way every month']},
     {l:'Resources',have:['The weekly innovation rhythm to host triage'],gap:['A named portal owner \u2013 the council secretary, in writing']},
     {l:'Technology',have:['Existing Microsoft 365 estate'],gap:[]}],
swot:{s:'Cheapest project in the portfolio with the broadest cultural reach.',w:'Easy to launch, easy to abandon.',o:'Feeds Blue Sky directly \u2013 the pipeline\u2019s replenishment mechanism.',t:'Unanswered submissions teach the floor that leadership is not listening. The reputational downside dwarfs the dollar cost.'},
pI:'Human resources and communications for launch and recognition; shift leads as champions.',pE:'None required \u2013 by design.',
call:'Go. Trivial cost, and the whole pipeline depends on what it feeds in \u2013 the technology is deliberately boring, so the gap column is nearly empty.'}];
var inner='<div class="u-2ad7718" style="margin-bottom:8px"><strong>Aurora:</strong> The three shortlisted ideas, taken through the full deepened assessment \u2013 the working entries behind each call, laid out the way the project card holds them.</div>'+D.map(function(d){
return'<details class="u-c2ef374"><summary class="u-33e06ff">'+d.n+' '+badge(d.v,'#1B6B5A')+'</summary>'+
'<div class="u-2ad7718" style="margin:8px 0 12px">'+d.intro+'</div>'+
'<h4 class="h-mini">Project Details</h4><div class="gr-2" style="row-gap:12px">'+F('Objectives',d.obj)+F('Deliverables',d.del)+F('Timeline',d.tl)+F('Resources',d.res)+F('Key risks',d.risk)+F('Success metrics',d.met)+F('Internal partners',d.pI)+F('External partners',d.pE)+'</div>'+
DIV+'<h4 class="h-mini">Gap Analysis</h4>'+d.gap.map(GA).join('<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:10px 0 12px"></div>')+
DIV+'<h4 class="h-mini">SWOT Analysis</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;overflow:hidden">'+Q4.map(function(q){return'<div style="background:'+q.bg+';padding:12px;min-height:66px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:'+q.c+';margin-bottom:5px">'+q.l+'</div><div class="u-2ad7718">'+d.swot[q.k]+'</div></div>'}).join('')+'</div>'+
'<div class="u-2ad7718" style="margin-top:12px;padding:10px;border-left:3px solid #1B6B5A;background:rgba(27,107,90,.06)"><strong>The call:</strong> '+d.call+'</div></details>'}).join('');
return'<div class="u-2d6fe45"><button onclick="UI.showEx.aurora24=!UI.showEx.aurora24;render()" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;border:1px dashed rgba(27,107,90,.5);background:'+(UI.showEx.aurora24?'rgba(27,107,90,.06)':'transparent')+';cursor:pointer;font-size:13px;font-weight:600;color:#1B6B5A;font-family:var(--sans,Helvetica Neue,sans-serif)">'+(UI.showEx.aurora24?'\u25be':'\u25b8')+' Example</button>'+(UI.showEx.aurora24?'<div class="u-b560a5f">'+inner+'</div>':'')+'</div>'}
function renderStep24(){
var ideas=data.ideas||[],proj=data.projects||{},as=data.assessments||{};
var _st24=getStages(),_adv24={};_st24.experiment.concat(_st24.operational||[]).forEach(function(x){_adv24[x]=1});
var _res24=function(i){var pr=proj[i]||{};return pr.viable===true?!!pr.objectives:pr.viable===false?!!pr.noGoReason:false};
var selAll=(data.selected||[]).filter(function(i){return!isArchived(i)&&!_adv24[i]});
var sel=selAll.filter(function(i){return!_res24(i)});
var h=vp('V-2.4.1','From Ideas to Project Cards','3\u20135 min');
h+='<h2 class="h-section">Step 4: Deepen Assessment</h2><p class="t-lead">Each idea you advanced now becomes a project card with a full workup. Complete the project details: gap analysis, SWOT, and project budgeting. Then re-score the project with fresh numbers and end with a verdict. \u201cGo\u201d sends it forward to Phase 3. \u201cNo Go\u201d sets it aside with a recorded reason. Flagging a project as \u201cNo Go\u201d shouldn\u2019t be seen as the idea failing \u2013 refusal to move a project forward if it doesn\u2019t fit the required criteria is what the process looks like when it\u2019s working.</p>';
h+=aurora24Example();
if(!(data.selected||[]).length)return h+card('<div class="empty-state"><p class="t-faint">Complete Phase 1 first.</p></div>');
var allDone=selAll.every(_res24);
if(!sel.length){h+=card('<div class="empty-state"><p class="t-faint">No projects are awaiting a verdict here. Go projects continue in Step 3.1; set-aside projects are under Not Advancing in the Exploration portfolio.</p></div>');h+=vizProjectReady();h+=notAdvPanel('24');h+=archivePanel(['explore','noGo'],'24');h+=doneBtn('saveDone24()',!allDone,'\u2713 All Assessed',(data.completedSteps||{})['2.4'],'Every project needs a verdict: Go with objectives, or No Go with a reason.');return h}
var ap=UI.ap!==null&&sel.indexOf(UI.ap)>=0?UI.ap:sel[0];UI.ap=ap;
var p=proj[ap]||{};var idea=ideas[ap]||{};

// Project tabs
h+='<div class="t-faint-sm" style="margin-bottom:6px">AVAILABLE PROJECTS</div><div class="u-917cf39">';
sel.forEach(function(i){var pr=proj[i]||{};h+='<button onclick="UI.ap='+i+';render()" style="padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(ap===i?(pr.viable!==undefined?'2px solid var(--paper)':'2px solid #2D5A8E'):'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(pr.viable===true?'#1B6B5A':pr.viable===false?'#9B2D3F':'rgba(var(--fg-rgb),.03)')+';color:'+(pr.viable!==undefined?'#fff':(ap===i?'#2D5A8E':'var(--text-faint)'))+'">'+esc(ideas[i]?ideas[i].name:'')+(pr.viable===true?' \u2713':pr.viable===false?' \u2717':'')+'</button>'});
h+='</div>';

// Project card
h+=card('<h3 class="h-sub-lg"><span style="color:var(--text-muted)">Project Name: </span>'+esc(idea.name)+'</h3>'+ideaCardFold(ap,'ic24')+assessBlock(ap),'margin-bottom:12px');





// Re-score (deepened)
var a1=as[ap]||{},rs=p.rescore||{};
h+=card('<h3 class="h-sub-lg">Re-score (deepened)</h3><p class="t-stone-snug">Blue-sky portfolio scores shown for reference. Enter fresh numbers now that the analysis is deeper. This becomes the working score. 10 is always the most favorable end of the scale.</p><div class="flx-g2-wrap">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(d){var tv=(a1[d.k]!=null?a1[d.k]:'\u2014');var cur=(rs[d.k]!=null?rs[d.k]:'');return'<div><label class="t-faint-sm">'+d.l+'</label><div class="t-faint-sm" style="opacity:.65">First Pass: '+tv+'</div><input type="number" min="0" max="10" id="rs_'+d.k+'" value="'+cur+'" onchange="fldSave(this.id,this.value)" class="score-mini"/></div>'}).join('')+'</div><div style="margin-top:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><button id="rsBtn" onclick="confirmRescore()"'+((p.rescoreDone||!rsComplete(rs))?' disabled':'')+' style="padding:8px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;background:'+(p.rescoreDone?'rgba(27,107,90,.25)':rsComplete(rs)?'#1B6B5A':'rgba(var(--fg-rgb),.08)')+';color:'+(p.rescoreDone?'var(--ref-accent)':rsComplete(rs)?'#fff':'var(--text-faint)')+';cursor:'+(rsComplete(rs)&&!p.rescoreDone?'pointer':'default')+'">'+(p.rescoreDone?'\u2713 Complete':'Mark Complete & Continue')+'</button><span class="t-stone-snug"><span id="rsTotal">'+rsTotalHtml(ap)+'</span></span></div>','margin-bottom:12px');

// Go/No Go
h+=card('<h3 class="h-sub-lg">Go / No Go <span class="t-faint-sm" style="font-weight:400">(required)</span></h3><div class="flx-g3"><div style="flex:1"><button onclick="setViable(true)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(p.viable===true?'2px solid #1B6B5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(p.viable===true?'#1B6B5A':'rgba(var(--fg-rgb),.03)')+';color:'+(p.viable===true?'#fff':'var(--stone)')+'">\u2713 Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(moves on to Step 3.1 when the verdict is complete)</p></div><div style="flex:1"><button onclick="setViable(false)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(p.viable===false?'2px solid #9B2D3F':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(p.viable===false?'#9B2D3F':'rgba(var(--fg-rgb),.03)')+';color:'+(p.viable===false?'#fff':'var(--stone)')+'">\u2717 No Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(moves to Not Advancing in the Exploration portfolio once a reason is recorded)</p></div></div>'+(p.viable===false?ta('Reason *','pj_noGoReason',p.noGoReason,'',2):''),'border-left:'+(p.viable===true?'4px solid #1B6B5A':p.viable===false?'4px solid #9B2D3F':'4px solid rgba(var(--fg-rgb),.12)'));

h+=vizProjectReady();h+=notAdvPanel('24');h+=archivePanel(['explore','noGo'],'24');
h+=doneBtn('saveDone24()',!allDone,'\u2713 All Assessed',(data.completedSteps||{})['2.4'],'Every project needs a verdict: Go with objectives, or No Go with a reason.');
return h}


function setViable(v){if(UI.ap===null)return;if(lockBlocked('projects::'+UI.ap))return;saveAssessFields(UI.ap);if(!data.projects)data.projects={};if(!data.projects[UI.ap])data.projects[UI.ap]={};var e=$('pj_noGoReason');if(e)data.projects[UI.ap].noGoReason=e.value;data.projects[UI.ap].viable=v;saveData();render()}
function saveDone24(){if(!confirmStepDone('2.4'))return;if(UI.ap!==null&&!Collab.lockedByOther('projects::'+UI.ap)){saveAssessFields(UI.ap);if(!data.projects)data.projects={};if(!data.projects[UI.ap])data.projects[UI.ap]={};var e=$('pj_noGoReason');if(e)data.projects[UI.ap].noGoReason=e.value}if(!data.completedSteps)data.completedSteps={};data.completedSteps['2.4']=true;stampStepDone('2.4');saveData();render()}
// === PHASE 3 STEPS ===
function renderStep31(){
var ideas=data.ideas||[],as=data.assessments||{},proj=data.projects||{},stages=getStages(),goP=stages.explore.filter(function(i){return(proj[i]||{}).viable===true}),port=data.portfolio||{};
var h=vp('V-3.1.1','Portfolio Thinking vs. Project Lists','3\u20135 min');
h+='<h2 class="h-section">Step 1: Structure as Portfolio</h2><p class="t-lead">A list of projects gets judged one at a time, and every judgment amounts to a fresh argument about how one project stacks up against the others. A portfolio is judged as a whole, where the mixture matters more than the individual bets. Here, what matters is not any one project\u2019s merits but the balance between quick wins and long-term possibilities, between high- and low-risk, and between cheap and expensive options. Grade each Go project on time horizon, risk, and reward, then check the balance panel below for gaps and concentrations.</p>';
if(!goP.length){var _res31=function(i){var pr=proj[i]||{};return pr.viable===true?!!pr.objectives:pr.viable===false?!!pr.noGoReason:false};var _await31=stages.explore.concat(stages.noGo).filter(function(i){return!_res31(i)});var msg31;
if(!(data.selected&&data.selected.length>0))msg31='Complete Phase 2 first \u2014 filter ideas and deepen assessments.';
else if((data.completedSteps||{})['3.1'])msg31='No projects are currently at the Exploration stage. Go projects appear here until they advance to Development; set-aside projects are under Not Advancing in the Exploration portfolio.';
else if(_await31.length>0)msg31='In Step 2.4 (Deepen Assessment), give every project a Go or No-Go verdict \u2013 at least one must be Go to proceed here.';
else msg31='No projects are currently at the Exploration stage \u2014 Go projects appear here until they advance to Development, and set-aside projects are under Not Advancing in the Exploration portfolio.';
return h+card('<div class="empty-state"><p class="t-faint">'+msg31+'</p></div>')}
var allGraded=goP.every(function(i){var p=port[i]||{};return p.horizon&&p.risk&&p.reward});
goP.forEach(function(i){var idea=ideas[i],p=port[i]||{},score=getScore(i);var sg=suggestedBands(i),_h2=[];if(!p.horizon&&sg.horizon)_h2.push('horizon: '+sg.horizon);if(!p.risk&&sg.risk)_h2.push('risk: '+sg.risk);if(!p.reward&&sg.reward)_h2.push('reward: '+sg.reward);var _hint=_h2.length?'<p class="t-faint-sm" style="margin:2px 0 8px">Suggested from your assessment \u2013 '+_h2.join(' \u00b7 ')+'</p>':'';
h+=card('<div class="flx-row-mb"><h4 class="h-card">'+esc(idea?idea.name:'')+'</h4>'+hzWarn(i,true)+badge(score+'/50','#1B6B5A')+'</div>'+'<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pc31'+i+'\']=!UI.expanded[\'pc31'+i+'\'];render()">'+(UI.expanded['pc31'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pc31'+i]?projCardRO(i):'')+'</div>'+'<div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',p.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',p.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}],'How likely the project is to miss, judged from your deepened assessment.',true)+sel('Reward *','port_'+i+'_w',p.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}],'How large the payoff is if it works, relative to the rest of the portfolio.',true)+'</div>'+_hint+'<div style="margin-top:12px"><div style="font-size:13px;color:var(--text-faint);margin-bottom:4px">Notes</div><textarea id="port_'+i+'_n" rows="1" class="ta-helper" onchange="fldSave(this.id,this.value)" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';fldSave(this.id,this.value,true)" placeholder="e.g. Balances the long-term QC project with a quick win">'+esc(p.notes||'')+'</textarea></div>','margin-bottom:12px')});
h+=balancePanel(goP,'explore');
h+=doneBtn('saveDone31()',!allGraded,'\u2713 Portfolio Structured',(data.completedSteps||{})['3.1'],'Grade every project on horizon, risk, and reward first.');return h}

function saveDone31(){if(!confirmStepDone('3.1'))return;var goP=getStages().explore.filter(function(i){return((data.projects||{})[i]||{}).viable===true});if(!data.portfolio)data.portfolio={};goP.forEach(function(i){if(Collab.lockedByOther('portfolio::'+i))return;var hh=$('port_'+i+'_h'),rr=$('port_'+i+'_r'),ww=$('port_'+i+'_w'),nn=$('port_'+i+'_n');if(!(hh||rr||ww||nn))return;if(!data.portfolio[i])data.portfolio[i]={};if(hh)data.portfolio[i].horizon=hh.value;if(rr)data.portfolio[i].risk=rr.value;if(ww)data.portfolio[i].reward=ww.value;if(nn)data.portfolio[i].notes=nn.value});if(!data.completedSteps)data.completedSteps={};data.completedSteps['3.1']=true;stampStepDone('3.1');saveData();render()}

function envReserveYear(y){return costNum((data.capital||{})['reserveY'+y])}
function capacityPicture(){var n=envYearsOf();var vals=[],mx=0;
for(var y=1;y<=n;y++){var c=envBudgetYear(y),r=envReserveYear(y);vals.push({y:y,c:c,r:Math.min(r,c)});if(c>mx)mx=c}
if(!mx)return'<p class="t-faint-sm">Set the year-one capacity to draw the picture.</p>';
var _caps=[];for(var yc=1;yc<=n;yc++)_caps.push(susCapOf(yc));
var _capsOn=_caps.filter(function(v){return v>0});
var _capUniform=_capsOn.length===n&&_capsOn.every(function(v){return v===_capsOn[0]});
var W=720,Hh=190,pad=30,bw=(W-pad*2)/n,base=Hh-26;
var sy=function(v){return (Hh-56)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
vals.forEach(function(v,ix){var x=pad+ix*bw+bw*.12,w=bw*.76;var bh=sy(v.c);h+='<rect x="'+x.toFixed(1)+'" y="'+(base-bh).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="4" fill="rgba(27,107,90,.35)"/>';
if(v.r>0){var rh=sy(v.r);h+='<rect x="'+x.toFixed(1)+'" y="'+(base-bh).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+rh.toFixed(1)+'" rx="4" fill="#2E9C7C"><title>Intake reserve '+fmtMoney(v.r)+'</title></rect>'}
var scpB=_caps[v.y-1];if(scpB>0){var cy=base-bh*(scpB/100);h+='<line x1="'+x.toFixed(1)+'" y1="'+cy.toFixed(1)+'" x2="'+(x+w).toFixed(1)+'" y2="'+cy.toFixed(1)+'" stroke="#D4A017" stroke-width="2" stroke-dasharray="4,3"><title>Sustainment cap '+scpB+'%</title></line>'}
h+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(Hh-12)+'" text-anchor="middle" font-size="10" fill="#8A8278">Year '+v.y+'</text>';
h+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(base-bh-6).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#F5F2EC">'+fmtMoney(v.c)+'</text>'});
h+='</svg>';
h+='<div class="t-faint-sm" style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:rgba(27,107,90,.35);border-radius:2px;margin-right:4px"></span>Annual capacity <span style="display:inline-block;width:10px;height:10px;background:#2E9C7C;border-radius:2px;margin:0 4px 0 12px"></span>Intake reserve within capacity'+(_capsOn.length?' <span style="display:inline-block;width:14px;border-top:2px dashed var(--warn-text);margin:0 4px 2px 12px"></span>Sustainment cap '+(_capUniform?_capsOn[0]+'%':'\u2013 per year')+'':'')+'</div>';
h+='<p class="t-faint-sm" style="margin:6px 0 0">Each bar is one year\u2019s total budget; the brighter block at its top is that year\u2019s intake reserve.</p>';
var warn='';
if(warn)h+='<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">\u26a0 '+warn+'</p>';
return h}
function capAuditAnswered(){return (data.audit||[]).every(function(it){return !it||!String(it.name||'').trim()||it.assigned==='yes'||it.assigned==='no'})}
function legacyAssign(i,val){if(lockBlocked('audit'))return;var it=(data.audit||[])[i];if(!it)return;it.assigned=val;Store.commit('audit');render()}
function legacyIntake(i){if(lockBlocked('audit'))return;var it=(data.audit||[])[i];if(!it||!String(it.name||'').trim())return;if(it.projIdx!=null)return;
var stg=(UI.legacyStage||{})[i]||'exploration';
if(!data.ideas)data.ideas=[];data.ideas.push({name:it.name,desc:'Legacy initiative adopted from the AI Innovation Audit',dept:'',cost:'',when:'now'});
var idx=data.ideas.length-1;
if(!data.projects)data.projects={};data.projects[idx]={legacy:true};
if(!data.selected)data.selected=[];data.selected.push(idx);
if(stg==='development'||stg==='operational'){if(!data.expSelected)data.expSelected=[];data.expSelected.push(idx);data.projects[idx].advancedAt=Date.parse((data.capital||{}).periodStart)||Date.now()}
if(stg==='operational'){if(!data.launched)data.launched=[];data.launched.push(idx);if(!data.opsData)data.opsData={};data.opsData[idx]={}}
it.assigned='yes';it.projIdx=idx;
data.capStale=true;
Store.commit('audit');Store.commit('ideas');Store.commit('projects',idx);Store.commit('selected');if(stg!=='exploration')Store.commit('expSelected');if(stg==='operational'){Store.commit('launched');Store.commit('opsData',idx)}Store.commit('capStale');
saveData();render()}
function legacyTab(){var au=data.audit||[];
var named=au.filter(function(a){return a&&String(a.name||'').trim()});
var body='<h3 class="h-sub-lg">Legacy Projects</h3><p class="t-faint-sm" style="margin-bottom:10px">Many budgets import pre-existing commitments. For each initiative identified in the AI Innovation Audit (Step 1.1), answer one question: does it draw on your AI transformation budget? If yes, the project enters the pipeline as a real card at its relevant stage, identified as pre-existing by its Legacy badge.</p><div class="form-label" style="margin-top:2px">Assigned to this budget?</div>';
if(!named.length)body+='<div class="empty-state"><p class="t-faint">No named initiatives in the AI Innovation Audit yet \u2013 inventory them at Step 1.1 first.</p></div>';
var _idx=[];au.forEach(function(it,i){if(it&&String(it.name||'').trim())_idx.push(i)});
var _ordered=_idx.filter(function(i){return au[i].assigned==='yes'}).concat(_idx.filter(function(i){return au[i].assigned!=='yes'}));
body+=_ordered.map(function(i,_ox){var it=au[i];
var st={alive:'Alive',dormant:'Dormant',dead:'Dead'}[it.status]||'\u2014';
var dim=it.assigned==='no';
var row='<div class="row-line" style="align-items:center;border-bottom:none'+(dim?';opacity:.5':'')+'"><span class="fs-14" style="flex:1">'+esc(it.name)+'</span>'+badge(st,it.status==='alive'?'#1B6B5A':'var(--text-faint)')
+'<select onchange="legacyAssign('+i+',this.value)" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px"><option value=""'+(!it.assigned?' selected':'')+'>Select\u2026</option><option value="yes"'+(it.assigned==='yes'?' selected':'')+'>Yes</option><option value="no"'+(it.assigned==='no'?' selected':'')+'>No</option></select>';
if(it.assigned==='yes'&&it.projIdx==null){
row+='<select onchange="UI.legacyStage['+i+']=this.value" class="sel-helper" style="width:auto;padding:4px 8px;font-size:12px"><option value="exploration"'+((UI.legacyStage[i]||'exploration')==='exploration'?' selected':'')+'>Exploration</option><option value="development"'+(UI.legacyStage[i]==='development'?' selected':'')+'>Development</option><option value="operational"'+(UI.legacyStage[i]==='operational'?' selected':'')+'>Operational</option></select>'
+btn('Adopt \u2192','legacyIntake('+i+')','bs','font-size:11px;padding:4px 10px')}
if(it.projIdx!=null){var pi=it.projIdx;var stgn=(data.launched||[]).indexOf(pi)>=0?'Operational':((data.expSelected||[]).indexOf(pi)>=0?'Development':'Exploration');
row+=badge(stgn,'#2D5A8E')+badge('Legacy','#D4A017')}
row+='</div>';
if(dim)row+='<p class="t-faint-sm" style="margin:2px 0 8px">Not this budget \u2013 stays off the organizational charts.</p>';
if(it.projIdx!=null){var pi2=it.projIdx;var open=UI.expanded['lgb'+pi2];
row+='<div style="margin:2px 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'lgb'+pi2+'\']=!UI.expanded[\'lgb'+pi2+'\'];render()">'+(open?'\u25be':'\u25b8')+' Budget plan</button>'+(open?'<p class="t-faint-sm" style="margin:8px 0 4px">This plan only looks forward. Month 1 is the start of the budgetary period, so enter the remaining work from that point on \u2013 money spent before the period began is not part of this budget and never appears on the charts.</p>'+bpBudgetTab(pi2):'')+'</div>'}
return '<div style="'+(_ox<_ordered.length-1?'border-bottom:1px solid rgba(var(--fg-rgb),.08);':'')+'margin-bottom:8px;padding-bottom:4px">'+row+'</div>'}).join('');
return card(body,'margin-bottom:16px')}
function renderStepCap(){
var cap=data.capital||{};
var h=vp('V-3.2.1','Sizing the Capacity Plan','3\u20135 min');
h+='<h2 class="h-section">Step 2: Plan Capacity</h2><p class="t-lead">Set the financial frame that every commitment will be measured against. Choose how many years the plan covers, date its starting month, and give each year a budget. Then open the second tab and answer the budget question for every legacy initiative, so the plan starts from your real position. This step records capacity only. Committing money to projects happens at the next step.</p>';
if(UI.capPlanTab==null)UI.capPlanTab=1;if(!UI.legacyStage)UI.legacyStage={};
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'1 \u00b7 Capacity Plan'},{t:2,l:'2 \u00b7 Legacy Projects'}].map(function(tb){return'<button onclick="UI.capPlanTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.capPlanTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.capPlanTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.capPlanTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
var _gateOff=!(String(cap.aiBudget||'').trim()&&String(cap.periodStart||'').trim()&&capAuditAnswered());
if(UI.capPlanTab===2){h+=legacyTab();h+=doneBtn('saveDoneCap()',_gateOff,null,(data.completedSteps||{})['3.2'],'Set the year-one budget and the period start date, and answer the budget question for every legacy initiative (second tab).');return h}
h+=card('<h3 class="h-sub-lg">Planning</h3><div style="display:flex;gap:14px 80px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div class="form-label">Planning period begins *</div><input type="date" id="cap_periodStart" value="'+esc(cap.periodStart||'')+'" onchange="fldSave(this.id,this.value,true)" onblur="fldSave(this.id,this.value,true);deferRender()" class="u-6293484"/><p class="t-faint-sm" style="margin:6px 0 0">The calendar origin point \u2013 month one of every organization-wide financial chart.</p><p class="fs-14" style="margin:8px 0 0">'+fyToday()+'</p></div><div style="flex:1;min-width:200px"><div class="form-label">Planning period length</div><select class="sel-helper" style="width:auto;padding:8px 12px;font-size:15px" onchange="fldSave(\'cap_envYears\',this.value)">'+[1,2,3,4,5].map(function(k){return'<option value="'+k+'"'+(envYearsOf()===k?' selected':'')+'>'+k+(k===1?' year':' years')+'</option>'}).join('')+'</select>'+hzReconcilePanel()+'</div></div>','margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Capacity Plan</h3>'+budgetEnvelopeRow()+fundNote(),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Sustainment Cap</h3><div class="flx-center gap-2" style="flex-wrap:wrap"><span class="fs-14">A maximum of</span><input id="cap_susCap" value="'+esc(cap.susCap||'')+'" placeholder="e.g. 40" onchange="fldSave(this.id,this.value)" class="row-input" style="flex:0 0 84px;width:84px;text-align:center"/><span class="fs-14">% of any year\u2019s budget can be spent on the running costs of existing projects.</span></div><p class="t-faint-sm" style="margin:8px 0 0">Drawn on the charts as a dashed line \u2013 crossing it generates a warning.</p><div class="t-faint-sm" style="margin:14px 0 4px">PER-YEAR OVERRIDES (optional) \u2013 leave a year blank to use the figure above</div><div style="display:flex;gap:10px;flex-wrap:wrap">'+(function(){var _h2='';for(var _y=1;_y<=envYearsOf();_y++){_h2+='<div style="flex:1;min-width:96px"><div class="form-label" style="font-size:12px">Year '+_y+'</div><div class="flx-center gap-2"><input id="cap_susCapY'+_y+'" value="'+esc(cap['susCapY'+_y]||'')+'" placeholder="\u2013" onchange="fldSave(this.id,this.value)" class="row-input" style="flex:0 0 64px;width:64px;text-align:center"/><span class="t-faint-sm">%</span></div></div>'}return _h2})()+'</div>','margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Capacity Picture</h3>'+capacityPicture(),'margin-bottom:16px');
h+=doneBtn('saveDoneCap()',_gateOff,null,(data.completedSteps||{})['3.2'],'Set the year-one budget and the period start date, and answer the budget question for every legacy initiative (second tab).');
return h}
function saveDoneCap(){if(!confirmStepDone('3.2'))return;if(!Collab.lockedByOther('capital')){if(!data.capital)data.capital={};['aiBudget','periodStart'].forEach(function(fld){var e=$('cap_'+fld);if(e&&e.value!==undefined)data.capital[fld]=e.value})}if(!data.completedSteps)data.completedSteps={};data.completedSteps['3.2']=true;stampStepDone('3.2');saveData();render()}
function capStartSave(i,val){if(Collab.lockedByOther('projects::'+i))return;if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};data.projects[i].startDate=val;Store.commit('projects',i);data.capStale=true;Store.commit('capStale')}
function deferRender(){setTimeout(render,0)}
function capLandingLine(i){var pj=(data.projects||{})[i]||{};var ps=(data.capital||{}).periodStart;
if(!ps)return'Set the period start at Step 3.2 to see where this lands.';
if(!pj.startDate){var pm=progMonthOf(new Date());return'No date yet \u2013 the commit will assume the first of next month (program Month '+((pm==null?0:pm)+1)+').'}
var a=progMonthOf(pj.startDate);if(a==null)return'';
var t='Plan Month 1 lands program Month '+a;
if(bpHasAny(i)){var fo=bpFirstOpMonth(i);if(fo)t+=' \u00b7 first operational month lands program Month '+(a+fo-1)}
return t+'.'}
function capOverrideRecord(rIn){if(Collab.lockedByOther('capital'))return;var e=$('cap_overrideReason');var r=rIn!=null?String(rIn).trim():(e?String(e.value||'').trim():'');if(!r)return;var br=capBreaches();if(!data.capital)data.capital={};if(!data.capital.overrides)data.capital.overrides=[];var u=typeof getCurrentUser==='function'?(getCurrentUser()||{}):{};data.capital.overrides.push({id:uid(),at:Date.now(),by:u.name||'',month:br.overCapMonth||0,reason:r});Store.commit('capital');render()}
function allocCore(){
var cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},port=data.portfolio||{},ca=data.capAlloc||{};
var goP=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
var av=capAvailable();
if(UI.capTab==null||UI.capTab>2)UI.capTab=1;if(!UI.capSim)UI.capSim={};
var h='';
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'1 \u00b7 Sandbox'},{t:2,l:'2 \u00b7 Commit & Advance'}].map(function(tb){return'<button onclick="UI.capTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.capTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.capTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.capTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.capTab===1){
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">No candidates to model \u2013 Go projects from Exploration appear here with their costs.</p></div>');
else{var selIdx=goP.filter(function(i){return UI.capSim[i]});
var toExp=0,fyOp=0;selIdx.forEach(function(i){toExp+=devCost(i);fyOp+=devCost(i)+opsRolloutCost(i)});
h+=card('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 class="h-sub-lg" style="margin:0">Sandbox</h3>'+btn('\u25BE Save as PDF','printCapSandbox()','bg2','font-size:12px')+'</div><p class="t-faint-sm" style="margin:6px 0 10px">Tick any combination to stack the batch onto the standing baseline \u2013 the charts redraw as the portfolio would look. This view is a sandbox: nothing here commits anything, nothing is saved.</p>'+goP.map(function(i){var pb=port[i]||{};return'<div class="row-line"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()"/><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+hzWarn(i,true)+'<input type="date" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484" style="width:132px;font-size:11px" title="Assumed start date \u2013 blank means next month"/>'+'<span class="t-faint-sm" style="min-width:150px;text-align:right">dev '+fmtMoney(devCost(i))+' \u00b7 rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span>'+badge(getScore(i)+'/50','#1B6B5A')+'</div>'}).join(''),'margin-bottom:16px');
if(!orgMonthly())h+=card('<p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>','margin-bottom:16px');
else{var pmNow=progMonthOf(new Date());var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
var extras=selIdx.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});
var brS=capBreaches(extras);
var _dated=selIdx.filter(function(i){return(proj[i]||{}).startDate}).length;
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">'+(selIdx.length?'Staged batch ('+selIdx.length+')':'The standing baseline')+'</h3>'+zoomBtn('ac_wf')+'</div>'
+(selIdx.length?'<p class="t-faint-sm" style="margin-bottom:8px">Unless otherwise specified, the assumed start for every ticked candidate is next month (program Month '+aAss+'). Committed on advancing: <strong>'+fmtMoney(toExp)+'</strong> \u2013 the full plans, reflected across the years they touch in the cells on the Commit & Advance tab.</p>':'<p class="t-faint-sm" style="margin-bottom:8px">Committed and legacy promises as they already sit on the program calendar \u2013 tick candidates above to stage the batch on top.</p>')
+orgWaterfallChart(extras)+(selIdx.length?(brS.overCapMonth?'<p class="fs-13" style="margin:14px 0 6px;color:var(--warn-text)">\u26a0 With this batch, cumulative commitments cross capacity in Month '+brS.overCapMonth+'. A funding plan will be required at Commit & Advance.</p>':'<p class="t-faint-sm" style="margin:14px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'')+'<div style="margin-top:6px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_cum')+'</div>'+orgCumChart(extras)+'</div><div style="margin-top:12px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_swim')+'</div>'+orgSwimlanes(extras)+'</div>','margin-bottom:16px')}}}
if(UI.capTab===2){
var br=capBreaches();var breached=br.overCapMonth>0;var ctOnly=!breached&&br.ctOverCapMonth>0;var ovs=(cap.overrides||[]);
var pmNow2=progMonthOf(new Date());var aAss2=Math.max(1,(pmNow2==null?0:pmNow2)+1);
var selIdx2=goP.filter(function(i){return UI.capSim[i]});
// 1. slim capital strip — staged batch included when ticked
var _sx2=selIdx2.map(function(i){return capAssumedExtra(i)});var _sxTot=0;_sx2.forEach(function(e){_sxTot+=capProjectWindow(e.i,e.anchor).inW});
h+=card(capCells(false,_sx2.length?_sx2:null)+(selIdx2.length?'<p class="t-faint-sm" style="margin:8px 0 0">Including the staged batch \u2013 '+selIdx2.length+' candidate'+(selIdx2.length>1?'s':'')+', +'+fmtMoney(_sxTot)+' of full plans committed on advancing, spread across the years they touch.</p>':''),'margin-bottom:16px');
// 2. advance queue — staged first, ticks live
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">Nothing to advance \u2013 Go projects appear here from Exploration. On a first pass, advance 3\u20135, led by the quick wins.</p></div>','margin-bottom:16px');
else{h+='<h3 class="h-sub-md">Advance queue</h3><p class="t-faint-sm" style="margin-bottom:10px">Ticked candidates are the staged batch \u2013 change the mix freely here or in the sandbox, and the calendar below redraws. Unless otherwise specified, the assumed start for a ticked candidate is program Month '+aAss2+' (next month).</p>';
goP.slice().sort(function(a,b){return(UI.capSim[b]?1:0)-(UI.capSim[a]?1:0)}).forEach(function(i){var c=projCosts(i),pb=port[i]||{},graded=!!(pb.horizon&&pb.risk&&pb.reward);
var live=graded;var _brF=capBreaches([capAssumedExtra(i)]);var fits=!_brF.overCapMonth;var planOk=!!(String(cap.reallocation||'').trim()||String(cap.gapPlan||'').trim());
var costRow=function(l,v){return'<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:5px"><span class="t-faint-sm">'+l+'</span><span class="fs-14" style="font-weight:700;color:var(--paper)">'+v+'</span></div>'};
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:1;min-width:260px"><div class="flx-row-mb"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()" style="margin-right:2px"/><h4 class="h-card">'+esc((ideas[i]||{}).name)+'</h4>'+hzWarn(i,true)+(UI.capSim[i]?badge('Staged','#8B5E3C'):'')+badge(getScore(i)+'/50','#1B6B5A')+'</div><div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end"><div><div class="t-faint-sm">ASSUMED START DATE</div><input type="date" id="prj_'+i+'_startDate" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484"/></div><div class="t-faint-sm" style="flex:1;min-width:150px;max-width:280px;padding-bottom:6px;line-height:1.45">'+capLandingLine(i)+'</div></div><div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(live&&(fits||planOk)?btn('Advance to Development Portfolio \u2192','advanceWithGates('+i+')','bp','font-size:13px'):(!graded?'<span><button class="btn-ghost" disabled style="font-size:13px;opacity:.35;cursor:not-allowed">Advance to Development Portfolio \u2192</button><div class="t-faint-sm" style="margin-top:6px">Grade Horizon, Risk, and Reward at Step 3.1 first.</div></span>':'<span class="t-faint-sm">Exceeds available budget \u2013 complete the funding plan below.</span>'))+'</div></div><div style="flex:0 0 230px;padding:10px 12px;border-left:1px solid rgba(var(--fg-rgb),.08)">'+costRow('Development costs',fmtMoney(devCost(i)))+costRow('Rollout costs',fmtMoney(opsRolloutCost(i)))+costRow('Sustainment costs',fmtMoney(opsSustainCost(i))+'/yr')+'</div></div>','margin-bottom:12px')})}
// 3. one batch-aware chart card — waterfall and cumulative, both open (Paul, July 7)
if(!orgMonthly())h+=card('<h3 class="h-sub-md">On the calendar</h3><p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the source-of-truth charts.</p>','margin-bottom:16px');
else{var extras2=selIdx2.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss2}});
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">On the calendar'+(selIdx2.length?' \u2013 staged batch included':'')+'</h3>'+zoomBtn('ac_wf')+'</div><p class="t-faint-sm" style="margin-bottom:10px">'+(selIdx2.length?'The standing baseline with the staged batch stacked on top \u2013 the same picture as the sandbox.':'Every committed promise at its month on the program calendar, against the capacity line.')+'</p>'+orgWaterfallChart(extras2)
+'<div style="margin-top:16px"><div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">Cumulative commitments vs capacity</h3>'+zoomBtn('ac_cum')+'</div>'+(function(){var _bx=capBreaches(extras2);return _bx.overCapMonth?'<p class="fs-13" style="margin:6px 0 6px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+_bx.overCapMonth+'.</p>':'<p class="t-faint-sm" style="margin:6px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'})()+orgCumChart(extras2)+'</div>','margin-bottom:16px')}
// 4. funding plan — open and bordered when breached, folded otherwise
var fpBody=(breached?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+br.overCapMonth+'. Reallocate, revise costs, drop candidates \u2013 or proceed with a recorded override (shown at the quarterly review).</p>':(function(){var L=capLens();var anyDef=false;
var strip=L.years.map(function(r){if(r.available<0)anyDef=true;return'Year '+r.y+' <strong style="color:'+(r.available<0?'#C25B73':'var(--ph1-t)')+'">'+(r.available<0?'\u2212'+fmtMoney(Math.abs(r.available)):fmtMoney(r.available))+'</strong>'}).join(' \u00b7 ');
return'<p class="t-faint-sm" style="margin-bottom:8px">Available by year: '+strip+' \u00b7 whole window <strong>'+fmtMoney(L.tot.available)+'</strong>. '+(anyDef?'Complete the funding plan below to close the gap before advancing further projects into the years in the red.':'If advancing a project pushes a year into the red, complete the funding plan below before it moves.')+'</p>'})())
+(ctOnly?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-pale)">\u26a0 Within capacity as committed, but stated contingencies would cross it in Month '+br.ctOverCapMonth+'.</p>':'')+fundPlanLines();
if(breached)fpBody+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.08)"><div class="t-faint-sm" style="margin-bottom:4px">PROCEED ANYWAY \u2013 RECORDED OVERRIDE</div><div class="flx-g3" style="align-items:center"><input id="cap_overrideReason" placeholder="Why this is acceptable \u2013 shown at the quarterly review" class="row-input" style="flex:3"/>'+btn('Record override','capOverrideRecord()','bg2','font-size:12px;padding:6px 12px')+'</div></div>';
if(ovs.length)fpBody+='<div class="t-faint-sm" style="margin:10px 0 4px">OVERRIDES ON RECORD</div>'+ovs.map(function(o){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(o.reason||'')+'</span><span class="t-faint-sm">month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join('');
if(breached||ctOnly)h+=card('<h3 class="h-sub-md">Capacity Breach Funding Plan</h3>'+fpBody,'margin-bottom:16px'+(breached?';border:1px solid rgba(212,160,23,.5)':';border:1px solid rgba(232,212,139,.35)'));
else{var _fpo=!!UI.expanded['fpA'];
h+=card('<div class="xh" style="cursor:pointer" onclick="UI.expanded[\'fpA\']=!UI.expanded[\'fpA\'];render()"><h3 class="h-sub-md" style="margin:0">'+(_fpo?'\u25be':'\u25b8')+' Capacity Breach Funding Plan</h3></div>'+(_fpo?'<div style="margin-top:10px">'+fpBody+'</div>':''),'margin-bottom:16px')}
// 4b. the committed calendar — own expandable card (Paul, July 7)
if(orgMonthly()){var _swm=!!UI.expanded['acSwim'];
h+=card('<div class="xh" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="UI.expanded[\'acSwim\']=!UI.expanded[\'acSwim\'];render()"><h3 class="h-sub-md" style="flex:1;margin:0">'+(_swm?'\u25be':'\u25b8')+' The committed calendar (swimlanes)</h3>'+(_swm?'<span onclick="event.stopPropagation()">'+zoomBtn('ac_swim')+'</span>':'')+'</div>'+(_swm?'<div style="margin-top:10px">'+orgSwimlanes(extras2)+'</div>':''),'margin-bottom:16px')}
// 5. folded ledger detail: itemized committed sums and the kill & phase-out pot
var _ref=!!UI.expanded['acRef'];
h+='<div style="margin-bottom:16px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'acRef\']=!UI.expanded[\'acRef\'];render()">'+(_ref?'\u25be':'\u25b8')+' Committed Sums & Kill Pot</button></div>';
if(_ref){h+=capReadout()}
// 6. advanced — the undo list stays last
var adv=stages.experiment;
if(adv.length){h+='<h3 class="h-sub-md" style="margin-top:10px">Advanced to Development ('+adv.length+')</h3>';
adv.forEach(function(i){h+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">Development Costs '+fmtMoney(devCost(i))+'</span><button onclick="toggleExpSel('+i+')" class="btn-ghost pad-chip-sm">\u21a9 Return to Exploration</button></div>'})}}
return h}
function renderStepAlloc(){
var cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},port=data.portfolio||{},ca=data.capAlloc||{};
var goP=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
var av=capAvailable();
if(UI.capTab==null||UI.capTab>2)UI.capTab=1;if(!UI.capSim)UI.capSim={};
var h=vp('V-3.3.1','Allocate Capital','3\u20135 min');
h+='<h2 class="h-section">Step 3: Allocate Capital</h2><p class="t-lead">Model batches of projects in the sandbox first. Select candidate groups and the charts will redraw to show what the portfolio\u2019s financial position would look like if these projects moved forward. When the mix looks right, move to the Commit & Advance tab, where you can assign each project an assumed start date and then advance it to the development portfolio.</p>';
h+=allocCore();
var advOk=stages.experiment.length>0;
h+=doneBtn('saveDoneAlloc()',!advOk,null,(data.completedSteps||{})['3.3'],'Advance at least one project.');
return h}
function advanceWithGates(i){var pb=(data.portfolio||{})[i]||{};
if(!(pb.horizon&&pb.risk&&pb.reward)){try{alert('Grade horizon, risk, and reward at Step 3.1 before advancing.')}catch(e){}return}
var cap2=data.capital||{};var _brA=capBreaches([capAssumedExtra(i)]);
if(_brA.overCapMonth&&!String(cap2.reallocation||'').trim()&&!String(cap2.gapPlan||'').trim()){try{alert('This advance would cross cumulative capacity in Month '+_brA.overCapMonth+' \u2013 complete the funding plan (reallocation sources or gap plan) first.')}catch(e){}return}
if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};if(!data.projects[i].startDate){var _d=new Date();_d.setDate(1);_d.setMonth(_d.getMonth()+1);data.projects[i].startDate=_d.toISOString().split('T')[0]}
advanceToDevFromExplore(i)}
function saveDoneAlloc(){if(!confirmStepDone('3.3'))return;if(!Collab.lockedByOther('capital')){if(!data.capital)data.capital={};['reallocation','gapPlan'].forEach(function(fld){var e=$('cap_'+fld);if(e&&e.value!==undefined)data.capital[fld]=e.value})}if(!data.completedSteps)data.completedSteps={};data.completedSteps['3.3']=true;stampStepDone('3.3');saveData();render()}
/* Define Development Program (Step 3.4 rebuild, July 5). Doctrine: the budget
   plan's development steps ARE the program's phases - one list, two lenses. This
   page adds the contract to each phase (owner, success metric, exit criteria);
   money fields reuse the plan-editor save path (bpRowSave). Gates are decision
   records taken as phases end (Step 4.1 / Development portfolio), never funding
   valves; the estimate commits whole at advancement. */
var PROG_TPL=[
{n:'Observation & design',d:'Shadow the current process, capture failure modes, specify the solution'},
{n:'Paper prototype',d:'Manual mock of the future workflow \u2013 no build, real users'},
{n:'Experiment',d:'Build and run the test that answers the core hypothesis'},
{n:'Pilot',d:'Limited live deployment against agreed thresholds'},
{n:'Rollout preparation',d:'Hardening, training, and handover design'},
{n:'',d:''}];
function pgDelPhase(i,id){try{if(!confirm('Delete this phase? Its budget line, dates, description, and gate criteria will all be removed.'))return}catch(e){}bpDelStep(i,'dev',id)}
function addProgPhase(i,t){if(Collab.lockedByOther('budgetPlans::'+i))return;var tp=PROG_TPL[t]||PROG_TPL[5];var p=bpEnsure(i);if(!p.dev)p.dev=[];p.dev.push({id:uid(),name:tp.n,desc:'',from:'',to:'',cost:''});Store.commit('budgetPlans',i);render()}
function addProgPhaseSel(i){var e=$('pgTpl_'+i);addProgPhase(i,e?parseInt(e.value,10):5)}
function addProgDefault(i){if(Collab.lockedByOther('budgetPlans::'+i))return;var p=bpEnsure(i);if(!p.dev)p.dev=[];p.dev.push({id:uid(),name:'Design & build experiment',desc:'',from:'',to:'',cost:''});p.dev.push({id:uid(),name:'Run & evaluate',desc:'',from:'',to:'',cost:''});Store.commit('budgetPlans',i);render()}
function progContracted(i){if(!bpHasDev(i))return false;var okAll=true;bpRows(i,'dev').forEach(function(r){if(!r)return;if(!bpStepMoney(r)||!String(r.powner||'').trim()||!String(r.pmetric||'').trim()||!String(r.pexit||'').trim())okAll=false});return okAll}
function pgTa(i,r,f,label,ph,rows){return'<div class="mb-4" style="flex:1;min-width:180px"><label class="form-label">'+esc(label)+'</label><textarea id="pgf_'+i+'__'+r.id+'__'+f+'" rows="'+(rows||1)+'" class="ta-helper gate-field" onchange="bpRowSave('+i+',\'dev\',\''+r.id+'\',\''+f+'\',this.value)" placeholder="'+esc(ph||'')+'">'+esc(r[f]||'')+'</textarea></div>'}
function progEditor(i){var rows=bpRows(i,'dev').filter(function(r){return !!r});
var h='<h4 style="font-size:17px;font-weight:700;color:var(--paper);margin:14px 0 10px">Project Development Program</h4>';
if(!rows.length){h+='<p class="t-faint-sm" style="margin:0 0 8px">No development phases yet. Start from the two-phase default \u2013 the module\u2019s experiment path \u2013 or add phases from the template list. Every phase carries a budget, an owner, a success metric, and exit criteria; a gate decision is taken as each phase ends.</p>'+btn('Create two-phase program','addProgDefault('+i+')','bg2','font-size:11px;padding:3px 10px')}
else{var H34=parseInt((bpGet(i)||{}).horizon,10)||3;rows.forEach(function(r,ix){h+='<div style="border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;padding:12px;margin-bottom:18px">'
+'<div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px"><div style="font-size:14px;font-weight:700;color:var(--paper)">Phase '+(ix+1)+'</div><button class="btn-ghost pad-chip-sm" style="font-size:10.5px" onclick="pgDelPhase('+i+',\''+r.id+'\')">Delete phase</button></div>'
+'<div style="max-width:260px">'+pgTa(i,r,'powner','Owner *','e.g. Robin Vance')+'</div>'
+'<div class="flx-g3" style="align-items:center;margin-bottom:2px"><span class="form-label" style="flex:2;margin:0">Phase name</span><span class="form-label" style="flex:0 0 136px;margin:0">Months</span><span class="form-label" style="flex:0 0 140px;margin:0">Phase budget</span></div>'
+bpStepRow(i,'dev',r,H34,true,true)
+'<div style="margin-top:10px"><label class="form-label">Phase description</label>'+bpDescTa('bps_'+i+'_dev_'+r.id+'_desc',r.desc,"bpRowSave("+i+",'dev','"+r.id+"','desc',this.value)",3,'Describe the development phase')+'</div>'
+'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">'+pgTa(i,r,'pmetric','Success metrics *','e.g. Quote turnaround < 4 hours',2)+pgTa(i,r,'pexit','Exit gate criteria *','e.g. \u2265 90% routing accuracy over four weeks',2)+'</div>'
+(r.gateDec?'<p class="t-faint-sm" style="margin:2px 0 6px">Gate taken: '+esc(r.gateDec)+(r.gateAt?' \u00b7 '+fmtDate(r.gateAt):'')+'</p>':'')+'</div>'})}
h+='<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><select id="pgTpl_'+i+'" style="font-size:11px;padding:3px 6px;background:rgba(var(--fg-rgb),.04);color:var(--text-max);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px">'+PROG_TPL.map(function(t,x){return'<option value="'+x+'" style="background:var(--menu-bg);color:var(--menu-fg)">'+(t.n||'Custom phase')+'</option>'}).join('')+'</select>'+btn('+ Add phase','addProgPhaseSel('+i+')','bg2','font-size:11px;padding:3px 10px')+'</div>';
if(bpHasDev(i))h+='<p class="t-faint-sm" style="margin-top:8px">The committed sum for this project is calculated from these phases. Adding phases or changing budgets changes the project\u2019s committed cost across the program. After making changes here, review headroom at Allocate Capital (Step 3.3) to confirm the plan still fits the budget.</p>';
return h}
function renderStepExp(){
var ideas=data.ideas||[],stages=getStages(),exp=data.experiments||{},exSel=(data.expSelected||[]).filter(function(i){return!isArchived(i)});
var devSel=exSel.filter(function(i){return(stages.operational||[]).indexOf(i)<0});
var allContracted=devSel.length>0&&devSel.every(function(i){return progContracted(i)});
var h=vp('V-3.4.1','Phases, Gates, and the Development Program','3\u20135 min');
h+='<h2 class="h-section">Step 4: Map Development Track</h2><p class="t-lead">The first batch of projects has now advanced from the Exploration portfolio to the Development portfolio. Each one needs a defined development program to carry it from planned-out idea to a project ready for live implementation. Development programs run across a number of phases, each with its own budget, owner, success metrics, and exit criteria. No project moves forward without passing through a rigorous gate at the end of each phase \u2013 a gate that either unlocks the funding for the next phase or passes the project through to the Operational portfolio. The number of phases is customizable: more complex or higher-risk projects warrant more of them.</p>';
if(devSel.length>5)h+='<p class="t-faint-sm" style="margin-top:6px">You have '+devSel.length+' projects in Development \u2013 the 90-day program recommends running no more than five at once.</p>';
if(devSel.length===0){h+=card('<div class="empty-state"><p class="t-faint">Nothing in Development yet \u2013 advance projects at Step 3.3 (Allocate Capital).</p></div>')}
else{h+='<div class="u-062d4a8"><h3 class="u-0c241bf">Development Programs</h3>';
devSel.forEach(function(i){var e=exp[i]||{},idea=ideas[i];var open=UI.expanded['xb'+i]!==false;var isR=progContracted(i),_ph=bpHasDev(i);
var head='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'xb'+i+'\']=UI.expanded[\'xb'+i+'\']===false?true:false;render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="u-32b14d6" style="flex:1;margin:0;font-size:17px">'+esc(idea?idea.name:'Item '+i)+'</h4>'+badge(isR?'gates defined':_ph?'phases defined':'no program yet',isR?'#1B6B5A':_ph?'#8B5E3C':'#57534B')+'</div>';
var body='';
if(open){body='<div style="margin-top:12px">'+ideaCardFold(i,'ic34')
+'<div style="margin:10px 0"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pc34'+i+'\']=!UI.expanded[\'pc34'+i+'\'];render()">'+(UI.expanded['pc34'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pc34'+i]?projCardRO(i):'')+'</div>'
+'<div style="display:grid;grid-template-columns:5fr 5fr minmax(150px,2fr);gap:12px;margin-top:4px">'+'<div class="lbl-lg">'+ta('Objectives','expl_'+i+'_obj',((data.projects||{})[i]||{}).objectives||'','What this project is meant to achieve',2)+'</div><div class="lbl-lg">'+ta('Deliverables','expl_'+i+'_del',((data.projects||{})[i]||{}).deliverables||'','What it will hand over',2)+'</div>'+bpHeadlineBudget(i,e)+'</div>'
+progEditor(i)+'</div>'}
h+=card(head+body,'border-left:4px solid #8B5E3C;margin-bottom:16px'+(open?'':';cursor:pointer'),xpandAttr('xb'+i,open))});
h+='</div>'}
h+=doneBtn('saveDoneProg()',!allContracted,'\u2713 Development Track Set \u2014 Ready for Phase 4',(data.completedSteps||{})['3.4'],'Give every phase a budget, an owner, a success metric, and exit criteria.');
return h}
function saveDoneProg(){if(!confirmStepDone('3.4'))return;if(!data.completedSteps)data.completedSteps={};data.completedSteps['3.4']=true;stampStepDone('3.4');saveData();render()}
function toggleExpSel(i){if(!data.expSelected)data.expSelected=[];var idx=data.expSelected.indexOf(i);if(idx>=0)data.expSelected.splice(idx,1);else data.expSelected.push(i);data.capStale=true;Store.commit('expSelected');Store.commit('capStale');render()}

// === PHASE 4 STEPS ===
/* Run Development Track (Step 4.1 rebuild, P4, July 5). Doctrine: gates cannot be
   scheduled but readiness can \u2013 the step completes when the machine is armed:
   every live program's next gate has dates, an owner, and exit criteria. Gate
   decisions themselves are taken on the Development portfolio as phases end. */
function progNextGate(i){var rows=progOrdered(i);for(var x=0;x<rows.length;x++){var r=rows[x];if(!r.gateDec&&r.pstatus!=='complete')return r}return null}
function progOverdue(i){if((((data.tracking||{})[i])||{}).status==='killed')return 0;var pmn=progMonthOf(new Date());if(pmn==null)return 0;var n=0;progOrdered(i).forEach(function(r){var sp=bpStepSpan(r);if(sp&&sp[1]<pmn&&!r.gateDec)n++});return n}
function progArmed(i){if((((data.tracking||{})[i])||{}).status==='killed')return true;if(!bpHasDev(i))return false;var nxt=progNextGate(i);if(!nxt)return true;return !!(bpStepSpan(nxt)&&String(nxt.powner||'').trim()&&String(nxt.pexit||'').trim())}
function renderStep41(){
var ideas=data.ideas||[],exSel=(data.expSelected||[]).filter(function(i){return!isArchived(i)}),trk=data.tracking||{};
var h=vp('V-4.1.1','Run Development Track: Results and Learning','3\u20135 min');
h+='<h2 class="h-section">Step 1: Run Development Track</h2><p class="t-lead">Run each development program one phase at a time. Keep the status of the current phase up to date, and record what each phase produces. That means the results the phase was designed to test for, and anything you learn about the systems and processes around it. When a phase ends, its gate asks for a decision. The development process either moves to its next phase, repeats the phase with changes, or stops the project. The step is complete when nothing is overdue \u2013 every phase that has ended has its gate decision recorded, and every upcoming gate has an owner and exit criteria.</p>';
if(!exSel.length)return h+card('<div class="empty-state"><p class="t-faint">Advance projects and define their programs in Phase 3 first.</p></div>');
var allArmed=exSel.every(function(i){return (trk[i]||{}).status==='killed'||(progArmed(i)&&!progOverdue(i))});
exSel.forEach(function(i){var idea=ideas[i],tr=trk[i]||{};var killed=tr.status==='killed';var armed=progArmed(i);
var rows=progOrdered(i);var nPh=rows.length,nDone=rows.filter(pdDoneRow).length,nRun=rows.filter(pdRunRow).length;
var needs=!killed&&(!bpHasDev(i)||!armed);
var k='re41_'+i;var open=UI.expanded[k]===undefined?needs:!!UI.expanded[k];
var head='<div class="flx-row-mb-12-clean xh" style="cursor:pointer" onclick="event.stopPropagation();UI.expanded[\''+k+'\']=!'+open+';render()"><div class="u-5d029f6"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="u-3a484c9"'+(killed?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+hzWarn(i,true)+(killed?badge('killed','#9B2D3F'):'')+(nPh?'<span class="t-faint-sm">'+nDone+' of '+nPh+' phases complete</span>':'')+'</div></div>';
var body='';
if(open){
var _dev=devCost(i),_sp=progSpentDone(i);
var stN=function(l,v,c){return'<div style="text-align:center;min-width:64px"><div style="font-size:20px;font-weight:700;color:'+(c||'var(--paper)')+'">'+v+'</div><div class="t-faint-sm" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase">'+l+'</div></div>'};
var stM=function(l,v,c){return'<div style="text-align:center;min-width:86px"><div style="font-size:15px;font-weight:700;line-height:26px;color:'+(c||'var(--paper)')+'">'+v+'</div><div class="t-faint-sm" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase">'+l+'</div></div>'};
var band=nPh?'<div style="display:flex;justify-content:space-between;align-items:stretch;flex-wrap:wrap;gap:14px;margin:0 0 12px"><div style="display:flex;gap:22px;background:rgba(79,179,154,.06);border:1px solid rgba(79,179,154,.25);border-radius:10px;padding:10px 18px">'+stN('Phases',nPh,'var(--paper)')+stN('Complete',nDone,'var(--ph1-t)')+stN('Running',nRun,'#D4A017')+'</div><div style="display:flex;gap:22px;background:rgba(212,160,23,.06);border:1px solid rgba(212,160,23,.28);border-radius:10px;padding:10px 18px">'+stM('Budget',fmtMoney(_dev),'#D4A017')+stM('Completed phases',fmtMoney(_sp),'var(--ph1-t)')+stM('Remaining',fmtMoney(Math.max(0,_dev-_sp)),'var(--paper)')+'</div></div>':'';
var armLine=(!killed&&bpHasDev(i)&&!armed)?'<p class="t-faint-sm" style="color:var(--warn-text);margin:0 0 8px">Next gate is not yet set \u2013 give it dates, an owner, and exit criteria (edit the phase below or at Step 3.4).</p>':'';
body='<div style="margin-top:12px">'+pausedNote(tr)+band+armLine
+progDash(i,killed)
+'<div class="gr-2">'+ta('Infrastructure learnings','trk_'+i+'_infraLearnings',tr.infraLearnings,'e.g. Decision rights working but budget reallocation too slow.',2)+ta('What\'s breaking / working','trk_'+i+'_breakWork',tr.breakWork,'e.g. Working: ownership model. Breaking: cross-functional requests.',2)+'</div>'
+(UI.expanded['kp'+i]===true?progKillPanel(i):'')
+(tr.status==='complete'&&!killed?'<div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(UI.expanded['lp'+i]?'<span class="t-faint-sm">Confirm below \u2193</span>':btn('Launch to Operational Portfolio \u2192','doLaunch('+i+')','bp','font-size:13px'))+'</div>'+(UI.expanded['lp'+i]?capLaunchPanel(i):''):'')
+'</div>'}
h+=card(head+body,'border-left:4px solid #9B2D3F;margin-bottom:16px'+(open?'':';cursor:pointer'),xpandAttr(k,open))});
h+=doneBtn('saveDone41()',!allArmed,'\u2713 Gates Current \u2014 Nothing Overdue',(data.completedSteps||{})['4.1'],'Record the gate decision for every phase that has ended, and give every upcoming gate an owner and exit criteria.');
return h}
function saveDone41(){if(!confirmStepDone('4.1'))return;var exSel=data.expSelected||[];if(!data.tracking)data.tracking={};exSel.forEach(function(i){if(!data.tracking[i])data.tracking[i]={};['status','results','infraLearnings','breakWork'].forEach(function(f){var e=$('trk_'+i+'_'+f);if(e)data.tracking[i][f]=e.value})});if(!data.completedSteps)data.completedSteps={};data.completedSteps['4.1']=true;stampStepDone('4.1');saveData();render()}

function renderStep42(){
var gov=data.governance||{};
var h=vp('V-4.2.1','Governance: Making Innovation Sustainable','3\u20135 min');
h+='<h2 class="h-section">Step 2: Establish Governance</h2><p class="t-lead">This step builds three structures that will keep the pipeline running once the 90-day program ends. A standing item on an existing leadership agenda keeps senior attention on pipeline health. A spending rule, backed by a periodic audit, routes any AI initiative above a set threshold into the pipeline. A quarterly review brings finance, operations, and technology together to judge the whole portfolio.</p>';
h+=card('<h3 class="h-sub">1. Standing Leadership Agenda</h3><p class="t-fade-lg">Pipeline health becomes a recurring item in a meeting that already exists, so attention survives the launch. Name the meeting, the metrics it reviews, and the format.</p>'+ta('Meeting to embed in *','gov_meeting',gov.meeting,'e.g. Weekly senior leadership meeting',1)+ta('Metrics to review','gov_metrics',gov.metrics,'e.g. Active experiments, pipeline throughput',2)+ta('Format','gov_format',gov.format,'e.g. 10-min standing item: dashboard review',2),'margin-bottom:16px');
h+=card('<h3 class="h-sub">2. Pipeline Intake Rule</h3><p class="t-fade-lg">Write the rule that routes AI decision making into the pipeline. Set a threshold. Any AI initiative above it enters the pipeline and passes its gates before money moves. Below the threshold, teams can experiment freely without process. Then set the audit that backs the rule. On a fixed schedule, sweep departmental spending, vendor contracts, and tool subscriptions for AI work running outside the pipeline. Record anything you find in the audit inventory at Step 1.1, then bring it into the budget through the Legacy Projects tab at Step 3.2.</p>'+ta('Investment threshold *','gov_threshold',gov.threshold,'e.g. Any investment above $5,000',1)+ta('Gate review process','gov_gateProcess',gov.gateProcess,'e.g. Pipeline owner + dept lead review against milestones.',3)+ta('Outside-pipeline audit','gov_outsideAudit',gov.outsideAudit,'e.g. Quarterly \u2014 pipeline owner sweeps departmental spend and vendor contracts',1),'margin-bottom:16px');
h+=card('<h3 class="h-sub">3. Quarterly Portfolio Review</h3><p class="t-fade-lg">Finance, operations, and technology review the whole portfolio together, on a set schedule, and make the Buy, Hold, or Sell decisions in one meeting. Name the attendees, the agenda, and the date of the first review. Step 4 of this phase runs that first review.</p>'+ta('Review attendees *','gov_reviewAttendees',gov.reviewAttendees,'e.g. CEO, CFO, CTO, Department Heads',2)+ta('Review agenda','gov_reviewAgenda',gov.reviewAgenda,'e.g. 1. Portfolio status (15min) 2. Buy/sell/hold decisions (30min)...',4)+ta('First review date','gov_firstReview',gov.firstReview,'e.g. End of Q2 2026',1));
h+=doneBtn('saveDone42()',!(gov.meeting&&gov.threshold&&gov.reviewAttendees),null,(data.completedSteps||{})['4.2'],'Name the meeting, the investment threshold, and the review attendees \u2013 the starred fields.');return h}
function saveDone42(){if(!confirmStepDone('4.2'))return;['meeting','metrics','format','threshold','gateProcess','outsideAudit','reviewAttendees','reviewAgenda','firstReview'].forEach(function(f){updObj('governance',f,val('gov_'+f))});if(!data.completedSteps)data.completedSteps={};data.completedSteps['4.2']=true;stampStepDone('4.2');saveData();render()}

function renderStep43(){
var stress=data.stress||{};
var h=vp('V-4.3.1','Stress-Testing: What Needs Tuning?','3\u20135 min');
h+='<h2 class="h-section">Step 3: Stress-Test Org Design</h2><p class="t-lead">In Phase 2 you reshaped the organization to support AI innovation, setting ownership, incentives, and a working rhythm. In this step you reassess those changes and judge how well they have actually performed.</p>';
[{k:'decisions',l:'Are decision rights working in practice?',ph:'e.g. Mostly \u2014 but budget reallocation still stuck.'},{k:'ownership',l:'Is the ownership model delivering?',ph:'e.g. Central owner working well. One embedded lead overwhelmed.'},{k:'incentives',l:'Are incentive changes shifting behavior?',ph:'e.g. Early signs in sales. Manufacturing still on old metrics.'},{k:'culture',l:'Is culture shifting or are old defaults reasserting?',ph:'e.g. Weekly rhythm helping. Still seeing \'not my job.\' '}].forEach(function(q){
h+=likert(q.l,'stress.'+q.k+'Score',stress[q.k+'Score'],'Not at all','Fully');
h+=ta('Details','str_'+q.k,stress[q.k],q.ph,2)});
h+='<div class="mb-4"><label class="form-label-md">What needs tuning? Top priorities for adjustment. *</label>';
var _tRows=Math.max(5,(stress.tuningList||[]).length);
for(var n=0;n<_tRows;n++){h+='<div class="flx-center gap-2 mb-2"><span class="u-c4e123e">'+(n+1)+'.</span><input id="tune_'+n+'" onchange="fldSave(this.id,this.value)" value="'+esc((stress.tuningList||[])[n])+'" placeholder="'+(n===0?'e.g. Add mid-cycle budget reallocation':n===1?'e.g. Split manufacturing embedded lead role':'(optional)')+'" class="u-f4d6077"/></div>'}
h+=btn('+ Add priority','addTunePriority()','bg2','font-size:12px;margin-top:2px');
h+='</div>'+doneBtn('saveDone43()',!((stress.tuningList||[]).some(function(t){return t})),null,(data.completedSteps||{})['4.3'],'List at least one tuning priority.');return h}
function addTunePriority(){if(lockBlocked('stress'))return;if(!data.stress)data.stress={};if(!data.stress.tuningList)data.stress.tuningList=[];var L=data.stress.tuningList;while(L.length<5)L.push('');L.push('');Store.commit('stress');render()}
function saveDone43(){if(!confirmStepDone('4.3'))return;['decisions','ownership','incentives','culture'].forEach(function(k){updObj('stress',k,val('str_'+k))});var list=[],_tn=0,_te;while((_te=$('tune_'+_tn))){list.push(_te.value);_tn++}updObj('stress','tuningList',list);if(!data.completedSteps)data.completedSteps={};data.completedSteps['4.3']=true;stampStepDone('4.3');saveData();render()}

function devPortBody(i){ /* the Development Portfolio card body, extracted July 7 so the review rows can embed the FULL live card (Paul) */
var ideas=data.ideas||[],exp=data.experiments||{},trk=data.tracking||{};
var e=exp[i]||{},idea=ideas[i],tr=trk[i]||{},killed=tr.status==='killed',pb=(data.portfolio||{})[i]||{},p=(data.projects||{})[i]||{};
return '<div style="margin-top:12px">'+ideaCardFold(i,'icoe')+'<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pcoe'+i+'\']=!UI.expanded[\'pcoe'+i+'\'];render()">'+(UI.expanded['pcoe'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pcoe'+i]?projCardRO(i):'')+'</div>'
+'<div class="gr-2" style="margin-bottom:10px">'+[['Objectives',p.objectives],['Deliverables',p.deliverables]].map(function(f){return '<div><div class="u-b25d981" style="margin-bottom:3px">'+f[0]+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">'+(f[1]?esc(f[1]):'<span class="t-faint">Not yet written at Step 3.4</span>')+'</div></div>'}).join('')+'</div>' /* 17 Sep 2026 (Paul's ruling): the program\u2019s objectives and deliverables from Step 3.4 on the card, read-only */
+'<div class="gr-2">'+devStatusSel(i,tr)+ta('Results to date','trk_'+i+'_results',tr.results,'',2)+'</div>'+pausedNote(tr)
+bpHeadlineBudget(i,e)
+progDash(i,killed)
+(UI.expanded['kp'+i]===true?progKillPanel(i):'')
+'<h4 class="h-mini">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>'
+'<div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(tr.status==='complete'?(UI.expanded['lp'+i]?'<span class="t-faint-sm">Confirm below \u2193</span>':btn('Launch to Operational Portfolio \u2192','doLaunch('+i+')','bp','font-size:13px')):'<span class="t-faint-sm">'+(killed?'Killed \u2013 change the status to revive it.':'Complete the terminal gate, or set status to Complete, to launch.')+'</span>')+archBtn(i)+'</div>'+(tr.status==='complete'&&UI.expanded['lp'+i]?capLaunchPanel(i):'')+'</div>'}
function opPortBody(i){ /* the Operational Portfolio card body, extracted July 7 – nested idea/project/development folds included */
var ideas=data.ideas||[],exp=data.experiments||{},trk=data.tracking||{};
var idea=ideas[i],e=exp[i]||{},tr=trk[i]||{},ops=((data.opsData||{})[i])||{},pb=(data.portfolio||{})[i]||{},opKilled=tr.status==='killed';
return '<p class="u-c3246db">'+esc(idea?idea.desc:'')+'</p>'
+ideaCardFold(i,'icoo')
+'<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pcoo'+i+'\']=!UI.expanded[\'pcoo'+i+'\'];render()">'+(UI.expanded['pcoo'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pcoo'+i]?projCardRO(i):'')+'</div>'
+'<div style="margin:0 0 12px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'xcoo'+i+'\']=!UI.expanded[\'xcoo'+i+'\'];render()">'+(UI.expanded['xcoo'+i]?'\u25be':'\u25b8')+' Development card</button>'+(UI.expanded['xcoo'+i]?'<div style="margin-top:8px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+devCardRO(i)+'</div>':'')+'</div>'
+'<div style="max-width:360px"><div class="soft-block" style="margin-bottom:10px"><div class="h-card-lg">OWNER</div><div class="u-e4e660d">'+esc(ops.owner||((progOrdered(i)[0]||{}).powner)||'\u2014')+'</div></div><div class="soft-block" style="margin-bottom:10px"><div class="h-card-lg">LAUNCH DATE</div><input type="date" id="ops_'+i+'_ld" value="'+esc(ops.launchDate||'')+'" onchange="updNested(\'opsData\','+i+',\'launchDate\',this.value,true)" onblur="deferRender()" class="u-6293484"/></div>'+bpHeadlineOps(i,ops)+'</div>'
+'<div class="soft-block" style="margin:2px 0 10px"><div class="h-card-lg">SUCCESS METRICS</div><div class="fs-13">'+esc(((data.projects||{})[i]||{}).metrics||'\u2014')+'</div></div>' /* 17 Sep 2026 (Paul's ruling): the project\u2019s own success metrics; the experiment field it read had no writer */+ta('Performance vs. success metric','ops_'+i+'_perf',ops.performance,'e.g. Quote turnaround averaging 3.5 hours (target: <4 hours) \u2713',2)+ta('Ongoing notes','ops_'+i+'_notes',ops.notes,'e.g. Week 3: Added 2 new product categories...',3)+'<h4 class="h-mini">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>'+'<p class="t-faint-sm" style="margin:6px 0 0">'+(opKilled?'Commitment released \u2013 wind-down costs belong in the kill & phase-out pot (Step 3.3).':(opFirstYear(i)?'Committed: development '+fmtMoney(devCost(i))+' + rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 sustainment '+fmtMoney(opsSustainCost(i))+'/yr from rollout\u2019s end':'Sustainment '+fmtMoney(opsSustainCost(i))+'/yr'))+'</p><div class="u-b95a4ce">'+(opKilled?'<button onclick="event.stopPropagation();reviveProject('+i+')" class="btn-ghost pad-chip-sm">\u21a9 Revive</button>':'')+archBtn(i,'Sunset')+'</div>'}
function expPortBody(i){ /* the Exploration Portfolio card body, extracted July 7 – the review rows embed the full live card (Paul: the principle extends to exploration) */
var ideas=data.ideas||[],proj=data.projects||{},port=data.portfolio||{},as=data.assessments||{};
var idea=ideas[i],p=proj[i]||{},pb=port[i]||{},a1=as[i]||{},rs=p.rescore||{},graded=!!(pb.horizon&&pb.risk&&pb.reward);
return '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardFold(i,'icox')+(p.viable===true?projCardRO(i):assessBlock(i))
+'<h4 class="h-mini">Re-score (deepened)</h4><p class="t-stone-snug">Blue-sky portfolio scores shown for reference. Enter fresh numbers now that the analysis is deeper. This becomes the working score. 10 is always the most favorable end of the scale.</p><div class="flx-g2-wrap">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(dd){var tv=(a1[dd.k]!=null?a1[dd.k]:'\u2014');var cur=(rs[dd.k]!=null?rs[dd.k]:'');return'<div><label class="t-faint-sm">'+dd.l+'</label><div class="t-faint-sm" style="opacity:.65">First Pass: '+tv+'</div><input type="number" min="0" max="10" id="prs_'+i+'_'+dd.k+'" value="'+cur+'" onchange="fldSave(this.id,this.value)" class="score-mini"/></div>'}).join('')+'</div><div style="margin-top:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><button id="prsBtn_'+i+'" onclick="confirmRescoreAt('+i+')"'+((p.rescoreDone||!rsComplete(rs))?' disabled':'')+' style="padding:8px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;background:'+(p.rescoreDone?'rgba(27,107,90,.25)':rsComplete(rs)?'#1B6B5A':'rgba(var(--fg-rgb),.08)')+';color:'+(p.rescoreDone?'var(--ref-accent)':rsComplete(rs)?'#fff':'var(--text-faint)')+';cursor:'+(rsComplete(rs)&&!p.rescoreDone?'pointer':'default')+'">'+(p.rescoreDone?'\u2713 Re-scored':'\u2713 Confirm Re-score')+'</button><span class="t-stone-snug"><span id="prsTotal_'+i+'">'+rsTotalHtml(i)+'</span></span></div>'
+'<h4 class="h-mini" style="margin-top:24px">Go / No Go <span class="t-faint-sm" style="font-weight:400">(required)</span></h4><div class="flx-g3"><div style="flex:1"><button onclick="setViableAt('+i+',true)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(p.viable===true?'2px solid #1B6B5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(p.viable===true?'#1B6B5A':'rgba(var(--fg-rgb),.03)')+';color:'+(p.viable===true?'#fff':'var(--stone)')+'">\u2713 Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(a Go can be graded below and advanced to Development)</p></div><div style="flex:1"><button onclick="setViableAt('+i+',false)" style="width:100%;padding:14px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone)">\u2717 No Go</button><p class="t-faint-sm" style="margin:6px 2px 0">(moves to Not Advancing below, where the reason is recorded)</p></div></div>'
+(p.viable===true?'<h4 class="h-mini" style="margin-top:24px">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>':'')
+'<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
+(function(){if(p.viable!==true)return'<span class="t-faint-sm">Issue a Go verdict to grade and advance.</span>';
if(!graded)return'<span class="t-faint-sm">Set all three grades to advance.</span>';
var capx=data.capital||{};var _brX=capBreaches([capAssumedExtra(i)]);
if(_brX.overCapMonth&&!String(capx.reallocation||'').trim()&&!String(capx.gapPlan||'').trim())return'<span class="t-faint-sm">Would cross cumulative capacity (Month '+_brX.overCapMonth+') \u2013 complete the funding plan at Step 3.3.</span>';
return btn('Advance to Development Portfolio \u2192','advanceWithGates('+i+')','bp','font-size:13px')})()
+archBtn(i)+'</div></div>'}
function reviewSnapshotCard(){var srs=orgMonthly();if(!srs)return'';
var ideas=data.ideas||[],proj=data.projects||{},cap=data.capital||{};
var sd='',lv='',ov='',sc='',ir='';
orgCommittedSet().forEach(function(e){if(e.sunk)return;var i=e.i;var sn=(proj[i]||{}).committedSnap;if(!sn||!sn.startDate)return;var cur=(proj[i]||{}).startDate||'';if(cur&&cur!==sn.startDate)sd+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">start date: committed at '+esc(sn.startDate)+', now says '+esc(cur)+'</span></div>'});
(data.launched||[]).forEach(function(i){var lc=((data.opsData||{})[i]||{}).launchConfirm;if(!lc)return;
if(lc.expectedFo&&lc.actualPm&&lc.expectedFo!==lc.actualPm){var d=lc.actualPm-lc.expectedFo;lv+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">launch: expected plan Month '+lc.expectedFo+', launched at '+lc.actualPm+' ('+Math.abs(d)+' month'+(Math.abs(d)>1?'s':'')+(d>0?' late':' early')+')</span></div>'}
else if(lc.note&&lc.note.indexOf('review decision')>=0)lv+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">'+esc(lc.note)+'</span></div>'});
var lastClose=0;(data.reviewCycles||[]).forEach(function(c){if(c&&c.at>lastClose)lastClose=c.at});
(cap.overrides||[]).forEach(function(o){ov+='<div class="row-line"><span class="fs-14" style="flex:1;color:var(--warn-text)">\u26a0 Override'+(o.at>lastClose?' (since last review)':'')+': '+esc(o.reason||'')+'</span><span class="t-faint-sm">month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+'</span></div>'});
var yt=orgYearTotals()||[];
yt.forEach(function(r){if(r.capPct>1)sc+='<div class="row-line"><span class="fs-14" style="flex:1;color:var(--warn-text)">\u26a0 Year '+r.y+' sustainment takes '+(r.budget?Math.round(r.sus/r.budget*100):0)+'% of the year\u2019s budget \u2013 over the '+r.scpY+'% cap.</span></div>';
if(r.reserve)ir+='<div class="row-line"><span class="fs-14">Year '+r.y+' intake reserve '+fmtMoney(r.reserve)+' <span class="t-faint-sm">\u00b7 Development committed in Year '+r.y+': '+fmtMoney(r.dev)+' \u2013 is intake keeping pace?</span></span></div>'});
var sec=function(t,rows){return rows?'<div class="h-card-lg" style="margin:10px 0 4px">'+t+'</div>'+rows:''}; /* 17 Sep 2026 (Paul's ruling): only the sections with content print */
var body=sec('Start Date Drift',sd)+sec('Launch Variance',lv)+sec('Overrides',ov)+sec('Sustainment Cap',sc)+sec('Intake Reserve',ir);
return card('<h3 class="h-sub-lg">Review Snapshot</h3>'+(body||'<p class="t-faint-sm" style="margin:2px 0 6px">Nothing to report since the last commitment.</p>'),'margin-bottom:16px')}
function renderReviewSurface(){ /* shared review machinery – mounted at 4.4 (first review, teaching frame) and natively in Navigate (every review thereafter). One surface, one state: a decision recorded on either page is the same decision. (Paul, July 7) */
var ideas=data.ideas||[],as=data.assessments||{},exSel=data.expSelected||[],trk=data.tracking||{},rev=data.review||{},port44=data.portfolio||{};
var allItems=exSel.filter(function(i){return!isArchived(i)}).concat((data.launched||[]).filter(function(i){return!isArchived(i)&&exSel.indexOf(i)<0})).concat((data.selected||[]).filter(function(i){return!isArchived(i)&&exSel.indexOf(i)<0&&(data.launched||[]).indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true})); /* pipeline rows restored (Paul, July 7) – the Buy path pulls them forward at close */
var allDecided=allItems.every(function(i){return((rev.items||{})[i]||{}).decision});
var h='';
var av44=capLens().tot;var buyPend=0;
Object.keys((rev.items||{})).forEach(function(k){if((rev.items[k]||{}).decision!=='buy')return;var ki=parseInt(k,10);var inD=exSel.indexOf(ki)>=0||(data.launched||[]).indexOf(ki)>=0;if(!inD)buyPend+=capProjectWindow(ki,null).inW});
h+='<p class="t-faint-sm" style="margin:-6px 0 10px">'+fyToday()+'. '+nextReviewLine()+'</p>';
var _fyc=(data.capital||{});h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-2px 0 12px"><span class="t-faint-sm">If you wish to align future reviews to your fiscal year, select the appropriate month here.</span><select class="sel-helper" style="width:auto;padding:6px 10px;font-size:13px" onchange="fldSave(\'cap_fyStartMonth\',this.value)"><option value=""'+(!(parseInt(_fyc.fyStartMonth,10)>=1)?' selected':'')+'>Same as planning period</option>'+['January','February','March','April','May','June','July','August','September','October','November','December'].map(function(mn,mi){return'<option value="'+(mi+1)+'"'+(parseInt(_fyc.fyStartMonth,10)===mi+1?' selected':'')+'>FY begins '+mn+'</option>'}).join('')+'</select></div>';
var _eff=new Date(new Date().getFullYear(),new Date().getMonth()+1,1);var _qiN=fyQuarterOf(_eff);
var _moN=(_qiN.endEx.getFullYear()*12+_qiN.endEx.getMonth())-(_eff.getFullYear()*12+_eff.getMonth());
var _np=capPeriod(_eff,_qiN.endEx);var _npBuyStart=0,_npBuyRun=0;
Object.keys((rev.items||{})).forEach(function(k){if((rev.items[k]||{}).decision!=='buy')return;var ki=parseInt(k,10);var inD=exSel.indexOf(ki)>=0;var inL=(data.launched||[]).indexOf(ki)>=0;var c=projCosts(ki);
if(!inD&&!inL)_npBuyStart+=c.start;else if(inD&&!inL)_npBuyRun+=Math.round(c.run/12*_moN)});
var _npTotal=_np.total+_npBuyStart+_npBuyRun;
var _ps44=(data.capital||{}).periodStart?new Date((data.capital||{}).periodStart):null;
var _yN44=_ps44?Math.max(1,Math.min(envYearsOf(),Math.floor(((_eff.getFullYear()*12+_eff.getMonth())-(_ps44.getFullYear()*12+_ps44.getMonth()))/12)+1)):1;
var _yts44=orgYearTotals();var _yr44=_yts44&&_yts44[_yN44-1]?_yts44[_yN44-1]:null;
var _npEnd=new Date(_qiN.endEx.getFullYear(),_qiN.endEx.getMonth(),_qiN.endEx.getDate()-1);
h+=card('<div class="t-faint-sm" style="margin-bottom:4px">NEXT PERIOD \u2013 '+fmtDate(_eff)+' to '+fmtDate(_npEnd)+' ('+_moN+' month'+(_moN>1?'s':'')+(_moN!==3?', stub':'')+') \u00b7 assumes this review closes this month</div><p class="t-faint-sm" style="margin:4px 0 0">Quarters count from your planning-period start (Step 3.2), not the calendar or fiscal year.</p><div style="display:flex;gap:14px;flex-wrap:wrap"><div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md">'+fmtMoney(_npTotal)+'</div><div class="t-fade-md">Committed consumption, this period</div></div>'+(_yr44?'<div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md">'+fmtMoney(_yr44.total)+' of '+fmtMoney(_yr44.budget)+'</div><div class="t-fade-md">Committed, Year '+_yN44+'</div></div><div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md" style="color:'+(_yr44.headroom<0?'#9B2D3F':'#1B6B5A')+'">'+fmtMoney(_yr44.headroom)+'</div><div class="t-fade-md">Headroom, Year '+_yN44+(_yr44.reserve?' \u00b7 '+fmtMoney(_yr44.headroom-_yr44.reserve)+' net of reserve':'')+'</div></div>':'')+'</div><div style="height:8px;background:rgba(var(--fg-rgb),.06);border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:'+Math.min(100,(_yr44&&_yr44.budget?_yr44.total/_yr44.budget*100:0)).toFixed(1)+'%;background:'+(_yr44&&_yr44.budget&&_yr44.total>_yr44.budget?'#D4A017':'#45A188')+'"></div></div>'+((_npBuyStart||_npBuyRun)?'<p class="t-faint-sm" style="margin-top:6px">Includes pending Buys: '+(_npBuyStart?'startups '+fmtMoney(_npBuyStart):'')+(_npBuyStart&&_npBuyRun?' \u00b7 ':'')+(_npBuyRun?'running '+fmtMoney(_npBuyRun):'')+'.</p>':'')+'<div style="border-top:1px solid rgba(var(--fg-rgb),.1);margin:10px 0"></div><div class="t-faint-sm" style="margin-bottom:4px">ANNUAL ENVELOPE</div>'+capCells(false)+'<p class="t-faint-sm" style="margin-top:8px">Live figures: a Sell releases its commitment immediately; a Buy on an Exploration project commits its full plan when the review closes'+(buyPend?' \u2013 pending Buys will commit <strong>'+fmtMoney(buyPend)+'</strong>, leaving <strong'+(av44.available-buyPend<0?' style="color:#9B2D3F"':'')+'>'+fmtMoney(av44.available-buyPend)+'</strong>':'')+'.'+(av44.killPot?' The kill & phase-out pot ('+fmtMoney(av44.killPot)+', set at Step 3.3) is held out of Available.':'')+'</p>','margin-bottom:16px');
h+=reviewSnapshotCard();
h+=fiscalHelpBox('44','review');
var cyc=data.reviewCycles||[];var openH=!!UI.expanded.revHist;
h+='<div class="mb-4" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+(Object.keys((rev.items||{})).length?btn('\u21bb Close Review & Start New Cycle','closeReviewCycle()','bp','font-size:14px;padding:12px 22px'):'')+(cyc.length?'<button class="btn-ghost pad-chip-sm" onclick="UI.expanded.revHist=!UI.expanded.revHist;render()">'+(openH?'\u25be':'\u25b8')+' Review History ('+cyc.length+')</button>':'')+'</div>';
if(openH&&cyc.length){h+=card(cyc.slice().reverse().map(function(c){var it=c.review.items||{};var b=0,s=0,ho=0;Object.keys(it).forEach(function(k){var d=it[k].decision;if(d==='buy')b++;else if(d==='sell')s++;else if(d==='hold')ho++});return'<div style="padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><strong>'+fmtDate(c.at)+'</strong> <span class="t-faint-sm">('+fmtQuarter(fyQuarterOf(new Date(c.at)))+')</span> \u2013 '+b+' Scale \u00b7 '+ho+' Hold \u00b7 '+s+' Kill'+(c.review.nextCycle?'<div class="t-faint-sm" style="margin-top:4px">Next cycle: '+esc(c.review.nextCycle)+'</div>':'')+'</div>'}).join(''),'margin-bottom:16px')}
h+=card('<h3 class="h-sub-lg">Buy / Sell / Hold Analysis <span class="t-faint-sm" style="font-weight:400">(required)</span></h3>'+allItems.map(function(i){var idea=ideas[i],tr=trk[i]||{},ri=(rev.items||{})[i]||{};var _in44=exSel.indexOf(i)>=0,_op44=(data.launched||[]).indexOf(i)>=0,_dev44=_in44||_op44;var _pb44=(data.portfolio||{})[i]||{};var _ug44=!_dev44&&!(_pb44.horizon&&_pb44.risk&&_pb44.reward);var _ng44=!_dev44&&!_ug44&&(function(){var cx=data.capital||{},bx=capBreaches([capAssumedExtra(i)]);return !!(bx.overCapMonth&&!String(cx.reallocation||'').trim()&&!String(cx.gapPlan||'').trim())})(); /* exploration Buy gates on the ADVANCE criteria – portfolio position + capacity/funding plan – never on 3.4 contracts, which exploration items cannot have (Paul, July 7) */var _c44=projCosts(i);
return'<div style="padding:16px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;margin-bottom:12px;background:'+(ri.decision==='buy'?'rgba(27,107,90,.06)':ri.decision==='sell'?'rgba(155,45,63,.06)':'rgba(var(--fg-rgb),.03)')+'"><div class="flx-row-mb xh" style="cursor:pointer" onclick="event.stopPropagation();UI.expanded[\'rv'+i+'\']=!UI.expanded[\'rv'+i+'\'];render()"><span style="color:var(--stone);font-size:15px">'+(UI.expanded['rv'+i]?'\u25be':'\u25b8')+'</span><h4 class="h-card"'+(tr.status==='killed'?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+hzWarn(i,true)+(tr.status==='killed'?badge('Killed','#9B2D3F'):_op44?badge('Operational','#1B6B5A'):_in44?badge('In development','#2D5A8E'):badge('Exploration','rgba(var(--faint-rgb),.5)'))+'</div>'+(UI.expanded['rv'+i]?'<p class="t-faint-sm" style="margin:-4px 0 8px">startup '+fmtMoney(_c44.start)+' \u00b7 run '+fmtMoney(_c44.run)+'/yr</p>'+(tr.results?'<p class="u-8c47e14">'+esc(tr.results.slice(0,150))+'</p>':'')+'<div style="margin:6px 0 10px">'+(_op44?opPortBody(i):_in44?devPortBody(i):expPortBody(i))+'</div>':'')+'<div class="flx-g2">'+[{v:'buy',l:'↗ Buy (Scale)',c:'#1B6B5A'},{v:'hold',l:'|| Hold (Maintain)',c:'#8B5E3C'},{v:'sell',l:'○ Sell (Kill)',c:'#9B2D3F'}].map(function(d){if(d.v==='sell'&&tr.status==='killed'){return'<button onclick="reviveReviewItem('+i+')" style="flex:1;padding:10px 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:2px solid #1B6B5A;background:rgba(27,107,90,.09);color:#1B6B5A">\u21a9 Revive</button>'}var kd=(d.v==='buy'&&tr.status==='killed');var gd=(d.v==='buy'&&_ug44);var ng=(d.v==='buy'&&!_ug44&&_ng44);return'<button '+((kd||gd||ng)?'disabled ':'')+(gd?'title="Grade horizon \u00b7 risk \u00b7 reward at Step 3.1 before scaling" ':ng?'title="Advancing would cross capacity \u2013 complete the funding plan at Step 3.3 before scaling" ':'')+'onclick="setReviewDecision('+i+',\''+d.v+'\')" style="flex:1;padding:10px 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(ri.decision===d.v?'2px solid '+d.c:'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(ri.decision===d.v?d.c+'18':'rgba(var(--fg-rgb),.03)')+';color:'+(ri.decision===d.v?d.c:'rgba(var(--faint-rgb),.7)')+((kd||gd||ng)?';opacity:.35;cursor:not-allowed':'')+'">'+d.l+'</button>'}).join('')+'</div>'+(ri.decision?ta('Rationale','rev_'+i+'_rationale',ri.rationale,'Why this decision?',2):'')+'</div>'}).join(''));
var balItems=allItems.filter(function(i){return(trk[i]||{}).status!=='killed'});
if(balItems.length){
h+=card('<h3 class="h-sub-lg">Portfolio Balance</h3><p class="t-faint-sm" style="margin-bottom:10px">The live mix across horizon, risk, and reward. Re-grade initiatives that are operational or in development to take account of the most recent evidence.</p>'+balancePanel(balItems,'rb44'),'margin-bottom:12px');
balItems.forEach(function(i){var pb=port44[i]||{},p=(data.projects||{})[i]||{};var open=!!UI.expanded['rb'+i];
var head='<div class="flx-between xh" onclick="event.stopPropagation();UI.expanded[\'rb'+i+'\']=!UI.expanded[\'rb'+i+'\'];render()" style="cursor:pointer"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="margin:0">'+esc((ideas[i]||{}).name)+'</h4>'+((data.launched||[]).indexOf(i)>=0?badge('Operational','#1B6B5A'):(data.expSelected||[]).indexOf(i)>=0?badge('In development','#2D5A8E'):badge('Exploration','rgba(var(--faint-rgb),.5)'))+badge(({quick:'Quick win',medium:'Medium-term bet',long:'Long-term bet'}[pb.horizon])||'not yet positioned','#8B5E3C')+badge('Risk: '+(pb.risk||'\u2014'),'#2D5A8E')+badge('Reward: '+(pb.reward||'\u2014'),'#1B6B5A')+'</div><div class="w-min-50"><div class="score-num-md">'+getScore(i)+'</div><div class="t-faint-sm">/50</div></div></div>';
var body='';
if(open){body='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+'<h4 class="h-mini">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>'
+'<div class="t-faint-sm" style="margin:10px 0 4px">POST-EXPERIMENT RE-SCORE (third measurement)</div><div class="flx-g2-wrap">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(dd){var prev=(p.rescore&&p.rescoreDone&&p.rescore[dd.k]!=null)?p.rescore[dd.k]:(((as[i]||{})[dd.k]!=null)?as[i][dd.k]:'\u2014');var cur=(p.rescore3&&p.rescore3[dd.k]!=null)?p.rescore3[dd.k]:'';return'<div><label class="t-faint-sm">'+dd.l+'</label><div class="t-faint-sm" style="opacity:.65">Prev: '+prev+'</div><input type="number" min="0" max="10" id="pr3_'+i+'_'+dd.k+'" value="'+cur+'" onchange="fldSave(this.id,this.value)" class="score-mini"/></div>'}).join('')+'</div><div style="margin-top:8px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><button id="pr3Btn_'+i+'" onclick="confirmRescore3At('+i+')"'+((p.rescore3Done||!rsComplete(p.rescore3||{}))?' disabled':'')+' style="padding:8px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;background:'+(p.rescore3Done?'rgba(27,107,90,.25)':rsComplete(p.rescore3||{})?'#1B6B5A':'rgba(var(--fg-rgb),.08)')+';color:'+(p.rescore3Done?'var(--ref-accent)':rsComplete(p.rescore3||{})?'#fff':'var(--text-faint)')+';cursor:'+(rsComplete(p.rescore3||{})&&!p.rescore3Done?'pointer':'default')+'">'+(p.rescore3Done?'\u2713 Re-scored':'\u2713 Confirm Post-experiment Score')+'</button><span class="t-stone-snug"><span id="pr3Total_'+i+'">'+rs3TotalHtml(i)+'</span></span></div></div>'}
h+=card(head+body,'margin-bottom:10px;border-left:4px solid #6B4C8A'+(open?'':';cursor:pointer'),xpandAttr('rb'+i,open))})}
h+=card('<h3 class="h-sub-lg">Portfolio Learnings</h3>'+ta('New opportunities','rev_newOpportunities',rev.newOpportunities,'e.g. 1. AI-assisted inventory forecasting...',3)+ta('Balance assessment','rev_balance',rev.balance,'e.g. Heavy on quick wins, need more medium-term...',2)+ta('What worked?','rev_worked',rev.worked,'e.g. The weekly rhythm survived contact with the operating business.',2)+ta('What didn\'t?','rev_didnt',rev.didnt,'e.g. Gate reviews slipped when the owner traveled.',2)+ta('Changes for next cycle?','rev_nextCycle',rev.nextCycle,'e.g. Deputy named for gate reviews. Reallocation window added mid-quarter.',2),'margin-bottom:16px');
return h}
function renderStep44(){
var ideas=data.ideas||[],as=data.assessments||{},exSel=data.expSelected||[],trk=data.tracking||{},rev=data.review||{},port44=data.portfolio||{};
var allItems=exSel.filter(function(i){return!isArchived(i)}).concat((data.selected||[]).filter(function(i){return!isArchived(i)&&exSel.indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true}));
var allDecided=allItems.every(function(i){return((rev.items||{})[i]||{}).decision});
var h=vp('V-4.4.1','Portfolio Review','3\u20135 min');
h+='<h2 class="h-section">Step 4: Quarterly Portfolio Review</h2><p class="t-lead">You scheduled this review at Step 2. Now you run it for the first time. Work through every live initiative and make a Buy, Hold, or Sell call, recording the reason for each decision. Choosing a decision opens a rationale box beneath its row. Re-position each project using the evidence the quarter produced. Then refill the portfolio by pulling the next set of ideas forward through the pipeline. Closing the review commits the money for every Buy, releases the money from every Sell, and starts the next quarter\u2019s cycle.</p>';
h+=renderReviewSurface();
h+=doneBtn('saveDone44()',!allDecided,'\u2713 First Review Complete \u2014 The Engine is Running',(data.completedSteps||{})['4.4'],'Decide Buy, Sell, or Hold for every initiative first.');
if((data.completedSteps||{})['4.4'])h+=card('<div class="flx-center gap-2 mb-2"><span class="u-b5ef888">★</span><h3 class="u-405c475">90-Day Ignition Complete</h3></div><p class="u-4f56591">You have a functioning innovation pipeline. The 90 days were the ignition. The engine is now running.</p>','margin-top:24px;border:2px solid #9B2D3F;background:rgba(155,45,63,.06)');
return h}
function closeReviewCycle(){if(!confirm('Close this quarterly review and start a new cycle? Scale decisions become launches; the closed review moves to history.'))return;
var rev=data.review||{};if(!data.launched)data.launched=[];
Object.keys(rev.items||{}).forEach(function(k){if(rev.items[k].decision!=='buy')return;var bi=parseInt(k,10);
var inDev=(data.expSelected||[]).indexOf(bi)>=0||data.launched.indexOf(bi)>=0;
if(inDev){if(data.launched.indexOf(bi)<0){data.launched.push(bi);if(!data.opsData)data.opsData={};if(!data.opsData[bi])data.opsData[bi]={};if(!data.opsData[bi].launchConfirm)data.opsData[bi].launchConfirm={at:Date.now(),by:'',note:'Launched by quarterly review decision'}}}
else{var pb=(data.portfolio||{})[bi]||{};if(((data.projects||{})[bi]||{}).viable===true&&pb.horizon&&pb.risk&&pb.reward){if(!data.expSelected)data.expSelected=[];if(data.expSelected.indexOf(bi)<0){data.expSelected.push(bi);if(!data.projects[bi])data.projects[bi]={};data.projects[bi].advancedAt=Date.now()}}}});
if(!data.reviewCycles)data.reviewCycles=[];data.reviewCycles.push({at:Date.now(),review:JSON.parse(JSON.stringify(rev))});
data.review={items:{}};data.capStale=true;Store.commit('review');Store.commit('capStale');render()}
function setReviewDecision(i,d){if(lockBlocked('review')||lockBlocked('tracking::'+i))return;if(!data.review)data.review={};if(!data.review.items)data.review.items={};if(!data.review.items[i])data.review.items[i]={};
if(data.review.items[i].decision===d){delete data.review.items[i].decision; /* clicking the active decision unclicks it (Paul, July 7) */
if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};
if(d==='sell'&&data.tracking[i].status==='killed'){data.tracking[i].status='';if(data.tracking[i].killSunkIds)delete data.tracking[i].killSunkIds;data.capStale=true}
saveData();render();return}
if(d==='sell'&&(data.expSelected||[]).indexOf(i)>=0&&(data.launched||[]).indexOf(i)<0&&(((data.tracking||{})[i])||{}).status!=='killed'){UI.expanded['rv'+i]=true;UI.expanded['kp'+i]=true;UI.reviewSellPending=i;render();return} /* dev items get the kill confirm panel – parity with the portfolio (Paul, July 7); the decision records on confirm */
data.review.items[i].decision=d;if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};if(d==='sell'){data.tracking[i].status='killed';stampKill(i);data.capStale=true}else if(data.tracking[i].status==='killed'){data.tracking[i].status='';if(data.tracking[i].killSunkIds)delete data.tracking[i].killSunkIds}saveData();render()}
function reviveReviewItem(i){if(lockBlocked('review')||lockBlocked('tracking::'+i))return;if(!data.review)data.review={};if(!data.review.items)data.review.items={};if(!data.review.items[i])data.review.items[i]={};if(data.review.items[i].decision==='sell')delete data.review.items[i].decision;/* Revive replaces Sell on killed projects (Paul, July 10) */if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};if(data.tracking[i].status==='killed'){data.tracking[i].status='';if(data.tracking[i].killSunkIds)delete data.tracking[i].killSunkIds;data.capStale=true}saveData();render()}
function saveDone44(){if(!confirmStepDone('4.4'))return;if(!data.review)data.review={};if(!Collab.lockedByOther('review'))['newOpportunities','balance','worked','didnt','nextCycle'].forEach(function(f){var e=$('rev_'+f);if(e)data.review[f]=e.value});if(!data.review.items)data.review.items={};var allItems=(data.expSelected||[]).concat((data.launched||[]).filter(function(i){return(data.expSelected||[]).indexOf(i)<0})).concat((data.selected||[]).filter(function(i){return(data.expSelected||[]).indexOf(i)<0&&(data.launched||[]).indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true}));allItems.forEach(function(i){if(!data.review.items[i])data.review.items[i]={};var e=$('rev_'+i+'_rationale');if(e)data.review.items[i].rationale=e.value});if(!data.completedSteps)data.completedSteps={};data.completedSteps['4.4']=true;stampStepDone('4.4');saveData();render()}
// === PHASE 5: NAVIGATE DASHBOARD ===
function parseBudget(v){if(typeof v!=='string')return 0;var m=v.replace(/,/g,'').match(/(\d+(?:\.\d+)?)\s*([kKmM])?/);if(!m)return 0;var n=parseFloat(m[1]);if(m[2]==='k'||m[2]==='K')n*=1000;if(m[2]==='m'||m[2]==='M')n*=1000000;return n}
function fmtMoney(n){if(!n)return'$0';if(n<0)return'\u2212'+fmtMoney(-n); /* 17 Sep 2026 (found on the sandbox printout): a negative amount reads as a minus and the formatted figure, not the raw number */
return n>=1000000?'$'+(n/1000000).toFixed(n%1000000?1:0)+'M':n>=1000?'$'+Math.round(n/1000)+'K':'$'+Math.round(n)}
function saveCapFields(){if(!data.capital)data.capital={};['budgeted','reallocation','gapPlan'].forEach(function(f){var e=$('cap_'+f);if(e)data.capital[f]=e.value});Store.commit('capital');render()}
/* Capital Analytics (chunk 4): the projection's face. Three derived views – stacked
   category bars per year against the envelope, the sustainment crowding-out share, and
   Faisal's phase-timeline strips (per-project month ranges; display only). */
function orgYearTotals(extras){var srs=orgMonthly(extras);if(!srs)return null;var cap=data.capital||{};var n=envYearsOf(),out=[];
for(var y=1;y<=n;y++){var scpY=susCapOf(y);var dev=0,roll=0,sus=0;for(var m=(y-1)*12;m<y*12;m++){dev+=srs[m].dev;roll+=srs[m].roll;sus+=srs[m].sus}
dev=Math.round(dev);roll=Math.round(roll);sus=Math.round(sus);var tot=dev+roll+sus;var bud=envBudgetYear(y);var res=envReserveYear(y);
out.push({y:y,budget:bud,budgetSet:(y===1?!!String(cap.aiBudget||'').trim():!!String(cap['budgetY'+y]||'').trim()),dev:dev,roll:roll,sus:sus,total:tot,headroom:bud-tot,reserve:res,susShare:tot?sus/tot:0,scpY:scpY,capPct:(scpY>0&&bud)?sus/(bud*scpY/100):0})}
return out}
function orgWaterfallChart(extras){var srs=orgMonthly(extras);if(!srs)return'';var M=srs.length;var CD='#45A188',CR='#5B8DD9',CS='#C25B73';
var hasX=!!(extras&&extras.length);var baseS=hasX?orgMonthly():srs;
var XPAL=['#D4A017','#8A63B8','#2E9C7C','#C87A3B','#7FA8D9','#B84A6E'];
var _goAll=hasX?getStages().explore.filter(function(q){return((data.projects||{})[q]||{}).viable===true}):[];
var xs=hasX?extras.map(function(e){var _r=_goAll.indexOf(e.i);return{i:e.i,c:XPAL[(_r>=0?_r:e.i)%XPAL.length],ser:orgProjectMonthly(e.i,false,M,e.anchor)}}):[];
var mx=0;srs.forEach(function(r){mx=Math.max(mx,r.dev+r.roll+r.sus,capSusCapLine(r.m))});if(!mx)return'<p class="t-faint-sm">Nothing committed yet \u2013 the first batch draws the first bars.</p>';
var W=720,Hh=190,pad=28,bw=(W-pad*2)/M,base=Hh-24;var sy=function(v){return (Hh-52)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
srs.forEach(function(r,ix){var b=hasX?baseS[ix]:r;var x=pad+ix*bw+bw*.15,w=Math.max(1,bw*.7);var yD=sy(b.dev),yR=sy(b.roll),yS=sy(b.sus);var yy=base;
if(b.sus>0){yy-=yS;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yS.toFixed(1)+'" fill="'+CS+'"><title>Month '+r.m+' sustainment '+fmtMoney(Math.round(b.sus))+'</title></rect>'}
if(b.roll>0){yy-=yR;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yR.toFixed(1)+'" fill="'+CR+'"><title>Month '+r.m+' rollout '+fmtMoney(Math.round(b.roll))+'</title></rect>'}
if(b.dev>0){yy-=yD;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yD.toFixed(1)+'" fill="'+CD+'"><title>Month '+r.m+' development '+fmtMoney(Math.round(b.dev))+'</title></rect>'}
if(hasX){xs.forEach(function(cx){var sr=cx.ser[ix];var t9=sr.dev+sr.roll+sr.sus;if(t9>0){var yT=sy(t9);yy-=yT;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(1,yT).toFixed(1)+'" fill="'+cx.c+'" opacity=".85"><title>'+esc(((data.ideas||[])[cx.i]||{}).name||('Item '+cx.i))+' \u2013 '+fmtMoney(Math.round(t9))+' this month (batch)</title></rect>'}})}});
var capCapPts='';
for(var m=1;m<=M;m++){var x1=pad+(m-1)*bw,x2=pad+m*bw;
var sc=capSusCapLine(m);if(sc>0){var cy2=base-sy(sc);capCapPts+=(capCapPts===''?'M':'L')+x1.toFixed(1)+' '+cy2.toFixed(1)+'L'+x2.toFixed(1)+' '+cy2.toFixed(1)}}
if(capCapPts)h+='<path d="'+capCapPts+'" fill="none" stroke="#D4A017" stroke-width="1.5" stroke-dasharray="4,3" opacity=".8"><title>Sustainment cap</title></path>';
for(var t=6;t<=M;t+=6)h+='<text x="'+(pad+(t-.5)*bw).toFixed(1)+'" y="'+(Hh-10)+'" text-anchor="middle" font-size="9" fill="#8A8278">'+t+'</text>';
h+='</svg>';
h+='<div class="t-faint-sm" style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:'+CD+';border-radius:2px;margin-right:4px"></span>Development <span style="display:inline-block;width:10px;height:10px;background:'+CR+';border-radius:2px;margin:0 4px 0 12px"></span>Rollout <span style="display:inline-block;width:10px;height:10px;background:'+CS+';border-radius:2px;margin:0 4px 0 12px"></span>Sustainment'+(capSusCapLine(1)>0?'<br/><span style="display:inline-block;width:18px;border-top:2px dashed var(--warn-text);margin:0 4px 0 2px;vertical-align:middle"></span> The dashed line is the sustainment cap \u2013 the run-cost ceiling for the year, at its monthly rate':'')+(hasX?'<br/>Batch: '+xs.map(function(cx){return'<span style="display:inline-block;width:10px;height:10px;background:'+cx.c+';border-radius:2px;margin:0 4px 0 10px"></span>'+esc(((data.ideas||[])[cx.i]||{}).name||('Item '+cx.i))}).join(''):'')+'</div>';
return h}
function orgCumChart(extras){var srs=orgMonthly(extras);if(!srs)return'';var M=srs.length;
var srsCt=orgMonthly(extras,true);
var cum=0,cumCap=0,cumCt=0,pts=[],cpts=[],ctpts=[],mx=0;
for(var m=1;m<=M;m++){cum+=srs[m-1].dev+srs[m-1].roll+srs[m-1].sus;cumCt+=srsCt[m-1].dev+srsCt[m-1].roll+srsCt[m-1].sus;cumCap+=capMonthlyLine(m);pts.push(cum);ctpts.push(cumCt);cpts.push(cumCap);mx=Math.max(mx,cum,cumCt,cumCap)}
if(!mx)return'';
var _brAll=capBreaches(extras);var br=_brAll.overCapMonth,ctBr=_brAll.ctOverCapMonth;var ctAny=cumCt>cum+0.5;
var W=720,Hh=180,pad=28,bw=(W-pad*2)/M,base=Hh-24;var sy=function(v){return base-(Hh-50)*(v/mx)};
var area='M'+pad+' '+base,line='';
for(var m2=1;m2<=M;m2++){var x=pad+(m2-.5)*bw;area+='L'+x.toFixed(1)+' '+sy(pts[m2-1]).toFixed(1);line+=(m2===1?'M':'L')+x.toFixed(1)+' '+sy(cpts[m2-1]).toFixed(1)}
area+='L'+(pad+(M-.5)*bw).toFixed(1)+' '+base+'Z';
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<path d="'+area+'" fill="rgba(69,161,136,.28)" stroke="#45A188" stroke-width="1.5"><title>Cumulative committed</title></path>';
h+='<path d="'+line+'" fill="none" stroke="#F5F2EC" stroke-width="1.5" opacity=".8" stroke-dasharray="2,3"><title>Cumulative capacity</title></path>';
if(ctAny){var ctline='';for(var m4=1;m4<=M;m4++){var x4=pad+(m4-.5)*bw;ctline+=(m4===1?'M':'L')+x4.toFixed(1)+' '+sy(ctpts[m4-1]).toFixed(1)}
h+='<path d="'+ctline+'" fill="none" stroke="#E8D48B" stroke-width="1.5" stroke-dasharray="4,3" opacity=".85"><title>Cumulative committed with each project\u2019s stated contingency</title></path>';
if(ctBr&&ctBr!==br){var cbx=pad+(ctBr-.5)*bw,cby=sy(ctpts[ctBr-1]);var cblx=Math.max(pad+78,Math.min(W-78,cbx)),cbly=Math.min(base-4,cby+16);h+='<circle cx="'+cbx.toFixed(1)+'" cy="'+cby.toFixed(1)+'" r="4" fill="#E8D48B"/><text x="'+cblx.toFixed(1)+'" y="'+cbly.toFixed(1)+'" text-anchor="middle" font-size="10" fill="#E8D48B">with contingencies \u2013 month '+ctBr+'</text>'}}
if(br){var bx=pad+(br-.5)*bw,by=sy(pts[br-1]);var blx=Math.max(pad+70,Math.min(W-70,bx)),bly=Math.max(12,by-8);h+='<circle cx="'+bx.toFixed(1)+'" cy="'+by.toFixed(1)+'" r="4" fill="'+'#D4A017'+'"/><text x="'+blx.toFixed(1)+'" y="'+bly.toFixed(1)+'" text-anchor="middle" font-size="10" fill="#D4A017">crosses capacity \u2013 month '+br+'</text>'}
for(var t=6;t<=M;t+=6)h+='<text x="'+(pad+(t-.5)*bw).toFixed(1)+'" y="'+(Hh-8)+'" text-anchor="middle" font-size="9" fill="#8A8278">'+t+'</text>';
h+='</svg>';
h+='<div class="t-faint-sm" style="margin-top:6px">Cumulative committed against cumulative capacity.'+(ctAny?' The pale dashed curve adds each project\u2019s stated contingency.':'')+'</div>';
return h}
function orgSwimlanes(extras){if(!orgMonthly())return'';var M=envYearsOf()*12;var ideas=data.ideas||[];
var set=orgCommittedSet().filter(function(e){return !e.sunk}).map(function(e){return{i:e.i,op:e.op,hyp:false}});(extras||[]).forEach(function(e){set.push({i:e.i,op:false,hyp:true,anchor:e.anchor})});
if(!set.length)return'';
var lanes=[];set.forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,e.hyp?e.anchor:null);var segs=[];['dev','roll','sus'].forEach(function(k){var st=0;for(var m=1;m<=M+1;m++){var on=m<=M&&s2[m-1][k]>0.5;if(on&&!st)st=m;if(!on&&st){segs.push({k:k,a:st,b:m-1});st=0}}});if(segs.length){var _rE=0,_sA=0;segs.forEach(function(g){if(g.k==='roll')_rE=Math.max(_rE,g.b);if(g.k==='sus')_sA=_sA?Math.min(_sA,g.a):g.a});
var _br=(_rE&&_sA&&_sA>_rE+1)?{a:_rE+1,b:_sA-1}:null;
lanes.push({i:e.i,name:(ideas[e.i]||{}).name||('Item '+e.i),hyp:e.hyp,legacy:!!((((data.projects||{})[e.i])||{}).legacy),segs:segs,br:_br})}});
if(!lanes.length)return'<p class="t-faint-sm">Nothing committed yet.</p>';
var shown=lanes.slice(0,10);
var W=720,LH=26,pad=150,Hh=shown.length*LH+30,cw=(W-pad-16)/M;
var C={dev:'#45A188',roll:'#5B8DD9',sus:'#C25B73'};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
shown.forEach(function(L,ix){var y=4+ix*LH;
h+='<text x="'+(pad-8)+'" y="'+(y+12)+'" text-anchor="end" font-size="10" fill="#B8B0A4">'+esc(L.name.length>22?L.name.slice(0,21)+'\u2026':L.name)+(L.legacy?' \u25c6':'')+'</text>';
h+='<line x1="'+pad+'" y1="'+(y+9)+'" x2="'+(W-16)+'" y2="'+(y+9)+'" stroke="rgba(245,242,236,.06)"/>';
L.segs.forEach(function(sg){var x=pad+(sg.a-1)*cw,w=Math.max(2,(sg.b-sg.a+1)*cw);
h+='<rect x="'+x.toFixed(1)+'" y="'+(y+2)+'" width="'+w.toFixed(1)+'" height="14" rx="3" fill="'+C[sg.k]+'"'+(L.hyp?' opacity=".45" stroke="'+C[sg.k]+'" stroke-dasharray="3,2"':'')+'><title>'+esc(L.name)+' \u00b7 '+(sg.k==='dev'?'development':sg.k==='roll'?'rollout':'sustainment')+' \u00b7 Months '+sg.a+'\u2013'+sg.b+(L.hyp?' (assumed)':'')+'</title></rect>'});
if(L.br){var bx=pad+(L.br.a-1)*cw,bw2=Math.max(2,(L.br.b-L.br.a+1)*cw);
h+='<rect x="'+bx.toFixed(1)+'" y="'+(y+7)+'" width="'+bw2.toFixed(1)+'" height="4" rx="2" fill="rgba(245,242,236,.18)"'+(L.hyp?' opacity=".5"':'')+'><title>'+esc(L.name)+' \u00b7 Months '+L.br.a+'\u2013'+L.br.b+' \u00b7 nothing charted between the end of rollout and the start of sustainment</title></rect>'}});
for(var t=6;t<=M;t+=6)h+='<text x="'+(pad+(t-.5)*cw).toFixed(1)+'" y="'+(Hh-6)+'" text-anchor="middle" font-size="9" fill="#8A8278">'+t+'</text>';
h+='</svg>';
if(lanes.length>shown.length)h+='<div class="t-faint-sm" style="margin-top:4px">+'+(lanes.length-shown.length)+' more committed items not shown</div>';
h+='<div class="t-faint-sm" style="margin-top:6px">One lane per committed item, placed at its anchor \u00b7 <span style="color:#45A188">\u25a0</span> development <span style="color:#5B8DD9">\u25a0</span> rollout <span style="color:#C25B73">\u25a0</span> sustainment \u00b7 \u25c6 legacy'+(shown.some(function(L2){return L2.br})?' \u00b7 thin bar = a gap the plan leaves between rollout and sustainment':'')+((extras||[]).length?' \u00b7 dashed = the ticked batch at its assumed start':'')+'</div>';
return h}
function orgCategoryDonut(){var srs=orgMonthly();if(!srs)return'';var dev=0,roll=0,sus=0;var _rg=capYearRange(srs.length);
srs.forEach(function(m,ix){if(ix<_rg[0]||ix>=_rg[1])return;dev+=m.dev;roll+=m.roll;sus+=m.sus});
var tot=dev+roll+sus;if(!(tot>0.5))return'<p class="t-faint-sm">Nothing committed yet.</p>';
var parts=[{name:'Development',t:dev,c:'#45A188'},{name:'Rollout',t:roll,c:'#5B8DD9'},{name:'Sustainment',t:sus,c:'#C25B73'}].filter(function(x){return x.t>0.5});
var cx=90,cy=90,r=70,ri=44;var h='<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 180 180" style="width:170px;height:170px;flex-shrink:0">';
if(parts.length===1){h+='<circle cx="90" cy="90" r="57" fill="none" stroke="'+parts[0].c+'" stroke-width="26"><title>'+parts[0].name+' '+fmtMoney(Math.round(tot))+'</title></circle>'}
else{var a0=-Math.PI/2;parts.forEach(function(x){var frac=x.t/tot;var a1=a0+frac*2*Math.PI;var large=frac>.5?1:0;
var p0=[cx+r*Math.cos(a0),cy+r*Math.sin(a0)],p1=[cx+r*Math.cos(a1),cy+r*Math.sin(a1)],q1=[cx+ri*Math.cos(a1),cy+ri*Math.sin(a1)],q0=[cx+ri*Math.cos(a0),cy+ri*Math.sin(a0)];
h+='<path d="M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+'A'+r+' '+r+' 0 '+large+' 1 '+p1[0].toFixed(1)+' '+p1[1].toFixed(1)+'L'+q1[0].toFixed(1)+' '+q1[1].toFixed(1)+'A'+ri+' '+ri+' 0 '+large+' 0 '+q0[0].toFixed(1)+' '+q0[1].toFixed(1)+'Z" fill="'+x.c+'"><title>'+x.name+' '+fmtMoney(Math.round(x.t))+'</title></path>';a0=a1})}
h+='<text x="90" y="86" text-anchor="middle" font-size="14" font-weight="700" fill="#F5F2EC">'+fmtMoney(Math.round(tot))+'</text><text x="90" y="102" text-anchor="middle" font-size="9" fill="#8A8278">'+(UI.capYear&&UI.capYear!=='T'?'Year '+UI.capYear:'all years combined')+'</text></svg><div style="flex:1;min-width:170px">';
parts.forEach(function(x){h+='<div class="row-line" style="padding:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+x.c+';margin-right:6px"></span><span class="fs-13" style="flex:1">'+x.name+'</span><span class="t-faint-sm">'+fmtMoney(Math.round(x.t))+' \u00b7 '+Math.round(x.t/tot*100)+'%</span></div>'});
return h+'</div></div>'}
function capYearRange(M){var sel=UI.capYear;if(sel==null||sel==='T'||!(sel>=1&&sel<=envYearsOf()))return[0,M];return[Math.min(M,(sel-1)*12),Math.min(M,sel*12)]}
function orgCompositionDonut(){var srs=orgMonthly();if(!srs)return'';var M=srs.length;var ideas=data.ideas||[];var _rg=capYearRange(M);
var per=[];orgCommittedSet().forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var t=0;for(var m=_rg[0];m<_rg[1];m++)t+=s2[m].dev+s2[m].roll+s2[m].sus;if(t>0.5)per.push({i:e.i,name:(ideas[e.i]||{}).name||('Item '+e.i),t:t})});
if(!per.length)return'<p class="t-faint-sm">Nothing committed yet.</p>';
per.sort(function(a,b){return b.t-a.t});
var top=per.slice(0,6);var rest=per.slice(6).reduce(function(a,x){return a+x.t},0);if(rest)top.push({name:'Other ('+(per.length-6)+')',t:rest});
var tot=per.reduce(function(a,x){return a+x.t},0);
var PAL=['#45A188','#5B8DD9','#C25B73','#D4A017','#7FB069','#9C6BB3','#8A8278'];
var cx=90,cy=90,r=70,ri=44;var h='<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 180 180" style="width:170px;height:170px;flex-shrink:0">';
if(top.length===1){h+='<circle cx="90" cy="90" r="57" fill="none" stroke="'+PAL[0]+'" stroke-width="26"><title>'+esc(top[0].name)+' '+fmtMoney(Math.round(tot))+'</title></circle>'}
else{var a0=-Math.PI/2;top.forEach(function(x,ix){var frac=x.t/tot;var a1=a0+frac*2*Math.PI;var large=frac>.5?1:0;
var p0=[cx+r*Math.cos(a0),cy+r*Math.sin(a0)],p1=[cx+r*Math.cos(a1),cy+r*Math.sin(a1)],q1=[cx+ri*Math.cos(a1),cy+ri*Math.sin(a1)],q0=[cx+ri*Math.cos(a0),cy+ri*Math.sin(a0)];
h+='<path d="M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+'A'+r+' '+r+' 0 '+large+' 1 '+p1[0].toFixed(1)+' '+p1[1].toFixed(1)+'L'+q1[0].toFixed(1)+' '+q1[1].toFixed(1)+'A'+ri+' '+ri+' 0 '+large+' 0 '+q0[0].toFixed(1)+' '+q0[1].toFixed(1)+'Z" fill="'+PAL[ix%PAL.length]+'"><title>'+esc(x.name)+' '+fmtMoney(Math.round(x.t))+'</title></path>';a0=a1})}
h+='<text x="90" y="86" text-anchor="middle" font-size="14" font-weight="700" fill="#F5F2EC">'+fmtMoney(Math.round(tot))+'</text><text x="90" y="102" text-anchor="middle" font-size="9" fill="#8A8278">'+(UI.capYear&&UI.capYear!=='T'?'Year '+UI.capYear:'all years combined')+'</text></svg><div style="flex:1;min-width:170px">';
top.forEach(function(x,ix){h+='<div class="row-line" style="padding:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+PAL[ix%PAL.length]+';margin-right:6px"></span><span class="fs-13" style="flex:1">'+esc(x.name)+'</span><span class="t-faint-sm">'+fmtMoney(Math.round(x.t))+' \u00b7 '+Math.round(x.t/tot*100)+'%</span></div>'});
h+='</div></div>';return h}
function orgPlateauBars(){var yt=orgYearTotals();if(!yt)return'';
var h='';yt.forEach(function(r){if(!(r.budget>0))return;var pct=Math.round(r.sus/r.budget*100);var over=r.capPct>1;
var lbl=(r.sus>0&&pct<1)?'&lt;1':String(pct);var wp=r.sus>0?Math.max(pct,1):0;
h+='<div style="margin-bottom:8px"><div class="flx-center" style="justify-content:space-between"><span class="fs-13">Year '+r.y+'</span><span class="t-faint-sm">'+lbl+'% of budget'+(over?' <span style="color:var(--warn-text)">\u26a0 over cap</span>':'')+'</span></div>';
h+='<div style="position:relative;height:10px;background:rgba(var(--fg-rgb),.06);border-radius:5px"><div style="position:absolute;left:0;top:0;bottom:0;width:'+Math.min(100,wp)+'%;background:#C25B73;border-radius:5px"></div>'+(r.scpY>0?'<div title="Sustainment cap '+r.scpY+'%" style="position:absolute;left:'+Math.min(100,r.scpY)+'%;top:-3px;bottom:-3px;width:2px;background:#D4A017"></div>':'')+'</div></div>'});
return h}
function orgQuarterStrip(){var srs=orgMonthly();if(!srs)return'';var pm=progMonthOf(new Date());if(pm==null)return'';
var M=srs.length;var qStart=Math.floor((Math.max(1,pm)-1)/3)*3+1;var out=[];var mx=0;
for(var q=0;q<4;q++){var a=qStart+q*3;if(a>M)break;var b=Math.min(a+2,M);var t=0;for(var m=a;m<=b;m++)t+=srs[m-1].dev+srs[m-1].roll+srs[m-1].sus;
var y=Math.ceil(a/12);var slice=envBudgetYear(y)/4;out.push({a:a,b:b,t:t,slice:slice});mx=Math.max(mx,t,slice)}
if(!out.length||!mx)return'';
var h='<div style="display:flex;gap:10px;align-items:flex-end;height:150px">';
out.forEach(function(o){var hb=Math.max(3,118*o.t/mx),hs=Math.max(2,118*o.slice/mx);var over=o.t>o.slice;
h+='<div style="flex:1;position:relative;height:100%"><div style="position:absolute;bottom:'+(18+hs)+'px;left:8%;right:8%;height:2px;background:rgba(var(--fg-rgb),.55)"><title>One quarter of the year\u2019s budget</title></div><div style="position:absolute;bottom:18px;left:15%;right:15%;height:'+hb+'px;background:'+(over?'#D4A017':'#45A188')+';border-radius:4px 4px 0 0" title="'+fmtMoney(Math.round(o.t))+' committed \u00b7 slice '+fmtMoney(Math.round(o.slice))+'"></div><div class="t-faint-sm" style="position:absolute;bottom:0;left:0;right:0;text-align:center">m'+o.a+'\u2013'+o.b+'</div></div>'});
h+='</div><p class="t-faint-sm" style="margin:6px 0 0">Committed costs in each of the next four program quarters. The grey line marks one quarter of the year\u2019s budget \u2013 an even-spread reference, not a limit. A bar turns amber when its quarter runs above that line.</p>';
return h}
function capKpiStrip(){var K=capKpiData(UI.capYear);if(!K)return''; /* 13 Sep 2026: the figures come from capKpiData, shared with the Capital Snapshot report */
var arc=function(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(245,242,236,.08)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#F5F2EC">'+Math.round(f*100)+'%</text></svg>'};
var tile=function(inner,label,sub){return'<div style="flex:1;min-width:150px;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:10px;background:rgba(var(--fg-rgb),.02)">'+inner+'<div style="min-width:0"><div class="fs-13" style="font-weight:600">'+label+'</div><div class="t-faint-sm">'+sub+'</div></div></div>'};
var h='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">';
h+=tile(arc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub);
h+=tile('<div class="score-num-md" style="color:'+(K.t2.neg?'#C25B73':'var(--ph1-t)')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub);
h+=tile(arc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub);
return h+'</div>'}
function renderCapAnalytics(){var srs=orgMonthly();var h='';
if(!srs)return card('<h3 class="h-sub-md">Organizational Charts</h3><p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to place commitments on the program calendar.</p>','margin-bottom:16px');
h+=capKpiStrip();
h+=card('<h3 class="h-sub-md">The Committed Calendar</h3>'+orgSwimlanes(),'margin-bottom:16px');
h+='<div class="gr-2" style="align-items:start">'+zoomCard('wf','Capacity Waterfall','Each month\u2019s committed costs, stacked by category: Development, Rollout, Sustainment.',orgWaterfallChart())+zoomCard('cum','Cumulative vs Capacity','Committed costs added up month by month, against the budget added up the same way. Where the committed line crosses the budget line, more has been promised than the envelope holds by that month.',orgCumChart())+'</div>';
h+='<div class="gr-2" style="align-items:start">'+zoomCard('donut','Committed Costs by Project','Each project\u2019s share of committed costs '+(UI.capYear&&UI.capYear!=='T'?'in Year '+UI.capYear+' \u2013 switch years on the tabs above.':'across the full financial horizon \u2013 every modeled year combined.'),orgCompositionDonut(),'58px')+zoomCard('cat','Committed Costs by Category','Committed costs '+(UI.capYear&&UI.capYear!=='T'?'in Year '+UI.capYear:'across the full financial horizon')+' \u2013 split into Development, Rollout, and Sustainment.',orgCategoryDonut(),'58px')+'</div>';
h+=zoomCard('plateau','Sustainment Load by Year','Ongoing Sustainment costs build up as projects launch and keep running. Each bar is one year\u2019s Sustainment as a share of that year\u2019s budget; the tick marks the cap set at Plan Capacity (Step 3.2).',orgPlateauBars());
var yt=orgYearTotals();var scp=parseFloat((data.capital||{}).susCap);
var c3='<h3 class="h-sub-md">Overviews by Year</h3>';
c3+='<div style="display:grid;grid-template-columns:64px repeat(5,1fr);gap:3px 14px;align-items:baseline">';
c3+=['YEAR','BUDGET','COMMITTED','HEADROOM*','INTAKE RESERVE','NET OF RESERVE'].map(function(hd){return'<div class="t-faint-sm" style="font-size:10px;letter-spacing:.06em">'+hd+'</div>'}).join('');
yt.forEach(function(r){var spare=r.headroom-(r.reserve||0);
c3+='<div class="fs-14"><strong>Year '+r.y+'</strong></div>';
c3+='<div class="fs-14">'+(r.budgetSet?(fmtMoney(r.budget)+(fundAddsYear(r.y)?'<span class="t-faint-sm"> (incl. '+fmtMoney(fundAddsYear(r.y))+' auth.)</span>':'')):'<span class="t-faint-sm">not set</span>')+'</div>';
c3+='<div class="fs-14">'+fmtMoney(r.total)+'</div>';
c3+='<div class="fs-14" style="color:'+(r.headroom<0?'#C25B73':'var(--ph1-t)')+'">'+(r.budgetSet?fmtMoney(r.headroom):'\u2014')+'</div>';
c3+='<div class="fs-14">'+(r.reserve?fmtMoney(r.reserve):'\u2014')+'</div>';
c3+='<div class="fs-14">'+(r.reserve&&r.budgetSet?fmtMoney(spare):'\u2014')+'</div>';
c3+='<div class="t-faint-sm" style="grid-column:1/-1;margin:-2px 0 8px">Committed = Development '+fmtMoney(r.dev)+' + Rollout '+fmtMoney(r.roll)+' + Sustainment '+fmtMoney(r.sus)+(r.scpY>0&&r.budgetSet&&r.budget>0?'. Sustainment takes '+((r.sus>0&&Math.round(r.sus/r.budget*100)<1)?'&lt;1':Math.round(r.sus/r.budget*100))+'% of the year\u2019s budget \u2013 cap '+r.scpY+'%'+(r.capPct>1?' <span style="color:var(--warn-text)">\u26a0 over the cap</span>':'')+'.':'')+'</div>'});
c3+='</div>';
c3+='<p class="t-faint-sm" style="margin-top:4px">*Headroom is the available budget that can still be assigned to new projects.</p>';
h+=card(c3,'margin-bottom:16px');
var br=capBreaches();var flags='';
if(br.overCapMonth)flags+='<p class="fs-13" style="margin:0 0 6px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+br.overCapMonth+'.</p>';
if(br.ctOverCapMonth&&br.ctOverCapMonth!==br.overCapMonth)flags+='<p class="fs-13" style="margin:0 0 6px;color:var(--warn-pale)">\u26a0 With stated contingencies, cumulative commitments would cross capacity in Month '+br.ctOverCapMonth+'.</p>';
br.capYears.forEach(function(y){flags+='<p class="fs-13" style="margin:0 0 6px;color:var(--warn-text)">\u26a0 Year '+y+' sustainment exceeds the '+(data.capital||{}).susCap+'% cap.</p>'});
if(flags)h+=card('<h3 class="h-sub-md">Flags</h3>'+flags,'margin-bottom:16px');
return h}
function zoomCard(key,title,capt,body,capMinH){return card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">'+title+'</h3><button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=\''+key+'\';render()" title="Enlarge">\u2922</button></div>'+(capt?'<p class="t-faint-sm" style="margin:4px 0 10px'+(capMinH?';min-height:'+capMinH:'')+'">'+capt+'</p>':'')+body,'margin-bottom:16px')}
function zoomBtn(key){return'<button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=\''+key+'\';render()" title="Enlarge" style="font-size:12px">\u2922</button>'}
function acStagedExtras(){var proj=data.projects||{};var goP=getStages().explore.filter(function(i){return(proj[i]||{}).viable===true});
var sel=goP.filter(function(i){return(UI.capSim||{})[i]});
var pmNow=progMonthOf(new Date());var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
return sel.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}})}
function chartZoomOverlay(){var z=UI.chartZoom;if(!z)return'';
var reg={wf:['Capacity Waterfall',orgWaterfallChart],cum:['Cumulative vs Capacity',orgCumChart],donut:['Committed Costs by Project',orgCompositionDonut],cat:['Committed Costs by Category',orgCategoryDonut],plateau:['Sustainment Load by Year',orgPlateauBars]};
var e=reg[z];
if(!e){var _sfx=acStagedExtras().length?' \u2013 staged batch included':'';
if(z==='ac_wf')e=['Capacity Waterfall'+_sfx,function(){return orgWaterfallChart(acStagedExtras())}];
else if(z==='ac_cum')e=['Cumulative vs Capacity'+_sfx,function(){var ex=acStagedExtras();var b=capBreaches(ex);return(b.overCapMonth?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+b.overCapMonth+'.</p>':'<p class="t-faint-sm" style="margin:0 0 8px">Cumulative commitments stay under cumulative capacity across the horizon.</p>')+orgCumChart(ex)}];
else if(z==='ac_swim')e=['The Committed Calendar'+_sfx,function(){return orgSwimlanes(acStagedExtras())}];
else if(z.indexOf('bpshape_')===0||z.indexOf('bpcum_')===0){var _bi=parseInt(z.split('_')[1],10);var _nm=esc((((data.ideas||[])[_bi])||{}).name||('Item '+_bi));
e=(z.indexOf('bpshape_')===0)?['Monthly Spend Shape \u2013 '+_nm,function(){return bpChartShape(_bi)+bpChartLegend()}]:['Cumulative Cost \u2013 '+_nm,function(){return bpChartCum(_bi)}]}}
if(!e)return'';
return'<div style="position:fixed;inset:0;background:rgba(10,9,7,.78);z-index:400;display:flex;align-items:center;justify-content:center;padding:32px" onclick="UI.chartZoom=null;render()"><div class="cd" style="background:var(--bg-elev);max-width:960px;width:100%;max-height:90vh;overflow:auto;margin:0;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.55)" onclick="event.stopPropagation()"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><h3 class="h-sub-lg" style="flex:1;margin:0">'+e[0]+'</h3><button class="btn-ghost pad-chip-sm" onclick="UI.chartZoom=null;render()">\u2715 Close</button></div>'+e[1]()+'</div></div>'}
/* ================= Module Management Hub (Paul, July 5) =================
   Assignments (data.assigns) and the roster already existed; this adds
   completion stamps (data.stepDoneAt, written by every saveDone handler),
   optional per-step deadlines (data.stepDue), and analytics: the 90-day
   burn-up and velocity charts (adapted from the companion Governance
   module), team load, and derived signals. Phase 5 (Navigate) is ongoing
   work, not a step to burn down, so it stays out of the counts. */
function stampStepDone(id){try{if(!data.stepDoneAt)data.stepDoneAt={};if(!data.stepDoneAt[id]){data.stepDoneAt[id]=new Date().toISOString().split('T')[0];Store.commit('stepDoneAt');notifyStepComplete(id)}}catch(e){}}
function mgSteps(){var out=[];PH.forEach(function(p){if(p.id===5)return;p.steps.forEach(function(st){out.push({id:st.id,name:st.name,icon:st.icon,ph:p})})});return out}
function mgDueSave(id,v){data.stepDue=data.stepDue||{};if(v)data.stepDue[id]=v;else delete data.stepDue[id];Store.commit('stepDue');render()}
function mgAssignToggle(id,uid2){toggleAssign(id,uid2)} /* delegates to the existing assignment system */
function mgStats(){var steps=mgSteps(),co=data.completedSteps||{},due=data.stepDue||{};
var done=steps.filter(function(s){return co[s.id]}).length;
var sd=data.startDate?new Date(data.startDate):new Date();
var elapsed=Math.max(0,Math.round((Date.now()-sd.getTime())/86400000));
var ideal=Math.min(1,elapsed/90)*steps.length;
var today=new Date().toISOString().split('T')[0];
var overdue=steps.filter(function(s){return !co[s.id]&&due[s.id]&&due[s.id]<today}).length;
return{total:steps.length,done:done,elapsed:elapsed,ideal:ideal,delta:done-ideal,overdue:overdue}}
function mgBurnup(){var steps=mgSteps(),total=steps.length;var co=data.completedSteps||{},dts=data.stepDoneAt||{};
var sd=data.startDate?new Date(data.startDate):new Date();
var events=[];steps.forEach(function(s){if(co[s.id]&&dts[s.id])events.push({d:new Date(dts[s.id]),id:s.id})});
events.sort(function(a,b){return a.d-b.d});
var elapsed=Math.max(0,Math.min(120,Math.round((Date.now()-sd.getTime())/86400000)));
var span=Math.max(90,elapsed);
var W=560,H=190,PX=40,PY=12,PW=W-PX-16,PHt=H-PY-34;
var X=function(day){return PX+day/span*PW},Y=function(nn){return PY+PHt-(nn/total)*PHt};
var h='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';
[0,.5,1].forEach(function(f){var y=PY+PHt-f*PHt;h+='<line x1="'+PX+'" y1="'+y.toFixed(1)+'" x2="'+(PX+PW)+'" y2="'+y.toFixed(1)+'" stroke="rgba(245,242,236,.08)"/><text x="'+(PX-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#8A8278">'+Math.round(f*total)+'</text>'});
[30,60,90].forEach(function(d){if(d<=span)h+='<line x1="'+X(d).toFixed(1)+'" y1="'+PY+'" x2="'+X(d).toFixed(1)+'" y2="'+(PY+PHt)+'" stroke="rgba(245,242,236,.08)" stroke-dasharray="2 4"/><text x="'+X(d).toFixed(1)+'" y="'+(PY+PHt+16)+'" text-anchor="middle" font-size="9" fill="#8A8278">day '+d+'</text>'});
h+='<line x1="'+X(0).toFixed(1)+'" y1="'+Y(0).toFixed(1)+'" x2="'+X(Math.min(90,span)).toFixed(1)+'" y2="'+Y(total).toFixed(1)+'" stroke="#8A8278" stroke-dasharray="4 4" stroke-opacity=".6"><title>Ideal pace: all '+total+' steps by day 90</title></line>';
var pth=['M'+X(0).toFixed(1)+' '+Y(0).toFixed(1)],n=0;
events.forEach(function(e){var day=Math.max(0,Math.min(span,Math.round((e.d-sd)/86400000)));pth.push('L'+X(day).toFixed(1)+' '+Y(n).toFixed(1));n++;pth.push('L'+X(day).toFixed(1)+' '+Y(n).toFixed(1))});
pth.push('L'+X(Math.min(elapsed,span)).toFixed(1)+' '+Y(n).toFixed(1));
h+='<path d="'+pth.join(' ')+'" fill="none" stroke="#D4A017" stroke-width="2"/>';
h+='<circle cx="'+X(Math.min(elapsed,span)).toFixed(1)+'" cy="'+Y(n).toFixed(1)+'" r="4" fill="#D4A017"/>';
h+='<text x="'+X(Math.min(elapsed,span)).toFixed(1)+'" y="'+(Y(n)-8).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#D4A017">TODAY \u00b7 '+n+'/'+total+'</text></svg>';
var st=mgStats();
h+='<div class="t-faint-sm" style="text-align:center;margin-top:4px;color:'+(st.delta>=0?'var(--ph1-t)':'#C25B73')+'">'+(st.delta>=0?'\u25b2 ':'\u25bc ')+Math.abs(st.delta).toFixed(1)+' steps '+(st.delta>=0?'ahead of':'behind')+' the ideal pace</div>';
return h}
function mgVelocity(){var dts=data.stepDoneAt||{},co=data.completedSteps||{};
var sd=data.startDate?new Date(data.startDate):new Date();
var weeks=[],i;for(i=0;i<13;i++)weeks.push(0);var any=false;
mgSteps().forEach(function(s){if(co[s.id]&&dts[s.id]){any=true;var w=Math.floor((new Date(dts[s.id])-sd)/(7*86400000));if(w<0)w=0;if(w>12)w=12;weeks[w]++}});
if(!any)return'<p class="t-faint-sm">No completion dates recorded yet \u2013 velocity appears as steps are marked complete.</p>';
var curW=Math.min(12,Math.max(0,Math.floor((Date.now()-sd.getTime())/(7*86400000))));
var W=560,H=170,PX=26,PY=20,PW=W-PX-10,PHt=H-PY-28;
var bw=PW/13,mx=Math.max.apply(null,weeks.concat([1]));
var h='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';
weeks.forEach(function(v,j){var bh=v/mx*PHt,x=PX+j*bw+3,y=PY+PHt-bh;var col=j===curW?'#D4A017':'#4FB39A';
h+='<rect x="'+x.toFixed(1)+'" y="'+PY+'" width="'+(bw-6).toFixed(1)+'" height="'+PHt+'" rx="4" fill="rgba(245,242,236,.03)"/>';
if(v)h+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw-6).toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="4" fill="'+col+'" fill-opacity=".85"><title>Week '+(j+1)+': '+v+' step'+(v>1?'s':'')+'</title></rect>';
if(v)h+='<text x="'+(x+(bw-6)/2).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#F5F2EC">'+v+'</text>';
h+='<text x="'+(x+(bw-6)/2).toFixed(1)+'" y="'+(PY+PHt+16)+'" text-anchor="middle" font-size="8.5" fill="'+(j===curW?'#D4A017':'#8A8278')+'">W'+(j+1)+'</text>'});
h+='</svg><div class="t-faint-sm" style="text-align:center;margin-top:4px">Gold bar = current program week</div>';
return h}
function mgSignals(){var steps=mgSteps(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{},assigns=data.assigns||{};
var withOwner=steps.filter(function(s){return(assigns[s.id]||[]).length}).length;
var withDue=steps.filter(function(s){return due[s.id]}).length;
var met=0,miss=0;steps.forEach(function(s){if(co[s.id]&&due[s.id]&&dts[s.id]){if(dts[s.id]<=due[s.id])met++;else miss++}});
var sd=data.startDate?new Date(data.startDate):new Date();
var h='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center">';
var cellS=function(v,l){return'<div><div class="fs-14"><strong>'+v+'</strong></div><div class="t-faint-sm" style="margin-top:2px">'+l+'</div></div>'};
h+=cellS(withOwner+' of '+steps.length,'steps with an owner');
h+=cellS(withDue+' of '+steps.length,'steps with a deadline');
h+=cellS((met+miss)?met+' met \u00b7 '+miss+' missed':'\u2014','deadlines on completed steps');
h+='</div>';
var meds=PH.filter(function(p){return p.id!==5}).map(function(p){var ds=p.steps.filter(function(st){return co[st.id]&&dts[st.id]}).map(function(st){return Math.round((new Date(dts[st.id])-sd)/86400000)}).sort(function(a,b){return a-b});var med=ds.length?ds[Math.floor((ds.length-1)/2)]:null;var doneN=p.steps.filter(function(st){return co[st.id]}).length;return{p:p,med:med,doneN:doneN,n:p.steps.length}});
h+='<div style="margin-top:10px">'+meds.map(function(x){return'<div class="row-line"><span class="fs-13" style="flex:1;color:'+x.p.color+'">Phase '+x.p.id+' \u2013 '+esc(x.p.name)+'</span><span class="t-faint-sm">'+x.doneN+' / '+x.n+' complete'+(x.med!=null?' \u00b7 median completion day '+x.med:'')+'</span></div>'}).join('')+'</div>';
return h}
function mgWeek(){var steps=mgSteps(),co=data.completedSteps||{},due=data.stepDue||{};
var today=new Date().toISOString().split('T')[0];
var week=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
var overdue=steps.filter(function(s){return !co[s.id]&&due[s.id]&&due[s.id]<today});
var upcoming=steps.filter(function(s){return !co[s.id]&&due[s.id]&&due[s.id]>=today&&due[s.id]<=week});
if(!overdue.length&&!upcoming.length)return'<p class="t-faint-sm">Nothing due in the next seven days and nothing overdue.</p>';
return overdue.concat(upcoming).map(function(s2){return mgRowHtml(s2.id,s2.name)}).join('')}
function mgRowHtml(id2,name){var co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{};
var today=new Date().toISOString().split('T')[0];
var doneS=!!co[id2];var d2=due[id2]||'';var over=!doneS&&d2&&d2<today;
return '<div style="display:grid;grid-template-columns:minmax(160px,1fr) 300px 240px;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)">'
+'<div style="display:flex;align-items:baseline;gap:10px"><span class="t-faint-sm" style="min-width:26px">'+id2+'</span><span class="fs-14">'+esc(name)+'</span></div>'
+'<div style="display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap">'
+(doneS?badge('\u2713 done'+(dts[id2]?' \u00b7 '+fmtDate(dts[id2]):''),'#1B6B5A')+(d2?'<span class="t-faint-sm">was due '+fmtDate(d2)+'</span>':''):over?badge('overdue \u00b7 was due '+fmtDate(d2),'#C25B73'):d2?badge('due '+fmtDate(d2),'#D4A017'):badge('open','#2D5A8E'))
+(doneS?'':'<input type="date" value="'+esc(d2)+'" onchange="mgDueSave(\''+id2+'\',this.value)" title="Optional deadline" style="font-size:11px;padding:3px 6px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"/>')
+'</div>'
+'<div style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:2px">'+assignBtn(id2)+'</div>'
+'</div>'}
function mgWorkload(){var steps=mgSteps(),co=data.completedSteps||{},assigns=data.assigns||{};
var rows=USERS.map(function(u){var open=0,done=0;steps.forEach(function(s){if((assigns[s.id]||[]).indexOf(u.id)>=0){if(co[s.id])done++;else open++}});return{u:u,open:open,done:done}}).filter(function(r){return r.open+r.done>0});
if(!rows.length)return'<p class="t-faint-sm">No assignments yet \u2013 assign members on the Assignments tab.</p>';
var mx=Math.max.apply(null,rows.map(function(r){return r.open+r.done}));
rows.sort(function(a,b){return(b.open-a.open)||(b.done-a.done)});
var h='';rows.forEach(function(r){
var wO=(r.open/mx)*100,wD=(r.done/mx)*100;
h+='<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><div style="width:26px">'+userAv(r.u,24)+'</div><div class="fs-13" style="width:140px">'+esc(r.u.name)+'</div>'
+'<div style="flex:1;height:12px;background:rgba(var(--fg-rgb),.05);border-radius:6px;overflow:hidden;display:flex">'
+(r.open?'<div style="width:'+wO.toFixed(1)+'%;background:#D4A017"><title></title></div>':'')
+(r.done?'<div style="width:'+wD.toFixed(1)+'%;background:#4FB39A;opacity:.45"></div>':'')
+'</div><div class="t-faint-sm" style="width:130px;text-align:right">'+r.open+' open \u00b7 '+r.done+' complete</div></div>'});
h+='<div class="t-faint-sm" style="margin-top:6px">Sorted by open load \u2013 gold is open work, faded teal is complete.</div>';
return h}
function mgmtHubContent(){ /* the hub body, callable for the page, the PDF, and the notification emails (July 7) */
var st=mgStats(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{},assigns=data.assigns||{};
var today=new Date().toISOString().split('T')[0];
var h='<div class="mb-6">'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Module <em>Management</em></h1><p class="u-98b80d8">Every step of the module in one place \u2013 who owns it, when it is due, and how completion is pacing against the 90 days.</p></div>';
var tile=function(v,l,c){return'<div style="text-align:center"><div class="score-num-md" style="font-size:26px;line-height:1.2'+(c?';color:'+c:'')+'">'+v+'</div><div class="t-faint-sm" style="margin-top:3px">'+l+'</div></div>'};
h+=card('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
+tile(st.done+' / '+st.total,'steps complete')
+tile('Day '+Math.min(st.elapsed,90)+(st.elapsed>90?' (+'+(st.elapsed-90)+' over)':''),'of the 90')
+tile((st.delta>=0?'+':'\u2212')+Math.abs(st.delta).toFixed(1),'steps vs ideal pace',st.delta>=0?'var(--ph1-t)':'#C25B73')
+tile(String(st.overdue),'overdue',st.overdue?'#C25B73':null)
+'</div>','margin-bottom:16px');
var _mt=UI.mgTab||0;
var _mtb=function(n,l){return'<button class="btn-ghost pad-chip-md'+(_mt===n?' nav-action-on':'')+'" style="font-size:13px'+(_mt===n?';border-color:var(--warn-text);color:var(--warn-text)':'')+'" onclick="UI.mgTab='+n+';render()">'+l+'</button>'};
h+='<div style="display:flex;gap:8px;margin-bottom:16px">'+_mtb(0,'Assignments')+_mtb(1,'Analytics')+'</div>';
if(_mt===1){
h+=card('<h3 class="h-sub-md">90-Day Burn-up</h3><p class="t-faint-sm" style="margin:4px 0 10px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all '+st.total+' steps by day 90.</p>'+mgBurnup(),'margin-bottom:16px');
h+=card('<h3 class="h-sub-md">Module Velocity</h3><p class="t-faint-sm" style="margin:4px 0 10px">Steps completed per program week, from completion dates.</p>'+mgVelocity(),'margin-bottom:16px');
h+=card('<h3 class="h-sub-md">Workload by Member</h3><p class="t-faint-sm" style="margin:4px 0 10px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>'+mgWorkload(),'margin-bottom:16px');
h+=card('<h3 class="h-sub-md">Signals</h3>'+mgSignals(),'margin-bottom:16px');
}else{
h+=card('<h3 class="h-sub-md">This Week</h3><p class="t-faint-sm" style="margin:4px 0 8px">Steps overdue or due within seven days.</p>'+mgWeek(),'margin-bottom:16px');
PH.forEach(function(p){if(p.id===5)return;
var rows='';p.steps.forEach(function(stp){var id2=stp.id;
rows+=mgRowHtml(id2,stp.name)});
h+=card('<h3 class="h-sub-md" style="color:'+p.color+'">Phase '+p.id+' \u2013 '+esc(p.name)+' <span class="t-faint-sm" style="font-weight:400">('+p.days+')</span></h3>'+rows,'margin-bottom:16px');
});
}
return h}
/* ================= Email Notifications (Paul, July 7) =================
   Client-side complete; INERT until the dev team wires the AWS service.
   Contract (see AWS_Notifications_Contract.md in the handoff set):
   - Set NOTIFY_ENDPOINT to the service URL. The app POSTs JSON:
     {kind, subject, to:[emails], stepId, orgName, sentAt, pdf, html}
   - kind 'step-complete': html = completion notice + the full Module
     Management analytics page (stat band included). pdf:true — the
     service converts the html to PDF (wrap with the app stylesheet)
     and mails it as an attachment to every address in `to`.
   - kind 'deadline-reminder': plain notice, pdf:false, sent to the
     administrator-role member(s) plus the step's assignees.
   - Until the endpoint is set, every notification is recorded in the
     local outbox (data.notifications) with status 'pending'.
   Admin rule: roster members flagged admin:true (the org's administrator account) - role text is cosmetic (ruled July 9)
   (case-insensitive). No match => assignees only, and the outbox
   entry notes the gap.
   ======================================================================= */
var NOTIFY_ENDPOINT=''; /* dev team: set to the AWS notification service URL */
function notifyMemberEmails(list){return (list||USERS||[]).map(function(u){return u&&u.email}).filter(function(e){return e&&/\S+@\S+/.test(e)})}
function notifyAdmins(){return (USERS||[]).filter(function(u){return u&&u.admin===true})} /* flag-based (ruled July 9): role text is a label, admin:true is the authority record */
function notifyStepName(id){var nm=id;(PH||[]).forEach(function(p){(p.steps||[]).forEach(function(st){if(st.id===id)nm='Step '+st.id+' \u2013 '+st.name})});return nm}
function notifyQueue(kind,subject,to,stepId,pdf){
if(!to||!to.length)return;
if(!data.notifications)data.notifications=[];
var n={at:Date.now(),kind:kind,subject:subject,to:to,stepId:stepId||'',pdf:!!pdf,status:NOTIFY_ENDPOINT?'sending':'pending \u2013 endpoint not configured'};
data.notifications.push(n);if(data.notifications.length>50)data.notifications=data.notifications.slice(-50);
Store.commit('notifications');
notifyDispatch(n);return n}
function notifyEmailHtml(n){
var head='<h2 style="font-family:Helvetica,Arial,sans-serif">'+esc(n.subject)+'</h2><p>'+(n.kind==='step-complete'?esc(notifyStepName(n.stepId))+' was marked complete on '+fmtDate(n.at)+'. The current Module Management analytics report is attached.':'The assigned step '+esc(notifyStepName(n.stepId))+' is due within one week ('+esc(((data.stepDue||{})[n.stepId]?fmtDate((data.stepDue||{})[n.stepId]):''))+').')+'</p>';
return n.kind==='step-complete'?head+'<hr/>'+mgmtHubContent():head}
function notifyDispatch(n){
if(SAMPLE_MODE||!NOTIFY_ENDPOINT)return; /* Part 3: the sample tab sends no email */ /* inert until wired \u2013 outbox holds the record */
try{fetch(NOTIFY_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:n.kind,subject:n.subject,to:n.to,stepId:n.stepId,orgName:(data.enterprise||{}).name||'',sentAt:new Date(n.at).toISOString(),pdf:n.pdf,html:notifyEmailHtml(n)})})
.then(function(r){n.status=r.ok?'sent':'failed ('+r.status+')';Store.commit('notifications');render()})
.catch(function(){n.status='failed (network)';Store.commit('notifications');render()})}catch(e){n.status='failed';Store.commit('notifications')}}
function notifyStepComplete(id){
try{var to=notifyMemberEmails();if(!to.length)return;
notifyQueue('step-complete',notifyStepName(id)+' complete \u2013 analytics report',to,id,true)}catch(e){}}
function notifySweepDeadlines(){
try{var due=data.stepDue||{},assigns=data.assigns||{},co=data.completedSteps||{};
if(!data.remind7)data.remind7={};
var today=new Date();today.setHours(0,0,0,0);
Object.keys(due).forEach(function(id){
if(!due[id]||co[id]||data.remind7[id])return;
var who=assigns[id]||[];if(!who.length)return; /* reminders are for ASSIGNED deadlines */
var d=new Date(due[id]+'T00:00:00');var days=Math.round((d-today)/86400000);
if(days<0||days>7)return;
var admins=notifyAdmins();
var to=notifyMemberEmails(admins.concat((USERS||[]).filter(function(u){return who.indexOf(u.id)>=0&&admins.indexOf(u)<0})));
if(!to.length)return;
var n=notifyQueue('deadline-reminder',notifyStepName(id)+' due '+due[id],to,id,false);
if(n&&!admins.length)n.status+=' \u00b7 no administrator on the roster';
data.remind7[id]=true;Store.commit('remind7')})}catch(e){}}
function notifyOutboxCard(){ /* not mounted – kept demo-clean (Paul, July 7); remount in renderMgmtHub if an in-app delivery log is wanted once AWS is wired */
var ns=(data.notifications||[]).slice(-8).reverse();
var rows=ns.map(function(n){return'<div class="row-line"><span class="fs-13" style="flex:1">'+esc(n.subject)+'</span><span class="t-faint-sm">'+fmtDate(n.at)+' \u00b7 '+n.to.length+' recipient'+(n.to.length>1?'s':'')+' \u00b7 '+esc(n.status)+'</span></div>'}).join('');
return card('<h3 class="h-sub-md">Email Notifications</h3><p class="t-faint-sm" style="margin:-2px 0 8px">Step-completion reports go to the whole team; deadline reminders go to the administrator and the assignees one week out. '+(NOTIFY_ENDPOINT?'Dispatching to the configured service.':'The dispatch service is not yet wired \u2013 notifications queue here until the dev team connects AWS.')+'</p>'+(rows||'<p class="t-faint-sm">\u2014</p>'),'margin-bottom:16px')}

function renderMgmtHub(){var _w='<div class="content-area pt-110"><div class="content-inner">';
return _w+backBtn()+'<div style="display:flex;justify-content:flex-end;margin:0 0 10px">'+'<button class="btn bg2" style="font-size:12px" onclick="printMgmtAnalytics()">\u25be Save as PDF</button>'+'</div>'+mgmtHubContent()+'</div></div>'}
function printMgmtAnalytics(){printDocument('Module Management',mgmtHubDoc(),'')} /* 14 Sep 2026 (Governance, Paul's ruling), ported 16 Sep 2026: the Track Program page prints as its own document */

function renderCapHub(){
var _w='<div class="content-area pt-110"><div class="content-inner">';
var ideas=data.ideas||[],stages=getStages(),cap=data.capital||{},trk=data.tracking||{},arch=data.archivedItems||{},port=data.portfolio||{};
var av=capAvailable();
var h=_w+backBtn()+'<div class="mb-6">'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Capital Planning <em>Hub</em></h1><p class="u-98b80d8">The portfolio\u2019s committed costs and remaining budget in one place. Every figure here is calculated from the projects themselves \u2013 their stages, their plans, and their dates \u2013 so the page always shows the portfolio as it currently stands.</p></div>';
if(!UI._printing)h+='<div style="display:flex;justify-content:flex-end;margin:0 0 12px">'+btn('\u25BE Save as PDF','printCapHub()','bg2','font-size:12px')+'</div>'; /* 16 Sep 2026: the family print control; the tab showing prints */
if(data.capStale)h+=card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">The portfolio changed since allocations were last reviewed \u2013 projects moved stage, were archived, or were killed.</span>'+btn('\u2713 Mark Reviewed','data.capStale=false;saveData();render()','bs','font-size:12px')+'</div>','border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
h+=card(capCells(true)+'<div style="margin-top:10px">'+btn('\u2913 Export CSV','dlAuditCSV()','bg2','font-size:11px;padding:4px 12px')+' </div>','margin-bottom:16px');
var _ht=UI.hubTab||0;
var _htb=function(n,lbl){return'<button class="btn-ghost pad-chip-sm" style="font-size:12px;padding:5px 14px;'+(_ht===n?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.hubTab='+n+';render()">'+lbl+'</button>'};
h+='<div style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap">'+_htb(0,'Dashboard')+_htb(1,'Commitments')+_htb(2,'Plan & Funding')+'</div>';
if(_ht===0){
h+=renderCapAnalytics();
h+='<h3 class="h-sub-lg" style="margin:20px 0 4px">The Quarterly Review</h3><p class="t-faint-sm" style="margin:0 0 10px">All costs in this module are counted month by month. The two cards below add those same monthly figures into three-month blocks, because the portfolio is reviewed once a quarter (Step 4.4). Nothing here caps what a quarter may spend \u2013 the blocks are a way of reading the plan, not budgets.</p>';
var tq=thisQuarterConsumption();
var _tqc=card('<h3 class="h-sub-md">This Quarter \u2013 '+fmtQuarter(tq.qi)+'</h3>'+(tq.p.rows.length?tq.p.rows.map(function(r){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(r.name)+'</span><span class="t-faint-sm">'+r.label+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(r.amt)+'</strong></div>'}).join('')+'<div class="row-line" style="border-top:1px solid rgba(var(--fg-rgb),.12)"><span class="fs-14" style="flex:1"><strong>Total this quarter</strong></span><strong style="min-width:70px;text-align:right">'+fmtMoney(tq.p.total)+'</strong></div>':'<p class="t-faint-sm">No consumption lands in this quarter yet.</p>')+'<p class="t-faint-sm" style="margin-top:8px">For comparison: one quarter of the annual budget is '+fmtMoney(capAvailable().budget/4)+'. Running above or below that figure is not a problem in itself \u2013 it only shows whether this quarter is heavier or lighter than an even spread.</p>','margin-bottom:16px');
var _qs=orgQuarterStrip();
h+='<div class="gr-2" style="align-items:start">'+_tqc+(_qs?card('<h3 class="h-sub-md">Quarter Runway</h3>'+_qs,'margin-bottom:16px'):'')+'</div>';
}else if(_ht===1){
h+=capReadout();
var expl=stages.explore.filter(function(i){return((data.projects||{})[i]||{}).viable===true});
h+=card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential projects, no financial commitments yet) ('+expl.length+')</h3>'+(expl.length?expl.map(function(i){var c=projCosts(i);return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+(progContracted(i)?badge('Program contracted','#1B6B5A'):'')+'<span class="t-faint-sm">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'}).join(''):'<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-md" style="color:#8B5E3C">Development (Development Costs committed) ('+stages.experiment.length+')</h3>'+(stages.experiment.length?stages.experiment.map(function(i){var cS=devCost(i);var s=(trk[i]||{}).status||'';var killed=s==='killed';return'<div class="row-line"><span class="fs-14" style="flex:1'+(killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc((ideas[i]||{}).name)+'</span>'+(s?badge(killed?'killed (released)':s==='paused'?'paused (held)':s,killed?'#9B2D3F':s==='complete'?'#1B6B5A':s==='paused'?'#D4A017':'#2D5A8E'):'')+'<strong style="min-width:70px;text-align:right">'+fmtMoney(killed?0:cS)+'</strong></div>'}).join(''):'<p class="t-faint-sm">Nothing in Development.</p>'),'margin-bottom:16px');
var ops=stages.operational||[];
h+=card('<h3 class="h-sub-md" style="color:#9B2D3F">Operational (all costs committed) ('+ops.length+')</h3>'+(ops.length?ops.map(function(i){var fy=opFirstYear(i);var killed=(trk[i]||{}).status==='killed';var amt=fy?(devCost(i)+opsRolloutCost(i)):opsSustainCost(i);return'<div class="row-line"><span class="fs-14" style="flex:1'+(killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">'+(killed?'killed (released)':fy?('Development + Rollout committed'+(opsSustainCost(i)?' \u00b7 Sustainment '+fmtMoney(Math.round(opsSustainCost(i)))+'/yr from rollout\u2019s end':'')):'annual Sustainment')+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(killed?0:amt)+'</strong></div>'}).join(''):'<p class="t-faint-sm">Nothing operational yet.</p>'),'margin-bottom:16px');
var freed=Object.keys(arch).filter(function(k){return devCost(k)>0});
if(freed.length)h+=card('<h3 class="h-sub-md">Archived \u2013 costs no longer committed</h3>'+freed.map(function(k){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[k]||{}).name||('Item '+k))+'</span><span class="t-faint-sm">archived from '+arch[k].stage+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(devCost(k))+'</strong></div>'}).join(''),'margin-bottom:16px');
}else{
h+=card('<h3 class="h-sub-lg">Budget Envelope</h3>'+budgetEnvelopeRow()+fundNote()+'<p class="t-faint-sm" style="margin:10px 0 0">Single source with Step 3.2 (Plan Capacity) \u2013 these are the same fields.</p>','margin-bottom:16px');
h+=card('<h3 class="h-sub-md">Funding Plan</h3>'+fundPlanLines(),'margin-bottom:16px');
}
return h+'</div></div>'}
function renderNavDash(embedded){
var h = embedded ? '' : '<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
var ideas=data.ideas||[],stages=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{};
var nm={bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};
// Standalone page shows the hero; when embedded in the step view the step header already supplies the title.
if(!embedded) h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Pipeline <em>Dashboard</em></h1><p class="u-98b80d8">Your operational pipeline. Click any stage to manage it.</p></div>'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;margin-top:8px')+'</div>'; /* 17 Sep 2026 (Paul's ruling): the dashboard prints from its own header, as Governance\u2019s does; printCurrentPage dispatches the dashboard document */
var maturity=getPipelineMaturity();h+='<div class="viz-dash-row">'+vizHealthGauge(maturity)+vizDimBars()+'</div>';
h+='<div class="gr-2-mb">';
h+=card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(rh.duration||30)+' min \xb7 '+(rhAttNames().length?rhAttNames().map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)');
h+=card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+(gov.firstReview||'TBD')+'</div><div class="u-d431697">'+btn('\u25b6 Run Quarterly Review','go(\'review\')','bp','font-size:12px;padding:6px 14px;background:#9B2D3F')+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)');
h+='</div>';
if(data.capStale)h+=card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">\u26a0 Capital allocations need to be reviewed \u2013 the portfolio has changed since the last update.</span>'+btn('Open Capital Hub \u2192','go(\'cap-hub\')','bs','font-size:12px')+'</div>','border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
h+=pipeViz('',nm,true);
// Stage cards
h+='<div class="u-03ed01f">';
[{k:'bluesky',t:'Blue Sky',c:'#1B6B5A',nav:'out-bluesky',items:bsNowList(stages)},{k:'explore',t:'Exploration',c:'#2D5A8E',nav:'out-explore',items:stages.explore},{k:'experiment',t:'Development',c:'#8B5E3C',nav:'out-expbriefs',items:stages.experiment},{k:'operate',t:'Operational',c:'#9B2D3F',nav:'out-oper',items:stages.operational||[]}].forEach(function(s){
h+=card('<div class="flx-row-mb-12"><h3 style="font-size:15px;font-weight:700;color:'+s.c+';margin:0">'+s.t+'</h3>'+badge(s.items.length+(s.k==='operate'?' live':' items'),s.c)+'</div>'+
s.items.slice(0,3).map(function(i){var idea=ideas[i];return'<div class="u-cfcd2a9"><span>'+esc(idea?idea.name:'Item '+(i+1))+'</span></div>'}).join('')+
(s.items.length>3?'<div class="u-b9a11b1">+'+(s.items.length-3)+' more</div>':'')+
(s.items.length===0?'<p class="u-c54d0ef">No items yet.</p>':'')+
'<div class="mt-3">'+btn('View Portfolio \u2192','go(\'portfolio\',\''+s.nav+'\')','bs','font-size:11px;padding:6px 12px;width:100%')+'</div>','border-top:4px solid '+s.c)});
h+='</div>';
// Data bank
h+=renderPortfolioAnalytics().replace(/onclick="go\('(out-[a-z]+)'\)"/g,"onclick=\"go('portfolio','$1')\"") /* 17 Sep 2026 (Paul's ruling): the charts\u2019 own links open the live portfolio pages, never an earlier phase\u2019s output */;
h+=vizBalanceMap();
var _nr=nextReviewLine();if(_nr)h+=card('<div class="flx-row-mb"><h3 class="h-sub-lg" style="margin:0">Portfolio Review</h3><button class="btn-ghost pad-chip-sm" onclick="UI.expanded.navRev=!UI.expanded.navRev;render()">'+(UI.expanded.navRev?'\u25be Close':'\u25b8 Run the review')+'</button></div>'+(UI.expanded.navRev?'<div style="margin-top:10px">'+renderReviewSurface()+'</div>':'<p class="fs-14" style="margin:6px 0 0">'+_nr+'</p>'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Data Bank</h3><div class="gr-3-sm">'+[{id:'out-report',l:'Assessment Report',ic:'□',c:'var(--ph1-t)'},{id:'out-orgready',l:'Org Readiness',ic:'■',c:'var(--ph2-t)'},{id:'out-raci',l:'RACI Matrix',ic:'⊕',c:'var(--ph2-t)'},{id:'out-capplan',l:'Capital Snapshot',ic:'◆',c:'var(--ph3-t)'},{id:'out-govfw',l:'Governance',ic:'—',c:'var(--ph4-t)'},{id:'out-orgrev',l:'Org Review',ic:'✕',c:'var(--ph4-t)'}].map(function(r){return'<button onclick="go(\''+r.id+'\')" class="u-355061e"><div style="font-size:22px;line-height:1;margin-bottom:8px;color:'+r.c+'">'+r.ic+'</div><div style="font-size:13px;font-weight:600;color:'+r.c+'">'+r.l+'</div></button>'}).join('')+'</div>','background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.12)');
return h + (embedded ? '' : '</div></div></div>')}

// === OUTCOME PAGES (simplified but functional) ===
function renderOutReport(){
var co=data.completedSections||{};if(!co['1.1']||!co['1.2']||!co['1.3']||!co['1.4']||!co['1.5'])return'<h2 class="h-section-tight">Assessment Report</h2>'+card('<div class="empty-state"><p class="t-faint">Complete all 5 assessment sections first.</p></div>');
var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{};
var cultureKeys=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'];var cs=cultureKeys.map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
var gaps=Object.values(de).filter(function(d){return d&&d.gap}).length;
return'<div class="flx-row-mb-20"><div><h2 class="h-section">Assessment Report</h2><p class="t-fade-fs13">From your Assessment Battery</p></div>'+'<div style="display:flex;align-items:center;gap:10px">'+lyDepthCtl()+'<button class="btn bg2" style="font-size:12px" onclick="printReport()">\u25be Save as PDF</button>'+'</div></div>'+
card('<div class="u-e572595">Executive Summary</div><p class="t-body-paper">Organization with '+(k.usage==='none'||k.usage==='basic'?'limited':'moderate')+' AI capabilities, '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+'/30). '+gaps+' decision rights gap(s).</p>','background:rgba(27,107,90,.06);border:2px solid #1B6B5A;margin-bottom:20px')+
'<div class="u-8c6263e">'+card('<div class="t-center"><div class="score-num-go">'+cs+'/30</div><div class="t-fade-md">Culture Score</div></div>','padding:16px')+card('<div class="t-center"><div class="u-9aa6bb3">'+((cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant')+'</div><div class="t-fade-md">Risk Appetite</div></div>','padding:16px')+card('<div class="t-center"><div style="font-size:24px;font-weight:800;color:'+(gaps?'#9B2D3F':'#1B6B5A')+'">'+gaps+'</div><div class="t-fade-md">Decision Gaps</div></div>','padding:16px')+'</div>'+
card('<h3 class="h-sub-md">Purpose & Direction</h3><div class="u-2b217c4"><strong>Mission:</strong> '+esc(p.mission)+'<br/><br/><strong>Friction Points:</strong><br/><span class="u-d07753c">'+esc(p.frictions)+'</span></div>','margin-bottom:12px')+
card('<h3 class="h-sub-md">Decision Rights</h3>'+[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}].map(function(q){return'<div class="u-d92c727"><strong>'+q.l+':</strong> '+esc((de[q.k]||{}).who||'\u2014')+((de[q.k]||{}).gap?'<span class="u-61bd6e7"> ‼ '+esc(de[q.k].gap)+'</span>':'')+'</div>'}).join(''))+card('<h3 class="h-sub">Readiness Profile</h3><p class="t-fade-fs13">Scored across the five Phase 1 dimensions.</p>'+vizRadarLarge(getAssessmentScores()),'margin-top:20px;padding:24px;background:rgba(var(--fg-rgb),.02)')}
function renderOutBluesky(){
var ideas=data.ideas||[],as=data.assessments||{};
var bsAll=getStages().bluesky;
var bsNow=bsAll.filter(function(i){return(ideas[i]||{}).when!=='future'});
var bsFut=bsAll.filter(function(i){return(ideas[i]||{}).when==='future'});
var rows=bsNow.map(function(i){var idea=ideas[i]||{},a=as[i]||{};var allG=a.techCapable!==undefined&&a.resourcesAvailable!==undefined&&a.culturalFit!==undefined&&a.purposeAligned!==undefined&&a.affordable!==undefined;var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;var disq=allG&&!feasible;var score=feasible?triageScore(i):null;return{i:i,idea:idea,a:a,score:score,disq:disq,feasible:feasible,g:disq?2:(score!==null?0:1)}}).sort(function(x,y){return x.g!==y.g?x.g-y.g:(y.score||0)-(x.score||0)});
var h='<h2 class="h-section">Blue Sky Portfolio</h2><p class="t-lead">Ideas ranked by Filter &amp; Rank score. Expand a card to qualify, score, and select ideas for Exploration.</p>'+pipeViz('bluesky');
h+=outputPrintRow('out-bluesky'); /* 16 Sep 2026: the print control */
h+='<div class="mb-5">'+btn(UI.addForm?'Cancel':'+ Add New Idea','UI.addForm=!UI.addForm;UI.ec=null;UI.icDraft=null;render()','bs','font-size:13px')+'</div>';
if(UI.addForm)h+=renderIdeaForm();
h+=bsLegend();
var divDone=false;
rows.forEach(function(r){var idea=r.idea;var open=!!UI.expanded['bs'+r.i];
var col=r.disq?'#9B2D3F':'#1B6B5A';
if(r.disq&&!divDone){h+='<div class="t-faint-sm" style="margin:14px 0 8px;letter-spacing:.06em">DID NOT PASS QUALIFICATION</div>';divDone=true}
var head='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bs'+r.i+'\']=!UI.expanded[\'bs'+r.i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+(r.disq?badge('Disqualified','#9B2D3F'):badge('Now','#1B6B5A'))+'<span id="scoreOut_'+r.i+'" data-sflav="bs">'+(r.score!==null?'<span style="font-weight:700;font-size:14px;color:'+col+'">'+r.score+'<span style="font-size:11px;color:var(--text-faint)">/50</span></span>':r.disq?'':'<span class="t-faint-sm">unscored</span>')+'</span></div>';
var body='';
if(open){body='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(r.i)
+'<div class="pill-row">'+[{k:'techCapable',l:'Tech?'},{k:'resourcesAvailable',l:'Resources?'},{k:'culturalFit',l:'Culture?'},{k:'purposeAligned',l:'Purpose?'},{k:'affordable',l:'Affordable?'}].map(function(g){var v=r.a[g.k];return'<button onclick="toggleGate('+r.i+',\''+g.k+'\')" class="gate-btn'+(v===true?' pass':v===false?' fail':'')+'">'+(v===true?'\u2713':v===false?'\u2717':'\u25cb')+' '+g.l+'</button>'}).join('')+'</div>'
+(r.feasible?'<div class="u-46b97fa">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(d){return'<div><label class="t-faint-sm">'+d.l+'</label><input type="number" min="0" max="10" id="score_'+r.i+'_'+d.k+'" value="'+(r.a[d.k]!=null?r.a[d.k]:'')+'" onchange="saveScore('+r.i+',\''+d.k+'\')" class="score-mini"/></div>'}).join('')+'</div>':'')
+(r.feasible?'<div style="margin-top:6px">'+'<button onclick="askAdvanceIdea('+r.i+')" style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--text-faint)">Advance to Exploration Portfolio</button>'+'</div>':'')
+(r.disq?'<p class="t-faint-sm" style="margin-top:8px">Failed one or more feasibility gates. Change a gate above to requalify, or archive it.</p>':'')
+'<div style="margin-top:10px">'+archBtn(r.i)+'</div></div>'}
h+=card(head+body,'border-left:4px solid '+col+';margin-bottom:10px'+(r.disq?';background:rgba(155,45,63,.04)':'')+(open?'':';cursor:pointer'),xpandAttr('bs'+r.i,open))});
if(!ideas.length)h+=card('<div class="empty-state"><p class="t-faint">No ideas in the Blue Sky portfolio yet. Click + Add New Idea to capture your first use case.</p></div>');
else if(!rows.length)h+=card('<div class="empty-state"><p class="t-faint">'+(bsFut.length?'All remaining ideas are parked as Future \u2013 expand the Ideas for the Future section below, or move one to Now to work on it here.':'All current ideas have advanced to Exploration \u2013 add a new idea to keep the intake full.')+'</p></div>');
if(bsFut.length){var fOpen=!!UI.expanded.bsFold;
h+='<div class="u-3ae1f62"><button class="btn-ghost pad-chip-sm" style="color:#2D5A8E;border-color:rgba(45,90,142,.4)" onclick="UI.expanded.bsFold=!UI.expanded.bsFold;render()">'+(fOpen?'\u25be':'\u25b8')+' Ideas for the Future ('+bsFut.length+')</button>';
if(fOpen){bsFut.forEach(function(i){var idea=ideas[i]||{};var fo=!!UI.expanded['bsf'+i];
var fhead='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bsf'+i+'\']=!UI.expanded[\'bsf'+i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(fo?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+badge('Future','#2D5A8E')+'</div>';
var fbody=fo?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(i)+'<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+btn('\u2192 Move to Now','moveIdeaToNow('+i+')','bs','font-size:12px')+archBtn(i)+'</div><p class="t-faint-sm" style="margin-top:8px">Moving to Now returns this idea to the ranked list above, where it can be qualified, scored, and selected.</p></div>':'';
h+=card(fhead+fbody,'border-left:4px solid #2D5A8E;margin-bottom:10px'+(fo?'':';cursor:pointer'),xpandAttr('bsf'+i,fo))})}
h+='</div>'}
h+=balancePanel(bsNow,'bluesky');
if(bsFut.length)h+='<p class="t-faint-sm" style="margin-top:-10px;margin-bottom:16px">Counts and balance cover Now ideas only \u2013 Future ideas join when moved to Now.</p>';
h+=archivePanel(['bluesky'],'obs');
return h}
function moveIdeaToNow(i){if(!data.ideas||!data.ideas[i])return;data.ideas[i].when='now';Store.commit('ideas');UI.expanded['bs'+i]=true;render()}
function renderOutOrgReady(){
var co=data.completedSteps||{};if(!(co['2.1']&&co['2.2']&&co['2.3']))return'<h2 class="h-section-tight">Org Readiness</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Steps 1\u20133 first.</p></div>');
var M=orgReadinessModel(),ow=M.ow,inc=M.inc,full=true; /* 17 Sep 2026 (Paul's ruling): one definitive version; the page shows everything */
var fig=function(v,l){return '<div class="t-center" style="flex:1;min-width:120px"><div class="score-num-md" style="font-size:26px">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
var h='<div class="flx-row-mb-20"><div><h2 class="h-section">Org Readiness Summary</h2><p class="t-fade-fs13">From Phase 2, Steps 1\u20133</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printOrgReady()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-7d1bdc0">Summary</div><p class="t-body-paper">'+esc(M.summary)+'</p>','background:rgba(45,90,142,.06);border:2px solid #2D5A8E;margin-bottom:20px');
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.leads.length,'Embedded leads')+fig(M.metrics.length,'Innovation metrics')+fig(M.done+' / '+M.chk.length,'Readiness checks')+'</div>','margin-bottom:16px'); /* the figures the document opens with */
h+=card('<h3 class="h-sub-lg">Organizational Readiness Checklist</h3>'+M.chk.map(function(c,i){return'<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:'+(i<M.chk.length-1?'1px solid rgba(var(--fg-rgb),.04)':'none')+'"><div style="width:20px;height:20px;border-radius:10px;background:'+(c.d?'#1B6B5A':'rgba(var(--fg-rgb),.06)')+';color:'+(c.d?'#fff':'#ccc')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">'+(c.d?'\u2713':'\u25cb')+'</div><div style="flex:1"><span style="font-size:13px;color:'+(c.d?'var(--paper)':'var(--text-faint)')+'">'+c.l+'</span>'+(full?'<div class="t-faint-sm" style="margin-top:3px">'+esc(c.ev)+'</div>':'')+'</div></div>'}).join('')+'<p class="t-faint-sm" style="margin-top:12px">'+M.done+' of '+M.chk.length+' complete ('+M.pct+'%)</p>','margin-bottom:20px');
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Pipeline Owner</h3><p class="fs-13"><strong>'+esc(ow.ownerName)+'</strong> ('+esc(ow.ownerRole)+')<br/>'+esc(ow.authority)+'</p>')+card('<h3 class="h-sub-md">Innovation Rhythm</h3><p class="fs-13">Every <strong>'+esc(M.rh.day)+'</strong> at '+esc(M.rh.time||'TBD')+'<br/>'+esc(M.att.join(', '))+(full&&M.agenda.length?'<br/><strong>Agenda:</strong> '+esc(M.agenda.join('; ')):'')+'</p>')+'</div>';
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Embedded Leads</h3><p class="fs-13">'+(M.leads.length?M.leads.map(function(l){return esc(l.name||'Unnamed')+(full&&l.dept?' <span class="t-faint-sm">\u2014 '+esc(l.dept)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>')+(full?card('<h3 class="h-sub-md">Engaged Senior Leaders</h3><p class="fs-13">'+(M.seniors.length?M.seniors.map(function(l){return esc(l.name||'Unnamed')+(l.role?' <span class="t-faint-sm">\u2014 '+esc(l.role)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>'):'')+'</div>';
h+=card('<h3 class="h-sub-md">Incentive Changes</h3><p class="fs-13"><strong>From:</strong> '+esc(inc.current)+'<br/><strong>To:</strong> '+esc(inc.changes)+'<br/><strong>Metrics:</strong> '+esc(M.metrics.join(', ')||'None selected')+'</p>');
return h} /* 17 Sep 2026 (Paul's ruling): the figures and the checklist under the summary; Summary / Full — Full adds the senior leaders, the leads' departments, the agenda, and the evidence beneath each check */
function renderOutGovFW(){
var co=data.completedSteps||{};if(!co['4.2'])return'<h2 class="h-section-tight">Governance Framework</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 2 first.</p></div>');
var gov=data.governance||{};
var h='<div class="flx-between-top-mb"><div>'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Governance Framework</h2><p class="t-stone-sm">Three mechanisms for sustainable innovation</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printGovFW()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-dcfde71">Executive Summary</div><p class="u-ef1e93b">Governance embedded across three mechanisms: standing agenda in <strong>'+esc(gov.meeting||'leadership meetings')+'</strong>, gate reviews above <strong>'+esc(gov.threshold||'threshold')+'</strong>, quarterly reviews from <strong>'+esc(gov.firstReview||'TBD')+'</strong>.</p>','background:rgba(155,45,63,.04);border:1px solid rgba(155,45,63,.2);margin-bottom:20px');
var pillars=[{ic:'—',t:'Standing Leadership Agenda',c:'#1B6B5A',items:[{l:'Embedded in',v:gov.meeting},{l:'Metrics',v:gov.metrics||'\u2014'},{l:'Format',v:gov.format||'\u2014'}]},{ic:'◉',t:'Pipeline Intake Rule',c:'#2D5A8E',items:[{l:'Threshold',v:gov.threshold},{l:'Review process',v:gov.gateProcess||'\u2014'},{l:'Outside-pipeline audit',v:gov.outsideAudit||'\u2014'}]},{ic:'■',t:'Quarterly Review',c:'#8B5E3C',items:[{l:'Attendees',v:gov.reviewAttendees},{l:'Agenda',v:gov.reviewAgenda||'\u2014'},{l:'First review',v:gov.firstReview||'\u2014'}]}];
pillars.forEach(function(p){h+=card('<div class="u-9cd32e3"><span class="u-fcc53cb">'+p.ic+'</span><h3 class="u-534d57b">'+p.t+'</h3></div>'+p.items.map(function(it){return'<div class="u-a67e826"><div style="font-family:var(--mono);font-size:10px;font-weight:700;color:'+p.c+';text-transform:uppercase;letter-spacing:.1em;min-width:110px;padding-top:2px">'+it.l+'</div><div class="u-2131614">'+esc(it.v)+'</div></div>'}).join(''),'border-left:3px solid '+p.c+';margin-bottom:12px')});
h+='</div>';
return h}
function renderOutOrgRev(){
var co=data.completedSteps||{};if(!co['4.3'])return'<h2 class="h-section-tight">Org Design Review</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 3 first.</p></div>');
var stress=data.stress||{};
return'<h2 class="h-section-loose">Organizational Design Review</h2>'+outputPrintRow('out-orgrev')+'<div class="gr-2-mb-5">'+
[{k:'decisions',l:'Decision Rights',ic:'◉'},{k:'ownership',l:'Ownership Model',ic:'+'},{k:'incentives',l:'Incentive Changes',ic:'▒'},{k:'culture',l:'Culture Shift',ic:'◉'}].map(function(q){var sc=stress[q.k+'Score']||0;return card('<div class="flx-center gap-2 mb-2"><span>'+q.ic+'</span><div class="u-2e5190f">'+q.l+'</div><div style="margin-left:auto;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':'rgba(155,45,63,.06)')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':'#9B2D3F')+'">'+sc+'/5</div></div><p class="t-soft-13">'+esc(stress[q.k]||'\u2014')+'</p>')}).join('')+'</div>'+
card('<h3 class="h-sub-md">Adjustment Plan</h3>'+(stress.tuningList||[]).filter(function(t){return t}).map(function(t,i){return'<div class="u-ebfe612"><strong class="u-d6ff56e">'+(i+1)+'.</strong> '+esc(t)+'</div>'}).join(''),'border:2px solid #9B2D3F')}
function renderOutCapplan(){var cap=data.capital||{};
if(!cap.aiBudget)return'<h2 class="h-section-tight">Capital Snapshot</h2>'+card('<div class="empty-state"><p class="t-faint">Set your AI Projects Budget at Step 3.2.</p></div>');
var av=capAvailable(),ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},trk=data.tracking||{};
var h='<div class="flx-between-top-mb"><div>'+badge('Phase 3 Output','#8B5E3C')+'<h2 class="h-big">Capital Snapshot</h2><p class="t-stone-sm">'+capSnapLead()+'</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printCapPlan()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-64e97f0">Financial Summary</div>'+capCells(false)+((cap.reallocation||cap.gapPlan||cap.killNotes||killPotRows().length)?'<div class="gr-2" style="margin-top:12px">'+((cap.killNotes||killPotRows().length)?'<div><div class="t-faint-sm">KILL & PHASE-OUT POT \u2013 '+fmtMoney(killPotTotal())+'</div>'+killPotRows().map(function(r){return'<p class="fs-14" style="margin:4px 0 0">'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+' <span class="t-faint-sm">(Year '+killPotYearOf(r)+')</span></p>'}).join('')+(cap.killNotes?'<p class="fs-14" style="margin:4px 0 0">'+esc(cap.killNotes)+'</p>':'')+'</div>':'')+(cap.reallocation?'<div><div class="t-faint-sm">REALLOCATION SOURCES</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.reallocation)+'</p></div>':'')+(cap.gapPlan?'<div><div class="t-faint-sm">FUNDING GAP & PLAN</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.gapPlan)+'</p></div>':'')+'</div>':''),'background:rgba(139,94,60,.04);border:1px solid rgba(139,94,60,.2);margin-bottom:16px');
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
if(orgMonthly()){h+=capKpiStrip();h+=card('<h3 class="h-sub-md">The Committed Calendar</h3>'+orgSwimlanes(),'margin-bottom:16px');h+=card('<h3 class="h-sub-md">Capacity Waterfall</h3>'+orgWaterfallChart(),'margin-bottom:16px')}
h+=card('<h3 class="h-sub-md" style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>'+(devRows.length?devRows.map(function(i){var cS=devCost(i),c=projCosts(i);return'<div style="padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div class="flx-row-mb"><h4 class="h-card" style="flex:1">'+esc((ideas[i]||{}).name)+'</h4><span class="t-faint-sm">Development '+fmtMoney(cS)+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'+progSnapRO(i)+'</div>'}).join(''):'<p class="t-faint-sm">Nothing in Development at this snapshot.</p>'),'margin-bottom:16px');
var ops=stages.operational||[];
h+=card('<h3 class="h-sub-md" style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>'+(ops.length?(function(){var _cr=capCommitments().rows;return ops.filter(function(i){return(trk[i]||{}).status!=='killed'}).map(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var amt=r?r.amt:0,lbl=r?r.label:'Full plan';return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">'+lbl+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(amt)+'</strong></div>'}).join('')})():'<p class="t-faint-sm">Nothing operational at this snapshot.</p>'),'margin-bottom:16px');
var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+=card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>'+(opts.length?opts.map(function(i){var c=projCosts(i);return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+(progContracted(i)?badge('Program contracted','#1B6B5A'):'')+badge(getScore(i)+'/50','#2D5A8E')+'<span class="t-faint-sm">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'}).join(''):'<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'));
return h}
// === MAIN RENDER ===

// === PDF EXPORT FUNCTIONS ===
function printThemeTokens(){
// Print windows are bare (no styles.css), so the swept var() references need
// definitions. Print is always the light theme. Shadows are suppressed for paper;
// font tokens are included so mono/serif stamps keep their faces in print.
return ':root{--ink:#F4F6F9;--paper:#1E2530;--bg-rgb:244,246,249;--fg-rgb:30,37,48;'+
'--stone:#4E5A68;--text-muted:#4E5A68;--text-fade:#64707E;--text-faint:#7E8B99;'+
'--faint-rgb:126,139,153;--ref-accent:#0A7FB5;'+
'--text-body:#39434F;--text-mid:#47525F;--text-hint:#2A3542;--text-bright:#273240;--text-soft:#3F4A58;--text-max:#1E2530;'+
'--bg-elev:#FFFFFF;--menu-bg:#FFFFFF;--menu-fg:#1E2530;--warn-text:#8F6A00;--warn-pale:#7E6A00;'+
'--ph1-t:#1B6B5A;--ph2-t:#2D5A8E;--ph3-t:#8B5E3C;--ph4-t:#9B2D3F;--ph5-t:#6B4C8A;'+
'--gold:#E8621A;--gold-rgb:232,98,26;--gold-light:#F07A37;--gold-pale:#FDE8D8;--navy:#1E2530;--rule:rgba(15,45,74,.32);--rule-rgb:15,45,74;--head-blue:#076D9E;--gold-text:#B34208;'+
'--ph1:#1B6B5A;--ph2:#2D5A8E;--ph3:#8B5E3C;--ph4:#9B2D3F;--ph5:#6B4C8A;'+
'--surface:rgba(var(--fg-rgb),.06);--border-faint:rgba(var(--fg-rgb),.12);--border-soft:rgba(var(--fg-rgb),.08);'+
'--border-softer:rgba(var(--fg-rgb),.06);--bg-card:rgba(var(--fg-rgb),.03);--bg-card-hover:rgba(232,98,26,.04);'+
'--bg-input:rgba(var(--fg-rgb),.06);--shadow-card:none;--shadow-elev:none;'+
"--serif:'Cormorant Garamond',Georgia,serif;--mono:'DM Mono',Menlo,Consolas,monospace;--sans:'Helvetica Neue',Arial,sans-serif}";
}

var PRINT_MODULE_NAME='90-Day AI Innovation Pipeline'; /* 16 Sep 2026 (Paul's ruling, family): the cover's kicker takes the Governance form — 90-Day and the module's name; the home page reads 90 Days to an AI Innovation Pipeline */

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'} /* the same words as the site footer at nextchapter.org */
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank — ported to the Innovation Pipeline 16 Sep 2026 (Paul's ruling: the cover as Governance has it) */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'} /* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
function _pdStrip(body){ /* the screen's heading block (title, lead, print control) comes off so the title lives on the cover only; every button goes */
  var m=body.indexOf('PDF</button></div>');if(m>=0)body=body.slice(m+18);
  return body.replace(/<button[\s\S]*?<\/button>/g,'')}
function _pdLead(body){var m=body.indexOf('PDF</button></div>');if(m<0)return '';var head=body.slice(0,m);var p=head.match(/<p[^>]*>([\s\S]*?)<\/p>/);return p?p[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim():''} /* the lead is the screen's own sub-line */
function printPage(title,contentFn){var raw=contentFn();printDocument(title,printDocCover(title,_pdLead(raw),'')+_pdStrip(raw),'')} /* 12 Sep 2026 (Paul's ruling): a cover, then the body without its heading */
function printDocument(title,content,extraCss,opts){ /* 14 Sep 2026: opts.preview shows the document as a sheet with its forced page breaks marked and a Show as pages button, and does not open the print dialog */ /* 13 Sep 2026: the shared print window – the family styles, an optional stylesheet for bespoke report documents, the content, the footer */
var w=window.open('');if(!w){alert('The print view was blocked by the browser. Allow pop-ups for this site and try again.');return}
w.document.write('<html><head><title>'+title+'</title>'+
'<link rel="stylesheet" href="'+(function(){try{return new URL('fonts/fonts.css', location.href).href}catch(e){return 'fonts/fonts.css'}})()+'">'+
'<style>'+printThemeTokens()+'*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Helvetica Neue",Arial,sans-serif;max-width:750px;margin:40px auto;padding:0 40px;line-height:1.7;font-size:14px;color:#1e2530;background:#fff}'+
'h1,h2,h3,h4{color:#1a1612;break-after:avoid;page-break-after:avoid}a{color:#2D5A8E}'+
'.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none !important}button{display:none !important}'+
'.cd{background:none;border:none;border-radius:0;padding:8px 0;margin-bottom:14px;page-break-inside:avoid}'+
'select{-webkit-appearance:none;appearance:none;border:none;background:none;font-weight:600;font-size:13px;color:#1a1612}textarea{border:none;background:none;font-size:13px;color:#1e2530;resize:none}'+
'table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e0e0e0;text-align:left}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact}[style*="#F5F2EC"],[style*="#8A8278"],[style*="rgba(245,242,236"],[style*="rgba(138,130,120"],[style*="color:var(--paper)"]{color:#1e2530 !important}[style*="color:var(--stone)"],[style*="color:var(--text-muted)"],[style*="color:var(--text-faint)"]{color:#555 !important}@media print{body{margin:0;padding:0}}'+
'@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}@top-center{content:""}@top-right{content:""}@bottom-center{content:""}@bottom-left{content:"'+printFooterText()+'";font:9px "DM Mono",monospace;color:#666}@bottom-right{content:counter(page) " / " counter(pages);font:9px "DM Mono",monospace;color:#666}}'+ /* PRINT MARGINS (Paul's ruling, 12 Sep 2026; family): the document owns all six page corners — the top three empty, the copyright line bottom left, the page number bottom right — so the browser's own date, title, address, and count never print, whatever the user's Headers and footers setting */
'.print-footer{display:none}@media screen{.print-footer{display:block;margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:"DM Mono",monospace;font-size:9px;letter-spacing:.06em;color:#666}}'+ /* on screen, before printing, the copyright line ends the document */
(extraCss||'')+'</style></head><body>'+((opts&&opts.preview)?'<div class="preview-note" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:12px/1.5 var(--sans,sans-serif);color:#333;background:#FBF6EC;border:1px solid #E8D9B8;padding:8px 12px;margin:0 0 24px"><button onclick="window.print()" style="font:12px var(--sans,sans-serif);font-weight:600;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;color:#111;cursor:pointer;white-space:nowrap">Show as pages</button><span style="flex:1;min-width:240px">Preview. Dashed rules below mark where the document forces a page break; where the printer breaks a long section in the middle is set when it prints. Show as pages opens your browser\u2019s print preview, where the pages are exact, and Cancel returns here.</span></div>'+'<style>@media print{.preview-note{display:none}}@media screen{html{background:#e6e6e6}body{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 32px rgba(0,0,0,.08);padding:56px 64px !important;margin:24px auto !important}[style*="break-before:page"]::before,[style*="page-break-after:always"]:not([style*="display:flex"])::after,[style*="min-height:85vh"]+*::before{content:"page break";display:block;text-align:center;font:10px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;border-top:1px dashed #bbb;padding-top:6px;margin:28px 0 24px}[style*="page-break-after:always"]+[style*="break-before:page"]::before{display:none}}</style>':'')+content+'<div class="print-footer">'+printFooterText()+'</div></body></html>');
w.document.close();if(!(opts&&opts.preview))setTimeout(function(){w.print()},500)}

function printReport(){printDocument('Assessment Report',assessmentReportDoc(),'')} /* 16 Sep 2026: the composed document, not the page */

function printOrgReady(){printDocument('Org Readiness',orgReadinessDoc(),'')} /* 16 Sep 2026: the composed document, not the page */

function printCapPlan(){printDocument('Capital Snapshot',printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody(),CAP_REPORT_CSS)} /* CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026): its own document – every budget year, then the total */
/* ── CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026) ──────────────────────────────
   The printed snapshot is its own document rendered from the data, never the screen cleaned up.
   One section per budget year, then a Budget Total section. Each section opens with its
   Financial Summary, the three KPI tiles, that year's committed calendar, and its capacity
   waterfall (the last thing on the section's first page); the committed lists begin on a
   new page. Year sections show what lands in that year; the Total section shows the whole
   plan, the program phases, and the Exploration pipeline. */
function capSnapLead(){return'A point-in-time picture of a fluid state, taken '+fmtDate(new Date())+' ('+fmtQuarter(fyQuarterOf(new Date()))+'). Commitments move as the portfolio moves \u2013 this page is a snapshot, not an end-of-task deliverable.'}
var CAP_REPORT_CSS='.cr-sec{page-break-before:always}.cr-hk{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 6px}.cr-h{font-family:var(--serif,Georgia,serif);font-size:30px;font-weight:600;color:#111;margin:0 0 8px;line-height:1.15}.cr-rule{border-top:2px solid #111;margin:0 0 18px}'
+'.cr-fin{border:1px solid rgba(139,94,60,.35);background:rgba(139,94,60,.05);border-radius:8px;padding:16px 18px;margin:0 0 14px;page-break-inside:avoid}.cr-fin-k{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 12px}'
+'.cr-cells{display:flex;gap:14px}.cr-cell{flex:1;text-align:center}.cr-num{font-size:26px;font-weight:800;color:#2D5A8E;line-height:1.1}.cr-lbl{font-size:12px;color:#4E5A68;margin-top:4px}'
+'.cr-note{font-size:12px;color:#39434F;margin:12px 0 0;line-height:1.5}.cr-note2{font-size:11.5px;color:#64707E;margin:4px 0 0;line-height:1.5}.cr-fin-x{display:flex;gap:18px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(139,94,60,.25)}.cr-fin-x>div{flex:1}.cr-fin-xk{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64707E;margin:0 0 3px}.cr-fin-x p{font-size:12px;margin:2px 0 0;color:#1E2530}'
+'.cr-kpis{display:flex;gap:10px;margin:0 0 14px;page-break-inside:avoid}.cr-kpi{flex:1;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(30,37,48,.16);border-radius:10px;background:#fff}.cr-kpi-l{font-size:13px;font-weight:700;color:#1E2530}.cr-kpi-s{font-size:11.5px;color:#4E5A68}.cr-kpi-n{font-size:22px;font-weight:800;line-height:1;flex-shrink:0}'
+'.cr-card{border:1px solid rgba(30,37,48,.14);border-radius:8px;padding:12px 14px;margin:0 0 14px;page-break-inside:avoid}.cr-card h3{font-size:15px;font-weight:700;color:#1E2530;margin:0 0 8px}.cr-cap{font-size:11px;color:#4E5A68;margin-top:6px;line-height:1.5}.cr-sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:middle}'
+'.cr-lists{page-break-before:always}.cr-list{margin:0 0 18px}.cr-list h3{font-size:16px;font-weight:700;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(30,37,48,.15)}.cr-item{padding:8px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-item-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.cr-item-h h4{font-size:14px;font-weight:700;margin:0;color:#1E2530}.cr-item-m{font-size:12px;color:#4E5A68;white-space:nowrap}.cr-item-y{font-size:12.5px;color:#1E2530;margin:3px 0 0}.cr-item-y strong{color:#8B5E3C}'
+'table.cr-t{width:100%;border-collapse:collapse;margin:8px 0 2px;font-size:12px}table.cr-t th{text-align:left;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64707E;font-weight:500;padding:4px 8px 4px 0;border-bottom:1px solid rgba(30,37,48,.15)}table.cr-t td{padding:5px 8px 5px 0;border-bottom:1px solid rgba(30,37,48,.07);vertical-align:top;color:#1E2530}table.cr-t td.r,table.cr-t th.r{text-align:right;padding-right:0}'
+'.cr-row{display:flex;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-row .n{flex:1;font-size:13.5px;color:#1E2530}.cr-row .m{font-size:12px;color:#4E5A68}.cr-row .a{min-width:70px;text-align:right;font-weight:700;color:#1E2530}.cr-badge{display:inline-block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.08em;padding:2px 7px;border-radius:10px;color:#fff;margin-right:6px;vertical-align:middle}.cr-empty{font-size:12.5px;color:#64707E}';
/* the shared KPI derivation: the same figures the screen's capKpiStrip shows, for one lens (a year number or 'T') */
function capKpiData(sel){var yt=orgYearTotals();if(!yt||!yt.length)return null;var cap=data.capital||{};var Y=envYearsOf();
if(sel==null)sel=1;var isT=sel==='T';if(!isT&&!(sel>=1&&sel<=Y))sel=1;
var r;if(isT){var _b=0,_t=0,_rs=0,_su=0;yt.forEach(function(x){_b+=x.budget;_t+=x.total;_rs+=(x.reserve||0);_su+=x.sus});r={budget:_b,total:_t,headroom:_b-_t,reserve:_rs,sus:_su,susShare:_t?_su/_t:0,capPct:0}}else r=yt[sel-1];
var lblY=isT?'all years':'Year '+sel;var pctC=r.budget?Math.min(1,r.total/r.budget):0;var scp=parseFloat(cap.susCap);
return{sel:sel,isT:isT,r:r,lblY:lblY,
t1:{f:pctC,c:pctC>.85?'#D4A017':'#45A188',label:'Committed, '+lblY,sub:fmtMoney(r.total)+' of '+fmtMoney(r.budget)},
t2:{v:fmtMoney(r.headroom),neg:r.headroom<0,label:'Headroom, '+lblY,sub:(r.reserve?fmtMoney(r.headroom-r.reserve)+' net of the intake reserve':'available for new projects')},
t3:{f:(!isT&&scp>0)?Math.min(1,r.capPct):r.susShare,c:(!isT&&scp>0&&r.capPct>1)?'#D4A017':'#C25B73',label:isT?'Sustainment share':'Sustainment vs cap',sub:(isT?Math.round(r.susShare*100)+'% of all committed':(scp>0?Math.round(r.susShare*100)+'% of Year '+sel+' \u00b7 cap '+scp+'%':Math.round(r.susShare*100)+'% of Year '+sel))}}}
/* per-item money landing in program months a..b (inclusive), from the same monthly series the charts use */
function capReportItemYear(e,a,b){var M=envYearsOf()*12;var s=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var o={dev:0,roll:0,sus:0};for(var m=a;m<=b&&m<=M;m++){o.dev+=s[m-1].dev;o.roll+=s[m-1].roll;o.sus+=s[m-1].sus}o.dev=Math.round(o.dev);o.roll=Math.round(o.roll);o.sus=Math.round(o.sus);o.total=o.dev+o.roll+o.sus;return o}
function capReportArc(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(30,37,48,.10)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#1E2530">'+Math.round(f*100)+'%</text></svg>'}
/* the committed calendar for program months a..b: one lane per committed item active in the window, segments clipped to it */
function capReportLanes(a,b){var M=envYearsOf()*12,ideas=data.ideas||[];var n=b-a+1;var C={dev:'#45A188',roll:'#5B8DD9',sus:'#C25B73'};
var lanes=[];orgCommittedSet().filter(function(e){return !e.sunk}).forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null);var segs=[];['dev','roll','sus'].forEach(function(k){var st=0;for(var m=a;m<=b+1;m++){var on=m<=b&&m<=M&&s2[m-1][k]>0.5;if(on&&!st)st=m;if(!on&&st){segs.push({k:k,a:st,b:m-1});st=0}}});
if(segs.length)lanes.push({name:(ideas[e.i]||{}).name||('Item '+e.i),legacy:!!((((data.projects||{})[e.i])||{}).legacy),segs:segs})});
if(!lanes.length)return'<p class="cr-empty">Nothing committed lands in these months.</p>';
var shown=lanes.slice(0,12);var W=720,LH=22,pad=170,Hh=shown.length*LH+30,cw=(W-pad-16)/n;
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
for(var g=0;g<=n;g++){var gx=pad+g*cw;h+='<line x1="'+gx.toFixed(1)+'" y1="2" x2="'+gx.toFixed(1)+'" y2="'+(Hh-18)+'" stroke="rgba(30,37,48,'+((g%(n>12?6:3))===0?'.14':'.05')+')"/>'}
shown.forEach(function(L,ix){var y=4+ix*LH;
h+='<text x="'+(pad-8)+'" y="'+(y+12)+'" text-anchor="end" font-size="10" fill="#39434F">'+esc(L.name.length>26?L.name.slice(0,25)+'\u2026':L.name)+(L.legacy?' \u25c6':'')+'</text>';
L.segs.forEach(function(sg){var x=pad+(sg.a-a)*cw,w=Math.max(2,(sg.b-sg.a+1)*cw);h+='<rect x="'+x.toFixed(1)+'" y="'+(y+2)+'" width="'+w.toFixed(1)+'" height="13" rx="3" fill="'+C[sg.k]+'"/>'})});
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*cw).toFixed(1)+'" y="'+(Hh-6)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
if(lanes.length>shown.length)h+='<div class="cr-cap">+'+(lanes.length-shown.length)+' more committed items not shown</div>';
h+='<div class="cr-cap">One lane per committed item \u00b7 program months '+a+'\u2013'+b+' \u00b7 <span class="cr-sw" style="background:#45A188;margin-left:0"></span>development <span class="cr-sw" style="background:#5B8DD9"></span>rollout <span class="cr-sw" style="background:#C25B73"></span>sustainment'+(shown.some(function(L2){return L2.legacy})?' \u00b7 \u25c6 legacy':'')+'</div>';
return h}
/* the capacity waterfall for program months a..b, on a scale shared by every section (mx) so the years read against each other */
function capReportWaterfall(a,b,mx){var srs=orgMonthly();if(!srs)return'';var CD='#45A188',CR='#5B8DD9',CS='#C25B73';var n=b-a+1;
if(!mx)return'<p class="cr-empty">Nothing committed yet \u2013 the first batch draws the first bars.</p>';
var W=720,Hh=190,pad=28,bw=(W-pad*2)/n,base=Hh-24;var sy=function(v){return (Hh-52)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="rgba(30,37,48,.25)"/>';
for(var m=a;m<=b;m++){var r=srs[m-1];if(!r)continue;var ix=m-a;var x=pad+ix*bw+bw*.15,w=Math.max(1,bw*.7);var yy=base;
if(r.sus>0){var yS=sy(r.sus);yy-=yS;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yS.toFixed(1)+'" fill="'+CS+'"/>'}
if(r.roll>0){var yR=sy(r.roll);yy-=yR;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yR.toFixed(1)+'" fill="'+CR+'"/>'}
if(r.dev>0){var yD=sy(r.dev);yy-=yD;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yD.toFixed(1)+'" fill="'+CD+'"/>'}}
var pts='';for(var m2=a;m2<=b;m2++){var sc=capSusCapLine(m2);if(sc>0){var x1=pad+(m2-a)*bw,x2=pad+(m2-a+1)*bw,cy=base-sy(sc);pts+=(pts===''?'M':'L')+x1.toFixed(1)+' '+cy.toFixed(1)+'L'+x2.toFixed(1)+' '+cy.toFixed(1)}}
if(pts)h+='<path d="'+pts+'" fill="none" stroke="#B8860B" stroke-width="1.5" stroke-dasharray="4,3"/>';
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*bw).toFixed(1)+'" y="'+(Hh-10)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
h+='<div class="cr-cap"><span class="cr-sw" style="background:'+CD+';margin-left:0"></span>Development <span class="cr-sw" style="background:'+CR+'"></span>Rollout <span class="cr-sw" style="background:'+CS+'"></span>Sustainment \u00b7 program months '+a+'\u2013'+b+(pts?'<br/><span style="display:inline-block;width:18px;border-top:2px dashed #B8860B;margin:0 4px 0 0;vertical-align:middle"></span> The dashed line is the sustainment cap \u2013 the run-cost ceiling for the year, at its monthly rate':'')+'</div>';
return h}
/* one section: a budget year (y = 1..Y) or the total (y = 'T') */
function capReportSection(y,L,mx,idx,count){var Y=envYearsOf(),cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},proj=data.projects||{};
var isT=y==='T';var a=isT?1:(y-1)*12+1,b=isT?Y*12:y*12;var d=isT?L.tot:L.years[y-1];
var h='<div class="'+(idx?'cr-sec':'')+'">';
h+='<div class="cr-hk">Capital Snapshot \u00b7 section '+(idx+1)+' of '+count+'</div><div class="cr-h">'+(isT?'Budget Total \u2013 '+Y+' years':'Budget Year '+y)+'</div><div class="cr-rule"></div>';
/* Financial Summary */
var cells=[{v:fmtMoney(d.budget),l:isT?'Budget \u2013 '+Y+' years':'Budget, Year '+y},{v:'\u2212 '+fmtMoney(d.committed),l:'Committed'}];
if(d.killPot)cells.push({v:'\u2212 '+fmtMoney(d.killPot),l:'Kill & phase-out'});
cells.push({v:fmtMoney(d.available),l:'Available',c:d.available<0?'#9B2D3F':'#1B6B5A'});
h+='<div class="cr-fin"><div class="cr-fin-k">Financial Summary</div><div class="cr-cells">'+cells.map(function(x){return'<div class="cr-cell"><div class="cr-num"'+(x.c?' style="color:'+x.c+'"':'')+'>'+x.v+'</div><div class="cr-lbl">'+x.l+'</div></div>'}).join('')+'</div>';
if(L.beyond)h+='<p class="cr-note">Committed funds falling beyond the planning window: '+fmtMoney(L.beyond)+' across '+L.beyondN+' project'+(L.beyondN>1?'s':'')+' \u2013 these months lie outside the '+Y+'-year period and are not counted above.</p>';
h+='<p class="cr-note2" style="margin-top:'+(L.beyond?4:12)+'px">Committed is the full cost of every live plan \u2013 all development, rollout, and sustainment months landing in '+(isT?'the '+Y+'-year window':'Year '+y)+'. This figure provides planning estimates. It does not track live spend.</p>';
var kr=killPotRows().filter(function(r){return isT||killPotYearOf(r)===y});var xs=[];
if(kr.length||(isT&&cap.killNotes))xs.push('<div><div class="cr-fin-xk">Kill & phase-out pot'+(isT?' \u2013 '+fmtMoney(killPotTotal()):'')+'</div>'+kr.map(function(r){return'<p>'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+(isT?' <span style="color:#64707E">(Year '+killPotYearOf(r)+')</span>':'')+'</p>'}).join('')+(isT&&cap.killNotes?'<p>'+esc(cap.killNotes)+'</p>':'')+'</div>');
if(isT&&cap.reallocation)xs.push('<div><div class="cr-fin-xk">Reallocation sources</div><p>'+esc(cap.reallocation)+'</p></div>');
if(isT&&cap.gapPlan)xs.push('<div><div class="cr-fin-xk">Funding gap & plan</div><p>'+esc(cap.gapPlan)+'</p></div>');
if(xs.length)h+='<div class="cr-fin-x">'+xs.join('')+'</div>';
h+='</div>';
/* KPI tiles */
var K=capKpiData(isT?'T':y);
if(K){var tile=function(inner,label,sub){return'<div class="cr-kpi">'+inner+'<div style="min-width:0"><div class="cr-kpi-l">'+label+'</div><div class="cr-kpi-s">'+sub+'</div></div></div>'};
h+='<div class="cr-kpis">'+tile(capReportArc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub)+tile('<div class="cr-kpi-n" style="color:'+(K.t2.neg?'#C25B73':'#1B6B5A')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub)+tile(capReportArc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub)+'</div>'}
/* the year's calendar, then its waterfall \u2013 the last thing on the section's first page */
if(orgMonthly()){h+='<div class="cr-card"><h3>The Committed Calendar</h3>'+capReportLanes(a,b)+'</div>';h+='<div class="cr-card"><h3>Capacity Waterfall</h3>'+capReportWaterfall(a,b,mx)+'</div>'}
/* the committed lists, on a new page */
h+='<div class="cr-lists">';
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
var landing=isT?'Within the planning window':'Landing in Year '+y;
h+='<div class="cr-list"><h3 style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>';
if(devRows.length)devRows.forEach(function(i){var yr=capReportItemYear({i:i,op:false},a,b);
h+='<div class="cr-item"><div class="cr-item-h"><h4>'+esc((ideas[i]||{}).name||('Item '+i))+'</h4><span class="cr-item-m">Development '+fmtMoney(devCost(i))+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>';
h+='<div class="cr-item-y">'+landing+': <strong>'+fmtMoney(yr.total)+'</strong> \u2013 development '+fmtMoney(yr.dev)+' \u00b7 rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus)+'</div>';
if(isT){var rows=progOrdered(i);if(rows.length)h+='<table class="cr-t"><thead><tr><th>Program phase</th><th>Owner</th><th class="r">Months</th><th class="r">Cost</th><th class="r">Gate decision</th></tr></thead><tbody>'+rows.map(function(r){var sp=bpStepSpan(r);return'<tr><td>'+esc(r.name||'\u2014')+'</td><td>'+esc(r.powner||'\u2014')+'</td><td class="r">'+(sp?'m'+sp[0]+'\u2013'+sp[1]:'\u2014')+'</td><td class="r"><strong>'+fmtMoney(bpStepMoney(r))+'</strong></td><td class="r">'+esc(r.gateDec||'\u2014')+'</td></tr>'}).join('')+'</tbody></table>';else h+='<p class="cr-empty" style="margin-top:4px">No development phases recorded.</p>'}
h+='</div>'});
else h+='<p class="cr-empty">Nothing in Development at this snapshot.</p>';
var held=orgCommittedSet().filter(function(e){return e.sunk});
if(held.length){h+='<div class="cr-item"><div class="cr-item-h"><h4 style="font-weight:600">Development costs held from killed items</h4></div>'+held.map(function(e){var yr=capReportItemYear(e,a,b);return'<div class="cr-row"><span class="n">'+esc((ideas[e.i]||{}).name||('Item '+e.i))+'</span><span class="m">entered phases held</span><span class="a">'+fmtMoney(yr.total)+'</span></div>'}).join('')+'</div>'}
h+='</div>';
var ops=(stages.operational||[]).filter(function(i){return(trk[i]||{}).status!=='killed'});var _cr=capCommitments().rows;
h+='<div class="cr-list"><h3 style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>';
if(ops.length)ops.forEach(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var yr=capReportItemYear({i:i,op:true},a,b);
h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="m">'+(isT?(r?r.label:'Full plan'):(yr.dev?'development '+fmtMoney(yr.dev)+' \u00b7 ':'')+'rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus))+'</span><span class="a">'+fmtMoney(isT?(r?r.amt:0):yr.total)+'</span></div>'});
else h+='<p class="cr-empty">Nothing operational at this snapshot.</p>';
h+='</div>';
if(isT){var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+='<div class="cr-list"><h3 style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>';
if(opts.length)opts.forEach(function(i){h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span>'+(progContracted(i)?'<span class="cr-badge" style="background:#1B6B5A">Program contracted</span>':'')+'<span class="cr-badge" style="background:#2D5A8E">'+getScore(i)+'/50</span></span><span class="m">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'});
else h+='<p class="cr-empty">No Go projects waiting in Exploration.</p>';
h+='</div>'}
h+='</div></div>';
return h}
/* the whole body: every budget year, then the total */
function capReportBody(){var cap=data.capital||{};
if(!cap.aiBudget)return'<p class="cr-empty">Set your AI Projects Budget at Step 3.2.</p>';
var Y=envYearsOf(),L=capLens();var srs=orgMonthly();var mx=0;if(srs)srs.forEach(function(r){mx=Math.max(mx,r.dev+r.roll+r.sus,capSusCapLine(r.m))});
var h='';for(var y=1;y<=Y;y++)h+=capReportSection(y,L,mx,y-1,Y+1);h+=capReportSection('T',L,mx,Y,Y+1);return h}

function printGovFW(){printDocument('Governance Framework',govFrameworkDoc(),'')} /* 16 Sep 2026: the composed document, not the page */

// === ENHANCED OUTCOME PAGES (replacing skeletons) ===

/* RACI columns are keyed by stable person identity, never by position: 'owner' and 'finance'
   are fixed keys; leads and seniors carry generated ids. Cell keys are '<activity>:<personKey>',
   so letters follow the person when the lists change. ensureRaciModel() backfills missing ids
   and migrates legacy '<activity>-<columnIndex>' cells onto whoever holds that column now. */
function raciCols(){ /* 17 Sep 2026 (Paul's ruling): no cap on leads or seniors — the matrix takes as many people as the organization names, as Governance's does */
var ow=data.ownership||{};var cols=[{k:'owner',l:ow.ownerName||'Pipeline Owner'}];
(ow.leads||[]).filter(function(l){return l&&(l.name||l.dept)}).forEach(function(l){cols.push({k:l.id,l:l.name||l.dept})});
(ow.seniors||[]).filter(function(sl){return sl&&(sl.name||sl.role)}).forEach(function(sl){cols.push({k:sl.id,l:sl.name||sl.role})});
cols.push({k:'finance',l:'Finance'});return cols}
function raciRoles(){return raciCols().map(function(c){return c.l})}
function ensureRaciModel(){try{
var ow=data.ownership||{},ch=false;
['leads','seniors'].forEach(function(k){(ow[k]||[]).forEach(function(pp){if(pp&&!pp.id){pp.id=uid();ch=true}})});
var r=data.raci||{},legacy=Object.keys(r).filter(function(k){return/^\d+-\d+$/.test(k)});
if(legacy.length){var cols=raciCols();legacy.forEach(function(k){var m=k.match(/^(\d+)-(\d+)$/),ri=parseInt(m[2],10),col=cols[ri];if(col&&col.k&&r[m[1]+':'+col.k]===undefined)r[m[1]+':'+col.k]=r[k];delete r[k]});ch=true}
if(ch){Store.commit('ownership');Store.commit('raci')}
}catch(e){}}
function purgeRaciFor(pid){var r=data.raci||{};var ch=false;Object.keys(r).forEach(function(k){var ci=k.indexOf(':');if(ci>=0&&k.slice(ci+1)===String(pid)){delete r[k];ch=true}});if(ch)Store.commit('raci')}
/* addendum 188 (17 Aug 2026, Paul's ruling): the Architecture module's RACI graphics, ported onto the governance data model, and from there onto the Innovation Pipeline's 17 Sep 2026 (Paul's ruling: the matrix looks as Governance's does wherever it appears) \u2014 colored letter chips, click-to-cycle cells, and the legend row. The activity inputs, the accountable-count warning, and the team rows above the matrix are unchanged. saveGovRaci stays in place pending a dead-code ruling. */
function _raciChip(v,colors){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+colors[v]+';color:#fff;font-size:13px;font-weight:700">'+v+'</span>'}
function _raciLegend(colors){var h='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--text-faint)">';
[['R','Responsible \u2014 does the work'],['A','Accountable \u2014 owns the decision, exactly one per activity'],['C','Consulted \u2014 input before'],['I','Informed \u2014 told after']].forEach(function(l){h+='<span><span style="display:inline-block;width:16px;height:16px;line-height:16px;border-radius:8px;background:'+colors[l[0]]+';color:#fff;font-size:10px;font-weight:700;text-align:center;margin-right:4px">'+l[0]+'</span>'+l[1]+'</span>'});
return h+'</div>'}
var RACI_COLORS={R:'#1B6B5A',A:'#2D5A8E',C:'#8B5E3C',I:'#6B7F8D'}; /* letters ride solid chips; Informed takes the slate-grey (Governance addendum 188) */
function raciCycle(key){if(Collab.lockedByOther('raci::'+key))return;ensureRaciModel();if(!data.raci)data.raci={};var order=['','R','A','C','I'];var cur=data.raci[key]||'';data.raci[key]=order[(order.indexOf(cur)+1)%order.length];Store.commit('raci',key);render()} /* the cell itself is the control, cycling R → A → C → I → blank */
function raciMatrix(ro){ensureRaciModel();
var raci=data.raci||{};var cols=raciCols();var colors=RACI_COLORS;
var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
var h=(ro?'':'<p style="font-size:12px;color:var(--text-faint);margin:0 0 6px">Click on a blank space on the matrix to assign roles.</p>')+'<div class="u-df74e8d"><table class="u-d1d587b"><thead><tr><th class="u-cd4ed5d">Activity</th>';
cols.forEach(function(c){h+='<th class="u-136497d">'+esc(c.l)+'</th>'});
h+='</tr></thead><tbody>';
acts.forEach(function(a,ai){var aCount=cols.filter(function(c){return raci[ai+':'+c.k]==='A'}).length;
h+='<tr style="background:'+(ai%2===0?'rgba(var(--fg-rgb),.04)':'rgba(var(--fg-rgb),.01)')+'"><td class="u-4a76a82">'+a+(ro||aCount===1?'':'<div style="font-size:11px;color:#C8860A;font-weight:600;margin-top:2px;min-height:15px">exactly one accountable name'+(aCount>1?' \u2014 '+aCount+' marked A':'')+'</div>')+'</td>';
cols.forEach(function(c){var key=ai+':'+c.k;var v=raci[key]||'';
if(ro){h+='<td class="u-47b192e">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.3);font-size:13px">\u2014</span>')+'</td>'}
else{h+='<td class="u-47b192e" id="raci_'+key+'" onclick="raciCycle(\''+key+'\')" title="Click to cycle R \u2192 A \u2192 C \u2192 I \u2192 blank" style="cursor:pointer">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.35);font-size:13px">\u2014</span>')+'</td>'}});
h+='</tr>'});
h+='</tbody></table></div>'+_raciLegend(colors);
return h} /* 17 Sep 2026 (Paul's ruling): Governance's matrix — coloured letter chips, click-to-cycle cells in place of the selects, the accountable-count note, the legend — on the 2.1 step and the output page alike */
function renderOutRaciFull(){
return'<div class="flx-between-top-mb"><div>'+badge('Phase 2 Output','#2D5A8E')+'<h2 class="h-big">RACI Matrix</h2><p class="t-stone-sm">R=Responsible A=Accountable C=Consulted I=Informed \u2013 filled out at Step 2.1 (Ownership &amp; Structure); this page is the printable record.</p></div>'+'<div style="display:flex;gap:8px">'+btn(UI.expanded.raciEdit?'\u2713 Done':'\u270E Edit','UI.expanded.raciEdit=!UI.expanded.raciEdit;render()','bs','font-size:13px')+'<button class="btn bg2" style="font-size:12px" onclick="printRaci()">\u25be Save as PDF</button>'+'</div>'+'</div>'+raciMatrix(!UI.expanded.raciEdit)}
function printRaci(){printDocument('RACI Matrix',raciDoc(),'')} /* 16 Sep 2026: the matrix on its landscape page */
function saveRaci(key){if(Collab.lockedByOther('raci::'+key))return;if(!data.raci)data.raci={};data.raci[key]=val('raci_'+key);Store.commit('raci',key);var el=document.getElementById('raci_'+key);if(el){var colors={R:'#1B6B5A',A:'#2D5A8E',C:'#8B5E3C',I:'rgba(var(--faint-rgb),.5)'};el.style.setProperty('color',colors[data.raci[key]]||'rgba(var(--faint-rgb),.4)','important')}}

function pcTabSet(i,n){if(!UI.pcTab)UI.pcTab={};UI.pcTab[i]=n;render()}
function pcEditToggle(i){if(!UI.pcEdit)UI.pcEdit={};UI.pcEdit[i]=!UI.pcEdit[i];render()}
function projCardRO(i){var p=(data.projects||{})[i]||{};
var shell=function(inner){return'<div style="margin-top:12px;padding:14px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;background:rgba(var(--fg-rgb),.02)">'+inner+'</div>'};
if(UI.pcEdit&&UI.pcEdit[i]){
return shell('<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><span style="font-size:12px;font-weight:700;color:var(--paper);letter-spacing:.03em">PROJECT CARD \u2013 EDITING</span>'+btn('Done editing','pcEditToggle('+i+')','bg2','font-size:11px;padding:3px 10px')+'</div>'+assessBlock(i))}
var tab=(UI.pcTab||{})[i]||0;
var tb=function(n,lbl){return'<button class="btn-ghost pad-chip-sm" style="font-size:12px;padding:4px 12px;'+(tab===n?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="pcTabSet('+i+','+n+')">'+lbl+'</button>'};
var f=function(l,v){return v?'<div><div class="u-b25d981" style="margin-bottom:3px">'+l+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">'+esc(v)+'</div></div>':''};
var body='';
if(tab===0){var inner=f('Objectives',p.objectives)+f('Deliverables',p.deliverables)+f('Timeline',p.timeline)+f('Resources',p.resources)+f('Key risks',p.risks)+f('Success metrics',p.metrics)+f('Internal partners',p.partInt)+f('External partners',p.partExt);
body=bpStatBand(i)+(inner?'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:14px 0 16px"></div><div class="gr-2" style="row-gap:16px">'+inner+'</div>':'<p class="t-faint-sm" style="margin:4px 0">No project details yet \u2014 click Edit, or complete the deepened assessment at 2.4.</p>')}
else if(tab===1){var _gi3=gapItemsOf(i),sw=p.swot||{};
var gAny=['skills','resources','technology'].some(function(c3){return(_gi3[c3]||[]).length});
var sAny=['strengths','weaknesses','opportunities','threats'].some(function(k4){return sw[k4]});
if(!gAny&&!sAny)body='<p class="t-faint-sm" style="margin:4px 0">No analyses recorded yet \u2014 the gap analysis and SWOT live in the editable card.</p>';
else{if(gAny){var grow=function(lbl,c4){var its=_gi3[c4]||[];if(!its.length)return'';var hv=its.filter(function(x){return x.have}),gp=its.filter(function(x){return !x.have});
var li=function(arr,col){return arr.length?arr.map(function(x){return'<div class="fs-13" style="margin-bottom:3px'+(col?';color:'+col:'')+'">'+esc(x.name)+'</div>'}).join(''):'<div class="t-faint-sm">\u2014</div>'};
return'<div style="margin-bottom:14px"><div style="font-size:14px;font-weight:700;color:var(--paper);margin-bottom:6px">'+lbl+'</div><div class="gr-3-sm"><div><div class="t-faint-sm" style="margin-bottom:4px">NEED</div>'+li(its)+'</div><div><div class="t-faint-sm" style="margin-bottom:4px">HAVE</div>'+li(hv)+'</div><div><div class="t-faint-sm" style="margin-bottom:4px">GAP</div>'+li(gp,'#D4A017')+'</div></div></div>'};
var _blocks=[grow('Skills','skills'),grow('Resources','resources'),grow('Technology','technology')].filter(function(x){return x});
body+='<h4 class="h-mini">Gap Analysis</h4>'+_blocks.join('<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 14px"></div>')}
if(sAny){var _q4=[{k:'strengths',l:'+ STRENGTHS',c:'var(--ph1-t)',bg:'rgba(27,107,90,.10)'},{k:'weaknesses',l:'\u2212 WEAKNESSES',c:'#C25B73',bg:'rgba(155,45,63,.08)'},{k:'opportunities',l:'\u25c9 OPPORTUNITIES',c:'var(--ph2-t)',bg:'rgba(45,90,142,.10)'},{k:'threats',l:'\u25b3 THREATS',c:'#D4A017',bg:'rgba(139,94,60,.10)'}];
body+=(gAny?'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:16px 0 14px"></div>':'')+'<h4 class="h-mini">SWOT</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:10px;overflow:hidden">'+_q4.map(function(q){return'<div style="background:'+q.bg+';padding:12px;min-height:76px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:'+q.c+';margin-bottom:5px">'+q.l+'</div><div class="u-2ad7718">'+esc(sw[q.k]||'\u2014')+'</div></div>'}).join('')+'</div>'}}}
else{body=bpBudgetTab(i,true)}
return shell('<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'+tb(0,'Overview')+tb(1,'Analyses')+tb(2,'Budget')+'<span style="flex:1"></span>'+btn('Edit','pcEditToggle('+i+')','bg2','font-size:11px;padding:3px 10px')+'</div>'+body)}
function devCardRO(i){var tr=((data.tracking||{})[i])||{};var f=function(l,v){return v?'<div><div class="u-b25d981">'+l+'</div><div class="u-2ad7718">'+esc(v)+'</div></div>':''};
var g=f('Results to date',tr.results)+f('Infrastructure learnings',tr.infraLearnings||tr.learnings) /* 16 Sep 2026 (seed check): the step and the seed write infraLearnings; the card read a key nothing wrote */+f('What\u2019s breaking / working',tr.breakWork);
return progSnapRO(i)+(g?'<div class="gr-2" style="margin-top:10px">'+g+'</div>':'')}
function expCardRO(i){var e=(data.experiments||{})[i]||{};var f=function(l,v){return v?'<div><div class="u-b25d981">'+l+'</div><div class="u-2ad7718">'+esc(v)+'</div></div>':''};
var inner=f('Owner',e.owner)+f('Development Costs',e.budget)+f('Timeline',e.timeline)+f('Success metric',e.successMetric)+f('What was tested',e.testing)+f('Evaluation milestone',e.milestone);
if(!inner)return'<p class="t-faint-sm">No experiment card recorded for this project.</p>';
return'<div class="gr-2">'+inner+'</div>'}
/* Program dashboard (P3, July 5). The Development portfolio card renders the
   project's development program - the plan's dev rows ordered by end month.
   Gates are decision records (Go / Kill / Hold / Recycle) taken as phases end;
   Kill routes through the inline confirm panel (released/held figures + a pot
   line, capLaunchPanel precedent). The terminal gate's Go is the launch
   decision. Seam advisories use the formal register (Paul ruling, July 5). */
function pdDoneRow(r){return r.gateDec==='go'||r.pstatus==='complete'}
function phLight(r,sz){var d=sz||10;var c,t;if(r.gateDec==='kill'){c='#C25B73';t='Killed at gate'}else if(pdDoneRow(r)){c='#34B04A';t='Complete'}else if(r.gateDec==='hold'){c='#8B5E3C';t='On hold'}else if(pdRunRow(r)){c='#D4A017';t='Running'}else{c='';t='Unstarted'}
return c?'<span title="'+t+'" style="width:'+d+'px;height:'+d+'px;border-radius:50%;background:'+c+';display:inline-block;flex:0 0 auto"></span>':'<span title="Unstarted" style="width:'+d+'px;height:'+d+'px;border-radius:50%;border:1.5px solid var(--text-faint);display:inline-block;box-sizing:border-box;flex:0 0 auto"></span>'}
function pdRunRow(r){return r.pstatus==='running'&&!r.gateDec}
function progSpentDone(i){var t=0;progOrdered(i).forEach(function(r){if(pdDoneRow(r))t+=bpStepMoney(r)});return t}
function progOrdered(i){return bpRows(i,'dev').filter(function(r){return !!r}).slice().sort(function(x,y){var sx=bpStepSpan(x),sy=bpStepSpan(y);return(sx?sx[1]:1e9)-(sy?sy[1]:1e9)})}
function phGlyph(r){if(r.gateDec==='kill')return['\u25cb','#9B2D3F'];if(r.gateDec)return['\u25c9','#1B6B5A'];if(r.pstatus==='complete')return['\u25cf','#1B6B5A'];if(r.pstatus==='running')return['\u25cf','#D4A017'];return['\u25cb','rgba(var(--faint-rgb),.6)']}
function progStrip(i){var rows=progOrdered(i);if(!rows.length)return'';var done=rows.filter(function(r){return r.gateDec||r.pstatus==='complete'}).length;
return'<span style="display:inline-flex;align-items:center;gap:3px;margin-left:8px" onclick="event.stopPropagation()">'+rows.map(function(r){var g=phGlyph(r);return'<span title="'+esc(r.name||'phase')+'" style="color:'+g[1]+';font-size:22px;line-height:1">'+g[0]+'</span>'}).join('')+'<span class="t-faint-sm" style="margin-left:4px">'+done+'/'+rows.length+' phases</span></span>'}
function phStatusSel(i,r){return'<select onclick="event.stopPropagation()" onchange="bpRowSave('+i+',\'dev\',\''+r.id+'\',\'pstatus\',this.value)" style="font-size:12.5px;padding:4px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px">'+[['','Unstarted'],['running','\u25cf Running'],['complete','\u2713 Complete']].map(function(o){return'<option value="'+o[0]+'"'+(String(r.pstatus||'')===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select>'}
function devStatusSave(i,el){var v=el.value;if(v==='killed'){UI.expanded['kp'+i]=true;render();return}fldSave('trk_'+i+'_status',v)}
function pausedNote(tr){return(tr&&tr.status==='paused')?'<p class="fs-13" style="margin:6px 0 0;color:var(--warn-text)">Paused \u2013 the financial commitment to this project remains in place. If the pause adds real costs (license months, restart work), add them to the paused phase\u2019s cost or add a phase covering the pause months. The committed sum will recalculate to take account of the addition.</p>':''}
function devStatusSel(i,tr){var opts=[['','Set status...'],['running','\u25cf Running'],['paused','\u25cf Paused'],['complete','\u2713 Complete'],['killed','\u25cb Killed']];
return'<div class="mb-4"><label class="form-label">Status</label><select id="trk_'+i+'_status" class="sel-helper" onchange="devStatusSave('+i+',this)">'+opts.map(function(o){return'<option value="'+o[0]+'"'+(String(tr.status||'')===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></div>'}
function progGate(i,id,dec){if(Collab.lockedByOther('budgetPlans::'+i))return;var r=bpRows(i,'dev').filter(function(x){return x&&x.id===id})[0];if(!r)return;
if(dec==='kill'){UI.expanded['gp_'+i+'_'+id]=false;UI.expanded['kp'+i]=id;render();return}
if(dec==='go'){var _rows0=progOrdered(i),_last0=_rows0.length?_rows0[_rows0.length-1]:null;if(!(_last0&&_last0.id===id)&&!confirm('Record Go for this gate?'))return} /* terminal Go goes uninterrupted to the launch panel's CONFIRM-OR-REVISE - no double confirm (ruled July 9) */
r.gateDec=dec;r.gateAt=Date.now();if(dec==='go')r.pstatus='complete';if(dec==='recycle')r.pstatus='running';UI.expanded['gp_'+i+'_'+id]=false;if(dec==='go')UI.expanded['phx_'+i+'_'+id]=false;if(dec==='recycle'){UI.expanded['phx_'+i+'_'+id]=true;UI.expanded['pde_'+i+'_'+id]=true}Store.commit('budgetPlans',i);
var rowsT=progOrdered(i),last=rowsT.length?rowsT[rowsT.length-1]:null;
if(dec==='go'&&last&&last.id===id){if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};if(data.tracking[i].status!=='complete'){data.tracking[i].status='complete';Store.commit('tracking',i);data.capStale=true;Store.commit('capStale')}saveData();doLaunch(i);return}
saveData();render()}
function progGateUI(i,r,terminal){
if(r.gateDec)return'<span class="t-faint-sm">Gate: '+esc(r.gateDec)+(r.gateAt?' \u00b7 '+fmtDate(r.gateAt):'')+(r.pgnote?' \u00b7 '+esc(String(r.pgnote).slice(0,80)):'')+'</span> <button class="btn-ghost pad-chip-sm" onclick="event.stopPropagation();progGateClear('+i+',\''+r.id+'\')" style="font-size:10px">retake</button>';
var _beg=(r.pstatus==='running'||r.pstatus==='complete'); /* flow rule (ruled July 9): an unstarted phase has produced no new evidence, so its gate offers no Kill - portfolio-level kills stay on the review's Sell and the status select */
var bb=function(lbl,dec,col){return'<button onclick="event.stopPropagation();progGate('+i+',\''+r.id+'\',\''+dec+'\')" style="flex:1;min-width:70px;padding:8px 6px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid '+col+'55;background:'+col+'18;color:'+col+'">'+lbl+'</button>'};
return'<div onclick="event.stopPropagation()" style="border:1px solid rgba(var(--fg-rgb),.15);border-radius:8px;padding:10px;margin-top:6px;width:100%"><div style="font-weight:700;color:var(--paper);font-size:13px;letter-spacing:.04em;margin-bottom:8px">EXIT GATE DECISION'+(terminal?' <span class="t-faint-sm" style="font-weight:400">(terminal \u2013 Go is the launch decision)</span>':'')+'</div>'
+'<div style="display:flex;gap:8px;flex-wrap:wrap">'+bb(terminal?'Go \u2013 Launch':'Go','go','#1B6B5A')+bb('Recycle','recycle','#2D5A8E')+(_beg?bb('Kill','kill','#9B2D3F'):'')+'</div>'
+'<p class="t-faint-sm" style="margin:6px 0 8px">Go confirms that the project has passed this gate and marks the phase complete. The project is now free to begin subsequent phases. Recycle records a fail-and-repeat decision: the phase returns to Running so you can extend its dates and budget.'+(_beg?' Kill opens the kill panel.':'')+' If the evidence is not in yet, take no decision \u2013 the gate simply stays open. To park a passing program for capital or priority reasons, pause it from the Development portfolio.</p>'
+pgTa(i,r,'pgnote','Gate note','Evidence against the exit criteria; conditions for the next phase')+'</div>'}
function progGateClear(i,id){if(Collab.lockedByOther('budgetPlans::'+i))return;var r=bpRows(i,'dev').filter(function(x){return x&&x.id===id})[0];if(!r)return;delete r.gateDec;delete r.gateAt;Store.commit('budgetPlans',i);saveData();render()}
function progDash(i,killed){var rows=progOrdered(i);
var h='<h4 style="font-size:15px;font-weight:700;color:var(--paper);margin:22px 0 10px">Development Phases</h4>';
if(killed)h+='<p class="t-faint-sm" style="margin:0 0 10px">Funds remain committed for phases that have already begun ('+fmtMoney(killSunkDev(i))+'). The remainder is released. Any wind-down costs should be recorded in the kill & phase-out pot (Step 3.3 or the Capital Planning Hub).</p>';
if(!rows.length)return h+'<p class="t-faint-sm" style="margin:0 0 10px">No phases defined \u2013 build the program at Step 3.4 (Map Development Track).</p>';
var pmn=planMonthNow(i),last=rows[rows.length-1];
var H41=parseInt((bpGet(i)||{}).horizon,10)||3;
var meta=function(l,v){return'<div><div class="t-faint-sm" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">'+l+'</div><div style="font-size:13.5px;color:var(--paper)">'+esc(v||'\u2014')+'</div></div>'};
var crit=function(l,v,col){return'<div style="flex:1;min-width:200px;border-left:2px solid '+col+';padding-left:10px"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:'+col+';margin-bottom:3px">'+l+'</div><div style="font-size:13px;color:var(--text-bright);line-height:1.5;white-space:pre-wrap">'+esc(v||'\u2014')+'</div></div>'};
rows.forEach(function(r,x){var sp=bpStepSpan(r);
var pk='phx_'+i+'_'+r.id;var pOpen=!!UI.expanded[pk];
var ek='pde_'+i+'_'+r.id;var editing=!killed&&pOpen&&!!UI.expanded[ek];
var rec=(!killed&&r.gateDec==='recycle')?'<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">Recycled'+(r.gateAt?' '+fmtDate(r.gateAt):'')+' \u2013 extend the time frame and revisit the phase budget before it runs again. New funds should be added to the existing phase budget for the additional work \u2013 the existing budget does not recycle automatically.</p>':'';
var late='';if(!killed&&pmn!=null&&sp&&sp[1]<pmn&&!r.gateDec)late='<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">\u201c'+esc(r.name||'')+'\u201d ended in Month '+sp[1]+', but its exit gate decision has not yet been made \u2013 the step cannot close until it is.</p>';
var seam='';if(!killed&&x>0&&pmn!=null&&sp&&sp[0]<=pmn&&!rows[x-1].gateDec)seam='<p class="t-faint-sm" style="color:var(--warn-text);margin:8px 0 0">\u201c'+esc(r.name||'')+'\u201d is scheduled to start in Month '+sp[0]+', but the exit gate decision at the end of \u201c'+esc(rows[x-1].name||'')+'\u201d has not yet been made. Check that this overlap is intentional.</p>';
h+='<div style="border:1px solid rgba(var(--fg-rgb),.1);border-radius:8px;margin-bottom:12px;overflow:hidden">'
+'<div onclick="UI.expanded[\''+pk+'\']=!'+pOpen+';render()" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;background:rgba(var(--fg-rgb),'+(pOpen?'.05':'.02')+')">'
+'<span style="color:var(--text-faint);font-size:13px">'+(pOpen?'\u25be':'\u25b8')+'</span>'
+'<span style="color:var(--text-faint);font-weight:700;font-size:14px">'+(x+1)+'.</span>'
+'<strong style="font-size:14.5px;color:var(--paper)">'+esc(r.name||'(unnamed phase)')+'</strong>'
+phLight(r,11)
+'<span style="margin-left:auto;display:inline-flex;gap:10px;align-items:center">'+(killed?'':phStatusSel(i,r))+'</span>'
+'</div>';
if(pOpen){
h+='<div style="padding:2px 14px 12px 14px">';
if(String(r.desc||'').trim())h+='<p style="font-size:12.5px;color:var(--text-muted);font-style:italic;margin:8px 0 2px">'+esc(r.desc)+'</p>';
if(editing){
h+='<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn-ghost pad-chip-sm" style="font-size:10.5px" onclick="UI.expanded[\''+ek+'\']=false;render()">Done editing</button></div>'
+'<div class="flx-g3" style="align-items:center;margin:4px 0 2px"><span class="form-label" style="flex:2;margin:0">Phase name</span><span class="form-label" style="flex:0 0 136px;margin:0">Months</span><span class="form-label" style="flex:0 0 140px;margin:0">Phase budget</span></div>'
+bpStepRow(i,'dev',r,H41,true,true)
+'<div style="max-width:260px;margin-top:8px">'+pgTa(i,r,'powner','Owner *','e.g. Robin Vance')+'</div>'
+'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">'+pgTa(i,r,'pmetric','Success metrics *','e.g. Quote turnaround < 4 hours',2)+pgTa(i,r,'pexit','Exit gate criteria *','e.g. \u2265 90% routing accuracy over four weeks',2)+'</div>';
}else{
h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:10px"><div style="display:flex;gap:28px;flex-wrap:wrap">'+meta('Time frame',sp?'Months '+sp[0]+'\u2013'+sp[1]:'No dates')+meta('Owner',r.powner)+meta('Phase budget',fmtMoney(bpStepMoney(r)))+'</div>'+(killed?'':'<button class="btn-ghost pad-chip-sm" style="font-size:10.5px;flex:0 0 auto" onclick="event.stopPropagation();UI.expanded[\''+ek+'\']=true;render()">Edit</button>')+'</div>'
+'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:14px">'+crit('Success metrics',r.pmetric,'var(--ph1-t)')+crit('Exit gate criteria',r.pexit,'#D4A017')+'</div>';
}
h+=(killed?'':'<div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+progGateUI(i,r,last&&last.id===r.id)+'</div>')
+'</div>';
}
if(seam||rec||late)h+='<div style="padding:0 14px 10px'+(pOpen?'':';padding-top:2px')+'">'+rec+late+seam+'</div>';
h+='</div>';
if(UI.expanded['kp'+i]===r.id)h+='<div style="margin:-4px 0 12px">'+progKillPanel(i)+'</div>'});
return h}
function progSnapRO(i){var rows=progOrdered(i);if(!rows.length)return'<p class="t-faint-sm">No development phases recorded.</p>';
return'<div class="t-faint-sm" style="margin-bottom:4px">PROGRAM PHASES</div>'+rows.map(function(r){var sp=bpStepSpan(r);return'<div class="row-line"><span class="fs-14" style="flex:3">'+esc(r.name||'\u2014')+(r.powner?' \u00b7 '+esc(r.powner):'')+'</span><span class="t-faint-sm" style="flex:1;text-align:right">'+(sp?'m'+sp[0]+'\u2013'+sp[1]:'\u2014')+'</span><span style="flex:1;text-align:right"><strong>'+fmtMoney(bpStepMoney(r))+'</strong></span><span class="t-faint-sm" style="flex:1;text-align:right">'+esc(r.gateDec||'\u2014')+'</span></div>'}).join('')}
function progKillPanel(i){if(!UI.expanded['kp'+i])return'';var prev=killReleasePreview(i),nm=esc(((data.ideas||[])[i]||{}).name||('Item '+i)),lines;
if(bpHasDev(i)){var held=prev.phases.filter(function(q){return q.entered}).map(function(q){return esc(q.name||'phase')}).join(', ');var rel=prev.phases.filter(function(q){return !q.entered}).map(function(q){return esc(q.name||'phase')}).join(', ');
lines='<p class="t-faint-sm" style="margin:0 0 6px">Killing releases <strong>'+fmtMoney(prev.released)+'</strong> \u2013 '+(rel?'the development phases not yet begun ('+rel+'), plus ':'')+'every rollout and sustainment month inside the planning window. '+(prev.sunk?'Phases already begun stay committed and charted: <strong>'+fmtMoney(prev.sunk)+'</strong>'+(held?' ('+held+')':'')+'.':'No phase has begun, so nothing is held.')+'</p>'}
else lines='<p class="t-faint-sm" style="margin:0 0 6px">No development phases are defined \u2013 killing releases the full in-window plan, <strong>'+fmtMoney(prev.released)+'</strong>.</p>';
return'<div style="border:1px solid rgba(155,45,63,.4);border-radius:8px;padding:12px;margin-top:10px;background:rgba(155,45,63,.05)"><div class="t-faint-sm" style="margin-bottom:6px">CONFIRM KILL \u2013 '+nm+'</div>'+lines
+'<p class="t-faint-sm" style="margin:0 0 6px">Does killing at this point carry costs of its own \u2013 contract exits, phase-outs, license runoff? Any amount entered is held as a line in the kill & phase-out pot (Step 3.3).</p>'
+'<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="kd_'+i+'" placeholder="e.g. Contractor exit" style="flex:2;min-width:160px;font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"><input id="ka_'+i+'" placeholder="e.g. $25K" style="flex:1;min-width:90px;font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px"></div>'
+'<div style="display:flex;gap:8px;margin-top:8px">'+btn('Confirm kill','progKillConfirm('+i+')','bd','font-size:12px')+btn('Cancel','UI.expanded[\'kp'+i+'\']=false;render()','bg2','font-size:12px')+'</div></div>'}
function progKillConfirm(i){var kp=UI.expanded['kp'+i];var d=$('kd_'+i),aE=$('ka_'+i);var dv=d?String(d.value||'').trim():'',av=aE?String(aE.value||'').trim():'';
if(dv||costNum(av)){if(!data.capital)data.capital={};if(!data.capital.killRows)data.capital.killRows=[];var nm=((data.ideas||[])[i]||{}).name||('Item '+i);data.capital.killRows.push({d:(dv||'Wind-down')+' \u2013 '+nm,a:av});Store.commit('capital')}
UI.expanded['kp'+i]=false;fldSave('trk_'+i+'_status','killed');
/* accounting rule (ruled July 9): the kill click never converts unspent money to spent - killSunkIds freezes on the PRE-decision entered set, then the gate record is written */
if(typeof kp==='string'){var r=bpRows(i,'dev').filter(function(x){return x&&x.id===kp})[0];if(r){r.gateDec='kill';r.gateAt=Date.now();Store.commit('budgetPlans',i);render()}}if(UI.reviewSellPending===i){delete UI.reviewSellPending;if(!data.review)data.review={};if(!data.review.items)data.review.items={};if(!data.review.items[i])data.review.items[i]={};data.review.items[i].decision='sell';saveData()}}
function renderOutExpbriefsFull(){
var ideas=data.ideas||[],exp=data.experiments||{},exSel=data.expSelected||[],trk=data.tracking||{},stages=getStages();
var h='<h2 class="h-section">Development Portfolio</h2><p class="t-lead">Programs in progress. Track phase status, take gate decisions as phases end, and launch completed projects to Operational \u2013 all from this page.</p>';
h+=outputPrintRow(currentStep); /* 16 Sep 2026: the print control */
h+=pipeViz('experiment');
if(stages.experiment.length===0){h+=card('<div class="empty-state"><p class="t-faint">'+(exSel.length>0?'All programs have been launched to Operational.':'No projects in Development. Advance Go, graded projects from the Exploration portfolio.')+'</p></div>');return h+archivePanel(['experiment'],'oeb')}
stages.experiment.forEach(function(i,rank){var e=exp[i]||{},idea=ideas[i],tr=trk[i]||{};
var open=!!UI.expanded['oe'+i];var killed=tr.status==='killed';var pb=(data.portfolio||{})[i]||{};
var head='<div class="flx-row-mb-12-clean xh" style="cursor:pointer" onclick="event.stopPropagation();UI.expanded[\'oe'+i+'\']=!UI.expanded[\'oe'+i+'\'];render()"><div class="u-5d029f6">'+hzWarn(i,true)+'<span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><span class="u-0447ee5">#'+(rank+1)+'</span><h4 class="u-3a484c9"'+(killed?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(tr.status?badge(tr.status,tr.status==='complete'?'#1B6B5A':tr.status==='running'?'#2D5A8E':killed?'#9B2D3F':'rgba(var(--faint-rgb),.5)'):'')+progStrip(i)+'</div>'+badge('Development','#8B5E3C')+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div>';
var body='';
if(open){body=devPortBody(i)}h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+(killed?'#9B2D3F':'#8B5E3C')+(open?'':';cursor:pointer'),xpandAttr('oe'+i,open))});
h+=balancePanel(stages.experiment,'experiment');
h+=archivePanel(['experiment'],'oeb');
return h}

function renderOutFinalportFull(){return renderOutPortfolioReview()} /* 17 Sep 2026 (Paul's ruling): the Portfolio Review page \u2014 the Development Portfolio\u2019s second appearance is gone */
function renderOutExploreEnhanced(){
var ideas=data.ideas||[],proj=data.projects||{},port=data.portfolio||{},as=data.assessments||{},stages=getStages();
var h='<h2 class="h-section">Exploration Portfolio</h2><p class="t-lead">Run the deepened assessment and re-score, issue the Go / No-Go verdict, grade horizon, risk, and reward, then advance Go projects to Development \u2013 all from this page.</p>';
h+=outputPrintRow('out-explore'); /* 16 Sep 2026: the print control */
h+=pipeViz('explore');
if(!UI.oxTab)UI.oxTab=1;
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'Structured Portfolio'},{t:2,l:'Allocate Capital'}].map(function(tb){return'<button onclick="UI.oxTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.oxTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.oxTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.oxTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.oxTab===2)return h+allocCore();
if(stages.explore.length===0&&stages.noGo.length===0){h+=card('<div class="empty-state"><p class="t-faint">No projects in Exploration yet. Select ideas from the Blue Sky portfolio to begin.</p></div>');return h+archivePanel(['explore','noGo'],'oxp')}
if(stages.explore.length>0){
var _srt=stages.explore.slice().sort(function(a,b){return getScore(b)-getScore(a)});
var _grd=[],_awt=[],_inc=[];
_srt.forEach(function(i){var _pj=proj[i]||{},_pb=port[i]||{};if(_pj.viable===true&&_pb.horizon&&_pb.risk&&_pb.reward)_grd.push(i);else if(_pj.viable===true)_awt.push(i);else _inc.push(i)});
var _sec=function(t){return'<div class="flx-row-mb-12" style="margin-top:8px"><h3 class="u-ce641a4">'+t+'</h3></div>'};
var _cardFor=function(i){var idea=ideas[i],p=proj[i]||{},pb=port[i]||{},a1=as[i]||{},rs=p.rescore||{};var _kd=(((data.tracking||{})[i])||{}).status==='killed';var open=!!UI.expanded['ox'+i];
var graded=!!(pb.horizon&&pb.risk&&pb.reward);
var vBadge=p.viable===true?badge('Go','#1B6B5A'):'';
var head='<div class="flx-between xh" onclick="event.stopPropagation();UI.expanded[\'ox'+i+'\']=!UI.expanded[\'ox'+i+'\'];render()" style="cursor:pointer"><div style="display:flex;gap:8px"><span style="color:var(--stone);font-size:15px;padding-top:1px">'+(open?'\u25be':'\u25b8')+'</span><div><h4 class="h-card"'+(_kd?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+' '+(_kd?badge('Killed','#9B2D3F')+' ':'')+vBadge+(p.viable===true&&graded?' '+badge('Portfolio assessment complete','#8B5E3C'):'')+'</h4><p class="t-stone-snug">'+esc(p.objectives||(idea?idea.desc:''))+'</p></div></div><div class="w-min-50"><div class="score-num-md">'+getScore(i)+'</div><div class="t-faint-sm">/50</div></div></div>';
var body='';
if(open){body=expPortBody(i)}h+=card(head+body,'margin-bottom:10px;border-left:4px solid '+(p.viable===true?'#1B6B5A':'#2D5A8E')+(open?'':';cursor:pointer'),xpandAttr('ox'+i,open))};
h+=_sec('Structured Portfolio ('+_grd.length+')');
if(!_grd.length)h+='<p class="t-faint-sm" style="margin:0 0 14px">Nothing graded yet \u2013 the structured portfolio is the graded set.</p>';
_grd.forEach(_cardFor);
if(_awt.length){h+=_sec('Not Yet Positioned ('+_awt.length+')');_awt.forEach(_cardFor)}
if(_inc.length){h+=_sec('Incomplete ('+_inc.length+')');_inc.forEach(_cardFor)}}
h+=notAdvPanel('oxp');
h+=balancePanel(stages.explore,'explore');
h+=archivePanel(['explore','noGo'],'oxp');
return h}
function setViableAt(i,v){if(lockBlocked('projects::'+i))return;saveAssessFields(i);if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};var e=$('pjr_'+i);if(e&&e.value!==undefined&&e.value!=='')data.projects[i].noGoReason=e.value;data.projects[i].viable=v;if(v===false){data.capStale=true;Store.commit('capStale')}Store.commit('projects',i);render()}
function deepScoreOf(i){var p=(data.projects||{})[i]||{},a=(data.assessments||{})[i]||{};if(!(p.rescore&&p.rescoreDone&&rsComplete(p.rescore)))return null;var r=p.rescore;return(r.priority!=null?r.priority:(a.priority||0))+(r.risk!=null?r.risk:(a.risk||0))+(r.value!=null?r.value:(a.value||0))+(r.costScore!=null?r.costScore:(a.costScore||0))+(r.difficulty!=null?r.difficulty:(a.difficulty||0))}
function rs3TotalHtml(i){var p=(data.projects||{})[i]||{};var deep=deepScoreOf(i),tri=triageScore(i);var deepTxt=(deep!=null?deep+'/50':'\u2014');
if(!(p.rescore3Done&&rsComplete(p.rescore3||{})))return'Post-experiment <strong>\u2014</strong> \u00b7 Deepened '+deepTxt+' \u00b7 First Pass '+tri+'/50';
var t3=getScore(i);var base=(deep!=null?deep:tri);var d=t3-base;
return'Post-experiment <strong>'+t3+'/50</strong> \u00b7 Deepened '+deepTxt+' \u00b7 First Pass '+tri+'/50 ('+(d>=0?'+':'')+d+' vs '+(deep!=null?'deepened':'first pass')+')'}
function refreshPr3Total(i){var p=(data.projects||{})[i]||{};var t=document.getElementById('pr3Total_'+i);if(t)t.innerHTML=rs3TotalHtml(i);var b=document.getElementById('pr3Btn_'+i);if(b){var comp=rsComplete(p.rescore3||{});b.disabled=!!p.rescore3Done||!comp;b.textContent=p.rescore3Done?'\u2713 Re-scored':'\u2713 Confirm Post-experiment Score'}}
function confirmRescore3At(i){if(lockBlocked('projects::'+i))return;var p=(data.projects||{})[i];if(!p||!rsComplete(p.rescore3||{}))return;p.rescore3Done=true;Store.commit('projects',i);render()}
function refreshPrsTotal(i){var p=(data.projects||{})[i]||{};var t=document.getElementById('prsTotal_'+i);if(t)t.innerHTML=rsTotalHtml(i);var b=document.getElementById('prsBtn_'+i);if(b){var comp=rsComplete(p.rescore||{});b.disabled=!!p.rescoreDone||!comp;b.textContent=p.rescoreDone?'\u2713 Re-scored':'\u2713 Confirm Re-score'}}
function confirmRescoreAt(i){if(lockBlocked('projects::'+i))return;var p=(data.projects||{})[i];if(!p||!rsComplete(p.rescore||{}))return;p.rescoreDone=true;Store.commit('projects',i);render()}
function reconsiderNoGo(i){if(lockBlocked('projects::'+i))return;if(!data.projects||!data.projects[i])return;delete data.projects[i].viable;data.capStale=true;Store.commit('projects',i);Store.commit('capStale');render()}
function renderOutOperFull(){
var ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},exp=data.experiments||{},opsData=data.opsData||{};
var operational=stages.operational||[];
var h='<h2 class="h-section">Operational Portfolio</h2><p class="t-lead">Live projects deployed in your business. Monitor performance and manage operations.</p>';
h+=outputPrintRow('out-oper'); /* 16 Sep 2026: the print control */
h+=pipeViz('operate');
if(!operational.length){h+=card('<div class="empty-state"><div class="u-947fc58">✕</div><p class="u-27e8e2c">No operational projects yet.</p><p class="u-97af957">Projects move here when launched from Development or given a "Buy/Scale" decision.</p></div>');return h+archivePanel(['operational'],'oop')}
operational.forEach(function(i){var idea=ideas[i],e=exp[i]||{},tr=trk[i]||{},ops=opsData[i]||{},pb=(data.portfolio||{})[i]||{};
var hColor=ops.health==='green'?'#1B6B5A':ops.health==='amber'?'#D4A017':ops.health==='red'?'#9B2D3F':'#2D5A8E';var opKilled=tr.status==='killed';if(opKilled)hColor='#9B2D3F';
var open=!!UI.expanded['oo'+i];
var head='<div class="u-c3626c3 xh" onclick="event.stopPropagation();UI.expanded[\'oo'+i+'\']=!UI.expanded[\'oo'+i+'\'];render()" style="cursor:pointer"><div class="flx-center gap-2 mb-1"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="u-6e57e18"'+(opKilled?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(opKilled?badge('Killed','#9B2D3F'):badge('Operational','#1B6B5A'))+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div><div class="u-7fc1635">'+['green','amber','red'].map(function(hh){return'<button title="'+(hh==='green'?'Health: on track':hh==='amber'?'Health: watch':'Health: at risk')+'" onclick="event.stopPropagation();setOpsHealth('+i+',\''+hh+'\')" style="width:28px;height:28px;border-radius:14px;border:'+(ops.health===hh?'2px solid #333':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(hh==='green'?'#1B6B5A':hh==='amber'?'#D4A017':'#9B2D3F')+';opacity:'+(ops.health===hh?1:.3)+';cursor:pointer"></button>'}).join('')+'</div></div>';
var body=!open?'':opPortBody(i);h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+hColor+(open?'':';cursor:pointer'),xpandAttr('oo'+i,open))});
h+=balancePanel(stages.operational||[],'operational');
h+=archivePanel(['operational'],'oop');
return h}
function setOpsHealth(i,h){updNested('opsData',i,'health',h)}



/* Budget Envelope (chunk 2): the org's AI budget projected over 3–5 years. Year 1 IS
   capital.aiBudget – the live annual figure the engine binds to; years 2+ (capital.budgetY2..5)
   are planning context, consumed by the chunk-3 projection and the analytics surface.
   Envelope years are fiscal/org years; profiles run project-relative – the year-by-year
   chart meets them approximately, as ruled. */
function envYearsOf(){var n=parseInt((data.capital||{}).envYears,10);return(n>=1&&n<=5)?n:3}
/* Funding Plan lines (Paul ruling, July 5): each line is a funding SOURCE
   (description, amount, target year, optional project tag), never a per-project
   ring-fence. Authorization is the auditable step that adds the amount to that
   year's budget envelope; the envelope getter sums base + authorized additions,
   so 3.2, the Hub, and every chart read one composed figure. Authorized lines
   are read-only (revoke to edit). The per-year gap is derived, never entered. */
function fundLines(){return((data.capital||{}).fundLines||[]).filter(function(r){return !!r})}
function fundAddsYear(y){var t=0;fundLines().forEach(function(r){if(r.st==='auth'&&parseInt(r.y,10)===y)t+=costNum(r.a)});return Math.round(t)}
function envBudgetYear(y){var cap=data.capital||{};return(y===1?costNum(cap.aiBudget):costNum(cap['budgetY'+y]))+fundAddsYear(y)}
function flAdd(){if(Collab.lockedByOther('capital'))return;if(!data.capital)data.capital={};if(!data.capital.fundLines)data.capital.fundLines=[];data.capital.fundLines.push({id:uid(),d:'',a:'',y:'1',proj:'',st:'planned'});Store.commit('capital');render()}
function flSave(id,f,v){if(Collab.lockedByOther('capital'))return;var r=fundLines().filter(function(x){return x.id===id})[0];if(!r||r.st==='auth')return;if(['d','a','y','proj'].indexOf(f)<0)return;r[f]=v;Store.commit('capital');render()}
function flDel(id){if(Collab.lockedByOther('capital'))return;var ls=(data.capital||{}).fundLines||[];for(var x=0;x<ls.length;x++){if(ls[x]&&ls[x].id===id){if(ls[x].st==='auth')return;ls.splice(x,1);break}}Store.commit('capital');render()}
function flAuth(id){if(Collab.lockedByOther('capital'))return;var r=fundLines().filter(function(x){return x.id===id})[0];if(!r||r.st==='auth'||!String(r.d||'').trim()||!costNum(r.a))return;
r.st='auth';r.at=Date.now();var u=(typeof getCurrentUser==='function')?getCurrentUser():null;r.by=(u&&u.name)||'';data.capStale=true;Store.commit('capital');Store.commit('capStale');saveData();render()}
function flRevoke(id){if(Collab.lockedByOther('capital'))return;var r=fundLines().filter(function(x){return x.id===id})[0];if(!r||r.st!=='auth')return;
if(!confirm('Revoking removes '+fmtMoney(costNum(r.a))+' from Year '+(r.y||'1')+'\u2019s budget. Continue?'))return;
r.st='planned';delete r.at;delete r.by;data.capStale=true;Store.commit('capital');Store.commit('capStale');saveData();render()}
function fundNote(){var n=envYearsOf(),parts=[];for(var y=1;y<=n;y++){var a=fundAddsYear(y);if(a)parts.push('Year '+y+' +'+fmtMoney(a))}
return parts.length?'<p class="t-faint-sm" style="margin:8px 0 0">The calculated figures include authorized funding-plan additions: '+parts.join(' \u00b7 ')+' (Funding Plan \u2013 Capital Planning Hub, Plan & Funding). The fields above hold the base budget.</p>':''}
function fundPlanLines(){var n=envYearsOf();var _fin='font-size:12px;padding:6px 8px;background:rgba(var(--fg-rgb),.04);color:var(--paper);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px';
var h='';var yt=orgYearTotals();
if(yt&&yt.length){var gaps=[];yt.forEach(function(r){if(r.budgetSet&&r.headroom<0)gaps.push('Year '+r.y+': '+fmtMoney(-r.headroom))});
h+='<p class="t-faint-sm" style="margin:0 0 8px">'+(gaps.length?('The funding gap is derived from the calendar \u2013 '+gaps.join(' \u00b7 ')+'. The lines below are the sources that answer it.'):'No funding gap on the current calendar \u2013 every envelope year\u2019s committed total sits inside its budget. Lines can still be planned ahead here.')+'</p>'}
fundLines().forEach(function(r){var auth=r.st==='auth';
h+='<div style="border:1px solid rgba(var(--fg-rgb),'+(auth?'.16':'.08')+');border-radius:8px;padding:8px 10px;margin-bottom:6px">'
+'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
+(auth
?'<span class="fs-13" style="flex:2;min-width:160px">'+esc(r.d||'')+'</span><strong>'+fmtMoney(costNum(r.a))+'</strong><span class="t-faint-sm">Year '+esc(r.y||'1')+(String(r.proj||'').trim()?' \u00b7 '+esc(r.proj):'')+'</span>'
:'<input value="'+esc(r.d||'')+'" placeholder="e.g. Reallocate from the marketing automation line" onchange="flSave(\''+r.id+'\',\'d\',this.value)" style="flex:2;min-width:170px;'+_fin+'"><input value="'+esc(r.a||'')+'" placeholder="e.g. $150K" onchange="flSave(\''+r.id+'\',\'a\',this.value)" style="flex:1;min-width:80px;'+_fin+'"><select onchange="flSave(\''+r.id+'\',\'y\',this.value)" style="'+_fin+'">'+(function(){var o='';for(var y=1;y<=n;y++)o+='<option value="'+y+'"'+(String(r.y||'1')===String(y)?' selected':'')+'>Year '+y+'</option>';return o})()+'</select><input value="'+esc(r.proj||'')+'" placeholder="project tag (optional)" onchange="flSave(\''+r.id+'\',\'proj\',this.value)" style="flex:1;min-width:120px;'+_fin+'">')
+'</div>'
+'<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">'
+(auth
?badge('authorized','#1B6B5A')+'<span class="t-faint-sm">added to Year '+esc(r.y||'1')+'\u2019s budget'+(r.at?' \u00b7 '+fmtDate(r.at):'')+(r.by?' \u00b7 '+esc(r.by):'')+'</span>'+btn('Revoke','flRevoke(\''+r.id+'\')','bg2','font-size:11px;padding:3px 10px')
:badge('planned','#8B5E3C')+((String(r.d||'').trim()&&costNum(r.a))?btn('Authorize \u2013 add to budget','flAuth(\''+r.id+'\')','bs','font-size:11px;padding:3px 10px'):'<span class="t-faint-sm">give the line a description and an amount to authorize it</span>')+btn('\u2715','flDel(\''+r.id+'\')','bg2','font-size:11px;padding:3px 8px'))
+'</div></div>'});
h+=btn('+ Add funding line','flAdd()','bg2','font-size:11px;padding:3px 10px');
var adds=[];for(var y2=1;y2<=n;y2++){var a2=fundAddsYear(y2);if(a2)adds.push('Year '+y2+' +'+fmtMoney(a2))}
if(adds.length)h+='<p class="t-faint-sm" style="margin-top:8px">Authorized additions now in the budget: '+adds.join(' \u00b7 ')+'.</p>';
return h}
function susCapOf(y){var cap=data.capital||{};var v=parseFloat(cap['susCapY'+y]);if(v>0)return v;var g=parseFloat(cap.susCap);return g>0?g:0}
function budgetEnvelopeRow(){var cap=data.capital||{};var n=envYearsOf();var h='';
h+='<div style="display:flex;gap:10px;flex-wrap:wrap">';
h+='<div style="flex:1;min-width:130px">'+ta('Year 1 budget *','cap_aiBudget',cap.aiBudget,'e.g. $3.5M',1)+'</div>';
for(var y=2;y<=n;y++){h+='<div style="flex:1;min-width:130px">'+ta('Year '+y+' budget','cap_budgetY'+y,cap['budgetY'+y],'e.g. $4M',1)+'</div>'}
h+='</div>';
h+='<div class="t-faint-sm" style="margin:10px 0 4px">INTAKE RESERVE (optional) \u2013 capacity held so next year\'s new projects can be admitted \u2013 headroom is reported net of this figure</div>';
h+='<div style="display:flex;gap:10px;flex-wrap:wrap">';
for(var y2=1;y2<=n;y2++){h+='<div style="flex:1;min-width:130px">'+ta('Year '+y2+' reserve','cap_reserveY'+y2,cap['reserveY'+y2],'e.g. $700K',1)+'</div>'}
h+='</div>';return h}
function bpHeadlineCosts(i,p,ro){var _ld=bpHasDev(i),_lr=bpHasRoll(i),_ls=bpHasSus(i);var ss=bpSusStartOpYear(i)||2;var _any=_ld||_lr||_ls;
return'<h4 class="h-mini">Costs'+(_any?' <span class="t-faint-sm" style="font-weight:400">(derived from budget plan)</span>':'')+'</h4><div class="gr-3-sm"><div>'+ta('Estimated development costs','expl_'+i+'_cS',_ld?fmtMoney(bpDevTotal(i)):p.startupCost,'e.g. $180K to build and prove it',1,ro||_ld)+'</div><div>'+ta('Estimated rollout costs','expl_'+i+'_cO',_lr?fmtMoney(bpRollTotal(i)):p.rolloutCost,'e.g. $40K to deploy, train, and launch',1,ro||_lr)+'</div><div>'+ta('Estimated annual sustainment costs','expl_'+i+'_cR',_ls?(fmtMoney(bpSusSteady(i)||bpSusOpYear(i,ss))+(ss>1?' from Year '+ss:'')):p.runningCost,'e.g. $60K per year in operation',1,ro||_ls)+'</div></div>'}
function bpHeadlineBudget(i,e){if(bpHasDev(i))return'<div class="mb-4"><label class="form-label" style="white-space:nowrap">Development Budget</label><textarea id="exp_'+i+'_budget" rows="1" class="ta-helper" readonly>'+esc(fmtMoney(bpDevTotal(i)))+'</textarea><div class="t-faint-sm" style="margin-top:2px;font-size:10px">Derived from budget plan</div>'+bpUndatedWarn(i)+'</div>';
return'<div>'+ta('Development Budget','exp_'+i+'_budget',e.budget,'e.g. $180K',1)+'</div>'}
function bpHeadlineOps(i,ops){var _lr=bpHasRoll(i),_ls=bpHasSus(i);var ss=bpSusStartOpYear(i)||2;var _n='<div class="t-faint-sm" style="margin:-10px 0 6px">Derived from budget plan</div>';
var rb=_lr?(ta('Rollout Costs','ops_'+i+'_rolloutCost',fmtMoney(bpRollTotal(i)),'e.g. $40K to deploy, train, and launch',1,true)+_n):(ta('Rollout Costs','ops_'+i+'_rolloutCost',ops.rolloutCost,'e.g. $40K to deploy, train, and launch',1));
var sb=_ls?(ta('Annual Sustainment Costs','ops_'+i+'_runCost',fmtMoney(bpSusSteady(i)||bpSusOpYear(i,ss))+(ss>1?' from Year '+ss:''),'e.g. $60K per year to keep this running',1,true)+_n):(ta('Annual Sustainment Costs','ops_'+i+'_runCost',ops.runCost,'e.g. $60K per year to keep this running',1));
return'<div>'+rb+'</div><div style="margin-top:2px">'+sb+'</div>'}
function gapItemsOf(i){var p=(data.projects||{})[i]||{};if(p.gapItems)return p.gapItems;
var g=p.gap||{},out={skills:[],resources:[],technology:[]};
['skills','resources','technology'].forEach(function(c){var n=0;
var sp=function(v){return String(v||'').split(';').map(function(x){return x.trim().replace(/\.$/,'')}).filter(function(x){return x})};
sp(g[c+'H']).forEach(function(nm){out[c].push({id:'mig_'+c+'_'+(n++),name:nm,have:true})});
sp(g[c+'N']).forEach(function(nm){out[c].push({id:'mig_'+c+'_'+(n++),name:nm,have:false})})});
return out}
function gapEnsure(i){if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};var p=data.projects[i];if(!p.gapItems)p.gapItems=gapItemsOf(i);return p.gapItems}
function gapAdd(i,c,val){if(Collab.lockedByOther('projects::'+i))return;if(!String(val==null?'':val).trim())return;gapEnsure(i)[c].push({id:uid(),name:String(val).trim(),have:false});Store.commit('projects',i);render()}
function gapHave(i,c,id){if(Collab.lockedByOther('projects::'+i))return;if(!id)return;var it=gapEnsure(i)[c].filter(function(x){return x&&x.id===id})[0];if(it)it.have=true;Store.commit('projects',i);render()}
function gapUnHave(i,c,id){if(Collab.lockedByOther('projects::'+i))return;var it=gapEnsure(i)[c].filter(function(x){return x&&x.id===id})[0];if(it)it.have=false;Store.commit('projects',i);render()}
function gapDel(i,c,id){if(Collab.lockedByOther('projects::'+i))return;var gi=gapEnsure(i);gi[c]=gi[c].filter(function(x){return !x||x.id!==id});Store.commit('projects',i);render()}
function assessBlock(i,ro){var _swH=ro?'':' onchange="fldSave(this.id,this.value)" oninput="fldSave(this.id,this.value,true)"';
var p=(data.projects||{})[i]||{},idea=(data.ideas||[])[i]||{};
var _dt='<div style="font-size:15px;font-weight:700;color:var(--paper);margin:0 0 12px">Project Details</div><div class="gr-2">'+ta('Objectives *','expl_'+i+'_obj',p.objectives||idea.strategic,'What this project aims to achieve',2,ro)+ta('Deliverables','expl_'+i+'_del',p.deliverables,'What will be produced',2,ro)+ta('Timeline','expl_'+i+'_tl',p.timeline,'e.g. Prototype 2mo, Test 1mo',2,ro)+ta('Resources','expl_'+i+'_res',p.resources,'People, budget, technology',2,ro)+ta('Key risks','expl_'+i+'_risk',p.risks||idea.risk,'Main risks and concerns',2,ro)+ta('Success metrics','expl_'+i+'_met',p.metrics,'How we\'ll measure success',2,ro)+'</div>'+
'<h4 class="h-mini">Partnerships</h4><div class="gr-2">'+ta('Internal','expl_'+i+'_pI',p.partInt,'e.g. IT for integration',2,ro)+ta('External','expl_'+i+'_pE',p.partExt,'e.g. AI vendor, consultant',2,ro)+'</div>'+
bpHeadlineCosts(i,p,ro);
var _gi=gapItemsOf(i);
var _gcol=function(c,lbl){var items=_gi[c]||[];var have=items.filter(function(x){return x.have});var gap=items.filter(function(x){return !x.have});
var row=function(it,un){return'<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span class="fs-13" style="flex:1">'+esc(it.name)+'</span><button onclick="'+(un?'gapUnHave':'gapDel')+'('+i+',\''+c+'\',\''+it.id+'\')" class="btn-ghost pad-chip-sm" style="width:22px;padding:1px" title="'+(un?'Move back to the gap':'Remove from the list')+'">\u2715</button></div>'};
var needCol='<div><div class="t-faint-sm" style="margin-bottom:4px">NEED \u2013 everything required</div>'+items.map(function(it){return row(it,false)}).join('')+'<input value="" placeholder="+ Add a need\u2026" onchange="gapAdd('+i+',\''+c+'\',this.value)" class="row-input" style="width:100%;font-size:12px;padding:5px 8px;opacity:.7"/></div>';
var opts=items.filter(function(x){return !x.have});
var haveCol='<div><div class="t-faint-sm" style="margin-bottom:4px">HAVE \u2013 already covered</div>'+have.map(function(it){return row(it,true)}).join('')+(opts.length?'<select onchange="gapHave('+i+',\''+c+'\',this.value)" class="sel-helper" style="width:100%;font-size:12px;padding:5px 8px;opacity:.8"><option value="">+ Mark a need as covered\u2026</option>'+opts.map(function(o){return'<option value="'+o.id+'">'+esc(o.name)+'</option>'}).join('')+'</select>':'')+'</div>';
var gapCol='<div><div class="t-faint-sm" style="margin-bottom:4px">GAP \u2013 need minus have</div>'+(gap.length?gap.map(function(it){return'<div class="fs-13" style="margin-bottom:3px;color:var(--warn-text)">'+esc(it.name)+'</div>'}).join(''):'<div class="t-faint-sm">\u2014</div>')+'</div>';
return'<div style="margin-bottom:24px"><div style="font-size:14px;font-weight:700;color:var(--paper);margin-bottom:8px">'+lbl+'</div><div class="gr-3-sm">'+needCol+haveCol+gapCol+'</div></div>'};
var _an='<div style="font-size:16px;font-weight:800;letter-spacing:.05em;color:var(--paper);margin:0 0 14px">ANALYSES</div>'
+'<h4 class="h-mini">Gap Analysis</h4><div class="t-faint-sm" style="margin:2px 0 14px">List what the project needs, mark what is already covered \u2013 the gap is what remains.</div>'+_gcol('skills','Skills')+'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>'+_gcol('resources','Resources')+'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>'+_gcol('technology','Technology')+'<div style="border-top:1px solid rgba(var(--fg-rgb),.08);margin:0 0 24px"></div>'
+'<h4 class="h-mini">SWOT Analysis</h4><div class="swot-mini">'+[{k:'strengths',l:'+ Strengths',bg:'rgba(27,107,90,.08)'},{k:'weaknesses',l:'\u2212 Weaknesses',bg:'rgba(155,45,63,.06)'},{k:'opportunities',l:'\u25c9 Opportunities',bg:'rgba(45,90,142,.08)'},{k:'threats',l:'\u25b3 Threats',bg:'rgba(139,94,60,.08)'}].map(function(q){return'<div style="background:'+q.bg+';padding:12px"><div class="h-card-lg">'+q.l+'</div><textarea id="expl_'+i+'_sw_'+q.k+'" rows="2"'+_swH+(ro?' readonly':'')+' class="u-5eec54b">'+esc((p.swot||{})[q.k])+'</textarea></div>'}).join('')+'</div>';
var _tk='bta'+i;UI.cardTab=UI.cardTab||{};var _ct=UI.cardTab[_tk]||1;
return bpTabBar(_tk,i,true)+(_ct===2?bpBudgetTab(i,ro):_ct===3?_an:_dt)}
function saveAssessFields(i){if(i==null)return;if(Collab.lockedByOther('projects::'+i))return;if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};var P=data.projects[i];var km={obj:'objectives',del:'deliverables',tl:'timeline',res:'resources',risk:'risks',met:'metrics',cS:'startupCost',cO:'rolloutCost',cR:'runningCost'};Object.keys(km).forEach(function(f){if((f==='cS'&&bpHasDev(i))||(f==='cO'&&bpHasRoll(i))||(f==='cR'&&bpHasSus(i)))return;var e=$('expl_'+i+'_'+f);if(e)P[km[f]]=e.value});var gap=P.gap||{};['skills','resources','technology'].forEach(function(g){var eh=$('expl_'+i+'_'+g+'H'),en=$('expl_'+i+'_'+g+'N');if(eh)gap[g+'H']=eh.value;if(en)gap[g+'N']=en.value});P.gap=gap;var sw=P.swot||{};['strengths','weaknesses','opportunities','threats'].forEach(function(k){var e=$('expl_'+i+'_sw_'+k);if(e)sw[k]=e.value});P.swot=sw;var pI=$('expl_'+i+'_pI'),pE=$('expl_'+i+'_pE');if(pI)P.partInt=pI.value;if(pE)P.partExt=pE.value}
function advanceToDevFromExplore(i){var _pb=(data.portfolio||{})[i]||{};if(((data.projects||{})[i]||{}).viable!==true||!(_pb.horizon&&_pb.risk&&_pb.reward))return;if(!data.expSelected)data.expSelected=[];if(data.expSelected.indexOf(i)<0)data.expSelected.push(i);if(!data.projects)data.projects={};if(!data.projects[i])data.projects[i]={};data.projects[i].advancedAt=Date.now();data.projects[i].committedSnap=bpSnapshot(i);Store.commit('projects',i);if(!data.experiments)data.experiments={};if(!data.experiments[i])data.experiments[i]={};if(!String(data.experiments[i].budget||'').trim()&&String(data.projects[i].startupCost||'').trim()){data.experiments[i].budget=data.projects[i].startupCost;Store.commit('experiments',i)}data.capStale=true;Store.commit('expSelected');Store.commit('capStale');render()}


function doLaunch(i){UI.expanded['lp'+i]=true;render()}
function capLaunchConfirm(i){if(lockBlocked('opsData::'+i))return;
if(!data.opsData)data.opsData={};if(!data.opsData[i])data.opsData[i]={};
var u=typeof getCurrentUser==='function'?(getCurrentUser()||{}):{};
data.opsData[i].launchConfirm={at:Date.now(),by:u.name||'',note:'Figures confirmed against actual launch',expectedFo:(bpHasAny(i)?bpFirstOpMonth(i):null)||null,actualPm:planMonthNow(i)};
Store.commit('opsData',i);UI.expanded['lp'+i]=false;doLaunchGo(i)}
function capLaunchPanel(i){var pm=planMonthNow(i);var fo=bpHasAny(i)?bpFirstOpMonth(i):null;var H=bpHorizon(i);
var h='<div style="margin-top:10px;padding:12px 14px;border:1px solid rgba(212,160,23,.5);border-radius:8px;background:rgba(212,160,23,.06)">';
h+='<div class="t-faint-sm" style="margin-bottom:6px">CONFIRM OR REVISE \u2013 LAUNCH</div>';
if(pm==null||fo==null){h+='<p class="fs-13" style="margin:0 0 8px">No anchored plan to check against \u2013 confirm to launch.</p>'}
else if(pm===fo){h+='<p class="fs-13" style="margin:0 0 8px">On schedule: the plan expected the first operational month exactly now (plan Month '+fo+'). One click.</p>'}
else{var lt=pm>fo;h+='<p class="fs-13" style="margin:0 0 8px">The plan expected the first operational month at plan Month '+fo+'; the launch is happening at plan Month '+pm+' ('+Math.abs(pm-fo)+' month'+(Math.abs(pm-fo)>1?'s':'')+(lt?' late':' early')+'). Rows that have not yet run are listed \u2013 revise them here if the dates move.</p>';
var thr=Math.min(pm,fo);
['dev','roll'].forEach(function(kk){bpRows(i,kk).forEach(function(x){var sp=bpStepSpan(x);if(!sp||!bpStepMoney(x))return;if(sp[1]<thr)return;
h+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc(x.name||'(unnamed step)')+' <span class="t-faint-sm">'+(kk==='dev'?'development':'rollout')+'</span></span><span class="t-faint-sm">From</span>'+bpMonthSel('lp_'+i+'_'+kk+'_'+x.id+'_f',x.from,1,H,'bpRowSave('+i+',\''+kk+'\',\''+x.id+'\',\'from\',this.value)')+'<span class="t-faint-sm">To</span>'+bpMonthSel('lp_'+i+'_'+kk+'_'+x.id+'_t',x.to,1,H,'bpRowSave('+i+',\''+kk+'\',\''+x.id+'\',\'to\',this.value)')+'</div>'})});
bpRows(i,'sus').forEach(function(ph){var sp=bpPhaseSpan(ph);if(!sp||!bpPhaseAnnual(ph))return;if(sp[0]<thr)return;
h+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc(ph.name||'(sustainment phase)')+' <span class="t-faint-sm">sustainment</span></span><span class="t-faint-sm">From</span>'+bpMonthSel('lp_'+i+'_sus_'+ph.id+'_f',ph.from,1,H,'bpPhSave('+i+',\''+ph.id+'\',\'from\',this.value)')+'</div>'})}
h+='<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+btn('Confirm & Launch \u2192','capLaunchConfirm('+i+')','bp','font-size:13px')+btn('Back','UI.expanded[\'lp'+i+'\']=false;render()','bg2','font-size:12px')+'<span class="t-faint-sm">The confirmation is saved for the quarterly review.</span></div></div>';
return h}
function doLaunchGo(i){if(!data.launched)data.launched=[];if(data.launched.indexOf(i)<0)data.launched.push(i);var _lp=(data.projects||{})[i]||{};if(!data.opsData)data.opsData={};if(!data.opsData[i])data.opsData[i]={};if(!String(data.opsData[i].runCost||'').trim()&&String(_lp.runningCost||'').trim()){data.opsData[i].runCost=_lp.runningCost;Store.commit('opsData',i)}if(!String(data.opsData[i].rolloutCost||'').trim()&&String(_lp.rolloutCost||'').trim()){data.opsData[i].rolloutCost=_lp.rolloutCost;Store.commit('opsData',i)}data.capStale=true;Store.commit('launched');Store.commit('capStale');render()}
function killFromLaunch(i){if(lockBlocked('tracking::'+i))return;if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};data.tracking[i].status='killed';data.capStale=true;Store.commit('tracking',i);Store.commit('capStale');render()}
function reviveProject(i){if(lockBlocked('tracking::'+i))return;if(!data.tracking)data.tracking={};if(!data.tracking[i])data.tracking[i]={};data.tracking[i].status='';if(data.tracking[i].killSunkIds)delete data.tracking[i].killSunkIds;data.capStale=true;Store.commit('capStale');Store.commit('tracking',i);render()}
// === VISUALIZATION FUNCTIONS ===

function vizTimeline(currentPhase){
var ranges=[{id:1,start:0,end:30,name:'Diagnose',color:'#1B6B5A'},{id:2,start:31,end:50,name:'Organize',color:'#2D5A8E'},{id:3,start:51,end:70,name:'Prepare',color:'#8B5E3C'},{id:4,start:71,end:90,name:'Ignite',color:'#9B2D3F'}];
var sd=new Date(data.startDate||new Date().toISOString().split('T')[0]);var today=new Date();
var daysSince=Math.max(0,Math.floor((today-sd)/(1000*60*60*24)));var progress=Math.min(100,Math.max(0,(daysSince/90)*100));
var phProg=function(pid){var p=PH.find(function(x){return x.id===pid});if(!p)return 0;var d=p.steps.filter(function(s){return isStepDone(s.id)}).length;return p.steps.length?Math.round(d/p.steps.length*100):0};
var h='<div class="mb-6"><div class="u-fc4d7a9">';
h+='<div class="flx-row-mb-14"><div class="t-fade-sm" style="flex:1">Start Date: '+fmtDate(sd)+'</div><div class="u-64f53f5" style="flex:1;text-align:center;color:var(--paper)">90-Day Timeline</div><div class="t-fade-sm" style="flex:1;text-align:right">Day '+Math.min(90,daysSince)+' of 90</div></div>';
h+='<div class="flx mb-3">';ranges.forEach(function(p){var s0=(p.start===0?0:p.start-1);var w=((p.end-s0)/90)*100;h+='<div onclick="go(\'phase-'+p.id+'\')" class="pipe-tick" style="--w:'+w+'%"><div style="font-size:11px;font-weight:700;color:'+(currentPhase===p.id?p.color:'var(--text-faint)')+'">'+p.name+'</div><div class="u-56f72fc">Days '+(p.start===0?1:p.start)+'\u2013'+p.end+'</div></div>'});
h+='</div><div class="u-c2a178b">';
ranges.forEach(function(p){var s0=(p.start===0?0:p.start-1);var left=(s0/90)*100;var w=((p.end-s0)/90)*100;var pp=phProg(p.id);h+='<div class="ph-bar-pos" data-pos="'+p.id+'" style="--left:'+left+'%;--w:'+w+'%"><div class="ph-fill" data-pos="'+p.id+'" data-full="'+(pp===100?1:0)+'" style="--w:'+pp+'%;--c:'+p.color+'"></div></div>'});
h+='<div title="Today \u2013 day '+Math.min(90,daysSince)+' of 90 on the program clock" style="position:absolute;top:-3px;left:'+progress+'%;width:3px;height:16px;background:#333;border-radius:2px;z-index:3;transition:left .3s;cursor:help"></div></div>';
h+='<div class="flx">';ranges.forEach(function(p){var s0=(p.start===0?0:p.start-1);var w=((p.end-s0)/90)*100;var pp=phProg(p.id);h+='<div onclick="go(\'phase-'+p.id+'\')" class="pipe-tick" style="--w:'+w+'%"><div style="font-size:10px;color:'+(pp===100?'#1B6B5A':'rgba(var(--faint-rgb),.7)')+';font-weight:'+(pp===100?700:400)+'">'+pp+'%</div></div>'});
h+='</div></div></div>';return h}

function vizRadar(){
var cu=data.culture||{},k=data.knowledge||{},de=data.decisions||{};
var cuVals=[cu.uncertainty,cu.aiLegitimacy,cu.newProposals,cu.incentives,cu.frontline,cu.overall].filter(function(v){return typeof v==='number'});
var kVals=[k.usage,k.awareness,k.resources,k.learning].filter(function(v){return typeof v==='number'});
var qs=['q1','q2','q3','q4','q5'];var agility=0;qs.forEach(function(q){var d=de[q]||{};if(d.who&&String(d.who).trim())agility+=(String(d.gap||'').trim()?0.5:1)});
var axes=[{label:'Innovation Culture',value:cuVals.length?(cuVals.reduce(function(a,b){return a+b},0)/cuVals.length):0},{label:'AI Readiness',value:kVals.length?(kVals.reduce(function(a,b){return a+b},0)/kVals.length):0},{label:'Decision Agility',value:agility}];
if(axes.every(function(a){return a.value===0}))return'';
var cx=150,cy=130,R=90,n=3,maxV=[5,5,5],PI=Math.PI;
var axTip={'Innovation Culture':'The average of your Risk & Culture ratings.','AI Readiness':'The average of your AI Knowledge Base ratings.','Decision Agility':'One point for each decision with a named holder and no recorded gaps, and half a point where the holder is named but gaps are recorded.'};
var pts=axes.map(function(a,i){var angle=(PI*2*i/n)-PI/2;var r=R*(a.value/maxV[i]);return{x:cx+r*Math.cos(angle),y:cy+r*Math.sin(angle),lx:cx+(R+22)*Math.cos(angle),ly:cy+(R+22)*Math.sin(angle),v:a.value,m:maxV[i],l:a.label}});
var svg='<svg viewBox="0 0 300 260" class="u-a12ed3b">';
[1,2,3,4,5].forEach(function(lv){var gp=axes.map(function(_,i){var angle=(PI*2*i/n)-PI/2;var r=R*(lv/5);return(cx+r*Math.cos(angle))+','+(cy+r*Math.sin(angle))}).join(' ');svg+='<polygon points="'+gp+'" fill="none" stroke="rgba(245,242,236,.08)" stroke-width="1"/>'});
axes.forEach(function(_,i){var angle=(PI*2*i/n)-PI/2;svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+R*Math.cos(angle))+'" y2="'+(cy+R*Math.sin(angle))+'" stroke="rgba(245,242,236,.08)" stroke-width="1"/>'});
svg+='<polygon points="'+pts.map(function(p){return p.x+','+p.y}).join(' ')+'" fill="#1B6B5A30" stroke="#1B6B5A" stroke-width="2"/>';
pts.forEach(function(p){svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#1B6B5A"/>'});
pts.forEach(function(p){svg+='<text x="'+p.lx+'" y="'+p.ly+'" text-anchor="middle" font-size="10" font-weight="600" fill="#8A8278" font-family="Helvetica Neue,Arial,sans-serif">'+p.l+'<title>'+esc(axTip[p.l]||'')+'</title></text><text x="'+p.lx+'" y="'+(p.ly+12)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#1B6B5A" font-family="Helvetica Neue,Arial,sans-serif">'+(typeof p.v==='number'?p.v.toFixed(1):p.v)+'/'+p.m+'</text>'});
svg+='</svg>';return card('<h3 class="h-sub">Assessment Profile</h3><p class="t-faint-sm" style="margin:-2px 0 8px">Three summary readings from your answers \u2013 hover an axis label for how each is calculated.</p>'+svg,'margin-top:20px;padding:20px')}

// ═══════════════════════════════════════════════════════════════
// VISUAL UPGRADES — adapted from AI-Ready Architecture app
// ═══════════════════════════════════════════════════════════════

/* Big hero stat strip — five live counts in NextChapter style.
   Big serif numeral over small mono uppercase label. */
function vizStatStrip(){
  var ideas=(data.ideas||[]).length;
  var stages=getStages();
  var totalPortfolio=(stages.bluesky||[]).length+(stages.explore||[]).length+(stages.experiment||[]).length+(stages.operational||[]).length;
  var stepsDone=0,stepsTotal=0;
  for(var i=0;i<PH.length;i++){var p=PH[i];for(var j=0;j<p.steps.length;j++){stepsTotal++;if(isStepDone(p.steps[j].id))stepsDone++}}
  var sd=new Date(data.startDate||new Date().toISOString().split('T')[0]);
  var today=new Date();
  var daysElapsed=Math.max(0,Math.min(90,Math.floor((today-sd)/(1000*60*60*24))));

  var stats=[
    {n:daysElapsed,sub:'of 90',l:'Days Elapsed'},
    {n:ideas,l:'Ideas Captured'},
    {n:totalPortfolio,l:'Portfolio Items'},
    {n:stepsDone+'/'+stepsTotal,l:'Steps Complete'}
  ];
  var h='<div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);text-align:center;margin-bottom:10px">Module start date \u2014 '+fmt(data.startDate||today)+'</div><div class="viz-stat-strip">';
  stats.forEach(function(s){
    h+='<div class="viz-stat-cell">'
      +'<div class="viz-stat-num">'+s.n+(s.sub?'<span class="viz-stat-sub">'+s.sub+'</span>':'')+'</div>'
      +'<div class="viz-stat-lbl">'+s.l+'</div>'
      +'</div>';
  });
  return h+'</div>';
}

/* Large 5-axis radar chart for the Assessment Report.
   Scores: array of {name, score (0-5)}.
   Adapted from Architecture's renderRadar(). */
function vizRadarLarge(scores){
  if(!scores||!scores.length)return '';
  var cx=250,cy=185,r=130,n=scores.length;
  var h='<div class="viz-radar"><svg viewBox="0 0 500 380" class="viz-radar-svg">';
  // Concentric ring grid (5 rings)
  for(var ring=1;ring<=5;ring++){
    var pts='';
    for(var i=0;i<n;i++){
      var a=Math.PI*2*i/n-Math.PI/2;
      var rr=r*ring/5;
      pts+=(cx+rr*Math.cos(a))+','+(cy+rr*Math.sin(a))+' ';
    }
    h+='<polygon points="'+pts.trim()+'" fill="none" stroke="rgba(184,137,42,'+(ring===5?'.32':'.12')+')" stroke-width="1"/>';
  }
  // Axis lines + labels
  for(var i=0;i<n;i++){
    var a=Math.PI*2*i/n-Math.PI/2;
    var ex=cx+r*Math.cos(a),ey=cy+r*Math.sin(a);
    h+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex+'" y2="'+ey+'" stroke="rgba(184,137,42,.15)" stroke-width="1"/>';
    var lx=cx+(r+24)*Math.cos(a),ly=cy+(r+24)*Math.sin(a);
    var anchor=lx<cx-8?'end':lx>cx+8?'start':'middle';
    var lbl=scores[i].name.length>16?scores[i].name.substring(0,15)+'…':scores[i].name;
    h+='<text x="'+lx+'" y="'+ly+'" text-anchor="'+anchor+'" dominant-baseline="middle" fill="#B8B0A5" font-size="11" font-weight="600" font-family="var(--mono)" letter-spacing="0.04em">'+lbl+'</text>';
    h+='<text x="'+lx+'" y="'+(ly+14)+'" text-anchor="'+anchor+'" dominant-baseline="middle" fill="#4FB39A" font-size="12" font-weight="700" font-family="var(--mono)">'+(typeof scores[i].score==='number'?scores[i].score.toFixed(1):scores[i].score)+'/5</text>';
  }
  // Data polygon
  var pts='';
  for(var i=0;i<n;i++){
    var a=Math.PI*2*i/n-Math.PI/2;
    var v=Math.max(0,Math.min(5,scores[i].score||0));
    pts+=(cx+(r*v/5)*Math.cos(a))+','+(cy+(r*v/5)*Math.sin(a))+' ';
  }
  h+='<polygon points="'+pts.trim()+'" fill="rgba(27,107,90,.20)" stroke="#1B6B5A" stroke-width="2.5"/>';
  // Score dots
  for(var i=0;i<n;i++){
    var a=Math.PI*2*i/n-Math.PI/2;
    var v=Math.max(0,Math.min(5,scores[i].score||0));
    var px=cx+(r*v/5)*Math.cos(a),py=cy+(r*v/5)*Math.sin(a);
    h+='<circle cx="'+px+'" cy="'+py+'" r="5" fill="#1B6B5A" stroke="var(--ink)" stroke-width="2"/>';
  }
  h+='</svg></div>';
  return h;
}

/* SVG semi-circle gauge for overall pipeline health.
   Score is 0-5; segments fill in color bands. */
function vizHealthGauge(m){var score=m.score;
  var cols=['#9B2D3F','#8B5E3C','#D4A017','#2D5A8E','#1B6B5A'];
  var col=score>=4?'#1B6B5A':score>=2.5?'#8B5E3C':'#9B2D3F';
  var h='<div class="viz-gauge-wrap"><svg viewBox="0 0 200 130" class="viz-gauge-svg">';
  for(var seg=0;seg<5;seg++){
    var a1=Math.PI+seg*Math.PI/5;
    var a2=Math.PI+(seg+1)*Math.PI/5;
    var x1=100+80*Math.cos(a1),y1=110+80*Math.sin(a1);
    var x2=100+80*Math.cos(a2),y2=110+80*Math.sin(a2);
    var active=score>seg;
    h+='<path d="M'+x1+','+y1+' A80,80 0 0,1 '+x2+','+y2+'" fill="none" stroke="'+(active?cols[seg]:'rgba(184,137,42,.15)')+'" stroke-width="14" stroke-linecap="butt"/>';
  }
  // Needle
  var na=Math.PI+score*Math.PI/5;
  var nx=100+62*Math.cos(na),ny=110+62*Math.sin(na);
  h+='<line x1="100" y1="110" x2="'+nx+'" y2="'+ny+'" stroke="var(--paper)" stroke-width="2.5" stroke-linecap="round"/>';
  h+='<circle cx="100" cy="110" r="5" fill="var(--paper)"/>';
  h+='</svg>';
  h+='<div class="viz-gauge-score" style="color:'+col+'">'+score.toFixed(1)+'<span class="viz-gauge-denom">/5</span></div>';
  h+='<div class="viz-gauge-label">Pipeline Maturity</div>';
  h+='<button class="btn-ghost pad-chip-sm" style="margin-top:6px" onclick="UI.expanded.matInfo=!UI.expanded.matInfo;render()">'+(UI.expanded.matInfo?'\u25be':'\u25b8')+' How is this scored?</button>';
  if(UI.expanded.matInfo){h+='<div class="t-faint-sm" style="margin-top:8px;max-width:230px;text-align:left"><p style="margin:0 0 6px">Half the score is build-step completion ('+Math.round(m.completion*100)+'%). Half is pipeline population against these targets:</p>'+m.pop.map(function(p){var hit=p.c>=p.t;return'<div style="display:flex;justify-content:space-between;gap:8px"><span>'+p.n+'</span><strong style="color:'+(hit?'#1B6B5A':'var(--text-faint)')+'">'+p.c+' / '+p.t+'</strong></div>'}).join('')+'<p style="margin:6px 0 0">Blue Sky counts Now ideas plus at most five Ideas for the Future.</p></div>'}
  h+='</div>';
  return h;
}

/* Horizontal dimension bars — one per phase, showing completion %. */
function vizDimBars(){
  var h='<div class="viz-dim-bars">';
  PH.forEach(function(p){if(p.id===5)return;
    var done=p.steps.filter(function(s){return isStepDone(s.id)}).length;
    var total=p.steps.length;
    var pct=total?Math.round(done/total*100):0;
    h+='<div class="viz-dim-row">'
      +'<div class="viz-dim-name">'+p.name+'</div>'
      +'<div class="viz-dim-track"><div class="viz-dim-fill" style="width:'+pct+'%;background:'+p.color+'"></div></div>'
      +'<div class="viz-dim-val" style="color:'+p.color+'">'+pct+'%</div>'
      +'</div>';
  });
  return h+'</div>';
}

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
function getPipelineMaturity(){
  var totalSteps=0,doneSteps=0;
  for(var i=0;i<PH.length;i++){if(PH[i].id===5)continue;for(var j=0;j<PH[i].steps.length;j++){totalSteps++;if(isStepDone(PH[i].steps[j].id))doneSteps++}}
  var completion=totalSteps?(doneSteps/totalSteps):0;
  var st=getStages();var trk=data.tracking||{};
  var opActive=(st.operational||[]).filter(function(i){return(trk[i]||{}).status!=='killed'});
  var bsN=bsNowList(st).length,bsF=st.bluesky.length-bsN;
  var pop=[
    {n:'Blue Sky ideas',c:bsN+Math.min(bsF,5),t:10},
    {n:'Exploration projects',c:st.explore.length,t:5},
    {n:'Active experiments',c:st.experiment.length,t:3},
    {n:'Operational projects',c:opActive.length,t:3}
  ];
  var popScore=pop.reduce(function(a,p){return a+Math.min(p.c/p.t,1)},0)/pop.length;
  // Half build-step completion, half pipeline population against stage targets. Linear pro-rata below target.
  // Blue Sky population = Now ideas + Future ideas capped at 5 (Paul's ruling, July 2).
  return {score:(completion*0.5+popScore*0.5)*5,completion:completion,pop:pop};
}

// ═══════════════════════════════════════════════════════════════
// PORTFOLIO ANALYTICS CHARTS
// All inline SVG. No external libs. Each handles its own empty state.
// ═══════════════════════════════════════════════════════════════

/* Helper: compute portfolio data once for all the charts */
function getPortfolioData(){
  var stages = getStages();
  var ideas = data.ideas || [];
  var assessments = data.assessments || {};
  var projects = data.projects || {};
  var portfolio = data.portfolio || {};
  var tracking = data.tracking || {};

  // Build a normalized project list — one entry per idea that's in any stage
  var items = [];
  var stageList = [
    {key:'bluesky',   label:'Blue Sky',    color:'var(--ph1-t)', ph:'#1B6B5A'},
    {key:'explore',   label:'Exploration', color:'var(--ph2-t)', ph:'#2D5A8E'},
    {key:'experiment',label:'Development', color:'var(--ph3-t)', ph:'#8B5E3C'},
    {key:'operational',label:'Operational',color:'var(--ph4-t)', ph:'#9B2D3F'}
  ];

  stageList.forEach(function(s){
    var arr = stages[s.key] || [];
    arr.forEach(function(i){
      var idea = ideas[i] || {};

      var pf   = portfolio[i] || {};

      var trk  = tracking[i] || {};
      var rb = resolveBands(i, s.key==='bluesky' ? 'bluesky' : 'pd');
      items.push({
        idx: i,
        name: idea.name || ('Item ' + (i+1)),
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
function vizStageDonut(){
  var pd = getPortfolioData();
  var counts = pd.stages.map(function(s){
    return { label:s.label, n:(s.key==='bluesky'?bsNowList(getStages()):(getStages()[s.key]||[])).length, c:s.color, ph:s.ph };
  });
  var total = counts.reduce(function(a,b){return a+b.n},0);

  var h = '<div class="chart-card"><div class="chart-title">Stage Distribution</div>';
  if(total === 0){
    h += '<div class="chart-empty">No portfolio items yet.</div></div>';
    return h;
  }

  h += '<div class="chart-donut-wrap">';
  var cx=110, cy=110, rOuter=85, rInner=58;
  h += '<svg viewBox="0 0 220 220" class="chart-donut-svg">';
  var startAngle = -Math.PI/2;
  counts.forEach(function(seg){
    if(seg.n === 0) return;
    var pct = seg.n / total;
    var endAngle = startAngle + pct * Math.PI * 2;
    if(pct >= 0.9999){
      h += '<circle cx="'+cx+'" cy="'+cy+'" r="'+((rOuter+rInner)/2)+'" fill="none" stroke="'+seg.ph+'" stroke-width="'+(rOuter-rInner)+'"/>';
      h += '<circle cx="'+cx+'" cy="'+cy+'" r="'+rOuter+'" fill="none" stroke="var(--ink)" stroke-width="2"/>';
      h += '<circle cx="'+cx+'" cy="'+cy+'" r="'+rInner+'" fill="none" stroke="var(--ink)" stroke-width="2"/>';
      startAngle = endAngle;
      return;
    }
    var x1 = cx + rOuter * Math.cos(startAngle), y1 = cy + rOuter * Math.sin(startAngle);
    var x2 = cx + rOuter * Math.cos(endAngle),   y2 = cy + rOuter * Math.sin(endAngle);
    var x3 = cx + rInner * Math.cos(endAngle),   y3 = cy + rInner * Math.sin(endAngle);
    var x4 = cx + rInner * Math.cos(startAngle), y4 = cy + rInner * Math.sin(startAngle);
    var large = pct > 0.5 ? 1 : 0;
    var d = 'M'+x1+','+y1+' A'+rOuter+','+rOuter+' 0 '+large+' 1 '+x2+','+y2
          + ' L'+x3+','+y3+' A'+rInner+','+rInner+' 0 '+large+' 0 '+x4+','+y4+' Z';
    h += '<path d="'+d+'" fill="'+seg.ph+'" stroke="var(--ink)" stroke-width="2"/>';
    startAngle = endAngle;
  });
  // Center label
  h += '<text x="110" y="98" text-anchor="middle" dominant-baseline="middle" font-family="var(--serif)" font-size="44" fill="var(--paper)" font-weight="300">'+total+'</text>';
  h += '<text x="110" y="134" text-anchor="middle" dominant-baseline="middle" font-family="var(--mono)" font-size="10" fill="var(--stone)" letter-spacing="0.2em">PROJECTS</text>';
  h += '</svg>';

  // Legend
  h += '<div class="chart-legend">';
  counts.forEach(function(seg){
    var pct = total ? Math.round(seg.n/total*100) : 0;
    h += '<div class="chart-legend-row">'
      +  '<span class="chart-legend-dot" style="background:'+seg.ph+'"></span>'
      +  '<span class="chart-legend-name">'+seg.label+'</span>'
      +  '<span class="chart-legend-val" style="color:'+seg.c+'">'+seg.n+'</span>'
      +  '<span class="chart-legend-pct">'+pct+'%</span>'
      +  '</div>';
  });
  h += '</div></div></div>';
  return h;
}

/* ─── Chart 2: Capital Allocation stacked bar ─────────────── */
function vizCapitalSplit(){
  var cap=data.capital||{};var port=data.portfolio||{};var com=capCommitments();
  var qAmt=0,hAmt=0,qN=0,hN=0;
  com.rows.forEach(function(r){var hz=(port[r.i]||{}).horizon;if(!hz)return;if(hz==='quick'){qAmt+=r.amt;qN++}else{hAmt+=r.amt;hN++}});
  var quick=0,horizon=0;
  if(qAmt+hAmt>0){quick=Math.round(qAmt/(qAmt+hAmt)*100);horizon=100-quick}
  else if(qN+hN>0){quick=Math.round(qN/(qN+hN)*100);horizon=100-quick}
  else{var pd=getPortfolioData();var q2=0,h2=0;pd.items.forEach(function(it){if(it.horizon==='quick')q2++;else if(it.horizon)h2++});var t=q2+h2;if(t){quick=Math.round(q2/t*100);horizon=100-quick}}
  var h = '<div class="chart-card"><div class="chart-title">Committed Capital</div>';
  if(quick === 0 && horizon === 0){
    h += '<div class="chart-empty">Nothing committed yet.</div></div>';
    return h;
  }
  h += '<div class="cap-split-labels">';
  h += '<div class="cap-split-side"><div class="cap-split-pct" style="color:var(--ph1-t)">'+quick+'%</div><div class="cap-split-name">Quick Wins</div></div>';
  h += '<div class="cap-split-side cap-split-right"><div class="cap-split-pct" style="color:var(--ph3-t)">'+horizon+'%</div><div class="cap-split-name">Horizon Bets</div></div>';
  h += '</div>';
  h += '<div class="cap-split-bar">';
  h += '<div class="cap-split-fill" style="width:'+quick+'%;background:#1B6B5A"></div>';
  h += '<div class="cap-split-fill" style="width:'+horizon+'%;background:#8B5E3C"></div>';
  h += '</div>';
  if(com.total){ h += '<div class="cap-split-foot">Committed: <strong>'+fmtMoney(com.total)+'</strong>'+(cap.aiBudget?' of <strong>'+esc(cap.aiBudget)+'</strong> budget':'')+'</div>'; }
  h += '</div>';
  return h;
}
function vizPortfolioMap(){
  var pd = getPortfolioData();
  var _all = pd.items.filter(function(it){return it.stage !== 'bluesky' && it.score > 0});
  var items = _all.filter(function(it){return it.horizon});
  var _skipped = _all.length - items.length;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Portfolio Map <span class="chart-subtitle">Impact × Horizon, sized by priority</span></div>';
  if(items.length === 0){
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
    {key:'quick',   label:'Quick Win',   x:padL + plotW*0.25},
    {key:'horizon', label:'Horizon Bet', x:padL + plotW*0.75}
  ];

  // Y axis: 0 to max score (typically 50)
  var maxScore = 50;
  function yFor(score){
    return padT + plotH - (score/maxScore) * plotH;
  }

  // Bubble radius by priority
  function rFor(p){
    return p === 'high' ? 22 : p === 'medium' ? 16 : 12;
  }

  h += '<svg viewBox="0 0 '+W+' '+H+'" class="chart-bubble-svg">';

  // Grid lines (horizontal at score 10/25/40)
  [10,25,40].forEach(function(s){
    var y = yFor(s);
    h += '<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="rgba(245,242,236,.06)" stroke-width="1" stroke-dasharray="2,3"/>';
    h += '<text x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end" font-family="var(--mono)" font-size="10" fill="var(--stone)">'+s+'</text>';
  });

  // Axes
  h += '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(H-padB)+'" stroke="rgba(245,242,236,.15)" stroke-width="1"/>';
  h += '<line x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'" stroke="rgba(245,242,236,.15)" stroke-width="1"/>';

  // X-axis labels
  xBuckets.forEach(function(b){
    h += '<text x="'+b.x+'" y="'+(H-padB+22)+'" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--paper)" letter-spacing="0.1em">'+b.label.toUpperCase()+'</text>';
  });

  // Y-axis label
  h += '<text x="20" y="'+(padT+plotH/2)+'" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--stone)" letter-spacing="0.15em" transform="rotate(-90 20 '+(padT+plotH/2)+')">IMPACT SCORE</text>';

  // Group items by bucket so we can dodge overlaps
  var bucketed = {};
  items.forEach(function(it){
    var b = it.horizon === 'quick' ? 'quick' : 'horizon';
    if(!bucketed[b]) bucketed[b] = [];
    bucketed[b].push(it);
  });

  // Sort each bucket by score so overlapping bubbles tile naturally
  Object.keys(bucketed).forEach(function(k){
    bucketed[k].sort(function(a,b){return b.score - a.score});
  });

  // Plot bubbles, dodging horizontally within each bucket
  xBuckets.forEach(function(b){
    var arr = bucketed[b.key] || [];
    arr.forEach(function(it, idx){
      var y = yFor(it.score);
      var r = rFor(it.priority);
      // dodge horizontally based on index parity
      var dodge = (idx % 2 === 0 ? 1 : -1) * Math.floor(idx/2) * (r*1.6);
      var x = b.x + dodge;
      var initials = it.name.split(/\s+/).map(function(w){return w[0]||''}).slice(0,2).join('').toUpperCase();
      h += '<g class="bubble-g" style="cursor:pointer" onclick="go(\'out-'+(it.stage==='bluesky'?'bluesky':it.stage==='explore'?'explore':it.stage==='experiment'?'expbriefs':'oper')+'\')">';
      h += '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+it.phaseColor+'" fill-opacity="0.75" stroke="'+it.stageColor+'" stroke-width="2"/>';
      h += '<text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-family="var(--mono)" font-size="'+(r >= 18 ? 11 : 9)+'" font-weight="700" fill="#fff">'+esc(initials)+'</text>';
      h += '<title>'+esc(it.name)+' · '+it.stageLabel+' · score '+it.score+' · '+it.priority+' priority</title>';
      h += '</g>';
    });
  });

  h += '</svg>';
  if(_skipped) h += '<div class="t-faint-sm" style="margin-top:4px">'+_skipped+' project'+(_skipped>1?'s':'')+' not yet placeable \u2013 add a timeframe, triage scores, or grades.</div>';

  // Legend underneath
  h += '<div class="bubble-legend">';
  h += '<div class="bubble-legend-group"><span class="bubble-legend-lbl">Priority</span>'
     + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:22px;height:22px"></span>High</span>'
     + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:16px;height:16px"></span>Medium</span>'
     + '<span class="bubble-legend-item"><span class="bubble-priority-dot" style="width:12px;height:12px"></span>Low</span>'
     + '</div>';
  h += '<div class="bubble-legend-group"><span class="bubble-legend-lbl">Stage</span>';
  var _plotted={};items.forEach(function(it){_plotted[it.stage]=1});
  pd.stages.forEach(function(s){
    if(!_plotted[s.key])return;
    h += '<span class="bubble-legend-item"><span class="bubble-legend-dot" style="background:'+s.ph+'"></span>'+s.label+'</span>';
  });
  h += '</div>';
  h += '</div></div>';
  return h;
}

/* ─── Chart 4: Status Breakdown (stacked horizontal bars) ── */
function vizStatusBars(){
  var pd = getPortfolioData();

  var statusList = [
    {key:'running',  label:'Running',  c:'#2D5A8E'},
    {key:'paused',   label:'Paused',   c:'#D4A017'},
    {key:'complete', label:'Complete', c:'#1B6B5A'},
    {key:'killed',   label:'Killed',   c:'#9B2D3F'},
    {key:'—',        label:'No Status',c:'rgba(var(--fg-rgb),.10)'}
  ];

  // Build counts per stage per status
  var stageData = pd.stages.map(function(s){
    var arr = pd.items.filter(function(it){return it.stage === s.key});
    var statuses = {};
    statusList.forEach(function(st){statuses[st.key] = 0});
    arr.forEach(function(it){
      var k = it.status;
      if(!statuses.hasOwnProperty(k)) k = '—';
      statuses[k]++;
    });
    return { label:s.label, color:s.ph, total:arr.length, statuses:statuses };
  });

  var maxTotal = Math.max.apply(null, stageData.map(function(s){return s.total})) || 1;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Status Breakdown <span class="chart-subtitle">By stage and execution status</span></div>';
  if(maxTotal === 0){
    h += '<div class="chart-empty">No portfolio items yet.</div></div>';
    return h;
  }

  h += '<div class="status-rows">';
  stageData.forEach(function(s){
    h += '<div class="status-row">';
    h += '<div class="status-row-label" style="color:'+s.color+'">'+s.label+'</div>';
    h += '<div class="status-row-bar">';
    statusList.forEach(function(st){
      var n = s.statuses[st.key];
      if(n === 0) return;
      var pct = (n/maxTotal)*100;
      h += '<div class="status-seg" style="width:'+pct+'%;background:'+st.c+'" title="'+st.label+': '+n+'">'
         + (pct > 10 ? '<span class="status-seg-n">'+n+'</span>' : '')
         + '</div>';
    });
    h += '</div>';
    h += '<div class="status-row-total">'+s.total+'</div>';
    h += '</div>';
  });
  h += '</div>';

  // Status legend
  h += '<div class="status-legend">';
  statusList.forEach(function(st){
    if(st.key === '—') return;
    h += '<span class="status-legend-item"><span class="status-legend-dot" style="background:'+st.c+'"></span>'+st.label+'</span>';
  });
  h += '</div></div>';
  return h;
}

/* ─── Chart 5: Owner Load (bar chart per user) ────────────── */
function vizOwnerLoad(){
  var assigns = data.assigns || {};
  var counts = {};
  USERS.forEach(function(u){counts[u.id] = 0});
  Object.keys(assigns).forEach(function(stepId){
    (assigns[stepId] || []).forEach(function(uid){
      if(counts.hasOwnProperty(uid)) counts[uid]++;
    });
  });

  var rows = USERS.map(function(u){return { u:u, n:counts[u.id] }});
  var max = Math.max.apply(null, rows.map(function(r){return r.n})) || 1;

  var h = '<div class="chart-card chart-card-wide"><div class="chart-title">Team Load <span class="chart-subtitle">Step assignments per member</span></div>';
  if(rows.every(function(r){return r.n === 0})){
    h += '<div class="chart-empty">No assignments yet. Open any step to assign team members.</div></div>';
    return h;
  }

  h += '<div class="owner-rows">';
  rows.forEach(function(r){
    var pct = (r.n/max)*100;
    h += '<div class="owner-row">';
    h += '<div class="owner-row-av">'+userAv(r.u, 26)+'</div>';
    h += '<div class="owner-row-name">'+esc(r.u.name)+'</div>';
    h += '<div class="owner-row-bar"><div class="owner-row-fill" style="width:'+pct+'%;background:'+r.u.color+'"></div></div>';
    h += '<div class="owner-row-n">'+r.n+'</div>';
    h += '</div>';
  });
  h += '</div></div>';
  return h;
}

/* ─── Compose the whole analytics block ────────────────────── */
function renderPortfolioAnalytics(){
  var h = '<div class="analytics-block">';
  h += '<div class="analytics-header">';
  h += '<div class="analytics-eyebrow">Phase 5 · Analytics</div>';
  h += '<h2 class="analytics-title">Portfolio <em>at a Glance</em></h2>';
  h += '</div>';
  h += '<div class="analytics-grid-2">';
  h += vizStageDonut();
  h += '<div onclick="go(\'cap-hub\')" style="cursor:pointer" title="Open Capital Planning Hub">'+vizCapitalSplit()+'</div>';
  h += '</div>';
  h += vizPortfolioMap();
  h += vizStatusBars();
  h += '<div onclick="go(\'mgmt-hub\')" style="cursor:pointer" title="Open Module Management">'+vizOwnerLoad()+'</div>';
  h += '</div>';
  return h;
}

function vizIdeas(){
var ideas=data.ideas||[];if(!ideas.length)return'';
var _bs=getStages().bluesky;if(!_bs.length)return'';
var _pool=_bs.map(function(i){var idea=ideas[i]||{};return{name:idea.name,when:idea.when,dept:idea.dept,idx:i}});
var now=_pool.filter(function(x){return x.when==='now'});
var future=_pool.filter(function(x){return x.when!=='now'});
var depts={};_pool.forEach(function(x){var d=x.dept||'Unassigned';depts[d]=(depts[d]||0)+1});
var h='<h3 class="h-sub">Ideas Landscape</h3><p class="t-faint-sm" style="margin:-2px 0 10px">Click an idea to open its card. \u201cNow\u201d ideas can be filtered and ranked at the next step. \u201cFuture\u201d ideas wait here until their status is changed to \u201cNow\u201d.</p><div class="u-37fa46c"><div class="t-center"><div class="u-a5b7f18">Now ('+now.length+')</div><div class="u-c4c0acf">';
now.forEach(function(idea){var nm=(idea.name||'').length>16?(idea.name||'').substring(0,14)+'\u2026':idea.name;h+='<div onclick="openIdeaForm('+idea.idx+')" class="u-fb07e78"><div class="u-5f887bd">◇</div><div class="u-536b48f">'+esc(nm)+'</div></div>'});
h+='</div></div>';
if(future.length>0){h+='<div class="t-center"><div class="u-2bb3590">Future ('+future.length+')</div><div class="u-c4c0acf">';future.forEach(function(idea){var nm=(idea.name||'').length>16?(idea.name||'').substring(0,14)+'\u2026':idea.name;h+='<div onclick="openIdeaForm('+idea.idx+')" class="u-32112ed"><div class="u-5f887bd">◆</div><div class="u-536b48f">'+esc(nm)+'</div></div>'});h+='</div></div>'}
h+='</div><div class="u-0b70227">';
Object.keys(depts).forEach(function(d){h+='<span><strong>'+esc(d)+':</strong> '+depts[d]+'</span>'});
h+='</div>';return card(h,'margin-top:20px')}

function bsLegend(note){
var chip=function(l,c){return'<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:'+c+';display:inline-block"></span>'+l+'</span>'};
return'<div style="display:flex;flex-wrap:wrap;align-items:center;margin:4px 0 10px"><span style="font-size:11px;color:var(--text-faint);letter-spacing:.06em;margin-right:10px">KEY</span>'+chip('Now','#1B6B5A')+chip('Future','#2D5A8E')+chip('Disqualified','#9B2D3F')+(note?'<span style="font-size:11px;color:var(--text-faint);margin-left:auto">'+note+'</span>':'')+'</div>'}
function vizScores(){
var ideas=data.ideas||[],as=data.assessments||{};if(!ideas.length)return'';
var scored=getStages().bluesky.filter(function(i){return(ideas[i]||{}).when!=='future'}).map(function(i){var idea=ideas[i]||{};var a=as[i]||{};var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;var score=feasible?triageScore(i):null;var disq=[a.techCapable,a.resourcesAvailable,a.culturalFit,a.purposeAligned,a.affordable].some(function(v){return v===false});return{name:idea.name||'Idea '+(i+1),score:score,disq:disq,when:idea.when}}).filter(function(s){return s.score!==null||s.disq}).sort(function(a,b){return(b.score||0)-(a.score||0)});
if(!scored.length)return'';
var maxS=50,W=460,barH=20,pad=120,H=Math.max(160,scored.length*28+60);
var svg='<svg viewBox="0 0 '+W+' '+H+'" class="u-ce6fc96">';
scored.forEach(function(s,i){var y=30+i*(barH+8);var w=s.score!==null?(s.score/maxS)*(W-pad-20):0;var c=s.disq?'#9B2D3F':(s.when==='future'?'#2D5A8E':'#1B6B5A');var nm=s.name.length>14?s.name.substring(0,12)+'\u2026':s.name;
svg+='<text x="'+(pad-8)+'" y="'+(y+barH/2+4)+'" text-anchor="end" font-size="10" fill="#8A8278" font-family="Helvetica Neue,Arial,sans-serif">'+esc(nm)+'</text>';
if(s.disq){svg+='<rect x="'+pad+'" y="'+y+'" width="'+(W-pad-20)+'" height="'+barH+'" fill="rgba(155,45,63,.06)" rx="3"/><text x="'+(pad+8)+'" y="'+(y+barH/2+4)+'" font-size="10" fill="#9B2D3F" font-family="Helvetica Neue,Arial,sans-serif" font-weight="600">Disqualified</text>'}
else{svg+='<rect x="'+pad+'" y="'+y+'" width="'+(W-pad-20)+'" height="'+barH+'" fill="rgba(245,242,236,.06)" rx="3"/><rect x="'+pad+'" y="'+y+'" width="'+w+'" height="'+barH+'" fill="'+c+'40" stroke="'+c+'" stroke-width="1" rx="3"/><text x="'+(pad+w+6)+'" y="'+(y+barH/2+4)+'" font-size="11" fill="'+c+'" font-family="Helvetica Neue,Arial,sans-serif" font-weight="700">'+s.score+'/50</text>'}});
svg+='</svg>';return card('<h3 class="h-sub">Score Distribution</h3>'+'<div style="display:flex;flex-wrap:wrap;align-items:center;margin:4px 0 10px"><span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:#1B6B5A;display:inline-block"></span>Qualified</span><span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:12px;color:var(--text-faint)"><span style="width:10px;height:10px;border-radius:5px;background:#9B2D3F;display:inline-block"></span>Disqualified</span><span style="font-size:11px;color:var(--text-faint);margin-left:auto">Bar length = score out of 50</span></div>'+svg,'margin-top:20px')}

function vizProjectReady(){
var sel=data.selected||[],proj=data.projects||{};if(!sel.length)return'';
var goC=sel.filter(function(i){return(proj[i]||{}).viable===true}).length;
var noC=sel.filter(function(i){return(proj[i]||{}).viable===false}).length;
var penC=sel.filter(function(i){return(proj[i]||{}).viable===undefined}).length;
var t=sel.length;
return card('<h3 class="h-sub-lg">Project Assessment Summary</h3><div class="u-5f04749"><div class="u-c91903e"><div class="score-num-go">'+goC+'</div><div class="u-5b23054">Go</div></div><div class="u-74df1b3"><div class="u-f02b9ef">'+noC+'</div><div class="u-3249b02">No Go</div></div><div class="u-664254f"><div class="u-1a106b8">'+penC+'</div><div class="u-4735f5f">Pending</div></div></div><div class="u-08c36f4">'+(goC?'<div style="width:'+((goC/t)*100)+'%;background:#1B6B5A;height:100%"></div>':'')+(noC?'<div style="width:'+((noC/t)*100)+'%;background:#9B2D3F;height:100%"></div>':'')+(penC?'<div style="width:'+((penC/t)*100)+'%;background:rgba(var(--fg-rgb),.12);height:100%"></div>':'')+'</div>','margin-top:20px')}

var insightsTab='latest'; // QA sweep 1 item 1: read by insightsTabBtn/setInsightsTab but never declared - first Insights visit threw ReferenceError
/* INSIGHTS CONTENT restored July 9 from the July 5 build (Paul-supplied, transplanted verbatim; renderers verified identical). The block was lost between July 5 and July 8 - see the July 9 session log. */
var INSIGHT_SOURCES={
  hbr:{label:'Harvard Business Review'},
  smr:{label:'MIT Sloan Management Review'},
  fastco:{label:'Fast Company'},
  imd:{label:'I by IMD'},
  psych:{label:'Psychology Today'},
  linkedin:{label:'LinkedIn'}
};

var LATEST_THOUGHTS=[
{src:'hbr',title:'Manage Your AI Investments Like a Portfolio',date:'January 2026',url:'https://faisalhoque.com/manage-your-ai-investments-like-a-portfolio/',excerpt:'Why a disciplined, stage-gated portfolio approach is the difference between AI investments that compound and pilots that drain attention and resources.'},
{src:'hbr',title:'Two Frameworks for Balancing AI Innovation and Risk',date:'March 2025',url:'https://faisalhoque.com/two-frameworks-for-balancing-ai-innovation-and-risk/',excerpt:'OPEN and CARE \u2013 the two complementary frameworks for harnessing AI\u2019s potential while guarding against its risks.'},
{src:'smr',title:'Why AI Demands a New Breed of Leaders',date:'April 2025',url:'https://sloanreview.mit.edu/article/why-ai-demands-a-new-breed-of-leaders/',excerpt:'With Thomas H. Davenport and Erik Nelson \u2013 why organizations need a new leadership role to manage the cultural and organizational change that AI adoption brings.'},
{src:'fastco',title:'Boards of Directors Have Critical New Responsibilities in the AI Era',date:'June 11, 2026',url:'https://faisalhoque.com/boards-of-directors-have-critical-new-responsibilities-in-the-ai-era/',excerpt:'If leadership were just analysis, an algorithm could do it. What boards must now own in the AI era \u2013 and how to build the capabilities to own it.'},
{src:'fastco',title:'Culture Is Where AI Strategy Goes to Die. Here\u2019s How to Jump-Start an AI-Ready Culture in 90 Days',date:'May 18, 2026',url:'https://faisalhoque.com/culture-is-where-ai-strategy-goes-to-die-heres-how-to-jump-start-an-ai-ready-culture-in-90-days/',excerpt:'A step-by-step road map for building a culture that supports AI transformation instead of suffocating it.'},
{src:'fastco',title:'The Cost of Hollowing Out Human Accountability',date:'2026',url:'https://faisalhoque.com/the-cost-of-hollowing-out-human-accountability/',excerpt:'Twenty seconds to approve a military strike; 1.2 seconds to deny an insurance claim. What happens when humans are in the loop but humanity is not.'},
{src:'imd',title:'Stop Developing an Obsolete AI Strategy. Part 2: Enterprise Risk',date:'May 31, 2026',url:'https://faisalhoque.com/stop-developing-an-obsolete-ai-strategy-part-2-enterprise-risk/',excerpt:'How to defend against the risks that emerge from what others are doing with AI \u2013 new models, competitor breakthroughs, and shifts in how value is created.'},
{src:'imd',title:'Stop Developing an Obsolete AI Strategy. Part 1: Project Risk',date:'May 20, 2026',url:'https://www.imd.org/ibyimd/brain-circuits/stop-developing-an-obsolete-ai-strategy-part-1-project-risk/',excerpt:'The distinction every leader needs: project risk arises from your own AI implementations, and portfolio discipline is how you manage it.'},
{src:'psych',title:'The Loneliness of Being Needed',date:'May 31, 2026',url:'https://faisalhoque.com/the-loneliness-of-being-needed/',excerpt:'The strongest person you know is running on empty. It might be you.'},
{src:'psych',title:'We All Use AI. Here\u2019s How to Use It Well',date:'May 19, 2026',url:'https://faisalhoque.com/we-all-use-ai-heres-how-to-use-it-well/',excerpt:'The future belongs to people who can think with AI \u2013 without thinking like it.'},
{src:'psych',title:'Only Dead Things Stay the Same',date:'April 22, 2026',url:'https://faisalhoque.com/dead-things-stay-the-sameyour-next-chapter-in-the-age-of-ai/',excerpt:'Most of us live in the waiting room of our own lives, waiting for things to settle. They never do \u2013 and that is the nature of being alive.'},
{src:'linkedin',title:'Faisal on LinkedIn',date:'Updated daily',url:'https://www.linkedin.com/in/faisalhoque/',excerpt:'Daily commentary on AI, leadership, and transformation \u2013 the fastest-moving strand of Faisal\u2019s thinking, posted most days.'}
];

var CONVERGENCE_EPISODES=[
{tag:'Episode 17',title:'How to Jump-Start Your Company\u2019s Responsible AI Governance in 90 Days',yt:'fGxQxBIhOLs',desc:'A step-by-step road map through the essential foundations for managing AI ethics, accountability, and human impact.'},
{tag:'Episode 16',title:'How to Diagnose the Strategic Gap: AI Readiness for Leaders',yt:'BtoHiUeI1D0',desc:'Three critical questions for AI strategy \u2013 identifying business bottlenecks, building a cultural safety net, and the 90-day reality of innovation.'},
{tag:'Episode 15',title:'Is the AI Job Crisis Designed?',yt:'igUJjKHIKEk',desc:'From boardroom decisions that favor short-term margins to the demand desert created when companies automate their own customers out of existence.'},
{tag:'Episode 14',title:'Regenerative Leadership Principles to Scale AI Successfully',yt:'HifjkL3XyiM',desc:'How regenerative leadership fuels innovation, collaboration, and resilience while building teams that last.'}
];

var FEATURED_VIDEOS=[
{tag:'Fast Company',title:'How Companies Can Roll Out AI Without Replacing Employees',yt:'nJAsQANx9yQ',desc:'Fast Company senior editor Bryan Lufkin talks with Faisal about what companies get wrong when rolling out AI \u2013 and how to do it better.'},
{tag:'Yahoo Finance',title:'Balancing Innovation and Security',yt:'18661-i900Y',desc:'Responsible innovation and responsible utilization come first. A conversation about the fundamentals of deploying AI well.'},
{tag:'TRANSCEND',title:'Four Parts to TRANSCEND',yt:'wZnd_WZ3iBs',desc:'The structure behind the book \u2013 including the philosophical grounding that gave rise to the OPEN and CARE frameworks.'},
{tag:'I by IMD Book Club',title:'Navigating Business Transformation in a Hyperdigital Era',yt:'Ow-mnxL2tQM',desc:'The I by IMD Book Club session on REINVENT \u2013 how organizations stay on top of relentless change.'}
];

var WORTH_YOUR_TIME=[
{kind:'Book',cta:'View on Amazon',title:'All In on AI',by:'Thomas H. Davenport and Nitin Mittal \u00b7 Harvard Business Review Press, 2023',url:'https://www.amazon.com/dp/1647824699',desc:'How the most aggressive adopters \u2013 Ping An, Airbus, Capital One \u2013 put AI at the core of everything they do, from the longest-standing authority on enterprise analytics.'},
{kind:'Article',cta:'Read Article',title:'Five Trends in AI and Data Science for 2026',by:'Thomas H. Davenport and Randy Bean \u00b7 MIT Sloan Management Review',url:'https://sloanreview.mit.edu/article/five-trends-in-ai-and-data-science-for-2026/',desc:'Their annual reading of where enterprise AI is actually heading \u2013 the investment bubble, the move to AI factories, agentic AI\u2019s slow road to value, and who should own the AI agenda.'},
{kind:'Video',cta:'Watch Video',title:'AI Trends in 2026: Key Insights for Leaders',by:'Thomas H. Davenport and Randy Bean \u00b7 MIT Sloan Management Review \u00b7 13 min',url:'https://sloanreview.mit.edu/video/ai-trends-in-2026-key-insights-for-leaders/',desc:'The companion conversation to the trends column: why most AI investments are not paying off yet, and what leading companies do differently.'},
{kind:'Newsletter',cta:'Visit Newsletter',title:'One Useful Thing',by:'Ethan Mollick \u00b7 Wharton School',url:'https://www.oneusefulthing.org/',desc:'A free newsletter on working with AI in practice \u2013 grounded in research, hands-on, and updated as fast as the technology moves.'},
{kind:'Report',cta:'Read Report',title:'The 2026 AI Index Report',by:'Stanford Institute for Human-Centered AI',url:'https://hai.stanford.edu/ai-index/2026-ai-index-report',desc:'The most comprehensive annual data on AI\u2019s technical progress, economic footprint, and adoption \u2013 a standard reference for scanning the horizon.'},
{kind:'Book',cta:'View on Amazon',title:'Competing in the Age of AI',by:'Marco Iansiti and Karim R. Lakhani \u00b7 Harvard Business Review Press, 2020',url:'https://www.amazon.com/dp/1633697622',desc:'The Harvard Business School case for why AI-driven operating models change the rules of scale, scope, and learning.'},
{kind:'Book',cta:'View on Amazon',title:'The Coming Wave',by:'Mustafa Suleyman with Michael Bhaskar \u00b7 Crown, 2023',url:'https://www.amazon.com/Coming-Wave-Power-Our-Future/dp/0593593979',desc:'The DeepMind co-founder \u2013 now chief executive of Microsoft AI \u2013 on the containment problem: keeping control of technologies that spread faster than the institutions meant to govern them.'},
{kind:'Podcast',cta:'Listen to Podcast',title:'Me, Myself, and AI',by:'Sam Ransbotham and Shervin Khodabandeh \u00b7 MIT Sloan Management Review and Boston Consulting Group',url:'https://sloanreview.mit.edu/audio-series/me-myself-and-ai/',desc:'What separates AI success from AI hype \u2013 episode-by-episode conversations with the people running AI inside companies like YouTube, Cisco, Sony, and ExxonMobil.'}
];
function renderInsights(){
  var h='<div class="u-70c6b34">';

  // ── Hero bar ──────────────────────────────────────────────────────────────
  h+='<div class="u-4f90335">';
  h+='<div class="section-label">Insights</div>';
  h+='<div class="u-3536245">';
  h+='<div>';
  h+='<h1 class="section-title u-d51702b">Ideas &amp; <em>Conversations</em></h1>';
  h+='<p class="u-7e59c65">Faisal Hoque\u2019s latest writing across six outlets, the CONVERGENCE podcast and interview appearances, and a shelf of work by people we admire.</p>';
  h+='</div>';
  h+='</div>';

  // ── Section navigation (anchors, not content switches) ────────────────────
  h+='<div class="u-58a9696">';
  h+=insightsTabBtn('latest','Latest Thoughts');
  h+=insightsTabBtn('conversations','Conversations');
  h+=insightsTabBtn('worth','Worth Your Time');
  h+='</div>';
  h+='</div>';

  // ── All three sections on one continuous page ─────────────────────────────
  h+='<div class="u-dc4836c">';
  h+='<div id="insights-latest" class="insights-section">';
  h+='<div class="section-title insights-section-title">Latest <em>Thoughts</em></div>';
  h+=insightsLatestHtml();
  h+='</div>';
  h+='<div id="insights-conversations" class="insights-section" style="margin-top:56px">';
  h+='<div class="section-title insights-section-title">Conversations</div>';
  h+=insightsConversationsHtml();
  h+='</div>';
  h+='<div id="insights-worth" class="insights-section" style="margin-top:56px">';
  h+='<div class="section-title insights-section-title">Worth Your <em>Time</em></div>';
  h+=insightsWorthHtml();
  h+='</div>';
  h+='</div>';

  h+='</div>';
  return h;
}

function insightsTabBtn(id,label){
  return '<button class="insight-filter'+(insightsTab===id?' active':'')+'" data-itab="'+id+'" onclick="setInsightsTab(\''+id+'\')">'+label+'</button>';
}

function setInsightsTab(t){
  insightsTab=t;
  var btns=document.querySelectorAll('.insight-filter[data-itab]');
  for(var i=0;i<btns.length;i++){btns[i].classList.toggle('active',btns[i].getAttribute('data-itab')===t);}
  var sec=document.getElementById('insights-'+t);
  if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
}

function insightsLatestHtml(){
  var h='<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">The most recent pieces from each outlet, refreshed as new work appears. Articles open on faisalhoque.com.</p>';
  h+='<div class="u-53a30b8">';
  for(var i=0;i<LATEST_THOUGHTS.length;i++){
    var it=LATEST_THOUGHTS[i];var s=INSIGHT_SOURCES[it.src];
    h+='<div class="insight-card" onclick="window.open(\''+it.url+'\',\'_blank\')">';
    h+='<div class="insight-card-header">';
    h+='<span class="insight-badge insight-badge--mono">'+s.label+'</span>';
    h+='<span class="insight-date">'+esc(it.date)+'</span>';
    h+='</div>';
    h+='<div class="insight-title">'+esc(it.title)+'</div>';
    h+='<div class="insight-excerpt">'+esc(it.excerpt)+'</div>';
    h+='<div class="insight-card-foot"><span class="insight-cta">Read \u2192</span></div>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}

function insightsConversationsHtml(){
  var h='<div class="section-label" style="margin-top:4px">The CONVERGENCE Podcast</div>';
  h+='<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">The latest four episodes of the signature series with Faisal Hoque and Lauren Hawker Zafer. Click any episode to play it here.</p>';
  h+='<div class="conv-grid">';
  for(var i=0;i<CONVERGENCE_EPISODES.length;i++)h+=insightsYtCard(CONVERGENCE_EPISODES[i]);
  h+='</div>';
  h+='<div class="section-label" style="margin-top:36px">Interviews &amp; Appearances</div>';
  h+='<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">A selection of Faisal\u2019s conversations from his video archive.</p>';
  h+='<div class="conv-grid">';
  for(var i=0;i<FEATURED_VIDEOS.length;i++)h+=insightsYtCard(FEATURED_VIDEOS[i]);
  h+='</div>';
  return h;
}

function insightsYtCard(v){
  var h='<div class="conv-card">';
  h+='<div class="overview-video-yt yt-facade" data-yt="'+v.yt+'" role="button" tabindex="0" aria-label="Play: '+esc(v.title)+'">';
  h+='<img class="yt-poster" src="https://i.ytimg.com/vi/'+v.yt+'/hqdefault.jpg" alt="" loading="lazy"/>';
  h+='<div class="yt-play"></div>';
  h+='</div>';
  h+='<div class="conv-card-tag">'+esc(v.tag)+'</div>';
  h+='<div class="serif-sub">'+esc(v.title)+'</div>';
  h+='<div class="t-stone">'+esc(v.desc)+'</div>';
  h+='</div>';
  return h;
}

function insightsWorthHtml(){
  var h='<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">Books, articles, and videos by people we admire \u2013 relevant to the work, written by others.</p>';
  h+='<div class="u-53a30b8">';
  for(var i=0;i<WORTH_YOUR_TIME.length;i++){
    var it=WORTH_YOUR_TIME[i];
    h+='<div class="insight-card" onclick="window.open(\''+it.url+'\',\'_blank\')">';
    h+='<div class="insight-card-header">';
    h+='<span class="insight-badge insight-badge--mono">'+esc(it.kind)+'</span>';
    h+='</div>';
    h+='<div class="insight-title">'+esc(it.title)+'</div>';
    h+='<div class="insight-date" style="white-space:normal">'+esc(it.by)+'</div>';
    h+='<div class="insight-excerpt">'+esc(it.desc)+'</div>';
    h+='<div class="insight-card-foot"><span class="insight-cta">'+esc(it.cta)+' \u2192</span></div>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}

// === SIDEBAR ===
function renderSidebar(){
  var sb=document.getElementById('pipSidebar');
  if(!sb)return;
  var showSidebar=sidebarPageShown();
  sb.style.display=showSidebar?'flex':'none';
  // Apply min/max class
  sb.className = 'sidebar' + (sidebarOpen ? '' : ' collapsed') + (sidebarMinimized ? ' mini' : '');
  var app=document.getElementById('app');
  if(app){
    app.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){app.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){app.classList.add('sidebar-mini');}
  }
  var ftr=document.getElementById('appFooter');
  if(ftr){
    ftr.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){ftr.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){ftr.classList.add('sidebar-mini');}
  }
  var btn=document.getElementById('sidebarToggle');
  if(btn){
    btn.style.display=showSidebar?'block':'none';
    // Keep the toggle pinned in the nav's top-left corner in every state.
    // It sits in the fixed nav band (top:16px) alongside the logo; pushing it
    // rightward (e.g. 270px) dropped the icon onto the "PIPELINE" logo text.
    btn.style.left = '16px';
  }
  if(!showSidebar)return;

  // Build header with min/max toggle button
  var togContent = sidebarMinimized ? '»' : '«&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="AI Pipeline">AI</div>' : '<div class="sidebar-logo">AI <span>Pipeline</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Build minimized body: phase circles only
  if(sidebarMinimized){
    var h='<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage==='pipeline'?' active':'') + '" onclick="go(\'pipeline\')" title="Overview">'
      + '<span class="sidebar-mini-icon">▦</span></div>';
    for(var i=0;i<PH.length;i++){
      var ph=PH[i];
      var isPhaseActive=(currentPage==='phase'&&currentStep===String(ph.id));
      var hasActiveStep = (currentPage==='step' && currentStep && String(currentStep).charAt(0)===String(ph.id));
      var hasActiveOutcome = currentPage==='outcome';
      h += '<div class="sidebar-mini-row' + (isPhaseActive||hasActiveStep?' active':'') + '" '
        + 'onclick="go(\'phase\',\''+ph.id+'\')" '
        + 'title="Phase '+ph.id+': '+ph.name+' ('+ph.days+')">'
        + '<span class="sidebar-mini-dot" style="background:'+ph.color+'">'+ph.id+'</span>'
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
  if(!UI.navOpenSet){ UI.navOpenSet = {}; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  if(UI._navPageKey !== pageKey){ UI._navPageKey = pageKey; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  var h='<div class="sidebar-inner">';
  h += headerHtml;
  h+='<div class="sidebar-scroll">';
  h+='<div class="sidebar-home'+(currentPage==='pipeline'?' active':'')+'" onclick="go(\'pipeline\')">Overview</div>';
  for(var i=0;i<PH.length;i++){
    var ph=PH[i];
    var isPhaseActive=(currentPage==='phase'&&currentStep===String(ph.id));
    var navOpenThis=!!(UI.navOpenSet&&UI.navOpenSet[String(ph.id)]);
    h+='<div class="sidebar-phase-group">';
    h+='<div class="sidebar-phase-head" onclick="goPhase('+ph.id+')">';
    h+='<div class="sidebar-phase-dot" style="background:'+ph.color+'"></div>';
    h+='<span class="sidebar-phase-name" style="color:'+(isPhaseActive?'var(--paper)':'color-mix(in srgb, '+ph.color+' 58%, var(--paper))')+'">'+ph.id+'. '+ph.name+'</span>';
    h+='<span class="sidebar-phase-days">'+ph.days+'</span>';
    h+='<span class="sidebar-phase-tog" onclick="event.stopPropagation();toggleNavPhase('+ph.id+')" title="'+(navOpenThis?'Collapse':'Expand')+'" style="cursor:pointer;color:color-mix(in srgb, '+ph.color+' 58%, var(--paper));font-family:var(--mono);font-size:13px;opacity:.9;padding:2px 6px;margin-left:2px;user-select:none">'+(navOpenThis?'\u25BE':'\u25B8')+'</span>';
    h+='</div>';
    if(navOpenThis){
      for(var j=0;j<ph.steps.length;j++){
        var s=ph.steps[j];
        var isActive=(currentPage==='step'&&currentStep===s.id)||(s.id==='5.1'&&currentPage==='phase5');
        var isDone=isStepDone(s.id);
        var cls='sidebar-step'+(isActive?' active':isDone?' done':'');
        h+='<div class="'+cls+'" onclick="go(\'step\',\''+s.id+'\')">'+(isDone&&!isActive?'':s.icon+' ')+s.id+' '+s.name+'</div>';
      }
      if(ph.outcomes&&ph.outcomes.length>0){
        var outOpen=navOutputsOpen(ph);
        h+='<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs('+ph.id+')" style="cursor:pointer;user-select:none" title="'+(outOpen?'Hide the outputs':'Show the outputs')+'">'+(outOpen?'\u25BE':'\u25B8')+' Outputs <span style="opacity:.7">('+ph.outcomes.length+')</span></div>'; /* 12 Sep 2026 (Paul's ruling): the outputs sit behind a fold */
        if(outOpen){
        for(var k=0;k<ph.outcomes.length;k++){
          var o=ph.outcomes[k];
          var isOActive=(currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id;
          h+='<div class="sidebar-outcome'+(isOActive?' active':'')+'" onclick="'+(o.id.indexOf('out-')===0?'go(\'outcome\',\''+o.id+'\')':'go(\''+o.id+'\')')+'">→ '+o.name+'</div>';
        }
        }
      }
    }
    h+='</div>';
  }
  // duplicate Pipeline Dashboard removed

  h+='</div>';
  h+='</div>';
  sb.innerHTML=h;
  updateSidebarState();
}

// Which phase contains the current page/selection (or null on Overview etc.)
function activeNavPhaseId(){
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

// Chevron handler: open this phase (collapsing the others) or, if it's the
// open one, collapse everything. Holds until the next navigation.
function toggleNavPhase(id){
  var k=String(id); if(!UI.navOpenSet)UI.navOpenSet={};
  UI.navOpenSet[k]=!UI.navOpenSet[k];
  var ss=document.querySelector('.sidebar-scroll'); var top=ss?ss.scrollTop:0;
  renderSidebar();
  var ss2=document.querySelector('.sidebar-scroll'); if(ss2)ss2.scrollTop=top;
}

// Phase-row handler (the whole "DIAGNOSE / ORGANIZE / …" bar). Acts as a toggle:
//   collapsed → open it and navigate to the phase
//   open      → collapse it in place (stay where you are, don't navigate away)
// The chevron still opens/collapses without navigating in either direction.
function goPhase(id){
  var k=String(id); if(!UI.navOpenSet)UI.navOpenSet={};
  if(UI.navOpenSet[k]){
    delete UI.navOpenSet[k];   // already open → clasp shut in place
    var ss=document.querySelector('.sidebar-scroll'); var top=ss?ss.scrollTop:0;
    renderSidebar();
    var ss2=document.querySelector('.sidebar-scroll'); if(ss2)ss2.scrollTop=top;
  } else {
    UI.navOpenSet[k]=true;  // collapsed → open this phase (others stay open) and navigate to it
    go('phase',String(id));
  }
}

function updateSidebarState(){
  var sb=document.getElementById('pipSidebar');
  var app=document.getElementById('app');
  var showSidebar=sidebarPageShown();
  if(sb){
    sb.className='sidebar'+(sidebarOpen?'':' collapsed')+(sidebarMinimized?' mini':'');
    sb.style.display=showSidebar?'flex':'none';
  }
  if(app){
    app.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){app.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){app.classList.add('sidebar-mini');}
  }
  var ftr=document.getElementById('appFooter');
  if(ftr){
    ftr.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){ftr.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){ftr.classList.add('sidebar-mini');}
  }
  var btn=document.getElementById('sidebarToggle');
  if(btn){
    btn.style.display=showSidebar?'block':'none';
    // Pinned to the nav's top-left corner; see note in renderSidebar().
    btn.style.left = '16px';
  }
}

function toggleSidebar(){sidebarOpen=!sidebarOpen;updateSidebarState();}

// === PHASE LANDING (from pipeline) ===
// renderPhaseLanding is provided by pipeline module above

// === OUTCOME PAGES ===
// renderOutcome routes handled by pipeline module above
function renderPhase5(){return renderNavDash();}
function renderPhase5Content(){return renderNavDash(true);}

function renderOutcome(){
  var id=currentStep;var ph=currentPhase;
  var _w='<div class="content-area pt-110"><div class="content-inner">';var _we='</div></div>';
  var _bb=backBtn();var backH=_bb?'<div class="mb-5">'+_bb+'</div>':'';
  // Route to pipeline's outcome renderers
  if(id==='out-report')return _w+backH+renderOutReport()+_we;
  if(id==='out-bluesky')return _w+backH+renderOutBluesky()+_we;
  if(id==='out-orgready')return _w+backH+renderOutOrgReady()+_we;
  if(id==='out-raci')return _w+backH+renderOutRaciFull()+_we;
  if(id==='out-explore')return _w+backH+renderOutExploreEnhanced()+_we;
  if(id==='out-devport')return _w+backH+renderOutExpbriefsFull()+_we; // alias: single canonical Development Portfolio
  if(id==='out-capplan')return _w+backH+renderOutCapplan()+_we;
  if(id==='out-expbriefs')return _w+backH+renderOutExpbriefsFull()+_we;
  if(id==='out-govfw')return _w+backH+renderOutGovFW()+_we;
  if(id==='out-orgrev')return _w+backH+renderOutOrgRev()+_we;
  if(id==='out-finalport')return _w+backH+renderOutFinalportFull()+_we;
  if(id==='out-oper')return _w+backH+renderOutOperFull()+_we;
  return '<p class="inline-stone">Output: '+esc(id)+'</p>';
}

// PDF export aliases (bridge pipeline names to master names)
// === COACH ===
/* -- AI FEATURES (Part 2, 2 Oct 2026): the AI Guide and Voice are off until an organization's administrator switches them on. Data without settings counts as both off. -- */
function aiGuideOn(){ return !SAMPLE_MODE && !!(data && data.settings && data.settings.aiGuide); }
function voiceOn(){ return !SAMPLE_MODE && !!(data && data.settings && data.settings.voice); }
function canSetAiFeatures(){ var u=getCurrentUser(); return !!isAppAdmin || !!(u && u.admin===true); } /* admin:true is the authority record (ruled July 9) */
/* Run on every render and after a change: buttons shown or hidden, an open AI Guide closed and a live microphone stopped when switched off. */
function applyAiFeatures(){
  var ai=aiGuideOn(), vo=voiceOn();
  if(!ai && coachOpen){ try{ toggleCoach(); }catch(e){} }
  if(!vo && voiceActive){ voiceActive=false; try{ if(recognition) recognition.stop(); }catch(e){} try{ updateVoiceUI(); }catch(e){} }
  var f=$('coachFab'), p=$('fabPulse'), v=$('voiceFab');
  if(f) f.style.display = ai ? '' : 'none';
  if(p) p.style.display = (ai && !coachOpen) ? 'block' : 'none';
  if(v) v.style.display = vo ? '' : 'none';
}
function setAiFeature(key,on){
  if(!canSetAiFeatures() || (key!=='aiGuide' && key!=='voice')) return;
  if(!data.settings) data.settings={aiGuide:false,voice:false};
  data.settings[key]=!!on;
  saveData();
  applyAiFeatures();
  render();
  if(currentModal==='org') renderOrgModal();
}
function aiFeaturesFold(){
  var s=data.settings||{};
  function sw(key,label,note){ return '<label class="ai-switch"><input type="checkbox" role="switch" id="aiSet_'+key+'"'+(s[key]?' checked':'')+' onchange="setAiFeature(\''+key+'\',this.checked)"/> <span>'+label+'</span></label><div class="ai-fold-note">'+note+'</div>'; }
  return '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open"'+(UI.aiFoldOpen?' open':'')+'><summary>AI Features (off by default)</summary><div class="ai-fold-body">'
    + sw('aiGuide','AI Guide','When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.')
    + sw('voice','Voice','When this is on, Voice uses the browser\'s own speech recognition. Some browsers send the recording to the browser maker to turn it into text.')
    + '</div></details>';
}
function toggleCoach(){
if(!coachOpen && !aiGuideOn()) return;
coachOpen=!coachOpen;
$('coachFab').className='coach-fab'+(coachOpen?' open':'');
$('fabPulse').style.display=coachOpen?'none':'block';
$('coachPanel').className='coach-panel'+(coachOpen?' open':'');
if(coachOpen)renderCoachPanel();
}

/* ── AI GUIDE: helpers (AI Guide stage 1 brief, 12 Oct 2026) ── */

// One sentence telling the Guide where the user is in the program.
function guideStepContext(){
if(currentStep){
for(var i=0;i<PH.length;i++){for(var j=0;j<PH[i].steps.length;j++){var s=PH[i].steps[j];
if(s.id===currentStep)return 'The user is on Step '+s.id+' ('+s.name+') in Phase '+PH[i].id+': '+PH[i].name+'.';}}
}
if(currentPhase)return 'The user is on the overview page for Phase '+currentPhase.id+': '+currentPhase.name+'.';
return 'The user is on the program overview.';
}

// Earlier exchanges to resend: skips the welcome message and any failed exchange,
// keeps the most recent GUIDE_HISTORY_LIMIT messages, and starts with a user turn.
function guideHistory(){
var out=[];
for(var i=0;i<coachMsgs.length;i++){var m=coachMsgs[i];
if(m.welcome||m.failed)continue;
out.push({role:m.role==='ai'?'assistant':'user',content:m.text});
}
out=out.slice(-GUIDE_HISTORY_LIMIT);
while(out.length&&out[0].role==='assistant')out.shift();
return out;
}

// Safe light formatting for Guide answers: escapes all HTML first, then renders
// **bold**, bulleted and numbered lists, and headings. Everything else is a paragraph.
function guideFormat(text){
var lines=esc(text).split(/\r?\n/),out='',list='';
function close(){if(list){out+='</'+list+'>';list='';}}
for(var i=0;i<lines.length;i++){
var l=lines[i].replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
var ul=l.match(/^\s*[-*•]\s+(.*)$/),ol=l.match(/^\s*\d+[.)]\s+(.*)$/),hd=l.match(/^\s*#{1,6}\s+(.*)$/);
if(ul||ol){
var t=ul?'ul':'ol';
if(list!==t){close();out+='<'+t+' class="coach-list">';list=t;}
out+='<li>'+(ul?ul[1]:ol[1])+'</li>';
}else{
close();
if(hd)out+='<p class="coach-head"><strong>'+hd[1]+'</strong></p>';
else if(l.trim())out+='<p>'+l+'</p>';
}
}
close();
return out;
}

/* AI Guide panel (dev UI pass, 13 Oct 2026). Dressed like Team Chat, its sibling panel: the same mono
   header and meta lines, 14px sans messages in bubbles, avatars beside them. The AI notice (A.2.6) stays
   the first line under the header, word for word.
   render() redraws this panel on every app redraw, so a redraw must change nothing the user is in the
   middle of: the scroll position, the draft in the box and the cursor are carried across. The view only
   moves when the conversation does: to the bottom when a question is sent, and to the FIRST line of an
   answer when it arrives, so it is read from the top. */
var coachRefocus = false;   // put the cursor back in the box once an answer arrives
var coachScrollTo = '';     // '' keep where the reader is | 'bottom' | 'answer' (start of the newest answer) | 'top'

// Where the user is, as the header's second line: "Step 1.2 · Brainstorm Use Cases".
function guideWhere(){
if(currentStep){
for(var i=0;i<PH.length;i++){for(var j=0;j<PH[i].steps.length;j++){var s=PH[i].steps[j];
if(s.id===currentStep)return 'Step '+s.id+' · '+s.name;}}
}
if(currentPhase)return 'Phase '+currentPhase.id+' · '+currentPhase.name;
return 'Program overview';
}

// Grows the question box with its text, up to the CSS max-height.
function coachAutoGrow(t){if(!t)return;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px';}

// Starts a fresh conversation. A reply still in flight stays in the old thread (see sendCoach).
function newCoachConversation(){
coachMsgs=JSON.parse(COACH_MSGS_PRISTINE);coachBusy=false;coachRefocus=true;coachScrollTo='top';renderCoachPanel();
}

// Copies one answer as the plain text the reader sees.
function coachCopy(btn){
var msg=btn&&btn.closest?btn.closest('.coach-msg'):null,body=msg?msg.querySelector('.coach-body'):null;if(!body)return;
var text=body.innerText||body.textContent||'';
function done(ok){btn.textContent=ok?'Copied':'Copy failed';setTimeout(function(){btn.textContent='Copy'},1600);}
function legacy(){try{var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();var ok=document.execCommand('copy');document.body.removeChild(ta);done(ok);}catch(e){done(false);}}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){done(true)},legacy);return;}  /* refused (no permission, page not focused): the older way */
legacy();
}

// Shows "Latest" while the reader is scrolled well up from the end of the conversation.
function coachScrollWatch(el){
var btn=document.getElementById('coachLatest');if(!el||!btn)return;
btn.classList.toggle('show',el.scrollHeight-el.scrollTop-el.clientHeight>160);
}
function coachToLatest(){var el=document.getElementById('coachMsgsEl');if(el){el.scrollTop=el.scrollHeight;coachScrollWatch(el);}}

var COACH_AVATAR='<span class="coach-avatar" aria-hidden="true">✦</span>';
function coachAiRow(body,extra,canCopy){
return '<div class="coach-row ai'+(extra?' '+extra:'')+'">'+COACH_AVATAR+'<div class="coach-col"><div class="coach-sender">Danni</div>'
+'<div class="coach-msg ai'+(extra?' '+extra:'')+'"><div class="coach-body">'+body+'</div>'
+(canCopy?'<div class="coach-tools"><button class="coach-tool" onclick="coachCopy(this)">Copy</button></div>':'')
+'</div></div></div>';
}

function renderCoachPanel(){
var panel=$('coachPanel');if(!panel)return;
/* what the reader is in the middle of, carried across the redraw */
var oldMsgs=document.getElementById('coachMsgsEl'),oldTop=oldMsgs?oldMsgs.scrollTop:null;
var oldInp=document.getElementById('coachInput'),draft=oldInp?oldInp.value:'',typing=!!oldInp&&document.activeElement===oldInp;
var selA=typing?oldInp.selectionStart:null,selB=typing?oldInp.selectionEnd:null;
panel.setAttribute('role','dialog');panel.setAttribute('aria-label','AI Guide');
panel.onkeydown=function(e){if(e.key==='Escape'&&coachOpen){e.preventDefault();toggleCoach();var f=$('coachFab');if(f&&f.focus)f.focus();}};
var me=(typeof getCurrentUser==='function'&&getCurrentUser())||null;
var started=coachMsgs.some(function(m){return !m.welcome;});
var h='<div class="coach-header"><div class="coach-id">'+COACH_AVATAR+'<div class="coach-id-text"><div class="coach-header-title">Ask Danni</div><div class="coach-where">'+esc(guideWhere())+'</div></div></div>';
h+='<div class="coach-actions">';
if(started)h+='<button class="coach-icon-btn" onclick="newCoachConversation()" title="New conversation" aria-label="Start a new conversation"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>';
h+='<button class="coach-icon-btn coach-close" onclick="toggleCoach()" title="Close (Esc)" aria-label="Close the AI Guide">×</button>';
h+='</div></div>';
h+='<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>';
h+='<div class="coach-msgs" id="coachMsgsEl" role="log" aria-live="polite" onscroll="coachScrollWatch(this)">';
for(var i=0;i<coachMsgs.length;i++){var m=coachMsgs[i];
if(m.role==='ai')h+=coachAiRow(guideFormat(m.text),m.failed?'failed':'',!m.welcome&&!m.failed);
else h+='<div class="coach-row user">'+(me?userAv(me,30):'')+'<div class="coach-col"><div class="coach-sender">You</div><div class="coach-msg user"><div class="coach-body">'+esc(m.text)+'</div></div></div></div>';
}
if(coachBusy)h+=coachAiRow('<span class="coach-dots" aria-hidden="true"><i></i><i></i><i></i></span>Thinking…','coach-thinking',false);
h+='</div>';
h+='<button class="coach-latest" id="coachLatest" onclick="coachToLatest()" aria-label="Jump to the latest message">↓ Latest</button>';
h+='<div class="coach-composer"><div class="coach-input-row"><textarea id="coachInput" rows="1" aria-label="Ask the AI Guide" placeholder="Ask about any step, concept, or challenge..."'+(coachBusy?' disabled':'')+' oninput="coachAutoGrow(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendCoach()}"></textarea>';
h+='<button class="coach-send" onclick="sendCoach()" title="Send" aria-label="Send"'+(coachBusy?' disabled':'')+'><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>';
h+='<div class="coach-hint">Enter to send · Shift+Enter for a new line · Esc to close</div></div>';
panel.innerHTML=h;

var msgs=document.getElementById('coachMsgsEl'),inp=document.getElementById('coachInput');
if(inp&&draft&&!coachBusy){inp.value=draft;coachAutoGrow(inp);}
if(msgs){
if(coachScrollTo==='bottom'||oldTop===null)msgs.scrollTop=msgs.scrollHeight;
else if(coachScrollTo==='top')msgs.scrollTop=0;
else if(coachScrollTo==='answer'){var rows=msgs.querySelectorAll('.coach-row.ai'),last=rows[rows.length-1];
if(last&&last.getBoundingClientRect)msgs.scrollTop+=last.getBoundingClientRect().top-msgs.getBoundingClientRect().top-12;else msgs.scrollTop=msgs.scrollHeight;}
else msgs.scrollTop=oldTop;
coachScrollTo='';coachScrollWatch(msgs);
}
if(coachOpen&&!coachBusy&&inp&&inp.focus&&(typing||coachRefocus)){
coachRefocus=false;inp.focus();
if(typing&&selA!=null&&inp.setSelectionRange){try{inp.setSelectionRange(selA,selB);}catch(e){}}
}
}

/* AI Guide stage 1: the brief's sendCoach, keeping this build's AI switch check and the 7 Oct in-flight rule */
function sendCoach(){
if(!aiGuideOn()) return;
if(coachBusy)return;
var inp=document.getElementById('coachInput');if(!inp||!inp.value.trim())return;
var userText=inp.value.trim();inp.value='';
var history=guideHistory();  // built before the new question is added
var thread=coachMsgs;/* Follow-up (7 Oct 2026, as Governance dev): the reply belongs to the conversation it was asked in. sealSession replaces coachMsgs on a sign-out or change of organization, so a reply still in flight then lands in the old, discarded thread and never in the next organization's */
var userMsg={role:'user',text:userText};
coachMsgs.push(userMsg);
coachBusy=true;coachRefocus=true;coachScrollTo='bottom';renderCoachPanel();
fetch(GUIDE_ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
body:JSON.stringify({question:userText,history:history,context:guideStepContext()})
}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(j){
if(!j||!j.answer)throw new Error('empty answer');
thread.push({role:'ai',text:j.answer});
}).catch(function(){
userMsg.failed=true;
thread.push({role:'ai',failed:true,text:'Sorry, the AI Guide is unavailable right now. Please try again in a moment.'});
}).then(function(){if(thread!==coachMsgs)return;coachBusy=false;coachScrollTo='answer';renderCoachPanel()});
}

// === GROUP CHAT ===
var gchatOpen=false;
function chatArr(){if(!data.chatMsgs)data.chatMsgs=[];return data.chatMsgs}
var gchatUnreadCount=0;
var gchatSeenCount=null; function gchatRecount(){ var a=chatArr(); if(gchatSeenCount==null||gchatOpen){gchatSeenCount=a.length;gchatUnreadCount=0;return} var me=getCurrentUser(),n=0; for(var i=gchatSeenCount;i<a.length;i++){var m=a[i];var mine=!!m&&((m.by&&m.by===currentUserId)||(!m.by&&m.uid&&m.uid===currentUserId)||(!m.by&&!m.uid&&!!me&&m.name===me.name));if(m&&!mine)n++} gchatUnreadCount=n; } /* Sweep 4R item 5 (addendum 5 Oct 2026): the badge counts colleagues' messages since this session last saw the room; one's own never count */

function gchatMembers(){return (data.roster||[]).map(function(u,ix){return{initials:u.initials,name:u.name,color:u.color,online:ix<5}})}

function gchatTxt(bg){var h=bg.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);return (0.299*r+0.587*g+0.114*b)>140?'#1A1612':'#fff'}
function gchatColor(who){if(who==='F')return'#B8892A';var u=(data.roster||[]).filter(function(x){return x.initials===who})[0];return u?u.color:'rgba(var(--faint-rgb),.7)'}

// Anchor the top-right slide-out panels just below the nav, which may be
// one or two rows tall depending on width — so they never overlap it.
function anchorBelowNav(){
  var nav=document.querySelector('nav');
  var h=nav?nav.getBoundingClientRect().height:60;
  return (Math.round(h)+10)+'px';
}

function toggleGChat(){
  if(SAMPLE_MODE && !gchatOpen) return; /* Part 3: Team Chat is off in the sample tab */
  gchatOpen=!gchatOpen;
  var fab=document.getElementById('gchatFab');
  var navBtn=document.getElementById('gchatNavBtn');
  var panel=document.getElementById('gchatPanel');
  if(fab)fab.className='gchat-fab'+(gchatOpen?' open':'');
  if(navBtn)navBtn.classList.toggle('nav-action-on',gchatOpen);
  if(panel){
    panel.className='gchat-panel'+(gchatOpen?' open':'');
    if(gchatOpen)panel.style.top=anchorBelowNav();
  }
  if(gchatOpen){
    gchatUnreadCount=0; gchatSeenCount=chatArr().length; /* Sweep 4R item 5 */
    var u=document.getElementById('gchatUnread');
    if(u){u.style.display='none';u.textContent='0';}
    renderGChatPanel();
  }
}

function renderGChatPanel(){
  var panel=document.getElementById('gchatPanel');
  if(!panel)return;
  var _gm=gchatMembers();
  var avHtml='';
  for(var i=0;i<_gm.length;i++){
    avHtml+='<div class="gchat-av" style="background:'+_gm[i].color+';color:'+gchatTxt(_gm[i].color)+'">'+_gm[i].initials+'</div>';
  }
  var memHtml='';
  for(var i=0;i<_gm.length;i++){
    var m=_gm[i];
    memHtml+='<div class="gchat-member"><div class="gchat-member-av" style="background:'+m.color+';color:'+gchatTxt(m.color)+'">'+m.initials+'</div>'+m.name+(m.online?'<div class="gchat-online"></div>':'')+'</div>';
  }
  var h='<div class="gchat-header"><div class="gchat-header-title"><div class="gchat-avatars">'+avHtml+'</div> Team Room</div><button class="gchat-close" onclick="toggleGChat()">×</button></div>';
  h+='<div class="gchat-members">'+memHtml+'</div>';
  h+='<div class="gchat-msgs" id="gchatMsgsEl">';
  var _cm=chatArr();
  if(!_cm.length)h+='<div class="notes-empty">No messages yet – the team thread starts here.</div>';
  else h+='<div class="gchat-day-div">Today</div>';
  for(var i=0;i<_cm.length;i++){
    var msg=_cm[i];
    var isMe=(msg.who==='F');
    var cls=isMe?'me':'them';
    var col=gchatColor(msg.who);
    h+='<div class="gchat-msg '+cls+'">';
    h+='<div class="gchat-msg-av" style="background:'+col+';color:'+gchatTxt(col)+'">'+msg.who+'</div>';
    h+='<div class="gchat-msg-body">';
    h+='<div class="gchat-msg-meta">'+esc(isMe?'You':msg.name)+' · '+msg.ts+'</div>';
    h+='<div class="gchat-msg-text">'+esc(msg.text)+'</div>';
    h+='</div></div>';
  }
  h+='</div>';
  h+='<div class="gchat-typing" id="gchatTyping"></div>';
  h+='<div class="gchat-input-row"><textarea id="gchatInput" placeholder="Message the team..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendGChat()}"></textarea><button class="gchat-send" onclick="sendGChat()">→</button></div>';
  panel.innerHTML=h;
  var msgs=document.getElementById('gchatMsgsEl');
  if(msgs)msgs.scrollTop=msgs.scrollHeight;
}

function sendGChat(){
  var inp=document.getElementById('gchatInput');
  if(!inp||!inp.value.trim())return;
  var text=inp.value.trim();inp.value='';
  var now=new Date();
  var ts=(now.getHours()%12||12)+':'+(now.getMinutes()<10?'0':'')+now.getMinutes()+' '+(now.getHours()>=12?'PM':'AM');
  chatArr().push({by:currentUserId,who:'F',name:'You',ts:ts,text:text}); /* Sweep 4R item 5: the author, by id */
  Store.commit('chatMsgs');
  renderGChatPanel();
  /* 2 Oct 2026 (Paul): Team Chat carries no AI; nothing is written in anyone else's name */
}

// === NOTES ===
function toggleNotes(){
notesOpen=!notesOpen;
var fab=$('notesFab');if(fab)fab.className='notes-fab'+(notesOpen?' open':'');
var navBtn=document.getElementById('notesNavBtn');if(navBtn)navBtn.classList.toggle('nav-action-on',notesOpen);
var np=$('notesPanel');np.className='notes-panel'+(notesOpen?' open':'');
if(notesOpen)np.style.top=anchorBelowNav();
if(notesOpen)renderNotesPanel();
}

function updateNotesCount(){var el=$('notesCount');if(el){var n=(data.notes||[]).length;el.textContent=n;el.style.display=n?'':'none'}}

function renderNotesPanel(){
var panel=$('notesPanel');if(!panel)return;
var h='<div class="notes-header"><div class="notes-header-title">&#9998; Notes</div><button class="notes-close" onclick="toggleNotes()">×</button></div>';
h+='<div class="notes-list">';
var notes=data.notes||[];
if(!notes.length)h+='<div class="notes-empty">Capture insights as you work through the pipeline.</div>';
else for(var i=notes.length-1;i>=0;i--){var n=notes[i];h+='<div class="note-card"><div class="note-text">'+esc(n.text)+'</div><div class="note-meta"><span class="note-date">'+(n.step?'Step '+n.step+' · ':'')+fmt(n.createdAt)+'</span><button class="note-del" onclick="deleteNote(\''+n.id+'\')">×</button></div></div>'}
h+='</div>';
h+='<div class="notes-input-row"><textarea id="notesInput" placeholder="Write a note..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();addNote()}"></textarea><button class="notes-send" onclick="addNote()">&#9998;</button></div>';
panel.innerHTML=h;
}

function addNote(){var inp=document.getElementById('notesInput');if(!inp||!inp.value.trim())return;if(!data.notes)data.notes=[];data.notes.push({id:uid(),text:inp.value.trim(),step:currentStep,createdAt:Date.now()});Store.commit('notes');renderNotesPanel();updateNotesCount();}
function deleteNote(id){data.notes=(data.notes||[]).filter(function(n){return n.id!==id});Store.commit('notes');renderNotesPanel();updateNotesCount();}

// === HELP MODAL ===
var currentModal=null;
function openHelp(){currentModal='help';renderModal();}
function closeModal(){currentModal=null;var mr=$('modalRoot');if(mr)mr.innerHTML='';}

function renderModal(){
var mr=$('modalRoot');if(!mr)return;
if(!currentModal){mr.innerHTML='';return;}

var h='<div class="modal-bg" onclick="if(event.target===this)closeModal()">';
h+='<div class="modal">';
h+='<h3>90-Day AI Innovation Pipeline</h3>';

h+='<div class="u-e6b5a04">A step-by-step tool for building an AI innovation pipeline, built on Faisal Hoque\u2019s published frameworks. This guide explains how the module is organized and how each of its surfaces works.</div>';

h+='<div class="mb-6"><div class="section-label mb-3">What This Is</div>';
h+='<p class="t-stone-md">Five sequential phases take you from a readiness assessment to a live portfolio under quarterly review. Each phase breaks into guided steps, and every phase produces output documents you can print. Your progress, ideas, assessments, and outputs are saved to your organization\u2019s shared workspace as you work.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Getting Around</div>';
h+='<div class="u-b1b744e">';
var navRows=[
  {k:'Top nav',v:'Home \xb7 Learn \xb7 Pipeline \xb7 Navigate \xb7 Insights on the left. Your profile chip, Help, the theme toggle, Team Chat, Notes, and a More menu sit at the top right; Track Program lives under More.'},
  {k:'More menu',v:'View zoom controls, Light/Dark mode toggle, Voice, Profile (your organization &amp; team), and two sample-data seeds (a day-70 program and a year-two portfolio). App admins also see an Admin entry that opens the management panel.'},
  {k:'Left sidebar',v:'Visible on Pipeline and Navigate pages. Shows all five phases, every step, and every output document. Click \u2630 to collapse.'},
  {k:'Phase landings',v:'Click any phase number in the sidebar or Pipeline overview. Shows completion %, live metrics, an intro video, the full step sequence, and links to all phase outputs.'},
  {k:'Step pages',v:'Each step opens with a concept carousel that auto-advances (hover to pause), guided work sections, further reading, and completion tracking. Every step carries an \u201cAssigned to\u201d bar so a named owner can take it. Steps build on each other. Work them in order.'}
];
for(var i=0;i<navRows.length;i++){var nr=navRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+nr.k+'</div><div class="u-13544a9">'+nr.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Signing In &amp; Organizations</div>';
h+='<div class="u-b1b744e">';
var accessRows=[
  {k:'Sign in',v:'Enter your username and password on the launch screen to go straight into your organization\u2019s workspace. Tick \u201cRemember me\u201d to skip sign-in next time on this device.'},
  {k:'New organization',v:'Use \u201cSet up a new organization\u201d on the login screen to create a workspace and your own account, then add the rest of your team.'},
  {k:'Multiple organizations',v:'Each organization is a fully isolated workspace with its own profile, team, and pipeline data. Nothing is shared between them.'},
  {k:'Profiles &amp; Passwords',v:'Every member has a username and password. These identities sign work, drive step assignments, and appear in Team Chat.'},
  {k:'Admin',v:'Choose \u201cAdmin\u201d on the login screen and enter the administrator username and password. Admins land in the app with an admin bar across the top. The Admin panel, opened from that bar or from the More menu, lists every organization and user and lets you add, edit, or remove them. \u201cChange password\u201d lives on the administrator console on the sign-in side.'}
];
for(var i=0;i<accessRows.length;i++){var ar=accessRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+ar.k+'</div><div class="u-13544a9">'+ar.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Five Phases</div>';
h+='<div class="u-dbaf33c">';
var helpPhases=[
  {n:'01',t:'Diagnose \u2013 Days 1\u201330',col:'#1B6B5A',
   steps:'Assessment Battery \xb7 Brainstorm Use Cases \xb7 Filter & Rank',
   out:'Assessment Report \xb7 Blue Sky Portfolio',
   d:'Run a full organizational AI readiness assessment. Surface potential use cases into a Blue Sky Portfolio. Score and rank those ideas to build a ranked shortlist.'},
  {n:'02',t:'Organize \u2013 Days 31\u201350',col:'#2D5A8E',
   steps:'Ownership & Structure \xb7 Realign Incentives \xb7 Innovation Rhythm \xb7 Deepen Assessment',
   out:'Org Readiness \xb7 RACI Matrix \xb7 Exploration Portfolio',
   d:'Assign named owners with explicit decision authority. Align incentives to innovation behavior. Establish a weekly cadence. Run SWOT and gap analysis on selected ideas to build the Exploration Portfolio.'},
  {n:'03',t:'Prepare \u2013 Days 51\u201370',col:'#8B5E3C',
   steps:'Structure Portfolio \xb7 Plan Capacity \xb7 Allocate Capital \xb7 Map Development Track',
   out:'Capital Snapshot \xb7 Development Portfolio',
   d:'Sort projects by time horizon (quick win / medium / strategic). Size the multi-year capacity plan, then commit capital against it. Map each advancing project\u2019s development track: phases with budgets, owners, success metrics, and exit gate criteria.'},
  {n:'04',t:'Ignite \u2013 Days 71\u201390',col:'#9B2D3F',
   steps:'Run Development Track \xb7 Establish Governance \xb7 Stress-Test Org Design \xb7 Portfolio Review',
   out:'Governance Framework \xb7 Org Design Review \xb7 Updated Dev Portfolio',
   d:'Run the development tracks and take the gate decisions as phases end. Lock in three governance mechanisms: a standing leadership agenda, portfolio ownership of all AI projects above a certain cost threshold, and a quarterly review cycle. Stress-test decision rights, ownership, and incentives. Run the first Buy / Hold / Sell review.'},
  {n:'05',t:'Navigate \u2013 Ongoing',col:'#6B4C8A',
   steps:'Pipeline Dashboard',
   out:'Operational Portfolio \xb7 Capital Planning Hub',
   d:'Manage the live pipeline. View all four stages in real time. Run the quarterly review and make Buy, Hold, or Sell decisions on every project. The engine runs continuously.'}
];
for(var i=0;i<helpPhases.length;i++){
  var hp=helpPhases[i];
  h+='<div class="u-edbd16f">';
  h+='<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+hp.col+';padding-top:2px">'+hp.n+'</div>';
  h+='<div>';
  h+='<div class="u-c4172bc">'+hp.t+'</div>';
  h+='<p class="u-061830a">'+hp.d+'</p>';
  h+='<div class="u-4c03721">';
  h+='<div class="t-fade-sm"><span class="hp-tag" style="--c:'+hp.col+'">Steps</span>'+hp.steps+'</div>';
  h+='<div class="t-fade-sm"><span class="hp-tag" style="--c:'+hp.col+'">Outputs</span>'+hp.out+'</div>';
  h+='</div></div></div>';
}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Pipeline Funnel</div>';
h+='<p class="u-cf9c823">Ideas flow through four stages as they progress. Counts update in real time across the entire app.</p>';
h+='<div class="u-5421535">';
var funnelStages=[{n:'Blue Sky',c:'#1B6B5A',d:'All ideas \u2013 unscored'},{n:'Exploration',c:'#2D5A8E',d:'Selected & scored'},{n:'Development',c:'#8B5E3C',d:'Funded development phases'},{n:'Operational',c:'#9B2D3F',d:'Live & scaling'}];
for(var i=0;i<funnelStages.length;i++){var fs=funnelStages[i];h+='<div style="flex:1;padding:12px 14px;border-right:1px solid rgba(var(--fg-rgb),.08);background:'+fs.c+'10"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:'+fs.c+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">'+fs.n+'</div><div class="u-79e87b9">'+fs.d+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">How the Money Works</div>';
h+='<div class="u-b1b744e">';
var moneyRows=[
  {k:'Commitments',v:'Money commits when a project advances into the Development stage. Advancing commits the project\u2019s whole budget plan, month by month: development steps, rollout steps, and sustainment. You never type a committed total by hand. Every money surface in the app, from the ledger to the charts to the gates, reads that same monthly table.'},
  {k:'Annual budgets',v:'Each year of the planning period has its own budget. A breach means that at least one year\u2019s committed plan exceeds that year\u2019s budget. The advance gates, the chart warning, and the per-year strip all report that one test. When a breach appears, the funding plan shows how to resolve it.'},
  {k:'Whole months',v:'Development and rollout steps spread their cost evenly across the months they cover. If you want more granularity and variance across months, add more steps. Sustainment counts at one twelfth of its annual rate per month, starting the month after rollout ends or at the later start the budget plan sets.'},
  {k:'Kill, pause, revive',v:'Killing a project releases the in-window money for development phases that have not begun, along with its rollout and sustainment months. Phases already begun stay committed. Any wind-down costs you enter go to the kill &amp; phase-out pot. Pausing a project holds its full commitment in place. Reviving a killed project puts its commitment back.'},
  {k:'Locked cost fields',v:'While a section of a budget plan holds money, the matching simple cost field locks and reads \u201cDerived from budget plan.\u201d Clear that section\u2019s money and the field is freed again.'},
  {k:'Quarters &amp; fiscal years',v:'Quarters count from the planning period start you set at Plan Capacity (Step 3.2). If your fiscal year begins in a different month, the selector on the review page aligns the review labels to it. That selector changes the display only. The money math never reads it.'}
];
for(var i=0;i<moneyRows.length;i++){var mo=moneyRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+mo.k+'</div><div class="u-13544a9">'+mo.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Quarterly Review</div>';
h+='<p class="t-stone-md" style="margin-bottom:10px">The review runs in two places. Step 4.4 hosts the first review with teaching material around it. After that, the Portfolio Review card on the Navigate dashboard hosts it under \u201cRun the review.\u201d It is one surface with one state, so a decision recorded on either page is the same decision.</p>';
h+='<div class="u-b1b744e">';
var reviewRows=[
  {k:'What you see',v:'The next review date, the fiscal-year selector, a Review Snapshot (Start Date Drift, Launch Variance, Overrides, Sustainment Cap, Intake Reserve), the Portfolio Balance cards, and a Portfolio Learnings card with five boxes for capturing what the cycle taught you.'},
  {k:'Decision rows',v:'Every project in development, every operational project, and every viable exploration project gets a row with Buy, Hold, and Sell buttons. Click the row head to expand it. The expansion is the full live portfolio card, the same one the portfolio pages use, so edits you make during the review are real.'},
  {k:'Buy',v:'Buy on a development project launches it when you close the review. Buy on an exploration project advances it into the Development stage at close, under the same grade and capital checks as the Advance button on its card.'},
  {k:'Sell',v:'Sell on a development project opens the kill confirm panel inside the expanded card. The panel shows what killing releases, what stays committed, and takes any wind-down costs for the kill &amp; phase-out pot. Sell on an exploration project kills it at once, because nothing is committed yet. Clicking an active decision again removes it. Click the green Revive button that replaces Sell to revive a killed project.'},
  {k:'Closing',v:'\u201cClose Review &amp; Start New Cycle\u201d applies the Buy decisions, moves the closed review into history, and starts the next cycle.'}
];
for(var i=0;i<reviewRows.length;i++){var rv=reviewRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+rv.k+'</div><div class="u-13544a9">'+rv.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Track Program</div>';
h+='<p class="t-stone-md" style="margin-bottom:10px">The \u25a6 Track Program item under the \u2026 More menu opens Module Management. It puts every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.</p>';
h+='<div class="u-b1b744e">';
var hubRows=[
  {k:'Assignments',v:'Every step, grouped by phase, with a status badge, an optional deadline, and an assignment button. \u201cThis Week\u201d lists the steps that are overdue or due within seven days. You can also assign a step from the \u201cAssigned to\u201d bar on the step page itself.'},
  {k:'Analytics',v:'A 90-Day Burn-up against the ideal pace, Module Velocity per program week, Workload by Member, and Signals. \u201cSave as PDF\u201d prints the analytics as a formatted report.'},
  {k:'Email notifications',v:'When a step is completed for the first time, the app emails a completion report to every team member with an email address, with the analytics attached as a PDF. When an assigned step comes within seven days of its deadline, the app emails one reminder to the assignees and to the organization\u2019s administrator account \u2013 the owner account created when the organization was set up.'}
];
for(var i=0;i<hubRows.length;i++){var hb=hubRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+hb.k+'</div><div class="u-13544a9">'+hb.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">RACI Matrix</div>';
h+='<p class="t-stone-md">You fill in the RACI Matrix at Step 2.1 (Ownership &amp; Structure). R marks the person responsible, who does the work. A marks the person accountable, who owns the outcome, with exactly one A per activity. C marks people consulted before decisions. I marks people informed after decisions. The printable record lives under Phase 2 outputs, where an \u270e Edit toggle lets you revise the matrix in place and \u25be Save as PDF prints it.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Tools</div>';
h+='<div class="u-b1b744e">';
var tools=[
  {ic:'? Help',d:'Top-right nav. Opens this guide at any time.'},
  {ic:'\u25a6 Track Program',d:'Under the \u2026 More menu. Opens the Track Program hub for step assignments, deadlines, analytics, and email notifications.'},
  {ic:'\u2726 AI Guide',d:'Orange button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque\u2019s book TRANSCEND and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can\u2019t see the data you have entered.'},
  {ic:'\u2261 Team Chat',d:'Top-right nav. Log decisions and messages with your team. Separate from the AI Guide conversation.'},
  {ic:'\u270e Notes',d:'Top-right nav. Capture thoughts as you work through each step. Notes are tagged to the step you are on when you write them.'},
  {ic:'\u25c7 Profile',d:'In the More menu. Set your organization details and manage the team roster. You can add, edit, or remove members inline.'},
  {ic:'\u25c9 Voice',d:'In the More menu. Navigate hands-free. Say: \u201chome\u201d \xb7 \u201clearn\u201d \xb7 \u201cpipeline\u201d \xb7 \u201cnavigate\u201d \xb7 \u201chelp\u201d \xb7 \u201copen guide\u201d \xb7 \u201copen notes\u201d \xb7 \u201cclose\u201d'},
  {ic:'\u2295 View',d:'In the More menu. Zoom the whole app in or out, fit the page to your screen, or reset to 100%. Useful for presentations and smaller displays.'},
  {ic:'\u25be Save as PDF',d:'Every output document has a \u25be Save as PDF button to print or save a formatted copy. That includes the Assessment Report, Org Readiness, the Capital Snapshot, the Governance Framework, and the rest.'},
  {ic:'\u21bb Sample data',d:'In the More menu. Seeds the workspace with a realistic example portfolio so you can explore every screen before entering your own data.'}
];
for(var i=0;i<tools.length;i++){var tl=tools[i];h+='<div class="u-6dc0f40"><div class="u-57ca10d">'+tl.ic+'</div><div class="u-13544a9">'+tl.d+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Navigate Dashboard</div>';
h+='<p class="t-stone-md">The Navigate tab is the live operations center. It shows real-time pipeline stage counts, per-portfolio views (Blue Sky, Exploration, Development, Operational, No-Go), the Capital Planning Hub, and a Data Bank linking to every phase output document. The quarterly review also runs here, inside the Portfolio Review card under \u201cRun the review.\u201d</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Insights</div>';
h+='<p class="t-stone-md">Curated articles, essays, and podcast episodes by Faisal Hoque \u2013 sourced from Fast Company, Psychology Today, Harvard Business Review, MIT Sloan Management Review, IMD, LinkedIn, and the CONVERGENCE podcast. Use the Refresh button to pull the latest content.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Organization &amp; Team</div>';
h+='<p class="t-stone-md">Open <strong class="t-paper">Profile</strong> from the More menu to manage the team and record your organization details. The page leads with Team Members and keeps Organization Details below it. Every member can be edited or removed inline, and each carries a username and password for sign-in. These profiles flow through sign-in, step assignments, and Team Chat. The details cover the organization name, website, industry, company size, region, AI maturity level, executive sponsor, and the primary objective. Creating a new organization walks you through this setup once.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Data &amp; Privacy</div>';
h+='<p class="t-stone-md">Your organization\u2019s workspace is stored centrally on the program\u2019s servers and is isolated from every other organization. Everyone on your team signs into the same workspace, so the work you save is the work your colleagues see, whichever device they sign in from. The AI Guide sends your question, your recent messages in the Guide panel, and the name of the step you are on to Pinecone, an AI service, routed through the program\u2019s server rather than directly from your browser. Pinecone adds relevant passages from the program\u2019s reference material and has a Claude model, made by Anthropic, write the answer. Email notifications go out through the program\u2019s email service to the addresses on the team roster. <strong class="t-paper">Reset</strong> (More menu) clears the current organization\u2019s data for the whole team, so use it with care. You can sign out at any time from your profile chip.</p></div>';

h+='<div class="u-ea28b89"><button class="btn-gold" onclick="closeModal()">Got It</button></div>';
h+='</div></div>';
mr.innerHTML=h;
}

// === ORGANIZATION & TEAM ===
// Enterprise profile + team roster. Stored on data.enterprise (object) and
// data.members (array), persisted with the rest of data via saveData().
function orgInitials(name){
  var p=(name||'').trim().split(/\s+/).filter(Boolean);
  if(!p.length)return '?';
  return (p[0].charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase();
}

var orgSetupMode=false;
function toggleNavMore(e){if(e&&e.stopPropagation)e.stopPropagation();UI.navMore=!UI.navMore;render();}
function closeNavMore(){if(UI.navMore){UI.navMore=false;render();}}
function openOrg(){orgSetupMode=false;currentModal='org';UI.orgEdit=null;renderOrgModal();}
function openOrgSetup(){orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}

/* ── Admin: manage all organizations ───────────────── */
function openAdmin(){ if(!isAppAdmin){return;} currentModal='admin'; renderAdminModal(); }

/* ── Cross-org data helpers (admin edits any org without switching) ── */
function getOrgData(id){ return Store.readOrg(id)||emptyData(); }
function saveOrgData(id,d){ Store.writeOrg(id,d); if(id===currentOrgId){ data=d; applyTeamRoster(); } }
/* -- withOrgData (Part 4, 2 Oct 2026): run fn on an organization's data and save it, without switching to it. It never calls
   switchToOrg or sealSession: the admin console working on an organization's data is not a change of organization (S.4). -- */
function withOrgData(id, fn){
  var d=getOrgData(id);
  var r=fn(d);
  if(r && typeof r==='object') d=r;
  saveOrgData(id, d);
  return d;
}
/* Reset scope law (Rollout item 68): the organization, its name, its administrators, their passwords and its AI settings stay;
   every other team member is removed, with their sign-in, together with all the program data. The rest starts as createOrg starts it. */
function resetOrgData(id){
  return withOrgData(id, function(d){
    var admins=(Array.isArray(d.roster)?d.roster:[]).filter(function(u){ return u && u.admin===true; });
    var fresh=emptyData();
    fresh.roster=admins;
    fresh.settings=d.settings||{aiGuide:false,voice:false};
    fresh.enterprise={name:(d.enterprise&&d.enterprise.name)||((getOrg(id)||{}).name)||''};
    fresh.startDate=new Date().toISOString().split('T')[0];
    fresh.bf12=true;
    return fresh;
  });
}
function confirmResetOrg(){ return confirm('Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.'); }
function afterResetOrg(id, viewer){ if(viewer && id===currentOrgId && !getCurrentUser()) Auth.setSession((USERS[0]&&USERS[0].id)||null); } /* Follow-up (7 Oct 2026, as Governance dev): with nobody signed in (the full-screen console), a reset must not sign anyone in */
function adminResetOrg(id){ /* the Admin panel */
  if(!isAppAdmin || !getOrg(id)) return;
  if(!confirmResetOrg()) return;
  var viewer=(id===currentOrgId) ? currentUserId : null;
  resetOrgData(id); afterResetOrg(id, viewer);
  render(); renderAdminModal();
}
function adminConsoleReset(id){ /* the full-screen admin console */
  if(!isAppAdmin || !getOrg(id)) return;
  if(!confirmResetOrg()) return;
  var viewer=(id===currentOrgId) ? currentUserId : null;
  resetOrgData(id); afterResetOrg(id, viewer);
  UI.entry={step:'admin'}; render();
}

/* ── Admin: organizations ─────────────────────────── */
/* ── The Admin panel's new organization (5.7.4): a first person with a temporary password ── */
function adminAddOrg(){ if(!isAppAdmin) return; UI.adminNewOrg={err:''}; renderAdminModal(); }
function adminNewOrgFormHtml(){
  var s=UI.adminNewOrg||{}, k=s.keep||{};
  function f(label,id,val,ac){ return '<div><label class="org-flabel" for="'+id+'">'+label+'</label><input id="'+id+'" class="field-input" type="text" value="'+esc(val||'')+'" autocomplete="'+(ac||'off')+'"/></div>'; }
  var h='<div class="org-card editing admin-user-editor admin-new-org">';
  h+='<div class="org-edit-grid">'+f('Organization name','ano_org',k.org)+f('Name','ano_name',k.name)+f('Username','ano_user',k.user)+tempPasswordFieldHtml('ano_temp')+'</div>';
  if(s.err) h+='<div class="entry-err">'+esc(s.err)+'</div>';
  h+='<div class="org-edit-actions"><button class="org-btn-save" onclick="adminSaveNewOrg()">Save</button><button class="org-btn-cancel" onclick="UI.adminNewOrg=null;renderAdminModal()">Cancel</button></div>';
  return h+'</div>';
}
function adminSaveNewOrg(){
  if(!isAppAdmin) return;
  var s=UI.adminNewOrg||{}; function v(id){ var el=$(id); return el?el.value:''; }
  var orgName=v('ano_org').trim(), name=v('ano_name').trim(), username=v('ano_user').trim(), temp=v('ano_temp');
  var tEl=$('ano_temp'); if(tEl) tEl.value='';
  s.keep={org:orgName, name:name, user:username}; UI.adminNewOrg=s;
  function fail(m){ s.err=m; renderAdminModal(); }
  if(!orgName||!name||!username) return fail('Please complete all fields to continue.');
  if(usernameTaken(username)) return fail('That username is already taken. Choose another.');
  var prob=passwordProblem(temp); if(prob) return fail(prob);
  var keep=currentOrgId;
  var res=createOrg(orgName, {name:name, username:username, role:'Administrator'}, true);   /* the session is kept (S.4) */
  setCurrentOrg(keep); if(keep){ loadData(); applyTeamRoster(); } else { data=emptyData(); USERS.length=0; }
  Auth.setTemporaryPassword(res.orgId, res.userId, temp, function(r){
    if(r && r.ok){ UI.adminNewOrg=null; if(UI.entry && UI.entry.step==='admin') render(); renderAdminModal(); return; }
    deleteOrgById(res.orgId); fail(authRefusal(r, temp));   /* no organization is left without its first person's password */
  });
}
function adminRenameOrg(id){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o=getOrg(id); if(!o)return;
  var nm=prompt('Organization name:', o.name); if(nm===null)return; nm=(nm||'').trim(); if(!nm)return;
  saveOrgs(getOrgs().map(function(x){return x.id===id?Object.assign({},x,{name:nm}):x;}));
  var d=getOrgData(id); d.enterprise=d.enterprise||{}; d.enterprise.name=nm; saveOrgData(id,d);
  renderAdminModal();
}
function adminOpenOrg(id){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  try{Store.setRemember(null);}catch(e){}
  switchToOrg(id); Auth.setSession((USERS[0]&&USERS[0].id)||null);
  if(!currentUserId){ alert('This organization has no members yet. Add one first.'); switchToOrg(id); renderAdminModal(); return; }
  UI.adminUserEdit=null; closeModal(); render();
}
function adminDeleteOrg(id){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var o=getOrg(id); if(!o)return;
  if(id===currentOrgId){ alert("You can't delete the organization you're currently in. Switch to another organization first."); return; } // ruled July 9, mirrors adminDeleteUser
  if(getOrgs().length<=1){ alert('You must keep at least one organization.'); return; }
  if(!confirm('Delete "'+o.name+'" and all of its data? This cannot be undone.'))return;
  var wasCurrent=(id===currentOrgId);
  deleteOrgById(id);
  if(wasCurrent){ var others=getOrgs(); if(others.length){ switchToOrg(others[0].id); Auth.setSession((USERS[0]&&USERS[0].id)||null); } }
  renderAdminModal();
}

/* ── Admin: users (within any org) ────────────────── */
function adminEditUser(orgId,userId){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit={orgId:orgId,userId:userId}; renderAdminModal(); }
function adminAddUser(orgId){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */ UI.adminUserEdit={orgId:orgId,userId:'new'}; renderAdminModal(); }
function adminCancelUser(){ UI.adminUserEdit=null; renderAdminModal(); }
function adminSaveUser(orgId,userId){
  if(!isAppAdmin) return;   /* the app administrator's person editor (5.10) */
  var d=getOrgData(orgId); d.roster=d.roster||[];
  var fields=['name','username','role','scope','email','dept'];
  var v={}; fields.forEach(function(f){var el=$('au_'+f); if(el)v[f]=el.value.trim();});
  var _r6 = (d.roster || []).filter(function (x) { return x.id === userId })[0]; if (userId !== 'new' && v.username && _r6 && !sameUsername(v.username, _r6.username) && usernameServerCheck(v.username, orgId, userId, function () { adminSaveUser(orgId, userId); }, function (m) { var e6 = UI.adminUserEdit || { orgId: orgId, userId: userId }; e6.draft = v; e6.err = m; UI.adminUserEdit = e6; renderAdminModal(); })) return; /* Sweep 4R item 6 */
  var tEl=$('au_temporary'), temp=tEl?tEl.value:''; if(tEl) tEl.value='';
  var ed=UI.adminUserEdit||{orgId:orgId, userId:userId}; ed.draft=v; UI.adminUserEdit=ed;
  var aEl = $('au_admin'), wantAdmin = aEl ? aEl.checked === true : null; if (wantAdmin !== null) v.admin = wantAdmin; /* Sweep 4R item 2 */
  if (userId !== 'new' && wantAdmin === false) { var _r0 = (d.roster || []).filter(function (x) { return x.id === userId })[0]; if (_r0 && _r0.admin === true && adminCountIn(d.roster) <= 1) { alert(LAST_ADMIN_MSG); v.admin = true; renderAdminModal(); return; } }
  function fail(m){ ed.err=m; renderAdminModal(); }
  var isNew=(userId==='new');
  if(isNew && (!v.name||!v.username)) return fail('Please complete all fields to continue.');
  if(v.username && usernameTaken(v.username, orgId, isNew?null:userId)) return fail('That username is already taken. Choose another.');
  if(isNew || temp){ var prob=passwordProblem(temp); if(prob) return fail(prob); }   /* 5.7.2: required when adding; empty keeps the password when editing */
  var id=isNew?uid():userId;
  if(isNew){
    d.roster.push({id:id,name:v.name||'',username:v.username||'',role:v.role||'',scope:v.scope||'',email:v.email||'',dept:v.dept||'',initials:orgInitials(v.name||'')||'?',color:ORG_PALETTE[d.roster.length%ORG_PALETTE.length]});
  }else{
    var u=d.roster.filter(function(x){return x.id===userId;})[0];
    if(!u) return;
    fields.forEach(function(f){u[f]=v[f];}); u.initials=orgInitials(u.name||'')||u.initials;
  }
  if (wantAdmin !== null) { var _t = (d.roster || []).filter(function (x) { return x.id === id })[0]; if (_t) _t.admin = wantAdmin; } /* Sweep 4R item 2 */
  saveOrgData(orgId,d);
  if(!temp){ UI.adminUserEdit=null; renderAdminModal(); return; }
  Auth.setTemporaryPassword(orgId, id, temp, function(res){
    if(res && res.ok){ UI.adminUserEdit=null; renderAdminModal(); return; }
    if(isNew){ var d2=getOrgData(orgId); d2.roster=(d2.roster||[]).filter(function(x){return x.id!==id;}); saveOrgData(orgId,d2); }   /* nobody is added without a password */
    fail(authRefusal(res, temp));
  });
}
function adminDeleteUser(orgId,userId){ if(!isAppAdmin) return; /* Sweep 4R item 10: the app administrator's console checks its caller itself, not only by hiding its button */
  var _dr = (getOrgData(orgId).roster || []), _du = _dr.filter(function (x) { return x.id === userId })[0]; if (_du && _du.admin === true && adminCountIn(_dr) <= 1) { alert(LAST_ADMIN_MSG); return; } /* Sweep 4R item 2 (A.5.30) */
  if(orgId===currentOrgId && userId===currentUserId){ alert("You're signed in as this profile, so it can't be deleted here."); return; }
  var d=getOrgData(orgId); var u=(d.roster||[]).filter(function(x){return x.id===userId;})[0];
  if(!confirm('Delete '+((u&&u.name)||'this user')+'?'))return;
  d.roster=(d.roster||[]).filter(function(x){return x.id!==userId;});
  saveOrgData(orgId,d); UI.adminUserEdit=null; renderAdminModal();
}

function adminUserEditorHtml(orgId,u){
  u=u||{};
  var _ed=UI.adminUserEdit||{}; if(_ed.draft) u=Object.assign({},u,_ed.draft);
  function f(label,key,ph,type){return '<div><label class="org-flabel">'+label+'</label><input id="au_'+key+'" class="field-input" type="'+(type||'text')+'" value="'+esc(u[key]||'')+'" placeholder="'+esc(ph)+'" autocomplete="off"/></div>';}
  var isNew=!u.id;
  var h='<div class="org-card editing admin-user-editor">';
  h+='<div class="org-card-head">'+userAv(isNew?{initials:'?',color:'#8A7B72'}:u,36)+'<div class="org-card-headtxt">'+(isNew?'New user':'Editing user')+'</div></div>';
  h+='<div class="org-edit-grid">';
  h+=f('Name','name','Full name');
  h+=f('Username','username','e.g. maria');
  h+=f('Role / title','role','e.g. Pipeline Owner');
  h+=f('Scope / focus','scope','e.g. Operations');
  h+=f('Email','email','name@company.com','email');
  h+=f('Department','dept','e.g. Strategy');
  h+=tempPasswordFieldHtml('au_temporary') + adminTickHtml('au_admin', u.admin === true) /* Sweep 4R item 2 (A.5.29) */;
  h+='</div>';
  if(_ed.err) h+='<div class="entry-err">'+esc(_ed.err)+'</div>';
  h+='<div class="org-edit-actions">';
  h+='<button class="org-btn-save" onclick="adminSaveUser(\''+orgId+'\',\''+(u.id||'new')+'\')">Save</button>';
  h+='<button class="org-btn-cancel" onclick="adminCancelUser()">Cancel</button>';
  if(!isNew) h+='<button class="org-btn-del" onclick="adminDeleteUser(\''+orgId+'\',\''+u.id+'\')">Delete</button>';
  h+='</div></div>';
  return h;
}

function renderAdminModal(){
  var mr=$('modalRoot'); if(!mr)return;
  if(currentModal!=='admin'){mr.innerHTML='';return;}
  var orgs=getOrgs();
  var totalUsers=0; orgs.forEach(function(o){totalUsers+=orgRosterPreview(o.id).length;});
  var ed=UI.adminUserEdit||null;
  var h='<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">';
  h+='<h3>Admin</h3>';
  h+='<div class="admin-acct-actions"><button class="entry-link" onclick="openChangePassword()">Change password</button><button class="entry-link" onclick="openChangeUsername()">Change username</button></div>';
  h+='<div class="u-e6b5a04">All registered organizations and their users. '+orgs.length+' organization'+(orgs.length===1?'':'s')+' \xb7 '+totalUsers+' user'+(totalUsers===1?'':'s')+'. Each workspace is fully isolated.</div>';
  h+='<div class="admin-mgr-list">';
  orgs.forEach(function(o){
    var cur=(o.id===currentOrgId);
    var roster=orgRosterPreview(o.id);
    h+='<div class="admin-mgr-org'+(cur?' admin-org-current':'')+'">';
    // Org header
    h+='<div class="admin-mgr-orghead"><div class="entry-org-badge">'+esc((o.name||'?').slice(0,1).toUpperCase())+'</div>';
    h+='<div class="admin-mgr-orgmeta"><div class="admin-org-name">'+esc(o.name)+(cur?' <span class="org-you">Current</span>':'')+'</div>';
    h+='<div class="admin-org-sub">'+roster.length+' user'+(roster.length===1?'':'s')+' \xb7 created '+fmtDate(o.created)+'</div></div>';
    h+='<div class="admin-mgr-orgactions">';
    h+='<button class="org-row-btn" title="Rename organization" onclick="adminRenameOrg(\''+o.id+'\')">\u270E</button>';
    if(!cur) h+='<button class="org-btn-cancel admin-mini-btn" onclick="adminOpenOrg(\''+o.id+'\')">Open</button>';
    h+='<button class="org-btn-cancel admin-mini-btn" onclick="adminResetOrg(\''+o.id+'\')">Reset data</button>';
    if(!cur) h+='<button class="org-row-btn org-row-del" title="Delete organization" onclick="adminDeleteOrg(\''+o.id+'\')">\xd7</button>';
    h+='</div></div>';
    // Users
    h+='<div class="admin-mgr-users">';
    roster.forEach(function(u){
      if(ed && ed.orgId===o.id && ed.userId===u.id){ h+=adminUserEditorHtml(o.id,u); return; }
      h+='<div class="admin-mgr-userrow">'+userAv(u,28)
        +'<div class="admin-mgr-uinfo"><span class="admin-user-name">'+esc(u.name||'Unnamed')+'</span> <span class="admin-user-uname">@'+esc(u.username||'—')+'</span></div>'
        +'<span class="admin-user-role">'+esc(u.role||'')+'</span>'
        +'<button class="org-row-btn" title="Edit user" onclick="adminEditUser(\''+o.id+'\',\''+u.id+'\')">\u270E</button>'
        +'</div>';
    });
    if(ed && ed.orgId===o.id && ed.userId==='new'){ h+=adminUserEditorHtml(o.id,{}); }
    else { h+='<button class="admin-adduser" onclick="adminAddUser(\''+o.id+'\')">+ Add user</button>'; }
    h+='</div>';
    h+='</div>';
  });
  h+='</div>';
  if(UI.adminNewOrg) h+=adminNewOrgFormHtml();
  h+='<div class="u-ea28b89" style="justify-content:space-between"><button class="org-btn-cancel" onclick="adminAddOrg()">+ New Organization</button><button class="btn-gold" onclick="closeModal()">Done</button></div>';
  h+='</div></div>';
  mr.innerHTML=h;
}

// First-run gate: force org/team setup once if it has never been completed
// and no organization has been named yet.
function finishOrgSetup(){
  saveEnterprise();
  var nm=(data.enterprise&&data.enterprise.name||'').trim();
  if(!nm){var el=$('ent_name');if(el)el.focus();alert('Please enter your organization name to continue.');return;}
  data.orgSetup=true;saveData();
  orgSetupMode=false;closeModal();render();
}

// Team roster customizations persist on data.roster and are applied to the
// live USERS list at startup, so edits/deletes survive reloads and propagate
// to sign-in, assignments, and the nav chip.
var ORG_PALETTE=['#B8892A','#4866A0','#458363','#8158A0','#8B5E3C','#6B4C8A','#9B2D3F','#2D5A8E'];

function persistRoster(){
  data.roster=USERS.map(function(u){return Object.assign({},u);});
  saveData();
}

function applyTeamRoster(){
  try{
    USERS.length=0;
    if(Array.isArray(data.roster)&&data.roster.length){
      data.roster.forEach(function(u){USERS.push(u);});
      // fold any legacy "additional members" into the roster once
      if(Array.isArray(data.members)&&data.members.length){
        data.members.forEach(function(m){
          USERS.push({id:m.id||uid(),name:m.name||'',role:m.role||'',email:m.email||'',dept:m.dept||'',
            scope:'',initials:orgInitials(m.name)||'?',color:ORG_PALETTE[USERS.length%ORG_PALETTE.length]});
        });
        data.members=[];
      }
    }else{
      // No roster yet for this org → seed from the default team
      DEFAULT_ROSTER.forEach(function(u){USERS.push(Object.assign({},u));});
    }
    USERS.forEach(function(u){ if(u) delete u.passcode; }); /* Part 5: the organization's data holds no password; this clears one left in old data */
    data.roster=USERS.map(function(u){return Object.assign({},u);});
  }catch(e){}
}

function scrollEditorIntoView(focus){
  setTimeout(function(){
    var el=document.querySelector('.org-card.editing');
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'center'});
      if(focus){ var f=el.querySelector('input'); if(f)f.focus(); }
    }
  },60);
}
function editProfile(id){ if(!(canManagePeople()||id===currentUserId)) return; UI.orgEdit=id; UI.orgDraft=null; UI.orgErr=''; renderOrgModal(); scrollEditorIntoView(false); }
function cancelEditProfile(){ UI.orgEdit=null; UI.orgDraft=null; UI.orgErr=''; renderOrgModal(); }
/* 5.10: administrators manage the people; every member edits their own profile (their password: Change password). 5.7: a temporary password when adding. */
function saveProfile(id){
  var isNew=(id==='new'), isMe=(id===currentUserId);
  if(!(canManagePeople()||isMe)) return;
  var v={}; ['name','username','role','scope','email','dept'].forEach(function(f){ var el=$('ru_'+id+'_'+f); if(el) v[f]=el.value.trim(); });
  var _r6 = USERS.find(function (x) { return x.id === id }); if (!isNew && v.username && _r6 && !sameUsername(v.username, _r6.username) && usernameServerCheck(v.username, currentOrgId, id, function () { saveProfile(id); }, function (m) { UI.orgDraft = v; UI.orgErr = m; renderOrgModal(); })) return; /* Sweep 4R item 6 */
  var tEl=$('ru_'+id+'_temporary'), temp=(tEl&&!isMe)?tEl.value:''; if(tEl) tEl.value='';
  UI.orgDraft=v;
  var aEl = $('ru_' + id + '_admin'), wantAdmin = (aEl && canManagePeople()) ? aEl.checked === true : null; /* Sweep 4R item 2 */
  if (wantAdmin !== null) v.admin = wantAdmin;
  if (!isNew && wantAdmin === false) { var _was = USERS.find(function (x) { return x.id === id }); if (_was && _was.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); v.admin = true; renderOrgModal(); return; } }
  function fail(m){ UI.orgErr=m; renderOrgModal(); }
  if(isNew && (!v.name||!v.username)) return fail('Please complete all fields to continue.');
  if(v.username && usernameTaken(v.username, currentOrgId, isNew?null:id)) return fail('That username is already taken. Choose another.');
  if(isNew || temp){ var prob=passwordProblem(temp); if(prob) return fail(prob); }
  var u;
  if(isNew){ u={id:uid(),name:'',username:'',role:'',scope:'',email:'',dept:'',initials:'?',color:ORG_PALETTE[USERS.length%ORG_PALETTE.length]}; USERS.push(u); }
  else { u=USERS.find(function(x){return x.id===id}); if(!u) return; }
  Object.keys(v).forEach(function(f){ u[f]=v[f]; });
  if(u.name) u.initials=orgInitials(u.name);
  persistRoster();
  function done(){ UI.orgEdit=null; UI.orgDraft=null; UI.orgErr=''; render(); renderOrgModal(); }
  if(!temp) return done();
  Auth.setTemporaryPassword(currentOrgId, u.id, temp, function(res){
    if(res && res.ok) return done();
    if(isNew){ var i=USERS.indexOf(u); if(i>=0) USERS.splice(i,1); persistRoster(); }   /* nobody is added without a password */
    UI.orgErr=authRefusal(res, temp); render(); renderOrgModal();
  });
}
function addProfile(){
  if(!canManagePeople()) return;
  UI.orgEdit='new'; UI.orgDraft=null; UI.orgErr='';   /* a draft: nothing is saved until it has a temporary password */
  renderOrgModal();
  scrollEditorIntoView(true); // bring the new editor up into view and focus it
}
function removeProfile(id){
  if(id==='new'){ cancelEditProfile(); return; }
  if(!canManagePeople()) return;   /* 5.10 */
  var _ru = USERS.find(function (x) { return x.id === id }); if (_ru && _ru.admin === true && adminCountIn(USERS) <= 1) { alert(LAST_ADMIN_MSG); return; } /* Sweep 4R item 2 (A.5.30) */
  if(id===currentUserId){alert("You're signed in as this profile, so it can't be deleted here. Switch to another user first, then delete it.");return;}
  var u=USERS.find(function(x){return x.id===id});
  var label=(u&&u.name)?(' \u2014 '+u.name):'';
  if(!confirm('Delete this team member'+label+'? They will also be removed from sign-in and task assignments.'))return;
  var i=USERS.findIndex(function(x){return x.id===id});
  if(i>=0)USERS.splice(i,1);
  if(UI.orgEdit===id)UI.orgEdit=null;
  persistRoster();render();renderOrgModal();
}

function saveEnterprise(){ if (!canManagePeople()) return; /* Sweep 4R item 3: only administrators edit the organization's details */
  if(!data.enterprise)data.enterprise={};
  ['name','industry','size','region','website','maturity','sponsor','objective'].forEach(function(f){
    var el=$('ent_'+f);if(el)data.enterprise[f]=el.value;
  });
  saveData();
}

function renderOrgModal(){
  var mr=$('modalRoot');if(!mr)return;
  if(currentModal!=='org'){mr.innerHTML='';return;}
  var e=data.enterprise||{},members=data.members||[];
  var sizeOpts=[['','Select size\u2026'],['1\u201350','1\u201350'],['51\u2013200','51\u2013200'],['201\u20131,000','201\u20131,000'],['1,001\u20135,000','1,001\u20135,000'],['5,000+','5,000+']];
  var matOpts=[['','Select stage\u2026'],['Exploring','Exploring'],['Piloting','Piloting'],['Scaling','Scaling'],['Operating','Operating']];
  var _entDis = canManagePeople() ? '' : ' disabled'; /* Sweep 4R item 3: everyone else sees the details, read-only */
  function einp(id,v,ph,type){return '<input id="'+id+'" class="field-input" type="'+(type||'text')+'" value="'+esc(v||'')+'" placeholder="'+esc(ph)+'" onchange="saveEnterprise()"'+_entDis+'/>';}
  function esel(id,v,opts){var s='<select id="'+id+'" class="field-sel" onchange="saveEnterprise()"'+_entDis+'>';opts.forEach(function(o){s+='<option value="'+esc(o[0])+'"'+(v===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';});return s+'</select>';}
  function fl(label,ctrl){return '<div><label class="form-label">'+esc(label)+'</label>'+ctrl+'</div>';}

  var h='<div class="modal-bg"'+(orgSetupMode?'':' onclick="if(event.target===this)closeModal()"')+'>';
  h+='<div class="modal">';
  if(orgSetupMode){
    h+='<div class="org-setup-eyebrow">Welcome \u2014 let\u2019s get set up</div>';
    h+='<h3>Set Up Your Organization &amp; Team</h3>';
    h+='<div class="u-e6b5a04">Before you start, tell us about your organization and confirm who\u2019s on the team. You can change any of this later from the <strong class="t-paper">Profile</strong> button. An organization name is required to continue.</div>';
  }else{
    h+='<h3>Organization &amp; Team</h3>';
    h+='<div class="u-e6b5a04"></div>';
    if(canSetAiFeatures()) h+=aiFeaturesFold();
  }

  // Team members — compact roster; edit expands one profile at a time
  h+='<div class="mb-6"><div class="section-label mb-3">Team Members <span class="org-count">\xb7 '+USERS.length+'</span></div>';
  h+='<p class="t-stone-md" style="margin-bottom:14px;font-size:13px">These people appear in sign-in, task assignments, and team chat.</p>';
  if(USERS.length>7&&canManagePeople())h+='<div style="text-align:center;margin:0 0 12px">'+btn('+ Add team member','addProfile()','bs')+'</div>';
  h+='<div class="org-list">';
  (UI.orgEdit==='new'?USERS.concat([{id:'new',name:'',username:'',initials:'?',color:'#8A7B72'}]):USERS).forEach(function(u0){
    var u=(UI.orgEdit===u0.id&&UI.orgDraft)?Object.assign({},u0,UI.orgDraft):u0;
    var isMe=(u.id===currentUserId);
    if(UI.orgEdit===u.id){
      // Inline editor for the active profile
      h+='<div class="org-card editing">';
      h+='<div class="org-card-head">'+userAv(u,40)+'<div class="org-card-headtxt">Editing profile</div></div>';
      h+='<div class="org-edit-grid">';
      h+='<div><label class="org-flabel">Name</label><input id="ru_'+u.id+'_name" class="field-input" value="'+esc(u.name||'')+'" placeholder="Full name"/></div>';
      h+='<div><label class="org-flabel">Username</label><input id="ru_'+u.id+'_username" class="field-input" value="'+esc(u.username||'')+'" placeholder="e.g. maria" autocomplete="off"/></div>';
      h+='<div><label class="org-flabel">Role / title</label><input id="ru_'+u.id+'_role" class="field-input" value="'+esc(u.role||'')+'" placeholder="e.g. Pipeline Owner"/></div>';
      h+='<div><label class="org-flabel">Scope / focus</label><input id="ru_'+u.id+'_scope" class="field-input" value="'+esc(u.scope||'')+'" placeholder="e.g. Operations"/></div>';
      h+='<div><label class="org-flabel">Email</label><input id="ru_'+u.id+'_email" class="field-input" type="email" value="'+esc(u.email||'')+'" placeholder="name@company.com"/></div>';
      h+='<div><label class="org-flabel">Department</label><input id="ru_'+u.id+'_dept" class="field-input" value="'+esc(u.dept||'')+'" placeholder="e.g. Strategy"/></div>';
      if(!isMe&&canManagePeople()) h+=tempPasswordFieldHtml('ru_'+u.id+'_temporary');
      if (canManagePeople()) h += adminTickHtml('ru_' + u.id + '_admin', u.admin === true); /* Sweep 4R item 2 (A.5.29): administrators only; new members too */
      h+='</div>';
      if(UI.orgErr) h+='<div class="entry-err">'+esc(UI.orgErr)+'</div>';
      h+='<div class="org-edit-actions">';
      h+='<button class="org-btn-save" onclick="saveProfile(\''+u.id+'\')">Save</button>';
      h+='<button class="org-btn-cancel" onclick="cancelEditProfile()">Cancel</button>';
      if(canManagePeople()) h+='<button class="org-btn-del" onclick="removeProfile(\''+u.id+'\')"'+(isMe?' disabled title="Signed-in profile \u2014 switch users to delete"':'')+'>Delete</button>';
      h+='</div>';
      h+='</div>';
    }else{
      // Compact read-only row
      var meta=[esc(u.role||''),(u.scope&&u.scope!=='All')?esc(u.scope):''].filter(Boolean).join(' \xb7 ');
      var sub=[esc(u.email||''),esc(u.dept||'')].filter(Boolean).join(' \xb7 ');
      h+='<div class="org-row">';
      h+=userAv(u,38);
      h+='<div class="org-row-main"><div class="org-row-name">'+(esc(u.name)||'<span class="org-unnamed">Unnamed</span>')+(isMe?' <span class="org-you">You</span>':'')+'</div>';
      if(meta)h+='<div class="org-row-meta">'+meta+'</div>';
      if(sub)h+='<div class="org-row-sub">'+sub+'</div>';
      h+='</div>';
      h+='<div class="org-row-actions">';
      if(canManagePeople()||isMe) h+='<button class="org-row-btn" title="Edit profile" aria-label="Edit" onclick="editProfile(\''+u.id+'\')">\u270E</button>';
      if(canManagePeople()) h+='<button class="org-row-btn org-row-del" title="'+(isMe?'Signed-in profile \u2014 switch users to delete':'Delete profile')+'" aria-label="Delete" onclick="removeProfile(\''+u.id+'\')"'+(isMe?' disabled':'')+'>\xd7</button>';
      h+='</div>';
      h+='</div>';
    }
  });
  h+='</div>';
  if(canManagePeople()) h+='<div style="text-align:center">'+btn('+ Add team member','addProfile()','bs')+'</div>';
  h+='</div>';

  // Organization details (kept at the bottom of the page)
  h+='<div class="mb-6 org-subhead"><div class="section-label mb-3">Organization Details</div>'+(_entDis ? '<p class="ent-ro-note">Only administrators can change the organization\u2019s details.</p>' : '')+'';
  h+='<div class="org-grid">';
  h+=fl('Organization name'+(orgSetupMode?' *':''),einp('ent_name',e.name,'e.g. Acme Manufacturing'));
  h+=fl('Industry',einp('ent_industry',e.industry,'e.g. Industrial / Pharma'));
  h+=fl('Company size',esel('ent_size',e.size,sizeOpts));
  h+=fl('Region / HQ',einp('ent_region',e.region,'e.g. Boston, USA'));
  h+=fl('Website',einp('ent_website',e.website,'e.g. acme.com'));
  h+=fl('AI maturity',esel('ent_maturity',e.maturity,matOpts));
  h+=fl('Executive sponsor',einp('ent_sponsor',e.sponsor,'e.g. CEO / CFO name'));
  h+='</div>';
  h+='<div style="margin-top:14px">'+fl('Primary objective','<textarea id="ent_objective" class="field-ta" rows="2" placeholder="What is the enterprise aiming to achieve with AI in the next 90 days?" onchange="saveEnterprise()"'+_entDis+'>'+esc(e.objective||'')+'</textarea>')+'</div>';
  h+='</div>';

  h+='<div class="u-ea28b89">'+(orgSetupMode?'<button class="btn-gold" onclick="finishOrgSetup()">Get Started</button>':'<button class="btn-gold" onclick="closeModal()">Done</button>')+'</div>';
  h+='</div></div>';
  mr.innerHTML=h;
}

// === VOICE ACTIVATION ===
var voiceActive=false,recognition=null,voiceTimeout=null;

function toggleVoice(){
if(!voiceOn()) return;
if(voiceActive){voiceActive=false;if(recognition){try{recognition.stop()}catch(e){}}updateVoiceUI();return;}
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SR){showVoiceToast('Voice not supported','Use Chrome, Edge, or Safari');return}
recognition=new SR();
recognition.continuous=false;recognition.interimResults=true;recognition.lang='en-US';recognition.maxAlternatives=1;
recognition.onstart=function(){voiceActive=true;updateVoiceUI();showVoiceToast('Listening\u2026','Try: "learn" \u00b7 "pipeline" \u00b7 "navigate" \u00b7 "open coach"')};
recognition.onresult=function(e){
var final='',interim='';
for(var i=0;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript}
var display=final||interim;
if(display){var t=$('voiceToast');if(t){t.innerHTML='<div class="voice-transcript">\u201c'+display.trim()+'\u201d</div>';t.classList.add('show')}}
if(final){processVoice(final.trim().toLowerCase())}
};
recognition.onerror=function(e){if(e.error==='not-allowed')showVoiceToast('Microphone blocked','Allow mic access in browser settings');else if(e.error!=='no-speech'&&e.error!=='aborted')showVoiceToast('Error: '+e.error,'')};
recognition.onend=function(){voiceActive=false;recognition=null;updateVoiceUI();clearTimeout(voiceTimeout);voiceTimeout=setTimeout(function(){var t=$('voiceToast');if(t)t.classList.remove('show')},4000)};
try{recognition.start()}catch(e){showVoiceToast('Could not start mic',''+e.message);voiceActive=false;updateVoiceUI()}
}

function updateVoiceUI(){
var fab=$('voiceFab'),lbl=$('voiceLabel');
if(fab){if(voiceActive){fab.classList.add('listening');if(lbl)lbl.textContent='Listening…'}else{fab.classList.remove('listening');if(lbl)lbl.textContent='Voice'}}
var nb=$('navVoiceBtn');
if(nb){if(voiceActive){nb.style.borderColor='var(--gold)';nb.style.color='var(--gold)';nb.textContent='◉ Listening…'}else{nb.style.borderColor='';nb.style.color='';nb.innerHTML='◉ Voice'}}
}

function showVoiceToast(msg,sub){
var t=$('voiceToast');if(!t)return;
t.innerHTML='<div>'+msg+'</div>'+(sub?'<div class="voice-cmd">'+sub+'</div>':'');
t.classList.add('show');
clearTimeout(voiceTimeout);
voiceTimeout=setTimeout(function(){t.classList.remove('show')},6000);
}

function processVoice(text){
var matched=true;
if(text.match(/\b(overview|home|go home|main|start)\b/))go('home');
else if(text.match(/\b(learn|read|research|library|articles?|books?|videos?|podcast)\b/))go('learn');
else if(text.match(/\b(pipeline|phases?|journey|steps?)\b/))go('pipeline');
else if(text.match(/\b(navigate|dashboard|operational|live)\b/))go('phase5');
else if(text.match(/\b(help)\b|how does this work/)){openHelp();showVoiceToast('\u2713 Opening help','')}
else if(aiGuideOn()&&text.match(/\b(coach|guide)\b|ask.*(coach|guide)|open.*(coach|guide)/)){if(!coachOpen)toggleCoach();showVoiceToast('\u2713 Opening AI Guide','')}
else if(text.match(/\b(notes?)\b|open.*note/)){if(!notesOpen)toggleNotes();showVoiceToast('\u2713 Opening notes','')}
else if(text.match(/\b(close|stop|cancel|never mind|dismiss)\b/)){closeModal();if(coachOpen)toggleCoach();if(notesOpen)toggleNotes();showVoiceToast('Closed','')}
else{matched=false;showVoiceToast('Didn\u2019t catch that','Try: "learn" \u00b7 "pipeline" \u00b7 "guide" \u00b7 "navigate"')}
if(matched&&!text.match(/close|stop|cancel/))showVoiceToast('\u2713 '+text,'');
}

/* ═══════════════════════════════════════════════════════════════
   SEED SAMPLE DATA — for testing the visualizations and multi-user
   features without manually filling forms. Triggered by the "Seed"
   button in the navbar (next to Reset).
   ═══════════════════════════════════════════════════════════════ */
function buildSeedBase(sd){ /* pure builder – fills `data` from the anchor date; no confirm, no persistence. Split from seedData for the Year 2 seed (Paul, July 8) */
  data.startDate = sd.toISOString().split('T')[0];
  data.bf12 = true;

  // ─── Phase 1: Assessment (all sections complete) ───
  data.purpose = {
    mission: 'Enable global businesses to operate at the intersection of human judgment and AI capability.',
    values: 'Trust \u00b7 Rigor \u00b7 Courage',
    shortTerm: 'Three enterprise AI pilots launched in Q1.',
    mediumTerm: 'Five operational AI pipelines by year-end.',
    longTerm: 'Industry-standard AI innovation framework adopted across 50 organizations.',
    goals: '1. Three AI pilots live\n2. Two AI case studies published\n3. Co-Delivery Partner agreement signed',
    frictions: '1. Slow capital cycles\n2. Mid-management AI literacy gaps\n3. Legacy procurement processes'
  };
  data.knowledge = { usage:'moderate', awareness:4, resources:'moderate', learning:'systematic' };
  data.culture = { uncertainty:3, aiLegitimacy:4, newProposals:4, incentives:3, frontline:3, overall:4 };
  data.audit = [
    {name:'AI-assisted customer triage', status:'alive', assigned:'yes', projIdx:0},
    {name:'Forecast model rebuild', status:'alive', assigned:'yes', projIdx:1},
    {name:'Document classification', status:'dormant', assigned:'no'},
    {name:'Knowledge graph PoC', status:'dead', assigned:'no'},
    {name:'Predictive maintenance', status:'alive', assigned:'yes', projIdx:4}
  ];
  data.decisions = {
    q1: { who:'Innovation Council',  gap:'' },
    q2: { who:'Phase Owner + CIO',   gap:'' },
    q3: { who:'CFO + COO',           gap:'Bottleneck in Q2 budget reallocation' },
    q4: { who:'Phase Owner',         gap:'' },
    q5: { who:'Resource Council',    gap:'Cross-functional staffing still slow' }
  };

  // ─── Ideas (1.2) — live idea-card schema ───
  data.ideas = [
    {name:'AI-Assisted Customer Triage', desc:'Route incoming inquiries by intent and urgency using LLM classification.', strategic:'Friction: support queue response times', cost:'Medium ($15-60K)', outcome:'Best: two-thirds of inquiries routed without human touch. Worst: misrouted urgent cases erode trust in the queue.', capabilities:'LLM classification, help-desk integration, labeled inquiry history.', risk:'Misrouting urgent complaints. Model drift as product mix changes.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'},
    {name:'Forecast Demand Model', desc:'Rebuild SKU-level demand forecasting with foundation models.', strategic:'Friction: inventory write-offs', cost:'High ($60K+)', outcome:'Best: write-offs cut by a third and stockouts halved. Worst: forecasts no better than the current spreadsheet.', capabilities:'Data science capacity, clean SKU sales history, ERP integration.', risk:'Sparse history on new SKUs. Planner trust if early forecasts miss.', dept:'Supply Chain', when:'now', timeframe:'12+ months'},
    {name:'Sales Knowledge Graph', desc:'Connect CRM, contracts, and product data for a unified rep view.', strategic:'Friction: fragmented account context', cost:'High ($60K+)', outcome:'Best: reps see full account context in one view and win rates rise. Worst: an expensive integration nobody opens.', capabilities:'Graph modeling, CRM and contract system APIs, data stewardship.', risk:'Stale data undermining trust. Integration scope creep.', dept:'Sales', when:'now', timeframe:'6-12 months'},
    {name:'Document Intelligence', desc:'Extract structured data from supplier contracts and invoices.', strategic:'Friction: manual contract review', cost:'Medium ($15-60K)', outcome:'Best: contract review hours cut by half with better accuracy. Worst: extraction errors propagate into payments.', capabilities:'OCR and extraction models, finance process knowledge, sample corpus.', risk:'Extraction errors on non-standard layouts. Supplier format drift.', dept:'Finance', when:'now', timeframe:'3-6 months'},
    {name:'Predictive Maintenance', desc:'Anomaly detection on plant sensor streams.', strategic:'Friction: unplanned line stoppages', cost:'High ($60K+)', outcome:'Best: unplanned stoppages down 40% with parts ordered ahead of failure. Worst: false alarms stop healthy lines.', capabilities:'Sensor infrastructure, anomaly models, maintenance engineering time.', risk:'False positives eroding operator trust. Sensor coverage gaps.', dept:'Manufacturing', when:'now', timeframe:'3-6 months'},
    {name:'Marketing Brief Generator', desc:'Draft campaign briefs from brand and product context.', strategic:'Friction: slow campaign turnaround', cost:'Low ($0-15K)', outcome:'Best: campaign briefs in hours instead of weeks. Worst: generic briefs that still need full rewrites.', capabilities:'Prompted LLM workflow, brand guideline corpus.', risk:'Off-brand output. Overreliance replacing strategic thinking.', dept:'Marketing', when:'future', timeframe:'1-3 months'},
    {name:'HR Skills Matcher', desc:'Match internal talent to open requisitions via a skill graph.', strategic:'Friction: slow internal mobility', cost:'Medium ($15-60K)', outcome:'Best: internal fills rise and time-to-fill drops. Worst: matches ignored by hiring managers.', capabilities:'Skills taxonomy, HRIS data access, matching model.', risk:'Stale skills data. Perceived unfairness in match rankings.', dept:'HR', when:'future', timeframe:'3-6 months'},
    {name:'Sustainability Reporting', desc:'Automate ESG metric collection from systems of record.', strategic:'Friction: manual ESG assembly', cost:'Low ($0-15K)', outcome:'Best: ESG pack assembled automatically each quarter. Worst: numbers still hand-checked line by line.', capabilities:'System-of-record connectors, ESG metric definitions.', risk:'Source-data quality. Framework changes outdating the mappings.', dept:'Operations', when:'future', timeframe:'6-12 months'},
    {name:'Meeting Minutes Automator', desc:'Draft structured minutes and action items from recorded meetings.', strategic:'Friction: untracked decisions and follow-ups', cost:'Low ($0-15K)', outcome:'Best: every decision and action captured and tracked. Worst: transcripts nobody reads and actions nobody owns.', capabilities:'Speech-to-text, summarization, calendar integration.', risk:'Sensitive discussions recorded. Attribution errors in minutes.', dept:'Corporate', when:'future', timeframe:'1-3 months'},
    {name:'Supplier Risk Radar', desc:'Monitor supplier news, filings, and delivery data for early risk signals.', strategic:'Friction: reactive supplier management', cost:'Medium ($15-60K)', outcome:'Best: supplier failures flagged a quarter before they bite. Worst: alert noise that procurement tunes out.', capabilities:'News and filings feeds, entity matching, procurement workflow hooks.', risk:'False alarms damaging supplier relationships. Feed coverage gaps.', dept:'Procurement', when:'future', timeframe:'6-12 months'},
    {name:'Energy Optimization', desc:'Optimize plant energy consumption against production schedules and tariffs.', strategic:'Friction: rising energy cost per unit', cost:'High ($60K+)', outcome:'Best: energy cost per unit down 15% with no schedule impact. Worst: savings too small to justify the metering spend.', capabilities:'Sub-metering, optimization models, production schedule access.', risk:'Tariff volatility swamping gains. Production constraints limiting flexibility.', dept:'Facilities', when:'future', timeframe:'12+ months'},
    {name:'Procurement Copilot', desc:'Draft RFQs and compare supplier bids against historical pricing.', strategic:'Friction: slow sourcing cycles', cost:'Medium ($15-60K)', outcome:'Best: sourcing cycles halved and quote quality up. Worst: buyers bypass it and keep their spreadsheets.', capabilities:'LLM drafting, historical pricing data, e-sourcing integration.', risk:'Price-comparison errors. Supplier gaming of standardized RFQs.', dept:'Procurement', when:'now', timeframe:'3-6 months'},
    {name:'Invoice Coding Copilot', desc:'Auto-suggest GL codes and cost centers on inbound invoices.', strategic:'Friction: month-end close delays', cost:'Low ($0-15K)', outcome:'Best: coding accuracy up and close shortened by two days. Worst: miscodes surface at audit.', capabilities:'AP system integration, GL history for training.', risk:'Silent miscoding. Exceptions still routing to the same bottleneck.', dept:'Finance', when:'now', timeframe:'1-3 months'},
    {name:'Quality Inspection Vision', desc:'Camera-based defect detection on the final assembly line.', strategic:'Friction: escaped defects reaching customers', cost:'High ($60K+)', outcome:'Best: escaped defects near zero at line speed. Worst: false rejects slow the line and the cameras get switched off.', capabilities:'Camera and edge infrastructure, CV models, labeled defect imagery.', risk:'Lighting and product-variant sensitivity. Labeled-image volume needed.', dept:'Manufacturing', when:'now', timeframe:'12+ months'},
    {name:'Churn Early-Warning Model', desc:'Score accounts weekly on churn risk from usage and support signals.', strategic:'Friction: surprise cancellations', cost:'Medium ($15-60K)', outcome:'Best: a third of at-risk accounts saved by earlier outreach. Worst: scores nobody acts on.', capabilities:'Usage and support data pipeline, scoring model, CRM alerting.', risk:'Acting capacity in account teams. Signal quality on low-touch accounts.', dept:'Customer Ops', when:'now', timeframe:'3-6 months'},
    {name:'Logistics Route Optimizer', desc:'Re-plan delivery routes daily against traffic, load, and fuel data.', strategic:'Friction: rising cost per delivery', cost:'Medium ($15-60K)', outcome:'Best: cost per delivery down 12% with better on-time rates. Worst: drivers ignore the routes and revert.', capabilities:'Routing engine, telematics data, dispatch process change.', risk:'Driver adoption. Local knowledge the model lacks.', dept:'Supply Chain', when:'now', timeframe:'6-12 months'},
    {name:'Field Service Assistant', desc:'On-site troubleshooting answers from manuals and repair history.', strategic:'Friction: repeat service visits', cost:'Medium ($15-60K)', outcome:'Best: first-visit fix rate up ten points. Worst: wrong answers in the field damage equipment or trust.', capabilities:'Manual and repair-history corpus, retrieval pipeline, mobile delivery.', risk:'Wrong guidance on safety-critical steps. Coverage of legacy equipment.', dept:'Service', when:'now', timeframe:'3-6 months'},
    {name:'Compliance Q&A Bot', desc:'Policy and regulation answers for frontline staff, with citations.', strategic:'Friction: compliance bottleneck on routine questions', cost:'High ($60K+)', outcome:'Best: routine questions answered instantly with citations, legal freed for real issues. Worst: a confident wrong answer creates the exposure it was meant to prevent.', capabilities:'Curated policy corpus, retrieval with citations, legal review loop.', risk:'Hallucinated or outdated answers. Jurisdictional nuance.', dept:'Legal', when:'now', timeframe:'12+ months'},
    {name:'Sales Proposal Drafter', desc:'Assemble first-draft proposals from CRM context and past wins.', strategic:'Friction: slow proposal turnaround', cost:'Low ($0-15K)', outcome:'Best: proposal turnaround from days to hours with higher hit rates. Worst: templated proposals that read templated.', capabilities:'CRM context access, past-win corpus, LLM drafting.', risk:'Stale pricing in drafts. Confidential terms leaking between accounts.', dept:'Sales', when:'now', timeframe:'1-3 months'},
    {name:'Support Ticket Summarizer', desc:'Summarize long ticket threads and suggest next actions for agents.', strategic:'Friction: slow handoffs between support tiers', cost:'Low ($0-15K)', outcome:'Best: handoffs lose nothing and resolution times drop. Worst: summaries drop the one detail that mattered.', capabilities:'Ticket system integration, summarization models.', risk:'Omission of critical details. Agent overreliance on the summary.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'}
  ];
  data.selected = [0,1,2,3,4,11,12,13,14,15,16,17];

  // ─── 1.3: per-dimension gates + triage scores (live schema) ───
  data.assessments = {
    0: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:9, costScore:9, difficulty:8 },
    1: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:7, value:8, costScore:7, difficulty:8 },
    2: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:5, difficulty:6 },
    3: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:5, value:6, costScore:5, difficulty:5 },
    4: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:8, costScore:8, difficulty:8 },
    11: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:6, difficulty:6 },
    12: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 },
    13: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:4, value:8, costScore:4, difficulty:4 },
    14: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:8, costScore:6, difficulty:6 },
    15: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:4, value:6, costScore:5, difficulty:5 },
    16: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:7, costScore:6, difficulty:6 },
    17: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:3, value:9, costScore:4, difficulty:5 },
    18: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 } /* 16 Sep 2026 (Paul's ruling): one unselected idea fully qualified and scored (34 / 50), so the Blue Sky portfolio shows a ranked idea awaiting selection */
  };

  // ─── 2.4: deepened projects (shared assessment block schema) ───
  data.projects = {
    0: { startupCost:'$170K', rolloutCost:'$50K', runningCost:'$60K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut median inquiry handle time 30% across two service queues within 60 days.',
      deliverables:'Triage classifier in production; routing rules; QA dashboard.',
      timeline:'Prototype 3 weeks, pilot 4 weeks, rollout 2 weeks.',
      resources:'1 ML engineer, 1 ops analyst, $220K.',
      risks:'Misrouting edge cases; agent trust in early weeks.',
      metrics:'Median handle time; misroute rate < 4%.',
      gap:{ skillsH:'Strong support ops team', skillsN:'Prompt engineering depth', resourcesH:'Queue data, labeled history', resourcesN:'Eval tooling', technologyH:'CRM APIs in place', technologyN:'LLM gateway' },
      swot:{ strengths:'Clean historical data; strong sponsor.', weaknesses:'No in-house eval harness.', opportunities:'Pattern reusable across three queues.', threats:'Vendor pricing shifts.' },
      partInt:'IT platform team for gateway.', partExt:'LLM vendor solutions engineer.',
      rescore:{ priority:9, risk:9, value:9, costScore:9, difficulty:8 }, rescoreDone:true },
    1: { startupCost:'$680K', rolloutCost:'$170K', runningCost:'$180K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut inventory write-offs 15% via foundation-model demand forecasting.',
      deliverables:'SKU-level forecast service; planner workbench integration.',
      timeline:'Data prep 4 weeks, model 4 weeks, pilot 4 weeks.',
      resources:'1 data scientist, 1 data engineer, $850K.',
      risks:'Data quality in long-tail SKUs; planner adoption.',
      metrics:'Write-off rate (4-week moving average).',
      gap:{ skillsH:'Forecasting team in place', skillsN:'Foundation-model fine-tuning', resourcesH:'3 years sales history', resourcesN:'Feature store', technologyH:'Warehouse on BigQuery', technologyN:'Model serving infra' },
      swot:{ strengths:'Rich history; clear baseline.', weaknesses:'Long time-to-value.', opportunities:'Extends to procurement planning.', threats:'Demand shocks invalidate training data.' },
      partInt:'Supply chain planning leads.', partExt:'Cloud provider ML specialists.',
      rescore:{ priority:8, risk:7, value:9, costScore:7, difficulty:9 }, rescoreDone:true },
    2: { startupCost:'$250K', rolloutCost:'$60K', runningCost:'$90K', viable:true, assessed:true,
      objectives:'Unify CRM, contract, and product data into a rep-facing account graph.',
      deliverables:'Knowledge graph; rep sidebar; refresh pipeline.',
      timeline:'Schema 3 weeks, ingest 5 weeks, UI 4 weeks.',
      resources:'1 data engineer, 0.5 PM, $310K.',
      risks:'Entity resolution quality; CRM data hygiene.',
      metrics:'Rep prep time per account; data coverage %.',
      gap:{ skillsH:'CRM admin expertise', skillsN:'Graph modeling', resourcesH:'Contract repository', resourcesN:'Entity-resolution tooling', technologyH:'CRM + CLM APIs', technologyN:'Graph database' },
      swot:{ strengths:'High strategic pull from sales.', weaknesses:'Ambiguous near-term ROI.', opportunities:'Foundation for assistant features.', threats:'Scope creep across data owners.' },
      partInt:'Sales ops; legal for contract access.', partExt:'Graph DB vendor.' },
    3: { viable:false, noGoReason:'Document Intelligence overlaps the dormant classification project; revisit after vendor consolidation in Q3.' },
    4: { startupCost:'$150K', rolloutCost:'$270K', runningCost:'$110K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Catch 80% of line failures 48 hours before production impact.',
      deliverables:'Anomaly models on sensor streams; alerting into maintenance workflow.',
      timeline:'Sensor audit 2 weeks, models 4 weeks, pilot 4 weeks.',
      resources:'1 ML engineer, plant liaison, $420K.',
      risks:'Sensor coverage gaps on older lines.',
      metrics:'Detection lead time; false-positive rate.',
      gap:{ skillsH:'Reliability engineering team', skillsN:'Streaming ML ops', resourcesH:'High-quality sensor data', resourcesN:'Edge compute budget', technologyH:'Historian database', technologyN:'Streaming pipeline' },
      swot:{ strengths:'Sensor data quality high.', weaknesses:'Edge deployment unproven.', opportunities:'Insurance premium reduction.', threats:'Plant network constraints.' },
      partInt:'Plant operations leads.', partExt:'Sensor platform vendor.',
      rescore:{ priority:8, risk:8, value:8, costScore:8, difficulty:9 }, rescoreDone:true },
    11: { startupCost:'$205K', rolloutCost:'$55K', runningCost:'$70K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut sourcing cycle time 25% on indirect spend within one quarter.',
      deliverables:'RFQ drafting assistant; bid comparison view; pricing history index.',
      timeline:'Pricing index 3 weeks, assistant 4 weeks, pilot 4 weeks.',
      resources:'1 engineer, procurement analyst, $260K.',
      risks:'Supplier data quality; buyer adoption.',
      metrics:'Sourcing cycle time; assisted-RFQ share.',
      gap:{ skillsH:'Category expertise', skillsN:'Retrieval tuning', resourcesH:'5 years PO history', resourcesN:'Clean supplier master', technologyH:'ERP APIs', technologyN:'Document pipeline' },
      swot:{ strengths:'Clear baseline metrics.', weaknesses:'Fragmented supplier data.', opportunities:'Extends to contract renewals.', threats:'Supplier pushback on comparisons.' },
      partInt:'Procurement category leads.', partExt:'ERP vendor services.',
      rescore:{ priority:8, risk:6, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    12: { startupCost:'$80K', rolloutCost:'$10K', runningCost:'$25K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut invoice coding effort 50% and shorten month-end close by one day.',
      deliverables:'GL-code suggestion service inside the AP workflow; exception queue.',
      timeline:'Data prep 2 weeks, model 3 weeks, pilot 3 weeks.',
      resources:'1 engineer part-time, AP lead, $90K.',
      risks:'Edge-case codings; auditor acceptance.',
      metrics:'Auto-coding acceptance rate; close duration.',
      gap:{ skillsH:'AP process knowledge', skillsN:'ML ops basics', resourcesH:'3 years coded invoices', resourcesN:'Eval set', technologyH:'AP workflow APIs', technologyN:'None significant' },
      swot:{ strengths:'Cheap, fast, measurable.', weaknesses:'Limited strategic upside.', opportunities:'Pattern reusable in expenses.', threats:'ERP upgrade mid-project.' },
      partInt:'Controller and AP team.', partExt:'None.',
      rescore:{ priority:6, risk:8, value:6, costScore:8, difficulty:7 }, rescoreDone:true },
    13: { startupCost:'$200K', rolloutCost:'$310K', runningCost:'$140K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Catch 90% of visual defects at final assembly before packaging.',
      deliverables:'Camera stations on two lines; defect models; operator review screen.',
      timeline:'Camera install 4 weeks, models 6 weeks, pilot 6 weeks.',
      resources:'1 ML engineer, quality engineer, $510K.',
      risks:'Lighting variance; defect-class long tail.',
      metrics:'Escaped-defect rate; false-reject rate.',
      gap:{ skillsH:'Quality engineering', skillsN:'Computer vision', resourcesH:'Defect photo archive', resourcesN:'Labeling budget', technologyH:'Line PLC integration', technologyN:'Camera infrastructure' },
      swot:{ strengths:'Strong cost-of-quality case.', weaknesses:'Long setup before signal.', opportunities:'Extends to incoming inspection.', threats:'Line-speed constraints.' },
      partInt:'Plant quality leads.', partExt:'Vision platform vendor.',
      rescore:{ priority:8, risk:4, value:9, costScore:4, difficulty:5 }, rescoreDone:true },
    14: { startupCost:'$180K', runningCost:'$55K', viable:true, assessed:true,
      objectives:'Flag 70% of churning accounts at least 30 days before cancellation.',
      deliverables:'Weekly churn-risk scores in the CRM; playbook triggers for CS team.',
      timeline:'Feature build 3 weeks, model 3 weeks, CS pilot 4 weeks.',
      resources:'1 data scientist, CS ops lead, $180K.',
      risks:'Label leakage; alert fatigue in CS.',
      metrics:'30-day detection rate; save rate on flagged accounts.',
      gap:{ skillsH:'CS process maturity', skillsN:'Feature engineering depth', resourcesH:'Usage telemetry', resourcesN:'Outcome labels pre-2024', technologyH:'CRM integration', technologyN:'Scoring pipeline' },
      swot:{ strengths:'Direct revenue protection.', weaknesses:'History shallow on outcomes.', opportunities:'Feeds expansion-signal models.', threats:'CS staffing for follow-up.' },
      partInt:'Customer success leadership.', partExt:'CRM vendor data services.',
      rescore:{ priority:7, risk:7, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    15: { startupCost:'$240K', runningCost:'$65K', viable:true, assessed:true,
      objectives:'Cut cost per delivery 8% across the regional fleet within two quarters.',
      deliverables:'Daily route plans into dispatch; driver-app turn list; savings dashboard.',
      timeline:'Data integration 4 weeks, optimizer 4 weeks, depot pilot 5 weeks.',
      resources:'1 engineer, dispatch lead, $240K.',
      risks:'Driver acceptance; address-data quality.',
      metrics:'Cost per delivery; planned-vs-actual route adherence.',
      gap:{ skillsH:'Dispatch expertise', skillsN:'Optimization modeling', resourcesH:'Telematics feed', resourcesN:'Clean address base', technologyH:'Dispatch system APIs', technologyN:'Routing engine' },
      swot:{ strengths:'Hard-dollar savings.', weaknesses:'Change management with drivers.', opportunities:'Extends to fleet sizing.', threats:'Fuel-price volatility masks signal.' },
      partInt:'Regional dispatch managers.', partExt:'Telematics provider.' },
    16: { objectives:'Pilot an on-site troubleshooting assistant that answers from installation manuals and service history, cutting repeat visits on the top five fault categories. Target: resolve 40% of field issues on the first visit with guided troubleshooting.',
      deliverables:'Retrieval index over manuals and service tickets; assistant in the technician mobile app; a 12-technician ride-along pilot; an accuracy evaluation set with sign-off thresholds.',
      timeline:'Index and prototype months 1\u20132; technician pilot Months 3\u20134; evaluation and rollout decision Month 5.',
      resources:'Service ops lead at 25%, two engineers, retrieval-stack vendor; roughly $140K development.',
      risks:'Manual coverage gaps on legacy product lines; wrong torque or spec answers in the field; technician adoption.',
      metrics:'First-visit fix rate +8 points; average handle time \u221215%; assistant answer acceptance above 70% in the pilot.',
      gap:{ skillsH:'Strong service-ops knowledge; two engineers with API experience.', skillsN:'Retrieval evaluation and prompt-safety experience.',
            resourcesH:'Manuals digitized for current lines; service tickets in the CRM.', resourcesN:'Legacy-line manuals need scanning; field devices for the pilot cohort.',
            technologyH:'CRM with full ticket history; shared document store.', technologyN:'Retrieval stack, mobile front end, evaluation harness.' },
      swot:{ strengths:'Rich ticket history; motivated service team; the cost of repeat visits is measured and visible.',
             weaknesses:'Legacy documentation is patchy; field connectivity varies by site.',
             opportunities:'Extends naturally to dealer-network support; feeds the warranty analytics roadmap.',
             threats:'Wrong answers in the field damage technician trust quickly; vendor lock-in on the retrieval stack.' },
      partInt:'IT for CRM and document-store integration; Service Ops for the pilot cohort and playbooks.',
      partExt:'Retrieval-stack vendor; documentation scanning service for legacy manuals.' }
  };

  // ─── Phase 2: Organize ───
  var _ld1=uid(),_ld2=uid(),_sr1=uid(),_sr2=uid();
  data.ownership = {
    ownerName: 'Shalini Mehta', ownerRole: 'VP Innovation',
    authority: 'Full budget authority for AI portfolio under $2M per initiative.',
    leads: [ { id:_ld1, name:'Vincent Lau', dept:'Engineering' }, { id:_ld2, name:'Harriet Rivers', dept:'Product' } ],
    seniors: [ { id:_sr1, name:'Imogen Whitfield', role:'CEO' }, { id:_sr2, name:'Daniel Reyes', role:'CFO' } ]
  };
  data.incentives = {
    current: 'Annual targets, individual MBOs, no innovation metric.',
    changes: 'Quarterly OKRs with explicit experimentation budget; team-based learning targets.',
    metrics: ['Active experiments','Kill speed','Support for experimentation','Time-to-value']
  };
  data.rhythm = { day:'Tue', time:'9:00 AM', attendees:['Shalini Mehta','Vincent Lau','Harriet Rivers'], agendaList:['Development gate reviews','Blocker triage','Experiment outcomes'] };
  data.raci = {};
  (function(){var _pp=['owner',_ld1,_ld2,_sr1,_sr2,'finance'];
  [['A','R','C','I','I','C'],   // Approve experiments – Shalini owns the call, Vincent runs the assessment
   ['A','R','C','I','C','C'],   // Advance projects
   ['R','C','I','I','A','C'],   // Allocate budget – the CFO owns the outcome
   ['A','R','C','I','C','I'],   // Kill projects
   ['A','C','R','I','I','I'],   // Pipeline reporting – Harriet assembles it
   ['A','R','R','I','I','C'],   // Weekly session
   ['A','C','C','C','R','R']    // Quarterly review – finance runs the numbers
  ].forEach(function(row,ai){row.forEach(function(v,ci){if(v)data.raci[ai+':'+_pp[ci]]=v})})})();

  // ─── Phase 3: Prepare (post-rework bands) ───
  data.portfolio = {
    0: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Fast proof point; funds learning for the bigger bets.' },
    1: { horizon:'long',   risk:'high',   reward:'high',   notes:'Anchor bet; longest time-to-value in the portfolio.' },
    2: { horizon:'medium', risk:'medium', reward:'medium', notes:'Platform play; value compounds with later projects.' },
    4: { horizon:'quick',  risk:'medium', reward:'high',   notes:'Operational risk reduction with measurable downtime impact.' },
    11: { horizon:'medium', risk:'medium', reward:'high',  notes:'Solid sourcing economics; balances the vision bet.' },
    12: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Cheap quick win; keeps near-term value flowing.' },
    13: { horizon:'long',   risk:'high',   reward:'high',  notes:'Second anchor bet; quality economics justify the horizon.' }
  };
  var _psd=new Date(sd);_psd.setDate(1);var _psISO=_psd.toISOString().split('T')[0];
  data.capital = {
    aiBudget: '$2.4M',
    envYears: '3',
    budgetY2: '$2.6M',
    budgetY3: '$2.8M',
    periodStart: _psISO,
    susCap: '40',
    reserveY2: '$700K',
    reserveY3: '$700K',
    reallocation: '',
    gapPlan: '',
    fundLines: [
      {id:'fl1', d:'Reallocation \u2013 dormant document-classification project', a:'$250K', y:'1', proj:'', st:'planned'},
      {id:'fl2', d:'Reallocation \u2013 Q1 marketing reserve', a:'$150K', y:'1', proj:'', st:'planned'},
      {id:'fl3', d:'Additional budget request at the month-2 gate review \u2013 contingent on triage pilot results', a:'$300K', y:'1', proj:'AI-Assisted Customer Triage', st:'planned'}
    ]
  };
  data.capAlloc = {}; /* gateRows retired (July 5): gate criteria live on the
    program phases as exit criteria; release amounts had no engine effect. */

  // ─── 3.3: experiment briefs (live schema) ───
  data.budgetPlans = {
    0: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp0a',name:'Triage model & routing rules',desc:'Intent model and routing rules on ticket history',from:'1',to:'2',cost:'$110K',powner:'Vincent Lau',pmetric:'Shadow-mode routing accuracy',pexit:'Pilot routing accuracy \u2265 90% in shadow mode'},
               {id:'bp0b',name:'Agent-assist integration',desc:'Desk integration and agent-assist surfaces',from:'2',to:'3',cost:'$60K',powner:'Vincent Lau',pmetric:'Misroute rate on live queues',pexit:'Two queues live with misroute rate < 4%'} ],
         roll:[ {id:'bp0c',name:'Support-team rollout',desc:'Rollout across support teams',from:'3',to:'8',cost:'$50K'} ],
         sus:[ {id:'bp0d',name:'Ongoing operation',from:'9',to:'ongoing',items:[ {id:'bpi0a',name:'Model hosting & monitoring',cost:'$35K'}, {id:'bpi0b',name:'Content & routing upkeep',cost:'$25K'} ]} ] },
    11:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp11a',name:'Observation & design',desc:'Shadow two buyers through complete sourcing cycles on indirect categories. Capture where time is lost between RFQ request and award, document the pricing references buyers actually consult, and specify the copilot workflows against those failure points.',from:'1',to:'1',cost:'$15K',powner:'Harriet Rivers',pmetric:'A documented map of the current sourcing cycle with measured stage times for at least ten live RFQs, and a signed-off specification for the three copilot workflows.',pexit:'The procurement lead signs off the specification and the baseline cycle-time measurements that later phases will be judged against.'},
               {id:'bp11b',name:'Paper prototype',desc:'Mock the RFQ drafting flow and the bid comparison view on paper. Walk four buyers through real historical RFQs using the mocks, with no code built, and revise until the workflow matches how buyers actually evaluate bids.',from:'1',to:'2',cost:'$20K',powner:'Harriet Rivers',pmetric:'Four buyers complete a full mock sourcing cycle. Task-completion notes and a revision log are captured for every session.',pexit:'Buyers can complete the mock cycle without facilitator help, and no open workflow objections remain from the prototype group.'},
               {id:'bp11c',name:'Experiment',desc:'Build the working copilot on the ingested catalog and policy data. Run it in shadow mode against live RFQs, with the copilot drafting in parallel while buyers work normally, and compare its drafts and price references against what the buyers produced.',from:'2',to:'3',cost:'$95K',powner:'Arvind Nair',pmetric:'Draft acceptance rate and pricing-index coverage across at least 30 shadow RFQs. Target coverage of 80% of indirect spend, with drafts rated usable in two thirds of cases.',pexit:'Shadow results meet the coverage and usability targets, and the buyer panel agrees the drafts are safe to put in front of suppliers.'},
               {id:'bp11d',name:'Pilot',desc:'Run the copilot live in two indirect categories with the pilot buyer group. Measure sourcing cycle time against the phase-one baseline and track every case where a buyer overrides or corrects the copilot output.',from:'3',to:'4',cost:'$55K',powner:'Harriet Rivers',pmetric:'Cycle time on pilot categories versus baseline, override rate, and buyer satisfaction from structured debriefs. Target a 15% cycle-time reduction with overrides falling week on week.',pexit:'Assisted RFQs live in two categories with the cycle-time target met, and no unresolved data or policy incidents in the pilot log.'},
               {id:'bp11e',name:'Rollout preparation',desc:'Harden the service for the whole procurement team. Finish access controls and audit logging, write the training materials from real pilot cases, and agree the support handover with the platform team.',from:'4',to:'4',cost:'$20K',powner:'Tom\u00e1s Vega',pmetric:'A training pack tested with two buyers from outside the pilot, audit logging verified on every copilot action, and a signed support runbook.',pexit:'The operations review accepts the runbook and the rollout plan, clearing the project to enter the rollout step.'} ],
         roll:[ {id:'bp11c',name:'Procurement-team rollout',desc:'Rollout to the procurement team, including first-year running',from:'5',to:'18',cost:'$55K'} ],
         sus:[ {id:'bp11d',name:'Ongoing operation',from:'19',to:'ongoing',items:[ {id:'bpi11a',name:'Hosting & vendor-data upkeep',cost:'$40K'}, {id:'bpi11b',name:'Policy maintenance',cost:'$30K'} ]} ] },
    12:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp12a',name:'Coding model build',desc:'Coding model trained on historical invoices',from:'1',to:'2',cost:'$80K',powner:'Vincent Lau',pmetric:'Suggestion acceptance rate in shadow mode',pexit:'Suggestion acceptance \u2265 85% in shadow mode'} ],
         roll:[ {id:'bp12b',name:'Finance-team rollout',desc:'Finance-team rollout, including first-year running',from:'3',to:'15',cost:'$10K'} ],
         sus:[ {id:'bp12c',name:'Ongoing operation',from:'16',to:'ongoing',items:[ {id:'bpi12a',name:'Hosting & rules upkeep',cost:'$25K'} ]} ] },
    2: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'skg1',name:'Schema & graph model',from:'1',to:'1',cost:'$60K'},
               {id:'skg2',name:'Ingest & entity resolution',from:'2',to:'3',cost:'$120K'},
               {id:'skg3',name:'Rep sidebar UI',from:'3',to:'4',cost:'$70K'} ],
         roll:[ {id:'skg4',name:'Rollout to the sales team',from:'5',to:'7',cost:'$60K'} ],
         sus:[ {id:'skg5',name:'Run & refresh',from:'8',to:'ongoing',items:[ {id:'skg5a',name:'Graph DB & hosting',cost:'$50K'}, {id:'skg5b',name:'Refresh pipeline & data stewardship',cost:'$40K'} ]} ] },
    14:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'chn1',name:'Features & outcome labels',from:'1',to:'2',cost:'$70K'},
               {id:'chn2',name:'Model build & validation',from:'2',to:'3',cost:'$60K'},
               {id:'chn3',name:'CS pilot',from:'3',to:'4',cost:'$50K'} ],
         roll:[],
         sus:[ {id:'chn4',name:'Run & retrain',from:'5',to:'ongoing',items:[ {id:'chn4a',name:'Scoring pipeline & monitoring',cost:'$35K'}, {id:'chn4b',name:'Model retraining',cost:'$20K'} ]} ] },
    15:{ horizon:'3', contingency:'', notes:{},
         dev:[ {id:'lro1',name:'Data integration',from:'1',to:'2',cost:'$80K'},
               {id:'lro2',name:'Optimizer build',from:'2',to:'3',cost:'$90K'},
               {id:'lro3',name:'Depot pilot',from:'4',to:'5',cost:'$70K'} ],
         roll:[],
         sus:[ {id:'lro4',name:'Run & tune',from:'6',to:'ongoing',items:[ {id:'lro4a',name:'Solver hosting & tuning',cost:'$40K'}, {id:'lro4b',name:'Address-data upkeep',cost:'$25K'} ]} ] },
    16:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'fs1',name:'Retrieval index & prototype',from:'1',to:'2',cost:'$60K'},
               {id:'fs2',name:'Technician pilot build',from:'3',to:'4',cost:'$50K'},
               {id:'fs3',name:'Evaluation & hardening',from:'5',to:'5',cost:'$30K'} ],
         roll:[ {id:'fs4',name:'Field rollout \u2013 wave 1',from:'6',to:'8',cost:'$45K'},
                {id:'fs5',name:'Dealer network extension',from:'9',to:'11',cost:'$30K'} ],
         sus:[ {id:'fs6',name:'Run & refresh',from:'12',to:'ongoing',items:[ {id:'fs6a',name:'Hosting & retrieval stack',cost:'$18K'}, {id:'fs6b',name:'Manual refresh & evaluation',cost:'$12K'} ]} ] },
    1: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp1a',name:'Data audit & feasibility',desc:'Historical sales data quality, sources, and feasibility review',from:'1',to:'3',cost:'$120K',powner:'Harriet Rivers',pmetric:'Source-data coverage of the SKU range',pexit:'Data audit signed off \u2013 sources complete and usable'},
               {id:'bp1b',name:'Model build & validation',desc:'Forecast model development, backtesting, and accuracy validation',from:'3',to:'12',cost:'$460K',powner:'Harriet Rivers',pmetric:'Forecast lift on the 200 highest-variance SKUs',pexit:'Holdout evaluation shows forecast lift over baseline'},
               {id:'bp1c',name:'Extended backtesting',desc:'Second-season validation across the full product range',from:'13',to:'14',cost:'$100K',powner:'Harriet Rivers',pmetric:'Accuracy across the full product range',pexit:'Second-season backtest \u2265 baseline accuracy portfolio-wide'} ],
         roll:[ {id:'bp1d',name:'Planning integration & training',desc:'ERP integration and planner training',from:'15',to:'18',cost:'$170K'} ],
         sus:[ {id:'bp1e',name:'Ongoing operation',from:'19',to:'ongoing',items:[
               {id:'bpi1a',name:'Model & API usage',cost:'$90K'},{id:'bpi1b',name:'Data platform & pipelines',cost:'$60K'},{id:'bpi1c',name:'Forecast ops support',cost:'$30K'}]} ] },
    4: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp4a',name:'Site survey & sensor pilot',desc:'Line 1 sensor pilot and data capture',from:'1',to:'2',cost:'$40K'},
               {id:'bp4b',name:'Model build & validation',desc:'Failure-prediction models on pilot data',from:'2',to:'5',cost:'$110K'} ],
         roll:[ {id:'bp4c',name:'Line 1 instrumentation & launch',desc:'Sensors, gateways, and alerting on line 1',from:'5',to:'10',cost:'$180K'},
                {id:'bp4d',name:'Remaining lines rollout',desc:'Sensor coverage across all remaining production lines',from:'11',to:'14',cost:'$90K'} ],
         sus:[ {id:'bp4e',name:'Ongoing operation',from:'15',to:'ongoing',items:[
               {id:'bpi4a',name:'Sensor & gateway upkeep',cost:'$45K'},{id:'bpi4b',name:'Platform & alerting',cost:'$40K'},{id:'bpi4c',name:'Model tuning',cost:'$25K'}]} ] },
    13:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'bp13a',name:'Camera trials & data collection',desc:'Rig trials and a defect image library on line A',from:'1',to:'3',cost:'$50K',powner:'Harriet Rivers',pmetric:'Labeled defect-set completeness',pexit:'Camera install and labeled defect set complete'},
               {id:'bp13b',name:'Vision model development',desc:'Defect-detection model training and validation',from:'3',to:'9',cost:'$150K',powner:'Harriet Rivers',pmetric:'Defect detection rate on the pilot line',pexit:'Pilot detection \u2265 90% on line 2'} ],
         roll:[ {id:'bp13c',name:'Line A cameras & rigs',desc:'Production install and launch on line A',from:'10',to:'12',cost:'$120K'},
                {id:'bp13d',name:'Full line coverage',desc:'Cameras and rigs across the remaining assembly lines',from:'13',to:'16',cost:'$190K'} ],
         sus:[ {id:'bp13e',name:'Ongoing operation',from:'17',to:'ongoing',items:[
               {id:'bpi13a',name:'Camera & rig maintenance',cost:'$50K'},{id:'bpi13b',name:'Vision platform licenses',cost:'$55K'},{id:'bpi13c',name:'Model retraining',cost:'$35K'}]} ] }
  };
  data.experiments = {
    0: { budget:'$170K' },
    1: { budget:'$680K' },
    4: { budget:'$150K' },
    11: { budget:'$205K' },
    12: { budget:'$80K' },
    13: { budget:'$200K' }
  };
  data.expSelected = [0,1,4,11,12,13];

  // ─── Phase 4: Ignite — two launched, one running ───
  data.tracking = {
    0: { status:'complete', results:'Week 5: median handle time down 34% in both pilot queues; misroute rate 2.8%.', infraLearnings:'Budget release at Gate 1 took two days \u2013 gate process working.', breakWork:'Working: ownership model, weekly rhythm. Breaking: QA review queue at volume.' },
    1: { status:'complete', results:'Holdout forecast beat baseline by 19%; planner pilot adopted in two regions.', infraLearnings:'Feature-store gap cost three weeks; now budgeted as shared infrastructure.', breakWork:'Working: data partnership with supply chain. Breaking: cross-region change management.' },
    4: { status:'complete', results:'Week 7: 82% of failures detected at 48h lead; false-positive rate 6%. Fleet rollout approved.', infraLearnings:'Edge compute procurement slower than cloud \u2013 flag for governance.', breakWork:'Working: plant liaison model. Breaking: sensor coverage on line 4.' },
    11: { status:'running', results:'Week 4: pricing index covering 84% of indirect spend; assisted RFQs in first category.', infraLearnings:'Supplier master cleanup was the hidden cost \u2013 two weeks of analyst time.', breakWork:'Working: category-lead partnership. Breaking: legal review loop on RFQ templates.' },
    12: { status:'running', results:'Week 3: shadow-mode acceptance at 81% and climbing as the eval set grows.', infraLearnings:'Smallest experiment in the portfolio \u2013 proof that the pipeline handles low-cost bets.', breakWork:'Working: AP team engagement. Breaking: nothing significant.' },
    13: { status:'running', results:'Week 5: cameras live on the pilot line; labeling at 60% with two defect classes ahead of plan.', infraLearnings:'Camera procurement hit the same governance lag as edge compute \u2013 pattern for the review.', breakWork:'Working: plant quality partnership. Breaking: labeling vendor throughput.' }
  };
  data.launched = [0,1,4];
  data.opsData = {
    0: { health:'green', launchDate:new Date(sd.getTime()+86400000*52).toISOString().split('T')[0], performance:'Handle time steady at 65% of baseline; misroute rate 2.5% and falling.', notes:'Week 2 operational: added third queue; agent satisfaction up.' },
    1: { health:'amber', launchDate:new Date(sd.getTime()+86400000*63).toISOString().split('T')[0], performance:'Write-offs tracking \u221212% vs target \u221215%; two regions live.', notes:'Region 3 rollout paused pending data-quality fix on legacy SKUs.' },
    4: { health:'green', launchDate:new Date(sd.getTime()+86400000*66).toISOString().split('T')[0], performance:'Fleet rollout underway; detection holding at 80%+ across three lines.', notes:'Maintenance scheduling now consuming alerts directly; insurance review booked.' }
  };

  // ─── 4.2 / 4.3 ───
  data.governance = {
    meeting:'Monthly executive review', threshold:'$500k',
    metrics:'Learning velocity, capital efficiency, customer impact',
    format:'30-min gate review per active project',
    gateProcess:'Buy / Hold / Sell decision with sponsor sign-off',
    outsideAudit:'Quarterly \u2013 pipeline owner sweeps departmental spend and vendor contracts for AI work outside the pipeline', firstReview:'End of week 12',
    reviewAttendees:'CEO, CFO, CIO, Phase Owner, Innovation Council',
    reviewAgenda:'Portfolio health \u00b7 Capital \u00b7 Lessons \u00b7 Next bets'
  };
  data.stress = {
    decisions:'Mostly working; budget reallocation still a multi-week loop.', decisionsScore:4,
    ownership:'Central owner working well; one embedded lead overwhelmed.', ownershipScore:3,
    incentives:'Early signs in sales; manufacturing still on old metrics.', incentivesScore:3,
    culture:'Weekly rhythm helping; some "not my job" still showing up.', cultureScore:3,
    tuningList:['Add backup phase owner','Shorten budget loop to 1 week','Manufacturing OKR refresh','','']
  };

  // ─── Review (4.4) left open — the demo ends mid-first-review ───
  data.review = { /* 17 Sep 2026 (Paul's ruling): the first quarterly review, seeded \u2014 a decision with its reason on each of the nine live initiatives, and the five learnings */
    items:{
      0:{decision:'buy',rationale:'Handle time is down a third with agent adoption at 94%. Scale to the remaining queues and the outsourced desk.'},
      1:{decision:'hold',rationale:'The write-off rate is moving, but the forecast still overshoots on new products. Hold the footprint until the retrain lands and the amber clears.'},
      4:{decision:'buy',rationale:'Two of three lines covered and downtime avoided is ahead of plan. Extend to the third line and the finishing cells.'},
      11:{decision:'hold',rationale:'The paper prototype landed well, but the live experiment has not started. Hold at the current budget until phase 3 reports.'},
      12:{decision:'hold',rationale:'Acceptance at 88% against a target of 85% after four weeks. Hold at the current plan and complete the rollout phase before scaling.'},
      13:{decision:'hold',rationale:'Detection is ahead of target on the pilot line. Hold until the phase-2 gate next month; the case for scaling is already made.'},
      2:{decision:'hold',rationale:'The Go verdict stands, but the data-stewardship gap is not closed. Hold until the CRM owner is named.'},
      14:{decision:'buy',rationale:'The highest score in exploration and a quick win. Advance in the next batch.'},
      15:{decision:'sell',rationale:'The lowest score in the set, and the carrier data cannot be obtained this year. Release the slot.'}
    },
    newOpportunities:'1. AI-assisted inventory forecasting, raised by Operations after the demand model\u2019s write-off results.\n2. Contract-clause extraction for Legal, a natural extension of the document-classification work.',
    balance:'Heavy on quick wins in operation and medium-term bets in development; no long-term bet is live. The next batch should carry one.',
    worked:'The weekly rhythm survived the quarter. Gate reviews were taken on the day in five cases out of six.',
    didnt:'Budget reallocation between projects took three weeks each time. The Finance column on the RACI did not translate into a fast path.',
    nextCycle:'A mid-quarter reallocation window. A deputy for gate reviews when the owner travels. The Legal opportunity scoped before the next review.'
  };
  if(!data.tracking[15])data.tracking[15]={};data.tracking[15].status='killed'; /* the Sell kills it, as the step does */
  data.reviewCycles = []; // seed order-independence: the Y2 seed writes cycle history; base must clear it (July 8)
  data.notifications = []; data.remind7 = {}; data.archivedItems = {}; data.chatMsgs = []; // "overwrites any existing entries" made literally true (Paul's ruling, July 8): runtime keys the builder never assigned used to survive a re-seed

  // ─── Completion state ───
  data.completedSections = { '1.1':true,'1.2':true,'1.3':true,'1.4':true,'1.5':true };
  data.completedSteps = { '1.1':true,'1.2':true,'1.3':true,'2.1':true,'2.2':true,'2.3':true,'2.4':true,'3.1':true,'3.2':true,'3.3':true,'3.4':true,'4.1':true,'4.2':true,'4.3':true,'4.4':true } /* 17 Sep 2026 (Paul's ruling): Phase 4 complete in the seed */;
  // ─── Module Management seed: completion history, roster, assignments, deadlines (July 5) ───
  var _dISO=function(dd){var t=new Date(sd);t.setDate(t.getDate()+dd);return t.toISOString().split('T')[0]};
  data.stepDoneAt = { '1.1':_dISO(8),'1.2':_dISO(13),'1.3':_dISO(18),'2.1':_dISO(26),'2.2':_dISO(31),'2.3':_dISO(34),'2.4':_dISO(39),'3.1':_dISO(47),'3.2':_dISO(53),'3.3':_dISO(59),'3.4':_dISO(64),'4.1':_dISO(68) };
  data.stepDue = { '4.2':_dISO(76), '4.3':_dISO(80), '4.4':_dISO(88) };
  var _seedRoster=[
    {id:'su1',name:'Vincent Lau',username:'vlau',role:'Head of Customer Operations',initials:'VL',color:'#1B6B5A',scope:'All'},
    {id:'su2',name:'Harriet Rivers',username:'hrivers',role:'Operational Excellence Lead',initials:'HR',color:'#2D5A8E',scope:'All'},
    {id:'su3',name:'Arvind Nair',username:'anair',role:'Chief Technology Officer',initials:'AN',color:'#8B5E3C',scope:'All'},
    {id:'su4',name:'Tom\u00e1s Vega',username:'tvega',role:'Finance Director',initials:'TV',color:'#9B2D3F',scope:'All'},
    {id:'su5',name:'Ray Caruso',username:'rcaruso',role:'Plant Manager',initials:'RC',color:'#6B4C8A',scope:'All'},
    {id:'su6',name:'Anders Lindqvist',username:'alindqvist',role:'Head of Sales',initials:'AL',color:'#C25B73',scope:'All'},
    {id:'su7',name:'Glen Hodges',username:'ghodges',role:'Data & Analytics Lead',initials:'GH',color:'#4FB39A',scope:'All'},
    {id:'su8',name:'Duncan Fairley',username:'dfairley',role:'HR Director',initials:'DF',color:'#D4A017',scope:'All'}
  ];
  data.chatMsgs=[
    {who:'VL',name:'Vincent Lau',ts:'8:52 AM',text:'Morning all. Phase 4 is underway and the tracker is current. Governance setup is the next milestone, due on the 11th.'},
    {who:'AN',name:'Arvind Nair',ts:'9:03 AM',text:'Shadow-mode numbers for the sourcing copilot land tomorrow. Coverage of indirect spend looks strong and draft acceptance is tracking just under the two-thirds target.'},
    {who:'TV',name:'Tom\u00e1s Vega',ts:'9:10 AM',text:'Reminder that the $300K request for AI-Assisted Customer Triage is still a planned funding line. I need the gate evidence before it goes to the capital group.'},
    {who:'GH',name:'Glen Hodges',ts:'9:18 AM',text:'Draft decision-rights matrix for the governance step is with Arvind for review. I will bring the data-access sections to the working session.'},
    {who:'RC',name:'Ray Caruso',ts:'9:26 AM',text:'Floor walk for the stress-test is booked for next week. I will have the line supervisors join the org design session.'},
    {who:'DF',name:'Duncan Fairley',ts:'9:34 AM',text:'Portfolio review is on the calendar for day 88. Send me kill and continue recommendations a week ahead so the panel has time to read them.'}
  ];
  /* seed reset rule (July 9, extends the July 8 literal-overwrite ruling): F3 returns the roster to
     the org's admin account(s) plus a fresh su1-su8. Renames, extra members, and email edits from a
     testing session do not survive a reseed. Admin accounts survive because the signed-in user is one. */
  var _keepAdmins=(Array.isArray(data.roster)?data.roster:[]).filter(function(x){return x&&x.admin===true});
  data.roster=_keepAdmins.concat(JSON.parse(JSON.stringify(_seedRoster)));
  data.assigns = { '1.1':['su3','su8'],'1.2':['su1','su7'],'1.3':['su1'],'2.1':['su8'],'2.2':['su8','su4'],'2.3':['su2'],'2.4':['su3'],'3.1':['su1','su2'],'3.2':['su4'],'3.3':['su4','su3'],'3.4':['su1','su2'],'4.1':['su2'],'4.2':['su3','su7'],'4.3':['su8'],'4.4':['su4','su1'] };
  applyTeamRoster();

  // ─── Notes (live schema: id / createdAt / step) ───
  data.notes = [
    { id:'sn1', createdAt:Date.now()-172800000, step:'4.1', text:'Arvind to circulate the shadow-mode results before the experiment gate on the sourcing copilot.' },
    { id:'sn2', createdAt:Date.now()-86400000, step:'3.3', text:'Tom\u00e1s needs month-two gate evidence before the $300K triage funding line goes to the capital group.' },
    { id:'sn3', createdAt:Date.now()-3600000, step:'4.4', text:'Book the portfolio review for the week of day 88 and circulate the agenda in advance.' }
  ];

  // ─── Assignments seeded above (su1–su8 live in the roster); keep only real roster ids, never ghosts ───
  var rIds=(data.roster||[]).map(function(u){return u.id});
  Object.keys(data.assigns||{}).forEach(function(sk){ data.assigns[sk]=(data.assigns[sk]||[]).filter(function(x){return rIds.indexOf(x)>=0}); });
}

function seedData(){
  if(!confirm('Load sample data? This overwrites any existing entries.')) return;
  // Day ~70 of 90 — experiments running, first launches operational
  var sd = new Date();
  sd.setDate(sd.getDate() - 70);
  buildSeedBase(sd);
  saveData();
  render();
}

function seedDataY2(){
  if(!confirm('Load the Year 2 sample? This overwrites any existing entries.')) return;

  // Same portfolio geometry as the base seed, shifted 19 calendar months back:
  // "today" lands late in envelope year 2 (month 22–23 of the 36-month window). (Paul, July 8)
  var sd = new Date();
  sd.setDate(sd.getDate() - 70);
  sd.setMonth(sd.getMonth() - 19);
  buildSeedBase(sd);

  var _dISO=function(dd){var t=new Date(sd);t.setDate(t.getDate()+dd);return t.toISOString().split('T')[0]};
  var _mTs=function(mm,dd){var t=new Date(sd);t.setDate(1);t.setMonth(t.getMonth()+(mm-1));t.setDate(dd||10);return t.getTime()}; // envelope month mm (from periodStart) → timestamp
  var _mISO=function(mm,dd){return new Date(_mTs(mm,dd)).toISOString().split('T')[0]};

  // ─── The 90-day program finished on schedule ───
  data.completedSteps['4.2']=true; data.completedSteps['4.3']=true; data.completedSteps['4.4']=true;
  data.stepDoneAt['4.2']=_dISO(76); data.stepDoneAt['4.3']=_dISO(80); data.stepDoneAt['4.4']=_dISO(88);

  // ─── Quality Inspection Vision (13): track complete, launched by the month-16 review ───
  data.budgetPlans[13].dev[0].pstatus='complete'; data.budgetPlans[13].dev[0].gateDec='go'; data.budgetPlans[13].dev[0].gateAt=_mTs(6,5);
  data.budgetPlans[13].dev[1].pstatus='complete'; data.budgetPlans[13].dev[1].gateDec='go'; data.budgetPlans[13].dev[1].gateAt=_mTs(12,5);
  data.tracking[13].status='complete';
  data.tracking[13].results='Development complete at month 11. Detection reached 87% of inspector-found flaws on the pilot line with a 4% false-positive rate. The quarterly review approved the launch.';
  data.launched.push(13);
  data.opsData[13]={ health:'green', launchDate:_mISO(16,20),
    launchConfirm:{at:_mTs(16,20),by:'',note:'Launched by quarterly review decision'},
    performance:'Live on six lines since launch at month 16. Detection is holding at 85% of inspector-found flaws with false positives under 5%.',
    notes:'Rollout to the remaining floor is scheduled inside the committed rollout budget.' };

  // ─── Procurement Copilot (11): start deferred to month 19, now mid-track ───
  data.projects[11].startDate=_mISO(19,5); // anchorMonth reads startDate first – exercises Start Date Drift
  data.budgetPlans[11].dev[0].pstatus='complete'; data.budgetPlans[11].dev[0].gateDec='go'; data.budgetPlans[11].dev[0].gateAt=_mTs(20,5);
  data.budgetPlans[11].dev[1].pstatus='complete'; data.budgetPlans[11].dev[1].gateDec='go'; data.budgetPlans[11].dev[1].gateAt=_mTs(21,5);
  data.budgetPlans[11].dev[2].pstatus='running';
  data.tracking[11].results='Start deferred to month 19 while year-one capacity cleared. The observation and paper prototype phases are complete and both gates passed. The shadow-mode experiment is running against live RFQs.';

  // ─── Invoice Coding Copilot (12): killed at its first gate ───
  data.budgetPlans[12].dev[0].pstatus='complete'; data.budgetPlans[12].dev[0].gateDec='kill'; data.budgetPlans[12].dev[0].gateAt=_mTs(5,10);
  data.tracking[12].status='killed';
  data.tracking[12].killSunkIds=['bp12a'];
  data.tracking[12].results='Killed at the first gate. Shadow-mode acceptance plateaued at 61% against an 85% exit bar, and error analysis showed the invoice history was too inconsistent to train on. A $15K contractor exit was recorded in the kill & phase-out pot.';
  if(!data.capital.killRows)data.capital.killRows=[];
  data.capital.killRows.push({d:'Contractor exit – Invoice Coding Copilot', a:'$15K'});

  // ─── Churn Early-Warning Model (14): advanced by the month-16 review against the year-2 reserve ───
  data.expSelected.push(14);
  data.projects[14].advancedAt=_mTs(16,20);
  data.portfolio[14]={horizon:'medium',risk:'medium',reward:'high',notes:'Revenue protection with fast time-to-value. Funded from the year-two intake reserve.'};
  data.budgetPlans[14]={ horizon:'2', contingency:'10', notes:{},
    dev:[ {id:'bp14a',name:'Feature & label build',desc:'Rebuild the outcome label set from CRM close reasons and assemble the churn feature base',from:'1',to:'2',cost:'$60K',powner:'Dana Whitfield',pmetric:'Label coverage on the last two years of accounts',pexit:'Usable outcome labels on \u2265 90% of accounts closed since 2024'},
          {id:'bp14b',name:'Model & scoring pilot',desc:'Train the churn model and run weekly scoring with the customer success pilot group',from:'2',to:'4',cost:'$120K',powner:'Dana Whitfield',pmetric:'30-day detection rate on a holdout set',pexit:'\u2265 70% of churning accounts flagged 30 days out on holdout'} ],
    roll:[ {id:'bp14c',name:'CS playbook rollout',desc:'Score every account weekly and wire playbook triggers into the CRM for the full CS team',from:'5',to:'8',cost:'$40K'} ],
    sus:[ {id:'bp14d',name:'Ongoing operation',from:'9',to:'ongoing',items:[ {id:'bpi14a',name:'Model monitoring & retraining',cost:'$35K'}, {id:'bpi14b',name:'CRM integration upkeep',cost:'$20K'} ]} ] };
  data.tracking[14]={ status:'running',
    results:'Advanced by the quarterly review at month 16 and funded against the year-two intake reserve. The feature and label build is complete. The scoring pilot is running with the customer success team.',
    infraLearnings:'Outcome labels before 2024 proved unusable. The team rebuilt the label set from CRM close reasons.',
    breakWork:'Working: reserve-funded intake through the review. Watch: alert fatigue in the pilot group.' };

  // ─── One closed review cycle (month 16) ───
  data.reviewCycles=[{at:_mTs(16,20),review:{
    items:{0:{decision:'hold'},1:{decision:'hold'},4:{decision:'hold'},11:{decision:'hold'},13:{decision:'buy'},14:{decision:'buy'}},
    newOpportunities:'1. Warranty claim photos are a natural extension of the vision platform\n2. Churn scores could feed the quote configurator concept',
    balance:'Two anchor bets are now operational. The portfolio needs one more quick win to keep near-term value flowing after the invoice copilot kill.',
    worked:'Deferring the procurement copilot start protected year-one capacity. The triage results unlocked the contingent budget request, and all three funding plan lines were authorized during year one.',
    didnt:'Invoice history quality was knowable before the first phase began. A short data audit before funding would have caught it.',
    nextCycle:'Decide whether the churn pilot earns its rollout phase. Grade the quote configurator for a possible advance.'
  }}];
  data.review={items:{}};

  // ─── Capital: the year-one funding plan was executed – all three lines authorized ───
  data.capital.fundLines.forEach(function(r){r.st='auth'});
  data.capital.susCap='18'; // tightened for the Year 2 seed (Paul's ruling, July 8). Hand-derived: year-3 sustainment 545K = 19.5% of the 2.8M envelope, so 18% breaches year 3 and leaves year 2 (10.3%) clean

  // ─── Intake since the program ended: new ideas at every funnel stage ───
  data.ideas.push(
    {name:'Quote Configurator Copilot', desc:'Draft complex window configurations and quotes from dealer requests, priced against current glass and hardware costs.', strategic:'Friction: quote turnaround for custom configurations', cost:'Medium ($120-200K)', outcome:'Best: same-day quotes on 80% of custom requests. Worst: mispriced configurations erode dealer trust.', capabilities:'Product configurator data, pricing rules, LLM drafting.', risk:'Mispriced edge-case configurations. Pricing rules drift as costs move.', dept:'Sales', when:'now', timeframe:'3-6 months'},
    {name:'Warranty Claim Vision', desc:'Assess warranty claims from installer and homeowner photos, classifying failure type and routing to repair or replace.', strategic:'Friction: warranty claim cycle time', cost:'Medium ($100-180K)', outcome:'Best: two-thirds of claims resolved without a site visit. Worst: wrong repair calls create repeat visits.', capabilities:'Vision platform from quality inspection, claims history, photo intake flow.', risk:'Photo quality from the field. Liability on wrong replace decisions.', dept:'Customer Ops', when:'now', timeframe:'3-6 months'},
    {name:'Glass Cutting Yield Optimizer', desc:'Optimize cutting plans across orders to raise sheet yield and cut offcut waste.', strategic:'Cost: glass waste in cutting operations', cost:'High ($200-400K)', outcome:'Best: three to five points of yield improvement across plants. Worst: optimizer plans that operators override daily.', capabilities:'Cutting plan data, order flow integration, optimization engine.', risk:'Operator trust. Integration with legacy cutting software.', dept:'Manufacturing', when:'future', timeframe:'6-12 months'},
    {name:'Installer Scheduling Assistant', desc:'Schedule installation crews against job complexity, travel time, and weather windows.', strategic:'Friction: installation backlog and travel waste', cost:'Medium ($80-150K)', outcome:'Best: 15% more installs per crew-week. Worst: schedules that crews ignore.', capabilities:'Job and crew data, routing, weather feeds.', risk:'Crew adoption. Edge cases in job complexity.', dept:'Field Ops', when:'future', timeframe:'3-6 months'},
    {name:'Thermal Performance Advisor', desc:'Answer dealer and homeowner questions on thermal performance and compliance from product specification data.', strategic:'Friction: technical pre-sales load on engineering', cost:'Low ($40-80K)', outcome:'Best: engineering pre-sales queries cut by half. Worst: wrong compliance answers reach customers.', capabilities:'Product spec corpus, compliance documents, retrieval.', risk:'Compliance liability on wrong answers.', dept:'Product', when:'future', timeframe:'1-3 months'}
  );
  // Quote Configurator Copilot (20): selected, fully assessed, graded – a candidate for the next intake decision
  data.selected.push(20);
  data.projects[20]={ startupCost:'$160K', runningCost:'$45K', viable:true, assessed:true,
    objectives:'Cut median quote turnaround for custom configurations from four days to one.',
    deliverables:'Configurator-integrated drafting assistant and a priced-quote review queue.',
    timeline:'Rules ingestion 4 weeks, drafting pilot 6 weeks, dealer trial 6 weeks.',
    resources:'1 pricing analyst, 1 engineer, $160K.',
    risks:'Pricing rule drift. Dealer trust if early quotes misprice.',
    metrics:'Quote turnaround time. Manual correction rate on drafts.',
    gap:{ skillsH:'Deep pricing rule knowledge', skillsN:'LLM drafting patterns', resourcesH:'Complete configurator data', resourcesN:'Labeled quote corrections', technologyH:'Configurator platform', technologyN:'Drafting integration layer' },
    swot:{ strengths:'Direct revenue cycle impact.', weaknesses:'Pricing rules change quarterly.', opportunities:'Feeds the dealer portal roadmap.', threats:'Dealer workarounds if drafts lag.' },
    partInt:'Sales operations leadership.', partExt:'Configurator platform vendor.' };
  data.portfolio[20]={horizon:'medium',risk:'medium',reward:'high',notes:'Strong quick-cycle revenue case. Candidate for the next intake decision.'};
  // Warranty Claim Vision (21): selected, assessment in progress
  data.selected.push(21);
  data.projects[21]={ assessed:false,
    objectives:'Resolve the majority of warranty claims from photos without a site visit.',
    deliverables:'Photo intake flow, failure-type classifier, and a repair-or-replace routing queue.' };

  saveData();
  render();
}

// Init

/* ═══ BOOT (async loader, July 8) ═══
   The whole boot sequence now runs inside bootApp(), driven by
   Store.ready(). Locally ready() fires in the same tick, so nothing
   about startup changes. On a server build the loading shell below
   holds the app node while Store warms its cache, then bootApp()
   runs against warm data. bootApp() is guarded: a second call is a
   no-op, so a late or duplicate ready signal cannot double-bind
   listeners or re-run migrations. */
/* -- SAMPLE ORGANIZATION (Part 3, 2 Oct 2026): a private copy of the built-in sample in each person's browser, opened from Demo
   in a new tab. It is kept only in this browser (key pipeline-org-data::org_sample_local), is not in the organization list, and
   the tab makes no request to any server: no saves elsewhere, no change polling, no locks, no email. -- */
var SAMPLE_REFUSED = false; /* a sample tab opened without a signed-in tab shows only A.3.6 */
var SAMPLE_NOTE_TEXT = 'Sample organization: your changes stay in this browser only';
function isSampleTab(){ try{ return /[?&]sample=1(&|$)/.test(location.search); }catch(e){ return false; } }
function openSampleTab(){
  if(!currentUserId || SAMPLE_MODE) return;
  try{ localStorage.setItem('sample-tab-pass', JSON.stringify({t: Date.now()})); }catch(e){}
  window.open(location.pathname + '?sample=1', '_blank');
}
/* The pass works once and for two minutes; a page opened from a file:// address cannot read its opener, so the pass is the dependable route. */
function sampleTabAccepted(){
  var ok=false;
  try{ var p=JSON.parse(localStorage.getItem('sample-tab-pass')||'null'); var age=p&&typeof p.t==='number'?Date.now()-p.t:-1; if(age>=0 && age<120000) ok=true; }catch(e){}
  try{ localStorage.removeItem('sample-tab-pass'); }catch(e){}
  if(!ok){ try{ var o=window.opener; if(o && o!==window && o.currentUserId && !o.SAMPLE_MODE) ok=true; }catch(e){} }
  return ok;
}
/* The copy: created from seedData (its confirmation suppressed) when empty or when started again; AI off; no passwords; the first sample person signed in. */
function prepareSampleData(fresh){
  if(fresh || !data || !Array.isArray(data.roster) || !data.roster.length){
    data=emptyData(); USERS.length=0;
    var _c=window.confirm; window.confirm=function(){ return true; };
    try{ seedData(); } finally { window.confirm=_c; }
  }
  data.settings={aiGuide:false,voice:false};
  applyTeamRoster();
  saveData();
  Auth.setSession((USERS[0]&&USERS[0].id)||null);
  UI.entry=null;
}
function startSampleTab(){
  SAMPLE_MODE=true; isAppAdmin=false;
  if(!sampleTabAccepted()){ SAMPLE_REFUSED=true; render(); return true; }
  currentOrgId=SAMPLE_LOCAL_ID; /* this tab's memory only: never setCurrentOrg, which stores the pointer the person's own tab uses */
  loadData();
  prepareSampleData(false);
  watchSampleNote();
  render();
  return true;
}
function restartSample(){
  if(!SAMPLE_MODE || SAMPLE_REFUSED) return;
  if(!confirm('Start the sample again? Your changes in this tab are replaced with the original sample.')) return;
  try{ closeModal(); }catch(e){}
  prepareSampleData(true);
  currentPage='home'; currentStep=null; currentPhase=null;
  render();
}
function closeSample(){
  if(!SAMPLE_MODE) return;
  try{ window.close(); }catch(e){}
  setTimeout(function(){ try{ if(!window.closed) location.replace(location.pathname); }catch(e){} }, 300);
}
/* The red note: the first line inside the page's content container, directly above the Back button; never above that container, where the top bar would hide it. */
function sampleNoteHost(){
  var a=document.getElementById('app'); if(!a) return null;
  return a.querySelector('.content-inner') || a.querySelector('.hero-left') || a.querySelector('.pt-100 > .wrap') || a.querySelector('.u-70c6b34 > .u-4f90335') || null; /* family pages · Home · Learn · Insights */
}
function ensureSampleNote(){
  if(!SAMPLE_MODE || SAMPLE_REFUSED || !currentUserId) return;
  var host=sampleNoteHost(); if(!host) return;
  var n=document.getElementById('sampleNote');
  if(n && n.parentNode===host && host.firstElementChild===n) return;
  if(n && n.parentNode) n.parentNode.removeChild(n);
  n=document.createElement('div'); n.id='sampleNote'; n.className='sample-note'; n.setAttribute('role','note'); n.textContent=SAMPLE_NOTE_TEXT;
  host.insertBefore(n, host.firstChild);
  /* Sweep 4R item 9 (addendum 5 Oct 2026): the note never sits under the top bar; on Home (no content container) it steps down below the bar's measured bottom */
  try{ var nav=document.querySelector('nav'), nb=nav?nav.getBoundingClientRect().bottom:0, top=n.getBoundingClientRect().top+(window.pageYOffset||0); if(nb && top<nb+8) n.style.marginTop=Math.ceil(nb+8-top)+'px'; }catch(e){}
}
var _sampleObserver=null;
function watchSampleNote(){ /* pages drawn a moment after the rest (the screen loader) */
  if(_sampleObserver || typeof MutationObserver==='undefined') return;
  var a=document.getElementById('app'); if(!a) return;
  _sampleObserver=new MutationObserver(function(){ try{ ensureSampleNote(); }catch(e){} });
  _sampleObserver.observe(a,{childList:true,subtree:true});
}
/* The start-up answer: a signed-in member or administrator goes straight back in, without the seal. A session that still
   has to choose a new password signs out: the password it replaces is needed, so the person signs in again. */
function resumeSession(res){
  if(res && res.ok && res.mustChange){ Auth.signOut(); res=null; }
  if(res && res.ok && res.admin){
    Auth.setAdminSession(true);
    var orgs=getOrgs(), target=(currentOrgId&&getOrg(currentOrgId))?currentOrgId:(orgs[0]&&orgs[0].id);
    if(target){ setCurrentOrg(target); loadData(); applyTeamRoster(); Auth.setSession((USERS[0]&&USERS[0].id)||null); }
    UI.entry=currentUserId?null:{step:'admin'}; render(); return;
  }
  if(res && res.ok && res.orgId && getOrg(res.orgId)){
    setCurrentOrg(res.orgId); loadData(); applyTeamRoster();
    if(USERS.some(function(u){return u.id===res.userId;})){ Auth.setSession(res.userId); UI.entry=null; render(); return; }
  }
  if(UI.entry && UI.entry.step==='checking'){ UI.entry={step:'login'}; render(); }
}
var _bootDone=false;
function bootApp(){
  if(_bootDone) return false;
  _bootDone=true;
  if(isSampleTab()) return startSampleTab(); /* Part 3: a sample tab never reads the person's stored pointers */
  currentOrgId=Store.getCurrentOrg();
  migrateLegacyData();
  if(currentOrgId && !getOrg(currentOrgId)) setCurrentOrg(null);
  /* 5.4.5: start-up asks the server whether this browser is signed in. The ids stored by Store.setRemember no longer sign
     anyone in. Never sealSession or switchToOrg here (S.4): a reload is not a change of organization or user. */
  if(currentOrgId){ loadData(); applyTeamRoster(); } else { data=emptyData(); USERS.length=0; }
  Auth.setSession(null); UI.entry={step:'checking'};
  try{ Store.setRemember(null); Store.raw.del('pipeline-admin'); }catch(e){} /* no ids that sign anyone in, and no administrator code, are kept in the browser */
  Auth.currentSession(resumeSession);
  try{ Store.startChangeSignal(); }catch(e){} // multi-user change signal: storage events + polling (July 8)
  (function(){var fy=document.getElementById('footerYear');if(fy)fy.textContent=new Date().getFullYear();})();
  // Mobile: collapse sidebar by default
  if(window.matchMedia&&window.matchMedia('(max-width:960px)').matches){sidebarOpen=false;}
  render();
  // Re-evaluate sidebar on resize
  window.addEventListener('resize',function(){
    if(window.matchMedia('(max-width:960px)').matches){
      if(sidebarOpen){sidebarOpen=false;if(typeof updateSidebarState==='function')updateSidebarState();}
    }
  });
  return true;
}
Store.ready(bootApp);
if(!_bootDone){
  // Server mode only: hold the app node while the cache warms. Never
  // visible locally – the synchronous path has already booted by here.
  try{
    var _bootEl=document.getElementById('app');
    if(_bootEl) _bootEl.innerHTML='<div style="padding:140px 24px;text-align:center;font-size:15px;opacity:.7">Loading your workspace…</div>';
  }catch(e){}
}

function renderStepContent(id){var h=renderStepContentBody(id);return isPhase5Step(id)?printBar()+h:h} /* 12 Sep 2026 (Paul's ruling): the print option on every Phase 5 page */

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px">'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px')+'</div>'}
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
/* ══ THE REPORTING ENGINE AND THE PAPER HELPERS — byte-exact from Executive Readiness (the family form; Governance's engine as ER carries it), ported to the Innovation Pipeline 16 Sep 2026 on Paul's ruling ══ */
/* ═══ REPORTING ENGINE (family code, copied from the Governance build 14 Sep 2026; Spec Rev A). Layered records: each record type declares a layer map; every layer has a summary and a full rendering; a layer is live when it has content and no later superseding layer does; renderings are additive; a register prints identity plus the summary of every live layer up to its own phase; each record ends with a missing-layers line. Output side only. ═══ */
var LAYER_MAPS={};
function lyCap(t){t=String(t);if(!t||/^(https?:\/\/|www\.)/.test(t)||t.indexOf('@')>=0||/^[a-z]+-[a-z0-9-]*\d/.test(t))return t;return t.charAt(0).toUpperCase()+t.slice(1)} /* 13 Sep 2026 (Paul's ruling): a printed value begins with a capital, unless it is a URL, an email, or an id */
function lyDate(v){var d=(typeof v==='number')?new Date(v):new Date(String(v));return isNaN(d)?String(v||''):d.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
function lyText(v){ /* any value to plain text */
  if(v==null)return '';if(Array.isArray(v))return v.map(lyText).filter(Boolean).join('; ');
  if(typeof v==='object')return Object.keys(v).map(function(k){return v[k]}).map(lyText).filter(Boolean).join('; ');
  return String(v).trim()}
function lyLive(map,rec,upto){ /* the live layers, in stage order, up to and including layer index upto (all when upto is null) */
  var present=map.layers.map(function(l){try{return !!l.present(rec)}catch(e){return false}});
  return map.layers.filter(function(l,i){if(upto!=null&&i>upto)return false;if(!present[i])return false;
    return !map.layers.some(function(m,j){return m.supersedes===l.id&&present[j]})})}
function lyMissing(map,rec,upto){ /* one sentence per required-but-absent or incomplete layer */
  var out=[];map.layers.forEach(function(l,i){if(upto!=null&&i>upto)return;if(!l.required)return;var req=false;try{req=!!l.required(rec)}catch(e){}
    if(!req)return;var pres=false;try{pres=!!l.present(rec)}catch(e){}
    if(!pres){out.push(l.missing||('No '+l.title.toLowerCase()+' recorded.'));return}
    if(l.complete){var c=null;try{c=l.complete(rec)}catch(e){}if(typeof c==='string'&&c)out.push(c)}});return out}
function lyRow(label,value,indent){var t=lyCap(lyText(value));return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
function lyList(label,items,fmt){ /* a list field: one row per item, the label on the first; a formatter may return lines separated by <br>, which print as lines */
  if(!items||!items.length)return lyRow(label,'');var h='';items.forEach(function(it,i){var v=fmt?fmt(it,i):it;h+=lyRowHtml(i===0?label:'',v,i>0)});return h}
function lyRowHtml(label,value,indent){var t=(typeof value==='string')?value:lyText(value);var parts=t.split('<br>').map(function(x){return esc(lyCap(x))});return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?parts.join('<br>'):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
function lyRender(type,rec,depth,upto,caption,lead){ /* the record as a table: an optional caption (the group header, which the browser keeps with the table's first page), the identity in the header row (repeats when the block splits), then each live layer's fields, then the missing-layers line. A record short enough to fit a page is unsplittable; a long one starts on a fresh page, flows and splits between rows, and ends with a wider gap. */
  var map=LAYER_MAPS[type];if(!map||!rec)return '';var full=(depth==='full');
  var idr=map.identity(rec);var title=esc(idr.title||'');var meta=(idr.meta||[]).filter(Boolean).map(esc).join(' \u00b7 ');
  var body='';var rowCount=0;  var live=lyLive(map,rec,upto);
  var rowsOf=function(l,all){var rows='';l.fields.forEach(function(f){if(!all&&!f.summary)return;var v=null;try{v=f.get(rec)}catch(e){}
      if(f.list)rows+=lyList(f.label,v,f.fmt);else rows+=lyRow(f.label,f.fmt?f.fmt(v):v)});return rows};
  var leadL=lead?live.filter(function(l){return l.id===lead})[0]:null; /* 14 Sep 2026 (Paul's ruling, the Emergency Response portfolio): the named layer leads the record, every field of it, in a box; the other layers follow as context */
  if(leadL){live=live.filter(function(l){return l!==leadL});var lr=rowsOf(leadL,true);
    body+='<tr><td colspan="2" style="padding:8px 10px 12px"><div class="ly-lead" style="border:2px solid #9B2D3F;border-radius:6px;padding:8px 10px 2px"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9B2D3F;padding:0 0 6px;margin:0 0 2px;border-bottom:1px solid #9B2D3F">'+esc(leadL.title)+'</div><table style="width:100%;border-collapse:collapse">'+lr+'</table></div></td></tr>';rowCount+=1+(lr.match(/<tr>/g)||[]).length}
  live.forEach(function(l){var rows=rowsOf(l,full);
    if(rows){body+='<tr><td colspan="2" style="padding:9px 10px 3px;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+esc(l.title)+'</td></tr>'+rows;rowCount+=1+(rows.match(/<tr>/g)||[]).length}});
  var miss=lyMissing(map,rec,upto);
  if(miss.length){body+='<tr><td colspan="2" style="padding:7px 10px;font-size:12px;color:#8B3A1E">'+miss.map(function(m){return '\u25b8 '+esc(m)}).join('<br>')+'</td></tr>';rowCount++}
  var LONG=16; /* about a page of rows: beyond this the record flows and splits between rows rather than being forced to a fresh page */
  var h='<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;'+(rowCount>LONG?'break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;margin-bottom:40px':'break-inside:avoid;page-break-inside:avoid')+'">'+(caption?'<caption style="caption-side:top;text-align:left;padding:0">'+caption+'</caption>':'')+'<thead><tr><th colspan="2" style="text-align:left;padding:8px 10px;border-bottom:2px solid #111;background:#fff"><div style="font-size:14px;font-weight:700;color:#111">'+title+(idr.score?'<span style="float:right;font-weight:700">'+esc(idr.score)+'</span>':'')+'</div>'+(meta?'<div style="font-size:11px;color:#666;font-weight:400;margin-top:2px">'+meta+'</div>':'')+'</th></tr></thead><tbody>'+body;
  return h+'</tbody></table>'}
function lyRegister(type,records,depth,upto,groups,onePerPage,lead){ /* a register document body: optional groups of records, each rendered. The group header is the largest, heaviest thing on the page, and it is the first record's table caption, so the browser keeps it with that record's first page whether the record is short or long */
  var h='';var gi=-1;(groups||[{name:'',list:records}]).filter(function(g){return g.list.length}).forEach(function(g){gi++;
    var head=g.name?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">'+esc(g.name)+' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+g.list.length+'</span></div>':'';
    g.list.forEach(function(r,i){var blk=lyRender(type,r,depth,upto,(i===0&&head)?head:'',lead);h+=(onePerPage&&!(gi===0&&i===0))?'<div style="break-before:page;page-break-before:always">'+blk+'</div>':blk})});
  return h||'<div style="font-size:13px;color:#666;font-style:italic;padding:8px 0">Nothing on this register.</div>'}
function lyGaps(type,records,upto){var out=[];var map=LAYER_MAPS[type];if(!map)return out;records.forEach(function(r){var m=lyMissing(map,r,upto);if(m.length)out.push({title:map.identity(r).title,lines:m})});return out}
function lyScreenRegister(type,records,depth,upto,groups){var h=lyRegister(type,records,depth,upto,groups);return '<div class="ly-screen" style="font-size:13px">'+h.replace(/color:#111/g,'color:var(--paper)').replace(/color:#555/g,'color:var(--text-muted)').replace(/color:#333/g,'color:var(--text-muted)').replace(/color:#666/g,'color:var(--text-faint)').replace(/background:#fff/g,'background:transparent').replace(/border-bottom:2px solid #111/g,'border-bottom:2px solid rgba(var(--fg-rgb),.5)').replace(/border-bottom:1px solid #111/g,'border-bottom:1px solid rgba(var(--fg-rgb),.4)').replace(/border-bottom:1px solid #eee/g,'border-bottom:1px solid rgba(var(--fg-rgb),.08)')+'</div>'}
function lyDepthCtl(){var d=(UI.printDepth||'summary');return '<span style="display:inline-flex;gap:4px;align-items:center;margin-right:8px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint)">DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.printDepth=\''+k+'\';render()">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span>'} /* Round 2: the depth control the outputs and the print share */
/* ── documents composed for paper (15 Sep 2026, Paul's ruling): a document is designed from the page's content and laid out for the page; it is never the page's markup passed through ── */
function erHead(title,sub){return '<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* a section heading alone, for sections that are not a table of rows. 16 Sep 2026 (Paul's ruling, from the Values Architecture printout): the sub-line sits on its own line beneath the title, in its mono face, not inline with it */
function erHeadLg(title,sub){return erHead(title,sub).replace('font-size:24px','font-size:28px')} /* 16 Sep 2026 (Paul's ruling): a section heading a step above the register's group headings (24px), for documents whose groups carry their own */
function erAppendix(title,sub){return erHeadLg('Appendix','')+'<div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* 16 Sep 2026 (Paul's ruling): an appendix is headed Appendix, with the section's own title beneath — never labelled beside the title; its sub-line beneath the title likewise */
function erFigRow(figs){return '<div class="er-figs" style="display:grid;grid-template-columns:repeat('+figs.length+',1fr);gap:10px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid">'+figs.map(function(f){return '<div style="border:1px solid #ddd;border-top:3px solid '+(f.col||'#111')+';border-radius:6px;padding:10px 8px;text-align:center"><b style="display:block;font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;line-height:1.1;color:'+(f.vcol||'#111')+'">'+esc(String(f.v))+'</b><span style="display:block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:4px">'+esc(f.l)+'</span>'+(f.sub?'<span style="display:block;font-size:10.5px;color:#777;margin-top:2px">'+esc(f.sub)+'</span>':'')+'</div>'}).join('')+'</div>'} /* a row of figures in boxes: the value, its label, an optional line beneath, a coloured rule above */
function erBarBlock(title,sub,rows){var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+rows.map(function(r){var v=+r.v||0,m=r.max||5;return '<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(r.l)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+Math.round(v/m*100)+'%;background:'+(v?tone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:64px;padding:4px 0 4px 8px;text-align:right;white-space:nowrap;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v.toFixed(1)+' / '+m:'\u2014')+'</td></tr>'}).join('')+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling): a headed block of bars — label · bar · score, the Readiness Report's row form — unsplittable under the block rule */
function erBlock(inner){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+inner+'</div>'} /* 16 Sep 2026: the block rule as a wrapper — a unit that is never split across pages */
/* ── the single-record documents (14 Sep 2026): a heading per section over labelled rows, in the screen's own words; one form each ── */
function erSection(title,rowsHtml,sub){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub) /* 16 Sep 2026 (Paul's ruling): the section heading is erHead's — the sub-line beneath the title; one heading form */+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px;break-inside:auto;page-break-inside:auto"><tbody>'+rowsHtml+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling; family): a block — a heading with its rows — is never split across pages; if it would be, it starts a new page. The block is unsplittable; the table inside stays splittable between rows so a block taller than a page still breaks between rows, never inside one */
function erRows(obj,fields){return fields.map(function(f){if(f.rows)return f.rows(obj).map(function(r){return lyRow(r.l,r.v)}).join(''); /* 16 Sep 2026: a field may supply its own rows (a list stored on the record) */var v=obj[f.k];var L=(typeof STRUCTURE_LABELS!=='undefined')&&STRUCTURE_LABELS[f.k];if(L&&L[v])v=L[v];return lyRow(f.l,v)}).join('')} /* a stored choice prints as its label */

/* ══ THE IDEA RECORD (16 Sep 2026): the record that runs the module — an idea, gaining a layer at each stage; the five portfolio outputs are its registers at successive stages. Labels are the app's own read-only cards' labels (expCardRO, projCardRO, devCardRO, opPortBody) ══ */
var IDEA_HORIZON_LABELS={quick:'Quick win',medium:'Medium-term bet',long:'Long-term bet'}; /* the words Step 3.1 gives the horizon values */
var IDEA_GATES=[{k:'techCapable',l:'Technology'},{k:'resourcesAvailable',l:'Resources'},{k:'culturalFit',l:'Culture'},{k:'purposeAligned',l:'Purpose'},{k:'affordable',l:'Affordability'}]; /* the five qualification gates of Step 1.3 */
function ideaRecs(list){return (list||[]).map(function(i){return {i:i}})} /* a register's records are indices into data.ideas, carried as {i} */
function ideaQual(i){var a=(data.assessments||{})[i]||{};var def=IDEA_GATES.filter(function(g){return a[g.k]!==undefined});if(!def.length)return {state:'none',text:''};var failed=IDEA_GATES.filter(function(g){return a[g.k]===false});if(def.length<IDEA_GATES.length)return {state:'partial',text:'Partly qualified ('+def.length+' of 5 gates answered)'};return failed.length?{state:'disq',text:'Did not pass: '+failed.map(function(g){return g.l}).join(', ')}:{state:'pass',text:'Passed all five gates'}}
function ideaBalanceBlock(items,stage,title){if(!items||!items.length)return '';var res=items.map(function(i){return resolveBands(i,stage)});var tot=res.length;
  var rows=[['Time horizon','h',[['quick','Quick'],['medium','Medium'],['long','Long']]],['Risk','r',[['low','Low'],['medium','Medium'],['high','High']]],['Reward','w',[['low','Low'],['medium','Medium'],['high','High']]]];
  var bars=rows.map(function(row){return '<tr><td style="width:24%;padding:8px 8px 8px 0;vertical-align:top;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#555;border-bottom:1px solid #eee">'+row[0]+'</td>'+row[2].map(function(b){var c=res.filter(function(x){return x.conf&&x[row[1]]===b[0]}).length,p=res.filter(function(x){return !x.conf&&x[row[1]]===b[0]}).length;var cw=Math.round(c/tot*100),pw=Math.round(p/tot*100);return '<td style="padding:8px 6px;vertical-align:top;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px"><span>'+b[1]+'</span><span style="font-family:var(--mono,monospace)">'+c+(p?' (+'+p+')':'')+'</span></div><div style="height:7px;border-radius:4px;background:#eee;overflow:hidden;display:flex"><div style="width:'+cw+'%;background:#555"></div><div style="width:'+pw+'%;background:#bbb"></div></div></td>'}).join('')+'</tr>'}).join('');
  var fl=balanceFlags(res);var sub=stage==='bluesky'?'From intake estimates \u2014 timeframe, triage risk and value':stage==='explore'?'Graded projects only':'Solid = positioned; lighter = provisional, suggested from the assessments';
  return erBlock(erHead(title||'Portfolio Balance',sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 '+(fl.length?'8px':'22px')+'"><tbody>'+bars+'</tbody></table>'+(fl.length?'<p style="font-size:12px;color:#333;margin:0 0 22px">'+fl.map(function(t){return '\u26A0 '+esc(t)}).join('<br>')+'</p>':''))} /* 17 Sep 2026 (Paul's ruling): the page's Portfolio Balance card on paper \u2014 three rows of three bands with counts, the flags beneath; greys, as the document's figures are */
LAYER_MAPS.idea={
  identity:function(r){var d=(data.ideas||[])[r.i]||{};return {title:d.name||'Unnamed idea',score:'',meta:[d.dept||'',d.cost||'',d.timeframe||'',d.when==='future'?'Parked for the future':''].filter(Boolean)}},
  layers:[
   {id:'idea',title:'The idea',stage:'1.2',present:function(r){var d=(data.ideas||[])[r.i]||{};return !!(d.desc||d.strategic||d.outcome||d.capabilities||d.risk)},fields:[
     {label:'Description',get:function(r){return ((data.ideas||[])[r.i]||{}).desc},summary:true},
     {label:'Strategic anchor',get:function(r){return ((data.ideas||[])[r.i]||{}).strategic},summary:true},
     {label:'Best and worst outcome',get:function(r){return ((data.ideas||[])[r.i]||{}).outcome}},
     {label:'Capabilities needed',get:function(r){return ((data.ideas||[])[r.i]||{}).capabilities}},
     {label:'Risk',get:function(r){return ((data.ideas||[])[r.i]||{}).risk}}]},
   {id:'rank',title:'Filter and rank',stage:'1.3',present:function(r){var a=(data.assessments||{})[r.i];return !!(a&&(IDEA_GATES.some(function(g){return a[g.k]!==undefined})||a.priority||a.value))},fields:[
     {label:'Qualification',get:function(r){return ideaQual(r.i).text},summary:true},
     {label:'Score',get:function(r){return ideaQual(r.i).state==='pass'?triageScore(r.i)+' / 50':''},summary:true},
     {label:'Priority',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.priority?a.priority+' / 10':''}},
     {label:'Risk (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.risk?a.risk+' / 10':''}},
     {label:'Value',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.value?a.value+' / 10':''}},
     {label:'Cost (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.costScore?a.costScore+' / 10':''}},
     {label:'Ease (10 = easy)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.difficulty?a.difficulty+' / 10':''}}]},
   {id:'exploration',title:'Exploration',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables}},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline}},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   {id:'portfolio',title:'Portfolio placement',stage:'3.1',present:function(r){var p=(data.portfolio||{})[r.i]||{};return !!(p.horizon||p.risk||p.reward||p.notes)},fields:[
     {label:'Horizon',get:function(r){var p=(data.portfolio||{})[r.i]||{};return IDEA_HORIZON_LABELS[p.horizon]||(p.horizon?lyCap(p.horizon):'')},summary:true},
     {label:'Risk',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.risk?lyCap(p.risk):''},summary:true},
     {label:'Reward',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.reward?lyCap(p.reward):''},summary:true},
     {label:'Notes',get:function(r){return ((data.portfolio||{})[r.i]||{}).notes}}]},
   {id:'capital',title:'Capital',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{},b=(data.budgetPlans||{})[r.i]||{};return !!(p.startupCost||p.rolloutCost||p.runningCost||b.horizon||b.contingency)},fields:[
     {label:'Start-up cost',get:function(r){return ((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout cost',get:function(r){return ((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Running cost',get:function(r){return ((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Plan horizon',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.contingency?b.contingency+'%':''}}]},
   {id:'development',title:'Development track',stage:'4.1',present:function(r){var t=(data.tracking||{})[r.i]||{};return !!(t.status||t.results||t.infraLearnings||t.breakWork)},fields:[
     {label:'Status',get:function(r){var t=(data.tracking||{})[r.i]||{};return t.status?lyCap(t.status):''},summary:true},
     {label:'Results to date',get:function(r){return ((data.tracking||{})[r.i]||{}).results},summary:true},
     {label:'Infrastructure learnings',get:function(r){return ((data.tracking||{})[r.i]||{}).infraLearnings}},
     {label:'What\u2019s breaking / working',get:function(r){return ((data.tracking||{})[r.i]||{}).breakWork}}]},
   {id:'review',title:'Portfolio review',stage:'4.4',present:function(r){var it=((data.review||{}).items||{})[r.i]||{};return !!it.decision},fields:[
     {label:'Decision',get:function(r){var it=((data.review||{}).items||{})[r.i]||{};return it.decision?lyCap(it.decision):''},summary:true}]},
   {id:'operations',title:'Operations',stage:'5',present:function(r){var o=(data.opsData||{})[r.i]||{};return (data.launched||[]).indexOf(r.i)>=0||!!(o.health||o.launchDate||o.performance||o.notes)},fields:[
     {label:'Health',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.health?lyCap(o.health):''},summary:true},
     {label:'Launch date',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.launchDate?lyDate(o.launchDate):''},summary:true},
     {label:'Owner',get:function(r){var o=(data.opsData||{})[r.i]||{},e=(data.experiments||{})[r.i]||{};return o.owner||e.owner}},
     {label:'Performance vs. success metric',get:function(r){return ((data.opsData||{})[r.i]||{}).performance},summary:true},
     {label:'Ongoing notes',get:function(r){return ((data.opsData||{})[r.i]||{}).notes}}]}
  ]};
var IDEA_LAYER_INDEX={idea:0,rank:1,exploration:2,portfolio:3,capital:4,development:5,review:6,operations:7}; /* the brief layer left 17 Sep 2026: its fields had no writer */ /* the layers of LAYER_MAPS.idea by index, so a register names the layer it prints up to */
/* ══ THE PROJECT RECORD (17 Sep 2026, Paul's ruling): once an idea is a project, its record is the project card — Overview (2.4), Analyses (the gap analysis and SWOT), Budget (3.3) — then the brief, the track, the review, and operations. The idea card is superseded and does not print. Summary draws on the Overview and the budget's figures; Full adds the analyses and the budget plan ══ */
function projLayerById(id){return LAYER_MAPS.idea.layers.filter(function(l){return l.id===id})[0]}
function bpMoney(i,fn){try{if(!bpHasAny(i))return '';var v=fn(i);return v?fmtMoney(v):''}catch(e){return ''}}
function bpSteps(i,k){var p=bpGet(i)||{};return (p[k]||[]).filter(function(st){return st&&(st.name||st.cost)}).map(function(st){return (st.name||'Unnamed')+(st.from&&st.to?' \u2014 months '+st.from+'\u2013'+st.to:'')+(st.cost?' \u2014 '+st.cost:'')})}
function bpSusLines(i){var p=bpGet(i)||{};return (p.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return x.name+(x.cost?' '+x.cost:'')});return ph.name+(ph.from?' \u2014 from month '+ph.from+(ph.to&&ph.to!=='ongoing'?' to '+ph.to:', ongoing'):'')+(items.length?': '+items.join('; '):'')})}
function gapNames(i,cat,have){var g=gapItemsOf(i);return (g[cat]||[]).filter(function(x){return !!x.have===have}).map(function(x){return x.name})}
LAYER_MAPS.project={
  identity:function(r){var d=(data.ideas||[])[r.i]||{},pb=(data.portfolio||{})[r.i]||{};return {title:d.name||'Unnamed project',score:'',meta:[d.dept||'',IDEA_HORIZON_LABELS[pb.horizon]||'',ideaStageWord(r.i)].filter(Boolean)}},
  layers:[
   {id:'overview',title:'Overview',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.timeline||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables},summary:true},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline},summary:true},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   projLayerById('portfolio'),
   {id:'analyses',title:'Analyses',stage:'3.2',present:function(r){var g=gapItemsOf(r.i),sw=((data.projects||{})[r.i]||{}).swot||{};return ['skills','resources','technology'].some(function(c){return (g[c]||[]).length})||['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]})},fields:[
     {label:'Skills we have',list:true,get:function(r){return gapNames(r.i,'skills',true)}},
     {label:'Skills gap',list:true,get:function(r){return gapNames(r.i,'skills',false)}},
     {label:'Resources we have',list:true,get:function(r){return gapNames(r.i,'resources',true)}},
     {label:'Resources gap',list:true,get:function(r){return gapNames(r.i,'resources',false)}},
     {label:'Technology we have',list:true,get:function(r){return gapNames(r.i,'technology',true)}},
     {label:'Technology gap',list:true,get:function(r){return gapNames(r.i,'technology',false)}},
     {label:'Strengths',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).strengths}},
     {label:'Weaknesses',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).weaknesses}},
     {label:'Opportunities',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).opportunities}},
     {label:'Threats',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).threats}}]},
   {id:'budget',title:'Budget',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{};return bpHasAny(r.i)||!!(p.startupCost||p.rolloutCost||p.runningCost)},fields:[
     {label:'Lifetime cost',get:function(r){return bpMoney(r.i,bpLifetime)},summary:true},
     {label:'Development costs',get:function(r){return bpMoney(r.i,bpDevTotal)||((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout costs',get:function(r){return bpMoney(r.i,bpRollTotal)||((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Annual sustainment costs',get:function(r){return bpMoney(r.i,bpSusSteady)||((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Estimated project lifetime',get:function(r){var b=bpGet(r.i)||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=bpGet(r.i)||{};return b.contingency?b.contingency+'%':''}},
     {label:'Development phases',list:true,get:function(r){return bpSteps(r.i,'dev')}},
     {label:'Rollout steps',list:true,get:function(r){return bpSteps(r.i,'roll')}},
     {label:'Sustainment',list:true,get:function(r){return bpSusLines(r.i)}}]},
   projLayerById('development'),projLayerById('review'),projLayerById('operations')
  ]};
var PROJECT_LAYER_INDEX={overview:0,portfolio:1,analyses:2,budget:3,development:4,review:5,operations:6};
/* ══ THE PROJECT ON PAPER AS CARDS (17 Sep 2026, Paul's ruling for the Exploration Portfolio): Summary prints each project's Overview card whole — every line — with the verdict and the Filter & Rank score right-justified on the name bar; Full gives each project two pages: the Overview card, the Analyses card (the gap analysis closed up, then the SWOT), and the portfolio position on the first; the budget on the second, with rollout steps and sustainment beside the development phases ══ */
var PC_LBL='font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#555;margin:0 0 2px';
function pcText(v,size){var t=lyText(v);return '<div style="font-size:'+(size||11.5)+'px;line-height:1.4;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div>'}
function projCardBar(i){var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{};var verdict=p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided';var sc=triageScore(i);
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+verdict+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
function projStatBand(i,large){if(!bpHasAny(i))return ''; /* 17 Sep 2026 (Paul's ruling): the figures are 26px and blue on the Full card only; Summary keeps the smaller black form, or they dominate its page */var H=bpHorizon(i),life=bpLifetime(i),pk=bpPeakMonth(i),fo=bpFirstOpMonth(i),ssv=bpSusSteady(i);var mm=bpMonthly(i);var pkV=pk?Math.round(mm[pk-1].dev+mm[pk-1].roll+mm[pk-1].sus):0;var ct=parseFloat((bpGet(i)||{}).contingency)||0;
  var big=function(v,l,sub){return '<td style="text-align:center;padding:'+(large?'9px':'8px')+' 6px 6px;vertical-align:top"><div style="'+(large?'font-size:26px;font-weight:800;color:var(--ph2-t)':'font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111')+';line-height:1.1">'+v+'</div><div style="font-size:10.5px;color:#333;margin-top:2px">'+l+'</div>'+(sub?'<div style="font-size:9.5px;color:#777">'+sub+'</div>':'')+'</td>'};
  var h='<table style="width:100%;border-collapse:collapse;border-bottom:1px solid #eee"><tr>'+big(fmtMoney(life),'Lifetime cost','across '+H+' years')+big(fmtMoney(bpDevTotal(i)),'Development costs','')+big(fmtMoney(bpRollTotal(i)),'Rollout costs','')+big(ssv?fmtMoney(ssv):'\u2014','Annual sustainment costs','')+'</tr></table>';
  var l1=[];if(ct>0)l1.push('With '+ct+'% contingency: '+fmtMoney(Math.round(life*(1+ct/100)))+' lifetime.');if(fo)l1.push('First operational month: Month '+fo+'.');
  var lines=(l1.length?'<div>'+l1.join(' \u00b7 ')+'</div>':'')+(pk?'<div>Monthly costs peak at Month '+pk+': '+fmtMoney(pkV)+' per month.</div>':'');
  return h+(lines?'<div style="padding:6px 14px 2px;font-size:11.5px;line-height:1.5;color:#111;border-bottom:1px solid #eee">'+lines+'</div>':'')} /* 17 Sep 2026 (Paul's ruling): the Overview card's numbers, as the page's stat band gives them \u2014 the four figures, then contingency and first operational month on one line, the peak month on the next */
function projOverviewCard(i,big){var p=(data.projects||{})[i]||{};var F=[['Objectives',p.objectives],['Deliverables',p.deliverables],['Timeline',p.timeline],['Resources',p.resources],['Key risks',p.risks],['Success metrics',p.metrics],['Internal partners',p.partInt],['External partners',p.partExt]];
  var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+cells[k+1]+'</tr>';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projCardBar(i)+projStatBand(i,big)+(p.noGoR?'<div style="padding:6px 14px 0"><div style="'+PC_LBL+'">No-Go reason</div>'+pcText(p.noGoR)+'</div>':'')+'<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table></div>'}
function projAnalysesCard(i){var p=(data.projects||{})[i]||{},g=gapItemsOf(i),sw=p.swot||{};var gAny=['skills','resources','technology'].some(function(c){return (g[c]||[]).length}),sAny=['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]});
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Analyses</div>';
  if(!gAny&&!sAny)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">No analyses recorded yet.</div></div>';
  if(gAny){h+='<div style="'+PC_LBL+'">Gap analysis</div><table style="width:100%;border-collapse:collapse;margin:0 0 8px"><tbody>'+[['Skills','skills'],['Resources','resources'],['Technology','technology']].map(function(c){var its=g[c[1]]||[];if(!its.length)return '';var hv=its.filter(function(x){return x.have}).map(function(x){return esc(x.name)}),gp=its.filter(function(x){return !x.have}).map(function(x){return esc(x.name)});return '<tr><td style="width:22%;padding:3px 0;font-size:11.5px;font-weight:700;color:#111;vertical-align:top;border-bottom:1px solid #eee">'+c[0]+'</td><td style="width:39%;padding:3px 8px 3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee"><span style="color:#1B6B5A;font-weight:700">Have:</span> '+(hv.length?hv.join(', '):'\u2014')+'</td><td style="width:39%;padding:3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee;color:'+(gp.length?'#B8860B':'#111')+'"><span style="color:#B8860B;font-weight:700">Gap:</span> '+(gp.length?gp.join(', '):'\u2014')+'</td></tr>' /* 17 Sep 2026 (Paul's ruling): colour on the gap analysis \u2014 gaps in the page's amber, what is in hand in green */}).join('')+'</tbody></table>'}
  if(sAny){var Q=[{k:'strengths',l:'+ Strengths',c:'#1B6B5A',bg:'rgba(27,107,90,.10)'},{k:'weaknesses',l:'\u2212 Weaknesses',c:'#C25B73',bg:'rgba(155,45,63,.08)'},{k:'opportunities',l:'\u25c9 Opportunities',c:'#2D5A8E',bg:'rgba(45,90,142,.10)'},{k:'threats',l:'\u25b3 Threats',c:'#D4A017',bg:'rgba(139,94,60,.10)'}]; /* the page's four tints and label colours (17 Sep 2026, Paul's ruling: colour throughout this report, as on screen) */
  var qcell=function(q){return '<td style="width:50%;vertical-align:top;background:'+q.bg+';border-radius:5px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:'+q.c+';margin-bottom:3px">'+q.l+'</div>'+pcText(sw[q.k],11)+'</td>'};
  h+='<div style="'+PC_LBL+'">SWOT</div><table style="width:100%;border-collapse:separate;border-spacing:4px 4px;margin:0 -4px"><tr>'+qcell(Q[0])+qcell(Q[1])+'</tr><tr>'+qcell(Q[2])+qcell(Q[3])+'</tr></table>'}
  return h+'</div>'}
function projPositionBlock(i){var pb=(data.portfolio||{})[i]||{};var placed=!!(pb.horizon||pb.risk||pb.reward||pb.notes);
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Portfolio Position</div>';
  if(!placed)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">Not yet placed in the portfolio (Step 3.1).</div></div>';
  var cell=function(l,v){return '<td style="width:33%;vertical-align:top;padding:2px 8px 2px 0"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  return h+'<table style="width:100%;border-collapse:collapse"><tr>'+cell('Horizon',IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''))+cell('Risk',pb.risk?lyCap(pb.risk):'')+cell('Reward',pb.reward?lyCap(pb.reward):'')+'</tr></table>'+(pb.notes?'<div style="margin-top:6px"><div style="'+PC_LBL+'">Notes</div>'+pcText(pb.notes)+'</div>':'')+'</div>'}
function projBudgetPage(i,opts){opts=opts||{};var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{},b=bpGet(i)||{};var has=bpHasAny(i);
  var h='<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 6px;padding-bottom:4px;border-bottom:3px solid #111"><div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111">Budget</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#555">'+esc(d.name||'')+'</div></div>';
  if(!has){h+='<div style="font-size:11.5px;color:#888;font-style:italic;margin:0 0 10px">No budget plan yet (Step 3.3).</div>';if(p.startupCost||p.rolloutCost||p.runningCost)h+=erFigRow([{v:p.startupCost||'\u2014',l:'Start-up cost'},{v:p.rolloutCost||'\u2014',l:'Rollout cost'},{v:p.runningCost||'\u2014',l:'Running cost'}]);return h}
  h+='<div style="font-size:11px;color:#333;margin:0 0 6px">'+(b.horizon?'Estimated project lifetime '+b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):'')+(b.contingency?(b.horizon?' \u00b7 ':'')+'Contingency '+b.contingency+'%':'')+'</div>';
  var th=function(t){return '<th style="text-align:left;padding:2px 4px;font-family:var(--mono,monospace);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,extra){return '<td style="padding:2px 4px;font-size:10px;line-height:1.25;vertical-align:top;border-bottom:1px solid #eee;'+(extra||'')+'">'+v+'</td>'};
  var steps=function(list,withDesc){return (list||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return '<tr>'+td(esc(x.name||'Unnamed')+(withDesc&&x.desc?'<div style="color:#666;font-size:9px">'+esc(x.desc)+'</div>':''))+td(x.from&&x.to?esc(x.from+'\u2013'+x.to):'','white-space:nowrap')+td(esc(x.cost||''),'white-space:nowrap;text-align:right')+'</tr>'}).join('')};
  var left='<div style="'+PC_LBL+'">Development phases</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Phase')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.dev,true)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var rollout='<div style="'+PC_LBL+'">Rollout steps</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Step')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.roll,false)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var sus='<div style="'+PC_LBL+'">Sustainment</div><table style="width:100%;border-collapse:collapse"><thead><tr>'+th('Phase')+th('From')+th('Annual items')+'</tr></thead><tbody>'+((b.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return esc(x.name||'')+(x.cost?' <span style="color:#555">'+esc(x.cost)+'</span>':'')}).join('<br>');return '<tr>'+td(esc(ph.name))+td(ph.from?'Month '+esc(ph.from)+(ph.to&&ph.to!=='ongoing'?'\u2013'+esc(ph.to):', ongoing'):'','white-space:nowrap')+td(items||'\u2014')+'</tr>'}).join('')||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var box=function(title,svg,cap,extra){var inner=String(svg||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;max-height:'+cap+'px;display:block" ').replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"');return inner?'<div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px 6px;margin:0 0 6px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:0 0 2px">'+title+'</div>'+inner+(extra||'')+'</div>':''}; /* 17 Sep 2026 (Paul's rulings): each chart in its own box, its height capped so the page holds; the charts print in colour without their zoom buttons */
  h+=box('Monthly spend shape',bpChartShape(i),118,String(bpChartLegend()).replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"'))+box('Step timeline',bpChartLanes(i),84)+box('How the lifetime total builds',bpChartWaterfall(i),128)+box('Cumulative cost \u2014 lifetime, including ongoing sustainment',bpChartCum(i),118);
  if(opts.noDevPhases)h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:45%;vertical-align:top;padding:0 8px 0 0">'+rollout+'</td><td style="width:55%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* 17 Sep 2026 (Paul's ruling): where the development card already lists the phases, the budget page shows rollout and sustainment only */
  else h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:36%;vertical-align:top;padding:0 8px 0 0">'+left+'</td><td style="width:30%;vertical-align:top;padding:0 8px;border-left:1px solid #ddd">'+rollout+'</td><td style="width:34%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* the three tables side by side, so the page closes up */
  return h}
function projectCardPages(i,depth,lead){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(!full)return keepWith(lead,projOverviewCard(i,false));
  var page1='<div style="break-before:page;page-break-before:always">'+keepWith(lead,projOverviewCard(i,true))+projAnalysesCard(i)+projPositionBlock(i);
  if(!bpHasAny(i))return page1+'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div></div>'; /* 17 Sep 2026 (Paul's ruling): no empty budget page \u2014 a line under the portfolio position instead */
  return page1+'</div><div style="break-before:page;page-break-before:always">'+projBudgetPage(i)+'</div>'}
function projectCardGroups(groups,depth,docHead){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' project'+(g.list.length===1?'':'s')):'');out+=projectCardPages(r.i,depth,lead);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* the document's own heading rides on the first project's page; at Summary the cards flow on a page of their own */
/* ══ THE LATER STAGES ON PAPER (17 Sep 2026, Paul's ruling: the signed-off Exploration form applied to the remaining registers). Each program's stage card mirrors its page's read-only cards — the development brief and track, the review decision, the operations record — with the status or health coloured as the page colours it. Full adds the Exploration pages: overview, analyses, and position, then the budget where there is a plan ══ */
var STATUS_COLORS={complete:'#1B6B5A',running:'#2D5A8E',alive:'#2D5A8E',killed:'#9B2D3F',dead:'#9B2D3F',paused:'#8B5E3C',dormant:'#8B5E3C'};
var HEALTH_COLORS={green:'#1B6B5A',amber:'#D4A017',red:'#9B2D3F'};
function projStageBar(i,kind){var d=(data.ideas||[])[i]||{},tr=(data.tracking||{})[i]||{},ops=(data.opsData||{})[i]||{};var sc=triageScore(i);var right='';
  if(kind==='ops'){var killed=tr.status==='killed';var hw=killed?'Killed':(ops.health?lyCap(ops.health):'Health not yet reported');right='<span style="color:'+(killed?'#9B2D3F':(HEALTH_COLORS[ops.health]||'#666'))+';font-weight:700">'+hw+'</span>'}
  else{right='<span style="color:'+(STATUS_COLORS[tr.status]||'#666')+';font-weight:700">'+(tr.status?lyCap(tr.status):'Not yet started')+'</span>'}
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+right+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
function pcGrid(F){var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+(cells[k+1]||'<td></td>')+'</tr>';return '<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table>'}
function pcSub(t){return '<div style="font-family:var(--serif,Georgia,serif);font-size:13px;font-weight:700;color:#111;padding:8px 14px 0">'+t+'</div>'}
function projDevCard(i,withPosition){var p=(data.projects||{})[i]||{},tr=(data.tracking||{})[i]||{},pb=(data.portfolio||{})[i]||{};var phases=progOrdered(i);
  var money=bpHasDev(i)?'Development budget <b>'+fmtMoney(bpDevTotal(i))+'</b>'+(bpHasRoll(i)?' \u00b7 Rollout <b>'+fmtMoney(bpRollTotal(i))+'</b>':'')+(bpSusSteady(i)?' \u00b7 Sustainment <b>'+fmtMoney(bpSusSteady(i))+'</b>/yr':''):'';
  var ph=phases.length?phases.map(function(r,ix){var sp=bpStepSpan(r);return '<div style="padding:6px 14px 6px;border-top:1px solid #eee;break-inside:avoid;page-break-inside:avoid"><div style="font-size:12px;color:#111"><b>Phase '+(ix+1)+' \u2014 '+esc(r.name||'Unnamed')+'</b>'+(r.powner?' <span style="color:#555">\u00b7 '+esc(r.powner)+'</span>':'')+(sp?' <span style="color:#555">\u00b7 months '+sp[0]+'\u2013'+sp[1]+'</span>':'')+(bpStepMoney(r)?' <span style="color:#555">\u00b7 '+fmtMoney(bpStepMoney(r))+'</span>':'')+'</div>'+(r.desc?'<div style="font-size:11px;color:#555;line-height:1.35;margin-top:1px">'+esc(r.desc)+'</div>':'')+'<div style="font-size:11px;line-height:1.35;margin-top:3px"><span style="color:#666">Success metrics:</span> '+(r.pmetric?esc(r.pmetric):'\u2014')+' &nbsp;<span style="color:#666">Exit gate:</span> '+(r.pexit?esc(r.pexit):'\u2014')+(r.gateDec?' &nbsp;<span style="color:#666">Gate taken:</span> <b>'+esc(r.gateDec)+'</b>'+(r.gateAt?' <span style="color:#666">'+fmtDate(r.gateAt)+'</span>':''):'')+'</div></div>'}).join(''):'<div style="padding:4px 14px 6px;font-size:11.5px;color:#888;font-style:italic">No development phases recorded.</div>';
  var pos=withPosition?'<div style="padding:6px 14px 8px;border-top:1px solid #eee;font-size:11.5px;color:#111"><span style="color:#666">Portfolio position:</span> '+((pb.horizon||pb.risk||pb.reward)?[IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''),pb.risk?lyCap(pb.risk)+' risk':'',pb.reward?lyCap(pb.reward)+' reward':''].filter(Boolean).join(' \u00b7 '):'not yet placed')+'</div>':'';
  var keep='break-inside:avoid;page-break-inside:avoid';
  return '<div class="er-block" style="'+keep+';border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden"><div style="'+keep+'">'+projStageBar(i,'dev')+pcSub('Development program')+pcGrid([['Objectives',p.objectives],['Deliverables',p.deliverables]])+(money?'<div style="padding:2px 14px 8px;font-size:11.5px;color:#111">'+money+'</div>':'')+'<div style="'+PC_LBL+';padding:4px 14px 2px">Program phases</div></div>'+ph+'<div style="'+keep+'">'+pcSub('Development track')+pcGrid([['Results to date',tr.results],['Infrastructure learnings',tr.infraLearnings||tr.learnings],['What\u2019s breaking / working',tr.breakWork]])+pos+'<div style="height:6px"></div></div></div>'} /* 17 Sep 2026 (Paul's finding: headings stranded): the card flows across pages like a long record \u2014 the bar with the program, each phase, and the track each stay whole, so the headings above are followed by the first program */ /* 17 Sep 2026 (Paul's ruling): the development card carries what the module records \u2014 Step 3.4\u2019s program (objectives, deliverables, the budget from the plan, each phase with its owner, months, budget, description, success metrics, exit gate criteria, and the gate taken) and the Development Portfolio page\u2019s track (status, results to date, learnings, what\u2019s breaking / working). The experiment brief it replaced was a retired design that only the seed still filled */
function projReviewBlock(i){var it=((data.review||{}).items||{})[i]||{};var col={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'}[it.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111">Portfolio Review</div><div style="font-family:var(--mono,monospace);font-size:12px;font-weight:700;color:'+col+'">'+(it.decision?lyCap(it.decision):'Not yet reviewed')+'</div></div>'+(it.note?pcText(it.note):'')+'</div>'}
function projOpsCard(i){var ops=(data.opsData||{})[i]||{},p=(data.projects||{})[i]||{};var roll=bpHasRoll(i)?fmtMoney(bpRollTotal(i)):(ops.rolloutCost||p.rolloutCost||''),sus=bpSusSteady(i)?fmtMoney(bpSusSteady(i))+'/yr':(ops.runningCost||p.runningCost||'');
  var cell=function(l,v,right){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px;'+(right?'text-align:right':'')+'"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  var corners='<table style="width:100%;border-collapse:collapse"><tbody><tr>'+cell('Owner',ops.owner||((progOrdered(i)[0]||{}).powner)||'')+cell('Launch date',ops.launchDate?lyDate(ops.launchDate):'',true)+'</tr><tr>'+cell('Rollout costs',roll)+cell('Annual sustainment cost',sus,true)+'</tr></tbody></table>';
  var rest=[['Success metrics',p.metrics],['Performance vs. success metric',ops.performance],['Ongoing notes',ops.notes]].map(function(f){return '<div style="padding:6px 14px 8px;border-top:1px solid #eee"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</div>'}).join('');
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projStageBar(i,'ops')+corners+rest+'<div style="height:6px"></div></div>'} /* 17 Sep 2026 (Paul's ruling): owner top left, launch date top right, rollout costs bottom left, annual sustainment cost bottom right (from the budget plan), the rest below */
function projectPagesFor(i,depth,lead,stage){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(stage==='ops'){var opsCard=projOpsCard(i);if(!full)return keepWith(lead,opsCard);
    var pageP='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>'+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'');
    return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,opsCard)+'</div>'+pageP+'<div style="break-before:page;page-break-before:always">'+projDevCard(i,false)+'</div>'} /* 17 Sep 2026 (Paul's ruling): Operational Full is the operations page, then the project pages, then the development page */
  var devCard=projDevCard(i,!full)+(stage==='updated'?projReviewBlock(i):'');
  if(!full)return keepWith(lead,devCard);
  var pageB='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>';
  return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,devCard)+'</div>'+pageB+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'')}
function projectStageGroups(groups,depth,docHead,stage,noHeads){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=noHeads?'':(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' program'+(g.list.length===1?'':'s')):'');out+=projectPagesFor(r.i,depth,lead,stage);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* 17 Sep 2026 (Paul's ruling, restated): cards stay whole; a heading rides its first card as one block (projectPagesFor); only a card longer than a page can spill, and that cannot be helped */
/* ══ THE PORTFOLIO REVIEW (17 Sep 2026, Paul's ruling): Ignite's third output, distilled from Step 4.4 — the Buy, Hold, or Sell call on every live initiative with its reasons, the capital and the balance after the decisions, the five learnings, and the history of closed cycles. One version; the page is a read-only report of the same ══ */
var RV_COLORS={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'};var RV_WORDS={buy:'Buy',hold:'Hold',sell:'Sell'};
function portfolioReviewModel(){var ideas=data.ideas||[],exSel=data.expSelected||[],trk=data.tracking||{},rev=data.review||{},launched=data.launched||[];
  var items=exSel.filter(function(i){return !isArchived(i)}).concat(launched.filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0})).concat((data.selected||[]).filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0&&launched.indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true})); /* the review's own set, as renderReviewSurface draws it */
  var stage=function(i){return launched.indexOf(i)>=0?'Operational':exSel.indexOf(i)>=0?'In development':'Exploration'};
  var recs=items.map(function(i){var ri=(rev.items||{})[i]||{};var c=projCosts(i);return {i:i,name:(ideas[i]||{}).name||'',dept:(ideas[i]||{}).dept||'',stage:stage(i),decision:ri.decision||'',rationale:ri.rationale||'',start:c.start,run:c.run,killed:(trk[i]||{}).status==='killed'}});
  var by=function(d){return recs.filter(function(r){return r.decision===d})};var groups=[{name:'Buy',key:'buy',list:by('buy')},{name:'Hold',key:'hold',list:by('hold')},{name:'Sell',key:'sell',list:by('sell')},{name:'Not yet decided',key:'',list:recs.filter(function(r){return !r.decision})}].filter(function(g){return g.list.length});
  var yN=1,yr=null;try{var eff=new Date(new Date().getFullYear(),new Date().getMonth()+1,1);var ps=(data.capital||{}).periodStart?new Date((data.capital||{}).periodStart):null;yN=ps?Math.max(1,Math.min(envYearsOf(),Math.floor(((eff.getFullYear()*12+eff.getMonth())-(ps.getFullYear()*12+ps.getMonth()))/12)+1)):1;var yts=orgYearTotals();yr=yts&&yts[yN-1]?yts[yN-1]:null}catch(e){yr=null}
  var learn=[['New opportunities',rev.newOpportunities],['Balance assessment',rev.balance],['What worked?',rev.worked],['What didn\u2019t?',rev.didnt],['Changes for next cycle?',rev.nextCycle]];
  return {items:items,recs:recs,groups:groups,decided:recs.filter(function(r){return r.decision}).length,buy:by('buy').length,hold:by('hold').length,sell:by('sell').length,yN:yN,yr:yr,balItems:items.filter(function(i){return (trk[i]||{}).status!=='killed'}),learn:learn,cycles:data.reviewCycles||[],complete:!!(data.completedSteps||{})['4.4']}}
function rvDecisionCard(r){var col=RV_COLORS[r.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:4px solid '+col+';border-radius:6px;margin:0 0 10px;padding:9px 14px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div><span style="font-family:var(--serif,Georgia,serif);font-size:15px;font-weight:700;color:#111'+(r.killed?';text-decoration:line-through':'')+'">'+esc(r.name)+'</span><span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(r.stage)+(r.dept?' \u00b7 '+esc(r.dept):'')+'</span></div><div style="font-family:var(--mono,monospace);font-size:11px;white-space:nowrap"><span style="color:'+col+';font-weight:700">'+(RV_WORDS[r.decision]||'Not yet decided')+'</span><span style="color:#555"> \u00b7 start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div></div>'+(r.rationale?'<div style="margin-top:6px;font-size:12.5px;line-height:1.5;color:#111;padding:8px 12px;border-left:3px solid #07 6D9E55;background:rgba(7,109,158,.06);white-space:pre-line;-webkit-print-color-adjust:exact;print-color-adjust:exact">'.replace('#07 6D9E55','#076D9E55')+esc(r.rationale)+'</div>':'<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic">No rationale recorded.</div>')+'</div>'}
function portfolioReviewDoc(){var M=portfolioReviewModel();
  var h=printDocCover('Portfolio Review','The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',M.decided+' of '+M.items.length+' decided');
  h+=erBlock(erHead('At a Glance',M.complete?'':M.decided+' of '+M.items.length+' initiatives decided \u2014 the review is still open')+erFigRow([{v:M.items.length,l:'Initiatives reviewed'},{v:M.buy,l:'Buy',col:'#1B6B5A',vcol:'#1B6B5A'},{v:M.hold,l:'Hold',col:'#8B5E3C',vcol:'#8B5E3C'},{v:M.sell,l:'Sell',col:'#9B2D3F',vcol:'#9B2D3F'}]));
  if(M.yr)h+=erBlock(erHead('Capital After the Decisions','Year '+M.yN+' of the planning window, as the calendar stands')+erFigRow([{v:fmtMoney(M.yr.total),l:'Committed, Year '+M.yN},{v:fmtMoney(M.yr.budget),l:'Budget, Year '+M.yN},{v:fmtMoney(M.yr.headroom),l:'Headroom',col:M.yr.headroom<0?'#9B2D3F':'#1B6B5A',vcol:M.yr.headroom<0?'#9B2D3F':'#1B6B5A'}]));
  h+=erHeadLg('The Decisions','')+M.groups.map(function(g){var cards=g.list.map(rvDecisionCard);return '<div style="break-inside:avoid;page-break-inside:avoid">'+erHead(g.name,g.list.length+' initiative'+(g.list.length===1?'':'s'))+(cards[0]||'')+'</div>'+cards.slice(1).join('')}).join(''); /* 17 Sep 2026 (Paul's rulings): the decisions follow the capital on the same page; a group\u2019s heading and its first initiative are one block, never split */
  h+=ideaBalanceBlock(M.balItems,'rb44','Portfolio Balance After the Review');
  h+=erBlock(erHead('Portfolio Learnings','What the quarter taught')+M.learn.map(function(l){var t=lyText(l[1]);return '<div style="margin:0 0 12px"><div style="'+PC_LBL+'">'+l[0]+'</div><div style="font-size:13px;line-height:1.55;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'<div style="height:8px"></div>'); /* 17 Sep 2026 (Paul's ruling): plain labelled text, not the quoted form */
  if(M.cycles.length){var th=function(t){return '<th style="text-align:left;padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">'+v+'</td>'};
    h+=erBlock(erHead('Review History',M.cycles.length+' closed cycle'+(M.cycles.length===1?'':'s'))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+th('Closed')+th('Buy')+th('Hold')+th('Sell')+'</tr></thead><tbody>'+M.cycles.slice().reverse().map(function(cy){var it=(cy.review||{}).items||{};var n=function(d){return Object.keys(it).filter(function(k){return it[k].decision===d}).length};return '<tr>'+td(fmtDate(cy.at))+td(n('buy'))+td(n('hold'))+td(n('sell'))+'</tr>'}).join('')+'</tbody></table>')}
  return h}
function renderOutPortfolioReview(){var M=portfolioReviewModel();
  var fig=function(v,l,c){return '<div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md" style="font-size:26px'+(c?';color:'+c:'')+'">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
  var h='<div class="flx-between-top-mb"><div>'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Portfolio Review</h2><p class="t-stone-sm">The first quarterly review, distilled from Step 4.4 \u2014 read-only; the decisions are taken there.</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.items.length,'Initiatives reviewed')+fig(M.buy,'Buy','#1B6B5A')+fig(M.hold,'Hold','#8B5E3C')+fig(M.sell,'Sell','#9B2D3F')+'</div>'+(M.complete?'':'<p class="t-faint-sm" style="margin:10px 0 0">'+M.decided+' of '+M.items.length+' decided \u2014 the review is still open at Step 4.4.</p>'),'margin-bottom:16px');
  if(M.yr)h+=card('<h3 class="h-sub-md">Capital After the Decisions</h3><div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(fmtMoney(M.yr.total),'Committed, Year '+M.yN)+fig(fmtMoney(M.yr.budget),'Budget, Year '+M.yN)+fig(fmtMoney(M.yr.headroom),'Headroom',M.yr.headroom<0?'#9B2D3F':'#1B6B5A')+'</div>','margin-bottom:16px');
  M.groups.forEach(function(g){h+='<h3 class="h-sub-lg" style="margin:6px 0 10px">'+g.name+' <span class="t-faint-sm" style="font-weight:400">('+g.list.length+')</span></h3>'+g.list.map(function(r){var col=RV_COLORS[r.decision]||'rgba(var(--faint-rgb),.5)';return card('<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><div><h4 class="h-card" style="margin:0;display:inline'+(r.killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc(r.name)+'</h4> '+badge(r.stage,r.stage==='Operational'?'#1B6B5A':r.stage==='In development'?'#2D5A8E':'rgba(var(--faint-rgb),.5)')+'</div><span class="t-faint-sm">start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div>'+(r.rationale?'<p class="fs-13" style="margin:8px 0 0;color:var(--text-muted);line-height:1.55">'+esc(r.rationale)+'</p>':'<p class="t-faint-sm" style="margin:8px 0 0">No rationale recorded.</p>'),'margin-bottom:10px;border-left:4px solid '+col)}).join('')});
  h+=card('<h3 class="h-sub-lg">Portfolio Learnings</h3>'+M.learn.map(function(l){return '<div style="margin:0 0 12px"><div class="u-b25d981" style="margin-bottom:3px">'+l[0]+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55;white-space:pre-line">'+(l[1]?esc(l[1]):'<span class="t-faint">Not yet written</span>')+'</div></div>'}).join(''),'margin-bottom:16px');
  return h}
/* ══ THE LIVE PAGES FROM THE DASHBOARD (17 Sep 2026, Paul's ruling): running a review or opening a portfolio from the dashboard never returns to a step page. The Quarterly Review page mounts the shared review surface — one state with Step 4.4 — under its own heading, and prints the Portfolio Review; the portfolio pages mount the same renderers as the outputs, so a change on either is the same change ══ */
function renderReviewPage(){var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Quarterly <em>Portfolio Review</em></h1><p class="u-98b80d8">Every live initiative: Buy, Hold, or Sell, with the reason. Decisions made here are the same decisions as at Step 4.4.</p></div>'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;margin-top:8px')+'</div>';
  h+=renderReviewSurface();
  return h+'</div></div></div>'}
var PORTFOLIO_PAGES={'out-bluesky':function(){return renderOutBluesky()},'out-explore':function(){return renderOutExploreEnhanced()},'out-expbriefs':function(){return renderOutExpbriefsFull()},'out-oper':function(){return renderOutOperFull()}};
function renderPortfolioPage(){var id=currentStep;var fn=PORTFOLIO_PAGES[id];var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-3">'+badge('Ongoing','#6B4C8A')+' <span class="t-faint-sm">Live portfolio \u2014 the same record as the output page, from the dashboard</span></div>';
  h+=fn?fn():card('<p class="t-faint">No portfolio at this address.</p>');
  return h+'</div></div></div>'}
function outcomeNameOf(id){var nm=id;PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id===id)nm=o.name})});if(id==='out-devport')nm='Development Portfolio';if(id==='out-expbriefs')nm='Development Portfolio';return nm} /* an output's name as the sidebar gives it (Part I §2); the development portfolio's two ids and the post-review portfolio spelled out */
var DEPTHED_OUTPUTS={'out-bluesky':1,'out-explore':1,'out-expbriefs':1,'out-devport':1,'out-oper':1,'out-report':1}; /* the Portfolio Review is one document */ /* Org Readiness left the list 17 Sep 2026: one definitive version */ /* the register documents offer Summary / Full (Part I §5) */
/* ══ THE REGISTER DOCUMENTS (16 Sep 2026): the five portfolio outputs print as registers of the idea record, each up to its own stage, grouped as its page groups. Composed for paper: a cover, a row of figures, then the register ══ */
var PRINT_DOCS={ /* 17 Sep 2026 (Paul's ruling): the Blue Sky register prints the idea record (the idea card and its ranking); the four project registers print the project record — the idea card is superseded once an idea is a project, and the record is the project card's overview, analyses, and budget, then its brief, track, review, and operations */
 'out-bluesky':function(){var st=getStages(),ideas=data.ideas||[],depth=(UI.printDepth||'summary');var all=st.bluesky;var now=all.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=all.filter(function(i){return (ideas[i]||{}).when==='future'});
   var q=function(i){return ideaQual(i).state};var ranked=now.filter(function(i){return q(i)==='pass'}).sort(function(a,b){return triageScore(b)-triageScore(a)}),partly=now.filter(function(i){return q(i)==='partial'||q(i)==='none'}),disq=now.filter(function(i){return q(i)==='disq'});
   var groups=[{name:'Ranked',list:ideaRecs(ranked)},{name:'Not yet qualified',list:ideaRecs(partly)},{name:'Did not pass qualification',list:ideaRecs(disq)},{name:'Ideas for the future',list:ideaRecs(fut)}].filter(function(g){return g.list.length});
   return printDocCover('Blue Sky Portfolio','Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',all.length+' idea'+(all.length===1?'':'s')+' \u00b7 '+ranked.length+' ranked \u00b7 '+fut.length+' for the future')
    +erHeadLg('At a Glance','')+erFigRow([{v:all.length,l:'Ideas'},{v:ranked.length,l:'Ranked'},{v:disq.length,l:'Did not pass'},{v:fut.length,l:'For the future'}])
    +ideaBalanceBlock(now,'bluesky','Blue Sky Portfolio Balance')+'<div style="break-before:page;page-break-before:always">'+erHeadLg('The Ideas','')+lyRegister('idea',ideaRecs(ranked.concat(partly,disq,fut)),depth,IDEA_LAYER_INDEX.rank,groups)+'</div>'},
 'out-explore':function(){var st=getStages(),depth=(UI.printDepth||'summary'),pj=data.projects||{};var list=st.explore.concat(st.noGo||[]);
   var go=list.filter(function(i){return (pj[i]||{}).viable===true}),nogo=list.filter(function(i){return (pj[i]||{}).viable===false}),open=list.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
   var groups=[{name:'Go',list:ideaRecs(go)},{name:'Not yet decided',list:ideaRecs(open)},{name:'No-Go',list:ideaRecs(nogo)}].filter(function(g){return g.list.length});
   return printDocCover('Exploration Portfolio','The projects selected for exploration: each one\u2019s overview and verdict'+(depth==='full'?', its analyses, its portfolio position, and its budget':'')+'.',list.length+' idea'+(list.length===1?'':'s')+' \u00b7 '+go.length+' Go \u00b7 '+nogo.length+' No-Go')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'In exploration'},{v:go.length,l:'Go'},{v:open.length,l:'Not yet decided'},{v:nogo.length,l:'No-Go'}])
    +ideaBalanceBlock(list,'explore','Exploration Portfolio Balance')
    +projectCardGroups(groups,depth,erHeadLg('The Projects',''))} /* 17 Sep 2026 (Paul's ruling): the Exploration Portfolio prints its projects as cards \u2014 Summary the Overview card, every line, verdict and score on the name bar; Full two pages per project (overview, analyses, position; then the budget). No portfolio placement section in Summary */,
 'out-expbriefs':function(){var st=getStages(),depth=(UI.printDepth||'summary'),tk=data.tracking||{};var list=st.experiment;var by=function(sts){return list.filter(function(i){return sts.indexOf((tk[i]||{}).status||'')>=0})};
   var running=by(['running','alive']),complete=by(['complete']),paused=by(['paused','dormant']),killed=by(['killed','dead']),notStarted=list.filter(function(i){return !((tk[i]||{}).status)});
   var groups=[{name:'Running',list:ideaRecs(running)},{name:'Complete',list:ideaRecs(complete)},{name:'Not yet started',list:ideaRecs(notStarted)},{name:'Paused',list:ideaRecs(paused)},{name:'Killed',list:ideaRecs(killed)}].filter(function(g){return g.list.length});
   return printDocCover('Development Portfolio','The programs in development: each one\u2019s brief \u2014 owner, costs, timeline, success metric \u2014 and its track to date.',list.length+' program'+(list.length===1?'':'s')+' \u00b7 '+running.length+' running \u00b7 '+complete.length+' complete')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Programs'},{v:running.length,l:'Running'},{v:complete.length,l:'Complete'},{v:killed.length,l:'Killed'}])
    +ideaBalanceBlock(list,'experiment','Development Portfolio Balance')
    +projectStageGroups(groups,depth,'','dev',true)} /* 17 Sep 2026 (Paul's ruling): no document heading and no group headings \u2014 every program here is in development, so the cards follow the figures on their own page */ /* 17 Sep 2026 (Paul's ruling): the Exploration form applied \u2014 each program's development card (brief and track); Full adds the overview, analyses, position, and budget pages */,
 'out-finalport':function(){return portfolioReviewDoc()}, /* 17 Sep 2026 (Paul's ruling): the Portfolio Review */
 'out-oper':function(){var st=getStages(),depth=(UI.printDepth||'summary'),ops=data.opsData||{};var list=st.operational;var byH=function(h){return list.filter(function(i){return ((ops[i]||{}).health||'')===h})};var green=byH('green'),amber=byH('amber'),red=byH('red'),none=list.filter(function(i){return !((ops[i]||{}).health)});
   var groups=[{name:'Live Projects',list:ideaRecs(list)}]; /* 17 Sep 2026 (Paul's ruling): one list, not grouped by health */
   return printDocCover('Operational Portfolio','The projects live in the business: each one\u2019s health, launch date, and performance against its success metric, with the brief and development track behind it.',list.length+' live project'+(list.length===1?'':'s')+' \u00b7 '+green.length+' green \u00b7 '+amber.length+' amber \u00b7 '+red.length+' red')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Live projects'},{v:green.length,l:'Green',col:'#1B6B5A',vcol:'#1B6B5A'},{v:amber.length,l:'Amber',col:'#B8860B',vcol:'#B8860B'},{v:red.length,l:'Red',col:'#9B2D3F',vcol:'#9B2D3F'}])
    +ideaBalanceBlock(list,'operational','Operational Portfolio Balance')
    +projectStageGroups(groups,depth,'','ops',true)} /* 17 Sep 2026: likewise, no headings \u2014 every project here is live */ /* 17 Sep 2026: the operations card, health coloured as the page; Full adds the development card and the project pages */
};
PRINT_DOCS['out-devport']=PRINT_DOCS['out-expbriefs']; /* the development portfolio's second id */
function printCurrentOutput(){var id=currentStep;var fn=PRINT_DOCS[id];if(fn){printDocument(outcomeNameOf(id),fn(),'');return}UI._printing=1;var body='';try{body=renderOutcome()}finally{UI._printing=0}printPage(outcomeNameOf(id),function(){return body})} /* 16 Sep 2026: an output with a composed document prints it; one without prints its page under a cover, as the 12 Sep baseline did */
function outputPrintRow(id){return '<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 12px">'+(DEPTHED_OUTPUTS[id]?lyDepthCtl():'')+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>'} /* 16 Sep 2026: the family's print control on an output page — the Summary / Full choice where the document offers it, then Save as PDF */
/* ══ THE SINGLE-RECORD DOCUMENTS (round 3, 16 Sep 2026): the outputs that are not registers, composed for paper in the page's own words ══ */
function erStatement(text){var t=lyText(text);return '<div style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin:0 0 22px;font-family:var(--serif,Georgia,serif);font-size:16px;line-height:1.5;white-space:pre-line;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div>'} /* a statement block: the page's summary paragraph, set in the serif */
/* ══ THE ASSESSMENT PROFILE BLOCKS — Governance's apBlock / apStrip (copy-pass item 8, 21 Aug 2026, ruled by Paul), ported to the Innovation Pipeline 17 Sep 2026 on his ruling that the Assessment Report's Full version present its scored questions as the Governance profile does. The frame-plus-attributed-block law: authored copy frames; user text is quoted, never woven. Governance's teal is the Pipeline's own module blue here — the head accent, #076D9E in its light value (17 Sep 2026, Paul's ruling, after a detour through the orange); each block is unsplittable ══ */
function apBlock(q,v){var t=String(v==null?'':v).trim();
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 4px">'+q+'</div>'+(t?'<div style="white-space:pre-wrap;font-size:14px;line-height:1.55;padding:10px 14px;border-left:3px solid #076D9E55;background:rgba(7,109,158,.06)">'+esc(t)+'</div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
function apStrip(q,v,lo,hi){var has=(typeof v==='number'&&v>=1&&v<=5);var cells='';for(var i=1;i<=5;i++){cells+='<div class="ap-seg'+(has&&i===v?' on':'')+'" style="flex:1;height:8px;border-radius:4px;margin:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(has&&i===v?'#076D9E':'rgba(138,130,120,.22)')+'"></div>'}
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 6px">'+q+'</div>'+(has?'<div style="display:flex;align-items:center">'+cells+'</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:3px"><span>'+lo+'</span><span>'+hi+'</span></div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
function assessmentReportDoc(){var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{},au=data.audit||[];var depth=(UI.printDepth||'summary'),full=(depth==='full');
  var cultureItems=[{k:'uncertainty',l:'Uncertainty'},{k:'aiLegitimacy',l:'AI legitimacy'},{k:'newProposals',l:'New proposals'},{k:'incentives',l:'Incentives'},{k:'frontline',l:'Frontline'},{k:'overall',l:'Overall'}];var cs=cultureItems.map(function(x){return typeof cu[x.k]==='number'?cu[x.k]:0}).reduce(function(a,b){return a+b},0);
  var gaps=Object.keys(de).filter(function(q){return de[q]&&de[q].gap}).length;var appetite=(cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant';
  var summary='An organization with '+(k.usage==='none'||k.usage==='basic'?'limited':'moderate')+' AI capabilities and '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+' of 30), with '+gaps+' decision-rights gap'+(gaps===1?'':'s')+'.';
  var qs=[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}];
  var h=printDocCover('Assessment Report','Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.'+(full?' Every scored answer of the Assessment Battery follows.':''),'Culture '+cs+' / 30 \u00b7 '+gaps+' decision-rights gap'+(gaps===1?'':'s'));
  h+=erBlock(erHead('Executive Summary','')+erStatement(summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:cs+' / 30',l:'Culture score'},{v:appetite,l:'Risk appetite'},{v:gaps,l:'Decision gaps'}]));
  var dims=getAssessmentScores();
  h+=erBarBlock('Readiness Profile','Scored across the five Phase 1 dimensions',dims.map(function(d){return {l:d.name,v:d.score,max:5}}));
  h+='<style>'+PIPE_RADAR_CSS+'</style>'+erBlock('<div style="border:1px solid #ddd;border-radius:6px;padding:10px 16px 4px;margin:-8px auto 22px;max-width:460px">'+vizRadarLarge(dims)+'</div>'); /* 17 Sep 2026 (Paul's ruling): the radar from the foot of the output page, beneath its bars */
  if(full)h+=erBlock(erHead('Purpose and Direction','Every answer of section 1.1, in the organization\u2019s own words')+apBlock('Mission',p.mission)+apBlock('Values',p.values)+apBlock('Short-term targets',p.shortTerm)+apBlock('Medium-term targets',p.mediumTerm)+apBlock('Long-term targets',p.longTerm)+apBlock('Key goals',p.goals)+apBlock('Friction points',p.frictions)+'<div style="height:8px"></div>'); /* the block rule: a section that would be cut starts a new page */
  else h+=erSection('Purpose and Direction',lyRow('Mission',p.mission)+lyRow('Friction points',p.frictions));
  if(full){
    h+=erBlock(erHead('AI Knowledge Base','The four answers of section 1.2')+apBlock('Current usage',k.usage?lyCap(k.usage):'')+apStrip('Leadership awareness',k.awareness,'Unaware','Very aware')+apBlock('Technical resources',k.resources?lyCap(k.resources):'')+apBlock('Learning processes',k.learning?lyCap(k.learning):'')+'<div style="height:8px"></div>');
    var CU_ENDS={uncertainty:['Uncomfortable','Comfortable'],aiLegitimacy:['Stigma','Accepted'],newProposals:['Shut down','Support'],incentives:['Punish','Reward'],frontline:['None','Strong'],overall:['Stagnant','Innovative']}; /* the endpoints as the step\u2019s Likert scales give them */
    h+=erBlock(erHead('Risk and Culture','The six answers of section 1.3 \u2014 together '+cs+' of 30')+cultureItems.map(function(x){return apStrip(x.l,cu[x.k],CU_ENDS[x.k][0],CU_ENDS[x.k][1])}).join('')+'<div style="height:8px"></div>');
    h+=erBlock(erHead('AI Innovation Audit',au.length?au.length+' past initiative'+(au.length===1?'':'s')+' \u2014 section 1.4':'Section 1.4')+(au.length?'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+['Initiative','Status'].map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+au.map(function(a){return '<tr>'+[a.name,a.status?lyCap(a.status):''].map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Past initiatives','')+'</tbody></table>'));
  }
  if(full){var QT={q1:'Who can authorize a new experiment to start, including its budget?',q2:'Who decides that a successful experiment moves into serious development?',q3:'Who can move money between projects mid-year without a new budget round?',q4:'Who can stop a project that is not working?',q5:'Who can commit people from more than one function to the same initiative?'}; /* the step\u2019s own question texts */
    h+=erBlock(erHead('Decision Rights','The five answers of section 1.5'+(gaps?' \u2014 '+gaps+' gap'+(gaps===1?'':'s')+' noted':''))+qs.map(function(q){var dq=de[q.k]||{};return apBlock(QT[q.k],dq.who)}).join('')+apBlock('Recorded decision-rights gaps',qs.filter(function(q){return (de[q.k]||{}).gap}).map(function(q){return q.l+' \u2014 '+de[q.k].gap}).join('\n')))}
  else h+=erSection('Decision Rights',qs.map(function(q){var d=de[q.k]||{};return lyRowHtml(q.l,(d.who||'')+(d.gap?'<br>Gap: '+d.gap:''))}).join(''),gaps?gaps+' gap'+(gaps===1?'':'s')+' noted':'');
  return h} /* 17 Sep 2026 (Paul's ruling): Summary as before plus the radar; Full prints every scored answer of the Assessment Battery \u2014 the seven purpose fields, the four knowledge answers, the six culture answers as bars, the innovation audit as a table \u2014 the Governance assessment document's form */
function orgReadinessDoc(){var M=orgReadinessModel();var ow=M.ow,inc=M.inc;
  var h=printDocCover('Org Readiness','How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, who backs it, how incentives are changing, and the rhythm the work keeps.',M.done+' of '+M.chk.length+' readiness checks complete');
  h+=erBlock(erHead('Summary','')+erStatement(M.summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:M.leads.length,l:'Embedded leads'},{v:M.metrics.length,l:'Innovation metrics'},{v:M.done+' / '+M.chk.length,l:'Readiness checks'}]));
  var tick=function(d){return '<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;text-align:center;font-size:11px;font-weight:700;'+(d?'background:#111;color:#fff':'border:1.5px solid #999;color:#999')+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+(d?'\u2713':'')+'</span>'};
  h+=erSection('Organizational Readiness',M.chk.map(function(c){return '<tr><td style="width:30px;padding:7px 0 7px 2px;border-bottom:1px solid #eee;vertical-align:top">'+tick(c.d)+'</td><td style="padding:6px 10px 7px 4px;border-bottom:1px solid #eee;vertical-align:top"><div style="font-size:12.5px;font-weight:600;color:'+(c.d?'#111':'#555')+'">'+esc(c.l)+'</div><div style="font-size:11.5px;line-height:1.45;color:#555;margin-top:2px">'+esc(c.ev)+'</div></td></tr>'}).join(''),M.done+' of '+M.chk.length+' complete'); /* 17 Sep 2026 (Paul's ruling): a checklist on paper too \u2014 a tick per check met, the record beneath each, the count in the sub-line */
  var tbl=function(rows,cols){return '<table style="width:100%;border-collapse:collapse;margin:0 0 14px"><thead><tr>'+cols.map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'};
  h+=erBlock(erHead('Pipeline Owner','')+apBlock('Name',ow.ownerName)+apBlock('Role',ow.ownerRole)+apBlock('Authority',ow.authority)+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Embedded Leads',M.leads.length?M.leads.length+' lead'+(M.leads.length===1?'':'s')+' \u2014 one per department that runs experiments':'')+(M.leads.length?tbl(M.leads.map(function(l){return [l.name,l.dept]}),['Lead','Department']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Engaged Senior Leaders',M.seniors.length?M.seniors.length+' executive'+(M.seniors.length===1?'':'s')+' who visibly back the pipeline':'')+(M.seniors.length?tbl(M.seniors.map(function(l){return [l.name,l.role]}),['Executive','Position']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Realigned Incentives','')+apBlock('Current structure',inc.current)+apBlock('Proposed changes',inc.changes)+apBlock('Innovation metrics',M.metrics.join('\n'))+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Innovation Rhythm','')+apBlock('Session',M.session)+apBlock('Attendees',M.att.join('\n'))+apBlock('Standing agenda',M.agenda.join('\n'))+'<div style="height:8px"></div>');
  return h} /* 17 Sep 2026 (Paul's ruling): one definitive version \u2014 the Full of the day before, which added little and was not overwhelming; no Summary / Full. The checklist is a checklist on paper; the step numbers and the meta phrase are gone */
/* ══ ORG READINESS (17 Sep 2026, Paul's ruling): one model for the page and the document. The three steps' record — Ownership & Structure (owner, embedded leads, engaged senior leaders), Realign Incentives (current structure, proposed changes, metrics), Innovation Rhythm (session, attendees, agenda) — and the seven readiness checks, each carrying the record that satisfies it or what is missing. Summary is the checks and the record's main facts; Full is every field in the organization's own words and the checks with their evidence ══ */
function orgReadinessModel(){var ow=data.ownership||{},inc=data.incentives||{},rh=data.rhythm||{};var leads=(ow.leads||[]).filter(function(l){return l&&(l.name||l.dept)}),seniors=(ow.seniors||[]).filter(function(l){return l&&(l.name||l.role)});var att=rhAttNames(),agenda=rhAgList(),metrics=(inc.metrics||[]).filter(Boolean);var deep=!!(data.completedSteps||{})['2.4'];
  var session=rh.day?'Every '+rh.day+(rh.time?' at '+rh.time:''):'';
  var chk=[
   {l:'Pipeline owner named with explicit authority',d:!!ow.ownerName&&!!ow.authority,ev:ow.ownerName?(ow.ownerName+(ow.ownerRole?', '+ow.ownerRole:'')+(ow.authority?': '+ow.authority:' \u2014 no authority stated')):'No owner named'},
   {l:'At least one embedded lead assigned',d:leads.length>=1&&!!leads[0].name,ev:leads.length?leads.length+' lead'+(leads.length===1?'':'s')+': '+leads.map(function(l){return (l.name||'Unnamed')+(l.dept?' ('+l.dept+')':'')}).join(', '):'No embedded lead yet'},
   {l:'Incentive structure addresses experimentation',d:!!inc.changes,ev:inc.changes||'No proposed changes recorded'},
   {l:'Innovation metrics selected (2+)',d:metrics.length>=2,ev:metrics.length?metrics.length+' metric'+(metrics.length===1?'':'s')+': '+metrics.join(', ')+(metrics.length<2?' \u2014 one more needed':''):'No metrics selected'},
   {l:'Weekly innovation session scheduled',d:!!rh.day&&att.length>0,ev:rh.day?session+(att.length?', '+att.length+' attendee'+(att.length===1?'':'s'):' \u2014 no attendees named'):'No day set'},
   {l:'Standing agenda defined',d:agenda.length>0,ev:agenda.length?agenda.join('; '):'No agenda items'},
   {l:'First deep assessments completed',d:deep,ev:deep?'Step 2.4 marked complete':'Not yet: step 2.4 is not marked complete'}];
  var done=chk.filter(function(c){return c.d}).length;
  var summary=(ow.ownerName?ow.ownerName+(ow.ownerRole?' ('+ow.ownerRole+')':'')+' owns the pipeline. ':'No pipeline owner is named yet. ')+leads.length+' embedded lead'+(leads.length===1?'':'s')+'. '+(rh.day?'Innovation rhythm: every '+rh.day+(rh.time?' at '+rh.time:'')+'. ':'No innovation rhythm set. ')+(inc.changes?'Incentives realigning.':'Incentives not yet realigned.');
  return {ow:ow,inc:inc,rh:rh,leads:leads,seniors:seniors,att:att,agenda:agenda,metrics:metrics,session:session,chk:chk,done:done,pct:Math.round(done/chk.length*100),summary:summary}}
function govFrameworkDoc(){var gov=data.governance||{};
  var h=printDocCover('Governance Framework','The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.','');
  var summary='Governance embedded across three mechanisms: a standing agenda in '+(gov.meeting||'the leadership meeting')+', gate reviews above '+(gov.threshold||'the intake threshold')+', and quarterly reviews from '+(gov.firstReview||'a date not yet set')+'.';
  h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid rgba(155,45,63,.2);background:rgba(155,45,63,.04);border-radius:8px;padding:14px 18px;margin:0 0 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9B2D3F;margin:0 0 6px">Executive Summary</div><div style="font-size:14px;line-height:1.55;color:#111">'+esc(summary)+'</div></div>';
  var pillars=[{t:'Standing Leadership Agenda',c:'#1B6B5A',items:[['Embedded in',gov.meeting],['Metrics',gov.metrics],['Format',gov.format]]},{t:'Pipeline Intake Rule',c:'#2D5A8E',items:[['Threshold',gov.threshold],['Review process',gov.gateProcess],['Outside-pipeline audit',gov.outsideAudit]]},{t:'Quarterly Review',c:'#8B5E3C',items:[['Attendees',gov.reviewAttendees],['Agenda',gov.reviewAgenda],['First review',gov.firstReview]]}];
  pillars.forEach(function(p){h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:3px solid '+p.c+';border-radius:8px;padding:12px 16px;margin:0 0 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111;margin:0 0 8px">'+p.t+'</div>'+p.items.map(function(it){var t=lyText(it[1]);return '<div style="display:flex;gap:14px;padding:5px 0;border-top:1px solid #eee"><div style="font-family:var(--mono,monospace);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:'+p.c+';min-width:130px;padding-top:2px">'+it[0]+'</div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'</div>'});
  return h} /* 17 Sep 2026 (Paul's ruling): a one-pager of the page's own cards \u2014 the executive summary card and the three mechanism cards with their coloured rules and mono labels \u2014 rather than the question-and-answer form */
function orgDesignReviewDoc(){var st=data.stress||{};var areas=[{k:'decisions',l:'Decision rights'},{k:'ownership',l:'Ownership model'},{k:'incentives',l:'Incentive changes'},{k:'culture',l:'Culture shift'}];var plan=(st.tuningList||[]).filter(function(t){return t});
  var scored=areas.filter(function(a){return st[a.k+'Score']});var avg=scored.length?(scored.reduce(function(s2,a){return s2+(+st[a.k+'Score']||0)},0)/scored.length):0;
  var h=printDocCover('Org Design Review','The stress test of the organization\u2019s design after the first cycle: how decision rights, the ownership model, the incentive changes, and the culture shift are holding, and the adjustments planned.',scored.length?'Average '+avg.toFixed(1)+' / 5 across '+scored.length+' area'+(scored.length===1?'':'s'):'');
  var box=function(a){var t=lyText(st[a.k]),sc=+st[a.k+'Score']||0;return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:#111">'+esc(a.l)+'</div><div style="padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':sc?'rgba(155,45,63,.06)':'#f4f4f4')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':sc?'#9B2D3F':'#888')+'">'+(sc?sc+'/5':'\u2014')+'</div></div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></td>'};
  h+=erHead('The Stress Test','Each area scored out of 5, as the page shows them');
  [[0,1],[2,3]].forEach(function(pair){h+=erBlock('<table style="width:calc(100% + 16px);margin:0 -8px 8px;border-collapse:separate;border-spacing:8px 0"><tr>'+box(areas[pair[0]])+box(areas[pair[1]])+'</tr></table>')}); /* 16 Sep 2026 (Paul's Decision Analyses ruling applied here): the page's four boxes kept on paper, two rows of two, each unsplittable, the score chip coloured as on the page */
  h+='<div style="height:8px"></div>';
  h+=erSection('Adjustment Plan',plan.length?lyList('Adjustments',plan.map(function(t,i){return (i+1)+'. '+t})):lyRow('Adjustments',''),plan.length?plan.length+' adjustment'+(plan.length===1?'':'s'):'');
  return h}
function raciDoc(opts){opts=opts||{};ensureRaciModel();var raci=data.raci||{},cols=raciCols();var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
  var th='font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:2px solid #111;padding:8px 8px';
  var pchip=function(v){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+RACI_COLORS[v]+';color:#fff;font-size:13px;font-weight:700;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact">'+v+'</span>'}; /* the chip as it prints */
  var tbl='<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;'+th+'">Activity</th>'+cols.map(function(c){return '<th style="text-align:center;'+th+'">'+esc(c.l)+'</th>'}).join('')+'</tr></thead><tbody>'+acts.map(function(a,ai){return '<tr><td style="padding:9px 8px;border-bottom:1px solid #ddd;font-size:12.5px;font-weight:600;color:#111">'+esc(a)+'</td>'+cols.map(function(c){var v=raci[ai+':'+c.k]||'';return '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid #ddd">'+(v?pchip(v):'<span style="color:#bbb;font-size:13px">\u2014</span>')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  var key=_raciLegend(RACI_COLORS).replace('color:var(--text-faint)','color:#555').replace(/-webkit-print-color-adjust|print-color-adjust/g,'').replace(/border-radius:8px;background:/g,'border-radius:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:');
  return printDocCover('RACI Matrix','Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities, as set at Step 2.1.',cols.length+' role'+(cols.length===1?'':'s')+' \u00b7 7 activities')
   +'<style>.raci-land{page:raciland;break-before:page;page-break-before:always;width:990px;margin-left:0;display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 15vh)}@page raciland{size:landscape;margin:8mm 8mm 14mm 8mm}@media print and (max-width:800px){.raci-land{width:1058px}}</style><div class="raci-land">'+(opts.sectionHead||'')+erHead('RACI Matrix','')+tbl+key+'</div>'} /* the matrix sits centred on its landscape page, as Governance's does (12 Sep 2026) */ 
var CAP_HUB_TABS=['Dashboard','Commitments','Plan & Funding']; /* the Capital Planning Hub\u2019s three tabs, as the page names them */
var PIPE_RADAR_CSS='.viz-radar{text-align:center;padding:8px 0}.viz-radar-svg{width:100%;max-width:520px;height:auto}'; /* the radar's two layout rules, from the stylesheet, for paper */
var PIPE_CHART_CSS='.user-av{border-radius:50%; display:inline-flex;align-items:center;justify-content:center; font-family:var(--mono);font-weight:700;letter-spacing:0; flex-shrink:0;line-height:1}.analytics-grid-2{display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px}.chart-card{padding: 24px; background: rgba(var(--fg-rgb),.025); border: 1px solid rgba(var(--fg-rgb),.08); display: flex; flex-direction: column}.chart-card-wide{grid-column: 1 / -1; margin-bottom: 16px}.chart-card-wide:last-child{margin-bottom: 0}.chart-title{font-family: var(--mono); font-size: 12px; letter-spacing: .15em; text-transform: uppercase; color: var(--paper); margin-bottom: 18px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap}.chart-subtitle{font-family: var(--sans); font-size: 12px; text-transform: none; letter-spacing: .01em; color: var(--stone); font-weight: 400}.chart-empty{padding: 32px 0; text-align: center; font-size: 13px; color: var(--stone); font-style: italic}.chart-donut-wrap{display: flex; align-items: center; gap: 24px; flex-wrap: wrap}.chart-donut-svg{width: 200px; height: 200px; flex-shrink: 0}.chart-legend{flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 8px}.chart-legend-row{display: grid; grid-template-columns: 12px 1fr auto auto; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(var(--fg-rgb),.04); font-family: var(--sans); font-size: 13px}.chart-legend-row:last-child{border-bottom: none}.chart-legend-dot{width: 10px; height: 10px; border-radius: 50%}.chart-legend-name{color: var(--paper)}.chart-legend-val{font-family: var(--mono); font-weight: 700; font-size: 14px}.chart-legend-pct{font-family: var(--mono); font-size: 11px; color: var(--stone); min-width: 38px; text-align: right}.cap-split-labels{display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-end}.cap-split-side .cap-split-pct{font-family: var(--serif); font-size: 42px; font-weight: 300; line-height: 1}.cap-split-side .cap-split-name{font-family: var(--mono); font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-top: 4px}.cap-split-right{text-align: right}.cap-split-bar{display: flex; height: 14px; background: rgba(var(--fg-rgb),.06); border-radius: 7px; overflow: hidden; margin-bottom: 14px}.cap-split-fill{height: 100%; transition: width .4s ease}.cap-split-foot{font-family: var(--sans); font-size: 12px; color: var(--stone); margin-top: 4px}.chart-bubble-svg{width: 100%; height: auto; max-height: 360px; display: block; margin-bottom: 16px}.bubble-legend{display: flex; gap: 32px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid rgba(var(--fg-rgb),.06)}.bubble-legend-group{display: flex; align-items: center; gap: 12px; flex-wrap: wrap}.bubble-legend-lbl{font-family: var(--mono); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-right: 4px}.bubble-legend-item{display: inline-flex; align-items: center; gap: 6px; font-family: var(--sans); font-size: 12px; color: var(--paper)}.bubble-legend-dot{width: 10px; height: 10px; border-radius: 50%}.bubble-priority-dot{border-radius: 50%; background: rgba(232,98,26,.6); border: 1px solid var(--gold)}.status-rows{display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px}.status-row{display: grid; grid-template-columns: 120px 1fr 30px; align-items: center; gap: 12px}.status-row-label{font-family: var(--sans); font-size: 14px; font-weight: 600}.status-row-bar{display: flex; height: 24px; gap: 2px; background: rgba(var(--fg-rgb),.04); border: 1px solid rgba(var(--fg-rgb),.06)}.status-seg{display: flex; align-items: center; justify-content: center; min-width: 2px; transition: filter .15s}.status-seg-n{font-family: var(--mono); font-size: 11px; font-weight: 700; color: #fff}.status-row-total{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.owner-rows{display: flex; flex-direction: column; gap: 8px}.owner-row{display: grid; grid-template-columns: 32px 160px 1fr 30px; align-items: center; gap: 12px}.owner-row-av{display: flex; justify-content: center}.owner-row-name{font-family: var(--sans); font-size: 13px; color: var(--paper)}.owner-row-bar{height: 12px; background: rgba(var(--fg-rgb),.05); border-radius: 6px; overflow: hidden}.owner-row-fill{height: 100%; border-radius: 6px; transition: width .4s ease}.owner-row-n{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.status-row{grid-template-columns: 90px 1fr 30px}.owner-row{grid-template-columns: 28px 110px 1fr 24px}.cap-split-side .cap-split-pct{font-size: 32px}.chart-card{break-inside:avoid;page-break-inside:avoid}'; /* 16 Sep 2026 (Paul's ruling): the dashboard's five charts print; their layout rules come from the stylesheet as the Capital Snapshot's do (CAP_REPORT_CSS), with each chart card unsplittable */
function _pdFormsToText(html){ /* 16 Sep 2026: a page that is a form prints its values as text — a select as its chosen option, an input as its value, a textarea as its content — and no handler survives */
  return html.replace(/<select[^>]*>([\s\S]*?)<\/select>/g,function(m,inner){var sel=inner.match(/<option[^>]*\sselected[^>]*>([^<]*)<\/option>/);var first=inner.match(/<option[^>]*>([^<]*)<\/option>/);var v=(sel?sel[1]:(first?first[1]:'')).trim();return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/<textarea[^>]*>([\s\S]*?)<\/textarea>/g,function(m,inner){return '<span>'+(inner.trim()||'\u2014')+'</span>'})
  .replace(/<input([^>]*)>/g,function(m,attrs){var v=(attrs.match(/\svalue="([^"]*)"/)||[])[1]||'';var t=(attrs.match(/\stype="([^"]*)"/)||[])[1]||'text';if(t==='checkbox'||t==='radio')return /\schecked/.test(attrs)?'\u2713':'\u2014';return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/ on(click|change|input|keyup|blur)="[^"]*"/g,'')}

function capHubDoc(){var tab=UI.hubTab||0;var body='';UI._printing=1;try{body=renderCapHub()}finally{UI._printing=0}
  return printDocCover('Capital Planning Hub \u2014 '+CAP_HUB_TABS[tab],'The portfolio\u2019s committed costs and remaining budget as they stand: the '+CAP_HUB_TABS[tab]+' view, every figure calculated from the projects themselves.','')+_pdFormsToText(_pdStrip(body))} /* the tab showing prints as its own document under a cover \u2014 Governance\u2019s Compliance Dashboard pattern (Rollout Guide Part II) */
function printCapHub(){printDocument('Capital Planning Hub',capHubDoc(),'')}
/* ══ THE CAPITAL SANDBOX ON PAPER (17 Sep 2026, Paul's ruling): the sandbox prints the scenario it shows — the standing baseline with whatever batch is ticked stacked on top — so different combinations print as different documents. Nothing here is a commitment; the title says so ══ */
function capSandboxDoc(){var ideas=data.ideas||[],stages=getStages(),proj=data.projects||{};var goP=stages.explore.filter(function(i){return (proj[i]||{}).viable===true});if(!UI.capSim)UI.capSim={};var sel=goP.filter(function(i){return UI.capSim[i]});
  var toExp=0;sel.forEach(function(i){toExp+=devCost(i)});var have=!!orgMonthly();var pmNow=have?progMonthOf(new Date()):null;var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
  var extras=sel.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return {i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});var br=have?capBreaches(extras):{};
  var title=sel.length?'Staged batch ('+sel.length+')':'The standing baseline';
  var h=printDocCover('Capital Sandbox','A capital expenditure scenario staging a specified batch of projects.',sel.length?sel.length+' candidate'+(sel.length===1?'':'s')+' staged \u00b7 '+fmtMoney(toExp)+' committed on advancing':'Nothing staged'); /* 17 Sep 2026 (Paul's ruling): the cover as he gave it */
  var th=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,r){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;vertical-align:top;'+(r?'text-align:right;white-space:nowrap':'')+'">'+v+'</td>'};
  var rows=function(list){return list.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;var start=have?('Month '+((a2!=null&&a2>=1)?a2:aAss)+(sd?'':' (assumed)')):(sd?lyDate(sd):'Next month');return '<tr>'+td('<b>'+esc((ideas[i]||{}).name)+'</b>')+td(getScore(i)+' / 50',true)+td(fmtMoney(devCost(i)),true)+td(fmtMoney(opsRolloutCost(i)),true)+td(fmtMoney(opsSustainCost(i))+'/yr',true)+td(start)+'</tr>'}).join('')};
  var tbl=function(list){return '<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Candidate')+th('Score',true)+th('Development',true)+th('Rollout',true)+th('Sustainment',true)+th('Start')+'</tr></thead><tbody>'+rows(list)+'</tbody></table>'};
  if(sel.length)h+=erBlock(erHead('The Staged Batch',sel.length+' of '+goP.length+' Go candidates ticked \u2014 unless dated, each is assumed to start next month (program Month '+aAss+')')+tbl(sel)+'<p style="font-size:11.5px;color:#333;margin:0 0 22px">Committed on advancing: <b>'+fmtMoney(toExp)+'</b> \u2014 the full plans, reflected across the years they touch.</p>');
  else h+=erBlock(erHead('The Staged Batch','Nothing ticked \u2014 the pages that follow show the committed portfolio alone')+(goP.length?'<p style="font-size:11.5px;color:#333;margin:0 0 6px">The Go candidates available to stage:</p>'+tbl(goP):'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 22px">No Go candidates yet \u2014 Go projects from Exploration appear here with their costs.</p>'));
  if(!have)return h+erBlock(erHead('On the Calendar','')+'<p style="font-size:12px;color:#888;font-style:italic">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>');
  var strip=function(x){return String(x||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;display:block" ')};
  var verdict=sel.length?(br.overCapMonth?'<p style="font-size:12px;color:#9B2D3F;margin:8px 0 0">\u26A0 With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth+'. A funding plan would be required at Commit &amp; Advance.</p>':'<p style="font-size:12px;color:#333;margin:8px 0 0">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'';
  h+=erBlock(erHead('On the Calendar',sel.length?'The standing baseline with the staged batch stacked on top':'The standing baseline')+strip(orgWaterfallChart(extras))+verdict);
  h+=erBlock(erHead('Cumulative Commitments Against Capacity','')+strip(orgCumChart(extras)));
  h+=erBlock(erHead('The Committed Calendar',sel.length?'Swimlanes, the staged batch included':'Swimlanes')+strip(orgSwimlanes(extras)));
  var L=capLens(extras.length?extras:null);var k=function(v){return (v<0?'\u2212':'')+'$'+Math.round(Math.abs(v)/1000).toLocaleString('en-US')+'K'};var anyKill=L.years.some(function(r){return r.killPot});
  var yth=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var ytd=function(v,r,c){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;'+(r?'text-align:right;white-space:nowrap;font-family:var(--mono,monospace);':'')+(c?'color:'+c+';font-weight:700;':'')+'">'+v+'</td>'};
  var yrow=function(lbl,r,bold){return '<tr>'+ytd(bold?'<b>'+lbl+'</b>':lbl)+ytd(k(r.budget),true)+ytd(k(r.committed),true)+(anyKill?ytd(r.killPot?k(r.killPot):'\u2014',true):'')+ytd(k(r.available),true,r.available<0?'#9B2D3F':'#1B6B5A')+'</tr>'};
  h+='<div style="height:22px"></div>'+erBlock(erHead('The Years','Budget, committed cost, and what remains in each year of the planning window'+(sel.length?', with the staged batch included':''))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+yth('Year')+yth('Budget',true)+yth('Committed',true)+(anyKill?yth('Kill & phase-out',true):'')+yth('Available',true)+'</tr></thead><tbody>'+L.years.map(function(r){return yrow('Year '+r.y,r)}).join('')+yrow('Total \u2014 '+L.years.length+' years',L.tot,true)+'</tbody></table>'); /* 17 Sep 2026 (Paul's ruling): a line per year and the total, in exact thousands so the arithmetic reads; the screen widget's one-year view and its paragraphs are gone */
  if(sel.length&&br.overCapMonth){ /* 17 Sep 2026 (Paul's ruling, on the chat's refinement): a funding plan is written for the batch that breaches, so it prints with that batch */
    var fl=fundLines(),ovs=((data.capital||{}).overrides||[]);var ytx=orgYearTotals()||[];var gaps=ytx.filter(function(r){return r.budgetSet&&r.headroom<0}).map(function(r){return 'Year '+r.y+': '+fmtMoney(-r.headroom)});
    var lines=fl.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 8px"><thead><tr>'+th('Source')+th('Amount',true)+th('Year')+th('Project')+th('Status')+'</tr></thead><tbody>'+fl.map(function(r){var auth=r.st==='auth';return '<tr>'+td(esc(r.d||'')||'<span style="color:#888;font-style:italic">Not recorded</span>')+td(fmtMoney(costNum(r.a)),true)+td('Year '+esc(String(r.y||'1')))+td(esc(r.proj||'')||'\u2014')+td(auth?'Authorized'+(r.at?' \u00b7 '+fmtDate(r.at):'')+(r.by?' \u00b7 '+esc(r.by):''):'Planned')+'</tr>'}).join('')+'</tbody></table>':'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 8px">No funding lines recorded yet.</p>';
    var ov=ovs.length?'<div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:10px 0 4px">Overrides on record</div>'+ovs.map(function(o){return '<div style="font-size:12px;color:#111;margin:0 0 3px">'+esc(o.reason||'')+' <span style="color:#555">\u2014 month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join(''):'';
    h+=erBlock(erHead('Capacity Breach Funding Plan','With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth)+(gaps.length?'<p style="font-size:12px;color:#333;margin:0 0 8px">The funding gap on the committed calendar \u2014 '+gaps.join(' \u00b7 ')+'. The lines below are the sources that answer it.</p>':'<p style="font-size:12px;color:#333;margin:0 0 8px">The committed calendar itself sits inside its budget. The funding breach comes from the staged batch. The items below identify additional sources that may be drawn on to cover the funding breach, or that have been identified so far.</p>' /* 17 Sep 2026: Paul's copy, verbatim */)+lines+ov)}
  return h}
function printCapSandbox(){printDocument('Capital Sandbox',capSandboxDoc(),'')}
/* ══ PHASE 5 DOCUMENTS (round 4, 16 Sep 2026): the Pipeline Dashboard composed for paper; the Module Management document as Governance and ER print it; the print dispatch for the Phase 5 pages ══ */
function pipelineDashboardDoc(){var ideas=data.ideas||[],st=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{},ops=data.opsData||{},pj=data.projects||{};var m=getPipelineMaturity();var att=rhAttNames();
  var css='<style>.gd-doc .gd-sec{font-size:22px;font-weight:800;color:#111;margin:0 0 14px}.gd-doc .gd-sec+.gd-sec{margin-top:26px}.gd-doc .gd-sub{font-size:17px;font-weight:700;color:#111;margin:18px 0 10px;break-after:avoid;page-break-after:avoid}.gd-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:180px;height:117px}.gd-doc .t-faint-sm{font-size:12px;color:#555}.gd-rev3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 14px}.gd-rev{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;break-inside:avoid}.gd-rev-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;line-height:1.35;min-height:32px}.gd-rev-v{font-size:19px;font-weight:800;margin-top:4px}.gd-rev-d{font-size:12px;color:#555;margin-top:2px}.gd-doc table.gd-sys{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 6px}.gd-doc table.gd-sys th{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111;padding:6px 8px;text-align:left}.gd-doc table.gd-sys td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}.gd-doc .gd-sys .bg{margin-right:4px;font-size:11px;padding:2px 8px}.gd-arch{font-size:12px;color:#555;margin:4px 0 0}.gd-dom{font-size:16px;font-weight:700;color:#111;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.gd-dom span{font-weight:400;color:#666;font-size:12px}.gd-none{font-size:12.5px;color:#666;font-style:italic;padding:4px 0}.gd-alert{border:2px solid #9B2D3F;color:#9B2D3F;font-weight:700;font-size:14px;padding:8px 12px;border-radius:6px;margin:0 0 14px}.gd-doc .u-778010b{display:flex;align-items:center;gap:0;margin:0 0 18px}.gd-doc .phase-flex{flex:1;opacity:var(--op)}.gd-doc .u-0cc49e2{width:100%;height:70px}.gd-lane{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}.gd-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.gd-subh{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 2px}.gd-gl{break-inside:avoid;page-break-inside:avoid;margin:0 0 6px}.gd-gl .gd-dom{font-size:15px;margin:10px 0 2px}.gd-gl-p{font-size:13px;line-height:1.6;margin:2px 0 0;color:#111}.gd-lane-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}.gd-lane-h h3{font-size:15px;font-weight:700;margin:0}.gd-lane .bg{font-size:11px;padding:2px 8px;margin-left:4px}.gd-warn{font-size:11px;font-weight:600;color:#C8860A;margin:0 0 4px}.gd-item{font-size:12.5px;color:#222;padding:3px 0;border-bottom:1px solid #eee}.gd-doc .analytics-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}.gd-doc .chart-card{border:1px solid #ddd;border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}.gd-doc .chart-title{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#111;margin:0 0 12px}.gd-doc .chart-empty{padding:24px 0;text-align:center;font-size:12px;color:#666;font-style:italic}.gd-doc .chart-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.gd-doc .chart-donut-svg{width:150px;height:150px;flex-shrink:0}.gd-doc .chart-legend{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px}.gd-doc .chart-legend-row{display:grid;grid-template-columns:12px 1fr auto auto;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px}.gd-doc .chart-legend-dot{width:10px;height:10px;border-radius:50%}.gd-doc .chart-legend-name{color:#111}.gd-doc .chart-legend-val{font-family:var(--mono,monospace);font-weight:700;font-size:13px}.gd-doc .chart-legend-pct{font-family:var(--mono,monospace);font-size:11px;color:#555;min-width:34px;text-align:right}.gd-doc svg{max-width:100%}</style>'; /* Governance's dashboard stylesheet, verbatim (dashboardDoc, 14 Sep 2026) */
  var h=printDocCover('Pipeline Dashboard','Pipeline maturity, the next session and reviews, the live projects, and the four portfolios as they stand today.','');
  h+=css+'<style>'+PIPE_CHART_CSS+'</style><div class="gd-doc">';
  /* page one: Pipeline Overview \u2014 the coverage card as govCoverageCard draws it (gauge, score, label; the bars beside), the three cadence cards, the live projects */
  h+='<div style="break-after:page;page-break-after:always">';
  h+='<div class="gd-sec">Pipeline Overview</div>';
  /* the page's own maturity row and its two cards (17 Sep 2026, Paul's ruling: as the dashboard page draws them, nothing added) */
  h+='<style>.gd-doc .viz-dash-row{display:grid;grid-template-columns:240px 1fr;gap:32px;align-items:center;padding:24px;margin-bottom:24px;border:1px solid #ddd;border-radius:6px;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:200px;height:130px;max-width:100%}.gd-doc .viz-gauge-score{font-family:var(--serif);font-size:36px;font-weight:300;margin-top:-8px;line-height:1}.gd-doc .viz-gauge-denom{font-size:18px;color:#4E5A68;font-weight:300;margin-left:2px}.gd-doc .viz-gauge-label{font-family:var(--mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#4E5A68;margin-top:8px}.gd-doc .viz-dim-bars{display:flex;flex-direction:column;gap:12px}.gd-doc .viz-dim-row{display:grid;grid-template-columns:120px 1fr 50px;align-items:center;gap:14px}.gd-doc .viz-dim-name{font-family:var(--sans);font-size:14px;font-weight:500;color:#1E2530}.gd-doc .viz-dim-track{height:10px;background:rgba(30,37,48,.06);border-radius:5px;overflow:hidden}.gd-doc .viz-dim-fill{height:100%;border-radius:5px}.gd-doc .viz-dim-val{font-family:var(--mono);font-size:13px;font-weight:700;text-align:right}.gd-doc .gr-2-mb{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.gd-doc .cd{border-radius:6px;padding:16px 18px;margin:0;break-inside:avoid;page-break-inside:avoid}.gd-doc .u-49c8739{font-size:14px;font-weight:700;color:#6B4C8A;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-ac07cd3{font-size:20px;font-weight:800;color:#6B4C8A}.gd-doc .u-a4cb65d{font-size:13px;color:#64707E;margin-top:4px}.gd-doc .u-efdcc60{font-size:14px;font-weight:700;color:#9B2D3F;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-e48f6d6{font-size:20px;font-weight:800;color:#9B2D3F}</style>';
  h+='<div class="viz-dash-row">'+vizHealthGauge(m)+vizDimBars()+'</div>';
  h+='<div class="gr-2-mb">'+card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(rh.duration||30)+' min \xb7 '+(att.length?att.map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)')+card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+esc(gov.firstReview||'TBD')+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)')+'</div>';
  var live=(st.operational||[]);
  h+='<div class="gd-sub">Operational Projects <span style="font-weight:400;color:#666;font-size:12px">('+live.length+')</span></div>';
  if(live.length){h+='<table class="gd-sys"><thead><tr><th style="width:34%">Project</th><th>Function</th><th style="width:22%">Status</th></tr></thead><tbody>';
    live.forEach(function(i){var killed=(trk[i]||{}).status==='killed';var hh=(ops[i]||{}).health;var col=killed?'#9B2D3F':({green:'#1B6B5A',amber:'#C8860A',red:'#9B2D3F'}[hh]||'#555');var word=killed?'Killed':hh?(hh==='green'?'On track':hh==='amber'?'Watch':'At risk'):'Health not reported';
      h+='<tr><td style="font-weight:600;color:#111">'+esc((ideas[i]||{}).name||'Unnamed project')+'</td><td>'+((ideas[i]||{}).desc?esc((ideas[i]||{}).desc):'<span style="color:#999">Not recorded</span>')+'</td><td style="font-weight:700;color:'+col+'">'+word+'</td></tr>'}); /* the status as coloured text: the page\u2019s badge class does not reach the print window */
    h+='</tbody></table>'}else h+='<div class="gd-none">No projects live yet.</div>';
  h+='</div>';
  /* page two: The Pipeline \u2014 the notice, the chevrons, the four portfolios as lanes; then Portfolio at a Glance follows at once */
  var stages=[{k:'bluesky',t:'Blue Sky',items:st.bluesky,col:'#1B6B5A'},{k:'explore',t:'Exploration',items:(st.explore||[]).concat(st.noGo||[]),col:'#2D5A8E'},{k:'experiment',t:'Development',items:st.experiment||[],col:'#8B5E3C'},{k:'operate',t:'Operational',items:st.operational||[],col:'#9B2D3F'}];
  h+='<div style="break-before:page;page-break-before:always"></div>'; /* 17 Sep 2026 (Paul's ruling): the pipeline starts on its own page, unlabelled */
  var reds=live.filter(function(i){return (ops[i]||{}).health==='red'&&(trk[i]||{}).status!=='killed'});if(reds.length)h+='<div class="gd-alert">\u26a0 '+reds.length+' operational project'+(reds.length===1?'':'s')+' at risk</div>';
  var chev=function(x,i){return '<div class="phase-flex" style="--op:1"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+x.col+'"/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+esc(x.t)+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="rgba(255,255,255,.92)" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+x.items.length+' item'+(x.items.length===1?'':'s')+'</text></svg></div>'};
  h+='<div class="u-778010b">'+stages.map(chev).join('')+'</div>';
  var cols=function(list){var half=Math.ceil(list.length/2);var col=function(l){return '<div>'+l.map(function(i){return '<div class="gd-item">'+esc((ideas[i]||{}).name||'Unnamed')+'</div>'}).join('')+'</div>'};return '<div class="gd-cols">'+col(list.slice(0,half))+col(list.slice(half))+'</div>'};
  var lane=function(t,c,bad,inner){return '<div class="gd-lane" style="border-top-color:'+c+'"><div class="gd-lane-h"><h3 style="color:'+c+'">'+t+'</h3><span>'+bad+'</span></div>'+inner+'</div>'};
  var sub=function(l,list,col){return list.length?'<div class="gd-subh" style="color:'+col+'">'+l+' ('+list.length+')</div>'+cols(list):''};
  var bs=stages[0],now=bs.items.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=bs.items.filter(function(i){return (ideas[i]||{}).when==='future'});
  var ex=stages[1],go=ex.items.filter(function(i){return (pj[i]||{}).viable===true}),nogo=ex.items.filter(function(i){return (pj[i]||{}).viable===false}),open=ex.items.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
  var dv=stages[2],byS=function(a){return dv.items.filter(function(i){return a.indexOf((trk[i]||{}).status||'')>=0})},running=byS(['running','alive']),complete=byS(['complete']),paused=byS(['paused','dormant']),dead=byS(['killed','dead']),fresh=dv.items.filter(function(i){return !((trk[i]||{}).status)});
  var op=stages[3],byH=function(hh){return op.items.filter(function(i){return ((ops[i]||{}).health||'')===hh&&(trk[i]||{}).status!=='killed'})},green=byH('green'),amber=byH('amber'),red=byH('red'),opKilled=op.items.filter(function(i){return (trk[i]||{}).status==='killed'}),unrep=op.items.filter(function(i){return !((ops[i]||{}).health)&&(trk[i]||{}).status!=='killed'});
  h+=lane('Blue Sky',bs.col,badge(bs.items.length+(bs.items.length===1?' item':' items'),bs.col),bs.items.length?(sub('Now',now,bs.col)+sub('For the future',fut,'#6B7F8D')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Exploration',ex.col,badge(go.length+' Go','#1B6B5A')+badge(nogo.length+' No-Go','#9B2D3F'),ex.items.length?(sub('Go',go,'#1B6B5A')+sub('Not yet decided',open,'#6B7F8D')+sub('No-Go',nogo,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Development',dv.col,badge(running.length+' running','#2D5A8E')+badge(complete.length+' complete','#1B6B5A'),dv.items.length?(sub('Running',running,'#2D5A8E')+sub('Complete',complete,'#1B6B5A')+sub('Not yet started',fresh,'#6B7F8D')+sub('Paused',paused,'#8B5E3C')+sub('Killed',dead,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Operational',op.col,badge(green.length+' on track','#1B6B5A')+badge(amber.length+' watch','#C8860A')+badge(red.length+' at risk','#9B2D3F'),op.items.length?(sub('On track',green,'#1B6B5A')+sub('Watch',amber,'#C8860A')+sub('At risk',red,'#9B2D3F')+sub('Health not reported',unrep,'#6B7F8D')+sub('Killed',opKilled,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  /* Portfolio at a Glance follows the Operational lane at once (17 Sep 2026, Paul's ruling: no gap) */
  var bm='';try{bm=vizBalanceMap()}catch(e){bm=''}
  h+='<div class="gd-sub">Portfolio at a Glance</div><div class="analytics-grid-2">'+vizStageDonut()+vizCapitalSplit()+'</div>'+vizPortfolioMap()+vizStatusBars()+vizOwnerLoad()+(bm?'<div class="chart-card chart-card-wide"><div class="chart-title">Balance Map <span class="chart-subtitle">Risk against reward, by horizon</span></div><div style="max-width:520px">'+bm+'</div></div>':'');
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')} /* 17 Sep 2026 (Paul's ruling, third time asked): the Governance dashboard document copied \u2014 its stylesheet, its coverage card (gauge, score, label, the bars beside), its cadence cards, its systems table, its lanes \u2014 with the Pipeline\u2019s data in their places */
/* MODULE MANAGEMENT DOCUMENT (Governance, 14 Sep 2026, Paul's ruling; ported to the Innovation Pipeline 16 Sep 2026 on his word): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every shared step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. The Pipeline's mgSteps supplies the shared steps of Phases 1–4 */
function mgmtHubDoc(){var st=mgStats(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{};
  var today=new Date().toISOString().split('T')[0];var week=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  var owners=function(id){return ((data.assigns||{})[id]||[]).map(function(uid){var u=(USERS||[]).find(function(x){return x.id===uid});return u?u.name:''}).filter(Boolean).join(', ')};
  var state=function(id){var d2=due[id]||'';if(co[id])return 'Done'+(dts[id]?' \u00b7 '+lyDate(dts[id]):'')+(d2?' \u00b7 was due '+lyDate(d2):'');if(d2&&d2<today)return 'Overdue \u00b7 was due '+lyDate(d2);if(d2)return 'Due '+lyDate(d2);return 'Open'};
  var css='<style>.mh-doc{--ok-t:#1B6B5A}.mh-doc .mh-sec{font-size:20px;font-weight:800;color:#111;margin:0 0 10px;break-after:avoid;page-break-after:avoid}.mh-doc .mh-sec+.mh-sec{margin-top:18px}.mh-fig{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.mh-fig div{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center}.mh-fig b{display:block;font-size:22px;font-weight:700;color:#111}.mh-fig span{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.08em}.mh-tbl{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px}.mh-tbl th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:left;padding:4px 6px;border-bottom:1px solid #111}.mh-tbl td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}.mh-tbl tr{break-inside:avoid;page-break-inside:avoid}.mh-id{font-family:var(--mono,monospace);font-size:11px;color:#555}.mh-ph{font-size:15px;font-weight:700;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.mh-ph span{font-weight:400;color:#666;font-size:12px}.mh-lead{font-size:12px;color:#555;margin:0 0 6px}.mh2{display:flex;gap:12px;align-items:stretch;break-inside:avoid;page-break-inside:avoid}.mh2>*{flex:1;min-width:0}.mh-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.mh-doc .cd h3{font-size:14px;font-weight:700;margin:0 0 4px;color:#111}.mh-doc .t-faint-sm{font-size:11.5px;color:#555}.mh-doc .fs-13{font-size:12.5px}.mh-doc .fs-14{font-size:13px}.mh-doc svg{max-width:100%}</style>';
  var h=printDocCover('Module Management','Every step of the module in one place \u2013 who owns it, when it is due, and how completion is pacing against the 90 days.','')+css+'<div class="mh-doc">';
  var fig=function(v,l){return '<div><b>'+v+'</b><span>'+l+'</span></div>'};
  h+='<div class="mh-fig">'+fig(st.done+' / '+st.total,'steps complete')+fig('Day '+Math.min(st.elapsed,90)+(st.elapsed>90?' (+'+(st.elapsed-90)+' over)':''),'of the 90')+fig((st.delta>=0?'+':'\u2212')+Math.abs(st.delta).toFixed(1),'steps vs ideal pace')+fig(String(st.overdue),'overdue')+'</div>';
  var steps=mgSteps();var wk=steps.filter(function(s2){return !co[s2.id]&&due[s2.id]&&due[s2.id]<=week}); /* overdue, or due within seven days */
  var tbl=function(list){var t='<table class="mh-tbl"><thead><tr><th style="width:8%">Step</th><th>Name</th><th style="width:28%">Owners</th><th style="width:30%">State</th></tr></thead><tbody>';
    list.forEach(function(s2){var o=owners(s2.id);t+='<tr><td class="mh-id">'+esc(s2.id)+'</td><td>'+esc(s2.name)+'</td><td>'+(o?esc(o):'<span style="color:#999">Not assigned</span>')+'</td><td>'+esc(state(s2.id))+'</td></tr>'});return t+'</tbody></table>'};
  h+='<div class="mh-sec">This Week</div><div class="mh-lead">Steps overdue or due within seven days.</div>'+(wk.length?tbl(wk):'<div class="t-faint-sm" style="font-style:italic;margin:0 0 12px">Nothing due in the next seven days and nothing overdue.</div>');
  h+='<div class="mh-sec">Assignments</div>';
  PH.forEach(function(p){if(p.days==='Ongoing')return;var list=steps.filter(function(s2){return s2.ph===p});if(!list.length)return;h+='<div class="mh-ph" style="color:'+p.color+'">Phase '+p.id+' \u2013 '+esc(p.name)+' <span>('+esc(p.days)+')</span></div>'+tbl(list)});
  /* page two: the analytics */
  h+='<div style="break-before:page;page-break-before:always"><div class="mh-sec">Analytics</div>';
  h+='<div class="mh2">'+card('<h3>90-Day Burn-up</h3><p class="t-faint-sm" style="margin:0 0 8px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all '+st.total+' steps by day 90.</p>'+mgBurnup())+card('<h3>Module Velocity</h3><p class="t-faint-sm" style="margin:0 0 8px">Steps completed per program week, from completion dates.</p>'+mgVelocity())+'</div>';
  h+=card('<h3>Workload by Member</h3><p class="t-faint-sm" style="margin:0 0 8px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>'+mgWorkload());
  h+=card('<h3>Signals</h3>'+mgSignals())+'</div>';
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<input[^>]*>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
function printCapHubPage(){printCapHub()} /* the Capital Planning Hub's document, reached from the Phase 5 dispatch */
function sidebarPageShown(){return currentPage==='step'||currentPage==='phase'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='pipeline'||currentPage==='cap-hub'||currentPage==='reports'||currentPage==='review'||currentPage==='portfolio'} /* 16 Sep 2026 (Paul's ruling, family): the pages that show the sidebar and its toggle, once — the Report Manager among them */
/* ══ /* ─ REPORT MANAGER (family code, ported from the Governance build 14 Sep 2026 and from Executive Readiness 16 Sep 2026; Spec Rev A §9). A named report definition on the organization holds an ordered list of units — outputs, Phase 5 pages, individual ideas, and text pages the user writes — with a depth where a unit has one and a note per section. The compiled document is one cover, a contents page, the introduction, and each unit as a numbered section. The record is never edited here. ─ */
function rcInp(label,id,val,ph){return '<div class="mb-4"><label class="form-label">'+esc(label)+'</label><input type="text" id="'+id+'" data-uncapped="1" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:100%"></div>'}
function rcBtnG(label,onclick,style){return '<button class="btn bg2" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function rcBtnS(label,onclick,color,style){return '<button class="btn bp" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function printDocumentPreview(title,content,opts){printDocument(title,content,'',opts)} /* the Report Manager's print and preview go through the shared window */
var RC_PAGE_UNITS=[['5.1','Pipeline Dashboard'],['cap-hub','Capital Planning Hub'],['mgmt-hub','Module Management']]; /* the Phase 5 pages a report can include, named as their documents are titled */
function rcUnitName(u){if(u.kind==='page'){var p=RC_PAGE_UNITS.filter(function(x){return x[0]===u.id})[0];if(p)return p[1]}return u.name||(u.kind==='text'?'Untitled page':'')} /* a page unit's name is read live, so a saved report follows a renaming */
function rcCatalogue(){var out=[];
  PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id==='cap-hub')return;if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED_OUTPUTS[o.id]?['summary','full']:null})})});
  RC_PAGE_UNITS.forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  var st=getStages(),arch=data.archivedItems||{};(data.ideas||[]).forEach(function(d,i){if(!d||arch[i])return;out.push({kind:'record',type:'idea',id:String(i),name:d.name||'Unnamed idea',group:'Individual Ideas',rec:{i:i},sub:ideaStageWord(i,st)+(d.dept?' \u00b7 '+d.dept:'')})});
  return out} /* the catalogue: every output with a document, by phase (the Capital Planning Hub is a page, not an output); the three Phase 5 pages; every idea not archived, with its stage and department */
function ideaStageWord(i,st){st=st||getStages();if((st.operational||[]).indexOf(i)>=0)return 'Operational';if((st.experiment||[]).indexOf(i)>=0)return 'Development';if((st.noGo||[]).indexOf(i)>=0)return 'No-Go';if((st.explore||[]).indexOf(i)>=0)return 'Exploration';if((st.bluesky||[]).indexOf(i)>=0)return 'Blue Sky';return 'Archived'} /* an idea's stage in the pipeline's own words */
function rcKindLabel(u){return u.kind==='output'?'Output':u.kind==='page'?'Phase 5 page':u.kind==='text'?'Text page':u.kind==='record'?'Individual idea':''}
function rcUnitBody(u,lead){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth,wasTab=UI.hubTab;
  try{
    if(u.kind==='output'&&u.id==='out-raci'){body=_rcStripCover(raciDoc({sectionHead:lead||''}))} /* the matrix opens on its own landscape page; the section heading rides into it */
    else if(u.kind==='output'){UI.printDepth=u.depth||'full';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.1'){body=_rcStripCover(pipelineDashboardDoc())}
    else if(u.kind==='page'&&u.id==='cap-hub'){body=CAP_HUB_TABS.map(function(t,k){UI.hubTab=k;return erHead(t,'')+_rcStripCover(capHubDoc())}).join('')} /* in a report the hub prints all three tabs, each under its name */
    else if(u.kind==='page'&&u.id==='mgmt-hub'){body=_rcStripCover(mgmtHubDoc())}
    else if(u.kind==='record'&&u.type==='idea'){var i=+u.id;var d=(data.ideas||[])[i];var isProj=(data.selected||[]).indexOf(i)>=0;body=d?lyRender(isProj?'project':'idea',{i:i},'full',null):'<p style="font-size:13px;color:#666;font-style:italic">This idea is no longer on the record.</p>'} /* a selected idea is a project and prints the project record */
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'}
  }finally{UI.printDepth=wasDepth;UI.hubTab=wasTab}
  return rcFirstRecordStays(body)}
function rcUnitGaps(u){if(u.kind==='record'&&u.type==='idea'){var i=+u.id;return (data.ideas||[])[i]?lyGaps('idea',[{i:i}],null):[]}return []} /* the idea map names no required layers; the list is empty by design */
function rcUnitFact(u){var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var st=getStages();
  if(u.kind==='output'){var cu=data.culture||{};var cs=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'].map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
    return ({'out-report':'Culture '+cs+' / 30','out-bluesky':n(st.bluesky.length,'idea'),'out-orgready':n((((data.ownership||{}).leads)||[]).filter(function(l){return l&&l.name}).length,'embedded lead'),'out-raci':n(raciCols().length,'role'),'out-explore':n(st.explore.length+(st.noGo||[]).length,'idea'),'out-capplan':(data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'No budget set','out-expbriefs':n(st.experiment.length,'program'),'out-devport':n(st.experiment.length,'program'),'out-govfw':(data.governance||{}).threshold?'Threshold '+(data.governance||{}).threshold:'','out-orgrev':(function(){var x=data.stress||{};var sc=['decisions','ownership','incentives','culture'].map(function(k){return +x[k+'Score']||0}).filter(Boolean);return sc.length?'Average '+(sc.reduce(function(a,b){return a+b},0)/sc.length).toFixed(1)+' / 5':''})(),'out-finalport':(function(){var M=portfolioReviewModel();return M.decided+' of '+M.items.length+' decided'})(),'out-oper':n((st.operational||[]).length,'live project')})[u.id]||''}
  if(u.kind==='page'){if(u.id==='5.1')return n(bsNowList(st).length+st.explore.length+st.experiment.length+(st.operational||[]).length,'idea');if(u.id==='cap-hub')return (data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'';if(u.id==='mgmt-hub'){var m=mgStats();return m.done+' of '+m.total+' steps'}return ''}
  if(u.kind==='record'){var i=+u.id;return (data.ideas||[])[i]?ideaStageWord(i,st):'No longer on the record'}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
function rcUnitDesc(u){var m={
    'out-report':'Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.',
    'out-bluesky':'Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',
    'out-orgready':'How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, how incentives are changing, and the rhythm the work keeps.',
    'out-raci':'Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities.',
    'out-explore':'The ideas selected for exploration: the deepened assessment, the Go / No-Go verdict, and the horizon, risk, and reward each was graded.',
    'out-capplan':'A point-in-time picture of the portfolio\u2019s capital: every budget year, then the total.',
    'out-expbriefs':'The programs in development: each one\u2019s brief and its track to date.',
    'out-devport':'The programs in development: each one\u2019s brief and its track to date.',
    'out-govfw':'The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.',
    'out-orgrev':'The stress test of the organization\u2019s design after the first cycle, and the adjustments planned.',
    'out-finalport':'The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',
    'out-oper':'The projects live in the business: each one\u2019s health, launch date, and performance against its success metric.',
    'page:5.1':'The pipeline as it stands: its maturity, how far each phase has come, the next session and review, and every idea by stage.',
    'page:cap-hub':'The portfolio\u2019s committed costs and remaining budget, in its three views: Dashboard, Commitments, Plan & Funding.',
    'page:mgmt-hub':'Every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.',
    'record:idea':'This idea\u2019s full record: the idea, its ranking, its exploration, its portfolio placement, its capital, its development brief and track, its review, and its operations.'};
  return m[u.kind==='output'?u.id:u.kind==='page'?'page:'+u.id:u.kind==='record'?'record:'+u.type:'']||''} /* one sentence per kind of content, in the same words as the documents' own covers */
function rcLeaderFilter(){return UI.rcF||(UI.rcF={q:'',st:'all'})} /* the Individual Ideas filters: a search, and the stage */
function rcSetFilter(k,v){var F=rcLeaderFilter();F[k]=v;render();if(k==='q'){var el=document.querySelector('input[type=search][placeholder^="Search ideas"]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}}
function rcLeaderPasses(rec,F){if(!rec)return false;var d=(data.ideas||[])[rec.i]||{};var q=(F.q||'').trim().toLowerCase();if(q&&((d.name||'')+' '+(d.dept||'')).toLowerCase().indexOf(q)<0)return false;if(F.st&&F.st!=='all'&&ideaStageWord(rec.i)!==F.st)return false;return true} /* an idea passes the Individual Ideas filters by name or department, and by stage */
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()} /* 14 Sep 2026: an option with a depth is added at the depth chosen */
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc} /* an output's own cover comes off inside a compiled report */
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
function rcCompile(id){ /* the whole document */
  var d=rcFind(id);if(!d)return '';
  var h=printDocCover(d.name||'Report',d.subtitle||'','');
  h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Contents</div>';
  d.units.forEach(function(u,i){h+='<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px"><span style="font-family:var(--mono,monospace);color:#666;min-width:28px">'+(i+1)+'.</span><span>'+esc(rcUnitName(u))+(u.depth?' <span style="color:#888;font-size:11px">('+u.depth+')</span>':'')+'</span></div>'});
  var gaps=[];d.units.forEach(function(u,i){rcUnitGaps(u).forEach(function(g){gaps.push({sec:i+1,title:g.title,lines:g.lines})})});
  if(gaps.length){h+='<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B3A1E;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #8B3A1E">What is missing ('+gaps.length+')</div>';
    gaps.forEach(function(g){h+='<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);color:#666">'+g.sec+'.</span> <strong>'+esc(g.title)+'</strong> \u2014 '+g.lines.map(esc).join(' ')+'</div>'})}
  h+='</div>';
  if(d.intro&&d.intro.trim())h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Introduction</div><div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap">'+esc(d.intro)+'</div></div>';
  d.units.forEach(function(u,i){h+=rcSection(u,i)});
  return h}
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var head='<div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(rcUnitName(u))+'</div>';
  if(u.note&&u.note.trim())head+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  if(u.kind==='output'&&u.id==='out-raci')return '<div>'+rcUnitBody(u,head)+'</div>'; /* the RACI matrix opens on its own landscape page; the heading sits at the top of that page, never alone before it */
  var h='<div style="page-break-before:always">'+head;
  return h+rcUnitBody(u)+'</div>'}
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printDocumentPreview(d.name||'Report',doc)}
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()} /* Save keeps the text and the heading and closes the inspector */
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printDocumentPreview(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()} /* the new page opens in the inspector */
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
function rcSanitize(html){ /* authored text keeps only its shape: paragraphs, breaks, bold, italics, and a size; everything else is dropped */
  var root=document.createElement('div');root.innerHTML=String(html||'');
  var SIZE={'1':'11px','2':'12px','3':'14px','4':'16px','5':'18px','6':'22px','7':'26px'};
  var walk=function(node){var out='';for(var i=0;i<node.childNodes.length;i++){var n=node.childNodes[i];
    if(n.nodeType===3){out+=esc(n.nodeValue);continue}
    if(n.nodeType!==1)continue;var tag=n.tagName.toLowerCase();if(tag==='script'||tag==='style'||tag==='iframe'||tag==='object'||tag==='embed')continue;var inner=walk(n);
    if(tag==='br'){out+='<br>';continue}
    if(tag==='b'||tag==='strong'){out+='<b>'+inner+'</b>';continue}
    if(tag==='i'||tag==='em'){out+='<i>'+inner+'</i>';continue}
    if(tag==='p'||tag==='div'||tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4'||tag==='li'||tag==='ul'||tag==='ol'){var st='';if(tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4')st=' style="font-size:22px;font-weight:700"';var fs=n.style&&n.style.fontSize;if(fs&&/^\d+(\.\d+)?px$/.test(fs))st=' style="font-size:'+fs+'"';out+='<div'+st+'>'+inner+'</div>';continue}
    if(tag==='font'&&n.getAttribute('size')&&SIZE[n.getAttribute('size')]){out+='<span style="font-size:'+SIZE[n.getAttribute('size')]+(n.getAttribute('size')==='6'||n.getAttribute('size')==='7'?';font-weight:700':'')+'">'+inner+'</span>';continue}
    if(tag==='span'){var fs2=n.style&&n.style.fontSize;var fw=n.style&&n.style.fontWeight;var st2=[];if(fs2&&/^\d+(\.\d+)?px$/.test(fs2))st2.push('font-size:'+fs2);if(fw==='700'||fw==='bold')st2.push('font-weight:700');out+=st2.length?'<span style="'+st2.join(';')+'">'+inner+'</span>':inner;continue}
    out+=inner}return out};
  return walk(root)}
function rcPreview(id){var d=rcFind(id);if(!d)return;printDocumentPreview(d.name||'Report',rcCompile(id),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual ideas can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner rc-page"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, and individual ideas into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+rcBtnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+rcBtnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+rcBtnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
function rcEditor(d){ /* 14 Sep 2026 (Paul's ruling): the Order column is the report's contents being built — one compact row per section with its number, name, kind, a fact about its size, its depth, and a mark where a note is written; one row selected at a time opens the inspector beneath the list, which holds what the section prints, the depth, the note, a preview of that section alone, and for a text page its editor. The Content Options list keeps its size; Add a text page is its first row. */
  var cat=rcCatalogue();var chosen={};d.units.forEach(function(u){chosen[u.key]=1});
  var seg=function(active,label,fn,extra){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(active?'background:rgba(var(--fg-rgb),.10);color:var(--paper);':'')+(extra||'')+'" onclick="'+fn+'">'+label+'</button>'};
  var ico=function(glyph,fn,title,dim){return '<button class="btn-ghost" title="'+esc(title)+'" style="font-size:12px;padding:2px 7px;line-height:1.2;min-width:0;'+(dim?'opacity:.35;pointer-events:none;':'')+'" onclick="event.stopPropagation();'+fn+'">'+glyph+'</button>'};
  var h='<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--fg-rgb),.10)">';
  /* the report's own words: title, subtitle, introduction */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+rcInp('Title','rc_name_'+d.id,d.name,'e.g. Board pack, September')+rcInp('Subtitle','rc_sub_'+d.id,d.subtitle,'One line under the title on the cover')+'</div>';
  h+='<script>document.getElementById(\'rc_name_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'name\',this.value);render()};document.getElementById(\'rc_sub_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'subtitle\',this.value)};</script>';
  h+='<div class="mb-4"><label class="form-label">Introduction</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed after the contents page.</p><textarea rows="6" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSet(\''+d.id+'\',\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>';
  /* the toolbar: preview and print; the Save as PDF here matches its neighbours (Paul's ruling, 14 Sep 2026: an exception to the quiet form, because it sits in a block of buttons) */
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+rcBtnG('Preview the report','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+'<span style="font-size:12px;color:var(--text-faint);margin-left:6px">'+d.units.length+' section'+(d.units.length===1?'':'s')+'</span></div>';
  /* two panes: the sections in order (twice the width) and the content options (its own width) */
  h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start">';
  /* left: the contents being built */
  var sel=UI.rcSel!=null?d.units.findIndex(function(u){return u.key===UI.rcSel}):-1;
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Sections, in order</h4>';
  if(!d.units.length)h+='<p class="t-faint-sm" style="padding:14px;border:1px dashed rgba(var(--fg-rgb),.18);border-radius:8px">Nothing chosen yet. Add content from the options on the right. Each section you add appears here as a line of the contents.</p>';
  else{h+='<div style="border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;overflow:hidden">';
    var inspector=function(u,sel){var fact=rcUnitFact(u); /* 14 Sep 2026 (Paul's ruling): the inspector opens directly beneath the selected row, inside the list, so it is never off the page */
      h+='<div style="padding:14px 16px 16px 50px;border-top:1px solid rgba(var(--fg-rgb),.14);background:var(--bg-elev)">';
      h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 6px"><span style="font-family:var(--serif);font-size:22px;line-height:1;color:var(--text-faint)">'+(sel+1)+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(u.kind==='text'?(u.name||'Untitled text page'):u.name)+'</span><span style="font-size:12px;color:var(--text-faint)">'+rcKindLabel(u)+'</span><span style="flex:1"></span>'+(u.kind!=='text'?rcBtnG('Preview this section','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px'):'')+rcBtnG('Close','UI.rcSel=null;render()','font-size:12px')+'</div>';
      if(u.kind==='text'){
        h+='<p class="t-faint-sm" style="margin:0 0 10px">A page you write, printed as its own numbered section. Use it to open a part of the report or to add a page of your own between sections.</p>';
        h+='<input type="text" id="rc_head_'+u.id+'" data-uncapped="1" value="'+esc(u.name||'')+'" placeholder="Heading for this text page" style="width:100%;font-size:15px;font-weight:600;margin:0 0 8px" onchange="rcSetUnit(\''+d.id+'\','+sel+',\'name\',this.value)">';
        h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">'+seg(false,'<b>B</b>','rcFmt(\''+u.id+'\',\'bold\')')+seg(false,'<i>I</i>','rcFmt(\''+u.id+'\',\'italic\')')+'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);align-self:center;margin:0 4px 0 8px">SIZE</span>'+seg(false,'Small','rcFmt(\''+u.id+'\',\'size\',\'small\')')+seg(false,'Normal','rcFmt(\''+u.id+'\',\'size\',\'normal\')')+seg(false,'Large','rcFmt(\''+u.id+'\',\'size\',\'large\')')+seg(false,'Heading','rcFmt(\''+u.id+'\',\'size\',\'heading\')')+'</div>';
        h+='<div id="rc_txt_'+u.id+'" contenteditable="true" class="rc-text-edit" style="min-height:260px;padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;font-size:14px;line-height:1.7;background:rgba(var(--fg-rgb),.02);color:var(--paper);outline:none" oninput="rcSetTextHtml(\''+d.id+'\','+sel+',this.innerHTML)">'+rcSanitize(u.html||'')+'</div>';
        h+='<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0">'+rcBtnS('Save','rcSaveText(\''+d.id+'\','+sel+')','#2A5A5A','font-size:12px')+rcBtnG('Preview this page','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px')+'<span style="font-size:12px;color:var(--text-faint)">Select text, then Bold, Italic, or a size.</span></div>';
      }else{
        h+='<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">'+esc(rcUnitDesc(u))+(fact?' <span style="color:var(--text-faint)">('+esc(fact)+')</span>':'')+'</p>';
        if(u.depth!==undefined&&u.depth!=='')h+='<div style="margin:0 0 10px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:6px">DEPTH</span>'+seg(u.depth==='summary','Summary','rcSetDepth(\''+d.id+'\','+sel+',\'summary\')')+seg(u.depth==='full','Full','rcSetDepth(\''+d.id+'\','+sel+',\'full\')')+'</div>';
        h+='<label class="form-label">Note for this section</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed at the head of the section.</p><textarea rows="4" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSetNote(\''+d.id+'\','+sel+',this.value);render()">'+esc(u.note||'')+'</textarea>';
      }
      h+='</div>'};
    d.units.forEach(function(u,i){var on=(i===sel);var fact=rcUnitFact(u);var noted=(u.kind==='text')?!!(u.html&&u.html.replace(/<[^>]*>/g,'').trim()):!!(u.note&&u.note.trim());
      h+='<div onclick="UI.rcSel='+(on?'null':'\''+u.key+'\'')+';render()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:'+(i?'1px solid rgba(var(--fg-rgb),.06)':'none')+';'+(on?'background:rgba(var(--fg-rgb),.06)':'')+'">'
        +'<span style="font-family:var(--serif);font-size:17px;line-height:1;color:var(--text-faint);min-width:28px;text-align:right">'+(i+1)+'</span>'
        +'<span style="flex:1;min-width:0;font-size:13.5px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.kind==='text'?'<em style="font-style:normal;font-weight:600">'+esc(u.name||'Untitled text page')+'</em>':'<span style="font-weight:600">'+esc(rcUnitName(u))+'</span>')+'</span>'
        +'<span style="font-size:11px;color:var(--text-faint);white-space:nowrap">'+rcKindLabel(u)+'</span>'
        +(fact?'<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+esc(fact)+'</span>':'')
        +(u.depth?'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap">'+u.depth+'</span>':'')
        +'<span title="'+(noted?'A note is written':'No note')+'" style="width:7px;height:7px;border-radius:50%;background:'+(noted?'var(--gold-text)':'rgba(var(--fg-rgb),.15)')+';flex-shrink:0"></span>'
        +'<span style="display:inline-flex;gap:2px;margin-left:4px">'+ico('\u2191','rcMove(\''+d.id+'\','+i+',-1)','Move up',i===0)+ico('\u2193','rcMove(\''+d.id+'\','+i+',1)','Move down',i===d.units.length-1)+ico('\u00d7','rcRemoveAt(\''+d.id+'\','+i+')','Remove this section')+'</span></div>';
      if(i===sel)inspector(u,i)});
    h+='</div>';
  }
  h+='</div>';
  /* right: report content options */
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Report Content Options</h4>';
  var groups=[];var byG={};cat.forEach(function(u){if(!byG[u.group]){byG[u.group]=[];groups.push(u.group)}byG[u.group].push(u)});
  var row=function(u){var k=rcKey(u);var on=!!chosen[k];
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px"><span style="flex:1;min-width:0;color:'+(on?'var(--text-faint)':'var(--paper)')+'">'+(on?'\u2713 ':'')+esc(u.name)+(u.sub?' <span style="font-size:11px;color:var(--text-faint)">'+esc(u.sub)+'</span>':'')+'</span>'
      +(on?seg(false,'Remove','rcToggle(\''+d.id+'\',\''+k+'\')'):(u.depths?(seg(false,'Summary','rcToggle(\''+d.id+'\',\''+k+'\',\'summary\')')+seg(false,'Full','rcToggle(\''+d.id+'\',\''+k+'\',\'full\')')):seg(false,'Add','rcToggle(\''+d.id+'\',\''+k+'\')')))+'</div>'};
  /* the first option: a text page */
  h+='<div style="margin:0 0 14px"><div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:8px;font-size:13px"><span style="flex:1;min-width:0"><span style="font-weight:600;color:var(--paper)">Text page</span> <span style="font-size:11px;color:var(--text-faint)">A heading and a body you write, added after the selected section or at the end</span></span>'+seg(false,'Add','rcAddText(\''+d.id+'\','+(sel>=0?(sel+1):'null')+')')+'</div></div>';
  groups.forEach(function(g){var list=byG[g];
    h+='<div style="margin:0 0 14px"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:0 0 4px;border-bottom:1px solid rgba(var(--fg-rgb),.18);margin:0 0 2px;display:flex;align-items:baseline;gap:8px">'+esc(g)+'<span style="font-family:var(--sans);letter-spacing:0;text-transform:none;font-size:11px;color:var(--text-faint)">'+list.length+'</span></div>';
    if(g==='Individual Ideas'){var F=rcLeaderFilter();
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search ideas by name or department" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">STAGE</span>'+[['all','All'],['Blue Sky','Blue Sky'],['Exploration','Exploration'],['No-Go','No-Go'],['Development','Development'],['Operational','Operational']].map(function(x){return seg(F.st===x[0],x[1],'rcSetFilter(\'st\',\''+x[0]+'\')')}).join('')+'</div>';
      var shown=list.filter(function(u){return rcLeaderPasses(u.rec,F)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' idea'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No idea matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}
PRINT_DOCS['5.1']=pipelineDashboardDoc; /* the dashboard, registered so the Report Manager can include it */
PRINT_DOCS['out-report']=assessmentReportDoc;PRINT_DOCS['out-orgready']=orgReadinessDoc;PRINT_DOCS['out-govfw']=govFrameworkDoc;PRINT_DOCS['out-orgrev']=orgDesignReviewDoc;PRINT_DOCS['out-raci']=raciDoc;
PRINT_DOCS['out-capplan']=function(){return '<style>'+CAP_REPORT_CSS+'</style>'+printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody()}; /* the Capital Snapshot Report as Paul ruled it on 13 Sep 2026, registered so the Report Manager can include it */
PRINT_DOCS['cap-hub']=capHubDoc;
function printCurrentPage(){ /* 16 Sep 2026: the Phase 5 pages print their own documents; any other step prints its page under a cover */
  if(currentPage==='cap-hub'){printCapHub();return}
  if(currentPage==='mgmt-hub'){printMgmtAnalytics();return}
  if(currentPage==='review'){printDocument('Portfolio Review',portfolioReviewDoc(),'');return} /* 17 Sep 2026: the review page prints the Portfolio Review */
  if(currentPage==='portfolio'){printCurrentOutput();return} /* a live portfolio page prints its output's document */
  if(currentPage==='phase5'||currentStep==='5.1'){printDocument('Pipeline Dashboard',pipelineDashboardDoc(),'');return}
  var id=currentStep;var title=stepNameOf(id);
  UI._printing=1;var body='';try{body=renderStepContentBody(id)}finally{UI._printing=0}
  printPage(title,function(){return body});
}

/* SIDEBAR OUTPUTS FOLD (Paul's ruling, 12 Sep 2026; family): a phase's outputs sit behind one folded line beneath its steps, so the sidebar stays uncramped and the list of outputs can grow. The fold opens when the user clicks it, and opens itself while one of its outputs is the page being viewed. */
function toggleNavOutputs(phId){UI.navOutOpen=UI.navOutOpen||{};UI.navOutOpen[phId]=!UI.navOutOpen[phId];render()}
function navOutputsOpen(ph){UI.navOutOpen=UI.navOutOpen||{};if(UI.navOutOpen[ph.id])return true;return (ph.outcomes||[]).some(function(o){return (currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id})}
