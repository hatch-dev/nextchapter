# Directive – Terms of Use acceptance screen (five modules)

**For:** the developers of AI-Ready Architecture, AI Innovation Pipeline, Responsible AI Governance, Executive Readiness and AI-Ready Culture. **From:** Paul Scade, 18 November 2026. **Priority:** needed before third parties are let into the apps.

**Reference build:** AI-Ready Workforce, where this change is built and tested (`Workforce-app.js` `3bcbbfe8` → `6ab84dad`, `Workforce-styles.css` `f2c93e6e` → `28e56a46`). The five module sections below give each module's exact changes.

---

## What happens now

Anyone who signs in goes straight into the workspace. Nothing asks them to accept terms of use, and nothing records that they did. Third parties are now being given access to evaluate the apps, so every person must accept terms that protect the software, methods and content before they use it.

## What is required (ruled by Paul, 18 November 2026)

1. **Every person accepts the Terms of Use after signing in and before the workspace opens.** This covers every way in: signing in, a remembered session reopening, setting up a new organization, an invited member's first sign-in, and after choosing a new password. While the terms are pending, the top bar, sidebar, Guide and Voice stay hidden.
2. **The screen** reads, word for word: eyebrow "NextChapter · 90-Day Jump-Start Program", title "Before you start", introduction "These terms govern your use of the NextChapter 90-Day programs. They protect the work you put into the app, and they protect the software, methods and content that make up the programs. Please read them before you continue.", the full terms in a scrolling box, then the tick boxes and the buttons **Continue** and **Decline and sign out**.
3. **The tick boxes.** Everyone ticks "I have read and agree to the Terms of Use and the Privacy Policy." An administrator also ticks "I am authorized to accept these terms on behalf of [organization name]." while the organization has not accepted the current version. In practice that is the person who creates the organization. Invited members see only the first box. **Continue** stays disabled until every box shown is ticked.
4. **Decline and sign out** ends the session and records nothing.
5. **What is recorded.** On the person's roster record, `terms: {v, at}` (the version and the time accepted). On the organization's data, `termsOrg: {v, userId, name, at}` when an administrator accepts for it. Every acceptance is appended to `data.termsLog` as `{userId, name, v, at, forOrg}`.
6. **New versions.** Raising `TERMS_VERSION` asks everyone to accept again at their next visit, and asks an administrator to accept again for the organization.
7. **Exempt:** the sample organization opened by Demo (it opens only from a signed-in tab, whose person has already accepted) and the app administrator's own console view.
8. **Reading the terms later.** The account menu gains **Terms of Use**, which opens the terms read-only with "You accepted version [v] on [date]." and "Accepted for [organization] by [name] on [date]."
9. **The terms text** is Part A's `TERMS_SECTIONS`, word for word: Version 1.0, effective November 18, 2026, between the user and **Next Chapter, LLC and Shadoka LLC**, under the laws of the **State of Connecticut**, contact **faisal.hoque@nextchapter.org**, Privacy Policy https://nextchapter.org/privacy.html.

**Server note.** In these local builds the records save through `persistRoster()` with the rest of the organization's data. On the live service, make sure `terms` on roster records, `termsOrg` and `termsLog` are stored and returned with the organization's data. The screen itself is a client-side gate. If you want acceptance enforced, the server should also refuse an organization's data to a person whose `terms.v` is not the current version.

---

## How the change is built

The change has the same three parts in every module:
- **Part A, the terms block:** one self-contained piece of code, identical in every module, inserted immediately before `renderEntry`. It holds the terms text and the screen, acceptance, decline and read-only view. It uses only `esc`, `$`, `getOrg`, `getCurrentUser`, `persistRoster`, `render`, `closeModal`, `data`, `UI`, `USERS` and `currentModal`, and checks before using `escAttr`, `SAMPLE_MODE`, `isAppAdmin`, `signOutNow`, `Collab` and `openOrgSetup`.
- **Part B, the styles:** appended to the end of the module's stylesheet, identical in every module.
- **The hooks:** up to five small changes that connect Part A to the module. They differ slightly between modules, so each module's section quotes its own.

**Every quoted text was counted in the copies named in each section. If a quoted text is not found exactly once in your build, stop and report it.** Your builds are newer than some of these copies and are wired to the server. Where your code differs, make the change described in the hook's heading wherever that code now lives, and list it in the close-out. Code blocks show the source exactly as it is in the file, including its backslash escapes. Copy them exactly.

---

## Part A. The terms block (identical in every module)

Insert immediately before `function renderEntry(){` (Hook 1 shows the exact place).

