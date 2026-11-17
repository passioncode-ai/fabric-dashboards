// FD-48 (operator decision 2026-10-11): outages reach the operator away from the Mac: episodes, their timing, and
// the operator-channel service they go through. FD-76 (the operator's Telegram rule of 2026-10-19): over 15 minutes,
// one case once, no routine.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import test from 'node:test';
import { callCapability, rpcResult } from '../src/core/mcp-client';
import { OutageAlerts } from '../src/electron/outage-alerts';
import { alertWords, channelEventId, chooseChannel, HELD_RETRY_MS, heldRefusal, notifyArguments, PERSONAL_SIDE, sideOf, delivered, emptyOutageState, notifyChannelOf, observe, OUTAGE_ALERT_AFTER_MS, owed, type OutageState, type Watched, type Words } from '../src/core/outage-alerts';
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

test('FD-76: an outage under fifteen minutes sends nothing; one held fifteen minutes sends one message, and one when it is back', () => {
  const short = run([{ at: 0, services: [down] }, { at: 14 * MIN, services: [down] }, { at: 14 * MIN + 1, services: [svc()] }, { at: 30 * MIN, services: [svc()] }]);
  assert.deepEqual(short.sent, [], 'a blip never reaches the channel');
  const long = run([{ at: 0, services: [down] }, { at: 3 * MIN, services: [down] }, { at: OUTAGE_ALERT_AFTER_MS, services: [down] }, { at: 16 * MIN, services: [down] }, { at: 185 * MIN, services: [svc()] }, { at: 195 * MIN, services: [svc()] }, { at: 200 * MIN, services: [svc()] }, { at: 201 * MIN, services: [svc()] }]);
  assert.equal(OUTAGE_ALERT_AFTER_MS, 15 * MIN);
  assert.deepEqual(long.sent.map((m) => [m.kind, m.subject, m.text]), [['failure', 'Copy is down', 'For 15 min: connection refused'], ['recovery', 'Copy is back', 'Back after 185 min.']], 'one message at fifteen minutes, none repeated, one on recovery after the 15-minute calm');
  assert.equal(long.sent[1]!.at, 200 * MIN, 'back only once it stayed well fifteen minutes');
  assert.equal(long.sent[0]!.eventId, 'outage:copy.default:0');
  assert.equal(long.sent[1]!.eventId, 'outage:copy.default:0:back');
  assert.deepEqual(long.state.episodes, {}, 'a settled episode is forgotten at the next look');
});

test('FD-76: a short outage looked at every minute through its calm sends nothing: the failure is owed only while the agent is still unavailable', () => {
  // The installed 0.7.15 sent "down" and "back" 18 s apart for an agent that had been down about 20 s (2026-10-19
  // 21:21 UTC): the open episode had passed fifteen minutes of age while the agent was already well again.
  const steps = [{ at: 0, services: [down] }, { at: 20_000, services: [svc()] }];
  for (let m = 1; m <= 40; m += 1) steps.push({ at: m * MIN, services: [svc()] });
  assert.deepEqual(run(steps).sent, [], 'down 20 s: nothing, neither at fifteen minutes nor when the calm ends');
  const late = run([{ at: 0, services: [down] }, { at: 14 * MIN, services: [down] }, { at: 14 * MIN + 30_000, services: [svc()] }, { at: 15 * MIN, services: [svc()] }, { at: 15 * MIN + 1, services: [down] }, { at: 16 * MIN, services: [down] }, { at: 31 * MIN + 2, services: [svc()] }, { at: 47 * MIN, services: [svc()] }]);
  assert.deepEqual(late.sent.map((m) => [m.at, m.kind]), [[15 * MIN + 1, 'failure'], [47 * MIN, 'recovery']], 'down again within the calm: the same case, told when it is unavailable again');
});

