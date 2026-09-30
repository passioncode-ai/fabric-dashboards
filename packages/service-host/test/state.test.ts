// The shared state-precedence vectors, run against the package's own deriveState.
import assert from 'node:assert/strict';
import test from 'node:test';
import { attentionRank, deriveState, DOWN_AFTER_MS, loadStateVectors, type StateInput } from '../src/index';

const vectors = loadStateVectors();

test('the vectors are the package\'s own grace window', () => {
  assert.equal(vectors.schema, 'fabric-service-host/state-precedence@1');
  assert.equal(vectors.downAfterMs, DOWN_AFTER_MS);
  assert.ok(vectors.cases.length >= 20, `${vectors.cases.length} cases`);
});

for (const c of vectors.cases) {
  test(`state precedence: ${c.name}`, () => {
    const input = { ...vectors.base, ...c.input } as StateInput;
    const out = deriveState(input);
    assert.equal(out.state, c.expect.state);
    if (c.expect.reasons) assert.deepEqual(out.reasons, c.expect.reasons);
  });
}

test('attention ranks put down first and hide what is fine', () => {
  const wk = (vectors.base.probe as { doc: Parameters<typeof attentionRank>[1] }).doc!;
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: null } }), null);
  assert.ok(attentionRank('down', null)! < attentionRank('duplicate', null)!);
  assert.ok(attentionRank('invalid', null)! < attentionRank('degraded', null)!);
  assert.equal(attentionRank('ready', { ...wk, summary: [{ label: 'Awaiting you', value: 1, attention: true }], update: { available: null } }), 7);
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: '0.2.1' } }), 8);
  assert.equal(attentionRank('stopped', null), null);
});
