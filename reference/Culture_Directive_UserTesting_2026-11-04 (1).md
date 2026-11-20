# Culture — directive: user-testing fixes (4 November 2026)
This directive is self-contained. It ports four fixes from Paul's local Culture build into the online codebase. Every change below is the exact shipped text, extracted mechanically from the local build. Replaying all of them on the starting files reproduces the finished files byte for byte.
## 1. Paul's requirements, verbatim
From the user-testing list (4 November 2026):
- "Questionnaire score boxes are too small in 1.2 and 3.3, text isn't visible and longer numbers don't display well"
- "Text alignment issues in 5.4"
- "Ditch any integer entry up/down buttons, as they take up too much space and aren't worth it"
Paul's rulings in chat (4 November 2026):
- On the up/down buttons: "getting rid of them by hiding the up and down buttons in the style sheet is a bad fix. They should be removed. Not just hidden."
- On the refresh issue: "whenever a user clicks, say, the More menu or interacts with certain other functionality on the screen, it makes the page reload. The tester found that that wasn't happening on the home page, the learn page, and most other places where it was happening before, so that's been successfully fixed. It was still happening on the step overview pages" — and, if it is local, "fold that into the directive." It was local, so it is folded in here.
## 2. What was wrong, and what each fix does
**A. The page looked as if it reloaded** (the refresh issue). No browser reload happened. Opening the More menu, switching the theme, or pressing Minimize redrew the whole page through `render()`. That rebuilt any video on the page, which reloaded it, and replayed the page's fade-in animations. The fix has two parts:
- **The More menu:** opening and closing it now repaints only the nav, with `renderNav()`.
- **Repainting the page already showing:** `render()`, and the screen loader that mounts Home and Learn, now keep the page's existing video elements, so playback isn't reset. The page's fade-in elements are shown at once, without the animation. Arriving at a page still plays its fade-ins.
**B. No number fields.** Every `type="number"` field becomes `type="text"` with `inputmode="numeric"`, or `inputmode="decimal"` for scores. The browser then draws no up/down buttons, in any browser. The app already checks every one of these values itself, refusing letters, negatives and fractions with a message, so no protection is lost. The two stylesheet rules that only hid the buttons are removed.
**C. Score boxes that fit their text.** A general rule, `textarea, input[type="text"], input[type="number"], select {padding:12px}`, outranked `.score-mini`. That left 54 px for text in each 80 px box, so the placeholder "1.0 to 5.0" (60 px) was cut off. A more specific rule makes the boxes 88 px wide with 6 px padding, leaving 74 px for text.
**D. Alignment on 5.4.** These changes are needed:
- **Analytical Signals:** each card put its link beside the text, so a long link label squeezed the text into narrow, uneven columns. The link now sits on its own line under the text, and the dot aligns with the text's first line.
- **Team Heatmap and Story Coverage:** priority rows have a dot before the dimension name and other rows had nothing, so names started at two points. Rows without the dot now get an invisible spacer of the same size.
## 3. Preconditions — STOP if any fails
1. The local starting point is Culture build **11-04k**. Its file identities:
   - `Culture-app.js`, md5 `1fb46f51a314…`
   - `Culture-styles.css`, md5 `f5d24097288d…`
   - `Culture-screen-loader.js`, md5 `0fdea60c539b…`

   The online files may differ in unrelated places. That's fine.
