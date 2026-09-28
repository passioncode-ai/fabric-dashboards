import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claimConflicts, readDirectory, servicesDir, validateDescriptor } from '../src/core/descriptor';
import { Launchd, parseDisabled, parsePrint, type Runner } from '../src/core/launchd';
import { attentionRank, deriveState, DOWN_AFTER_MS, type StateInput } from '../src/core/state';
import type { Descriptor, WellKnown } from '../src/core/types';

const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fd-core-'));

test('contract fixtures: positive descriptors pass, negative ones fail with the reason', () => {
  assert.deepEqual(validateDescriptor(fx('positive_service-descriptor.json')), []);
  assert.deepEqual(validateDescriptor(fx('positive_service-descriptor-unmanaged.json')), []);
  const expect: Record<string, RegExp> = {
    'negative_service-descriptor-lan-origin.json': /origin/,
    'negative_service-descriptor-shell-command.json': /argument array/,
    'negative_service-descriptor-launchd-without-label.json': /lifecycle.label/,
    'negative_service-descriptor-bearer-on-custom-header.json': /scheme must be none/,
  };
  for (const [file, pattern] of Object.entries(expect)) {
    const problems = validateDescriptor(fx(file));
    assert.ok(problems.some((p) => pattern.test(p)), `${file}: ${problems.join('; ')}`);
  }
});

test('services directory follows FABRIC_SERVICES_DIR, then the OS location', () => {
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '/x/y' }, 'darwin', '/Users/o'), '/x/y');
  assert.equal(servicesDir({}, 'darwin', '/Users/o'), '/Users/o/Library/Application Support/ai.passioncode.fabric/services');
  assert.equal(servicesDir({}, 'linux', '/home/o'), '/home/o/.local/share/passioncode-fabric/services');
});

test('readDirectory reports unreadable and misnamed files instead of throwing', () => {
  const dir = tmp();
  const good = fx('positive_service-descriptor.json');
  fs.writeFileSync(path.join(dir, 'example-agent.default.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(dir, 'half.default.json'), '{"protocol": "fabric-');
  fs.writeFileSync(path.join(dir, 'wrong.name.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(dir, '.tmp.json'), 'ignored');
  const entries = readDirectory(dir);
  assert.equal(entries.length, 3);
  assert.ok(entries.find((e) => e.key === 'example-agent.default')?.descriptor);
  assert.match(entries.find((e) => e.key === 'half.default')!.problems[0]!, /JSON/);
  assert.match(entries.find((e) => e.path.endsWith('wrong.name.json'))!.problems.join(), /named wrong\.name\.json/);
  assert.deepEqual(readDirectory(path.join(dir, 'absent')), []);
});

test('FAC-SEM-010: two services on one port name each other', () => {
  const a = { ...fx('positive_service-descriptor.json'), id: 'maker', instance: 'preview', origin: 'http://127.0.0.1:47191' };
  const b = { ...fx('positive_service-descriptor.json'), id: 'writer', instance: 'default', origin: 'http://127.0.0.1:47191' };
  const c = { ...fx('positive_service-descriptor.json'), id: 'plan', instance: 'default', origin: 'http://127.0.0.1:47110' };
  const entries = [a, b, c].map((d) => ({ path: '', key: `${d.id}.${d.instance}`, descriptor: d, problems: [] }));
  const conflicts = claimConflicts(entries);
  assert.deepEqual(conflicts.get('writer.default'), { port: 47191, with: ['maker.preview'] });
  assert.equal(conflicts.has('brand.default'), false);
});

test('launchctl output parsing', () => {
  assert.deepEqual(parsePrint('gui/501/x = {\n\tstate = running\n\tpid = 5542\n}'), { pid: 5542 });
  assert.deepEqual(parsePrint('state = not running'), { pid: null });
  const table = 'disabled services = {\n\t"com.example.plan-board" => disabled\n\t"com.other" => enabled\n\t"com.old" => true\n}';
  assert.equal(parseDisabled(table, 'com.example.plan-board'), true);
  assert.equal(parseDisabled(table, 'com.other'), false);
  assert.equal(parseDisabled(table, 'com.old'), true);
  assert.equal(parseDisabled(table, 'com.absent'), false);
});

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

const descriptor = fx('positive_service-descriptor.json') as Descriptor;
const wk = fx('positive_service-well-known.json') as WellKnown;
const base = (over: Partial<StateInput> = {}): StateInput => ({
  descriptor, problems: [], conflict: undefined,
  launchd: { managed: true, loaded: true, pid: 51234, disabled: false },
  probe: { kind: 'answer', doc: { ...wk, status: 'ready', degraded: [] }, ms: 3 },
  firstUnansweredAt: null, now: 1_000_000, busy: null, ...over,
});

test('state precedence of design §3.3', () => {
  assert.equal(deriveState(base()).state, 'ready');
  assert.equal(deriveState(base({ probe: { kind: 'answer', doc: wk, ms: 3 } })).state, 'degraded');
  assert.equal(deriveState(base({ descriptor: null, problems: ['origin must be …'] })).state, 'invalid');
  assert.equal(deriveState(base({ conflict: { port: 47195, with: ['writer.default'] } })).state, 'conflict');
  const other = { ...wk, service: { ...wk.service, id: 'maker' } };
  assert.equal(deriveState(base({ probe: { kind: 'answer', doc: other, ms: 3 } })).state, 'foreign');
  assert.equal(deriveState(base({ probe: { kind: 'not-protocol', detail: 'HTTP 404' } })).state, 'foreign');
  const dup = deriveState(base({ launchd: { managed: true, loaded: true, pid: 5542, disabled: false } }));
  assert.equal(dup.state, 'duplicate');
  assert.deepEqual(dup.reasons[0]?.params, { answering: 51234, launchd: 5542 });
  const silent = { probe: { kind: 'no-answer' as const, detail: 'ECONNREFUSED' } };
  assert.equal(deriveState(base({ ...silent, launchd: { managed: true, loaded: false, pid: null, disabled: true } })).state, 'stopped');
  assert.equal(deriveState(base({ ...silent, firstUnansweredAt: 1_000_000 - 1000 })).state, 'starting');
  assert.equal(deriveState(base({ ...silent, firstUnansweredAt: 1_000_000 - DOWN_AFTER_MS - 1 })).state, 'down');
  assert.equal(deriveState(base({ busy: 'restarting' })).state, 'starting');
  assert.equal(deriveState(base({ busy: 'stopping' })).state, 'stopping');
});

test('attention ranks put down first and hide what is fine', () => {
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: null } }), null);
  assert.ok(attentionRank('down', null)! < attentionRank('degraded', null)!);
  assert.equal(attentionRank('ready', { ...wk, summary: [{ label: 'Awaiting you', value: 1, attention: true }], update: { available: null } }), 7);
  assert.equal(attentionRank('ready', { ...wk, summary: [], update: { available: '0.2.1' } }), 8);
});
