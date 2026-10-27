#!/usr/bin/env node
/* -------------------------------------------------------------
   port-pipeline-directive.js - carry the 17 Sep 2026 AI Innovation
   Pipeline directive into the LIVE app
   -------------------------------------------------------------
   The directive's 209 steps target the standalone dev build
   (enterprises/dev/innovation-pipeline/app.js); tools/apply-pipeline-
   directive.js applies them there. The Pipeline is the one program
   with no generated module - its live code IS the shell, split across
   js/app.js, js/steps/*, js/pages/*, js/features/*, js/dev/seed.js and
   js/modules/pipeline/*. So the port is the same 209 edits made in
   whichever live file holds each step's anchor.

   That routing is the whole job, and it is mechanical: find the ONE
   live file that declares the anchor at top level, and apply the step's
   own operation there. Where a name is declared in more than one file,
   or in none, ROUTE says which file and why - never a guess.

   Three things this must not do, each of which reads as working code:
     - apply a Replace over a live body that carries a ruling of ours
       the directive's line never had. MERGES holds those, with the
       reason; every `find` must match exactly once or the run stops.
     - leave a name the directive's code calls declared nowhere. The
       undeclared scan is baseline-relative, per file and then whole-app.
     - shadow a name another program owns. The shell is shared: a new
       top-level name in js/app.js is visible to all six programs.

   Usage:
     node tools/port-pipeline-directive.js            # the plan, and what does not route
     node tools/port-pipeline-directive.js --losses   # what the Replace steps overwrite live
     node tools/port-pipeline-directive.js --emit     # write the files
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md');
const N_STEPS = 209;

const EMIT = process.argv.includes('--emit');
const LOSSES = process.argv.includes('--losses');
const PLAN = process.argv.includes('--plan');

/* The Pipeline's live files, in shell.html's load order. Order matters
   twice over: a name must be declared before the file that reads it at
   load time, and a step appended to the wrong file can land after its
   reader. */
const FILES = [
  'js/modules/pipeline/module.js',
  'js/modules/pipeline/help.js',
  'js/router.js',
  'js/nav.js',
  'js/features/help.js',
  'js/features/sidebar.js',
  'js/features/budget.js',
  'js/features/charts.js',
  'js/steps/phase1.js',
  'js/steps/phase2.js',
  'js/steps/phase3.js',
  'js/steps/phase4.js',
  'js/pages/navigate.js',
  'js/dev/seed.js',
  'js/app.js',
  'js/features/collab-notices.js',  /* LIVE_EDITS only - no step anchors here */
  'shell.html',                     /* ditto: the script tag for the new page */
  'assets/css/styles.css'           /* ditto: section 5 */
];

/* Where a step goes when the anchor cannot decide it: the name is
   declared in no live file, in more than one, or the live app keeps it
   somewhere the dev build does not. Each entry says which file and why. */
const ROUTE = {
  /* The live app already had a printCapHub (js/pages/navigate.js, printing
     the live page); step 153 adds the directive's, which prints the composed
     document. SUPERSEDE removes the old one first, so this and every step
     that chains off it resolve to the one in js/app.js. */
  154: 'js/app.js',

  /* The Report Manager - steps 160 to 203 - is a page of its own and gets a
     file of its own, js/pages/reports.js, beside js/pages/navigate.js, rather
     than another thousand lines in the shared shell. Only the FIRST of the
     chain needs placing: every step after it anchors on the name the step
     before declared, so they follow it into the file.

     It is here rather than chained off sidebarPageShown because that step
     (159) is skipped - the live app keeps that list in SIDEBAR_PAGES. */
  160: { file: 'js/pages/reports.js', atEnd: true },

  /* Steps 203-207 register the remaining documents in PRINT_DOCS. They are
     TOP-LEVEL ASSIGNMENTS, executed when the file loads - and their anchors
     chain off rcEditor, which would carry them into js/pages/reports.js.
     That file is loaded BEFORE js/app.js, where PRINT_DOCS is declared, so
     the page threw `PRINT_DOCS is not defined` on load and the Report
     Manager was a page that never defined itself. Registered where the
     table lives instead, next to the registration step 136 already made.
     Only the first needs placing; 204-207 anchor on the line before. */
  203: {
    file: 'js/app.js',
    anchor: { kind: 'line', name: "PRINT_DOCS['out-devport']=PRINT_DOCS['out-expbriefs']; /* the development portfolio's second id */" }
  }
};

/* A file the port creates. Its header is the only thing written by hand;
   everything else in it arrives as steps 160-203. */
const NEW_FILES = {
  'js/pages/reports.js':
    '/* ─────────────────────────────────────────────────────\n' +
    '   pages/reports.js — the Report Manager\n' +
    '   ─────────────────────────────────────────────────────\n' +
    '   Where the user assembles several outputs and Phase 5 pages into one\n' +
    '   printed report: a cover, a contents page, an introduction, then each\n' +
    '   chosen item as a numbered section. A report is a named definition on\n' +
    '   the organization (data.reportDefs) holding an ordered list of units\n' +
    '   — an output, a Phase 5 page, a single idea, or a text page the user\n' +
    '   writes — with a Summary / Full depth where the unit offers one and a\n' +
    '   note per section. Nothing here edits the record it prints.\n\n' +
    '   Family code: the same page exists in Responsible AI Governance and in\n' +
    '   Executive Readiness. It arrived here from\n' +
    '   reference/Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md,\n' +
    '   steps 160–203, applied by tools/port-pipeline-directive.js — which is\n' +
    '   where any change to it belongs, not in this file.\n\n' +
    '   Its page id is `reports`: routed by render() (js/app.js), kept in the\n' +
    '   sidebar by SIDEBAR_PAGES (js/features/sidebar.js), and reached from the\n' +
    '   More menu through the module\'s own moreItems (js/modules/pipeline/module.js).\n' +
    '   ───────────────────────────────────────────────── */\n'
};

/* Live declarations the directive supersedes: removed just before the step
   that brings in its replacement, so the name is declared exactly once.
   Each entry says what the live one did and which step replaces it. */
const SUPERSEDE = [{
  atStep: 153, name: 'printCapHub', file: 'js/pages/navigate.js',
  why: "printed the live hub page through printPage; step 153's prints the Capital Planning Hub document"
}];

/* Steps the live app already carries, family-wide, from the Governance and
   Executive Readiness directives. Porting them would declare a second copy
   of a name the shell already owns - and in each case the live version is
   the one to keep. Each says why, and what (if anything) was adjusted live
   instead; LIVE_EDITS below holds those adjustments. */
const SKIP = {
  2: 'PH is the module\'s declaration (js/modules/pipeline/module.js), not page code - and it carries icons and a step name this build chose. Ignite\'s third output is renamed there: see LIVE_EDITS',
  22: 'printThemeTokens already carries --gold-rgb, the one token this step adds, and this build\'s ground '
    + 'is its own (--ink #EAEEF4) - so taking the directive\'s block would change the colour of every '
    + 'printed document to another build\'s. It stops being dead code at step 30: printDocument() calls it, '
    + 'and what it returns is then the ONLY stylesheet the export gets. POST_EDITS corrects its comment',
  12: "renderMgmtHub already delegates to mgmtHubContent(pdfBtn('printMgmtAnalytics()')) - the directive's only change here is the button's words, which the live button already has",
  14: "renderCapHub already delegates to capHubContent(false, pdfBtn('printCapHub()')) - same reason; `all`/`pdf` are how the live hub separates screen from paper",
  59: "renderSidebar's two changes here are both live already: showSidebar reads sidebarShowsHere() "
    + '(the SIDEBAR_PAGES list), and the Outputs fold is in place with the same markup, the same title '
    + 'attribute and the same count in its own span. The live body is also much more than the '
    + "directive's - the per-program wordmark and Modules.stepStrands - so replacing it would take "
    + 'the shell back to one program',
  62: 'renderModal is the shell\'s chrome (js/features/help.js); the three strings this step rewrites are '
    + 'help TEXT, and all three already read "▾ Save as PDF" - js/features/help.js:55 and :70, '
    + 'js/modules/pipeline/help.js:106 and :113',
  61: 'updateSidebarState reads sidebarShowsHere()/SIDEBAR_PAGES in js/features/sidebar.js - the family list, written once and read from both places',
  159: 'sidebarPageShown IS that SIDEBAR_PAGES list; the ids it adds are put there instead',
  208: "toggleNavOutputs is live already and keeps the sidebar's scroll position, which the directive's copy does not",
  209: 'navOutputsOpen is live already and identical in behaviour',
  44: 'raciCols already lifted the cap of four: the matrix holds the owner plus RACI_MAX_PEOPLE (8), '
    + 'and the limit is enforced at the input by raciAtCap() disabling the add button, rather than truncating '
    + 'the matrix silently. Same defect, fixed earlier and with an affordance'
};