test('FD-76: one case, once: a service that falls again within fifteen minutes of coming back is the same outage', () => {
  const r = run([
    { at: 0, services: [down] }, { at: 20 * MIN, services: [down] },
    { at: 30 * MIN, services: [svc()] }, { at: 40 * MIN, services: [down] }, { at: 60 * MIN, services: [down] },
    { at: 70 * MIN, services: [svc()] }, { at: 86 * MIN, services: [svc()] },
  ]);
  assert.deepEqual(r.sent.map((m) => [m.at, m.kind, m.text]), [[20 * MIN, 'failure', 'For 20 min: connection refused'], [86 * MIN, 'recovery', 'Back after 70 min.']]);
});

test('FD-48: a down–up flicker is one outage; going from down to degraded is not a recovery', () => {
  const flicker = [];
  for (let m = 0; m <= 30; m += 1) flicker.push({ at: m * MIN, services: [m % 5 === 4 ? svc() : down] });
  assert.deepEqual(run(flicker).sent.map((m) => m.kind), ['failure'], 'down 4 of every 5 minutes still alerts, once');
  const degraded = svc({ state: 'degraded', degraded: [{ source: 'database', reason: 'unreachable' }] });
  const half = run([{ at: 0, services: [down] }, { at: 16 * MIN, services: [down] }, { at: 17 * MIN, services: [degraded] }, { at: 60 * MIN, services: [degraded] }]);
  assert.deepEqual(half.sent.map((m) => m.kind), ['failure'], 'still impaired: no "back"');
});

test('FD-76: a degraded source alone never reaches the channel (it stays on the Mac); only an agent that does not answer does', () => {
  const db = { source: 'database', reason: 'database unreachable' };
  const r = run([
    { at: 0, services: [svc()] }, { at: 1 * MIN, services: [svc({ state: 'degraded', degraded: [db] })] },
    { at: 30 * MIN, services: [svc({ state: 'degraded', degraded: [db] })] }, { at: 120 * MIN, services: [svc({ state: 'degraded', degraded: [db] })] },
    { at: 121 * MIN, services: [svc()] }, { at: 140 * MIN, services: [svc()] },
  ]);
  assert.deepEqual(r.sent, []);
  assert.deepEqual(r.state.episodes, {}, 'no episode was opened');
});

test('FD-48: delivery is recorded only when the channel took it — a failure waits, a recovery never comes first, a missed outage is told once after', () => {
  const r = run([{ at: 0, services: [down] }, { at: 16 * MIN, services: [down], deliver: false }, { at: 17 * MIN, services: [down] }, { at: 30 * MIN, services: [svc()] }, { at: 46 * MIN, services: [svc()] }]);
  assert.deepEqual(r.sent.map((m) => [m.at, m.kind]), [[17 * MIN, 'failure'], [46 * MIN, 'recovery']], 'retried at the next look, in order');
  const channelDown = run([{ at: 0, services: [down] }, { at: 16 * MIN, services: [down], deliver: false }, { at: 20 * MIN, services: [svc()], deliver: false }, { at: 36 * MIN, services: [svc()] }]);
  assert.deepEqual(channelDown.sent.map((m) => [m.kind, m.text]), [['recovery', 'Was down 20 min (connection refused)']], 'never "back" before "down": one message after, saying both');
});

test('FD-48: a removed service closes its episode with one message; a muted episode sends nothing, nor its recovery; eventIds stay short', () => {
  const removed = run([{ at: 0, services: [down] }, { at: 16 * MIN, services: [down] }, { at: 17 * MIN, services: [] }]);
  assert.deepEqual(removed.sent.map((m) => [m.kind, m.subject]), [['failure', 'Copy is down'], ['recovery', 'Copy was removed']]);
  const muted = run([{ at: 0, services: [down], allowed: false }, { at: 16 * MIN, services: [down], allowed: false }, { at: 19 * MIN, services: [svc()], allowed: false }, { at: 40 * MIN, services: [svc()], allowed: false }]);
  assert.deepEqual(muted.sent, []);
  const long = 'a'.repeat(63) + '.' + 'b'.repeat(32);
  const ids = run([{ at: 0, services: [svc({ key: long, state: 'down' })] }, { at: 16 * MIN, services: [svc({ key: long, state: 'down' })] }, { at: 19 * MIN, services: [svc({ key: long })] }, { at: 40 * MIN, services: [svc({ key: long })] }]).sent.map((m) => m.eventId);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.ok(id.length <= 160 && !id.includes('/'), id);
});

