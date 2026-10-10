// FD-39 (ADR-0020, SCN-056/057): pinned agents first in pin order; the rest by name, status or recent activity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { arrangeProducts, groupProducts, togglePin } from '../src/core/products';
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
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'name', pinned: [] }).foreground), ['alpha', 'bravo', 'charlie', 'delta']);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: [] }).foreground), ['bravo', 'charlie', 'alpha', 'delta']);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'activity', pinned: [] }).foreground), ['charlie', 'alpha', 'bravo', 'delta'], 'an agent with no event goes last');
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: [] }).background), ['worker'], 'Background keeps its own section');
});

test('FD-39 SCN-056: pinned agents lead in pin order whatever the sort, leave their section, and an unknown pin is ignored', () => {
  const a = arrangeProducts(products, { sort: 'name', pinned: ['delta', 'worker', 'gone'] });
  assert.deepEqual(ids(a.pinned), ['delta', 'worker']);
  assert.deepEqual(ids(a.foreground), ['alpha', 'bravo', 'charlie']);
  assert.deepEqual(ids(a.background), []);
  assert.deepEqual(ids(arrangeProducts(products, { sort: 'status', pinned: ['delta', 'worker'] }).pinned), ['delta', 'worker'], 'never re-sorted');
  assert.deepEqual(togglePin(['a', 'b'], 'c'), ['a', 'b', 'c'], 'a new pin goes last');
  assert.deepEqual(togglePin(['a', 'b', 'c'], 'b'), ['a', 'c'], 'unpinning keeps the others\' order');
});

test('FD-39 SCN-056/057: the pin list and the sort persist, and a damaged one reads as a usable one', () => {
  const dir = tmp('fd-list-');
  const s = new SettingsStore(dir);
  assert.deepEqual(s.get().layout.list, { sort: 'name', pinned: [] });
  s.update({ layout: { list: { pinned: ['delta', 'alpha'] } } });
  s.update({ layout: { list: { sort: 'activity' } } });
  assert.deepEqual(new SettingsStore(dir).get().layout.list, { sort: 'activity', pinned: ['delta', 'alpha'] }, 'one field changes alone, and both survive a restart');
  const file = path.join(dir, 'settings.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.layout.list = { sort: 'random', pinned: ['ok', 'Bad Id', 'ok', 7, '../x'] };
  fs.writeFileSync(file, JSON.stringify(raw));
  assert.deepEqual(new SettingsStore(dir).get().layout.list, { sort: 'name', pinned: ['ok'] });
});