/* -- Edits no step can express ------------------------------------
   The Pipeline runs on the shared shell, so three of this directive's
   changes belong to a seam rather than to a page: PH and the More menu
   are the module's declaration, the sidebar's page list is the family's,
   and a new workspace container needs a name in the collaboration
   notices or the harness's LABELS check fails. Each is anchored and must
   match exactly once. The step that would otherwise have made the change
   is listed in SKIP, naming this. */
const LIVE_EDITS = [
  {
    file: 'js/modules/pipeline/module.js', forStep: 2,
    what: "Ignite's third output is the Portfolio Review",
    find: "{ id: 'out-finalport', name: 'Updated Dev Portfolio', icon: '↗' }",
    replace: "{ id: 'out-finalport', name: 'Portfolio Review', icon: '↗' } /* 17 Sep 2026 (Paul's ruling): Ignite's third output is the review distilled from Step 4.4, not a second Development Portfolio */"
  },
  {
    file: 'js/modules/pipeline/module.js', forStep: 177,
    /* "Every key the program ever writes starts here, so a fresh
       organization and a restored export have the same shape and no
       screen has to guard against a missing collection" - this file's
       own contract. rcDefs() does guard, but an undeclared container is
       also absent from an export and unnamed in the collaboration
       notices. Governance declares it the same way. */
    what: "the Report Manager's saved reports are part of the workspace shape",
    find: "        assigns: {}, roster: null, enterprise: {}, members: [], orgSetup: false",
    replace: "        assigns: {}, roster: null, enterprise: {}, members: [], orgSetup: false,\n"
      + "        reportDefs: [] /* 17 Sep 2026: the Report Manager's saved reports */"
  },
  {
    file: 'js/modules/pipeline/module.js', forStep: 3,
    what: "the Report Manager's door in the More menu (js/nav.js asks Modules.moreItems())",
    /* The entry MUST carry `run`. js/modules/registry.js drops any item
       without one — `list.filter(s => s && s.id && typeof s.run === 'function')`
       — so a malformed entry does not error, it just never appears, and
       the page is left reachable only by typing its id. That is how this
       shipped on 18 Sep with no door and nothing in the console.
       Same shape as Executive Readiness's and Governance's. */
    find: "    // Empty: the shell's built-in route table still renders every Pipeline page.\n    pages: {}",
    replace: "    /* Actions only this program has. js/nav.js draws them from\n"
      + "       Modules.moreItems(); the page itself is routed by render().\n"
      + "       `run` is required — the registry filters out an item without one. */\n"
      + "    moreItems: [\n"
      + "      { id: 'reports', icon: '☷', label: 'Report Manager', run: function () { go('reports'); } } /* 17 Sep 2026: the Report Manager's door */\n"
      + "    ],\n\n"
      + "    // Empty: the shell's built-in route table still renders every Pipeline page.\n    pages: {}"
  },
  {
    file: 'js/features/sidebar.js', forStep: 159,
    what: "the Quarterly Review page keeps the sidebar (SIDEBAR_PAGES, read by renderSidebar and updateSidebarState alike)",
    find: "var SIDEBAR_PAGES = ['step', 'phase', 'phase5', 'outcome', 'pipeline', 'cap-hub',\n  'portfolio', 'system', 'ethicsov', 'govreview', 'reports'];",
    replace: "var SIDEBAR_PAGES = ['step', 'phase', 'phase5', 'outcome', 'pipeline', 'cap-hub',\n  'portfolio', 'system', 'ethicsov', 'govreview', 'reports', 'review'];\n"
      + "/* 'review' is the Pipeline's Quarterly Review page (17 Sep 2026); 'portfolio' is\n"
      + "   already here for Governance and now carries the Pipeline's live portfolio pages\n"
      + "   too - the id is the same and both want the rail. */"
  },
  /* -- Section 5, against the live stylesheet ---------------------
     assets/css/styles.css is pretty-printed and its @media print block is
     a long way past the dev build's, so none of the four anchors match as
     written and two of the changes are already there. What each one
     becomes here:

       Change 1 (.btn.bg2 sizing) is NOT applied. It exists so the
         directive's inline <button class="btn bg2"> looks like the
         family's control; this app emits that control from pdfBtn(), and
         .pdf-btn already carries exactly those values - "it stays its own
         class rather than being inlined as a btn/bg2 pair because the two
         rules under it are what stop the button wrapping". Adding the rule
         would instead resize every OTHER bg2 button in all six programs.

       Change 2 is already in the print block, and further: the control
         list, the appearance reset on select, the border reset on textarea
         AND input, and print-color-adjust on *. The one thing missing is
         .bg, which is a real class here (styles.css:3312) and would print.

       Change 3 IS added. The live app solves the same wrap with named
         classes on the two children (.pdf-hd / .pdf-btn-dock, whose comment
         is this change's reasoning a year early); the generic rule covers
         the rows that do not use them.

       Change 4 IS added. The Report Manager needs it and the copy in
         assets/css/modules/exec-readiness.css loads only for that program. */
  {
    file: 'assets/css/styles.css', forStep: '5.2',
    what: 'Change 2: .bg joins the controls that do not print',
    find: '  .bg2,\n  .bd,\n  .viz-legend-toggle {\n    display: none !important\n  }',
    replace: '  .bg,\n  .bg2,\n  .bd,\n  .viz-legend-toggle {\n    display: none !important\n  }'
  },
  {
    file: 'assets/css/styles.css', forStep: '5.3',
    what: 'Change 3: the title wraps in its own column so the control keeps the title line',
    find: '.flx-between-top-mb {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  margin-bottom: 24px;\n  flex-wrap: wrap;\n  gap: 12px\n}',
    replace: '.flx-between-top-mb {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  margin-bottom: 24px;\n  flex-wrap: wrap;\n  gap: 12px\n}\n\n'
      + '/* 13 Sep 2026 (Paul): the heading text wraps in its own column so the Save as\n'
      + '   PDF control sits on the title line, right-justified, instead of dropping\n'
      + '   below. Same reasoning as .pdf-hd / .pdf-btn-dock above, for the rows that\n'
      + '   do not name those classes. */\n'
      + '.flx-between-top-mb>:first-child {\n  flex: 1 1 0;\n  min-width: 0\n}\n\n'
      + '.flx-between-top-mb>:last-child {\n  flex-shrink: 0\n}',
  },
  {
    file: 'assets/css/styles.css', forStep: '5.4',
    what: "Change 4: the Report Manager's wider block, and its own dressing",
    /* 21 Sep 2026, the operator's ruling, revised the same day. It was
       briefly put into the app's shared 900px column so that it lined up
       with every other page - but with real content in it the sections
       being assembled do not fit: an "Output - Culture 21/30 - SUMMARY"
       row plus its reorder controls needs more than the 428px that column
       leaves. So the directive's Change 4 stands after all, and this page
       is the one deliberate exception to the shared column.

       What is kept from that round is the DRESSING below - the two columns
       as the app's cards, its heading sizes, its row rhythm - which is
       what "according to all sections" was really asking for. The width
       was never the part that made it look foreign. */
    find: '.main-content .content-inner {\n  margin-left: max(0px, calc(50vw - var(--sbw) - 450px));\n  margin-right: auto;\n  transition: margin-left .25s cubic-bezier(.16, 1, .3, 1)\n}',
    replace: '.main-content .content-inner {\n  margin-left: max(0px, calc(50vw - var(--sbw) - 450px));\n  margin-right: auto;\n  transition: margin-left .25s cubic-bezier(.16, 1, .3, 1)\n}\n\n'
      + "/* 16 Sep 2026 (Paul's ruling, family): the Report Manager's 1350px block centres\n"
      + '   on the page when the sidebar is closed; the shared formula above is written\n'
      + '   for the 900px column. */\n'
      + '.content-inner.rc-page {\n  max-width: 1350px;\n  margin-left: max(0px, calc(50vw - var(--sbw) - 675px))\n}\n\n'
      + '/* ─── THE REPORT MANAGER, IN THIS APP\'S LANGUAGE ──────────────────\n'
      + '   21 Sep 2026: the page came from the Governance/Executive Readiness line\n'
      + '   drawing its own boxes inline, so it read as a different application —\n'
      + '   one panel around everything, 14px headings where every other page uses\n'
      + '   .h-sub-md, and rows at a 6px pitch against the app\'s 8px .row-line.\n'
      + '   Its markup carries three hooks (.rc-cols, .rc-row, and the .h-sub-md\n'
      + '   headings); the dressing is here, so the page follows the same tokens as\n'
      + '   every card in the app and moves with them. Values are .cd\'s and\n'
      + '   .row-line\'s, not new ones. */\n'
      + '.rc-page .rc-cols>* {\n'
      + '  background: var(--bg-card);\n'
      + '  border: 1px solid var(--border-softer);\n'
      + '  padding: 24px;\n'
      + '  min-width: 0\n'
      + '}\n\n'
      + '/* The rows are the app\'s row rhythm: 8px and one hairline, not 6px and a\n'
      + '   tighter one. The border is set inline on the row, so it is answered here. */\n'
      + '.rc-page .rc-row {\n'
      + '  padding: 8px 0 !important;\n'
      + '  border-top: 0 !important;\n'
      + '  border-bottom: 1px solid var(--border-softer)\n'
      + '}\n\n'
      + '.rc-page .rc-row:last-child {\n  border-bottom: 0\n}\n\n'
      + '/* Below the width where the shared column itself starts shrinking, two cards\n'
      + '   side by side is two cramped cards. Stack them instead: the options are then\n'
      + '   read under the sections they are being added to, which is the same order. */\n'
      + '@media (max-width: 1080px) {\n'
      + '  .rc-page .rc-cols {\n    grid-template-columns: minmax(0, 1fr) !important\n  }\n}'
  },
  {
    file: 'shell.html', forStep: 202,
    what: 'the Report Manager page is a file, so the shell has to load it',
    find: '  <script src="js/pages/navigate.js"></script>',
    replace: '  <script src="js/pages/navigate.js"></script>\n  <script src="js/pages/reports.js"></script>'
  },
  {
    file: 'js/features/collab-notices.js', forStep: 177,
    what: 'the saved reports are a workspace container and need a name here',
    find: "  raci: 'RACI', enterprise: 'Organization details', roster: 'Team', notes: 'Notes',",
    replace: "  raci: 'RACI', enterprise: 'Organization details', roster: 'Team', notes: 'Notes',\n"
      + "  reportDefs: 'Saved reports',"
  }
];