test('FD-48: the channel is a local service offering <id>.notify over streamable HTTP; automatic takes the only one', () => {
  const ready = (key: string, caps: string[], origin = 'http://127.0.0.1:47832') => ({ key, state: 'ready' as const, descriptor: { origin } as never, wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http' as const, capabilities: caps } } } as never });
  const channel = ready('relay.default', ['relay.status', 'relay.notify']);
  assert.deepEqual(notifyChannelOf(channel), { key: 'relay.default', origin: 'http://127.0.0.1:47832', path: '/mcp', capability: 'relay.notify' });
  assert.equal(notifyChannelOf(ready('far.default', ['far.notify'], 'https://far.example.com')), null, 'this machine only');
  assert.equal(notifyChannelOf(ready('x.default', ['x.notifyAll'])), null);
  const other = ready('writer.default', ['writer.write']);
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
  const after = (setup: boolean) => run([
    { at: 0, services: [down] }, { at: 16 * MIN, services: [down] },
    { at: 17 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'pinned model unavailable', ...(setup ? { setup: true } : {}) }] })] },
    { at: 40 * MIN, services: [svc({ state: 'degraded', degraded: [{ source: 'execution', reason: 'pinned model unavailable', ...(setup ? { setup: true } : {}) }] })] },
  ]).sent.map((m) => m.kind);
  assert.deepEqual(after(false), ['failure'], 'after an outage, a source failing without the flag keeps the outage open (FD-76: a degraded source alone opens none)');
  assert.deepEqual(after(true), ['failure', 'recovery'], 'one waiting for setup is not the outage going on');
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


test('DEC-0154 HA-2: a watcher counts foreign and foreign-user as unavailable, as it counts down: the agent serves nothing', () => {
  for (const state of ['foreign', 'foreign-user'] as const) {
    const held = svc({ state, reason: 'Port 47195 is held by a program of another macOS user on this Mac. Nothing is sent to it.' });
    const r = run([{ at: 0, services: [held] }, { at: OUTAGE_ALERT_AFTER_MS, services: [held] }, { at: 20 * MIN, services: [svc()] }, { at: 36 * MIN, services: [svc()] }]);
    assert.deepEqual(r.sent.map((m) => [m.kind, m.subject, m.text]), [
      ['failure', 'Copy is down', 'For 15 min: Port 47195 is held by a program of another macOS user on this Mac. Nothing is sent to it.'],
      ['recovery', 'Copy is back', 'Back after 20 min.'],
    ], state);
  }
});

