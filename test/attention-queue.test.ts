// W2 "one truth about attention" (UX-04, UX-05, UX-06, UX-08, UX-01, UX-03): one queue for the tray, the sidebar,
// the Dock and Overview; a limit that stopped work is in it; the agent page's first action; the visit kept current.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { attentionQueue, badgeText, nextNewsExpiry, urgent } from '../src/core/attention';
import { trayMenuModel } from '../src/core/tray-model';
import { limitsNeedingPerson } from '../src/core/spend';
import { firstAction } from '../src/core/focus';
import { revisitDue, VISIT_GAP_MS } from '../src/core/visit';
import { audit } from '../src/core/audit';
import { snap } from './snap';

const NOW = Date.parse('2026-10-24T10:00:00Z');
const tripped = (id = 'daily'): LimitView => ({ id, scope: 'machine', kind: 'daily', period: 'day', limitUsd: 5, spentUsd: 6, enforced: true, tripped: true, state: 'tripped', share: 1.2 });
const near = (id = 'monthly'): LimitView => ({ id, scope: 'machine', kind: 'monthly', period: 'month', limitUsd: 100, spentUsd: 85, enforced: true, state: 'near', share: 0.85 });

test('UX-04: the queue counts what Overview lists: problems, degraded, updates, attention tiles, running and failed actions', () => {
  const failedAt = new Date(NOW - 60_000).toISOString();
  const services = [
    snap('alpha.default', 'down'),
    snap('bravo.default', 'degraded'),
    snap('charlie.default', 'ready', { update: '2.0.0' }),
    snap('delta.default', 'ready', { tile: true }),
    snap('echo.default', 'starting', { busy: 'restart' }),
    snap('foxtrot.default', 'ready', { lastAction: { action: 'restart', ok: false, reason: { code: 'result.failed' }, at: failedAt } }),
    snap('golf.default', 'ready'),
    snap('hotel.default', 'stopped'),
  ];
  const q = attentionQueue(services, { now: NOW });
  assert.deepEqual(q.map((x) => x.s.key), ['alpha.default', 'echo.default', 'foxtrot.default', 'bravo.default', 'delta.default', 'charlie.default']);
  assert.equal(badgeText(q.length), '6', 'the Dock shows the same number');
  assert.equal(badgeText(0), '', 'nothing to do: no badge');
  assert.deepEqual(q.filter(urgent).map((x) => x.s.key), ['alpha.default', 'foxtrot.default'], 'urgent: something does not work; a running action is not');
  // A failure stops being news after 30 minutes; the main process re-reads the count then.
  assert.equal(nextNewsExpiry(services, NOW), Date.parse(failedAt) + 30 * 60_000);
  assert.equal(attentionQueue(services, { now: Date.parse(failedAt) + 30 * 60_000 }).some((x) => x.s.key === 'foxtrot.default'), false);
  assert.equal(nextNewsExpiry([snap('a.default', 'ready')], NOW), null);
});

test('UX-06: a limit that stopped work puts its agent in the queue, after what does not answer, and carries the limit', () => {
  const services = [snap('alpha.default', 'ready'), snap('bravo.default', 'down'), snap('charlie.default', 'degraded'), snap('delta.default', 'ready')];
  const q = attentionQueue(services, { now: NOW, limits: { 'alpha.default': [tripped()], 'delta.default': [near()] } });
  assert.deepEqual(q.map((x) => x.s.key), ['bravo.default', 'alpha.default', 'charlie.default'], 'a near limit is not in the queue');
  assert.equal(q[1]!.limit?.id, 'daily');
  assert.equal(urgent(q[1]!), true);
  assert.equal(attentionQueue(services, { now: NOW }).length, 2, 'without limits read, nothing is invented');
});