/* -- Edits to what the steps just wrote ----------------------------
   Applied after the step loop, anchored on the ported code itself. */
const POST_EDITS = [
  {
    file: 'js/app.js',
    what: 'the print window declares its encoding',
    /* The popup renders today only because a window.open('') inherits the
       opener's encoding. Save the document and reopen it and every ·, —
       and ✓ in it is mojibake. The same omission is on record in the
       Governance build, where it was found exactly that way. */
    find: "w.document.write('<html><head><title>'+title+'</title>'+",
    replace: "w.document.write('<html><head><meta charset=\"utf-8\"><title>'+title+'</title>'+"
  },
  /* -- The Report Manager in the app's own design language ---------
     21 Sep 2026, the operator's ruling: "UI must be according to all
     sections". The page arrived as family code that draws its own boxes
     inline - 23 `class=` against 91 `style=`, where the Pipeline's own
     pages run about 150 against 100 - so it reads as a different app:
     one giant card instead of grouped panels, 14px bold <h4>s where
     every other page uses .h-sub-md at 17px, and a 6px row pitch where
     the app's .row-line is 8px with a divider.

     Four markup hooks here, then one scoped block in styles.css does the
     dressing. Hooks rather than a rewrite because this function is 12KB
     of generated markup shared in shape with two other programs: adding
     a class is safe to re-run and easy to read against the reference. */
  {
    file: 'js/pages/reports.js',
    what: 'the two columns can be dressed as cards',
    /* 420px on the 1350px block leaves about 890 for the sections being
       assembled, which is the side holding a name, a size, a depth and
       four reorder controls on one line. Under a narrow window the
       stylesheet stacks the two rather than squeezing both. */
    find: '<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start">',
    replace: '<div class="rc-cols" style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:20px;align-items:start">'
  },
  {
    file: 'js/pages/reports.js',
    what: "the Sections column's heading is the app's card heading",
    find: '<h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Sections, in order</h4>',
    replace: '<h3 class="h-sub-md">Sections, in order</h3>'
  },
  {
    file: 'js/pages/reports.js',
    what: "the Options column's heading likewise",
    find: '<h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Report Content Options</h4>',
    replace: '<h3 class="h-sub-md">Report Content Options</h3>'
  },
  {
    file: 'js/pages/reports.js',
    what: 'a catalogue row can take the app\'s row rhythm',
    find: "return '<div style=\"display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px\">",
    replace: "return '<div class=\"rc-row\" style=\"display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px\">"
  },
  {
    file: 'js/app.js',
    what: 'the print window prints ITSELF, so the app is not frozen behind its dialog',
    /* `window.print()` suspends the script that CALLS it until the print
       dialog is dismissed. The directive calls it on the popup from a
       timer in the OPENER - so the dialog appears over the print window
       and the app behind it stops dead, with no dialog of its own to
       explain why. Reported 18 Sep 2026: "it preview pdf completely but
       main app hangs up".

       Before this document the export printed the LIVE document, so the
       dialog was over the app and a frozen app was simply the dialog
       being open. Moving the document into a second window is what turns
       the same block into a hang.

       So the printing is done BY the document: a script written into it
       calls print() in its own context, and the opener's stack returns as
       soon as the window is written. It also waits for `load` rather than
       the directive's fixed 500ms, which is a guess that cuts a slow
       webfont or image out of the first layout.

       Exec Readiness and Responsible AI Governance carry the same line in
       their own printDocument and have the same behaviour; this changes
       the Pipeline's only. */
    /* Written INSIDE the body, before </body>, not after </html>: a
       script after the document has been closed off is parsed into an
       implied body and runs, but only because browsers are forgiving,
       and the forgiving path is not the one to depend on for the thing
       that makes the button work. */
    find: "printFooterText()+'</div></body></html>');\nw.document.close();if(!(opts&&opts.preview))setTimeout(function(){w.print()},500)}",
    replace: "printFooterText()+'</div>'"
      + "+((opts&&opts.preview)?'':'<scr'+'ipt>(function(){function p(){try{window.print()}catch(e){}}"
      + "if(document.readyState===\"complete\"){setTimeout(p,60)}"
      + "else{window.addEventListener(\"load\",function(){setTimeout(p,60)})}})();<\\/scr'+'ipt>')"
      + "+'</body></html>');\n"
      + "w.document.close()} /* 18 Sep 2026: the document prints ITSELF. print() suspends the script that calls it, so calling it on the popup from a timer in the opener left the app frozen behind a dialog it did not own. Waiting for load also beats the fixed 500ms, which cuts a slow webfont out of the first layout */"
  },
  {
    file: 'js/app.js',
    what: 'the RACI matrix prints PORTRAIT, on the same page and margins as every other document',
    /* 18 Sep 2026, the operator's ruling, and it overrides the directive:
       step 147 and acceptance check 5 both ask for the matrix "centred on
       a sideways page". It is now portrait like everything else, on the
       document's own @page margins, so a printed report does not turn a
       page on its side half way through.

       What has to change with it: the matrix was given a fixed 990px
       because it had a landscape page to spend. A portrait page's content
       box is about 688px on A4 and 710px on Letter, so the width becomes
       100% and the table is laid out with table-layout:fixed - otherwise
       the browser sizes the columns to the longest NAME and the table
       runs off the right edge, which prints as a silently cropped matrix
       rather than as an error. The name headers wrap instead, and the
       chips and padding come down to keep the rows from growing as they
       do. No named page, so no orientation change and no blank page.

       Measured with Page.printToPDF over the real document: every page
       portrait, and the table's width within the page's content box. */
    /* The padding and letter-spacing are written as INLINE styles by the
       function above, so a plain rule here loses to them - hence the few
       !importants. They are the only way to reach those declarations
       without rewriting the markup builder, and each one is doing exactly
       one job: making a column narrow enough to fit the page. */
    find: "'<style>.raci-land{page:raciland;break-before:page;page-break-before:always;width:990px;margin-left:0;display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 15vh)}@page raciland{size:landscape;margin:8mm 8mm 14mm 8mm}@media print and (max-width:800px){.raci-land{width:1058px}}</style>",
    replace: "'<style>.raci-land{break-before:page;page-break-before:always;width:100%;margin-left:0}"
      + ".raci-land table{table-layout:fixed}"
      + ".raci-land th{white-space:normal;word-break:break-word;letter-spacing:.03em!important;padding:8px 3px!important}"
      + ".raci-land th:first-child{width:23%}"
      + ".raci-land td{padding:7px 3px!important}"
      + "</style>"
  },
  {
    file: 'js/app.js',
    what: 'printThemeTokens is called again, and its comment said it never was',
    find: '  // NOTHING IN THE SHELL CALLS THIS ANY MORE. The export stopped opening a bare\n'
      + '  // window (see printPage below), so the tokens it needs are the stylesheet\'s,\n'
      + '  // declared once in the @media print block of assets/css/styles.css — which is\n'
      + '  // the set to edit. This is kept because the standalone review builds under\n'
      + '  // <role>/dev/ still print through a window of their own and call it, and\n'
      + '  // because tools/port-exec-readiness.js lists it as deliberately left with the\n'
      + '  // shell rather than lifted into a module.\n',
    replace: '  // THIS IS THE ONLY STYLESHEET THE EXPORT GETS (17 Sep 2026). printDocument()\n'
      + '  // opens a bare window and writes a self-contained page into it, so nothing in\n'
      + '  // assets/css reaches the document — whatever this returns is all it has. The\n'
      + '  // @media print block of assets/css/styles.css still dresses a plain ⌘P of the\n'
      + '  // page on screen, so BOTH have to be kept in step, and the values here must\n'
      + '  // agree with the ones there.\n'
      + '  //\n'
      + '  // For the months between, the export printed the live document instead and\n'
      + '  // nothing called this; it was kept then for the standalone review builds under\n'
      + '  // <role>/dev/, which print through a window of their own, and because\n'
      + '  // tools/port-exec-readiness.js lists it as deliberately left with the shell\n'
      + '  // rather than lifted into a module. Both are still true.\n'
  }
];

