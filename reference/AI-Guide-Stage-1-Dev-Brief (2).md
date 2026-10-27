# AI Guide – Stage 1: Wiring the Guide Button to Pinecone Assistant

**For:** Development team
**From:** Paul Scade, NextChapter
**Date:** October 12, 2026
**Applies to:** The `/dev/` version of the AI Innovation Pipeline app only. Do not apply to the live version.

---

> ## IMPORTANT: Make these changes in `/dev/` only
>
> **Apply every change in this brief to the `/dev/` directory version of the app, not the live version.** This is a prototype of the AI Guide. It must be tested in `/dev/` before anything touches the live deployment. That covers everything:
>
> - The browser and style changes (sections 5 and 6) go into the `/dev/` copy of the app's files.
> - The server route (section 4) goes on the server that serves `/dev/`, not the live server.
> - The API key (section 2) is set only in the `/dev/` server's environment.
>
> **Check where the Guide route points.** The browser code sets `GUIDE_ENDPOINT` to `/api/guide`. A path that starts with `/` points to the root of the domain, not to the `/dev/` directory. If `/dev/` and the live app share a domain, set `GUIDE_ENDPOINT` so that it reaches the `/dev/` server's route and not the live one.
>
> Nothing in this brief should be applied to the live version until Paul confirms that testing in `/dev/` is complete.

---

## 1. What this stage delivers

The AI Guide button currently opens a placeholder chat panel. This stage connects it to the Pinecone assistant our team has set up and tested (`testassistant1`). That assistant holds TRANSCEND and a guide to the module's content, and it answers using Claude Sonnet 4.5.

When this stage is done:

1. A user types a question in the Guide panel and gets an answer from the Pinecone assistant.
2. The Guide remembers the earlier exchanges in the current panel conversation, so follow-up questions work.
3. Each question tells the Guide which step the user is on.
4. The Pinecone API key stays on the server and never reaches the browser.
5. Download links to our uploaded files, which Pinecone includes with every answer, are removed on the server.
6. The preset question buttons are gone, and the panel shows a "Thinking…" indicator while it waits.

Everything the Guide might eventually see of the user's own work (their entries, portfolio data, and so on) is **stage 2** and out of scope here. See section 9.

If you have seen the earlier Pinecone quickstart, this brief replaces it. The quickstart is correct as far as it goes, but it is missing four things this brief adds: resending the conversation, naming the model, keeping the key on the server, and removing file links.

---

## 2. Before you start

**You don't need a Pinecone account.** Everything you need from Pinecone is in this brief, including the API key below. Pinecone's documentation, linked throughout, is public.

**The API key.** Set this as the server's `PINECONE_API_KEY` environment variable (or store it in AWS Secrets Manager):

```
pcsk_3W276b_59S5h6roU3GE2q7EUQL1VxjzhGb7q6hKveY8VvZJHK7Vhss7WvrBAgk2b8pnL4T
```

Store it only as a server secret. It must never appear in `app.js` or in any file served to the browser. Keep this document out of the code repository, since it contains the key.

**About line numbers.** Line numbers in this brief refer to the prototype copy of `app.js` and `styles.css` shared on October 12, 2026. The versions on AWS differ from this prototype copy (the live version has the admin switch, for example), so find each item in the `/dev/` copy by its function name or by the quoted text.

---

## 3. How it works

```
Browser (Guide panel)
  │  POST /api/guide   { question, history, context }
  ▼
Our server (holds the Pinecone key)
  │  POST https://prod-1-data.ke.pinecone.io/assistant/chat/testassistant1
  │       { messages: [...history, newest question with step context], model, stream:false }
  ▼
Pinecone Assistant
  │  searches TRANSCEND and the module guide for relevant passages,
  │  then has Claude Sonnet 4.5 write the answer
  ▼
Our server
  │  keeps only the answer text, removes citation markers,
  │  drops the citation list (which contains file download links)
  ▼
Browser   { answer }
```

Two points about Pinecone that drive the design:

