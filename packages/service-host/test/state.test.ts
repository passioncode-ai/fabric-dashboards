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

// Scenario walk 2026-11-11 (SCN-006): the attention order is shared too; a tile comes before an update.
for (const c of vectors.attention ?? []) {
  test(`attention rank: ${c.name}`, () => {
    const doc = (vectors.base.probe as { doc: NonNullable<Parameters<typeof attentionRank>[1]> }).doc;
    assert.equal(attentionRank(c.state, c.wellKnown ? { ...doc, ...c.wellKnown } : null), c.expect);
  });
}

test('the vectors carry attention ranks, the tile before the update among them', () => {
  assert.ok((vectors.attention ?? []).some((c) => c.wellKnown?.update?.available && c.wellKnown.summary?.some((t) => t.attention) && c.expect === 7));
});

test('attention ranks put down first and hide what is fine', () => {
  const wk = (vectors.base.probe as { doc: Parameters<typeof attentionRank>[1] }).doc!;
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: null } }), null);
  assert.ok(attentionRank('down', null)! < attentionRank('duplicate', null)!);
  assert.ok(attentionRank('invalid', null)! < attentionRank('degraded', null)!);
  assert.equal(attentionRank('ready', { ...wk, summary: [{ label: 'Awaiting you', value: 1, attention: true }], update: { available: null } }), 7);
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: '0.2.1' } }), 8);
  assert.equal(attentionRank('ready', { ...wk, summary: [{ label: 'Awaiting you', value: 1, attention: true }], update: { available: '0.2.1' } }), 7, 'a tile before an update');
  assert.equal(attentionRank('stopped', null), null);
});

test('FD-250: a local job that is down says how launchd saw it end, and how often it was started', async () => {
  const { deriveState } = await import('../src/state');
  const d = { id: 'x', instance: 'default', origin: 'http://127.0.0.1:1', placement: 'local', lifecycle: { manager: 'launchd', label: 'x' } } as never;
  const base = { descriptor: d, problems: [], conflict: null, probe: { kind: 'no-answer', detail: 'ECONNREFUSED' } as never, firstUnansweredAt: 0, now: 600_000, busy: null };
  const down = deriveState({ ...base, launchd: { managed: true, loaded: true, pid: null, disabled: false, runs: 37, lastExit: { code: 1 } } });
  assert.equal(down.state, 'down');
  assert.deepEqual(down.reasons[1], { code: 'reason.launchd.exitCode', params: { code: 1, runs: 37 } });
  const sig = deriveState({ ...base, launchd: { managed: true, loaded: true, pid: null, disabled: false, runs: 2, lastExit: { signal: 'Killed: 9' } } });
  assert.deepEqual(sig.reasons[1], { code: 'reason.launchd.signal', params: { signal: 'Killed: 9', runs: 2 } });
  const clean = deriveState({ ...base, launchd: { managed: true, loaded: true, pid: null, disabled: false, runs: 1, lastExit: { code: 0 } } });
  assert.equal(clean.reasons.length, 1, 'a clean exit adds nothing');
});