/* -- The live app's spelling, applied to EVERY step's code ---------
   Two rulings the live app made before this directive and the directive's
   line never had. They are mechanical, they appear in a dozen blocks, and
   writing them out per step is how one gets missed.

   1. The Save as PDF button. The directive writes it inline, twice over -
      a literal <button class="btn bg2" style="font-size:12px"> and a
      btn(...,'bg2','font-size:12px') call. The live app emits the SAME
      button from one helper, pdfBtn() in js/app.js, whose .pdf-btn rule
      is documented as ".bg2's ground, ink and border at 12px, with the
      compact padding and 6px radius the shared rule gives it" - it IS
      this button, as a named class, and .pdf-hd/.pdf-btn-dock beside it
      are section 5's Change 3 solved a year earlier and by name. So every
      site is rewritten to pdfBtn(), and section 5's Change 1 still lands
      for anything that does spell it .btn.bg2.

   2. UI.expanded[k] read for display becomes xOpen(k) - PRINT_EXPAND ||
      UI.expanded[k] - so a card that is closed on screen still opens for
      the export. Only READS are rewritten; the writes (the toggles in the
      onclick handlers) stay exactly as they are.

   COUNT is asserted at the end of the run: a spelling that stops matching,
   or a new site, is a stop, not a silent pass-through. */
