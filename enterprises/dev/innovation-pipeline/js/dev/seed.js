/* ============================================================
   dev/seed.js - Sample-data seeds (dev/testing only)
   ------------------------------------------------------------
   Extracted from app.js (plain global script, loaded before app.js).
   buildSeedBase() fills the active data object from an anchor date;
   seedData() (day-70 program) and seedDataY2() (year-two portfolio)
   are triggered from the More menu. Rely on app.js globals: data,
   emptyData, Store, saveData, applyTeamRoster, render, PH, getStages,
   uid, and related helpers. Not loaded in production if seeds are removed.
   ============================================================ */

/* ═══════════════════════════════════════════════════════════════
   SEED SAMPLE DATA — for testing the visualizations and multi-user
   features without manually filling forms. Triggered by the "Seed"
   button in the navbar (next to Reset).
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SEED SAMPLE DATA — for testing the visualizations and multi-user
   features without manually filling forms. Triggered by the "Seed"
   button in the navbar (next to Reset).
   ═══════════════════════════════════════════════════════════════ */
function buildSeedBase(sd){ /* pure builder – fills `data` from the anchor date; no confirm, no persistence. Split from seedData for the Year 2 seed (Paul, July 8) */
  data.startDate = sd.toISOString().split('T')[0];
  data.bf12 = true;
  data.bf11 = true; /* 1.1 is a real step in this build - see bf11 beside isStepDone (js/app.js) */

  // ─── Phase 1: Assessment (all sections complete) ───
  data.purpose = {
    mission: 'Enable global businesses to operate at the intersection of human judgment and AI capability.',
    values: 'Trust \u00b7 Rigor \u00b7 Courage',
    shortTerm: 'Three enterprise AI pilots launched in Q1.',
    mediumTerm: 'Five operational AI pipelines by year-end.',
    longTerm: 'Industry-standard AI innovation framework adopted across 50 organizations.',
    goals: '1. Three AI pilots live\n2. Two AI case studies published\n3. Co-Delivery Partner agreement signed',
    frictions: '1. Slow capital cycles\n2. Mid-management AI literacy gaps\n3. Legacy procurement processes'
  };
  data.knowledge = { usage:'moderate', awareness:4, resources:'moderate', learning:'systematic' };
  data.culture = { uncertainty:3, aiLegitimacy:4, newProposals:4, incentives:3, frontline:3, overall:4 };
  data.audit = [
    {name:'AI-assisted customer triage', status:'alive', assigned:'yes', projIdx:0},
    {name:'Forecast model rebuild', status:'alive', assigned:'yes', projIdx:1},
    {name:'Document classification', status:'dormant', assigned:'no'},
    {name:'Knowledge graph PoC', status:'dead', assigned:'no'},
    {name:'Predictive maintenance', status:'alive', assigned:'yes', projIdx:4}
  ];
  data.decisions = {
    q1: { who:'Innovation Council',  gap:'' },
    q2: { who:'Phase Owner + CIO',   gap:'' },
    q3: { who:'CFO + COO',           gap:'Bottleneck in Q2 budget reallocation' },
    q4: { who:'Phase Owner',         gap:'' },
    q5: { who:'Resource Council',    gap:'Cross-functional staffing still slow' }
  };

  // ─── Ideas (1.2) — live idea-card schema ───
  data.ideas = [
    {name:'AI-Assisted Customer Triage', desc:'Route incoming inquiries by intent and urgency using LLM classification.', strategic:'Friction: support queue response times', cost:'Medium ($15-60K)', outcome:'Best: two-thirds of inquiries routed without human touch. Worst: misrouted urgent cases erode trust in the queue.', capabilities:'LLM classification, help-desk integration, labeled inquiry history.', risk:'Misrouting urgent complaints. Model drift as product mix changes.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'},
    {name:'Forecast Demand Model', desc:'Rebuild SKU-level demand forecasting with foundation models.', strategic:'Friction: inventory write-offs', cost:'High ($60K+)', outcome:'Best: write-offs cut by a third and stockouts halved. Worst: forecasts no better than the current spreadsheet.', capabilities:'Data science capacity, clean SKU sales history, ERP integration.', risk:'Sparse history on new SKUs. Planner trust if early forecasts miss.', dept:'Supply Chain', when:'now', timeframe:'12+ months'},
    {name:'Sales Knowledge Graph', desc:'Connect CRM, contracts, and product data for a unified rep view.', strategic:'Friction: fragmented account context', cost:'High ($60K+)', outcome:'Best: reps see full account context in one view and win rates rise. Worst: an expensive integration nobody opens.', capabilities:'Graph modeling, CRM and contract system APIs, data stewardship.', risk:'Stale data undermining trust. Integration scope creep.', dept:'Sales', when:'now', timeframe:'6-12 months'},
    {name:'Document Intelligence', desc:'Extract structured data from supplier contracts and invoices.', strategic:'Friction: manual contract review', cost:'Medium ($15-60K)', outcome:'Best: contract review hours cut by half with better accuracy. Worst: extraction errors propagate into payments.', capabilities:'OCR and extraction models, finance process knowledge, sample corpus.', risk:'Extraction errors on non-standard layouts. Supplier format drift.', dept:'Finance', when:'now', timeframe:'3-6 months'},
    {name:'Predictive Maintenance', desc:'Anomaly detection on plant sensor streams.', strategic:'Friction: unplanned line stoppages', cost:'High ($60K+)', outcome:'Best: unplanned stoppages down 40% with parts ordered ahead of failure. Worst: false alarms stop healthy lines.', capabilities:'Sensor infrastructure, anomaly models, maintenance engineering time.', risk:'False positives eroding operator trust. Sensor coverage gaps.', dept:'Manufacturing', when:'now', timeframe:'3-6 months'},
    {name:'Marketing Brief Generator', desc:'Draft campaign briefs from brand and product context.', strategic:'Friction: slow campaign turnaround', cost:'Low ($0-15K)', outcome:'Best: campaign briefs in hours instead of weeks. Worst: generic briefs that still need full rewrites.', capabilities:'Prompted LLM workflow, brand guideline corpus.', risk:'Off-brand output. Overreliance replacing strategic thinking.', dept:'Marketing', when:'future', timeframe:'1-3 months'},
    {name:'HR Skills Matcher', desc:'Match internal talent to open requisitions via a skill graph.', strategic:'Friction: slow internal mobility', cost:'Medium ($15-60K)', outcome:'Best: internal fills rise and time-to-fill drops. Worst: matches ignored by hiring managers.', capabilities:'Skills taxonomy, HRIS data access, matching model.', risk:'Stale skills data. Perceived unfairness in match rankings.', dept:'HR', when:'future', timeframe:'3-6 months'},
    {name:'Sustainability Reporting', desc:'Automate ESG metric collection from systems of record.', strategic:'Friction: manual ESG assembly', cost:'Low ($0-15K)', outcome:'Best: ESG pack assembled automatically each quarter. Worst: numbers still hand-checked line by line.', capabilities:'System-of-record connectors, ESG metric definitions.', risk:'Source-data quality. Framework changes outdating the mappings.', dept:'Operations', when:'future', timeframe:'6-12 months'},
    {name:'Meeting Minutes Automator', desc:'Draft structured minutes and action items from recorded meetings.', strategic:'Friction: untracked decisions and follow-ups', cost:'Low ($0-15K)', outcome:'Best: every decision and action captured and tracked. Worst: transcripts nobody reads and actions nobody owns.', capabilities:'Speech-to-text, summarization, calendar integration.', risk:'Sensitive discussions recorded. Attribution errors in minutes.', dept:'Corporate', when:'future', timeframe:'1-3 months'},
    {name:'Supplier Risk Radar', desc:'Monitor supplier news, filings, and delivery data for early risk signals.', strategic:'Friction: reactive supplier management', cost:'Medium ($15-60K)', outcome:'Best: supplier failures flagged a quarter before they bite. Worst: alert noise that procurement tunes out.', capabilities:'News and filings feeds, entity matching, procurement workflow hooks.', risk:'False alarms damaging supplier relationships. Feed coverage gaps.', dept:'Procurement', when:'future', timeframe:'6-12 months'},
    {name:'Energy Optimization', desc:'Optimize plant energy consumption against production schedules and tariffs.', strategic:'Friction: rising energy cost per unit', cost:'High ($60K+)', outcome:'Best: energy cost per unit down 15% with no schedule impact. Worst: savings too small to justify the metering spend.', capabilities:'Sub-metering, optimization models, production schedule access.', risk:'Tariff volatility swamping gains. Production constraints limiting flexibility.', dept:'Facilities', when:'future', timeframe:'12+ months'},
    {name:'Procurement Copilot', desc:'Draft RFQs and compare supplier bids against historical pricing.', strategic:'Friction: slow sourcing cycles', cost:'Medium ($15-60K)', outcome:'Best: sourcing cycles halved and quote quality up. Worst: buyers bypass it and keep their spreadsheets.', capabilities:'LLM drafting, historical pricing data, e-sourcing integration.', risk:'Price-comparison errors. Supplier gaming of standardized RFQs.', dept:'Procurement', when:'now', timeframe:'3-6 months'},
    {name:'Invoice Coding Copilot', desc:'Auto-suggest GL codes and cost centers on inbound invoices.', strategic:'Friction: month-end close delays', cost:'Low ($0-15K)', outcome:'Best: coding accuracy up and close shortened by two days. Worst: miscodes surface at audit.', capabilities:'AP system integration, GL history for training.', risk:'Silent miscoding. Exceptions still routing to the same bottleneck.', dept:'Finance', when:'now', timeframe:'1-3 months'},
    {name:'Quality Inspection Vision', desc:'Camera-based defect detection on the final assembly line.', strategic:'Friction: escaped defects reaching customers', cost:'High ($60K+)', outcome:'Best: escaped defects near zero at line speed. Worst: false rejects slow the line and the cameras get switched off.', capabilities:'Camera and edge infrastructure, CV models, labeled defect imagery.', risk:'Lighting and product-variant sensitivity. Labeled-image volume needed.', dept:'Manufacturing', when:'now', timeframe:'12+ months'},
    {name:'Churn Early-Warning Model', desc:'Score accounts weekly on churn risk from usage and support signals.', strategic:'Friction: surprise cancellations', cost:'Medium ($15-60K)', outcome:'Best: a third of at-risk accounts saved by earlier outreach. Worst: scores nobody acts on.', capabilities:'Usage and support data pipeline, scoring model, CRM alerting.', risk:'Acting capacity in account teams. Signal quality on low-touch accounts.', dept:'Customer Ops', when:'now', timeframe:'3-6 months'},
    {name:'Logistics Route Optimizer', desc:'Re-plan delivery routes daily against traffic, load, and fuel data.', strategic:'Friction: rising cost per delivery', cost:'Medium ($15-60K)', outcome:'Best: cost per delivery down 12% with better on-time rates. Worst: drivers ignore the routes and revert.', capabilities:'Routing engine, telematics data, dispatch process change.', risk:'Driver adoption. Local knowledge the model lacks.', dept:'Supply Chain', when:'now', timeframe:'6-12 months'},
    {name:'Field Service Assistant', desc:'On-site troubleshooting answers from manuals and repair history.', strategic:'Friction: repeat service visits', cost:'Medium ($15-60K)', outcome:'Best: first-visit fix rate up ten points. Worst: wrong answers in the field damage equipment or trust.', capabilities:'Manual and repair-history corpus, retrieval pipeline, mobile delivery.', risk:'Wrong guidance on safety-critical steps. Coverage of legacy equipment.', dept:'Service', when:'now', timeframe:'3-6 months'},
    {name:'Compliance Q&A Bot', desc:'Policy and regulation answers for frontline staff, with citations.', strategic:'Friction: compliance bottleneck on routine questions', cost:'High ($60K+)', outcome:'Best: routine questions answered instantly with citations, legal freed for real issues. Worst: a confident wrong answer creates the exposure it was meant to prevent.', capabilities:'Curated policy corpus, retrieval with citations, legal review loop.', risk:'Hallucinated or outdated answers. Jurisdictional nuance.', dept:'Legal', when:'now', timeframe:'12+ months'},
    {name:'Sales Proposal Drafter', desc:'Assemble first-draft proposals from CRM context and past wins.', strategic:'Friction: slow proposal turnaround', cost:'Low ($0-15K)', outcome:'Best: proposal turnaround from days to hours with higher hit rates. Worst: templated proposals that read templated.', capabilities:'CRM context access, past-win corpus, LLM drafting.', risk:'Stale pricing in drafts. Confidential terms leaking between accounts.', dept:'Sales', when:'now', timeframe:'1-3 months'},
    {name:'Support Ticket Summarizer', desc:'Summarize long ticket threads and suggest next actions for agents.', strategic:'Friction: slow handoffs between support tiers', cost:'Low ($0-15K)', outcome:'Best: handoffs lose nothing and resolution times drop. Worst: summaries drop the one detail that mattered.', capabilities:'Ticket system integration, summarization models.', risk:'Omission of critical details. Agent overreliance on the summary.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'}
  ];
  data.selected = [0,1,2,3,4,11,12,13,14,15,16,17];

  // ─── 1.3: per-dimension gates + triage scores (live schema) ───
  data.assessments = {
    0: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:9, costScore:9, difficulty:8 },
    1: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:7, value:8, costScore:7, difficulty:8 },
    2: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:5, difficulty:6 },
    3: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:5, value:6, costScore:5, difficulty:5 },
    4: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:8, costScore:8, difficulty:8 },
    11: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:6, difficulty:6 },
    12: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 },
    13: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:4, value:8, costScore:4, difficulty:4 },
    14: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:8, costScore:6, difficulty:6 },
    15: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:4, value:6, costScore:5, difficulty:5 },
    16: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:7, costScore:6, difficulty:6 },
    17: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:3, value:9, costScore:4, difficulty:5 },
    18: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 } /* 16 Sep 2026 (Paul's ruling): one unselected idea fully qualified and scored (34 / 50), so the Blue Sky portfolio shows a ranked idea awaiting selection */
  };

  // ─── 2.4: deepened projects (shared assessment block schema) ───
  data.projects = {
    0: { startupCost:'$170K', rolloutCost:'$50K', runningCost:'$60K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut median inquiry handle time 30% across two service queues within 60 days.',
      deliverables:'Triage classifier in production; routing rules; QA dashboard.',
      timeline:'Prototype 3 weeks, pilot 4 weeks, rollout 2 weeks.',
      resources:'1 ML engineer, 1 ops analyst, $220K.',
      risks:'Misrouting edge cases; agent trust in early weeks.',
      metrics:'Median handle time; misroute rate < 4%.',
      gap:{ skillsH:'Strong support ops team', skillsN:'Prompt engineering depth', resourcesH:'Queue data, labeled history', resourcesN:'Eval tooling', technologyH:'CRM APIs in place', technologyN:'LLM gateway' },
      swot:{ strengths:'Clean historical data; strong sponsor.', weaknesses:'No in-house eval harness.', opportunities:'Pattern reusable across three queues.', threats:'Vendor pricing shifts.' },
      partInt:'IT platform team for gateway.', partExt:'LLM vendor solutions engineer.',
      rescore:{ priority:9, risk:9, value:9, costScore:9, difficulty:8 }, rescoreDone:true },
    1: { startupCost:'$680K', rolloutCost:'$170K', runningCost:'$180K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut inventory write-offs 15% via foundation-model demand forecasting.',
      deliverables:'SKU-level forecast service; planner workbench integration.',
      timeline:'Data prep 4 weeks, model 4 weeks, pilot 4 weeks.',
      resources:'1 data scientist, 1 data engineer, $850K.',
      risks:'Data quality in long-tail SKUs; planner adoption.',
      metrics:'Write-off rate (4-week moving average).',
      gap:{ skillsH:'Forecasting team in place', skillsN:'Foundation-model fine-tuning', resourcesH:'3 years sales history', resourcesN:'Feature store', technologyH:'Warehouse on BigQuery', technologyN:'Model serving infra' },
      swot:{ strengths:'Rich history; clear baseline.', weaknesses:'Long time-to-value.', opportunities:'Extends to procurement planning.', threats:'Demand shocks invalidate training data.' },
      partInt:'Supply chain planning leads.', partExt:'Cloud provider ML specialists.',
      rescore:{ priority:8, risk:7, value:9, costScore:7, difficulty:9 }, rescoreDone:true },
    2: { startupCost:'$250K', rolloutCost:'$60K', runningCost:'$90K', viable:true, assessed:true,
      objectives:'Unify CRM, contract, and product data into a rep-facing account graph.',
      deliverables:'Knowledge graph; rep sidebar; refresh pipeline.',
      timeline:'Schema 3 weeks, ingest 5 weeks, UI 4 weeks.',
      resources:'1 data engineer, 0.5 PM, $310K.',
      risks:'Entity resolution quality; CRM data hygiene.',
      metrics:'Rep prep time per account; data coverage %.',
      gap:{ skillsH:'CRM admin expertise', skillsN:'Graph modeling', resourcesH:'Contract repository', resourcesN:'Entity-resolution tooling', technologyH:'CRM + CLM APIs', technologyN:'Graph database' },
      swot:{ strengths:'High strategic pull from sales.', weaknesses:'Ambiguous near-term ROI.', opportunities:'Foundation for assistant features.', threats:'Scope creep across data owners.' },
      partInt:'Sales ops; legal for contract access.', partExt:'Graph DB vendor.' },
    3: { viable:false, noGoReason:'Document Intelligence overlaps the dormant classification project; revisit after vendor consolidation in Q3.' },
    4: { startupCost:'$150K', rolloutCost:'$270K', runningCost:'$110K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Catch 80% of line failures 48 hours before production impact.',
      deliverables:'Anomaly models on sensor streams; alerting into maintenance workflow.',
      timeline:'Sensor audit 2 weeks, models 4 weeks, pilot 4 weeks.',
      resources:'1 ML engineer, plant liaison, $420K.',
      risks:'Sensor coverage gaps on older lines.',
      metrics:'Detection lead time; false-positive rate.',
      gap:{ skillsH:'Reliability engineering team', skillsN:'Streaming ML ops', resourcesH:'High-quality sensor data', resourcesN:'Edge compute budget', technologyH:'Historian database', technologyN:'Streaming pipeline' },
      swot:{ strengths:'Sensor data quality high.', weaknesses:'Edge deployment unproven.', opportunities:'Insurance premium reduction.', threats:'Plant network constraints.' },
      partInt:'Plant operations leads.', partExt:'Sensor platform vendor.',
      rescore:{ priority:8, risk:8, value:8, costScore:8, difficulty:9 }, rescoreDone:true },
    11: { startupCost:'$205K', rolloutCost:'$55K', runningCost:'$70K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut sourcing cycle time 25% on indirect spend within one quarter.',
      deliverables:'RFQ drafting assistant; bid comparison view; pricing history index.',
      timeline:'Pricing index 3 weeks, assistant 4 weeks, pilot 4 weeks.',
      resources:'1 engineer, procurement analyst, $260K.',
      risks:'Supplier data quality; buyer adoption.',
      metrics:'Sourcing cycle time; assisted-RFQ share.',
      gap:{ skillsH:'Category expertise', skillsN:'Retrieval tuning', resourcesH:'5 years PO history', resourcesN:'Clean supplier master', technologyH:'ERP APIs', technologyN:'Document pipeline' },
      swot:{ strengths:'Clear baseline metrics.', weaknesses:'Fragmented supplier data.', opportunities:'Extends to contract renewals.', threats:'Supplier pushback on comparisons.' },
      partInt:'Procurement category leads.', partExt:'ERP vendor services.',
      rescore:{ priority:8, risk:6, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    12: { startupCost:'$80K', rolloutCost:'$10K', runningCost:'$25K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut invoice coding effort 50% and shorten month-end close by one day.',
      deliverables:'GL-code suggestion service inside the AP workflow; exception queue.',
      timeline:'Data prep 2 weeks, model 3 weeks, pilot 3 weeks.',
      resources:'1 engineer part-time, AP lead, $90K.',
      risks:'Edge-case codings; auditor acceptance.',
      metrics:'Auto-coding acceptance rate; close duration.',
      gap:{ skillsH:'AP process knowledge', skillsN:'ML ops basics', resourcesH:'3 years coded invoices', resourcesN:'Eval set', technologyH:'AP workflow APIs', technologyN:'None significant' },
      swot:{ strengths:'Cheap, fast, measurable.', weaknesses:'Limited strategic upside.', opportunities:'Pattern reusable in expenses.', threats:'ERP upgrade mid-project.' },
      partInt:'Controller and AP team.', partExt:'None.',
      rescore:{ priority:6, risk:8, value:6, costScore:8, difficulty:7 }, rescoreDone:true },
    13: { startupCost:'$200K', rolloutCost:'$310K', runningCost:'$140K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Catch 90% of visual defects at final assembly before packaging.',
      deliverables:'Camera stations on two lines; defect models; operator review screen.',
      timeline:'Camera install 4 weeks, models 6 weeks, pilot 6 weeks.',
      resources:'1 ML engineer, quality engineer, $510K.',
      risks:'Lighting variance; defect-class long tail.',
      metrics:'Escaped-defect rate; false-reject rate.',
      gap:{ skillsH:'Quality engineering', skillsN:'Computer vision', resourcesH:'Defect photo archive', resourcesN:'Labeling budget', technologyH:'Line PLC integration', technologyN:'Camera infrastructure' },
      swot:{ strengths:'Strong cost-of-quality case.', weaknesses:'Long setup before signal.', opportunities:'Extends to incoming inspection.', threats:'Line-speed constraints.' },
      partInt:'Plant quality leads.', partExt:'Vision platform vendor.',
      rescore:{ priority:8, risk:4, value:9, costScore:4, difficulty:5 }, rescoreDone:true },
    14: { startupCost:'$180K', runningCost:'$55K', viable:true, assessed:true,
      objectives:'Flag 70% of churning accounts at least 30 days before cancellation.',
      deliverables:'Weekly churn-risk scores in the CRM; playbook triggers for CS team.',
      timeline:'Feature build 3 weeks, model 3 weeks, CS pilot 4 weeks.',
      resources:'1 data scientist, CS ops lead, $180K.',
      risks:'Label leakage; alert fatigue in CS.',
      metrics:'30-day detection rate; save rate on flagged accounts.',
      gap:{ skillsH:'CS process maturity', skillsN:'Feature engineering depth', resourcesH:'Usage telemetry', resourcesN:'Outcome labels pre-2024', technologyH:'CRM integration', technologyN:'Scoring pipeline' },
      swot:{ strengths:'Direct revenue protection.', weaknesses:'History shallow on outcomes.', opportunities:'Feeds expansion-signal models.', threats:'CS staffing for follow-up.' },
      partInt:'Customer success leadership.', partExt:'CRM vendor data services.',
      rescore:{ priority:7, risk:7, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    15: { startupCost:'$240K', runningCost:'$65K', viable:true, assessed:true,
      objectives:'Cut cost per delivery 8% across the regional fleet within two quarters.',
      deliverables:'Daily route plans into dispatch; driver-app turn list; savings dashboard.',
      timeline:'Data integration 4 weeks, optimizer 4 weeks, depot pilot 5 weeks.',
      resources:'1 engineer, dispatch lead, $240K.',
      risks:'Driver acceptance; address-data quality.',
      metrics:'Cost per delivery; planned-vs-actual route adherence.',
      gap:{ skillsH:'Dispatch expertise', skillsN:'Optimization modeling', resourcesH:'Telematics feed', resourcesN:'Clean address base', technologyH:'Dispatch system APIs', technologyN:'Routing engine' },
      swot:{ strengths:'Hard-dollar savings.', weaknesses:'Change management with drivers.', opportunities:'Extends to fleet sizing.', threats:'Fuel-price volatility masks signal.' },
      partInt:'Regional dispatch managers.', partExt:'Telematics provider.' },
    16: { objectives:'Pilot an on-site troubleshooting assistant that answers from installation manuals and service history, cutting repeat visits on the top five fault categories. Target: resolve 40% of field issues on the first visit with guided troubleshooting.',
      deliverables:'Retrieval index over manuals and service tickets; assistant in the technician mobile app; a 12-technician ride-along pilot; an accuracy evaluation set with sign-off thresholds.',
      timeline:'Index and prototype months 1\u20132; technician pilot Months 3\u20134; evaluation and rollout decision Month 5.',
      resources:'Service ops lead at 25%, two engineers, retrieval-stack vendor; roughly $140K development.',
      risks:'Manual coverage gaps on legacy product lines; wrong torque or spec answers in the field; technician adoption.',
      metrics:'First-visit fix rate +8 points; average handle time \u221215%; assistant answer acceptance above 70% in the pilot.',
      gap:{ skillsH:'Strong service-ops knowledge; two engineers with API experience.', skillsN:'Retrieval evaluation and prompt-safety experience.',
            resourcesH:'Manuals digitized for current lines; service tickets in the CRM.', resourcesN:'Legacy-line manuals need scanning; field devices for the pilot cohort.',
            technologyH:'CRM with full ticket history; shared document store.', technologyN:'Retrieval stack, mobile front end, evaluation harness.' },
      swot:{ strengths:'Rich ticket history; motivated service team; the cost of repeat visits is measured and visible.',
             weaknesses:'Legacy documentation is patchy; field connectivity varies by site.',
             opportunities:'Extends naturally to dealer-network support; feeds the warranty analytics roadmap.',
             threats:'Wrong answers in the field damage technician trust quickly; vendor lock-in on the retrieval stack.' },
      partInt:'IT for CRM and document-store integration; Service Ops for the pilot cohort and playbooks.',
      partExt:'Retrieval-stack vendor; documentation scanning service for legacy manuals.' }
  };

  // ─── Phase 2: Organize ───
  var _ld1=uid(),_ld2=uid(),_sr1=uid(),_sr2=uid();
  data.ownership = {
    ownerName: 'Shalini Mehta', ownerRole: 'VP Innovation',
    authority: 'Full budget authority for AI portfolio under $2M per initiative.',
    leads: [ { id:_ld1, name:'Vincent Lau', dept:'Engineering' }, { id:_ld2, name:'Harriet Rivers', dept:'Product' } ],
    seniors: [ { id:_sr1, name:'Imogen Whitfield', role:'CEO' }, { id:_sr2, name:'Daniel Reyes', role:'CFO' } ]
  };
  data.incentives = {
    current: 'Annual targets, individual MBOs, no innovation metric.',
    changes: 'Quarterly OKRs with explicit experimentation budget; team-based learning targets.',
    metrics: ['Active experiments','Kill speed','Support for experimentation','Time-to-value']
  };
  data.rhythm = { day:'Tue', time:'9:00 AM', attendees:['Shalini Mehta','Vincent Lau','Harriet Rivers'], agendaList:['Development gate reviews','Blocker triage','Experiment outcomes'] };
  data.raci = {};
  (function(){var _pp=['owner',_ld1,_ld2,_sr1,_sr2,'finance'];
  [['A','R','C','I','I','C'],   // Approve experiments – Shalini owns the call, Vincent runs the assessment
   ['A','R','C','I','C','C'],   // Advance projects
   ['R','C','I','I','A','C'],   // Allocate budget – the CFO owns the outcome
   ['A','R','C','I','C','I'],   // Kill projects
   ['A','C','R','I','I','I'],   // Pipeline reporting – Harriet assembles it
   ['A','R','R','I','I','C'],   // Weekly session
   ['A','C','C','C','R','R']    // Quarterly review – finance runs the numbers
  ].forEach(function(row,ai){row.forEach(function(v,ci){if(v)data.raci[ai+':'+_pp[ci]]=v})})})();

  // ─── Phase 3: Prepare (post-rework bands) ───
  data.portfolio = {
    0: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Fast proof point; funds learning for the bigger bets.' },
    1: { horizon:'long',   risk:'high',   reward:'high',   notes:'Anchor bet; longest time-to-value in the portfolio.' },
    2: { horizon:'medium', risk:'medium', reward:'medium', notes:'Platform play; value compounds with later projects.' },
    4: { horizon:'quick',  risk:'medium', reward:'high',   notes:'Operational risk reduction with measurable downtime impact.' },
    11: { horizon:'medium', risk:'medium', reward:'high',  notes:'Solid sourcing economics; balances the vision bet.' },
    12: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Cheap quick win; keeps near-term value flowing.' },
    13: { horizon:'long',   risk:'high',   reward:'high',  notes:'Second anchor bet; quality economics justify the horizon.' }
  };
  var _psd=new Date(sd);_psd.setDate(1);var _psISO=_psd.toISOString().split('T')[0];
  data.capital = {
    aiBudget: '$2.4M',
    envYears: '3',
    budgetY2: '$2.6M',
    budgetY3: '$2.8M',
    periodStart: _psISO,
    susCap: '40',
    reserveY2: '$700K',
    reserveY3: '$700K',
    reallocation: '',
    gapPlan: '',
    fundLines: [
      {id:'fl1', d:'Reallocation \u2013 dormant document-classification project', a:'$250K', y:'1', proj:'', st:'planned'},
      {id:'fl2', d:'Reallocation \u2013 Q1 marketing reserve', a:'$150K', y:'1', proj:'', st:'planned'},
      {id:'fl3', d:'Additional budget request at the month-2 gate review \u2013 contingent on triage pilot results', a:'$300K', y:'1', proj:'AI-Assisted Customer Triage', st:'planned'}
    ]
  };
  data.capAlloc = {}; /* gateRows retired (July 5): gate criteria live on the
    program phases as exit criteria; release amounts had no engine effect. */

  // ─── 3.3: experiment briefs (live schema) ───
  data.budgetPlans = {
    0: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp0a',name:'Triage model & routing rules',desc:'Intent model and routing rules on ticket history',from:'1',to:'2',cost:'$110K',powner:'Vincent Lau',pmetric:'Shadow-mode routing accuracy',pexit:'Pilot routing accuracy \u2265 90% in shadow mode'},
               {id:'bp0b',name:'Agent-assist integration',desc:'Desk integration and agent-assist surfaces',from:'2',to:'3',cost:'$60K',powner:'Vincent Lau',pmetric:'Misroute rate on live queues',pexit:'Two queues live with misroute rate < 4%'} ],
         roll:[ {id:'bp0c',name:'Support-team rollout',desc:'Rollout across support teams',from:'3',to:'8',cost:'$50K'} ],
         sus:[ {id:'bp0d',name:'Ongoing operation',from:'9',to:'ongoing',items:[ {id:'bpi0a',name:'Model hosting & monitoring',cost:'$35K'}, {id:'bpi0b',name:'Content & routing upkeep',cost:'$25K'} ]} ] },
    11:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp11a',name:'Observation & design',desc:'Shadow two buyers through complete sourcing cycles on indirect categories. Capture where time is lost between RFQ request and award, document the pricing references buyers actually consult, and specify the copilot workflows against those failure points.',from:'1',to:'1',cost:'$15K',powner:'Harriet Rivers',pmetric:'A documented map of the current sourcing cycle with measured stage times for at least ten live RFQs, and a signed-off specification for the three copilot workflows.',pexit:'The procurement lead signs off the specification and the baseline cycle-time measurements that later phases will be judged against.'},
               {id:'bp11b',name:'Paper prototype',desc:'Mock the RFQ drafting flow and the bid comparison view on paper. Walk four buyers through real historical RFQs using the mocks, with no code built, and revise until the workflow matches how buyers actually evaluate bids.',from:'1',to:'2',cost:'$20K',powner:'Harriet Rivers',pmetric:'Four buyers complete a full mock sourcing cycle. Task-completion notes and a revision log are captured for every session.',pexit:'Buyers can complete the mock cycle without facilitator help, and no open workflow objections remain from the prototype group.'},
               {id:'bp11c',name:'Experiment',desc:'Build the working copilot on the ingested catalog and policy data. Run it in shadow mode against live RFQs, with the copilot drafting in parallel while buyers work normally, and compare its drafts and price references against what the buyers produced.',from:'2',to:'3',cost:'$95K',powner:'Arvind Nair',pmetric:'Draft acceptance rate and pricing-index coverage across at least 30 shadow RFQs. Target coverage of 80% of indirect spend, with drafts rated usable in two thirds of cases.',pexit:'Shadow results meet the coverage and usability targets, and the buyer panel agrees the drafts are safe to put in front of suppliers.'},
               {id:'bp11d',name:'Pilot',desc:'Run the copilot live in two indirect categories with the pilot buyer group. Measure sourcing cycle time against the phase-one baseline and track every case where a buyer overrides or corrects the copilot output.',from:'3',to:'4',cost:'$55K',powner:'Harriet Rivers',pmetric:'Cycle time on pilot categories versus baseline, override rate, and buyer satisfaction from structured debriefs. Target a 15% cycle-time reduction with overrides falling week on week.',pexit:'Assisted RFQs live in two categories with the cycle-time target met, and no unresolved data or policy incidents in the pilot log.'},
               {id:'bp11e',name:'Rollout preparation',desc:'Harden the service for the whole procurement team. Finish access controls and audit logging, write the training materials from real pilot cases, and agree the support handover with the platform team.',from:'4',to:'4',cost:'$20K',powner:'Tom\u00e1s Vega',pmetric:'A training pack tested with two buyers from outside the pilot, audit logging verified on every copilot action, and a signed support runbook.',pexit:'The operations review accepts the runbook and the rollout plan, clearing the project to enter the rollout step.'} ],
         roll:[ {id:'bp11c',name:'Procurement-team rollout',desc:'Rollout to the procurement team, including first-year running',from:'5',to:'18',cost:'$55K'} ],
         sus:[ {id:'bp11d',name:'Ongoing operation',from:'19',to:'ongoing',items:[ {id:'bpi11a',name:'Hosting & vendor-data upkeep',cost:'$40K'}, {id:'bpi11b',name:'Policy maintenance',cost:'$30K'} ]} ] },
    12:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp12a',name:'Coding model build',desc:'Coding model trained on historical invoices',from:'1',to:'2',cost:'$80K',powner:'Vincent Lau',pmetric:'Suggestion acceptance rate in shadow mode',pexit:'Suggestion acceptance \u2265 85% in shadow mode'} ],
         roll:[ {id:'bp12b',name:'Finance-team rollout',desc:'Finance-team rollout, including first-year running',from:'3',to:'15',cost:'$10K'} ],
         sus:[ {id:'bp12c',name:'Ongoing operation',from:'16',to:'ongoing',items:[ {id:'bpi12a',name:'Hosting & rules upkeep',cost:'$25K'} ]} ] },
    2: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'skg1',name:'Schema & graph model',from:'1',to:'1',cost:'$60K'},
               {id:'skg2',name:'Ingest & entity resolution',from:'2',to:'3',cost:'$120K'},
               {id:'skg3',name:'Rep sidebar UI',from:'3',to:'4',cost:'$70K'} ],
         roll:[ {id:'skg4',name:'Rollout to the sales team',from:'5',to:'7',cost:'$60K'} ],
         sus:[ {id:'skg5',name:'Run & refresh',from:'8',to:'ongoing',items:[ {id:'skg5a',name:'Graph DB & hosting',cost:'$50K'}, {id:'skg5b',name:'Refresh pipeline & data stewardship',cost:'$40K'} ]} ] },
    14:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'chn1',name:'Features & outcome labels',from:'1',to:'2',cost:'$70K'},
               {id:'chn2',name:'Model build & validation',from:'2',to:'3',cost:'$60K'},
               {id:'chn3',name:'CS pilot',from:'3',to:'4',cost:'$50K'} ],
         roll:[],
         sus:[ {id:'chn4',name:'Run & retrain',from:'5',to:'ongoing',items:[ {id:'chn4a',name:'Scoring pipeline & monitoring',cost:'$35K'}, {id:'chn4b',name:'Model retraining',cost:'$20K'} ]} ] },
    15:{ horizon:'3', contingency:'', notes:{},
         dev:[ {id:'lro1',name:'Data integration',from:'1',to:'2',cost:'$80K'},
               {id:'lro2',name:'Optimizer build',from:'2',to:'3',cost:'$90K'},
               {id:'lro3',name:'Depot pilot',from:'4',to:'5',cost:'$70K'} ],
         roll:[],
         sus:[ {id:'lro4',name:'Run & tune',from:'6',to:'ongoing',items:[ {id:'lro4a',name:'Solver hosting & tuning',cost:'$40K'}, {id:'lro4b',name:'Address-data upkeep',cost:'$25K'} ]} ] },
    16:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'fs1',name:'Retrieval index & prototype',from:'1',to:'2',cost:'$60K'},
               {id:'fs2',name:'Technician pilot build',from:'3',to:'4',cost:'$50K'},
               {id:'fs3',name:'Evaluation & hardening',from:'5',to:'5',cost:'$30K'} ],
         roll:[ {id:'fs4',name:'Field rollout \u2013 wave 1',from:'6',to:'8',cost:'$45K'},
                {id:'fs5',name:'Dealer network extension',from:'9',to:'11',cost:'$30K'} ],
         sus:[ {id:'fs6',name:'Run & refresh',from:'12',to:'ongoing',items:[ {id:'fs6a',name:'Hosting & retrieval stack',cost:'$18K'}, {id:'fs6b',name:'Manual refresh & evaluation',cost:'$12K'} ]} ] },
    1: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp1a',name:'Data audit & feasibility',desc:'Historical sales data quality, sources, and feasibility review',from:'1',to:'3',cost:'$120K',powner:'Harriet Rivers',pmetric:'Source-data coverage of the SKU range',pexit:'Data audit signed off \u2013 sources complete and usable'},
               {id:'bp1b',name:'Model build & validation',desc:'Forecast model development, backtesting, and accuracy validation',from:'3',to:'12',cost:'$460K',powner:'Harriet Rivers',pmetric:'Forecast lift on the 200 highest-variance SKUs',pexit:'Holdout evaluation shows forecast lift over baseline'},
               {id:'bp1c',name:'Extended backtesting',desc:'Second-season validation across the full product range',from:'13',to:'14',cost:'$100K',powner:'Harriet Rivers',pmetric:'Accuracy across the full product range',pexit:'Second-season backtest \u2265 baseline accuracy portfolio-wide'} ],
         roll:[ {id:'bp1d',name:'Planning integration & training',desc:'ERP integration and planner training',from:'15',to:'18',cost:'$170K'} ],
         sus:[ {id:'bp1e',name:'Ongoing operation',from:'19',to:'ongoing',items:[
               {id:'bpi1a',name:'Model & API usage',cost:'$90K'},{id:'bpi1b',name:'Data platform & pipelines',cost:'$60K'},{id:'bpi1c',name:'Forecast ops support',cost:'$30K'}]} ] },
    4: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp4a',name:'Site survey & sensor pilot',desc:'Line 1 sensor pilot and data capture',from:'1',to:'2',cost:'$40K'},
               {id:'bp4b',name:'Model build & validation',desc:'Failure-prediction models on pilot data',from:'2',to:'5',cost:'$110K'} ],
         roll:[ {id:'bp4c',name:'Line 1 instrumentation & launch',desc:'Sensors, gateways, and alerting on line 1',from:'5',to:'10',cost:'$180K'},
                {id:'bp4d',name:'Remaining lines rollout',desc:'Sensor coverage across all remaining production lines',from:'11',to:'14',cost:'$90K'} ],
         sus:[ {id:'bp4e',name:'Ongoing operation',from:'15',to:'ongoing',items:[
               {id:'bpi4a',name:'Sensor & gateway upkeep',cost:'$45K'},{id:'bpi4b',name:'Platform & alerting',cost:'$40K'},{id:'bpi4c',name:'Model tuning',cost:'$25K'}]} ] },
    13:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'bp13a',name:'Camera trials & data collection',desc:'Rig trials and a defect image library on line A',from:'1',to:'3',cost:'$50K',powner:'Harriet Rivers',pmetric:'Labeled defect-set completeness',pexit:'Camera install and labeled defect set complete'},
               {id:'bp13b',name:'Vision model development',desc:'Defect-detection model training and validation',from:'3',to:'9',cost:'$150K',powner:'Harriet Rivers',pmetric:'Defect detection rate on the pilot line',pexit:'Pilot detection \u2265 90% on line 2'} ],
         roll:[ {id:'bp13c',name:'Line A cameras & rigs',desc:'Production install and launch on line A',from:'10',to:'12',cost:'$120K'},
                {id:'bp13d',name:'Full line coverage',desc:'Cameras and rigs across the remaining assembly lines',from:'13',to:'16',cost:'$190K'} ],
         sus:[ {id:'bp13e',name:'Ongoing operation',from:'17',to:'ongoing',items:[
               {id:'bpi13a',name:'Camera & rig maintenance',cost:'$50K'},{id:'bpi13b',name:'Vision platform licenses',cost:'$55K'},{id:'bpi13c',name:'Model retraining',cost:'$35K'}]} ] }
  };
  data.experiments = {
    0: { budget:'$170K' },
    1: { budget:'$680K' },
    4: { budget:'$150K' },
    11: { budget:'$205K' },
    12: { budget:'$80K' },
    13: { budget:'$200K' }
  };
  data.expSelected = [0,1,4,11,12,13];

  // ─── Phase 4: Ignite — two launched, one running ───
  data.tracking = {
    0: { status:'complete', results:'Week 5: median handle time down 34% in both pilot queues; misroute rate 2.8%.', infraLearnings:'Budget release at Gate 1 took two days \u2013 gate process working.', breakWork:'Working: ownership model, weekly rhythm. Breaking: QA review queue at volume.' },
    1: { status:'complete', results:'Holdout forecast beat baseline by 19%; planner pilot adopted in two regions.', infraLearnings:'Feature-store gap cost three weeks; now budgeted as shared infrastructure.', breakWork:'Working: data partnership with supply chain. Breaking: cross-region change management.' },
    4: { status:'complete', results:'Week 7: 82% of failures detected at 48h lead; false-positive rate 6%. Fleet rollout approved.', infraLearnings:'Edge compute procurement slower than cloud \u2013 flag for governance.', breakWork:'Working: plant liaison model. Breaking: sensor coverage on line 4.' },
    11: { status:'running', results:'Week 4: pricing index covering 84% of indirect spend; assisted RFQs in first category.', infraLearnings:'Supplier master cleanup was the hidden cost \u2013 two weeks of analyst time.', breakWork:'Working: category-lead partnership. Breaking: legal review loop on RFQ templates.' },
    12: { status:'running', results:'Week 3: shadow-mode acceptance at 81% and climbing as the eval set grows.', infraLearnings:'Smallest experiment in the portfolio \u2013 proof that the pipeline handles low-cost bets.', breakWork:'Working: AP team engagement. Breaking: nothing significant.' },
    13: { status:'running', results:'Week 5: cameras live on the pilot line; labeling at 60% with two defect classes ahead of plan.', infraLearnings:'Camera procurement hit the same governance lag as edge compute \u2013 pattern for the review.', breakWork:'Working: plant quality partnership. Breaking: labeling vendor throughput.' }
  };
  data.launched = [0,1,4];
  data.opsData = {
    0: { health:'green', launchDate:new Date(sd.getTime()+86400000*52).toISOString().split('T')[0], performance:'Handle time steady at 65% of baseline; misroute rate 2.5% and falling.', notes:'Week 2 operational: added third queue; agent satisfaction up.' },
    1: { health:'amber', launchDate:new Date(sd.getTime()+86400000*63).toISOString().split('T')[0], performance:'Write-offs tracking \u221212% vs target \u221215%; two regions live.', notes:'Region 3 rollout paused pending data-quality fix on legacy SKUs.' },
    4: { health:'green', launchDate:new Date(sd.getTime()+86400000*66).toISOString().split('T')[0], performance:'Fleet rollout underway; detection holding at 80%+ across three lines.', notes:'Maintenance scheduling now consuming alerts directly; insurance review booked.' }
  };

  // ─── 4.2 / 4.3 ───
  data.governance = {
    meeting:'Monthly executive review', threshold:'$500k',
    metrics:'Learning velocity, capital efficiency, customer impact',
    format:'30-min gate review per active project',
    gateProcess:'Buy / Hold / Sell decision with sponsor sign-off',
    outsideAudit:'Quarterly \u2013 pipeline owner sweeps departmental spend and vendor contracts for AI work outside the pipeline', firstReview:'End of week 12',
    reviewAttendees:'CEO, CFO, CIO, Phase Owner, Innovation Council',
    reviewAgenda:'Portfolio health \u00b7 Capital \u00b7 Lessons \u00b7 Next bets'
  };
  data.stress = {
    decisions:'Mostly working; budget reallocation still a multi-week loop.', decisionsScore:4,
    ownership:'Central owner working well; one embedded lead overwhelmed.', ownershipScore:3,
    incentives:'Early signs in sales; manufacturing still on old metrics.', incentivesScore:3,
    culture:'Weekly rhythm helping; some "not my job" still showing up.', cultureScore:3,
    tuningList:['Add backup phase owner','Shorten budget loop to 1 week','Manufacturing OKR refresh','','']
  };

  // ─── Review (4.4) left open — the demo ends mid-first-review ───
  data.review = { /* 17 Sep 2026 (Paul's ruling): the first quarterly review, seeded \u2014 a decision with its reason on each of the nine live initiatives, and the five learnings */
    items:{
      0:{decision:'buy',rationale:'Handle time is down a third with agent adoption at 94%. Scale to the remaining queues and the outsourced desk.'},
      1:{decision:'hold',rationale:'The write-off rate is moving, but the forecast still overshoots on new products. Hold the footprint until the retrain lands and the amber clears.'},
      4:{decision:'buy',rationale:'Two of three lines covered and downtime avoided is ahead of plan. Extend to the third line and the finishing cells.'},
      11:{decision:'hold',rationale:'The paper prototype landed well, but the live experiment has not started. Hold at the current budget until phase 3 reports.'},
      12:{decision:'hold',rationale:'Acceptance at 88% against a target of 85% after four weeks. Hold at the current plan and complete the rollout phase before scaling.'},
      13:{decision:'hold',rationale:'Detection is ahead of target on the pilot line. Hold until the phase-2 gate next month; the case for scaling is already made.'},
      2:{decision:'hold',rationale:'The Go verdict stands, but the data-stewardship gap is not closed. Hold until the CRM owner is named.'},
      14:{decision:'buy',rationale:'The highest score in exploration and a quick win. Advance in the next batch.'},
      15:{decision:'sell',rationale:'The lowest score in the set, and the carrier data cannot be obtained this year. Release the slot.'}
    },
    newOpportunities:'1. AI-assisted inventory forecasting, raised by Operations after the demand model\u2019s write-off results.\n2. Contract-clause extraction for Legal, a natural extension of the document-classification work.',
    balance:'Heavy on quick wins in operation and medium-term bets in development; no long-term bet is live. The next batch should carry one.',
    worked:'The weekly rhythm survived the quarter. Gate reviews were taken on the day in five cases out of six.',
    didnt:'Budget reallocation between projects took three weeks each time. The Finance column on the RACI did not translate into a fast path.',
    nextCycle:'A mid-quarter reallocation window. A deputy for gate reviews when the owner travels. The Legal opportunity scoped before the next review.'
  };
  if(!data.tracking[15])data.tracking[15]={};data.tracking[15].status='killed'; /* the Sell kills it, as the step does */
  data.reviewCycles = []; // seed order-independence: the Y2 seed writes cycle history; base must clear it (July 8)
  data.notifications = []; data.remind7 = {}; data.archivedItems = {}; data.chatMsgs = []; // "overwrites any existing entries" made literally true (Paul's ruling, July 8): runtime keys the builder never assigned used to survive a re-seed

  // ─── Completion state ───
  data.completedSections = { '1.1':true,'1.2':true,'1.3':true,'1.4':true,'1.5':true };
  data.completedSteps = { '1.1':true,'1.2':true,'1.3':true,'2.1':true,'2.2':true,'2.3':true,'2.4':true,'3.1':true,'3.2':true,'3.3':true,'3.4':true,'4.1':true,'4.2':true,'4.3':true,'4.4':true } /* 17 Sep 2026 (Paul's ruling): Phase 4 complete in the seed */;
  // ─── Module Management seed: completion history, roster, assignments, deadlines (July 5) ───
  var _dISO=function(dd){var t=new Date(sd);t.setDate(t.getDate()+dd);return t.toISOString().split('T')[0]};
  data.stepDoneAt = { '1.1':_dISO(8),'1.2':_dISO(13),'1.3':_dISO(18),'2.1':_dISO(26),'2.2':_dISO(31),'2.3':_dISO(34),'2.4':_dISO(39),'3.1':_dISO(47),'3.2':_dISO(53),'3.3':_dISO(59),'3.4':_dISO(64),'4.1':_dISO(68) };
  data.stepDue = { '4.2':_dISO(76), '4.3':_dISO(80), '4.4':_dISO(88) };
  var _seedRoster=[
    {id:'su1',name:'Vincent Lau',username:'vlau',role:'Head of Customer Operations',initials:'VL',color:'#1B6B5A',scope:'All'},
    {id:'su2',name:'Harriet Rivers',username:'hrivers',role:'Operational Excellence Lead',initials:'HR',color:'#2D5A8E',scope:'All'},
    {id:'su3',name:'Arvind Nair',username:'anair',role:'Chief Technology Officer',initials:'AN',color:'#8B5E3C',scope:'All'},
    {id:'su4',name:'Tom\u00e1s Vega',username:'tvega',role:'Finance Director',initials:'TV',color:'#9B2D3F',scope:'All'},
    {id:'su5',name:'Ray Caruso',username:'rcaruso',role:'Plant Manager',initials:'RC',color:'#6B4C8A',scope:'All'},
    {id:'su6',name:'Anders Lindqvist',username:'alindqvist',role:'Head of Sales',initials:'AL',color:'#C25B73',scope:'All'},
    {id:'su7',name:'Glen Hodges',username:'ghodges',role:'Data & Analytics Lead',initials:'GH',color:'#4FB39A',scope:'All'},
    {id:'su8',name:'Duncan Fairley',username:'dfairley',role:'HR Director',initials:'DF',color:'#D4A017',scope:'All'}
  ];
  data.chatMsgs=[
    {who:'VL',name:'Vincent Lau',ts:'8:52 AM',text:'Morning all. Phase 4 is underway and the tracker is current. Governance setup is the next milestone, due on the 11th.'},
    {who:'AN',name:'Arvind Nair',ts:'9:03 AM',text:'Shadow-mode numbers for the sourcing copilot land tomorrow. Coverage of indirect spend looks strong and draft acceptance is tracking just under the two-thirds target.'},
    {who:'TV',name:'Tom\u00e1s Vega',ts:'9:10 AM',text:'Reminder that the $300K request for AI-Assisted Customer Triage is still a planned funding line. I need the gate evidence before it goes to the capital group.'},
    {who:'GH',name:'Glen Hodges',ts:'9:18 AM',text:'Draft decision-rights matrix for the governance step is with Arvind for review. I will bring the data-access sections to the working session.'},
    {who:'RC',name:'Ray Caruso',ts:'9:26 AM',text:'Floor walk for the stress-test is booked for next week. I will have the line supervisors join the org design session.'},
    {who:'DF',name:'Duncan Fairley',ts:'9:34 AM',text:'Portfolio review is on the calendar for day 88. Send me kill and continue recommendations a week ahead so the panel has time to read them.'}
  ];
  /* seed reset rule (July 9, extends the July 8 literal-overwrite ruling): F3 returns the roster to
     the org's admin account(s) plus a fresh su1-su8. Renames, extra members, and email edits from a
     testing session do not survive a reseed. Admin accounts survive because the signed-in user is one. */
  var _keepAdmins=(Array.isArray(data.roster)?data.roster:[]).filter(function(x){return x&&x.admin===true});
  data.roster=_keepAdmins.concat(JSON.parse(JSON.stringify(_seedRoster)));
  data.assigns = { '1.1':['su3','su8'],'1.2':['su1','su7'],'1.3':['su1'],'2.1':['su8'],'2.2':['su8','su4'],'2.3':['su2'],'2.4':['su3'],'3.1':['su1','su2'],'3.2':['su4'],'3.3':['su4','su3'],'3.4':['su1','su2'],'4.1':['su2'],'4.2':['su3','su7'],'4.3':['su8'],'4.4':['su4','su1'] };
  applyTeamRoster();

  // ─── Notes (live schema: id / createdAt / step) ───
  data.notes = [
    { id:'sn1', createdAt:Date.now()-172800000, step:'4.1', text:'Arvind to circulate the shadow-mode results before the experiment gate on the sourcing copilot.' },
    { id:'sn2', createdAt:Date.now()-86400000, step:'3.3', text:'Tom\u00e1s needs month-two gate evidence before the $300K triage funding line goes to the capital group.' },
    { id:'sn3', createdAt:Date.now()-3600000, step:'4.4', text:'Book the portfolio review for the week of day 88 and circulate the agenda in advance.' }
  ];

  // ─── Assignments seeded above (su1–su8 live in the roster); keep only real roster ids, never ghosts ───
  var rIds=(data.roster||[]).map(function(u){return u.id});
  Object.keys(data.assigns||{}).forEach(function(sk){ data.assigns[sk]=(data.assigns[sk]||[]).filter(function(x){return rIds.indexOf(x)>=0}); });
}

