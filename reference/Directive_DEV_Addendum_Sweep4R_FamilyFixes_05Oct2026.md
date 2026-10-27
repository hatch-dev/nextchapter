# Addendum to the three module directives: the Sweep 4R family fixes (5 October 2026)

**For:** the developers of the Innovation Pipeline, Executive Readiness and Governance.
**Applies on top of:** each module's directive `Directive_DEV_{Module}_Seal_EU_Readiness_02Oct2026.md`, whose Parts S to 6 come first.
**Source:** Architecture's final QA batch (Sweep 4R), which found these faults in code the three modules share or that their directives add. Every passage quoted below is taken word for word from Architecture's shipped build, `Architecture-app.js` `da1e96de`, where each is covered by a passing check.

As in the directives, every change is anchored on quoted code text, never on line numbers. **If a quoted text is not found exactly once in your copy, stop and report it.** Where a passage below adds code that a directive also added (Parts 3 and 5), add it beside that code.

Checked against each module's own file before writing: the lock fault (item 6) is in all three; the Team Chat unread count (item 8) is never raised in Governance, and in the Innovation Pipeline and Executive Readiness it is raised only inside the AI reply code that Part 2.5 of their directives removes, so after the directive it is never raised in any of them; none of the three has `signOutNow` or `resetOrgScopedUI` (their session seal is Part S's `sealSession`); Governance has no `adminAddOrg` (its console creates organizations through `adminConsoleNewOrg`).

---

## 1. Sign-in accepts the username only (item 2; Paul's decision)

**Server (Part 6):** `POST /session` matches the typed username against usernames only, never a person's full name, comparing as in section 6 below (ignoring capitals and every space). A full name with the right password is refused like any mismatch (`'no-user'`, shown as A.5.3).
**Acceptance:** signing in with a full name and the correct password shows A.5.3; the username signs in.

## 2. Administrators make administrators; never none (item 3; Paul's decision; wording approved)

1. Add beside the other constants:

```js
var LAST_ADMIN_MSG='An organization needs at least one administrator. Make someone else an administrator first.';
function adminCountIn(list){return (list||[]).filter(function(x){return x&&x.admin===true}).length}
```

2. In both person editors (the Profile page's, in `renderOrgModal`, and the admin console's, `adminUserEditorHtml`), add a tick box labeled **Administrator** (A.5.29), shown only to administrators (`isOrgAdminNow()` on the Profile page), checked when the person's `admin` is `true`. New members have it too.
3. Saving (`saveProfile`, `adminSaveUser`): before anything changes, refuse with `alert(LAST_ADMIN_MSG)` if this would untick the last administrator (`adminCountIn(...)<=1`); otherwise set `admin` from the tick box. Removing (`removeProfile`, `adminDeleteUser`): refuse the same way for the last administrator.
4. **Server:** a request that would leave an organization without an administrator is refused. A reset keeps every administrator, as Part 4 already says.

**Acceptance:** an administrator promotes a member, who survives a reset and can be demoted; the last administrator can be neither demoted nor removed, on the Profile page or in the console, with A.5.30.

## 3. Only administrators edit the organization's details (item 4; Paul's decision; wording approved)

1. `saveEnterprise` begins with `if(!isOrgAdminNow())return;`.
2. For everyone else, the organization's detail fields are drawn `disabled`, and a line A.5.31 follows the Organization Details heading.
3. **Server:** writes to the organization's details are refused unless the session belongs to an administrator of that organization or to the app administrator.

**Acceptance:** an ordinary member sees the fields disabled with A.5.31 and cannot save them; an administrator edits them.

## 4. Locks belong to sessions, not people (item 6)

In `Collab`, a lock is held by a session (its tab), so two tabs of one person, or the app administrator's Open (which acts as the organization's first member), lock each other out like anyone else.

1. Beside `function me(){ return currentUserId; }` add:

```js
function sid(){ return (typeof TAB_ID!=='undefined'&&TAB_ID)||'tab'; }
```

   If your module has no `TAB_ID`, add `var TAB_ID='tab_'+Math.random().toString(36).slice(2,10);` once at the top level.
2. In `acquire`, record the session with the person: `L[rk]={id:me(),sid:sid(),name:...,at:Date.now()}`.
3. Everywhere inside `Collab` that compares a lock's holder with `me()` (`.id===me()` and `.id!==me()`: in `lockedByOther`, `acquire`, `release`, `refreshMine`, `leave` and `othersLocks`), compare `.sid` with `sid()` instead.