const LIVE_SPELLINGS = [
  {
    what: 'the literal Save as PDF button -> pdfBtn()',
    find: /'<button class="btn bg2" style="font-size:12px" onclick="([A-Za-z_$][\w$]*\(\))">\\u25be Save as PDF<\/button>'/g,
    to: (m, fn) => "pdfBtn('" + fn + "')",
    count: 5
  },
  {
    what: "btn('\\u25BE Save as PDF', ...) -> pdfBtn()",
    find: /btn\('\\u25BE Save as PDF','([A-Za-z_$][\w$]*\(\))','bg2','font-size:12px'\)/g,
    to: (m, fn) => "pdfBtn('" + fn + "')",
    count: 4
  },
  {
    what: "the same, with a top margin -> pdfBtn() in a spaced box",
    find: /btn\('\\u25BE Save as PDF','([A-Za-z_$][\w$]*\(\))','bg2','font-size:12px;margin-top:8px'\)/g,
    to: (m, fn) => "'<div style=\"margin-top:8px\">'+pdfBtn('" + fn + "')+'</div>'",
    count: 2
  },
  {
    /* The nine keys the live app reads through xOpen, named rather than
       pattern-matched: `!!UI.expanded[k]` appears elsewhere in these blocks
       (allocCore's fpA / acSwim / acRef) where the live app deliberately
       does NOT force the card open for the export, and a broad pattern
       would quietly change those too. The keys here are exactly the live
       call sites - `grep -o "xOpen([^)]*)" js/`. */
    what: 'the nine display reads the live app takes through xOpen()',
    find: /!!UI\.expanded\['(bs|bsf|oe|oo|ox|pcoe|pcoo|xcoo)'\+([\w.$]+)\]/g,
    to: (m, k, i) => "xOpen('" + k + "'+" + i + ")",
    count: 5
  },
  {
    /* Each of these three keys is read TWICE on its row: once to choose the
       caret glyph and once to decide whether the card's content is drawn.
       Only the second is rewritten - the caret reports what is open ON
       SCREEN, and forcing it to ▾ in an export where the reader cannot
       click anything would be a lie about the page. The live app draws the
       same distinction; the negative lookahead is what keeps it. */
    what: 'the same, where the block writes the read as a ternary (the content test, not the caret)',
    find: /\(UI\.expanded\['(pcoe|pcoo|xcoo)'\+([\w.$]+)\]\?(?!'\\u25be')/g,
    to: (m, k, i) => "(xOpen('" + k + "'+" + i + ")?",
    count: 3
  },
  {
    what: 'and the fold on the Blue Sky page, whose key is a property not an index',
    find: /!!UI\.expanded\.bsFold/g,
    to: () => "xOpen('bsFold')",
    count: 1
  }
];

/* Replace steps whose live body carries a ruling of ours. Same shape as
   the dev tool's: 'ours' keeps the live body and applies the directive's
   delta to it, 'theirs' takes the directive's block (after LIVE_SPELLINGS)
   and puts our rulings back. Every `find` must match exactly once. */

/* Five output pages dock their control in the title row rather than on a
   line of its own: the live .pdf-hd / .pdf-btn-dock pair, which is what
   section 5's Change 3 asks for and what acceptance check §5 describes -
   "sitting on the title line at the right". The directive's own
   outputPrintRow() still draws the control (Summary / Full, then the
   button); it is only moved into the row. One edit each. */
function dock(what, lead, row) {
  return {
    what: what + ": the print control docks in the title row (.pdf-hd), as it does live",
    find: "var h='<h2" + lead + "</p>';\nh+=outputPrintRow(" + row + "); /* 16 Sep 2026: the print control */",
    replace: "var h='<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\"><h2" + lead +
      "</p></div>'+outputPrintRow(" + row + ")+'</div>';"
  };
}

const MERGES = {
  /* render() is the shell's, and far more than the directive's line: the
     signed-out gate, the launchpad, the record-lock repaint, the field
     capture. Its real change here is three routes. The Report Manager's
     door in the More menu is NOT here - js/nav.js asks
     Modules.moreItems(), so it is declared in module.js (LIVE_EDITS). */
  3: [{
    base: 'ours',
    what: 'the three new pages: the Report Manager, the Quarterly Review, a live portfolio',
    find: "    else if (currentPage === 'mgmt-hub') h = renderMgmtHub();\n",
    replace: "    else if (currentPage === 'reports') h = renderReports(); /* 16 Sep 2026: the Report Manager page */\n"
      + "    else if (currentPage === 'review') h = renderReviewPage(); /* 17 Sep 2026: the Quarterly Review page */\n"
      + "    else if (currentPage === 'portfolio') h = renderPortfolioPage(); /* 17 Sep 2026: a live portfolio page */\n"
      + "    else if (currentPage === 'mgmt-hub') h = renderMgmtHub();\n"
  }],

  16: [{
    what: 'the Assessment Report keeps its live .pdf-hd dock around the new Summary / Full control',
    find: "return'<div class=\"flx-row-mb-20\"><div><h2 class=\"h-section\">Assessment Report</h2><p class=\"t-fade-fs13\">From your Assessment Battery</p></div>'+'<div style=\"display:flex;align-items:center;gap:10px\">'+lyDepthCtl()+pdfBtn('printReport()')+'</div></div>'+",
    replace: "return'<div class=\"flx-row-mb-20\"><div class=\"pdf-hd\"><h2 class=\"h-section\">Assessment Report</h2><p class=\"t-fade-fs13\">From your Assessment Battery</p></div>'+'<div class=\"pdf-btn-dock\" style=\"display:flex;align-items:center;gap:10px\">'+lyDepthCtl()+pdfBtn('printReport()')+'</div></div>'+"
  }],

  17: [{
    what: 'the Blue Sky Portfolio docks its control in the title row',
    find: "var h='<h2 class=\"h-section\">Blue Sky Portfolio</h2><p class=\"t-lead\">Ideas ranked by Filter &amp; Rank score. Expand a card to qualify, score, and select ideas for Exploration.</p>'+pipeViz('bluesky');\nh+=outputPrintRow('out-bluesky'); /* 16 Sep 2026: the print control */",
    replace: "var h='<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\"><h2 class=\"h-section\">Blue Sky Portfolio</h2><p class=\"t-lead\">Ideas ranked by Filter &amp; Rank score. Expand a card to qualify, score, and select ideas for Exploration.</p></div>'+outputPrintRow('out-bluesky')+'</div>'+pipeViz('bluesky');"
  }],

  18: [{
    what: 'Org Readiness keeps its live .pdf-hd dock',
    find: "var h='<div class=\"flx-row-mb-20\"><div><h2 class=\"h-section\">Org Readiness Summary</h2>",
    replace: "var h='<div class=\"flx-row-mb-20\"><div class=\"pdf-hd\"><h2 class=\"h-section\">Org Readiness Summary</h2>"
  }],

  19: [{
    what: 'the Governance Framework keeps its live .pdf-hd dock',
    find: "var h='<div class=\"flx-between-top-mb\"><div>'+badge('Phase 4 Output','#9B2D3F')",
    replace: "var h='<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\">'+badge('Phase 4 Output','#9B2D3F')"
  }],

  20: [{
    what: 'the Org Design Review keeps the Phase 4 Output badge and the .pdf-hd dock this build gave it',
    find: "return'<h2 class=\"h-section-loose\">Organizational Design Review</h2>'+outputPrintRow('out-orgrev')+'<div class=\"gr-2-mb-5\">'+",
    replace: "return'<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\">'+badge('Phase 4 Output','#9B2D3F')+'<h2 class=\"h-section-loose\">Organizational Design Review</h2></div>'+outputPrintRow('out-orgrev')+'</div>'+'<div class=\"gr-2-mb-5\">'+"
  }],

  21: [{
    what: 'the Capital Snapshot keeps its live .pdf-hd dock',
    find: "var h='<div class=\"flx-between-top-mb\"><div>'+badge('Phase 3 Output',",
    replace: "var h='<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\">'+badge('Phase 3 Output',"
  }],

  /* printThemeTokens is dead in the shell - the live export prints the
     document rather than opening a bare window, so these tokens are the
     stylesheet's. It is kept because the standalone review builds under
     <role>/dev/ do call it. Ours is the base: its ground is this app's
     (--ink #EAEEF4), and the directive's change is one token. */
  50: [{
    what: 'the RACI output page keeps its live .pdf-hd dock',
    find: "return'<div class=\"flx-between-top-mb\"><div>'+badge('Phase 2 Output',",
    replace: "return'<div class=\"flx-between-top-mb\"><div class=\"pdf-hd\">'+badge('Phase 2 Output',"
  }],

  53: [dock('the Development Portfolio', " class=\"h-section\">Development Portfolio</h2><p class=\"t-lead\">Programs in progress. Track phase status, take gate decisions as phases end, and launch completed projects to Operational \\u2013 all from this page.", 'currentStep')],

  55: [
    dock('the Exploration Portfolio', " class=\"h-section\">Exploration Portfolio</h2><p class=\"t-lead\">Run the deepened assessment and re-score, issue the Go / No-Go verdict, grade horizon, risk, and reward, then advance Go projects to Development \\u2013 all from this page.", "'out-explore'"),
    {
      what: 'the export is the whole page, both tabs, not the tab on screen',
      find: "if(UI.oxTab===2)return h+allocCore();",
      replace: "if(UI.oxTab===2&&!PRINT_EXPAND)return h+allocCore();"
    },
    {
      what: 'so the Allocate Capital tab is appended when printing',
      find: "\nreturn h}",
      replace: "\nif(PRINT_EXPAND)h+=allocCore(); /* the export is the whole page, both tabs */\nreturn h}"
    }
  ],

  /* buildSeedBase: most of what this step changes IS the directive's
     business - the first quarterly review, the three completed steps,
     the trimmed experiment records - so its block is the base. The one
     thing this build added and it never had goes back in. */
  63: [{
    what: 'bf11: the sample workspace marks the flag that makes 1.1 a real step (js/app.js, isStepDone)',
    find: "  data.bf12 = true;\n",
    replace: "  data.bf12 = true;\n  data.bf11 = true; /* 1.1 is a real step in this build - see bf11 beside isStepDone (js/app.js) */\n"
  }],

  56: [dock('the Operational Portfolio', " class=\"h-section\">Operational Portfolio</h2><p class=\"t-lead\">Live projects deployed in your business. Monitor performance and manage operations.", "'out-oper'")]
};

/* ---------------------------------------------------------------- */
function parseSteps(md) {
  const parts = md.split(/^### Step /m).slice(1);
  return parts.map(p => {
    const num = parseInt(p, 10);
    const title = p.split('\n')[0].trim();
    const ci = p.indexOf('**Code:**');
    const head = ci >= 0 ? p.slice(0, ci) : p;
    const kind = (head.match(/\*\*Kind:\*\*\s*(.+)/) || [, '?'])[1].trim();
    const where = (head.match(/\*\*Where:\*\*([\s\S]*)$/) || [, ''])[1].trim();
    let code = null;
    if (ci >= 0) {
      const m = p.slice(ci).match(/```[a-z]*\n([\s\S]*?)\n```/);
      if (m) code = m[1];
    }
    return { num, title, kind, where, code };
  });
}

/* -- ranges, over the lexed skeleton of ONE file ------------------ */
function fnRange(skel, name) {
  const re = new RegExp('^function\\s+' + name + '\\s*\\(', 'gm');
  const hits = []; let m;
  while ((m = re.exec(skel))) hits.push(m.index);
  if (hits.length !== 1) return { err: hits.length + ' top-level declarations of function ' + name };
  const start = hits[0];
  let i = skel.indexOf('{', start), depth = 0;
  if (i < 0) return { err: 'no body for function ' + name };
  for (; i < skel.length; i++) {
    if (skel[i] === '{') depth++;
    else if (skel[i] === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
  }
  return { err: 'unterminated function ' + name };
}
function varRange(skel, name) {
  const re = new RegExp('^var\\s+' + name + '\\s*=', 'gm');
  const hits = []; let m;
  while ((m = re.exec(skel))) hits.push(m.index);
  if (hits.length !== 1) return { err: hits.length + ' top-level declarations of var ' + name };
  const start = hits[0];
  let i = skel.indexOf('=', start) + 1, depth = 0;
  for (; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return { start, end: i + 1 };
  }
  return { err: 'unterminated var ' + name };
}
const squash = s => s.replace(/\s+/g, '');
function stmtRange(src, skel, line) {
  const needle = squash(line);
  const lines = src.split('\n');
  const hits = []; let off = 0;
  for (const ln of lines) {
    if (squash(ln) === needle) hits.push(off + (ln.length - ln.replace(/^\s+/, '').length));
    off += ln.length + 1;
  }
  if (hits.length !== 1) return { err: hits.length + ' lines reading "' + line.slice(0, 40) + '"' };
  const start = hits[0];
  const kw = /^(if|for|while|switch|try|do|function)\b/.test(src.slice(start, start + 12));
  let i = start, depth = 0, seen = false;
  for (; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '[' || c === '(') { depth++; seen = true; }
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0 && seen && c === '}') {
        let j = i + 1;
        while (j < skel.length && /\s/.test(skel[j])) j++;
        if (skel[j] === ';') return { start, end: j + 1 };
        if (kw) return { start, end: i + 1 };
      }
    } else if (c === ';' && depth === 0) return { start, end: i + 1 };
  }
  return { err: 'unterminated statement at "' + line.slice(0, 40) + '"' };
}

