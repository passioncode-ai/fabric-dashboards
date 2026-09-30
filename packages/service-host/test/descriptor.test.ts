// Reading services/: the contract's fixtures are the test vectors (test/fixtures/contract, copied
// from fabric-agent-contract with a SOURCE.txt).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claimConflicts, portOf, readDirectory, servicesDir, validateDescriptor } from '../src/descriptor';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/contract');
const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fsh-descriptor-'));

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
  assert.deepEqual(validateDescriptor([]), ['the file is not a JSON object']);
  assert.deepEqual(validateDescriptor({ protocol: 'fabric-service/0.1' }).slice(0, 2), ['missing id', 'missing instance']);
});

test('services directory follows FABRIC_SERVICES_DIR, then the OS location', () => {
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '/x/y' }, 'darwin', '/Users/o'), '/x/y');
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '~/s' }, 'darwin', '/Users/o'), '/Users/o/s');
  assert.equal(servicesDir({}, 'darwin', '/Users/o'), '/Users/o/Library/Application Support/ai.passioncode.fabric/services');
  assert.equal(servicesDir({}, 'linux', '/home/o'), '/home/o/.local/share/passioncode-fabric/services');
  assert.equal(servicesDir({ XDG_DATA_HOME: '/d' }, 'linux', '/home/o'), '/d/passioncode-fabric/services');
});

test('portOf accepts only a loopback http origin with a port', () => {
  assert.equal(portOf('http://127.0.0.1:47195'), 47195);
  for (const bad of ['http://localhost:47195', 'https://127.0.0.1:47195', 'http://127.0.0.1', 'http://127.0.0.1:99', 'http://127.0.0.1:70000', 'http://0.0.0.0:47195']) {
    assert.equal(portOf(bad), null, bad);
  }
});

test('readDirectory reports unreadable and misnamed files instead of throwing', () => {
  const dir = tmp();
  const good = fx('positive_service-descriptor.json');
  fs.writeFileSync(path.join(dir, 'example-agent.default.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(dir, 'half.default.json'), '{"protocol": "fabric-');
  fs.writeFileSync(path.join(dir, 'wrong.name.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(dir, '.tmp.json'), 'ignored');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
  const entries = readDirectory(dir);
  assert.equal(entries.length, 3);
  assert.ok(entries.find((e) => e.key === 'example-agent.default')?.descriptor);
  assert.match(entries.find((e) => e.key === 'half.default')!.problems[0]!, /JSON/);
  const misnamed = entries.find((e) => e.path.endsWith('wrong.name.json'))!;
  assert.equal(misnamed.descriptor, null);
  assert.match(misnamed.problems.join(), /named wrong\.name\.json/);
  assert.deepEqual(readDirectory(path.join(dir, 'absent')), []);
});

test('readDirectory throws what is not an absent directory (the caller reports it)', () => {
  const file = path.join(tmp(), 'plain');
  fs.writeFileSync(file, '');
  assert.throws(() => readDirectory(file), /ENOTDIR/);
});

test('FAC-SEM-010: two services on one port name each other; a key claimed twice is a conflict', () => {
  const d = (id: string, instance: string, port: number) => ({ ...fx('positive_service-descriptor.json'), id, instance, origin: `http://127.0.0.1:${port}` });
  const entries = [d('maker', 'preview', 47191), d('writer', 'default', 47191), d('plan', 'default', 47110), d('twice', 'default', 47120), d('twice', 'default', 47121)]
    .map((x) => ({ path: '', key: `${x.id}.${x.instance}`, descriptor: x, problems: [] }));
  const conflicts = claimConflicts(entries);
  assert.deepEqual(conflicts.get('writer.default'), { port: 47191, with: ['maker.preview'] });
  assert.deepEqual(conflicts.get('maker.preview'), { port: 47191, with: ['writer.default'] });
  assert.deepEqual(conflicts.get('twice.default'), { with: ['twice.default'] });
  assert.equal(conflicts.has('plan.default'), false);
});