**Acceptance:** two tabs of the same person each see the other's lock and are refused; a tab's own lock does not block it.

## 5. Team Chat's unread badge counts (item 8)

1. Beside `var gchatUnreadCount=0;` add:

```js
var gchatSeenCount=null; function gchatRecount(){ var a=chatArr(); if(gchatSeenCount==null||gchatOpen){gchatSeenCount=a.length;gchatUnreadCount=0;return} var me=getCurrentUser(),n=0; for(var i=gchatSeenCount;i<a.length;i++){var m=a[i];var mine=!!m&&((m.by&&m.by===currentUserId)||(!m.by&&!!me&&m.name===me.name));if(m&&!mine)n++} gchatUnreadCount=n; }
```

2. At the start of `render`: `try{if(currentOrgId&&currentUserId)gchatRecount()}catch(e){}`.
3. Where opening the panel sets `gchatUnreadCount=0`, also set `gchatSeenCount=chatArr().length`.
4. In the session seal (Part S's `sealSession`), set `gchatUnreadCount=0` and `gchatSeenCount=null`.
5. A message `sendGChat` saves records its author: add `by:currentUserId` to the object it pushes.

**Acceptance:** a colleague's message raises the badge; one's own does not; opening the panel clears it; it does not reappear for messages already seen; signing out and back in starts at zero.

## 6. Usernames: every space ignored; the app administrator and console-made organizations take part (items 20 and 21)

1. Use this check in place of Part 5.11's (it ignores every space, not only the ends, and includes the app administrator's username, the stored one or the default `admin`):

```js
function unameKey(x){ return String(x||'').replace(/\s+/g,'').toLowerCase(); }
function usernameTaken(name,exceptId){ var n=unameKey(name); if(!n)return false; if(exceptId!=='__admin'){ var _ac=adminCreds()||{username:'admin'}; if(unameKey(_ac.username||'admin')===n)return true; } /* Sweep 4R item 20: the app administrator's username takes part, both ways */ var orgs=getOrgs(); for(var i=0;i<orgs.length;i++){ var r=(orgs[i].id===currentOrgId&&typeof USERS!=='undefined')?USERS:(((Store.readOrg(orgs[i].id)||{}).roster)||[]); for(var j=0;j<r.length;j++){ var u=r[j]; if(u&&u.id!==exceptId&&unameKey(u.username)===n)return true; } } return false; }
```

2. The administrator's own Change username calls `usernameTaken(newName,'__admin')`, so it does not clash with itself.
3. When the console creates an organization without naming its first person, that person's username is `owner`, `owner2` and so on, whichever is free.
4. Part 5.11's wording changes to "ignoring capitals and every space". **Server:** the same rule, enforced on the server, with the app administrator's username part of the login database.

**Acceptance:** with `s4r-r1-a` taken, `s4r- r1-a` is refused; a member cannot take the administrator's username, nor the administrator a member's; two console-made organizations get different first-member usernames.

## 7. The console's Change password (item 22)

The console's Change password asks for the current password, then the new one twice, and sends `Auth.changeAdminPassword(current, next)`. A wrong current password shows A.5.15 and an unchanged one A.5.10 (the server's `'bad-current'` and `'same'`, already in Part 6). It never offers a new password without the current one.

**Acceptance:** a wrong current password and an unchanged password are each refused with their messages; a good change saves.

## 8. The session seal empties the closed panels (item 23)

In Part S's `sealSession`, after it empties the dialog layer, add:

```js
try{var _gp=document.getElementById('gchatPanel');if(_gp)_gp.innerHTML='';var _cp=document.getElementById('coachPanel');if(_cp)_cp.innerHTML=''}catch(e){}
```

Each panel is rebuilt by its own draw function when it next opens.

**Acceptance:** after any sealing route, neither closed panel holds the previous session's text; each draws normally when opened.

## 9. The sample tab (items 5, 9, 24 and 25; amends Part 3)

1. **Its More menu** offers only the module's navigation items (as Architecture's Track Program and Report Manager), Start the sample again and Close the sample: also hide Export state and Import state while `SAMPLE_MODE` is true.
2. **Its account chip's Sign Out closes the sample:** `signOut` (and any function it calls to sign out) begins with `if(SAMPLE_MODE){sampleClose();return}`. It never signs anyone out, never opens the sign-in screen, and writes nothing to storage, so the stored theme is untouched.
3. **The note on Home:** on a page with no content container (Home), the note takes the top bar's measured height as its top margin, so it sits below the bar. Use this in place of Part 3's note function (`anchorBelowNav` is the measurement Team Chat's panel already uses; if your module's is named differently, use that):