/* See the dev tool: skip whitespace and comments, then either the line
   ends (insert there) or an earlier insertion already shares the line
   (insert before it and close the line). */
function insertPoint(src, skel, end) {
  let i = end;
  while (i < src.length && src[i] !== '\n' && /\s/.test(skel[i])) i++;
  if (i >= src.length) return { at: src.length, close: false };
  if (src[i] === '\n') return { at: i, close: false };
  return { at: i, close: true };
}

/* What a step's *Where* asks for, before it is routed to a file. */
function intent(step) {
  const w = step.where.replace(/\s+/g, ' ');
  let m;
  if ((m = w.match(/^Replace the whole function named `([\w$]+)`\./))) return { op: 'replace', kind: 'fn', name: m[1] };
  if ((m = w.match(/^Replace the whole constant named `([\w$]+)`\./))) return { op: 'replace', kind: 'var', name: m[1] };
  if ((m = w.match(/^Delete the whole function named `([\w$]+)`\./))) return { op: 'delete', kind: 'fn', name: m[1] };
  if ((m = w.match(/^Add this immediately after the function named `([\w$]+)` ends/))) return { op: 'after', kind: 'fn', name: m[1] };
  if ((m = w.match(/^Add this immediately after the constant named `([\w$]+)` ends/))) return { op: 'after', kind: 'var', name: m[1] };
  if (/^Add this immediately after the statement that begins with the line reading exactly/.test(w)) {
    const f = step.where.match(/```[a-z]*\n([\s\S]*?)\n```/);
    if (!f) return { err: 'no anchor fence' };
    return { op: 'after', kind: 'line', name: f[1].trim() };
  }
  return { err: 'unrecognised Where: ' + w.slice(0, 90) };
}

function rangeIn(src, skel, it) {
  if (it.kind === 'fn') return fnRange(skel, it.name);
  if (it.kind === 'var') return varRange(skel, it.name);
  return stmtRange(src, skel, it.name);
}

