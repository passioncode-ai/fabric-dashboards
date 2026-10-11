// The estate updater (FD-30, ADR-0018): pin readers, clone trust, tip comparison, the publisher
// check, the apply gates, and the runner's cadence — first check 90 s after start, then every 6 h,
// one retry within the hour after a failure, nothing while the switch is off. Clocks are fake;
// child processes and file reads arrive as injected stubs, so no test touches git or the registry.
// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { OwnedResult } from '../src/core/children';
import * as estate from '../src/core/estate-update';
import { EstateUpdater, estateEnv, expandHome, readSiblingPins, siblingPinFiles, type Run } from '../src/electron/estate-updater';
import { merge } from '../src/core/settings';
import { CHECK_EVERY_MS, FIRST_CHECK_MS } from '../src/core/version';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/types';
import { tmp } from './helpers';

const REMOTE = 'a'.repeat(40);
const LOCAL = 'b'.repeat(40);

// ── pin readers ──────────────────────────────────────────────────────────────────────────

test('pinFromLockJson reads the commit a lock file pins', () => {
  assert.equal(estate.pinFromLockJson(JSON.stringify({ commit: REMOTE })), REMOTE);
  assert.equal(estate.pinFromLockJson(JSON.stringify({ branch: 'main' })), null, 'no commit field');
  assert.equal(estate.pinFromLockJson('{broken'), null, 'damaged file is not a pin');
});

test('pinFromSourceJson reads currentCommit', () => {
  assert.equal(estate.pinFromSourceJson(JSON.stringify({ currentCommit: LOCAL })), LOCAL);
  assert.equal(estate.pinFromSourceJson(JSON.stringify({ currentCommit: 'not-a-sha' })), null);
});

test('pinFromSourceTxt reads "main @<sha>"', () => {
  assert.equal(estate.pinFromSourceTxt(`Copied from the contract — every file byte-identical to main @${REMOTE} (checked 2026-10-05).`), REMOTE);
  assert.equal(estate.pinFromSourceTxt('no pin here'), null);
});

test('readSiblingPins reads every lock beside the clone, then the fixture pins, and never fails on a missing file', () => {
  const clone = path.join(tmp('fd-estate-pins-'), 'fabric-agent-contract');
  const list = () => ['fabric-agent-contract', 'fabric-agent-adapter', 'sample-agent', 'fabric', '.hidden'];
  const files = siblingPinFiles(clone, list);
  assert.deepEqual(files.map((f) => f.key), ['fabric', 'fabric-agent-adapter', 'sample-agent', 'fabric', 'fabric-dashboards']);
  const read = (file: string) => file.endsWith(path.join('fabric-agent-adapter', 'fabric-contract.lock.json')) ? JSON.stringify({ commit: REMOTE })
    : file.endsWith(path.join('sample-agent', 'fabric-contract.lock.json')) ? JSON.stringify({ commit: REMOTE.slice(0, 7) })
    : file.includes('SOURCE.json') ? JSON.stringify({ currentCommit: LOCAL })
    : null; // fabric has no lock; dashboards SOURCE.txt missing
  const pins = readSiblingPins(read, clone, REMOTE, list);
  assert.deepEqual(pins, [
    { key: 'fabric-agent-adapter', pinned: REMOTE, state: 'current' },
    { key: 'sample-agent', pinned: REMOTE.slice(0, 7), state: 'current' },
    { key: 'fabric', pinned: LOCAL, state: 'behind' },
    { key: 'fabric-dashboards', pinned: null, state: 'unknown' },
  ]);
});

test('a short pin naming the tip is current, as the real SOURCE.txt `main @94b1829` is (review finding 4)', () => {
  const tip = '94b1829c1816' + 'f'.repeat(28);
  assert.equal(estate.pinState(estate.pinFromSourceTxt('byte-identical to main @94b1829 (checked)'), tip), 'current');
  assert.equal(estate.pinState('94b182', tip), 'behind', 'fewer than seven characters is not a pin');
  assert.equal(estate.pinState('0000000', tip), 'behind');
});

// ── clone trust and tips ─────────────────────────────────────────────────────────────────

