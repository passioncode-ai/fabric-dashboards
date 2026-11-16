// FD-285 (SB-393, contract DEC-0179): the observer of `agent-health/1` reports. The contract's vectors (worst state,
// what a reader counts, the episode key) run against the port; the episodes follow the agents base's `alert-episodes`
// pattern (two bad readings open, two good close, one message each way, an unreadable report one episode a product).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020';
import { BLIND, episodeKey, healthAnswerOf, healthDelivered, observeHealth, owedHealth, readHealth, worstState, type HealthBook, type HealthReport, type HealthWords } from '../src/core/agent-health';

const read = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const V = read('vectors_agent-health.json') as {
  worst: { name: string; input: unknown[]; expected: string }[];
  read: { name: string; input: unknown; expected: { state: string; reason?: string } }[];
  episodes: { name: string; input: [string, string, number]; expected: string }[];
};

for (const c of V.worst) test(`DEC-0179 worst vector: ${c.name}`, () => assert.equal(worstState(c.input), c.expected));
for (const c of V.read) test(`DEC-0179 read vector: ${c.name}`, () => assert.deepEqual(readHealth(c.input), c.expected));
for (const c of V.episodes) test(`DEC-0179 episode vector: ${c.name}`, () => assert.equal(episodeKey(...c.input), c.expected));

test('DEC-0179: the reader and the contract schema agree on every read vector (HL-1)', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(read('schema_common.json'));
  const valid = ajv.compile(read('schema_agent-health.json'));
  for (const c of V.read) {
    if (c.input === null) continue;
    assert.equal(c.expected.reason === 'schema', !valid(c.input), c.name);
  }
});

const report = (checks: HealthReport['checks'], over: Partial<HealthReport> = {}): HealthReport =>
  ({ schema: 'agent-health/1', product: 'fabric-switchboard', version: '0.7.102', at: 1794851134, state: worstState(checks.map((c) => c.state)), checks, ...over });
const ok = (id = 'owner') => ({ id, area: 'lifecycle', state: 'ok' as const, count: 0, fix: null });
const errors = (state: 'ok' | 'warn' | 'fail' | 'unknown', count = 716) => ({ id: 'errors_today', area: 'errors', state, count, fix: { tool: 'switchboard_bugs' } });
const words: HealthWords = {
  open: (n, c, s) => `${n}: ${c} is ${s}`, back: (n, c) => `${n}: ${c} is ok again`, blind: (n, r) => `${n}: health unreadable (${r})`,
  blindBack: (n) => `${n}: health readable again`, detail: (a, n, f) => `area ${a}, count ${n}${f ? `, fix ${f}` : ''}`,
};
const P = 'fabric-switchboard';
const MIN = 60_000;
/** Read each answer five minutes apart, delivering what is owed after each. */
function run(answers: unknown[], deliver = true) {
  let book: HealthBook = {};
  const sent: { at: number; kind: string; subject: string; text: string; eventId: string }[] = [];
  answers.forEach((a, i) => {
    const at = 1794851134000 + i * 5 * MIN;
    book = observeHealth(book, P, a, at);
    if (!deliver) return;
    for (const d of owedHealth(book, words, () => 'Switchboard', () => true)) {
      sent.push({ at, kind: d.msg.kind, subject: d.msg.subject, text: d.msg.text, eventId: d.msg.eventId });
      book = healthDelivered(book, d.id, d.step);
    }
  });
  return { book, sent };
}

test('FD-285: Switchboard prints its report inside {data, ok}; the reader takes the report', () => {
  const r = report([ok(), errors('warn')]);
  assert.deepEqual(healthAnswerOf(JSON.stringify({ data: r, ok: true })), r);
  assert.equal(healthAnswerOf(JSON.stringify({ data: r, ok: false })), null);
  assert.equal(healthAnswerOf('not json'), null);
  assert.deepEqual(readHealth(healthAnswerOf(JSON.stringify({ data: r, ok: true }))), { state: 'warn' });
});

test('FD-285: one bad reading opens nothing; two in a row open one episode and one message', () => {
  const first = run([report([ok(), errors('warn')])]);
  assert.equal(first.sent.length, 0);
  const { sent, book } = run([report([ok(), errors('warn')]), report([ok(), errors('warn', 717)]), report([ok(), errors('fail', 900)])]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.eventId, `health:${P}:errors_today@2026-11-16`);
  assert.equal(sent[0]!.subject, 'Switchboard: errors_today is warn');
  assert.equal(sent[0]!.text, 'area errors, count 717, fix tool switchboard_bugs');
  assert.equal(sent[0]!.kind, 'failure');
  // a worse state on an open episode is no second message; the episode follows the count
  assert.equal(book[P]!.causes.errors_today!.episode!.state, 'fail');
  assert.equal(book[P]!.causes.errors_today!.episode!.count, 900);
});

