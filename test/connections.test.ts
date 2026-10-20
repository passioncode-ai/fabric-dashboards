// FD-78 (SCN-073): an agent's connections — declared, seen by the app, the chain through other agents, and who uses it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CONNECTIONS_EXTENSION } from '@passioncode-ai/fabric-service-host/connections';
import { buildGraph, chainState, MAX_DEPTH, resolveTarget, stateOfService } from '../src/core/connections';
import type { ServiceSnapshot } from '../src/core/types';

function svc(key: string, state: ServiceSnapshot['state'], connections?: unknown[], extra: Record<string, unknown> = {}): ServiceSnapshot {
  return {
    key, descriptorPath: `/x/${key}.json`, problems: [], state, reasons: state === 'down' ? [{ code: 'reason.down', params: {} }] : [], firstUnansweredAt: null, lastAnswerAt: null, busy: null, lastAction: null, feedError: null, latestEvent: null,
    descriptor: { name: key.split('.')[0]!.toUpperCase() } as ServiceSnapshot['descriptor'],
    wellKnown: { service: { name: key }, surfaces: { events: { path: '/e' } }, degraded: [], ...extra, ...(connections ? { extensions: { [CONNECTIONS_EXTENSION]: { connections } } } : {}) } as unknown as ServiceSnapshot['wellKnown'],
    launchd: { managed: false, loaded: false, pid: null, disabled: false },
  } as ServiceSnapshot;
}

const use = (id: string, target: string, state = 'ok', capability?: string) => ({ id, kind: 'service', target, state, ...(capability ? { capability } : {}) });

test('FD-78: declared connections first, a reached agent carries its own state and its chain', () => {
  const all = [
    svc('ads.default', 'ready', [use('notify', 'communicator', 'ok', 'communicator.notify'), { id: 'tg', kind: 'connector', target: 'telegram', state: 'ok' }]),
    svc('communicator.default', 'degraded', [use('relay', 'relay.default')]),
    svc('relay.default', 'down'),
  ];
  const g = buildGraph(all[0]!, all);
  assert.equal(g.declared, true);
  const notify = g.uses[0]!;
  assert.deepEqual([notify.serviceKey, notify.state, notify.capability], ['communicator.default', 'degraded', 'communicator.notify'], 'ok as declared, degraded as installed: the worse shows');
  assert.deepEqual(notify.children.map((c) => [c.serviceKey, c.state]), [['relay.default', 'down']], 'the chain goes on through the next agent');
  assert.equal(g.uses[1]!.kind, 'connector');
  assert.equal(chainState(g.uses), 'down', 'the worst anywhere in the chain');
});

test('FD-78: a loop is drawn once, the chain stops at its depth, and an agent that is not installed reads unknown', () => {
  const a = svc('a.default', 'ready', [use('b', 'b'), use('ghost', 'ghost.default')]);
  const b = svc('b.default', 'ready', [use('a', 'a.default'), use('c', 'c')]);
  const c = svc('c.default', 'ready', [use('d', 'd')]);
  const d = svc('d.default', 'ready', [use('e', 'e')]);
  const e = svc('e.default', 'ready');
  const g = buildGraph(a, [a, b, c, d, e]);
  const toB = g.uses[0]!;
  assert.equal(toB.children[0]!.repeated, true, 'back to the agent itself: not repeated');
  const toC = toB.children[1]!;
  assert.equal(MAX_DEPTH, 3);
  assert.equal(toC.children[0]!.serviceKey, 'd.default');
  assert.deepEqual(toC.children[0]!.children, [], 'three levels, then it stops');
  assert.deepEqual([g.uses[1]!.serviceKey, g.uses[1]!.state], [undefined, 'unknown']);
  assert.equal(buildGraph(svc('p.default', 'ready', [use('q', 'q')]), [svc('p.default', 'ready'), svc('q.default', 'down')]).uses[0]!.agentReason?.code, 'reason.down', 'a reached agent that is not well carries its own reason, for the reader to translate');
});

test('FD-78: what the app sees without a declaration: models from usage, the runner, failing parts; and who uses the agent', () => {
  const s = svc('prowl.default', 'degraded', undefined, {
    degraded: [{ source: 'collector', reason: 'collect-bing never finished' }, { source: 'oauth', reason: 'sign in', setup: true }],
    configuration: { slots: ['runner'], resolved: { runnerKind: 'claude-code', route: 'subscription', models: ['claude-sonnet-5-5'] } },
    surfaces: { events: { path: '/e' }, mcp: { path: '/mcp', transport: 'streamable-http', capabilities: ['prowl.search'] } },
  });
  const user = svc('growth.default', 'ready', [use('prowl', 'prowl', 'ok', 'prowl.search')]);
  const g = buildGraph(s, [s, user], [{ provider: 'openrouter', model: 'gemini-3-flash', calls: 12 }]);
  assert.equal(g.declared, false);
  assert.deepEqual(g.uses.map((n) => [n.kind, n.label, n.state, n.source]), [
    ['model', 'gemini-3-flash', 'ok', 'usage'],
    ['runner', 'claude-code', 'ok', 'runner'],
    ['part', 'collector', 'degraded', 'degraded'],
    ['part', 'oauth', 'unknown', 'degraded'],
  ]);
  assert.deepEqual(g.usedBy, [{ key: 'growth.default', name: 'GROWTH', state: 'ok', capability: 'prowl.search' }]);
  assert.deepEqual(g.offers, { capabilities: ['prowl.search'], surfaces: ['mcp', 'events'] });
});

test('FD-78: a failing part named by a declaration marks that connection; an invalid declaration is reported, never guessed', () => {
  const s = svc('x.default', 'degraded', [{ id: 'db', kind: 'store', target: 'postgres', state: 'ok' }], { degraded: [{ source: 'db', reason: 'connection refused' }] });
  const g = buildGraph(s, [s]);
  assert.deepEqual(g.uses.map((n) => [n.id, n.state, n.reason]), [['db', 'degraded', 'connection refused']]);
  const bad = svc('y.default', 'ready', [{ id: 'Bad Id', kind: 'store', target: 'x', state: 'ok' }]);
  const gb = buildGraph(bad, [bad]);
  assert.equal(gb.declared, false);
  assert.ok(gb.errors.length > 0);
  assert.deepEqual(gb.uses, []);
  assert.equal(stateOfService('stopped'), 'down');
  assert.equal(resolveTarget('x', [s])?.key, 'x.default');
});

test('FD-78: the worse of two states is the one a person reads first', async () => {
  const { worstOf } = await import('../src/core/connections');
  assert.equal(worstOf('ok', 'down'), 'down');
  assert.equal(worstOf('unknown', 'degraded'), 'degraded');
  assert.equal(worstOf(stateOfService('down'), chainState([])), 'down', 'an agent that does not answer, with no connections, is not "Works"');
});
