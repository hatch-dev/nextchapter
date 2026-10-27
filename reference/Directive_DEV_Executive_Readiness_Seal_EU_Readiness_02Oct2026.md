# Directive for the developers: Executive Readiness

*2 October 2026. For the developers, and Part 6 for Param. This directive covers one module, Executive Readiness. Separate directives cover the AI Innovation Pipeline, Executive Readiness and Responsible AI Governance; further work will be added to each in later revisions.*

## 0. Before you start

**The file this directive was written against.** Every name and every exact piece of text below was read from this file:

| File | Lines | Bytes | md5 |
|---|---|---|---|
| `Exec-Readiness-app.js` | 7,730 | 801,601 | `99f541bd0e4936977cb52e7c4b873ac4` |

**Your copy.** The table describes the copy this directive was written against, for reference. Your deployed copy differs where you connected it to the server (the Store adapter and `AUTH_ENDPOINT`): apply every edit to your copy. Every edit is anchored on quoted code text, never on line numbers. **If a quoted text is not found exactly once in your copy, stop and report it** before changing anything.

**Ruled on 2 October 2026.** Team Chat carries no AI in any module: it is for team members chatting, and any simulated reply is removed (section 2.5). The line under the AI Guide switch (A.2.3) stands as written in every module; the AI Guides are being connected as a separate step. Resetting an organization's data follows Rollout item 68, the reset scope law: the organization and its administrators stay, and every other team member is removed with the program data (Part 4). The word is "reset", never "empty". Every team member an administrator adds is given a temporary password, which they replace with their own at their first sign-in; the sample organization is a private copy in each person's browser, opened from **Demo** in the top bar (Part 3); creating a new organization needs a setup code, and only an organization's administrators, and the app administrator, manage its people (Part 5). People who are only recorded in the module (on a RACI chart, as the owner of a responsibility) are not team members and are not added to the people list.

**What this directive asks for.**

- **Part S.** Seal each organization's session, so nothing at all survives a change of organization or user. Exact code and exact edits.
- **Part 1.** No request to Google's font servers.
- **Part 2.** The AI features off by default, with a switch per organization.
- **Part 3.** A private sample organization each person opens in a new tab, kept only in their own browser.
- **Part 4.** Resetting an organization's data, and deleting an organization, from the admin console only.
- **Part 5.** Passwords and accounts: the browser.
- **Part 6.** Passwords and accounts: the server (for Param).
- **Part 7.** A printable personal record of any one person.

**How this module runs.** The copy this directive was written against keeps data in the browser (`Store` reads and writes `localStorage`) and checks sign-ins there (`AUTH_ENDPOINT` is `''`); that is the local form of the code. **Your deployed copy reads, writes and signs in through the server.** Parts 5 and 6 are written for that: the browser sends what people type to the server, and the server checks every password and holds the hashes. There are no client organizations yet, so nothing existing has to be converted.

**Order of work.** Part S first, then 1, 2, 3, 4, 5, 6, 7. Parts 5 and 6 ship together.

**The test suites.** The module's test suites will fail in places once this work is done (they look for the sample items in the More menu, the word PIN and the code 1234, and seed sample data into an ordinary organization). Change those tests to the new behavior and add the tests listed under each part. To test a screen that sends a request to the server, replace `fetch` in the test with a function that records the request and returns the answer the test needs.

**Every new on-screen word is in Appendix A.** Use the words exactly as written.

---

## Part S — Seal each organization's session

### S.1 The problem

While someone works, the module keeps session state in memory: the `UI` object (which card or editor is open, drafts, filters, the selected report and page) and a few variables beside it (the AI Guide conversation `coachMsgs`, the Team Chat unread count, the current page, the Insights tab, an open dialog). The stored data of each organization is kept apart, but this session state is not: it is never cleared when the organization or the person changes. In a test of this exact file, a setting, the AI Guide conversation, the unread count and the current page all survived a sign-out. Because the sample organizations use fixed record ids, a pointer left over from one organization lands on the matching record in the next.

### S.2 The requirement (ruled by Paul, 1 October 2026)

Every organization is sealed. Nothing at all survives a change of organization or user: no carve-outs, preferences included. On every sign-in, sign-out, organization switch, admin-console Open, new-organization setup, and deletion of the organization being viewed, the session returns to its starting state: `UI` exactly as first created; theme, zoom and the sidebar at their defaults, on screen and in stored preferences; the page at Home with an empty history; panels and dialogs closed; the AI Guide conversation at its opening message; the unread count at zero. Reloading the page in the same session is not a change of organization or user and does not reset anything.

### S.3 The exact edits

Make these six edits in order. Each quoted text occurs exactly once in the file; if a count differs, stop and report it.

**Edit S-1.** After the end of the `UI` declaration. Find (once):

```js
PageKey:null,mfTab:'intro',crTab:'reflections'};
```

Replace with:

```js
PageKey:null,mfTab:'intro',crTab:'reflections'};
var UI_PRISTINE = JSON.stringify(UI); /* the session's starting state, for sealSession */
```

**Edit S-2.** After the end of the `coachMsgs` declaration. Find (once):

```js
rks, philosophical proficiency, or any step.'}];
```

Replace with:

```js
rks, philosophical proficiency, or any step.'}];
var COACH_MSGS_PRISTINE = JSON.stringify(coachMsgs); /* the AI Guide's opening, for sealSession */
```