test('FD-255 (security audit F3): a token goes to a loopback MCP server only when this user\'s own process listens there', async (t) => {
  const { setLoopbackOwnerCheck } = await import('@passioncode-ai/fabric-service-host');
  let hits = 0;
  const server = http.createServer((req, res) => { hits++; req.resume(); res.writeHead(500); res.end(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.close(); setLoopbackOwnerCheck(null); });
  const target = { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, path: '/mcp', headers: { Authorization: 'Bearer x' } };
  setLoopbackOwnerCheck(async () => false);
  await assert.rejects(callCapability(target, 'relay.notify', {}, '0.8.88'), /not listened on by this user's process, so its token was not sent/);
  setLoopbackOwnerCheck(async () => 'unknown');
  await assert.rejects(callCapability(target, 'relay.notify', {}, '0.8.88'), /could not be told, so its token was not sent/);
  assert.equal(hits, 0, 'nothing reached the port');
  setLoopbackOwnerCheck(async () => true);
  await assert.rejects(callCapability(target, 'relay.notify', {}, '0.8.88'), /initialize answered HTTP 500/);
  assert.equal(hits, 1, 'our own process: the call goes');
  setLoopbackOwnerCheck(async () => false);
  await assert.rejects(callCapability({ ...target, headers: {} }, 'relay.notify', {}, '0.8.88'), /HTTP 500/, 'no token, no check');
});

test('Wave 4 C-06: a message the channel refuses waits for its own retry; the one behind it still goes', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { OutageAlerts } = await import('../src/electron/outage-alerts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-c06-'));
  const channel = { key: 'relay.default', state: 'ready' as const, descriptor: { origin: 'http://127.0.0.1:47832' } as never, wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http' as const, capabilities: ['relay.notify'] } } } as never };
  const lines: string[] = [];
  const alerts = new OutageAlerts({ dataDir: dir, snapshots: () => [channel as never], settings: () => merge({}), words: () => words, nameOf: () => 'x', reasonOf: () => 'x', allowed: () => true, version: '0.0.0', log: (l) => lines.push(l), changed: () => undefined });
  const sent: string[] = [];
  let calls = 0;
  (alerts as unknown as { deliver: (c: unknown, m: { eventId: string }) => Promise<void> }).deliver = async (_c, m) => { calls++; if (calls === 1) throw new Error('refused'); sent.push(m.eventId); };
  alerts.ask('a.default', 'e1', { name: 'A', episode: 'ep-a', at: Date.now() - 2, text: 'first?', link: null });
  alerts.ask('b.default', 'e2', { name: 'B', episode: 'ep-b', at: Date.now() - 1, text: 'second?', link: null });
  await (alerts as unknown as { flush: () => Promise<void> }).flush();
  alerts.stop();
  assert.equal(calls, 2, 'the round went on after the refusal');
  assert.equal(sent.length, 1, 'the second message was delivered');
});

test('FD-269: a message goes only through a channel of its agent\'s side; an organization without one falls back to the operator\'s own', () => {
  const at = (key: string, org: { name: string; label: string; personal?: boolean } | null | undefined, caps = [`${key.split('.')[0]}.notify`]) =>
    ({ key, state: 'ready' as const, organization: org, descriptor: { origin: 'http://127.0.0.1:47832' } as never, wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http' as const, capabilities: caps } } } as never });
  const mine = { name: 'me', label: 'Me', personal: true };
  const acme = { name: 'acme', label: 'Acme' };
  const beta = { name: 'beta', label: 'Beta' };
  assert.equal(sideOf(mine), PERSONAL_SIDE);
  assert.equal(sideOf(null), PERSONAL_SIDE, 'not attributed: the operator\'s side');
  assert.equal(sideOf(undefined), PERSONAL_SIDE, 'no map read');
  assert.equal(sideOf(acme), 'org:acme');
  const personal = at('relay.default', mine);
  const acmeChannel = at('acmebot.default', acme);
  const betaChannel = at('betabot.default', beta);
  const key = (c: unknown) => (c as { key?: string }).key ?? (c as { none: string }).none;
  // Each side takes its own channel; the operator's agents never go through an organization's.
  assert.equal(key(chooseChannel([personal, acmeChannel, betaChannel], 'auto', 'org:acme')), 'acmebot.default');
  assert.equal(key(chooseChannel([personal, acmeChannel, betaChannel], 'auto', PERSONAL_SIDE)), 'relay.default');
  assert.equal(key(chooseChannel([acmeChannel], 'auto', PERSONAL_SIDE)), 'none-installed', 'an organization\'s channel never carries the operator\'s agents');
  // An organization with no channel of its own falls back to the operator's, never to another organization's.
  assert.equal(key(chooseChannel([personal, betaChannel], 'auto', 'org:acme')), 'relay.default');
  assert.equal(key(chooseChannel([betaChannel], 'auto', 'org:acme')), 'none-installed');
  // The person's choice holds where it is one of the side's channels; a choice of another side's is not used for it.
  assert.equal(key(chooseChannel([personal, acmeChannel], 'acmebot.default', 'org:acme')), 'acmebot.default');
  assert.equal(key(chooseChannel([personal, acmeChannel], 'acmebot.default', PERSONAL_SIDE)), 'relay.default');
  assert.equal(key(chooseChannel([personal, at('relay2.default', mine)], 'auto', 'org:acme')), 'several');
  // Without a side, the operator's: one machine-wide channel as before.
  assert.equal(key(chooseChannel([personal], 'auto')), 'relay.default');
});

test('FD-269: the side is kept with the episode, so a removed agent\'s recovery still names it', () => {
  const words = { down: (n: string) => `${n} is down`, failing: (n: string) => `${n} fails`, back: (n: string) => `${n} is back`, removed: (n: string) => `${n} was removed`, since: () => 's', after: () => 'a', wasDown: () => 'w' } as unknown as Words;
  const w = (state: 'ready' | 'down'): Watched => ({ key: 'a.default', name: 'A', state, startedAt: null, degraded: [], reason: 'r', side: 'org:acme' });
  let st: OutageState = emptyOutageState();
  st = observe(st, [w('down')], 0);
  assert.equal(st.episodes['a.default']!.side, 'org:acme');
  st = observe(st, [w('down')], OUTAGE_ALERT_AFTER_MS + 1);
  const due = owed(st, OUTAGE_ALERT_AFTER_MS + 1, words, () => true);
  assert.equal(due[0]!.msg.side, 'org:acme');
  st = observe(delivered(st, due[0]!.id, 'failure'), [], OUTAGE_ALERT_AFTER_MS + 2);
  const back = owed(st, OUTAGE_ALERT_AFTER_MS + 2, words, () => true);
  assert.deepEqual(back.map((d) => [d.msg.kind, d.msg.side]), [['recovery', 'org:acme']]);
});

test('FD-286: the channel gets only its contract\'s fields; a message\'s service and side never reach it (invalid_event)', () => {
  const args = notifyArguments({ eventId: 'outage:copy.default:0:back', kind: 'recovery', subject: 'S'.repeat(200), text: 'T'.repeat(4000), serviceKey: 'copy.default', side: 'org:acme' });
  assert.deepEqual(Object.keys(args).sort(), ['eventId', 'kind', 'subject', 'text']);
  assert.equal(args.subject.length, 160);
  assert.equal(args.text.length, 3500);
  assert.equal(args.eventId, 'outage:copy.default:0:back');
});

test('FD-287: a refusal with a code waits an hour and is logged once; others are retried every minute', async (t) => {
  assert.equal(heldRefusal('relay_notify refused: invalid_event field side is not allowed'), 'invalid_event');
  assert.equal(heldRefusal('relay_notify refused: invalid_event_id'), 'invalid_event_id');
  assert.equal(heldRefusal('relay_notify answered HTTP 502'), null);
  assert.equal(heldRefusal('connect ECONNREFUSED 127.0.0.1:1'), null);
  assert.equal(heldRefusal('relay_notify refused: busy, try later'), null);

  let refusal: string | null = 'invalid_event field side is not allowed';
  let calls = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
      const msg = JSON.parse(body) as { id?: number; method: string };
      if (msg.method === 'initialize') { res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 's' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} })); return; }
      if (!msg.id) { res.writeHead(202); res.end(); return; }
      if (msg.method === 'tools/list') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'relay_notify' }] } })); return; }
      calls++;
      const result = refusal ? { isError: true, content: [{ type: 'text', text: refusal }] } : { content: [{ type: 'text', text: '{}' }] };
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-287-'));
  let now = Date.parse('2026-11-16T12:00:00Z');
  const lines: string[] = [];
  const channel = { key: 'relay.default', state: 'ready', organization: null, descriptor: { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, auth: {} }, wellKnown: { surfaces: { mcp: { transport: 'streamable-http', path: '/mcp', capabilities: ['relay.notify'] } } } };
  const alerts = new OutageAlerts({
    dataDir: dir, snapshots: () => [channel] as never, settings: () => merge({}), words: () => ({ down: (n) => n, failing: (n) => n, back: (n) => n, removed: (n) => n, since: () => '', after: () => '', wasDown: () => '' }),
    nameOf: () => 'Copy', reasonOf: () => '', allowed: () => true, version: '0', log: (l) => lines.push(l), changed: () => {}, now: () => now,
  });
  t.after(() => { alerts.stop(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const settle = async (n: number) => { for (let i = 0; i < 100 && calls < n; i++) await new Promise((r) => setTimeout(r, 10)); await new Promise((r) => setTimeout(r, 30)); };
  alerts.ask('copy.default', 'e1', { name: 'Copy', episode: 'ep', at: now, text: 'decide', link: null });
  await settle(1);
  assert.equal(calls, 1);
  assert.equal(lines.filter((l) => l.includes('refused by relay.default (invalid_event)')).length, 1);
  assert.deepEqual(alerts.status().held, { count: 1, codes: ['invalid_event'] });
  now += 2 * 60_000; alerts.tick(); await settle(2);
  assert.equal(calls, 1, 'not tried again within the hour');
  now += HELD_RETRY_MS; alerts.tick(); await settle(2);
  assert.equal(calls, 2, 'tried again after the hour');
  assert.equal(lines.filter((l) => l.includes('refused by')).length, 1, 'the same refusal is said once');
  refusal = null; now += HELD_RETRY_MS; alerts.tick(); await settle(3);
  assert.equal(calls, 3);
  assert.equal(alerts.status().held, undefined, 'a delivered message is no longer held');
  assert.ok(lines.some((l) => l.startsWith('alerts: sent result')));
});

test('FD-289: before any service has answered, a message waits without saying there is no channel; once one answers it goes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-289-'));
  const lines: string[] = [];
  const read = { key: 'relay.default', state: 'starting', organization: null, descriptor: { origin: 'http://127.0.0.1:47832' } } as Record<string, unknown>;
  let snaps: Record<string, unknown>[] = [read];
  const alerts = new OutageAlerts({ dataDir: dir, snapshots: () => snaps as never, settings: () => merge({}), words: () => words, nameOf: () => 'x', reasonOf: () => 'x', allowed: () => true, version: '0', log: (l) => lines.push(l), changed: () => undefined });
  const sent: string[] = [];
  (alerts as unknown as { deliver: (c: unknown, m: { eventId: string }) => Promise<void> }).deliver = async (_c, m) => { sent.push(m.eventId); };
  const flush = () => (alerts as unknown as { flush: () => Promise<void> }).flush();
  alerts.ask('a.default', 'e1', { name: 'A', episode: 'ep-a', at: Date.now(), text: 'decide?', link: null });
  await flush();
  assert.deepEqual(sent, []);
  assert.equal(lines.filter((l) => l.includes('no channel')).length, 0, 'nothing is said before the first answer');
  const other = { key: 'b.default', state: 'ready', organization: null, descriptor: { origin: 'http://127.0.0.1:1' }, wellKnown: { surfaces: {} } };
  snaps = [read, other];
  await flush();
  assert.equal(lines.filter((l) => l.includes('no channel')).length, 1, 'once a service has answered, a missing channel is said');
  snaps = [{ ...read, state: 'ready', wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http', capabilities: ['relay.notify'] } } } }];
  await flush();
  alerts.stop();
  assert.equal(sent.length, 1, 'the message went once the channel answered');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-285: a look at the services keeps the health book (the 30 s tick erased it)', () => {
  const health = { 'fabric-switchboard': { readAt: 1, read: { state: 'warn' as const }, causes: { errors_today: { bad: 1, good: 0 } } } };
  const st: OutageState = { ...emptyOutageState(), health };
  const next = observe(st, [], 5);
  assert.deepEqual(next.health, health);
  assert.equal('health' in observe(emptyOutageState(), [], 5), false, 'no book is added where none was');
});

