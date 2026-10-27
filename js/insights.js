/* ─────────────────────────────────────────────────────────────
   insights.js — Insights screen module (data + rendering)
   ─────────────────────────────────────────────────────────────
   Extracted out of app.js into the per-screen module pattern.
   Skeleton markup lives in templates/insights.html; the content
   arrays and the card renderers live here.

   To edit the reading/watching lists, edit the arrays below — the
   cards regenerate on the next visit. (Kept in JS rather than the
   template because each list is a repeated, data-shaped card.)

   Public API (window):
     renderInsights(container)   mount + hydrate the three sections

   Content restored July 9 from the July 5 build (Paul-supplied,
   transplanted verbatim).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var INSIGHT_SOURCES = {
    hbr: { label: 'Harvard Business Review' },
    smr: { label: 'MIT Sloan Management Review' },
    fastco: { label: 'Fast Company' },
    imd: { label: 'I by IMD' },
    psych: { label: 'Psychology Today' },
    linkedin: { label: 'LinkedIn' }
  };

  var LATEST_THOUGHTS = [
    { src: 'hbr', title: 'Manage Your AI Investments Like a Portfolio', date: 'January 2026', url: 'https://faisalhoque.com/manage-your-ai-investments-like-a-portfolio/', excerpt: 'Why a disciplined, stage-gated portfolio approach is the difference between AI investments that compound and pilots that drain attention and resources.' },
    { src: 'hbr', title: 'Two Frameworks for Balancing AI Innovation and Risk', date: 'March 2025', url: 'https://faisalhoque.com/two-frameworks-for-balancing-ai-innovation-and-risk/', excerpt: 'OPEN and CARE – the two complementary frameworks for harnessing AI’s potential while guarding against its risks.' },
    { src: 'smr', title: 'Why AI Demands a New Breed of Leaders', date: 'April 2025', url: 'https://sloanreview.mit.edu/article/why-ai-demands-a-new-breed-of-leaders/', excerpt: 'With Thomas H. Davenport and Erik Nelson – why organizations need a new leadership role to manage the cultural and organizational change that AI adoption brings.' },
    { src: 'fastco', title: 'Boards of Directors Have Critical New Responsibilities in the AI Era', date: 'June 11, 2026', url: 'https://faisalhoque.com/boards-of-directors-have-critical-new-responsibilities-in-the-ai-era/', excerpt: 'If leadership were just analysis, an algorithm could do it. What boards must now own in the AI era – and how to build the capabilities to own it.' },
    { src: 'fastco', title: 'Culture Is Where AI Strategy Goes to Die. Here’s How to Jump-Start an AI-Ready Culture in 90 Days', date: 'May 18, 2026', url: 'https://faisalhoque.com/culture-is-where-ai-strategy-goes-to-die-heres-how-to-jump-start-an-ai-ready-culture-in-90-days/', excerpt: 'A step-by-step road map for building a culture that supports AI transformation instead of suffocating it.' },
    { src: 'fastco', title: 'The Cost of Hollowing Out Human Accountability', date: '2026', url: 'https://faisalhoque.com/the-cost-of-hollowing-out-human-accountability/', excerpt: 'Twenty seconds to approve a military strike; 1.2 seconds to deny an insurance claim. What happens when humans are in the loop but humanity is not.' },
    { src: 'imd', title: 'Stop Developing an Obsolete AI Strategy. Part 2: Enterprise Risk', date: 'May 31, 2026', url: 'https://faisalhoque.com/stop-developing-an-obsolete-ai-strategy-part-2-enterprise-risk/', excerpt: 'How to defend against the risks that emerge from what others are doing with AI – new models, competitor breakthroughs, and shifts in how value is created.' },
    { src: 'imd', title: 'Stop Developing an Obsolete AI Strategy. Part 1: Project Risk', date: 'May 20, 2026', url: 'https://www.imd.org/ibyimd/brain-circuits/stop-developing-an-obsolete-ai-strategy-part-1-project-risk/', excerpt: 'The distinction every leader needs: project risk arises from your own AI implementations, and portfolio discipline is how you manage it.' },
    { src: 'psych', title: 'The Loneliness of Being Needed', date: 'May 31, 2026', url: 'https://faisalhoque.com/the-loneliness-of-being-needed/', excerpt: 'The strongest person you know is running on empty. It might be you.' },
    { src: 'psych', title: 'We All Use AI. Here’s How to Use It Well', date: 'May 19, 2026', url: 'https://faisalhoque.com/we-all-use-ai-heres-how-to-use-it-well/', excerpt: 'The future belongs to people who can think with AI – without thinking like it.' },
    { src: 'psych', title: 'Only Dead Things Stay the Same', date: 'April 22, 2026', url: 'https://faisalhoque.com/dead-things-stay-the-sameyour-next-chapter-in-the-age-of-ai/', excerpt: 'Most of us live in the waiting room of our own lives, waiting for things to settle. They never do – and that is the nature of being alive.' },
    { src: 'linkedin', title: 'Faisal on LinkedIn', date: 'Updated daily', url: 'https://www.linkedin.com/in/faisalhoque/', excerpt: 'Daily commentary on AI, leadership, and transformation – the fastest-moving strand of Faisal’s thinking, posted most days.' }
  ];

  var CONVERGENCE_EPISODES = [
    { tag: 'Episode 17', title: 'How to Jump-Start Your Company’s Responsible AI Governance in 90 Days', yt: 'fGxQxBIhOLs', desc: 'A step-by-step road map through the essential foundations for managing AI ethics, accountability, and human impact.' },
    { tag: 'Episode 16', title: 'How to Diagnose the Strategic Gap: AI Readiness for Leaders', yt: 'BtoHiUeI1D0', desc: 'Three critical questions for AI strategy – identifying business bottlenecks, building a cultural safety net, and the 90-day reality of innovation.' },
    { tag: 'Episode 15', title: 'Is the AI Job Crisis Designed?', yt: 'igUJjKHIKEk', desc: 'From boardroom decisions that favor short-term margins to the demand desert created when companies automate their own customers out of existence.' },
    { tag: 'Episode 14', title: 'Regenerative Leadership Principles to Scale AI Successfully', yt: 'HifjkL3XyiM', desc: 'How regenerative leadership fuels innovation, collaboration, and resilience while building teams that last.' }
  ];

  var FEATURED_VIDEOS = [
    { tag: 'Fast Company', title: 'How Companies Can Roll Out AI Without Replacing Employees', yt: 'nJAsQANx9yQ', desc: 'Fast Company senior editor Bryan Lufkin talks with Faisal about what companies get wrong when rolling out AI – and how to do it better.' },
    { tag: 'Yahoo Finance', title: 'Balancing Innovation and Security', yt: '18661-i900Y', desc: 'Responsible innovation and responsible utilization come first. A conversation about the fundamentals of deploying AI well.' },
    { tag: 'TRANSCEND', title: 'Four Parts to TRANSCEND', yt: 'wZnd_WZ3iBs', desc: 'The structure behind the book – including the philosophical grounding that gave rise to the OPEN and CARE frameworks.' },
    { tag: 'I by IMD Book Club', title: 'Navigating Business Transformation in a Hyperdigital Era', yt: 'Ow-mnxL2tQM', desc: 'The I by IMD Book Club session on REINVENT – how organizations stay on top of relentless change.' }
  ];

  var WORTH_YOUR_TIME = [
    { kind: 'Book', cta: 'View on Amazon', title: 'All In on AI', by: 'Thomas H. Davenport and Nitin Mittal · Harvard Business Review Press, 2023', url: 'https://www.amazon.com/dp/1647824699', desc: 'How the most aggressive adopters – Ping An, Airbus, Capital One – put AI at the core of everything they do, from the longest-standing authority on enterprise analytics.' },
    { kind: 'Article', cta: 'Read Article', title: 'Five Trends in AI and Data Science for 2026', by: 'Thomas H. Davenport and Randy Bean · MIT Sloan Management Review', url: 'https://sloanreview.mit.edu/article/five-trends-in-ai-and-data-science-for-2026/', desc: 'Their annual reading of where enterprise AI is actually heading – the investment bubble, the move to AI factories, agentic AI’s slow road to value, and who should own the AI agenda.' },
    { kind: 'Video', cta: 'Watch Video', title: 'AI Trends in 2026: Key Insights for Leaders', by: 'Thomas H. Davenport and Randy Bean · MIT Sloan Management Review · 13 min', url: 'https://sloanreview.mit.edu/video/ai-trends-in-2026-key-insights-for-leaders/', desc: 'The companion conversation to the trends column: why most AI investments are not paying off yet, and what leading companies do differently.' },
    { kind: 'Newsletter', cta: 'Visit Newsletter', title: 'One Useful Thing', by: 'Ethan Mollick · Wharton School', url: 'https://www.oneusefulthing.org/', desc: 'A free newsletter on working with AI in practice – grounded in research, hands-on, and updated as fast as the technology moves.' },
    { kind: 'Report', cta: 'Read Report', title: 'The 2026 AI Index Report', by: 'Stanford Institute for Human-Centered AI', url: 'https://hai.stanford.edu/ai-index/2026-ai-index-report', desc: 'The most comprehensive annual data on AI’s technical progress, economic footprint, and adoption – a standard reference for scanning the horizon.' },
    { kind: 'Book', cta: 'View on Amazon', title: 'Competing in the Age of AI', by: 'Marco Iansiti and Karim R. Lakhani · Harvard Business Review Press, 2020', url: 'https://www.amazon.com/dp/1633697622', desc: 'The Harvard Business School case for why AI-driven operating models change the rules of scale, scope, and learning.' },
    { kind: 'Book', cta: 'View on Amazon', title: 'The Coming Wave', by: 'Mustafa Suleyman with Michael Bhaskar · Crown, 2023', url: 'https://www.amazon.com/Coming-Wave-Power-Our-Future/dp/0593593979', desc: 'The DeepMind co-founder – now chief executive of Microsoft AI – on the containment problem: keeping control of technologies that spread faster than the institutions meant to govern them.' },
    { kind: 'Podcast', cta: 'Listen to Podcast', title: 'Me, Myself, and AI', by: 'Sam Ransbotham and Shervin Khodabandeh · MIT Sloan Management Review and Boston Consulting Group', url: 'https://sloanreview.mit.edu/audio-series/me-myself-and-ai/', desc: 'What separates AI success from AI hype – episode-by-episode conversations with the people running AI inside companies like YouTube, Cisco, Sony, and ExxonMobil.' }
  ];

  var insightsTab = 'latest';
  function esc(s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); }
  function attr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  /* ── Card renderers ───────────────────────────────────────── */
  // Article / book / resource card → a real anchor (opens in a new tab),
  // matching the Learn screen's .insight-card links.
  function linkCard(url, badge, dateOrBy, dateClass, title, excerpt, cta) {
    return '<a class="insight-card" href="' + attr(url) + '" target="_blank" rel="noopener">' +
      '<div class="insight-card-header">' +
      '<span class="insight-badge insight-badge--mono">' + esc(badge) + '</span>' +
      (dateOrBy != null && dateClass === 'insight-date' ? '<span class="insight-date">' + esc(dateOrBy) + '</span>' : '') +
      '</div>' +
      '<div class="insight-title">' + esc(title) + '</div>' +
      (dateOrBy != null && dateClass === 'by' ? '<div class="insight-date" style="white-space:normal">' + esc(dateOrBy) + '</div>' : '') +
      '<div class="insight-excerpt">' + esc(excerpt) + '</div>' +
      '<div class="insight-card-foot"><span class="insight-cta">' + esc(cta) + ' →</span></div>' +
      '</a>';
  }

  function latestHtml() {
    var h = '<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">The most recent pieces from each outlet, refreshed as new work appears. Articles open on faisalhoque.com.</p>';
    h += '<div class="u-53a30b8">';
    for (var i = 0; i < LATEST_THOUGHTS.length; i++) {
      var it = LATEST_THOUGHTS[i], s = INSIGHT_SOURCES[it.src];
      h += linkCard(it.url, s.label, it.date, 'insight-date', it.title, it.excerpt, 'Read');
    }
    return h + '</div>';
  }

  function ytCard(v) {
    return '<div class="conv-card">' +
      '<div class="overview-video-yt yt-facade" data-yt="' + attr(v.yt) + '" role="button" tabindex="0" aria-label="Play: ' + attr(v.title) + '">' +
      '<img class="yt-poster" src="https://i.ytimg.com/vi/' + attr(v.yt) + '/hqdefault.jpg" alt="" loading="lazy"/>' +
      '<div class="yt-play"></div>' +
      '</div>' +
      '<div class="conv-card-tag">' + esc(v.tag) + '</div>' +
      '<div class="serif-sub">' + esc(v.title) + '</div>' +
      '<div class="t-stone">' + esc(v.desc) + '</div>' +
      '</div>';
  }

  function conversationsHtml() {
    var h = '<div class="section-label" style="margin-top:4px">The CONVERGENCE Podcast</div>';
    h += '<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">The latest four episodes of the signature series with Faisal Hoque and Lauren Hawker Zafer. Click any episode to play it here.</p>';
    h += '<div class="conv-grid">';
    for (var i = 0; i < CONVERGENCE_EPISODES.length; i++) h += ytCard(CONVERGENCE_EPISODES[i]);
    h += '</div>';
    h += '<div class="section-label" style="margin-top:36px">Interviews &amp; Appearances</div>';
    h += '<p class="t-stone-13" style="max-width:680px;margin:6px 0 14px">A selection of Faisal’s conversations from his video archive.</p>';
    h += '<div class="conv-grid">';
    for (var j = 0; j < FEATURED_VIDEOS.length; j++) h += ytCard(FEATURED_VIDEOS[j]);
    return h + '</div>';
  }

  function worthHtml() {
    var h = '<p class="t-stone-13" style="max-width:680px;margin:0 0 6px">Books, articles, and videos by people we admire – relevant to the work, written by others.</p>';
    h += '<div class="u-53a30b8">';
    for (var i = 0; i < WORTH_YOUR_TIME.length; i++) {
      var it = WORTH_YOUR_TIME[i];
      h += linkCard(it.url, it.kind, it.by, 'by', it.title, it.desc, it.cta);
    }
    return h + '</div>';
  }

  /* ── Tab navigation (anchors to sections, not content switches) ── */
  window.insightsTabReset = function () { insightsTab = 'latest'; };   /* for sealSession (Part S) */
  function setInsightsTab(t) {
    insightsTab = t;
    document.querySelectorAll('.insight-filter[data-itab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-itab') === t); });
    var sec = document.getElementById('insights-' + t);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Mount + hydrate ──────────────────────────────────────── */
  function afterMount(container) {
    var fill = function (slot, html) { var el = container.querySelector('[data-slot="' + slot + '"]'); if (el) el.innerHTML = html; };
    fill('latest', latestHtml());
    fill('conversations', conversationsHtml());
    fill('worth', worthHtml());
    container.querySelectorAll('.insight-filter[data-itab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-itab') === insightsTab); });
    var bar = container.querySelector('[data-insights-tabs]');
    if (bar) bar.addEventListener('click', function (e) { var b = e.target.closest('[data-itab]'); if (b) setInsightsTab(b.getAttribute('data-itab')); });
  }

  function renderInsights(container) {
    Screens.mount('insights', container, { afterMount: afterMount });
  }

  window.renderInsights = renderInsights;
})();
