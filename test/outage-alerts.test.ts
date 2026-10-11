// FD-48 (operator decision 2026-10-11): outages reach the operator away from the Mac — episodes, their timing, and
// the operator-channel service they go through.
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { callCapability, rpcResult } from '../src/core/mcp-client';
import { chooseChannel, delivered, emptyOutageState, notifyChannelOf, observe, OUTAGE_ALERT_AFTER_MS, owed, type OutageState, type Watched, type Words } from '../src/core/outage-alerts';
import { merge } from '../src/core/settings';

const words: Words = { down: (n) => `${n} is down`, failing: (n, s) => `${n}: ${s} is failing`, back: (n) => `${n} is back`, removed: (n) => `${n} was removed`, since: (m, r) => `For ${m} min: ${r}`, after: (m) => `Back after ${m} min.`, wasDown: (m, r) => `Was down ${m} min (${r})` };
const svc = (over: Partial<Watched> = {}): Watched => ({ key: 'copy.default', name: 'Copy', state: 'ready', startedAt: '2026-10-11T15:00:00Z', degraded: [], reason: 'connection refused', ...over });
const MIN = 60_000;
/** Look at each step, then deliver what is owed unless the channel is out (`deliver: false`). */
const run = (steps: { at: number; services: Watched[]; allowed?: boolean; deliver?: boolean }[]) => {
  let state: OutageState = emptyOutageState();
  const sent: { at: number; kind: string; subject: string; text: string; eventId: string }[] = [];
  for (const s of steps) {
    state = observe(state, s.services, s.at);
    for (const d of owed(state, s.at, words, () => s.allowed ?? true)) {
      if (s.deliver === false) break; // the first failure stops the round
      sent.push({ at: s.at, kind: d.msg.kind, subject: d.msg.subject, text: d.msg.text, eventId: d.msg.eventId });
      state = delivered(state, d.id, d.step);
    }
  }
  return { state, sent };
};
const down = svc({ state: 'down' });

test('FD-48: an outage under five minutes sends nothing; one held five minutes sends one message, and one when it is back', () => {
  const short = run([{ at: 0, services: [down] }, { at: 4 * MIN, services: [down] }, { at: 4 * MIN + 1, services: [svc()] }, { at: 7 * MIN, services: [svc()] }]);
  assert.deepEqual(short.sent, [], 'a blip never reaches the channel');
  const long = run([{ at: 0, services: [down] }, { at: 3 * MIN, services: [down] }, { at: OUTAGE_ALERT_AFTER_MS, services: [down] }, { at: 6 * MIN, services: [down] }, { at: 185 * MIN, services: [svc()] }, { at: 187 * MIN, services: [svc()] }, { at: 188 * MIN, services: [svc()] }]);
  assert.deepEqual(long.sent.map((m) => [m.kind, m.subject, m.text]), [['failure', 'Copy is down', 'For 5 min: connection refused'], ['recovery', 'Copy is back', 'Back after 185 min.']], 'one message at five minutes, none repeated, one on recovery after the 2-minute calm');
  assert.equal(long.sent[0]!.eventId, 'outage:copy.default:0');
  assert.equal(long.sent[1]!.eventId, 'outage:copy.default:0:back');
  assert.deepEqual(long.state.episodes, {}, 'a settled episode is forgotten at the next look');
});

test('FD-48: a down–up flicker is one outage; going from down to degraded is not a recovery', () => {
  const flicker = [];
  for (let m = 0; m <= 10; m += 1) flicker.push({ at: m * MIN, services: [m % 5 === 4 ? svc() : down] });
  assert.deepEqual(run(flicker).sent.map((m) => m.kind), ['failure'], 'down 4 of every 5 minutes still alerts, once');
  const half = run([{ at: 0, services: [down] }, { at: 6 * MIN, services: [down] }, { at: 7 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'database', reason: 'unreachable' }] })] }, { at: 20 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'database', reason: 'unreachable' }] })] }]);
  assert.deepEqual(half.sent.map((m) => m.kind), ['failure'], 'still impaired: no "back"');
});

