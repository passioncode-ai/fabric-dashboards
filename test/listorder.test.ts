// FD-39 (ADR-0020, SCN-056/057): pinned agents first in pin order; the rest by name, status or recent activity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { arrangeProducts, categoryOf, groupProducts, setKind, toggleHidden, togglePin } from '../src/core/products';
import { SettingsStore } from '../src/core/settings';
import type { ServiceSnapshot } from '../src/core/types';
import { tmp } from './helpers';

function svc(key: string, name: string, state: ServiceSnapshot['state'], lastEventAt: string | null = null, dashboard = true): ServiceSnapshot {
  return {
    key, descriptorPath: `/x/${key}.json`, problems: [], state, reasons: [], firstUnansweredAt: null, lastAnswerAt: null, busy: null, lastAction: null, feedError: null,
    descriptor: { name } as ServiceSnapshot['descriptor'],
    wellKnown: { surfaces: dashboard ? { dashboard: { path: '/', login: false } } : {} } as unknown as ServiceSnapshot['wellKnown'],
    launchd: { managed: false, loaded: false, pid: null, disabled: false },
    latestEvent: lastEventAt ? { id: lastEventAt, at: lastEventAt, kind: 'k', level: 'info', text: 't' } : null,
  } as ServiceSnapshot;
}

const products = groupProducts([
  svc('alpha.default', 'Alpha', 'ready', '2026-10-10T09:00:00Z'),
  svc('bravo.default', 'Bravo', 'down', '2026-10-10T08:00:00Z'),
  svc('charlie.default', 'Charlie', 'degraded', '2026-10-10T11:00:00Z'),
  svc('delta.default', 'Delta', 'ready', null),
  svc('worker.default', 'Worker', 'down', '2026-10-10T12:00:00Z', false),
]);
const ids = (list: { id: string }[]) => list.map((p) => p.id);

test('FD-39 SCN-057: Name is alphabetical; Status puts what needs attention first; Recent activity the newest event first', () => {
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'name', pinned: [] }).local), ['alpha', 'bravo', 'charlie', 'delta']);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: [] }).local), ['bravo', 'charlie', 'alpha', 'delta']);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'activity', pinned: [] }).local), ['charlie', 'alpha', 'bravo', 'delta'], 'an agent with no event goes last');
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: [] }).service), ['worker'], 'a service keeps its own section');
});

test('FD-39 SCN-056: pinned agents lead in pin order whatever the sort, leave their section, and an unknown pin is ignored', () => {
  const a = arrangeProducts(products, { sort: 'name', pinned: ['delta', 'worker', 'gone'] });
  assert.deepEqual(ids(a.pinned), ['delta', 'worker']);
  assert.deepEqual(ids(a.local), ['alpha', 'bravo', 'charlie']);
  assert.deepEqual(ids(a.service), []);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: ['delta', 'worker'] }).pinned), ['delta', 'worker'], 'never re-sorted');
  assert.deepEqual(togglePin(['a', 'b'], 'c'), ['a', 'b', 'c'], 'a new pin goes last');
  assert.deepEqual(togglePin(['a', 'b', 'c'], 'b'), ['a', 'c'], 'unpinning keeps the others\' order');
});

test('FD-39 SCN-056/057: the pin list and the sort persist, and a damaged one reads as a usable one', () => {
  const dir = tmp('fd-list-');
  const s = new SettingsStore(dir);
  assert.deepEqual(s.get().layout.list, { sort: 'name', pinned: [], hidden: [], kinds: {}, hiddenOpen: false, order: [] });
  s.update({ layout: { list: { pinned: ['delta', 'alpha'] } } });
  s.update({ layout: { list: { sort: 'activity' } } });
  assert.deepEqual(new SettingsStore(dir).get().layout.list, { sort: 'activity', pinned: ['delta', 'alpha'], hidden: [], kinds: {}, hiddenOpen: false, order: [] }, 'one field changes alone, and both survive a restart');
  const file = path.join(dir, 'settings.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.layout.list = { sort: 'random', pinned: ['ok', 'Bad Id', 'ok', 7, '../x'], hidden: ['h', 'H!'], kinds: { a: 'service', b: 'robot', 'C D': 'agent' }, hiddenOpen: 'yes' };
  fs.writeFileSync(file, JSON.stringify(raw));
  assert.deepEqual(new SettingsStore(dir).get().layout.list, { sort: 'name', pinned: ['ok'], hidden: ['h'], kinds: { a: 'service' }, hiddenOpen: false, order: [] });
});

function online(key: string, name: string, dashboard = true): ServiceSnapshot {
  const s = svc(key, name, 'ready', null, dashboard);
  return { ...s, descriptor: { name, placement: 'remote' } as ServiceSnapshot['descriptor'] };
}

test('FD-78: Local, Online and Services; the person moves a product between agent and service, and hides one', () => {
  const all = groupProducts([...products.flatMap((p) => p.members), online('prowl.default', 'Prowl', false), online('site.default', 'Site')]);
  const a = arrangeProducts(all, { sort: 'name', pinned: [] });
  assert.deepEqual([ids(a.local), ids(a.online), ids(a.service)], [['alpha', 'bravo', 'charlie', 'delta'], ['site'], ['prowl', 'worker']], 'a product without a dashboard is a service, local or online');
  const site = all.find((p) => p.id === 'site')!;
  const worker = all.find((p) => p.id === 'worker')!;
  assert.deepEqual(setKind({}, site, 'service'), { site: 'service' });
  assert.deepEqual(setKind({ worker: 'agent' }, worker, 'service'), {}, 'choosing the guess removes the override');
  const moved = arrangeProducts(all, { sort: 'name', pinned: [], kinds: { site: 'service', worker: 'agent' } });
  assert.deepEqual([ids(moved.local), ids(moved.online), ids(moved.service)], [['alpha', 'bravo', 'charlie', 'delta', 'worker'], [], ['prowl', 'site']]);
  assert.equal(categoryOf(worker, { worker: 'agent' }), 'local');
  const hid = arrangeProducts(all, { sort: 'name', pinned: ['delta', 'alpha'], hidden: toggleHidden([], 'delta').concat('prowl') });
  assert.deepEqual([ids(hid.pinned), ids(hid.local), ids(hid.service), ids(hid.hidden)], [['alpha'], ['bravo', 'charlie'], ['worker'], ['delta', 'prowl']], 'a hidden product leaves every section, its pin too');
  assert.deepEqual(toggleHidden(['delta', 'prowl'], 'delta'), ['prowl']);
  assert.deepEqual(ids(arrangeProducts(all, { sort: 'name', pinned: ['delta', 'alpha'], hidden: ['prowl'] }).pinned), ['delta', 'alpha'], 'shown again, its pin comes back');
});