test('FD-285: an event id reaches the channel in the form it takes', () => {
  const re = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
  assert.equal(notifyArguments({ eventId: 'health:fabric-switchboard:errors_today@2026-11-17', kind: 'failure', subject: 's', text: 't', serviceKey: 'x', side: PERSONAL_SIDE }).eventId, 'health:fabric-switchboard:errors_today_2026-11-17');
  assert.equal(channelEventId('health:p:blind@2026-11-17:back'), 'health:p:blind_2026-11-17:back');
  for (const id of ['outage:copy.default:0', '@x', 'a/b c', 'é'.repeat(300), ':back']) assert.match(channelEventId(id), re, id);
  assert.equal(channelEventId('outage:copy.default:0:back'), 'outage:copy.default:0:back');
});

// FD-295 (architect review 445c0b80 item 9): a mass outage is one case. Three or more agents of one side whose
// messages come due within five minutes go out as one message naming them, and their recoveries as one.
const many: Words = { ...words, group: { down: (n) => `${n} agents are not answering`, back: (n) => `${n} agents are back`, line: (name, m, r) => `${name}: ${m} min, ${r}`, more: (n) => `and ${n} more` } };
const runWith = (w: Words, steps: { at: number; services: Watched[] }[]) => {
  let state: OutageState = emptyOutageState();
  const sent: { at: number; kind: string; subject: string; text: string; eventId: string }[] = [];
  for (const s of steps) {
    state = observe(state, s.services, s.at);
    for (const d of owed(state, s.at, w, () => true)) {
      sent.push({ at: s.at, kind: d.msg.kind, subject: d.msg.subject, text: d.msg.text, eventId: d.msg.eventId });
      for (const id of d.ids ?? [d.id]) state = delivered(state, id, d.step);
    }
  }
  return { state, sent };
};
const agent = (i: number, over: Partial<Watched> = {}) => svc({ key: `a${i}.default`, name: `Agent ${i}`, ...over });
const fleet = (n: number, state: Watched['state'], from = 0) => Array.from({ length: n }, (_, i) => agent(i + from, { state }));
const everyMinute = (to: number, at: (m: number) => Watched[]) => Array.from({ length: to + 1 }, (_, m) => ({ at: m * MIN, services: at(m) }));