```js
/* ═══ Terms of Use acceptance (Paul, 18 Nov 2026): every person accepts the program terms after signing in and before the workspace opens.
   The person who first accepts for an organization, as one of its administrators, also confirms they may accept on the organization's behalf.
   The block is the same in every module: it uses only esc, $, getOrg, getCurrentUser, persistRoster, render, closeModal, data, UI and currentModal, and checks for the rest.
   Acceptance is kept on the person's roster record (terms) and, for the organization, on data.termsOrg, with each acceptance logged in data.termsLog.
   Raising TERMS_VERSION asks everyone to accept again at their next visit. The sample organization and the app administrator's view are exempt. ═══ */
var TERMS_VERSION='1.0';
var TERMS_EFFECTIVE='November 18, 2026';
var TERMS_CONTACT='faisal.hoque@nextchapter.org';
var TERMS_PRIVACY_URL='https://nextchapter.org/privacy.html';
var TERMS_SECTIONS=[
 {h:"1. Agreement",p:["These Terms of Use (“Terms”) are an agreement between you and Next Chapter, LLC and Shadoka LLC (together, “NextChapter”, “we”, “us”). They govern your use of the NextChapter 90-Day program applications, including AI Innovation Pipeline, Responsible AI Governance, AI-Ready Architecture, Executive Readiness, AI-Ready Culture and AI-Ready Workforce, together with their software, content, documents, videos, AI guide and related services (the “Service”). By ticking the box and continuing, you agree to these Terms and to our Privacy Policy. If you are using the Service on behalf of an organization, you also agree to them on that organization’s behalf. If you do not agree, do not use the Service."]},
 {h:"2. Who may use the Service",p:["You may use the Service only if your organization has been given access by NextChapter, or you have been invited by an administrator of such an organization. You must be at least 18 and able to enter into a binding contract. If you accept on behalf of an organization, you confirm that you are authorized to do so."]},
 {h:"3. Your account",p:["You must give accurate information and keep your sign-in details confidential. Your account is for you alone, and you may not share it. You are responsible for everything done through your account. Tell us at once at "+TERMS_CONTACT+" if you believe your account has been used without your permission."]},
 {h:"4. Our intellectual property",p:["The Service and everything in it belong to NextChapter or its licensors and are protected by copyright, trade secret, trademark and other laws. This includes:"],ol:["the software, source code, scripts, stylesheets and data structures","the design, layout, screens and user interface","the programs’ structure, phases, steps, sequences and workflows","the frameworks, methods, concepts and models","the questionnaires, assessment instruments, scoring rules and indices","the templates, report formats, explanatory text, videos and other content","the names, logos and branding"],after:["Except for the limited right of use in section 5, these Terms grant you no right, title or interest in any of this."]},
 {h:"5. Your right to use the Service",p:["Subject to these Terms, NextChapter grants you a limited, non-exclusive, non-transferable, non-sublicensable and revocable right to use the Service during your organization’s period of access. The right covers your organization’s own internal purposes only, such as evaluating the Service and running the programs within your organization."]},
 {h:"6. What you may not do",p:["You may not, and may not help or allow anyone else to:"],ol:["copy, reproduce, download, store or distribute any part of the Service, except reports and documents the Service produces for your organization’s internal use","access, view, copy, extract or analyze the Service’s source code, scripts or stylesheets, by browser developer tools or any other means","reverse engineer, decompile, disassemble or otherwise attempt to derive the Service’s code, structure, methods or logic","use the Service, or any knowledge of its design, structure, methods, frameworks, questionnaires, scoring rules or content, to build, design, train or improve any product, service, course or tool, whether for yourself or anyone else","reproduce the programs’ frameworks, step structures, questionnaires, scoring models or templates outside the Service, in any medium, for any purpose other than your organization’s internal use","use bots, scrapers, crawlers or other automated means to access, collect or harvest any part of the Service","enter any part of the Service’s content, code or design into an AI system or tool for the purpose of training, analyzing or reproducing it","record, screenshot or capture the Service for distribution outside your organization","publish or share benchmarks, reviews, comparisons or descriptions of the Service’s design or performance without our written permission","give access to the Service, or share its non-public features or content, with anyone outside your organization, or with anyone who offers competing products or services","sell, rent, lease, sublicense or otherwise make the Service available to anyone else","remove or change any copyright, trademark or other notice","probe, test or bypass the Service’s security, or interfere with its operation","use the Service in any way that breaks the law or infringes anyone’s rights"]},
 {h:"7. Confidentiality",p:["The Service, its non-public features and content, and any information we share about it are our confidential information. Keep them confidential and use them only as these Terms allow. This duty continues for five years after your access ends, and for as long as any part qualifies as a trade secret under applicable law. It does not cover information that is publicly available through no fault of yours, that you already lawfully had, or that you are required by law to disclose, provided you tell us first where the law allows."]},
 {h:"8. Feedback",p:["If you give us suggestions, comments or ideas about the Service, we may use them freely and without obligation to you. You assign to us any rights you have in that feedback."]},
 {h:"9. Your organization’s data",p:["The information your organization enters into the Service (“Your Data”) remains your organization’s. You give us permission to host, process and display Your Data to provide, secure and support the Service. We may use information about how the Service is used, in a form that does not identify you or your organization, to operate and improve it. You are responsible for having the right to enter Your Data, including any information about other people, and for entering it lawfully. How we handle personal information is described in our Privacy Policy."]},
 {h:"10. Reports and documents",p:["Your organization may use the reports and documents the Service produces from Your Data for its own internal purposes. The formats, templates, structure and explanatory text in them remain ours and are covered by sections 4 to 7."]},
 {h:"11. AI features",p:["If your administrator switches on the AI guide, the text you type into it and the context of the page you are on are sent to our AI provider to generate an answer. AI answers can be wrong or incomplete. Check them before relying on them."]},
 {h:"12. No professional advice",p:["The Service provides frameworks, tools and guidance. It does not provide legal, regulatory, financial, employment or other professional advice. Where the Service refers to laws, regulations or standards, it helps you organize your own work and does not confirm that you comply with them. You are responsible for your decisions and for taking professional advice where you need it."]},
 {h:"13. Third-party content and services",p:["The Service may link to or include material from others, such as articles, books, videos and podcasts. We are not responsible for that material or for any third party’s services."]},
 {h:"14. Pre-release features",p:["Some features may be in development or offered for evaluation. They may change, be withdrawn or contain errors, and are provided for testing and feedback."]},
 {h:"15. Monitoring and enforcement",p:["We may monitor use of the Service to keep it secure and to enforce these Terms. If we believe you or your organization have breached these Terms, we may suspend or end access at once. A breach of sections 4 to 7 could cause us harm that money alone could not put right. We may therefore seek an injunction or other court order to stop it, in addition to any other remedy."]},
 {h:"16. Disclaimer",p:["The Service is provided “as is” and “as available”. To the fullest extent the law allows, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not promise that the Service will be uninterrupted or error-free."]},
 {h:"17. Limitation of liability",p:["To the fullest extent the law allows, NextChapter will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, revenue, data or goodwill. Our total liability for all claims relating to the Service is limited to the greater of the amount your organization paid us for the Service in the twelve months before the claim, and one hundred US dollars. Nothing in these Terms limits liability that cannot be limited by law."]},
 {h:"18. Indemnity",p:["You will defend and indemnify NextChapter against claims, losses and costs arising from your breach of these Terms or from Your Data, to the extent the law allows."]},
 {h:"19. Ending access",p:["You may stop using the Service at any time. We may suspend or end access to the Service, in whole or in part, at any time. Sections 4, 6, 7, 8, 10, and 15 to 21 continue after access ends."]},
 {h:"20. Changes to these Terms",p:["We may update these Terms. When we do, we will change the version number, and you will be asked to accept the new version before you continue using the Service."]},
 {h:"21. General",p:["These Terms are governed by the laws of the State of Connecticut, and the state and federal courts located in Connecticut have exclusive jurisdiction, except that we may seek injunctive relief in any court. If any part of these Terms is unenforceable, the rest remains in effect. Not enforcing a term is not a waiver of it. You may not transfer your rights under these Terms. These Terms, together with the Privacy Policy and any separate written agreement between NextChapter and your organization, are the whole agreement on their subject. If a separate written agreement conflicts with these Terms, the separate agreement prevails.","Questions about these Terms: "+TERMS_CONTACT+"."]}
];
function termsBodyHtml(){ var h='<div class="terms-doc-title">Terms of Use for the NextChapter 90-Day Programs</div><div class="terms-doc-meta">Version '+esc(TERMS_VERSION)+' \u00b7 Effective '+esc(TERMS_EFFECTIVE)+'</div>';
  TERMS_SECTIONS.forEach(function(sec){ h+='<h4 class="terms-h">'+esc(sec.h)+'</h4>'; (sec.p||[]).forEach(function(t){h+='<p>'+esc(t)+'</p>'}); if(sec.ol){h+='<ol>'+sec.ol.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ol>'} (sec.after||[]).forEach(function(t){h+='<p>'+esc(t)+'</p>'}); });
  h+='<p class="terms-privacy">Privacy Policy: <a href="'+_termsAttr(TERMS_PRIVACY_URL)+'" target="_blank" rel="noopener">'+esc(TERMS_PRIVACY_URL.replace(/^https?:\/\//,''))+'</a></p>';
  return h; }
function _termsAttr(x){ return (typeof escAttr==='function')?escAttr(x):esc(x); }
function termsAcceptedBy(u){ return !!(u&&u.terms&&u.terms.v===TERMS_VERSION); }
function termsPending(){ try{ if((typeof SAMPLE_MODE!=='undefined'&&SAMPLE_MODE)||(typeof isAppAdmin!=='undefined'&&isAppAdmin))return false; if(!currentOrgId||!currentUserId)return false; var u=getCurrentUser(); return !!u&&!termsAcceptedBy(u); }catch(e){return false} }
function termsNeedsOrg(){ var u=getCurrentUser(); return !!(u&&u.admin===true&&!(data&&data.termsOrg&&data.termsOrg.v===TERMS_VERSION)); }
function renderTermsScreen(){ var e=UI.termsErr||'', org=getOrg(currentOrgId), oname=(org&&org.name)||'your organization', needOrg=termsNeedsOrg();
  return '<div class="login-screen terms-screen"><div class="login-card terms-card">'
   +'<div class="login-eyebrow">NextChapter \u00b7 90-Day Jump-Start Program</div>'
   +'<h1 class="login-title">Before you start</h1>'
   +'<p class="login-sub terms-sub">These terms govern your use of the NextChapter 90-Day programs. They protect the work you put into the app, and they protect the software, methods and content that make up the programs. Please read them before you continue.</p>'
   +'<div class="terms-box" id="termsBox" tabindex="0" aria-label="Terms of Use">'+termsBodyHtml()+'</div>'
   +'<label class="terms-tick"><input type="checkbox" id="termsAgree" onchange="termsTick()"/> <span>I have read and agree to the Terms of Use and the Privacy Policy.</span></label>'
   +(needOrg?'<label class="terms-tick"><input type="checkbox" id="termsOrg" onchange="termsTick()"/> <span>I am authorized to accept these terms on behalf of '+esc(oname)+'.</span></label>':'')
   +(e?'<div class="entry-err">'+esc(e)+'</div>':'')
   +'<div class="terms-actions"><button class="btn-gold" id="termsContinue" onclick="acceptTerms()" disabled>Continue</button><button class="btn-ghost" onclick="declineTerms()">Decline and sign out</button></div>'
   +'</div></div>'; }
function termsTick(){ var a=$('termsAgree'),o=$('termsOrg'),b=$('termsContinue'); if(b)b.disabled=!((a&&a.checked)&&(!o||o.checked)); }
function acceptTerms(){ var u=getCurrentUser(); if(!u)return; var a=$('termsAgree'),o=$('termsOrg'), needOrg=termsNeedsOrg();
  if(!(a&&a.checked)||(needOrg&&!(o&&o.checked))){UI.termsErr='Tick the box to accept the terms, or decline and sign out.';render();return}
  var at=new Date().toISOString();
  u.terms={v:TERMS_VERSION,at:at};
  if(!Array.isArray(data.termsLog))data.termsLog=[];
  data.termsLog.push({userId:u.id,name:u.name||'',v:TERMS_VERSION,at:at,forOrg:!!needOrg});
  if(needOrg)data.termsOrg={v:TERMS_VERSION,userId:u.id,name:u.name||'',at:at};
  persistRoster(); UI.termsErr=''; var then=UI.termsThen; UI.termsThen=null; render(); if(then==='orgSetup'&&typeof openOrgSetup==='function')openOrgSetup(); }
function declineTerms(){ UI.termsErr=''; UI.termsThen=null; if(typeof signOutNow==='function'){signOutNow();return} try{Collab.leave()}catch(e){} try{Auth.clearSession()}catch(e){} UI.entry={step:'login',err:''}; render(); }
function openTermsView(){ currentModal='terms'; renderTermsModal(); }
function renderTermsModal(){ var mr=$('modalRoot'); if(!mr||currentModal!=='terms')return; var u=getCurrentUser(), org=getOrg(currentOrgId), to=data&&data.termsOrg;
  var mine=(u&&u.terms&&u.terms.at)?'You accepted version '+u.terms.v+' on '+fmtTermsDate(u.terms.at)+'.':'';
  var forOrg=(to&&to.at)?'Accepted for '+((org&&org.name)||'the organization')+' by '+(to.name||'an administrator')+' on '+fmtTermsDate(to.at)+'.':'';
  mr.innerHTML='<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal terms-modal">'
   +'<h3 class="h-sub-lg" style="margin:0 0 6px">Terms of Use</h3>'
   +((mine||forOrg)?'<div class="terms-modal-meta">'+esc([mine,forOrg].filter(Boolean).join(' '))+'</div>':'')
   +'<div class="terms-box">'+termsBodyHtml()+'</div>'
   +'<div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn-gold" onclick="closeModal()">Done</button></div>'
   +'</div></div>'; }
function fmtTermsDate(iso){ try{ var d=new Date(iso); return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); }catch(e){return String(iso||'')} }
```

