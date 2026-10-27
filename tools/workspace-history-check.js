#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   workspace-history-check.js — who changed what, against the real API
   ─────────────────────────────────────────────────────────────
   The history is recorded by the two write paths (Models\Workspace::save and
   ::patch) and read back by GET /workspace/history. All three are PHP, so this
   drives them over HTTP rather than stubbing them — a stub would only prove
   that the stub records what the stub was told.

   It works on a scratch organization of its own and removes it at the end, so
   it never touches the team's data. THE DEV DATABASE IS SHARED with the
   browser: nothing here may truncate a table.

   Usage:  node tools/workspace-history-check.js [-v]
           (needs the app served — APPS_BASE to point it elsewhere)
   ───────────────────────────────────────────────────────────── */
'use strict';
const http = require('http');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const BASE = process.env.APPS_BASE || 'http://localhost/apps/api';

function call(method, path, body) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      method, hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(d); } catch (e) { }
        resolve({ status: res.statusCode, body: j, raw: d });
      });
    });
    req.on('error', e => resolve({ status: 0, body: null, raw: String(e.message) }));
    if (payload) req.write(payload);
    req.end();
  });
}

const failures = [];
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (VERBOSE || !ok) console.log('  ' + String(label).padEnd(66) + (ok ? 'ok' : 'FAILED — ' + detail));
  if (!ok) failures.push(label + ' — ' + detail);
}
const entriesOf = h => (h.body && h.body.data && h.body.data.entries) || [];

