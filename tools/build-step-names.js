#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   build-step-names.js — writes api/config/step-names.json
   ─────────────────────────────────────────────────────────────
   The server's due-date reminders (api/core/DeadlineReminders.php) name the step, and only the programs know their
   steps' names. This opens each program's sign-in page on the local install and writes down what it declares (PH).
   Run it after renaming or adding a step; XAMPP must be running.

       node tools/build-step-names.js
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('@playwright/test');
const BASE = process.env.PW_BASE_URL || 'http://localhost/apps/';
const DOORS = { 'pipeline': 'enterprises/innovation-pipeline', 'exec-readiness': 'enterprises/executive-readiness', 'ai-governance': 'enterprises/responsible-ai-governance', 'ai-architecture': 'enterprises/architecture', 'ai-culture': 'enterprises/culture' };
const OUT = ['api/config/step-names.json', 'enterprises/dev/innovation-pipeline/api/config/step-names.json'];
(async () => {
  const browser = await chromium.launch(), out = {};
  for (const [id, door] of Object.entries(DOORS)) {
    const page = await browser.newPage();
    await page.goto(BASE + door + '/login');
    await page.waitForFunction(() => typeof PH !== 'undefined' && PH.length > 0, null, { timeout: 20000 });
    out[id] = await page.evaluate(() => { const o = {}; PH.forEach((p) => (p.steps || []).forEach((s) => { if (/^\d+\.\d+$/.test(String(s.id))) o[s.id] = s.name; })); return o; });
    await page.close();
  }
  await browser.close();
  for (const f of OUT) { const p = path.resolve(__dirname, '..', f); if (fs.existsSync(path.dirname(p))) fs.writeFileSync(p, JSON.stringify(out, null, 1) + '\n'); }
  console.log(Object.entries(out).map(([k, v]) => k + ' ' + Object.keys(v).length).join(', '));
})();
