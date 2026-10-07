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
import { EstateUpdater, readSiblingPins, siblingPinFiles, type Run } from '../src/electron/estate-updater';
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

test('readSiblingPins reports each consumer pin and never fails on a missing file', () => {
  const clone = path.join(tmp('fd-estate-pins-'), 'fabric-agent-contract');
  const files = siblingPinFiles(clone);
  assert.deepEqual(files.map((f) => f.key), ['fabric-agent-adapter', 'fabric', 'fabric-dashboards']);
  const read = (file: string) => file.includes('fabric-agent-adapter') ? JSON.stringify({ commit: REMOTE })
    : file.includes('SOURCE.json') ? JSON.stringify({ currentCommit: LOCAL })
    : null; // dashboards SOURCE.txt missing
  const pins = readSiblingPins(read, clone, REMOTE);
  assert.deepEqual(pins, [
    { key: 'fabric-agent-adapter', pinned: REMOTE, state: 'current' },
    { key: 'fabric', pinned: LOCAL, state: 'behind' },
    { key: 'fabric-dashboards', pinned: null, state: 'unknown' },
  ]);
});

// ── clone trust and tips ─────────────────────────────────────────────────────────────────

test('contractCloneState refuses anything that is not the contract repository', () => {
  assert.equal(estate.contractCloneState({ clonePath: '', remoteUrl: null }), 'unconfigured');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'git@github.com:passioncode-ai/fabric-agent-contract.git' }), 'ready');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: 'https://github.com/someone/else.git' }), 'not-a-clone');
  assert.equal(estate.contractCloneState({ clonePath: '/x', remoteUrl: null }), 'not-a-clone', 'no origin is not a clone');
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

test('parseRegistryVersion reads the first version-looking line', () => {
  assert.equal(estate.parseRegistryVersion('\n1.52.6\n'), '1.52.6');
  assert.equal(estate.parseRegistryVersion('npm warn ignored\n1.2.3-rc.1\n'), '1.2.3-rc.1');
  assert.equal(estate.parseRegistryVersion('npm ERR! 404'), null);
});

test('maintainersTrusted checks the publisher against the real registry output', () => {
  // The value `npm view sshlg-skills maintainers` returned on 2026-10-07:
  assert.equal(estate.maintainersTrusted('ssheleg <sergeysheleg4@gmail.com>'), true);
  assert.equal(estate.maintainersTrusted('someone <other@example.com>\nssheleg <sergeysheleg4@gmail.com>'), true);
  assert.equal(estate.maintainersTrusted('someone <other@example.com>'), false);
  assert.equal(estate.maintainersTrusted('["ssheleg <sergeysheleg4@gmail.com>"]'), true, 'the JSON array shape npm can print');
  assert.equal(estate.maintainersTrusted('{broken'), false);
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
  assert.deepEqual(merge({ estate: { enabled: false, autoSkills: true, contractClone: '/work/fabric-agent-contract' } }).estate,
    { enabled: false, autoSkills: true, contractClone: '/work/fabric-agent-contract' });
  assert.deepEqual(merge({ estate: { contractClone: 'relative/path' } }).estate.contractClone, '', 'a relative path is never used: git -C would resolve it against the app');
  assert.deepEqual(merge({ estate: { enabled: 'yes' } }).estate.enabled, true, 'a wrong type falls back to the default');
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
function rig(o?: { settings?: Settings; cloneDir?: string; record?: string | null }) {
  const dir = tmp('fd-estate-run-');
  if (o?.record !== undefined && o.record !== null) fs.writeFileSync(path.join(dir, 'estate-skills.json'), o.record);
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
  const updater = new EstateUpdater({ settings: () => settings, log: (m) => log.push(m), onChange: () => { changes += 1; }, dataDir: dir, run });
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
  respond((call) => {
    if (call.args[2] === 'remote') return ok('git@github.com:passioncode-ai/fabric-agent-contract.git');
    if (call.args[2] === 'ls-remote') return ok(`${REMOTE}\trefs/heads/main`);
    if (call.args[2] === 'rev-parse') return ok(LOCAL);
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
    assert.ok(log.some((l) => l.startsWith('estate_check ok') && l.includes('contract=behind')), 'the check logged the state');
    assert.ok(log.some((l) => l.startsWith('estate_update done') && l.includes('target=contract')), 'the fetch logged as an update');
    assert.equal(updater.state.contract.state, 'behind');
    assert.equal(updater.state.contract.remoteTip, REMOTE);
    assert.equal(updater.state.contract.localTip, LOCAL);
    assert.deepEqual(updater.state.pins.map((p) => p.key), ['fabric-agent-adapter', 'fabric', 'fabric-dashboards']);
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
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    if (call.command === 'npm' && call.args[2] === 'maintainers') return ok('ssheleg <sergeysheleg4@gmail.com>');
    return undefined;
  });
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    const apply = calls.find((c) => c.command === 'npx');
    assert.ok(apply, 'the apply ran');
    assert.deepEqual(apply!.args, ['--yes', 'sshlg-skills', 'update']);
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
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    if (call.command === 'npm' && call.args[2] === 'maintainers') return ok('ssheleg <sergeysheleg4@gmail.com>');
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

test('skills: no record yet with the switch off reports unknown and nothing runs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, respond } = rig();
  respond((call) => (call.command === 'npm' && call.args[2] === 'version' ? ok('1.52.6\n') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.skills.state, 'unknown');
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
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    if (call.command === 'npm' && call.args[2] === 'maintainers') return ok('intruder <intruder@example.com>');
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
    if (call.command === 'npm' && call.args[2] === 'version') return ok('1.52.6\n');
    if (call.command === 'npm' && call.args[2] === 'maintainers') return ok('ssheleg <sergeysheleg4@gmail.com>');
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
  } finally {
    updater.stop();
  }
});

test('skills: without a record the state is unknown — tracked from the first run or apply', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { updater, calls, respond } = rig();
  respond((call) => (call.command === 'npm' && call.args[2] === 'version' ? ok('1.52.6\n') : undefined));
  try {
    updater.start();
    t.mock.timers.tick(FIRST_CHECK_MS);
    await flush();
    assert.equal(updater.state.skills.state, 'unknown');
    assert.equal(updater.state.skills.installed, null);
    assert.equal(updater.state.skills.latest, '1.52.6');
    assert.ok(!calls.some((c) => c.command === 'npx'), 'nothing to apply against an unknown record');
  } finally {
    updater.stop();
  }
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
// #endregion estate-update
