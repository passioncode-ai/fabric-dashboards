// FD-86 (principle 4): items of one class fold into one line; the queue keeps its order.
import assert from 'node:assert/strict';
import test from 'node:test';
import { foldAttention, groupAttention } from '../src/core/attention';

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

test('SCN-042: three lines show and "Show all N" counts lines after folding; asked for all, every line shows', () => {
  const lines = ['a', 'b', 'c', 'd'];
  assert.deepEqual(foldAttention(lines, false), { shown: ['a', 'b', 'c'], more: 4 });
  assert.deepEqual(foldAttention(lines, true), { shown: lines, more: 4 });
  assert.deepEqual(foldAttention(['a', 'b', 'c'], false), { shown: ['a', 'b', 'c'], more: null }, 'three lines need no control');
  const four = groupAttention(['x', 'x', 'x', 'x'], (v) => v);
  assert.equal(foldAttention(four, false).more, null, 'four agents with one problem are one line, so nothing folds');
});