test('contractCloneState refuses anything that is not the contract repository', () => {
  assert.equal(estate.contractCloneState({ clonePath: '', remoteUrl: null }), 'unconfigured');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'git@github.com:passioncode-ai/fabric-agent-contract.git' }), 'ready');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'https://github.com/someone/else.git' }), 'not-a-clone');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: null }), 'not-a-clone', 'no origin is not a clone');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'https://github.com/evil/fabric-agent-contract-fork.git' }), 'not-a-clone', 'a name inside the URL is not the repository (review finding 12)');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'https://github.com/evil/fabric-agent-contract.git' }), 'not-a-clone', 'another owner is another repository');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'https://github.com/passioncode-ai/fabric-agent-contract' }), 'ready');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'ssh://git@github.com/passioncode-ai/fabric-agent-contract.git' }), 'ready');
});

test('parseLsRemote and parseRevParse read the tips', () => {
  assert.equal(estate.parseLsRemote(`${REMOTE}\trefs/heads/main\n`), REMOTE);
  assert.equal(estate.parseLsRemote(`${'c'.repeat(40)}\trefs/heads/other\n`), null, 'only refs/heads/main counts');
  assert.equal(estate.parseRevParse(`${LOCAL}\n`), LOCAL);
  assert.equal(estate.parseRevParse('fatal: ambiguous argument'), null);
});

test('compareTips: equal is current, different is behind, a missing tip is unknown', () => {
  assert.equal(estate.compareTips(REMOTE, REMOTE.toUpperCase()), 'current');
  assert.equal(estate.compareTips(LOCAL, REMOTE), 'behind');
  assert.equal(estate.compareTips(null, REMOTE), 'unknown');
  assert.equal(estate.compareTips(LOCAL, null), 'unknown');
  assert.equal(estate.shouldFetchContract('behind'), true);
  assert.equal(estate.shouldFetchContract('current'), false);
});

// ── the skills registry ──────────────────────────────────────────────────────────────────

test('parseRegistryVersion reads the first release version; a prerelease is never installed by itself', () => {
  assert.equal(estate.parseRegistryVersion('npm warn something\n1.52.6\n'), '1.52.6');
  assert.equal(estate.parseRegistryVersion('1.53.0-rc.1\n'), null);
  assert.equal(estate.parseRegistryVersion(''), null);
});

const publisher = (o: Record<string, unknown>) => JSON.stringify({ version: '1.52.6', maintainers: ['ssheleg <sergeysheleg4@gmail.com>'], _npmUser: 'ssheleg <sergeysheleg4@gmail.com>', ...o });

test('publisherTrusted: every maintainer and the publisher of the checked version, from the real --json shape (review finding 3)', () => {
  assert.equal(estate.publisherTrusted(publisher({}), '1.52.6'), true, 'the registry answer of 2026-10-07');
  assert.equal(estate.publisherTrusted(publisher({ maintainers: ['ssheleg <a@b>', 'someone <c@d>'] }), '1.52.6'), false, 'one extra maintainer stops the automatic install');
  assert.equal(estate.publisherTrusted(publisher({ _npmUser: 'someone <c@d>' }), '1.52.6'), false, 'published by someone else');
  assert.equal(estate.publisherTrusted(publisher({ maintainers: 'ssheleg <a@b>' }), '1.52.6'), true, 'a single maintainer may come as a string');
  assert.equal(estate.publisherTrusted(publisher({ maintainers: [{ name: 'ssheleg' }], _npmUser: { name: 'ssheleg' } }), '1.52.6'), true, 'the object form');
  assert.equal(estate.publisherTrusted(publisher({ version: '1.52.5' }), '1.52.6'), false, 'not the version that was checked');
  assert.equal(estate.publisherTrusted(publisher({ version: '1.53.0-rc.1' }), '1.53.0-rc.1'), false, 'never a prerelease');
  assert.equal(estate.publisherTrusted(publisher({ maintainers: [] }), '1.52.6'), false, 'nobody named is not trust');
  assert.equal(estate.publisherTrusted('{broken', '1.52.6'), false);
});

test('the skills record heals to unknown and round-trips', () => {
  assert.deepEqual(estate.parseSkillsRecord(null), { installed: null, updatedAt: null });
  assert.deepEqual(estate.parseSkillsRecord('{broken'), { installed: null, updatedAt: null });
  const text = estate.serializeSkillsRecord({ installed: '1.52.6', updatedAt: '2026-10-07T00:00:00Z' });
  assert.deepEqual(estate.parseSkillsRecord(text), { installed: '1.52.6', updatedAt: '2026-10-07T00:00:00Z' });
});