test('FD-285: two good readings close the episode with one recovery; one good is not enough', () => {
  const bad = report([ok(), errors('warn')]);
  const good = report([ok(), errors('ok', 3)]);
  const one = run([bad, bad, good]);
  assert.deepEqual(one.sent.map((s) => s.kind), ['failure']);
  const { sent, book } = run([bad, bad, good, good, good]);
  assert.deepEqual(sent.map((s) => s.kind), ['failure', 'recovery']);
  assert.equal(sent[1]!.eventId, `health:${P}:errors_today@2026-11-16:back`);
  assert.equal(sent[1]!.subject, 'Switchboard: errors_today is ok again');
  assert.equal(book[P]!.causes.errors_today!.episode, undefined);
});

test('FD-285: unknown is never good: a bad, unknown, good, bad run keeps nothing open and an open episode open', () => {
  const bad = report([ok(), errors('fail')]);
  const unk = report([ok(), errors('unknown')]);
  const good = report([ok(), errors('ok')]);
  // unknown between two bad readings keeps the streak: it opens
  assert.equal(run([bad, unk, bad]).sent.length, 1);
  // unknown between two good readings breaks the good streak: still open
  const r = run([bad, bad, good, unk, good]);
  assert.deepEqual(r.sent.map((s) => s.kind), ['failure']);
  assert.notEqual(r.book[P]!.causes.errors_today!.episode, undefined);
});

test('FD-285: an unreadable report is one episode for the product, and every check stays where it was (HL-5, HL-6)', () => {
  const bad = report([ok(), errors('fail')]);
  const { sent, book } = run([bad, bad, null, null, null]);
  assert.deepEqual(sent.map((s) => s.subject), ['Switchboard: errors_today is fail', 'Switchboard: health unreadable (no-answer)']);
  assert.equal(sent[1]!.eventId, `health:${P}:${BLIND}@2026-11-16`);
  assert.notEqual(book[P]!.causes.errors_today!.episode, undefined);
  assert.equal(book[P]!.causes.errors_today!.episode!.closedAt, undefined);
  // a report that lies (ok while a check fails) reads unknown, never ok
  const lying = report([errors('fail')], { state: 'ok' });
  assert.deepEqual(readHealth(lying), { state: 'unknown', reason: 'FAC-SEM-181' });
  const back = run([lying, lying, report([ok()]), report([ok()])]);
  assert.deepEqual(back.sent.map((s) => s.subject), ['Switchboard: health unreadable (FAC-SEM-181)', 'Switchboard: health readable again']);
});

test('FD-285: another product\'s report under this product\'s name reads unknown', () => {
  const book = observeHealth({}, P, report([ok()], { product: 'other-product' }), 0);
  assert.deepEqual(book[P]!.read, { state: 'unknown', reason: 'other-product' });
});

test('FD-285: an episode the channel never carried closes silently; nothing owed is lost while the channel is out', () => {
  const bad = report([ok(), errors('warn')]);
  const good = report([ok(), errors('ok')]);
  const quiet = run([bad, bad, good, good], false);
  assert.equal(owedHealth(quiet.book, words, () => 'Switchboard', () => true).length, 0);
  const waiting = run([bad, bad], false);
  assert.equal(owedHealth(waiting.book, words, () => 'Switchboard', () => true).length, 1);
  assert.equal(owedHealth(waiting.book, words, () => 'Switchboard', () => false).length, 0, 'held by the person\'s rules');
});

test('FD-285: the episode key is the UTC day of the report that opened it, not of the next reading', () => {
  const late = 1794873599; // 2026-11-16T23:59:59Z
  const book1 = observeHealth({}, P, report([errors('fail')], { at: late }), 0);
  const book2 = observeHealth(book1, P, report([errors('fail')], { at: late + 1 }), 5 * MIN);
  assert.equal(book2[P]!.causes.errors_today!.episode!.key, `${P}:errors_today@2026-11-17`);
  const book3 = observeHealth(book2, P, report([errors('fail')], { at: late + 300 }), 10 * MIN);
  assert.equal(book3[P]!.causes.errors_today!.episode!.key, `${P}:errors_today@2026-11-17`);
});

test('FD-285: a check gone from the report is unmeasured, never healed; a good check with nothing open is forgotten', () => {
  const bad = report([ok(), errors('fail')]);
  const without = report([ok()]);
  const r = run([bad, bad, without, without, without]);
  assert.deepEqual(r.sent.map((s) => s.kind), ['failure']);
  assert.notEqual(r.book[P]!.causes.errors_today!.episode, undefined);
  const forgotten = run([report([ok(), errors('ok')]), without]);
  assert.equal(forgotten.book[P]!.causes.errors_today, undefined);
});

