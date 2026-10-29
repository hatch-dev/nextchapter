# All four modules: the apps stop writing their own instructions into AI requests, and Team Chat stops using AI (28 October 2026)

**For:** the developers of the four modules: 90 Days to an AI-Ready Architecture, the 90-Day AI Innovation Pipeline, 90-Day Responsible AI Governance, and Executive Readiness.  
**Applies to:** each module's live build, on top of every earlier directive and addendum.  
**Source:** the copies Paul holds: `Architecture-app_1.js` (md5 `e40beb611381807d182ca623e255c3d2`), `app.js` for the Innovation Pipeline (md5 `5f03fefbca1e003e06e63bfcb4dcf461`), `Governance-app.js` (md5 `a41e381cad994907e83db81e3fddc358`), `Governance-smoke.js` (md5 `a214fa53cbd00389593a7dba85abe9bc`), and `Exec-Readiness-app.js` (md5 `99f541bd0e4936977cb52e7c4b873ac4`). The Architecture copy is current. The other three date from 15 October 2026.

**Checked:** every change below was applied to copies that already carried the video-name directives of 26 October (and, for Architecture, `Directive_DEV_Architecture_KBFixes_Combined_19Oct2026.md`). Every quoted text is also found exactly once in the copies without those directives, so the order does not matter.
- `Architecture-app.js`: md5 `52219777afc6825705e5cd35a4655b53` before, `d4fc2f753acc282277a943671cff04d2` after, 13,327 lines both times.
- Innovation `app.js`: md5 `69b26fe6adecfc7095d99651b2be442b` before (7,521 lines), `c51ccdc6cbac8e1aee7d1b251546afcb` after (7,486 lines).
- `Governance-app.js`: md5 `9b53fac71e42399d12aeef7fd9190523` before (8,767 lines), `60a4c2d2ed30404b29b9e06f68c43295` after (8,601 lines).
- `Governance-smoke.js`: md5 `bb7978a532853191f889189f5030d222` before, `b2f5ed7a2e364e4c2d60695957a2323d` after, 2,224 lines both times.
- `Exec-Readiness-app.js`: md5 `0debf440f77f25e16b90f26132c85070` before (7,730 lines), `ed90c8076abf333ccda36ed8f8e37ff2` after (7,710 lines).
- Every changed file passes `node --check`.
- Test suites, after the changes:
  - Architecture: the harness (686 assertions) and smoke test (99) give the same results as before, with the same two failures that predate this directive: the harness's FONTS check (the copy tested had no `fonts` folder) and the smoke test's out-of-date "CAROUSEL 4 slides each". The harness check that the Guide sends a request only while its switch is on still passes.
  - Innovation Pipeline: `harness.js` passes in full, 1,829 assertions, 0 failures.
  - Governance: `Governance-smoke.js` passes in full, 971 assertions, 0 failures, once its addendum 205 is retargeted (item 3.4).
  - Executive Readiness: `Exec-Readiness-harness.js` (335 assertions) and `Exec-Readiness-boot-smoke.js` (287) pass in full, 0 failures.

**Your live code differs from these copies.** The AI Guide has been wired up in the live apps, and the Executive Readiness copy's Guide is still a placeholder that never calls the AI. The exact changes below are quoted from the copies. Wherever your live code differs, delete the same things described under "What is deleted", wherever they are. If a quoted text is not found exactly once in your copy, stop and report it rather than forcing the change in.

Code blocks show the source exactly as it is in the file, including its backslash escapes. Copy them exactly.

---

## What is deleted

Paul ruled on 28 October 2026. The AI Guide's guiding system prompt now lives in the backend, and the backend sets the model. The apps still carry instructions written in the days when the Guide was a placeholder, and they send them with every message. These are deleted, in all four modules:

1. **From every AI Guide request:**
   - Every piece of text the app writes into the request to tell the AI who it is, what the program is, or how to answer. In the copies this is the paragraph that begins "You are the AI Guide…", including its rules on length and format ("Maximum 150 words per response. No bullets unless absolutely essential." and "Answer in 2-4 short sentences. Tone: smart, direct, practical. Plain text only — no markdown.").
   - The model name (`model:…`).
   - The reply-length cap (`max_tokens:…`).
