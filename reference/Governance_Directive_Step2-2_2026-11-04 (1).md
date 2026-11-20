# Governance — directive: complete step 2.2 from any tab (4 November 2026)

This directive is self-contained. It fixes one issue in the Governance module.

## 1. Paul's requirement, verbatim

From the user-testing list (4 November 2026): "2.2 can only be completed from the first page, despite having 4 pages."

Paul's ruling (4 November 2026): "Governance 2.2 only, completing from page 1, should work how the other pages with tabs work, so you don't have to return to the first tab to mark the step complete."

## 2. What is wrong

Step 2.2, Ownership & Structure, has four tabs:

- Governance Model
- Incentives & Skills
- Culture
- Stakeholder Feedback

`render22()` returns early for the second, third and fourth tabs:

```text
if(tab==='is')return h+incentivesSkillsBody();
```

Only the first tab, Governance Model, runs on to the end of the function, where the gated "✓ Mark Step 2.2 Complete & Continue →" button is drawn. So once all four tabs are complete, the step can be completed only from the first tab.

Every other Governance step with tabs or sections draws its step button on whichever tab is open. For example, `render11()` puts each section in an `if(sec==='1.1a'){…}` block, then draws the gated step button after all of them.

## 3. Preconditions — STOP if any fails

1. **What this was written against:** the Governance code bundled as the donor copy in Culture's handover, `Governance-app.js`, md5 `a41e381cad99…`. The current online Governance code may differ.
2. **Count each Find text:** in your `Governance-app.js`, each of the two "Find" texts below must occur exactly once. If either count is different, **STOP** and report. If `render22()` has changed shape, apply the same intent:
   - compute the gated step button once, before the tab branches
   - add it after the content of every tab, including the first
3. **Order:** apply Change 1 before Change 2. Change 2 uses the variable that Change 1 introduces.

## 4. The changes, exact text

**Change 1** — in `render22()`, the tab branches. Find this text. It must occur exactly once.

```text
h+='</div>';
if(tab==='is')return h+incentivesSkillsBody();
if(tab==='cul')return h+cultureTabBody();
if(tab==='sk')return h+stakeholderBody();
```

Replace it with:

```text
h+='</div>';
var stepBtn=(['2.2a','2.2b','2.2c','2.2d'].every(function(k){return !!comp[k]}))?doneBtn('completeStepGated(\'2.2\')',false,'\u2713 Mark Step 2.2 Complete & Continue \u2192','2.2'):''; /* user testing (4 Nov 2026, Paul): the step button shows on every tab once all four are complete, as on the other steps with tabs */
if(tab==='is')return h+incentivesSkillsBody()+stepBtn;
if(tab==='cul')return h+cultureTabBody()+stepBtn;
if(tab==='sk')return h+stakeholderBody()+stepBtn;
```

**Change 2** — in `render22()`, the end of the first tab. Find this text. It must occur exactly once.

```text
if(['2.2a','2.2b','2.2c','2.2d'].every(function(k){return !!comp[k]}))h+=doneBtn('completeStepGated(\'2.2\')',false,'\u2713 Mark Step 2.2 Complete & Continue \u2192','2.2');
```

Replace it with:

```text
h+=stepBtn;
```

The tab bodies (`incentivesSkillsBody`, `cultureTabBody` and `stakeholderBody`) and each tab's own section button are unchanged. The step button keeps its label and its condition: all four tabs complete.

## 5. Acceptance criteria — the work is done when all of these hold

1. **All four tabs complete:** "✓ Mark Step 2.2 Complete & Continue →" shows on every tab.
2. **Completing from any tab:** pressing it from any tab, the last tab included, records step 2.2 as complete and moves on to step 2.3.
3. **Any tab incomplete:** the step button shows on no tab.
4. **Nothing else changes:** each tab's own section button, content and completion chip behave as before.
5. **Suites:** the module's smoke suite passes.

**Verified on the donor copy, in Chromium:**

- **Before the change:** the button showed on Governance Model only. From Stakeholder Feedback there was no button.
- **After the change:** the button showed on all four tabs. Pressing it from Stakeholder Feedback recorded step 2.2 complete and moved on to 2.3.
- **With one tab incomplete:** no button on any tab.
- **Smoke suite:** Governance's own suite passed, 971 tests with 0 failures, both before and after.

## 6. Per-surface checklist

| Tab | All four complete: button shows | One tab incomplete: no button | Pressing it completes 2.2 | Done |
|---|---|---|---|---|
| Governance Model | ☐ | ☐ | ☐ | ☐ |
| Incentives & Skills | ☐ | ☐ | ☐ | ☐ |
| Culture | ☐ | ☐ | ☐ | ☐ |
| Stakeholder Feedback | ☐ | ☐ | ☐ | ☐ |