/* ---------------------------------------------------------------- */
function main() {
  const steps = parseSteps(fs.readFileSync(MD, 'utf8'));
  if (steps.length !== N_STEPS) fail('expected ' + N_STEPS + ' steps, parsed ' + steps.length);

  const src = {}, before = {};
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) fail('missing live file ' + f);
    src[f] = before[f] = fs.readFileSync(p, 'utf8');
  }
  for (const f in NEW_FILES) { src[f] = NEW_FILES[f]; before[f] = null; }
  const ALL = FILES.concat(Object.keys(NEW_FILES));

  /* Refuse to run twice: step 1 deletes renderStepContent, which step 64
     puts back, so a second pass deletes the new one and doubles every
     insertion. renderReports is the marker - nothing else declares it. */
  /* Read from DISK, not from src: a file this port creates starts as its
     header template here, so asking src would never see the marker and a
     second run would double every insertion into the other ten files. */
  for (const f of ALL)
    if (/^function renderReports\s*\(/m.test(P.skeletonOf(readIf(f))))
      fail('the live app already has renderReports (' + f + ') - the port looks done.\n'
        + '      To run it again: restore the .pre-17sep backups and delete '
        + Object.keys(NEW_FILES).join(', ') + '.');

  const report = [], losses = [], merged = [], splits = [];
  const used = new Map();
  let bad = 0;

  const spellingHits = LIVE_SPELLINGS.map(() => 0);
  const superseded = [];

  /* The seam edits first: PH, the More menu, the sidebar's page list and
     the collaboration notices are read by code that runs before any page
     does, and each is a whole-file anchor rather than a step's. */
  for (const e of LIVE_EDITS) {
    const n = src[e.file].split(e.find).length - 1;
    if (n !== 1) fail('live edit "' + e.what + '" (' + e.file + '): anchor matched ' + n + ' times');
    src[e.file] = src[e.file].replace(e.find, e.replace);
  }

  for (const st of steps) {
    /* A live declaration this step replaces has to go before it arrives,
       or the name is declared twice and which one answers is load order. */
    for (const s of SUPERSEDE) {
      if (s.atStep !== st.num) continue;
      const f = s.file, skel = P.skeletonOf(src[f]);
      const r = fnRange(skel, s.name);
      if (r.err) fail('supersede ' + s.name + ' in ' + f + ': ' + r.err);
      const p = insertPoint(src[f], skel, r.end);
      let e = p.close ? r.end : p.at;
      if (src[f][e] === '\n') e++;
      src[f] = src[f].slice(0, r.start) + src[f].slice(e);
      superseded.push(s.name + ' (' + f + ') - ' + s.why);
    }

    if (SKIP[st.num]) { report.push(row(st, '(live)', 'skipped  ' + SKIP[st.num].slice(0, 90))); continue; }

    const it = intent(st);
    if (it.err) { report.push(row(st, '', 'UNRESOLVED  ' + it.err)); bad++; continue; }

    /* Route: the one live file whose top level declares the anchor. */
    /* Normalised to an object first. A bare string route must not be read
       for `.anchor`: String.prototype.anchor is a legacy method, so it
       answers with a function rather than undefined and the anchor becomes
       the line "anchor". */
    let route = ROUTE[st.num] ? (typeof ROUTE[st.num] === 'string' ? { file: ROUTE[st.num] } : ROUTE[st.num]) : null;
    let file = (route && route.file) || null;
    let r = null;
    if (route && route.atEnd) {
      r = { start: src[file].length, end: src[file].length };
    } else if (file) {
      r = rangeIn(src[file], P.skeletonOf(src[file]), (route && route.anchor) || it);
      if (r.err) { report.push(row(st, file, 'UNRESOLVED (routed)  ' + r.err)); bad++; continue; }
    } else {
      const found = [];
      for (const f of ALL) {
        const rr = rangeIn(src[f], P.skeletonOf(src[f]), it);
        if (!rr.err) found.push([f, rr]);
      }
      if (found.length !== 1) {
        report.push(row(st, '', 'NO ROUTE  ' + it.kind + ' ' + it.name.slice(0, 44) +
          '  (' + (found.length ? found.map(x => x[0]).join(' + ') : 'in no live file') + ')'));
        bad++; continue;
      }
      file = found[0][0]; r = found[0][1];
    }

    if (st.code === null && it.op !== 'delete') { report.push(row(st, file, 'NO CODE')); bad++; continue; }
    const skel = P.skeletonOf(src[file]);

    if (it.op === 'replace' || it.op === 'delete')
      losses.push({ num: st.num, name: it.name, op: it.op, file, old: src[file].slice(r.start, r.end), now: null });

    /* The live app's spelling, before any merge: a merge's `find` is
       then written against what the block actually says here. */
    let code = st.code;
    if (code !== null) LIVE_SPELLINGS.forEach((s, i) => {
      code = code.replace(s.find, (...a) => { spellingHits[i]++; return s.to(...a); });
    });

    if (MERGES[st.num]) {
      const edits = MERGES[st.num];
      if (it.op !== 'replace') fail('step ' + st.num + ' is merged but is not a Replace');
      /* The port's default base is THEIRS - the directive's block, with the
         live spelling applied and the live rulings regrafted onto it. That
         is the common case here, because the live copies of these functions
         are the 12 September ones plus a handful of presentation rulings.
         'ours' is for the few where the live body is the substantial one
         (render, printThemeTokens, buildSeedBase) and the directive's change
         is a line or two. */
      const bases = new Set(edits.map(e => e.base || 'theirs'));
      if (bases.size !== 1) fail('step ' + st.num + ' mixes merge bases');
      if (bases.has('ours')) code = src[file].slice(r.start, r.end);
      for (const e of edits) {
        const n = typeof e.find === 'string'
          ? code.split(e.find).length - 1
          : (code.match(new RegExp(e.find.source, e.find.flags.replace('g', '') + 'g')) || []).length;
        if (n !== 1) fail('step ' + st.num + ' merge "' + e.what + '": anchor matched ' + n + ' times');
        code = code.replace(e.find, e.replace);
      }
      merged.push(st.num + ' ' + it.name + ' [' + file + ', base: ' + [...bases][0] + ']\n      - ' + edits.map(e => e.what).join('\n      - '));
    }

    /* Recorded AFTER the merge, so --losses compares the live body with what
       is actually written over it, not with the directive's unmerged block. */
    { const l = losses[losses.length - 1]; if (l && l.num === st.num) l.now = code; }
    if (code !== null) used.set(st.num, { code, file });
    if (it.op === 'replace') src[file] = src[file].slice(0, r.start) + code + src[file].slice(r.end);
    else if (it.op === 'delete') {
      const p = insertPoint(src[file], skel, r.end);
      let e = p.close ? r.end : p.at;
      if (src[file][e] === '\n') e++;
      src[file] = src[file].slice(0, r.start) + src[file].slice(e);
    } else {
      const p = insertPoint(src[file], skel, r.end);
      src[file] = src[file].slice(0, p.at) + '\n' + code + (p.close ? '\n' : '') + src[file].slice(p.at);
      if (p.close) splits.push(st.num);
    }
    report.push(row(st, file, 'ok  ' + it.op + '  ' + it.name.slice(0, 44)));
  }

  if (LOSSES) {
    const dir = path.join(ROOT, 'tools', '_pl-port-losses');
    fs.mkdirSync(dir, { recursive: true });
    console.log('\n== What the Replace/Delete steps overwrite in the LIVE app ==\n');
    for (const l of losses) {
      const a = l.old.replace(/\s+/g, ' ').length, b = (l.now || '').replace(/\s+/g, ' ').length;
      console.log('STEP ' + String(l.num).padStart(3) + '  ' + l.op + '  ' + l.name.padEnd(26) +
        l.file.padEnd(28) + 'live ' + a + ' ch -> directive ' + b + ' ch');
      fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.live.js'), l.old);
      if (l.now !== null) fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.directive.js'), l.now);
    }
    console.log('\nwritten to tools/_pl-port-losses/');
  }

  /* Anchored on what the steps just wrote, so these run last. */
  if (!bad) for (const e of POST_EDITS) {
    const n = src[e.file].split(e.find).length - 1;
    if (n !== 1) fail('post edit "' + e.what + '" (' + e.file + '): anchor matched ' + n + ' times');
    src[e.file] = src[e.file].replace(e.find, e.replace);
  }

  if (PLAN || bad) console.log(report.join('\n'));
  if (splits.length) console.log('\nline closed to make room: steps ' + splits.join(','));
  if (superseded.length) {
    console.log('\nSUPERSEDED (the live declaration removed before its replacement arrives):');
    for (const s of superseded) console.log('  ' + s);
  }
  console.log('\nthe live app\'s spelling, applied to the directive\'s blocks:');
  let spellBad = 0;
  LIVE_SPELLINGS.forEach((s, i) => {
    const okc = spellingHits[i] === s.count;
    if (!okc) spellBad++;
    console.log('  ' + (okc ? ' ' : '!') + ' ' + String(spellingHits[i]).padStart(3) + ' / ' + s.count + '  ' + s.what);
  });
  if (spellBad) fail(spellBad + ' spelling rewrite(s) did not match the expected number of sites - read them before changing the count');
  if (merged.length) {
    console.log('\nMERGED (the live body kept, the directive\'s delta applied to it):');
    for (const m of merged) console.log('  step ' + m);
  }

  const byFile = {};
  for (const [, u] of used) byFile[u.file] = (byFile[u.file] || 0) + 1;
  console.log('\nsteps: ' + steps.length + '   unrouted/unresolved: ' + bad);
  console.log('edits per file:');
  for (const f of ALL) if (byFile[f]) console.log('  ' + f.padEnd(34) + String(byFile[f]).padStart(3) +
    '   ' + (before[f] === null ? 'new file, ' : before[f].split('\n').length + ' -> ') + src[f].split('\n').length + ' lines');

  if (bad) fail(bad + ' step(s) did not route - nothing written');

  for (const f of ALL) {
    if (!/\.js$/.test(f) || src[f] === before[f]) continue;
    try { new Function(src[f]); }
    catch (e) { fail(f + ' does not parse: ' + e.message); }
  }
  console.log('parse: ok');

  /* A name the ported code calls that nothing declares. Baseline-relative
     and asked of the whole app at once, because the Pipeline's code is
     spread over a dozen files that share one global scope - a name moved
     between them is fine, a name that arrived from the directive and has
     no home here is the class that took ER's app blank. */
  /* Every script shell.html loads, not just the ones this port edits:
     these files share one global scope, so a name declared in js/auth.js
     answers a call in js/app.js and scanning a subset invents holes. */
  const SHELL_JS = ((src['shell.html'] || '').match(/src="([^"]+\.js)"/g) || []).map(s => s.slice(5, -1));
  if (!SHELL_JS.includes('js/pages/reports.js'))
    fail('shell.html does not load js/pages/reports.js - the Report Manager would be a page nothing defines');
  const joined = f => SHELL_JS.map(x => (f[x] !== undefined && f[x] !== null) ? f[x]
    : (fs.existsSync(path.join(ROOT, x)) ? fs.readFileSync(path.join(ROOT, x), 'utf8') : '')).join('\n');
  const base = new Set(undeclared(joined(before)));
  const un = undeclared(joined(src)).filter(n => !base.has(n));
  if (base.size) console.log('undeclared, pre-existing (left alone): ' + [...base].join(' '));
  if (un.length) {
    console.log('\nUNDECLARED, INTRODUCED BY THIS PORT:');
    for (const u of un) console.log('  ' + u);
    fail(un.length + ' introduced undeclared name(s)');
  }

  /* The same question for names the directive's blocks READ rather than
     call, asked only of the code the port brings in. */
  const declared = declaredAll(joined(src));
  const reads = new Map(), guarded = new Map();
  for (const [num, u] of used) {
    /* A merge with base 'ours' contributes the LIVE body, which of course
       reads the shell's own globals - it is not code the directive brought
       in, so there is nothing here to check. */
    if (MERGES[num] && (MERGES[num][0].base || 'theirs') === 'ours') continue;
    const g = new Set();
    for (const m of u.code.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*['"]undefined['"]/g)) g.add(m[1]);
    for (const n of refsIn(u.code)) if (!declared.has(n)) {
      const bag = g.has(n) ? guarded : reads;
      if (!bag.has(n)) bag.set(n, []);
      bag.get(n).push(num);
    }
  }
  if (guarded.size) {
    console.log('\nread behind a `typeof` guard, declared nowhere here (safe):');
    for (const [n, at] of [...guarded].sort()) console.log('  ' + n.padEnd(28) + ' step ' + at.join(','));
  }
  if (reads.size) {
    console.log('\nREAD BY THE DIRECTIVE, DECLARED NOWHERE IN THE LIVE APP:');
    for (const [n, at] of [...reads].sort()) console.log('  ' + n.padEnd(28) + ' step ' + at.join(','));
    fail(reads.size + ' name(s) the directive expects and the live app does not have');
  }
  console.log('undeclared: none introduced');

  /* LOAD ORDER. A `function f(){}` is hoisted and costs nothing at load,
     but a top-level STATEMENT runs the moment its file is parsed - so
     `PRINT_DOCS['5.1']=...` in a file that loads before js/app.js, where
     PRINT_DOCS is declared, throws and takes the rest of that file with
     it. The page then simply does not exist, with no error anyone sees
     until they open it. That is what steps 203-207 did on the first run.
     Asked of every file this port touched, against what is declared at or
     before it in shell.html's order. */
  const earlyIn = which => {
    const out = [];
    let acc = '';
    for (const f of SHELL_JS) {
      const text = (which[f] !== undefined && which[f] !== null) ? which[f] : readIf(f);
      acc += '\n' + text;
      const known = declaredAll(acc);
      for (const w of tableWritesAtLoad(text)) if (!known.has(w.table))
        out.push(f + ': ' + w.table + '  in  ' + w.stmt.replace(/\s+/g, ' ').trim().slice(0, 72));
    }
    return out;
  };
  /* Baseline-relative like the scans above: the shell already reads names
     it never declares with `var` - window.Modules, the browser's own
     storage - and those are not this port's business. */
  const earlyBase = new Set(earlyIn(before).map(s => s.split('  in  ')[0]));
  const early = earlyIn(src).filter(s => !earlyBase.has(s.split('  in  ')[0]));
  if (early.length) {
    console.log('\nRUN AT LOAD, BEFORE THE NAME EXISTS:');
    for (const e of early) console.log('  ' + e);
    fail(early.length + ' top-level statement(s) read a name declared in a later file');
  }
  console.log('load order: every top-level statement runs after the names it reads');

  if (EMIT) {
    /* Every backup before any write: a run that stops half way leaves the
       app in a state neither this tool nor a reader can reason about, and
       the rollback has to be one command over files that all exist. A file
       this port CREATES has nothing to back up and must not be given a
       null one - that is what stopped the first run after ten writes. */
    const written = [];
    for (const f of ALL) {
      if (src[f] === before[f] || before[f] === null) continue;
      const bak = path.join(ROOT, f) + '.pre-17sep';
      if (!fs.existsSync(bak)) fs.writeFileSync(bak, before[f]);
    }
    for (const f of ALL) {
      if (src[f] === before[f]) continue;
      fs.writeFileSync(path.join(ROOT, f), src[f]);
      written.push(f + (before[f] === null ? '  (new)' : ''));
    }
    for (const f of written) console.log('wrote ' + f);
    console.log('\nto undo: restore the .pre-17sep files and delete ' + Object.keys(NEW_FILES).join(', '));
  } else {
    console.log('(dry run - pass --emit to write)');
  }
}

const readIf = f => fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '';

/* The top-level statements that TOUCH A TABLE at load: `X[k] = ...` and
   `X.k = ...` written at depth zero. That is the shape this check exists
   for - a registration into a table another file declares, which runs the
   moment the file is parsed.

   Deliberately only that shape. A function declaration is hoisted and runs
   nothing; an IIFE runs, but the names in its inner functions do not, so
   reading identifiers out of one reports every forward reference in the
   file as a load error. Narrow and exact beats broad and ignored. */
function tableWritesAtLoad(source) {
  const skel = P.skeletonOf(source);
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) {
      const stmt = source.slice(start, i + 1);
      const head = P.skeletonOf(stmt).replace(/^[\s;]*/, '');
      const m = head.match(/^([A-Za-z_$][\w$]*)\s*(\[|\.)/);
      if (m && /^[^=]*=[^=]/.test(head)) out.push({ stmt, table: m[1] });
      start = i + 1;
    }
  }
  return out;
}

/* -- the same three scans the dev tool runs, over the live files --- */
function declaredAll(src) {
  const skel = P.skeletonOf(src);
  const declared = new Set([...P.BROWSER, 'ResizeObserver', 'MutationObserver', 'IntersectionObserver',
    'arguments', 'this', 'undefined', 'null', 'true', 'false', 'NaN', 'Infinity']);
  for (const m of skel.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/function[^(]*\(([^)]*)\)/g))
    for (const p of m[1].split(',')) { const n = p.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n); }
  for (const m of skel.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  return declared;
}
function undeclared(src) {
  const skel = P.skeletonOf(src);
  const declared = declaredAll(src);
  const called = new Set();
  for (const m of skel.matchAll(/(^|[^\w.$'"])([A-Za-z_$][\w$]*)\s*\(/g))
    if (!P.JS_KEYWORDS.has(m[2])) called.add(m[2]);
  return [...called].filter(n => !declared.has(n)).sort();
}
const MORE_KW = new Set(['try', 'finally', 'continue', 'break', 'throw', 'case', 'default',
  'instanceof', 'const', 'let', 'yield', 'await', 'class', 'extends', 'super', 'debugger', 'with']);
function refsIn(code) {
  const skel = P.skeletonOf(code);
  const own = declaredAll(code);
  const out = new Set();
  for (const m of skel.matchAll(/(^|[^\w.$])([A-Za-z_$][\w$]*)/g)) {
    const n = m[2];
    if (/^\s*:/.test(skel.slice(m.index + m[0].length))) continue;
    if (P.JS_KEYWORDS.has(n) || MORE_KW.has(n) || own.has(n)) continue;
    out.add(n);
  }
  return out;
}

function row(st, file, what) {
  return '  STEP ' + String(st.num).padStart(3) + '  ' + (file || '-').padEnd(30) + what;
}
function fail(msg) { console.error('\nFAIL: ' + msg); process.exit(1); }

/* The tables, so tools/pipeline-directive-verify.js can ask its question
   against the SAME rules this tool applied rather than a second copy of
   them that drifts. */
module.exports = { FILES, NEW_FILES, ROUTE, SUPERSEDE, SKIP, LIVE_EDITS, POST_EDITS, LIVE_SPELLINGS, MERGES };

if (require.main === module) main();
