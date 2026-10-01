import assert from 'node:assert/strict';
import test from 'node:test';
import { ViewSlot } from '../src/electron/policy';

// The renderer sends show and hide over IPC in the order React commits effects: the new
// dashboard's layout effect (show) runs before the old one's passive cleanup (hide). The slot
// decides from who asked, not from arrival order, so a stale hide never blanks the new view.

test('switching between two loaded services: the old host hide arriving after the new show is ignored', () => {
  const slot = new ViewSlot();
  const a = slot.request('host-a', 'store-agent.default');
  assert.equal(slot.current(a), true);
  const b = slot.request('host-b', 'maker.default');
  assert.equal(slot.release('host-a'), false, 'the unmounted host may not hide what the new host shows');
  assert.equal(slot.current(b), true);
  assert.equal(slot.wanted(), 'maker.default');
});

test('the same service remounted: the old host of the same key cannot hide the new one', () => {
  const slot = new ViewSlot();
  slot.request('host-1', 'svc.default');
  const again = slot.request('host-2', 'svc.default');
  assert.equal(slot.release('host-1'), false);
  assert.equal(slot.current(again), true);
});

test('a show that finishes after a newer show or a hide never attaches', () => {
  const slot = new ViewSlot();
  const slow = slot.request('host-a', 'slow.default');
  const fast = slot.request('host-b', 'fast.default');
  assert.equal(slot.current(slow), false, 'a slower load finishing late does not cover the newer view');
  assert.equal(slot.current(fast), true);
  const pending = slot.request('host-c', 'pending.default');
  assert.equal(slot.release(), true, 'leaving the service page hides whatever is shown');
  assert.equal(slot.current(pending), false);
  assert.equal(slot.wanted(), null);
});

test('the host that asked may hide its own view (error, crash, overlay)', () => {
  const slot = new ViewSlot();
  const t = slot.request('host-a', 'svc.default');
  assert.equal(slot.release('host-a'), true);
  assert.equal(slot.current(t), false);
  assert.equal(slot.release('host-a'), false, 'a second hide from the same host changes nothing');
});