```js
function sampleNoteEnsure(){ if(!SAMPLE_MODE||typeof document==='undefined'||!document)return; if(UI.entry&&UI.entry.step==='sampleSignIn')return; /* 5 Oct 2026 (Sweep 4R item 25): the unsigned tab shows only its sentence */ var app=document.getElementById('app'); if(!app)return; if(app.querySelector('#sampleBanner'))return; var host=app.querySelector('.content-inner')||app.querySelector('.content-area')||app.firstElementChild||app; /* 5 Oct 2026: inside the page's content container, directly above Back; above that container the top bar covers it */ var d=document.createElement('div'); d.id='sampleBanner'; d.style.cssText='color:#B3261E;font-weight:800;font-size:28px;line-height:1.25;letter-spacing:.01em;text-align:center;margin:6px 0 22px'; /* 5 Oct 2026 (Paul): twice the size, centered, bold */ d.textContent='Sample organization: your changes stay in this browser only'; if(!app.querySelector('.content-inner')&&!app.querySelector('.content-area')){ try{d.style.marginTop=anchorBelowNav()}catch(e){d.style.marginTop='70px'} d.setAttribute('data-clears-bar','1'); } /* 5 Oct 2026 (Sweep 4R item 9): on a page without a content container (Home), the note sits below the top bar */ host.insertBefore(d,host.firstChild); }
```

4. **No Team Chat button in the sample tab:** draw the top bar's Team Chat button only while `SAMPLE_MODE` is false.
5. **The unsigned sample tab** shows only A.3.6, with no eyebrow, title or note:

```js
function renderSampleNeedsSignIn(){ return '<div class="login-screen"><div class="login-card"><p class="login-sub">Sign in to your organization, then open Demo from the top bar.</p></div></div>'; }
```

**Acceptance:** the sample's More menu holds only its navigation items, Start the sample again and Close the sample; Sign Out closes the tab and the person stays signed in, storage unchanged; on Home the note sits below the top bar; no Team Chat button in the sample; the unsigned tab's whole text is A.3.6.

## 10. Rights inside the functions (item 29)

Each function that manages people, passwords, the administrator flag or the organization's details checks the caller's rights itself, rather than relying on its button being hidden:

- every app-console function begins with `if(!isAppAdmin)return;` — in each module, those it has of `adminConsoleOpen`, `adminConsoleDelete`, `adminConsoleNewOrg`, `adminAddOrg`, `adminRenameOrg`, `adminOpenOrg`, `adminDeleteOrg`, `adminEditUser`, `adminAddUser`, `adminSaveUser`, `adminDeleteUser`, `adminChangePasscode`, the console's Change username, and Part 4's Reset data function;
- `clearData` (if your module still has it) and `setAiSetting` begin with `if(!isOrgAdminNow())return;`;
- `addProfile`, `editProfile` (for anyone but oneself), `saveProfile` (for a new member or anyone but oneself), `removeProfile` and `saveEnterprise` check `isOrgAdminNow()` (Part 5.10 and section 3 above).

**Server:** the same rights on every request, as Part 6 already requires for managing people.
**Acceptance:** each function, called by an ordinary member from the browser console, changes nothing.

---

## Appendix: new on-screen words (approved by Paul)

| Ref | Where | Words |
|---|---|---|
| A.5.29 | Person editors, tick box | Administrator |
| A.5.30 | Demoting or removing the last administrator | An organization needs at least one administrator. Make someone else an administrator first. |
| A.5.31 | Organization Details, for an ordinary member | Only administrators can change the organization’s details. |

## Checklist

- [ ] 1 Sign-in by username only (server)
- [ ] 2 Administrators make administrators; never none
- [ ] 3 Only administrators edit the organization's details
- [ ] 4 Locks by session
- [ ] 5 Team Chat's unread badge
- [ ] 6 Usernames: every space; the administrator; console-made organizations
- [ ] 7 The console's Change password
- [ ] 8 The seal empties the closed panels
- [ ] 9 The sample tab: menu, Sign Out, Home note, no Team Chat, unsigned card
- [ ] 10 Rights inside the functions
