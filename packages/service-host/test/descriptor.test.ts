// Reading services/: the contract's fixtures are the test vectors (test/fixtures/contract, copied
// from fabric-agent-contract with a SOURCE.txt).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claimConflicts, expand, portOf, readDirectory, servicesDir, validateDescriptor } from '../src/descriptor';

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
    // DEC-0019 — the remote placement (copied from the contract at 2ce3922)
    'negative_service-descriptor-remote-http.json': /https/,
    'negative_service-descriptor-remote-launchd.json': /supervised by its platform/,
    'negative_service-descriptor-remote-ip-literal.json': /IP literal/,
    'negative_service-descriptor-remote-path.json': /no path/,
    'negative_service-descriptor-remote-update.json': /no update/,
    'negative_service-descriptor-remote-loopback.json': /https/,
    'negative_service-descriptor-https-without-placement.json': /127\.0\.0\.1/,
    'negative_service-descriptor-local-without-paths.json': /missing paths/,
  };
  assert.deepEqual(validateDescriptor(fx('positive_service-descriptor-remote.json')), []);
  for (const [file, pattern] of Object.entries(expect)) {
    const problems = validateDescriptor(fx(file));
    assert.ok(problems.some((p) => pattern.test(p)), `${file}: ${problems.join('; ')}`);
  }
  assert.deepEqual(validateDescriptor([]), ['the file is not a JSON object']);
  assert.deepEqual(validateDescriptor({ protocol: 'fabric-service/0.1' }).slice(0, 2), ['missing id', 'missing instance']);
});

test('services directory follows FABRIC_SERVICES_DIR, then the OS location', () => {
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '/x/y' }, 'darwin', '/Users/example'), '/x/y');
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '~/s' }, 'darwin', '/Users/example'), '/Users/example/s');
  assert.equal(servicesDir({}, 'darwin', '/Users/example'), '/Users/example/Library/Application Support/ai.passioncode.fabric/services');
  assert.equal(servicesDir({}, 'linux', '/home/example'), '/home/example/.local/share/passioncode-fabric/services');
  assert.equal(servicesDir({ XDG_DATA_HOME: '/d' }, 'linux', '/home/example'), '/d/passioncode-fabric/services');
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

// FD-37: Windows and Linux. The services directory and the path grammar follow the operating system the
// descriptor was written on; Windows paths are drive-absolute or `~\`, never a network share.
test('FD-37: the Windows services directory is %LOCALAPPDATA%\\passioncode-fabric\\services', () => {
  assert.equal(servicesDir({ LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local' }, 'win32', 'C:\\Users\\example'), 'C:\\Users\\example\\AppData\\Local\\passioncode-fabric\\services');
  assert.equal(servicesDir({}, 'win32', 'C:\\Users\\example'), 'C:\\Users\\example\\AppData\\Local\\passioncode-fabric\\services', 'LOCALAPPDATA missing: the profile default');
  assert.equal(servicesDir({ FABRIC_SERVICES_DIR: '~\\svc' }, 'win32', 'C:\\Users\\example'), 'C:\\Users\\example\\svc');
});

test('FD-37: expand resolves ~/ everywhere and ~\\ on Windows only', () => {
  assert.equal(expand('~/t', '/home/example', 'linux'), '/home/example/t');
  assert.equal(expand('~\\t', 'C:\\Users\\example', 'win32'), 'C:\\Users\\example\\t');
  assert.equal(expand('~/t', 'C:\\Users\\example', 'win32'), 'C:\\Users\\example\\t');
  assert.equal(expand('~\\t', '/home/example', 'linux'), '~\\t', 'a backslash is a file-name character on Linux');
});

test('FD-37: descriptor paths are drive-absolute or ~\\ on Windows, never a share; POSIX elsewhere', () => {
  const win = (paths: { token: string; data: string; logs: string[]; doctor: string }) => ({
    ...fx('positive_service-descriptor.json'),
    auth: { tokenFile: paths.token },
    lifecycle: { manager: 'none' },
    paths: { data: paths.data, logs: paths.logs },
    commands: { doctor: [paths.doctor, 'doctor'] },
  });
  const good = win({ token: 'C:\\Users\\example\\AppData\\Local\\example-agent\\token', data: '~\\AppData\\Local\\example-agent', logs: ['C:/Users/example/AppData/Local/example-agent/logs'], doctor: 'C:\\Program Files\\Example\\example-agent.exe' });
  assert.deepEqual(validateDescriptor(good, 'win32'), []);
  assert.ok(validateDescriptor(good, 'darwin').some((p) => /tokenFile/.test(p)), 'a Windows path is not a path on macOS');
  for (const share of ['\\\\server\\share\\token', '//server/share/token']) {
    assert.ok(validateDescriptor(win({ ...{ token: share, data: '~\\d', logs: [], doctor: 'C:\\x.exe' } }), 'win32').some((p) => /tokenFile/.test(p)), share);
  }
  assert.ok(validateDescriptor(win({ token: 'token', data: '~\\d', logs: [], doctor: 'C:\\x.exe' }), 'win32').some((p) => /tokenFile/.test(p)), 'a relative path is refused');
});

test('FD-37: readDirectory judges paths by the host system it is given, not the one the test runs on', () => {
  const dir = tmp();
  const posix = fx('positive_service-descriptor-unmanaged.json');
  fs.writeFileSync(path.join(dir, `${posix.id}.${posix.instance}.json`), JSON.stringify({ ...posix, paths: { data: '/var/x', logs: [] } }));
  assert.deepEqual(readDirectory(dir, 'darwin')[0]!.problems, []);
  assert.ok(readDirectory(dir, 'win32')[0]!.problems.length, 'a POSIX path is not a Windows path');
});