2. **Every connection between Team Chat and the AI.** Team Chat makes no request to the AI service, posts no AI-written reply, and shows no "is typing" indicator for one.
3. **Governance's "fetch latest insights" code:** both definitions of `fetchLiveInsights`, and the two helpers that only it uses, `setInsightStatus` and `_refreshInsightGrid`. Nothing in the app calls this code, but it sends its own prompts to the AI service.

---

## 1. Architecture: `Architecture-app.js`

The Guide's paragraph sits in `sendCoach`, in the variable `sys`, which is placed at the front of the latest message. Team Chat in this copy makes no request to the AI.

### 1.1 In `sendCoach`, the paragraph

Find (occurs exactly once):

```js
var sys='You are the AI Guide inside the 90 Days to an AI-Ready Architecture program (NextChapter 90-Day Jump-Start Program by Faisal Hoque). The 90-day program has five phases: Map (assess data estate, integrations, identity, compute, risk), Build (data governance, API modernization, zero-trust identity, model governance), Test (end-to-end deployment, security stress tests, cascade scenarios, alignment review), Embed (architecture review board, skills inventory, first review), Manage (ongoing dashboard discipline). It also teaches the five-layer AI tech stack: 1 Data & Storage, 2 Compute & Acceleration, 3 Model & Algorithm, 4 Orchestration & Tooling, 5 Application & Governance. '+coachContext()+' Answer in 2-4 short sentences. Tone: smart, direct, practical. Plain text only \u2014 no markdown.';
```

Replace it with:

```js
var sys=coachContext();
```

### 1.2 In `sendCoach`, the model name and reply-length cap

Find (occurs exactly once):

```js
body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,messages:history})
```

Replace it with:

```js
body:JSON.stringify({messages:history})
```

---

## 2. Innovation Pipeline: `app.js`

The Guide's paragraph is the variable `sysPrompt` in `sendCoach`. Team Chat's `sendGChat` sends each message to the AI and posts the reply under a randomly chosen teammate's name.

### 2.1 In `sendCoach`, the paragraph

Find (occurs exactly once) and delete it:

```js
var sysPrompt='You are the AI Guide for Faisal Hoque\'s 90-Day AI Innovation Pipeline — a framework grounded in the OPEN and CARE frameworks and published in Fast Company, HBR, and MIT Sloan Management Review. You help leaders build structured AI innovation pipelines through five phases: Diagnose, Organize, Prepare, Ignite, Navigate. Be direct, insightful, and strategic. Maximum 150 words per response. No bullets unless absolutely essential.';
```

### 2.2 In `sendCoach`, the model name, the reply-length cap, and the paragraph's place in the message

Find (occurs exactly once):

```js
body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:300,
messages:[{role:'user',content:sysPrompt+'\n\n'+ctx+'\n\nUser question: '+userText}]})
```

Replace it with:

```js
body:JSON.stringify({
messages:[{role:'user',content:ctx+'\n\nUser question: '+userText}]})
```

### 2.3 In `sendGChat` (Team Chat), everything that sends the message to the AI and posts a reply

The block runs from the "is typing" indicator to the end of the AI request, including the replies posted when the request succeeds or fails.

Find (occurs exactly once):

```js
  renderGChatPanel();
  var typing=document.getElementById('gchatTyping');
  var _pool=data.roster||[];
  if(!_pool.length)return;
  var r=_pool[Math.floor(Math.random()*_pool.length)];
  r={who:r.initials,name:r.name,role:r.role};
  if(typing)typing.textContent=r.name+' is typing...';
    var sysPrompt="You are "+r.name+", "+(r.role||'a colleague')+" at this organization. The team is running the 90-Day AI Innovation Pipeline — phases Diagnose, Organize, Prepare, Ignite, Navigate — and is deep into Phase 4: the first development cohort is funded and running, with governance setup and the portfolio review coming up. Respond in 1-2 short sentences. Tone: smart, direct, collegial. No markdown.";
  fetch(CLAUDE_API_URL,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:120,
      messages:[{role:'user',content:sysPrompt+'\n\nA colleague just wrote: "'+text+'"'}]
    })
  }).then(function(res){return res.json()}).then(function(j){
    var reply='';
    if(j.content)for(var i=0;i<j.content.length;i++)if(j.content[i].text)reply+=j.content[i].text;
    if(!reply)reply='Good point — let\'s discuss further.';
    var now2=new Date();
    var ts2=(now2.getHours()%12||12)+':'+(now2.getMinutes()<10?'0':'')+now2.getMinutes()+' '+(now2.getHours()>=12?'PM':'AM');
    chatArr().push({who:r.who,name:r.name,ts:ts2,text:reply});
    Store.commit('chatMsgs');
    if(!gchatOpen){
      gchatUnreadCount++;
      var u=document.getElementById('gchatUnread');
      if(u){u.style.display='';u.textContent=gchatUnreadCount;}
    }
    if(gchatOpen)renderGChatPanel();
    else{var typing2=document.getElementById('gchatTyping');if(typing2)typing2.textContent='';}
  }).catch(function(){
    var now3=new Date();
    var ts3=(now3.getHours()%12||12)+':'+(now3.getMinutes()<10?'0':'')+now3.getMinutes()+' '+(now3.getHours()>=12?'PM':'AM');
    chatArr().push({who:r.who,name:r.name,ts:ts3,text:'Got it — will follow up shortly.'});
    Store.commit('chatMsgs');
    if(gchatOpen)renderGChatPanel();
  });
}

// === NOTES ===
```