/* Persist the whole seed to the database: the demo TEAM + step ASSIGNMENTS into
   the normalized `users`/`step_assignments` tables, and the WORKSPACE document
   (ideas, portfolio, progress, …) as one authoritative save.

   `seedDoc` is the freshly built document, captured by the caller BEFORE any
   async work so this is immune to the change-poll swapping the global `data`
   out from under us mid-flight (that race is exactly what left a new org with a
   roster but no ideas). We POST the seeded members to /seed (server replaces the
   org's previous seed cohort and returns local_id → public_id), stamp those ids
   onto the captured doc's roster, then Store.commitSeed() force-saves the doc
   with base_rev:null so the seed content can't be discarded by a stale-write
   merge. commitSeed always runs — even if the team sync fails or there are no
   new members — so the workspace content lands regardless.

   No-ops when the app runs from disk (file://) or the org isn't linked to a DB
   record — the seed still works locally, it just isn't mirrored. */
function syncSeedToServer(seedDoc, actorOverride) {
  try {
    seedDoc = seedDoc || (typeof data !== 'undefined' ? data : null);
    if (!seedDoc) return;
    var orgSid = (typeof orgServerId === 'function') ? orgServerId() : null;
    /* The actor is whoever PRESSED the button, captured by runSeed before the
       seed ran — not whoever is signed in now. A seed may replace the roster and
       the session as part of its sample data: Executive Readiness signs in as
       its facilitator, a member who does not exist in the database yet and so
       has no serverId. Reading actorId() here then returned '' and this function
       bailed one line later, which meant that program's sample workspace saved
       to the browser and never reached the database at all. */
    var actor = actorOverride || ((typeof actorId === 'function') ? actorId() : '');
    if (!orgSid || !actor) return;

    // Save the workspace document authoritatively, then keep the on-screen data
    // consistent with exactly what was persisted.
    function commitWorkspace() {
      if (typeof Store === 'undefined' || !Store.commitSeed) return;
      Store.commitSeed(orgSid, seedDoc, function (ok) {
        if (ok) {
          if (typeof currentOrgId !== 'undefined' && currentOrgId === orgSid) {
            data = seedDoc; try { applyTeamRoster(); render(); } catch (e) { }
          }
        } else if (typeof showToast === 'function') {
          showToast('The sample workspace could not be saved to the database.', 'error');
        }
      }, actor);   // whoever pressed Seed — see runSeed
    }

    var roster = Array.isArray(seedDoc.roster) ? seedDoc.roster : [];
    var members = roster.filter(function (u) {
      return u && !u.serverId && (u.username || '').trim();   // the freshly seeded members
    }).map(function (u) {
      return {
        local_id: u.id, name: u.name || '', username: (u.username || '').trim(),
        role: u.role || '', scope: u.scope || 'All',
        email: (u.email || '').trim() || ((u.username || '').trim() + '@example.com'),
        department: u.dept || '',   /* no password: sample people cannot sign in (Directive 2 Oct 2026, 5.2.2) */
        initials: u.initials || '', color: u.color || ''
      };
    });

    // No new members to create (e.g. an unusual roster) — still save the doc.
    if (!members.length) { commitWorkspace(); return; }

    postJSON(API_BASE + '/seed',
      /* The module scopes the ASSIGNMENTS that ride along with the seed; the
         members themselves are the organization's and belong to every program. */
      { org: orgSid, module: (window.Modules && Modules.activeId()) || 'pipeline',
        actor_id: actor, members: members, assignments: seedDoc.assigns || {} },
      function (res) {
        var map = (res && res.data && res.data.map) || {};
        roster.forEach(function (u) { if (u && map[u.id]) u.serverId = map[u.id]; }); // link the captured doc's roster
        commitWorkspace();
        if (typeof showToast === 'function') showToast('Sample data saved to the database — ' + ((res.data && res.data.members) || 0) + ' team members.');
      },
      function (err) {
        commitWorkspace(); // persist the workspace content even if the team sync failed
        if (typeof showToast === 'function') showToast((err && err.message) || 'Could not save the sample team to the database.', 'error');
      }
    );
  } catch (e) { }
}