test('FD-295: thirty agents falling together send one message naming them, and one when they are back', () => {
  const r = runWith(many, everyMinute(70, (m) => fleet(30, m < 30 ? 'down' : 'ready')));
  assert.deepEqual(r.sent.map((s) => [s.at, s.kind, s.subject]), [[15 * MIN, 'failure', '30 agents are not answering'], [45 * MIN, 'recovery', '30 agents are back']]);
  assert.match(r.sent[0]!.text, /^Agent 0: 15 min, connection refused\n/);
  assert.match(r.sent[0]!.text, /\nand 10 more$/, 'twenty agents named, the rest counted');
  assert.equal(r.sent[0]!.text.split('\n').length, 21);
  assert.equal(r.sent[0]!.eventId, 'outage:a0.default:0:+29', 'the group is named by its first member, the same on every retry');
  assert.equal(r.sent[1]!.eventId, 'outage:a0.default:0:+29:back');
  assert.deepEqual(r.state.episodes, {}, 'every member is settled');
});

test('FD-295: agents falling a few minutes apart wait for each other, at most five minutes', () => {
  const r = runWith(many, everyMinute(40, (m) => [agent(1, { state: m >= 0 ? 'down' : 'ready' }), agent(2, { state: m >= 2 ? 'down' : 'ready' }), agent(3, { state: m >= 4 ? 'down' : 'ready' })]));
  assert.deepEqual(r.sent.map((s) => [s.at, s.subject]), [[19 * MIN, '3 agents are not answering']], 'the first is held until the last comes due, four minutes later');
  const far = runWith(many, everyMinute(40, (m) => [agent(1, { state: 'down' }), agent(2, { state: m >= 2 ? 'down' : 'ready' }), agent(3, { state: m >= 9 ? 'down' : 'ready' })]));
  assert.deepEqual(far.sent.map((s) => [s.at, s.subject]), [[15 * MIN, 'Agent 1 is down'], [17 * MIN, 'Agent 2 is down'], [24 * MIN, 'Agent 3 is down']], 'a peer more than five minutes behind is not waited for');
});