test('decideSkillsApply: the switch first, then a real update, then the trust check', () => {
  assert.deepEqual(estate.decideSkillsApply({ autoSkills: false, trusted: true, updateAvailable: true }), { apply: false, why: 'opted-out' });
  assert.deepEqual(estate.decideSkillsApply({ autoSkills: true, trusted: true, updateAvailable: false }), { apply: false, why: 'nothing-to-do' });
  assert.deepEqual(estate.decideSkillsApply({ autoSkills: true, trusted: false, updateAvailable: true }), { apply: false, why: 'untrusted' });
  assert.deepEqual(estate.decideSkillsApply({ autoSkills: true, trusted: true, updateAvailable: true }), { apply: true });
});

// ── settings merge ───────────────────────────────────────────────────────────────────────

test('estate settings: defaults, a file from an earlier version, and the clone path rule', () => {
  assert.deepEqual(merge({}).estate, { enabled: true, autoSkills: false, contractClone: '' });
  const absolute = process.platform === 'win32' ? 'C:\\work\\fabric-agent-contract' : '/work/fabric-agent-contract'; // FD-37: each system's own form
  assert.deepEqual(merge({ estate: { enabled: false, autoSkills: true, contractClone: absolute } }).estate,
    { enabled: false, autoSkills: true, contractClone: absolute });
  assert.deepEqual(merge({ estate: { contractClone: 'relative/path' } }).estate.contractClone, '', 'a relative path is never used: git -C would resolve it against the app');
  assert.deepEqual(merge({ estate: { enabled: 'yes' } }).estate.enabled, true, 'a wrong type falls back to the default');
  assert.equal(merge({ estate: { contractClone: '~/DATA/fabric-agent-contract' } }).estate.contractClone, '~/DATA/fabric-agent-contract', 'the placeholder\'s own spelling is kept (review finding 7)');
  assert.equal(expandHome('~/DATA/x', '/Users/p', 'darwin'), '/Users/p/DATA/x');
  assert.equal(expandHome('/abs', '/Users/p', 'darwin'), '/abs');
});

// ── the runner ───────────────────────────────────────────────────────────────────────────

const T0 = Date.parse('2026-10-07T12:00:00Z');
const flush = async (n = 5) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setImmediate(r)); };

interface Rig {
  updater: EstateUpdater;
  calls: { command: string; args: string[]; timeoutMs: number }[];
  log: string[];
  changes: () => number;
  dir: string;
  respond: (which: (call: { command: string; args: string[] }) => OwnedResult | undefined) => void;
}

/** A runner whose every command answers per the responder, defaulting to success with no output. */
/** The skills family's folder as its launcher leaves it: a runtime of `version`, and optionally its own update check. */
function familyAt(version: string | null, check?: { at: number; latest: string }): string {
  const dir = tmp('fd-estate-family-');
  if (version !== null) {
    fs.mkdirSync(path.join(dir, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'runtime', 'package.json'), JSON.stringify({ name: 'sshlg-skills', version }));
  }
  if (check) fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ updateCheck: check }));
  return dir;
}

function rig(o?: { settings?: Settings; cloneDir?: string; record?: string | null; familyDir?: string; now?: () => number }) {
  const dir = tmp('fd-estate-run-');
  if (o?.record !== undefined && o.record !== null) fs.writeFileSync(path.join(dir, 'estate-skills.json'), o.record);
  const familyDir = o?.familyDir ?? familyAt('1.52.5');
  const settings: Settings = o?.settings ?? { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: false, contractClone: o?.cloneDir ?? '' } };
  const calls: Rig['calls'] = [];
  const log: string[] = [];
  let changes = 0;
  let responder: (call: { command: string; args: string[] }) => OwnedResult | undefined = () => undefined;
  const run: Run = async (command, args, timeoutMs) => {
    const call = { command, args, timeoutMs };
    calls.push(call);
    return responder(call) ?? { code: 0, output: '', timedOut: false, started: true, signal: null };
  };
  const updater = new EstateUpdater({ settings: () => settings, log: (m) => log.push(m), onChange: () => { changes += 1; }, dataDir: dir, run, familyDir, now: o?.now });
  return { updater, calls, log, changes: () => changes, dir, respond: (r) => { responder = r; } } satisfies Rig;
}

const ok = (output = ''): OwnedResult => ({ code: 0, output, timedOut: false, started: true, signal: null });
const fail = (output: string): OwnedResult => ({ code: 1, output, timedOut: false, started: true, signal: null });