/* ── Running a program's seed ──────────────────────────────────
   Which sample workspaces exist is the PROGRAM's business — the documents share
   no fields between programs, so there is nothing here for the shell to build.
   Saving one to the database is the SHELL's business, and identical whichever
   program produced it. So the module lists its seeds (Modules.seeds(), see
   js/modules/registry.js) and this runs the chosen one and then persists it.

   The force-save matters. A seed replaces the entire document, and the ordinary
   debounced flush is an optimistic-concurrency write that the change-poll can
   beat — which is how a freshly seeded org ended up with a roster and no
   content. syncSeedToServer() commits with base_rev:null, and commitSeed()
   stamps the active module on the request, so a seed lands in the workspace of
   the program that produced it and nowhere else. */
function runSeed(seedId) {
  var list = (window.Modules && Modules.seeds()) || [];
  var seed = list.filter(function (s) { return s.id === seedId; })[0];
  if (!seed) return;
  /* Read the actor BEFORE the seed runs. A seed may replace the roster and sign
     in as one of its own sample members, and that member is not in the database
     yet — so afterwards there is nobody the API would accept the save from. */
  var actor = (typeof actorId === 'function') ? actorId() : '';
  if (seed.run() === false) return;     // the operator declined the confirm
  render();
  syncSeedToServer(data, actor);        // the freshly built doc, saved authoritatively
}