## Part B. The styles (identical in every module)

Append to the end of the module's stylesheet.

```css
/* Terms of Use acceptance (Paul, 18 Nov 2026) */
.terms-screen{padding-top:calc(40px + 24px)}
.terms-card{max-width:760px;padding:36px 44px}
.terms-sub{max-width:none;margin-bottom:20px}
.terms-box{max-height:38vh;overflow-y:auto;padding:20px 22px;margin-bottom:20px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--rule-rgb),.24);font-size:14px;line-height:1.65;color:var(--paper)}
.terms-box p{margin:0 0 10px}
.terms-box ol{margin:0 0 10px;padding-left:22px}
.terms-box li{margin:0 0 4px}
.terms-box a{color:var(--gold-text)}
.terms-doc-title{font-family:var(--serif);font-size:22px;color:var(--paper);margin-bottom:4px}
.terms-doc-meta{font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--stone);margin-bottom:16px}
.terms-h{font-size:14px;font-weight:600;color:var(--paper);margin:16px 0 6px}
.terms-tick{display:flex;align-items:flex-start;gap:10px;font-size:15px;line-height:1.5;color:var(--paper);margin-bottom:12px;cursor:pointer}
.terms-tick input{margin-top:4px;flex:0 0 auto;width:16px;height:16px}
.terms-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
.terms-actions .btn-gold[disabled]{opacity:.45;cursor:not-allowed}
.terms-privacy{margin-top:14px;color:var(--stone)}
.terms-modal{max-width:760px}
.terms-modal-meta{font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:14px}
```