test('LC-16 cadence: the first check runs 90 s after start, then every 6 h; off means nothing runs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls } = rig();
  try {
    updater.start();
    await flush();
    assert.equal(calls.length, 0, 'nothing before the first check');
    t.mock.timers.tick(FIRST_CHECK_MS - 1);
    await flush();
    assert.equal(calls.length, 0);
    t.mock.timers.tick(1);
    await flush();
    assert.ok(calls.length > 0, 'the first check ran at 90 s');
    const afterFirst = calls.length;
    t.mock.timers.tick(CHECK_EVERY_MS);
    await flush();
    assert.ok(calls.length > afterFirst, 'the 6-hour interval fired');
  } finally {
    updater.stop();
  }
});

test('the switch off at start arms nothing; toggling it mid-run starts and stops cleanly', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: false, autoSkills: false, contractClone: '' } };
  const { updater, calls } = rig({ settings });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS + CHECK_EVERY_MS);
    await flush();
    assert.equal(calls.length, 0, 'off: no probe ever runs');
    settings.estate.enabled = true;
    updater.switched(true);
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.ok(calls.length > 0, 'on: the first check is armed again');
    const done = calls.length;
    settings.estate.enabled = false;
    updater.switched(false);
    t.mock.timers.tick(CHECK_EVERY_MS * 2);
    await flush();
    assert.equal(calls.length, done, 'off again: the timers stopped');
  } finally {
    updater.stop();
  }
});

test('a contract behind the remote is fetched and never pulled; pins are read, never rewritten', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const clone = path.join(tmp('fd-estate-clone-'), 'fabric-agent-contract');
  fs.mkdirSync(clone, { recursive: true });
  const { updater, calls, log, respond } = rig({ cloneDir: clone });
  let fetchedYet = false;
  respond((call) => {
    if (call.args[2] === 'remote') return ok('git@github.com:passioncode-ai/fabric-agent-contract.git');
    if (call.args[2] === 'ls-remote') return ok(`${REMOTE}\trefs/heads/main`);
    if (call.args[2] === 'rev-parse' && call.args.includes('refs/remotes/origin/main')) return ok(fetchedYet ? REMOTE : LOCAL);
    if (call.args[2] === 'rev-parse') return ok(LOCAL);
    if (call.args[2] === 'fetch') { fetchedYet = true; return ok(); }
    if (call.command === 'npm') return ok('1.52.6\n');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    const argv = (needle: string) => calls.find((c) => c.args.includes(needle));
    assert.ok(argv('ls-remote'), 'probed the remote tip');
    assert.ok(argv('rev-parse'), 'read the local tip');
    const fetched = argv('fetch');
    assert.ok(fetched, 'a behind clone is fetched');
    assert.deepEqual(fetched!.args, ['-C', clone, 'fetch', 'origin']);
    assert.equal(fetched!.timeoutMs, 30_000);
    assert.ok(!calls.some((c) => ['pull', 'reset', 'rebase', 'checkout'].some((w) => c.args.includes(w))), 'never pull, reset or rebase');
    assert.ok(argv('refs/heads/main') && calls.some((c) => c.args.includes('--verify')), 'tips are read by full ref, never an ambiguous name (review finding 13)');
    assert.ok(log.some((l) => l.startsWith('estate_check ok') && l.includes('contract=current fetched=yes')), 'after the fetch the clone knows the remote main (review finding 14)');
    assert.ok(log.some((l) => l.startsWith('estate_update done') && l.includes('target=contract')), 'the fetch logged as an update');
    assert.equal(updater.state.contract.state, 'current');
    assert.equal(updater.state.contract.remoteTip, REMOTE);
    assert.equal(updater.state.contract.knownTip, REMOTE);
    assert.equal(updater.state.contract.localTip, LOCAL, 'the clone\'s own main is reported and never moved');
    assert.deepEqual(updater.state.pins.map((p) => p.key), ['fabric', 'fabric-dashboards'], 'no lock beside this clone: only the fixture pins');
    assert.ok(updater.state.pins.every((p) => p.state === 'unknown'), 'no sibling checkouts here: every pin reads as unknown, not a failure');
  } finally {
    updater.stop();
  }
});

