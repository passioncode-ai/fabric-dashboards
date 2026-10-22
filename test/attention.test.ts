// FD-86 (principle 4): items of one class fold into one line; the queue keeps its order.
import assert from 'node:assert/strict';
import test from 'node:test';
import { groupAttention } from '../src/core/attention';

test('FD-86: agents in one state for one reason are one line, in the queue\'s order; an unclassed row stays alone', () => {
  const q = [
    { key: 'a', cls: 'down|hub unavailable' },
    { key: 'b', cls: 'degraded|disk' },
    { key: 'c', cls: 'down|hub unavailable' },
    { key: 'd', cls: '' },
    { key: 'e', cls: '' },
    { key: 'f', cls: 'down|hub unavailable' },
  ];
  const g = groupAttention(q, (x) => x.cls);
  assert.deepEqual(g.map((e) => e.members.map((m) => m.key)), [['a', 'c', 'f'], ['b'], ['d'], ['e']]);
  assert.equal(g[0]!.lead.key, 'a');
  assert.deepEqual(groupAttention([], (x: { cls: string }) => x.cls), []);
});
