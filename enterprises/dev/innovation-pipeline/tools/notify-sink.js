#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   notify-sink.js — stand in for the AWS notification service
   ─────────────────────────────────────────────────────────────
   The email component (js/features/email.js) POSTs to NOTIFY_ENDPOINT and is
   inert until that is set. This is somewhere to point it while the real
   service does not exist yet, so the whole path can be exercised by hand:
   the request, the CORS pre-flight, the per-program URL path, the eight-field
   body, and the HTML the service would turn into a PDF.

   It answers the way the directive of 3 Sep 2026 says the service must
   (Part 3, point 2): CORS headers on both OPTIONS and POST, and a 2xx.

     node tools/notify-sink.js            → http://localhost:4599/notify
     node tools/notify-sink.js 5000       → a different port

   Every request is printed, and each body's `html` is written to
   tools/_notify-out/ so the completion report can be opened in a browser and
   checked — that HTML is what the real service converts to the PDF.

   Nothing here is part of the app. It is a test double; deleting it changes
   nothing that ships.
   ───────────────────────────────────────────────────────────── */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 4599;
const OUT = path.join(__dirname, '_notify-out');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) { }

/* Access-Control-Allow-Origin is '*' here deliberately: this is a throwaway on
   localhost and pinning it to an origin is the commonest way to spend an hour
   debugging the test rig instead of the app. The real service should name the
   domains each app is served from. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600'
};

let n = 0;
const pad = s => String(s == null ? '' : s);

http.createServer((req, res) => {
  /* The browser asks first. Answering this wrongly is the failure the directive
     calls "the most common reason for this kind of integration to fail
     silently" — every notification records as failed (network) and no email is
     sent, with nothing in the app to say why. */
  if (req.method === 'OPTIONS') {
    console.log('  · pre-flight OPTIONS ' + req.url + ' → 204');
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'POST') {
    res.writeHead(405, CORS); return res.end('POST only');
  }

  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    let body = null;
    try { body = JSON.parse(raw); } catch (e) { }
    n++;

    console.log('\n─── #' + n + '  ' + new Date().toISOString());
    console.log('  URL       : ' + req.url + '        ← the program is named here');
    console.log('  Auth hdrs : ' + (req.headers.authorization || req.headers['x-api-key'] ? 'PRESENT — the app must send none' : 'none (correct)'));
    if (!body) {
      console.log('  BODY      : not JSON (' + raw.length + ' bytes)');
      res.writeHead(400, Object.assign({ 'Content-Type': 'application/json' }, CORS));
      return res.end('{"ok":false}');
    }
    const keys = Object.keys(body).sort().join(',');
    const EXPECT = 'html,kind,orgName,pdf,sentAt,stepId,subject,to';
    console.log('  fields    : ' + keys + (keys === EXPECT ? '   ✓ exactly the eight of Part 3' : '   ✗ EXPECTED ' + EXPECT));
    console.log('  kind      : ' + pad(body.kind) + '   pdf: ' + body.pdf + (body.kind === 'step-complete' && body.pdf !== true ? '   ✗ a completion report must ask for the PDF' : ''));
    console.log('  subject   : ' + pad(body.subject));
    console.log('  stepId    : ' + pad(body.stepId) + '   orgName: ' + pad(body.orgName));
    console.log('  sentAt    : ' + pad(body.sentAt));
    console.log('  to        : ' + (Array.isArray(body.to) ? body.to.join(', ') : '(not a list)'));

    const html = pad(body.html);
    const file = path.join(OUT, String(n).padStart(3, '0') + '-' + pad(body.kind) + '-' + pad(body.stepId).replace(/[^\w.-]/g, '_') + '.html');
    try { fs.writeFileSync(file, html); } catch (e) { }
    console.log('  html      : ' + html.length + ' chars → ' + path.relative(process.cwd(), file));
    if (body.kind === 'step-complete') {
      /* The one thing worth checking automatically: correction A says the
         completion body is always the ANALYTICS tab, whatever tab the user
         left open. These four markers appear only on that tab. */
      const marks = ['90-Day Burn-up', 'Module Velocity', 'Workload by Member', 'Signals'];
      const missing = marks.filter(m => html.indexOf(m) < 0);
      console.log('  analytics : ' + (missing.length ? '✗ MISSING ' + missing.join(', ') + ' — this is not the analytics tab' : '✓ all four analytics markers present'));
      if (html.indexOf('This Week') >= 0) console.log('              ✗ the ASSIGNMENTS tab body is in the email');
    }

    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end('{"ok":true,"received":' + n + '}');
  });
}).listen(PORT, () => {
  console.log('notification sink listening');
  console.log('  base URL : http://localhost:' + PORT + '/notify');
  console.log('  bodies   : ' + path.relative(process.cwd(), OUT));
  console.log('\nIn the app\'s browser console:');
  console.log("  NOTIFY_ENDPOINT = 'http://localhost:" + PORT + "/notify';\n");
});
