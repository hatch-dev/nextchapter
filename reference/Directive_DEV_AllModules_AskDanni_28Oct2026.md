# All four modules: the AI Guide becomes "Ask Danni", with a new opening message (28 October 2026)

**For:** the developers of the four modules: 90 Days to an AI-Ready Architecture, 90 Days to an AI Innovation Pipeline, 90 Days to Responsible AI Governance, and 90 Days to Executive Readiness.  
**Applies to:** each module's live build, after `Directive_DEV_AllModules_AIRequestCleanup_28Oct2026.md` and every earlier directive and addendum.  
**Source:** the copies Paul holds. The Architecture copy is current. The other three date from 15 October 2026.

**Checked:** every change below was applied to copies that already carried the AI request cleanup directive and the video-name directives (and, for Architecture, the combined knowledge-base directive). Every quoted text is also found exactly once in the copies without them.
- `Architecture-app.js`: md5 `d4fc2f753acc282277a943671cff04d2` before, `0d704173280c1bf45d6cb6bbd53899a5` after. `Architecture-index.html`: `202aaca4e70cf930470d2ed078b50db6` before, `6793e9c3b7eeb4913f542a35d14f81f4` after.
- Innovation `app.js`: `c51ccdc6cbac8e1aee7d1b251546afcb` before, `43bffa1407c6c534d13c1e7b4e70cc31` after. `index.html`: `e5c9183f112d2e004d419fe04a253af2` before, `a894c7e4d068577bebb82f04a26f0f8f` after.
- `Governance-app.js`: `60a4c2d2ed30404b29b9e06f68c43295` before, `41643f8b2322cd1bb6e43dd51db7f44c` after. `Governance-index.html`: `937a237d79bda0b40e159c4d789b04f1` before, `307fb11b4973e8058c9a2ff01b5f866e` after.
- `Exec-Readiness-app.js`: `ed90c8076abf333ccda36ed8f8e37ff2` before, `90431e5a476295522514f94e73a67555` after. `Exec-Readiness-index.html`: `e06cd243abdfab2963135e60ea0529f2` before, `7408a907d3ed90e9c07e8a47cc1944e1` after.
- No file changes its number of lines. Every changed script passes `node --check`.
- Every module's test suite gives the same results as before the change: Architecture's harness and smoke test show only their two long-standing failures (FONTS and "CAROUSEL 4 slides each"), and the Innovation, Governance and Executive Readiness suites pass in full. No test refers to the changed words.

**Your live code differs from these copies.** In particular, the live Guide panel shows a line saying the Guide is based on Faisal Hoque's writing, which the copies do not have. Wherever your live code differs, apply "What changes" wherever the label, the message names and the opening message actually live. If a quoted text is not found exactly once in your copy, stop and report it rather than forcing the change in.

Code blocks show the source exactly as it is in the file, including its backslash escapes and HTML entities. Copy them exactly.

---

## What changes

Ruled by Paul on 28 October 2026, following the meeting with Faisal. The Guide is presented as Danni, and as the company's guide rather than one person's writing.

1. **The button that opens the Guide** (bottom right) reads **Ask Danni**, keeping its star mark.
2. **The panel's title** reads **Ask Danni**, keeping its star mark.
3. **Every message in the panel is headed with a name:** **Danni** above Danni's replies, including the opening message, and **You** above the user's own messages. All four modules work the same way. The Innovation Pipeline and Governance already head each message, with "AI Guide" and "You", so only "AI Guide" changes there. Architecture and Executive Readiness head no messages yet, so they gain both names. They use the `coach-sender` style that all four modules' stylesheets already define, so the names look the same in every module.
4. **The opening message** in the panel reads, word for word:
   - Architecture: "Welcome to AI-Ready Architecture. I’m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications."
   - Innovation Pipeline: "Welcome to the AI Innovation Pipeline. I’m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications."
   - Governance: "Welcome to Responsible AI Governance. I’m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications."
   - Executive Readiness: "Welcome to Executive Readiness. I’m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications."
