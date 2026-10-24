// FD-81: the auditor's findings over every agent, and the estate map's layered layout.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CONNECTIONS_EXTENSION } from '@passioncode-ai/fabric-service-host/connections';
import { audit, auditBrief, byAgent } from '../src/core/audit';
import { estateMap } from '../src/core/estate-map';
import type { ServiceSnapshot } from '../src/core/types';

function svc(key: string, state: ServiceSnapshot['state'], extra: Record<string, unknown> = {}, connections?: unknown[]): ServiceSnapshot {
  return {
    key, state, reasons: state === 'down' ? [{ code: 'reason.down', params: { since: '10:00' } }] : [], descriptor: { name: key.split('.')[0] } as ServiceSnapshot['descriptor'],
    wellKnown: { service: { name: key }, surfaces: { events: { path: '/e' } }, degraded: [], ...extra, ...(connections ? { extensions: { [CONNECTIONS_EXTENSION]: { connections } } } : {}) } as unknown as ServiceSnapshot['wellKnown'],
  } as ServiceSnapshot;
}
const use = (id: string, target: string, state = 'ok') => ({ id, kind: 'service', target, state });

test('FD-81: the auditor names what does not work, what waits for a person, and what is out of date, worst first', () => {
  const all = [
    svc('ads.default', 'degraded', { degraded: [{ source: 'google-ads', reason: 'quota' }, { source: 'oauth', reason: 'sign in', setup: true }], update: { available: '2.0.0' } }, [use('notify', 'comm'), { id: 'db', kind: 'store', target: 'postgres', state: 'down', reason: 'refused' }, use('ghost', 'ghost.default')]),
    svc('comm.default', 'ready', {}, [use('relay', 'relay.default')]),
    svc('relay.default', 'down'),
    svc('bad.default', 'ready', {}, [{ id: 'Bad Id', kind: 'store', target: 'x', state: 'ok' }]),
  ];
  const a = audit(all, { 'ads.default': [{ id: 'daily', scope: 'machine', kind: 'daily', period: 'day', limitUsd: 5, spentUsd: 6, enforced: true, state: 'breach', share: 1.2 }] });
  assert.deepEqual(a.findings.map((f) => [f.severity, f.key, f.kind, f.reason.code]), [
    ['error', 'ads.default', 'connection', 'audit.connection.down'],
    ['error', 'comm.default', 'chain', 'audit.chain.down'],
    ['error', 'relay.default', 'state', 'reason.down'],
    ['warn', 'ads.default', 'connection', 'audit.connection.missing'],
    ['warn', 'ads.default', 'limit', 'audit.limit.breach'],
    ['warn', 'ads.default', 'part', 'audit.part.failing'],
    ['warn', 'bad.default', 'declaration', 'audit.declaration.invalid'],
    ['setup', 'ads.default', 'part', 'audit.part.setup'],
    ['info', 'ads.default', 'update', 'audit.update'],
  ]);
  assert.deepEqual(a.counts, { error: 3, warn: 4, setup: 1, info: 1 });
  assert.deepEqual(a.coverage, { agents: 4, declaring: 2 }, 'an invalid declaration does not count as declaring');
  assert.deepEqual(byAgent(a.findings).map((g) => [g.key, g.findings.length]), [['ads.default', 6], ['comm.default', 1], ['relay.default', 1], ['bad.default', 1]]);
  assert.match(auditBrief('Ads', 'ads.default', ['one', 'two']), /has 2 problem\(s\)[\s\S]*- one\n- two[\s\S]*`audit`/);
  assert.deepEqual(audit([svc('ok.default', 'ready')]).findings, [], 'a well agent has nothing to say');
});

test('FD-81: the estate map lays agents out left to right by who calls whom, cuts cycles, and keeps the loose ones apart', () => {
  const all = [
    svc('a.default', 'ready', {}, [use('b', 'b'), use('x', 'nowhere')]),
    svc('b.default', 'degraded', {}, [use('c', 'c.default'), use('a', 'a.default')]),
    svc('c.default', 'ready'),
    svc('d.default', 'down', {}, [use('c', 'c')]),
    svc('e.default', 'ready'),
  ];
  const m = estateMap(all);
  const col = Object.fromEntries(m.nodes.map((n) => [n.id, n.column]));
  assert.deepEqual(col, { 'a.default': 0, 'd.default': 0, 'b.default': 1, 'missing:nowhere': 1, 'c.default': 2 }, 'a cycle a→b→a is cut where it closes');
  assert.equal(m.edges.find((e) => e.from === 'a.default' && e.to === 'b.default')!.state, 'degraded', 'the worse of the call and the agent reached');
  assert.equal(m.nodes.find((n) => n.id === 'missing:nowhere')!.missing, true);
  assert.deepEqual(m.loose.map((n) => n.id), ['e.default']);
  assert.deepEqual([m.columns, m.rows], [3, 2]);
  assert.deepEqual(estateMap([svc('solo.default', 'ready')]).nodes, [], 'nothing declared: no edges, everyone loose');
});

test('FD-93 review: an invalid load declaration is a finding of the auditor too (FAC-SEM-133), a valid one is not', () => {
  const LOAD = 'https://fabric.passioncode.ai/agent-contract/extensions/load/0.1';
  const bad = audit([svc('q.default', 'ready', { extensions: { [LOAD]: { path: 'load', windowSeconds: 5, limits: {} } } })]);
  assert.deepEqual(bad.findings.map((f) => [f.severity, f.kind, f.reason.code]), [['warn', 'declaration', 'audit.declaration.loadInvalid']]);
  assert.match(String(bad.findings[0]!.reason.params?.errors), /\/path/);
  const good = audit([svc('q.default', 'ready', { extensions: { [LOAD]: { path: '/fabric/v1/load', windowSeconds: 3600, limits: { concurrency: 1, perCaller: 1, queueMax: 0 } } } })]);
  assert.deepEqual(good.findings, []);
});