Replace it with:

```js
  renderGChatPanel();
}

// === NOTES ===
```

---

## 3. Governance: `Governance-app.js` and `Governance-smoke.js`

The Guide's paragraph is the variable `sysPrompt` in `sendCoach`. Team Chat in this copy makes no request to the AI.

### 3.1 In `sendCoach`, the paragraph

Find (occurs exactly once) and delete it:

```js
var sysPrompt='You are the AI Guide for Faisal Hoque\'s 90-Day Responsible AI Governance Program \u2014 grounded in the CARE framework (Catastrophize, Assess, Regulate, Exit) and published in Fast Company, HBR, and MIT Sloan Management Review. You help leaders build working AI governance through five phases: Map, Build, Assess, Embed, Govern \u2014 an execution path aligned to the NIST AI Risk Management Framework (GOVERN, MAP, MEASURE, MANAGE). Be direct, insightful, and strategic. Maximum 150 words per response. No bullets unless absolutely essential.';
```

### 3.2 In `sendCoach`, the model name, the reply-length cap, and the paragraph's place in the message

Find (occurs exactly once):

```js
body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:300,
messages:[{role:'user',content:sysPrompt+'\n\n'+ctx+'\n\nUser question: '+userText}]})
```

Replace it with:

```js
body:JSON.stringify({
messages:[{role:'user',content:ctx+'\n\nUser question: '+userText}]})
```

### 3.3 The "fetch latest insights" code

Delete one continuous block of 165 lines. It holds, in order: `function setInsightStatus(msg,loading){…}`, the first `function fetchLiveInsights(){…}`, `function _refreshInsightGrid(){…}` (whose closing brace is followed on the same line by the comment `// ── AI-powered live feed fetcher ───…`), and the second `function fetchLiveInsights(){…}`.
- It starts at the line `function setInsightStatus(msg,loading){`.
- It ends at the closing `}` of the second `fetchLiveInsights`, just after its last lines: `    setInsightStatus('Live fetch failed. Showing curated content.',false);` and `  });`.
- The exact text is in Appendix A. Its md5, including the final line break, is `5e89715919c2cfe72d1a90dda2fba498`.

Nothing else refers to `fetchLiveInsights`, `setInsightStatus` or `_refreshInsightGrid`. The Insights page's display code still reads `insightsState.liveLoaded` and each feed's `_live` items. With nothing setting them, those readings simply stay empty, and they are not part of this deletion.

### 3.4 In `Governance-smoke.js`, addendum 205

This assertion checks that the CARE framework keeps its own vocabulary. It looked for the words "CARE framework (Catastrophize, Assess, Regulate, Exit)", which appear only in the paragraph deleted in 3.1. Without this change it fails. It now looks for the same four words on the Insights card for the CARE framework article, where they remain.

Find (occurs exactly once):

```js
return _s.indexOf('CARE framework (Catastrophize, Assess, Regulate, Exit)')>=0&&
```

Replace it with:

```js
return _s.indexOf('Catastrophize, Assess, Regulate, Exit')>=0 /* RETARGETED 28 Oct 2026 (Paul): the AI Guide paragraph that spelled out the CARE framework is deleted, and the Insights card for the CARE framework article now carries its vocabulary */&&
```

---