test('a folder that is not a contract clone is refused: no probe runs against it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const clone = path.join(tmp('fd-estate-foreign-'), 'some-other-repo');
  fs.mkdirSync(clone, { recursive: true });
  const { updater, calls, log, respond } = rig({ cloneDir: clone });
  respond((call) => (call.args[2] === 'remote' ? ok('git@github.com:someone/else.git') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.contract.state, 'not-a-clone');
    assert.ok(!calls.some((c) => c.args.includes('ls-remote')), 'a foreign folder is never probed');
    assert.ok(log.some((l) => l.startsWith('estate_check failed') && l.includes('not-a-clone')));
  } finally {
    updater.stop();
  }
});

test('skills: a newer registry version is reported; with the switch on and the publisher trusted it applies and records', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const record = estate.serializeSkillsRecord({ installed: '1.52.5', updatedAt: '2026-10-01T00:00:00Z' });
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: true, contractClone: '' } };
  const { updater, calls, log, dir, respond } = rig({ settings, record });
  respond((call) => {
    if (call.command === 'npm' && call.args.includes('--json')) return ok(publisher({}));
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    const apply = calls.find((c) => c.command === 'npx');
    assert.ok(apply, 'the apply ran');
    assert.deepEqual(apply!.args, ['--yes', 'sshlg-skills@1.52.6', 'update'], 'exactly the version that was checked runs (review finding 2)');
    assert.ok(calls.some((c) => c.command === 'npm' && c.args.join(' ') === 'view sshlg-skills@1.52.6 version maintainers _npmUser --json'), 'the publisher of that version is checked');
    assert.equal(apply!.timeoutMs, 10 * 60_000, 'the apply gets the 10-minute bound');
    assert.deepEqual(estate.parseSkillsRecord(fs.readFileSync(path.join(dir, 'estate-skills.json'), 'utf8')),
      { installed: '1.52.6', updatedAt: new Date(T0 + FIRST_CHECK_MS).toISOString() }, 'the record moved only on exit 0');
    assert.equal(updater.state.skills.state, 'current');
    assert.ok(log.some((l) => l.startsWith('estate_update done') && l.includes('target=skills version=1.52.6')));
    assert.ok(log.some((l) => l.startsWith('estate_check ok') && l.includes('skills=current')));
  } finally {
    updater.stop();
  }
});

test('skills: no record yet — with the switch on and the publisher trusted the first apply bootstraps the record', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: true, contractClone: '' } };
  const { updater, calls, dir, respond } = rig({ settings });
  respond((call) => {
    if (call.command === 'npm' && call.args.includes('--json')) return ok(publisher({}));
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.ok(calls.some((c) => c.command === 'npx'), 'the first apply runs with no record yet — the reconcile reconciles, it never removes');
    assert.equal(estate.parseSkillsRecord(fs.readFileSync(path.join(dir, 'estate-skills.json'), 'utf8')).installed, '1.52.6', 'the record bootstraps on exit 0');
    assert.equal(updater.state.skills.state, 'current');
  } finally {
    updater.stop();
  }
});

test('skills: with the switch off a newer version is reported and nothing runs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, respond } = rig();
  respond((call) => (call.command === 'npm' && call.args[2] === 'version' ? ok('1.52.6\n') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.skills.state, 'update-available', 'the installed version is the family runtime\'s, record or not (FD-34)');
    assert.ok(!calls.some((c) => c.command === 'npx'), 'no apply without the switch');
  } finally {
    updater.stop();
  }
});

test('skills: the publisher check refuses an unexpected owner and nothing runs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const record = estate.serializeSkillsRecord({ installed: '1.52.5', updatedAt: null });
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: true, contractClone: '' } };
  const { updater, calls, log, dir, respond } = rig({ settings, record });
  respond((call) => {
    if (call.command === 'npm' && call.args.includes('--json')) return ok(publisher({ maintainers: ['intruder <intruder@example.com>'], _npmUser: 'intruder <intruder@example.com>' }));
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.ok(!calls.some((c) => c.command === 'npx'), 'an untrusted publisher is never applied');
    assert.ok(log.some((l) => l.startsWith('estate_update refused') && l.includes('reason=untrusted')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'estate-skills.json'), 'utf8')).installed, '1.52.5', 'the record did not move');
    assert.equal(updater.state.skills.state, 'update-available');
  } finally {
    updater.stop();
  }
});