test('FD-285: through the operator channel: two bad reports send one failure, kept in outage-alerts.json; MCP agent_health reads it', async () => {
  const os = await import('node:os');
  const { OutageAlerts } = await import('../src/electron/outage-alerts');
  const { merge } = await import('../src/core/settings');
  const tools = await import('../src/mcp/tools');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-285-'));
  const channel = { key: 'relay.default', state: 'ready', organization: null, descriptor: { origin: 'http://127.0.0.1:1', auth: {} }, wellKnown: { surfaces: { mcp: { path: '/mcp', transport: 'streamable-http', capabilities: ['relay.notify'] } } } };
  let now = 1794851134000;
  const alerts = new OutageAlerts({
    dataDir: dir, snapshots: () => [channel] as never, settings: () => merge({}), version: '0', log: () => undefined, changed: () => undefined, now: () => now,
    words: () => ({ down: (n) => n, failing: (n) => n, back: (n) => n, removed: (n) => n, since: () => '', after: () => '', wasDown: () => '', health: words }),
    nameOf: () => 'x', reasonOf: () => '', allowed: () => true, productName: () => 'Switchboard',
  });
  const sent: { eventId: string; subject: string }[] = [];
  (alerts as unknown as { deliver: (c: unknown, m: { eventId: string; subject: string }) => Promise<void> }).deliver = async (_c, m) => { sent.push({ eventId: m.eventId, subject: m.subject }); };
  const flush = () => (alerts as unknown as { flush: () => Promise<void> }).flush();
  alerts.health(P, report([ok(), errors('warn')])); await flush();
  now += 5 * MIN;
  alerts.health(P, report([ok(), errors('warn')])); await flush();
  now += 5 * MIN;
  alerts.health(P, report([ok(), errors('warn')])); await flush();
  alerts.stop();
  assert.deepEqual(sent, [{ eventId: `health:${P}:errors_today@2026-11-16`, subject: 'Switchboard: errors_today is warn' }]);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'outage-alerts.json'), 'utf8'));
  assert.equal(saved.health[P].causes.errors_today.episode.failureDelivered, true);
  const read = tools.agentHealth({ settingsFile: () => path.join(dir, 'settings.json') } as never);
  assert.equal(read.products[P]!.read.state, 'warn');
  assert.equal(read.products[P]!.causes.errors_today!.episode!.key, `${P}:errors_today@2026-11-16`);
  assert.deepEqual(Object.keys(tools.agentHealth({ settingsFile: () => path.join(dir, 'settings.json') } as never, 'other').products), []);
  // a restart keeps the book and owes nothing again
  const again = new OutageAlerts({
    dataDir: dir, snapshots: () => [channel] as never, settings: () => merge({}), version: '0', log: () => undefined, changed: () => undefined, now: () => now,
    words: () => ({ down: (n) => n, failing: (n) => n, back: (n) => n, removed: (n) => n, since: () => '', after: () => '', wasDown: () => '', health: words }),
    nameOf: () => 'x', reasonOf: () => '', allowed: () => true,
  });
  assert.equal(again.healthBook()[P]!.causes.errors_today!.episode!.failureDelivered, true);
  again.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-285: the poller reads only an installed product with the command; a failed run is an unreadable report', async () => {
  const { HealthPoller } = await import('../src/electron/health-poller');
  const seen: [string, unknown][] = [];
  const lines: string[] = [];
  let result = { code: 0, stdout: JSON.stringify({ data: report([ok()]), ok: true }), stderr: '' };
  let binary: string | null = '/bin/switchboard';
  const poller = new HealthPoller({ binary: async () => binary, run: async () => result, observe: (p, a) => seen.push([p, a]), log: (l) => lines.push(l) });
  await poller.pass();
  assert.equal(seen.length, 1);
  assert.deepEqual(readHealth(seen[0]![1]), { state: 'ok' });
  result = { code: 2, stdout: '', stderr: "error: unrecognized subcommand 'health'" };
  await poller.pass(); await poller.pass();
  assert.equal(seen.length, 1, 'too old to have the command: not read');
  assert.equal(lines.length, 1, 'said once');
  result = { code: 1, stdout: '', stderr: 'boom' };
  await poller.pass();
  assert.deepEqual(seen[1], [P, null]);
  binary = null;
  await poller.pass();
  assert.equal(seen.length, 2, 'not installed: not read');
  poller.stop();
});