5. **Delete** any line in the panel saying the Guide is based on Faisal Hoque's writing, and anything else in the panel that presents the Guide as one person's work.

Only the places listed change. The feature keeps its name, AI Guide, where the app refers to it as a feature: the administrators' switch, Help, and the privacy text.

---

## 1. Architecture

### 1.1 `Architecture-index.html`: the button that opens the Guide

Find (occurs exactly once):

```html
onclick="toggleCoach()">&#10022; AI Guide</button>
```

Replace it with:

```html
onclick="toggleCoach()">&#10022; Ask Danni</button>
```

### 1.2 `Architecture-app.js`: the panel's title

Find (occurs exactly once):

```js
\u2726 AI Guide</div><button class="coach-close" onclick="toggleCoach()">\u00D7</button>
```

Replace it with:

```js
\u2726 Ask Danni</div><button class="coach-close" onclick="toggleCoach()">\u00D7</button>
```

### 1.3 `Architecture-app.js`: a name above every message (new)

Find (occurs exactly once):

```js
h+='<div class="coach-msg '+(m.role==='user'?'user':'ai')+'">'+esc(m.text)+'</div>';
```

Replace it with:

```js
h+='<div class="coach-msg '+(m.role==='user'?'user':'ai')+'"><div class="coach-sender">'+(m.role==='user'?'You':'Danni')+'</div>'+esc(m.text)+'</div>';
```

### 1.4 `Architecture-app.js`: the opening message

Find (occurs exactly once):

```js
var coachMsgs=[{role:'ai',text:'Welcome to the 90 Days to an AI-Ready Architecture program. Ask me about the five-layer AI tech stack, strategic enterprise architecture, data governance, integration modernization, identity architecture, or any step in the program.'}];
```

Replace it with:

```js
var coachMsgs=[{role:'ai',text:'Welcome to AI-Ready Architecture. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.'}];
```

---

## 2. Innovation Pipeline

### 2.1 `index.html`: the button that opens the Guide

Find (occurs exactly once):

```html
onclick="toggleCoach()">&#10022; AI Guide</button>
```

Replace it with:

```html
onclick="toggleCoach()">&#10022; Ask Danni</button>
```

### 2.2 `app.js`: the panel's title

Find (occurs exactly once):

```js
<div class="coach-header-title"><span>★</span> AI Guide</div>
```

Replace it with:

```js
<div class="coach-header-title"><span>★</span> Ask Danni</div>
```

### 2.3 `app.js`: the name above Danni's replies

Find (occurs exactly once):

```js
(m.role==='ai'?'AI Guide':'You')
```

Replace it with:

```js
(m.role==='ai'?'Danni':'You')
```

### 2.4 `app.js`: the opening message

Find (occurs exactly once):

```js
var coachMsgs=[{role:'ai',text:'Welcome to the AI Innovation Pipeline. I\'m your strategic guide through the 90-day transformation journey. Ask me about any step, framework, or concept — or challenge me on where you\'re stuck.'}];
```

Replace it with:

```js
var coachMsgs=[{role:'ai',text:'Welcome to the AI Innovation Pipeline. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.'}];
```

---

## 3. Governance

### 3.1 `Governance-index.html`: the button that opens the Guide

Find (occurs exactly once):

```html
&#10022; AI Guide</button>
```

Replace it with:

```html
&#10022; Ask Danni</button>
```

### 3.2 `Governance-app.js`: the panel's title

Find (occurs exactly once):

```js
<div class="coach-header-title"><span>✦</span> AI Guide</div>
```

Replace it with:

```js
<div class="coach-header-title"><span>✦</span> Ask Danni</div>
```

### 3.3 `Governance-app.js`: the name above Danni's replies

Find (occurs exactly once):

```js
(m.role==='ai'?'AI Guide':'You')
```

Replace it with:

```js
(m.role==='ai'?'Danni':'You')
```

