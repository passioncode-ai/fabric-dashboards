// FD-167: Observatory's root-owned record of the system daemons it installs for a space (observatory-space-daemons/1).
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSpaceDaemons, SpaceDaemonReader, spaceDaemonsFileProblem, SPACE_DAEMONS_SCHEMA, LaunchdReader, type RunResult } from '../src/index';

const doc = (entries: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ schema: SPACE_DAEMONS_SCHEMA, entries, ...extra });
const ROOT = { uid: 0, mode: 0o100644, size: 200, mtimeMs: 1 };

test('FD-167: the record names label, user and uid; anything incomplete is dropped, never guessed', () => {
  const r = parseSpaceDaemons(doc([
    { label: 'com.example.agent', user: 'space', uid: 502, source: '/x', sourceSha256: 'a', written: '/Library/LaunchDaemons/com.example.agent.plist', writtenSha256: 'b', at: '2026-11-07T00:00:00Z' },
    { label: 'com.example.nouid', user: 'space' },
    { label: 'com.example.baduid', user: 'space', uid: -1 },
    { user: 'space', uid: 502 },
  ]));
  assert.deepEqual(r, { daemons: [{ label: 'com.example.agent', user: 'space', uid: 502 }], error: null });
  assert.match(parseSpaceDaemons(doc([], { schema: 'other/1' })).error!, /speaks other\/1/);
  assert.match(parseSpaceDaemons('{').error!, /not JSON/);
  assert.match(parseSpaceDaemons(JSON.stringify({ schema: SPACE_DAEMONS_SCHEMA })).error!, /no entries/);
});

test('FD-167: only a record root owns and nobody else may write is read', () => {
  assert.equal(spaceDaemonsFileProblem(ROOT), null);
  assert.match(spaceDaemonsFileProblem({ ...ROOT, uid: 501 })!, /not owned by root/);
  assert.match(spaceDaemonsFileProblem({ ...ROOT, mode: 0o100666 })!, /others may write/);
});

test('FD-167: a label is a system daemon only for the uid the record names; no file, or another platform, is gui as before', () => {
  let reads = 0;
  const raw = doc([{ label: 'com.example.agent', user: 'space', uid: 502 }]);
  const r = new SpaceDaemonReader({ platform: 'darwin', uid: 502, stat: () => ROOT, read: () => { reads++; return raw; } });
  assert.equal(r.isSystem('com.example.agent', 0), true);
  assert.equal(r.isSystem('com.example.other', 1), false);
  assert.equal(reads, 1, 'read once while unchanged');
  assert.equal(new SpaceDaemonReader({ platform: 'darwin', uid: 501, stat: () => ROOT, read: () => raw }).isSystem('com.example.agent', 0), false, 'another user\'s daemon');
  assert.equal(new SpaceDaemonReader({ platform: 'darwin', uid: 502, stat: () => { throw new Error('ENOENT'); } }).isSystem('com.example.agent', 0), false);
  assert.equal(new SpaceDaemonReader({ platform: 'linux', uid: 502, stat: () => ROOT, read: () => raw }).isSystem('com.example.agent', 0), false);
  const bad = new SpaceDaemonReader({ platform: 'darwin', uid: 502, stat: () => ({ ...ROOT, uid: 502 }), read: () => raw });
  assert.equal(bad.isSystem('com.example.agent', 0), false);
  assert.match(bad.error!, /not owned by root/);
});

test('FD-167: launchd is read in the system domain for such a job', async () => {
  const calls: string[] = [];
  const run = async (_c: string, a: string[]): Promise<RunResult> => { calls.push(a.join(' ')); return a[0] === 'print' ? { code: 0, stdout: 'pid = 77\n', stderr: '' } : { code: 0, stdout: '"com.example.agent" => enabled', stderr: '' }; };
  const reader = new LaunchdReader(run, 502);
  assert.deepEqual(await reader.status('com.example.agent', undefined, 'system'), { loaded: true, pid: 77, disabled: false });
  assert.deepEqual(calls, ['print system/com.example.agent', 'print-disabled system']);
  assert.equal(reader.target('com.example.agent'), 'gui/502/com.example.agent', 'gui stays the default');
});