(async () => {
  console.log('\nchecking...');

  const probe = await call('GET', '/organizations');
  if (probe.status === 0) {
    console.log('\n  the API is not answering at ' + BASE + ' - start the server, or set APPS_BASE.');
    process.exit(2);
  }

  /* A scratch organization with two members, created through the API so the
     rows are shaped exactly as the app's own are. */
  const stamp = Date.now().toString(36);
  const mk = await call('POST', '/setup', {
    account_type: 'enterprise', organization_name: 'History Probe ' + stamp,
    name: 'Ada Probe', email: 'ada' + stamp + '@probe.example', username: 'ada' + stamp, pin: '1234'
  });
  const org = mk.body && mk.body.data && mk.body.data.organization;
  const ADA = mk.body && mk.body.data && mk.body.data.user && mk.body.data.user.id;
  if (!org || !org.id || !ADA) {
    console.log('\n  could not create a scratch organization: ' + mk.status + ' ' + mk.raw.slice(0, 300));
    process.exit(2);
  }
  const ORG = org.id;

  // A second member, so "who changed it" has more than one possible answer.
  const add = await call('POST', '/users', {
    organization_id: ORG, actor_id: ADA,
    name: 'Ben Probe', email: 'ben' + stamp + '@probe.example',
    username: 'ben' + stamp, role: 'Analyst', scope: 'All', department: 'Operations', passcode: '1234'
  });
  const BEN = add.body && add.body.data && (add.body.data.user || add.body.data).id;
  if (!BEN) {
    await call('POST', '/organizations/delete', { id: ORG, actor_id: ADA });
    console.log('\n  could not add a second member: ' + add.status + ' ' + add.raw.slice(0, 300));
    process.exit(2);
  }
  const MOD = 'pipeline';

  /* A member added to an organization holds no program grants of their own, and
     every workspace write is checked against them (Core\Controller::moduleFrom
     — org_modules INTERSECT user_modules). Without this Ben's writes are all
     403s and the history is correctly empty, which looks exactly like the
     history being broken. */
  const grant = await call('POST', '/access/user', { id: BEN, actor_id: ADA, modules: [MOD] });
  if (!(grant.body && grant.body.success)) {
    await call('POST', '/organizations/delete', { id: ORG, actor_id: ADA });
    console.log('\n  could not grant the second member the program: ' + grant.status + ' ' + grant.raw.slice(0, 300));
    process.exit(2);
  }
  if (VERBOSE) console.log('  scratch org ' + ORG + '  ada=' + ADA + '  ben=' + BEN);

  const q = a => '?org=' + encodeURIComponent(ORG) + '&module=' + MOD + '&actor=' + encodeURIComponent(a);

  try {
    // 1. The first write creates the document AND its first history entry.
    let r = await call('POST', '/workspace', {
      org: ORG, module: MOD, actor_id: ADA, base_rev: null, replace: true, schema_version: 1,
      doc: { purpose: { mission: 'the first mission' }, knowledge: { tools: '' } }
    });
    check('a first save is accepted', r.status === 200 && r.body && r.body.success, r.status + ' ' + r.raw.slice(0, 200));

    let e = entriesOf(await call('GET', '/workspace/history' + q(ADA)));
    check('the first write is in the history', e.length === 1, 'got ' + e.length + ' entries');
    check('attributed to the member who made it', e[0] && e[0].actor === ADA, JSON.stringify(e[0] && e[0].actor));

    // 2. Ben patches ONE section. The entry names that section and nothing else.
    r = await call('POST', '/workspace/patch', {
      org: ORG, module: MOD, actor_id: BEN, schema_version: 1,
      sections: { purpose: { mission: 'the mission Ben wrote' } }
    });
    check('a patch is accepted', r.status === 200 && r.body && r.body.success, r.status + ' ' + r.raw.slice(0, 200));

    e = entriesOf(await call('GET', '/workspace/history' + q(ADA)));
    check('it is the newest entry', e.length === 2 && e[0].actor === BEN, JSON.stringify(e.map(x => x.actor)));
    const ch = (e[0] && e[0].changed) || {};
    check('naming only the section that moved', Object.keys(ch).join(',') === 'purpose', Object.keys(ch).join(','));
    check('with the value it had before',
      ch.purpose && ch.purpose.before && ch.purpose.before.mission === 'the first mission',
      JSON.stringify(ch.purpose && ch.purpose.before));
    check('and the value it has now',
      ch.purpose && ch.purpose.after && ch.purpose.after.mission === 'the mission Ben wrote',
      JSON.stringify(ch.purpose && ch.purpose.after));

    // 3. A save that changes nothing is not history.
    const beforeNoop = e.length;
    await call('POST', '/workspace/patch', {
      org: ORG, module: MOD, actor_id: BEN, schema_version: 1,
      sections: { purpose: { mission: 'the mission Ben wrote' } }
    });
    e = entriesOf(await call('GET', '/workspace/history' + q(ADA)));
    check('a save that changed nothing adds no entry', e.length === beforeNoop,
      'went from ' + beforeNoop + ' to ' + e.length);

    // 4. COALESCING. Typing debounces to about a second and a half, so a
    //    paragraph is twenty-odd saves. One entry, not twenty.
    for (let i = 1; i <= 5; i++) {
      await call('POST', '/workspace/patch', {
        org: ORG, module: MOD, actor_id: BEN, schema_version: 1,
        sections: { purpose: { mission: 'the mission Ben wrote, and kept typing ' + 'x'.repeat(i) } }
      });
    }
    e = entriesOf(await call('GET', '/workspace/history' + q(ADA)));
    check('five more saves by the same member fold into one entry', e.length === 2, 'got ' + e.length + ' entries');
    const folded = e[0] && e[0].changed && e[0].changed.purpose;
    check('the folded entry keeps what it said BEFORE they started',
      folded && folded.before && folded.before.mission === 'the first mission',
      JSON.stringify(folded && folded.before));
    check('and what it says now',
      folded && folded.after && /kept typing xxxxx$/.test(folded.after.mission),
      JSON.stringify(folded && folded.after));

    // 5. A different member's work is never folded into somebody else's entry:
    //    half of it would then be attributed to the wrong person.
    await call('POST', '/workspace/patch', {
      org: ORG, module: MOD, actor_id: ADA, schema_version: 1,
      sections: { knowledge: { tools: 'Ada was here' } }
    });
    e = entriesOf(await call('GET', '/workspace/history' + q(ADA)));
    check('another member gets an entry of their own', e.length === 3 && e[0].actor === ADA,
      JSON.stringify(e.map(x => x.actor)));

    // 6. THE QUESTION THIS WAS BUILT FOR: the last change by a named member.
    e = entriesOf(await call('GET', '/workspace/history' + q(ADA) + '&actor_id=' + encodeURIComponent(BEN) + '&limit=1'));
    check('the last change by one named member can be asked for',
      e.length === 1 && e[0].actor === BEN, JSON.stringify(e.map(x => x.actor)));
    check('and it is that member’s latest, not their first',
      e[0] && e[0].changed && e[0].changed.purpose && /kept typing xxxxx$/.test(e[0].changed.purpose.after.mission),
      JSON.stringify(e[0] && e[0].changed));

    // 7. `since` is what a client holding rev N asks with.
    const head = await call('GET', '/workspace/history' + q(ADA));
    const revNow = (head.body && head.body.data && head.body.data.rev) || 0;
    e = entriesOf(await call('GET', '/workspace/history' + q(ADA) + '&since=' + revNow));
    check('nothing has happened since the current rev', e.length === 0, 'got ' + e.length);

    // 8. It is still the organization's own data.
    const anon = await call('GET', '/workspace/history?org=' + encodeURIComponent(ORG) + '&module=' + MOD);
    check('a history request with no actor is refused',
      anon.status === 403 || anon.status === 401 || (anon.body && !anon.body.success),
      'status ' + anon.status + ' ' + anon.raw.slice(0, 160));
  } finally {
    const del = await call('POST', '/organizations/delete', { id: ORG, actor_id: ADA });
    if (VERBOSE) console.log('  scratch org removed: ' + del.status + ' ' + del.raw.slice(0, 120));
    if (!(del.body && del.body.success)) {
      failures.push('the scratch organization ' + ORG + ' was left behind — remove it by hand');
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log('Workspace history: who changed what, and when');
  console.log('  assertions :', checks);
  if (failures.length) {
    console.log('  BROKEN     :', failures.length);
    console.log('──────────────────────────────────────────');
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('  ✓ every accepted write is recorded, with its author and both values');
  console.log('  ✓ one member typing on is one entry; another member is never folded in');
  console.log('  ✓ the last change by a named member can be asked for directly');
  console.log('──────────────────────────────────────────');
})();
