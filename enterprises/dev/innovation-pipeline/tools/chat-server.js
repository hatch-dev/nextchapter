/* ============================================================
   Team-chat WebSocket relay — dependency-free (Node built-ins only).

   Run it:   node chat-server.js
   Listens:  ws://localhost:8090/?ticket=<ticket from GET api/chat/ticket>

   It does NOT touch the database — messages are persisted by the PHP
   API (POST /messages). This server only tells the other clients in the
   same room that there is something new; each then reads it from the API,
   which checks their session. If it isn't running, the app still works via
   its polling fallback (just not instant).

   ADMISSION (Directive 2 Oct 2026, Part 6.1.4). It used to put anyone who
   connected with ?org=<id> into that room. Now a connection needs a ticket
   the API signed with CHAT_RELAY_SECRET (apps/.env), naming the room and
   expiring 60 s after it was issued; the room comes from the ticket and
   nothing else. No secret configured = every connection is refused.

   WHAT IS RELAYED. Never a client's own payload: a member could otherwise
   show colleagues a message "from" someone else until their next reload.
   Any text frame becomes the fixed signal {"type":"new"}, and the receivers
   fetch the new messages from the API (MessageController records the author
   from the session).
   ============================================================ */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.CHAT_PORT || 8090;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map(); // room ("orgPublicId::module") -> Set<socket>
const SIGNAL = JSON.stringify({ type: 'new' });

/* The shared secret: the environment, else apps/.env (the file the API reads). */
function readSecret() {
  if (process.env.CHAT_RELAY_SECRET) return process.env.CHAT_RELAY_SECRET.trim();
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = env.match(/^\s*CHAT_RELAY_SECRET\s*=\s*"?([^"\r\n#]*)"?/m);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}
const SECRET = readSecret();

/* The room a ticket admits to, or null. Constant-time signature check; expired tickets refused. */
function roomFromTicket(ticket) {
  if (!SECRET || typeof ticket !== 'string') return null;
  const dot = ticket.indexOf('.');
  if (dot < 1) return null;
  const payload = ticket.slice(0, dot), sig = ticket.slice(dot + 1);
  const want = crypto.createHmac('sha256', SECRET).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!data || typeof data.room !== 'string' || !data.room || !(Number(data.exp) > Date.now() / 1000)) return null;
    return data.room;
  } catch (e) { return null; }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AI Pipeline team-chat WebSocket server is running.\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  let ticket = null;
  try { ticket = new URL(req.url, 'http://x').searchParams.get('ticket'); } catch (e) {}
  const org = roomFromTicket(ticket);   // `org` kept as the name: it is the room key below
  if (!org) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  if (!rooms.has(org)) rooms.set(org, new Set());
  rooms.get(org).add(socket);
  socket.setKeepAlive(true);

  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let frame;
    while ((frame = decodeFrame(buffer))) {
      if (!frame.complete) break;
      buffer = frame.rest;
      if (frame.opcode === 0x8) { cleanup(); socket.end(); return; }  // close
      if (frame.opcode === 0x9) { socket.write(encodeFrame(frame.payload, 0xA)); continue; } // ping->pong
      if (frame.opcode === 0x1) broadcast(org, SIGNAL, socket);  // text: tell the others there is something new (never its payload)
    }
  });
  function cleanup() { const r = rooms.get(org); if (r) { r.delete(socket); if (!r.size) rooms.delete(org); } }
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

function broadcast(org, text, except) {
  const r = rooms.get(org); if (!r) return;
  const out = encodeFrame(text, 0x1);
  for (const s of r) { if (s !== except && s.writable) { try { s.write(out); } catch (e) {} } }
}

/* --- WebSocket frame codec (text/control, no fragmentation) --- */
function encodeFrame(str, opcode) {
  const payload = Buffer.from(str || '', 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
  return Buffer.concat([header, payload]);
}
function decodeFrame(buf) {
  if (buf.length < 2) return { complete: false };
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) { if (buf.length < 4) return { complete: false }; len = buf.readUInt16BE(2); offset = 4; }
  else if (len === 127) { if (buf.length < 10) return { complete: false }; len = buf.readUInt32BE(6); offset = 10; }
  let mask;
  if (masked) { if (buf.length < offset + 4) return { complete: false }; mask = buf.slice(offset, offset + 4); offset += 4; }
  if (buf.length < offset + len) return { complete: false };
  let payload = buf.slice(offset, offset + len);
  if (masked) { const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4]; payload = out; }
  return { complete: true, opcode, payload: payload.toString('utf8'), rest: buf.slice(offset + len) };
}

server.listen(PORT, () => console.log('Team-chat WebSocket server listening on ws://localhost:' + PORT
  + (SECRET ? '' : '\n  WARNING: no CHAT_RELAY_SECRET in the environment or apps/.env — every connection will be refused.')));