- **Pinecone remembers nothing between requests.** Its guide states that any earlier messages needed to understand a new question must be included in each request ([Pinecone: Provide conversation history](https://docs.pinecone.io/guides/assistant/chat-with-assistant)). The Pinecone console's playground does this automatically, which is why it appears to remember. Our app must do it itself, so the browser sends the recent conversation with every question.
- **If a request names no model, Pinecone uses GPT-4o.** The API specification gives `gpt-4o` as the default ([Pinecone API specification, 2026-07](https://raw.githubusercontent.com/pinecone-io/pinecone-api/refs/heads/main/2026-07/assistant_data_2026-07.oas.yaml)). The console shows Claude Sonnet 4.5 for this assistant, but Pinecone's documentation does not say whether an API request that names no model follows that console setting. So the server names `claude-sonnet-4-5` in every request.

---

## 4. Server: the Guide route

### Requirements

1. Add a route, `POST /api/guide`, that accepts `{ question, history, context }` as JSON and returns `{ answer }`.
2. **The route must refuse requests without a valid signed-in session** (HTTP 401). Use the same session check that protects the app's other server routes. Without this, anyone on the internet could use our route and run up Pinecone charges.
3. The route calls Pinecone with the key from the server secret, names the model `claude-sonnet-4-5`, and sends the API version header `X-Pinecone-Api-Version: 2026-07`.
4. The route returns **only** the answer text. It must never forward Pinecone's `citations` field to the browser. Each citation carries a `signed_url` field, a temporary link to the whole uploaded file, and Pinecone's specification warns that anyone with the link can access the file. Forwarded to the browser, it would let any user download the full text of TRANSCEND.
5. The route removes citation markers such as `[1]` or `[1, pp. 12]` from the answer text, since users will not see the source list they refer to.
6. The route logs model and token usage for each answer, for cost tracking. It does not log question or answer text.
7. Any proxy or gateway in front of the route must allow long enough for an answer. Answers can take several seconds or more, and the code below waits up to 60 seconds.

### Code: the handler (complete file)

Node.js 18 or newer (it uses the built-in `fetch`). It does not depend on any web framework or library, and no Pinecone SDK is needed. If the server does not run Node.js, see "If your server doesn't run Node.js" below. Environment variables: `PINECONE_API_KEY` (required, the key in section 2), plus optional `PINECONE_ASSISTANT_HOST` and `PINECONE_ASSISTANT_NAME` if the host or assistant name ever change. Paul will tell you if the host or the assistant name ever changes.

```javascript
// guide-route.js – server-side handler for the AI Guide (Node.js 18 or newer)
'use strict';

const PINECONE_HOST    = process.env.PINECONE_ASSISTANT_HOST || 'https://prod-1-data.ke.pinecone.io';
const ASSISTANT_NAME   = process.env.PINECONE_ASSISTANT_NAME || 'testassistant1';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;  // server secret – never sent to the browser
const MODEL            = 'claude-sonnet-4-5';
const API_VERSION      = '2026-07';

const MAX_QUESTION_CHARS        = 2000;
const MAX_CONTEXT_CHARS         = 300;
const MAX_HISTORY_MESSAGES      = 10;
const MAX_HISTORY_MESSAGE_CHARS = 8000;
const TIMEOUT_MS                = 60000;

// Keeps only well-formed user/assistant turns, the most recent ones, starting with a user turn.
function cleanHistory(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = list
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') &&
                 typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS) }));
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
}

// Removes citation markers such as [1] or [1, pp. 12]. The source list itself never reaches the browser.
function stripCitationMarkers(text) {
  return text.replace(/\s?\[\d+(?:,\s*pp?\.[^\]]*)?\]/g, '').trim();
}

async function answerGuideQuestion(body) {
  const question = String((body && body.question) || '').trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) return { status: 400, json: { error: 'empty_question' } };

  const context = String((body && body.context) || '').trim().slice(0, MAX_CONTEXT_CHARS);
  const history = cleanHistory(body && body.history);
  const newest  = (context ? '[' + context + ']\n\n' : '') + question;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(PINECONE_HOST + '/assistant/chat/' + encodeURIComponent(ASSISTANT_NAME), {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_API_KEY,
        'Content-Type': 'application/json',
        'X-Pinecone-Api-Version': API_VERSION
      },
      body: JSON.stringify({
        messages: history.concat([{ role: 'user', content: newest }]),
        model: MODEL,
        stream: false
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    console.error('[guide] Pinecone returned HTTP ' + res.status);
    return { status: 502, json: { error: 'guide_unavailable' } };
  }

  const data = await res.json();
  const answer = stripCitationMarkers((data.message && data.message.content) || '');
  if (!answer) return { status: 502, json: { error: 'guide_unavailable' } };

  // Usage logging for cost tracking. No question or answer text is logged.
  console.log(JSON.stringify({
    event: 'guide_answer',
    model: data.model,
    usage: data.usage,
    snippets: data.context_snippet_count
  }));

  // Only the answer text leaves the server. data.citations, which carries
  // download links to the uploaded files, is deliberately dropped.
  return { status: 200, json: { answer: answer } };
}

module.exports = { answerGuideQuestion, cleanHistory, stripCitationMarkers };
```

### Connecting the handler to your server

Add a `POST /api/guide` route to the app's existing server, using whatever framework or setup it already runs on. Your route only needs to do five things:

1. Check the user's session exactly as the app's other authenticated routes do, and refuse the request with HTTP 401 if there is no valid session.
2. Read the request body as JSON. The body is small, so a size limit of 100 KB is plenty.
3. Call `answerGuideQuestion(body)`.
4. Send back `out.status` as the HTTP status and `out.json` as the JSON response body.
5. If anything fails along the way, respond with HTTP 502 and `{ "error": "guide_unavailable" }`.

Two examples follow. Use whichever matches your setup, or neither.

**Example: Express.** Here `requireSignedIn` stands for the app's existing session middleware. Replace it with whatever the other authenticated routes use.

```javascript
const express = require('express');
const { answerGuideQuestion } = require('./guide-route');

app.post('/api/guide', requireSignedIn, express.json({ limit: '100kb' }), async (req, res) => {
  try {
    const out = await answerGuideQuestion(req.body);
    res.status(out.status).json(out.json);
  } catch (err) {
    console.error('[guide] request failed:', err && err.message);
    res.status(502).json({ error: 'guide_unavailable' });
  }
});
```

**Example: AWS Lambda behind API Gateway.**

```javascript
const { answerGuideQuestion } = require('./guide-route');

exports.handler = async (event) => {
  // Session check: use the same mechanism as the app's other authenticated routes
  // (for example, an API Gateway authorizer). Refuse with 401 if there is no valid session.
  const json = (status, obj) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  });
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '{}');
    const out = await answerGuideQuestion(JSON.parse(raw));
    return json(out.status, out.json);
  } catch (err) {
    console.error('[guide] request failed:', err && err.message);
    return json(502, { error: 'guide_unavailable' });
  }
};
```

**If your server doesn't run Node.js,** port `guide-route.js` to the server's language. It is 85 lines. The requirements at the start of this section list everything it must do, and the request it sends to Pinecone is shown in section 3 and the appendix. The port must behave the same way: the same limits on question length, context length, and history, the same model name and headers, citation markers removed, and only `{ answer }` returned to the browser.

---

## 5. Browser: changes to the Guide panel (`app.js`)

### Requirements

1. The panel sends questions to the `/dev/` server's Guide route (see the notice at the top), not to `CLAUDE_API_URL`.
2. The old in-code system prompt in `sendCoach` is removed. Paul's team will work out any instructions for the Guide during testing and set them in the Pinecone console, so they need no code change.
3. Each request includes the last 10 messages of the current panel conversation, excluding the welcome message and any exchange that failed.
4. Each request includes one sentence saying which step the user is on (for example, "The user is on Step 1.1 (Assessment Battery) in Phase 1: Diagnose."). The server adds it to the front of the newest question. This also helps Pinecone's search find passages relevant to that step.
5. The five preset question buttons are removed.
6. While waiting for an answer, the panel shows "Thinking…", and the send button and text box are disabled, so a question can't be sent twice.
7. Answers are shown with light formatting (bold, lists, headings) instead of raw asterisks and hash marks. All HTML in an answer is escaped first, so an answer can never inject markup into the page.
8. If a request fails, the panel shows: "Sorry, the AI Guide is unavailable right now. Please try again in a moment." The failed exchange is not resent with later questions.
9. **Do not remove `CLAUDE_API_URL`** (prototype line 244). Team Chat still uses it (prototype line 5614).

### Code

The block below is complete. In the prototype:

- Add the configuration lines near the other endpoint settings (around line 244).
- Add the three helpers above `renderCoachPanel`.
- Replace the existing `renderCoachPanel` and `sendCoach` (prototype lines 5484–5520) with the versions here.
- **Delete** `sendCoachPreset` (prototype line 5502) entirely. Nothing calls it once the presets are gone.
- Leave `toggleCoach` unchanged.

```javascript
/* ── AI GUIDE: configuration (add next to the other endpoint settings) ── */
var GUIDE_ENDPOINT = '/api/guide';  // Dev team: the /dev/ server's Guide route (see the notice at the top)
var GUIDE_HISTORY_LIMIT = 10;       // earlier messages resent with each new question
var coachBusy = false;

/* ── AI GUIDE: helpers (add above renderCoachPanel) ── */

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
var ul=l.match(/^\s*[-*\u2022]\s+(.*)$/),ol=l.match(/^\s*\d+[.)]\s+(.*)$/),hd=l.match(/^\s*#{1,6}\s+(.*)$/);
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

/* ── AI GUIDE: replaces the existing renderCoachPanel ── */
function renderCoachPanel(){
var panel=$('coachPanel');if(!panel)return;
var ctx=currentStep?('Step '+currentStep):'Overview';
var h='<div class="coach-header"><div class="coach-header-title"><span>★</span> AI Guide</div><button class="coach-close" onclick="toggleCoach()">×</button></div>';
h+='<div class="u-095218e"><div class="u-3d326bb">Context: '+esc(ctx)+'</div></div>';
h+='<div class="coach-msgs" id="coachMsgsEl">';
for(var i=0;i<coachMsgs.length;i++){var m=coachMsgs[i];
h+='<div class="coach-msg '+m.role+'"><div class="coach-sender">'+(m.role==='ai'?'AI Guide':'You')+'</div>'+(m.role==='ai'?guideFormat(m.text):esc(m.text))+'</div>'}
if(coachBusy)h+='<div class="coach-msg ai coach-thinking"><div class="coach-sender">AI Guide</div>Thinking\u2026</div>';
h+='</div>';
h+='<div class="coach-input-row"><textarea id="coachInput" placeholder="Ask about any step, concept, or challenge..."'+(coachBusy?' disabled':'')+' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendCoach()}"></textarea><button class="coach-send" onclick="sendCoach()"'+(coachBusy?' disabled':'')+'>→</button></div>';
panel.innerHTML=h;
var msgs=document.getElementById('coachMsgsEl');if(msgs)msgs.scrollTop=msgs.scrollHeight;
}

/* ── AI GUIDE: replaces the existing sendCoach ── */
function sendCoach(){
if(coachBusy)return;
var inp=document.getElementById('coachInput');if(!inp||!inp.value.trim())return;
var userText=inp.value.trim();inp.value='';
var history=guideHistory();  // built before the new question is added
var userMsg={role:'user',text:userText};
coachMsgs.push(userMsg);
coachBusy=true;renderCoachPanel();
fetch(GUIDE_ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
body:JSON.stringify({question:userText,history:history,context:guideStepContext()})
}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(j){
if(!j||!j.answer)throw new Error('empty answer');
coachMsgs.push({role:'ai',text:j.answer});
}).catch(function(){
userMsg.failed=true;
coachMsgs.push({role:'ai',failed:true,text:'Sorry, the AI Guide is unavailable right now. Please try again in a moment.'});
}).then(function(){coachBusy=false;renderCoachPanel()});
}
```

The welcome message also changes. It needs a new `welcome:true` flag so it is never resent to Pinecone. See section 6, item 1, for the complete replacement line.

**If the Guide route is on a different domain from the app,** change `credentials:'same-origin'` to whatever the app's other authenticated server calls use (for example, `credentials:'include'` with matching CORS settings on the server).

### Styles (`styles.css`)

Add these rules after the existing `.coach-msg` rules (prototype lines 247–251):

```css
.coach-msg p{margin:0 0 8px}
.coach-msg p:last-child{margin-bottom:0}
.coach-msg .coach-list{margin:0 0 8px;padding-left:20px}
.coach-msg .coach-list li{margin:0 0 4px}
.coach-thinking{opacity:.7}
.coach-input-row textarea:disabled,.coach-send:disabled{opacity:.5;cursor:not-allowed}
```

Delete the three preset rules, `.coach-presets`, `.coach-preset`, and `.coach-preset:hover` (prototype lines 252–254).

---

## 6. Copy changes

Three pieces of text in the app become inaccurate once the Guide is wired. Replace each one exactly as shown. The quoted text is from the prototype, so match it to the `/dev/` version.

**1. Welcome message** (prototype line 815). This change also adds the `welcome:true` flag the new code needs.

Find:

```javascript
var coachMsgs=[{role:'ai',text:'Welcome to the AI Innovation Pipeline. I\'m your strategic guide through the 90-day transformation journey. Ask me about any step, framework, or concept — or challenge me on where you\'re stuck.'}];
```

Replace with:

```javascript
var coachMsgs=[{role:'ai',welcome:true,text:'Welcome to the AI Innovation Pipeline. I\'m your AI Guide. Ask me how to complete the step you\'re on, what to do next, or for ideas drawn from Faisal Hoque\'s book TRANSCEND.'}];
```

**2. Help text for the Guide button** (prototype line 5802). The current text says the Guide can see the user's data, which is not true in stage 1.

Find:

```javascript
{ic:'\u2726 AI Guide',d:'Orange button, bottom-right corner. Context-aware for whichever step you are on. Ask it anything about the current step, your data, or portfolio decisions.'}
```

Replace with:

```javascript
{ic:'\u2726 AI Guide',d:'Orange button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque\u2019s book TRANSCEND and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can\u2019t see the data you have entered.'}
```

**3. Privacy text** (prototype line 5824, one sentence within a longer paragraph). The current text says questions go to the Anthropic API. They now go to Pinecone. Replace only this sentence and leave the rest of the paragraph unchanged.

Find:

```
The AI Guide sends only your question and the current step context to the Anthropic API, routed through the program\u2019s server rather than directly from your browser.
```

Replace with:

```
The AI Guide sends your question, your recent messages in the Guide panel, and the name of the step you are on to Pinecone, an AI service, routed through the program\u2019s server rather than directly from your browser. Pinecone adds relevant passages from the program\u2019s reference material and has a Claude model, made by Anthropic, write the answer.
```

---

## 7. Acceptance criteria

Stage 1 is done when all of the following are true in the `/dev/` environment:

1. **Presets gone:** The Guide panel shows no preset question buttons.
2. **Answers:** A question typed in the panel returns an answer in the panel.
3. **Memory:** Ask "Give me three ideas for using AI in a small bookshop," then "Expand on the second one." The second answer develops the second idea from the first answer.
4. **Step awareness:** On Step 1.1, ask "Which step am I on?" The answer names Step 1.1, Assessment Battery.
5. **Model:** The server log line for each answer shows a `model` value naming Claude Sonnet 4.5, not GPT-4o.
6. **No file links:** In the browser's developer tools (Network tab), the response from `/api/guide` contains only `{"answer": ...}`. It contains no `citations`, no `signed_url`, and no `storage.googleapis.com` address.
7. **No key in the browser:** The Pinecone API key appears in no file served to the browser and in no browser request.
8. **Sign-in required:** A request to `/api/guide` without a valid session is refused with HTTP 401.
9. **Waiting state:** While an answer is pending, the panel shows "Thinking…", and pressing Enter or the send button does nothing.
10. **Failure handling:** If the route fails, the panel shows "Sorry, the AI Guide is unavailable right now. Please try again in a moment." The next question works normally, and the failed exchange is not included in its history.
11. **Formatting:** An answer containing bullets and bold text shows as a list with bold text, not as raw asterisks or hash marks.
12. **Copy:** All three replacements in section 6 appear exactly as written.
13. **Admin switch:** If the `/dev/` version has the admin switch, it still shows and hides the Guide button as before.
14. **Team Chat:** Team Chat still works (it still uses `CLAUDE_API_URL`).
15. **Live untouched:** The live version of the app and its server are unchanged.

---

## 8. Checklist by surface

**Environment**
- [ ] All changes made in `/dev/` only, with nothing changed in the live version
- [ ] `GUIDE_ENDPOINT` confirmed to reach the `/dev/` server's route

**Server**
- [ ] API key from section 2 stored as a server secret only
- [ ] `POST /api/guide` added to the existing server, using `guide-route.js` (or a port of it with the same behavior)
- [ ] Route protected by the existing session check
- [ ] Gateway or proxy timeout long enough (the handler waits up to 60 seconds)
- [ ] Usage logging visible in server logs

**Browser (`app.js`)**
- [ ] `GUIDE_ENDPOINT`, `GUIDE_HISTORY_LIMIT`, and `coachBusy` added
- [ ] `guideStepContext`, `guideHistory`, and `guideFormat` added
- [ ] `renderCoachPanel` and `sendCoach` replaced
- [ ] `sendCoachPreset` deleted
- [ ] Welcome message replaced, including the `welcome:true` flag
- [ ] `CLAUDE_API_URL` left in place for Team Chat

**Styles (`styles.css`)**
- [ ] Six new rules added
- [ ] Three preset rules deleted

**Copy**
- [ ] Welcome message (section 6, item 1)
- [ ] Help text (section 6, item 2)
- [ ] Privacy sentence (section 6, item 3)

---

## 9. Out of scope for stage 1

- **What the Guide can see of the user's work** (entries, portfolio data, team activity). This is stage 2, which involves privacy, cost, and design decisions still to be made.
- **Saving Guide conversations** between sessions or devices. In stage 1, the conversation lasts only while the page is open.
- **Streaming answers** word by word. Pinecone supports this, but it can come later.
- **Showing sources to users** (for example, "TRANSCEND, p. 112"). If wanted later, the server can pass on file names and page numbers, but never the `signed_url` links.
- **Team Chat's simulated colleague replies.** This is a separate issue, to be handled separately.

---

## Appendix: Pinecone reference

All details below are from Pinecone's documentation, accessed October 12, 2026.

| Item | Value | Source |
| --- | --- | --- |
| Chat endpoint | `POST {host}/assistant/chat/{assistant_name}` | [Chat guide](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| Host for `testassistant1` | `https://prod-1-data.ke.pinecone.io` (from the Pinecone console, per Paul) | Pinecone console |
| Headers | `Api-Key`, `Content-Type: application/json`, `X-Pinecone-Api-Version: 2026-07` | [Chat guide](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| Request fields used | `messages` (array of `{role, content}`, content can't be empty), `model`, `stream` | [API specification](https://raw.githubusercontent.com/pinecone-io/pinecone-api/refs/heads/main/2026-07/assistant_data_2026-07.oas.yaml) |
| Other request fields | `temperature` (default 0), `filter`, `json_response`, `include_highlights`, `context_options` (`top_k`, default 16 passages, and `snippet_size`, default 2,048 tokens) | [API specification](https://raw.githubusercontent.com/pinecone-io/pinecone-api/refs/heads/main/2026-07/assistant_data_2026-07.oas.yaml), [Chat guide](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| Default model if none named | `gpt-4o` | [API specification](https://raw.githubusercontent.com/pinecone-io/pinecone-api/refs/heads/main/2026-07/assistant_data_2026-07.oas.yaml) |
| Model name used here | `claude-sonnet-4-5` | [Chat guide: Choose a model](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| Response fields | `message.content` (the answer), `model`, `usage`, `citations` (each reference includes `file.signed_url`), `context_snippet_count` | [Chat guide](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| Conversation memory | Not stored by Pinecone. Earlier messages must be sent with each request. | [Chat guide: Provide conversation history](https://docs.pinecone.io/guides/assistant/chat-with-assistant) |
| History limit | 64,000 tokens of chat history per request (our 10-message cap stays well below this) | [Pricing and limits](https://docs.pinecone.io/guides/assistant/pricing-and-limits) |