## 4. Executive Readiness: `Exec-Readiness-app.js`

In this copy, the Guide's `sendCoach` is a placeholder that never calls the AI, so the copy has no Guide paragraph to quote. **Apply "What is deleted", item 1, to your live Guide code.** Team Chat's `sendGChat` sends each message to the AI and posts the reply under a randomly chosen teammate's name.

### 4.1 In `sendGChat` (Team Chat), everything that sends the message to the AI and posts a reply

The block runs from choosing a teammate to the end of the AI request, including the replies posted when the request succeeds or fails.

Find (occurs exactly once):

```js
  renderGChatPanel();
  var responders=USERS.filter(function(u){return u.id!==cuId});
  var r=responders[Math.floor(Math.random()*responders.length)];
  var typing=$('gchatTyping');if(typing)typing.textContent=r.name+' is typing\u2026';
  var sysPrompt='You are '+r.name+', '+leaderRoleName(r)+' at SHADOKA. You are working with Faisal Hoque on AI Executive Readiness \u2014 leadership structure, philosophical proficiency, AI governance, and organizational transformation. '+r.name+' focuses on '+r.scope+'. Respond in 1-2 short sentences. Tone: smart, direct, collegial. No markdown.';
  fetch(CLAUDE_API_URL,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:120,messages:[{role:'user',content:sysPrompt+'\n\n'+cu.name+' just wrote: "'+text+'"'}]})
  }).then(function(res){return res.json()}).then(function(j){
    var reply='';if(j.content)for(var i=0;i<j.content.length;i++)if(j.content[i].text)reply+=j.content[i].text;
    if(!reply)reply='Good point \u2014 let\u2019s discuss further.';
    var now2=new Date();var ts2=(now2.getHours()%12||12)+':'+(now2.getMinutes()<10?'0':'')+now2.getMinutes()+' '+(now2.getHours()>=12?'PM':'AM');
    chatArr().push({who:r.id,name:r.name,ts:ts2,text:reply}); Store.commit('chatMsgs');
    if(!gchatOpen){gchatUnreadCount++;var u=$('gchatUnread');if(u){u.style.display='';u.textContent=gchatUnreadCount}}
    if(gchatOpen)renderGChatPanel();
    else{var t2=$('gchatTyping');if(t2)t2.textContent=''}
  }).catch(function(){
    var now3=new Date();var ts3=(now3.getHours()%12||12)+':'+(now3.getMinutes()<10?'0':'')+now3.getMinutes()+' '+(now3.getHours()>=12?'PM':'AM');
    chatArr().push({who:r.id,name:r.name,ts:ts3,text:'Got it \u2014 will follow up shortly.'}); Store.commit('chatMsgs');
    if(gchatOpen)renderGChatPanel();
  });
}
```

Replace it with:

```js
  renderGChatPanel();
}
```

---

## Acceptance

- In all four modules, the AI Guide's request contains no text written by the app telling the AI who it is, what the program is, or how to answer, no model name, and no reply-length cap. The Guide still answers the user's question.
- In all four modules, Team Chat makes no request to the AI service. A message posted in Team Chat gets no reply unless a teammate writes one, and no "is typing" indicator appears.
- Governance contains no `fetchLiveInsights`, `setInsightStatus` or `_refreshInsightGrid`. The Insights page looks and works as before.
- A search of each module's files for `max_tokens`, `model:'claude` and `You are the AI Guide` finds nothing.
- `node --check` passes on every changed file. Each module's test suite gives the results listed under "Checked".

## Checklist

- [ ] 1 Architecture: the Guide's paragraph (1.1), and its model name and reply-length cap (1.2)
- [ ] 2 Innovation Pipeline: the Guide's paragraph (2.1), and its model name and reply-length cap (2.2)
- [ ] 2 Innovation Pipeline: Team Chat's AI request and replies (2.3)
- [ ] 3 Governance: the Guide's paragraph (3.1), and its model name and reply-length cap (3.2)
- [ ] 3 Governance: the "fetch latest insights" code (3.3)
- [ ] 3 Governance: smoke-test addendum 205 retargeted (3.4)
- [ ] 4 Executive Readiness: "What is deleted", item 1, applied to the live Guide code
- [ ] 4 Executive Readiness: Team Chat's AI request and replies (4.1)
- [ ] Live code checked in every module for anything else covered by "What is deleted"
- [ ] `node --check` passes, and every test suite gives the results under "Checked"

## Per-surface checklist

- [ ] AI Guide panel in each of the four modules: ask a question, and an answer comes back from the backend
- [ ] AI Guide requests in each module, seen in the browser's network panel: no instruction paragraph, no `model`, no `max_tokens`
- [ ] Team Chat in each of the four modules: post a message, and no AI request is made, no reply appears, and no "is typing" indicator shows
- [ ] Governance Insights page: the cards, filters, and grid and list views work as before

---

## Appendix A: the Governance block deleted in 3.3

```js
function setInsightStatus(msg,loading){
  var st=document.getElementById('insightStatusText');
  var sp=document.getElementById('insightSpinner');
  if(st)st.textContent=msg;
  if(sp)sp.style.display=loading?'block':'none';
  if(st)st.style.display=loading?'none':'block';
}