---

## Module: Architecture

**Copy the anchors were counted in:** the copy of 19 October 2026: `Architecture-app.js` md5 `e40beb61` (13,325 lines), `Architecture-styles.css` md5 `c15b535b`. **After the change:** `Architecture-app.js` md5 `ecba02eb` (13,400 lines), `Architecture-styles.css` md5 `b6ffa237`. `node --check` passes, and the terms probe (Part C) gives 19 passes and 0 failures.

### Architecture: Hook 1. The terms block, and the entry screen shows the terms first

In `renderEntry`. Insert the whole terms block (Part A) immediately before `renderEntry`, and make `renderEntry` show the terms screen when no other entry step is pending. The replacement below shows the block as `[PART A: THE TERMS BLOCK]` for readability. Paste Part A there in full.

Find (occurs exactly once):

```js
function renderEntry(){
  if(!UI.entry)UI.entry={step:'login'};
```

Replace it with:

```js
[PART A: THE TERMS BLOCK]
function renderEntry(){
  if(!UI.entry&&termsPending())return renderTermsScreen(); /* Terms of Use (Paul, 18 Nov 2026): after any other entry step, before the workspace */
  if(!UI.entry)UI.entry={step:'login'};
```

### Architecture: Hook 2. `render()` treats pending terms like signed-out

In `render`. `render()` opens the entry screen while the terms are pending, which also hides the top bar, the sidebar and the Guide.

Find (occurs exactly once):

```js
if(UI.entry||!currentOrgId||!currentUserId||!getCurrentUser()){
```

Replace it with:

```js
if(UI.entry||!currentOrgId||!currentUserId||!getCurrentUser()||termsPending()){
```

### Architecture: Hook 3. The entry screen's focus skips the tick boxes