**Edit S-3.** Add `sealSession` and call it first in `switchToOrg` (sign-in, the admin console's Open, and switching all pass through `switchToOrg`). Find (once):

```js
function switchToOrg(id){ setCurrentOrg(id);
```

Replace with:

```js
/* -- SESSION SEAL (2 Oct 2026): every organization is sealed. Nothing at all survives a change of organization or user: no carve-outs, preferences included. -- */
function sealSession(){
  try{ if(coachOpen) toggleCoach(); }catch(e){}
  try{ if(notesOpen) toggleNotes(); }catch(e){}
  try{ if(gchatOpen) toggleGChat(); }catch(e){}
  try{ closeModal(); }catch(e){}
  try{ if(carouselState && carouselState.timer) clearInterval(carouselState.timer); }catch(e){}
  Object.keys(UI).forEach(function(k){ delete UI[k]; });
  var fresh = JSON.parse(UI_PRISTINE);
  Object.keys(fresh).forEach(function(k){ UI[k] = fresh[k]; });
  UI.theme = 'light'; UI.zoom = 1;
  try{ Store.setPref('theme', 'light'); Store.setPref('zoom', 1); Store.setPref('sidebar-min', '0'); }catch(e){}
  try{ document.documentElement.setAttribute('data-theme', 'light'); }catch(e){}
  sidebarMinimized = false; sidebarOpen = true;
  currentPage = 'home'; currentStep = null; currentPhase = null;
  navHistory = [];
  insightsTab = 'latest';
  carouselState = {idx:0, timer:null, stepId:null, hover:false};
  gateArmed = false; _lastGateStep = null;
  coachMsgs = JSON.parse(COACH_MSGS_PRISTINE);
  gchatUnreadCount = 0;
  orgSetupMode = false;
}
function switchToOrg(id){ sealSession(); setCurrentOrg(id);
```

**Edit S-4.** Sign-out. Find (once, inside `signOut`; the line break and two-space indent are part of the text):

```js
try{Collab.leave();}catch(e){}
  Auth.clearSession();
```

Replace with:

```js
try{Collab.leave();}catch(e){}
  sealSession();
  Auth.clearSession();
```

**Edit S-5.** Creating an organization switches to it. Find (once, inside `createOrg`):

```js
saveOrgs(list);
  setCurrentOrg(id);
```

Replace with:

```js
saveOrgs(list);
  sealSession();
  setCurrentOrg(id);
```

**Edit S-6.** Deleting the organization being viewed. Find (once, inside `deleteOrgById`):

```js
if(currentOrgId===id){ setCurrentOrg(null);
```

Replace with:

```js
if(currentOrgId===id){ sealSession(); setCurrentOrg(null);
```

### S.4 Where sealSession must not run

- **On page load.** `bootApp` restores a remembered session with `setCurrentOrg`, not `switchToOrg`, so the seal does not run on a reload. Keep it that way: when Part 5.4 replaces this with a check of the server session, that start-up path must not call `sealSession` or `switchToOrg`.
- **When the admin console works on another organization's data** (resetting an organization's data: Part 4). That is not a change of organization for the person, and sealing would close the admin console. Use the helper in 3.3, which never calls `sealSession` or `switchToOrg`.
- **Closing panels.** `sealSession` closes the AI Guide with `toggleCoach`. The AI Guide guard added in Part 2 must therefore block only opening, not closing (Part 2.2 step 4 gives the exact guard).

### S.5 Acceptance tests

These edits were applied to a copy of the file named in section 0 and run in a simulated browser. After a sign-out, an organization switch and an organization creation, each check below passed; on the unchanged file, the setting, the AI Guide conversation, the unread count and the page all survived a sign-out.

1. **Two organizations, one browser tab.** Sign in to organization A. Open cards and editors, type to the AI Guide, set dark theme and zoom to 150 percent, minimize the sidebar, go to the Insights page. Sign out and sign in to organization B. Nothing from A shows: Home page, light theme, 100 percent zoom, sidebar open, AI Guide at its opening message, no open editors.
2. **The admin console's Open.** From the admin console, Open organization A, work as in test 1, then Open organization B. Same result.
3. **Reload.** In organization B, set dark theme and reload the page. The theme stays dark (a reload is not a change of organization or user).
4. **Suite test.** Add a test that sets `UI.aNewKey={x:1}`, changes `UI.sec`, pushes a message to `coachMsgs`, sets the unread count to 4 and the page to Insights, pushes an entry to `navHistory`, then calls `signOut` (with `confirm` answering yes). It passes when `UI` without `entry` equals `JSON.parse(UI_PRISTINE)` with `theme` `'light'` and `zoom` `1`, `coachMsgs` equals `JSON.parse(COACH_MSGS_PRISTINE)`, the unread count is 0, the page is `'home'`, `navHistory` is empty, and the stored `theme` and `zoom` preferences are `'light'` and `1`. Repeat with `switchToOrg` and `createOrg`.

### S.6 Checklist

- [ ] S-1 `UI_PRISTINE` after the `UI` declaration
- [ ] S-2 `COACH_MSGS_PRISTINE` after the `coachMsgs` declaration
- [ ] S-3 `sealSession` added, called first in `switchToOrg`
- [ ] S-4 called in `signOut`
- [ ] S-5 called in `createOrg`
- [ ] S-6 called in `deleteOrgById` for the organization being viewed
- [ ] Not called on page load, nor by the admin console's work on another organization's data
- [ ] Acceptance tests 1 to 4 pass

---

## Part 1 — Fonts from our own server, not Google's

### 1.1 The requirement

When any page opens, and when the print window opens, the browser makes no request to `fonts.googleapis.com` or `fonts.gstatic.com`. The pages look exactly as now: Cormorant Garamond and DM Mono, in the same weights. (Each request to Google's font servers sends the user's internet address to Google, which European data protection authorities treat as a transfer of personal data.)

### 1.2 How

1. Download the WOFF2 files (Latin and Latin Extended) for the weights `index.html` loads today: Cormorant Garamond regular 300, 400, 500, 600, 700 and italic 300, 400, 600; DM Mono regular 300, 400, 500; and DM Sans regular 400, 600, 700, 800, which the print window loads. Both are free to host under the SIL Open Font License. (`index.html` was not supplied with this directive; check the weights against its Google Fonts link.)
2. Put them in a folder `fonts` beside `index.html`.
3. Create `fonts/fonts.css` with one `@font-face` rule per file, family names exactly `'Cormorant Garamond'` and `'DM Mono'`, each with `font-display: swap;`. For example:

```css
@font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:400;font-display:swap;src:url('CormorantGaramond-Regular.woff2') format('woff2')}
```

4. In `index.html`, replace the Google Fonts `<link>` (its address begins `https://fonts.googleapis.com/css2?family=Cormorant+Garamond`) with:

```html
<link rel="stylesheet" href="fonts/fonts.css">
```

5. In `Exec-Readiness-app.js`, the one remaining reference to `fonts.googleapis.com` is in the print window's code, `printDocument`. The print window is a new, empty window, so a relative address does not work there. Replace that `<link>` with one built from the page's own address:

```js
'<link rel="stylesheet" href="'+(function(){try{return new URL('fonts/fonts.css', location.href).href}catch(e){return 'fonts/fonts.css'}})()+'">'
```

6. Search every deployed file (`.html`, `.js`, `.css`) for `fonts.googleapis.com` and `fonts.gstatic.com`. Nothing may remain.

### 1.3 Acceptance tests

1. With the browser's developer tools on the Network tab, sign in, open Home, a step, an output, and the print window. No request goes to `fonts.googleapis.com` or `fonts.gstatic.com`.
2. Headings are still in Cormorant Garamond and small labels in DM Mono, on screen and in the print window.

### 1.4 Checklist

- [ ] Font files in `fonts/`, and `fonts/fonts.css` with all fifteen weights and styles
- [ ] `index.html` links `fonts/fonts.css`, no Google link
- [ ] `printDocument` links the absolute address of `fonts/fonts.css`
- [ ] No `fonts.googleapis.com` or `fonts.gstatic.com` in any deployed file

---

## Part 2 — The AI features: off by default, switched on per organization

### 2.1 The requirement

1. Each organization has two settings, **AI Guide** and **Voice**, both off when the organization is created.
2. While the AI Guide is off for the organization being viewed: the AI Guide's buttons (`coachFab`) are not shown; the AI Guide panel (`coachPanel`) cannot be opened; every other place that opens the AI Guide or asks it a question is not shown; and **no request is sent to the AI service (`CLAUDE_API_URL`) for any reason**. In this file the AI Guide does not yet call the AI service: every question gets a fixed answer, and it is being connected as a separate step. The only call today is Team Chat's (`sendGChat`), which section 2.5 removes. The switch hides the AI Guide while off; when the AI Guide is connected, the function that sends its requests begins with the guard in 2.2 step 5.
3. While Voice is off, the Voice button (`voiceFab`) is not shown and speech recognition (`SpeechRecognition` or `webkitSpeechRecognition`, started in `toggleVoice`) is never started.
4. The two switches are on the organization's Profile page (the More menu's Profile, `openOrg`), in a fold headed **AI Features (off by default)** (A.2.1), closed by default, at the top of the page. Only people with administrator rights in the organization see it.
5. A change takes effect at once, without signing out.
6. When the AI Guide panel opens, the first thing the user reads states that it is an AI. If the panel's heading and first message do not say so plainly, add A.2.6 as the panel's first line.

### 2.2 How

1. Store the settings in the organization's data: add `settings: { aiGuide: false, voice: false }` to the object `emptyData()` returns. Data without `settings` counts as both off.
2. Add:

```js
function aiGuideOn(){ return !!(data && data.settings && data.settings.aiGuide); }
function voiceOn(){ return !!(data && data.settings && data.settings.voice); }
```

3. In `render`, show or hide `coachFab`, `voiceFab` from these helpers on every render.
4. At the top of `toggleCoach`, add `if(!coachOpen && !aiGuideOn()) return;` (it blocks opening only, so `sealSession` and switching the setting off can always close an open panel). At the top of `toggleVoice`, add `if(!voiceOn()) return;`.
5. At the top of each function that sends a request to the AI service (none today; see the note in 2.1 point 2), return without sending anything if `aiGuideOn()` is false.
6. In `toggleVoice`, do not start speech recognition if `voiceOn()` is false.
7. On the Profile page, add the AI features fold with two on/off switches and the lines A.2.1 to A.2.5, as Architecture has it: `<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open">`, open while `UI.aiFoldOpen` is true (so it stays open when a setting changes and the page redraws), its heading in `<summary>`, the switches inside `<div class="ai-fold-body">`. Add to the stylesheet (it uses the stylesheet's own `--rule`, `--sans` and `--paper`):

```css
.ai-fold{border:1px solid var(--rule);border-radius:6px;padding:9px 14px;margin:6px 0 22px}
.ai-fold[open]{margin-bottom:36px}
.ai-fold>summary{cursor:pointer;font-family:var(--sans);font-style:normal;font-size:13px;font-weight:600;letter-spacing:.01em;color:var(--paper)}
.ai-fold .ai-fold-body{padding-top:12px}
.ai-fold .ai-fold-body label,.ai-fold .ai-fold-body div{font-family:var(--sans);font-style:normal}
```

### 2.3 Acceptance tests

1. Create an organization and sign in. No AI Guide or Voice button; in the Network tab, no request to the AI service while you work through three steps, post in Team Chat,.
2. As an administrator, open Profile: the fold **AI Features (off by default)** is closed; open it: both switches are off. Switch on AI Guide: its button appears at once; open it: its first line says it is an AI.
3. Switch AI Guide off: the button disappears and an open panel closes; no further request is sent.
4. Switch Voice on: its button appears. Off: it disappears and the microphone is not used.
5. A person without administrator rights sees no AI features fold.
6. Switching AI Guide on in organization A leaves organization B off.

### 2.5 Team Chat carries no AI (ruled by Paul, 2 October 2026)

Today `sendGChat` saves the person's message, then picks a real colleague from the organization's people list, shows "[name] is typing", asks the AI service to write a reply as that colleague, and saves it in the shared chat under the colleague's name (or, if the request fails, a fixed reply under the colleague's name). Replace the whole function `sendGChat` with the following. It is the current function up to the point where the person's own message is saved and shown, and nothing after it (taken from the file named in section 0; checked: it parses, a message posts exactly once, and no request goes to the AI service):

```js
function sendGChat(){
  var inp=$('gchatInput');if(!inp||!inp.value.trim())return;
  var text=inp.value.trim();inp.value='';
  var cu=getCurrentUser();var cuId=cu?cu.id:'u1';
  var now=new Date();var ts=(now.getHours()%12||12)+':'+(now.getMinutes()<10?'0':'')+now.getMinutes()+' '+(now.getHours()>=12?'PM':'AM');
  chatArr().push({who:cuId,name:cu?cu.name:'You',ts:ts,text:text}); Store.commit('chatMsgs');
  renderGChatPanel();
  /* 2 Oct 2026 (Paul): Team Chat carries no AI; nothing is written in anyone else's name */
}
```

Acceptance: post a message; it appears once, under the poster's name; no other message is added, no "is typing" line appears, and no request goes to the AI service.

### 2.4 Checklist

