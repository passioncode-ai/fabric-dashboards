// FD-132: the placement record (observatory-placement/1) and how a descriptor is matched against it.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { elsewhereOf, parsePlacement, placementFile, placementFileProblem, PlacementReader, type Descriptor } from '../src/index';

const doc = (elsewhere: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ schema: 'observatory-placement/1', machine: 'studio-1', updatedAt: '2026-10-28T10:00:00Z', elsewhere, ...extra });
const d = (over: Partial<Descriptor> = {}) => ({ id: 'example-agent', instance: 'default', lifecycle: { manager: 'launchd', label: 'com.example.example-agent' }, ...over }) as Descriptor;

test('FD-132: the file lives under XDG_DATA_HOME, else ~/.local/share', () => {
  // path.join: Windows joins with its own separator (the release's Windows check, 2026-10-28).
  assert.equal(placementFile({ XDG_DATA_HOME: '/x/data' }, '/opt/h'), path.join('/x/data', 'project-observatory', 'placement.json'));
  assert.equal(placementFile({}, '/opt/h'), path.join('/opt/h', '.local', 'share', 'project-observatory', 'placement.json'));
  assert.equal(placementFile({ XDG_DATA_HOME: ' ' }, '/opt/h'), path.join('/opt/h', '.local', 'share', 'project-observatory', 'placement.json'));
});

test('FD-132: a launchd label places the service on the named machine', () => {
  const r = parsePlacement(doc([{ label: 'com.example.example-agent', serviceId: 'example-agent.default', placedOn: 'studio-2', since: '2026-10-28T09:00:00Z', by: 'OBS-283' }]));
  assert.equal(r.error, null);
  assert.deepEqual(elsewhereOf(r.placement, d()), { placedOn: 'studio-2', since: '2026-10-28T09:00:00Z' });
});

test('FD-132: a key matches without a label; an id alone stands for the default instance only', () => {
  const r = parsePlacement(doc([{ serviceId: 'example-agent', placedOn: 'studio-2' }])).placement;
  assert.deepEqual(elsewhereOf(r, d({ lifecycle: { manager: 'none' } } as Partial<Descriptor>)), { placedOn: 'studio-2' });
  assert.equal(elsewhereOf(r, d({ instance: 'preview' })), null);
  const k = parsePlacement(doc([{ serviceId: 'example-agent.preview', placedOn: 'studio-2' }])).placement;
  assert.deepEqual(elsewhereOf(k, d({ instance: 'preview' })), { placedOn: 'studio-2' });
  assert.equal(elsewhereOf(k, d()), null);
});

test('FD-132: no record, an unnamed service, or one placed on this machine itself: placed here', () => {
  const r = parsePlacement(doc([{ label: 'com.other', placedOn: 'studio-2' }, { label: 'com.example.example-agent', placedOn: 'studio-1' }])).placement;
  assert.equal(elsewhereOf(null, d()), null);
  assert.equal(elsewhereOf(r, d({ id: 'other' } as Partial<Descriptor>)), null);
  assert.equal(elsewhereOf(r, d()), null);
});

test('FD-132: an entry with no machine or nothing to match by is dropped, never guessed', () => {
  const r = parsePlacement(doc([{ label: 'com.a' }, { placedOn: 'studio-2' }, 'x', null, { label: 'com.b', placedOn: 'studio-2' }]));
  assert.deepEqual(r.placement?.elsewhere, [{ label: 'com.b', placedOn: 'studio-2' }]);
});

test('FD-132: a document that is not the record is refused with its reason', () => {
  assert.match(parsePlacement('{').error ?? '', /not JSON/);
  assert.match(parsePlacement('[]').error ?? '', /not an object/);
  assert.match(parsePlacement(doc([], { schema: 'observatory-placement/2' })).error ?? '', /observatory-placement\/2/);
  assert.match(parsePlacement(JSON.stringify({ machine: 'm' })).error ?? '', /no elsewhere list/);
});

