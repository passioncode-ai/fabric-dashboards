// The remote token latch: an origin that is not the service gets no token again.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteTokenLatch, type Descriptor, type WellKnownResult } from '../src/index';

const d = { id: 'agent', instance: 'default', placement: 'remote', origin: 'https://agent.example.com', auth: { tokenFile: '/x' } } as unknown as Descriptor;
const answer = (id: string): WellKnownResult => ({ kind: 'answer', ms: 1, doc: { service: { id, instance: 'default' }, process: { pid: 1 } } as never });

function sender(results: WellKnownResult[]) {
  const calls: boolean[] = [];
  return { calls, send: async (withToken: boolean) => { calls.push(withToken); return results.shift()!; } };
}

test('a non-protocol answer withholds the token until the origin asks for one again', async () => {
  const latch = new RemoteTokenLatch();
  const s = sender([{ kind: 'not-protocol', detail: 'HTTP 404' }, { kind: 'not-protocol', detail: 'HTTP 404' }, { kind: 'refused', detail: '401' }, answer('agent')]);
  assert.equal((await latch.probe(d, s.send)).kind, 'not-protocol');
  assert.equal(latch.withheld(d), 'not-protocol');
  assert.equal((await latch.probe(d, s.send)).kind, 'not-protocol');
  assert.equal((await latch.probe(d, s.send)).kind, 'answer');
  assert.deepEqual(s.calls, [true, false, false, true], 'no token after the first non-protocol answer; a 401 reopens it');
  assert.equal(latch.withheld(d), null);
});

test('another service answering keeps its verdict with no request until the descriptor changes', async () => {
  const latch = new RemoteTokenLatch();
  const s = sender([answer('other'), answer('agent')]);
  await latch.probe(d, s.send);
  assert.equal((await latch.probe(d, s.send)).kind, 'answer');
  assert.deepEqual(s.calls, [true]);
  assert.equal(latch.withheld({ ...d, origin: 'https://new.example.com' } as Descriptor), null);
  await latch.probe({ ...d, origin: 'https://new.example.com' } as Descriptor, s.send);
  assert.deepEqual(s.calls, [true, true]);
});