2. **Before changing anything,** check that each "Find" text below occurs in your file exactly the number of times stated. If any count is different, **STOP**. Report which change failed and the count you found. Do not adapt the change by guesswork.
3. Apply the changes in the order given, within each file.
## 4. The changes, exact text
### A. The refresh issue
**Change 1** — `Culture-app.js`, in `render`. Find this text. It must occur exactly once.
```text
function render(){
```
Replace it with:
```text
var _culLastPaint='',_culRepaintSame=false; /* the page last painted, so a repaint of it keeps its videos and fade-ins (user testing, 4 Nov 2026) */
function render(){
```
**Change 2** — `Culture-app.js`, in `render`. Find this text. It must occur exactly once.
```text
    if(screenFn){screenFn(app);}

```
Replace it with:
```text
    if(screenFn){screenFn(app);_culLastPaint=currentPage+'||';_culRepaintSame=false;} /* Home and Learn mount through the screen loader, which keeps a remount's videos and fade-ins itself (user testing, 4 Nov 2026) */

```
**Change 3** — `Culture-app.js`, in `render`. Find this text. It must occur exactly once.
```text
Review Map) */ app.innerHTML=h;
    }

```
Replace it with:
```text
Review Map) */ var _culPKey=currentPage+'|'+(currentStep||'')+'|'+((currentPhase&&currentPhase.id)||currentPhase||''),_culSame=(_culPKey===_culLastPaint),_culOldV={}; if(_culSame){Array.prototype.forEach.call(app.querySelectorAll('video'),function(v){var s=v.querySelector('source'),k=s?s.getAttribute('src'):v.getAttribute('src');if(k&&!_culOldV[k])_culOldV[k]=v})} app.innerHTML=h; app.removeAttribute('data-screen'); if(_culSame){Array.prototype.forEach.call(app.querySelectorAll('video'),function(nv){var s=nv.querySelector('source'),k=s?s.getAttribute('src'):nv.getAttribute('src'),ov=k&&_culOldV[k];if(ov&&nv.parentNode){nv.parentNode.replaceChild(ov,nv);delete _culOldV[k]}})} _culRepaintSame=_culSame;_culLastPaint=_culPKey; /* user testing (4 Nov 2026, Paul): a repaint of the page already showing keeps its videos playing and its fade-ins in place, so a click on a menu, the theme, or the sidebar does not look like a reload */
    }

```
**Change 4** — `Culture-app.js`, in `render`. Find this text. It must occur exactly once.
```text
setTimeout(function(){var els=document.querySelectorAll('.reveal');for(var i=0;i<els.length;i++){(function(el,d){setTimeout(function(){el.classList.add('visible')},d)})(els[i],i*60)}},50);
```
Replace it with:
```text
if(_culRepaintSame){var _rapp=$('app');if(_rapp)_rapp.classList.add('cul-still');var _rels=document.querySelectorAll('.reveal');for(var _ri=0;_ri<_rels.length;_ri++)_rels[_ri].classList.add('visible');requestAnimationFrame(function(){requestAnimationFrame(function(){var _ra=$('app');if(_ra)_ra.classList.remove('cul-still')})})}else{setTimeout(function(){var els=document.querySelectorAll('.reveal');for(var i=0;i<els.length;i++){(function(el,d){setTimeout(function(){el.classList.add('visible')},d)})(els[i],i*60)}},50);} _culRepaintSame=false; /* the fade-ins play on arriving at a page, not on a repaint of it */
```
**Change 5** — `Culture-app.js`, in `toggleNavMore`. Find this text. It must occur exactly once.
```text
function toggleNavMore(e){ if(e&&e.stopPropagation)e.stopPropagation(); UI.navMore=!UI.navMore; render(); }
```
Replace it with:
```text
function toggleNavMore(e){ if(e&&e.stopPropagation)e.stopPropagation(); UI.navMore=!UI.navMore; renderNav(); try{updateNotesCount()}catch(_e){} } /* user testing (4 Nov 2026, Paul): opening the More menu repaints the nav only, so the page under it is not redrawn */
```
**Change 6** — `Culture-app.js`, in `closeNavMore`. Find this text. It must occur exactly once.
```text
function closeNavMore(){ if(UI.navMore){ UI.navMore=false; render(); } }
```
Replace it with:
```text
function closeNavMore(){ if(UI.navMore){ UI.navMore=false; renderNav(); try{updateNotesCount()}catch(_e){} } } /* the nav only, as toggleNavMore */
```
**Change 7** — `Culture-screen-loader.js`, in `mount`. Find this text. It must occur exactly once.
```text
      container.innerHTML = '<div class="zoom-wrap" id="zoomWrap"' + zs + '>' + html + '</div>';
      wire(container);
      reveal(container);
```
Replace it with:
```text
      // User testing (4 Nov 2026, Paul): remounting the screen already showing
      // (a click on the theme, for example) keeps its videos playing and its
      // fade-ins in place, so the click does not look like a page reload.
      var same = container.getAttribute('data-screen') === name, oldV = {};
      if (same) container.querySelectorAll('video').forEach(function (v) { var s = v.querySelector('source'), k = s ? s.getAttribute('src') : v.getAttribute('src'); if (k && !oldV[k]) oldV[k] = v; });
      container.innerHTML = '<div class="zoom-wrap" id="zoomWrap"' + zs + '>' + html + '</div>';
      container.setAttribute('data-screen', name);
      if (same) container.querySelectorAll('video').forEach(function (nv) { var s = nv.querySelector('source'), k = s ? s.getAttribute('src') : nv.getAttribute('src'), ov = k && oldV[k]; if (ov && nv.parentNode) { nv.parentNode.replaceChild(ov, nv); delete oldV[k]; } });
      wire(container);
      if (same) {
        container.classList.add('cul-still');
        container.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
        requestAnimationFrame(function () { requestAnimationFrame(function () { container.classList.remove('cul-still'); }); });
      } else reveal(container);
```
### B. No number fields
**Change 8** — `Culture-app.js`, in `inp`. Find this text. It must occur exactly once.
```text
var _t=type||'text';
```
Replace it with:
```text
var _t=type||'text',_im=''; if(_t==='number'){_t='text';_im=' inputmode="numeric"';} /* user testing (4 Nov 2026, Paul): no number fields, so no up/down buttons in any browser; the app checks every number itself */
```
**Change 9** — `Culture-app.js`, in `inp`. Find this text. It must occur exactly once.
```text
'<input type="'+escAttr(_t)+'" id="'+escAttr(
```
Replace it with:
```text
'<input type="'+escAttr(_t)+'"'+_im+' id="'+escAttr(
```
**Change 10** — `Culture-app.js`, in `culCellNum`. Find this text. It must occur exactly once.
```text
return '<input type="'+(sc?'text" inputmode="decimal" autocomplete="off':'number')+'" id="'+escAttr(id)+'" class="score-mini'+(cls?' '+cls:'')+'" data-lock="pulseRounds::'+escAttr(lockKey)+'"'+(sc?'':' step="1" min="0"')+' value="'
```
Replace it with:
```text
return '<input type="text" inputmode="'+(sc?'decimal':'numeric')+'" autocomplete="off" id="'+escAttr(id)+'" class="score-mini'+(cls?' '+cls:'')+'" data-lock="pulseRounds::'+escAttr(lockKey)+'" value="'
```
**Change 11** — `Culture-app.js`, in `culPulseGrid`. Find this text. It must occur exactly once.
```text
<input type="number" id="prgN_
```
Replace it with:
```text
<input type="text" inputmode="numeric" id="prgN_
```
**Change 12** — `Culture-app.js`, in `culTeamRow`. Find this text. It must occur exactly once.
```text
return '<input type="'+type+'" id="tm_'
```
Replace it with:
```text
return '<input type="'+(type==='number'?'text" inputmode="numeric':type)+'" id="tm_'
```
**Change 13** — `Culture-app.js`, in `culCountCell`. Find this text. It must occur exactly once.
```text
'<input type="number" id="'+escAttr(id)+'" class="field-input" style="width:130px" min="0" step="1"'
```
Replace it with:
```text
'<input type="text" inputmode="numeric" id="'+escAttr(id)+'" class="field-input" style="width:130px"'
```
**Change 14** — `Culture-app.js`, in `culCkMeasureEdit`. Find this text. It must occur exactly once.
```text
'<input type="number" min="0" step="1" class="field-input gate-field gate-quiet"
```
Replace it with:
```text
'<input type="text" inputmode="numeric" class="field-input gate-field gate-quiet"
```
**Change 15** — `Culture-styles.css`, in `classes`. Find this text. It must occur exactly once.
```text
input[type=number]{-moz-appearance:textfield;appearance:textfield}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
```
Replace it with:
```text
/* User testing (4 Nov 2026, Paul): the app has no number fields, so the rules that hid their up/down buttons are gone */
```
### C. Score boxes
> **Paul's ruling (4 November 2026):** the respondents boxes have no placeholder, so each one is an empty box. The style rule in Change 20, the last change in this directive, gives every grid box room for its text.
**Change 16** — `Culture-app.js`, in `culPulseGrid`. Find this text. It must occur exactly once.
```text
','Number of people',u.n+' respondents',
```
Replace it with:
```text
','',u.n+' respondents',
```
### D. Alignment on 5.4
**Change 17** — `Culture-app.js`, in `culAnTSignals`. Find this text. It must occur exactly once.
```text
h+='<div class="cul-ansig-i" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid '+s.c+'40;background:'+s.c+'10;border-radius:8px;margin-bottom:8px"><span style="width:8px;height:8px;border-radius:4px;background:'+s.c+';flex-shrink:0"></span><span style="flex:1;font-size:12.5px;color:var(--text-body);line-height:1.4">'+esc(s.t)+'</span>'+(s.a?'<a href="#" onclick="'+s.a+';return false" style="font-family:var(--mono);font-size:12px;color:var(--gold);text-decoration:none;letter-spacing:.1em;white-space:nowrap">'+esc(s.l)+' →</a>':'')+'</div>'
```
Replace it with:
```text
h+='<div class="cul-ansig-i" style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border:1px solid '+s.c+'40;background:'+s.c+'10;border-radius:8px;margin-bottom:8px"><span style="width:8px;height:8px;border-radius:4px;background:'+s.c+';flex-shrink:0;margin-top:5px"></span><span style="flex:1;min-width:0;font-size:12.5px;color:var(--text-body);line-height:1.4">'+esc(s.t)+(s.a?'<a href="#" onclick="'+s.a+';return false" style="display:block;margin-top:6px;font-family:var(--mono);font-size:12px;color:var(--gold);text-decoration:none;letter-spacing:.1em">'+esc(s.l)+' →</a>':'')+'</span></div>' /* user testing (4 Nov 2026, Paul): the link sits on its own line under the text, so the text has the card's full width and every card lines up the same way */
```
**Change 18** — `Culture-app.js`, in `culAnTHeat`. Find this text. It must occur exactly once at this site: the same text also occurs once in the other heatmap-style table, and each occurrence is a separate change.
```text
(isP?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--gold-text);margin-right:6px"></span>':'')+esc(r.name)+'</th>'
```
Replace it with:
```text
(isP?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--gold-text);margin-right:6px"></span>':'<span aria-hidden="true" style="display:inline-block;width:7px;height:7px;margin-right:6px"></span>')+esc(r.name)+'</th>' /* user testing (4 Nov 2026): a row without the priority dot keeps the dot's space, so every name starts at the same point */
```
**Change 19** — `Culture-app.js`, in `culAnTStory`. Find this text. It must occur exactly once at this site: the same text also occurs once in the other heatmap-style table, and each occurrence is a separate change.
```text
(isP?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--gold-text);margin-right:6px"></span>':'')+esc(r.name)+'</th>'
```
Replace it with:
```text
(isP?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--gold-text);margin-right:6px"></span>':'<span aria-hidden="true" style="display:inline-block;width:7px;height:7px;margin-right:6px"></span>')+esc(r.name)+'</th>' /* user testing (4 Nov 2026): a row without the priority dot keeps the dot's space, so every name starts at the same point */
```
### Stylesheet rules appended at the end of the file (parts A and C)
**Change 20** — `Culture-styles.css`, at the very end of the file. **Append** this text:
```text

/* User testing (4 Nov 2026): a repaint of the page already showing sets its fade-ins at once, without the animation */
#app.cul-still .reveal{transition:none!important}

/* User testing (4 Nov 2026, Paul): the questionnaire grid's boxes in 1.2, 3.3 and the Pulse Round page are wide enough for their placeholders and for longer numbers. The general input rule (padding 12px) outranked .score-mini, leaving 54px for text. */
#app input.score-mini{width:88px;padding:6px}

```
**Order note.** In `Culture-app.js`, `culAnTHeat` and `culAnTStory` contain the same "Find" text, once each. Apply each change at its own site. Two occurrences in the file before you start is correct.
## 5. Acceptance criteria — the work is done when all of these hold
1. **More menu:** opening and closing it on any page leaves the page content in place. The `<video>` element on Home, the Framework overview and the phase pages is the same element before and after, and no fade-in replays.
2. **Theme and Minimize:** switching the theme or pressing Minimize on Home, Learn, the Framework overview, any phase page or the Culture Dashboard doesn't rebuild the page's video or replay its fade-ins.
3. **Arrival:** going from one page to another, for example a phase page to Home, still plays the fade-ins on arrival.
4. **No number fields:** no `input[type="number"]` exists on any step tab or the Pulse Round page. In the local build, the walk found 0, with 405 fields carrying `inputmode`.
5. **Validation intact:** typing letters into a number field, such as a team's headcount, is refused. The field returns to its last saved value and the app shows its message, for example "Enter the headcount as a whole number, 1 or more."
6. **No spinner rules:** the stylesheet contains no `spin-button` rule.
7. **Score boxes:** the respondents boxes have no placeholder. In the 1.2 grids, the 3.3 round grid and the Pulse Round page, each grid box is 88 px wide with at least 74 px for text, and the placeholder "1.0 to 5.0" shows in full.
8. **Analytical Signals:** on 5.4, each card's link sits on its own line under the signal text, and every card's text starts at the same horizontal position within its column.
9. **Dimension names:** in Team Heatmap and Story Coverage, every name starts at the same horizontal position, with or without the priority dot.
10. **Suites:** the module's smoke suite and harness pass.
## 6. Per-surface checklist
| Surface | Check | Done |
|---|---|---|
| Home | More menu, theme switch: the video keeps playing and nothing re-animates | ☐ |
| Learn | More menu, theme switch: nothing re-animates | ☐ |
| Framework overview | More menu, theme switch, Minimize: the video keeps playing | ☐ |
| Phase pages 1 to 5 | More menu, theme switch, Minimize: the video keeps playing | ☐ |
| Culture Dashboard | More menu, theme switch, Minimize: nothing re-animates | ☐ |
| Any step page | More menu opens and closes without redrawing the page | ☐ |
| 1.2 Teams (headcount) | Text field, no up/down buttons, letters refused with the message | ☐ |
| 1.2 Leaders' and Employees' grids | Boxes 88 px, "1.0 to 5.0" fully visible, no up/down buttons on the respondents or percentage boxes | ☐ |
| 3.3 Pulse Round grid, and the Pulse Round page | Same as the 1.2 grids | ☐ |
| 1.4 Listening sessions (Number of people) | Text field, no up/down buttons, validation intact | ☐ |
| 2.3 Protections (Days to respond) | Text field, no up/down buttons, validation intact | ☐ |
| 2.6 Charter (Target per quarter) | Text field, no up/down buttons, the target rule still refuses a negative or fractional target | ☐ |
| Practice Counts (counts, and counts per team) | Text field, no up/down buttons, the 0 to 100,000 rule intact | ☐ |
| 5.4 Analytical Signals | The link sits under the text, and the cards line up | ☐ |
| 5.4 Team Heatmap | All dimension names start at one position | ☐ |
| 5.4 Story Coverage | All dimension names start at one position | ☐ |

## 7. Not in this directive
- **The jump when adding an item** (for example "+ Add value" on 1.1). The new item's form opens in an edit box below the whole surface, and the page scrolls to centre it. This awaits Paul's decision on a layout change.
- **The character count under each text box, and the "Add value/commitment/policy" buttons not working.** Neither happens in the local build, so both belong to the deployment list.