test('FD-132: only the owner may write the record', () => {
  const ok = { uid: 501, mode: 0o100600, size: 10, mtimeMs: 1 };
  assert.equal(placementFileProblem(ok, { platform: 'darwin', uid: 501 }), null);
  assert.match(placementFileProblem({ ...ok, uid: 0 }, { platform: 'darwin', uid: 501 }) ?? '', /another user/);
  assert.match(placementFileProblem({ ...ok, mode: 0o100666 }, { platform: 'darwin', uid: 501 }) ?? '', /others may write/);
  assert.equal(placementFileProblem({ ...ok, mode: 0o100644 }, { platform: 'darwin', uid: 501 }), null);
  assert.equal(placementFileProblem({ ...ok, uid: 0, mode: 0o100666 }, { platform: 'win32', uid: undefined }), null);
});

test('FD-132: the reader reads again only when the file changed, and no more often than asked', () => {
  let stamp = { uid: 501, mode: 0o100600, size: 10, mtimeMs: 1 };
  let body = doc([{ label: 'com.example.example-agent', placedOn: 'studio-2' }]);
  let present = true;
  let reads = 0;
  let stats = 0;
  const reader = new PlacementReader({ file: '/f', everyMs: 5000, platform: 'darwin', uid: 501,
    stat: () => { stats += 1; if (!present) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return stamp; },
    read: () => { reads += 1; return body; } });
  assert.equal(reader.get(0)?.elsewhere.length, 1);
  assert.equal(reader.get(1000)?.elsewhere.length, 1);
  assert.equal(stats, 1, 'asked within the interval: no stat');
  reader.get(6000);
  assert.equal(reads, 1, 'same stamp: not read again');
  body = doc([]);
  stamp = { ...stamp, mtimeMs: 2 };
  assert.equal(reader.get(12000)?.elsewhere.length, 0);
  assert.equal(reads, 2);
  present = false;
  assert.equal(reader.get(18000), null);
  assert.equal(reader.error, null, 'absent is not an error');
  present = true;
  stamp = { ...stamp, mode: 0o100666, mtimeMs: 3 };
  assert.equal(reader.get(24000), null);
  assert.match(reader.error ?? '', /others may write/);
  body = '{';
  stamp = { ...stamp, mode: 0o100600, mtimeMs: 4 };
  assert.equal(reader.get(30000), null);
  assert.match(reader.error ?? '', /not JSON/);
});

// Written by Observatory 0.30.1's own writer (`machine_identity.place_elsewhere`, OBS-283) into a temporary
// XDG_DATA_HOME on 2026-11-03, byte for byte: what this reader must take from the producer.
const OBSERVATORY_0301 = `{
  "schema": "observatory-placement/1",
  "machine": "m-thismac0001",
  "updatedAt": "2026-11-03T02:48:10Z",
  "elsewhere": [
    {
      "label": "com.example.agent",
      "serviceId": "example-agent.default",
      "placedOn": "m-studio0001",
      "since": "2026-11-03T02:48:10Z",
      "by": "machine-restore"
    },
    {
      "label": "com.example.bot",
      "serviceId": null,
      "placedOn": "unknown",
      "since": "2026-11-03T02:48:10Z",
      "by": "machine-restore"
    },
    {
      "label": "com.example.here",
      "serviceId": null,
      "placedOn": "m-thismac0001",
      "since": "2026-11-03T02:48:10Z",
      "by": "machine-move leave"
    }
  ]
}
`;

test('FD-132: the file Observatory 0.30.1 writes is read: by label, by key, with serviceId null and placedOn unknown', () => {
  const r = parsePlacement(OBSERVATORY_0301);
  assert.equal(r.error, null);
  assert.equal(r.placement?.machine, 'm-thismac0001');
  assert.equal(r.placement?.elsewhere.length, 3);
  const since = '2026-11-03T02:48:10Z';
  assert.deepEqual(elsewhereOf(r.placement, d({ lifecycle: { manager: 'launchd', label: 'com.example.agent' } } as Partial<Descriptor>)), { placedOn: 'm-studio0001', since });
  assert.deepEqual(elsewhereOf(r.placement, d({ lifecycle: { manager: 'none' } } as Partial<Descriptor>)), { placedOn: 'm-studio0001', since });
  assert.deepEqual(elsewhereOf(r.placement, d({ id: 'bot', lifecycle: { manager: 'launchd', label: 'com.example.bot' } } as Partial<Descriptor>)), { placedOn: 'unknown', since });
  // An entry that names this machine is placed here.
  assert.equal(elsewhereOf(r.placement, d({ id: 'here', lifecycle: { manager: 'launchd', label: 'com.example.here' } } as Partial<Descriptor>)), null);
});