test('FD-295: two agents falling together are told one by one; the old Words send every one alone', () => {
  const two = runWith(many, everyMinute(20, () => fleet(2, 'down')));
  assert.deepEqual(two.sent.map((s) => s.subject), ['Agent 0 is down', 'Agent 1 is down']);
  const old = runWith(words, everyMinute(20, () => fleet(4, 'down')));
  assert.equal(old.sent.length, 4, 'no group words, no group');
});

test('FD-295: agents of different sides are never grouped together', () => {
  const r = runWith(many, everyMinute(20, () => [...fleet(3, 'down'), ...fleet(3, 'down', 10).map((a) => ({ ...a, side: 'org:acme' }))]));
  assert.deepEqual(r.sent.map((s) => s.subject), ['3 agents are not answering', '3 agents are not answering']);
  assert.deepEqual(r.sent.map((s) => s.eventId), ['outage:a0.default:0:+2', 'outage:a10.default:0:+2']);
});

test('FD-295: a group the channel refused is sent again whole, under the same id', () => {
  let state: OutageState = emptyOutageState();
  for (let m = 0; m <= 15; m += 1) state = observe(state, fleet(4, 'down'), m * MIN);
  const first = owed(state, 15 * MIN, many, () => true);
  assert.equal(first.length, 1);
  assert.deepEqual(first[0]!.ids, ['a0.default', 'a1.default', 'a2.default', 'a3.default']);
  state = observe(state, fleet(4, 'down'), 16 * MIN);
  const again = owed(state, 16 * MIN, many, () => true);
  assert.equal(again[0]!.msg.eventId, first[0]!.msg.eventId);
  for (const id of again[0]!.ids!) state = delivered(state, id, again[0]!.step);
  assert.deepEqual(owed(state, 17 * MIN, many, () => true), []);
});

test('FD-304: alertWords gives every channel sentence in English and Russian, with every placeholder filled', () => {
  for (const l of ['en', 'ru'] as const) {
    const w = alertWords(l);
    const said = [
      w.down('A'), w.failing('A', 'db'), w.back('A'), w.since(5, 'r'), w.after(5), w.removed('A'), w.wasDown(5, 'r'), w.ask('A'), w.open('fabric-dashboards://x'),
      w.group.down(3), w.group.back(3), w.group.line('A', 5, 'r'), w.group.more(2),
      w.health!.open('A', 'c', 'warn'), w.health!.back('A', 'c'), w.health!.blind('A', 'r'), w.health!.blindBack('A'), w.health!.detail('area', 2, 'fix it'), w.health!.detail('area', 2),
    ];
    for (const s of said) {
      assert.ok(s.length > 0, l);
      assert.doesNotMatch(s, /\{[a-z]+\}/, `${l}: ${s}`);
      assert.doesNotMatch(s, /^alerts\./, `${l}: a key, not a sentence: ${s}`);
    }
    assert.notEqual(alertWords('en').down('A'), alertWords('ru').down('A'));
  }
});