- [ ] `settings` in `emptyData()`; missing settings count as off
- [ ] `aiGuideOn()` and `voiceOn()`; buttons shown or hidden on every render
- [ ] Guards in `toggleCoach` (opening only), `toggleVoice`; the AI Guide's request function guarded when it is connected
- [ ] The AI features fold on Profile, administrators only, closed by default and kept open across a change
- [ ] AI Guide panel opens with a plain statement that it is an AI
- [ ] 2.5: Team Chat's AI request and both simulated replies removed

---

## Part 3 — The sample organization: a private copy in each person's browser

### 3.1 What this part adds

A private sample organization that every signed-in person can open beside their own workspace. The More menu's existing sample items (**Seed sample data**) stay as they are for now, while the modules are tested (ruled by Paul, 5 October 2026); removing them comes in a later directive.

### 3.2 The requirement (agreed by Paul and Faisal, 2 October 2026)

1. The top bar, for every signed-in person, has **Demo** (A.3.1), where the Notes button was (3.3 steps 7 and 8). It opens the module in a new browser tab, in sample mode. The person's own workspace stays open in the first tab.
2. The sample tab opens only from a signed-in tab. Opened any other way, it shows only A.3.6.
3. **Where things run.** The app itself still comes from the server, as always. Only the sample's data is kept in that person's own browser, under its own key. Nothing the person does in the sample tab is sent to the server, so nobody else sees it or is affected by it.
4. The first time a person opens the sample, their copy is created from the module's built-in sample, `seedData`. Nobody signs in as a sample person: the tab enters as the first sample person, and the sample people have no passwords.
5. A note in red text (A.3.2) stays at the top of the main content, above the Back button, on every page of the sample tab: large (twice the body size), bold and centered. It never covers the top bar.
6. In the sample tab the AI Guide, Voice and Team Chat are off, whatever the settings say, and no email is sent.
7. In the sample tab the More menu offers **Start the sample again** (A.3.3, asking A.3.4 first) and **Close the sample** (A.3.5) in place of Change password; it shows neither Notes, Org & Team nor Admin, and the top bar shows no Demo button.
8. Nobody edits a shared master copy: every person's copy starts from the same built-in sample.
9. The More menu's existing sample items, and the sample functions behind them (`seedData`), stay exactly as they are for now. The sample tab does not show them.

### 3.3 How

