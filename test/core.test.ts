// The app's own use of the shared reading code: the launchd verbs that only the app has, and
// the shared state-precedence vectors run through the package the app imports (the same file
// Fabric runs — packages/service-host/test-vectors/state-precedence.json, AR-2.2).
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveState, DOWN_AFTER_MS, loadStateVectors, type StateInput } from '@passioncode-ai/fabric-service-host';
import { Launchd, type Runner } from '../src/core/launchd';
import { DOWN_AFTER_MS as MONITOR_GRACE } from '@passioncode-ai/fabric-service-host/state';

test('Launchd verbs: stop disables, start enables, restart kickstarts, never a process spawn', async () => {
  const calls: string[] = [];
  let loaded = true;
  const run: Runner = async (cmd, args) => {
    assert.equal(cmd, 'launchctl');
    calls.push(args.join(' '));
    if (args[0] === 'print') return loaded ? { code: 0, stdout: 'pid = 7', stderr: '' } : { code: 113, stdout: '', stderr: 'Could not find service' };
    if (args[0] === 'bootout') { loaded = false; return { code: 0, stdout: '', stderr: '' }; }
    if (args[0] === 'bootstrap') { loaded = true; return { code: 0, stdout: '', stderr: '' }; }
    return { code: 0, stdout: '', stderr: '' };
  };
  const l = new Launchd(run, 501);
  await l.stop('com.x');
  assert.deepEqual(calls.filter((c) => !c.startsWith('print')), ['bootout gui/501/com.x', 'disable gui/501/com.x']);
  calls.length = 0;
  await l.restart('com.x', '/p.plist');
  assert.deepEqual(calls.filter((c) => !c.startsWith('print')), ['enable gui/501/com.x', 'bootstrap gui/501 /p.plist']);
  calls.length = 0;
  await l.restart('com.x', '/p.plist');
  assert.deepEqual(calls.filter((c) => !c.startsWith('print')), ['kickstart -k gui/501/com.x']);
});

test('Launchd bootstrap retries the transient I/O error', async () => {
  let attempts = 0;
  const run: Runner = async (_c, args) => {
    if (args[0] === 'bootstrap') { attempts += 1; return attempts < 2 ? { code: 5, stdout: '', stderr: 'Bootstrap failed: 5: Input/output error' } : { code: 0, stdout: '', stderr: '' }; }
    return { code: 0, stdout: '', stderr: '' };
  };
  const r = await new Launchd(run, 501).start('com.x', '/p.plist');
  assert.equal(r.code, 0);
  assert.equal(attempts, 2);
});

const vectors = loadStateVectors();

test('the shared state-precedence vectors hold for the app', () => {
  assert.equal(vectors.downAfterMs, DOWN_AFTER_MS);
  assert.equal(MONITOR_GRACE, DOWN_AFTER_MS, 'the renderer entry and the main entry are one module');
  assert.ok(vectors.cases.length >= 20);
  for (const c of vectors.cases) {
    const out = deriveState({ ...vectors.base, ...c.input } as StateInput);
    assert.equal(out.state, c.expect.state, c.name);
    if (c.expect.reasons) assert.deepEqual(out.reasons, c.expect.reasons, c.name);
  }
});

test('F-1: an installed copy moves only forward — the feed\'s version must be newer', async () => {
  const { isNewer } = await import('../src/core/version');
  assert.equal(isNewer('0.5.5', '0.5.4'), true);
  assert.equal(isNewer('0.5.4', '0.5.5'), false, 'an older release in the feed is never installed');
  assert.equal(isNewer('0.5.5', '0.5.5'), false);
  assert.equal(isNewer('0.10.0', '0.9.9'), true, 'numeric, not string, comparison');
  assert.equal(isNewer('1.0.0', '1.0.0-rc.2'), true);
  assert.equal(isNewer('1.0.0-rc.10', '1.0.0-rc.9'), true);
  assert.equal(isNewer('1.0.0-rc.1', '1.0.0'), false);
  assert.equal(isNewer('garbage', '0.5.4'), false);
  assert.equal(isNewer('v0.6.0', '0.5.4'), true);
});