test('FD-48: a degraded source there since the start is setup; one that appears later is an outage; a recovered setup source counts next time', () => {
  const setup = { source: 'execution', reason: 'generation not configured' };
  const db = { source: 'database', reason: 'database unreachable' };
  const r = run([
    { at: 0, services: [svc({ state: 'degraded', degraded: [setup] })] }, { at: 10 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
    { at: 11 * MIN, services: [svc({ state: 'degraded', degraded: [setup, db] })] }, { at: 16 * MIN, services: [svc({ state: 'degraded', degraded: [setup, db] })] },
    { at: 30 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] }, { at: 33 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
  ]);
  assert.deepEqual(r.sent.map((m) => [m.kind, m.subject]), [['failure', 'Copy: database is failing'], ['recovery', 'Copy is back']]);
  const again = run([
    { at: 0, services: [svc({ state: 'degraded', degraded: [db] })] }, { at: 1 * MIN, services: [svc()] },
    { at: 2 * MIN, services: [svc({ state: 'degraded', degraded: [db] })] }, { at: 8 * MIN, services: [svc({ state: 'degraded', degraded: [db] })] },
  ]);
  assert.deepEqual(again.sent.map((m) => m.subject), ['Copy: database is failing'], 'a baseline source that recovered and failed again is an outage');
  const restarted = run([{ at: 0, services: [svc({ state: 'degraded', degraded: [db] })] }, { at: 10 * MIN, services: [svc({ state: 'degraded', degraded: [db], startedAt: '2026-10-11T16:00:00Z' })] }]);
  assert.deepEqual(restarted.sent, [], 'present at its (new) start: setup as far as the watcher can tell');
});

test('FD-48: delivery is recorded only when the channel took it — a failure waits, a recovery never comes first, a missed outage is told once after', () => {
  const r = run([{ at: 0, services: [down] }, { at: 6 * MIN, services: [down], deliver: false }, { at: 7 * MIN, services: [down] }, { at: 30 * MIN, services: [svc()] }, { at: 33 * MIN, services: [svc()] }]);
  assert.deepEqual(r.sent.map((m) => [m.at, m.kind]), [[7 * MIN, 'failure'], [33 * MIN, 'recovery']], 'retried at the next look, in order');
  const channelDown = run([{ at: 0, services: [down] }, { at: 6 * MIN, services: [down], deliver: false }, { at: 20 * MIN, services: [svc()], deliver: false }, { at: 23 * MIN, services: [svc()] }]);
  assert.deepEqual(channelDown.sent.map((m) => [m.kind, m.text]), [['recovery', 'Was down 20 min (connection refused)']], 'never "back" before "down": one message after, saying both');
});

test('FD-48: a removed service closes its episode with one message; a muted episode sends nothing, nor its recovery; eventIds stay short', () => {
  const removed = run([{ at: 0, services: [down] }, { at: 6 * MIN, services: [down] }, { at: 7 * MIN, services: [] }]);
  assert.deepEqual(removed.sent.map((m) => [m.kind, m.subject]), [['failure', 'Copy is down'], ['recovery', 'Copy was removed']]);
  const muted = run([{ at: 0, services: [down], allowed: false }, { at: 6 * MIN, services: [down], allowed: false }, { at: 9 * MIN, services: [svc()], allowed: false }, { at: 12 * MIN, services: [svc()], allowed: false }]);
  assert.deepEqual(muted.sent, []);
  const long = 'a'.repeat(63) + '.' + 'b'.repeat(32);
  const ids = run([{ at: 0, services: [svc({ key: long, state: 'down' })] }, { at: 6 * MIN, services: [svc({ key: long, state: 'down' })] }, { at: 9 * MIN, services: [svc({ key: long })] }]).sent.map((m) => m.eventId);
  for (const id of ids) assert.ok(id.length <= 160 && !id.includes('/'), id);
});

test('FD-48: the channel is a local service offering <id>.notify over streamable HTTP; automatic takes the only one', () => {
  const ready = (key: string, caps: string[], origin = 'http://127.0.0.1:47832') => ({ key, state: 'ready' as const, descriptor: { origin } as never, wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http' as const, capabilities: caps } } } as never });
  const channel = ready('relay.default', ['relay.status', 'relay.notify']);
  assert.deepEqual(notifyChannelOf(channel), { key: 'relay.default', origin: 'http://127.0.0.1:47832', path: '/mcp', capability: 'relay.notify' });
  assert.equal(notifyChannelOf(ready('far.default', ['far.notify'], 'https://far.example.com')), null, 'this machine only');
  assert.equal(notifyChannelOf(ready('x.default', ['x.notifyAll'])), null);
  const other = ready('copy.default', ['copylot.write']);
  assert.equal((chooseChannel([channel, other], 'auto') as { key: string }).key, 'relay.default');
  assert.deepEqual(chooseChannel([other], 'auto'), { none: 'none-installed' });
  assert.deepEqual(chooseChannel([channel, ready('b.default', ['b.notify'])], 'auto'), { none: 'several' });
  assert.equal((chooseChannel([channel, ready('b.default', ['b.notify'])], 'b.default') as { key: string }).key, 'b.default');
  assert.deepEqual(chooseChannel([channel], 'off'), { none: 'off' });
  assert.deepEqual(chooseChannel([channel], 'gone.default'), { none: 'chosen-gone' });
  assert.deepEqual(chooseChannel([channel, { key: 'relay2.default', state: 'down', descriptor: { origin: 'http://127.0.0.1:1' } as never, wellKnown: null } as never], 'relay2.default'), { none: 'chosen-unreachable' }, 'installed but not answering is not gone');
  assert.equal(notifyChannelOf(ready('p.default', ['p.notify'], 'http://127.0.0.1:47832') && { ...ready('p.default', ['p.notify']), wellKnown: { surfaces: { mcp: { path: '//evil:1/x', transport: 'streamable-http', capabilities: ['p.notify'] } } } } as never), null, 'a path that names another host is refused');
  assert.equal(merge({}).notifications.channel, 'auto');
  assert.equal(merge({ notifications: { channel: 'off' } as never }).notifications.channel, 'off');
  assert.equal(merge({ notifications: { channel: '../x' } as never }).notifications.channel, 'auto', 'only off or a service key');
});

test('FD-48: the MCP client initializes, finds the capability\'s tool by either spelling, calls it, reads JSON or SSE, and reports a refusal in the server\'s words', async (t) => {
  const seen: { method: string; session?: string; args?: unknown }[] = [];
  let refuse = false;
  let toolName = 'relay_notify';
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'DELETE') { seen.push({ method: 'DELETE', session: req.headers['mcp-session-id'] as string | undefined }); res.writeHead(204); res.end(); return; }
      const msg = JSON.parse(body) as { id?: number; method: string; params?: { arguments?: unknown } };
      seen.push({ method: msg.method, session: req.headers['mcp-session-id'] as string | undefined, args: msg.params?.arguments });
      if (msg.method === 'initialize') { res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'sess-1' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-03-26' } })); return; }
      if (!msg.id) { res.writeHead(202); res.end(); return; }
      if (msg.method === 'tools/list') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'relay.status' }, { name: toolName }] } })); return; }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const result = refuse ? { isError: true, content: [{ type: 'text', text: 'invalid_event_id' }] } : { content: [{ type: 'text', text: '{"status":"queued"}' }] };
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n\n`);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const target = { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, path: '/mcp' };
  const args = { eventId: 'outage:copy.default:down:0', kind: 'failure', subject: 'Copy is down', text: 'For 5 min: refused' };
  await callCapability(target, 'relay.notify', args, '0.7.5');
  assert.deepEqual(seen.map((s) => s.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'DELETE']);
  assert.deepEqual(seen.slice(1).map((s) => s.session), ['sess-1', 'sess-1', 'sess-1', 'sess-1'], 'the session id is carried, and closed');
  assert.deepEqual(seen[3]!.args, args);
  toolName = 'relay.notify'; // a server that keeps the dots (as a real operator channel does)
  seen.length = 0;
  await callCapability(target, 'relay.notify', args, '0.7.5');
  assert.equal(seen.at(-2)!.method, 'tools/call');
  toolName = 'something_else';
  await assert.rejects(callCapability(target, 'relay.notify', args, '0.7.5'), /offers no tool for relay\.notify/);
  toolName = 'relay_notify';
  refuse = true;
  await assert.rejects(callCapability(target, 'relay.notify', args, '0.7.5'), /relay_notify refused: invalid_event_id/);
  await assert.rejects(callCapability({ origin: 'http://localhost:1', path: '/mcp' }, 'x.notify', {}, '0'), /this machine only/);
  await assert.rejects(callCapability({ ...target, path: '//127.0.0.1:1/mcp' }, 'x.notify', {}, '0'), /a path on the service/, 'the port comes from the origin, never the path');
  assert.ok(seen.some((s) => s.method === 'DELETE'), 'the session is closed after the call');
  const multi = rpcResult({ headers: { 'content-type': 'text/event-stream' }, body: 'event: message\ndata: {"jsonrpc":"2.0",\ndata: "id":7,"result":{}}\n\n' }, 7);
  assert.deepEqual(multi, { jsonrpc: '2.0', id: 7, result: {} }, 'an event\'s data lines are one message');
  assert.deepEqual(rpcResult({ headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":2,"result":{"ok":1}}' }, 2), { jsonrpc: '2.0', id: 2, result: { ok: 1 } });
});

test('FD-48 DEC-0044: an entry marked setup: true never opens an episode, even when it appears after the start', () => {
  const setupLater = run([
    { at: 0, services: [svc({ state: 'ready' })] },
    { at: 1 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'generation not configured', setup: true }] })] },
    { at: 30 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'generation not configured', setup: true }] })] },
  ]);
  assert.deepEqual(setupLater.sent, [], 'a key not entered is not an outage');
  const failing = run([
    { at: 0, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'generation not configured', setup: true }] })] },
    { at: 1 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'pinned model unavailable' }] })] },
    { at: 7 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'pinned model unavailable' }] })] },
  ]);
  assert.deepEqual(failing.sent.map((m) => m.subject), ['Copy: execution is failing'], 'the same source without the flag is a failure, even though it was there at the start');
});

test('FD-48: the start baseline is taken after the service left starting, so a setup state filled in during start-up is not an outage', () => {
  const setup = { source: 'execution', reason: 'generation not configured' };
  const r = run([
    { at: 0, services: [svc({ state: 'starting', degraded: [] })] },
    { at: 1 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
    { at: 30 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
  ]);
  assert.deepEqual(r.sent, []);
});

