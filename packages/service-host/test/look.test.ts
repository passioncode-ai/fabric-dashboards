// One look at every service: what Fabric's registry reads, and what the MCP server answers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LaunchdReader, lookAtServices, type Runner, type WellKnownResult } from '../src/index';
import { tmpDir } from './tmp';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

function world() {
  const dir = tmpDir('fsh-look-');
  const write = (d: Record<string, unknown>, name = `${d.id}.${d.instance}.json`) => fs.writeFileSync(path.join(dir, name), JSON.stringify(d));
  const base = fx('positive_service-descriptor.json');
  const wk = fx('positive_service-well-known.json');
  write({ ...base, id: 'ready-one', instance: 'default', origin: 'http://127.0.0.1:47301', lifecycle: { manager: 'none' } });
  write({ ...base, id: 'off-one', instance: 'default', origin: 'http://127.0.0.1:47302', lifecycle: { ...base.lifecycle, label: 'com.example.off' } });
  write({ ...base, id: 'clash-a', instance: 'default', origin: 'http://127.0.0.1:47303' });
  write({ ...base, id: 'clash-b', instance: 'default', origin: 'http://127.0.0.1:47303' });
  fs.writeFileSync(path.join(dir, 'broken.default.json'), '{');
  const probed: string[] = [];
  const answers: Record<string, WellKnownResult> = {
    'http://127.0.0.1:47301': { kind: 'answer', ms: 2, doc: { ...wk, service: { ...wk.service, id: 'ready-one' }, status: 'ready', degraded: [] } },
  };
  const wellKnown = async (origin: string): Promise<WellKnownResult> => { probed.push(origin); return answers[origin] ?? { kind: 'no-answer', detail: 'connect ECONNREFUSED' }; };
  const launchctl: string[] = [];
  const run: Runner = async (_cmd, args) => {
    launchctl.push(args[0]!);
    if (args[0] === 'print-disabled') return { code: 0, stdout: '"com.example.off" => disabled\n', stderr: '' };
    return { code: 113, stdout: '', stderr: 'Could not find service' };
  };
  return { dir, probed, launchctl, wellKnown, launchd: new LaunchdReader(run, 501) };
}

test('every descriptor gets one state; invalid and conflicting ones are never probed', async () => {
  const w = world();
  const look = await lookAtServices({ servicesDir: w.dir, wellKnown: w.wellKnown, launchd: w.launchd, now: () => 1_000_000, platform: 'darwin' });
  assert.equal(look.servicesDir, w.dir);
  assert.equal(look.error, null);
  const states = Object.fromEntries(look.services.map((s) => [s.key, s.state]));
  assert.deepEqual(states, { 'broken.default': 'invalid', 'clash-a.default': 'conflict', 'clash-b.default': 'conflict', 'off-one.default': 'stopped', 'ready-one.default': 'ready' });
  assert.deepEqual(w.probed.sort(), ['http://127.0.0.1:47301', 'http://127.0.0.1:47302']);
  assert.equal(w.launchctl.filter((v) => v === 'print-disabled').length, 1, 'one print-disabled per look');
  const ready = look.services.find((s) => s.key === 'ready-one.default')!;
  assert.equal(ready.wellKnown?.service.id, 'ready-one');
  assert.deepEqual(ready.launchd, { managed: false, loaded: false, pid: null, disabled: false });
  assert.equal(look.services.find((s) => s.key === 'off-one.default')!.wellKnown, null);
});

test('one look has no history: a loaded service that does not answer now is down', async () => {
  const w = world();
  const run: Runner = async (_c, args) => (args[0] === 'print' ? { code: 0, stdout: 'pid = 9\n', stderr: '' } : { code: 0, stdout: '', stderr: '' });
  const look = await lookAtServices({ servicesDir: w.dir, wellKnown: w.wellKnown, launchd: new LaunchdReader(run, 501), now: () => 1_000_000, platform: 'darwin' });
  assert.equal(look.services.find((s) => s.key === 'off-one.default')!.state, 'down');
});

test('an absent services directory is an empty look; an unreadable one is reported, not thrown', async () => {
  const w = world();
  const absent = await lookAtServices({ servicesDir: path.join(w.dir, 'none'), wellKnown: w.wellKnown, launchd: w.launchd, platform: 'darwin' });
  assert.deepEqual(absent.services, []);
  assert.equal(absent.error, null);
  const file = path.join(w.dir, 'broken.default.json');
  const unreadable = await lookAtServices({ servicesDir: file, wellKnown: w.wellKnown, launchd: w.launchd, platform: 'darwin' });
  assert.deepEqual(unreadable.services, []);
  assert.match(unreadable.error!, /ENOTDIR/);
});

test('a probe that throws is a no-answer, never a failed look', async () => {
  const w = world();
  const look = await lookAtServices({ servicesDir: w.dir, wellKnown: async () => { throw new Error('boom'); }, launchd: w.launchd, now: () => 1_000_000 });
  assert.equal(look.services.find((s) => s.key === 'ready-one.default')!.state, 'down');
});

test('only= looks at the named services, and still sees the claims of the others', async () => {
  const w = world();
  const look = await lookAtServices({ servicesDir: w.dir, wellKnown: w.wellKnown, launchd: w.launchd, now: () => 1_000_000, only: ['clash-a.default', 'ready-one.default'], platform: 'darwin' });
  assert.deepEqual(look.services.map((s) => [s.key, s.state]), [['clash-a.default', 'conflict'], ['ready-one.default', 'ready']]);
  assert.deepEqual(look.services[0]!.conflict, { port: 47303, with: ['clash-b.default'] });
  assert.deepEqual(w.probed, ['http://127.0.0.1:47301']);
  const unmanaged = world();
  await lookAtServices({ servicesDir: unmanaged.dir, wellKnown: unmanaged.wellKnown, launchd: unmanaged.launchd, only: ['ready-one.default'], platform: 'darwin' });
  assert.deepEqual(unmanaged.launchctl, [], 'no launchd job among the chosen: launchctl is not run');
});

// FD-37 / ADR-0019 §7: launchd is macOS's. A look on Windows or Linux spawns no launchctl and shows a
// launchd descriptor read-only — a service that does not answer is down, never "stopped".
test('FD-37: off macOS a look never runs launchctl and reads a launchd service as unmanaged', async () => {
  const w = world();
  const look = await lookAtServices({ servicesDir: w.dir, wellKnown: w.wellKnown, launchd: w.launchd, now: () => 1_000_000, platform: 'linux' });
  assert.deepEqual(w.launchctl, [], 'no print-disabled, no print');
  const off = look.services.find((s) => s.key === 'off-one.default')!;
  assert.equal(off.launchd.managed, false);
  assert.notEqual(off.state, 'stopped');
});
