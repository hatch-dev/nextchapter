/* ─────────────────────────────────────────────────────────────
   ai-governance/help.js — Responsible AI Governance's "? Help" guide
   ─────────────────────────────────────────────────────────────
   The reference build's own help modal, as it stands
   (enterprises/dev/responsible-ai-governance-prototype/Governance-app.js,
   renderModal → currentModal === 'help'): the same sections, wording,
   order and inline styling, handed to the shell as finished markup
   (doc.html, js/features/help.js) instead of being rebuilt out of the
   shell's shared blocks. Ruled 17 Nov 2026: live's guide reads exactly
   as the prototype's.

   Generated from the reference by a one-off script; the only edits are
   these six, each the fewest words that make the sentence true here:

     · "twelve output documents" → thirteen (PH in module.js has 13)
     · "All data is saved locally in your browser" → the shared
       workspace sentence; the workspace is server-backed here
     · Phase 3 outputs drop "Risk Classification", retired 12 Sep 2026
       (folded into the registers) and in neither build's sidebar
     · Tools: the AI Guide / Voice / Notes positions ("top / middle /
       bottom" in the reference's floating stack) → where they are here
     · Data & Privacy: the AI Guide sentence is the shell's
       (HELP_PRIVACY_NEW) — this program's Guide asks Pinecone
     · Data & Privacy: Reset no longer "removes all team members except
       administrators"; the shell's reset keeps the team (clearData)

   If the reference's help changes, carry the change across by hand.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  /* The reference's risk-category table, which its help lists in colour. */
  var POSTI=[
  {key:'P',name:'Product',color:'#C4553A',desc:'Risks to what your organization makes and delivers'},
  {key:'O',name:'Operational',color:'#3A8B8B',desc:'Risks to how your organization runs'},
  {key:'S',name:'Strategic',color:'#8B6BAE',desc:'Risks to your competitive position and market'},
  {key:'T',name:'Technological',color:'#D4963A',desc:'Risks from the technology itself'},
  {key:'i',name:'Intersectional',color:'#6B7F8D',desc:'Compound risks spanning multiple categories'},
  {key:'X',name:'Other',color:'#3D4F5C',desc:'Risks that fit none of the other categories'}
  ];

  Modules.defineHelp('ai-governance', {
    title: '90-Day Responsible AI Governance',
    html: function () {
      var h = '';
      h+='<h3>90-Day Responsible AI Governance</h3>';
      
      h+='<div style="background:rgba(46,122,102,.08);border-left:2px solid var(--ph1);padding:16px 20px;margin-bottom:28px;font-family:var(--serif);font-size:17px;font-style:italic;font-weight:400;line-height:1.55;color:var(--gold-pale)">The gap between AI deployment and AI governance is where organizations get hurt. This framework closes that gap.</div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">What This App Does</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">A guided implementation of the 90-Day Responsible AI Governance framework from Faisal Hoque. Five phases take you from AI risk mapping through to a living governance discipline \u2014 structured forms, research-backed context panels, thirteen output documents, a live governance dashboard, and a step-aware AI Guide. Your work is saved to your organization’s shared workspace as you go.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Navigation</div>';
      h+='<div style="font-size:14px;color:var(--stone);line-height:2"><strong style="color:var(--paper)">Top nav</strong> \u2014 Home \xb7 Learn \xb7 Framework \xb7 Governance Dashboard \xb7 Insights (always visible)<br><strong style="color:var(--paper)">Left sidebar</strong> \u2014 visible on Framework and Dashboard pages only. Jump directly to any phase, step, or output. Click \u2630 to collapse.<br><strong style="color:var(--paper)">Phase landings</strong> \u2014 click a phase in the sidebar or Framework overview for progress metrics, step flow, and output links.</div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">The Five Phases</div>';
      h+='<div style="display:grid;gap:12px">';
      var gphases=[
      {n:'01',t:'Map (Days 1\u201330)',d:'Run the five-section Assessment Battery. Inventory every AI system. Log risks across the risk categories, then close discovery with the rapid screen: Likelihood, Impact, and Timeframe, 1\u20135 each. Map the regulatory landscape.'},
      {n:'02',t:'Build (Days 31\u201350)',d:'Stand up the Responsible AI Review Board and author the register of Responsible AI principles. Assign governance ownership via the RACI matrix. Set the New Risk Review cadence with its rescan. Itemize obligations for the regimes that need it. Then make the selection: every considered risk gets a decision \u2014 advance under a named owner, or defer with its trigger and horizon.'},
      {n:'03',t:'Assess (Days 51\u201370)',d:'Run the Responsible AI screening on flagged cards. Deepen the assessment of every selected risk and score each afresh on Likelihood, Impact, and Timeframe (LIT 1\u20135). End each assessment with a classification decision: Manage, Monitor, or Archive. Build each system\'s testing plan and evidence log.'},
      {n:'04',t:'Embed (Days 71\u201390)',d:'Activate the Manage portfolio: a management or monitoring plan on every arriving card. Turn the review schedule into a real meeting. Wire deployment gates into operations and review every system, writing a standing exit plan on each. Close by holding the first Governance Review.'},
      {n:'05',t:'Govern (Ongoing)',d:'The standing state. The portfolios and the Governance Dashboard carry the work from here: the classification lanes, the monitoring checks, escalations, the archive, and the review rhythm. The 90 days build the foundation. The discipline continues for as long as you run AI.'}
      ];
      for(var i=0;i<gphases.length;i++){var gph=gphases[i];h+='<div style="display:grid;grid-template-columns:32px 1fr;gap:12px;align-items:start"><div style="font-family:var(--serif);font-size:24px;font-weight:400;color:var(--gold-text)">'+gph.n+'</div><div><div style="font-size:14px;color:var(--paper);font-weight:500;margin-bottom:2px">'+gph.t+'</div><div style="font-size:14px;color:var(--stone);line-height:1.6">'+gph.d+'</div></div></div>';}
      h+='</div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Risk Categories</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75;margin-bottom:8px">The categories used to classify AI risk throughout the framework:</p>';
      h+='<div style="font-family:var(--mono);font-size:12px;color:var(--stone);line-height:2;padding:12px 16px;border:1px solid var(--rule)">';
      for(var i=0;i<POSTI.length;i++){var gp=POSTI[i];h+='<span style="color:'+gp.color+'">'+gp.name+'</span> \u2014 '+gp.desc+'<br>';}
      h+='</div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">LIT Scoring</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75;margin-bottom:8px">Each risk is scored 1\u20135 on three dimensions in Phase 3:</p>';
      h+='<div style="font-family:var(--mono);font-size:12px;color:var(--stone);line-height:2;padding:12px 16px;border:1px solid var(--rule)">L \u2014 Likelihood (how probable)<br>I \u2014 Impact (how severe)<br>T \u2014 Timeframe (how imminent)<br><span style="color:var(--gold-text)">Composite = L + I + T (max 15)</span></div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">The Risk Portfolios</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Every risk moves through four portfolios. Identify holds new arrivals, each with its risk card and an advance-or-defer decision. Assess is where selected risks get their full assessment and their classification. Manage &amp; Monitor carries the working plans, one tab for managed risks and one for monitored risks. Emergency Response is the alarm lane: a risk escalates there by human decision, runs its emergency plan, and de-escalates when things are stable again. A finished risk archives from wherever it stands.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">The Standing Reviews</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Three reviews keep the discipline honest, each run from its own box on the Governance Dashboard. The New Risk Review re-scans your configured sources and decides every new arrival on the register. The Responsible AI Review Board review works the waiting screenings and reviews the principle register. The Governance Review looks at the machine itself: whether the reviews are running as planned, portfolio hygiene, and a short look back. Every run stamps the shared review log.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Systems &amp; Compliance</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Every AI system carries its own card: description, its risks, its testing record, and a standing exit plan, with the deployment gate log and the retirement route on the card. The Compliance Dashboard tracks every regime you catalog, with NIST pre-loaded as a worked example, and the Testing Center collects the testing work in one place.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Phase Outputs</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75;margin-bottom:16px">Each phase produces output documents accessible from the sidebar or phase landing page.</p>';
      h+='<div style="display:grid;gap:8px">';
      var helpOutputs=[
        {ph:'Phase 1 \u2014 Map',items:'Assessment Profile \xb7 Initial Risk Register \xb7 Systems Inventory \xb7 Compliance Survey'},
        {ph:'Phase 2 \u2014 Build',items:'Responsible AI Principles \xb7 RACI Matrix \xb7 Governance Systems Report \xb7 Compliance Obligations'},
        {ph:'Phase 3 \u2014 Assess',items:'Assessed Risk Register \xb7 Testing & Evidence'},
        {ph:'Phase 4 \u2014 Embed',items:'Management & Monitoring Plans \xb7 Governance Framework \xb7 Updated Risk Register'}
      ];
      for(var i=0;i<helpOutputs.length;i++){var ho=helpOutputs[i];
        h+='<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.08)">';
        h+='<div style="font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text);padding-top:1px">'+ho.ph+'</div>';
        h+='<div style="font-size:14px;color:var(--stone);line-height:1.6">'+ho.items+'</div>';
        h+='</div>';
      }
      h+='</div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Phase Landing Pages</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Click any phase header in the sidebar or the Framework overview to open its landing page. Each shows the phase description, a live progress bar with its completion percentage, metrics that link to their source step, a horizontal step flow with completion indicators, and every phase output link. The Framework tab shows the five-phase timeline grid with day ranges and step counts.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Phase 5 \u2014 Govern</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Phase 5 is the standing state, carried by four pages. The Governance Dashboard shows the risk pipeline, the portfolios, the standing reviews, and the Data Bank of output documents. The Compliance Dashboard tracks the regimes. The Testing Center holds the testing log. Analytics charts the register, team load, and program coverage.</p></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Tools</div>';
      h+='<div style="font-size:14px;color:var(--stone);line-height:2"><strong style="color:var(--paper)">Top-right nav</strong> \u2014 Help, the theme toggle, Team Chat, Notes, your user chip: Org Profile, View Assignments, Sign Out, and the \u22ef More menu: Track Program, Voice, Profile, Admin (administrators only), Load the seeded example, Export state, Import state, Reset all data.<br><span style="color:var(--gold-text)">✦ AI Guide</span> \u2014 teal button, bottom-right corner. Context-aware for your current step. Ask about the POSTi risk categories (Product, Operational, Strategic, Technological, Intersectional), LIT scoring, exit plans, or anything in the governance model.<br><span style="color:var(--paper)">\u25ce Voice</span> \u2014 in the More menu. Hands-free navigation. Say: <span style="font-family:var(--mono);font-size:12px">&ldquo;learn&rdquo; &middot; &ldquo;framework&rdquo; &middot; &ldquo;dashboard&rdquo; &middot; &ldquo;open coach&rdquo; &middot; &ldquo;open notes&rdquo; &middot; &ldquo;close&rdquo;</span><br><span style="color:var(--paper)">✎ Notes</span> \u2014 in the More menu. Capture insights tagged to your current step. Persists across sessions.<br><strong style="color:var(--paper)">Printing</strong> \u2014 Output documents and the dashboards print through their Save as PDF and Export Report controls.</div></div>';
      h+='<div style="margin-bottom:24px"><div class="section-label" style="margin-bottom:12px">Data &amp; Privacy</div>';
      h+='<p style="font-size:14px;color:var(--stone);line-height:1.75">Your organization\'s workspace is stored centrally on the program\'s servers and is isolated from every other organization. Everyone on your team signs into the same workspace, so the work you save is the work your colleagues see, whichever device they sign in from. Each program module keeps its own workspace under that same organization. The AI Guide sends your question, your recent messages in the Guide panel, and the name of the step you are on to Pinecone, an AI service, routed through the program’s server rather than directly from your browser. Pinecone adds relevant passages from the program’s reference material and has a Claude model, made by Anthropic, write the answer. Email notifications go out through the program\'s email service to the addresses on the team roster. <strong>Reset</strong> (More menu) clears the current organization\'s data for the whole team, so use it with care. You can sign out at any time from your profile chip.</p></div>';
      h+='<div style="text-align:center;padding-top:8px"><button class="btn-gold" onclick="closeModal()">Got It</button></div>';
      return h;
    }
  });
})();