1. Add beside the other constants: `var SAMPLE_LOCAL_ID = 'org_sample_local'; var SAMPLE_MODE = false;`, `isSampleTab()` (true when the page address carries `?sample=1`), and `openSampleTab()` (only when someone is signed in: leave a pass in the browser's storage, `localStorage.setItem('sample-tab-pass', JSON.stringify({t: Date.now()}))`, then `window.open(location.pathname + '?sample=1', '_blank')`).
2. At the start of `bootApp`, in a sample tab: accept the tab if the pass is under two minutes old (remove it either way, so it works only once) or if `window.opener` is signed in (a page opened from a `file://` address cannot read its opener, so the pass is the dependable route). If neither, set `SAMPLE_MODE = true`, show A.3.6, call `render()` and return `true`. Otherwise set `SAMPLE_MODE = true` and `currentOrgId = SAMPLE_LOCAL_ID` in this tab's memory only (never `setCurrentOrg`, which stores the pointer the person's own tab uses), load the copy, create it from `seedData` with its confirmation suppressed if it is empty, set its AI settings off, remove every sample person's password, save, enter as the first sample person, then call `render()` and return `true`, exactly as the end of `bootApp` does. Returning before `render()` leaves a blank page (Architecture's first version did exactly that).
3. **Storage.** The sample copy is read and written only in the browser's own storage (`localStorage`), under keys for `org_sample_local`. In deployment, the storage layer sends every other organization to the server and keeps this one in the browser. The sample tab makes no request to any server after it starts: no saves, no polling for changes, no locks, no notifications.
4. In `render`, while `SAMPLE_MODE` is true, make the note (A.3.2) the first line inside the page's content container, in red (`#B3261E`), extra-bold, 28 pixels, centered, directly above the Back button (in the family layout, the first child of `.content-inner`). Never place it above that container: the top bar overlays the space above it and would hide the note. Add the note at the end of every `render`, and watch the main container with a `MutationObserver` for pages drawn a moment after the rest (screens loaded by the screen loader). Hide the Team Chat button. `aiGuideOn()` and `voiceOn()` return false while `SAMPLE_MODE` is true, and `toggleGChat` refuses to open.
5. Leave the existing sample functions and their More-menu items unchanged; in the code that draws the More menu (in `render`), hide them while `SAMPLE_MODE` is true.
7. **The top bar** (agreed by Paul and Faisal, 5 October 2026). Replace the Notes button (`id="notesNavBtn"`, `onclick="toggleNotes()"`) with the Demo button: `'+(SAMPLE_MODE?'':'<button id="sampleNavBtn" class="btn-ghost pad-chip-md nav-action" onclick="openSampleTab()">&#9673; Demo</button>')+'`. The top bar's right-hand side then holds exactly: the signed-in person's menu, Help, Dark mode, Team Chat, Demo, More.
8. **Notes moves into the More menu**, above Org & Team, with its count, and is not shown in the sample tab: `(SAMPLE_MODE?'':'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleNotes()"><span class="nav-more-ic">&#9998;</span> Notes <span id="notesCount" class="notes-count">'+((data.notes||[]).length)+'</span></button>')+`. `toggleNotes` and `updateNotesCount` already check that their elements exist.
9. Keep code comments outside quoted markup: a comment inside a quoted string is drawn on screen as text (Architecture's first version of this change showed one in its top bar).

### 3.4 Acceptance tests

1. Sign in to a client organization and choose **Demo** in the top bar. A new tab opens on the sample company with the red note above the Back button, and every control in the top bar still works; the first tab is unchanged.
2. In the sample tab, change and add records. Open the sample in a second browser: it shows the untouched sample. The client organization is unchanged, and the server receives no sample data.
3. Open the sample tab's address in a browser that is not signed in: only A.3.6 shows.
4. In the sample tab, the AI Guide, Voice and Team Chat buttons are absent.
5. Start the sample again: the original sample returns.
6. In a client organization, the existing sample items are still in the More menu and work as before; in the sample tab they are hidden.

### 3.5 Checklist

- [ ] `SAMPLE_LOCAL_ID`, `SAMPLE_MODE`, `isSampleTab`, `openSampleTab`; the sample start in `bootApp`
- [ ] Sample data kept only in the browser; never sent to the server
- [ ] The red note above the Back button on every page; AI Guide, Voice and Team Chat off; Start again and Close in the More menu
- [ ] Existing sample items left as they are, and hidden in the sample tab
- [ ] Demo in the top bar where Notes was; Notes in the More menu with its count; no comment text on screen

---

## Part 4 — Resetting an organization's data, and deleting an organization

### 4.1 What already exists

The admin console's **Delete** (`adminDeleteOrg`) asks "Delete "[name]" and all of its data? This cannot be undone.", refuses the organization the administrator is in, keeps at least one organization, and removes it through `deleteOrgById` and `Store.removeOrg`.

### 4.2 The requirement

1. Keep **Delete**.
2. Add **Reset data** (A.4.0) to every organization's row. It follows Rollout item 68, the reset scope law: the organization, its name, its administrators, their passwords, and its AI settings stay; every other team member is removed, with their sign-in, together with all the program data. It asks A.4.1 first, which states the removal.
3. This replaces the More menu's **Reset all data** (`clearData`): remove that item from the More menu.
4. Server: deleting an organization deletes everything held for it, including its people's password hashes; resetting removes everything except the organization record, its administrators, their password hashes, and its settings, and deletes the removed members' sign-ins.

### 4.3 How

Use `withOrgData(id, fn)` (3.3) with a function that keeps the administrators from the people list (members with administrator rights) and `data.settings`, sets `data = emptyData()`, and puts them back; every other member is gone. Never `switchToOrg`: resetting another organization's data is not a change of organization for the administrator.

### 4.4 Acceptance tests

1. Reset an organization's data: its administrators can still sign in; every other member is gone from the people list and cannot sign in; its steps and outputs are empty; its AI settings are as they were; every other organization is unchanged; the admin console stays open.
2. Delete an organization: it leaves the list; its people can no longer sign in.
3. Param: after a deletion, nothing remains on the server for its id, including password hashes.

### 4.5 Checklist

- [ ] **Reset data** on every organization's row (A.4.0, A.4.1)
- [ ] Resetting keeps the organization, its administrators, their passwords and its settings, and removes every other member, via `withOrgData`
- [ ] Server-side deletion verified by Param

---

## Part 5 — Passwords: the browser

The browser shows the screens, checks a proposed password against the rule so people get an immediate answer, sends passwords to the server over HTTPS, and never keeps them. The server stores and checks them (Part 6). The browser does not hash: a hash made in the browser simply becomes the thing that is sent.

### 5.1 The password rule (identical in every module; ruled by Paul, 1 October 2026)

At least 8 characters, at most 128, at least one number, at least one special character (anything that is not a letter, a number or a space), and not one of the most common passwords. Add this block above the `Auth` object. It has been tested: accented letters count as letters, spaces are allowed, and common passwords that meet the rule, such as `Password1!`, are refused.

```js
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
```

Every password field allows pasting (for password managers), never cuts a password short, and shows A.5.18 under every field where a new password is chosen.

### 5.2 Remove the browser's own password handling

In this file `passcode` appears in: `addProfile`, `adminChangePasscode`, `adminSaveUser`, `applyTeamRoster`, `createOrg`, `doAdminLogin`, `doSetup`, `ensurePasscode`, `findUserByLogin`, `migrateLegacyData`, `renderAdminConsole`, `renderAdminLogin`, `saveProfile`, `seedData`, `setAdminPasscode`, `signIn`, `signInAdmin`.

1. Remove the `passcode` field from every person in `data.roster` and from every place that writes it, including `createOrg`, `adminSaveUser`, `doSetup`, `addProfile`, `saveProfile`, `seedData` and the sample data.
2. Remove every default code: `DEFAULT_PASSCODE='1234'` in `Auth`, the `'1234'` defaults in `createOrg` and `adminSaveUser`, and any other.
3. Remove the in-browser sign-in checks: the branch of `Auth.signIn` that runs when `AUTH_ENDPOINT` is `''` (it calls `findUserByLogin`), the comparison inside `findUserByLogin`, and the branch of `Auth.signInAdmin` that keeps the administrator's code in the browser (`adminCreds`, `setAdminCreds`, `setAdminPasscode`, `ensurePasscode`).
4. A typed password is sent to the server and then cleared from its field; it is never saved in data, browser storage, a printout, a report, or an export.
5. Done when a search of the file for `passcode`, `1234`, `DEFAULT_PASSCODE`, `adminCreds` and `setAdminCreds` finds nothing that handles a password.

### 5.3 The browser's requests

Add to `Auth`, each sending one request (Part 6.2) and calling back with the answer:

| Function | Sends | Used by |
|---|---|---|
| `Auth.signIn(username, password, remember, cb)` | `POST /session` | the sign-in screen |
| `Auth.signInAdmin(username, password, cb)` | `POST /admin-session` | the admin sign-in |
| `Auth.currentSession(cb)` | `GET /session` | start-up |
| `Auth.changePassword(current, next, cb)` | `POST /password` | Change password; Choose a new password |
| `Auth.changeAdminPassword(current, next, cb)` | `POST /admin/password` | the admin console's Change password |
| `Auth.setTemporaryPassword(orgId, userId, temporary, cb)` | `POST /admin/temporary-password` | the person editor |
| `Auth.signOut(cb)` | `POST /sign-out` | Sign out |

Refusals become Appendix A words: `'no-user'` and `'bad-password'` → A.5.3; `'no-credential'` → A.5.12; `'locked'` → A.5.4; `'bad-current'` → A.5.15; `'same'` → A.5.10; `'weak'` and `'common'` → the message `passwordProblem` gives for the same password.

### 5.4 The sign-in screen

1. The second field becomes `type="password"`, no `inputmode="numeric"`, `autocomplete="current-password"`, placeholder A.5.1; pasting allowed.
2. The line above the fields becomes A.5.2 (it reads "Enter your username and PIN to open your organization's workspace." today).
3. Every on-screen **PIN** and **Passcode** becomes **Password**, including the admin console's **Change passcode** (`adminChangePasscode`).
4. **Remember me** is sent with the sign-in; the server then keeps the session longer.
5. Start-up calls `Auth.currentSession`: a signed-in answer opens the workspace, otherwise the sign-in screen. The ids stored by `Store.setRemember` no longer sign anyone in. This start-up path must not call `sealSession` or `switchToOrg` (Part S.4); a person signing in from the sign-in screen does go through `switchToOrg`.

### 5.5 Choose a new password

When the server's sign-in answer has `mustChange: true`, the workspace does not open; a screen (A.5.5, A.5.5a, A.5.6, A.5.7, A.5.18, A.5.8) asks for a new password twice. `passwordProblem` must return `''` (otherwise show its message); the entries must match (otherwise A.5.9); then `Auth.changePassword(temporary, new)`; `'same'` shows A.5.10; success opens the workspace.

### 5.6 Change password

A More-menu item for every signed-in person (A.5.11) opens a dialog: current password (`autocomplete="current-password"`), new and confirm (`autocomplete="new-password"`), the rule line, a button (A.5.13, A.5.6, A.5.7, A.5.8). Check as in 5.5, send `Auth.changePassword`, show refusals as in 5.3, and A.5.16 on success. The admin console's Change password works the same way with `Auth.changeAdminPassword`.

### 5.7 Setting someone's password

1. In the person editor (`adminUserEditorHtml`, saved by `adminSaveUser`), the passcode field becomes **Temporary password**, with A.5.18 and A.5.17 beneath it.
2. Adding a team member: required. It must pass `passwordProblem`, and is sent with `Auth.setTemporaryPassword` once the member is saved; the member chooses their own password at their first sign-in (5.5). People who are only recorded in the module are not team members and are not added here.
3. Editing a member: leave the field empty to keep their password; filling it sets a new temporary one.
4. `createOrg`, used by the app administrator: a temporary password for the first person is required, sent with `Auth.setTemporaryPassword`. `doSetup`, where a person sets up their own organization with the setup code: the password they choose is their own, so it is not temporary.
5. The app administrator's account exists from installation (5.12). Remove the first-use flow that let whoever first opened the admin console set its code (`doAdminLogin`, `renderAdminLogin`, `setAdminPasscode`).

### 5.8 Acceptance tests

1. Create an organization with a first person and a temporary password; sign in with it: **Choose a new password** opens. `abc1!` → "Use at least 8 characters."; `abcdefgh` → "Include at least one number."; `abcdefg1` → "Include at least one special character, such as ! or #."; `Password1!` → "That password is too common. Choose another."; two different good passwords → "The two passwords do not match."; the temporary password again → "Choose a password different from your current one."; a good password twice → the workspace opens.
2. Sign out and in with the new password: the workspace opens directly.
3. Reload while signed in: the workspace reopens. Sign out and reload: the sign-in screen.
4. Five wrong passwords: the fifth refusal shows A.5.4, and the right password is refused for 15 minutes.
5. Change password from the More menu: a wrong current password is refused; a good change works; the next sign-in needs it.
6. A temporary password set in the admin console forces the person to choose their own.
7. Adding a member without a temporary password is refused.
8. A pasted 40-character password works.
9. The organization's data as the browser receives it, browser storage, a printout and a compiled report contain no password, hash or `passcode`.
10. Searching the file for `passcode`, `1234`, `DEFAULT_PASSCODE`, `adminCreds` and `setAdminCreds` finds nothing that handles a password.

### 5.9 Creating an organization needs a setup code (ruled by Paul, 2 October 2026; a placeholder)

1. The setup screen gains a **Setup code** field (A.5.19, A.5.20) above its other fields.
2. Setting up a new organization refuses a missing or wrong code with A.5.21 and creates nothing. For now the one code is `ABCXYZ`, held in `SETUP_CODE`; in deployment the server checks it, never the browser alone. Faisal's voucher and registration system replaces it later.
3. Acceptance: setup with `WRONG` shows A.5.21 and adds no organization; setup with `ABCXYZ` creates it, its first person as administrator.

### 5.10 Managing people is for administrators (ruled by Paul, 2 October 2026)

1. Only an organization's administrators, and the app administrator, add members, edit other members, remove members, or set a member's temporary password. Guard `addProfile`, `editProfile`, `saveProfile` and `removeProfile` (and the admin console's person editor), and show **+ Add team member** and each row's edit and delete controls only to them.
2. Every member can still edit their own profile and change their own password.
3. Acceptance: signed in as an ordinary member, the add, edit-other and delete controls are absent, and calling those functions in the console changes nothing; signed in as an administrator, all of them work.

### 5.11 Unique usernames (ruled by Paul, 5 October 2026)

1. No two accounts in the same login database share a username. The login database is whatever serves the installation: one organization, a block of organizations sold together, or every NextChapter installation.
2. Adding a member, changing a member's username, setting up an organization, and the admin console's person editor all refuse a username already in use, ignoring capitals and surrounding spaces, with A.5.22. Keeping one's own username when editing is allowed.
3. Someone who works in two organizations under one login database holds two accounts.
4. Acceptance: with `maria` in organization A, adding ` Maria ` in organization B is refused with A.5.22; setting up a new organization whose first person is `MARIA` is refused; editing Maria's own record without changing her username saves.

### 5.12 The app administrator's default account (ruled by Paul, 2 October 2026)

1. Every installation starts with one app administrator account: username `admin`, password `NextChapter2026!`. The account is handed to the buyer.
2. The password works only once: the first sign-in opens **Choose a new password** (5.5) before anything else, so the published default never opens an installation that is in use.
3. The app administrator can change their username (subject to 5.11) and their password at any time. The administrator's sign-in screen asks for a username and a password.
4. Acceptance: on a fresh installation, `admin` / `NextChapter2026!` signs in and opens Choose a new password; after a new password is chosen, `NextChapter2026!` is refused.

### 5.13 Checklist

- [ ] Rule block (5.1) unchanged; rule line under every new-password field
- [ ] `passcode`, default codes and in-browser checks removed; passwords cleared after sending
- [ ] `Auth` requests (5.3); refusals mapped to Appendix A
- [ ] Sign-in field and words; Remember me; start-up session check without the seal
- [ ] Choose a new password; Change password (More menu and admin console)
- [ ] Temporary password required in the person editor, `createOrg` and `doSetup`
- [ ] Administrator's first-use flow removed
- [ ] Setup code field and check (5.9)
- [ ] Managing people limited to administrators (5.10)
- [ ] Unique usernames (5.11)
- [ ] The app administrator's default account, one-time password (5.12)

---

## Part 6 — Passwords on the server (for Param)

### 6.1 The requirement

1. **Hashing.** Store every password only as an Argon2id hash (at least 19 MiB of memory, 2 iterations, 1 degree of parallelism, the OWASP Password Storage Cheat Sheet's recommended setting), or bcrypt with a work factor of 10 or more. Each hash has its own random salt. Verify a sign-in against the stored hash with the same library. Never store, return or log a readable password.
2. **Apart from the organization's data.** Password hashes live in their own store of sign-ins. When the browser saves an organization's data, the server strips any `passwordHash`, `mustChange` or `passcode` from the people list; when it sends the data, none is present. (The people list travels to every signed-in member's browser.)
3. **Sessions.** On a correct sign-in, set a session cookie marked `HttpOnly`, `Secure` and `SameSite=Strict`. Without Remember me it ends when the browser closes and after 8 hours unused; with Remember me it lasts 30 days. Sign-out ends it at once; changing a password ends the person's other sessions.
4. **Access.** Refuse every read or save of an organization's data unless the session belongs to a person in that organization, or to the app administrator.
5. **The rule.** Apply exactly the rule in 5.1 to every new password, temporary or chosen, whatever the browser has checked, and refuse passwords on a list of the 100,000 most common and leaked passwords.
6. **Temporary passwords** (set by an administrator, or at installation) are marked `mustChange`; until changed, the person can do nothing else.
7. **Failed attempts.** After 5 wrong passwords for one username within 15 minutes, refuse it for 15 minutes; slow repeated failures from one internet address.
8. **Logging.** Never log a sign-in or password request body. Record each sign-in, failed sign-in, password change and temporary password set, with time and username.
9. **Transport.** HTTPS only, with HTTP Strict Transport Security on.
10. **Installation.** Create the app administrator's account with username `admin` and the password `NextChapter2026!`, marked `mustChange`, so it works only once (5.12).
11. **Deleting** an organization deletes its people's sign-ins (Part 4).
12. **The setup code.** Creating an organization is refused unless the request carries the installation's setup code (`ABCXYZ` for now), checked on the server.
13. **Managing people.** Requests that add, change or remove a member, or set a temporary password, are refused unless the session belongs to an administrator of that organization or to the app administrator.
14. **Unique usernames.** A request that would create a duplicate username in the login database is refused, whatever the browser has checked.
15. **A stored password that breaks the rule.** At sign-in, a correct password that no longer meets the rule (one set before it) is accepted only with `mustChange: true`, so the person replaces it at once.

### 6.2 The requests

All JSON. `{AUTH_ENDPOINT}` is the server address set in the module.

| Request | Body | Answer | Refusals (`{ok:false, reason}`) |
|---|---|---|---|
| `POST {AUTH_ENDPOINT}/session` | `{username, password, remember}` | `{ok:true, orgId, userId, mustChange}` and the cookie | `'no-user'`, `'bad-password'`, `'no-credential'`, `'locked'` with `retryAfterMinutes` |
| `GET {AUTH_ENDPOINT}/session` | none | `{ok:true, orgId, userId, mustChange}` while signed in | `{ok:false}` |
| `POST {AUTH_ENDPOINT}/admin-session` | `{username, password}` | `{ok:true, mustChange}` and the cookie | `'bad-password'`, `'locked'` |
| `POST {AUTH_ENDPOINT}/password` | `{current, next}` | `{ok:true}` | `'bad-current'`, `'weak'`, `'common'`, `'same'` |
| `POST {AUTH_ENDPOINT}/admin/password` | `{current, next}` | `{ok:true}` | as above |
| `POST {AUTH_ENDPOINT}/admin/temporary-password` | `{orgId, userId, temporary}` | `{ok:true}` (marks `mustChange`) | `'weak'`, `'common'`, `'not-admin'` |
| `POST {AUTH_ENDPOINT}/sign-out` | `{}` | `{ok:true}` | |

### 6.3 Acceptance tests

1. The store of sign-ins holds Argon2id (or bcrypt) hashes, no readable password; organization data holds no `passwordHash`, `mustChange` or `passcode`.
2. With one organization's session, a request for another organization's data is refused.
3. Five wrong passwords lock the username for 15 minutes.
4. The cookie is `HttpOnly`, `Secure`, `SameSite=Strict`.
5. `/admin/temporary-password` with `abcdefgh`, sent directly, is refused with `'weak'`.
6. After a day of testing, no password appears in the logs.
7. `http://` redirects to `https://`.

### 6.4 Infrastructure (Param to decide and write down)

- Storage encrypted at rest, in an EU region for EU clients.
- How long backups keep a deleted or emptied organization's data, and that a deleted organization is never restored without the client's written instruction.

### 6.5 Checklist

- [ ] Argon2id or bcrypt; no readable password stored, returned or logged
- [ ] Sign-ins apart from organization data; fields stripped both ways
- [ ] Cookie flags, lifetimes, sign-out, other sessions ended on a change
- [ ] Every data request checked against the session's organization
- [ ] Rule and common-password list applied on the server; temporary passwords `mustChange`
- [ ] Attempt limit; sign-in events logged without bodies; HTTPS and HSTS
- [ ] Deletion removes sign-ins
- [ ] Setup code checked on the server; managing people limited to administrators on the server; unique usernames enforced on the server
- [ ] The app administrator's default account at installation, one-time password
- [ ] Encryption at rest and backup retention written down

---

## Part 7 — The personal record (this module only)

### 7.1 The requirement

Any person the organization holds information about, user or not, can be given a printed copy of what is held about them, produced by the administrator from the Report Manager.

1. The Report Manager's content list gains a group **Individual People** (A.7.1): one entry per person in the leadership inventory and in the people list, each once; a leader matches a person by the leader's `userId`.
2. Adding a person adds their **personal record**, printing in order: their leader record at full depth (as **Individual Leaders** prints it); every entry of their practice log (`data.practiceLog[userId]`) with its date; every Team Chat message they sent (`data.chatMsgs`) with its date; every note they wrote (`data.notes`), if notes record their author; and every other record that names them, by id or name, as subject, owner, author, assignee or attendee, with the record's name and the field that names them.
3. Heading and first line: A.7.2 and A.7.3.
4. No password or password field ever appears in it.

### 7.2 Acceptance tests

1. In the sample organization, a sample leader's personal record shows their leader record, all their practice log entries, and the other records that name them.
2. Every record containing that person's id or full name appears in it.
3. A person in the people list who is not a leader appears under **Individual People**, with what they wrote.

### 7.3 Checklist

- [ ] **Individual People** group; personal record section in the order above
- [ ] Words A.7.1 to A.7.3; search test passes

---

## 8. Acceptance across the module

On the test server, after all parts:

1. Fresh installation: sign in to the admin console as `admin` with `NextChapter2026!`, and choose a new password.
2. Create a client organization with a first person and a temporary password; sign in as that person; choose a password; the workspace opens with no AI Guide or Voice button.
3. As the organization's administrator, switch the AI Guide on, use it, switch it off.
4. Throughout 2 and 3, the Network tab shows no request to Google's font servers, and AI requests only while the switch is on.
5. Choose **Demo** in the top bar: it opens in a new tab with its red note, and the client organization is unchanged.
6. Reset the client organization's data; its administrators can still sign in, and every other member is gone.
7. Part S's two-organization test passes.
8. The test suites report no failures.

## 9. Checklist for the delivery

| Part | Done |
|---|---|
| S. Session seal | [ ] |
| 1. Fonts | [ ] |
| 2. AI features switches | [ ] |
| 3. Sample organization | [ ] |
| 4. Resetting and deleting | [ ] |
| 5. Passwords and accounts: the browser | [ ] |
| 6. Passwords and accounts: the server | [ ] |
| 7. Personal record | [ ] |
| Test suites updated and passing | [ ] |

---

## Appendix A — Every new on-screen word

Use these exactly. `[name]` is the organization's or person's name.

**A.2 AI features (Profile page)**

| Ref | Where | Words |
|---|---|---|
| A.2.1 | Fold heading, closed by default | AI Features (off by default) |
| A.2.2 | First switch | AI Guide |
| A.2.3 | Under the AI Guide switch | When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider. |
| A.2.4 | Second switch | Voice |
| A.2.5 | Under the Voice switch | When this is on, Voice uses the browser's own speech recognition. Some browsers send the recording to the browser maker to turn it into text. |
| A.2.6 | First line of the AI Guide panel, only if it does not already say it is an AI | You are talking to an AI assistant. It can make mistakes, so check anything important. |

**A.3 The sample organization (agreed 2 October 2026; words for Paul's veto)**

| Ref | Where | Words |
|---|---|---|
| A.3.1 | Top-bar button, where Notes was | Demo |
| A.3.2 | Red note at the top of the main content, sample tab: large, bold, centered | Sample organization: your changes stay in this browser only |
| A.3.3 | Sample tab, More menu | Start the sample again |
| A.3.4 | Before starting again | Start the sample again? Your changes in this tab are replaced with the original sample. |
| A.3.5 | Sample tab, More menu | Close the sample |
| A.3.6 | A sample tab opened without a signed-in tab | Sign in to your organization, then open Demo from the top bar. |

**A.4 Resetting an organization's data (admin console; ruled by Paul, 2 October 2026)**

| Ref | Where | Words |
|---|---|---|
| A.4.0 | Button on each organization's row | Reset data |
| A.4.1 | Before resetting | Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone. |

**A.5 Passwords**

| Ref | Where | Words |
|---|---|---|
| A.5.1 | Sign-in field placeholder | Password |
| A.5.2 | Above the sign-in fields | Enter your username and password to open your organization's workspace. |
| A.5.3 | Wrong username or password | That username and password do not match. |
| A.5.4 | Too many attempts | Too many attempts. Try again in 15 minutes. |
| A.5.5 | Choose a new password: heading | Choose a new password |
| A.5.5a | Under the heading | Your administrator set a temporary password. Choose your own to continue. |
| A.5.6 | New password field | New password |
| A.5.7 | Confirmation field | Confirm new password |
| A.5.8 | Button | Save password |
| A.5.9 | Entries differ | The two passwords do not match. |
| A.5.10 | Same as the old one | Choose a password different from your current one. |
| A.5.11 | More menu item | Change password |
| A.5.12 | A member with no password | This person has no sign-in yet. Ask your administrator to set a password. |
| A.5.13 | Current password field | Current password |
| A.5.15 | Wrong current password | Your current password is not correct. |
| A.5.16 | After a change | Your password has been changed. |
| A.5.17 | Under Temporary password | The person will be asked to choose their own password the next time they sign in. |
| A.5.18 | Under every new-password field | At least 8 characters, including a number and a special character such as ! or #. |
| A.5.19 | Setup screen field label | Setup code |
| A.5.20 | Setup code placeholder | The code you were given |
| A.5.21 | Wrong or missing setup code | That setup code is not recognized. |
| A.5.22 | A username already in use | That username is already taken. Choose another. |
| A.5.23 | Choose a new password, the administrator's first sign-in | This password works only once. Choose your own to continue. |
| A.5.24 | Choose a new password, a stored password that breaks the rule | Your password does not meet the current password rules. Choose a new one to continue. |
| A.5.25 | Above the administrator's sign-in fields | Enter the administrator username and password to view all organizations and users. |
| A.5.26 | Admin console button | Change username |
| A.5.27 | After a username change | Your username has been changed. |
| A.5.28 | Administrator's sign-in refused | That username and password do not match. |
| — | From `passwordProblem` | Use at least 8 characters. · Use no more than 128 characters. · Include at least one number. · Include at least one special character, such as ! or #. · That password is too common. Choose another. |
| — | Admin console button (was Change passcode) | Change password |
| — | Person editor field (was Passcode) | Temporary password |


**A.7 The personal record**

| Ref | Where | Words |
|---|---|---|
| A.7.1 | Report Manager group | Individual People |
| A.7.2 | Section heading | Personal record: [name] |
| A.7.3 | First line | The information this workspace holds about [name], gathered from every part of the program. |