// ── Live feed fetcher (uses Claude web_search — server-side, no CORS) ────────
function fetchLiveInsights(){
  if(insightsState.loading)return;
  insightsState.loading=true;
  var btn=document.getElementById('insightRefreshBtn');
  if(btn){btn.disabled=true;btn.textContent='\u23f3 Fetching\u2026';}
  setInsightStatus('',true);

  // Build one search request per source that has a profileUrl
  // We batch them: ask Claude to search all sources in one call using web_search
  var sourceList=INSIGHT_FEEDS.map(function(f,i){
    return (i+1)+'. '+f.label+' — profile: '+f.profileUrl+(f.feedUrl?' / rss: '+f.feedUrl:'');
  }).join('\n');

  var systemPrompt='You are a research assistant. Use web_search to find the 3–4 most recent public articles, posts, or podcast episodes for each source listed. Return ONLY a JSON object — no markdown, no explanation. Format:\n{\n  "fastco": [{title,date,url,excerpt},...],\n  "psych": [...],\n  "hbr": [...],\n  "mitsloan": [...],\n  "imd": [...],\n  "linkedin": [...],\n  "convergence": [{title,date,url,excerpt,duration},...]\n}\nFor podcasts include duration if found. Excerpts should be 1–2 sentences. Dates as YYYY-MM-DD or YYYY-MM.';

  var userMsg='Find the latest content from Faisal Hoque at these sources:\n'+sourceList+'\n\nReturn only the JSON object described.';

  fetch(CLAUDE_API_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:4000,
      system:systemPrompt,
      tools:[{type:'web_search_20250305',name:'web_search'}],
      messages:[{role:'user',content:userMsg}]
    })
  })
  .then(function(r){
    if(!r.ok)throw new Error('API '+r.status);
    return r.json();
  })
  .then(function(data){
    insightsState.loading=false;
    if(btn){btn.disabled=false;btn.innerHTML='\u21bb Refresh Live';}

    // Collect all text blocks from the response (Claude may use tool + then respond)
    var text='';
    if(data.content&&data.content.length){
      for(var i=0;i<data.content.length;i++){
        if(data.content[i].type==='text')text+=data.content[i].text;
      }
    }

    // Extract JSON from response text
    var parsed=null;
    try{
      var s=text.indexOf('{'),e=text.lastIndexOf('}');
      if(s>=0&&e>s)parsed=JSON.parse(text.slice(s,e+1));
    }catch(err){parsed=null;}

    if(parsed){
      var liveCount=0;
      for(var i=0;i<INSIGHT_FEEDS.length;i++){
        var f=INSIGHT_FEEDS[i];
        if(parsed[f.id]&&Array.isArray(parsed[f.id])&&parsed[f.id].length){
          f._live=parsed[f.id].slice(0,6);
          insightsState.liveLoaded[f.id]=true;
          liveCount++;
        }
      }
      _refreshInsightGrid();
      var total=_insightCount('all');
      setInsightStatus('\u2713 '+total+' items \u00b7 '+liveCount+' source'+(liveCount!==1?'s':'')+' live \u00b7 '+new Date().toLocaleTimeString(),false);
    } else {
      setInsightStatus('Live fetch complete. Feed data unavailable \u2014 showing curated content.',false);
    }
  })
  .catch(function(err){
    insightsState.loading=false;
    if(btn){btn.disabled=false;btn.innerHTML='\u21bb Refresh Live';}
    setInsightStatus('Fetch failed ('+err.message+'). Showing curated content.',false);
    console.error('Insights fetch error:',err);
  });
}