test('UX-04: the tray headline counts the same queue and lists every item, a stopped limit and an update by what they are', () => {
  const services = [snap('alpha.default', 'ready'), snap('bravo.default', 'degraded'), snap('charlie.default', 'ready', { update: '2.0.0' }), snap('delta.default', 'ready')];
  const m = trayMenuModel(services, { now: NOW, limits: { 'alpha.default': [tripped()] }, lang: 'en' });
  assert.equal(m.headline, 'Needs attention: 3');
  assert.deepEqual(m.attention.map((i) => i.key), ['alpha.default', 'bravo.default', 'charlie.default']);
  assert.match(m.attention[0]!.label, /Alpha.*spending limit stopped work/);
  assert.match(m.attention[2]!.label, /Charlie.*2\.0\.0/);
  assert.deepEqual(m.rest.map((i) => i.key), ['delta.default']);
  const calm = trayMenuModel([snap('a.default', 'ready'), snap('b.default', 'stopped')], { now: NOW, lang: 'en' });
  assert.equal(calm.headline, 'Ready: 1 of 2', 'a stopped agent is not ready, and is not attention either');
  const ru = trayMenuModel(services, { now: NOW, limits: { 'alpha.default': [tripped()] }, lang: 'ru' });
  assert.equal(ru.headline, 'Требуют внимания: 3');
  for (const i of [...ru.attention, ...m.attention]) assert.equal(i.label.includes(String.fromCharCode(0x2014)), false, 'no em dash in the menu');
});

test('UX-05: the limits a person must see come from the cached spend read, tripped and over the line only', () => {
  const entries = [
    { key: 'alpha.default', kind: 'report' as const, summary: { limits: [tripped(), near()] } },
    { key: 'bravo.default', kind: 'report' as const, summary: { limits: [near()] } },
    { key: 'charlie.default', kind: 'none' as const },
  ];
  const l = limitsNeedingPerson(entries as never);
  assert.deepEqual(Object.keys(l), ['alpha.default']);
  assert.deepEqual(l['alpha.default']!.map((x) => x.id), ['daily']);
  // The sidebar badge reads the same audit as the page: a tripped limit is an error there too.
  assert.equal(audit([snap('alpha.default', 'ready')], l).counts.error, 1);
});

test('UX-01, UX-03: the agent page\'s first action is Restart, Start or Update, never Fix', () => {
  assert.deepEqual(firstAction(snap('a.default', 'down')), { kind: 'restart' });
  assert.deepEqual(firstAction(snap('a.default', 'duplicate')), { kind: 'restart' });
  assert.deepEqual(firstAction(snap('a.default', 'stopped')), { kind: 'start' });
  assert.deepEqual(firstAction(snap('a.default', 'ready', { update: '2.0.0' })), { kind: 'update', version: '2.0.0' });
  assert.deepEqual(firstAction(snap('a.default', 'degraded', { update: '2.0.0' })), { kind: 'update', version: '2.0.0' }, 'the update may be the fix');
  assert.equal(firstAction(snap('a.default', 'ready')), null);
  assert.equal(firstAction(snap('a.default', 'down', { managed: false })), null, 'nothing here can restart what launchd does not manage');
  assert.equal(firstAction(snap('a.default', 'down', { online: true })), null, 'an online agent is supervised by its platform');
  assert.equal(firstAction(snap('a.default', 'down', { busy: 'restart' })), null, 'a running action shows its progress instead');
});

test('UX-08: a window shown again after an hour hidden is a new visit; a short look away is not', () => {
  assert.equal(VISIT_GAP_MS, 60 * 60_000);
  assert.equal(revisitDue(null, { at: '2026-10-24T10:00:00Z', afterHiddenMs: 2 * VISIT_GAP_MS }), true);
  assert.equal(revisitDue('2026-10-24T10:00:00Z', { at: '2026-10-24T10:00:00Z', afterHiddenMs: 2 * VISIT_GAP_MS }), false, 'the same show is handled once');
  assert.equal(revisitDue('2026-10-24T09:00:00Z', { at: '2026-10-24T10:00:00Z', afterHiddenMs: 10 * 60_000 }), false);
  assert.equal(revisitDue('2026-10-24T09:00:00Z', undefined), false);
});
