// One entry per product (ADR-0012): the instances of one service id group under one product;
// grouping never changes a member's key, state or authority.
import assert from 'node:assert/strict';
import test from 'node:test';
import { groupProducts, instanceOf, productIdOf, productOf } from '../src/core/products';
import type { ServiceSnapshot, ServiceState, WellKnown } from '../src/core/types';

function snap(key: string, state: ServiceState = 'ready', dashboard: boolean | null = true): ServiceSnapshot {
  const [id, instance] = key.split('.');
  const wellKnown = dashboard === null ? null : ({
    protocol: 'fabric-service/0.1',
    service: { id, instance, name: id, version: '0.1.0', build: { commit: 'abc1234' } },
    process: { pid: 1, startedAt: '2026-10-04T00:00:00Z' },
    status: 'ready',
    degraded: [],
    surfaces: { events: { path: '/events' }, ...(dashboard ? { dashboard: { path: '/dashboard', login: true } } : {}) },
  } satisfies WellKnown);
  return {
    key, descriptorPath: `/d/${key}.json`, descriptor: null, problems: [], state, reasons: [], wellKnown,
    launchd: { managed: false, loaded: false, pid: null, disabled: false },
    firstUnansweredAt: null, lastAnswerAt: null, busy: null, lastAction: null, latestEvent: null, feedError: null,
  };
}

test('productIdOf and instanceOf split a key at its first dot', () => {
  assert.equal(productIdOf('sshlg-growth.reader'), 'sshlg-growth');
  assert.equal(instanceOf('sshlg-growth.reader'), 'reader');
  assert.equal(productIdOf('weird'), 'weird');
  assert.equal(instanceOf('weird'), 'default');
});

test('three instances of one id are one product; the default instance is its primary', () => {
  const services = [snap('sshlg-growth.projection'), snap('asset-foundry.default'), snap('sshlg-growth.reader'), snap('sshlg-growth.default')];
  const products = groupProducts(services);
  assert.deepEqual(products.map((p) => p.id), ['sshlg-growth', 'asset-foundry'], 'order of first appearance');
  const growth = products[0];
  assert.equal(growth.primary.key, 'sshlg-growth.default');
  assert.deepEqual(growth.members.map((m) => m.key), ['sshlg-growth.default', 'sshlg-growth.projection', 'sshlg-growth.reader']);
  for (const m of growth.members) assert.ok(services.includes(m), 'members are the original snapshots, unchanged');
});

test('without a default instance the first member with a dashboard is primary, else the first by key', () => {
  assert.equal(groupProducts([snap('x.b', 'ready', false), snap('x.c'), snap('x.a', 'ready', false)])[0].primary.key, 'x.c');
  assert.equal(groupProducts([snap('x.b', 'ready', false), snap('x.a', 'ready', false)])[0].primary.key, 'x.a');
});

test('a stopped or down default stays primary: no other member is promoted to cover it', () => {
  const [p] = groupProducts([snap('g.default', 'down', null), snap('g.reader')]);
  assert.equal(p.primary.key, 'g.default');
  assert.equal(p.primary.state, 'down');
  assert.equal(p.memberProblem, false, 'the primary\'s own problem is its state, not a member problem');
});

test('a member in trouble is reported without changing the primary\'s state', () => {
  const [p] = groupProducts([snap('g.default'), snap('g.projection', 'down', null)]);
  assert.equal(p.primary.state, 'ready');
  assert.equal(p.memberProblem, true);
  assert.equal(groupProducts([snap('g.default'), snap('g.projection', 'degraded')])[0].memberProblem, false, 'degraded is not a problem state');
});

test('a product with no dashboard anywhere is background only once something answered', () => {
  assert.equal(groupProducts([snap('comm.default', 'ready', false)])[0].background, true);
  assert.equal(groupProducts([snap('comm.default', 'down', null)])[0].background, false, 'unknown is not background: a silent service stays in view');
  assert.equal(groupProducts([snap('a.default', 'ready', false), snap('a.web')])[0].background, false);
});

test('productOf finds the product of any member key', () => {
  const products = groupProducts([snap('g.default'), snap('g.reader'), snap('h.default')]);
  assert.equal(productOf(products, 'g.reader')?.id, 'g');
  assert.equal(productOf(products, 'missing.default'), undefined);
});

test('an empty list has no products', () => {
  assert.deepEqual(groupProducts([]), []);
});