test('skills: a failed apply leaves the record and the state so the next check tries again', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const record = estate.serializeSkillsRecord({ installed: '1.52.5', updatedAt: null });
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: true, contractClone: '' } };
  const { updater, log, dir, respond } = rig({ settings, record });
  respond((call) => {
    if (call.command === 'npm' && call.args.includes('--json')) return ok(publisher({}));
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    if (call.command === 'npx') return fail('update crashed');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.ok(log.some((l) => l.startsWith('estate_update failed') && l.includes('target=skills')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'estate-skills.json'), 'utf8')).installed, '1.52.5', 'no exit 0, no record move');
    assert.equal(updater.state.skills.state, 'update-available');
    assert.ok(log.some((l) => l.startsWith('estate_check failed')), 'a failed apply is a failed check, which earns the LC-16 retry (review finding 10)');
  } finally {
    updater.stop();
  }
});

test('skills: without the family installed nothing is asked about it — no registry, no failure (FD-34)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, log } = rig({ familyDir: familyAt(null) });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.skills.state, 'absent');
    assert.ok(!calls.some((c) => c.command === 'npm' || c.command === 'npx'), 'a public install never asks npm about the operator\'s family');
    assert.ok(log.some((l) => l.startsWith('estate_check ok') && l.includes('skills=absent')));
  } finally {
    updater.stop();
  }
});

test('skills: the launcher\'s own check, under a day old, answers without the registry; an older one does not (FD-34)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const at = T0 + FIRST_CHECK_MS - 60_000;
  const fresh = rig({ familyDir: familyAt('1.53.0', { at, latest: '1.53.0' }), now: () => T0 + FIRST_CHECK_MS });
  try {
    fresh.updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(fresh.updater.state.skills.state, 'current');
    assert.ok(!fresh.calls.some((c) => c.command === 'npm'), 'a fresh launcher check is the answer');
  } finally {
    fresh.updater.stop();
  }
  const stale = rig({ familyDir: familyAt('1.53.0', { at: at - 2 * 24 * 60 * 60_000, latest: '1.53.0' }), now: () => T0 + FIRST_CHECK_MS });
  stale.respond((call) => (call.command === 'npm' ? ok('1.54.0\n') : undefined));
  try {
    stale.updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.ok(stale.calls.some((c) => c.command === 'npm'), 'a stale launcher check sends the question to the registry');
    assert.equal(stale.updater.state.skills.state, 'update-available');
    assert.equal(stale.updater.state.skills.installed, '1.53.0');
  } finally {
    stale.updater.stop();
  }
});

test('skills: an update the person or an agent ran is seen — the runtime, not this app\'s record, is installed (FD-34)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const record = estate.serializeSkillsRecord({ installed: '1.40.0', updatedAt: null });
  const { updater, calls, respond } = rig({ record, familyDir: familyAt('1.52.6') });
  respond((call) => (call.command === 'npm' && call.args[2] === 'version' ? ok('1.52.6\n') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.skills.state, 'current');
    assert.equal(updater.state.skills.installed, '1.52.6');
    assert.ok(!calls.some((c) => c.command === 'npx'));
  } finally {
    updater.stop();
  }
});

test('familyRuntimeVersion, launcherLatest and compareReleases read only what they should', () => {
  assert.equal(estate.familyRuntimeVersion(JSON.stringify({ name: 'sshlg-skills', version: '1.53.0' })), '1.53.0');
  assert.equal(estate.familyRuntimeVersion(JSON.stringify({ name: 'other', version: '1.53.0' })), null);
  assert.equal(estate.familyRuntimeVersion(JSON.stringify({ name: 'sshlg-skills', version: '1.54.0-rc.1' })), null);
  assert.equal(estate.familyRuntimeVersion('{broken'), null);
  assert.equal(estate.launcherLatest(JSON.stringify({ updateCheck: { at: 1000, latest: '1.53.0' } }), 2000, 5000), '1.53.0');
  assert.equal(estate.launcherLatest(JSON.stringify({ updateCheck: { at: 1000, latest: '1.53.0' } }), 9000, 5000), null, 'too old');
  assert.equal(estate.launcherLatest(JSON.stringify({ updateCheck: { at: 9000, latest: '1.53.0' } }), 1000, 5000), null, 'from the future is not fresh');
  assert.equal(estate.compareReleases('1.10.0', '1.9.9'), 1);
  assert.equal(estate.compareReleases('1.53.0', '1.53.0'), 0);
  assert.equal(estate.compareReleases('0.9.0', '1.0.0'), -1);
});