function seedData() {
  if (!confirm('Load sample data? This overwrites any existing entries.')) return false;
  // Day ~70 of 90 — experiments running, first launches operational
  var sd = new Date();
  sd.setDate(sd.getDate() - 70);
  buildSeedBase(sd);
  saveData();
}

function seedDataY2() {
  if (!confirm('Load the Year 2 sample? This overwrites any existing entries.')) return false;

  // Same portfolio geometry as the base seed, shifted 19 calendar months back:
  // "today" lands late in envelope year 2 (month 22–23 of the 36-month window). (Paul, July 8)
  var sd = new Date();
  sd.setDate(sd.getDate() - 70);
  sd.setMonth(sd.getMonth() - 19);
  buildSeedBase(sd);

  var _dISO = function (dd) { var t = new Date(sd); t.setDate(t.getDate() + dd); return t.toISOString().split('T')[0] };
  var _mTs = function (mm, dd) { var t = new Date(sd); t.setDate(1); t.setMonth(t.getMonth() + (mm - 1)); t.setDate(dd || 10); return t.getTime() }; // envelope month mm (from periodStart) → timestamp
  var _mISO = function (mm, dd) { return new Date(_mTs(mm, dd)).toISOString().split('T')[0] };

  // ─── The 90-day program finished on schedule ───
  data.completedSteps['4.2'] = true; data.completedSteps['4.3'] = true; data.completedSteps['4.4'] = true;
  data.stepDoneAt['4.2'] = _dISO(76); data.stepDoneAt['4.3'] = _dISO(80); data.stepDoneAt['4.4'] = _dISO(88);

  // ─── Quality Inspection Vision (13): track complete, launched by the month-16 review ───
  data.budgetPlans[13].dev[0].pstatus = 'complete'; data.budgetPlans[13].dev[0].gateDec = 'go'; data.budgetPlans[13].dev[0].gateAt = _mTs(6, 5);
  data.budgetPlans[13].dev[1].pstatus = 'complete'; data.budgetPlans[13].dev[1].gateDec = 'go'; data.budgetPlans[13].dev[1].gateAt = _mTs(12, 5);
  data.tracking[13].status = 'complete';
  data.tracking[13].results = 'Development complete at month 11. Detection reached 87% of inspector-found flaws on the pilot line with a 4% false-positive rate. The quarterly review approved the launch.';
  data.launched.push(13);
  data.opsData[13] = {
    health: 'green', launchDate: _mISO(16, 20),
    launchConfirm: { at: _mTs(16, 20), by: '', note: 'Launched by quarterly review decision' },
    performance: 'Live on six lines since launch at month 16. Detection is holding at 85% of inspector-found flaws with false positives under 5%.',
    notes: 'Rollout to the remaining floor is scheduled inside the committed rollout budget.'
  };

  // ─── Procurement Copilot (11): start deferred to month 19, now mid-track ───
  data.projects[11].startDate = _mISO(19, 5); // anchorMonth reads startDate first – exercises Start Date Drift
  data.budgetPlans[11].dev[0].pstatus = 'complete'; data.budgetPlans[11].dev[0].gateDec = 'go'; data.budgetPlans[11].dev[0].gateAt = _mTs(20, 5);
  data.budgetPlans[11].dev[1].pstatus = 'complete'; data.budgetPlans[11].dev[1].gateDec = 'go'; data.budgetPlans[11].dev[1].gateAt = _mTs(21, 5);
  data.budgetPlans[11].dev[2].pstatus = 'running';
  data.tracking[11].results = 'Start deferred to month 19 while year-one capacity cleared. The observation and paper prototype phases are complete and both gates passed. The shadow-mode experiment is running against live RFQs.';

  // ─── Invoice Coding Copilot (12): killed at its first gate ───
  data.budgetPlans[12].dev[0].pstatus = 'complete'; data.budgetPlans[12].dev[0].gateDec = 'kill'; data.budgetPlans[12].dev[0].gateAt = _mTs(5, 10);
  data.tracking[12].status = 'killed';
  data.tracking[12].killSunkIds = ['bp12a'];
  data.tracking[12].results = 'Killed at the first gate. Shadow-mode acceptance plateaued at 61% against an 85% exit bar, and error analysis showed the invoice history was too inconsistent to train on. A $15K contractor exit was recorded in the kill & phase-out pot.';
  if (!data.capital.killRows) data.capital.killRows = [];
  data.capital.killRows.push({ d: 'Contractor exit – Invoice Coding Copilot', a: '$15K' });

  // ─── Churn Early-Warning Model (14): advanced by the month-16 review against the year-2 reserve ───
  data.expSelected.push(14);
  data.projects[14].advancedAt = _mTs(16, 20);
  data.portfolio[14] = { horizon: 'medium', risk: 'medium', reward: 'high', notes: 'Revenue protection with fast time-to-value. Funded from the year-two intake reserve.' };
  data.budgetPlans[14] = {
    horizon: '2', contingency: '10', notes: {},
    dev: [{ id: 'bp14a', name: 'Feature & label build', desc: 'Rebuild the outcome label set from CRM close reasons and assemble the churn feature base', from: '1', to: '2', cost: '$60K', powner: 'Dana Whitfield', pmetric: 'Label coverage on the last two years of accounts', pexit: 'Usable outcome labels on \u2265 90% of accounts closed since 2024' },
    { id: 'bp14b', name: 'Model & scoring pilot', desc: 'Train the churn model and run weekly scoring with the customer success pilot group', from: '2', to: '4', cost: '$120K', powner: 'Dana Whitfield', pmetric: '30-day detection rate on a holdout set', pexit: '\u2265 70% of churning accounts flagged 30 days out on holdout' }],
    roll: [{ id: 'bp14c', name: 'CS playbook rollout', desc: 'Score every account weekly and wire playbook triggers into the CRM for the full CS team', from: '5', to: '8', cost: '$40K' }],
    sus: [{ id: 'bp14d', name: 'Ongoing operation', from: '9', to: 'ongoing', items: [{ id: 'bpi14a', name: 'Model monitoring & retraining', cost: '$35K' }, { id: 'bpi14b', name: 'CRM integration upkeep', cost: '$20K' }] }]
  };
  data.tracking[14] = {
    status: 'running',
    results: 'Advanced by the quarterly review at month 16 and funded against the year-two intake reserve. The feature and label build is complete. The scoring pilot is running with the customer success team.',
    infraLearnings: 'Outcome labels before 2024 proved unusable. The team rebuilt the label set from CRM close reasons.',
    breakWork: 'Working: reserve-funded intake through the review. Watch: alert fatigue in the pilot group.'
  };

  // ─── One closed review cycle (month 16) ───
  data.reviewCycles = [{
    at: _mTs(16, 20), review: {
      items: { 0: { decision: 'hold' }, 1: { decision: 'hold' }, 4: { decision: 'hold' }, 11: { decision: 'hold' }, 13: { decision: 'buy' }, 14: { decision: 'buy' } },
      newOpportunities: '1. Warranty claim photos are a natural extension of the vision platform\n2. Churn scores could feed the quote configurator concept',
      balance: 'Two anchor bets are now operational. The portfolio needs one more quick win to keep near-term value flowing after the invoice copilot kill.',
      worked: 'Deferring the procurement copilot start protected year-one capacity. The triage results unlocked the contingent budget request, and all three funding plan lines were authorized during year one.',
      didnt: 'Invoice history quality was knowable before the first phase began. A short data audit before funding would have caught it.',
      nextCycle: 'Decide whether the churn pilot earns its rollout phase. Grade the quote configurator for a possible advance.'
    }
  }];
  data.review = { items: {} };

  // ─── Capital: the year-one funding plan was executed – all three lines authorized ───
  data.capital.fundLines.forEach(function (r) { r.st = 'auth' });
  data.capital.susCap = '18'; // tightened for the Year 2 seed (Paul's ruling, July 8). Hand-derived: year-3 sustainment 545K = 19.5% of the 2.8M envelope, so 18% breaches year 3 and leaves year 2 (10.3%) clean

  // ─── Intake since the program ended: new ideas at every funnel stage ───
  data.ideas.push(
    { name: 'Quote Configurator Copilot', desc: 'Draft complex window configurations and quotes from dealer requests, priced against current glass and hardware costs.', strategic: 'Friction: quote turnaround for custom configurations', cost: 'Medium ($120-200K)', outcome: 'Best: same-day quotes on 80% of custom requests. Worst: mispriced configurations erode dealer trust.', capabilities: 'Product configurator data, pricing rules, LLM drafting.', risk: 'Mispriced edge-case configurations. Pricing rules drift as costs move.', dept: 'Sales', when: 'now', timeframe: '3-6 months' },
    { name: 'Warranty Claim Vision', desc: 'Assess warranty claims from installer and homeowner photos, classifying failure type and routing to repair or replace.', strategic: 'Friction: warranty claim cycle time', cost: 'Medium ($100-180K)', outcome: 'Best: two-thirds of claims resolved without a site visit. Worst: wrong repair calls create repeat visits.', capabilities: 'Vision platform from quality inspection, claims history, photo intake flow.', risk: 'Photo quality from the field. Liability on wrong replace decisions.', dept: 'Customer Ops', when: 'now', timeframe: '3-6 months' },
    { name: 'Glass Cutting Yield Optimizer', desc: 'Optimize cutting plans across orders to raise sheet yield and cut offcut waste.', strategic: 'Cost: glass waste in cutting operations', cost: 'High ($200-400K)', outcome: 'Best: three to five points of yield improvement across plants. Worst: optimizer plans that operators override daily.', capabilities: 'Cutting plan data, order flow integration, optimization engine.', risk: 'Operator trust. Integration with legacy cutting software.', dept: 'Manufacturing', when: 'future', timeframe: '6-12 months' },
    { name: 'Installer Scheduling Assistant', desc: 'Schedule installation crews against job complexity, travel time, and weather windows.', strategic: 'Friction: installation backlog and travel waste', cost: 'Medium ($80-150K)', outcome: 'Best: 15% more installs per crew-week. Worst: schedules that crews ignore.', capabilities: 'Job and crew data, routing, weather feeds.', risk: 'Crew adoption. Edge cases in job complexity.', dept: 'Field Ops', when: 'future', timeframe: '3-6 months' },
    { name: 'Thermal Performance Advisor', desc: 'Answer dealer and homeowner questions on thermal performance and compliance from product specification data.', strategic: 'Friction: technical pre-sales load on engineering', cost: 'Low ($40-80K)', outcome: 'Best: engineering pre-sales queries cut by half. Worst: wrong compliance answers reach customers.', capabilities: 'Product spec corpus, compliance documents, retrieval.', risk: 'Compliance liability on wrong answers.', dept: 'Product', when: 'future', timeframe: '1-3 months' }
  );
  // Quote Configurator Copilot (20): selected, fully assessed, graded – a candidate for the next intake decision
  data.selected.push(20);
  data.projects[20] = {
    startupCost: '$160K', runningCost: '$45K', viable: true, assessed: true,
    objectives: 'Cut median quote turnaround for custom configurations from four days to one.',
    deliverables: 'Configurator-integrated drafting assistant and a priced-quote review queue.',
    timeline: 'Rules ingestion 4 weeks, drafting pilot 6 weeks, dealer trial 6 weeks.',
    resources: '1 pricing analyst, 1 engineer, $160K.',
    risks: 'Pricing rule drift. Dealer trust if early quotes misprice.',
    metrics: 'Quote turnaround time. Manual correction rate on drafts.',
    gap: { skillsH: 'Deep pricing rule knowledge', skillsN: 'LLM drafting patterns', resourcesH: 'Complete configurator data', resourcesN: 'Labeled quote corrections', technologyH: 'Configurator platform', technologyN: 'Drafting integration layer' },
    swot: { strengths: 'Direct revenue cycle impact.', weaknesses: 'Pricing rules change quarterly.', opportunities: 'Feeds the dealer portal roadmap.', threats: 'Dealer workarounds if drafts lag.' },
    partInt: 'Sales operations leadership.', partExt: 'Configurator platform vendor.'
  };
  data.portfolio[20] = { horizon: 'medium', risk: 'medium', reward: 'high', notes: 'Strong quick-cycle revenue case. Candidate for the next intake decision.' };
  // Warranty Claim Vision (21): selected, assessment in progress
  data.selected.push(21);
  data.projects[21] = {
    assessed: false,
    objectives: 'Resolve the majority of warranty claims from photos without a site visit.',
    deliverables: 'Photo intake flow, failure-type classifier, and a repair-or-replace routing queue.'
  };

  saveData();
}

// Init

/* ═══ BOOT (async loader, July 8) ═══
   The whole boot sequence now runs inside bootApp(), driven by
   Store.ready(). Locally ready() fires in the same tick, so nothing
   about startup changes. On a server build the loading shell below
   holds the app node while Store warms its cache, then bootApp()
   runs against warm data. bootApp() is guarded: a second call is a
   no-op, so a late or duplicate ready signal cannot double-bind
   listeners or re-run migrations. */
var _bootDone = false;
