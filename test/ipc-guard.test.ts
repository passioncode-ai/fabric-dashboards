import assert from 'node:assert/strict';
import test from 'node:test';
import { DialogGate, trustedSender } from '../src/core/ipc-guard';

const index = 'file:///Applications/Fabric%20Dashboards.app/Contents/Resources/app.asar/out/renderer/index.html';

test('FD-259 (F7): only the app\'s own page in its main frame is a trusted IPC sender', () => {
  assert.equal(trustedSender(index, true, index), true);
  assert.equal(trustedSender(`${index}?drawer=1#/agents`, true, index), true, 'the drawer and any route');
  assert.equal(trustedSender(index, false, index), false, 'a subframe');
  assert.equal(trustedSender('http://127.0.0.1:47001/dashboard', true, index), false, 'a service page');
  assert.equal(trustedSender('file:///tmp/other.html', true, index), false, 'another file');
  assert.equal(trustedSender(undefined, true, index), false, 'a frame already gone');
  assert.equal(trustedSender('not a url', true, index), false);
});

test('FD-259 (F9): a page gets one dialog at a time, and not again within the gap', () => {
  let now = 1000;
  const g = new DialogGate(2000, () => now);
  assert.equal(g.take('a.default'), true);
  assert.equal(g.take('a.default'), false, 'one open already');
  assert.equal(g.take('b.default'), true, 'another page is not held back');
  g.done('a.default');
  now += 1500;
  assert.equal(g.take('a.default'), false, 'too soon after the last one closed');
  now += 600;
  assert.equal(g.take('a.default'), true);
});