test('one retry within the hour after a failed check, then back to the 6-hour rhythm', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, log, respond } = rig();
  respond((call) => (call.command === 'npm' ? fail('registry unreachable') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    const afterFirst = calls.length;
    assert.ok(log.some((l) => l.startsWith('estate_check failed')));
    assert.equal(updater.state.skills.state, 'error', 'a registry that did not answer is an error, not "not tracked yet" (review finding 5)');
    t.mock.timers.tick(45 * 60_000); // LC-16: one retry within the hour
    await flush();
    assert.ok(calls.length > afterFirst, 'the retry ran');
    const afterRetry = calls.length;
    t.mock.timers.tick(45 * 60_000);
    await flush();
    assert.equal(calls.length, afterRetry, 'only one retry: the next try waits for the 6-hour interval');
    t.mock.timers.tick(CHECK_EVERY_MS - 90 * 60_000);
    await flush();
    assert.ok(calls.length > afterRetry, 'the interval check ran again');
  } finally {
    updater.stop();
  }
});

test('every estate child gets the login shell\'s PATH and never a git prompt (review finding 1, FD-33)', () => {
  const env = estateEnv(['/opt/homebrew/bin', '/usr/bin'], { PATH: '/usr/bin:/bin', ELECTRON_RUN_AS_NODE: '1', HOME: '/Users/p' });
  assert.equal(env.PATH, ['/opt/homebrew/bin', '/usr/bin'].join(path.delimiter), 'launchd\'s PATH is replaced, so npm, npx and node resolve');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.ELECTRON_RUN_AS_NODE, undefined, 'the descriptor-safe stripping still applies');
  assert.equal(env.HOME, '/Users/p');
});

test('the default runner resolves the search path once and passes it to every child', async () => {
  let asked = 0;
  const dir = tmp('fd-estate-path-');
  const settings: Settings = { ...DEFAULT_SETTINGS, estate: { enabled: true, autoSkills: false, contractClone: '' } };
  const updater = new EstateUpdater({ settings: () => settings, log: () => {}, onChange: () => {}, dataDir: dir,
    familyDir: familyAt('1.52.5'), searchPath: async () => { asked += 1; return ['/nowhere-estate-test']; } });
  // `npm` is not in /nowhere-estate-test, so the probe fails to start — the point is that it looked there.
  await (updater as unknown as { check: () => Promise<void> }).check();
  await (updater as unknown as { check: () => Promise<void> }).check();
  assert.equal(asked, 1, 'read once, reused');
  assert.equal(updater.state.skills.state, 'error');
});

test('stop() means nothing starts afterwards: no child, no retry (review finding 11)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, respond } = rig();
  respond((call) => (call.command === 'npm' ? fail('registry unreachable') : undefined));
  updater.start();
  updater.stop();
  t.mock.timers.tick(FIRST_CHECK_MS + CHECK_EVERY_MS);
  await flush();
  assert.equal(calls.length, 0);
  updater.switched(true);
  updater.checkSoon();
  t.mock.timers.tick(FIRST_CHECK_MS);
  await flush();
  assert.equal(calls.length, 0, 'a switch or a settings change after quit does not restart it');
});

test('a settings change checks again within seconds, not hours (review finding 7)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, respond } = rig();
  respond((call) => (call.command === 'npm' ? ok('1.52.6\n') : undefined));
  try {
    updater.start();
    updater.checkSoon();
    updater.checkSoon();
    t.mock.timers.tick(5_000);
    await flush();
    assert.equal(calls.filter((c) => c.command === 'npm').length, 1, 'a burst of edits is one check');
  } finally {
    updater.stop();
  }
});

test('a named folder that does not exist is reported as missing, not as "not a clone" (review finding 16)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls } = rig({ cloneDir: path.join(tmp('fd-estate-missing-'), 'nope') });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.contract.state, 'missing');
    assert.ok(!calls.some((c) => c.command === 'git'), 'no git runs against a folder that is not there');
  } finally {
    updater.stop();
  }
});
// #endregion estate-update

test('FD-37: a contract clone typed as ~\\ resolves against the home folder on Windows', () => {
  assert.equal(expandHome('~\\DATA\\fabric-agent-contract', 'C:\\Users\\e', 'win32'), 'C:\\Users\\e\\DATA\\fabric-agent-contract');
  assert.equal(expandHome('~', 'C:\\Users\\e', 'win32'), 'C:\\Users\\e');
  assert.equal(expandHome('~/x', '/home/e', 'linux'), '/home/e/x');
});