function _refreshInsightGrid(){
  // Rebuild filter strip counts too
  var filters=document.querySelectorAll('.insight-filter');
  filters.forEach(function(b){
    var fid=b.getAttribute('data-feed');
    var cnt=_insightCount(fid);
    b.innerHTML=(fid==='all'?'All':
      (function(){var f=INSIGHT_FEEDS.filter(function(x){return x.id===fid;})[0];return f?(f.type==='podcast'?'&#9654; ':f.type==='post'?'&#9998; ':'')+f.shortLabel:fid;}())
    )+' <span style="opacity:.5;font-size:12px">'+cnt+'</span>';
    b.classList.toggle('active',fid===insightsState.filter);
  });
  var g=document.getElementById('insightGrid');
  if(g)g.innerHTML=buildInsightCards(insightsState.filter,insightsState.view);
}// ── AI-powered live feed fetcher ───────────────────────────────────────────
function fetchLiveInsights(){
  if(insightsState.loading)return;
  insightsState.loading=true;
  var btn=document.getElementById('insightRefreshBtn');
  if(btn){btn.disabled=true;btn.textContent='\u23f3 Fetching\u2026';}
  setInsightStatus('',true);

  // Build list of feeds with URLs to try
  var feedsWithUrls=INSIGHT_FEEDS.filter(function(f){return f.feedUrl;});
  var feedNames=feedsWithUrls.map(function(f){return f.label+' ('+f.feedUrl+')';}).join(', ');

  var prompt='You are an RSS aggregator. Please fetch and parse the following RSS/podcast feeds and return the 5 most recent items from each as JSON.\n\nFeeds to fetch:\n'
    +feedsWithUrls.map(function(f,i){return (i+1)+'. '+f.label+': '+f.feedUrl;}).join('\n')
    +'\n\nFor each feed, return an array of items with fields: title, date (YYYY-MM-DD), url, excerpt (2-3 sentences, plain text), duration (podcasts only).\n\nReturn ONLY a JSON object like:\n{"fastco":[...],"psych":[...],"convergence":[...]}\n\nUse the feed IDs: '+feedsWithUrls.map(function(f){return f.id;}).join(', ')+'\n\nIf a feed is unreachable, return an empty array for that key. Return pure JSON only, no markdown.';

  fetch(CLAUDE_API_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:4000,
      messages:[{role:'user',content:prompt}]
    })
  })
  .then(function(r){return r.json();})
  .then(function(data){
    insightsState.loading=false;
    if(btn){btn.disabled=false;btn.innerHTML='\u21bb Refresh Live';}
    var text='';
    if(data.content&&data.content.length){
      for(var i=0;i<data.content.length;i++){if(data.content[i].type==='text')text+=data.content[i].text;}
    }
    // Parse JSON from response
    var clean=text.replace(/```json|```/g,'').trim();
    // Find JSON object
    var start=clean.indexOf('{'),end=clean.lastIndexOf('}');
    if(start>=0&&end>start){
      try{
        var parsed=JSON.parse(clean.slice(start,end+1));
        var liveCount=0;
        for(var i=0;i<INSIGHT_FEEDS.length;i++){
          var f=INSIGHT_FEEDS[i];
          if(parsed[f.id]&&parsed[f.id].length){
            f._live=parsed[f.id];
            insightsState.liveLoaded[f.id]=true;
            liveCount++;
          }
        }
        var g=document.getElementById('insightGrid');
        if(g)g.innerHTML=buildInsightCards(insightsState.filter,insightsState.view);
        // Update filter counts
        if(currentPage==='insights'){render();}
        setInsightStatus('\u2713 Live feeds updated \u2014 '+liveCount+' source'+(liveCount!==1?'s':'')+' refreshed \u00b7 '+new Date().toLocaleTimeString(),false);
      }catch(e){
        setInsightStatus('Could not parse feed data. Showing curated content.',false);
      }
    } else {
      setInsightStatus('Live fetch returned no data. Showing curated content.',false);
    }
  })
  .catch(function(e){
    insightsState.loading=false;
    if(btn){btn.disabled=false;btn.innerHTML='\u21bb Refresh Live';}
    setInsightStatus('Live fetch failed. Showing curated content.',false);
  });
}
```