In `render`. On the terms screen, focusing the first tick box would scroll the page to it. Focus only text inputs.

Find (occurs exactly once):

```js
var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus();
```

Replace it with:

```js
var ef=document.querySelector('.login-screen input:not([type=checkbox])'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus(); /* the terms screen's tick boxes are never focused on arrival, so the terms open at the top */
```

### Architecture: Hook 4. The setup panel waits for the terms

In `openOrgSetup`. A new organization's setup panel opens after the terms are accepted, never over them.

Find (occurs exactly once):

```js
function openOrgSetup(){orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

Replace it with:

```js
function openOrgSetup(){if(termsPending()){UI.termsThen='orgSetup';return} /* the setup panel opens once the terms are accepted */orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

### Architecture: Hook 5. Terms of Use in the account menu

In `_userMenuHtml`. Lets anyone read the terms again, with who accepted and when.

Find (occurs exactly once):

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
        '<div class="nav-more-sep"></div>'+
```

Replace it with:

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeUserMenu();openTermsView()"><span class="nav-more-ic">\u00a7</span> Terms of Use</button>'+
        '<div class="nav-more-sep"></div>'+
```

**Styles:** append Part B to `Architecture-styles.css`.

---

## Module: Innovation Pipeline

**Copy the anchors were counted in:** the copy of 15 October 2026: `app.js` md5 `5f03fefb` (7,521 lines), `styles.css` md5 `6723ab64`. **After the change:** `app.js` md5 `4f9c458c` (7,595 lines), `styles.css` md5 `ea9fc665`. `node --check` passes, and the terms probe (Part C) gives 18 passes and 0 failures.

### Innovation Pipeline: Hook 1. The terms block, and the entry screen shows the terms first

In `renderEntry`. Insert the whole terms block (Part A) immediately before `renderEntry`, and make `renderEntry` show the terms screen when no other entry step is pending. The replacement below shows the block as `[PART A: THE TERMS BLOCK]` for readability. Paste Part A there in full.

Find (occurs exactly once):

```js
function renderEntry(){
  if(!UI.entry) UI.entry={step:'login'};
```

Replace it with:

```js
[PART A: THE TERMS BLOCK]
function renderEntry(){
  if(!UI.entry&&termsPending())return renderTermsScreen(); /* Terms of Use (Paul, 18 Nov 2026): after any other entry step, before the workspace */
  if(!UI.entry) UI.entry={step:'login'};
```

### Innovation Pipeline: Hook 2. `render()` treats pending terms like signed-out

In `render`. `render()` opens the entry screen while the terms are pending, which also hides the top bar, the sidebar and the Guide.

Find (occurs exactly once):

```js
if(!currentOrgId || !currentUserId || !getCurrentUser()){
```

Replace it with:

```js
if(!currentOrgId || !currentUserId || !getCurrentUser() || termsPending()){
```

### Innovation Pipeline: Hook 3. The entry screen's focus skips the tick boxes

In `render`. On the terms screen, focusing the first tick box would scroll the page to it. Focus only text inputs.

Find (occurs exactly once):

```js
var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !UI.entry.err) ef.focus();
```

Replace it with:

```js
var ef=document.querySelector('.login-screen input:not([type=checkbox])'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus(); /* the terms screen's tick boxes are never focused on arrival, so the terms open at the top */ /* and UI.entry may be empty while the terms screen shows */
```

### Innovation Pipeline: Hook 4. The setup panel waits for the terms

In `openOrgSetup`. A new organization's setup panel opens after the terms are accepted, never over them.

Find (occurs exactly once):

```js
function openOrgSetup(){orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

Replace it with:

```js
function openOrgSetup(){if(termsPending()){UI.termsThen='orgSetup';return} /* the setup panel opens once the terms are accepted */orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

**Hook 5 (account menu):** this copy has no account menu (`_userMenuHtml`). If your build has one, add the Terms of Use item as shown under Culture's Hook 5, matching your indentation. Otherwise add a **Terms of Use** link that calls `openTermsView()` wherever the account's options live, and report where.

**Note on Hook 3:** in this copy the focus line reads `!UI.entry.err`, which throws once the terms screen shows with no entry step pending. The replacement also guards it, as the other modules already do.

**Styles:** append Part B to `styles.css`.

---

## Module: Governance

**Copy the anchors were counted in:** the copy of 15 October 2026: `Governance-app.js` md5 `a41e381c` (8,767 lines), `Governance-styles.css` md5 `fffdda59`. **After the change:** `Governance-app.js` md5 `e6f1677d` (8,842 lines), `Governance-styles.css` md5 `1dafdf18`. `node --check` passes, and the terms probe (Part C) gives 17 passes and 0 failures.

### Governance: Hook 1. The terms block, and the entry screen shows the terms first

In `renderEntry`. Insert the whole terms block (Part A) immediately before `renderEntry`, and make `renderEntry` show the terms screen when no other entry step is pending. The replacement below shows the block as `[PART A: THE TERMS BLOCK]` for readability. Paste Part A there in full.

Find (occurs exactly once):

```js
function renderEntry(){
  if(!UI.entry) UI.entry={step:'login'};
```

Replace it with:

```js
[PART A: THE TERMS BLOCK]
function renderEntry(){
  if(!UI.entry&&termsPending())return renderTermsScreen(); /* Terms of Use (Paul, 18 Nov 2026): after any other entry step, before the workspace */
  if(!UI.entry) UI.entry={step:'login'};
```

### Governance: Hook 2. `render()` treats pending terms like signed-out

In `render`. `render()` opens the entry screen while the terms are pending, which also hides the top bar, the sidebar and the Guide.

Find (occurs exactly once):

```js
if(!currentOrgId || !currentUserId || !getCurrentUser()){
```

Replace it with:

```js
if(!currentOrgId || !currentUserId || !getCurrentUser() || termsPending()){
```

### Governance: Hook 3. The entry screen's focus skips the tick boxes

In `render`. On the terms screen, focusing the first tick box would scroll the page to it. Focus only text inputs.

Find (occurs exactly once):

```js
var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus();
```

Replace it with:

```js
var ef=document.querySelector('.login-screen input:not([type=checkbox])'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus(); /* the terms screen's tick boxes are never focused on arrival, so the terms open at the top */
```

### Governance: Hook 5. Terms of Use in the account menu

In `_userMenuHtml`. Lets anyone read the terms again, with who accepted and when.

Find (occurs exactly once):

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
      '<div class="nav-more-sep"></div>'+
```

Replace it with:

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeUserMenu();openTermsView()"><span class="nav-more-ic">\u00a7</span> Terms of Use</button>'+
      '<div class="nav-more-sep"></div>'+
```

**Hook 4 (setup panel):** this copy has no `openOrgSetup`. If your build has one, make the change shown under Culture's Hook 4. Part A already opens it after acceptance when it exists.

**Styles:** append Part B to `Governance-styles.css`.

---

## Module: Executive Readiness

**Copy the anchors were counted in:** the copy of 15 October 2026: `Exec-Readiness-app.js` md5 `99f541bd` (7,730 lines), `Exec-Readiness-styles.css` md5 `32077d14`. **After the change:** `Exec-Readiness-app.js` md5 `f2f5f6c6` (7,804 lines), `Exec-Readiness-styles.css` md5 `353412ea`. `node --check` passes, and the terms probe (Part C) gives 18 passes and 0 failures.

### Executive Readiness: Hook 1. The terms block, and the entry screen shows the terms first

In `renderEntry`. Insert the whole terms block (Part A) immediately before `renderEntry`, and make `renderEntry` show the terms screen when no other entry step is pending. The replacement below shows the block as `[PART A: THE TERMS BLOCK]` for readability. Paste Part A there in full.

Find (occurs exactly once):

```js
function renderEntry(){
  if(!UI.entry) UI.entry={step:'login'};
```

Replace it with:

```js
[PART A: THE TERMS BLOCK]
function renderEntry(){
  if(!UI.entry&&termsPending())return renderTermsScreen(); /* Terms of Use (Paul, 18 Nov 2026): after any other entry step, before the workspace */
  if(!UI.entry) UI.entry={step:'login'};
```

### Executive Readiness: Hook 2. `render()` treats pending terms like signed-out

In `render`. `render()` opens the entry screen while the terms are pending, which also hides the top bar, the sidebar and the Guide.

Find (occurs exactly once):

```js
if(!currentOrgId || !currentUserId || !getCurrentUser()){
```

Replace it with:

```js
if(!currentOrgId || !currentUserId || !getCurrentUser() || termsPending()){
```

### Executive Readiness: Hook 3. The entry screen's focus skips the tick boxes

In `render`. On the terms screen, focusing the first tick box would scroll the page to it. Focus only text inputs.

Find (occurs exactly once):

```js
var _ef=document.querySelector('.login-screen input'); if(_ef && document.activeElement!==_ef && !(UI.entry&&UI.entry.err)) _ef.focus();
```

Replace it with:

```js
var _ef=document.querySelector('.login-screen input:not([type=checkbox])'); if(_ef && document.activeElement!==_ef && !(UI.entry&&UI.entry.err)) _ef.focus(); /* the terms screen's tick boxes are never focused on arrival, so the terms open at the top */
```

### Executive Readiness: Hook 4. The setup panel waits for the terms

In `openOrgSetup`. A new organization's setup panel opens after the terms are accepted, never over them.

Find (occurs exactly once):

```js
function openOrgSetup(){orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

Replace it with:

```js
function openOrgSetup(){if(termsPending()){UI.termsThen='orgSetup';return} /* the setup panel opens once the terms are accepted */orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

**Hook 5 (account menu):** this copy has no account menu (`_userMenuHtml`). If your build has one, add the Terms of Use item as shown under Culture's Hook 5, matching your indentation. Otherwise add a **Terms of Use** link that calls `openTermsView()` wherever the account's options live, and report where.

**Styles:** append Part B to `Exec-Readiness-styles.css`.

---

## Module: Culture

**Copy the anchors were counted in:** the copy of 10 November 2026: `Culture-app.js` md5 `1fb46f51` (11,882 lines), `Culture-styles.css` md5 `f5d24097`. **After the change:** `Culture-app.js` md5 `98019c0c` (11,957 lines), `Culture-styles.css` md5 `c13aee7c`. `node --check` passes, and the terms probe (Part C) gives 20 passes and 0 failures.

### Culture: Hook 1. The terms block, and the entry screen shows the terms first

In `renderEntry`. Insert the whole terms block (Part A) immediately before `renderEntry`, and make `renderEntry` show the terms screen when no other entry step is pending. The replacement below shows the block as `[PART A: THE TERMS BLOCK]` for readability. Paste Part A there in full.

Find (occurs exactly once):

```js
function renderEntry(){
  if(!UI.entry)UI.entry={step:'login'};
```

Replace it with:

```js
[PART A: THE TERMS BLOCK]
function renderEntry(){
  if(!UI.entry&&termsPending())return renderTermsScreen(); /* Terms of Use (Paul, 18 Nov 2026): after any other entry step, before the workspace */
  if(!UI.entry)UI.entry={step:'login'};
```

### Culture: Hook 2. `render()` treats pending terms like signed-out

In `render`. `render()` opens the entry screen while the terms are pending, which also hides the top bar, the sidebar and the Guide.

Find (occurs exactly once):

```js
if(UI.entry||!currentOrgId||!currentUserId||!getCurrentUser()){
```

Replace it with:

```js
if(UI.entry||!currentOrgId||!currentUserId||!getCurrentUser()||termsPending()){
```

### Culture: Hook 3. The entry screen's focus skips the tick boxes

In `render`. On the terms screen, focusing the first tick box would scroll the page to it. Focus only text inputs.

Find (occurs exactly once):

```js
var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus();
```

Replace it with:

```js
var ef=document.querySelector('.login-screen input:not([type=checkbox])'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus(); /* the terms screen's tick boxes are never focused on arrival, so the terms open at the top */
```

### Culture: Hook 4. The setup panel waits for the terms

In `openOrgSetup`. A new organization's setup panel opens after the terms are accepted, never over them.

Find (occurs exactly once):

```js
function openOrgSetup(){orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

Replace it with:

```js
function openOrgSetup(){if(termsPending()){UI.termsThen='orgSetup';return} /* the setup panel opens once the terms are accepted */orgSetupMode=true;currentModal='org';UI.orgEdit=null;renderOrgModal();}
```

### Culture: Hook 5. Terms of Use in the account menu

In `_userMenuHtml`. Lets anyone read the terms again, with who accepted and when.

Find (occurs exactly once):

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
      '<div class="nav-more-sep"></div>'+
```

Replace it with:

```js
<span class="nav-more-ic">\u2630</span> View Assignments</button>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeUserMenu();openTermsView()"><span class="nav-more-ic">\u00a7</span> Terms of Use</button>'+
      '<div class="nav-more-sep"></div>'+
```

**Styles:** append Part B to `Culture-styles.css`.

---

## Part C. Tests

**1. A switch for your existing suites.** Every suite that signs a simulated person in and then expects the workspace will now meet the terms screen. In each such test file, immediately after the app's scripts are loaded and before any test runs, add:

```js
termsPending=function(){return false}; /* Terms of Use (18 Nov 2026): simulated sign-ins skip the terms screen, which has its own checks */
```

Keep the real function (for example as `window.__termsPendingReal`) and restore it in the terms checks. In Workforce's suites, two checks also needed adjusting: a word check that bans "harvest" from the code leaves out `TERMS_SECTIONS` (the terms forbid harvesting), and the byte-form comparison of `_userMenuHtml` with Governance leaves out the new menu item until every module has it.

**2. The terms probe.** Run it in each module's folder (it needs jsdom): `node terms-probe-generic.js <the module's index.html>`. It loads the page's own scripts, creates an organization, and checks every requirement above that the module's code supports. It must report 0 failures.

```js
// Terms of Use gate: a module-agnostic behavior check. Run from a module's folder: node terms-probe-generic.js <index.html>
const fs=require('fs'),{JSDOM}=require('jsdom');const mem={};
const idx=process.argv[2]||'index.html';
const LS={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]},get length(){return Object.keys(mem).length},key:i=>Object.keys(mem)[i]};
const html=fs.readFileSync(idx,'utf8');const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>fs.existsSync(f));
const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'});const w=dom.window;
Object.defineProperty(w,'localStorage',{value:LS});w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.requestAnimationFrame=f=>setTimeout(f,0);w.open=()=>null;
w.fetch=p=>Promise.resolve({ok:true,text:()=>Promise.resolve(fs.readFileSync(String(p).replace(/^\.\//,''),'utf8'))});
const pre=html.match(/__SCREEN_FILE_PREFIX="([^"]*)"/);if(pre)w.eval(`window.__SCREEN_FILE_PREFIX=${JSON.stringify(pre[1])}`);
for(const f of scripts)w.eval(fs.readFileSync(f,'utf8'));
const wait=(ms=50)=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ok  '+m)}else{fail++;console.log('  XX  '+m)}};
const app=()=>w.document.getElementById('app').innerHTML;
(async()=>{await wait();
 const r=w.eval(`createOrg('Probe Org',{name:'Ann Admin',username:'annp',passcode:'Ann#2026xx',role:'Administrator'})`);
 w.eval(`switchToOrg('${r.orgId}');Auth.setSession('${r.userId}');UI.entry=null;render()`);await wait(80);
 ok(/Before you start/.test(app()),'the terms screen shows for a signed-in person who has not accepted');
 const nav=w.document.querySelector('nav');ok(!nav||nav.style.display==='none','the top bar is hidden on the terms screen');
 ok(!!w.document.getElementById('termsOrg')&&/on behalf of Probe Org/.test(app()),'the organization tick shows for an administrator, naming the organization');
 ok(w.document.getElementById('termsContinue').disabled===true,'Continue starts disabled');
 w.eval(`document.getElementById('termsAgree').checked=true;termsTick()`);ok(w.document.getElementById('termsContinue').disabled===true,'one of two ticks leaves Continue disabled');
 w.eval(`document.getElementById('termsOrg').checked=true;termsTick()`);ok(w.document.getElementById('termsContinue').disabled===false,'both ticks enable Continue');
 w.eval('acceptTerms()');await wait(80);
 ok(!/Before you start/.test(app()),'accepting opens the workspace');
 const st=()=>{const k=Object.keys(mem).find(k=>/-org-data::/.test(k)&&k.indexOf(r.orgId)>=0);return k?JSON.parse(mem[k]):{}};
 let d=st();const ann=(d.roster||[]).find(u=>u.id===r.userId);
 ok(ann&&ann.terms&&ann.terms.v==='1.0','the person\u2019s acceptance is saved with the version');
 ok(d.termsOrg&&d.termsOrg.v==='1.0'&&d.termsLog&&d.termsLog.length===1,'the organization\u2019s acceptance is saved and logged');
 w.eval(`USERS.push({id:'u_mia',name:'Mia Member',username:'miap',passcode:'Mia#2026xx',role:'Analyst'});persistRoster();Auth.setSession('u_mia');UI.entry=null;render()`);await wait(80);
 ok(/Before you start/.test(app())&&!w.document.getElementById('termsOrg'),'a member sees the terms with no organization tick');
 w.eval('declineTerms()');await wait(80);
 ok(!w.eval('currentUserId')&&!/Before you start/.test(app()),'Decline and sign out ends the session');
 d=st();ok(!((d.roster||[]).find(u=>u.id==='u_mia')||{}).terms,'declining records nothing');
 w.eval(`switchToOrg('${r.orgId}');Auth.setSession('u_mia');UI.entry=null;render()`);await wait(80);
 w.eval(`document.getElementById('termsAgree').checked=true;termsTick();acceptTerms()`);await wait(80);
 d=st();ok(((d.roster||[]).find(u=>u.id==='u_mia')||{}).terms&&d.termsLog.length===2&&d.termsLog[1].forOrg===false,'the member\u2019s acceptance is saved and logged');
 w.eval('openTermsView()');await wait();const mr=(w.document.getElementById('modalRoot')||{}).innerHTML||'';
 ok(/You accepted version 1\.0/.test(mr)&&/Accepted for Probe Org by Ann Admin/.test(mr),'Terms of Use opens read-only with both acceptances');w.eval('closeModal()');
 const hasMenu=w.eval(`typeof _userMenuHtml==='function'`);if(hasMenu)ok(/openTermsView\(\)/.test(w.eval('_userMenuHtml()')),'the account menu lists Terms of Use');
 w.eval(`TERMS_VERSION='1.1';render()`);await wait(60);ok(/Before you start/.test(app()),'a new version asks again');
 if(w.eval(`typeof SAMPLE_MODE!=='undefined'`)){w.eval('SAMPLE_MODE=true');ok(w.eval('termsPending()')===false,'the sample is exempt');w.eval('SAMPLE_MODE=false')}
 w.eval('isAppAdmin=true');ok(w.eval('termsPending()')===false,'the app administrator\u2019s view is exempt');w.eval('isAppAdmin=false');
 if(w.eval(`typeof openOrgSetup==='function'`)){w.eval(`Auth.setSession('${r.userId}');UI.entry=null;render();openOrgSetup()`);await wait(60);
  ok(w.eval('currentModal')!=='org','the setup panel waits while the terms are pending');
  w.eval(`document.getElementById('termsAgree').checked=true;var _o=document.getElementById('termsOrg');if(_o)_o.checked=true;termsTick();acceptTerms()`);await wait(80);
  ok(w.eval('currentModal')==='org','the setup panel opens once the terms are accepted');}
 console.log(`\nTerms probe (${idx}): ${pass} pass, ${fail} fail`);process.exit(fail?1:0);
})().catch(e=>{console.log('PROBE ERROR',e&&e.stack||e);process.exit(2)});
```

---

## How to check it by hand (each module)

1. Set up a new organization. The terms screen shows with both tick boxes. Continue stays disabled until both are ticked. After Continue, the workspace opens, then the setup panel.
2. As that administrator, add a member with a password. Sign in as the member in another browser: the terms screen shows with one tick box. Decline and sign out returns to sign-in. Sign in again and accept.
3. Open the account menu, then Terms of Use. It shows the member's acceptance and the organization's.
4. Reload with Remember me on. The workspace opens without the terms (already accepted).
5. Raise `TERMS_VERSION` in the code and reload. Both people are asked again, and the administrator again sees the organization box.
6. Open Demo from a signed-in tab. The sample shows no terms screen.

## Acceptance

- Every requirement 1 to 9 above holds in the module, checked by hand and by the probe.
- The terms text on screen matches Part A word for word.
- The module's existing suites pass as before, with the switch added.
- On the live service, the three records persist with the organization's data.

## Per-module checklist

| Module | Part A inserted | Part B styles | Hooks applied | Records persist on the server | Suites pass with the switch | Probe 0 failures | Hand check |
|---|---|---|---|---|---|---|---|
| Architecture | ☐ | ☐ | ☐ 1–5 | ☐ | ☐ | ☐ | ☐ |
| Innovation Pipeline | ☐ | ☐ | ☐ 1–4, 5 if the menu exists | ☐ | ☐ | ☐ | ☐ |
| Governance | ☐ | ☐ | ☐ 1–3 and 5, 4 if `openOrgSetup` exists | ☐ | ☐ | ☐ | ☐ |
| Executive Readiness | ☐ | ☐ | ☐ 1–4, 5 if the menu exists | ☐ | ☐ | ☐ | ☐ |
| Culture | ☐ | ☐ | ☐ 1–5 | ☐ | ☐ | ☐ | ☐ |

## Close-out

For each module, report:
- the hooks applied, and any whose quoted text differed in your build, with what you changed instead
- where the account's Terms of Use link sits, if the module has no account menu
- how the three records are stored on the server, and whether the server enforces acceptance
- the suite results with the switch, and the probe result

Anything changed beyond this directive is listed as such.
