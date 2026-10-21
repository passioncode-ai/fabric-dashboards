// FD-78: a service's declared connections (the proposed `extensions/connections/0.1`): a valid list reads, an
// invalid one declares nothing and says why, and an absent one is simply not declared.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CONNECTIONS_EXTENSION, connectionsOf } from '../src/connections';

const doc = (value: unknown) => ({ extensions: { [CONNECTIONS_EXTENSION]: value } });
const good = { connections: [
  { id: 'notify', kind: 'service', target: 'example-notifier.default', capability: 'notifier.notify', state: 'ok', lastAt: '2026-10-20T09:00:00Z' },
  { id: 'telegram', kind: 'connector', target: 'telegram', label: 'Telegram Bot API', purpose: 'reads the operator chat', state: 'degraded', reason: 'flood wait 30 s' },
  { id: 'db', kind: 'store', target: 'postgres', state: 'unknown' },
] };

test('FD-78: a valid declaration reads as it is', () => {
  const v = connectionsOf(doc(good));
  assert.equal(v.declared, true);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.connections.map((c) => [c.id, c.kind, c.state]), [['notify', 'service', 'ok'], ['telegram', 'connector', 'degraded'], ['db', 'store', 'unknown']]);
});

test('FD-78: absent is not declared; anything not a document is not declared either', () => {
  assert.deepEqual(connectionsOf({ extensions: {} }), { declared: false, reported: false, connections: [], errors: [] });
  assert.deepEqual(connectionsOf(null), { declared: false, reported: false, connections: [], errors: [] });
  assert.deepEqual(connectionsOf({ extensions: { constructor: 1 } }).declared, false);
});

test('FD-78: an invalid declaration declares nothing and names every reason', () => {
  const v = connectionsOf(doc({ connections: [
    { id: 'notify', kind: 'service', target: 'Not A Key!', state: 'ok' },
    { id: 'notify', kind: 'robot', target: 'x', state: 'fine', capability: 'x.y', extra: 1 },
    { id: 'z', kind: 'store', target: 'pg', state: 'ok', lastAt: 'yesterday' },
  ], more: true }));
  assert.equal(v.declared, false);
  assert.equal(v.reported, true);
  assert.deepEqual(v.connections, []);
  for (const want of ['additionalProperties: more', '/connections/0/target', '/connections/1/kind', '/connections/1/state', '/connections/1/capability', 'additionalProperties: extra', '/connections/2/lastAt']) {
    assert.ok(v.errors.some((e) => e.includes(want)), want);
  }
  assert.ok(connectionsOf(doc({ connections: Array.from({ length: 65 }, (_, i) => ({ id: `c${i}`, kind: 'store', target: 'x', state: 'ok' })) })).errors.some((e) => e.includes('at most 64')));
});

test('DEC-0096 (CT-70): the contract\'s vectors read the same through the host\'s port', () => {
  const vectors = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../test/fixtures/contract/vectors_connections.json'), 'utf8')) as { cases: { name: string; input: unknown; expected: { declared: boolean; reported: boolean; connections?: unknown[] } }[] };
  assert.ok(vectors.cases.length >= 100);
  for (const c of vectors.cases) {
    const v = connectionsOf(c.input);
    assert.equal(v.declared, c.expected.declared, `${c.name}: declared`);
    assert.equal(v.reported, c.expected.reported, `${c.name}: reported`);
    if (c.expected.connections) assert.deepEqual(v.connections, c.expected.connections, `${c.name}: connections`);
  }
});
