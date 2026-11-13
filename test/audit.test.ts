// FD-81: the auditor's findings over every agent, and the estate map's layered layout.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CONNECTIONS_EXTENSION } from '@passioncode-ai/fabric-service-host/connections';
import { audit, auditBrief, byAgent } from '../src/core/audit';
import { t } from '../src/core/i18n';
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

test('FD-110 (DEC-0121, CT-126): the auditor reports a button without an agent twin, a wrong or invalid declaration, and a dashboard with no actions declared', () => {
  const ACTIONS = 'https://fabric.passioncode.ai/agent-contract/extensions/actions/0.1';
  const mcp = { mcp: { path: '/mcp', capabilities: ['replies.approve'] } };
  const declared = (actions: unknown, surfaces: Record<string, unknown> = mcp) => ({ surfaces: { events: { path: '/e' }, dashboard: { path: '/', login: true }, ...surfaces }, extensions: { [ACTIONS]: { actions } } });
  const twinless = audit([svc('a.default', 'ready', declared([
    { id: 'approve', title: 'Approve the reply', tool: 'replies.approve', gate: 'relayed' },
    { id: 'send', title: 'Send', tool: 'replies.send', gate: 'relayed' },
    { id: 'pay', title: 'Top up', tool: 'replies.approve', gate: 'relayed', humanStep: 'payment' },
  ]))]);
  assert.deepEqual(twinless.findings.map((f) => [f.severity, f.kind, f.reason.code, f.reason.params?.title]), [
    ['warn', 'declaration', 'audit.action.noTwin', 'Send'],
    ['warn', 'declaration', 'audit.action.invalid', 'Top up'],
  ]);
  assert.equal(twinless.findings[0]!.reason.params?.tool, 'replies.send');
  const invalid = audit([svc('b.default', 'ready', declared([{ id: 'x', title: 'X', gate: 'none' }]))]);
  assert.deepEqual(invalid.findings.map((f) => f.reason.code), ['audit.declaration.actionsInvalid'], 'one finding for an invalid value, never one per action');
  const none = audit([svc('c.default', 'ready', { surfaces: { events: { path: '/e' }, dashboard: { path: '/', login: true } } })]);
  assert.deepEqual(none.findings.map((f) => [f.severity, f.reason.code]), [['info', 'audit.action.notAdopted']]);
  assert.deepEqual(audit([svc('d.default', 'ready')]).findings, [], 'no dashboard, no buttons: nothing to declare');
  assert.deepEqual(audit([svc('e.default', 'ready', declared([{ id: 'approve', title: 'Approve the reply', tool: 'replies.approve', gate: 'relayed' }]))]).findings, [], 'every button has its twin');
});

test('FD-147: a connection that names the repository of installed agents says so and names them, and resolves nothing', () => {
  const repo = (key: string, url: string) => ({ ...svc(key, 'ready'), descriptor: { name: key.split('.')[0], source: { repository: url } } } as ServiceSnapshot);
  const all = [
    svc('voc.default', 'ready', {}, [use('ads-bot', 'personal-os'), use('ghost', 'nowhere')]),
    repo('ads-bot.default', 'https://github.com/someone/personal-os.git'),
    repo('communicator.default', 'git@github.com:someone/personal-os'),
    repo('other.default', 'https://github.com/someone/personal-os-extra'),
  ];
  const f = audit(all).findings.filter((x) => x.kind === 'connection');
  assert.deepEqual(f.map((x) => [x.reason.code, x.reason.params]), [
    ['audit.connection.repository', { name: 'personal-os', services: 'ads-bot, communicator' }],
    ['audit.connection.missing', { name: 'nowhere' }],
  ]);
});

test('FD-149: a bare id with several instances and none default is followed to the first and says so', () => {
  const all = [
    svc('brand.default', 'ready', {}, [use('copy', 'writer'), use('found', 'foundry'), use('exact', 'writer.team')]),
    svc('writer.cloud', 'ready'),
    svc('writer.team', 'ready'),
    svc('foundry.default', 'ready'),
    svc('foundry.second', 'ready'),
  ];
  const f = audit(all).findings.filter((x) => x.kind === 'connection');
  assert.deepEqual(f.map((x) => [x.severity, x.reason.code, x.reason.params]), [
    ['warn', 'audit.connection.ambiguous', { name: 'writer', instances: 'writer.cloud, writer.team', chosen: 'writer.cloud' }],
  ], 'a default instance settles it, and a full id is never ambiguous');
});

test('FD-151: an extension under its short key is named, with the full key, and still reads as not declared', () => {
  const short = { extensions: { 'extensions/connections/0.1': { connections: [] } } };
  const both = { extensions: { 'extensions/connections/0.1': { connections: [] }, [CONNECTIONS_EXTENSION]: { connections: [] } } };
  const r = audit([svc('a.default', 'ready', short), svc('b.default', 'ready', both)]);
  assert.deepEqual(r.findings.filter((f) => f.reason.code === 'audit.declaration.shortKey').map((f) => [f.key, f.severity, f.reason.params]), [
    ['a.default', 'warn', { key: 'extensions/connections/0.1', full: CONNECTIONS_EXTENSION }],
  ], 'the full key present settles it');
  assert.equal(r.coverage.declaring, 1);
});

test('FD-155: one failure of a declared connection is one finding, on the connection, with the part\'s words', () => {
  const conn = (id: string, state: string) => ({ id, kind: 'store', target: id, state });
  const s = svc('pilot.default', 'ready', {
    degraded: [{ source: 'database', reason: 'connection refused' }, { source: 'queue', reason: 'slow' }, { source: 'adspower', reason: 'closed', setup: true }],
  }, [conn('database', 'down'), conn('queue', 'ok'), conn('adspower', 'unknown')]);
  const f = audit([s]).findings.filter((x) => x.kind === 'part' || x.kind === 'connection');
  assert.deepEqual(f.map((x) => [x.kind, x.severity, x.reason.code, x.reason.params?.text]), [
    ['connection', 'error', 'audit.connection.down', 'connection refused'],
    ['part', 'warn', 'audit.part.failing', 'slow'],
    ['part', 'setup', 'audit.part.setup', 'closed'],
  ], 'database once; a part whose connection says ok is still told; setup stays setup');
});

test('FD-226: a failing part reads as one sentence: its name, then the agent\'s own words after a colon, or a full stop', () => {
  assert.equal(t('en', 'audit.connection.degraded', { name: 'demo', text: 'the mail provider answers slowly' }), 'demo works only in part: the mail provider answers slowly');
  assert.equal(t('ru', 'audit.connection.down', { name: 'demo', text: 'нет ответа' }), 'demo не работает: нет ответа');
  assert.equal(t('en', 'audit.connection.degraded.bare', { name: 'demo' }), 'demo works only in part.');
  assert.equal(t('ru', 'audit.connection.down.bare', { name: 'demo' }), 'demo не работает.');
});
