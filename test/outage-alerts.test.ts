// FD-48 (operator decision 2026-10-11): outages reach the operator away from the Mac — episodes, their timing, and
// the operator-channel service they go through.
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { callCapability, rpcResult } from '../src/core/mcp-client';
import { chooseChannel, emptyOutageState, notifyChannelOf, OUTAGE_ALERT_AFTER_MS, stepOutages, type OutageState, type Watched, type Words } from '../src/core/outage-alerts';
import { merge } from '../src/core/settings';

const words: Words = { down: (n) => `${n} is down`, failing: (n, s) => `${n}: ${s} is failing`, back: (n) => `${n} is back`, since: (m, r) => `For ${m} min: ${r}`, after: (m) => `Back after ${m} min.` };
const svc = (over: Partial<Watched> = {}): Watched => ({ key: 'copy.default', name: 'Copy', state: 'ready', startedAt: '2026-10-11T15:00:00Z', degraded: [], reason: 'connection refused', ...over });
const MIN = 60_000;
const run = (steps: { at: number; services: Watched[]; allowed?: boolean }[]) => {
  let state: OutageState = emptyOutageState();
  const sent = [];
  for (const s of steps) {
    const r = stepOutages(state, s.services, s.at, words, () => s.allowed ?? true);
    state = r.state;
    sent.push(...r.messages.map((m) => ({ at: s.at, ...m })));
  }
  return { state, sent };
};

test('FD-48: an outage under five minutes sends nothing; one held five minutes sends one message, and one when it is back', () => {
  const short = run([{ at: 0, services: [svc({ state: 'down' })] }, { at: 4 * MIN, services: [svc({ state: 'down' })] }, { at: 5 * MIN - 1, services: [svc()] }]);
  assert.deepEqual(short.sent, [], 'a blip never reaches the channel');
  const long = run([
    { at: 0, services: [svc({ state: 'down' })] }, { at: 3 * MIN, services: [svc({ state: 'down' })] },
    { at: OUTAGE_ALERT_AFTER_MS, services: [svc({ state: 'down' })] }, { at: 6 * MIN, services: [svc({ state: 'down' })] },
    { at: 187 * MIN, services: [svc()] },
  ]);
  assert.deepEqual(long.sent.map((m) => [m.kind, m.subject, m.text]), [
    ['failure', 'Copy is down', 'For 5 min: connection refused'],
    ['recovery', 'Copy is back', 'Back after 187 min.'],
  ], 'one message at five minutes, none repeated, one on recovery');
  assert.equal(long.sent[0]!.eventId, 'outage:copy.default:down:0');
  assert.equal(long.sent[1]!.eventId, 'outage:copy.default:down:0:back');
  for (const m of long.sent) assert.ok(!m.eventId.includes('/') && m.eventId.length <= 160, m.eventId);
});

test('FD-48: a degraded source there since the start is setup, never an outage; one that appears later is', () => {
  const setup = { source: 'execution', reason: 'generation not configured' };
  const db = { source: 'database', reason: 'database unreachable' };
  const r = run([
    { at: 0, services: [svc({ state: 'degraded', degraded: [setup] })] },
    { at: 10 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
    { at: 11 * MIN, services: [svc({ state: 'degraded', degraded: [setup, db] })] },
    { at: 16 * MIN, services: [svc({ state: 'degraded', degraded: [setup, db] })] },
    { at: 30 * MIN, services: [svc({ state: 'degraded', degraded: [setup] })] },
  ]);
  assert.deepEqual(r.sent.map((m) => [m.kind, m.subject, m.eventId]), [
    ['failure', 'Copy: database is failing', `outage:copy.default:degraded-database:${11 * 60}`],
    ['recovery', 'Copy is back', `outage:copy.default:degraded-database:${11 * 60}:back`],
  ]);
});

test('FD-48: a restart takes a new baseline; a removed service closes silently; a muted episode sends nothing, nor its recovery', () => {
  const db = { source: 'database', reason: 'down' };
  const restarted = run([
    { at: 0, services: [svc({ state: 'degraded', degraded: [db] })] },
    { at: 10 * MIN, services: [svc({ state: 'degraded', degraded: [db], startedAt: '2026-10-11T16:00:00Z' })] },
  ]);
  assert.deepEqual(restarted.sent, [], 'present at its (new) start: setup as far as the watcher can tell');
  const removed = run([{ at: 0, services: [svc({ state: 'down' })] }, { at: 6 * MIN, services: [svc({ state: 'down' })] }, { at: 7 * MIN, services: [] }]);
  assert.deepEqual(removed.sent.map((m) => m.kind), ['failure'], 'removed, not recovered: no "back" message');
  assert.deepEqual(removed.state.open, {});
  const muted = run([{ at: 0, services: [svc({ state: 'down' })], allowed: false }, { at: 6 * MIN, services: [svc({ state: 'down' })], allowed: false }, { at: 9 * MIN, services: [svc()] }]);
  assert.deepEqual(muted.sent, []);
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
  assert.deepEqual(seen.map((s) => s.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
  assert.deepEqual(seen.slice(1).map((s) => s.session), ['sess-1', 'sess-1', 'sess-1'], 'the session id is carried');
  assert.deepEqual(seen[3]!.args, args);
  toolName = 'relay.notify'; // a server that keeps the dots (as a real operator channel does)
  seen.length = 0;
  await callCapability(target, 'relay.notify', args, '0.7.5');
  assert.equal(seen.at(-1)!.method, 'tools/call');
  toolName = 'something_else';
  await assert.rejects(callCapability(target, 'relay.notify', args, '0.7.5'), /offers no tool for relay\.notify/);
  toolName = 'relay_notify';
  refuse = true;
  await assert.rejects(callCapability(target, 'relay.notify', args, '0.7.5'), /relay_notify refused: invalid_event_id/);
  await assert.rejects(callCapability({ origin: 'http://localhost:1', path: '/mcp' }, 'x.notify', {}, '0'), /this machine only/);
  assert.deepEqual(rpcResult({ headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":2,"result":{"ok":1}}' }, 2), { jsonrpc: '2.0', id: 2, result: { ok: 1 } });
});