### 3.4 `Governance-app.js`: the opening message

Find (occurs exactly once):

```js
var coachMsgs=[{role:'ai',text:'Welcome to the 90-Day Responsible AI Governance program. I\'m your guide through the five phases — Map, Build, Assess, Embed, Govern — and the CARE framework behind them. Ask me about any step, the NIST AI RMF alignment, or challenge me on where you\'re stuck.'}];
```

Replace it with:

```js
var coachMsgs=[{role:'ai',text:'Welcome to Responsible AI Governance. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.'}];
```

---

## 4. Executive Readiness

### 4.1 `Exec-Readiness-index.html`: the button that opens the Guide

Find (occurs exactly once):

```html
onclick="toggleCoach()">&#10022; AI Guide</button>
```

Replace it with:

```html
onclick="toggleCoach()">&#10022; Ask Danni</button>
```

### 4.2 `Exec-Readiness-app.js`: the panel's title

Find (occurs exactly once):

```js
\u2726 AI Guide</div><button class="coach-close" onclick="toggleCoach()" title="Close">\u00D7</button>
```

Replace it with:

```js
\u2726 Ask Danni</div><button class="coach-close" onclick="toggleCoach()" title="Close">\u00D7</button>
```

### 4.3 `Exec-Readiness-app.js`: a name above every message (new)

Find (occurs exactly once):

```js
coachMsgs.forEach(function(m){h+='<div class="coach-msg '+m.role+'">'+esc(m.text)+'</div>'});
```

Replace it with:

```js
coachMsgs.forEach(function(m){h+='<div class="coach-msg '+m.role+'"><div class="coach-sender">'+(m.role==='ai'?'Danni':'You')+'</div>'+esc(m.text)+'</div>'});
```

### 4.4 `Exec-Readiness-app.js`: the opening message

Find (occurs exactly once):

```js
var coachMsgs=[{role:'ai',text:'Welcome to the Executive Readiness module. Ask me about leadership readiness, the OPEN and CARE frameworks, philosophical proficiency, or any step.'}];
```

Replace it with:

```js
var coachMsgs=[{role:'ai',text:'Welcome to Executive Readiness. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.'}];
```

In this copy the Guide is still a placeholder. If your live Guide sets its opening message somewhere else, or draws its messages somewhere else, apply "What changes", items 3 and 4, there instead, and make sure no other opening message remains.

---

## Acceptance

- In all four modules, the button that opens the Guide reads "✦ Ask Danni" (★ in the Innovation Pipeline, as now), and the panel's title reads the same.
- In all four modules, every message in the panel is headed: "Danni" above Danni's replies and the opening message, "You" above the user's own messages. The names look the same in every module.
- The panel opens with the module's ruled message from "What changes", item 4, word for word, with a curly apostrophe in "I’m".
- No panel in any module says the Guide is based on Faisal Hoque's writing.
- `node --check` passes on every changed script, and each module's test suite gives the same results as before.

## Checklist

- [ ] 1 Architecture: button, panel title, names above messages, opening message (1.1 to 1.4)
- [ ] 2 Innovation Pipeline: button, panel title, reply name, opening message (2.1 to 2.4)
- [ ] 3 Governance: button, panel title, reply name, opening message (3.1 to 3.4)
- [ ] 4 Executive Readiness: button, panel title, names above messages, opening message (4.1 to 4.4), including the live Guide's opening message wherever it is set
- [ ] Any "based on Faisal Hoque's writing" line deleted from every live panel
- [ ] `node --check` passes, and every test suite gives the same results as before

## Per-surface checklist

In each of the four modules, signed in with the AI Guide switched on:

- [ ] The button at the bottom right reads "Ask Danni"
- [ ] Opening the panel shows the title "Ask Danni" and the module's opening message, headed "Danni"
- [ ] Asking a question: the question is headed "You" and the answer "Danni", styled the same way in all four modules
- [ ] Nothing in the panel mentions Faisal Hoque's writing
