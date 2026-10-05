// What every agent spent (ADR-0013): read on demand, per service, from its own usage report.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readSpend, sumSpend, type SpendDeps, type SpendEntry } from '../src/core/spend';
import type { SpendSum } from '@passioncode-ai/fabric-service-host/usage';
import type { Descriptor, WellKnown } from '../src/core/types';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const D = fixture('positive_service-descriptor.json') as Descriptor;
const WK = fixture('positive_service-well-known-usage.json') as WellKnown;
const NOW = Date.parse('2026-10-04T12:00:00Z');

function deps(over: Partial<SpendDeps> = {}): SpendDeps & { reads: string[] } {
  const reads: string[] = [];
  return { reads, token: () => 'tok-0123456789abcdef', fetchUsage: async (d, p) => { reads.push(`${d.id}.${d.instance}${p}`); return fixture('positive_service-usage.json'); }, now: () => NOW, ...over };
}

test('a service that declares surfaces.usage is read and summed; one that does not is "none" and is not contacted', async () => {
  const dd = deps();
  const out = await readSpend([
    { key: 'example-agent.default', descriptor: D, wellKnown: WK },
    { key: 'other.default', descriptor: { ...D, id: 'other' }, wellKnown: { ...WK, surfaces: { events: WK.surfaces.events } } },
    { key: 'down.default', descriptor: { ...D, id: 'down' }, wellKnown: null },
  ], dd);
  assert.deepEqual(out.map((e) => e.kind), ['report', 'none', 'none']);
  assert.deepEqual(dd.reads, ['example-agent.default/fabric/v1/usage']);
  const first = out[0]!;
  assert.ok(first.kind === 'report' && first.summary.week.calls === 19);
});

test('one service failing — refused token, unreadable token file, malformed report — is that entry, not the answer', async () => {
  const out = await readSpend([{ key: 'example-agent.default', descriptor: D, wellKnown: WK }], deps({ fetchUsage: async () => { throw new Error('the service refused the token (HTTP 401)'); } }));
  assert.deepEqual(out, [{ key: 'example-agent.default', kind: 'error', error: 'the service refused the token (HTTP 401)' }]);
  const noToken = await readSpend([{ key: 'example-agent.default', descriptor: D, wellKnown: WK }], deps({ token: () => { throw new Error('the token file is readable by others; set mode 0600'); } }));
  assert.equal(noToken[0]!.kind, 'error');
});

test('a usage path that leaves the service origin is refused without a request', async () => {
  const dd = deps();
  const out = await readSpend([{ key: 'example-agent.default', descriptor: D, wellKnown: { ...WK, surfaces: { ...WK.surfaces, usage: { path: '//evil.example/x' } } } }], dd);
  assert.equal(out[0]!.kind, 'error');
  assert.deepEqual(dd.reads, []);
});

test('fetchUsage: the token in its header, the report checked against the descriptor, refusals named', async () => {
  const http = await import('node:http');
  const { fetchUsage } = await import('../src/core/probe');
  let answer: { status: number; body: string } = { status: 200, body: JSON.stringify(fixture('positive_service-usage.json')) };
  let seen = '';
  const server = http.createServer((req, res) => { seen = String(req.headers['x-example-token'] ?? ''); res.writeHead(answer.status, { 'content-type': 'application/json' }); res.end(answer.body); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const d: Descriptor = { ...D, origin: `http://127.0.0.1:${port}` };
  try {
    const report = await fetchUsage(d, '/fabric/v1/usage', 'tok-0123456789abcdef');
    assert.equal(report.days.length, 2);
    assert.equal(seen, 'tok-0123456789abcdef', 'the descriptor names its header and no scheme');
    answer = { status: 401, body: '{}' };
    await assert.rejects(fetchUsage(d, '/fabric/v1/usage', 'tok-0123456789abcdef'), /refused the token/);
    answer = { status: 200, body: 'not json' };
    await assert.rejects(fetchUsage(d, '/fabric/v1/usage', 'tok-0123456789abcdef'), /not JSON/);
    answer = { status: 200, body: JSON.stringify(fixture('positive_service-usage.json')) };
    await assert.rejects(fetchUsage({ ...d, instance: 'preview' }, '/fabric/v1/usage', 'tok-0123456789abcdef'), /malformed: the report is for example-agent.default/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('sumSpend: unknown stays unknown across agents, a failure makes a lower bound, no calls is $0', () => {
  const sum = (costUsd: number | null, calls: number, partial = false): SpendSum => ({ calls, inputTokens: 0, outputTokens: 0, costUsd, partial });
  const entry = (key: string, today: SpendSum): SpendEntry => ({ key, kind: 'report', summary: { today, week: today, month: today, models: [], budget: null, generatedAt: '2026-10-04T00:00:00Z' } });
  assert.deepEqual(sumSpend([entry('a.default', sum(null, 3, true))], 'today'), { calls: 3, inputTokens: 0, outputTokens: 0, costUsd: null, partial: true }, 'all unpriced: unknown, not $0');
  const mixed = sumSpend([entry('a.default', sum(null, 3, true)), entry('b.default', sum(1.5, 2))], 'today');
  assert.equal(mixed.costUsd, 1.5);
  assert.equal(mixed.partial, true);
  const failed = sumSpend([entry('b.default', sum(1.5, 2)), { key: 'c.default', kind: 'error', error: 'x' }], 'today');
  assert.equal(failed.costUsd, 1.5);
  assert.equal(failed.partial, true, 'an unreadable agent makes the sum a lower bound');
  assert.deepEqual(sumSpend([entry('d.default', sum(0, 0)), { key: 'e.default', kind: 'none' }], 'today'), { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, partial: false });
});

// ── release audit S-1, D-1 ────────────────────────────────────────────────────────────────

test('S-1: the token goes only to the service\'s own document — a foreign answer is never read', async () => {
  const dd = deps();
  const squatter = { ...WK, service: { ...WK.service, id: 'someone-else' } };
  const out = await readSpend([
    { key: 'example-agent.default', state: 'foreign', descriptor: D, wellKnown: WK }, // a foreign snapshot, whatever it carries
    { key: 'example-agent.preview', descriptor: { ...D, instance: 'preview' }, wellKnown: squatter }, // a document of another identity
  ], dd);
  assert.deepEqual(dd.reads, [], 'no usage request, so no token, to a program that is not the service');
  assert.deepEqual(out.map((e) => e.kind), ['none', 'none']);
});

test('D-1: an agent that reported spend and stopped answering is an error, never "not reporting" — the totals become lower bounds', async () => {
  const dd = deps();
  const out = await readSpend([
    { key: 'example-agent.default', state: 'ready', descriptor: D, wellKnown: WK, usagePath: '/fabric/v1/usage' },
    { key: 'down.default', state: 'down', descriptor: { ...D, id: 'down' }, wellKnown: null, usagePath: '/fabric/v1/usage' },
    { key: 'squat.default', state: 'foreign', descriptor: { ...D, id: 'squat' }, wellKnown: null, usagePath: '/fabric/v1/usage' },
    { key: 'never.default', state: 'down', descriptor: { ...D, id: 'never' }, wellKnown: null, usagePath: null },
  ], dd);
  assert.deepEqual(out.map((e) => e.kind), ['report', 'error', 'error', 'none']);
  assert.match((out[1] as { error: string }).error, /does not answer/);
  assert.match((out[2] as { error: string }).error, /another program/);
  assert.equal(sumSpend(out, 'week').partial, true, '≥: one agent\'s spend is unknown');
  assert.deepEqual(dd.reads, ['example-agent.default/fabric/v1/usage']);
});
